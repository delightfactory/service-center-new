-- ============================================================
-- Migration: تحسينات فلو أمر الشغل
-- ============================================================
-- 1. Trigger لإعادة فتح الأمر عند إضافة مهمة جديدة
-- 2. التأكد من إيقاف كل التايمرات عند طلب المراجعة
-- ============================================================

-- ============================================================
-- 1. Trigger لإعادة فتح الأمر عند إضافة مهمة جديدة
-- ============================================================
-- عند إضافة مهمة جديدة لأمر في حالة review أو completed
-- يتم إعادة الحالة تلقائياً لـ in_progress

CREATE OR REPLACE FUNCTION reopen_job_on_new_task()
RETURNS TRIGGER AS $$
DECLARE
    current_status text;
BEGIN
    -- جلب الحالة الحالية للأمر
    SELECT status INTO current_status 
    FROM job_orders 
    WHERE id = NEW.job_order_id;
    
    -- إذا كان الأمر في حالة review أو completed، أعد فتحه
    IF current_status IN ('review', 'completed') THEN
        UPDATE job_orders 
        SET status = 'in_progress',
            updated_at = now()
        WHERE id = NEW.job_order_id;
        
        RAISE NOTICE 'Job % reopened due to new task', NEW.job_order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف الـ Trigger إن وجد
DROP TRIGGER IF EXISTS reopen_job_on_task_insert ON job_tasks;

-- إنشاء الـ Trigger
CREATE TRIGGER reopen_job_on_task_insert
    AFTER INSERT ON job_tasks
    FOR EACH ROW
    EXECUTE FUNCTION reopen_job_on_new_task();

-- ============================================================
-- 2. Function لإيقاف كل التايمرات النشطة عند طلب المراجعة
-- ============================================================
-- يمكن استدعاؤها من الكود أو كـ Trigger

CREATE OR REPLACE FUNCTION close_all_active_timelogs(p_job_order_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE job_time_logs
    SET clock_out = COALESCE(clock_out, now())
    WHERE job_order_id = p_job_order_id
    AND clock_out IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Trigger لإيقاف التايمرات تلقائياً عند تغيير الحالة لـ review أو completed
-- ============================================================

CREATE OR REPLACE FUNCTION auto_close_timelogs_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- إذا تغيرت الحالة إلى review أو completed
    IF NEW.status IN ('review', 'completed') AND OLD.status NOT IN ('review', 'completed') THEN
        -- إيقاف كل التايمرات النشطة
        UPDATE job_time_logs
        SET clock_out = COALESCE(clock_out, now())
        WHERE job_order_id = NEW.id
        AND clock_out IS NULL;
        
        RAISE NOTICE 'Closed all active timelogs for job %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف الـ Trigger إن وجد
DROP TRIGGER IF EXISTS auto_close_timelogs_trigger ON job_orders;

-- إنشاء الـ Trigger
CREATE TRIGGER auto_close_timelogs_trigger
    AFTER UPDATE OF status ON job_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_close_timelogs_on_status_change();

-- ============================================================
-- 4. إضافة RLS للسماح للمشرف بتغيير الحالة
-- ============================================================

-- التأكد من وجود سياسة UPDATE على job_orders
DROP POLICY IF EXISTS "job_orders_update_policy" ON job_orders;

CREATE POLICY "job_orders_update_policy" ON job_orders
    FOR UPDATE TO authenticated
    USING (
        -- المدراء والمشرفين
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor', 'engineer')
        )
        -- أو الفني المعين على الأمر (للحالات المسموحة)
        OR EXISTS (
            SELECT 1 FROM job_technicians jt
            WHERE jt.job_order_id = job_orders.id
            AND jt.technician_id = auth.uid()
        )
    );

-- ============================================================
-- تم إنشاء Triggers لـ:
-- ✅ إعادة فتح الأمر عند إضافة مهمة جديدة
-- ✅ إيقاف التايمرات تلقائياً عند طلب المراجعة/الإنهاء
-- ✅ السماح للفني والمشرف بتحديث حالة الأمر
-- ============================================================
