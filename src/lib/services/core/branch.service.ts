// ============================================================
// Branch Service
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import type { Branch } from '@/types/database';

// ============================================================
// Types
// ============================================================

export interface CreateBranchDTO {
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    is_main?: boolean;
}

export interface UpdateBranchDTO extends Partial<CreateBranchDTO> {
    is_active?: boolean;
}

// ============================================================
// Branch Service
// ============================================================

class BranchService extends BaseService<Branch, CreateBranchDTO, UpdateBranchDTO> {
    protected tableName = 'branches';
    protected selectColumns = 'id, code, name, address, phone, is_main, is_active, created_at, updated_at';
    protected sortColumn = 'name';

    /**
     * Get all active branches
     */
    async getActiveBranches(): Promise<Branch[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('is_active', true)
            .order('is_main', { ascending: false })
            .order('name');

        if (error) throw error;
        return (data as unknown as Branch[]) || [];
    }

    /**
     * Get the main branch
     */
    async getMainBranch(): Promise<Branch | null> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('is_main', true)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data as Branch | null;
    }

    /**
     * Set a branch as main (and unset others)
     */
    async setAsMain(branchId: string): Promise<Branch> {
        // First, unset all main branches
        await supabase
            .from(this.tableName)
            .update({ is_main: false })
            .eq('is_main', true);

        // Then set the selected branch as main
        return this.update(branchId, { is_main: true });
    }
}

export const branchService = new BranchService();
export default branchService;
