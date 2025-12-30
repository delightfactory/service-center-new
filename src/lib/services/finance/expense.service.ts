// ============================================================
// Expense Service (المصروفات)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Expense, AccountCategory, Supplier } from '@/types/database';
import type { ExpenseStatus } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateExpenseDTO {
    category_id?: string | null;
    branch_id: string;
    treasury_id?: string | null;
    supplier_id?: string | null;
    amount: number;
    description: string;
    expense_date?: string;
    reference?: string;
    attachment?: string;
    notes?: string;
}

export interface UpdateExpenseDTO extends Partial<CreateExpenseDTO> {
    status?: ExpenseStatus;
    approved_by?: string;
    approved_at?: string;
}

export interface ExpenseFilters {
    status?: ExpenseStatus;
    category_id?: string;
    branch_id?: string;
    supplier_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface ExpenseWithRelations extends Expense {
    category?: Pick<AccountCategory, 'id' | 'name'> | null;
    supplier?: Pick<Supplier, 'id' | 'name'> | null;
}

// ============================================================
// Expense Service
// ============================================================

class ExpenseService extends BaseService<Expense, CreateExpenseDTO, UpdateExpenseDTO> {
    protected tableName = 'expenses';
    protected selectColumns = `
    id, code, category_id, branch_id, treasury_id, supplier_id,
    amount, description, expense_date, reference, attachment,
    status, approved_by, approved_at, notes, created_by, created_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get expenses with filters
     */
    async getExpenses(
        params: Partial<PaginationParams> = {},
        filters: ExpenseFilters = {}
    ): Promise<PaginatedResponse<ExpenseWithRelations>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        category:account_categories (id, name),
        supplier:suppliers (id, name)
      `, { count: 'exact' });

        // Apply filters
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.category_id) {
            query = query.eq('category_id', filters.category_id);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.supplier_id) {
            query = query.eq('supplier_id', filters.supplier_id);
        }
        if (filters.date_from) {
            query = query.gte('expense_date', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('expense_date', filters.date_to);
        }

        query = query
            .range(from, to)
            .order('expense_date', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as ExpenseWithRelations[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get pending expenses
     */
    async getPendingExpenses(branchId?: string): Promise<ExpenseWithRelations[]> {
        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        category:account_categories (id, name),
        supplier:suppliers (id, name)
      `)
            .eq('status', 'pending')
            .order('expense_date', { ascending: true });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as ExpenseWithRelations[];
    }

    /**
     * Approve expense
     */
    async approveExpense(id: string, approvedBy: string): Promise<Expense> {
        return this.update(id, {
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
        });
    }

    /**
     * Reject expense
     */
    async rejectExpense(id: string, approvedBy: string, reason?: string): Promise<Expense> {
        return this.update(id, {
            status: 'rejected',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
            notes: reason,
        });
    }

    /**
     * Mark expense as paid (and record treasury transaction)
     */
    async markAsPaid(id: string, treasuryId: string): Promise<Expense> {
        const expense = await this.update(id, {
            status: 'paid',
            treasury_id: treasuryId,
        });

        // Record treasury transaction
        await supabase.from('treasury_transactions').insert({
            treasury_id: treasuryId,
            transaction_type: 'expense',
            amount: expense.amount,
            reference_type: 'expense',
            reference_id: id,
            description: expense.description,
            branch_id: expense.branch_id,
            created_by: expense.approved_by,
        });

        return expense;
    }

    /**
     * Cancel expense
     */
    async cancelExpense(id: string): Promise<Expense> {
        return this.update(id, { status: 'cancelled' });
    }

    /**
     * Get expense summary by category
     */
    async getExpenseSummary(
        branchId?: string,
        dateFrom?: string,
        dateTo?: string
    ): Promise<{
        total: number;
        byCategory: { category_id: string; category_name: string; amount: number }[];
        byStatus: Record<ExpenseStatus, number>;
    }> {
        let query = supabase
            .from(this.tableName)
            .select(`
        amount, status, category_id,
        category:account_categories (id, name)
      `);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (dateFrom) {
            query = query.gte('expense_date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('expense_date', dateTo);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);

        let total = 0;
        const byCategory: Record<string, { category_id: string; category_name: string; amount: number }> = {};
        const byStatus: Record<ExpenseStatus, number> = {
            pending: 0,
            approved: 0,
            paid: 0,
            rejected: 0,
            cancelled: 0,
        };

        (data || []).forEach(expense => {
            if (expense.status !== 'cancelled' && expense.status !== 'rejected') {
                total += expense.amount;

                if (expense.category_id) {
                    if (!byCategory[expense.category_id]) {
                        byCategory[expense.category_id] = {
                            category_id: expense.category_id,
                            category_name: (expense.category as unknown as { name: string })?.name || 'غير مصنف',
                            amount: 0,
                        };
                    }
                    byCategory[expense.category_id].amount += expense.amount;
                }
            }

            byStatus[expense.status as ExpenseStatus]++;
        });

        return {
            total,
            byCategory: Object.values(byCategory),
            byStatus,
        };
    }

    /**
     * Get expense categories (for dropdown)
     */
    async getExpenseCategories(): Promise<AccountCategory[]> {
        const { data, error } = await supabase
            .from('account_categories')
            .select('id, code, name')
            .eq('category_type', 'expense')
            .eq('is_active', true)
            .order('name');

        if (error) handleSupabaseError(error);
        return data as AccountCategory[];
    }
}

export const expenseService = new ExpenseService();
export default expenseService;
