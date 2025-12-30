-- ============================================================
-- نظام إدارة مركز صيانة السيارات - جداول العملاء والمركبات
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: 00_enums.sql, 01_core.sql
-- ============================================================

-- ============================================================
-- 1. جدول العملاء (customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    name text NOT NULL,
    phone text NOT NULL,
    phone_alt text,
    email text,
    address text,
    customer_type customer_type DEFAULT 'individual',
    tax_number text,
    notes text,
    balance numeric(14,2) DEFAULT 0,
    branch_id uuid REFERENCES branches(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING gin(to_tsvector('arabic', name));

COMMENT ON TABLE customers IS 'العملاء - أفراد وشركات';

-- ============================================================
-- 2. جدول المركبات (vehicles)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id),
    plate_number text NOT NULL,
    vin text,
    make text NOT NULL,
    model text NOT NULL,
    year integer,
    color text,
    engine_type text,
    transmission text,
    current_mileage integer DEFAULT 0,
    last_service_date date,
    next_service_mileage integer,
    insurance_expiry date,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin) WHERE vin IS NOT NULL;

COMMENT ON TABLE vehicles IS 'المركبات - مرتبطة بالعملاء (عميل واحد يمكنه امتلاك عدة سيارات)';

-- ============================================================
-- 3. جدول الموردين (suppliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    tax_number text,
    contact_person text,
    balance numeric(14,2) DEFAULT 0,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers USING gin(to_tsvector('arabic', name));

COMMENT ON TABLE suppliers IS 'الموردين وأرصدتهم';

-- ============================================================
-- دالة توليد الأكواد التلقائية
-- ============================================================
CREATE OR REPLACE FUNCTION generate_code(prefix text, table_name text)
RETURNS text AS $$
DECLARE
    next_num integer;
    new_code text;
BEGIN
    EXECUTE format('SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM ''[0-9]+$'') AS INTEGER)), 0) + 1 FROM %I WHERE code LIKE $1', table_name)
    INTO next_num
    USING prefix || '%';
    
    new_code := prefix || LPAD(next_num::text, 4, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger لتوليد كود العميل تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('CUS-', 'customers');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_customer_code ON customers;
CREATE TRIGGER set_customer_code
    BEFORE INSERT ON customers
    FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- ============================================================
-- Trigger لتوليد كود المورد تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION generate_supplier_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('SUP-', 'suppliers');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_supplier_code ON suppliers;
CREATE TRIGGER set_supplier_code
    BEFORE INSERT ON suppliers
    FOR EACH ROW EXECUTE FUNCTION generate_supplier_code();

-- ============================================================
-- Triggers لتحديث updated_at
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON customers;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON vehicles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON suppliers;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- تم إنشاء 3 جداول: customers, vehicles, suppliers
-- ============================================================
