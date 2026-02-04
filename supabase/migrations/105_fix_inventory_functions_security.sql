-- ============================================================
-- Migration: Fix Inventory Functions Security (Safe Version)
-- ============================================================
-- المشكلة: دوال حجز المخزون تفشل للمشرف/المهندس لأنهم لا يملكون
-- صلاحية تعديل جدول inventory_items مباشرة
-- 
-- الحل: إضافة SECURITY DEFINER للدوال الموجودة بدون إعادة كتابتها
-- هذا يجعل الدوال تعمل بصلاحيات مالكها (postgres) بدلاً من المستخدم
-- ============================================================

-- ============================================================
-- تعديل الدوال الأساسية لحجز المخزون
-- ============================================================

-- دالة حجز منتج واحد - الدالة الأساسية التي تعدل inventory_items
ALTER FUNCTION reserve_single_product(uuid, uuid, numeric, uuid) SECURITY DEFINER;

-- دالة تحرير حجز منتج واحد
ALTER FUNCTION release_single_product(uuid, uuid, numeric, uuid) SECURITY DEFINER;

-- دالة خصم منتج واحد عند الفوترة
ALTER FUNCTION deduct_single_product(uuid, uuid, uuid, numeric, uuid) SECURITY DEFINER;

-- دالة إرجاع منتج واحد للمخزون
ALTER FUNCTION restore_single_product(uuid, uuid, numeric, uuid) SECURITY DEFINER;

-- ============================================================
-- تعديل الدوال العليا (تستدعي الدوال الأساسية)
-- ============================================================

-- دالة حجز المخزون لبند أمر الشغل
ALTER FUNCTION reserve_inventory_for_job_item(uuid, uuid, numeric, uuid) SECURITY DEFINER;

-- دالة تحرير حجز المخزون لبند أمر الشغل
ALTER FUNCTION release_inventory_for_job_item(uuid, uuid, numeric, uuid) SECURITY DEFINER;

-- دالة خصم المخزون عند اعتماد الفاتورة
ALTER FUNCTION deduct_inventory_on_invoice_approval(uuid) SECURITY DEFINER;

-- دالة إرجاع المخزون عند إلغاء الفاتورة
ALTER FUNCTION restore_inventory_on_invoice_cancel(uuid) SECURITY DEFINER;

-- ============================================================
-- ملاحظة: لم يتم تعديل محتوى الدوال - فقط تم إضافة SECURITY DEFINER
-- ============================================================
-- الآن المشرف والمهندس يستطيعون إضافة بنود لأمر الشغل
-- والـ triggers ستعمل بصلاحيات مالك الدالة
-- ============================================================
