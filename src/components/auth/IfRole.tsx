import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    canPerform,
    type PermissionResource,
    type PermissionAction,
    type UserRole
} from '@/lib/permissions';

/**
 * ============================================================
 * IfRole - إظهار/إخفاء العناصر بناءً على الدور
 * ============================================================
 * يُستخدم لإخفاء الأزرار والعناصر التي لا يملك المستخدم صلاحية استخدامها
 */

interface IfRoleProps {
    children: React.ReactNode;
    /**
     * الأدوار المسموح بها (اختياري إذا تم استخدام resource/action)
     */
    roles?: (UserRole | string)[];
    /**
     * المورد للتحقق من الصلاحية
     */
    resource?: PermissionResource;
    /**
     * الإجراء على المورد
     */
    action?: PermissionAction;
    /**
     * مكون بديل يظهر عند عدم وجود صلاحية
     */
    fallback?: React.ReactNode;
    /**
     * عكس الشرط (إظهار إذا لم يكن لديه الصلاحية)
     */
    inverse?: boolean;
}

export function IfRole({
    children,
    roles,
    resource,
    action = 'read',
    fallback = null,
    inverse = false
}: IfRoleProps) {
    const { profile } = useAuth();

    if (!profile) {
        return inverse ? <>{children}</> : <>{fallback}</>;
    }

    let hasPermission = false;

    // التحقق بالأدوار المباشرة
    if (roles && roles.length > 0) {
        hasPermission = roles.includes(profile.role);
    }
    // التحقق بالمورد والإجراء
    else if (resource) {
        hasPermission = canPerform(resource, action, profile.role);
    }
    // إذا لم يُحدد شيء، يُسمح
    else {
        hasPermission = true;
    }

    // عكس النتيجة إذا inverse = true
    if (inverse) {
        hasPermission = !hasPermission;
    }

    return hasPermission ? <>{children}</> : <>{fallback}</>;
}

/**
 * ============================================================
 * IfAdmin - إظهار فقط للمديرين
 * ============================================================
 */
export function IfAdmin({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <IfRole roles={['admin']} fallback={fallback}>{children}</IfRole>;
}

/**
 * ============================================================
 * IfManager - إظهار للمديرين ومديري الفروع
 * ============================================================
 */
export function IfManager({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <IfRole roles={['admin', 'manager']} fallback={fallback}>{children}</IfRole>;
}

/**
 * ============================================================
 * IfCanDelete - إظهار إذا كان يمكنه الحذف
 * ============================================================
 */
export function IfCanDelete({
    resource,
    children,
    fallback
}: {
    resource: PermissionResource;
    children: React.ReactNode;
    fallback?: React.ReactNode
}) {
    return (
        <IfRole resource={resource} action="delete" fallback={fallback}>
            {children}
        </IfRole>
    );
}

/**
 * ============================================================
 * IfCanCreate - إظهار إذا كان يمكنه الإنشاء
 * ============================================================
 */
export function IfCanCreate({
    resource,
    children,
    fallback
}: {
    resource: PermissionResource;
    children: React.ReactNode;
    fallback?: React.ReactNode
}) {
    return (
        <IfRole resource={resource} action="create" fallback={fallback}>
            {children}
        </IfRole>
    );
}

/**
 * ============================================================
 * IfCanUpdate - إظهار إذا كان يمكنه التعديل
 * ============================================================
 */
export function IfCanUpdate({
    resource,
    children,
    fallback
}: {
    resource: PermissionResource;
    children: React.ReactNode;
    fallback?: React.ReactNode
}) {
    return (
        <IfRole resource={resource} action="update" fallback={fallback}>
            {children}
        </IfRole>
    );
}

/**
 * ============================================================
 * IfCanApprove - إظهار إذا كان يمكنه الموافقة
 * ============================================================
 */
export function IfCanApprove({
    resource,
    children,
    fallback
}: {
    resource: PermissionResource;
    children: React.ReactNode;
    fallback?: React.ReactNode
}) {
    return (
        <IfRole resource={resource} action="approve" fallback={fallback}>
            {children}
        </IfRole>
    );
}

/**
 * ============================================================
 * IfCanCancel - إظهار إذا كان يمكنه الإلغاء
 * ============================================================
 */
export function IfCanCancel({
    resource,
    children,
    fallback
}: {
    resource: PermissionResource;
    children: React.ReactNode;
    fallback?: React.ReactNode
}) {
    return (
        <IfRole resource={resource} action="cancel" fallback={fallback}>
            {children}
        </IfRole>
    );
}

export default IfRole;

