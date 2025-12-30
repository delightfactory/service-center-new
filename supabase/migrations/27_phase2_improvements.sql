-- ============================================================
-- تحسينات المرحلة 2: تنبيهات المخزون + وظائف مساعدة
-- Migration: 27_phase2_improvements.sql
-- الإصدار: 1.0
-- التاريخ: 2024-12-28
-- ============================================================

-- ============================================================
-- 1. RPC: جلب المنتجات تحت الحد الأدنى للمخزون
-- ============================================================
CREATE OR REPLACE FUNCTION get_low_stock_products(
    p_branch_id UUID DEFAULT NULL,
    p_warehouse_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(row_to_json(t))
    INTO v_result
    FROM (
        SELECT 
            p.id,
            p.code,
            p.name,
            p.product_type,
            p.min_stock,
            p.unit,
            COALESCE(SUM(ii.quantity), 0) as total_quantity,
            COALESCE(SUM(ii.reserved_quantity), 0) as total_reserved,
            COALESCE(SUM(ii.available_quantity), 0) as available_quantity,
            CASE 
                WHEN p.min_stock > 0 THEN 
                    ROUND((COALESCE(SUM(ii.available_quantity), 0) / p.min_stock * 100)::numeric, 1)
                ELSE 100
            END as stock_percentage,
            json_agg(
                json_build_object(
                    'warehouse_id', w.id,
                    'warehouse_name', w.name,
                    'quantity', ii.quantity,
                    'reserved', ii.reserved_quantity,
                    'available', ii.available_quantity
                )
            ) FILTER (WHERE w.id IS NOT NULL) as warehouses
        FROM products p
        LEFT JOIN inventory_items ii ON ii.product_id = p.id
        LEFT JOIN warehouses w ON w.id = ii.warehouse_id
        WHERE 
            p.is_active = true
            AND p.is_trackable = true
            AND p.min_stock > 0
            AND p.product_type IN ('part', 'consumable')
            AND (p_warehouse_id IS NULL OR ii.warehouse_id = p_warehouse_id)
            AND (p_branch_id IS NULL OR w.branch_id = p_branch_id)
        GROUP BY p.id, p.code, p.name, p.product_type, p.min_stock, p.unit
        HAVING COALESCE(SUM(ii.available_quantity), 0) < p.min_stock
        ORDER BY 
            (COALESCE(SUM(ii.available_quantity), 0) / NULLIF(p.min_stock, 0)) ASC,
            p.name ASC
        LIMIT p_limit
    ) t;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================
-- 2. RPC: ملخص حالة المخزون للداشبورد
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_health_summary(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_products', (
            SELECT COUNT(*) FROM products 
            WHERE is_active = true AND is_trackable = true
        ),
        'low_stock_count', (
            SELECT COUNT(DISTINCT p.id)
            FROM products p
            LEFT JOIN inventory_items ii ON ii.product_id = p.id
            LEFT JOIN warehouses w ON w.id = ii.warehouse_id
            WHERE p.is_active = true 
                AND p.is_trackable = true 
                AND p.min_stock > 0
                AND (p_branch_id IS NULL OR w.branch_id = p_branch_id)
            GROUP BY p.id, p.min_stock
            HAVING COALESCE(SUM(ii.available_quantity), 0) < p.min_stock
        ),
        'out_of_stock_count', (
            SELECT COUNT(DISTINCT p.id)
            FROM products p
            LEFT JOIN inventory_items ii ON ii.product_id = p.id
            LEFT JOIN warehouses w ON w.id = ii.warehouse_id
            WHERE p.is_active = true 
                AND p.is_trackable = true
                AND (p_branch_id IS NULL OR w.branch_id = p_branch_id)
            GROUP BY p.id
            HAVING COALESCE(SUM(ii.available_quantity), 0) <= 0
        ),
        'total_value', (
            SELECT COALESCE(SUM(ii.quantity * COALESCE(ii.avg_cost, p.purchase_price, 0)), 0)
            FROM inventory_items ii
            JOIN products p ON p.id = ii.product_id
            LEFT JOIN warehouses w ON w.id = ii.warehouse_id
            WHERE p.is_active = true
                AND (p_branch_id IS NULL OR w.branch_id = p_branch_id)
        ),
        'categories_summary', (
            SELECT json_agg(row_to_json(cat_summary))
            FROM (
                SELECT 
                    c.name as category_name,
                    COUNT(DISTINCT p.id) as product_count,
                    COALESCE(SUM(ii.quantity), 0) as total_quantity,
                    COALESCE(SUM(ii.quantity * COALESCE(ii.avg_cost, p.purchase_price, 0)), 0) as total_value
                FROM categories c
                LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
                LEFT JOIN inventory_items ii ON ii.product_id = p.id
                LEFT JOIN warehouses w ON w.id = ii.warehouse_id
                WHERE (p_branch_id IS NULL OR w.branch_id = p_branch_id)
                GROUP BY c.id, c.name
                HAVING COUNT(DISTINCT p.id) > 0
                ORDER BY total_value DESC
                LIMIT 10
            ) cat_summary
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- ============================================================
-- 3. RPC: تقرير حركات المخزون الأخيرة
-- ============================================================
CREATE OR REPLACE FUNCTION get_recent_inventory_movements(
    p_branch_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(row_to_json(t))
    INTO v_result
    FROM (
        SELECT 
            it.id,
            it.code,
            it.transaction_type,
            it.quantity,
            it.balance_before,
            it.balance_after,
            it.reference_type,
            it.notes,
            it.created_at,
            json_build_object(
                'id', p.id,
                'code', p.code,
                'name', p.name
            ) as product,
            json_build_object(
                'id', w.id,
                'name', w.name
            ) as warehouse
        FROM inventory_transactions it
        JOIN products p ON p.id = it.product_id
        JOIN warehouses w ON w.id = it.warehouse_id
        WHERE (p_branch_id IS NULL OR w.branch_id = p_branch_id)
        ORDER BY it.created_at DESC
        LIMIT p_limit
    ) t;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================
-- 4. RPC: ملخص المالية للفترة
-- ============================================================
CREATE OR REPLACE FUNCTION get_finance_period_summary(
    p_branch_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start DATE := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::date);
    v_end DATE := COALESCE(p_end_date, CURRENT_DATE);
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'period', json_build_object(
            'start_date', v_start,
            'end_date', v_end
        ),
        'revenue', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM invoices
            WHERE invoice_type = 'sales'
                AND status IN ('approved', 'paid', 'partial')
                AND created_at::date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'expenses', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM expenses
            WHERE status IN ('approved', 'paid')
                AND expense_date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'purchases', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM invoices
            WHERE invoice_type = 'purchase'
                AND status IN ('approved', 'paid', 'partial')
                AND created_at::date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'collections', (
            SELECT COALESCE(SUM(amount), 0)
            FROM payments
            WHERE payment_type = 'customer_receipt'
                AND payment_date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'payouts', (
            SELECT COALESCE(SUM(amount), 0)
            FROM payments
            WHERE payment_type = 'supplier_payment'
                AND payment_date BETWEEN v_start AND v_end
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ),
        'receivables', (
            SELECT COALESCE(SUM(balance), 0)
            FROM customers
            WHERE balance > 0
        ),
        'payables', (
            SELECT COALESCE(SUM(balance), 0)
            FROM suppliers
            WHERE balance > 0
        ),
        'treasury_balance', (
            SELECT COALESCE(SUM(balance), 0)
            FROM treasuries
            WHERE is_active = true
                AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- ============================================================
-- 5. إضافة فهارس لتحسين أداء الاستعلامات الجديدة
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_min_stock 
    ON products(min_stock) 
    WHERE min_stock > 0 AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_inventory_items_available 
    ON inventory_items(available_quantity);

CREATE INDEX IF NOT EXISTS idx_expenses_date_status 
    ON expenses(expense_date, status);

-- ============================================================
-- 6. منح الصلاحيات
-- ============================================================
GRANT EXECUTE ON FUNCTION get_low_stock_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_health_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_inventory_movements TO authenticated;
GRANT EXECUTE ON FUNCTION get_finance_period_summary TO authenticated;

-- ============================================================
-- ✅ تم إنشاء:
-- 1. get_low_stock_products - تنبيهات نقص المخزون
-- 2. get_inventory_health_summary - ملخص صحة المخزون
-- 3. get_recent_inventory_movements - آخر حركات المخزون
-- 4. get_finance_period_summary - ملخص المالية للفترة
-- ============================================================

COMMENT ON FUNCTION get_low_stock_products IS 'جلب المنتجات تحت الحد الأدنى للمخزون';
COMMENT ON FUNCTION get_inventory_health_summary IS 'ملخص صحة المخزون للداشبورد';
COMMENT ON FUNCTION get_recent_inventory_movements IS 'آخر حركات المخزون';
COMMENT ON FUNCTION get_finance_period_summary IS 'ملخص المالية للفترة المحددة';
