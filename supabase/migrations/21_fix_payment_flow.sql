-- ============================================================
-- إصلاح تدفق الدفعات وربطها بالخزينة
-- الإصدار: 1.0
-- التاريخ: 2024-12-26
-- ============================================================
-- يتطلب: 05_finance.sql
-- ============================================================

-- ============================================================
-- 1. Trigger: إنشاء treasury_transaction تلقائياً عند إنشاء payment
-- ============================================================
CREATE OR REPLACE FUNCTION create_treasury_transaction_for_payment()
RETURNS trigger AS $$
DECLARE
    v_tx_type treasury_tx_type;
    v_party_type text;
    v_party_id uuid;
    v_description text;
BEGIN
    -- تحديد نوع الحركة
    v_tx_type := CASE NEW.payment_type
        WHEN 'customer_receipt' THEN 'customer_receipt'::treasury_tx_type
        WHEN 'advance_payment' THEN 'customer_receipt'::treasury_tx_type
        WHEN 'supplier_payment' THEN 'supplier_payment'::treasury_tx_type
        WHEN 'refund_to_customer' THEN 'withdrawal'::treasury_tx_type
        WHEN 'refund_from_supplier' THEN 'deposit'::treasury_tx_type
    END;

    -- تحديد الطرف
    IF NEW.customer_id IS NOT NULL THEN
        v_party_type := 'customer';
        v_party_id := NEW.customer_id;
    ELSIF NEW.supplier_id IS NOT NULL THEN
        v_party_type := 'supplier';
        v_party_id := NEW.supplier_id;
    END IF;

    -- الوصف
    v_description := CASE NEW.payment_type
        WHEN 'customer_receipt' THEN 'تحصيل من عميل'
        WHEN 'advance_payment' THEN 'دفعة مقدمة (عربون)'
        WHEN 'supplier_payment' THEN 'سداد لمورد'
        WHEN 'refund_to_customer' THEN 'مرتجع للعميل'
        WHEN 'refund_from_supplier' THEN 'مرتجع من مورد'
    END || COALESCE(' - ' || NEW.reference, '');

    -- إنشاء حركة الخزينة
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
        NEW.treasury_id,
        v_tx_type,
        NEW.amount,
        'payment',
        NEW.id,
        v_party_type,
        v_party_id,
        v_description,
        NEW.branch_id,
        NEW.created_by
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_create_treasury_tx ON payments;
CREATE TRIGGER trg_payment_create_treasury_tx
    AFTER INSERT ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION create_treasury_transaction_for_payment();

-- ============================================================
-- 2. Function: تحديث رصيد العميل عند اعتماد الفاتورة
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_balance_on_invoice_approved()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'draft' AND NEW.customer_id IS NOT NULL THEN
        -- زيادة مديونية العميل (رصيد مدين)
        IF NEW.invoice_type = 'sales' THEN
            UPDATE customers 
            SET balance = balance + NEW.total_amount,
                updated_at = now()
            WHERE id = NEW.customer_id;
        -- مرتجع المبيعات يقلل المديونية
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

DROP TRIGGER IF EXISTS trg_invoice_update_customer_balance ON invoices;
CREATE TRIGGER trg_invoice_update_customer_balance
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND OLD.status = 'draft')
    EXECUTE FUNCTION update_customer_balance_on_invoice_approved();

-- ============================================================
-- 3. Function: تحديث رصيد المورد عند اعتماد فاتورة المشتريات
-- ============================================================
CREATE OR REPLACE FUNCTION update_supplier_balance_on_invoice_approved()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'draft' AND NEW.supplier_id IS NOT NULL THEN
        -- زيادة مستحقات المورد
        IF NEW.invoice_type = 'purchase' THEN
            UPDATE suppliers 
            SET balance = balance + NEW.total_amount,
                updated_at = now()
            WHERE id = NEW.supplier_id;
        -- مرتجع المشتريات يقلل المستحقات
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

DROP TRIGGER IF EXISTS trg_invoice_update_supplier_balance ON invoices;
CREATE TRIGGER trg_invoice_update_supplier_balance
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND OLD.status = 'draft')
    EXECUTE FUNCTION update_supplier_balance_on_invoice_approved();

-- ============================================================
-- 4. Function: إلغاء تأثير الفاتورة على الأرصدة
-- ============================================================
CREATE OR REPLACE FUNCTION revert_balances_on_invoice_cancelled()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid', 'partial') THEN
        -- إلغاء تأثير فاتورة العميل
        IF NEW.customer_id IS NOT NULL THEN
            IF NEW.invoice_type = 'sales' THEN
                UPDATE customers 
                SET balance = balance - NEW.total_amount + NEW.paid_amount,
                    updated_at = now()
                WHERE id = NEW.customer_id;
            ELSIF NEW.invoice_type = 'sales_return' THEN
                UPDATE customers 
                SET balance = balance + NEW.total_amount,
                    updated_at = now()
                WHERE id = NEW.customer_id;
            END IF;
        END IF;
        
        -- إلغاء تأثير فاتورة المورد
        IF NEW.supplier_id IS NOT NULL THEN
            IF NEW.invoice_type = 'purchase' THEN
                UPDATE suppliers 
                SET balance = balance - NEW.total_amount + NEW.paid_amount,
                    updated_at = now()
                WHERE id = NEW.supplier_id;
            ELSIF NEW.invoice_type = 'purchase_return' THEN
                UPDATE suppliers 
                SET balance = balance + NEW.total_amount,
                    updated_at = now()
                WHERE id = NEW.supplier_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_cancelled_revert_balances ON invoices;
CREATE TRIGGER trg_invoice_cancelled_revert_balances
    AFTER UPDATE OF status ON invoices
    FOR EACH ROW 
    WHEN (NEW.status = 'cancelled')
    EXECUTE FUNCTION revert_balances_on_invoice_cancelled();

-- ============================================================
-- 5. تصحيح enum لـ invoice_status إذا كان 'partial' غير موجود
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'partial' AND enumtypid = 'invoice_status'::regtype) THEN
        -- 'partially_paid' موجود، نستخدمه بدلاً
        NULL;
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- ✅ تم إصلاح تدفق الدفعات
-- ============================================================
COMMENT ON FUNCTION create_treasury_transaction_for_payment IS 'إنشاء حركة خزينة تلقائياً مع كل دفعة';
COMMENT ON FUNCTION update_customer_balance_on_invoice_approved IS 'تحديث رصيد العميل عند اعتماد الفاتورة';
COMMENT ON FUNCTION update_supplier_balance_on_invoice_approved IS 'تحديث رصيد المورد عند اعتماد فاتورة الشراء';
COMMENT ON FUNCTION revert_balances_on_invoice_cancelled IS 'إلغاء تأثير الفاتورة على الأرصدة عند الإلغاء';
