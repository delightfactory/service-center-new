-- ============================================================
-- نظام تنظيف Storage التلقائي - Auto Storage Cleanup System
-- ============================================================
-- التاريخ: 2026-02-04
-- الهدف: 
--   1. تتبع الصور المرفوعة مع أحجامها
--   2. حذف الصور الأقدم من 30 يوم تلقائياً
--   3. حذف الصور عند تجاوز 80% من المساحة المجانية (1GB)
-- ============================================================

-- ============================================================
-- الإعدادات الافتراضية
-- ============================================================
-- الحد الأقصى للتخزين المجاني: 1GB = 1073741824 bytes
-- نسبة التحذير: 80% = 858993459 bytes
-- مدة الاحتفاظ: 30 يوم
-- ============================================================

-- ============================================================
-- 1. جدول تتبع الصور المرفوعة (محسّن)
-- ============================================================
CREATE TABLE IF NOT EXISTS storage_files_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text NOT NULL,
    file_path text NOT NULL,
    file_size_bytes bigint DEFAULT 0,  -- حجم الملف بالبايت
    uploaded_at timestamptz DEFAULT now(),
    assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
    is_deleted boolean DEFAULT false,   -- هل تم حذفه؟
    deleted_at timestamptz,             -- متى تم حذفه؟
    
    CONSTRAINT unique_file UNIQUE (bucket_id, file_path)
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_storage_files_log_uploaded_at 
    ON storage_files_log(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_storage_files_log_assessment 
    ON storage_files_log(assessment_id);
CREATE INDEX IF NOT EXISTS idx_storage_files_log_not_deleted 
    ON storage_files_log(is_deleted) WHERE is_deleted = false;

-- ============================================================
-- 2. جدول إعدادات التنظيف
-- ============================================================
CREATE TABLE IF NOT EXISTS storage_cleanup_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- صف واحد فقط
    max_storage_bytes bigint DEFAULT 1073741824,      -- 1GB
    warning_threshold_percent integer DEFAULT 80,     -- 80%
    retention_days integer DEFAULT 30,                -- 30 يوم
    auto_cleanup_enabled boolean DEFAULT true,
    last_cleanup_at timestamptz,
    last_cleanup_deleted_count integer DEFAULT 0,
    last_cleanup_freed_bytes bigint DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- إدخال الإعدادات الافتراضية
INSERT INTO storage_cleanup_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. دالة تسجيل ملف جديد (محسّنة)
-- ============================================================
CREATE OR REPLACE FUNCTION log_storage_file(
    p_bucket_id text,
    p_file_path text,
    p_file_size_bytes bigint DEFAULT 0,
    p_assessment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO storage_files_log (bucket_id, file_path, file_size_bytes, assessment_id)
    VALUES (p_bucket_id, p_file_path, p_file_size_bytes, p_assessment_id)
    ON CONFLICT (bucket_id, file_path) DO UPDATE
        SET file_size_bytes = COALESCE(NULLIF(p_file_size_bytes, 0), storage_files_log.file_size_bytes),
            assessment_id = COALESCE(p_assessment_id, storage_files_log.assessment_id)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- ============================================================
-- 4. دالة حساب إحصائيات التخزين (محسّنة)
-- ============================================================
CREATE OR REPLACE FUNCTION get_storage_usage()
RETURNS TABLE (
    total_files bigint,
    total_size_bytes bigint,
    total_size_mb numeric,
    max_storage_mb numeric,
    usage_percent numeric,
    files_older_than_retention bigint,
    size_older_than_retention_bytes bigint,
    needs_cleanup boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    settings storage_cleanup_settings%ROWTYPE;
BEGIN
    SELECT * INTO settings FROM storage_cleanup_settings WHERE id = 1;
    
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(file_size_bytes), 0) as total_bytes,
            COUNT(*) FILTER (WHERE uploaded_at < now() - (settings.retention_days || ' days')::interval) as old_count,
            COALESCE(SUM(file_size_bytes) FILTER (WHERE uploaded_at < now() - (settings.retention_days || ' days')::interval), 0) as old_bytes
        FROM storage_files_log
        WHERE is_deleted = false
    )
    SELECT 
        s.total_count::bigint,
        s.total_bytes::bigint,
        ROUND((s.total_bytes / 1048576.0)::numeric, 2),
        ROUND((settings.max_storage_bytes / 1048576.0)::numeric, 2),
        ROUND(((s.total_bytes * 100.0) / NULLIF(settings.max_storage_bytes, 0))::numeric, 2),
        s.old_count::bigint,
        s.old_bytes::bigint,
        (s.total_bytes * 100.0 / NULLIF(settings.max_storage_bytes, 0) >= settings.warning_threshold_percent)
            OR (s.old_count > 0)
    FROM stats s;
END;
$$;

-- ============================================================
-- 5. دالة الحصول على الملفات المرشحة للحذف
-- ============================================================
CREATE OR REPLACE FUNCTION get_files_to_cleanup(p_limit integer DEFAULT 100)
RETURNS TABLE (
    file_id uuid,
    bucket_id text,
    file_path text,
    file_size_bytes bigint,
    uploaded_at timestamptz,
    age_days integer,
    cleanup_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    settings storage_cleanup_settings%ROWTYPE;
    v_usage_percent numeric;
BEGIN
    SELECT * INTO settings FROM storage_cleanup_settings WHERE id = 1;
    
    -- حساب نسبة الاستخدام الحالية
    SELECT 
        (COALESCE(SUM(file_size_bytes), 0) * 100.0 / NULLIF(settings.max_storage_bytes, 0))::numeric
    INTO v_usage_percent
    FROM storage_files_log
    WHERE is_deleted = false;
    
    RETURN QUERY
    SELECT 
        sfl.id,
        sfl.bucket_id,
        sfl.file_path,
        sfl.file_size_bytes,
        sfl.uploaded_at,
        EXTRACT(DAY FROM (now() - sfl.uploaded_at))::integer,
        CASE 
            WHEN sfl.uploaded_at < now() - (settings.retention_days || ' days')::interval 
                THEN 'older_than_retention'
            WHEN v_usage_percent >= settings.warning_threshold_percent 
                THEN 'storage_threshold_exceeded'
            ELSE 'unknown'
        END
    FROM storage_files_log sfl
    WHERE sfl.is_deleted = false
        AND (
            -- الملفات الأقدم من فترة الاحتفاظ
            sfl.uploaded_at < now() - (settings.retention_days || ' days')::interval
            -- أو إذا تجاوزنا حد التخزين، نحذف الأقدم
            OR (v_usage_percent >= settings.warning_threshold_percent)
        )
    ORDER BY sfl.uploaded_at ASC
    LIMIT p_limit;
END;
$$;

-- ============================================================
-- 6. دالة وضع علامة حذف على ملف (بدلاً من الحذف المباشر)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_file_as_deleted(
    p_bucket_id text,
    p_file_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE storage_files_log
    SET is_deleted = true,
        deleted_at = now()
    WHERE bucket_id = p_bucket_id 
        AND file_path = p_file_path
        AND is_deleted = false;
    
    RETURN FOUND;
END;
$$;

-- ============================================================
-- 7. دالة تحديث إحصائيات التنظيف
-- ============================================================
CREATE OR REPLACE FUNCTION update_cleanup_stats(
    p_deleted_count integer,
    p_freed_bytes bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE storage_cleanup_settings
    SET last_cleanup_at = now(),
        last_cleanup_deleted_count = p_deleted_count,
        last_cleanup_freed_bytes = p_freed_bytes,
        updated_at = now()
    WHERE id = 1;
END;
$$;

-- ============================================================
-- 8. دالة فحص الحاجة للتنظيف
-- ============================================================
CREATE OR REPLACE FUNCTION should_run_cleanup()
RETURNS TABLE (
    needs_cleanup boolean,
    reason text,
    usage_percent numeric,
    old_files_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    settings storage_cleanup_settings%ROWTYPE;
    v_total_files bigint;
    v_total_bytes bigint;
    v_usage_percent numeric;
    v_old_files_count bigint;
    v_needs_cleanup boolean;
BEGIN
    SELECT * INTO settings FROM storage_cleanup_settings WHERE id = 1;
    
    -- حساب الإحصائيات مباشرة
    SELECT 
        COUNT(*),
        COALESCE(SUM(file_size_bytes), 0),
        COUNT(*) FILTER (WHERE uploaded_at < now() - (settings.retention_days || ' days')::interval)
    INTO v_total_files, v_total_bytes, v_old_files_count
    FROM storage_files_log
    WHERE is_deleted = false;
    
    -- حساب نسبة الاستخدام
    v_usage_percent := ROUND(((v_total_bytes * 100.0) / NULLIF(settings.max_storage_bytes, 0))::numeric, 2);
    
    -- تحديد إذا كان التنظيف مطلوباً
    v_needs_cleanup := (v_usage_percent >= settings.warning_threshold_percent) OR (v_old_files_count > 0);
    
    RETURN QUERY
    SELECT 
        v_needs_cleanup,
        CASE 
            WHEN NOT settings.auto_cleanup_enabled THEN 'auto_cleanup_disabled'
            WHEN v_usage_percent >= settings.warning_threshold_percent THEN 'storage_threshold_80_percent'
            WHEN v_old_files_count > 0 THEN 'files_older_than_30_days'
            ELSE 'no_cleanup_needed'
        END,
        v_usage_percent,
        v_old_files_count;
END;
$$;

-- ============================================================
-- 9. دالة تنظيف السجلات القديمة (المحذوفة)
-- ============================================================
CREATE OR REPLACE FUNCTION purge_deleted_logs(p_days_old integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM storage_files_log
    WHERE is_deleted = true
        AND deleted_at < now() - (p_days_old || ' days')::interval;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================
-- RLS للجداول
-- ============================================================
ALTER TABLE storage_files_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_cleanup_settings ENABLE ROW LEVEL SECURITY;

-- سياسات storage_files_log
DROP POLICY IF EXISTS "storage_files_log_select" ON storage_files_log;
CREATE POLICY "storage_files_log_select" ON storage_files_log
    FOR SELECT TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

DROP POLICY IF EXISTS "storage_files_log_insert" ON storage_files_log;
CREATE POLICY "storage_files_log_insert" ON storage_files_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "storage_files_log_update" ON storage_files_log;
CREATE POLICY "storage_files_log_update" ON storage_files_log
    FOR UPDATE TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

DROP POLICY IF EXISTS "storage_files_log_delete" ON storage_files_log;
CREATE POLICY "storage_files_log_delete" ON storage_files_log
    FOR DELETE TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- سياسات storage_cleanup_settings
DROP POLICY IF EXISTS "storage_cleanup_settings_select" ON storage_cleanup_settings;
CREATE POLICY "storage_cleanup_settings_select" ON storage_cleanup_settings
    FOR SELECT TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

DROP POLICY IF EXISTS "storage_cleanup_settings_update" ON storage_cleanup_settings;
CREATE POLICY "storage_cleanup_settings_update" ON storage_cleanup_settings
    FOR UPDATE TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- ============================================================
-- ملخص API:
-- ============================================================
-- تسجيل ملف:     SELECT log_storage_file('assessment-photos', 'path', 1024, uuid);
-- إحصائيات:      SELECT * FROM get_storage_usage();
-- هل نحتاج تنظيف: SELECT * FROM should_run_cleanup();
-- ملفات للحذف:   SELECT * FROM get_files_to_cleanup(50);
-- تمييز محذوف:   SELECT mark_file_as_deleted('bucket', 'path');
-- تحديث الإحصائيات: SELECT update_cleanup_stats(10, 5242880);
-- ============================================================
