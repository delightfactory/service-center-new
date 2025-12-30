-- ============================================================
-- نظام إدارة مركز صيانة السيارات
-- ملف إصلاح RLS الشامل والنهائي (الإصدار المُصحح)
-- ============================================================
-- 
-- التاريخ: 2024-12-26
-- 
-- الترتيب الصحيح للتنفيذ:
-- 1. حذف جميع السياسات أولاً
-- 2. حذف الدوال القديمة
-- 3. إنشاء الدوال الجديدة
-- 4. إنشاء السياسات الجديدة
-- 
-- ============================================================

-- ============================================================
-- القسم 1: حذف جميع السياسات الموجودة
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;

-- branches
DROP POLICY IF EXISTS "branches_select_all" ON branches;
DROP POLICY IF EXISTS "branches_admin_modify" ON branches;

-- warehouses
DROP POLICY IF EXISTS "warehouses_select" ON warehouses;
DROP POLICY IF EXISTS "warehouses_modify" ON warehouses;

-- customers
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;

-- vehicles
DROP POLICY IF EXISTS "vehicles_select" ON vehicles;
DROP POLICY IF EXISTS "vehicles_modify" ON vehicles;

-- suppliers
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_modify" ON suppliers;

-- assessments
DROP POLICY IF EXISTS "assessments_select" ON assessments;
DROP POLICY IF EXISTS "assessments_insert" ON assessments;
DROP POLICY IF EXISTS "assessments_update" ON assessments;

-- job_orders
DROP POLICY IF EXISTS "job_orders_select" ON job_orders;
DROP POLICY IF EXISTS "job_orders_insert" ON job_orders;
DROP POLICY IF EXISTS "job_orders_update" ON job_orders;
DROP POLICY IF EXISTS "job_orders_delete" ON job_orders;

-- job_items
DROP POLICY IF EXISTS "job_items_select" ON job_items;
DROP POLICY IF EXISTS "job_items_modify" ON job_items;
DROP POLICY IF EXISTS "job_items_tech_complete" ON job_items;

-- job_technicians
DROP POLICY IF EXISTS "job_technicians_select" ON job_technicians;
DROP POLICY IF EXISTS "job_technicians_modify" ON job_technicians;

-- categories
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_modify" ON categories;

-- products
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_modify" ON products;

-- service_components
DROP POLICY IF EXISTS "service_components_select" ON service_components;
DROP POLICY IF EXISTS "service_components_modify" ON service_components;

-- inventory_items
DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_modify" ON inventory_items;

-- inventory_transactions
DROP POLICY IF EXISTS "inventory_tx_select" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_tx_insert" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_tx_admin" ON inventory_transactions;

-- treasuries
DROP POLICY IF EXISTS "treasuries_select" ON treasuries;
DROP POLICY IF EXISTS "treasuries_modify" ON treasuries;

-- account_categories
DROP POLICY IF EXISTS "account_categories_select" ON account_categories;
DROP POLICY IF EXISTS "account_categories_modify" ON account_categories;

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

-- expenses
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

-- payments
DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "payments_admin" ON payments;

-- treasury_transactions
DROP POLICY IF EXISTS "treasury_tx_select" ON treasury_transactions;
DROP POLICY IF EXISTS "treasury_tx_insert" ON treasury_transactions;
DROP POLICY IF EXISTS "treasury_tx_admin" ON treasury_transactions;

-- treasury_transfers
DROP POLICY IF EXISTS "treasury_transfers_select" ON treasury_transfers;
DROP POLICY IF EXISTS "treasury_transfers_insert" ON treasury_transfers;
DROP POLICY IF EXISTS "treasury_transfers_update" ON treasury_transfers;

-- credit_debit_notes
DROP POLICY IF EXISTS "credit_debit_notes_select" ON credit_debit_notes;
DROP POLICY IF EXISTS "credit_debit_notes_modify" ON credit_debit_notes;

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;

-- Storage policies
DROP POLICY IF EXISTS "assessment_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "assessment_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "assessment_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "expense_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "expense_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "expense_attachments_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;

-- ============================================================
-- القسم 2: حذف الدوال القديمة
-- ============================================================
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.get_user_branch_id();
DROP FUNCTION IF EXISTS public.is_admin_or_manager();
DROP FUNCTION IF EXISTS public.can_modify();

-- ============================================================
-- القسم 3: إنشاء الدوال الجديدة
-- ============================================================

-- دالة للحصول على دور المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role::text INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN COALESCE(user_role, 'guest');
EXCEPTION WHEN OTHERS THEN
    RETURN 'guest';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- دالة للحصول على فرع المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid AS $$
DECLARE
    user_branch uuid;
BEGIN
    SELECT branch_id INTO user_branch 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN user_branch;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- دالة للتحقق إذا كان المستخدم أدمن أو مدير
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role::text INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN user_role IN ('admin', 'manager');
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- دالة للتحقق إذا كان المستخدم يمكنه التعديل
CREATE OR REPLACE FUNCTION public.can_modify()
RETURNS boolean AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role::text INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN user_role IN ('admin', 'manager', 'supervisor', 'engineer');
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- القسم 4: إنشاء السياسات الجديدة
-- ============================================================

-- profiles
CREATE POLICY "profiles_select" ON profiles 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_self" ON profiles 
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_trigger" ON profiles 
    FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- branches
CREATE POLICY "branches_select_all" ON branches 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "branches_admin_modify" ON branches 
    FOR ALL USING (public.get_user_role() = 'admin');

-- warehouses
CREATE POLICY "warehouses_select" ON warehouses 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "warehouses_modify" ON warehouses 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'warehouse'));

-- customers
CREATE POLICY "customers_select" ON customers 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "customers_insert" ON customers 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "customers_update" ON customers 
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "customers_delete" ON customers 
    FOR DELETE USING (public.is_admin_or_manager());

-- vehicles
CREATE POLICY "vehicles_select" ON vehicles 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vehicles_modify" ON vehicles 
    FOR ALL USING (auth.uid() IS NOT NULL);

-- suppliers
CREATE POLICY "suppliers_select" ON suppliers 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_modify" ON suppliers 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'accountant', 'warehouse'));

-- assessments
CREATE POLICY "assessments_select" ON assessments 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assessments_insert" ON assessments 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "assessments_update" ON assessments 
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- job_orders
CREATE POLICY "job_orders_select" ON job_orders 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "job_orders_insert" ON job_orders 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "job_orders_update" ON job_orders 
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "job_orders_delete" ON job_orders 
    FOR DELETE USING (public.get_user_role() = 'admin');

-- job_items
CREATE POLICY "job_items_select" ON job_items 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "job_items_modify" ON job_items 
    FOR ALL USING (auth.uid() IS NOT NULL);

-- job_technicians
CREATE POLICY "job_technicians_select" ON job_technicians 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "job_technicians_modify" ON job_technicians 
    FOR ALL USING (auth.uid() IS NOT NULL);

-- categories
CREATE POLICY "categories_select" ON categories 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "categories_modify" ON categories 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- products
CREATE POLICY "products_select" ON products 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_modify" ON products 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- service_components
CREATE POLICY "service_components_select" ON service_components 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "service_components_modify" ON service_components 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- inventory_items
CREATE POLICY "inventory_items_select" ON inventory_items 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inventory_items_modify" ON inventory_items 
    FOR ALL USING (public.get_user_role() IN ('admin', 'warehouse'));

-- inventory_transactions
CREATE POLICY "inventory_tx_select" ON inventory_transactions 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inventory_tx_insert" ON inventory_transactions 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "inventory_tx_admin" ON inventory_transactions 
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- treasuries
CREATE POLICY "treasuries_select" ON treasuries 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "treasuries_modify" ON treasuries 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'accountant'));

-- account_categories
CREATE POLICY "account_categories_select" ON account_categories 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "account_categories_modify" ON account_categories 
    FOR ALL USING (public.get_user_role() IN ('admin', 'accountant'));

-- invoices
CREATE POLICY "invoices_select" ON invoices 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoices_insert" ON invoices 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "invoices_update" ON invoices 
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoices_delete" ON invoices 
    FOR DELETE USING (public.get_user_role() = 'admin');

-- expenses
CREATE POLICY "expenses_select" ON expenses 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_insert" ON expenses 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_update" ON expenses 
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_delete" ON expenses 
    FOR DELETE USING (public.get_user_role() = 'admin');

-- payments
CREATE POLICY "payments_select" ON payments 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments_insert" ON payments 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "payments_admin" ON payments 
    FOR UPDATE USING (public.get_user_role() IN ('admin', 'accountant'));

-- treasury_transactions
CREATE POLICY "treasury_tx_select" ON treasury_transactions 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "treasury_tx_insert" ON treasury_transactions 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "treasury_tx_admin" ON treasury_transactions 
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- treasury_transfers
CREATE POLICY "treasury_transfers_select" ON treasury_transfers 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "treasury_transfers_insert" ON treasury_transfers 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "treasury_transfers_update" ON treasury_transfers 
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- credit_debit_notes
CREATE POLICY "credit_debit_notes_select" ON credit_debit_notes 
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "credit_debit_notes_modify" ON credit_debit_notes 
    FOR ALL USING (public.get_user_role() IN ('admin', 'manager', 'accountant'));

-- activity_logs
CREATE POLICY "activity_logs_select" ON activity_logs 
    FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));

-- ============================================================
-- القسم 5: سياسات Storage
-- ============================================================

-- assessment-photos
CREATE POLICY "assessment_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'assessment-photos'
        AND public.get_user_role() IN ('admin', 'manager', 'supervisor', 'engineer')
    );
CREATE POLICY "assessment_photos_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'assessment-photos');
CREATE POLICY "assessment_photos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'assessment-photos'
        AND public.get_user_role() IN ('admin', 'manager')
    );

-- expense-attachments
CREATE POLICY "expense_attachments_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'expense-attachments'
        AND public.get_user_role() IN ('admin', 'manager', 'accountant')
    );
CREATE POLICY "expense_attachments_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'expense-attachments'
        AND public.get_user_role() IN ('admin', 'manager', 'accountant')
    );
CREATE POLICY "expense_attachments_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'expense-attachments'
        AND public.get_user_role() = 'admin'
    );

-- documents
CREATE POLICY "documents_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND public.get_user_role() IN ('admin', 'manager', 'accountant', 'engineer')
    );
CREATE POLICY "documents_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents'
        AND public.get_user_role() IN ('admin', 'manager', 'accountant', 'engineer', 'supervisor')
    );
CREATE POLICY "documents_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents'
        AND public.get_user_role() IN ('admin', 'manager')
    );

-- ============================================================
-- تم الانتهاء من إصلاح جميع سياسات RLS
-- ============================================================
