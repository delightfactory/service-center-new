-- ============================================================
-- إصلاح العمليات العكسية - إلغاء أوامر الشغل والفواتير
-- الإصدار: 1.0
-- التاريخ: 2024-01-30
-- ============================================================
-- يتطلب: 20_inventory_reservation.sql, 100_fix_inventory_logic.sql
-- ============================================================

-- ============================================================
-- 1. دالة استرجاع المخزون المصروف يدوياً لأمر شغل
-- ============================================================
CREATE OR REPLACE FUNCTION restore_dispensed_inventory_for_job_order(p_job_order_id uuid)
RETURNS void AS $$
DECLARE
    v_job_item record;
    v_product record;
    v_component record;
    v_warehouse_id uuid;
BEGIN
    -- للبنود المصروفة يدوياً فقط
    FOR v_job_item IN 
        SELECT * FROM job_items 
        WHERE job_order_id = p_job_order_id 
        AND product_id IS NOT NULL
        AND is_cancelled = false
        AND is_dispensed = true
    LOOP
        SELECT * INTO v_product FROM products WHERE id = v_job_item.product_id;
        v_warehouse_id := COALESCE(v_job_item.warehouse_id, 
            (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));

        -- خدمة مركبة: استرجاع مكوناتها
        IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
            FOR v_component IN 
                SELECT sc.component_id, sc.quantity as component_qty
                FROM service_components sc
                JOIN products p ON p.id = sc.component_id
                WHERE sc.service_id = v_product.id
                AND p.is_trackable = true
            LOOP
                -- إرجاع الكمية للمخزون
                UPDATE inventory_items 
                SET quantity = quantity + (v_component.component_qty * v_job_item.quantity),
                    last_updated = now()
                WHERE product_id = v_component.component_id 
                AND warehouse_id = v_warehouse_id;
                
                -- تسجيل حركة الإرجاع
                INSERT INTO inventory_transactions (
                    product_id, warehouse_id, transaction_type, quantity,
                    reference_type, reference_id, notes, created_by
                ) VALUES (
                    v_component.component_id, v_warehouse_id, 'adjustment',
                    v_component.component_qty * v_job_item.quantity,
                    'job_order', p_job_order_id,
                    'إرجاع مخزون - إلغاء أمر شغل',
                    (SELECT created_by FROM job_orders WHERE id = p_job_order_id)
                );
            END LOOP;
        -- قطعة/مستهلك قابل للتتبع
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            UPDATE inventory_items 
            SET quantity = quantity + v_job_item.quantity,
                last_updated = now()
            WHERE product_id = v_job_item.product_id 
            AND warehouse_id = v_warehouse_id;
            
            INSERT INTO inventory_transactions (
                product_id, warehouse_id, transaction_type, quantity,
                reference_type, reference_id, notes, created_by
            ) VALUES (
                v_job_item.product_id, v_warehouse_id, 'adjustment',
                v_job_item.quantity,
                'job_order', p_job_order_id,
                'إرجاع مخزون - إلغاء أمر شغل',
                (SELECT created_by FROM job_orders WHERE id = p_job_order_id)
            );
        END IF;
        
        -- ملاحظة: لا نُعدّل is_dispensed هنا لأن الأمر سيُلغى بالكامل
        -- وتعديله سيؤثر على الـ loop في on_job_order_cancelled
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. trigger للتحقق من إمكانية الإلغاء (BEFORE - للتحقق فقط)
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_order_cancel_validate()
RETURNS trigger AS $$
DECLARE
    v_has_approved_invoice boolean;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        
        -- تحقق من وجود فاتورة معتمدة
        SELECT EXISTS (
            SELECT 1 FROM invoices 
            WHERE job_order_id = NEW.id 
            AND status IN ('approved', 'paid', 'partial')
        ) INTO v_has_approved_invoice;
        
        IF v_has_approved_invoice THEN
            RAISE EXCEPTION 'لا يمكن إلغاء أمر شغل له فاتورة معتمدة. يرجى إلغاء الفاتورة أولاً.';
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- trigger للتحقق (BEFORE)
DROP TRIGGER IF EXISTS trg_job_order_cancel_validate ON job_orders;
CREATE TRIGGER trg_job_order_cancel_validate
    BEFORE UPDATE OF status ON job_orders
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
    EXECUTE FUNCTION on_job_order_cancel_validate();

-- ============================================================
-- 3. trigger لتنفيذ الإلغاء (AFTER - لتعديل البيانات)
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_order_cancelled()
RETURNS trigger AS $$
DECLARE
    v_job_item record;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        
        -- استرجاع المخزون المصروف يدوياً (إن وجد)
        PERFORM restore_dispensed_inventory_for_job_order(NEW.id);
        
        -- تحرير الحجوزات للبنود غير المصروفة
        FOR v_job_item IN 
            SELECT * FROM job_items 
            WHERE job_order_id = NEW.id 
            AND product_id IS NOT NULL
            AND is_cancelled = false
            AND is_dispensed = false
        LOOP
            PERFORM release_inventory_for_job_item(
                v_job_item.id,
                v_job_item.product_id,
                v_job_item.quantity,
                v_job_item.warehouse_id
            );
        END LOOP;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- trigger للتنفيذ (AFTER)
DROP TRIGGER IF EXISTS trg_job_order_cancelled ON job_orders;
CREATE TRIGGER trg_job_order_cancelled
    AFTER UPDATE OF status ON job_orders
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
    EXECUTE FUNCTION on_job_order_cancelled();

-- ============================================================
-- 3. تعديل trigger إلغاء الفاتورة للتحقق من الدفعات
-- ============================================================
CREATE OR REPLACE FUNCTION on_invoice_cancel_validate()
RETURNS trigger AS $$
DECLARE
    v_payment_count integer;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial') THEN
        
        -- تحقق من وجود دفعات مرتبطة
        SELECT COUNT(*) INTO v_payment_count
        FROM payments 
        WHERE invoice_id = NEW.id;
        
        IF v_payment_count > 0 THEN
            RAISE EXCEPTION 'لا يمكن إلغاء فاتورة لها دفعات مرتبطة (%). يرجى حذف الدفعات أولاً.', v_payment_count;
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء trigger جديد للتحقق (BEFORE)
DROP TRIGGER IF EXISTS trg_invoice_cancel_validate ON invoices;
CREATE TRIGGER trg_invoice_cancel_validate
    BEFORE UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial'))
    EXECUTE FUNCTION on_invoice_cancel_validate();

-- ============================================================
-- 4. إضافة عمود سبب الإلغاء لأوامر الشغل والفواتير (إذا لم تكن موجودة)
-- ============================================================
DO $$ BEGIN
    -- أعمدة أوامر الشغل
    ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
    ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
    ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id);
    
    -- أعمدة الفواتير
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_reason text;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- التعليقات
-- ============================================================
COMMENT ON FUNCTION restore_dispensed_inventory_for_job_order IS 'استرجاع المخزون المصروف يدوياً عند إلغاء أمر الشغل';
COMMENT ON FUNCTION on_job_order_cancelled IS 'معالجة إلغاء أمر الشغل: التحقق من الفواتير، استرجاع المخزون، تحرير الحجوزات';
COMMENT ON FUNCTION on_invoice_cancel_validate IS 'التحقق من عدم وجود دفعات قبل إلغاء الفاتورة';

COMMENT ON COLUMN job_orders.cancellation_reason IS 'سبب إلغاء أمر الشغل';
COMMENT ON COLUMN invoices.cancellation_reason IS 'سبب إلغاء الفاتورة';

