-- ============================================================
-- نظام إدارة مركز صيانة السيارات - سياسات أمان RLS
-- الإصدار: 1.1 (متوافق 100% مع Supabase SQL Editor)
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: جميع الملفات السابقة
-- ملاحظة: تم تحديث استدعاءات الدوال لاستخدام public schema
-- ============================================================

-- ============================================================
-- تفعيل RLS على جميع الجداول
-- ============================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. سياسات جدول branches
-- ============================================================
DROP POLICY IF EXISTS "branches_select_all" ON branches;
CREATE POLICY "branches_select_all" ON branches 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "branches_admin_modify" ON branches;
CREATE POLICY "branches_admin_modify" ON branches 
    FOR ALL USING (public.get_user_role() = 'admin');

-- ============================================================
-- 2. سياسات جدول profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles 
    FOR SELECT USING (
        auth.uid() = id 
        OR branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles 
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 3. سياسات جدول warehouses
-- ============================================================
DROP POLICY IF EXISTS "warehouses_select" ON warehouses;
CREATE POLICY "warehouses_select" ON warehouses 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "warehouses_modify" ON warehouses;
CREATE POLICY "warehouses_modify" ON warehouses 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'warehouse'));

-- ============================================================
-- 4. سياسات جدول customers
-- ============================================================
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers 
    FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers 
    FOR UPDATE USING (
        branch_id = public.get_user_branch_id()
        OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers 
    FOR DELETE USING (public.is_admin_or_manager());

-- ============================================================
-- 5. سياسات جدول vehicles
-- ============================================================
DROP POLICY IF EXISTS "vehicles_select" ON vehicles;
CREATE POLICY "vehicles_select" ON vehicles 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM customers c 
            WHERE c.id = vehicles.customer_id 
            AND (c.branch_id = public.get_user_branch_id() OR public.get_user_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS "vehicles_modify" ON vehicles;
CREATE POLICY "vehicles_modify" ON vehicles 
    FOR ALL USING (public.can_modify() OR public.get_user_role() IN ('warehouse', 'accountant'));

-- ============================================================
-- 6. سياسات جدول suppliers
-- ============================================================
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "suppliers_modify" ON suppliers;
CREATE POLICY "suppliers_modify" ON suppliers 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'accountant', 'warehouse'));

-- ============================================================
-- 7. سياسات جدول assessments
-- ============================================================
DROP POLICY IF EXISTS "assessments_select" ON assessments;
CREATE POLICY "assessments_select" ON assessments 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "assessments_insert" ON assessments;
CREATE POLICY "assessments_insert" ON assessments 
    FOR INSERT WITH CHECK (public.can_modify());

DROP POLICY IF EXISTS "assessments_update" ON assessments;
CREATE POLICY "assessments_update" ON assessments 
    FOR UPDATE USING (
        received_by = auth.uid() 
        OR public.is_admin_or_manager()
    );

-- ============================================================
-- 8. سياسات جدول job_orders
-- ============================================================
DROP POLICY IF EXISTS "job_orders_select" ON job_orders;
CREATE POLICY "job_orders_select" ON job_orders 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM job_technicians jt 
            WHERE jt.job_order_id = job_orders.id 
            AND jt.technician_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "job_orders_insert" ON job_orders;
CREATE POLICY "job_orders_insert" ON job_orders 
    FOR INSERT WITH CHECK (public.can_modify());

DROP POLICY IF EXISTS "job_orders_update" ON job_orders;
CREATE POLICY "job_orders_update" ON job_orders 
    FOR UPDATE USING (
        created_by = auth.uid()
        OR public.is_admin_or_manager()
        OR public.get_user_role() = 'supervisor'
    );

DROP POLICY IF EXISTS "job_orders_delete" ON job_orders;
CREATE POLICY "job_orders_delete" ON job_orders 
    FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- 9. سياسات جدول job_items
-- ============================================================
DROP POLICY IF EXISTS "job_items_select" ON job_items;
CREATE POLICY "job_items_select" ON job_items 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM job_orders jo 
            WHERE jo.id = job_items.job_order_id
            AND (jo.branch_id = public.get_user_branch_id() OR public.get_user_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS "job_items_modify" ON job_items;
CREATE POLICY "job_items_modify" ON job_items 
    FOR ALL USING (public.can_modify());

DROP POLICY IF EXISTS "job_items_tech_complete" ON job_items;
CREATE POLICY "job_items_tech_complete" ON job_items 
    FOR UPDATE USING (
        public.get_user_role() = 'technician' 
        AND EXISTS (
            SELECT 1 FROM job_technicians jt 
            WHERE jt.job_order_id = job_items.job_order_id 
            AND jt.technician_id = auth.uid()
        )
    );

-- ============================================================
-- 10. سياسات جدول job_technicians
-- ============================================================
DROP POLICY IF EXISTS "job_technicians_select" ON job_technicians;
CREATE POLICY "job_technicians_select" ON job_technicians 
    FOR SELECT USING (
        technician_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM job_orders jo 
            WHERE jo.id = job_technicians.job_order_id
            AND (jo.branch_id = public.get_user_branch_id() OR public.get_user_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS "job_technicians_modify" ON job_technicians;
CREATE POLICY "job_technicians_modify" ON job_technicians 
    FOR ALL USING (public.can_modify());

-- ============================================================
-- 11. سياسات جداول المخزون
-- ============================================================

-- categories
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_modify" ON categories;
CREATE POLICY "categories_modify" ON categories 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- products
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_modify" ON products;
CREATE POLICY "products_modify" ON products 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- service_components
DROP POLICY IF EXISTS "service_components_select" ON service_components;
CREATE POLICY "service_components_select" ON service_components 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_components_modify" ON service_components;
CREATE POLICY "service_components_modify" ON service_components 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- inventory_items
DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
CREATE POLICY "inventory_items_select" ON inventory_items 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM warehouses w 
            WHERE w.id = inventory_items.warehouse_id
            AND (w.branch_id = public.get_user_branch_id() OR public.get_user_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS "inventory_items_modify" ON inventory_items;
CREATE POLICY "inventory_items_modify" ON inventory_items 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- inventory_transactions
DROP POLICY IF EXISTS "inventory_tx_select" ON inventory_transactions;
CREATE POLICY "inventory_tx_select" ON inventory_transactions 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM warehouses w 
            WHERE w.id = inventory_transactions.warehouse_id
            AND (w.branch_id = public.get_user_branch_id() OR public.get_user_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS "inventory_tx_insert" ON inventory_transactions;
CREATE POLICY "inventory_tx_insert" ON inventory_transactions 
    FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'warehouse') OR created_by IS NULL);

DROP POLICY IF EXISTS "inventory_tx_admin" ON inventory_transactions;
CREATE POLICY "inventory_tx_admin" ON inventory_transactions 
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- ============================================================
-- 12. سياسات جداول المالية
-- ============================================================

-- treasuries
DROP POLICY IF EXISTS "treasuries_select" ON treasuries;
CREATE POLICY "treasuries_select" ON treasuries 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "treasuries_modify" ON treasuries;
CREATE POLICY "treasuries_modify" ON treasuries 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'accountant'));

-- account_categories
DROP POLICY IF EXISTS "account_categories_select" ON account_categories;
CREATE POLICY "account_categories_select" ON account_categories 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "account_categories_modify" ON account_categories;
CREATE POLICY "account_categories_modify" ON account_categories 
    FOR ALL USING (public.get_user_role() IN ('admin', 'accountant'));

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices 
    FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'supervisor', 'accountant'));

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices 
    FOR UPDATE USING (
        created_by = auth.uid()
        OR public.is_admin_or_manager()
        OR public.get_user_role() = 'accountant'
    );

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices 
    FOR DELETE USING (public.get_user_role() = 'admin');

-- expenses
DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses 
    FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses 
    FOR UPDATE USING (
        created_by = auth.uid()
        OR public.get_user_role() IN ('admin', 'manager', 'accountant')
    );

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses 
    FOR DELETE USING (public.get_user_role() = 'admin');

-- payments
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments 
    FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'accountant'));

DROP POLICY IF EXISTS "payments_admin" ON payments;
CREATE POLICY "payments_admin" ON payments 
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- treasury_transactions
DROP POLICY IF EXISTS "treasury_tx_select" ON treasury_transactions;
CREATE POLICY "treasury_tx_select" ON treasury_transactions 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "treasury_tx_insert" ON treasury_transactions;
CREATE POLICY "treasury_tx_insert" ON treasury_transactions 
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('admin', 'accountant') 
        OR created_by IS NULL
    );

DROP POLICY IF EXISTS "treasury_tx_admin" ON treasury_transactions;
CREATE POLICY "treasury_tx_admin" ON treasury_transactions 
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- treasury_transfers
DROP POLICY IF EXISTS "treasury_transfers_select" ON treasury_transfers;
CREATE POLICY "treasury_transfers_select" ON treasury_transfers 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "treasury_transfers_insert" ON treasury_transfers;
CREATE POLICY "treasury_transfers_insert" ON treasury_transfers 
    FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'accountant'));

DROP POLICY IF EXISTS "treasury_transfers_update" ON treasury_transfers;
CREATE POLICY "treasury_transfers_update" ON treasury_transfers 
    FOR UPDATE USING (
        (created_by = auth.uid() AND status = 'pending')
        OR public.is_admin_or_manager()
    );

-- credit_debit_notes
DROP POLICY IF EXISTS "credit_debit_notes_select" ON credit_debit_notes;
CREATE POLICY "credit_debit_notes_select" ON credit_debit_notes 
    FOR SELECT USING (
        branch_id = public.get_user_branch_id()
        OR public.get_user_role() = 'admin'
    );

DROP POLICY IF EXISTS "credit_debit_notes_modify" ON credit_debit_notes;
CREATE POLICY "credit_debit_notes_modify" ON credit_debit_notes 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'accountant'));

-- ============================================================
-- 13. سياسات جدول activity_logs
-- ============================================================
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
CREATE POLICY "activity_logs_select" ON activity_logs 
    FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));

-- لا توجد سياسات INSERT/UPDATE/DELETE - فقط النظام يكتب

-- ============================================================
-- تم تطبيق سياسات RLS على 24 جدول
-- جميع الدوال تستخدم public schema بدلاً من auth schema
-- ============================================================
