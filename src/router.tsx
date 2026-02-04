import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { DashboardLayout, AuthLayout } from '@/layouts';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import ReportsPage from '@/pages/dashboard/ReportsPage';
import { CustomersPage, NewCustomerPage, CustomerDetailsPage } from '@/pages/dashboard/customers';
import { VehiclesPage, VehicleDetailsPage, NewVehiclePage } from '@/pages/dashboard/vehicles';
import { ReceptionWizardPage, ReceptionListPage, AssessmentDetailsPage, QuickCheckPage, BenchWorkPage } from '@/pages/dashboard/reception';
import { WorkshopPage, KanbanPage, JobOrderDetailsPage, SupervisorReviewPage } from '@/pages/dashboard/workshop';
import { ProductsPage, ProductDetailsPage, CategoriesPage, InventoryPage, WarehouseTransfersPage, WarehousesPage, StockMovementsPage, StockAuditPage } from '@/pages/dashboard/inventory';
import { InvoicesPage, TreasuriesPage, ExpensesPage, ExpenseCategoriesPage, CreateInvoicePage, PurchasesPage, PaymentsPage, InvoiceDetailsPage } from '@/pages/dashboard/finance';
import { UsersPage, BranchesPage, ProfilePage } from '@/pages/dashboard/settings';
import { SuppliersPage, SupplierDetailsPage } from '@/pages/dashboard/suppliers';
import { TechLayout, TechJobsPage, TechJobDetailsPage, TechProfilePage } from '@/pages/technician';
import { RoleGuard, TechnicianGuard } from '@/components/auth';

const router = createBrowserRouter([
    // Root redirect
    {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
    },

    // Auth routes
    {
        element: <AuthLayout />,
        children: [
            {
                path: '/login',
                element: <LoginPage />,
            },
            {
                path: '/forgot-password',
                element: <ForgotPasswordPage />,
            },
        ],
    },

    // Dashboard routes
    {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
            {
                index: true,
                element: <DashboardPage />,
            },
            // Reports - للإدارة فقط (الأدمن والمدير)
            {
                path: 'reports',
                element: (
                    <RoleGuard allowedRoles={['admin', 'manager']}>
                        <ReportsPage />
                    </RoleGuard>
                ),
            },
            // Reception - للإدارة والمشرفين والمهندسين
            {
                path: 'reception',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <ReceptionListPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'new',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'engineer']}>
                                <ReceptionWizardPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: ':id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <AssessmentDetailsPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Quick Check - كشف سريع
            {
                path: 'quick-check',
                element: (
                    <RoleGuard allowedRoles={['admin', 'manager', 'engineer']}>
                        <QuickCheckPage />
                    </RoleGuard>
                ),
            },
            // Bench Work - صيانة كنترول
            {
                path: 'bench-work',
                element: (
                    <RoleGuard allowedRoles={['admin', 'manager', 'engineer']}>
                        <BenchWorkPage />
                    </RoleGuard>
                ),
            },
            // Workshop - للإدارة والمشرفين والمهندسين
            {
                path: 'workshop',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <WorkshopPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'kanban',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <KanbanPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'review',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor']}>
                                <SupervisorReviewPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: ':id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <JobOrderDetailsPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Customers - للإدارة والمشرفين والمهندسين والمحاسب
            {
                path: 'customers',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer', 'accountant']}>
                                <CustomersPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'new',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'engineer']}>
                                <NewCustomerPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: ':id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer', 'accountant']}>
                                <CustomerDetailsPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Vehicles - للإدارة والمشرفين والمهندسين
            {
                path: 'vehicles',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <VehiclesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'new',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'engineer']}>
                                <NewVehiclePage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: ':id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'supervisor', 'engineer']}>
                                <VehicleDetailsPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Suppliers - للإدارة وأمين المخزن
            {
                path: 'suppliers',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse', 'accountant']}>
                                <SuppliersPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: ':id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse', 'accountant']}>
                                <SupplierDetailsPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Inventory - للإدارة وأمين المخزن
            {
                path: 'inventory',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <ProductsPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'products',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <ProductsPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'products/:id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <ProductDetailsPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'categories',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <CategoriesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'warehouses',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <WarehousesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'stock',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <InventoryPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'transfers',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <WarehouseTransfersPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'movements',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <StockMovementsPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'audit',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'warehouse']}>
                                <StockAuditPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Finance - للإدارة والمحاسب
            {
                path: 'finance',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <InvoicesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'invoices',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <InvoicesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'invoices/new',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <CreateInvoicePage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'invoices/:id',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant', 'supervisor', 'engineer']}>
                                <InvoiceDetailsPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'purchases',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant', 'warehouse']}>
                                <PurchasesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'payments',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <PaymentsPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'treasuries',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <TreasuriesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'expenses',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <ExpensesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'expense-categories',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager', 'accountant']}>
                                <ExpenseCategoriesPage />
                            </RoleGuard>
                        ),
                    },
                ],
            },
            // Settings - للإدارة فقط
            {
                path: 'settings',
                children: [
                    {
                        index: true,
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager']}>
                                <UsersPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'branches',
                        element: (
                            <RoleGuard allowedRoles={['admin']}>
                                <BranchesPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'users',
                        element: (
                            <RoleGuard allowedRoles={['admin', 'manager']}>
                                <UsersPage />
                            </RoleGuard>
                        ),
                    },
                    {
                        path: 'profile',
                        // Profile متاح للجميع
                        element: <ProfilePage />,
                    },
                ],
            },
        ],
    },

    // Technician routes - للفنيين فقط
    {
        path: '/tech',
        element: (
            <TechnicianGuard>
                <TechLayout />
            </TechnicianGuard>
        ),
        children: [
            {
                index: true,
                element: <TechJobsPage />,
            },
            {
                path: 'job/:id',
                element: <TechJobDetailsPage />,
            },
            {
                path: 'profile',
                element: <TechProfilePage />,
            },
        ],
    },

    // Legacy technician route redirect
    {
        path: '/technician',
        element: <Navigate to="/tech" replace />,
    },

    // Legacy auth route redirects
    {
        path: '/auth/login',
        element: <Navigate to="/login" replace />,
    },

    // 404
    {
        path: '*',
        element: (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">404</h1>
                    <p className="text-muted-foreground">الصفحة غير موجودة</p>
                </div>
            </div>
        ),
    },
]);

export function AppRouter() {
    return <RouterProvider router={router} />;
}
