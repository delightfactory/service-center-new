// ============================================================
// Centralized Query Keys
// Structured for optimal caching with React Query
// ============================================================

// ============================================================
// Query Keys Factory
// ============================================================

export const queryKeys = {
    // ============================================================
    // Core
    // ============================================================
    auth: {
        all: ['auth'] as const,
        session: ['auth', 'session'] as const,
        user: ['auth', 'user'] as const,
        profile: ['auth', 'profile'] as const,
    },

    profiles: {
        all: ['profiles'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.profiles.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.profiles.all, 'detail', id] as const,
        byRole: (role: string) => [...queryKeys.profiles.all, 'byRole', role] as const,
        technicians: (branchId?: string) => [...queryKeys.profiles.all, 'technicians', branchId] as const,
    },

    branches: {
        all: ['branches'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.branches.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.branches.all, 'detail', id] as const,
        active: ['branches', 'active'] as const,
        main: ['branches', 'main'] as const,
    },

    warehouses: {
        all: ['warehouses'] as const,
        list: (branchId?: string) => [...queryKeys.warehouses.all, 'list', branchId] as const,
        detail: (id: string) => [...queryKeys.warehouses.all, 'detail', id] as const,
        default: (branchId: string) => [...queryKeys.warehouses.all, 'default', branchId] as const,
    },

    // ============================================================
    // CRM
    // ============================================================
    customers: {
        all: ['customers'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.customers.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.customers.all, 'detail', id] as const,
        search: (query: string) => [...queryKeys.customers.all, 'search', query] as const,
        vehicles: (customerId: string) => [...queryKeys.customers.all, customerId, 'vehicles'] as const,
        withBalance: ['customers', 'withBalance'] as const,
        statement: (customerId: string, dateFrom?: string, dateTo?: string) =>
            [...queryKeys.customers.all, customerId, 'statement', dateFrom, dateTo] as const,
    },

    vehicles: {
        all: ['vehicles'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.vehicles.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.vehicles.all, 'detail', id] as const,
        byCustomer: (customerId: string) => [...queryKeys.vehicles.all, 'byCustomer', customerId] as const,
        byPlate: (plateNumber: string) => [...queryKeys.vehicles.all, 'byPlate', plateNumber] as const,
        search: (query: string) => [...queryKeys.vehicles.all, 'search', query] as const,
        serviceHistory: (vehicleId: string) => [...queryKeys.vehicles.all, vehicleId, 'serviceHistory'] as const,
    },

    suppliers: {
        all: ['suppliers'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.suppliers.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.suppliers.all, 'detail', id] as const,
        search: (query: string) => [...queryKeys.suppliers.all, 'search', query] as const,
        active: ['suppliers', 'active'] as const,
        withBalance: ['suppliers', 'withBalance'] as const,
        statement: (supplierId: string, dateFrom?: string, dateTo?: string) =>
            [...queryKeys.suppliers.all, supplierId, 'statement', dateFrom, dateTo] as const,
    },

    // ============================================================
    // Operations
    // ============================================================
    assessments: {
        all: ['assessments'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.assessments.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.assessments.all, 'detail', id] as const,
        byStatus: (status: string) => [...queryKeys.assessments.all, 'byStatus', status] as const,
        byCustomer: (customerId: string) => [...queryKeys.assessments.all, 'byCustomer', customerId] as const,
        today: (branchId?: string) => [...queryKeys.assessments.all, 'today', branchId] as const,
        pending: (branchId?: string) => [...queryKeys.assessments.all, 'pending', branchId] as const,
    },

    jobOrders: {
        all: ['jobOrders'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.jobOrders.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.jobOrders.all, 'detail', id] as const,
        byStatus: (status: string) => [...queryKeys.jobOrders.all, 'byStatus', status] as const,
        byTechnician: (technicianId: string) => [...queryKeys.jobOrders.all, 'byTechnician', technicianId] as const,
        byCustomer: (customerId: string) => [...queryKeys.jobOrders.all, 'byCustomer', customerId] as const,
        byVehicle: (vehicleId: string) => [...queryKeys.jobOrders.all, 'byVehicle', vehicleId] as const,
        active: (branchId?: string) => [...queryKeys.jobOrders.all, 'active', branchId] as const,
        today: (branchId?: string) => [...queryKeys.jobOrders.all, 'today', branchId] as const,
        summary: (branchId?: string) => [...queryKeys.jobOrders.all, 'summary', branchId] as const,
    },

    jobItems: {
        all: ['jobItems'] as const,
        byJobOrder: (jobOrderId: string) => [...queryKeys.jobItems.all, 'byJobOrder', jobOrderId] as const,
        detail: (id: string) => [...queryKeys.jobItems.all, 'detail', id] as const,
        totals: (jobOrderId: string) => [...queryKeys.jobItems.all, 'totals', jobOrderId] as const,
    },

    jobTechnicians: {
        all: ['jobTechnicians'] as const,
        byJobOrder: (jobOrderId: string) => [...queryKeys.jobTechnicians.all, 'byJobOrder', jobOrderId] as const,
        byTechnician: (technicianId: string) => [...queryKeys.jobTechnicians.all, 'byTechnician', technicianId] as const,
    },

    // ============================================================
    // Inventory
    // ============================================================
    categories: {
        all: ['categories'] as const,
        list: ['categories', 'list'] as const,
        tree: ['categories', 'tree'] as const,
        withProductCount: ['categories', 'withProductCount'] as const,
    },

    products: {
        all: ['products'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.products.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.products.all, 'detail', id] as const,
        byCategory: (categoryId: string) => [...queryKeys.products.all, 'byCategory', categoryId] as const,
        services: ['products', 'services'] as const,
        parts: ['products', 'parts'] as const,
        search: (query: string) => [...queryKeys.products.all, 'search', query] as const,
        lowStock: (warehouseId?: string) => [...queryKeys.products.all, 'lowStock', warehouseId] as const,
        components: (serviceId: string) => [...queryKeys.products.all, serviceId, 'components'] as const,
    },

    inventory: {
        all: ['inventory'] as const,
        byWarehouse: (warehouseId: string) => [...queryKeys.inventory.all, 'byWarehouse', warehouseId] as const,
        byProduct: (productId: string) => [...queryKeys.inventory.all, 'byProduct', productId] as const,
        transactions: (params: Record<string, unknown>) => [...queryKeys.inventory.all, 'transactions', params] as const,
    },

    // ============================================================
    // Finance
    // ============================================================
    treasuries: {
        all: ['treasuries'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.treasuries.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.treasuries.all, 'detail', id] as const,
        default: (branchId: string) => [...queryKeys.treasuries.all, 'default', branchId] as const,
        transactions: (params: Record<string, unknown>) => [...queryKeys.treasuries.all, 'transactions', params] as const,
        balances: (branchId?: string) => [...queryKeys.treasuries.all, 'balances', branchId] as const,
    },

    invoices: {
        all: ['invoices'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.invoices.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.invoices.all, 'detail', id] as const,
        byCustomer: (customerId: string) => [...queryKeys.invoices.all, 'byCustomer', customerId] as const,
        bySupplier: (supplierId: string) => [...queryKeys.invoices.all, 'bySupplier', supplierId] as const,
        byJobOrder: (jobOrderId: string) => [...queryKeys.invoices.all, 'byJobOrder', jobOrderId] as const,
        unpaid: (type?: string) => [...queryKeys.invoices.all, 'unpaid', type] as const,
        overdue: ['invoices', 'overdue'] as const,
        revenue: (branchId?: string, dateFrom?: string, dateTo?: string) =>
            [...queryKeys.invoices.all, 'revenue', branchId, dateFrom, dateTo] as const,
    },

    payments: {
        all: ['payments'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.payments.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.payments.all, 'detail', id] as const,
        byInvoice: (invoiceId: string) => [...queryKeys.payments.all, 'byInvoice', invoiceId] as const,
        byCustomer: (customerId: string) => [...queryKeys.payments.all, 'byCustomer', customerId] as const,
        bySupplier: (supplierId: string) => [...queryKeys.payments.all, 'bySupplier', supplierId] as const,
        today: (branchId?: string) => [...queryKeys.payments.all, 'today', branchId] as const,
        summary: (branchId?: string, dateFrom?: string, dateTo?: string) =>
            [...queryKeys.payments.all, 'summary', branchId, dateFrom, dateTo] as const,
    },

    expenses: {
        all: ['expenses'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.expenses.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.expenses.all, 'detail', id] as const,
        pending: (branchId?: string) => [...queryKeys.expenses.all, 'pending', branchId] as const,
        summary: (branchId?: string, dateFrom?: string, dateTo?: string) =>
            [...queryKeys.expenses.all, 'summary', branchId, dateFrom, dateTo] as const,
    },

    creditDebitNotes: {
        all: ['creditDebitNotes'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.creditDebitNotes.all, 'list', params] as const,
        detail: (id: string) => [...queryKeys.creditDebitNotes.all, 'detail', id] as const,
        byCustomer: (customerId: string) => [...queryKeys.creditDebitNotes.all, 'byCustomer', customerId] as const,
    },

    // ============================================================
    // Activity Log
    // ============================================================
    activityLogs: {
        all: ['activityLogs'] as const,
        list: (params: Record<string, unknown>) => [...queryKeys.activityLogs.all, 'list', params] as const,
        byEntity: (entityType: string, entityId: string) =>
            [...queryKeys.activityLogs.all, 'byEntity', entityType, entityId] as const,
        byUser: (userId: string) => [...queryKeys.activityLogs.all, 'byUser', userId] as const,
    },

    // ============================================================
    // Dashboard / Reports
    // ============================================================
    dashboard: {
        all: ['dashboard'] as const,
        stats: (branchId?: string) => [...queryKeys.dashboard.all, 'stats', branchId] as const,
        recentJobs: (branchId?: string) => [...queryKeys.dashboard.all, 'recentJobs', branchId] as const,
        todayRevenue: (branchId?: string) => [...queryKeys.dashboard.all, 'todayRevenue', branchId] as const,
        charts: (branchId?: string, period?: string) => [...queryKeys.dashboard.all, 'charts', branchId, period] as const,
    },
} as const;

// ============================================================
// Type Exports
// ============================================================

export type QueryKeys = typeof queryKeys;
