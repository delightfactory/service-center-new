import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    canPerform,
    canAccessRoute as checkRoute,
    isAdminRole as checkAdmin,
    type PermissionResource,
    type PermissionAction,
    type UserRole,
    getAccessibleResources as getResources
} from '@/lib/permissions';

/**
 * ============================================================
 * usePermissions - Hook للتحقق من الصلاحيات برمجياً
 * ============================================================
 * يوفر دوال سهلة للتحقق من صلاحيات المستخدم الحالي
 */
export function usePermissions() {
    const { profile } = useAuth();
    const role = profile?.role as UserRole | undefined;

    return useMemo(() => ({
        /**
         * الدور الحالي للمستخدم
         */
        role,

        /**
         * هل المستخدم مسجل دخول
         */
        isAuthenticated: !!profile,

        /**
         * هل المستخدم لديه دور إداري (admin أو manager)
         */
        isAdmin: checkAdmin(role),

        /**
         * التحقق إذا كان يمكنه تنفيذ إجراء على مورد
         */
        can: (resource: PermissionResource, action: PermissionAction = 'read'): boolean => {
            return canPerform(resource, action, role);
        },

        /**
         * التحقق إذا كان يمكنه القراءة
         */
        canRead: (resource: PermissionResource): boolean => {
            return canPerform(resource, 'read', role);
        },

        /**
         * التحقق إذا كان يمكنه الإنشاء
         */
        canCreate: (resource: PermissionResource): boolean => {
            return canPerform(resource, 'create', role);
        },

        /**
         * التحقق إذا كان يمكنه التعديل
         */
        canUpdate: (resource: PermissionResource): boolean => {
            return canPerform(resource, 'update', role);
        },

        /**
         * التحقق إذا كان يمكنه الحذف
         */
        canDelete: (resource: PermissionResource): boolean => {
            return canPerform(resource, 'delete', role);
        },

        /**
         * التحقق إذا كان يمكنه الموافقة
         */
        canApprove: (resource: PermissionResource): boolean => {
            return canPerform(resource, 'approve', role);
        },

        /**
         * التحقق إذا كان يمكنه الإدارة
         */
        canManage: (resource: PermissionResource): boolean => {
            return canPerform(resource, 'manage', role);
        },

        /**
         * التحقق إذا كان يمكنه الوصول لمسار
         */
        canAccessRoute: (route: string): boolean => {
            return checkRoute(route, role);
        },

        /**
         * التحقق إذا كان لديه أي من الأدوار المحددة
         */
        hasRole: (roles: (UserRole | string)[]): boolean => {
            if (!role) return false;
            return roles.includes(role);
        },

        /**
         * الحصول على جميع الموارد المتاحة للمستخدم
         */
        getAccessibleResources: (): PermissionResource[] => {
            if (!role) return [];
            return getResources(role);
        },
    }), [profile, role]);
}

export default usePermissions;
