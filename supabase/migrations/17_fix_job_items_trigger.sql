-- ============================================================
-- Migration: Fix log_activity() for tables without 'code' field
-- ============================================================
-- المشكلة: log_activity() تحاول الوصول لـ NEW.code مباشرة
-- لكن بعض الجداول مثل job_items لا تحتوي على هذا الحقل
-- الحل: التحقق من اسم الجدول قبل الوصول للحقل
-- ============================================================

CREATE OR REPLACE FUNCTION log_activity()
RETURNS trigger AS $$
DECLARE
    v_action text;
    v_old_values jsonb;
    v_new_values jsonb;
    v_changed text[];
    v_description text;
    v_entity_code text;
    v_branch_id uuid;
BEGIN
    -- تحديد نوع العملية
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_new_values := to_jsonb(NEW);
        v_description := 'إنشاء ' || TG_TABLE_NAME;
        
        -- استخراج الكود فقط من الجداول التي تحتوي عليه
        v_entity_code := CASE 
            WHEN TG_TABLE_NAME IN ('job_orders', 'assessments', 'invoices', 'payments', 
                                   'expenses', 'customers', 'suppliers', 'products',
                                   'inventory_transactions', 'treasury_transactions') 
            THEN (to_jsonb(NEW) ->> 'code')
            ELSE NULL
        END;
        
        -- استخراج branch_id إن وجد
        v_branch_id := CASE 
            WHEN TG_TABLE_NAME IN ('job_orders', 'assessments', 'invoices', 'payments',
                                   'expenses', 'treasury_transactions') 
            THEN (to_jsonb(NEW) ->> 'branch_id')::uuid
            ELSE NULL
        END;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
        -- حساب الحقول المتغيرة
        SELECT array_agg(key) INTO v_changed
        FROM jsonb_each_text(v_old_values) AS old_kv(key, value)
        WHERE v_new_values ->> key IS DISTINCT FROM old_kv.value
          AND key NOT IN ('updated_at', 'created_at');
        
        v_description := 'تعديل ' || TG_TABLE_NAME;
        
        -- استخراج الكود
        v_entity_code := CASE 
            WHEN TG_TABLE_NAME IN ('job_orders', 'assessments', 'invoices', 'payments', 
                                   'expenses', 'customers', 'suppliers', 'products',
                                   'inventory_transactions', 'treasury_transactions') 
            THEN COALESCE(v_new_values ->> 'code', v_old_values ->> 'code')
            ELSE NULL
        END;
        
        -- استخراج branch_id
        v_branch_id := (COALESCE(v_new_values ->> 'branch_id', v_old_values ->> 'branch_id'))::uuid;
        
        -- تحديد نوع التعديل الخاص
        IF TG_TABLE_NAME = 'job_orders' AND (v_old_values ->> 'status') IS DISTINCT FROM (v_new_values ->> 'status') THEN
            v_action := 'status_change';
            v_description := 'تغيير حالة أمر الشغل من ' || (v_old_values ->> 'status') || ' إلى ' || (v_new_values ->> 'status');
        END IF;
        
        IF TG_TABLE_NAME = 'invoices' AND (v_old_values ->> 'status') IS DISTINCT FROM (v_new_values ->> 'status') THEN
            v_action := 'status_change';
            v_description := 'تغيير حالة الفاتورة من ' || (v_old_values ->> 'status') || ' إلى ' || (v_new_values ->> 'status');
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_old_values := to_jsonb(OLD);
        v_description := 'حذف ' || TG_TABLE_NAME;
        
        v_entity_code := CASE 
            WHEN TG_TABLE_NAME IN ('job_orders', 'assessments', 'invoices', 'payments', 
                                   'expenses', 'customers', 'suppliers', 'products',
                                   'inventory_transactions', 'treasury_transactions') 
            THEN (v_old_values ->> 'code')
            ELSE NULL
        END;
        
        v_branch_id := (v_old_values ->> 'branch_id')::uuid;
    END IF;

    -- إدراج السجل
    INSERT INTO activity_logs (
        action,
        entity_type,
        entity_id,
        entity_code,
        old_values,
        new_values,
        changed_fields,
        description,
        user_id,
        user_name,
        user_role,
        branch_id,
        created_at
    ) VALUES (
        v_action,
        TG_TABLE_NAME,
        COALESCE((to_jsonb(NEW) ->> 'id')::uuid, (to_jsonb(OLD) ->> 'id')::uuid),
        v_entity_code,
        v_old_values,
        v_new_values,
        v_changed,
        v_description,
        auth.uid(),
        (SELECT full_name FROM profiles WHERE id = auth.uid()),
        (SELECT role::text FROM profiles WHERE id = auth.uid()),
        v_branch_id,
        now()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- تم إصلاح log_activity() للتعامل مع جميع الجداول
-- ============================================================
