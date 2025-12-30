// ============================================================
// Centralized Error Handler
// ============================================================

import { PostgrestError } from '@supabase/supabase-js';

// ============================================================
// Error Types
// ============================================================

export class AppError extends Error {
    public code: string;
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, code: string = 'UNKNOWN_ERROR', statusCode: number = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = true;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', 400);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} غير موجود`, 'NOT_FOUND', 404);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'غير مصرح لك بهذا الإجراء') {
        super(message, 'UNAUTHORIZED', 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'ليس لديك صلاحية لهذا الإجراء') {
        super(message, 'FORBIDDEN', 403);
    }
}

// ============================================================
// Supabase Error Handler
// ============================================================

export function handleSupabaseError(error: PostgrestError): never {
    // Common PostgreSQL error codes
    const errorMap: Record<string, { message: string; code: string; status: number }> = {
        // Unique violation
        '23505': {
            message: 'هذا العنصر موجود بالفعل',
            code: 'DUPLICATE_ERROR',
            status: 409,
        },
        // Foreign key violation
        '23503': {
            message: 'لا يمكن حذف هذا العنصر لأنه مرتبط ببيانات أخرى',
            code: 'FOREIGN_KEY_ERROR',
            status: 409,
        },
        // Not null violation
        '23502': {
            message: 'بعض الحقول المطلوبة غير مكتملة',
            code: 'NULL_VIOLATION',
            status: 400,
        },
        // Check constraint violation
        '23514': {
            message: 'البيانات المدخلة غير صالحة',
            code: 'CHECK_VIOLATION',
            status: 400,
        },
        // RLS policy violation
        '42501': {
            message: 'ليس لديك صلاحية لهذا الإجراء',
            code: 'PERMISSION_DENIED',
            status: 403,
        },
        // Insufficient privilege
        'PGRST301': {
            message: 'غير مصرح لك',
            code: 'UNAUTHORIZED',
            status: 401,
        },
    };

    const mapped = errorMap[error.code] || {
        message: error.message || 'حدث خطأ غير متوقع',
        code: error.code || 'UNKNOWN_ERROR',
        status: 500,
    };

    throw new AppError(mapped.message, mapped.code, mapped.status);
}

// ============================================================
// Generic Error Handler
// ============================================================

export function handleError(error: unknown): AppError {
    // Already an AppError
    if (error instanceof AppError) {
        return error;
    }

    // Supabase PostgrestError
    if (isPostgrestError(error)) {
        try {
            handleSupabaseError(error);
        } catch (e) {
            return e as AppError;
        }
    }

    // Standard Error
    if (error instanceof Error) {
        return new AppError(error.message);
    }

    // Unknown error
    return new AppError('حدث خطأ غير متوقع');
}

// Type guard for PostgrestError
function isPostgrestError(error: unknown): error is PostgrestError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error &&
        'details' in error
    );
}

// ============================================================
// Error Messages (Arabic)
// ============================================================

export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'خطأ في الاتصال بالخادم',
    UNAUTHORIZED: 'يرجى تسجيل الدخول',
    FORBIDDEN: 'ليس لديك صلاحية',
    NOT_FOUND: 'العنصر غير موجود',
    VALIDATION_ERROR: 'البيانات غير صحيحة',
    SERVER_ERROR: 'خطأ في الخادم',
    UNKNOWN_ERROR: 'حدث خطأ غير متوقع',
} as const;
