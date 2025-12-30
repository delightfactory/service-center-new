-- ============================================================
-- Migration: إصلاح RLS لتطبيق الفني
-- ============================================================
-- يسمح للفني المعين على أمر الشغل بتحديث المهام والأوقات
-- ============================================================

-- ============================================================
-- 1. إصلاح RLS على job_tasks
-- ============================================================
-- المشكلة: الـ Policy القديمة تشترط assigned_to = auth.uid()
-- لكن المهام قد لا يكون لها assigned_to
-- الحل: السماح للفني المعين على الأمر بتحديث أي مهمة فيه

-- حذف الـ Policy القديمة
DROP POLICY IF EXISTS "job_tasks_update_policy" ON job_tasks;

-- إنشاء Policy جديدة محسّنة
CREATE POLICY "job_tasks_update_policy" ON job_tasks
    FOR UPDATE TO authenticated
    USING (
        -- الفني المعين على أمر الشغل يستطيع تحديث أي مهمة في هذا الأمر
        EXISTS (
            SELECT 1 FROM job_technicians jt
            WHERE jt.job_order_id = job_tasks.job_order_id
            AND jt.technician_id = auth.uid()
        )
        -- أو المدير/المشرف/المهندس
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor', 'engineer')
        )
    );

-- ============================================================
-- 2. التأكد من RLS على job_time_logs
-- ============================================================
-- الفني يحتاج:
-- - INSERT: إنشاء سجل وقت جديد
-- - UPDATE: تحديث clock_out عند الإيقاف
-- - SELECT: قراءة سجلاته

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "job_time_logs_select" ON job_time_logs;
DROP POLICY IF EXISTS "job_time_logs_insert" ON job_time_logs;
DROP POLICY IF EXISTS "job_time_logs_update" ON job_time_logs;

-- السماح بالقراءة للمستخدمين المصادق عليهم
CREATE POLICY "job_time_logs_select" ON job_time_logs
    FOR SELECT TO authenticated
    USING (true);

-- السماح بالإضافة للفني المعين على أمر الشغل
CREATE POLICY "job_time_logs_insert" ON job_time_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        -- الفني المعين على الأمر
        EXISTS (
            SELECT 1 FROM job_technicians jt
            WHERE jt.job_order_id = job_time_logs.job_order_id
            AND jt.technician_id = auth.uid()
        )
        -- أو المدراء
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor')
        )
    );

-- السماح بالتحديث للفني صاحب السجل أو المدراء
CREATE POLICY "job_time_logs_update" ON job_time_logs
    FOR UPDATE TO authenticated
    USING (
        -- الفني صاحب السجل يستطيع تحديثه (إغلاق الوقت)
        technician_id = auth.uid()
        -- أو المدراء
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor')
        )
    );

-- ============================================================
-- تم إنشاء RLS policies المحسّنة لتطبيق الفني
-- ============================================================
-- الآن الفني يستطيع:
-- ✅ تحديث أي مهمة في أوامر الشغل المعين عليها
-- ✅ إنشاء سجلات وقت لأوامر الشغل المعين عليها
-- ✅ تحديث سجلات الوقت الخاصة به (clock_out)
-- ============================================================
