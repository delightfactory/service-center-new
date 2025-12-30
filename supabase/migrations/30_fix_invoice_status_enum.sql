-- ============================================================
-- Migration: Fix Invoice Status Enum in Payment Trigger
-- Version: 30
-- Description: Fix type mismatch - cast text to invoice_status enum
--              Also remove remaining_amount (GENERATED column)
-- ============================================================

-- Recreate the function with proper enum casting
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS trigger AS $$
DECLARE
    v_invoice record;
    v_new_paid numeric;
    v_new_status invoice_status;
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
        
        -- لا نحدث remaining_amount لأنه عمود GENERATED محسوب تلقائياً
        UPDATE invoices SET 
            paid_amount = v_new_paid,
            status = v_new_status,
            updated_at = now()
        WHERE id = NEW.invoice_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Trigger already exists, just updating the function

-- ============================================================
-- DONE
-- ============================================================
