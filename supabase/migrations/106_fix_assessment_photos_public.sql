-- ============================================================
-- إصلاح bucket صور الفحص ليكون public للقراءة
-- ============================================================
-- التاريخ: 2026-02-04
-- الهدف: السماح بعرض صور الفحص بدون signed URLs
-- ============================================================

-- تحديث bucket assessment-photos ليكون public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'assessment-photos';

-- ملاحظة: سياسات الرفع ستبقى كما هي (للمصادقين فقط)
-- لكن سياسة القراءة ستكون public

-- تحديث سياسة القراءة لتكون public
DROP POLICY IF EXISTS "assessment_photos_select" ON storage.objects;
CREATE POLICY "assessment_photos_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'assessment-photos');
