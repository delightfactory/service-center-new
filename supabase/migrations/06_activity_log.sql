-- ============================================================
-- نظام إدارة مركز صيانة السيارات - سجل النشاط
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- ============================================================

-- ============================================================
-- جدول سجل النشاط (activity_logs)
-- يتتبع جميع العمليات على النظام
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- العملية
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    entity_code text,
    
    -- التغييرات
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    
    -- الوصف
    description text,
    
    -- المستخدم
    user_id uuid REFERENCES profiles(id),
    user_name text,
    user_role text,
    
    -- السياق
    branch_id uuid REFERENCES branches(id),
    ip_address text,
    user_agent text,
    
    -- الوقت
    created_at timestamptz DEFAULT now()
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_branch ON activity_logs(branch_id);

COMMENT ON TABLE activity_logs IS 'سجل النشاط - تتبع جميع العمليات على النظام';

-- ============================================================
-- دالة التسجيل التلقائي للنشاط
-- ============================================================
CREATE OR REPLACE FUNCTION log_activity()
RETURNS trigger AS $$
DECLARE
    v_action text;
    v_old_values jsonb;
    v_new_values jsonb;
    v_changed text[];
    v_description text;
    v_entity_code text;
    v_branch_id uuid;
BEGIN
    -- تحديد نوع العملية
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_new_values := to_jsonb(NEW);
        v_description := 'إنشاء ' || TG_TABLE_NAME;
        v_entity_code := CASE 
            WHEN NEW.code IS NOT NULL THEN NEW.code
            ELSE NULL
        END;
        v_branch_id := CASE 
            WHEN NEW.branch_id IS NOT NULL THEN NEW.branch_id
            ELSE NULL
        END;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
        -- حساب الحقول المتغيرة
        SELECT array_agg(key) INTO v_changed
        FROM jsonb_each_text(v_old_values) AS old_kv(key, value)
        WHERE v_new_values ->> key IS DISTINCT FROM old_kv.value
          AND key NOT IN ('updated_at', 'created_at');
        
        v_description := 'تعديل ' || TG_TABLE_NAME;
        v_entity_code := COALESCE(NEW.code, OLD.code);
        v_branch_id := COALESCE(NEW.branch_id, OLD.branch_id);
        
        -- تحديد نوع التعديل الخاص
        IF TG_TABLE_NAME = 'job_orders' AND OLD.status IS DISTINCT FROM NEW.status THEN
            v_action := 'status_change';
            v_description := 'تغيير حالة أمر الشغل من ' || OLD.status || ' إلى ' || NEW.status;
        END IF;
        
        IF TG_TABLE_NAME = 'invoices' AND OLD.status IS DISTINCT FROM NEW.status THEN
            v_action := 'status_change';
            v_description := 'تغيير حالة الفاتورة من ' || OLD.status || ' إلى ' || NEW.status;
        END IF;
        
        IF TG_TABLE_NAME = 'invoices' AND NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN
            v_action := 'cancel';
            v_description := 'إلغاء الفاتورة: ' || COALESCE(NEW.cancellation_reason, 'بدون سبب');
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_old_values := to_jsonb(OLD);
        v_description := 'حذف ' || TG_TABLE_NAME;
        v_entity_code := OLD.code;
        v_branch_id := OLD.branch_id;
    END IF;

    -- إدراج السجل
    INSERT INTO activity_logs (
        action,
        entity_type,
        entity_id,
        entity_code,
        old_values,
        new_values,
        changed_fields,
        description,
        user_id,
        user_name,
        user_role,
        branch_id,
        created_at
    ) VALUES (
        v_action,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_entity_code,
        v_old_values,
        v_new_values,
        v_changed,
        v_description,
        auth.uid(),
        (SELECT full_name FROM profiles WHERE id = auth.uid()),
        (SELECT role::text FROM profiles WHERE id = auth.uid()),
        v_branch_id,
        now()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- تطبيق التريجر على الجداول الحرجة
-- ============================================================

-- أوامر الشغل
DROP TRIGGER IF EXISTS log_job_orders_activity ON job_orders;
CREATE TRIGGER log_job_orders_activity
    AFTER INSERT OR UPDATE OR DELETE ON job_orders
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- بنود أمر الشغل
DROP TRIGGER IF EXISTS log_job_items_activity ON job_items;
CREATE TRIGGER log_job_items_activity
    AFTER INSERT OR UPDATE OR DELETE ON job_items
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- الفواتير
DROP TRIGGER IF EXISTS log_invoices_activity ON invoices;
CREATE TRIGGER log_invoices_activity
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- المدفوعات
DROP TRIGGER IF EXISTS log_payments_activity ON payments;
CREATE TRIGGER log_payments_activity
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- المصروفات
DROP TRIGGER IF EXISTS log_expenses_activity ON expenses;
CREATE TRIGGER log_expenses_activity
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- حركات المخزون
DROP TRIGGER IF EXISTS log_inventory_tx_activity ON inventory_transactions;
CREATE TRIGGER log_inventory_tx_activity
    AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- حركات الخزينة
DROP TRIGGER IF EXISTS log_treasury_tx_activity ON treasury_transactions;
CREATE TRIGGER log_treasury_tx_activity
    AFTER INSERT OR UPDATE OR DELETE ON treasury_transactions
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- العملاء
DROP TRIGGER IF EXISTS log_customers_activity ON customers;
CREATE TRIGGER log_customers_activity
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- الموردين
DROP TRIGGER IF EXISTS log_suppliers_activity ON suppliers;
CREATE TRIGGER log_suppliers_activity
    AFTER INSERT OR UPDATE OR DELETE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- تعيين الفنيين
DROP TRIGGER IF EXISTS log_job_technicians_activity ON job_technicians;
CREATE TRIGGER log_job_technicians_activity
    AFTER INSERT OR UPDATE OR DELETE ON job_technicians
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- الإشعارات الدائنة/المدينة
DROP TRIGGER IF EXISTS log_credit_debit_notes_activity ON credit_debit_notes;
CREATE TRIGGER log_credit_debit_notes_activity
    AFTER INSERT OR UPDATE OR DELETE ON credit_debit_notes
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- ============================================================
-- تم إنشاء جدول activity_logs + 11 تريجر للتتبع التلقائي
-- ============================================================
