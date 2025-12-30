-- ============================================================
-- Migration: Fix Workflow Gaps - Part 2
-- Version: 30
-- Description: 
--   1. Auto-calculate actual_cost from job_items
--   2. Auto-update started_at on first clock-in
--   3. Add approved_at to invoices
-- ============================================================

-- ============================================================
-- 1. إضافة approved_at للفواتير
-- ============================================================
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ============================================================
-- 2. تحديث approved_at عند اعتماد الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION update_invoice_approved_at()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
        NEW.approved_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_approved_at ON invoices;
CREATE TRIGGER trg_invoice_approved_at
    BEFORE UPDATE OF status ON invoices
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status = 'draft')
    EXECUTE FUNCTION update_invoice_approved_at();

-- ============================================================
-- 3. حساب التكلفة الفعلية تلقائياً من البنود
-- ============================================================
CREATE OR REPLACE FUNCTION update_job_order_actual_cost()
RETURNS trigger AS $$
DECLARE
    v_total_cost numeric;
BEGIN
    -- حساب مجموع البنود
    SELECT COALESCE(SUM(total_price), 0) INTO v_total_cost
    FROM job_items 
    WHERE job_order_id = COALESCE(NEW.job_order_id, OLD.job_order_id)
    AND is_cancelled = false;
    
    -- تحديث التكلفة الفعلية
    UPDATE job_orders SET 
        actual_cost = v_total_cost,
        updated_at = now()
    WHERE id = COALESCE(NEW.job_order_id, OLD.job_order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_item_cost ON job_items;
CREATE TRIGGER trg_job_item_cost
    AFTER INSERT OR UPDATE OR DELETE ON job_items
    FOR EACH ROW
    EXECUTE FUNCTION update_job_order_actual_cost();

-- ============================================================
-- 4. تحديث started_at عند أول clock-in
-- ============================================================
CREATE OR REPLACE FUNCTION update_started_at_on_clock_in()
RETURNS trigger AS $$
BEGIN
    -- تحديث started_at فقط إذا كانت فارغة ولم يتم البدء بعد
    IF NEW.clock_in IS NOT NULL THEN
        UPDATE job_orders SET 
            started_at = COALESCE(started_at, NEW.clock_in),
            status = CASE 
                WHEN status = 'pending' THEN 'in_progress'::job_status
                ELSE status
            END,
            updated_at = now()
        WHERE id = NEW.job_order_id 
        AND started_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clock_in_started_at ON job_time_logs;
CREATE TRIGGER trg_clock_in_started_at
    AFTER INSERT ON job_time_logs
    FOR EACH ROW
    WHEN (NEW.clock_in IS NOT NULL)
    EXECUTE FUNCTION update_started_at_on_clock_in();

-- ============================================================
-- 5. التحقق من اكتمال المهام قبل طلب المراجعة (اختياري)
-- ============================================================
CREATE OR REPLACE FUNCTION validate_review_request()
RETURNS trigger AS $$
DECLARE
    v_incomplete_tasks int;
BEGIN
    IF NEW.status = 'review' AND OLD.status != 'review' THEN
        SELECT COUNT(*) INTO v_incomplete_tasks
        FROM job_tasks 
        WHERE job_order_id = NEW.id 
        AND is_completed = false
        AND is_blocked = false;
        
        IF v_incomplete_tasks > 0 THEN
            RAISE WARNING 'يوجد % مهام غير مكتملة. يُفضل إكمالها قبل طلب المراجعة.', v_incomplete_tasks;
            -- نسمح بالاستمرار مع تحذير للمرونة
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_review ON job_orders;
CREATE TRIGGER trg_validate_review
    BEFORE UPDATE OF status ON job_orders
    FOR EACH ROW
    WHEN (NEW.status = 'review')
    EXECUTE FUNCTION validate_review_request();

-- ============================================================
-- 6. إضافة actual_cost لجدول job_orders إذا لم تكن موجودة
-- ============================================================
ALTER TABLE job_orders 
ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(14,2) DEFAULT 0;

-- ============================================================
-- 7. تحديث التكاليف الحالية للأوامر الموجودة
-- ============================================================
UPDATE job_orders jo SET 
    actual_cost = COALESCE((
        SELECT SUM(total_price) 
        FROM job_items ji 
        WHERE ji.job_order_id = jo.id 
        AND ji.is_cancelled = false
    ), 0);

-- ============================================================
-- ✅ تم تنفيذ الإصلاحات:
-- 1. approved_at للفواتير مع trigger للتحديث التلقائي
-- 2. actual_cost يُحسب تلقائياً من job_items
-- 3. started_at يُحدث عند أول clock-in
-- 4. تحذير (وليس منع) عند طلب مراجعة بمهام غير مكتملة
-- ============================================================

COMMENT ON FUNCTION update_invoice_approved_at IS 'تحديث تاريخ الاعتماد عند اعتماد الفاتورة';
COMMENT ON FUNCTION update_job_order_actual_cost IS 'حساب التكلفة الفعلية من البنود';
COMMENT ON FUNCTION update_started_at_on_clock_in IS 'تحديث تاريخ البدء عند أول clock-in';
COMMENT ON FUNCTION validate_review_request IS 'التحقق من المهام قبل طلب المراجعة';
