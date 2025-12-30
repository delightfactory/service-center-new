-- ============================================================
-- إضافة عمود صور المنتجات
-- ============================================================

DO $$
BEGIN
    -- إضافة عمود image_url إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE products ADD COLUMN image_url text;
        COMMENT ON COLUMN products.image_url IS 'رابط صورة المنتج';
    END IF;
END $$;

-- ============================================================
-- إنشاء bucket لصور المنتجات
-- ============================================================
-- هذا يحتاج تنفيذه من خلال Supabase Dashboard أو API:
-- 1. اذهب إلى Storage في لوحة التحكم
-- 2. أنشئ bucket جديد باسم 'product-images'
-- 3. اجعله public للقراءة
