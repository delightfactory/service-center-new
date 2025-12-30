// ============================================================
// Treasury Service (الخزن)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Treasury, TreasuryTransaction } from '@/types/database';
import type { TreasuryType, TreasuryTxType } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateTreasuryDTO {
    name: string;
    code?: string;
    treasury_type: TreasuryType;
    branch_id?: string | null;
    opening_balance?: number;
    bank_name?: string;
    account_number?: string;
    iban?: string;
    is_default?: boolean;
}

export interface UpdateTreasuryDTO extends Partial<CreateTreasuryDTO> {
    is_active?: boolean;
}

export interface TreasuryTransactionFilters {
    treasury_id?: string;
    transaction_type?: TreasuryTxType;
    branch_id?: string;
    date_from?: string;
    date_to?: string;
}

// ============================================================
// Treasury Service
// ============================================================

class TreasuryService extends BaseService<Treasury, CreateTreasuryDTO, UpdateTreasuryDTO> {
    protected tableName = 'treasuries';
    protected selectColumns = `
    id, code, name, treasury_type, branch_id,
    balance, opening_balance, bank_name, account_number, iban,
    is_default, is_active, created_at
  `;
    protected sortColumn = 'name';

    /**
     * Get all treasuries with balance
     */
    async getTreasuries(branchId?: string): Promise<Treasury[]> {
        let query = supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return (data as unknown as Treasury[]) || [];
    }

    /**
     * Get default treasury for branch
     */
    async getDefaultTreasury(branchId: string): Promise<Treasury | null> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('branch_id', branchId)
            .eq('is_default', true)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') handleSupabaseError(error);
        return data as Treasury | null;
    }

    /**
     * Get treasury transactions
     */
    async getTransactions(
        params: Partial<PaginationParams> = {},
        filters: TreasuryTransactionFilters = {}
    ): Promise<PaginatedResponse<TreasuryTransaction>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from('treasury_transactions')
            .select(`
        id, code, treasury_id, transaction_type, amount,
        balance_before, balance_after, reference_type, reference_id,
        party_type, party_id, description, branch_id, created_by, created_at
      `, { count: 'exact' });

        // Apply filters
        if (filters.treasury_id) {
            query = query.eq('treasury_id', filters.treasury_id);
        }
        if (filters.transaction_type) {
            query = query.eq('transaction_type', filters.transaction_type);
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

        query = query
            .range(from, to)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as TreasuryTransaction[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get total balances
     */
    async getTotalBalances(branchId?: string): Promise<{
        total: number;
        byCash: number;
        byBank: number;
        byPos: number;
        byOnline: number;
    }> {
        let query = supabase
            .from(this.tableName)
            .select('treasury_type, balance')
            .eq('is_active', true);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);

        const result = {
            total: 0,
            byCash: 0,
            byBank: 0,
            byPos: 0,
            byOnline: 0,
        };

        (data || []).forEach(treasury => {
            const balance = treasury.balance || 0;
            result.total += balance;

            switch (treasury.treasury_type) {
                case 'cash':
                    result.byCash += balance;
                    break;
                case 'bank':
                    result.byBank += balance;
                    break;
                case 'pos':
                    result.byPos += balance;
                    break;
                case 'online':
                    result.byOnline += balance;
                    break;
            }
        });

        return result;
    }

    /**
     * Record a transaction (internal use)
     */
    async recordTransaction(data: {
        treasury_id: string;
        transaction_type: TreasuryTxType;
        amount: number;
        reference_type?: string;
        reference_id?: string;
        party_type?: string;
        party_id?: string;
        description?: string;
        branch_id?: string;
        created_by?: string;
    }): Promise<TreasuryTransaction> {
        // Get current balance
        const treasury = await this.getById(data.treasury_id);
        const balanceBefore = treasury.balance;

        // Calculate new balance
        const incomingTypes: TreasuryTxType[] = [
            'deposit', 'transfer_in', 'customer_receipt',
            'income', 'opening_balance'
        ];
        const isIncoming = incomingTypes.includes(data.transaction_type);
        const balanceAfter = isIncoming
            ? balanceBefore + data.amount
            : balanceBefore - data.amount;

        // Create transaction
        const { data: transaction, error } = await supabase
            .from('treasury_transactions')
            .insert({
                ...data,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
            })
            .select()
            .single();

        if (error) handleSupabaseError(error);

        // Update treasury balance
        await supabase
            .from(this.tableName)
            .update({ balance: balanceAfter })
            .eq('id', data.treasury_id);

        return transaction as TreasuryTransaction;
    }

    /**
     * Transfer between treasuries
     */
    async transferBetweenTreasuries(
        fromTreasuryId: string,
        toTreasuryId: string,
        amount: number,
        notes?: string,
        createdBy?: string,
        branchId?: string
    ): Promise<void> {
        // Record outgoing transaction
        await this.recordTransaction({
            treasury_id: fromTreasuryId,
            transaction_type: 'transfer_out',
            amount,
            reference_type: 'treasury_transfer',
            party_type: 'treasury',
            party_id: toTreasuryId,
            description: notes,
            branch_id: branchId,
            created_by: createdBy,
        });

        // Record incoming transaction
        await this.recordTransaction({
            treasury_id: toTreasuryId,
            transaction_type: 'transfer_in',
            amount,
            reference_type: 'treasury_transfer',
            party_type: 'treasury',
            party_id: fromTreasuryId,
            description: notes,
            branch_id: branchId,
            created_by: createdBy,
        });
    }
}

export const treasuryService = new TreasuryService();
export default treasuryService;
