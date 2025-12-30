-- ============================================================
-- Migration: Fix job_items RLS for INSERT
-- ============================================================
-- المشكلة: policy job_items_modify تستخدم FOR ALL USING فقط
-- الحل: إضافة WITH CHECK لتعمل INSERT
-- ============================================================

-- إعادة إنشاء policy job_items_modify بشكل صحيح
DROP POLICY IF EXISTS "job_items_modify" ON job_items;

-- إنشاء policy للإضافة
CREATE POLICY "job_items_insert" ON job_items 
    FOR INSERT WITH CHECK (public.can_modify());

-- إنشاء policy للتحديث
CREATE POLICY "job_items_update" ON job_items 
    FOR UPDATE USING (public.can_modify());

-- إنشاء policy للحذف
CREATE POLICY "job_items_delete" ON job_items 
    FOR DELETE USING (public.can_modify());

-- ============================================================
-- تم إصلاح RLS لجدول job_items
-- ============================================================
