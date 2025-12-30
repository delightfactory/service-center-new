-- ============================================================
-- Migration: Invoice Items Table
-- Date: 2024-12-27
-- ============================================================
-- جدول بنود الفواتير لعرضها للعميل عند المراجعة
-- ============================================================

-- إنشاء جدول بنود الفواتير
CREATE TABLE IF NOT EXISTS invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- تفاصيل البند
    description text NOT NULL,
    quantity numeric(10,3) DEFAULT 1,
    unit_price numeric(14,2) DEFAULT 0,
    discount_amount numeric(14,2) DEFAULT 0,
    total_price numeric(14,2) GENERATED ALWAYS AS (
        quantity * unit_price - discount_amount
    ) STORED,
    
    -- ربط بأمر الشغل (اختياري)
    job_item_id uuid REFERENCES job_items(id) ON DELETE SET NULL,
    product_id uuid REFERENCES products(id),
    
    -- الترتيب
    sort_order integer DEFAULT 0,
    
    -- التتبع
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

-- تعليقات
COMMENT ON TABLE invoice_items IS 'بنود الفواتير التفصيلية';

-- RLS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "invoice_items_select" ON invoice_items
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "invoice_items_insert" ON invoice_items
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "invoice_items_update" ON invoice_items
    FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "invoice_items_delete" ON invoice_items
    FOR DELETE TO authenticated
    USING (true);

-- منح الصلاحيات
GRANT ALL ON invoice_items TO authenticated;
