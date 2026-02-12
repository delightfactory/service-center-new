-- ============================================================
-- نظام النسخ الاحتياطي المتكامل - Backup System
-- الإصدار: 1.0
-- التاريخ: 2026-02-11
-- ============================================================

-- ============================================================
-- 1. جدول سجل النسخ الاحتياطية
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type text NOT NULL DEFAULT 'full',
    operation text NOT NULL,            -- 'export' | 'restore'
    tables_included text[],
    total_records integer DEFAULT 0,
    file_size_bytes bigint DEFAULT 0,
    status text DEFAULT 'in_progress',  -- 'in_progress' | 'completed' | 'failed'
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_by uuid,                    -- nullable, NO FK to profiles (to avoid restore issues)
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- RLS Policies
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view backup logs" ON backup_logs;
CREATE POLICY "Admins can view backup logs" ON backup_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can insert backup logs" ON backup_logs;
CREATE POLICY "Admins can insert backup logs" ON backup_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update backup logs" ON backup_logs;
CREATE POLICY "Admins can update backup logs" ON backup_logs
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- 2. دالة التصدير (Export)
-- ============================================================
CREATE OR REPLACE FUNCTION export_backup_data(p_type text DEFAULT 'full')
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_tables_count integer := 0;
    v_total_records integer := 0;
    v_backup_id uuid;
    v_data jsonb := '{}'::jsonb;
BEGIN
    -- 1. التحقق من الصلاحيات (Admin Only)
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: User is not an admin';
    END IF;

    -- إنشاء سجل العملية
    INSERT INTO backup_logs (operation, backup_type, status, created_by)
    VALUES ('export', p_type, 'in_progress', auth.uid())
    RETURNING id INTO v_backup_id;

    -- 2. تجميع البيانات (26 جدول)
    -- الترتيب هنا للتنظيم فقط، الاعتماديات تهم في الاستعادة
    
    -- Level 0
    v_data := jsonb_set(v_data, '{branches}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM branches) t));
    v_data := jsonb_set(v_data, '{categories}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM categories) t));
    
    -- Level 1
    v_data := jsonb_set(v_data, '{warehouses}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM warehouses) t));
    v_data := jsonb_set(v_data, '{account_categories}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM account_categories) t));
    v_data := jsonb_set(v_data, '{settings}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM settings) t));
    v_data := jsonb_set(v_data, '{customers}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM customers) t));
    v_data := jsonb_set(v_data, '{suppliers}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM suppliers) t));
    v_data := jsonb_set(v_data, '{treasuries}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM treasuries) t));

    -- Level 2
    v_data := jsonb_set(v_data, '{vehicles}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM vehicles) t));
    v_data := jsonb_set(v_data, '{products}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM products) t));

    -- Level 3
    v_data := jsonb_set(v_data, '{assessments}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM assessments) t));
    v_data := jsonb_set(v_data, '{service_components}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM service_components) t));
    v_data := jsonb_set(v_data, '{inventory_items}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM inventory_items) t));

    -- Level 4
    v_data := jsonb_set(v_data, '{job_orders}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM job_orders) t));

    -- Level 5
    v_data := jsonb_set(v_data, '{job_items}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM job_items) t));
    v_data := jsonb_set(v_data, '{job_technicians}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM job_technicians) t));
    v_data := jsonb_set(v_data, '{job_tasks}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM job_tasks) t));
    v_data := jsonb_set(v_data, '{job_time_logs}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM job_time_logs) t));
    v_data := jsonb_set(v_data, '{invoices}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM invoices) t));

    -- Level 6
    v_data := jsonb_set(v_data, '{invoice_items}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM invoice_items) t));
    v_data := jsonb_set(v_data, '{payments}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM payments) t));
    v_data := jsonb_set(v_data, '{expenses}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM expenses) t));
    v_data := jsonb_set(v_data, '{credit_debit_notes}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM credit_debit_notes) t));
    v_data := jsonb_set(v_data, '{inventory_transactions}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM inventory_transactions) t));

    -- Level 7
    v_data := jsonb_set(v_data, '{treasury_transactions}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM treasury_transactions) t));
    v_data := jsonb_set(v_data, '{treasury_transfers}', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT * FROM treasury_transfers) t));

    -- activity_logs: لا يتم تصديرها (حجم كبير + تتولد تلقائياً من triggers)

    -- حساب الإحصائيات
    SELECT count(*) INTO v_tables_count FROM jsonb_object_keys(v_data);
    
    -- حساب إجمالي السجلات (كل الجداول)
    v_total_records := 
        jsonb_array_length(COALESCE(v_data->'branches', '[]')) +
        jsonb_array_length(COALESCE(v_data->'warehouses', '[]')) +
        jsonb_array_length(COALESCE(v_data->'settings', '[]')) +
        jsonb_array_length(COALESCE(v_data->'categories', '[]')) +
        jsonb_array_length(COALESCE(v_data->'account_categories', '[]')) +
        jsonb_array_length(COALESCE(v_data->'customers', '[]')) +
        jsonb_array_length(COALESCE(v_data->'suppliers', '[]')) +
        jsonb_array_length(COALESCE(v_data->'treasuries', '[]')) +
        jsonb_array_length(COALESCE(v_data->'vehicles', '[]')) +
        jsonb_array_length(COALESCE(v_data->'products', '[]')) +
        jsonb_array_length(COALESCE(v_data->'service_components', '[]')) +
        jsonb_array_length(COALESCE(v_data->'inventory_items', '[]')) +
        jsonb_array_length(COALESCE(v_data->'assessments', '[]')) +
        jsonb_array_length(COALESCE(v_data->'job_orders', '[]')) +
        jsonb_array_length(COALESCE(v_data->'job_items', '[]')) +
        jsonb_array_length(COALESCE(v_data->'job_technicians', '[]')) +
        jsonb_array_length(COALESCE(v_data->'job_tasks', '[]')) +
        jsonb_array_length(COALESCE(v_data->'job_time_logs', '[]')) +
        jsonb_array_length(COALESCE(v_data->'invoices', '[]')) +
        jsonb_array_length(COALESCE(v_data->'invoice_items', '[]')) +
        jsonb_array_length(COALESCE(v_data->'payments', '[]')) +
        jsonb_array_length(COALESCE(v_data->'expenses', '[]')) +
        jsonb_array_length(COALESCE(v_data->'credit_debit_notes', '[]')) +
        jsonb_array_length(COALESCE(v_data->'inventory_transactions', '[]')) +
        jsonb_array_length(COALESCE(v_data->'treasury_transactions', '[]')) +
        jsonb_array_length(COALESCE(v_data->'treasury_transfers', '[]'));

    -- بناء النتيجة النهائية
    v_result := jsonb_build_object(
        'version', '1.0',
        'created_at', now(),
        'system', 'service-center',
        'type', p_type,
        'tables_count', v_tables_count,
        'total_records', v_total_records,
        'data', v_data,
        'checksums', jsonb_build_object(
            'branches', jsonb_array_length(COALESCE(v_data->'branches', '[]')),
            'warehouses', jsonb_array_length(COALESCE(v_data->'warehouses', '[]')),
            'settings', jsonb_array_length(COALESCE(v_data->'settings', '[]')),
            'categories', jsonb_array_length(COALESCE(v_data->'categories', '[]')),
            'account_categories', jsonb_array_length(COALESCE(v_data->'account_categories', '[]')),
            'customers', jsonb_array_length(COALESCE(v_data->'customers', '[]')),
            'suppliers', jsonb_array_length(COALESCE(v_data->'suppliers', '[]')),
            'treasuries', jsonb_array_length(COALESCE(v_data->'treasuries', '[]')),
            'vehicles', jsonb_array_length(COALESCE(v_data->'vehicles', '[]')),
            'products', jsonb_array_length(COALESCE(v_data->'products', '[]')),
            'service_components', jsonb_array_length(COALESCE(v_data->'service_components', '[]')),
            'inventory_items', jsonb_array_length(COALESCE(v_data->'inventory_items', '[]')),
            'assessments', jsonb_array_length(COALESCE(v_data->'assessments', '[]')),
            'job_orders', jsonb_array_length(COALESCE(v_data->'job_orders', '[]')),
            'job_items', jsonb_array_length(COALESCE(v_data->'job_items', '[]')),
            'job_technicians', jsonb_array_length(COALESCE(v_data->'job_technicians', '[]')),
            'job_tasks', jsonb_array_length(COALESCE(v_data->'job_tasks', '[]')),
            'job_time_logs', jsonb_array_length(COALESCE(v_data->'job_time_logs', '[]')),
            'invoices', jsonb_array_length(COALESCE(v_data->'invoices', '[]')),
            'invoice_items', jsonb_array_length(COALESCE(v_data->'invoice_items', '[]')),
            'payments', jsonb_array_length(COALESCE(v_data->'payments', '[]')),
            'expenses', jsonb_array_length(COALESCE(v_data->'expenses', '[]')),
            'credit_debit_notes', jsonb_array_length(COALESCE(v_data->'credit_debit_notes', '[]')),
            'inventory_transactions', jsonb_array_length(COALESCE(v_data->'inventory_transactions', '[]')),
            'treasury_transactions', jsonb_array_length(COALESCE(v_data->'treasury_transactions', '[]')),
            'treasury_transfers', jsonb_array_length(COALESCE(v_data->'treasury_transfers', '[]'))
        )
    );

    -- تحديث السجل
    UPDATE backup_logs
    SET status = 'completed',
        completed_at = now(),
        metadata = jsonb_build_object('version', '1.0', 'checksums', v_result->'checksums'),
        total_records = v_total_records,
        -- file_size_bytes سيتم تحديثه تقريبياً أو من الفرونت
        tables_included = ARRAY(SELECT jsonb_object_keys(v_data))
    WHERE id = v_backup_id;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- تسجيل الفشل
    UPDATE backup_logs
    SET status = 'failed',
        error_message = SQLERRM,
        completed_at = now()
    WHERE id = v_backup_id;
    
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. دالة الاستعادة (Restore)
-- ============================================================
CREATE OR REPLACE FUNCTION restore_backup_data(p_backup_json jsonb)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data jsonb;
    v_backup_id uuid;
    v_record record;
    v_profile_exists boolean;
    v_expected_checksums jsonb;
BEGIN
    -- 1. التحقق من الصلاحيات (Admin Only)
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: User is not an admin';
    END IF;

    -- 1.1 التحقق من بنية الملف الأساسية
    IF p_backup_json IS NULL
        OR p_backup_json->>'version' IS NULL
        OR p_backup_json->'data' IS NULL
        OR jsonb_typeof(p_backup_json->'data') <> 'object'
    THEN
        RAISE EXCEPTION 'Invalid backup format: missing version/data';
    END IF;

    IF p_backup_json->>'version' <> '1.0' THEN
        RAISE EXCEPTION 'Unsupported backup version: %', p_backup_json->>'version';
    END IF;

    IF COALESCE(p_backup_json->>'system', '') <> 'service-center' THEN
        RAISE EXCEPTION 'Invalid backup system: %', p_backup_json->>'system';
    END IF;

    v_data := p_backup_json->'data';
    v_expected_checksums := COALESCE(p_backup_json->'checksums', '{}'::jsonb);

    -- إنشاء سجل العملية
    INSERT INTO backup_logs (operation, backup_type, status, created_by)
    VALUES ('restore', p_backup_json->>'type', 'in_progress', auth.uid())
    RETURNING id INTO v_backup_id;

    -- 1.2 التحقق من checksums (Fail-fast قبل الحذف)
    -- ملاحظة: نقارن فقط وجود الجداول الأساسية وعدد عناصرها داخل الملف نفسه
    IF v_expected_checksums ? 'branches' THEN
        IF (v_expected_checksums->>'branches')::int <> jsonb_array_length(COALESCE(v_data->'branches', '[]'::jsonb)) THEN
            RAISE EXCEPTION 'Checksum mismatch: branches';
        END IF;
    END IF;
    IF v_expected_checksums ? 'invoices' THEN
        IF (v_expected_checksums->>'invoices')::int <> jsonb_array_length(COALESCE(v_data->'invoices', '[]'::jsonb)) THEN
            RAISE EXCEPTION 'Checksum mismatch: invoices';
        END IF;
    END IF;
    IF v_expected_checksums ? 'payments' THEN
        IF (v_expected_checksums->>'payments')::int <> jsonb_array_length(COALESCE(v_data->'payments', '[]'::jsonb)) THEN
            RAISE EXCEPTION 'Checksum mismatch: payments';
        END IF;
    END IF;

    -- 2. التحقق من profiles (Fail-Fast) للأعمدة NOT NULL
    -- technician_id في job_technicians
    FOR v_record IN SELECT * FROM jsonb_to_recordset(COALESCE(v_data->'job_technicians', '[]'::jsonb)) AS x(technician_id uuid)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_record.technician_id) THEN
            RAISE EXCEPTION 'Missing profile for technician_id: %', v_record.technician_id;
        END IF;
    END LOOP;

    -- technician_id في job_time_logs
    FOR v_record IN SELECT * FROM jsonb_to_recordset(COALESCE(v_data->'job_time_logs', '[]'::jsonb)) AS x(technician_id uuid)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_record.technician_id) THEN
            RAISE EXCEPTION 'Missing profile for job_time_logs: %', v_record.technician_id;
        END IF;
    END LOOP;

    -- 3. بدء عملية الاستعادة (Transaction Implicit)
    BEGIN
        -- تعطيل triggers (متوافق مع Supabase — لا يحتاج صلاحية superuser)
        ALTER TABLE treasury_transfers DISABLE TRIGGER USER;
        ALTER TABLE activity_logs DISABLE TRIGGER USER;
        ALTER TABLE treasury_transactions DISABLE TRIGGER USER;
        ALTER TABLE inventory_transactions DISABLE TRIGGER USER;
        ALTER TABLE credit_debit_notes DISABLE TRIGGER USER;
        ALTER TABLE expenses DISABLE TRIGGER USER;
        ALTER TABLE payments DISABLE TRIGGER USER;
        ALTER TABLE invoice_items DISABLE TRIGGER USER;
        ALTER TABLE invoices DISABLE TRIGGER USER;
        ALTER TABLE job_time_logs DISABLE TRIGGER USER;
        ALTER TABLE job_tasks DISABLE TRIGGER USER;
        ALTER TABLE job_technicians DISABLE TRIGGER USER;
        ALTER TABLE job_items DISABLE TRIGGER USER;
        ALTER TABLE job_orders DISABLE TRIGGER USER;
        ALTER TABLE assessments DISABLE TRIGGER USER;
        ALTER TABLE inventory_items DISABLE TRIGGER USER;
        ALTER TABLE service_components DISABLE TRIGGER USER;
        ALTER TABLE products DISABLE TRIGGER USER;
        ALTER TABLE vehicles DISABLE TRIGGER USER;
        ALTER TABLE treasuries DISABLE TRIGGER USER;
        ALTER TABLE suppliers DISABLE TRIGGER USER;
        ALTER TABLE customers DISABLE TRIGGER USER;
        ALTER TABLE account_categories DISABLE TRIGGER USER;
        ALTER TABLE categories DISABLE TRIGGER USER;
        ALTER TABLE warehouses DISABLE TRIGGER USER;
        ALTER TABLE branches DISABLE TRIGGER USER;

        -- حفظ ارتباط المستخدمين بالفروع مؤقتاً (profiles.branch_id → branches FK)
        CREATE TEMP TABLE _profile_branches ON COMMIT DROP AS
            SELECT id, branch_id FROM profiles WHERE branch_id IS NOT NULL;
        UPDATE profiles SET branch_id = NULL WHERE branch_id IS NOT NULL;

        -- أ) حذف البيانات (ترتيب عكسي - من الفروع للجذور)
        DELETE FROM activity_logs WHERE true;
        DELETE FROM treasury_transfers WHERE true;
        DELETE FROM treasury_transactions WHERE true;
        DELETE FROM inventory_transactions WHERE true;
        DELETE FROM credit_debit_notes WHERE true;
        DELETE FROM expenses WHERE true;
        DELETE FROM payments WHERE true;
        DELETE FROM invoice_items WHERE true;
        DELETE FROM invoices WHERE true;
        DELETE FROM job_time_logs WHERE true;
        DELETE FROM job_tasks WHERE true;
        DELETE FROM job_technicians WHERE true;
        DELETE FROM job_items WHERE true;
        DELETE FROM job_orders WHERE true;
        DELETE FROM assessments WHERE true;
        DELETE FROM inventory_items WHERE true;
        DELETE FROM service_components WHERE true;
        DELETE FROM products WHERE true;
        DELETE FROM vehicles WHERE true;
        DELETE FROM treasuries WHERE true;
        DELETE FROM suppliers WHERE true;
        DELETE FROM customers WHERE true;
        DELETE FROM account_categories WHERE true;
        DELETE FROM categories WHERE true;
        DELETE FROM warehouses WHERE true;
        DELETE FROM branches WHERE true;
        -- settings لا تُحذف

        -- ب) إدراج البيانات (ترتيب طبيعي - من الجذور للفروع)
        
        -- Level 0
        IF v_data ? 'branches' THEN
            INSERT INTO branches SELECT * FROM jsonb_populate_recordset(NULL::branches, v_data->'branches');
        END IF;

        -- استعادة ارتباط المستخدمين بالفروع
        UPDATE profiles p SET branch_id = pb.branch_id
        FROM _profile_branches pb WHERE p.id = pb.id;

        IF v_data ? 'warehouses' THEN
            INSERT INTO warehouses SELECT * FROM jsonb_populate_recordset(NULL::warehouses, v_data->'warehouses');
        END IF;

        -- Categories (Self-referencing): Insert with parent_id NULL then UPDATE parent_id
        IF v_data ? 'categories' THEN
            -- Phase 1: Insert all with parent_id = NULL
            -- Note: jsonb_populate_recordset might not be flexible enough for complex topological sort in one go easily without CTEs/Loops.
            -- Simpler approach for restore: Insert all but set parent_id to NULL initially, then update.
            -- OR since we disable triggers (FK checks might normally be deferred but here triggers are off, FKs still apply!).
            -- session_replication_role = 'replica' disables FK checks too? NO, usually triggers. FKs are constraints.
            -- Actually, 'replica' disables triggers defined by user, NOT constraints (unless deferrable).
            -- BUT: "SET session_replication_role = 'replica';" DOES disable FK checks IF valid triggers are used? 
            -- Correction: It does NOT disable FK constraints automatically unless they are implemented as triggers (which is rare in standard PG).
            -- Standard FKs are checked. So we MUST handle order.
            
            -- Strategy: Insert with parent_id NULL, then update.
            INSERT INTO categories (id, name, parent_id, description, sort_order, is_active, created_at)
            SELECT id, name, NULL, description, sort_order, is_active, created_at
            FROM jsonb_populate_recordset(NULL::categories, v_data->'categories');
            
            -- Update parents
            UPDATE categories c
            SET parent_id = s.parent_id
            FROM (SELECT id, parent_id FROM jsonb_populate_recordset(NULL::categories, v_data->'categories')) s
            WHERE c.id = s.id AND s.parent_id IS NOT NULL;
        END IF;

        IF v_data ? 'account_categories' THEN
            INSERT INTO account_categories (id, code, name, category_type, parent_id, description, is_system, is_active, created_at)
            SELECT id, code, name, category_type, NULL, description, is_system, is_active, created_at
            FROM jsonb_populate_recordset(NULL::account_categories, v_data->'account_categories');
            
            UPDATE account_categories c
            SET parent_id = s.parent_id
            FROM (SELECT id, parent_id FROM jsonb_populate_recordset(NULL::account_categories, v_data->'account_categories')) s
            WHERE c.id = s.id AND s.parent_id IS NOT NULL;
        END IF;

        -- Level 1
        IF v_data ? 'customers' THEN
            INSERT INTO customers SELECT * FROM jsonb_populate_recordset(NULL::customers, v_data->'customers');
        END IF;
        IF v_data ? 'suppliers' THEN
            INSERT INTO suppliers SELECT * FROM jsonb_populate_recordset(NULL::suppliers, v_data->'suppliers');
        END IF;
        IF v_data ? 'treasuries' THEN
            INSERT INTO treasuries SELECT * FROM jsonb_populate_recordset(NULL::treasuries, v_data->'treasuries');
        END IF;

        -- Level 2
        IF v_data ? 'vehicles' THEN
            INSERT INTO vehicles SELECT * FROM jsonb_populate_recordset(NULL::vehicles, v_data->'vehicles');
        END IF;
        IF v_data ? 'products' THEN
            INSERT INTO products SELECT * FROM jsonb_populate_recordset(NULL::products, v_data->'products');
        END IF;

        -- Level 3
        IF v_data ? 'assessments' THEN
            INSERT INTO assessments SELECT * FROM jsonb_populate_recordset(NULL::assessments, v_data->'assessments');
        END IF;
        IF v_data ? 'service_components' THEN
            INSERT INTO service_components SELECT * FROM jsonb_populate_recordset(NULL::service_components, v_data->'service_components');
        END IF;
        IF v_data ? 'inventory_items' THEN
             -- Exclude GENERATED 'available_quantity'
            INSERT INTO inventory_items (
                id, product_id, warehouse_id, quantity, reserved_quantity,
                last_purchase_price, avg_cost, last_updated
            )
            SELECT 
                id, product_id, warehouse_id, quantity, reserved_quantity,
                last_purchase_price, avg_cost, last_updated
            FROM jsonb_populate_recordset(NULL::inventory_items, v_data->'inventory_items');
        END IF;

        -- Level 4
        IF v_data ? 'job_orders' THEN
            INSERT INTO job_orders SELECT * FROM jsonb_populate_recordset(NULL::job_orders, v_data->'job_orders');
        END IF;

        -- Level 5
        IF v_data ? 'job_items' THEN
            -- Exclude GENERATED 'total_price'
            INSERT INTO job_items (
                id, job_order_id, product_id, item_type, description, quantity, unit_price, 
                discount_percent, external_cost, is_completed, completed_at, completed_by, 
                is_blocked, blocked_reason, returned_quantity, return_reason, warehouse_id, 
                sort_order, notes, created_at, is_cancelled, is_dispensed
            )
            SELECT 
                id, job_order_id, product_id, item_type, description, quantity, unit_price, 
                discount_percent, external_cost, is_completed, completed_at, completed_by, 
                is_blocked, blocked_reason, returned_quantity, return_reason, warehouse_id, 
                sort_order, notes, created_at, is_cancelled, is_dispensed
            FROM jsonb_populate_recordset(NULL::job_items, v_data->'job_items');
        END IF;

        IF v_data ? 'job_technicians' THEN
            INSERT INTO job_technicians SELECT * FROM jsonb_populate_recordset(NULL::job_technicians, v_data->'job_technicians');
        END IF;
        IF v_data ? 'job_tasks' THEN
            INSERT INTO job_tasks SELECT * FROM jsonb_populate_recordset(NULL::job_tasks, v_data->'job_tasks');
        END IF;
        IF v_data ? 'job_time_logs' THEN
            -- Exclude GENERATED 'duration_minutes'
            INSERT INTO job_time_logs (
                id, job_order_id, technician_id, clock_in, clock_out, notes, created_at, activity_type, updated_at
            )
            SELECT 
                id, job_order_id, technician_id, clock_in, clock_out, notes, created_at, activity_type, updated_at
            FROM jsonb_populate_recordset(NULL::job_time_logs, v_data->'job_time_logs');
        END IF;

        IF v_data ? 'invoices' THEN
            -- Exclude GENERATED 'remaining_amount'
            INSERT INTO invoices (
                id, code, invoice_type, status,
                subtotal, discount_amount, tax_percent, tax_amount,
                total_amount, paid_amount,
                due_date, cancelled_by, cancelled_at, cancellation_reason,
                has_credit_notes, has_debit_notes,
                notes, created_by, approved_by,
                job_order_id, customer_id, supplier_id, branch_id,
                created_at, updated_at
                -- remaining_amount IS GENERATED
            )
            SELECT 
                id, code, invoice_type, status,
                subtotal, discount_amount, tax_percent, tax_amount,
                total_amount, paid_amount,
                due_date, cancelled_by, cancelled_at, cancellation_reason,
                has_credit_notes, has_debit_notes,
                notes, created_by, approved_by,
                job_order_id, customer_id, supplier_id, branch_id,
                created_at, updated_at
            FROM jsonb_populate_recordset(NULL::invoices, v_data->'invoices');
        END IF;

        -- Level 6
        IF v_data ? 'invoice_items' THEN
            -- Exclude GENERATED 'total_price'
            INSERT INTO invoice_items (
                id, invoice_id, description, quantity, unit_price, discount_amount, 
                job_item_id, product_id, sort_order, created_at
            )
            SELECT 
                id, invoice_id, description, quantity, unit_price, discount_amount, 
                job_item_id, product_id, sort_order, created_at
            FROM jsonb_populate_recordset(NULL::invoice_items, v_data->'invoice_items');
        END IF;

        IF v_data ? 'payments' THEN
            INSERT INTO payments SELECT * FROM jsonb_populate_recordset(NULL::payments, v_data->'payments');
        END IF;
        IF v_data ? 'expenses' THEN
            INSERT INTO expenses SELECT * FROM jsonb_populate_recordset(NULL::expenses, v_data->'expenses');
        END IF;
        IF v_data ? 'credit_debit_notes' THEN
            INSERT INTO credit_debit_notes SELECT * FROM jsonb_populate_recordset(NULL::credit_debit_notes, v_data->'credit_debit_notes');
        END IF;
        IF v_data ? 'inventory_transactions' THEN
            INSERT INTO inventory_transactions SELECT * FROM jsonb_populate_recordset(NULL::inventory_transactions, v_data->'inventory_transactions');
        END IF;

        -- Level 7
        IF v_data ? 'treasury_transactions' THEN
            INSERT INTO treasury_transactions SELECT * FROM jsonb_populate_recordset(NULL::treasury_transactions, v_data->'treasury_transactions');
        END IF;
        IF v_data ? 'treasury_transfers' THEN
            INSERT INTO treasury_transfers SELECT * FROM jsonb_populate_recordset(NULL::treasury_transfers, v_data->'treasury_transfers');
        END IF;

        -- activity_logs: لا تُستعاد (تتولد تلقائياً من triggers)

        -- إعادة تفعيل triggers
        ALTER TABLE branches ENABLE TRIGGER USER;
        ALTER TABLE warehouses ENABLE TRIGGER USER;
        ALTER TABLE categories ENABLE TRIGGER USER;
        ALTER TABLE account_categories ENABLE TRIGGER USER;
        ALTER TABLE customers ENABLE TRIGGER USER;
        ALTER TABLE suppliers ENABLE TRIGGER USER;
        ALTER TABLE treasuries ENABLE TRIGGER USER;
        ALTER TABLE vehicles ENABLE TRIGGER USER;
        ALTER TABLE products ENABLE TRIGGER USER;
        ALTER TABLE assessments ENABLE TRIGGER USER;
        ALTER TABLE service_components ENABLE TRIGGER USER;
        ALTER TABLE inventory_items ENABLE TRIGGER USER;
        ALTER TABLE job_orders ENABLE TRIGGER USER;
        ALTER TABLE job_items ENABLE TRIGGER USER;
        ALTER TABLE job_technicians ENABLE TRIGGER USER;
        ALTER TABLE job_tasks ENABLE TRIGGER USER;
        ALTER TABLE job_time_logs ENABLE TRIGGER USER;
        ALTER TABLE invoices ENABLE TRIGGER USER;
        ALTER TABLE invoice_items ENABLE TRIGGER USER;
        ALTER TABLE payments ENABLE TRIGGER USER;
        ALTER TABLE expenses ENABLE TRIGGER USER;
        ALTER TABLE credit_debit_notes ENABLE TRIGGER USER;
        ALTER TABLE inventory_transactions ENABLE TRIGGER USER;
        ALTER TABLE treasury_transactions ENABLE TRIGGER USER;
        ALTER TABLE treasury_transfers ENABLE TRIGGER USER;
        ALTER TABLE activity_logs ENABLE TRIGGER USER;

        -- 4. إعادة حساب الحقول المشتقة (Recalculation)
        
        -- أ) Treasuries Balance
        -- ENUM: deposit, transfer_in, customer_receipt, income, opening_balance = +
        -- Else (withdrawal, transfer_out, supplier_payment, expense, adjustment) = -
        UPDATE treasuries t SET balance = COALESCE(opening_balance, 0) + COALESCE(
            (SELECT SUM(CASE 
                WHEN tt.transaction_type IN ('deposit','transfer_in','customer_receipt','income','opening_balance') THEN tt.amount 
                ELSE -tt.amount 
             END)
             FROM treasury_transactions tt WHERE tt.treasury_id = t.id), 0)
        WHERE true;

        -- ب) Customers Balance (Invoices + Payments)
        -- Invoices: sales (approved/paid/partial) = +, sales_return = -
        -- Payments: customer_receipt/advance_payment = -, refund_to_customer = +
        WITH inv_calc AS (
            SELECT customer_id, 
                   SUM(CASE WHEN invoice_type = 'sales' THEN total_amount ELSE -total_amount END) as inv_total
            FROM invoices 
            WHERE status IN ('approved', 'partial', 'paid') AND customer_id IS NOT NULL
            GROUP BY customer_id
        ), pay_calc AS (
            SELECT customer_id,
                   SUM(CASE WHEN payment_type IN ('customer_receipt', 'advance_payment') THEN -amount ELSE amount END) as pay_total
            FROM payments
            WHERE customer_id IS NOT NULL
            GROUP BY customer_id
        )
        UPDATE customers c
        SET balance = COALESCE(i.inv_total, 0) + COALESCE(p.pay_total, 0)
        FROM inv_calc i FULL OUTER JOIN pay_calc p ON i.customer_id = p.customer_id
        WHERE c.id = COALESCE(i.customer_id, p.customer_id);

        -- ج) Suppliers Balance (Invoices + Payments)
        -- Invoices: purchase = +, purchase_return = -
        -- Payments: supplier_payment = -, refund_from_supplier = +
        WITH inv_calc_sup AS (
            SELECT supplier_id, 
                   SUM(CASE WHEN invoice_type = 'purchase' THEN total_amount ELSE -total_amount END) as inv_total
            FROM invoices 
            WHERE status IN ('approved', 'partial', 'paid') AND supplier_id IS NOT NULL
            GROUP BY supplier_id
        ), pay_calc_sup AS (
            SELECT supplier_id,
                   SUM(CASE WHEN payment_type = 'supplier_payment' THEN -amount ELSE amount END) as pay_total
            FROM payments
            WHERE supplier_id IS NOT NULL
            GROUP BY supplier_id
        )
        UPDATE suppliers s
        SET balance = COALESCE(i.inv_total, 0) + COALESCE(p.pay_total, 0)
        FROM inv_calc_sup i FULL OUTER JOIN pay_calc_sup p ON i.supplier_id = p.supplier_id
        WHERE s.id = COALESCE(i.supplier_id, p.supplier_id);

        -- د) Invoices Paid Amount
        UPDATE invoices i SET paid_amount = COALESCE(
            (SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0)
        WHERE true;

        -- هـ) Job Orders Actual Hours
        UPDATE job_orders jo SET actual_hours = COALESCE(
            (SELECT SUM(duration_minutes) / 60.0 
             FROM job_time_logs jtl WHERE jtl.job_order_id = jo.id AND jtl.clock_out IS NOT NULL), 0)
        WHERE true;

        -- 5. تحديث حالة النسخة
        UPDATE backup_logs
        SET status = 'completed',
            completed_at = now()
        WHERE id = v_backup_id;

    EXCEPTION WHEN OTHERS THEN
        -- ضمان إعادة تفعيل triggers حتى عند الفشل
        ALTER TABLE branches ENABLE TRIGGER USER;
        ALTER TABLE warehouses ENABLE TRIGGER USER;
        ALTER TABLE categories ENABLE TRIGGER USER;
        ALTER TABLE account_categories ENABLE TRIGGER USER;
        ALTER TABLE customers ENABLE TRIGGER USER;
        ALTER TABLE suppliers ENABLE TRIGGER USER;
        ALTER TABLE treasuries ENABLE TRIGGER USER;
        ALTER TABLE vehicles ENABLE TRIGGER USER;
        ALTER TABLE products ENABLE TRIGGER USER;
        ALTER TABLE assessments ENABLE TRIGGER USER;
        ALTER TABLE service_components ENABLE TRIGGER USER;
        ALTER TABLE inventory_items ENABLE TRIGGER USER;
        ALTER TABLE job_orders ENABLE TRIGGER USER;
        ALTER TABLE job_items ENABLE TRIGGER USER;
        ALTER TABLE job_technicians ENABLE TRIGGER USER;
        ALTER TABLE job_tasks ENABLE TRIGGER USER;
        ALTER TABLE job_time_logs ENABLE TRIGGER USER;
        ALTER TABLE invoices ENABLE TRIGGER USER;
        ALTER TABLE invoice_items ENABLE TRIGGER USER;
        ALTER TABLE payments ENABLE TRIGGER USER;
        ALTER TABLE expenses ENABLE TRIGGER USER;
        ALTER TABLE credit_debit_notes ENABLE TRIGGER USER;
        ALTER TABLE inventory_transactions ENABLE TRIGGER USER;
        ALTER TABLE treasury_transactions ENABLE TRIGGER USER;
        ALTER TABLE treasury_transfers ENABLE TRIGGER USER;
        ALTER TABLE activity_logs ENABLE TRIGGER USER;
        
        UPDATE backup_logs
        SET status = 'failed',
            error_message = SQLERRM,
            completed_at = now()
        WHERE id = v_backup_id;
        
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. دالة عرض إحصائيات آخر نسخة
-- ============================================================
CREATE OR REPLACE FUNCTION get_backup_info()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_backup record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: User is not an admin';
    END IF;

    SELECT * INTO v_last_backup 
    FROM backup_logs 
    WHERE status = 'completed' AND operation = 'export'
    ORDER BY completed_at DESC 
    LIMIT 1;

    RETURN jsonb_build_object(
        'last_backup_date', v_last_backup.completed_at,
        'total_records', v_last_backup.total_records,
        'size_bytes', v_last_backup.file_size_bytes,
        'metadata', v_last_backup.metadata
    );
END;
$$ LANGUAGE plpgsql;
