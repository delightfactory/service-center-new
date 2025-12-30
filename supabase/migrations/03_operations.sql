-- ============================================================
-- نظام إدارة مركز صيانة السيارات - جداول العمليات
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: 00_enums.sql, 01_core.sql, 02_crm.sql
-- ============================================================

-- ============================================================
-- 1. جدول تقارير الدخول/الفحص (assessments)
-- ============================================================
CREATE TABLE IF NOT EXISTS assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    vehicle_id uuid REFERENCES vehicles(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    branch_id uuid NOT NULL REFERENCES branches(id),
    entry_type entry_type NOT NULL DEFAULT 'vehicle',
    
    -- بيانات السيارة
    mileage_in integer,
    fuel_level integer CHECK (fuel_level >= 0 AND fuel_level <= 100),
    
    -- بيانات الجهاز (لحالة bench_work)
    device_type text,
    device_serial text,
    device_description text,
    
    -- الفحص
    customer_complaint text,
    initial_diagnosis text,
    inspection_notes jsonb DEFAULT '{}',
    photos text[] DEFAULT '{}',
    
    -- الحالة والتتبع
    status assessment_status DEFAULT 'pending',
    received_by uuid REFERENCES profiles(id),
    received_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_assessments_vehicle ON assessments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_assessments_customer ON assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_assessments_branch ON assessments(branch_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_date ON assessments(created_at DESC);

COMMENT ON TABLE assessments IS 'تقارير الدخول والفحص الظاهري';

-- ============================================================
-- 2. جدول أوامر الشغل (job_orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    assessment_id uuid REFERENCES assessments(id),
    vehicle_id uuid REFERENCES vehicles(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    branch_id uuid NOT NULL REFERENCES branches(id),
    
    -- التصنيف والحالة
    job_category job_category NOT NULL DEFAULT 'maintenance',
    status job_status DEFAULT 'draft',
    priority priority_level DEFAULT 'normal',
    
    -- التوجيهات والملاحظات
    manager_instructions text,
    notes text,
    
    -- الوقت
    estimated_hours numeric(5,2),
    actual_hours numeric(5,2),
    promised_date date,
    started_at timestamptz,
    completed_at timestamptz,
    
    -- المرجعية الخارجية
    external_reference text,
    
    -- التتبع
    created_by uuid REFERENCES profiles(id),
    approved_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_job_orders_assessment ON job_orders(assessment_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_vehicle ON job_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_customer ON job_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_branch ON job_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_orders_date ON job_orders(created_at DESC);

COMMENT ON TABLE job_orders IS 'أوامر الشغل الرئيسية';

-- ============================================================
-- 3. جدول بنود أمر الشغل (job_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_order_id uuid NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    product_id uuid, -- سيتم إضافة FK لاحقاً بعد إنشاء جدول products
    
    -- التفاصيل
    item_type job_item_type NOT NULL,
    description text NOT NULL,
    quantity numeric(10,3) DEFAULT 1,
    unit_price numeric(12,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    total_price numeric(12,2) GENERATED ALWAYS AS (
        quantity * unit_price * (1 - discount_percent / 100)
    ) STORED,
    
    -- تكلفة الخدمة الخارجية
    external_cost numeric(12,2) DEFAULT 0,
    
    -- الحالة
    is_completed boolean DEFAULT false,
    completed_at timestamptz,
    completed_by uuid REFERENCES profiles(id),
    
    -- التعثر
    is_blocked boolean DEFAULT false,
    blocked_reason text,
    
    -- الإرجاع
    returned_quantity numeric(10,3) DEFAULT 0,
    return_reason text,
    
    -- المخزن
    warehouse_id uuid, -- سيتم إضافة FK لاحقاً
    
    -- الترتيب
    sort_order integer DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_job_items_job_order ON job_items(job_order_id);
CREATE INDEX IF NOT EXISTS idx_job_items_product ON job_items(product_id);
CREATE INDEX IF NOT EXISTS idx_job_items_type ON job_items(item_type);

COMMENT ON TABLE job_items IS 'بنود أمر الشغل (عمالة، قطع، مستهلكات، خدمات خارجية...)';

-- ============================================================
-- 4. جدول الفنيين المعينين (job_technicians)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_technicians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_order_id uuid NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    technician_id uuid NOT NULL REFERENCES profiles(id),
    
    -- الدور
    is_lead boolean DEFAULT false,
    
    -- التتبع
    assigned_at timestamptz DEFAULT now(),
    assigned_by uuid REFERENCES profiles(id),
    
    -- منع التكرار
    UNIQUE(job_order_id, technician_id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_job_technicians_job ON job_technicians(job_order_id);
CREATE INDEX IF NOT EXISTS idx_job_technicians_tech ON job_technicians(technician_id);

COMMENT ON TABLE job_technicians IS 'الفنيين المعينين لأوامر الشغل';

-- ============================================================
-- Triggers لتوليد الأكواد التلقائية
-- ============================================================
CREATE OR REPLACE FUNCTION generate_assessment_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('ASM-', 'assessments');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_assessment_code ON assessments;
CREATE TRIGGER set_assessment_code
    BEFORE INSERT ON assessments
    FOR EACH ROW EXECUTE FUNCTION generate_assessment_code();

CREATE OR REPLACE FUNCTION generate_job_order_code()
RETURNS trigger AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := generate_code('JOB-', 'job_orders');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_job_order_code ON job_orders;
CREATE TRIGGER set_job_order_code
    BEFORE INSERT ON job_orders
    FOR EACH ROW EXECUTE FUNCTION generate_job_order_code();

-- ============================================================
-- Trigger لتحديث updated_at في job_orders
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON job_orders;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON job_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- تم إنشاء 4 جداول: assessments, job_orders, job_items, job_technicians
-- ============================================================
