-- ============================================================
-- إصلاح الفجوات في المنطق التجاري والمالي
-- Migration: 26_fix_business_logic_gaps.sql
-- الإصدار: 1.1
-- التاريخ: 2024-12-27
-- ============================================================
-- يتطلب: 20_inventory_reservation.sql, 21_fix_payment_flow.sql, 22_fix_flow_gaps.sql
-- ============================================================
-- ⚠️ هذا الملف يستبدل/يحسن Triggers موجودة في:
--    - 05_finance.sql (تحديث أرصدة العملاء والموردين والفواتير)
--    - 22_fix_flow_gaps.sql (عكس تأثير حذف الدفعة)
-- ============================================================

-- ============================================================
-- 1. تحسين reserve_single_product مع التحقق من كفاية المخزون
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
    v_available numeric;
BEGIN
    -- التحقق من وجود سجل المخزون وإنشائه إذا لم يكن موجوداً
    INSERT INTO inventory_items (product_id, warehouse_id, quantity, reserved_quantity)
    VALUES (p_product_id, p_warehouse_id, 0, 0)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    -- الحصول على الكميات الحالية مع القفل لمنع Race Condition
    SELECT quantity, reserved_quantity 
    INTO v_current_qty, v_current_reserved
    FROM inventory_items 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    -- حساب الكمية المتاحة
    v_available := v_current_qty - v_current_reserved;

    -- التحقق من كفاية المخزون (تحذير وليس خطأ للمرونة)
    IF v_available < p_quantity THEN
        RAISE WARNING 'الكمية المتاحة (%) أقل من المطلوب (%) للمنتج %', 
            v_available, p_quantity, p_product_id;
        -- نستمر في الحجز مع التحذير
    END IF;

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
-- 2. Trigger لتحديث الحجز عند تغيير كمية البند
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_item_quantity_update()
RETURNS trigger AS $$
DECLARE
    v_product record;
    v_component record;
    v_warehouse_id uuid;
BEGIN
    -- فقط إذا تغيرت الكمية ولم يكن البند ملغياً
    IF NEW.quantity != OLD.quantity 
       AND NEW.product_id IS NOT NULL 
       AND NEW.is_cancelled = false 
       AND OLD.is_cancelled = false THEN
        
        SELECT * INTO v_product FROM products WHERE id = NEW.product_id;
        v_warehouse_id := COALESCE(NEW.warehouse_id, (SELECT id FROM warehouses WHERE is_default = true LIMIT 1));
        
        -- التعامل مع الخدمات المركبة
        IF v_product.product_type = 'service' AND v_product.is_composite = true THEN
            FOR v_component IN 
                SELECT sc.component_id, sc.quantity as component_qty
                FROM service_components sc
                JOIN products p ON p.id = sc.component_id
                WHERE sc.service_id = NEW.product_id
                AND p.is_trackable = true
            LOOP
                -- تحرير الكمية القديمة
                PERFORM release_single_product(
                    OLD.id,
                    v_component.component_id,
                    v_component.component_qty * OLD.quantity,
                    v_warehouse_id
                );
                -- حجز الكمية الجديدة
                PERFORM reserve_single_product(
                    NEW.id,
                    v_component.component_id,
                    v_component.component_qty * NEW.quantity,
                    v_warehouse_id
                );
            END LOOP;
        ELSIF v_product.product_type IN ('part', 'consumable') AND v_product.is_trackable = true THEN
            -- تحرير الكمية القديمة
            PERFORM release_single_product(OLD.id, OLD.product_id, OLD.quantity, v_warehouse_id);
            -- حجز الكمية الجديدة
            PERFORM reserve_single_product(NEW.id, NEW.product_id, NEW.quantity, v_warehouse_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_item_qty_update ON job_items;
CREATE TRIGGER trg_job_item_qty_update
    AFTER UPDATE OF quantity ON job_items
    FOR EACH ROW 
    WHEN (NEW.quantity != OLD.quantity)
    EXECUTE FUNCTION on_job_item_quantity_update();

-- ============================================================
-- 3. Trigger لعكس تأثير حذف الدفعة (يستبدل 22_fix_flow_gaps.sql)
-- ============================================================
-- ⚠️ نحذف الـ trigger القديم من 22_fix_flow_gaps.sql ونستبدله بهذا
DROP TRIGGER IF EXISTS trg_payment_revert_on_delete ON payments;

CREATE OR REPLACE FUNCTION revert_payment_on_delete()
RETURNS trigger AS $$
BEGIN
    -- إعادة المبلغ للفاتورة
    IF OLD.invoice_id IS NOT NULL THEN
        UPDATE invoices SET 
            paid_amount = GREATEST(0, paid_amount - OLD.amount),
            remaining_amount = remaining_amount + OLD.amount,
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
-- 4. تحسين التحقق من المدفوعات قبل إلغاء الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION validate_invoice_cancellation()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial') THEN
        -- التحقق من عدم وجود مدفوعات
        IF EXISTS (SELECT 1 FROM payments WHERE invoice_id = NEW.id) THEN
            RAISE EXCEPTION 'لا يمكن إلغاء فاتورة بها مدفوعات. يجب حذف المدفوعات أولاً.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_invoice_cancel ON invoices;
CREATE TRIGGER trg_validate_invoice_cancel
    BEFORE UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled')
    EXECUTE FUNCTION validate_invoice_cancellation();

-- ============================================================
-- 5. التحقق من رصيد الخزينة قبل الصرف
-- ============================================================
CREATE OR REPLACE FUNCTION validate_treasury_balance_before_payment()
RETURNS trigger AS $$
DECLARE
    v_treasury_balance numeric;
BEGIN
    -- التحقق فقط لعمليات الصرف
    IF NEW.payment_type IN ('supplier_payment', 'refund_to_customer') THEN
        SELECT balance INTO v_treasury_balance 
        FROM treasuries 
        WHERE id = NEW.treasury_id;
        
        IF v_treasury_balance IS NULL THEN
            RAISE EXCEPTION 'الخزينة غير موجودة';
        END IF;
        
        IF v_treasury_balance < NEW.amount THEN
            RAISE EXCEPTION 'رصيد الخزينة غير كافٍ. المتاح: % والمطلوب: %', 
                v_treasury_balance, NEW.amount;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_treasury_balance ON payments;
CREATE TRIGGER trg_validate_treasury_balance
    BEFORE INSERT ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION validate_treasury_balance_before_payment();

-- ============================================================
-- 6. تحسين release_single_product مع FOR UPDATE
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
    -- القفل لمنع Race Condition
    SELECT quantity, reserved_quantity 
    INTO v_current_qty, v_current_reserved
    FROM inventory_items 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

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
-- 7. Function لتحديث رصيد العميل عند الدفع
-- ============================================================
-- ⚠️ يستبدل update_customer_balance_after_payment من 05_finance.sql
DROP TRIGGER IF EXISTS on_payment_update_customer ON payments;

CREATE OR REPLACE FUNCTION update_customer_balance_on_payment()
RETURNS trigger AS $$
BEGIN
    -- تحصيل من عميل
    IF NEW.payment_type = 'customer_receipt' AND NEW.customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = balance - NEW.amount,
            updated_at = now()
        WHERE id = NEW.customer_id;
    -- دفعة مقدمة (عربون)
    ELSIF NEW.payment_type = 'advance_payment' AND NEW.customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = balance - NEW.amount,
            updated_at = now()
        WHERE id = NEW.customer_id;
    -- مرتجع للعميل
    ELSIF NEW.payment_type = 'refund_to_customer' AND NEW.customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = balance + NEW.amount,
            updated_at = now()
        WHERE id = NEW.customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_update_customer ON payments;
CREATE TRIGGER trg_payment_update_customer
    AFTER INSERT ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION update_customer_balance_on_payment();

-- ============================================================
-- 8. Function لتحديث رصيد المورد عند الدفع
-- ============================================================
-- ⚠️ يستبدل update_supplier_balance_after_payment من 05_finance.sql
DROP TRIGGER IF EXISTS on_payment_update_supplier ON payments;

CREATE OR REPLACE FUNCTION update_supplier_balance_on_payment()
RETURNS trigger AS $$
BEGIN
    -- سداد لمورد
    IF NEW.payment_type = 'supplier_payment' AND NEW.supplier_id IS NOT NULL THEN
        UPDATE suppliers 
        SET balance = balance - NEW.amount,
            updated_at = now()
        WHERE id = NEW.supplier_id;
    -- مرتجع من مورد
    ELSIF NEW.payment_type = 'refund_from_supplier' AND NEW.supplier_id IS NOT NULL THEN
        UPDATE suppliers 
        SET balance = balance + NEW.amount,
            updated_at = now()
        WHERE id = NEW.supplier_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_update_supplier ON payments;
CREATE TRIGGER trg_payment_update_supplier
    AFTER INSERT ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION update_supplier_balance_on_payment();

-- ============================================================
-- 9. تحديث paid_amount و remaining_amount و status للفاتورة
-- ============================================================
-- ⚠️ يستبدل on_payment_created من 05_finance.sql
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
            remaining_amount = v_invoice.total_amount - v_new_paid,
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
-- ✅ تم إصلاح الفجوات الحرجة:
-- 1. التحقق من كفاية المخزون مع FOR UPDATE
-- 2. Trigger لتحديث الحجز عند تغيير الكمية
-- 3. Trigger لعكس تأثير حذف الدفعة
-- 4. التحقق من المدفوعات قبل إلغاء الفاتورة
-- 5. التحقق من رصيد الخزينة قبل الصرف
-- 6. FOR UPDATE لمنع Race Condition في release
-- 7-9. إدارة أرصدة العملاء والموردين والفواتير
-- ============================================================

COMMENT ON FUNCTION reserve_single_product IS 'حجز منتج واحد مع التحقق والقفل';
COMMENT ON FUNCTION on_job_item_quantity_update IS 'تحديث الحجز عند تغيير كمية البند';
COMMENT ON FUNCTION revert_payment_on_delete IS 'عكس تأثير الدفعة عند الحذف';
COMMENT ON FUNCTION validate_invoice_cancellation IS 'التحقق من عدم وجود مدفوعات قبل الإلغاء';
COMMENT ON FUNCTION validate_treasury_balance_before_payment IS 'التحقق من رصيد الخزينة قبل الصرف';
COMMENT ON FUNCTION update_invoice_on_payment IS 'تحديث الفاتورة عند الدفع';
