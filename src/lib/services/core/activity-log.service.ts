// ============================================================
// Activity Log Service (سجل النشاط)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { ActivityLog } from '@/types/database';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface LogActionDTO {
    action: string;
    entity_type: string;
    entity_id?: string;
    entity_code?: string;
    old_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    changed_fields?: string[];
    description?: string;
    user_id?: string;
    user_name?: string;
    user_role?: string;
    branch_id?: string;
    ip_address?: string;
    user_agent?: string;
}

export interface ActivityLogFilters {
    action?: string;
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    branch_id?: string;
    date_from?: string;
    date_to?: string;
}

// ============================================================
// Activity Log Service
// ============================================================

class ActivityLogService {
    private tableName = 'activity_logs';
    private selectColumns = `
    id, action, entity_type, entity_id, entity_code,
    old_values, new_values, changed_fields, description,
    user_id, user_name, user_role, branch_id,
    ip_address, user_agent, created_at
  `;

    /**
     * Get activity logs with filters and pagination
     */
    async getLogs(
        params: Partial<PaginationParams> = {},
        filters: ActivityLogFilters = {}
    ): Promise<PaginatedResponse<ActivityLog>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(this.selectColumns, { count: 'exact' });

        // Apply filters
        if (filters.action) {
            query = query.eq('action', filters.action);
        }
        if (filters.entity_type) {
            query = query.eq('entity_type', filters.entity_type);
        }
        if (filters.entity_id) {
            query = query.eq('entity_id', filters.entity_id);
        }
        if (filters.user_id) {
            query = query.eq('user_id', filters.user_id);
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
            data: (data as unknown as ActivityLog[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get activity logs for specific entity
     */
    async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) handleSupabaseError(error);
        return (data as unknown as ActivityLog[]) || [];
    }

    /**
     * Get recent activity for user
     */
    async getByUser(userId: string, limit: number = 50): Promise<ActivityLog[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) handleSupabaseError(error);
        return (data as unknown as ActivityLog[]) || [];
    }

    /**
     * Log an action
     */
    async logAction(dto: LogActionDTO): Promise<ActivityLog> {
        const { data, error } = await supabase
            .from(this.tableName)
            .insert(dto)
            .select(this.selectColumns)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as ActivityLog;
    }

    /**
     * Log create action
     */
    async logCreate(
        entityType: string,
        entityId: string,
        entityCode: string | undefined,
        newValues: Record<string, unknown>,
        userId?: string,
        userName?: string,
        branchId?: string
    ): Promise<ActivityLog> {
        return this.logAction({
            action: 'create',
            entity_type: entityType,
            entity_id: entityId,
            entity_code: entityCode,
            new_values: newValues,
            description: `إنشاء ${entityType}: ${entityCode || entityId}`,
            user_id: userId,
            user_name: userName,
            branch_id: branchId,
        });
    }

    /**
     * Log update action
     */
    async logUpdate(
        entityType: string,
        entityId: string,
        entityCode: string | undefined,
        oldValues: Record<string, unknown>,
        newValues: Record<string, unknown>,
        userId?: string,
        userName?: string,
        branchId?: string
    ): Promise<ActivityLog> {
        // Calculate changed fields
        const changedFields = Object.keys(newValues).filter(
            key => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
        );

        return this.logAction({
            action: 'update',
            entity_type: entityType,
            entity_id: entityId,
            entity_code: entityCode,
            old_values: oldValues,
            new_values: newValues,
            changed_fields: changedFields,
            description: `تعديل ${entityType}: ${entityCode || entityId} (${changedFields.length} حقول)`,
            user_id: userId,
            user_name: userName,
            branch_id: branchId,
        });
    }

    /**
     * Log delete action
     */
    async logDelete(
        entityType: string,
        entityId: string,
        entityCode: string | undefined,
        oldValues: Record<string, unknown>,
        userId?: string,
        userName?: string,
        branchId?: string
    ): Promise<ActivityLog> {
        return this.logAction({
            action: 'delete',
            entity_type: entityType,
            entity_id: entityId,
            entity_code: entityCode,
            old_values: oldValues,
            description: `حذف ${entityType}: ${entityCode || entityId}`,
            user_id: userId,
            user_name: userName,
            branch_id: branchId,
        });
    }

    /**
     * Log status change
     */
    async logStatusChange(
        entityType: string,
        entityId: string,
        entityCode: string | undefined,
        oldStatus: string,
        newStatus: string,
        userId?: string,
        userName?: string,
        branchId?: string
    ): Promise<ActivityLog> {
        return this.logAction({
            action: 'status_change',
            entity_type: entityType,
            entity_id: entityId,
            entity_code: entityCode,
            old_values: { status: oldStatus },
            new_values: { status: newStatus },
            changed_fields: ['status'],
            description: `تغيير حالة ${entityType}: ${oldStatus} → ${newStatus}`,
            user_id: userId,
            user_name: userName,
            branch_id: branchId,
        });
    }

    /**
     * Get available actions for filtering
     */
    async getAvailableActions(): Promise<string[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('action')
            .limit(1000);

        if (error) handleSupabaseError(error);

        const unique = new Set((data || []).map(d => d.action));
        return Array.from(unique);
    }

    /**
     * Get available entity types for filtering
     */
    async getAvailableEntityTypes(): Promise<string[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('entity_type')
            .limit(1000);

        if (error) handleSupabaseError(error);

        const unique = new Set((data || []).map(d => d.entity_type));
        return Array.from(unique);
    }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
