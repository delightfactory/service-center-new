import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessRoute, DASHBOARD_ROLES, TECHNICIAN_ROLES, type UserRole } from '@/lib/permissions';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ============================================================
 * RoleGuard - حماية المسارات بناءً على الأدوار
 * ============================================================
 * يمنع الوصول للصفحات غير المسموح بها بناءً على دور المستخدم
 */

interface RoleGuardProps {
    children: React.ReactNode;
    /**
     * الأدوار المسموح بها للوصول
     * إذا لم تُحدد، سيتم استخدام نظام الصلاحيات المركزي
     */
    allowedRoles?: (UserRole | string)[];
    /**
     * مكون بديل يظهر عند عدم وجود صلاحية
     * الافتراضي: صفحة رفض الوصول
     */
    fallback?: React.ReactNode;
    /**
     * إعادة التوجيه لمسار معين بدلاً من عرض fallback
     */
    redirectTo?: string;
}

export function RoleGuard({
    children,
    allowedRoles,
    fallback,
    redirectTo
}: RoleGuardProps) {
    const { profile, loading, isAuthenticated } = useAuth();
    const location = useLocation();

    // حالة التحميل
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // غير مسجل
    if (!isAuthenticated || !profile) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // التحقق من الصلاحيات
    let hasAccess = false;

    if (allowedRoles && allowedRoles.length > 0) {
        // استخدام الأدوار المحددة مباشرة
        hasAccess = allowedRoles.includes(profile.role);
    } else {
        // استخدام نظام الصلاحيات المركزي
        hasAccess = canAccessRoute(location.pathname, profile.role);
    }

    // إعادة التوجيه أو عرض fallback
    if (!hasAccess) {
        if (redirectTo) {
            return <Navigate to={redirectTo} replace />;
        }
        return <>{fallback || <AccessDeniedPage />}</>;
    }

    return <>{children}</>;
}

/**
 * صفحة رفض الوصول الافتراضية
 */
function AccessDeniedPage() {
    const { profile } = useAuth();

    // تحديد الصفحة الرئيسية للمستخدم بناءً على دوره
    const getHomeRoute = () => {
        if (!profile) return '/login';
        if (TECHNICIAN_ROLES.includes(profile.role as UserRole)) {
            return '/technician';
        }
        return '/dashboard';
    };

    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
            <div className="rounded-full bg-destructive/10 p-4">
                <ShieldX className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">غير مصرح بالوصول</h1>
            <p className="text-muted-foreground max-w-md">
                ليس لديك الصلاحيات الكافية للوصول لهذه الصفحة.
                <br />
                يرجى التواصل مع مدير النظام إذا كنت تعتقد أن هذا خطأ.
            </p>
            <Button onClick={() => window.location.href = getHomeRoute()}>
                العودة للصفحة الرئيسية
            </Button>
        </div>
    );
}

/**
 * ============================================================
 * DashboardGuard - حماية صفحات الداشبورد
 * ============================================================
 * يمنع الفنيين من الوصول للداشبورد ويوجههم لتطبيقهم
 */
export function DashboardGuard({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard
            allowedRoles={DASHBOARD_ROLES}
            redirectTo="/technician"
        >
            {children}
        </RoleGuard>
    );
}

/**
 * ============================================================
 * TechnicianGuard - حماية تطبيق الفني
 * ============================================================
 * يسمح فقط للفنيين بالوصول
 */
export function TechnicianGuard({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard
            allowedRoles={TECHNICIAN_ROLES}
            redirectTo="/dashboard"
        >
            {children}
        </RoleGuard>
    );
}

/**
 * ============================================================
 * AdminGuard - حماية صفحات الإدارة
 * ============================================================
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allowedRoles={['admin']}>
            {children}
        </RoleGuard>
    );
}

/**
 * ============================================================
 * ManagerGuard - حماية صفحات الإدارة
 * ============================================================
 */
export function ManagerGuard({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allowedRoles={['admin', 'manager']}>
            {children}
        </RoleGuard>
    );
}

export default RoleGuard;
