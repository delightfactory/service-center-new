-- ============================================================
-- نظام إدارة مركز صيانة السيارات - ملف الـ ENUMs
-- الإصدار: 1.0
-- التاريخ: 2024-12-25
-- ============================================================
-- هذا الملف قابل لإعادة التشغيل بأمان (Idempotent)
-- ============================================================

-- ============================================================
-- 1. أدوار المستخدمين
-- ============================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'admin',        -- مدير النظام
        'manager',      -- مدير فرع
        'supervisor',   -- مشرف
        'engineer',     -- مهندس استقبال
        'technician',   -- فني
        'warehouse',    -- أمين مخزن
        'accountant'    -- محاسب
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. أنواع العملاء
-- ============================================================
DO $$ BEGIN
    CREATE TYPE customer_type AS ENUM (
        'individual',   -- فرد
        'company'       -- شركة
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. أنواع الدخول
-- ============================================================
DO $$ BEGIN
    CREATE TYPE entry_type AS ENUM (
        'vehicle',      -- سيارة كاملة
        'bench_work',   -- قطعة/كنترول
        'quick_check'   -- كشف سريع
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. حالات تقرير الدخول
-- ============================================================
DO $$ BEGIN
    CREATE TYPE assessment_status AS ENUM (
        'pending',      -- في الانتظار
        'received',     -- تم الاستلام
        'in_workshop'   -- في ساحة العمل
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. تصنيفات أوامر الشغل
-- ============================================================
DO $$ BEGIN
    CREATE TYPE job_category AS ENUM (
        'maintenance',      -- صيانة عامة
        'repair',           -- إصلاح
        'quick_check',      -- كشف سريع
        'bench_repair',     -- إصلاح كنترول
        'body_work',        -- سمكرة ودهان
        'electrical',       -- كهرباء
        'ac_service'        -- تكييف
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. حالات أوامر الشغل
-- ============================================================
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
        'draft',            -- مسودة
        'pending',          -- في الانتظار
        'in_progress',      -- جاري العمل
        'paused',           -- متوقف
        'review',           -- مراجعة فنية
        'completed',        -- مكتمل
        'delivered',        -- تم التسليم
        'cancelled'         -- ملغي
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 7. مستويات الأولوية
-- ============================================================
DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM (
        'low',      -- منخفضة
        'normal',   -- عادية
        'high',     -- عالية
        'urgent'    -- عاجلة
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 8. أنواع بنود أمر الشغل
-- ============================================================
DO $$ BEGIN
    CREATE TYPE job_item_type AS ENUM (
        'labor',        -- عمالة
        'part',         -- قطعة غيار
        'consumable',   -- مستهلك
        'external',     -- خدمة خارجية
        'note',         -- ملاحظة فنية
        'warranty'      -- ضمان
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 9. أنواع المنتجات
-- ============================================================
DO $$ BEGIN
    CREATE TYPE product_type AS ENUM (
        'part',         -- قطعة غيار
        'consumable',   -- مستهلك
        'service'       -- خدمة
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 10. أنواع حركات المخزون
-- ============================================================
DO $$ BEGIN
    CREATE TYPE inventory_tx_type AS ENUM (
        'purchase',         -- شراء
        'sale',             -- بيع
        'job_consumption',  -- استهلاك أمر شغل
        'job_return',       -- إرجاع من أمر شغل
        'transfer_in',      -- تحويل وارد
        'transfer_out',     -- تحويل صادر
        'adjustment',       -- تسوية
        'damage',           -- تالف
        'opening'           -- رصيد افتتاحي
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 11. أنواع الخزينة
-- ============================================================
DO $$ BEGIN
    CREATE TYPE treasury_type AS ENUM (
        'cash',     -- نقدية
        'bank',     -- بنكية
        'pos',      -- نقاط بيع
        'online'    -- إلكترونية
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 12. أنواع حركات الخزينة
-- ============================================================
DO $$ BEGIN
    CREATE TYPE treasury_tx_type AS ENUM (
        'deposit',              -- إيداع
        'withdrawal',           -- سحب
        'transfer_in',          -- تحويل وارد
        'transfer_out',         -- تحويل صادر
        'customer_receipt',     -- تحصيل من عميل
        'supplier_payment',     -- دفع لمورد
        'expense',              -- مصروف
        'income',               -- إيراد
        'opening_balance',      -- رصيد افتتاحي
        'adjustment'            -- تسوية
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 13. حالات التحويل
-- ============================================================
DO $$ BEGIN
    CREATE TYPE transfer_status AS ENUM (
        'pending',      -- في الانتظار
        'approved',     -- معتمد
        'rejected',     -- مرفوض
        'cancelled'     -- ملغي
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 14. أنواع الفواتير
-- ============================================================
DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM (
        'sales',            -- مبيعات
        'purchase',         -- مشتريات
        'sales_return',     -- مرتجع مبيعات
        'purchase_return'   -- مرتجع مشتريات
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 15. حالات الفواتير
-- ============================================================
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'draft',        -- مسودة
        'approved',     -- معتمدة
        'partial',      -- مدفوعة جزئياً
        'paid',         -- مدفوعة بالكامل
        'overdue',      -- متأخرة
        'cancelled'     -- ملغاة
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 16. أنواع المدفوعات
-- ============================================================
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM (
        'customer_receipt',     -- سند قبض من عميل
        'supplier_payment',     -- سند صرف لمورد
        'advance_payment',      -- دفعة مقدمة (عربون)
        'refund_to_customer',   -- مرتجع للعميل
        'refund_from_supplier'  -- مرتجع من مورد
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 17. طرق الدفع
-- ============================================================
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'cash',             -- نقدي
        'card',             -- بطاقة
        'bank_transfer',    -- تحويل بنكي
        'cheque',           -- شيك
        'online'            -- دفع إلكتروني
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 18. حالات المصروفات
-- ============================================================
DO $$ BEGIN
    CREATE TYPE expense_status AS ENUM (
        'pending',      -- في انتظار الاعتماد
        'approved',     -- معتمد
        'paid',         -- مدفوع
        'rejected',     -- مرفوض
        'cancelled'     -- ملغي
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 19. أنواع بنود الحسابات
-- ============================================================
DO $$ BEGIN
    CREATE TYPE account_category_type AS ENUM (
        'income',   -- إيراد
        'expense'   -- مصروف
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 20. أنواع الإشعارات الدائنة/المدينة
-- ============================================================
DO $$ BEGIN
    CREATE TYPE note_type AS ENUM (
        'credit',   -- إشعار دائن
        'debit'     -- إشعار مدين
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 21. حالات الإشعارات الدائنة/المدينة
-- ============================================================
DO $$ BEGIN
    CREATE TYPE note_status AS ENUM (
        'pending',      -- في الانتظار
        'approved',     -- معتمد
        'applied',      -- مطبق
        'cancelled'     -- ملغي
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- تم إنشاء 21 ENUM بنجاح
-- ============================================================
