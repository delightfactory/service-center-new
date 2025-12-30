import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// تعريف المسارات وأسماءها
const routeLabels: Record<string, string> = {
    'dashboard': 'الرئيسية',
    'reception': 'الاستقبال',
    'new': 'جديد',
    'quick-check': 'كشف سريع',
    'bench-work': 'صيانة كنترول',
    'workshop': 'ساحة العمل',
    'kanban': 'عرض Kanban',
    'review': 'مراجعة المشرف',
    'customers': 'العملاء',
    'vehicles': 'المركبات',
    'suppliers': 'الموردين',
    'inventory': 'المخزون',
    'products': 'المنتجات',
    'categories': 'التصنيفات',
    'warehouses': 'المخازن',
    'stock': 'الأرصدة',
    'transfers': 'التحويلات',
    'movements': 'الحركات',
    'finance': 'المالية',
    'invoices': 'الفواتير',
    'purchases': 'المشتريات',
    'payments': 'المدفوعات',
    'treasuries': 'الخزن',
    'expenses': 'المصروفات',
    'expense-categories': 'بنود المصروفات',
    'settings': 'الإعدادات',
    'users': 'المستخدمين',
    'branches': 'الفروع',
    'profile': 'الملف الشخصي',
};

interface BreadcrumbsProps {
    className?: string;
}

export function Breadcrumbs({ className }: BreadcrumbsProps) {
    const location = useLocation();

    // تحليل المسار الحالي
    const pathSegments = location.pathname.split('/').filter(Boolean);

    // لا تعرض Breadcrumbs في الصفحة الرئيسية فقط
    if (pathSegments.length <= 1) return null;

    // بناء مسارات الـ Breadcrumbs
    const breadcrumbs = pathSegments.map((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/');
        const isLast = index === pathSegments.length - 1;

        // تحقق من أن المسار ليس ID (UUID)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);

        // الحصول على الاسم المعروض
        let label = routeLabels[segment] || segment;
        if (isUuid) {
            label = 'التفاصيل';
        }

        return {
            label,
            path,
            isLast,
            isUuid,
        };
    });

    return (
        <nav
            aria-label="Breadcrumb"
            className={cn(
                "flex items-center gap-1.5 text-sm text-muted-foreground mb-4",
                className
            )}
        >
            {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.path}>
                    {index > 0 && (
                        <ChevronLeft size={14} className="text-muted-foreground/50" />
                    )}
                    {item.isLast ? (
                        <span className="text-foreground font-medium">
                            {item.label}
                        </span>
                    ) : (
                        <Link
                            to={item.path}
                            className="hover:text-foreground transition-colors"
                        >
                            {index === 0 ? (
                                <span className="flex items-center gap-1">
                                    <Home size={14} />
                                    {item.label}
                                </span>
                            ) : (
                                item.label
                            )}
                        </Link>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

export default Breadcrumbs;
