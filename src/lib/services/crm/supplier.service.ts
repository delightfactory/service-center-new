// ============================================================
// Supplier Service
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Supplier } from '@/types/database';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateSupplierDTO {
    name: string;
    code?: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_number?: string;
    contact_person?: string;
    notes?: string;
}

export interface UpdateSupplierDTO extends Partial<CreateSupplierDTO> {
    is_active?: boolean;
}

// ============================================================
// Supplier Service
// ============================================================

class SupplierService extends BaseService<Supplier, CreateSupplierDTO, UpdateSupplierDTO> {
    protected tableName = 'suppliers';
    protected selectColumns = `
    id, code, name, phone, email, address, tax_number,
    balance, contact_person, notes, is_active,
    created_at, updated_at
  `;
    protected sortColumn = 'name';

    /**
     * Get suppliers with filters
     */
    async getSuppliers(
        params: Partial<PaginationParams> = {},
        activeOnly: boolean = true
    ): Promise<PaginatedResponse<Supplier>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(this.selectColumns, { count: 'exact' });

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const sortBy = normalizedParams.sortBy || 'name';
        const ascending = normalizedParams.sortOrder === 'asc' || sortBy === 'name';

        query = query
            .range(from, to)
            .order(sortBy, { ascending });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as Supplier[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get all active suppliers (for dropdowns)
     */
    async getActiveSuppliers(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, phone, balance')
            .eq('is_active', true)
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Supplier[]) || [];
    }

    /**
     * Search suppliers by name or code
     */
    async searchSuppliers(query: string, limit: number = 20): Promise<Supplier[]> {
        if (!query.trim()) return [];

        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, phone, balance')
            .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(limit)
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Supplier[]) || [];
    }

    /**
     * Get suppliers with outstanding balance
     */
    async getSuppliersWithBalance(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, phone, balance')
            .neq('balance', 0)
            .eq('is_active', true)
            .order('balance', { ascending: true }); // Negative balance (we owe them) first

        if (error) handleSupabaseError(error);
        return (data as unknown as Supplier[]) || [];
    }

    /**
     * Get supplier purchase history
     */
    async getPurchaseHistory(supplierId: string, limit: number = 50): Promise<{
        id: string;
        code: string;
        invoice_type: string;
        total_amount: number;
        status: string;
        created_at: string;
    }[]> {
        const { data, error } = await supabase
            .from('invoices')
            .select('id, code, invoice_type, total_amount, status, created_at')
            .eq('supplier_id', supplierId)
            .in('invoice_type', ['purchase', 'purchase_return'])
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) handleSupabaseError(error);
        return data || [];
    }

    /**
     * Update supplier balance
     */
    async updateBalance(supplierId: string, newBalance: number): Promise<Supplier> {
        const { data, error } = await supabase
            .from(this.tableName)
            .update({ balance: newBalance })
            .eq('id', supplierId)
            .select(this.selectColumns)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as Supplier;
    }

    /**
     * Recalculate supplier balance from invoices and payments
     */
    async recalculateBalance(supplierId: string): Promise<Supplier> {
        // Get total invoiced (purchase - purchase_returns)
        const { data: invoices, error: invError } = await supabase
            .from('invoices')
            .select('invoice_type, total_amount')
            .eq('supplier_id', supplierId)
            .neq('status', 'cancelled')
            .in('invoice_type', ['purchase', 'purchase_return']);

        if (invError) handleSupabaseError(invError);

        // Get total paid
        const { data: payments, error: payError } = await supabase
            .from('payments')
            .select('payment_type, amount')
            .eq('supplier_id', supplierId)
            .in('payment_type', ['supplier_payment', 'refund_from_supplier']);

        if (payError) handleSupabaseError(payError);

        // Calculate (negative = we owe supplier)
        let totalOwed = 0;
        (invoices || []).forEach(inv => {
            if (inv.invoice_type === 'purchase') {
                totalOwed += inv.total_amount;
            } else {
                totalOwed -= inv.total_amount; // purchase_return
            }
        });

        let totalPaid = 0;
        (payments || []).forEach(pay => {
            if (pay.payment_type === 'refund_from_supplier') {
                totalPaid -= pay.amount;
            } else {
                totalPaid += pay.amount;
            }
        });

        const newBalance = totalPaid - totalOwed; // Positive = we paid more, Negative = we owe

        return this.updateBalance(supplierId, newBalance);
    }

    /**
     * Get statement of account (كشف حساب)
     */
    async getStatementOfAccount(
        supplierId: string,
        dateFrom?: string,
        dateTo?: string
    ): Promise<{
        supplier: Supplier;
        openingBalance: number;
        transactions: {
            date: string;
            type: 'invoice' | 'payment';
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
        // Get supplier
        const { data: supplier, error: supError } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('id', supplierId)
            .single();

        if (supError) handleSupabaseError(supError);

        // Get invoices
        let invoiceQuery = supabase
            .from('invoices')
            .select('code, invoice_type, total_amount, created_at')
            .eq('supplier_id', supplierId)
            .neq('status', 'cancelled');

        if (dateFrom) invoiceQuery = invoiceQuery.gte('created_at', dateFrom);
        if (dateTo) invoiceQuery = invoiceQuery.lte('created_at', dateTo);

        const { data: invoices, error: invError } = await invoiceQuery.order('created_at');
        if (invError) handleSupabaseError(invError);

        // Get payments
        let paymentQuery = supabase
            .from('payments')
            .select('code, payment_type, amount, payment_date')
            .eq('supplier_id', supplierId);

        if (dateFrom) paymentQuery = paymentQuery.gte('payment_date', dateFrom);
        if (dateTo) paymentQuery = paymentQuery.lte('payment_date', dateTo);

        const { data: payments, error: payError } = await paymentQuery.order('payment_date');
        if (payError) handleSupabaseError(payError);

        // Build transactions list
        const transactions: {
            date: string;
            type: 'invoice' | 'payment';
            code: string;
            description: string;
            debit: number;
            credit: number;
            balance: number;
        }[] = [];

        // Add invoices (purchase = credit = we owe, purchase_return = debit)
        (invoices || []).forEach(inv => {
            const isCredit = inv.invoice_type === 'purchase';
            transactions.push({
                date: inv.created_at,
                type: 'invoice',
                code: inv.code,
                description: isCredit ? 'فاتورة مشتريات' : 'مرتجع مشتريات',
                debit: isCredit ? 0 : inv.total_amount,
                credit: isCredit ? inv.total_amount : 0,
                balance: 0,
            });
        });

        // Add payments (payment = debit = reduces what we owe)
        (payments || []).forEach(pay => {
            const isDebit = pay.payment_type !== 'refund_from_supplier';
            transactions.push({
                date: pay.payment_date,
                type: 'payment',
                code: pay.code,
                description: isDebit ? 'سند صرف' : 'مرتجع من مورد',
                debit: isDebit ? pay.amount : 0,
                credit: isDebit ? 0 : pay.amount,
                balance: 0,
            });
        });

        // Sort by date
        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate running balance
        let runningBalance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        transactions.forEach(tx => {
            runningBalance += tx.credit - tx.debit; // Positive = we owe
            tx.balance = runningBalance;
            totalDebit += tx.debit;
            totalCredit += tx.credit;
        });

        return {
            supplier: supplier as unknown as Supplier,
            openingBalance: 0,
            transactions,
            closingBalance: runningBalance,
            summary: {
                totalDebit,
                totalCredit,
            },
        };
    }
}

export const supplierService = new SupplierService();
export default supplierService;
