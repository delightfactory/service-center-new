-- ============================================================
-- إصلاح خصم المصروفات من الخزينة
-- Migration: 28_fix_expense_treasury.sql
-- التاريخ: 2024-12-28
-- ============================================================
-- المشكلة: الـ trigger الحالي يعمل فقط عند UPDATE من pending → approved
-- الحل: trigger جديد يعمل على INSERT و UPDATE
-- ============================================================

-- ============================================================
-- 1. حذف الـ trigger القديم
-- ============================================================
DROP TRIGGER IF EXISTS trg_expense_approved_deduct ON expenses;

-- ============================================================
-- 2. Function جديدة لخصم المصروف من الخزينة
-- ============================================================
CREATE OR REPLACE FUNCTION handle_expense_treasury_transaction()
RETURNS trigger AS $$
DECLARE
    v_should_create_transaction BOOLEAN := false;
    v_transaction_exists BOOLEAN := false;
BEGIN
    -- التحقق من وجود حركة خزينة مسبقة
    SELECT EXISTS (
        SELECT 1 FROM treasury_transactions 
        WHERE reference_type = 'expense' 
        AND reference_id = NEW.id
    ) INTO v_transaction_exists;
    
    -- حالة INSERT: إنشاء حركة إذا كانت الحالة approved أو paid
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('approved', 'paid') AND NEW.treasury_id IS NOT NULL THEN
            v_should_create_transaction := true;
        END IF;
    
    -- حالة UPDATE: إنشاء حركة إذا تغيرت الحالة إلى approved أو paid
    ELSIF TG_OP = 'UPDATE' THEN
        -- فقط إذا لم تكن هناك حركة مسبقة
        IF NOT v_transaction_exists THEN
            IF NEW.status IN ('approved', 'paid') 
               AND OLD.status NOT IN ('approved', 'paid')
               AND NEW.treasury_id IS NOT NULL THEN
                v_should_create_transaction := true;
            END IF;
        END IF;
        
        -- إذا كان هناك تغيير في الخزينة فقط (نادر)
        IF NEW.treasury_id IS DISTINCT FROM OLD.treasury_id 
           AND NEW.treasury_id IS NOT NULL
           AND NEW.status IN ('approved', 'paid')
           AND NOT v_transaction_exists THEN
            v_should_create_transaction := true;
        END IF;
    END IF;
    
    -- إنشاء حركة الخزينة
    IF v_should_create_transaction THEN
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
            'مصروف: ' || COALESCE(NEW.description, ''),
            NEW.branch_id,
            COALESCE(NEW.approved_by, NEW.created_by)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Trigger على INSERT و UPDATE
-- ============================================================
CREATE TRIGGER trg_expense_treasury
    AFTER INSERT OR UPDATE OF status, treasury_id ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION handle_expense_treasury_transaction();

-- ============================================================
-- 4. Function لعكس حركة الخزينة عند إلغاء المصروف
-- ============================================================
CREATE OR REPLACE FUNCTION revert_expense_on_cancel()
RETURNS trigger AS $$
BEGIN
    -- إذا تم إلغاء المصروف وكان معتمداً أو مدفوعاً
    IF NEW.status = 'cancelled' 
       AND OLD.status IN ('approved', 'paid') 
       AND OLD.treasury_id IS NOT NULL THEN
        
        -- إنشاء حركة عكسية
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
            OLD.treasury_id,
            'deposit'::treasury_tx_type,
            OLD.amount,
            'expense_reversal',
            OLD.id,
            'عكس مصروف ملغي: ' || COALESCE(OLD.description, ''),
            OLD.branch_id,
            NEW.approved_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expense_cancel_revert ON expenses;
CREATE TRIGGER trg_expense_cancel_revert
    AFTER UPDATE OF status ON expenses
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.status IN ('approved', 'paid'))
    EXECUTE FUNCTION revert_expense_on_cancel();

-- ============================================================
-- 5. التأكد من وجود قيم expense و expense_reversal في enum
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expense' AND enumtypid = 'treasury_tx_type'::regtype) THEN
        ALTER TYPE treasury_tx_type ADD VALUE IF NOT EXISTS 'expense';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expense_reversal' AND enumtypid = 'treasury_tx_type'::regtype) THEN
        ALTER TYPE treasury_tx_type ADD VALUE IF NOT EXISTS 'expense_reversal';
    END IF;
END $$;

-- ============================================================
-- ✅ تم إصلاح:
-- 1. خصم المصروف من الخزينة عند الإنشاء/التحديث للحالة approved أو paid
-- 2. عكس الحركة عند إلغاء المصروف
-- ============================================================

COMMENT ON FUNCTION handle_expense_treasury_transaction IS 'خصم المصروف من الخزينة عند الاعتماد';
COMMENT ON FUNCTION revert_expense_on_cancel IS 'عكس حركة المصروف عند الإلغاء';
