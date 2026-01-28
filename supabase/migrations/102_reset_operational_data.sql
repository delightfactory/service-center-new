-- ============================================================
-- تفريغ كامل للبيانات التشغيلية والمرجعية للاختبار النظيف
-- Migration: 102_reset_operational_data.sql
-- Date: 2026-01-28
-- ============================================================
-- ⚠️ تحذير: هذا الملف يحذف جميع البيانات!
-- 
-- الجداول التي سيتم تفريغها:
--   ✅ العملاء: customers, vehicles
--   ✅ الموردين: suppliers
--   ✅ العمليات: assessments, job_orders, job_items, job_technicians, job_tasks, job_time_logs
--   ✅ المالية: invoices, invoice_items, payments, expenses, credit_debit_notes
--   ✅ حركات الخزينة: treasury_transactions, treasury_transfers
--   ✅ المخزون: inventory_items, inventory_transactions
--   ✅ المنتجات: products, service_components, categories
--   ✅ الخزن: treasuries (وإعادة إنشاء الافتراضية)
-- 
-- الجداول التي سيتم الحفاظ عليها:
--   🔒 branches, profiles (المستخدمين)
--   🔒 warehouses
--   🔒 account_categories
--   🔒 settings
-- ============================================================

-- تعطيل الـ triggers مؤقتاً لتسريع العملية
SET session_replication_role = 'replica';

-- ============================================================
-- 1. تفريغ جداول المالية (بالترتيب الصحيح للـ FK)
-- ============================================================
TRUNCATE TABLE treasury_transactions CASCADE;
TRUNCATE TABLE treasury_transfers CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE invoice_items CASCADE;
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE credit_debit_notes CASCADE;

-- ============================================================
-- 2. تفريغ جداول المخزون
-- ============================================================
TRUNCATE TABLE inventory_transactions CASCADE;
TRUNCATE TABLE inventory_items CASCADE;

-- حذف حجوزات المخزون إن وجدت
DO $$ BEGIN
    EXECUTE 'TRUNCATE TABLE inventory_reservations CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 3. تفريغ جداول العمليات
-- ============================================================
-- job_time_logs و job_tasks
DO $$ BEGIN
    EXECUTE 'TRUNCATE TABLE job_time_logs CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    EXECUTE 'TRUNCATE TABLE job_tasks CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    EXECUTE 'TRUNCATE TABLE job_item_stages CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- job_technicians, job_items, job_orders
TRUNCATE TABLE job_technicians CASCADE;
TRUNCATE TABLE job_items CASCADE;
TRUNCATE TABLE job_orders CASCADE;

-- assessments
TRUNCATE TABLE assessments CASCADE;

-- ============================================================
-- 4. تفريغ جداول العملاء والمركبات والموردين
-- ============================================================
TRUNCATE TABLE vehicles CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE suppliers CASCADE;

-- ============================================================
-- 5. تفريغ المنتجات والتصنيفات
-- ============================================================
-- مكونات الخدمات أولاً
DO $$ BEGIN
    EXECUTE 'TRUNCATE TABLE service_components CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- المنتجات
TRUNCATE TABLE products CASCADE;

-- التصنيفات
TRUNCATE TABLE categories CASCADE;

-- ============================================================
-- 6. تفريغ وإعادة تهيئة الخزن
-- ============================================================
TRUNCATE TABLE treasuries CASCADE;

-- إعادة إنشاء الخزينة الافتراضية للفرع الأول
INSERT INTO treasuries (name, treasury_type, branch_id, is_default, balance, is_active)
SELECT 
    'الخزينة الرئيسية',
    'cash',
    id,
    true,
    0,
    true
FROM branches
LIMIT 1;

-- ============================================================
-- 7. إعادة تفعيل الـ triggers
-- ============================================================
SET session_replication_role = 'origin';

-- ============================================================
-- ملخص التفريغ
-- ============================================================
DO $$
DECLARE
    v_branch_name text;
BEGIN
    SELECT name INTO v_branch_name FROM branches LIMIT 1;
    
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ تم تفريغ جميع البيانات بنجاح';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '🗑️  تم حذف: العملاء، السيارات، الموردين';
    RAISE NOTICE '🗑️  تم حذف: تقارير الدخول، أوامر الشغل';
    RAISE NOTICE '🗑️  تم حذف: الفواتير، المدفوعات، المصروفات';
    RAISE NOTICE '🗑️  تم حذف: حركات المخزون والخزينة';
    RAISE NOTICE '�️  تم حذف: المنتجات، التصنيفات';
    RAISE NOTICE '🗑️  تم حذف: الخزن (وإعادة إنشاء الافتراضية)';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '🔒 تم الحفاظ على: الفروع، المستخدمين، المخازن، الإعدادات';
    RAISE NOTICE '🏢 الفرع النشط: %', v_branch_name;
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
