// ============================================================
// Pagination Utilities
// Optimized for large-scale data
// ============================================================

// ============================================================
// Types
// ============================================================

export interface PaginationParams {
    page: number;          // 1-indexed
    pageSize: number;      // default: 20, max: 100
    sortBy?: string;       // column to sort by
    sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    from: number;          // first item index (1-indexed)
    to: number;            // last item index (1-indexed)
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

// ============================================================
// Defaults & Constants
// ============================================================

export const PAGINATION_DEFAULTS = {
    page: 1,
    pageSize: 20,
    sortOrder: 'desc' as const,
};

export const PAGINATION_LIMITS = {
    minPageSize: 5,
    maxPageSize: 100,
    defaultPageSize: 20,
};

// ============================================================
// Utility Functions
// ============================================================

/**
 * Normalize pagination params with defaults and limits
 */
export function normalizePaginationParams(params: Partial<PaginationParams>): PaginationParams {
    const page = Math.max(1, params.page || PAGINATION_DEFAULTS.page);
    const pageSize = Math.min(
        PAGINATION_LIMITS.maxPageSize,
        Math.max(PAGINATION_LIMITS.minPageSize, params.pageSize || PAGINATION_DEFAULTS.pageSize)
    );
    const sortOrder = params.sortOrder || PAGINATION_DEFAULTS.sortOrder;

    return {
        page,
        pageSize,
        sortBy: params.sortBy,
        sortOrder,
    };
}

/**
 * Calculate range for Supabase query
 * Returns [from, to] for .range(from, to)
 */
export function calculateRange(params: PaginationParams): [number, number] {
    const { page, pageSize } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return [from, to];
}

/**
 * Build pagination meta from count and params
 */
export function buildPaginationMeta(
    totalCount: number,
    params: PaginationParams
): PaginationMeta {
    const { page, pageSize } = params;
    const totalPages = Math.ceil(totalCount / pageSize);
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalCount);

    return {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        from: totalCount > 0 ? from : 0,
        to: totalCount > 0 ? to : 0,
    };
}

/**
 * Create empty paginated response
 */
export function emptyPaginatedResponse<T>(params: PaginationParams): PaginatedResponse<T> {
    return {
        data: [],
        meta: buildPaginationMeta(0, params),
    };
}

// ============================================================
// Search Utilities
// ============================================================

export interface SearchParams extends PaginationParams {
    query?: string;
    filters?: Record<string, unknown>;
}

/**
 * Build search query for multiple columns
 * Uses PostgreSQL's ilike for case-insensitive search
 */
export function buildSearchFilter(query: string, columns: string[]): string {
    if (!query.trim()) return '';

    const escapedQuery = query.replace(/[%_]/g, '\\$&');
    const conditions = columns.map(col => `${col}.ilike.%${escapedQuery}%`);

    return conditions.join(',');
}

// ============================================================
// Date Range Utilities
// ============================================================

export interface DateRangeFilter {
    startDate?: string;  // ISO string
    endDate?: string;    // ISO string
    column?: string;     // default: 'created_at'
}

export function buildDateRangeFilter(filter: DateRangeFilter): Record<string, string> {
    const column = filter.column || 'created_at';
    const result: Record<string, string> = {};

    if (filter.startDate) {
        result[`${column}`] = `gte.${filter.startDate}`;
    }
    if (filter.endDate) {
        result[`${column}`] = `lte.${filter.endDate}`;
    }

    return result;
}
