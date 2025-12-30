// ============================================================
// Customer Service
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Customer, Vehicle } from '@/types/database';
import type { CustomerType } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateCustomerDTO {
    name: string;
    customer_type?: CustomerType;
    phone?: string;
    phone_alt?: string;
    email?: string;
    address?: string;
    tax_number?: string;
    notes?: string;
    branch_id?: string | null;  // Made optional - not required in DB schema
}

export interface UpdateCustomerDTO extends Partial<CreateCustomerDTO> {
    is_active?: boolean;
}

export interface CustomerFilters {
    customer_type?: CustomerType;
    branch_id?: string;
    is_active?: boolean;
    has_balance?: boolean;
}

export interface CustomerWithVehicles extends Customer {
    vehicles: Vehicle[];
}

// ============================================================
// Customer Service
// ============================================================

class CustomerService extends BaseService<Customer, CreateCustomerDTO, UpdateCustomerDTO> {
    protected tableName = 'customers';
    protected selectColumns = `
    id, code, name, customer_type, phone, phone_alt, email, 
    address, tax_number, balance, notes, branch_id, 
    is_active, created_at, updated_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get customers with filters and pagination
     */
    async getCustomers(
        params: Partial<PaginationParams> = {},
        filters: CustomerFilters = {}
    ): Promise<PaginatedResponse<Customer>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        // Build query
        let query = supabase
            .from(this.tableName)
            .select(this.selectColumns, { count: 'exact' });

        // Apply filters
        if (filters.customer_type) {
            query = query.eq('customer_type', filters.customer_type);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }
        if (filters.has_balance) {
            query = query.neq('balance', 0);
        }

        // Apply sorting
        const sortBy = normalizedParams.sortBy || 'created_at';
        const ascending = normalizedParams.sortOrder === 'asc';

        query = query
            .range(from, to)
            .order(sortBy, { ascending });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as Customer[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Search customers by name, phone, or code
     */
    async searchCustomers(query: string, limit: number = 20): Promise<Customer[]> {
        if (!query.trim()) return [];

        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, phone, customer_type, balance')
            .or(`name.ilike.%${query}%,phone.ilike.%${query}%,code.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(limit)
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Customer[]) || [];
    }

    /**
     * Get customer with their vehicles
     */
    async getCustomerWithVehicles(customerId: string): Promise<CustomerWithVehicles> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        vehicles (
          id, plate_number, vin, make, model, year, color, is_active
        )
      `)
            .eq('id', customerId)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as CustomerWithVehicles;
    }

    /**
     * Get customers with outstanding balance
     */
    async getCustomersWithBalance(): Promise<Customer[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, phone, balance')
            .neq('balance', 0)
            .eq('is_active', true)
            .order('balance', { ascending: false });

        if (error) handleSupabaseError(error);
        return data as Customer[];
    }

    /**
     * Update customer balance
     * Note: This should typically be done via triggers, but available for manual adjustments
     */
    async updateBalance(customerId: string, newBalance: number): Promise<Customer> {
        return this.update(customerId, { balance: newBalance } as unknown as UpdateCustomerDTO);
    }

    /**
     * Get customer statistics
     */
    async getCustomerStats(customerId: string): Promise<{
        totalOrders: number;
        totalSpent: number;
        lastVisit: string | null;
    }> {
        // Get job orders count and sum
        const { data: jobData, error: jobError } = await supabase
            .from('job_orders')
            .select('id, created_at')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (jobError) handleSupabaseError(jobError);

        // Get invoices sum
        const { data: invoiceData, error: invoiceError } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('customer_id', customerId)
            .eq('invoice_type', 'sales')
            .in('status', ['approved', 'partial', 'paid']);

        if (invoiceError) handleSupabaseError(invoiceError);

        const totalSpent = (invoiceData || []).reduce(
            (sum, inv) => sum + (inv.total_amount || 0),
            0
        );

        return {
            totalOrders: jobData?.length || 0,
            totalSpent,
            lastVisit: jobData?.[0]?.created_at || null,
        };
    }

    /**
     * Recalculate customer balance from invoices and payments
     */
    async recalculateBalance(customerId: string): Promise<Customer> {
        // Get total invoiced (sales - sales_returns)
        const { data: invoices, error: invError } = await supabase
            .from('invoices')
            .select('invoice_type, total_amount')
            .eq('customer_id', customerId)
            .neq('status', 'cancelled')
            .in('invoice_type', ['sales', 'sales_return']);

        if (invError) handleSupabaseError(invError);

        // Get total paid
        const { data: payments, error: payError } = await supabase
            .from('payments')
            .select('payment_type, amount')
            .eq('customer_id', customerId)
            .in('payment_type', ['customer_receipt', 'advance_payment', 'refund_to_customer']);

        if (payError) handleSupabaseError(payError);

        // Calculate
        let totalInvoiced = 0;
        (invoices || []).forEach(inv => {
            if (inv.invoice_type === 'sales') {
                totalInvoiced += inv.total_amount;
            } else {
                totalInvoiced -= inv.total_amount; // sales_return
            }
        });

        let totalPaid = 0;
        (payments || []).forEach(pay => {
            if (pay.payment_type === 'refund_to_customer') {
                totalPaid -= pay.amount;
            } else {
                totalPaid += pay.amount;
            }
        });

        const newBalance = totalInvoiced - totalPaid;

        return this.updateBalance(customerId, newBalance);
    }

    /**
     * Get statement of account (كشف حساب)
     */
    async getStatementOfAccount(
        customerId: string,
        dateFrom?: string,
        dateTo?: string
    ): Promise<{
        customer: Customer;
        openingBalance: number;
        transactions: {
            date: string;
            type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
            code: string;
            description: string;
            debit: number;
            credit: number;
            balance: number;
        }[];
        closingBalance: number;
        summary: {
            totalDebit: number;
            totalCredit: number;
        };
    }> {
        // Get customer
        const customer = await this.getById(customerId);

        // Get invoices
        let invoiceQuery = supabase
            .from('invoices')
            .select('code, invoice_type, total_amount, created_at')
            .eq('customer_id', customerId)
            .neq('status', 'cancelled');

        if (dateFrom) invoiceQuery = invoiceQuery.gte('created_at', dateFrom);
        if (dateTo) invoiceQuery = invoiceQuery.lte('created_at', dateTo);

        const { data: invoices, error: invError } = await invoiceQuery.order('created_at');
        if (invError) handleSupabaseError(invError);

        // Get payments
        let paymentQuery = supabase
            .from('payments')
            .select('code, payment_type, amount, payment_date')
            .eq('customer_id', customerId);

        if (dateFrom) paymentQuery = paymentQuery.gte('payment_date', dateFrom);
        if (dateTo) paymentQuery = paymentQuery.lte('payment_date', dateTo);

        const { data: payments, error: payError } = await paymentQuery.order('payment_date');
        if (payError) handleSupabaseError(payError);

        // Build transactions list
        const transactions: {
            date: string;
            type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
            code: string;
            description: string;
            debit: number;
            credit: number;
            balance: number;
        }[] = [];

        // Add invoices
        (invoices || []).forEach(inv => {
            const isDebit = inv.invoice_type === 'sales';
            transactions.push({
                date: inv.created_at,
                type: 'invoice',
                code: inv.code,
                description: isDebit ? 'فاتورة مبيعات' : 'مرتجع مبيعات',
                debit: isDebit ? inv.total_amount : 0,
                credit: isDebit ? 0 : inv.total_amount,
                balance: 0, // Will be calculated
            });
        });

        // Add payments
        (payments || []).forEach(pay => {
            const isCredit = pay.payment_type !== 'refund_to_customer';
            transactions.push({
                date: pay.payment_date,
                type: 'payment',
                code: pay.code,
                description: isCredit ? 'سند قبض' : 'مرتجع للعميل',
                debit: isCredit ? 0 : pay.amount,
                credit: isCredit ? pay.amount : 0,
                balance: 0,
            });
        });

        // Sort by date
        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate opening balance if dateFrom is provided
        let openingBalance = 0;
        if (dateFrom) {
            // Get invoices before dateFrom
            const { data: priorInvoices } = await supabase
                .from('invoices')
                .select('invoice_type, total_amount')
                .eq('customer_id', customerId)
                .neq('status', 'cancelled')
                .lt('created_at', dateFrom);

            // Get payments before dateFrom
            const { data: priorPayments } = await supabase
                .from('payments')
                .select('payment_type, amount')
                .eq('customer_id', customerId)
                .lt('payment_date', dateFrom);

            // Calculate opening balance
            (priorInvoices || []).forEach(inv => {
                if (inv.invoice_type === 'sales') {
                    openingBalance += inv.total_amount;
                } else {
                    openingBalance -= inv.total_amount;
                }
            });

            (priorPayments || []).forEach(pay => {
                if (pay.payment_type === 'refund_to_customer') {
                    openingBalance += pay.amount;
                } else {
                    openingBalance -= pay.amount;
                }
            });
        }

        // Calculate running balance
        let runningBalance = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;

        transactions.forEach(tx => {
            runningBalance += tx.debit - tx.credit;
            tx.balance = runningBalance;
            totalDebit += tx.debit;
            totalCredit += tx.credit;
        });

        return {
            customer,
            openingBalance,
            transactions,
            closingBalance: runningBalance,
            summary: {
                totalDebit,
                totalCredit,
            },
        };
    }
}

export const customerService = new CustomerService();
export default customerService;
