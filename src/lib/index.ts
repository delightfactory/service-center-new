// ============================================================
// Lib Main Index
// Central export file for all library modules
// ============================================================

// Supabase Client
export { supabase } from './supabase';

// Query Client
export { queryClient } from './utils/query-client';

// All Services
export * from './services';

// All Hooks
export * from './hooks';

// Error Handling
export { handleSupabaseError, AppError, ValidationError, NotFoundError, UnauthorizedError } from './utils/error-handler';

// Pagination Utilities
export type { PaginationParams, PaginatedResponse, PaginationMeta } from './utils/pagination';
export { normalizePaginationParams, calculateRange, buildPaginationMeta } from './utils/pagination';
