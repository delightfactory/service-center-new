-- ============================================================
-- Fix Inventory Logic: Manual Dispense & Consumption Type
-- Migration: 100_fix_inventory_logic.sql
-- Date: 2026-01-26
-- ============================================================

-- 1. إضافة عمود is_dispensed لجدول job_items
DO $$ BEGIN
    ALTER TABLE job_items ADD COLUMN IF NOT EXISTS is_dispensed boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. تحديث دالة خصم المنتج لتقبل نوع الحركة
CREATE OR REPLACE FUNCTION deduct_single_product(
    p_invoice_id uuid, -- يمكن أن يكون NULL في حالة الصرف اليدوي
    p_job_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid,
    p_transaction_type inventory_tx_type DEFAULT 'sale'
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

    -- خصم من الكمية المحجوزة فقط (الكمية الفعلية يخصمها التريجر update_inventory_balance)
    UPDATE inventory_items 
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        last_updated = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- تسجيل الحركة (التريجر سيقوم بخصم الكمية الفعلية بناءً على هذا الإدراج)
    INSERT INTO inventory_transactions (
        product_id, 
        warehouse_id, 
        transaction_type, 
        quantity,
        balance_before,
        balance_after, -- Trigger will recalculate this
        reference_type, 
        reference_id,
        notes
    )
    VALUES (
        p_product_id,
        p_warehouse_id,
        p_transaction_type,
        p_quantity,
        v_current_qty, 
        v_current_qty - p_quantity,
        'job_item',
        p_job_item_id,
        CASE 
            WHEN p_transaction_type = 'job_consumption' AND p_invoice_id IS NULL THEN 'صرف يدوي لأمر شغل'
            WHEN p_transaction_type = 'job_consumption' THEN 'صرف تلقائي - فوترة'
            ELSE 'خصم نهائي - مبيعات مباشرة'
        END
    );
END;
$$ LANGUAGE plpgsql;

-- 3. دالة RPC للصرف اليدوي من الورشة
CREATE OR REPLACE FUNCTION dispense_job_items(p_job_order_id uuid)
RETURNS void AS $$
DECLARE
    v_job_item record;
    v_product record;
    v_component record;
    v_warehouse_id uuid;
BEGIN
    -- لكل بند في أمر الشغل لم يتم صرفه بعد
    FOR v_job_item IN 
        SELECT * FROM job_items 
        WHERE job_order_id = p_job_order_id 
        AND product_id IS NOT NULL
        AND is_cancelled = false
        AND is_dispensed = false
    LOOP
        SELECT * INTO v_product FROM products WHERE id = v_job_item.product_id;
        v_warehouse_id := COALESCE(v_job_item.warehouse_id, (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));

        -- خصم المخزون
        IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
            FOR v_component IN 
                SELECT sc.component_id, sc.quantity as component_qty
                FROM service_components sc
                JOIN products p ON p.id = sc.component_id
                WHERE sc.service_id = v_product.id
                AND p.is_trackable = true
            LOOP
                PERFORM deduct_single_product(
                    NULL,
                    v_job_item.id,
                    v_component.component_id,
                    v_component.component_qty * v_job_item.quantity,
                    v_warehouse_id,
                    'job_consumption'
                );
            END LOOP;
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            PERFORM deduct_single_product(
                NULL,
                v_job_item.id,
                v_job_item.product_id,
                v_job_item.quantity,
                v_warehouse_id,
                'job_consumption'
            );
        END IF;

        -- تحديث حالة البند
        UPDATE job_items SET is_dispensed = true WHERE id = v_job_item.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. تحديث دالة الخصم عند اعتماد الفاتورة (لتفادي الخصم المزدوج)
CREATE OR REPLACE FUNCTION deduct_inventory_on_invoice_approval(p_invoice_id uuid)
RETURNS void AS $$
DECLARE
    v_invoice record;
    v_job_item record;
    v_product record;
    v_component record;
    v_warehouse_id uuid;
    v_tx_type inventory_tx_type;
BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    IF NOT FOUND OR v_invoice.job_order_id IS NULL THEN
        RETURN;
    END IF;

    v_tx_type := 'job_consumption';

    FOR v_job_item IN 
        SELECT * FROM job_items 
        WHERE job_order_id = v_invoice.job_order_id 
        AND product_id IS NOT NULL
        AND is_cancelled = false
        AND is_dispensed = false -- فقط إذا لم يتم الصرف مسبقاً
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
                PERFORM deduct_single_product(
                    p_invoice_id,
                    v_job_item.id,
                    v_component.component_id,
                    v_component.component_qty * v_job_item.quantity,
                    v_warehouse_id,
                    v_tx_type
                );
            END LOOP;
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            PERFORM deduct_single_product(
                p_invoice_id,
                v_job_item.id,
                v_job_item.product_id,
                v_job_item.quantity,
                v_warehouse_id,
                v_tx_type
            );
        END IF;
        
        UPDATE job_items SET is_dispensed = true WHERE id = v_job_item.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. تحديث دالة استرجاع المخزون (إلغاء الفواتير)
CREATE OR REPLACE FUNCTION restore_single_product(
    p_invoice_id uuid, 
    p_job_item_id uuid, 
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

    -- لا نحدث الكمية يدوياً هنا أيضاً، نعتمد على التريجر عند إدراج حركة job_return
    
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
        'job_return',
        p_quantity,
        v_current_qty,
        v_current_qty + p_quantity,
        'job_item',
        p_job_item_id,
        'إرجاع للمخزون - إلغاء'
    );
END;
$$ LANGUAGE plpgsql;

-- 6. تحديث دالة الاسترجاع الرئيسية
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
        AND is_dispensed = true -- فقط إذا تم الصرف سابقاً
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
                    v_job_item.id,
                    v_component.component_id,
                    v_component.component_qty * v_job_item.quantity,
                    v_warehouse_id
                );
            END LOOP;
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            PERFORM restore_single_product(
                p_invoice_id,
                v_job_item.id,
                v_job_item.product_id,
                v_job_item.quantity,
                v_warehouse_id
            );
        END IF;

        -- إعادة الحالة لغير مصروف
        UPDATE job_items SET is_dispensed = false WHERE id = v_job_item.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
