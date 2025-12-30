-- ============================================================
-- Migration: Job Order Delivery Columns
-- Date: 2024-12-27
-- ============================================================
-- إضافة أعمدة التسليم لتتبع خروج السيارة من الورشة
-- ============================================================

-- إضافة أعمدة التسليم
ALTER TABLE job_orders 
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS mileage_out integer;

-- إضافة تعليقات
COMMENT ON COLUMN job_orders.delivered_at IS 'تاريخ ووقت تسليم السيارة للعميل';
COMMENT ON COLUMN job_orders.delivered_by IS 'الموظف الذي سلّم السيارة';
COMMENT ON COLUMN job_orders.mileage_out IS 'عداد الكيلومترات عند الخروج';

-- فهرس للبحث عن الأوامر المسلمة
CREATE INDEX IF NOT EXISTS idx_job_orders_delivered ON job_orders(delivered_at) 
WHERE delivered_at IS NOT NULL;
