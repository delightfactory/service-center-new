-- ============================================================
-- ملف إصلاحات موحد (Post-Run Fixes)
-- التاريخ: 2026-01-26
-- الهدف: تجميع الإصلاحات التي تمت على ميجريشنات تم تشغيلها سابقًا
-- ملاحظة: هذا الملف آمن لإعادة التشغيل (Idempotent)
-- ============================================================

-- ============================================================
-- 1) ملاحظة: لا نقوم بإنشاء Trigger تلقائي للـ profiles
--    الاعتماد الحالي على Edge Function (admin-create-user)
--    لتجنب ازدواج إدراج الـ profiles.
-- ============================================================

-- ============================================================
-- 2) التأكد من قيم enum الخاصة بحجز المخزون
-- ============================================================
DO $$ BEGIN
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
-- 3) منع تحديث الكمية الفعلية عند حركات الحجز/تحرير الحجز
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
    IF NEW.transaction_type IN ('purchase', 'transfer_in', 'adjustment', 'opening', 'job_return') THEN
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
-- 4) خصم المخزون النهائي بدون تعديل الكمية يدويًا
--    + استخدام job_return عند إلغاء الفاتورة
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

    -- تحرير الحجز فقط (تحديث الكمية يتم عبر trigger حركة المخزون)
    UPDATE inventory_items 
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
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
        'invoice',
        p_invoice_id,
        'إرجاع للمخزون - إلغاء فاتورة'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5) عكس الدفعة بدون تعديل remaining_amount (Generated Column)
-- ============================================================
CREATE OR REPLACE FUNCTION revert_payment_on_delete()
RETURNS trigger AS $$
BEGIN
    -- إعادة المبلغ للفاتورة
    IF OLD.invoice_id IS NOT NULL THEN
        UPDATE invoices SET 
            paid_amount = GREATEST(0, paid_amount - OLD.amount),
            status = CASE 
                WHEN paid_amount - OLD.amount <= 0 THEN 'approved'
                ELSE 'partial'
            END,
            updated_at = now()
        WHERE id = OLD.invoice_id;
    END IF;

    -- إعادة رصيد العميل (التحصيل يقلل الرصيد، الحذف يزيده)
    IF OLD.customer_id IS NOT NULL THEN
        IF OLD.payment_type IN ('customer_receipt', 'advance_payment') THEN
            UPDATE customers 
            SET balance = balance + OLD.amount,
                updated_at = now()
            WHERE id = OLD.customer_id;
        ELSIF OLD.payment_type = 'refund_to_customer' THEN
            UPDATE customers 
            SET balance = balance - OLD.amount,
                updated_at = now()
            WHERE id = OLD.customer_id;
        END IF;
    END IF;

    -- إعادة رصيد المورد
    IF OLD.supplier_id IS NOT NULL THEN
        IF OLD.payment_type = 'supplier_payment' THEN
            UPDATE suppliers 
            SET balance = balance + OLD.amount,
                updated_at = now()
            WHERE id = OLD.supplier_id;
        ELSIF OLD.payment_type = 'refund_from_supplier' THEN
            UPDATE suppliers 
            SET balance = balance - OLD.amount,
                updated_at = now()
            WHERE id = OLD.supplier_id;
        END IF;
    END IF;

    -- إنشاء حركة عكسية للخزينة (بدلاً من الحذف - للحفاظ على السجل)
    IF OLD.treasury_id IS NOT NULL THEN
        INSERT INTO treasury_transactions (
            treasury_id,
            transaction_type,
            amount,
            reference_type,
            reference_id,
            party_type,
            party_id,
            description,
            branch_id,
            created_by
        )
        VALUES (
            OLD.treasury_id,
            CASE 
                WHEN OLD.payment_type IN ('customer_receipt', 'advance_payment', 'refund_from_supplier') 
                THEN 'withdrawal'::treasury_tx_type
                ELSE 'deposit'::treasury_tx_type
            END,
            OLD.amount,
            'payment_reversal',
            OLD.id,
            CASE WHEN OLD.customer_id IS NOT NULL THEN 'customer' ELSE 'supplier' END,
            COALESCE(OLD.customer_id, OLD.supplier_id),
            'عكس دفعة - حذف سند ' || OLD.code,
            OLD.branch_id,
            OLD.created_by
        );
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_delete_revert ON payments;
CREATE TRIGGER trg_payment_delete_revert
    BEFORE DELETE ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION revert_payment_on_delete();

-- ============================================================
-- 6) تحديث الفاتورة عند الدفع بدون تعديل remaining_amount
-- ============================================================
DROP TRIGGER IF EXISTS on_payment_created ON payments;

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS trigger AS $$
DECLARE
    v_invoice record;
    v_new_paid numeric;
    v_new_status text;
BEGIN
    IF NEW.invoice_id IS NOT NULL THEN
        SELECT total_amount, paid_amount INTO v_invoice
        FROM invoices WHERE id = NEW.invoice_id;

        v_new_paid := COALESCE(v_invoice.paid_amount, 0) + NEW.amount;

        -- تحديد الحالة الجديدة
        IF v_new_paid >= v_invoice.total_amount THEN
            v_new_status := 'paid';
        ELSIF v_new_paid > 0 THEN
            v_new_status := 'partial';
        ELSE
            v_new_status := 'approved';
        END IF;

        UPDATE invoices SET 
            paid_amount = v_new_paid,
            status = v_new_status,
            updated_at = now()
        WHERE id = NEW.invoice_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_update_invoice ON payments;
CREATE TRIGGER trg_payment_update_invoice
    AFTER INSERT ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION update_invoice_on_payment();

-- ============================================================
-- 7) تصحيح ملخص المالية للفترة (استخدام amount بالمصروفات)
-- ============================================================
CREATE OR REPLACE FUNCTION get_finance_period_summary(
    p_branch_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start DATE := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::date);
    v_end DATE := COALESCE(p_end_date, CURRENT_DATE);
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'period', json_build_object(
            'start_date', v_start,
            'end_date', v_end
        ),
        'revenue', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM invoices
            WHERE invoice_type = 'sales'
                AND status IN ('approved', 'paid', 'partial')
                AND created_at::date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'expenses', (
            SELECT COALESCE(SUM(amount), 0)
            FROM expenses
            WHERE status IN ('approved', 'paid')
                AND expense_date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'purchases', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM invoices
            WHERE invoice_type = 'purchase'
                AND status IN ('approved', 'paid', 'partial')
                AND created_at::date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'collections', (
            SELECT COALESCE(SUM(amount), 0)
            FROM payments
            WHERE payment_type = 'customer_receipt'
                AND payment_date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'payouts', (
            SELECT COALESCE(SUM(amount), 0)
            FROM payments
            WHERE payment_type = 'supplier_payment'
                AND payment_date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'receivables', (
            SELECT COALESCE(SUM(balance), 0)
            FROM customers
            WHERE balance > 0
        ),
        'payables', (
            SELECT COALESCE(SUM(balance), 0)
            FROM suppliers
            WHERE balance > 0
        ),
        'treasury_balance', (
            SELECT COALESCE(SUM(balance), 0)
            FROM treasuries
            WHERE is_active = true
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ============================================================
-- ✅ نهاية ملف الإصلاحات الموحد
-- ============================================================
