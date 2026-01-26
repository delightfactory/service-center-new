// ============================================================
// Inventory Service (حركات المخزون)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { InventoryItem, InventoryTransaction, Product } from '@/types/database';
import type { InventoryTxType } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface RecordTransactionDTO {
    product_id: string;
    warehouse_id: string;
    transaction_type: InventoryTxType;
    quantity: number;
    unit_cost?: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
    created_by?: string;
}

export interface TransferItemDTO {
    product_id: string;
    quantity: number;
    unit_cost?: number;
}

export interface InventoryFilters {
    warehouse_id?: string;
    product_id?: string;
    transaction_type?: InventoryTxType;
    reference_type?: string;
    date_from?: string;
    date_to?: string;
}

export interface ProductStock {
    product_id: string;
    product_name: string;
    product_code: string | null;
    stocks: {
        warehouse_id: string;
        warehouse_name: string;
        quantity: number;
        reserved_quantity: number;
        available_quantity: number;
        avg_cost: number;
    }[];
    total_quantity: number;
    total_value: number;
}

// ============================================================
// Inventory Service
// ============================================================

class InventoryService {
    /**
     * Get stock by product across all warehouses
     */
    async getStockByProduct(productId: string): Promise<ProductStock> {
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, code, name')
            .eq('id', productId)
            .single();

        if (productError) handleSupabaseError(productError);

        const { data: stocks, error: stockError } = await supabase
            .from('inventory_items')
            .select(`
        quantity, reserved_quantity, available_quantity, avg_cost,
        warehouse:warehouses (id, name)
      `)
            .eq('product_id', productId);

        if (stockError) handleSupabaseError(stockError);

        const stockList = (stocks || []).map(s => ({
            warehouse_id: (s.warehouse as unknown as { id: string }).id,
            warehouse_name: (s.warehouse as unknown as { name: string }).name,
            quantity: s.quantity,
            reserved_quantity: s.reserved_quantity,
            available_quantity: s.available_quantity,
            avg_cost: s.avg_cost,
        }));

        return {
            product_id: product.id,
            product_name: product.name,
            product_code: product.code,
            stocks: stockList,
            total_quantity: stockList.reduce((sum, s) => sum + s.quantity, 0),
            total_value: stockList.reduce((sum, s) => sum + (s.quantity * s.avg_cost), 0),
        };
    }

    /**
     * Get stock by warehouse
     */
    async getStockByWarehouse(warehouseId: string): Promise<InventoryItem[]> {
        const { data, error } = await supabase
            .from('inventory_items')
            .select(`
        *,
        product:products (id, code, name, unit, min_stock)
      `)
            .eq('warehouse_id', warehouseId)
            .gt('quantity', 0);

        if (error) handleSupabaseError(error);
        return data as unknown as InventoryItem[];
    }

    /**
     * Record a transaction (purchase, sale, adjustment, etc.)
     */
    async recordTransaction(dto: RecordTransactionDTO): Promise<InventoryTransaction> {
        const { data, error } = await supabase
            .from('inventory_transactions')
            .insert({
                product_id: dto.product_id,
                warehouse_id: dto.warehouse_id,
                transaction_type: dto.transaction_type,
                quantity: dto.quantity,
                unit_cost: dto.unit_cost,
                total_cost: dto.unit_cost ? dto.quantity * dto.unit_cost : null,
                reference_type: dto.reference_type,
                reference_id: dto.reference_id,
                notes: dto.notes,
                created_by: dto.created_by,
            })
            .select()
            .single();

        if (error) handleSupabaseError(error);
        return data as InventoryTransaction;
    }

    /**
     * Record purchase (add to inventory)
     */
    async recordPurchase(
        productId: string,
        warehouseId: string,
        quantity: number,
        unitCost: number,
        referenceId?: string,
        notes?: string,
        createdBy?: string
    ): Promise<InventoryTransaction> {
        return this.recordTransaction({
            product_id: productId,
            warehouse_id: warehouseId,
            transaction_type: 'purchase',
            quantity,
            unit_cost: unitCost,
            reference_type: referenceId ? 'invoice' : undefined,
            reference_id: referenceId,
            notes,
            created_by: createdBy,
        });
    }

    /**
     * Record job consumption (deduct from inventory)
     */
    async recordJobConsumption(
        productId: string,
        warehouseId: string,
        quantity: number,
        jobOrderId: string,
        createdBy?: string
    ): Promise<InventoryTransaction> {
        return this.recordTransaction({
            product_id: productId,
            warehouse_id: warehouseId,
            transaction_type: 'job_consumption',
            quantity,
            reference_type: 'job_order',
            reference_id: jobOrderId,
            created_by: createdBy,
        });
    }

    /**
     * Record job return (add back to inventory)
     */
    async recordJobReturn(
        productId: string,
        warehouseId: string,
        quantity: number,
        jobOrderId: string,
        reason?: string,
        createdBy?: string
    ): Promise<InventoryTransaction> {
        return this.recordTransaction({
            product_id: productId,
            warehouse_id: warehouseId,
            transaction_type: 'job_return',
            quantity,
            reference_type: 'job_order',
            reference_id: jobOrderId,
            notes: reason,
            created_by: createdBy,
        });
    }

    /**
 * Record stock adjustment
 */
    async recordAdjustment(
        productId: string,
        warehouseId: string,
        newQuantity: number,
        reason: string,
        createdBy?: string
    ): Promise<InventoryTransaction> {
        // Get current quantity
        const { data: current, error: currentError } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('product_id', productId)
            .eq('warehouse_id', warehouseId)
            .single();

        if (currentError && currentError.code !== 'PGRST116') handleSupabaseError(currentError);

        const currentQty = current?.quantity || 0;
        const difference = newQuantity - currentQty;

        if (difference === 0) {
            throw new Error('الكمية الجديدة مساوية للكمية الحالية');
        }

        // Use 'adjustment' for increase (adds to quantity)
        // Use 'damage' for decrease (subtracts from quantity)
        // This is because the trigger in 04_inventory.sql treats 'adjustment' as addition
        // and treats other types (like 'damage') as subtraction
        const transactionType = difference > 0 ? 'adjustment' : 'damage';

        return this.recordTransaction({
            product_id: productId,
            warehouse_id: warehouseId,
            transaction_type: transactionType,
            quantity: Math.abs(difference),
            notes: `تسوية جرد: ${reason}. من ${currentQty} إلى ${newQuantity} (${difference > 0 ? '+' : ''}${difference})`,
            created_by: createdBy,
        });
    }

    /**
     * Transfer between warehouses
     */
    async transfer(
        fromWarehouseId: string,
        toWarehouseId: string,
        items: TransferItemDTO[],
        notes?: string,
        createdBy?: string
    ): Promise<void> {
        for (const item of items) {
            // Record outgoing
            await this.recordTransaction({
                product_id: item.product_id,
                warehouse_id: fromWarehouseId,
                transaction_type: 'transfer_out',
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                reference_type: 'transfer',
                notes,
                created_by: createdBy,
            });

            // Record incoming
            await this.recordTransaction({
                product_id: item.product_id,
                warehouse_id: toWarehouseId,
                transaction_type: 'transfer_in',
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                reference_type: 'transfer',
                notes,
                created_by: createdBy,
            });
        }
    }

    /**
     * Get inventory transactions with filters
     */
    async getTransactions(
        params: Partial<PaginationParams> = {},
        filters: InventoryFilters = {}
    ): Promise<PaginatedResponse<InventoryTransaction>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from('inventory_transactions')
            .select(`
        *,
        product:products (id, code, name),
        warehouse:warehouses (id, name)
      `, { count: 'exact' });

        // Apply filters
        if (filters.warehouse_id) {
            query = query.eq('warehouse_id', filters.warehouse_id);
        }
        if (filters.product_id) {
            query = query.eq('product_id', filters.product_id);
        }
        if (filters.transaction_type) {
            query = query.eq('transaction_type', filters.transaction_type);
        }
        if (filters.reference_type) {
            query = query.eq('reference_type', filters.reference_type);
        }
        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to);
        }

        query = query
            .range(from, to)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as InventoryTransaction[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get transactions by reference
     */
    async getByReference(referenceType: string, referenceId: string): Promise<InventoryTransaction[]> {
        const { data, error } = await supabase
            .from('inventory_transactions')
            .select('*')
            .eq('reference_type', referenceType)
            .eq('reference_id', referenceId)
            .order('created_at');

        if (error) handleSupabaseError(error);
        return data as InventoryTransaction[];
    }

    /**
     * Check if product has sufficient stock
     */
    async hasStock(productId: string, warehouseId: string, requiredQuantity: number): Promise<boolean> {
        const { data, error } = await supabase
            .from('inventory_items')
            .select('available_quantity')
            .eq('product_id', productId)
            .eq('warehouse_id', warehouseId)
            .single();

        if (error) return false;
        return (data?.available_quantity || 0) >= requiredQuantity;
    }

    /**
     * Reserve stock for job order
     */
    async reserveStock(productId: string, warehouseId: string, quantity: number): Promise<void> {
        const { data: item, error: itemError } = await supabase
            .from('inventory_items')
            .select('quantity, reserved_quantity')
            .eq('product_id', productId)
            .eq('warehouse_id', warehouseId)
            .maybeSingle();

        if (itemError) handleSupabaseError(itemError);

        let currentQty = item?.quantity ?? 0;
        let currentReserved = item?.reserved_quantity ?? 0;

        if (!item) {
            const { error: insertError } = await supabase
                .from('inventory_items')
                .insert({
                    product_id: productId,
                    warehouse_id: warehouseId,
                    quantity: 0,
                    reserved_quantity: 0,
                });

            if (insertError) handleSupabaseError(insertError);
        }

        const newReserved = currentReserved + quantity;
        const balanceBefore = currentQty - currentReserved;
        const balanceAfter = currentQty - newReserved;

        const { error: updateError } = await supabase
            .from('inventory_items')
            .update({
                reserved_quantity: newReserved,
                last_updated: new Date().toISOString(),
            })
            .eq('product_id', productId)
            .eq('warehouse_id', warehouseId);

        if (updateError) handleSupabaseError(updateError);

        const { error: txError } = await supabase
            .from('inventory_transactions')
            .insert({
                product_id: productId,
                warehouse_id: warehouseId,
                transaction_type: 'reservation',
                quantity,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                reference_type: 'manual_reservation',
                notes: 'حجز يدوي من النظام',
            });

        if (txError) handleSupabaseError(txError);
    }

    /**
     * Release reserved stock
     */
    async releaseReserve(productId: string, warehouseId: string, quantity: number): Promise<void> {
        const { data: item, error: itemError } = await supabase
            .from('inventory_items')
            .select('quantity, reserved_quantity')
            .eq('product_id', productId)
            .eq('warehouse_id', warehouseId)
            .maybeSingle();

        if (itemError) handleSupabaseError(itemError);
        if (!item) return;

        const currentQty = item.quantity ?? 0;
        const currentReserved = item.reserved_quantity ?? 0;
        const newReserved = Math.max(0, currentReserved - quantity);
        const balanceBefore = currentQty - currentReserved;
        const balanceAfter = currentQty - newReserved;

        const { error: updateError } = await supabase
            .from('inventory_items')
            .update({
                reserved_quantity: newReserved,
                last_updated: new Date().toISOString(),
            })
            .eq('product_id', productId)
            .eq('warehouse_id', warehouseId);

        if (updateError) handleSupabaseError(updateError);

        const { error: txError } = await supabase
            .from('inventory_transactions')
            .insert({
                product_id: productId,
                warehouse_id: warehouseId,
                transaction_type: 'release_reservation',
                quantity,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                reference_type: 'manual_reservation',
                notes: 'تحرير حجز يدوي من النظام',
            });

        if (txError) handleSupabaseError(txError);
    }
}

export const inventoryService = new InventoryService();
export default inventoryService;
