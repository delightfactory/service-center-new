-- ============================================================
-- Fix: Payment trigger status type mismatch
-- Migration: 103_fix_payment_status_type.sql
-- Date: 2026-01-28
-- Issue: "column 'status' is of type invoice_status but expression is of type text"
-- ============================================================

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS trigger AS $$
DECLARE
    v_invoice record;
    v_new_paid numeric;
    v_new_status invoice_status; -- Fixed: use proper enum type instead of text
BEGIN
    IF NEW.invoice_id IS NOT NULL THEN
        SELECT total_amount, paid_amount INTO v_invoice
        FROM invoices WHERE id = NEW.invoice_id;

        v_new_paid := COALESCE(v_invoice.paid_amount, 0) + NEW.amount;

        -- تحديد الحالة الجديدة
        IF v_new_paid >= v_invoice.total_amount THEN
            v_new_status := 'paid'::invoice_status;
        ELSIF v_new_paid > 0 THEN
            v_new_status := 'partial'::invoice_status;
        ELSE
            v_new_status := 'approved'::invoice_status;
        END IF;

        UPDATE invoices SET 
            paid_amount = v_new_paid,
            status = v_new_status,
            updated_at = now()
        WHERE id = NEW.invoice_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the revert_payment_on_delete function
CREATE OR REPLACE FUNCTION revert_payment_on_delete()
RETURNS trigger AS $$
BEGIN
    -- إعادة المبلغ للفاتورة
    IF OLD.invoice_id IS NOT NULL THEN
        UPDATE invoices SET 
            paid_amount = GREATEST(0, paid_amount - OLD.amount),
            status = CASE 
                WHEN paid_amount - OLD.amount <= 0 THEN 'approved'::invoice_status
                ELSE 'partial'::invoice_status
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DONE - Fixed status type from text to invoice_status enum
-- ============================================================
