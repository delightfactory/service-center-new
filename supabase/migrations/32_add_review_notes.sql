-- ============================================================
-- إضافة عمود ملاحظات المراجعة لجدول أوامر الشغل
-- الإصدار: 1.0
-- التاريخ: 2024-12-30
-- ============================================================

-- إضافة عمود review_notes إذا لم يكن موجوداً
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS review_notes text;

-- تعليق توضيحي
COMMENT ON COLUMN job_orders.review_notes IS 'ملاحظات المشرف عند المراجعة أو الإرجاع';






-- تفعيل Realtime على الجداول الموجودة فقط
DO $$ 
DECLARE
    tables TEXT[] := ARRAY[
        'job_orders', 'job_items', 'job_tasks', 'job_technicians', 
        'job_time_logs', 'assessments', 'invoices', 'payments',
        'treasuries', 'treasury_transactions', 'expenses', 
        'customers', 'suppliers'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
            RAISE NOTICE 'Added table: %', t;
        EXCEPTION
            WHEN duplicate_object THEN
                RAISE NOTICE 'Already in realtime: %', t;
            WHEN undefined_table THEN
                RAISE NOTICE 'Table not found: %', t;
        END;
    END LOOP;
END $$;

-- عرض الجداول المفعلة
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;