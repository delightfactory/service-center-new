// ============================================================
// Auth Components Export - تصدير مكونات المصادقة والصلاحيات
// ============================================================

// Legacy exports (للتوافق مع الكود القديم)
export { ProtectedRoute, RoleGate, usePermission, getDefaultRouteForRole } from './ProtectedRoute';
export type { UserRole } from './ProtectedRoute';
export { ADMIN_ROLES, TECH_ROLES, DASHBOARD_ROLES, ROUTE_PERMISSIONS } from './ProtectedRoute';

// New Role Guards (حماية المسارات)
export {
    RoleGuard,
    DashboardGuard,
    TechnicianGuard,
    AdminGuard,
    ManagerGuard
} from './RoleGuard';

// Conditional Rendering (العرض المشروط)
export {
    IfRole,
    IfAdmin,
    IfManager,
    IfCanDelete,
    IfCanCreate,
    IfCanUpdate,
    IfCanApprove,
    IfCanCancel
} from './IfRole';

// Permissions Hook
export { usePermissions } from '@/hooks/usePermissions';

// Re-export permissions utilities
export {
    canPerform,
    canAccessRoute,
    getAllowedRoles,
    getAccessibleResources,
    isAdminRole,
    canApprove,
    canManage,
    PERMISSIONS,
    OPERATIONAL_ROLES,
    SUPPORT_ROLES,
    TECHNICIAN_ROLES,
} from '@/lib/permissions';

export type {
    PermissionAction,
    PermissionResource,
} from '@/lib/permissions';
