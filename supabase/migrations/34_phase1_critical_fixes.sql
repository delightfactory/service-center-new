-- ============================================================
-- Migration: إصلاحات المرحلة الأولى الحرجة
-- الملف: 34_phase1_critical_fixes.sql
-- التاريخ: 2026-01-03
-- ============================================================
-- الإصلاحات:
-- 1. تحديث رصيد العميل/المورد عند INSERT فاتورة بحالة approved مباشرة
-- 2. تحسين trigger تحديث رصيد العميل ليشمل INSERT بحالة approved
-- ============================================================

-- ============================================================
-- 1. إصلاح تحديث رصيد العميل عند إنشاء فاتورة approved مباشرة
-- ============================================================
-- المشكلة: الـ trigger الحالي يعمل فقط عند UPDATE من draft إلى approved
-- الحل: إضافة trigger جديد على INSERT

CREATE OR REPLACE FUNCTION update_customer_balance_on_invoice_insert()
RETURNS trigger AS $$
BEGIN
    -- فقط إذا كانت الفاتورة approved من البداية
    IF NEW.status = 'approved' AND NEW.customer_id IS NOT NULL THEN
        -- فاتورة مبيعات = زيادة مديونية العميل
        IF NEW.invoice_type = 'sales' THEN
            UPDATE customers 
            SET balance = balance + NEW.total_amount,
                updated_at = now()
            WHERE id = NEW.customer_id;
        -- مرتجع مبيعات = تقليل مديونية العميل
        ELSIF NEW.invoice_type = 'sales_return' THEN
            UPDATE customers 
            SET balance = balance - NEW.total_amount,
                updated_at = now()
            WHERE id = NEW.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_insert_customer_balance ON invoices;
CREATE TRIGGER trg_invoice_insert_customer_balance
    AFTER INSERT ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND NEW.customer_id IS NOT NULL)
    EXECUTE FUNCTION update_customer_balance_on_invoice_insert();

-- ============================================================
-- 2. إصلاح تحديث رصيد المورد عند إنشاء فاتورة approved مباشرة
-- ============================================================
CREATE OR REPLACE FUNCTION update_supplier_balance_on_invoice_insert()
RETURNS trigger AS $$
BEGIN
    -- فقط إذا كانت الفاتورة approved من البداية
    IF NEW.status = 'approved' AND NEW.supplier_id IS NOT NULL THEN
        -- فاتورة شراء = زيادة مستحقات المورد
        IF NEW.invoice_type = 'purchase' THEN
            UPDATE suppliers 
            SET balance = balance + NEW.total_amount,
                updated_at = now()
            WHERE id = NEW.supplier_id;
        -- مرتجع شراء = تقليل مستحقات المورد
        ELSIF NEW.invoice_type = 'purchase_return' THEN
            UPDATE suppliers 
            SET balance = balance - NEW.total_amount,
                updated_at = now()
            WHERE id = NEW.supplier_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_insert_supplier_balance ON invoices;
CREATE TRIGGER trg_invoice_insert_supplier_balance
    AFTER INSERT ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND NEW.supplier_id IS NOT NULL)
    EXECUTE FUNCTION update_supplier_balance_on_invoice_insert();

-- ============================================================
-- 3. إصلاح خصم المخزون عند إنشاء فاتورة approved مباشرة
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_inventory_on_invoice_insert()
RETURNS trigger AS $$
BEGIN
    -- فقط إذا كانت الفاتورة approved من البداية ومرتبطة بأمر شغل
    IF NEW.status = 'approved' AND NEW.job_order_id IS NOT NULL THEN
        PERFORM deduct_inventory_on_invoice_approval(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_insert_deduct_inventory ON invoices;
CREATE TRIGGER trg_invoice_insert_deduct_inventory
    AFTER INSERT ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND NEW.job_order_id IS NOT NULL)
    EXECUTE FUNCTION deduct_inventory_on_invoice_insert();

-- ============================================================
-- 4. تحسين حساب actual_hours ليشمل جميع الحالات
-- ============================================================
-- الـ trigger الحالي يعمل بشكل صحيح عند clock_out
-- نضيف trigger إضافي لتحديث الساعات عند تسليم أمر الشغل

CREATE OR REPLACE FUNCTION finalize_job_actual_hours()
RETURNS trigger AS $$
DECLARE
    v_total_hours numeric;
BEGIN
    -- فقط عند التحول إلى completed أو delivered
    IF NEW.status IN ('completed', 'delivered') 
       AND OLD.status NOT IN ('completed', 'delivered') THEN
        -- حساب إجمالي الساعات من سجلات الوقت المكتملة
        SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) INTO v_total_hours
        FROM job_time_logs
        WHERE job_order_id = NEW.id
          AND clock_out IS NOT NULL;
        
        -- تحديث actual_hours فقط إذا كانت هناك سجلات
        IF v_total_hours > 0 THEN
            NEW.actual_hours := v_total_hours;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finalize_job_hours ON job_orders;
CREATE TRIGGER trg_finalize_job_hours
    BEFORE UPDATE OF status ON job_orders
    FOR EACH ROW 
    WHEN (NEW.status IN ('completed', 'delivered') AND OLD.status NOT IN ('completed', 'delivered'))
    EXECUTE FUNCTION finalize_job_actual_hours();

-- ============================================================
-- ✅ تم إصلاح الفجوات الحرجة:
-- 1. رصيد العميل يُحدث عند INSERT فاتورة approved
-- 2. رصيد المورد يُحدث عند INSERT فاتورة approved
-- 3. المخزون يُخصم عند INSERT فاتورة approved مرتبطة بأمر شغل
-- 4. actual_hours يُحسب نهائياً عند completed/delivered
-- ============================================================

COMMENT ON FUNCTION update_customer_balance_on_invoice_insert IS 'تحديث رصيد العميل عند إنشاء فاتورة approved مباشرة';
COMMENT ON FUNCTION update_supplier_balance_on_invoice_insert IS 'تحديث رصيد المورد عند إنشاء فاتورة approved مباشرة';
COMMENT ON FUNCTION deduct_inventory_on_invoice_insert IS 'خصم المخزون عند إنشاء فاتورة approved مباشرة';
COMMENT ON FUNCTION finalize_job_actual_hours IS 'حساب actual_hours نهائياً عند اكتمال/تسليم أمر الشغل';
