-- ============================================================
-- نظام إدارة مركز صيانة السيارات - جداول المالية
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: 00_enums.sql, 01_core.sql, 02_crm.sql, 03_operations.sql
-- ============================================================

-- ============================================================
-- 1. جدول الخزن (treasuries)
-- ============================================================
CREATE TABLE IF NOT EXISTS treasuries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    name text NOT NULL,
    treasury_type treasury_type NOT NULL,
    branch_id uuid REFERENCES branches(id),
    
    -- الرصيد
    balance numeric(14,2) DEFAULT 0,
    opening_balance numeric(14,2) DEFAULT 0,
    
    -- بيانات البنك
    bank_name text,
    account_number text,
    iban text,
    
    -- الحالة
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_treasuries_branch ON treasuries(branch_id);
CREATE INDEX IF NOT EXISTS idx_treasuries_type ON treasuries(treasury_type);

COMMENT ON TABLE treasuries IS 'الخزن (نقدية، بنكية، POS، إلكترونية)';

-- ============================================================
-- 2. جدول بنود الحسابات (account_categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS account_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    name text NOT NULL,
    category_type account_category_type NOT NULL,
    parent_id uuid REFERENCES account_categories(id),
    description text,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_account_categories_type ON account_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_account_categories_parent ON account_categories(parent_id);

COMMENT ON TABLE account_categories IS 'بنود الإيرادات والمصروفات';

-- ============================================================
-- 3. جدول الفواتير (invoices)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    invoice_type invoice_type NOT NULL,
    
    -- الأطراف
    job_order_id uuid REFERENCES job_orders(id),
    customer_id uuid REFERENCES customers(id),
    supplier_id uuid REFERENCES suppliers(id),
    branch_id uuid NOT NULL REFERENCES branches(id),
    
    -- المبالغ
    subtotal numeric(14,2) DEFAULT 0,
    discount_amount numeric(14,2) DEFAULT 0,
    tax_percent numeric(5,2) DEFAULT 0,
    tax_amount numeric(14,2) DEFAULT 0,
    total_amount numeric(14,2) DEFAULT 0,
    paid_amount numeric(14,2) DEFAULT 0,
    remaining_amount numeric(14,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    
    -- الحالة والتواريخ
    status invoice_status DEFAULT 'draft',
    due_date date,
    
    -- الإلغاء
    cancelled_by uuid REFERENCES profiles(id),
    cancelled_at timestamptz,
    cancellation_reason text,
    
    -- إشعارات
    has_credit_notes boolean DEFAULT false,
    has_debit_notes boolean DEFAULT false,
    
    -- الملاحظات
    notes text,
    
    -- التتبع
    created_by uuid REFERENCES profiles(id),
    approved_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- قيد: الفاتورة إما لعميل أو لمورد
    CONSTRAINT invoice_party_check CHECK (
        (customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (customer_id IS NULL AND supplier_id IS NOT NULL)
    )
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_order ON invoices(job_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at DESC);

COMMENT ON TABLE invoices IS 'الفواتير (مبيعات، مشتريات، مرتجعات)';

-- ============================================================
-- 4. جدول المصروفات (expenses)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    category_id uuid REFERENCES account_categories(id),
    branch_id uuid NOT NULL REFERENCES branches(id),
    treasury_id uuid REFERENCES treasuries(id),
    supplier_id uuid REFERENCES suppliers(id),
    
    -- المبلغ والتفاصيل
    amount numeric(14,2) NOT NULL,
    description text NOT NULL,
    expense_date date DEFAULT CURRENT_DATE,
    reference text,
    attachment text,
    
    -- الحالة
    status expense_status DEFAULT 'pending',
    approved_by uuid REFERENCES profiles(id),
    approved_at timestamptz,
    
    -- الملاحظات
    notes text,
    
    -- التتبع
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_treasury ON expenses(treasury_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);

COMMENT ON TABLE expenses IS 'المصروفات مع دورة الاعتماد';

-- ============================================================
-- 5. جدول المدفوعات (payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    payment_type payment_type NOT NULL,
    payment_method payment_method NOT NULL,
    
    -- الخزينة والمرجع
    treasury_id uuid REFERENCES treasuries(id),
    invoice_id uuid REFERENCES invoices(id),
    job_order_id uuid REFERENCES job_orders(id),
    
    -- الأطراف
    customer_id uuid REFERENCES customers(id),
    supplier_id uuid REFERENCES suppliers(id),
    
    -- المبلغ والتفاصيل
    amount numeric(14,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE,
    reference text,
    
    -- بيانات الشيك
    cheque_number text,
    cheque_date date,
    cheque_bank text,
    
    -- الملاحظات
    notes text,
    
    -- التتبع
    branch_id uuid NOT NULL REFERENCES branches(id),
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_payments_treasury ON payments(treasury_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_order ON payments(job_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);

COMMENT ON TABLE payments IS 'سندات القبض والصرف';

-- ============================================================
-- 6. جدول حركات الخزينة (treasury_transactions)
-- ============================================================
CREATE TABLE IF NOT EXISTS treasury_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    treasury_id uuid NOT NULL REFERENCES treasuries(id),
    transaction_type treasury_tx_type NOT NULL,
    
    -- المبالغ
    amount numeric(14,2) NOT NULL,
    balance_before numeric(14,2),
    balance_after numeric(14,2),
    
    -- المرجع
    reference_type text,
    reference_id uuid,
    
    -- الطرف
    party_type text,
    party_id uuid,
    
    -- التفاصيل
    description text,
    branch_id uuid REFERENCES branches(id),
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_treasury_tx_treasury ON treasury_transactions(treasury_id);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_type ON treasury_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_ref ON treasury_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_date ON treasury_transactions(created_at DESC);

COMMENT ON TABLE treasury_transactions IS 'حركات الخزينة (إيداع، سحب، تحويل، تحصيل...)';

-- ============================================================
-- 7. جدول التحويلات بين الخزن (treasury_transfers)
-- ============================================================
CREATE TABLE IF NOT EXISTS treasury_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    from_treasury_id uuid NOT NULL REFERENCES treasuries(id),
    to_treasury_id uuid NOT NULL REFERENCES treasuries(id),
    amount numeric(14,2) NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE,
    notes text,
    
    -- الحالة
    status transfer_status DEFAULT 'pending',
    approved_by uuid REFERENCES profiles(id),
    
    -- التتبع
    branch_id uuid REFERENCES branches(id),
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    
    -- منع التحويل للخزينة نفسها
    CONSTRAINT different_treasuries CHECK (from_treasury_id != to_treasury_id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_from ON treasury_transfers(from_treasury_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_to ON treasury_transfers(to_treasury_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_status ON treasury_transfers(status);

COMMENT ON TABLE treasury_transfers IS 'التحويلات بين الخزن';

-- ============================================================
-- 8. جدول الإشعارات الدائنة/المدينة (credit_debit_notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_debit_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    note_type note_type NOT NULL,
    invoice_id uuid REFERENCES invoices(id),
    customer_id uuid REFERENCES customers(id),
    
    -- المبلغ والسبب
    amount numeric(14,2) NOT NULL,
    reason text NOT NULL,
    
    -- الحالة
    status note_status DEFAULT 'pending',
    applied_to_invoice_id uuid REFERENCES invoices(id),
    refunded_amount numeric(14,2) DEFAULT 0,
    
    -- الاعتماد
    approved_by uuid REFERENCES profiles(id),
    approved_at timestamptz,
    
    -- التتبع
    branch_id uuid REFERENCES branches(id),
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_invoice ON credit_debit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_customer ON credit_debit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_type ON credit_debit_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_status ON credit_debit_notes(status);

COMMENT ON TABLE credit_debit_notes IS 'الإشعارات الدائنة والمدينة لتعديل الفواتير';

-- ============================================================
-- Triggers لتوليد الأكواد التلقائية
-- ============================================================

CREATE OR REPLACE FUNCTION generate_treasury_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('TRS-', 'treasuries');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_treasury_code ON treasuries;
CREATE TRIGGER set_treasury_code
    BEFORE INSERT ON treasuries
    FOR EACH ROW EXECUTE FUNCTION generate_treasury_code();

CREATE OR REPLACE FUNCTION generate_invoice_code()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.code IS NULL THEN
        prefix := CASE NEW.invoice_type
            WHEN 'sales' THEN 'INV-'
            WHEN 'purchase' THEN 'PUR-'
            WHEN 'sales_return' THEN 'SRT-'
            WHEN 'purchase_return' THEN 'PRT-'
        END;
        NEW.code := generate_code(prefix, 'invoices');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_code ON invoices;
CREATE TRIGGER set_invoice_code
    BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION generate_invoice_code();

CREATE OR REPLACE FUNCTION generate_expense_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('EXP-', 'expenses');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_expense_code ON expenses;
CREATE TRIGGER set_expense_code
    BEFORE INSERT ON expenses
    FOR EACH ROW EXECUTE FUNCTION generate_expense_code();

CREATE OR REPLACE FUNCTION generate_payment_code()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.code IS NULL THEN
        prefix := CASE 
            WHEN NEW.payment_type IN ('customer_receipt', 'advance_payment') THEN 'RCV-'
            ELSE 'PAY-'
        END;
        NEW.code := generate_code(prefix, 'payments');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payment_code ON payments;
CREATE TRIGGER set_payment_code
    BEFORE INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION generate_payment_code();

CREATE OR REPLACE FUNCTION generate_treasury_tx_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('TTX-', 'treasury_transactions');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_treasury_tx_code ON treasury_transactions;
CREATE TRIGGER set_treasury_tx_code
    BEFORE INSERT ON treasury_transactions
    FOR EACH ROW EXECUTE FUNCTION generate_treasury_tx_code();

CREATE OR REPLACE FUNCTION generate_transfer_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('TRF-', 'treasury_transfers');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transfer_code ON treasury_transfers;
CREATE TRIGGER set_transfer_code
    BEFORE INSERT ON treasury_transfers
    FOR EACH ROW EXECUTE FUNCTION generate_transfer_code();

CREATE OR REPLACE FUNCTION generate_note_code()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.code IS NULL THEN
        prefix := CASE NEW.note_type
            WHEN 'credit' THEN 'CN-'
            WHEN 'debit' THEN 'DN-'
        END;
        NEW.code := generate_code(prefix, 'credit_debit_notes');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_note_code ON credit_debit_notes;
CREATE TRIGGER set_note_code
    BEFORE INSERT ON credit_debit_notes
    FOR EACH ROW EXECUTE FUNCTION generate_note_code();

-- ============================================================
-- Trigger لتحديث رصيد الخزينة بعد الحركة
-- ============================================================
CREATE OR REPLACE FUNCTION update_treasury_balance()
RETURNS trigger AS $$
DECLARE
    v_current_balance numeric(14,2);
BEGIN
    -- الحصول على الرصيد الحالي
    SELECT balance INTO v_current_balance FROM treasuries WHERE id = NEW.treasury_id;
    NEW.balance_before := v_current_balance;
    
    -- تحديث الرصيد
    IF NEW.transaction_type IN ('deposit', 'transfer_in', 'customer_receipt', 'income', 'opening_balance') THEN
        UPDATE treasuries SET balance = balance + NEW.amount WHERE id = NEW.treasury_id;
    ELSE
        UPDATE treasuries SET balance = balance - NEW.amount WHERE id = NEW.treasury_id;
    END IF;
    
    -- الحصول على الرصيد بعد
    SELECT balance INTO NEW.balance_after FROM treasuries WHERE id = NEW.treasury_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_treasury_transaction ON treasury_transactions;
CREATE TRIGGER on_treasury_transaction
    BEFORE INSERT ON treasury_transactions
    FOR EACH ROW EXECUTE FUNCTION update_treasury_balance();

-- ============================================================
-- Trigger لتحديث حالة الفاتورة بعد الدفع
-- ============================================================
CREATE OR REPLACE FUNCTION update_invoice_after_payment()
RETURNS trigger AS $$
BEGIN
    IF NEW.invoice_id IS NOT NULL THEN
        UPDATE invoices SET 
            paid_amount = paid_amount + NEW.amount,
            status = CASE 
                WHEN paid_amount + NEW.amount >= total_amount THEN 'paid'::invoice_status
                WHEN paid_amount + NEW.amount > 0 THEN 'partial'::invoice_status
                ELSE status
            END,
            updated_at = now()
        WHERE id = NEW.invoice_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_created ON payments;
CREATE TRIGGER on_payment_created
    AFTER INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_after_payment();

-- ============================================================
-- Trigger لتحديث رصيد العميل بعد الدفع
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_balance_after_payment()
RETURNS trigger AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL THEN
        IF NEW.payment_type = 'customer_receipt' THEN
            UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.customer_id;
        ELSIF NEW.payment_type = 'refund_to_customer' THEN
            UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.customer_id;
        ELSIF NEW.payment_type = 'advance_payment' THEN
            UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_update_customer ON payments;
CREATE TRIGGER on_payment_update_customer
    AFTER INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION update_customer_balance_after_payment();

-- ============================================================
-- Trigger لتحديث رصيد المورد بعد الدفع
-- ============================================================
CREATE OR REPLACE FUNCTION update_supplier_balance_after_payment()
RETURNS trigger AS $$
BEGIN
    IF NEW.supplier_id IS NOT NULL THEN
        IF NEW.payment_type = 'supplier_payment' THEN
            UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.supplier_id;
        ELSIF NEW.payment_type = 'refund_from_supplier' THEN
            UPDATE suppliers SET balance = balance + NEW.amount WHERE id = NEW.supplier_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_update_supplier ON payments;
CREATE TRIGGER on_payment_update_supplier
    AFTER INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION update_supplier_balance_after_payment();

-- ============================================================
-- Trigger لتحديث updated_at في invoices
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON invoices;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- تم إنشاء 8 جداول مالية
-- ============================================================
