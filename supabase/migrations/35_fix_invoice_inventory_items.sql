-- ============================================================
-- Migration: Invoice Items Inventory Fixes
-- Version: 35
-- Description:
--   1. Add inventory_tx_type values for sales/purchase returns
--   2. Apply inventory movements for invoice_items (non job_order invoices)
--   3. Reverse inventory on invoice cancellation
-- ============================================================

-- ============================================================
-- 1) Ensure enum values for returns
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sales_return' AND enumtypid = 'inventory_tx_type'::regtype) THEN
        ALTER TYPE inventory_tx_type ADD VALUE IF NOT EXISTS 'sales_return';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'purchase_return' AND enumtypid = 'inventory_tx_type'::regtype) THEN
        ALTER TYPE inventory_tx_type ADD VALUE IF NOT EXISTS 'purchase_return';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- 2) Update inventory balance trigger to treat sales_return as inbound
-- ============================================================
CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS trigger AS $$
DECLARE
    v_current_qty numeric(10,3);
    v_current_reserved numeric(10,3);
BEGIN
    -- لا تؤثر عمليات الحجز/تحرير الحجز على الكمية الفعلية
    IF NEW.transaction_type::text IN ('reservation', 'release_reservation') THEN
        IF NEW.balance_before IS NULL OR NEW.balance_after IS NULL THEN
            SELECT quantity, reserved_quantity
            INTO v_current_qty, v_current_reserved
            FROM inventory_items
            WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;

            NEW.balance_before := v_current_qty - COALESCE(v_current_reserved, 0);
            NEW.balance_after := NEW.balance_before;
        END IF;

        RETURN NEW;
    END IF;

    -- الحصول على الرصيد الحالي
    SELECT COALESCE(quantity, 0) INTO v_current_qty
    FROM inventory_items
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;

    -- تسجيل الرصيد قبل
    NEW.balance_before := v_current_qty;

    -- تحديث الرصيد
    IF NEW.transaction_type IN (
        'purchase',
        'transfer_in',
        'adjustment',
        'opening',
        'job_return',
        'sales_return'
    ) THEN
        -- إضافة
        INSERT INTO inventory_items (product_id, warehouse_id, quantity, last_updated)
        VALUES (NEW.product_id, NEW.warehouse_id, NEW.quantity, now())
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET
            quantity = inventory_items.quantity + NEW.quantity,
            last_updated = now();
    ELSE
        -- خصم
        UPDATE inventory_items
        SET quantity = quantity - NEW.quantity, last_updated = now()
        WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
    END IF;

    -- الحصول على الرصيد بعد
    SELECT quantity INTO NEW.balance_after
    FROM inventory_items
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_inventory_transaction ON inventory_transactions;
CREATE TRIGGER on_inventory_transaction
    BEFORE INSERT ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION update_inventory_balance();

-- ============================================================
-- 3) Apply inventory movements for invoice_items
-- ============================================================
CREATE OR REPLACE FUNCTION apply_inventory_for_invoice_items(
    p_invoice_id uuid,
    p_is_reversal boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
    v_invoice record;
    v_item record;
    v_warehouse_id uuid;
    v_tx_type inventory_tx_type;
BEGIN
    SELECT id, invoice_type, job_order_id
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- تجنب التكرار: فواتير أوامر الشغل (مبيعات/مرتجع مبيعات) لها خصم عبر job_items
    IF v_invoice.job_order_id IS NOT NULL AND v_invoice.invoice_type IN ('sales', 'sales_return') THEN
        RETURN;
    END IF;

    SELECT id INTO v_warehouse_id
    FROM warehouses
    WHERE is_default = true
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        RAISE WARNING 'No default warehouse for invoice %', p_invoice_id;
        RETURN;
    END IF;

    FOR v_item IN
        SELECT
            ii.product_id,
            ii.quantity,
            p.product_type,
            p.is_trackable
        FROM invoice_items ii
        JOIN products p ON p.id = ii.product_id
        WHERE ii.invoice_id = p_invoice_id
        AND ii.product_id IS NOT NULL
    LOOP
        IF v_item.is_trackable IS DISTINCT FROM true THEN
            CONTINUE;
        END IF;

        IF v_item.product_type = 'service' THEN
            CONTINUE;
        END IF;

        INSERT INTO inventory_items (product_id, warehouse_id, quantity, reserved_quantity)
        VALUES (v_item.product_id, v_warehouse_id, 0, 0)
        ON CONFLICT (product_id, warehouse_id) DO NOTHING;

        IF v_invoice.invoice_type = 'sales' THEN
            v_tx_type := CASE WHEN p_is_reversal THEN 'sales_return' ELSE 'sale' END;
        ELSIF v_invoice.invoice_type = 'sales_return' THEN
            v_tx_type := CASE WHEN p_is_reversal THEN 'sale' ELSE 'sales_return' END;
        ELSIF v_invoice.invoice_type = 'purchase' THEN
            v_tx_type := CASE WHEN p_is_reversal THEN 'purchase_return' ELSE 'purchase' END;
        ELSIF v_invoice.invoice_type = 'purchase_return' THEN
            v_tx_type := CASE WHEN p_is_reversal THEN 'purchase' ELSE 'purchase_return' END;
        ELSE
            CONTINUE;
        END IF;

        INSERT INTO inventory_transactions (
            product_id,
            warehouse_id,
            transaction_type,
            quantity,
            reference_type,
            reference_id,
            notes
        ) VALUES (
            v_item.product_id,
            v_warehouse_id,
            v_tx_type,
            v_item.quantity,
            'invoice',
            p_invoice_id,
            CASE WHEN p_is_reversal THEN 'عكس حركة مخزون للفاتورة' ELSE 'حركة مخزون للفاتورة' END
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_invoice_approved_apply_inventory_items()
RETURNS trigger AS $$
BEGIN
    PERFORM apply_inventory_for_invoice_items(NEW.id, false);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_approved_inventory_items ON invoices;
CREATE TRIGGER trg_invoice_approved_inventory_items
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status = 'draft')
    EXECUTE FUNCTION on_invoice_approved_apply_inventory_items();

CREATE OR REPLACE FUNCTION on_invoice_insert_apply_inventory_items()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' THEN
        PERFORM apply_inventory_for_invoice_items(NEW.id, false);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_insert_inventory_items ON invoices;
CREATE TRIGGER trg_invoice_insert_inventory_items
    AFTER INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.status = 'approved')
    EXECUTE FUNCTION on_invoice_insert_apply_inventory_items();

-- ============================================================
-- 4) Reverse inventory movements for invoice_items on cancellation
-- ============================================================
CREATE OR REPLACE FUNCTION on_invoice_cancelled_inventory_items()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial') THEN
        PERFORM apply_inventory_for_invoice_items(NEW.id, true);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_cancelled_inventory_items ON invoices;
CREATE TRIGGER trg_invoice_cancelled_inventory_items
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial'))
    EXECUTE FUNCTION on_invoice_cancelled_inventory_items();

-- ============================================================
-- DONE
-- ============================================================
COMMENT ON FUNCTION apply_inventory_for_invoice_items IS 'حركة مخزون لفواتير غير مرتبطة بأمر شغل بناءً على invoice_items';
COMMENT ON FUNCTION on_invoice_approved_apply_inventory_items IS 'تشغيل حركة المخزون عند اعتماد الفاتورة';
COMMENT ON FUNCTION on_invoice_cancelled_inventory_items IS 'عكس حركة المخزون عند إلغاء الفاتورة';
