-- ============================================================
-- نظام إدارة مركز صيانة السيارات - جداول المخزون
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: 00_enums.sql, 01_core.sql
-- ============================================================

-- ============================================================
-- 1. جدول تصنيفات المنتجات (categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    parent_id uuid REFERENCES categories(id),
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

COMMENT ON TABLE categories IS 'تصنيفات المنتجات - هيكل شجري';

-- ============================================================
-- 2. جدول المنتجات والخدمات (products)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    barcode text,
    name text NOT NULL,
    name_en text,
    description text,
    
    -- النوع والتصنيف
    product_type product_type NOT NULL,
    category_id uuid REFERENCES categories(id),
    
    -- الوحدة والأسعار
    unit text DEFAULT 'قطعة',
    purchase_price numeric(12,2) DEFAULT 0,
    selling_price numeric(12,2) DEFAULT 0,
    
    -- المخزون
    min_stock numeric(10,3) DEFAULT 0,
    is_trackable boolean DEFAULT true,
    
    -- الخدمات المركبة
    is_composite boolean DEFAULT false,
    duration_minutes integer,
    labor_cost numeric(12,2) DEFAULT 0,
    
    -- بيانات إضافية
    brand text,
    compatible_vehicles jsonb DEFAULT '[]',
    warranty_months integer,
    
    -- الحالة
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('arabic', name));

COMMENT ON TABLE products IS 'المنتجات والخدمات - قطع غيار، مستهلكات، خدمات';

-- ============================================================
-- 3. جدول مكونات الخدمات (service_components)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity numeric(10,3) DEFAULT 1,
    is_optional boolean DEFAULT false,
    notes text,
    
    -- منع التكرار
    UNIQUE(service_id, component_id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_service_components_service ON service_components(service_id);
CREATE INDEX IF NOT EXISTS idx_service_components_component ON service_components(component_id);

COMMENT ON TABLE service_components IS 'مكونات الخدمات المركبة (قطع/مستهلكات تُضاف تلقائياً)';

-- ============================================================
-- 4. جدول أرصدة المخزون (inventory_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    quantity numeric(10,3) DEFAULT 0,
    reserved_quantity numeric(10,3) DEFAULT 0,
    available_quantity numeric(10,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    last_purchase_price numeric(12,2),
    avg_cost numeric(12,2) DEFAULT 0,
    last_updated timestamptz DEFAULT now(),
    
    -- منع التكرار
    UNIQUE(product_id, warehouse_id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse ON inventory_items(warehouse_id);

COMMENT ON TABLE inventory_items IS 'أرصدة المخزون لكل منتج في كل مخزن';

-- ============================================================
-- 5. جدول حركات المخزون (inventory_transactions)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    product_id uuid NOT NULL REFERENCES products(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    
    -- الحركة
    transaction_type inventory_tx_type NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit_cost numeric(12,2),
    total_cost numeric(12,2),
    
    -- الرصيد
    balance_before numeric(10,3),
    balance_after numeric(10,3),
    
    -- المرجع
    reference_type text,
    reference_id uuid,
    
    -- التفاصيل
    notes text,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_inventory_tx_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_warehouse ON inventory_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_date ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_ref ON inventory_transactions(reference_type, reference_id);

COMMENT ON TABLE inventory_transactions IS 'حركات المخزون (شراء، بيع، تحويل، تالف...)';

-- ============================================================
-- إضافة FK لـ job_items بعد إنشاء products
-- ============================================================
DO $$ BEGIN
    ALTER TABLE job_items ADD CONSTRAINT fk_job_items_product
        FOREIGN KEY (product_id) REFERENCES products(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE job_items ADD CONSTRAINT fk_job_items_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Trigger للتحقق من نوع المكون في service_components
-- ============================================================
CREATE OR REPLACE FUNCTION check_component_type()
RETURNS trigger AS $$
BEGIN
    -- التحقق من أن service_id هو خدمة
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.service_id AND product_type = 'service') THEN
        RAISE EXCEPTION 'service_id يجب أن يشير لمنتج من نوع service';
    END IF;
    
    -- التحقق من أن component_id ليس خدمة
    IF EXISTS (SELECT 1 FROM products WHERE id = NEW.component_id AND product_type = 'service') THEN
        RAISE EXCEPTION 'المكون يجب أن يكون قطعة أو مستهلك، وليس خدمة';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_component_type ON service_components;
CREATE TRIGGER validate_component_type
    BEFORE INSERT OR UPDATE ON service_components
    FOR EACH ROW EXECUTE FUNCTION check_component_type();

-- ============================================================
-- Trigger لتوليد كود المنتج تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.code IS NULL THEN
        prefix := CASE NEW.product_type
            WHEN 'part' THEN 'PRT-'
            WHEN 'consumable' THEN 'CON-'
            WHEN 'service' THEN 'SRV-'
        END;
        NEW.code := generate_code(prefix, 'products');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_product_code ON products;
CREATE TRIGGER set_product_code
    BEFORE INSERT ON products
    FOR EACH ROW EXECUTE FUNCTION generate_product_code();

-- ============================================================
-- Trigger لتوليد كود حركة المخزون تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION generate_inventory_tx_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('ITX-', 'inventory_transactions');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_inventory_tx_code ON inventory_transactions;
CREATE TRIGGER set_inventory_tx_code
    BEFORE INSERT ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION generate_inventory_tx_code();

-- ============================================================
-- Trigger لتحديث رصيد المخزون بعد الحركة
-- ============================================================
CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS trigger AS $$
DECLARE
    v_current_qty numeric(10,3);
BEGIN
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
-- Trigger لتحديث updated_at في products
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON products;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- تم إنشاء 5 جداول: categories, products, service_components, 
--                    inventory_items, inventory_transactions
-- ============================================================
