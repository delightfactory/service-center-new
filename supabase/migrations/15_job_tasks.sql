-- ============================================================
-- Migration: Job Tasks (مهام أوامر الشغل)
-- ============================================================
-- جدول منفصل للمهام التي يراها الفني (ToDo List)
-- منفصل عن job_items التي تظهر في الفاتورة
-- ============================================================

-- إنشاء جدول المهام
CREATE TABLE IF NOT EXISTS job_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_order_id uuid NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    
    -- وصف المهمة
    description text NOT NULL,
    
    -- التعيين
    assigned_to uuid REFERENCES profiles(id),
    
    -- الحالة
    is_completed boolean DEFAULT false,
    completed_at timestamptz,
    completed_by uuid REFERENCES profiles(id),
    
    -- التعثر
    is_blocked boolean DEFAULT false,
    blocked_reason text,
    
    -- الترتيب والملاحظات
    sort_order integer DEFAULT 0,
    notes text,
    
    -- التتبع
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_job_tasks_job_order ON job_tasks(job_order_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_assigned_to ON job_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_tasks_completed ON job_tasks(is_completed);

-- تعليقات
COMMENT ON TABLE job_tasks IS 'مهام أوامر الشغل - قائمة ToDo للفنيين';
COMMENT ON COLUMN job_tasks.description IS 'وصف المهمة مثل: فحص الفرامل، تغيير الزيت';
COMMENT ON COLUMN job_tasks.assigned_to IS 'الفني المسؤول عن المهمة';
COMMENT ON COLUMN job_tasks.is_blocked IS 'هل المهمة متعثرة (مثلاً في انتظار قطعة)';

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة لجميع المستخدمين المصادق عليهم
CREATE POLICY "job_tasks_select_policy" ON job_tasks
    FOR SELECT TO authenticated
    USING (true);

-- السماح بالإضافة
CREATE POLICY "job_tasks_insert_policy" ON job_tasks
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- السماح بالتحديث للفني المعين أو المدير
CREATE POLICY "job_tasks_update_policy" ON job_tasks
    FOR UPDATE TO authenticated
    USING (
        assigned_to = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor', 'engineer')
        )
    );

-- السماح بالحذف للمدير فقط
CREATE POLICY "job_tasks_delete_policy" ON job_tasks
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor')
        )
    );

-- ============================================================
-- Trigger لتحديث updated_at
-- ============================================================
DROP TRIGGER IF EXISTS set_job_tasks_updated_at ON job_tasks;
CREATE TRIGGER set_job_tasks_updated_at
    BEFORE UPDATE ON job_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- تم إنشاء جدول job_tasks للفصل بين المهام وبنود الفاتورة
-- ============================================================
