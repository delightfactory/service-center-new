-- ============================================================
-- Migration: تنظيف الـ Trigger المكرر
-- الملف: 33_cleanup_duplicate_triggers.sql
-- التاريخ: 2026-01-03
-- ============================================================
-- المشكلة: يوجد trigger مكرر على job_items لنفس الـ function:
--   - trg_job_item_quantity_update (من 22_fix_flow_gaps.sql)
--   - trg_job_item_qty_update (من 26_fix_business_logic_gaps.sql)
-- 
-- كلاهما يستدعي on_job_item_quantity_update() مما يسبب:
--   - تنفيذ الـ function مرتين
--   - حجز/تحرير الكمية مرتين
--   - تكرار حركات المخزون
-- ============================================================

-- حذف الـ trigger القديم (من 22_fix_flow_gaps.sql)
-- الـ trigger الأحدث trg_job_item_qty_update سيبقى ويعمل بشكل صحيح
DROP TRIGGER IF EXISTS trg_job_item_quantity_update ON job_items;

-- إضافة تعليق توضيحي على الـ trigger الفعال
COMMENT ON TRIGGER trg_job_item_qty_update ON job_items IS 
  'تحديث حجز المخزون عند تغيير كمية البند - يدعم الخدمات المركبة والتحقق من is_cancelled (من 26_fix_business_logic_gaps.sql)';

-- ============================================================
-- ✅ تم التنظيف
-- الـ trigger الفعال الآن: trg_job_item_qty_update
-- ============================================================
