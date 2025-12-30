-- ============================================================
-- نظام حجز المخزون المرن + العمليات العكسية
-- الإصدار: 1.0
-- التاريخ: 2024-12-26
-- ============================================================
-- يتطلب: 04_inventory.sql, 05_finance.sql
-- ============================================================

-- ============================================================
-- 1. إضافة عمود is_cancelled للـ job_items إذا لم يكن موجوداً
-- ============================================================
DO $$ BEGIN
    ALTER TABLE job_items ADD COLUMN IF NOT EXISTS is_cancelled boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 2. إضافة أنواع جديدة لحركات المخزون
-- ============================================================
-- التحقق من وجود القيم قبل إضافتها
DO $$ BEGIN
    -- إضافة reservation إذا لم يكن موجوداً
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reservation' AND enumtypid = 'inventory_tx_type'::regtype) THEN
        ALTER TYPE inventory_tx_type ADD VALUE IF NOT EXISTS 'reservation';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'release_reservation' AND enumtypid = 'inventory_tx_type'::regtype) THEN
        ALTER TYPE inventory_tx_type ADD VALUE IF NOT EXISTS 'release_reservation';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- 3. Function: حجز المخزون (تدعم الخدمات المركبة)
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_inventory_for_job_item(
    p_job_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_product record;
    v_warehouse_id uuid;
    v_component record;
BEGIN
    -- الحصول على معلومات المنتج
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- تحديد المخزن (الافتراضي إذا لم يُحدد)
    v_warehouse_id := COALESCE(p_warehouse_id, (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));

    -- إذا كان المنتج خدمة مركبة، نحجز مكوناتها
    IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
        -- حجز كل مكون من مكونات الخدمة
        FOR v_component IN 
            SELECT sc.component_id, sc.quantity as component_qty, p.is_trackable
            FROM service_components sc
            JOIN products p ON p.id = sc.component_id
            WHERE sc.service_id = p_product_id
            AND p.is_trackable = true
        LOOP
            -- حجز الكمية = كمية المكون × كمية الخدمة المطلوبة
            PERFORM reserve_single_product(
                p_job_item_id,
                v_component.component_id,
                v_component.component_qty * p_quantity,
                v_warehouse_id
            );
        END LOOP;
    -- إذا كان قطعة/مستهلك قابل للتتبع
    ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
        PERFORM reserve_single_product(p_job_item_id, p_product_id, p_quantity, v_warehouse_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Function: حجز منتج واحد
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_single_product(
    p_job_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_qty numeric;
    v_current_reserved numeric;
BEGIN
    -- التحقق من وجود سجل المخزون وإنشائه إذا لم يكن موجوداً
    INSERT INTO inventory_items (product_id, warehouse_id, quantity, reserved_quantity)
    VALUES (p_product_id, p_warehouse_id, 0, 0)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    -- الحصول على الكميات الحالية
    SELECT quantity, reserved_quantity 
    INTO v_current_qty, v_current_reserved
    FROM inventory_items 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- تحديث الكمية المحجوزة
    UPDATE inventory_items 
    SET reserved_quantity = reserved_quantity + p_quantity,
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- تسجيل حركة الحجز
    INSERT INTO inventory_transactions (
        product_id, 
        warehouse_id, 
        transaction_type, 
        quantity,
        balance_before,
        balance_after,
        reference_type, 
        reference_id,
        notes
    )
    VALUES (
        p_product_id,
        p_warehouse_id,
        'reservation',
        p_quantity,
        v_current_qty - v_current_reserved,
        v_current_qty - (v_current_reserved + p_quantity),
        'job_item',
        p_job_item_id,
        'حجز للبند في أمر شغل'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Function: تحرير حجز المخزون
-- ============================================================
CREATE OR REPLACE FUNCTION release_inventory_for_job_item(
    p_job_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_product record;
    v_warehouse_id uuid;
    v_component record;
BEGIN
    -- الحصول على معلومات المنتج
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_warehouse_id := COALESCE(p_warehouse_id, (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));

    -- إذا كان المنتج خدمة مركبة
    IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
        FOR v_component IN 
            SELECT sc.component_id, sc.quantity as component_qty, p.is_trackable
            FROM service_components sc
            JOIN products p ON p.id = sc.component_id
            WHERE sc.service_id = p_product_id
            AND p.is_trackable = true
        LOOP
            PERFORM release_single_product(
                p_job_item_id,
                v_component.component_id,
                v_component.component_qty * p_quantity,
                v_warehouse_id
            );
        END LOOP;
    ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
        PERFORM release_single_product(p_job_item_id, p_product_id, p_quantity, v_warehouse_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. Function: تحرير حجز منتج واحد
-- ============================================================
CREATE OR REPLACE FUNCTION release_single_product(
    p_job_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_qty numeric;
    v_current_reserved numeric;
BEGIN
    SELECT quantity, reserved_quantity 
    INTO v_current_qty, v_current_reserved
    FROM inventory_items 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- تحديث الكمية المحجوزة (مع منع السالب)
    UPDATE inventory_items 
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- تسجيل حركة تحرير الحجز
    INSERT INTO inventory_transactions (
        product_id, 
        warehouse_id, 
        transaction_type, 
        quantity,
        balance_before,
        balance_after,
        reference_type, 
        reference_id,
        notes
    )
    VALUES (
        p_product_id,
        p_warehouse_id,
        'release_reservation',
        p_quantity,
        v_current_qty - v_current_reserved,
        v_current_qty - GREATEST(0, v_current_reserved - p_quantity),
        'job_item',
        p_job_item_id,
        'تحرير حجز - إلغاء/حذف البند'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. Trigger: حجز المخزون عند إضافة job_item
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_item_insert_reserve()
RETURNS trigger AS $$
BEGIN
    IF NEW.product_id IS NOT NULL THEN
        PERFORM reserve_inventory_for_job_item(
            NEW.id,
            NEW.product_id,
            NEW.quantity,
            NEW.warehouse_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_item_insert_reserve ON job_items;
CREATE TRIGGER trg_job_item_insert_reserve
    AFTER INSERT ON job_items
    FOR EACH ROW 
    EXECUTE FUNCTION on_job_item_insert_reserve();

-- ============================================================
-- 8. Trigger: تحرير الحجز عند حذف job_item
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_item_delete_release()
RETURNS trigger AS $$
BEGIN
    -- لا نحرر الحجز إذا كان البند قد تم فوترته
    IF OLD.product_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM invoices i
        JOIN job_orders jo ON jo.id = i.job_order_id
        WHERE jo.id = OLD.job_order_id
        AND i.status IN ('approved', 'paid', 'partial')
    ) THEN
        PERFORM release_inventory_for_job_item(
            OLD.id,
            OLD.product_id,
            OLD.quantity,
            OLD.warehouse_id
        );
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_item_delete_release ON job_items;
CREATE TRIGGER trg_job_item_delete_release
    BEFORE DELETE ON job_items
    FOR EACH ROW 
    EXECUTE FUNCTION on_job_item_delete_release();

-- ============================================================
-- 9. Trigger: تحرير الحجز عند إلغاء job_item
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_item_cancelled()
RETURNS trigger AS $$
BEGIN
    IF NEW.is_cancelled = true AND OLD.is_cancelled = false AND NEW.product_id IS NOT NULL THEN
        PERFORM release_inventory_for_job_item(
            NEW.id,
            NEW.product_id,
            NEW.quantity,
            NEW.warehouse_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_item_cancelled ON job_items;
CREATE TRIGGER trg_job_item_cancelled
    AFTER UPDATE OF is_cancelled ON job_items
    FOR EACH ROW 
    WHEN (NEW.is_cancelled = true AND OLD.is_cancelled = false)
    EXECUTE FUNCTION on_job_item_cancelled();

-- ============================================================
-- 10. Function: خصم المخزون نهائياً عند اعتماد الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_inventory_on_invoice_approval(p_invoice_id uuid)
RETURNS void AS $$
DECLARE
    v_invoice record;
    v_job_item record;
    v_product record;
    v_component record;
    v_warehouse_id uuid;
BEGIN
    -- الحصول على معلومات الفاتورة
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    IF NOT FOUND OR v_invoice.job_order_id IS NULL THEN
        RETURN;
    END IF;

    -- لكل بند في أمر الشغل
    FOR v_job_item IN 
        SELECT * FROM job_items 
        WHERE job_order_id = v_invoice.job_order_id 
        AND product_id IS NOT NULL
        AND is_cancelled = false
    LOOP
        SELECT * INTO v_product FROM products WHERE id = v_job_item.product_id;
        v_warehouse_id := COALESCE(v_job_item.warehouse_id, (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));

        -- إذا كانت خدمة مركبة
        IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
            FOR v_component IN 
                SELECT sc.component_id, sc.quantity as component_qty
                FROM service_components sc
                JOIN products p ON p.id = sc.component_id
                WHERE sc.service_id = v_product.id
                AND p.is_trackable = true
            LOOP
                PERFORM deduct_single_product(
                    p_invoice_id,
                    v_job_item.id,
                    v_component.component_id,
                    v_component.component_qty * v_job_item.quantity,
                    v_warehouse_id
                );
            END LOOP;
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            PERFORM deduct_single_product(
                p_invoice_id,
                v_job_item.id,
                v_job_item.product_id,
                v_job_item.quantity,
                v_warehouse_id
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. Function: خصم منتج واحد
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_single_product(
    p_invoice_id uuid,
    p_job_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_qty numeric;
    v_current_reserved numeric;
BEGIN
    SELECT quantity, reserved_quantity 
    INTO v_current_qty, v_current_reserved
    FROM inventory_items 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- خصم من الكمية الفعلية وتحرير الحجز
    UPDATE inventory_items 
    SET quantity = quantity - p_quantity,
        reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- تسجيل حركة البيع
    INSERT INTO inventory_transactions (
        product_id, 
        warehouse_id, 
        transaction_type, 
        quantity,
        balance_before,
        balance_after,
        reference_type, 
        reference_id,
        notes
    )
    VALUES (
        p_product_id,
        p_warehouse_id,
        'sale',
        p_quantity,
        v_current_qty,
        v_current_qty - p_quantity,
        'invoice',
        p_invoice_id,
        'خصم نهائي - فوترة'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. Trigger: خصم المخزون عند اعتماد الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION on_invoice_approved_deduct()
RETURNS trigger AS $$
BEGIN
    -- فقط عند التحول من draft إلى approved
    IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
        PERFORM deduct_inventory_on_invoice_approval(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_approved_deduct ON invoices;
CREATE TRIGGER trg_invoice_approved_deduct
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND OLD.status = 'draft')
    EXECUTE FUNCTION on_invoice_approved_deduct();

-- ============================================================
-- 13. Function: إرجاع المخزون عند إلغاء الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION restore_inventory_on_invoice_cancel(p_invoice_id uuid)
RETURNS void AS $$
DECLARE
    v_invoice record;
    v_job_item record;
    v_product record;
    v_component record;
    v_warehouse_id uuid;
BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    IF NOT FOUND OR v_invoice.job_order_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_job_item IN 
        SELECT * FROM job_items 
        WHERE job_order_id = v_invoice.job_order_id 
        AND product_id IS NOT NULL
        AND is_cancelled = false
    LOOP
        SELECT * INTO v_product FROM products WHERE id = v_job_item.product_id;
        v_warehouse_id := COALESCE(v_job_item.warehouse_id, (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));

        IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
            FOR v_component IN 
                SELECT sc.component_id, sc.quantity as component_qty
                FROM service_components sc
                JOIN products p ON p.id = sc.component_id
                WHERE sc.service_id = v_product.id
                AND p.is_trackable = true
            LOOP
                PERFORM restore_single_product(
                    p_invoice_id,
                    v_component.component_id,
                    v_component.component_qty * v_job_item.quantity,
                    v_warehouse_id
                );
            END LOOP;
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            PERFORM restore_single_product(
                p_invoice_id,
                v_job_item.product_id,
                v_job_item.quantity,
                v_warehouse_id
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 14. Function: إرجاع منتج واحد للمخزون
-- ============================================================
CREATE OR REPLACE FUNCTION restore_single_product(
    p_invoice_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_qty numeric;
BEGIN
    SELECT quantity INTO v_current_qty
    FROM inventory_items 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    UPDATE inventory_items 
    SET quantity = quantity + p_quantity,
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    INSERT INTO inventory_transactions (
        product_id, 
        warehouse_id, 
        transaction_type, 
        quantity,
        balance_before,
        balance_after,
        reference_type, 
        reference_id,
        notes
    )
    VALUES (
        p_product_id,
        p_warehouse_id,
        'return',
        p_quantity,
        v_current_qty,
        v_current_qty + p_quantity,
        'invoice',
        p_invoice_id,
        'إرجاع للمخزون - إلغاء فاتورة'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 15. Trigger: إرجاع المخزون عند إلغاء الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION on_invoice_cancelled_restore()
RETURNS trigger AS $$
BEGIN
    -- فقط إذا كانت الفاتورة معتمدة أو مدفوعة سابقاً
    IF NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial') THEN
        PERFORM restore_inventory_on_invoice_cancel(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_cancelled_restore ON invoices;
CREATE TRIGGER trg_invoice_cancelled_restore
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial'))
    EXECUTE FUNCTION on_invoice_cancelled_restore();

-- ============================================================
-- 16. Trigger: تحرير حجوزات عند إلغاء أمر الشغل
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_order_cancelled()
RETURNS trigger AS $$
DECLARE
    v_job_item record;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        -- تحرير حجوزات جميع البنود غير المفوترة
        IF NOT EXISTS (
            SELECT 1 FROM invoices 
            WHERE job_order_id = NEW.id 
            AND status IN ('approved', 'paid', 'partial')
        ) THEN
            FOR v_job_item IN 
                SELECT * FROM job_items 
                WHERE job_order_id = NEW.id 
                AND product_id IS NOT NULL
                AND is_cancelled = false
            LOOP
                PERFORM release_inventory_for_job_item(
                    v_job_item.id,
                    v_job_item.product_id,
                    v_job_item.quantity,
                    v_job_item.warehouse_id
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_order_cancelled ON job_orders;
CREATE TRIGGER trg_job_order_cancelled
    AFTER UPDATE OF status ON job_orders
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
    EXECUTE FUNCTION on_job_order_cancelled();

-- ============================================================
-- ✅ تم إنشاء نظام حجز المخزون المرن
-- ============================================================
COMMENT ON FUNCTION reserve_inventory_for_job_item IS 'حجز المخزون عند إضافة بند - يدعم الخدمات المركبة';
COMMENT ON FUNCTION release_inventory_for_job_item IS 'تحرير حجز المخزون عند إلغاء/حذف بند';
COMMENT ON FUNCTION deduct_inventory_on_invoice_approval IS 'خصم نهائي من المخزون عند اعتماد الفاتورة';
COMMENT ON FUNCTION restore_inventory_on_invoice_cancel IS 'إرجاع المخزون عند إلغاء الفاتورة';
