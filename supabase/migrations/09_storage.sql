-- ============================================================
-- نظام إدارة مركز صيانة السيارات - Storage Buckets
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: تنفيذه بعد جميع ملفات الـ Migrations
-- ============================================================

-- ============================================================
-- 1. إنشاء Buckets للتخزين
-- ============================================================

-- Bucket لصور الفحص الظاهري (assessments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assessment-photos',
    'assessment-photos',
    false,  -- خاص (يحتاج مصادقة)
    5242880,  -- 5MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket لمرفقات المصروفات (إيصالات)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'expense-attachments',
    'expense-attachments',
    false,
    10485760,  -- 10MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket للصور الشخصية (avatars)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,  -- عام (للعرض بدون مصادقة)
    2097152,  -- 2MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket لمستندات العملاء والموردين
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    20971520,  -- 20MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2. سياسات RLS للـ Buckets
-- ============================================================

-- ========== assessment-photos ==========

-- السماح لمهندس الاستقبال والأعلى برفع الصور
DROP POLICY IF EXISTS "assessment_photos_insert" ON storage.objects;
CREATE POLICY "assessment_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'assessment-photos'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) 
            IN ('admin', 'manager', 'supervisor', 'engineer')
    );

-- السماح لجميع المستخدمين المصادقين بعرض الصور
DROP POLICY IF EXISTS "assessment_photos_select" ON storage.objects;
CREATE POLICY "assessment_photos_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'assessment-photos');

-- السماح للمدير والأدمن بالحذف
DROP POLICY IF EXISTS "assessment_photos_delete" ON storage.objects;
CREATE POLICY "assessment_photos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'assessment-photos'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

-- ========== expense-attachments ==========

-- السماح للمحاسب والأعلى برفع المرفقات
DROP POLICY IF EXISTS "expense_attachments_insert" ON storage.objects;
CREATE POLICY "expense_attachments_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'expense-attachments'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) 
            IN ('admin', 'manager', 'accountant')
    );

-- السماح للمحاسب والأعلى بعرض المرفقات
DROP POLICY IF EXISTS "expense_attachments_select" ON storage.objects;
CREATE POLICY "expense_attachments_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'expense-attachments'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) 
            IN ('admin', 'manager', 'accountant')
    );

-- السماح للأدمن فقط بالحذف
DROP POLICY IF EXISTS "expense_attachments_delete" ON storage.objects;
CREATE POLICY "expense_attachments_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'expense-attachments'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- ========== avatars (public) ==========

-- السماح للمستخدم برفع صورته الشخصية فقط
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- السماح لأي شخص بعرض الصور (bucket عام)
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'avatars');

-- السماح للمستخدم بتحديث صورته فقط
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- السماح للمستخدم بحذف صورته فقط
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ========== documents ==========

-- السماح للأدوار الإدارية برفع المستندات
DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
CREATE POLICY "documents_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) 
            IN ('admin', 'manager', 'accountant', 'engineer')
    );

-- السماح للأدوار الإدارية بعرض المستندات
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
CREATE POLICY "documents_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) 
            IN ('admin', 'manager', 'accountant', 'engineer', 'supervisor')
    );

-- السماح للأدمن والمدير بالحذف
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

-- ============================================================
-- ملخص Buckets المُنشأة:
-- 1. assessment-photos  : صور الفحص الظاهري (خاص، 5MB، صور فقط)
-- 2. expense-attachments: إيصالات المصروفات (خاص، 10MB، صور + PDF)
-- 3. avatars            : الصور الشخصية (عام، 2MB، صور فقط)
-- 4. documents          : مستندات عامة (خاص، 20MB، صور + PDF + Word)
-- ============================================================
