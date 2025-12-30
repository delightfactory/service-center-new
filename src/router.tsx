import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { DashboardLayout, AuthLayout } from '@/layouts';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { CustomersPage, NewCustomerPage, CustomerDetailsPage } from '@/pages/dashboard/customers';
import { VehiclesPage, VehicleDetailsPage, NewVehiclePage } from '@/pages/dashboard/vehicles';
import { ReceptionWizardPage, ReceptionListPage, AssessmentDetailsPage, QuickCheckPage, BenchWorkPage } from '@/pages/dashboard/reception';
import { WorkshopPage, KanbanPage, JobOrderDetailsPage, SupervisorReviewPage } from '@/pages/dashboard/workshop';
import { ProductsPage, ProductDetailsPage, CategoriesPage, InventoryPage, WarehouseTransfersPage, WarehousesPage, StockMovementsPage } from '@/pages/dashboard/inventory';
import { InvoicesPage, TreasuriesPage, ExpensesPage, ExpenseCategoriesPage, CreateInvoicePage, PurchasesPage, PaymentsPage, InvoiceDetailsPage } from '@/pages/dashboard/finance';
import { UsersPage, BranchesPage, ProfilePage } from '@/pages/dashboard/settings';
import { SuppliersPage, SupplierDetailsPage } from '@/pages/dashboard/suppliers';
import { TechLayout, TechJobsPage, TechJobDetailsPage, TechProfilePage } from '@/pages/technician';

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
            // Reception
            {
                path: 'reception',
                children: [
                    {
                        index: true,
                        element: <ReceptionListPage />,
                    },
                    {
                        path: 'new',
                        element: <ReceptionWizardPage />,
                    },
                    {
                        path: ':id',
                        element: <AssessmentDetailsPage />,
                    },
                ],
            },
            // Quick Check - كشف سريع
            {
                path: 'quick-check',
                element: <QuickCheckPage />,
            },
            // Bench Work - صيانة كنترول
            {
                path: 'bench-work',
                element: <BenchWorkPage />,
            },
            // Workshop
            {
                path: 'workshop',
                children: [
                    {
                        index: true,
                        element: <WorkshopPage />,
                    },
                    {
                        path: 'kanban',
                        element: <KanbanPage />,
                    },
                    {
                        path: 'review',
                        element: <SupervisorReviewPage />,
                    },
                    {
                        path: ':id',
                        element: <JobOrderDetailsPage />,
                    },
                ],
            },
            // Customers
            {
                path: 'customers',
                children: [
                    {
                        index: true,
                        element: <CustomersPage />,
                    },
                    {
                        path: 'new',
                        element: <NewCustomerPage />,
                    },
                    {
                        path: ':id',
                        element: <CustomerDetailsPage />,
                    },
                ],
            },
            // Vehicles
            {
                path: 'vehicles',
                children: [
                    {
                        index: true,
                        element: <VehiclesPage />,
                    },
                    {
                        path: 'new',
                        element: <NewVehiclePage />,
                    },
                    {
                        path: ':id',
                        element: <VehicleDetailsPage />,
                    },
                ],
            },
            // Suppliers
            {
                path: 'suppliers',
                children: [
                    {
                        index: true,
                        element: <SuppliersPage />,
                    },
                    {
                        path: ':id',
                        element: <SupplierDetailsPage />,
                    },
                ],
            },
            // Inventory
            {
                path: 'inventory',
                children: [
                    {
                        index: true,
                        element: <ProductsPage />,
                    },
                    {
                        path: 'products',
                        element: <ProductsPage />,
                    },
                    {
                        path: 'products/:id',
                        element: <ProductDetailsPage />,
                    },
                    {
                        path: 'categories',
                        element: <CategoriesPage />,
                    },
                    {
                        path: 'warehouses',
                        element: <WarehousesPage />,
                    },
                    {
                        path: 'stock',
                        element: <InventoryPage />,
                    },
                    {
                        path: 'transfers',
                        element: <WarehouseTransfersPage />,
                    },
                    {
                        path: 'movements',
                        element: <StockMovementsPage />,
                    },
                ],
            },
            // Finance
            {
                path: 'finance',
                children: [
                    {
                        index: true,
                        element: <InvoicesPage />,
                    },
                    {
                        path: 'invoices',
                        element: <InvoicesPage />,
                    },
                    {
                        path: 'invoices/new',
                        element: <CreateInvoicePage />,
                    },
                    {
                        path: 'invoices/:id',
                        element: <InvoiceDetailsPage />,
                    },
                    {
                        path: 'purchases',
                        element: <PurchasesPage />,
                    },
                    {
                        path: 'payments',
                        element: <PaymentsPage />,
                    },
                    {
                        path: 'treasuries',
                        element: <TreasuriesPage />,
                    },
                    {
                        path: 'expenses',
                        element: <ExpensesPage />,
                    },
                    {
                        path: 'expense-categories',
                        element: <ExpenseCategoriesPage />,
                    },
                ],
            },
            // Settings
            {
                path: 'settings',
                children: [
                    {
                        index: true,
                        element: <UsersPage />,
                    },
                    {
                        path: 'branches',
                        element: <BranchesPage />,
                    },
                    {
                        path: 'users',
                        element: <UsersPage />,
                    },
                    {
                        path: 'profile',
                        element: <ProfilePage />,
                    },
                ],
            },
        ],
    },

    // Technician routes
    {
        path: '/tech',
        element: <TechLayout />,
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
