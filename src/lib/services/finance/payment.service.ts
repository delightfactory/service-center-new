// ============================================================
// Payment Service (المدفوعات)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Payment, Customer, Supplier, Invoice } from '@/types/database';
import type { PaymentType, PaymentMethod } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreatePaymentDTO {
    payment_type: PaymentType;
    payment_method: PaymentMethod;
    treasury_id: string;
    invoice_id?: string | null;
    job_order_id?: string | null;
    customer_id?: string | null;
    supplier_id?: string | null;
    amount: number;
    payment_date?: string;
    reference?: string;
    cheque_number?: string;
    cheque_date?: string;
    cheque_bank?: string;
    notes?: string;
    branch_id: string;
}

export interface PaymentFilters {
    payment_type?: PaymentType;
    payment_method?: PaymentMethod;
    treasury_id?: string;
    customer_id?: string;
    supplier_id?: string;
    invoice_id?: string;
    branch_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface PaymentWithRelations extends Payment {
    customer?: Pick<Customer, 'id' | 'name'> | null;
    supplier?: Pick<Supplier, 'id' | 'name'> | null;
    invoice?: Pick<Invoice, 'id' | 'code' | 'total_amount'> | null;
}

// ============================================================
// Payment Service
// ============================================================

class PaymentService extends BaseService<Payment, CreatePaymentDTO, never> {
    protected tableName = 'payments';
    protected selectColumns = `
    id, code, payment_type, payment_method, treasury_id,
    invoice_id, job_order_id, customer_id, supplier_id,
    amount, payment_date, reference,
    cheque_number, cheque_date, cheque_bank,
    notes, branch_id, created_by, created_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get payments with filters
     */
    async getPayments(
        params: Partial<PaginationParams> = {},
        filters: PaymentFilters = {}
    ): Promise<PaginatedResponse<PaymentWithRelations>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name),
        supplier:suppliers (id, name),
        invoice:invoices (id, code, total_amount)
      `, { count: 'exact' });

        // Apply filters
        if (filters.payment_type) {
            query = query.eq('payment_type', filters.payment_type);
        }
        if (filters.payment_method) {
            query = query.eq('payment_method', filters.payment_method);
        }
        if (filters.treasury_id) {
            query = query.eq('treasury_id', filters.treasury_id);
        }
        if (filters.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters.supplier_id) {
            query = query.eq('supplier_id', filters.supplier_id);
        }
        if (filters.invoice_id) {
            query = query.eq('invoice_id', filters.invoice_id);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.date_from) {
            query = query.gte('payment_date', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('payment_date', filters.date_to);
        }

        query = query
            .range(from, to)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as PaymentWithRelations[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get payments by invoice
     */
    async getByInvoice(invoiceId: string): Promise<Payment[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('invoice_id', invoiceId)
            .order('payment_date', { ascending: false });

        if (error) handleSupabaseError(error);
        return (data as unknown as Payment[]) || [];
    }

    /**
     * Get payments by customer
     */
    async getByCustomer(customerId: string, limit: number = 50): Promise<PaymentWithRelations[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        invoice:invoices (id, code, total_amount)
      `)
            .eq('customer_id', customerId)
            .order('payment_date', { ascending: false })
            .limit(limit);

        if (error) handleSupabaseError(error);
        return data as unknown as PaymentWithRelations[];
    }

    /**
     * Get today's payments
     */
    async getTodayPayments(branchId?: string): Promise<PaymentWithRelations[]> {
        const today = new Date().toISOString().split('T')[0];

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name),
        supplier:suppliers (id, name)
      `)
            .eq('payment_date', today)
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as PaymentWithRelations[];
    }

    /**
     * Create payment for invoice
     * Note: Invoice update (paid_amount, status) is handled automatically 
     * by database trigger trg_payment_update_invoice
     */
    async createPaymentForInvoice(
        invoiceId: string,
        paymentData: Omit<CreatePaymentDTO, 'invoice_id'>
    ): Promise<Payment> {
        // Create payment - invoice will be updated automatically by trigger
        const payment = await this.create({
            ...paymentData,
            invoice_id: invoiceId,
        });

        return payment;
    }

    /**
     * Get payment summary
     */
    async getPaymentSummary(
        branchId?: string,
        dateFrom?: string,
        dateTo?: string
    ): Promise<{
        totalReceipts: number;
        totalPayouts: number;
        netCashFlow: number;
        byMethod: Record<PaymentMethod, number>;
    }> {
        let query = supabase
            .from(this.tableName)
            .select('payment_type, payment_method, amount');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (dateFrom) {
            query = query.gte('payment_date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('payment_date', dateTo);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);

        let totalReceipts = 0;
        let totalPayouts = 0;
        const byMethod: Record<PaymentMethod, number> = {
            cash: 0,
            card: 0,
            bank_transfer: 0,
            cheque: 0,
            online: 0,
        };

        (data || []).forEach(payment => {
            byMethod[payment.payment_method as PaymentMethod] += payment.amount;

            if (['customer_receipt', 'refund_from_supplier'].includes(payment.payment_type)) {
                totalReceipts += payment.amount;
            } else {
                totalPayouts += payment.amount;
            }
        });

        return {
            totalReceipts,
            totalPayouts,
            netCashFlow: totalReceipts - totalPayouts,
            byMethod,
        };
    }
}

export const paymentService = new PaymentService();
export default paymentService;
