// ============================================================
// Utils Index
// ============================================================

export { queryClient, invalidateQueries } from './query-client';
export {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    handleSupabaseError,
    handleError,
    ERROR_MESSAGES,
} from './error-handler';
export {
    type PaginationParams,
    type PaginationMeta,
    type PaginatedResponse,
    type SearchParams,
    type DateRangeFilter,
    PAGINATION_DEFAULTS,
    PAGINATION_LIMITS,
    normalizePaginationParams,
    calculateRange,
    buildPaginationMeta,
    emptyPaginatedResponse,
    buildSearchFilter,
    buildDateRangeFilter,
} from './pagination';
export { debugLog, debugWarn, debugError, isDebugLogsEnabled } from './debug';
