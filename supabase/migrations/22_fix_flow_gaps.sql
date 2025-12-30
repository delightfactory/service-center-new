-- ============================================================
-- إصلاح الفجوات في التدفقات المالية والمخزنية
-- الإصدار: 1.0
-- التاريخ: 2024-12-27
-- ============================================================
-- يتطلب: 20_inventory_reservation.sql, 21_fix_payment_flow.sql
-- ============================================================

-- ============================================================
-- 1. Trigger: عكس تأثير الدفعة عند الحذف
-- ============================================================
CREATE OR REPLACE FUNCTION revert_payment_on_delete()
RETURNS trigger AS $$
BEGIN
    -- إرجاع المبلغ للفاتورة
    IF OLD.invoice_id IS NOT NULL THEN
        UPDATE invoices SET 
            paid_amount = GREATEST(0, paid_amount - OLD.amount),
            status = CASE 
                WHEN paid_amount - OLD.amount <= 0 THEN 'approved'::invoice_status
                WHEN paid_amount - OLD.amount < total_amount THEN 'partial'::invoice_status
                ELSE status
            END,
            updated_at = now()
        WHERE id = OLD.invoice_id;
    END IF;
    
    -- إرجاع رصيد العميل
    IF OLD.customer_id IS NOT NULL THEN
        IF OLD.payment_type = 'customer_receipt' OR OLD.payment_type = 'advance_payment' THEN
            UPDATE customers SET balance = balance + OLD.amount WHERE id = OLD.customer_id;
        ELSIF OLD.payment_type = 'refund_to_customer' THEN
            UPDATE customers SET balance = balance - OLD.amount WHERE id = OLD.customer_id;
        END IF;
    END IF;
    
    -- إرجاع رصيد المورد
    IF OLD.supplier_id IS NOT NULL THEN
        IF OLD.payment_type = 'supplier_payment' THEN
            UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.supplier_id;
        ELSIF OLD.payment_type = 'refund_from_supplier' THEN
            UPDATE suppliers SET balance = balance - OLD.amount WHERE id = OLD.supplier_id;
        END IF;
    END IF;
    
    -- إنشاء حركة عكسية للخزينة
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

DROP TRIGGER IF EXISTS trg_payment_revert_on_delete ON payments;
CREATE TRIGGER trg_payment_revert_on_delete
    BEFORE DELETE ON payments
    FOR EACH ROW 
    EXECUTE FUNCTION revert_payment_on_delete();

-- ============================================================
-- 2. Trigger: تحديث الحجز عند تعديل كمية job_item
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_item_quantity_update()
RETURNS trigger AS $$
DECLARE
    v_diff numeric;
BEGIN
    -- فقط إذا تغيرت الكمية والمنتج له حجز
    IF NEW.quantity != OLD.quantity AND NEW.product_id IS NOT NULL THEN
        v_diff := NEW.quantity - OLD.quantity;
        
        IF v_diff > 0 THEN
            -- زيادة الكمية = حجز إضافي
            PERFORM reserve_inventory_for_job_item(
                NEW.id,
                NEW.product_id,
                v_diff,
                NEW.warehouse_id
            );
        ELSE
            -- نقص الكمية = تحرير جزء من الحجز
            PERFORM release_inventory_for_job_item(
                NEW.id,
                NEW.product_id,
                ABS(v_diff),
                NEW.warehouse_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_item_quantity_update ON job_items;
CREATE TRIGGER trg_job_item_quantity_update
    AFTER UPDATE OF quantity ON job_items
    FOR EACH ROW 
    WHEN (NEW.quantity != OLD.quantity AND NEW.product_id IS NOT NULL)
    EXECUTE FUNCTION on_job_item_quantity_update();

-- ============================================================
-- 3. Trigger: تحديث الحجز عند تغيير product_id
-- ============================================================
CREATE OR REPLACE FUNCTION on_job_item_product_change()
RETURNS trigger AS $$
BEGIN
    -- تحرير الحجز القديم
    IF OLD.product_id IS NOT NULL THEN
        PERFORM release_inventory_for_job_item(
            OLD.id,
            OLD.product_id,
            OLD.quantity,
            OLD.warehouse_id
        );
    END IF;
    
    -- إنشاء حجز جديد
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

DROP TRIGGER IF EXISTS trg_job_item_product_change ON job_items;
CREATE TRIGGER trg_job_item_product_change
    AFTER UPDATE OF product_id ON job_items
    FOR EACH ROW 
    WHEN (OLD.product_id IS DISTINCT FROM NEW.product_id)
    EXECUTE FUNCTION on_job_item_product_change();

-- ============================================================
-- 4. Trigger: خصم من الخزينة عند اعتماد المصروف
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_treasury_on_expense_approved()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.treasury_id IS NOT NULL THEN
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
            'expense'::treasury_tx_type,
            NEW.amount,
            'expense',
            NEW.id,
            CASE WHEN NEW.supplier_id IS NOT NULL THEN 'supplier' ELSE NULL END,
            NEW.supplier_id,
            'مصروف: ' || NEW.description,
            NEW.branch_id,
            NEW.approved_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expense_approved_deduct ON expenses;
CREATE TRIGGER trg_expense_approved_deduct
    AFTER UPDATE OF status ON expenses
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
    EXECUTE FUNCTION deduct_treasury_on_expense_approved();

-- ============================================================
-- 5. Trigger: إنشاء حركات للتحويلات بين الخزن
-- ============================================================
CREATE OR REPLACE FUNCTION execute_treasury_transfer()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- سحب من الخزينة المصدر
        INSERT INTO treasury_transactions (
            treasury_id,
            transaction_type,
            amount,
            reference_type,
            reference_id,
            description,
            branch_id,
            created_by
        )
        VALUES (
            NEW.from_treasury_id,
            'transfer_out'::treasury_tx_type,
            NEW.amount,
            'transfer',
            NEW.id,
            'تحويل إلى خزينة أخرى',
            NEW.branch_id,
            NEW.approved_by
        );
        
        -- إيداع في الخزينة الهدف
        INSERT INTO treasury_transactions (
            treasury_id,
            transaction_type,
            amount,
            reference_type,
            reference_id,
            description,
            branch_id,
            created_by
        )
        VALUES (
            NEW.to_treasury_id,
            'transfer_in'::treasury_tx_type,
            NEW.amount,
            'transfer',
            NEW.id,
            'تحويل من خزينة أخرى',
            NEW.branch_id,
            NEW.approved_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_treasury_transfer_execute ON treasury_transfers;
CREATE TRIGGER trg_treasury_transfer_execute
    AFTER UPDATE OF status ON treasury_transfers
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
    EXECUTE FUNCTION execute_treasury_transfer();

-- ============================================================
-- 6. Trigger: تطبيق الإشعارات الدائنة/المدينة
-- ============================================================
CREATE OR REPLACE FUNCTION apply_credit_debit_note()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- إشعار دائن = تخفيض مديونية العميل
        IF NEW.note_type = 'credit' AND NEW.customer_id IS NOT NULL THEN
            UPDATE customers 
            SET balance = balance - NEW.amount,
                updated_at = now()
            WHERE id = NEW.customer_id;
        -- إشعار مدين = زيادة مديونية العميل
        ELSIF NEW.note_type = 'debit' AND NEW.customer_id IS NOT NULL THEN
            UPDATE customers 
            SET balance = balance + NEW.amount,
                updated_at = now()
            WHERE id = NEW.customer_id;
        END IF;
        
        -- تحديث الفاتورة المرتبطة إذا وجدت
        IF NEW.applied_to_invoice_id IS NOT NULL THEN
            IF NEW.note_type = 'credit' THEN
                UPDATE invoices 
                SET paid_amount = paid_amount + NEW.amount,
                    has_credit_notes = true,
                    status = CASE 
                        WHEN paid_amount + NEW.amount >= total_amount THEN 'paid'::invoice_status
                        ELSE 'partial'::invoice_status
                    END,
                    updated_at = now()
                WHERE id = NEW.applied_to_invoice_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_debit_note_apply ON credit_debit_notes;
CREATE TRIGGER trg_credit_debit_note_apply
    AFTER UPDATE OF status ON credit_debit_notes
    FOR EACH ROW 
    WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
    EXECUTE FUNCTION apply_credit_debit_note();

-- ============================================================
-- 7. إضافة أنواع حركات الخزينة الناقصة
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expense' AND enumtypid = 'treasury_tx_type'::regtype) THEN
        ALTER TYPE treasury_tx_type ADD VALUE IF NOT EXISTS 'expense';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'transfer_out' AND enumtypid = 'treasury_tx_type'::regtype) THEN
        ALTER TYPE treasury_tx_type ADD VALUE IF NOT EXISTS 'transfer_out';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'transfer_in' AND enumtypid = 'treasury_tx_type'::regtype) THEN
        ALTER TYPE treasury_tx_type ADD VALUE IF NOT EXISTS 'transfer_in';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- ✅ تم إصلاح جميع الفجوات
-- ============================================================
COMMENT ON FUNCTION revert_payment_on_delete IS 'عكس تأثير الدفعة عند حذفها';
COMMENT ON FUNCTION on_job_item_quantity_update IS 'تحديث الحجز عند تعديل كمية البند';
COMMENT ON FUNCTION on_job_item_product_change IS 'تحديث الحجز عند تغيير المنتج';
COMMENT ON FUNCTION deduct_treasury_on_expense_approved IS 'خصم من الخزينة عند اعتماد المصروف';
COMMENT ON FUNCTION execute_treasury_transfer IS 'تنفيذ التحويل بين الخزن';
COMMENT ON FUNCTION apply_credit_debit_note IS 'تطبيق الإشعارات الدائنة/المدينة';
