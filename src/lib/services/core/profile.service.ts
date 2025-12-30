// ============================================================
// Profile Service
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Profile } from '@/types/database';
import type { UserRole } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface UpdateProfileDTO {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    role?: UserRole;
    branch_id?: string | null;
    specialization?: string;
    hourly_rate?: number;
    hire_date?: string;
    is_active?: boolean;
}

export interface ProfileFilters {
    role?: UserRole;
    branch_id?: string;
    is_active?: boolean;
}

// ============================================================
// Profile Service
// ============================================================

class ProfileService extends BaseService<Profile, never, UpdateProfileDTO> {
    protected tableName = 'profiles';
    protected selectColumns = `
    id, email, full_name, phone, avatar_url, 
    role, branch_id, specialization, hourly_rate, hire_date,
    is_active, created_at, updated_at
  `;
    protected sortColumn = 'full_name';

    /**
     * Get profiles with filters
     */
    async getProfiles(
        params: Partial<PaginationParams> = {},
        filters: ProfileFilters = {}
    ): Promise<PaginatedResponse<Profile>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        // Build query
        let query = supabase
            .from(this.tableName)
            .select(this.selectColumns, { count: 'exact' });

        // Apply filters
        if (filters.role) {
            query = query.eq('role', filters.role);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }

        // Apply pagination
        query = query
            .range(from, to)
            .order('full_name');

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as Profile[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get all technicians (for assignment)
     */
    async getTechnicians(branchId?: string): Promise<Profile[]> {
        let query = supabase
            .from(this.tableName)
            .select('id, full_name, specialization, avatar_url, is_active')
            .eq('role', 'technician')
            .eq('is_active', true)
            .order('full_name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return (data as unknown as Profile[]) || [];
    }

    /**
     * Get profiles by role
     */
    async getByRole(role: UserRole): Promise<Profile[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('role', role)
            .eq('is_active', true)
            .order('full_name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Profile[]) || [];
    }

    /**
     * Search profiles by name or email
     */
    async searchProfiles(query: string): Promise<Profile[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(20)
            .order('full_name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Profile[]) || [];
    }

    /**
     * Update current user's profile
     */
    async updateMyProfile(data: UpdateProfileDTO): Promise<Profile> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Only allow updating specific fields for self
        const allowedFields: UpdateProfileDTO = {
            full_name: data.full_name,
            phone: data.phone,
            avatar_url: data.avatar_url,
        };

        return this.update(user.id, allowedFields);
    }

    /**
     * Change user role (admin only)
     */
    async changeRole(userId: string, newRole: UserRole): Promise<Profile> {
        return this.update(userId, { role: newRole });
    }

    /**
     * Assign user to branch
     */
    async assignToBranch(userId: string, branchId: string | null): Promise<Profile> {
        return this.update(userId, { branch_id: branchId });
    }
}

export const profileService = new ProfileService();
export default profileService;
