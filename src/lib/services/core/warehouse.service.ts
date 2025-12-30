// ============================================================
// Warehouse Service (المخازن)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Warehouse, InventoryItem, Product } from '@/types/database';

// ============================================================
// Types
// ============================================================

export interface CreateWarehouseDTO {
    name: string;
    code?: string;
    branch_id: string;
    is_default?: boolean;
}

export interface UpdateWarehouseDTO extends Partial<CreateWarehouseDTO> {
    is_active?: boolean;
}

export interface WarehouseStockItem {
    product: Pick<Product, 'id' | 'code' | 'name' | 'product_type' | 'unit' | 'min_stock'>;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    avg_cost: number;
    total_value: number;
    is_low_stock: boolean;
}

// ============================================================
// Warehouse Service
// ============================================================

class WarehouseService extends BaseService<Warehouse, CreateWarehouseDTO, UpdateWarehouseDTO> {
    protected tableName = 'warehouses';
    protected selectColumns = `
    id, branch_id, code, name, is_default, is_active, created_at
  `;
    protected sortColumn = 'name';

    /**
     * Get warehouses by branch
     */
    async getByBranch(branchId: string): Promise<Warehouse[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Warehouse[]) || [];
    }

    /**
     * Get default warehouse for branch
     */
    async getDefaultWarehouse(branchId: string): Promise<Warehouse | null> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('branch_id', branchId)
            .eq('is_default', true)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') handleSupabaseError(error);
        return data as Warehouse | null;
    }

    /**
     * Set warehouse as default
     */
    async setAsDefault(warehouseId: string): Promise<Warehouse> {
        const warehouse = await this.getById(warehouseId);

        // Unset all default in same branch
        await supabase
            .from(this.tableName)
            .update({ is_default: false })
            .eq('branch_id', warehouse.branch_id)
            .eq('is_default', true);

        return this.update(warehouseId, { is_default: true });
    }

    /**
     * Get stock report for warehouse
     */
    async getStockReport(warehouseId: string): Promise<WarehouseStockItem[]> {
        const { data, error } = await supabase
            .from('inventory_items')
            .select(`
        quantity, reserved_quantity, available_quantity, avg_cost,
        product:products (id, code, name, product_type, unit, min_stock)
      `)
            .eq('warehouse_id', warehouseId)
            .gt('quantity', 0)
            .order('products.name');

        if (error) handleSupabaseError(error);

        return (data || []).map(item => ({
            product: item.product as unknown as WarehouseStockItem['product'],
            quantity: item.quantity,
            reserved_quantity: item.reserved_quantity,
            available_quantity: item.available_quantity,
            avg_cost: item.avg_cost,
            total_value: item.quantity * item.avg_cost,
            is_low_stock: item.quantity <= (item.product as unknown as Product)?.min_stock,
        }));
    }

    /**
     * Get low stock items in warehouse
     */
    async getLowStockItems(warehouseId: string): Promise<WarehouseStockItem[]> {
        const report = await this.getStockReport(warehouseId);
        return report.filter(item => item.is_low_stock);
    }

    /**
     * Get total inventory value for warehouse
     */
    async getTotalValue(warehouseId: string): Promise<number> {
        const { data, error } = await supabase
            .from('inventory_items')
            .select('quantity, avg_cost')
            .eq('warehouse_id', warehouseId);

        if (error) handleSupabaseError(error);

        return (data || []).reduce(
            (sum, item) => sum + (item.quantity * item.avg_cost),
            0
        );
    }
}

export const warehouseService = new WarehouseService();
export default warehouseService;
