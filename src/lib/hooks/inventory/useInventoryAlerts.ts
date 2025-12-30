// ============================================================
// Inventory Hooks (المخزون)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

// ============================================================
// Types
// ============================================================

export interface LowStockProduct {
    id: string;
    code: string;
    name: string;
    product_type: string;
    min_stock: number;
    unit: string;
    total_quantity: number;
    total_reserved: number;
    available_quantity: number;
    stock_percentage: number;
    warehouses: {
        warehouse_id: string;
        warehouse_name: string;
        quantity: number;
        reserved: number;
        available: number;
    }[];
}

export interface InventoryHealthSummary {
    total_products: number;
    low_stock_count: number;
    out_of_stock_count: number;
    total_value: number;
    categories_summary: {
        category_name: string;
        product_count: number;
        total_quantity: number;
        total_value: number;
    }[];
}

export interface InventoryMovement {
    id: string;
    code: string;
    transaction_type: string;
    quantity: number;
    balance_before: number;
    balance_after: number;
    reference_type: string;
    notes: string;
    created_at: string;
    product: {
        id: string;
        code: string;
        name: string;
    };
    warehouse: {
        id: string;
        name: string;
    };
}

export interface FinancePeriodSummary {
    period: {
        start_date: string;
        end_date: string;
    };
    revenue: number;
    expenses: number;
    purchases: number;
    collections: number;
    payouts: number;
    receivables: number;
    payables: number;
    treasury_balance: number;
}

// ============================================================
// Query Keys
// ============================================================

export const inventoryQueryKeys = {
    lowStock: (branchId?: string, warehouseId?: string) =>
        ['low-stock-products', branchId, warehouseId] as const,
    healthSummary: (branchId?: string) =>
        ['inventory-health-summary', branchId] as const,
    recentMovements: (branchId?: string) =>
        ['recent-inventory-movements', branchId] as const,
    financeSummary: (branchId?: string, startDate?: string, endDate?: string) =>
        ['finance-period-summary', branchId, startDate, endDate] as const,
};

// ============================================================
// Hooks
// ============================================================

/**
 * Hook لجلب المنتجات تحت الحد الأدنى للمخزون (نسخة محسنة)
 */
export function useLowStockAlerts(options?: {
    branchId?: string;
    warehouseId?: string;
    limit?: number;
    enabled?: boolean;
}) {
    const { branchId, warehouseId, limit = 50, enabled = true } = options || {};

    return useQuery({
        queryKey: inventoryQueryKeys.lowStock(branchId, warehouseId),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_low_stock_products', {
                p_branch_id: branchId || null,
                p_warehouse_id: warehouseId || null,
                p_limit: limit,
            });

            if (error) throw error;
            return (data as LowStockProduct[]) || [];
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchInterval: 10 * 60 * 1000, // 10 minutes
    });
}

/**
 * Hook لجلب ملخص صحة المخزون
 */
export function useInventoryHealthSummary(branchId?: string) {
    return useQuery({
        queryKey: inventoryQueryKeys.healthSummary(branchId),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_inventory_health_summary', {
                p_branch_id: branchId || null,
            });

            if (error) throw error;
            return data as InventoryHealthSummary;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook لجلب آخر حركات المخزون
 */
export function useRecentInventoryMovements(options?: {
    branchId?: string;
    limit?: number;
}) {
    const { branchId, limit = 20 } = options || {};

    return useQuery({
        queryKey: inventoryQueryKeys.recentMovements(branchId),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_recent_inventory_movements', {
                p_branch_id: branchId || null,
                p_limit: limit,
            });

            if (error) throw error;
            return (data as InventoryMovement[]) || [];
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Hook لجلب ملخص المالية للفترة
 */
export function useFinancePeriodSummary(options?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
}) {
    const { branchId, startDate, endDate } = options || {};

    return useQuery({
        queryKey: inventoryQueryKeys.financeSummary(branchId, startDate, endDate),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_finance_period_summary', {
                p_branch_id: branchId || null,
                p_start_date: startDate || null,
                p_end_date: endDate || null,
            });

            if (error) throw error;
            return data as FinancePeriodSummary;
        },
        staleTime: 5 * 60 * 1000,
    });
}
