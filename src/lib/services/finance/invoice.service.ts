// ============================================================
// Invoice Service (الفواتير)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Invoice, Customer, Supplier, Payment } from '@/types/database';
import type { InvoiceType, InvoiceStatus } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateInvoiceDTO {
    invoice_type: InvoiceType;
    job_order_id?: string | null;
    customer_id?: string | null;
    supplier_id?: string | null;
    branch_id: string;
    subtotal: number;
    discount_amount?: number;
    tax_percent?: number;
    tax_amount?: number;
    total_amount: number;
    due_date?: string;
    notes?: string;
}

export interface UpdateInvoiceDTO extends Partial<Omit<CreateInvoiceDTO, 'invoice_type'>> {
    status?: InvoiceStatus;
    paid_amount?: number;
    cancelled_by?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    approved_by?: string;
}

export interface InvoiceFilters {
    invoice_type?: InvoiceType;
    status?: InvoiceStatus | InvoiceStatus[];
    customer_id?: string;
    supplier_id?: string;
    branch_id?: string;
    date_from?: string;
    date_to?: string;
    overdue?: boolean;
}

export interface InvoiceWithRelations extends Invoice {
    customer?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
    supplier?: Pick<Supplier, 'id' | 'name' | 'phone'> | null;
    payments?: Payment[];
}

// ============================================================
// Invoice Service
// ============================================================

class InvoiceService extends BaseService<Invoice, CreateInvoiceDTO, UpdateInvoiceDTO> {
    protected tableName = 'invoices';
    protected selectColumns = `
    id, code, invoice_type, job_order_id, customer_id, supplier_id, branch_id,
    subtotal, discount_amount, tax_percent, tax_amount, total_amount,
    paid_amount, remaining_amount, status, due_date,
    cancelled_by, cancelled_at, cancellation_reason,
    has_credit_notes, has_debit_notes, notes,
    created_by, approved_by, created_at, updated_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get invoices with filters
     */
    async getInvoices(
        params: Partial<PaginationParams> = {},
        filters: InvoiceFilters = {}
    ): Promise<PaginatedResponse<InvoiceWithRelations>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        supplier:suppliers (id, name, phone)
      `, { count: 'exact' });

        // Apply filters
        if (filters.invoice_type) {
            query = query.eq('invoice_type', filters.invoice_type);
        }
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }
        if (filters.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters.supplier_id) {
            query = query.eq('supplier_id', filters.supplier_id);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to);
        }
        if (filters.overdue) {
            const today = new Date().toISOString().split('T')[0];
            query = query
                .lt('due_date', today)
                .neq('status', 'paid')
                .neq('status', 'cancelled');
        }

        query = query
            .range(from, to)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as InvoiceWithRelations[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get invoice with payments
     */
    async getInvoiceDetail(id: string): Promise<InvoiceWithRelations> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (*),
        supplier:suppliers (*),
        payments (*)
      `)
            .eq('id', id)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as InvoiceWithRelations;
    }

    /**
     * Get unpaid invoices
     */
    async getUnpaidInvoices(type?: 'sales' | 'purchase'): Promise<InvoiceWithRelations[]> {
        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        supplier:suppliers (id, name, phone)
      `)
            .gt('remaining_amount', 0)
            .neq('status', 'cancelled')
            .order('due_date', { ascending: true });

        if (type) {
            query = query.eq('invoice_type', type);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as InvoiceWithRelations[];
    }

    /**
     * Get overdue invoices
     */
    async getOverdueInvoices(): Promise<InvoiceWithRelations[]> {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        supplier:suppliers (id, name, phone)
      `)
            .lt('due_date', today)
            .gt('remaining_amount', 0)
            .neq('status', 'cancelled')
            .order('due_date', { ascending: true });

        if (error) handleSupabaseError(error);
        return data as unknown as InvoiceWithRelations[];
    }

    /**
     * Update invoice status based on payments
     */
    async updateStatusFromPayment(invoiceId: string, paidAmount: number): Promise<Invoice> {
        const invoice = await this.getById(invoiceId);
        const newPaidAmount = invoice.paid_amount + paidAmount;

        let newStatus: InvoiceStatus = 'partial';
        if (newPaidAmount >= invoice.total_amount) {
            newStatus = 'paid';
        } else if (newPaidAmount === 0) {
            newStatus = 'approved';
        }

        return this.update(invoiceId, {
            paid_amount: newPaidAmount,
            status: newStatus,
        });
    }

    /**
     * Approve invoice
     */
    async approveInvoice(id: string, approvedBy: string): Promise<Invoice> {
        return this.update(id, {
            status: 'approved',
            approved_by: approvedBy,
        });
    }

    /**
     * Cancel invoice
     */
    async cancelInvoice(id: string, cancelledBy: string, reason: string): Promise<Invoice> {
        return this.update(id, {
            status: 'cancelled',
            cancelled_by: cancelledBy,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason,
        });
    }

    /**
     * Get revenue summary
     */
    async getRevenueSummary(
        branchId?: string,
        dateFrom?: string,
        dateTo?: string
    ): Promise<{
        totalSales: number;
        totalPurchases: number;
        netRevenue: number;
        unpaidSales: number;
        unpaidPurchases: number;
    }> {
        let salesQuery = supabase
            .from(this.tableName)
            .select('total_amount, remaining_amount')
            .eq('invoice_type', 'sales')
            .neq('status', 'cancelled');

        let purchasesQuery = supabase
            .from(this.tableName)
            .select('total_amount, remaining_amount')
            .eq('invoice_type', 'purchase')
            .neq('status', 'cancelled');

        if (branchId) {
            salesQuery = salesQuery.eq('branch_id', branchId);
            purchasesQuery = purchasesQuery.eq('branch_id', branchId);
        }
        if (dateFrom) {
            salesQuery = salesQuery.gte('created_at', dateFrom);
            purchasesQuery = purchasesQuery.gte('created_at', dateFrom);
        }
        if (dateTo) {
            salesQuery = salesQuery.lte('created_at', dateTo);
            purchasesQuery = purchasesQuery.lte('created_at', dateTo);
        }

        const [salesResult, purchasesResult] = await Promise.all([
            salesQuery,
            purchasesQuery,
        ]);

        if (salesResult.error) handleSupabaseError(salesResult.error);
        if (purchasesResult.error) handleSupabaseError(purchasesResult.error);

        const salesData = salesResult.data || [];
        const purchasesData = purchasesResult.data || [];

        const totalSales = salesData.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        const totalPurchases = purchasesData.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        const unpaidSales = salesData.reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0);
        const unpaidPurchases = purchasesData.reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0);

        return {
            totalSales,
            totalPurchases,
            netRevenue: totalSales - totalPurchases,
            unpaidSales,
            unpaidPurchases,
        };
    }
}

export const invoiceService = new InvoiceService();
export default invoiceService;
