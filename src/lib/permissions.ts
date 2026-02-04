/**
 * ============================================================
 * نظام الصلاحيات المركزي - Centralized Permissions System
 * ============================================================
 * هذا الملف يحدد جميع الصلاحيات في التطبيق بشكل مركزي
 * ============================================================
 */

// الأدوار المتاحة في النظام
export type UserRole =
    | 'admin'       // مدير النظام
    | 'manager'     // مدير فرع
    | 'supervisor'  // مشرف
    | 'engineer'    // مهندس استقبال
    | 'technician'  // فني
    | 'warehouse'   // أمين مخزن
    | 'accountant'; // محاسب

// تعريف الإجراءات الممكنة
export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'manage' | 'cancel';

// تعريف الموارد
export type PermissionResource =
    | 'dashboard'
    | 'reports'
    | 'reception'
    | 'workshop'
    | 'customers'
    | 'vehicles'
    | 'suppliers'
    | 'inventory'
    | 'finance'
    | 'settings'
    | 'users'
    | 'branches'
    | 'invoices'
    | 'payments'
    | 'expenses'
    | 'treasuries'
    | 'products'
    | 'categories'
    | 'warehouses'
    | 'job_orders'
    | 'job_tasks'
    | 'assessments'
    | 'expense_categories'  // بنود المصروفات
    | 'purchases'           // المشتريات
    | 'warehouse_transfers' // تحويلات المخزن
    // موارد تطبيق الفني
    | 'tech_profile'    // ملف الفني الشخصي
    | 'custody'         // العهدة
    | 'task_stages'     // مراحل المهمة
    | 'work_logs';      // سجل العمل


// ============================================================
// تعريف الصلاحيات لكل مورد
// ============================================================
export const PERMISSIONS: Record<PermissionResource, Partial<Record<PermissionAction, UserRole[]>>> = {
    // لوحة التحكم - متاحة للجميع ما عدا الفني
    dashboard: {
        read: ['admin', 'manager', 'supervisor', 'engineer', 'warehouse', 'accountant'],
    },

    // التقارير - متاحة للإدارة فقط
    reports: {
        read: ['admin', 'manager'],
    },

    // الاستقبال
    reception: {
        read: ['admin', 'manager', 'supervisor', 'engineer'],
        create: ['admin', 'manager', 'engineer'],
        update: ['admin', 'manager', 'engineer'],
        delete: ['admin', 'manager'],
    },

    // ساحة العمل
    workshop: {
        read: ['admin', 'manager', 'supervisor', 'engineer'],
        manage: ['admin', 'manager', 'supervisor'],
    },

    // العملاء
    customers: {
        read: ['admin', 'manager', 'supervisor', 'engineer', 'accountant'],
        create: ['admin', 'manager', 'engineer'],
        update: ['admin', 'manager', 'engineer'],
        delete: ['admin', 'manager'],
    },

    // المركبات
    vehicles: {
        read: ['admin', 'manager', 'supervisor', 'engineer'],
        create: ['admin', 'manager', 'engineer'],
        update: ['admin', 'manager', 'engineer'],
        delete: ['admin', 'manager'],
    },

    // الموردين
    suppliers: {
        read: ['admin', 'manager', 'warehouse', 'accountant'],
        create: ['admin', 'manager', 'warehouse'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin', 'manager'],
    },

    // المخزون
    inventory: {
        read: ['admin', 'manager', 'warehouse', 'supervisor'],
        create: ['admin', 'manager', 'warehouse'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin', 'manager'],
        manage: ['admin', 'manager', 'warehouse'],
    },

    // المالية
    finance: {
        read: ['admin', 'manager', 'accountant'],
        create: ['admin', 'manager', 'accountant'],
        update: ['admin', 'manager', 'accountant'],
        delete: ['admin'],
        approve: ['admin', 'manager'],
    },

    // الإعدادات
    settings: {
        read: ['admin', 'manager'],
        update: ['admin', 'manager'],
        manage: ['admin'],
    },

    // المستخدمين
    users: {
        read: ['admin', 'manager'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin'],
    },

    // الفروع
    branches: {
        read: ['admin', 'manager'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin'],
    },

    // الفواتير
    invoices: {
        read: ['admin', 'manager', 'accountant', 'supervisor', 'engineer'],
        create: ['admin', 'manager', 'accountant', 'engineer'],
        update: ['admin', 'manager', 'accountant'],
        delete: ['admin'],
        approve: ['admin', 'manager', 'accountant'],
        cancel: ['admin', 'manager'], // إلغاء الفاتورة - المالك والمدير فقط
    },

    // المدفوعات
    payments: {
        read: ['admin', 'manager', 'accountant'],
        create: ['admin', 'manager', 'accountant'],
        update: ['admin', 'manager', 'accountant'],
        delete: ['admin', 'manager'], // حذف الدفعة - المالك والمدير فقط
    },

    // المصروفات
    expenses: {
        read: ['admin', 'manager', 'accountant'],
        create: ['admin', 'manager', 'accountant'],
        update: ['admin', 'manager', 'accountant'],
        delete: ['admin'],
        approve: ['admin', 'manager'],
    },

    // الخزن
    treasuries: {
        read: ['admin', 'manager', 'accountant'],
        create: ['admin', 'manager'],
        update: ['admin', 'manager'],
        delete: ['admin'],
        manage: ['admin', 'manager', 'accountant'],
    },

    // المنتجات
    products: {
        read: ['admin', 'manager', 'warehouse', 'supervisor', 'engineer'],
        create: ['admin', 'manager', 'warehouse'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin', 'manager'],
    },

    // التصنيفات
    categories: {
        read: ['admin', 'manager', 'warehouse', 'supervisor', 'engineer'],
        create: ['admin', 'manager', 'warehouse'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin', 'manager'],
    },

    // المخازن
    warehouses: {
        read: ['admin', 'manager', 'warehouse'],
        create: ['admin', 'manager'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin'],
    },

    // أوامر الشغل
    job_orders: {
        read: ['admin', 'manager', 'supervisor', 'engineer', 'technician'],
        create: ['admin', 'manager', 'supervisor', 'engineer'],
        update: ['admin', 'manager', 'supervisor', 'engineer'],
        delete: ['admin', 'manager'],
        approve: ['admin', 'manager', 'supervisor'],
        cancel: ['admin', 'manager'], // إلغاء أمر الشغل - المالك والمدير فقط
    },

    // المهام
    job_tasks: {
        read: ['admin', 'manager', 'supervisor', 'engineer', 'technician'],
        create: ['admin', 'manager', 'supervisor'],
        update: ['admin', 'manager', 'supervisor', 'technician'],
        delete: ['admin', 'manager', 'supervisor'],
    },

    // التقييمات
    assessments: {
        read: ['admin', 'manager', 'supervisor', 'engineer'],
        create: ['admin', 'manager', 'engineer'],
        update: ['admin', 'manager', 'supervisor', 'engineer'],
        delete: ['admin', 'manager'],
        approve: ['admin', 'manager', 'supervisor'],
    },

    // بنود المصروفات
    expense_categories: {
        read: ['admin', 'manager', 'accountant'],
        create: ['admin', 'manager'],
        update: ['admin', 'manager'],
        delete: ['admin'],
    },

    // المشتريات
    purchases: {
        read: ['admin', 'manager', 'accountant', 'warehouse'],
        create: ['admin', 'manager', 'accountant', 'warehouse'],
        update: ['admin', 'manager', 'accountant'],
        delete: ['admin'],
        approve: ['admin', 'manager'],
    },

    // تحويلات المخزن
    warehouse_transfers: {
        read: ['admin', 'manager', 'warehouse'],
        create: ['admin', 'manager', 'warehouse'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin'],
        approve: ['admin', 'manager'],
    },

    // ============================================================
    // موارد تطبيق الفني - Technician App Resources
    // ============================================================

    // ملف الفني الشخصي
    tech_profile: {
        read: ['technician'],
        update: ['technician'],
    },

    // العهدة - الفني يمكنه القراءة فقط وعرض عهدته
    custody: {
        read: ['admin', 'manager', 'supervisor', 'warehouse', 'technician'],
        create: ['admin', 'manager', 'warehouse'],
        update: ['admin', 'manager', 'warehouse'],
        delete: ['admin', 'manager'],
        manage: ['admin', 'manager', 'warehouse'],
    },

    // مراحل المهمة - الفني يمكنه تحديث مراحل مهامه
    task_stages: {
        read: ['admin', 'manager', 'supervisor', 'engineer', 'technician'],
        create: ['admin', 'manager', 'supervisor'],
        update: ['admin', 'manager', 'supervisor', 'technician'],
        delete: ['admin', 'manager', 'supervisor'],
    },

    // سجل العمل - الفني يمكنه إضافة سجلات عمله
    work_logs: {
        read: ['admin', 'manager', 'supervisor', 'engineer', 'technician'],
        create: ['admin', 'manager', 'supervisor', 'technician'],
        update: ['admin', 'manager', 'supervisor', 'technician'],
        delete: ['admin', 'manager', 'supervisor'],
    },
};


// ============================================================
// دوال التحقق من الصلاحيات
// ============================================================

/**
 * التحقق إذا كان الدور يمكنه تنفيذ إجراء معين على مورد
 */
export function canPerform(
    resource: PermissionResource,
    action: PermissionAction,
    role: UserRole | string | undefined
): boolean {
    if (!role) return false;
    const allowedRoles = PERMISSIONS[resource]?.[action];
    if (!allowedRoles) return false;
    return allowedRoles.includes(role as UserRole);
}

/**
 * التحقق إذا كان الدور يمكنه الوصول لمسار معين
 */
export function canAccessRoute(route: string, role: UserRole | string | undefined): boolean {
    if (!role) return false;

    // استخراج الـ resource من المسار
    const resource = extractResourceFromRoute(route);
    if (!resource) return true; // مسارات عامة

    return canPerform(resource, 'read', role);
}

/**
 * استخراج المورد من المسار
 */
function extractResourceFromRoute(route: string): PermissionResource | null {
    const routeMap: Record<string, PermissionResource> = {
        '/dashboard': 'dashboard',
        '/dashboard/reports': 'reports',
        '/dashboard/reception': 'reception',
        '/dashboard/workshop': 'workshop',
        '/dashboard/customers': 'customers',
        '/dashboard/vehicles': 'vehicles',
        '/dashboard/suppliers': 'suppliers',
        '/dashboard/inventory': 'inventory',
        '/dashboard/finance': 'finance',
        '/dashboard/settings': 'settings',
    };

    // البحث عن أقرب تطابق
    for (const [path, resource] of Object.entries(routeMap)) {
        if (route === path || route.startsWith(path + '/')) {
            return resource;
        }
    }

    return null;
}

/**
 * الحصول على الأدوار المسموح بها لمورد وإجراء معين
 */
export function getAllowedRoles(
    resource: PermissionResource,
    action: PermissionAction
): UserRole[] {
    return PERMISSIONS[resource]?.[action] || [];
}

/**
 * الحصول على جميع الموارد المتاحة لدور معين
 */
export function getAccessibleResources(role: UserRole): PermissionResource[] {
    const resources: PermissionResource[] = [];

    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
        if (actions.read?.includes(role)) {
            resources.push(resource as PermissionResource);
        }
    }

    return resources;
}

// ============================================================
// تصنيف الأدوار
// ============================================================

// أدوار إدارية
export const ADMIN_ROLES: UserRole[] = ['admin', 'manager'];

// أدوار تشغيلية
export const OPERATIONAL_ROLES: UserRole[] = ['supervisor', 'engineer', 'technician'];

// أدوار دعم
export const SUPPORT_ROLES: UserRole[] = ['warehouse', 'accountant'];

// أدوار الـ Dashboard (غير الفنيين)
export const DASHBOARD_ROLES: UserRole[] = ['admin', 'manager', 'supervisor', 'engineer', 'warehouse', 'accountant'];

// أدوار تطبيق الفني
export const TECHNICIAN_ROLES: UserRole[] = ['technician'];

/**
 * التحقق إذا كان الدور إدارياً
 */
export function isAdminRole(role: UserRole | string | undefined): boolean {
    if (!role) return false;
    return ADMIN_ROLES.includes(role as UserRole);
}

/**
 * التحقق إذا كان الدور لديه صلاحيات الموافقة
 */
export function canApprove(resource: PermissionResource, role: UserRole | string | undefined): boolean {
    return canPerform(resource, 'approve', role);
}

/**
 * التحقق إذا كان الدور يمكنه الإدارة
 */
export function canManage(resource: PermissionResource, role: UserRole | string | undefined): boolean {
    return canPerform(resource, 'manage', role);
}
