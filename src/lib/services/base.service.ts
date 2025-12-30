// ============================================================
// Base Service - Generic CRUD Operations
// Optimized for large-scale data (100K+ rows)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { handleSupabaseError, NotFoundError } from '@/lib/utils/error-handler';
import {
    PaginationParams,
    PaginatedResponse,
    normalizePaginationParams,
    calculateRange,
    buildPaginationMeta,
} from '@/lib/utils/pagination';

// ============================================================
// Base Service Class
// ============================================================

export abstract class BaseService<
    TRow,                    // Database row type
    TInsert = Partial<TRow>, // Insert DTO
    TUpdate = Partial<TRow>  // Update DTO
> {
    /**
     * Table name in the database
     */
    protected abstract tableName: string;

    /**
     * Columns to select (avoid SELECT *)
     * Override in child class for specific columns
     */
    protected abstract selectColumns: string;

    /**
     * Default sort column
     */
    protected sortColumn: string = 'created_at';

    // ============================================================
    // READ Operations
    // ============================================================

    /**
     * Get all records with pagination
     */
    async getAll(params: Partial<PaginationParams> = {}): Promise<PaginatedResponse<TRow>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        // Get count first
        const { count, error: countError } = await supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true });

        if (countError) handleSupabaseError(countError);

        // Get data with pagination
        let query = supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .range(from, to);

        // Apply sorting
        if (normalizedParams.sortBy) {
            query = query.order(normalizedParams.sortBy, {
                ascending: normalizedParams.sortOrder === 'asc',
            });
        } else {
            query = query.order(this.sortColumn, { ascending: false });
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as TRow[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get a single record by ID
     */
    async getById(id: string): Promise<TRow> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new NotFoundError(this.tableName);
            }
            handleSupabaseError(error);
        }

        return data as TRow;
    }

    /**
     * Get records by a specific column value
     */
    async getByColumn(column: string, value: unknown): Promise<TRow[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq(column, value);

        if (error) handleSupabaseError(error);

        return (data as TRow[]) || [];
    }

    // ============================================================
    // WRITE Operations
    // ============================================================

    /**
     * Create a new record
     */
    async create(insertData: TInsert): Promise<TRow> {
        const { data, error } = await supabase
            .from(this.tableName)
            .insert(insertData as Record<string, unknown>)
            .select(this.selectColumns)
            .single();

        if (error) handleSupabaseError(error);

        return data as TRow;
    }

    /**
     * Create multiple records
     */
    async createMany(insertDataArray: TInsert[]): Promise<TRow[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .insert(insertDataArray as Record<string, unknown>[])
            .select(this.selectColumns);

        if (error) handleSupabaseError(error);

        return (data as TRow[]) || [];
    }

    /**
     * Update a record by ID
     */
    async update(id: string, updateData: TUpdate): Promise<TRow> {
        const { data, error } = await supabase
            .from(this.tableName)
            .update(updateData as Record<string, unknown>)
            .eq('id', id)
            .select(this.selectColumns)
            .single();

        if (error) handleSupabaseError(error);

        return data as TRow;
    }

    /**
     * Delete a record by ID (soft delete if is_active exists)
     */
    async delete(id: string): Promise<void> {
        // Try soft delete first
        const { error: softDeleteError } = await supabase
            .from(this.tableName)
            .update({ is_active: false } as Record<string, unknown>)
            .eq('id', id);

        // If is_active doesn't exist, do hard delete
        if (softDeleteError?.code === '42703') {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) handleSupabaseError(error);
        } else if (softDeleteError) {
            handleSupabaseError(softDeleteError);
        }
    }

    // ============================================================
    // Search Operations
    // ============================================================

    /**
     * Search records by text query
     * Override in child class to specify search columns
     */
    async search(
        query: string,
        searchColumns: string[],
        params: Partial<PaginationParams> = {}
    ): Promise<PaginatedResponse<TRow>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        if (!query.trim()) {
            return this.getAll(params);
        }

        // Build OR filter for search
        const searchPattern = `%${query}%`;
        const orFilter = searchColumns.map(col => `${col}.ilike.${searchPattern}`).join(',');

        // Get count
        const { count, error: countError } = await supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .or(orFilter);

        if (countError) handleSupabaseError(countError);

        // Get data
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .or(orFilter)
            .range(from, to)
            .order(this.sortColumn, { ascending: false });

        if (error) handleSupabaseError(error);

        return {
            data: (data as TRow[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Check if a record exists by ID
     */
    async exists(id: string): Promise<boolean> {
        const { count, error } = await supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .eq('id', id);

        if (error) return false;

        return (count || 0) > 0;
    }

    /**
     * Get count of all records
     */
    async count(filters?: Record<string, unknown>): Promise<number> {
        let query = supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true });

        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }

        const { count, error } = await query;

        if (error) handleSupabaseError(error);

        return count || 0;
    }
}
