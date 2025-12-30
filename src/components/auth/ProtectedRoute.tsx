// ============================================================
// Role-Based Route Protection Component
// ============================================================
// يحمي الـ routes حسب صلاحيات المستخدم
// ============================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// تعريف الأدوار المتاحة
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'engineer' | 'technician' | 'warehouse' | 'accountant';

// الأدوار التي لها صلاحيات إدارية
export const ADMIN_ROLES: UserRole[] = ['admin', 'manager'];

// الأدوار التي تستخدم تطبيق الفني
export const TECH_ROLES: UserRole[] = ['technician'];

// الأدوار التي تستخدم لوحة التحكم العامة
export const DASHBOARD_ROLES: UserRole[] = ['admin', 'manager', 'supervisor', 'engineer', 'warehouse', 'accountant'];

// تعريف صلاحيات كل route
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
    // الصفحة الرئيسية - متاحة لجميع أدوار الـ dashboard
    '/dashboard': DASHBOARD_ROLES,

    // الاستقبال - متاح للمهندسين والمشرفين والإدارة
    '/dashboard/reception': ['admin', 'manager', 'supervisor', 'engineer'],

    // ساحة العمل - متاح للجميع ما عدا المحاسب
    '/dashboard/workshop': ['admin', 'manager', 'supervisor', 'engineer', 'technician', 'warehouse'],

    // العملاء - متاح للإدارة والمهندسين والمشرفين
    '/dashboard/customers': ['admin', 'manager', 'supervisor', 'engineer'],
    '/dashboard/vehicles': ['admin', 'manager', 'supervisor', 'engineer'],
    '/dashboard/suppliers': ['admin', 'manager', 'warehouse'],

    // المخزون - متاح للإدارة وأمين المخزن
    '/dashboard/inventory': ['admin', 'manager', 'warehouse'],

    // المالية - متاح للإدارة والمحاسب
    '/dashboard/finance': ['admin', 'manager', 'accountant'],

    // الإعدادات - الإدارة فقط
    '/dashboard/settings': ['admin', 'manager'],
};

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
    redirectTo?: string;
}

/**
 * مكون حماية الـ Routes حسب الدور
 * يتحقق من صلاحية المستخدم للوصول للـ route الحالي
 */
export function ProtectedRoute({
    children,
    allowedRoles,
    redirectTo
}: ProtectedRouteProps) {
    const { profile, isAuthenticated, loading } = useAuth();
    const location = useLocation();

    // أثناء التحميل
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // غير مسجل دخول
    if (!isAuthenticated || !profile) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // إذا لم يتم تحديد أدوار مسموح بها، نستخدم الـ ROUTE_PERMISSIONS
    const rolesRequired = allowedRoles || findRolesForPath(location.pathname);

    // التحقق من الصلاحية
    if (rolesRequired && !rolesRequired.includes(profile.role as UserRole)) {
        // تحديد صفحة إعادة التوجيه حسب الدور
        const defaultRedirect = getDefaultRouteForRole(profile.role as UserRole);
        return <Navigate to={redirectTo || defaultRedirect} replace />;
    }

    return <>{children}</>;
}

/**
 * البحث عن الأدوار المطلوبة للـ path
 */
function findRolesForPath(pathname: string): UserRole[] | undefined {
    // البحث عن تطابق مباشر
    if (ROUTE_PERMISSIONS[pathname]) {
        return ROUTE_PERMISSIONS[pathname];
    }

    // البحث عن تطابق جزئي (للـ nested routes)
    const matchingPath = Object.keys(ROUTE_PERMISSIONS)
        .sort((a, b) => b.length - a.length) // ترتيب من الأطول للأقصر
        .find(path => pathname.startsWith(path));

    return matchingPath ? ROUTE_PERMISSIONS[matchingPath] : undefined;
}

/**
 * الحصول على الـ route الافتراضي لكل دور
 */
export function getDefaultRouteForRole(role: UserRole): string {
    switch (role) {
        case 'technician':
            return '/tech';
        case 'admin':
        case 'manager':
            return '/dashboard';
        case 'supervisor':
        case 'engineer':
            return '/dashboard/reception';
        case 'warehouse':
            return '/dashboard/inventory';
        case 'accountant':
            return '/dashboard/finance';
        default:
            return '/dashboard';
    }
}

/**
 * Hook للتحقق من صلاحية المستخدم لـ action معين
 */
export function usePermission(requiredRoles: UserRole[]): boolean {
    const { profile } = useAuth();
    if (!profile) return false;
    return requiredRoles.includes(profile.role as UserRole);
}

/**
 * مكون لإخفاء المحتوى حسب الصلاحية
 */
interface RoleGateProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    fallback?: React.ReactNode;
}

export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
    const hasPermission = usePermission(allowedRoles);
    return hasPermission ? <>{children}</> : <>{fallback}</>;
}

export default ProtectedRoute;
