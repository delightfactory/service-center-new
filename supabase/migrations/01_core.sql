-- ============================================================
-- نظام إدارة مركز صيانة السيارات - الجداول الأساسية
-- الإصدار: 1.2 (متوافق 100% مع Supabase)
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- يتطلب: 00_enums.sql
-- ============================================================

-- ============================================================
-- 1. جدول الفروع (branches)
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    name text NOT NULL,
    address text,
    phone text,
    is_main boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- إنشاء فهرس للبحث
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(is_active) WHERE is_active = true;

COMMENT ON TABLE branches IS 'الفروع المادية للمركز';

-- ============================================================
-- 2. جدول الملفات الشخصية (profiles)
-- امتداد لجدول auth.users
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text NOT NULL,
    phone text,
    avatar_url text,
    role user_role NOT NULL DEFAULT 'technician',
    branch_id uuid REFERENCES branches(id),
    specialization text,
    hourly_rate numeric(10,2),
    hire_date date,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;

COMMENT ON TABLE profiles IS 'الملفات الشخصية للمستخدمين - امتداد لـ auth.users';

-- ============================================================
-- 3. جدول المخازن (warehouses)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES branches(id),
    code text UNIQUE,
    name text NOT NULL,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_warehouses_branch ON warehouses(branch_id);

COMMENT ON TABLE warehouses IS 'المخازن - مرتبطة بالفروع';

-- ============================================================
-- دوال مساعدة للتحقق من الصلاحيات (RLS Helper Functions)
-- ============================================================

-- دالة للحصول على دور المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة للحصول على فرع المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid AS $$
    SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة للتحقق إذا كان المستخدم أدمن أو مدير
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة للتحقق إذا كان المستخدم يمكنه التعديل
CREATE OR REPLACE FUNCTION public.can_modify()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager', 'supervisor', 'engineer')
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Trigger لتحديث updated_at تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق على الجداول
DROP TRIGGER IF EXISTS set_updated_at ON branches;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- دالة إنشاء Profile للمستخدم الجديد
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_role user_role DEFAULT 'technician';
    v_role_text text;
BEGIN
    -- Try to get role from metadata safely
    v_role_text := NEW.raw_user_meta_data ->> 'role';
    IF v_role_text IS NOT NULL AND v_role_text != '' THEN
        BEGIN
            v_role := v_role_text::user_role;
        EXCEPTION WHEN OTHERS THEN
            v_role := 'technician';
        END;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
        v_role
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail - user can still be created
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger على auth.users لإنشاء Profile تلقائياً
-- ملاحظة: يجب التنفيذ بصلاحيات postgres/service_role
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- دالة توليد الأكواد التلقائية
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_code(prefix text, table_name text)
RETURNS text AS $$
DECLARE
    next_num integer;
    new_code text;
BEGIN
    EXECUTE format('SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM ''[0-9]+$'') AS INTEGER)), 0) + 1 FROM %I WHERE code LIKE $1', table_name)
    INTO next_num
    USING prefix || '%';
    
    new_code := prefix || LPAD(next_num::text, 4, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- تم إنشاء 3 جداول أساسية + 6 دوال مساعدة + 3 تريجرات
-- ============================================================


-- 1. حذف الـ Trigger المشكل نهائياً
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. حذف الـ Function القديمة
DROP FUNCTION IF EXISTS public.handle_new_user();