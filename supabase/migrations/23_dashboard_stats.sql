-- ============================================================
-- Dashboard Statistics RPC Functions - Optimized for Performance
-- Migration: 23_dashboard_stats.sql
-- Date: 2024-12-27
-- ============================================================
-- استخدام RPC functions بدلاً من استعلامات متعددة
-- لتحسين الأداء مع مئات الآلاف من الصفوف
-- ============================================================

-- ============================================================
-- 1. إحصائيات اليوم الموحدة (Single Query)
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_today_stats(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_result JSON;
BEGIN
    SELECT json_build_object(
        -- إحصائيات اليوم
        'today_receptions', (
            SELECT COUNT(*) FROM assessments 
            WHERE created_at::date = v_today
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'yesterday_receptions', (
            SELECT COUNT(*) FROM assessments 
            WHERE created_at::date = v_yesterday
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'in_progress', (
            SELECT COUNT(*) FROM job_orders 
            WHERE status IN ('pending', 'in_progress', 'paused')
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'today_completed', (
            SELECT COUNT(*) FROM job_orders 
            WHERE status = 'completed'
            AND completed_at::date = v_today
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'yesterday_completed', (
            SELECT COUNT(*) FROM job_orders 
            WHERE status = 'completed'
            AND completed_at::date = v_yesterday
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'today_revenue', (
            SELECT COALESCE(SUM(total_amount), 0) FROM invoices 
            WHERE invoice_type = 'sales'
            AND status IN ('approved', 'partial', 'paid')
            AND created_at::date = v_today
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'yesterday_revenue', (
            SELECT COALESCE(SUM(total_amount), 0) FROM invoices 
            WHERE invoice_type = 'sales'
            AND status IN ('approved', 'partial', 'paid')
            AND created_at::date = v_yesterday
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'today_collected', (
            SELECT COALESCE(SUM(amount), 0) FROM payments 
            WHERE payment_type = 'customer_receipt'
            AND payment_date::date = v_today
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'total_receivables', (
            SELECT COALESCE(SUM(remaining_amount), 0) FROM invoices 
            WHERE invoice_type = 'sales'
            AND status IN ('approved', 'partial')
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'total_payables', (
            SELECT COALESCE(SUM(remaining_amount), 0) FROM invoices 
            WHERE invoice_type = 'purchase'
            AND status IN ('approved', 'partial')
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'treasury_balance', (
            SELECT COALESCE(SUM(balance), 0) FROM treasuries 
            WHERE is_active = true
            AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'active_customers', (
            SELECT COUNT(DISTINCT customer_id) FROM job_orders 
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND customer_id IS NOT NULL
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- ============================================================
-- 2. توزيع أوامر الشغل حسب الحالة (Optimized)
-- ============================================================
CREATE OR REPLACE FUNCTION get_jobs_by_status(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(row_to_json(t))
    FROM (
        SELECT 
            status,
            COUNT(*) as count
        FROM job_orders
        WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)
        GROUP BY status
        ORDER BY 
            CASE status
                WHEN 'pending' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'paused' THEN 3
                WHEN 'review' THEN 4
                WHEN 'completed' THEN 5
                WHEN 'delivered' THEN 6
                WHEN 'cancelled' THEN 7
                ELSE 8
            END
    ) t INTO v_result;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================
-- 3. حالة الفنيين مع أوامرهم الحالية
-- ============================================================
CREATE OR REPLACE FUNCTION get_technicians_status(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(row_to_json(t))
    FROM (
        SELECT 
            p.id as technician_id,
            p.full_name,
            p.avatar_url,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM job_technicians jt
                    JOIN job_orders jo ON jo.id = jt.job_order_id
                    WHERE jt.technician_id = p.id 
                    AND jo.status IN ('pending', 'in_progress')
                ) THEN 'busy'
                ELSE 'available'
            END as status,
            (
                SELECT json_build_object(
                    'job_id', jo.id,
                    'job_code', jo.code,
                    'job_status', jo.status
                )
                FROM job_technicians jt
                JOIN job_orders jo ON jo.id = jt.job_order_id
                WHERE jt.technician_id = p.id 
                AND jo.status IN ('pending', 'in_progress')
                ORDER BY jo.created_at DESC
                LIMIT 1
            ) as current_job,
            (   
                SELECT COALESCE(SUM(
                    EXTRACT(EPOCH FROM (
                        COALESCE(jtl.clock_out, NOW()) - jtl.clock_in
                    )) / 3600
                ), 0)
                FROM job_time_logs jtl
                WHERE jtl.technician_id = p.id
                AND jtl.clock_in::date = CURRENT_DATE
            )::numeric(10,2) as hours_today,
            (
                SELECT COUNT(*) FROM job_orders jo
                JOIN job_technicians jt ON jt.job_order_id = jo.id
                WHERE jt.technician_id = p.id
                AND jo.status = 'completed'
                AND jo.completed_at::date = CURRENT_DATE
            ) as completed_today
        FROM profiles p
        WHERE p.role = 'technician'
        AND p.is_active = true
        AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        ORDER BY p.full_name
    ) t INTO v_result;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================
-- 4. الأوامر العاجلة والمتأخرة
-- ============================================================
CREATE OR REPLACE FUNCTION get_urgent_jobs(p_branch_id UUID DEFAULT NULL, p_limit INT DEFAULT 10)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(row_to_json(t))
    FROM (
        SELECT 
            jo.id,
            jo.code,
            jo.status,
            jo.priority,
            jo.created_at,
            jo.updated_at,
            v.plate_number,
            CONCAT(v.make, ' ', v.model) as vehicle_name,
            c.name as customer_name,
            c.phone as customer_phone,
            -- حساب التأخير
            CASE 
                WHEN jo.status = 'paused' THEN 
                    EXTRACT(DAY FROM NOW() - jo.updated_at)::int
                ELSE 0
            END as days_paused,
            -- سبب العجلة
            CASE 
                WHEN jo.priority = 'urgent' THEN 'أولوية عاجلة'
                WHEN jo.priority = 'high' THEN 'أولوية عالية'
                WHEN jo.status = 'paused' AND jo.updated_at < NOW() - INTERVAL '1 day' THEN 'متوقف أكثر من يوم'
                WHEN jo.status = 'pending' AND jo.created_at < NOW() - INTERVAL '2 days' THEN 'في الانتظار أكثر من يومين'
                ELSE 'يحتاج متابعة'
            END as urgency_reason,
            -- الفنيين المعينين
            (
                SELECT json_agg(json_build_object(
                    'id', p.id,
                    'name', p.full_name
                ))
                FROM job_technicians jt
                JOIN profiles p ON p.id = jt.technician_id
                WHERE jt.job_order_id = jo.id
            ) as technicians
        FROM job_orders jo
        LEFT JOIN vehicles v ON v.id = jo.vehicle_id
        LEFT JOIN customers c ON c.id = jo.customer_id
        WHERE (p_branch_id IS NULL OR jo.branch_id = p_branch_id)
        AND jo.status NOT IN ('completed', 'delivered', 'cancelled')
        AND (
            jo.priority IN ('urgent', 'high')
            OR (jo.status = 'paused' AND jo.updated_at < NOW() - INTERVAL '1 day')
            OR (jo.status = 'pending' AND jo.created_at < NOW() - INTERVAL '2 days')
        )
        ORDER BY 
            CASE jo.priority 
                WHEN 'urgent' THEN 1 
                WHEN 'high' THEN 2 
                ELSE 3 
            END,
            jo.updated_at ASC
        LIMIT p_limit
    ) t INTO v_result;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================
-- 5. التنبيهات الذكية
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_alerts(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_alerts JSON[];
    v_low_stock INT;
    v_overdue INT;
    v_stuck INT;
    v_due_today INT;
BEGIN
    -- منتجات تحت الحد الأدنى
    SELECT COUNT(*) INTO v_low_stock
    FROM inventory_items ii
    JOIN products p ON p.id = ii.product_id
    WHERE ii.quantity < COALESCE(p.min_stock, 5)
    AND p.min_stock > 0
    AND (p_branch_id IS NULL OR ii.warehouse_id IN (
        SELECT id FROM warehouses WHERE branch_id = p_branch_id
    ));
    
    IF v_low_stock > 0 THEN
        v_alerts := array_append(v_alerts, json_build_object(
            'type', 'warning',
            'category', 'inventory',
            'message', v_low_stock || ' منتجات تحت الحد الأدنى',
            'count', v_low_stock,
            'link', '/dashboard/inventory'
        ));
    END IF;
    
    -- فواتير متأخرة السداد
    SELECT COUNT(*) INTO v_overdue
    FROM invoices
    WHERE status IN ('approved', 'partial')
    AND due_date < CURRENT_DATE
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
    
    IF v_overdue > 0 THEN
        v_alerts := array_append(v_alerts, json_build_object(
            'type', 'error',
            'category', 'finance',
            'message', v_overdue || ' فواتير متأخرة السداد',
            'count', v_overdue,
            'link', '/dashboard/finance/invoices'
        ));
    END IF;
    
    -- أوامر شغل متعثرة
    SELECT COUNT(*) INTO v_stuck
    FROM job_orders
    WHERE status = 'paused'
    AND updated_at < NOW() - INTERVAL '2 days'
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
    
    IF v_stuck > 0 THEN
        v_alerts := array_append(v_alerts, json_build_object(
            'type', 'warning',
            'category', 'operations',
            'message', v_stuck || ' أوامر شغل متعثرة',
            'count', v_stuck,
            'link', '/dashboard/workshop'
        ));
    END IF;
    
    -- فواتير تستحق اليوم
    SELECT COUNT(*) INTO v_due_today
    FROM invoices
    WHERE status IN ('approved', 'partial')
    AND due_date = CURRENT_DATE
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
    
    IF v_due_today > 0 THEN
        v_alerts := array_append(v_alerts, json_build_object(
            'type', 'info',
            'category', 'finance',
            'message', v_due_today || ' فواتير تستحق اليوم',
            'count', v_due_today,
            'link', '/dashboard/finance/invoices'
        ));
    END IF;
    
    -- إذا لم توجد تنبيهات
    IF array_length(v_alerts, 1) IS NULL THEN
        v_alerts := array_append(v_alerts, json_build_object(
            'type', 'success',
            'category', 'system',
            'message', 'لا توجد تنبيهات - كل شيء على ما يرام!',
            'count', 0,
            'link', NULL
        ));
    END IF;
    
    RETURN array_to_json(v_alerts);
END;
$$;

-- ============================================================
-- 6. آخر تقارير الدخول مع بيانات كاملة
-- ============================================================
CREATE OR REPLACE FUNCTION get_recent_assessments(p_branch_id UUID DEFAULT NULL, p_limit INT DEFAULT 5)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(row_to_json(t))
    FROM (
        SELECT 
            a.id,
            a.code,
            a.entry_type,
            a.status,
            a.created_at,
            v.plate_number,
            CONCAT(v.make, ' ', v.model) as vehicle_name,
            c.name as customer_name,
            c.phone as customer_phone,
            -- هل تم إنشاء أمر شغل؟
            EXISTS (
                SELECT 1 FROM job_orders jo WHERE jo.assessment_id = a.id
            ) as has_job_order
        FROM assessments a
        LEFT JOIN vehicles v ON v.id = a.vehicle_id
        LEFT JOIN customers c ON c.id = a.customer_id
        WHERE (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        ORDER BY a.created_at DESC
        LIMIT p_limit
    ) t INTO v_result;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================
-- 7. Indexes للأداء
-- ============================================================

-- Job Orders
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_orders_branch_status ON job_orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_job_orders_completed_at ON job_orders(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_orders_priority ON job_orders(priority) WHERE priority IN ('urgent', 'high');

-- Assessments
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_assessments_branch_created ON assessments(branch_id, created_at);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE status IN ('approved', 'partial');
CREATE INDEX IF NOT EXISTS idx_invoices_branch_type ON invoices(branch_id, invoice_type);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_branch_type ON payments(branch_id, payment_type);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_items_quantity ON inventory_items(quantity);

-- Job Technicians
CREATE INDEX IF NOT EXISTS idx_job_technicians_tech ON job_technicians(technician_id);

-- Job Time Logs
CREATE INDEX IF NOT EXISTS idx_job_time_logs_tech_date ON job_time_logs(technician_id, clock_in);

-- ============================================================
-- منح الصلاحيات
-- ============================================================
GRANT EXECUTE ON FUNCTION get_dashboard_today_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_jobs_by_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_technicians_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_urgent_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_assessments TO authenticated;
