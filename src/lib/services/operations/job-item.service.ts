// ============================================================
// Job Item Service (بنود أمر الشغل)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { JobItem, Product } from '@/types/database';
import type { JobItemType } from '@/types/enums';

// ============================================================
// Types
// ============================================================

export interface CreateJobItemDTO {
    job_order_id: string;
    product_id?: string | null;
    item_type: JobItemType;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    external_cost?: number;
    warehouse_id?: string | null;
    notes?: string;
}

export interface UpdateJobItemDTO extends Partial<Omit<CreateJobItemDTO, 'job_order_id'>> {
    is_completed?: boolean;
    completed_at?: string;
    completed_by?: string;
    is_blocked?: boolean;
    blocked_reason?: string;
    returned_quantity?: number;
    return_reason?: string;
}

export interface JobItemWithProduct extends JobItem {
    product?: Pick<Product, 'id' | 'code' | 'name' | 'product_type'> | null;
}

// ============================================================
// Job Item Service
// ============================================================

class JobItemService extends BaseService<JobItem, CreateJobItemDTO, UpdateJobItemDTO> {
    protected tableName = 'job_items';
    protected selectColumns = `
    id, job_order_id, product_id, item_type, description,
    quantity, unit_price, discount_percent, total_price,
    external_cost, is_completed, completed_at, completed_by,
    is_blocked, blocked_reason, returned_quantity, return_reason,
    warehouse_id, sort_order, notes, created_at
  `;
    protected sortColumn = 'sort_order';

    /**
     * Get items by job order with product info
     */
    async getByJobOrder(jobOrderId: string): Promise<JobItemWithProduct[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        product:products (id, code, name, product_type)
      `)
            .eq('job_order_id', jobOrderId)
            .order('sort_order')
            .order('created_at');

        if (error) handleSupabaseError(error);
        return data as unknown as JobItemWithProduct[];
    }

    /**
     * Add item from product
     */
    async addFromProduct(
        jobOrderId: string,
        productId: string,
        quantity: number = 1,
        warehouseId?: string
    ): Promise<JobItem> {
        // Get product details
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, product_type, selling_price')
            .eq('id', productId)
            .single();

        if (productError) handleSupabaseError(productError);

        // Map product type to item type
        const itemTypeMap: Record<string, JobItemType> = {
            part: 'part',
            consumable: 'consumable',
            service: 'labor',
        };

        return this.create({
            job_order_id: jobOrderId,
            product_id: productId,
            item_type: itemTypeMap[product.product_type] || 'part',
            description: product.name,
            quantity,
            unit_price: product.selling_price,
            warehouse_id: warehouseId,
        });
    }

    /**
     * Mark item as completed
     */
    async markAsCompleted(id: string, completedBy: string): Promise<JobItem> {
        return this.update(id, {
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: completedBy,
        });
    }

    /**
     * Block item
     */
    async blockItem(id: string, reason: string): Promise<JobItem> {
        return this.update(id, {
            is_blocked: true,
            blocked_reason: reason,
        });
    }

    /**
     * Unblock item
     */
    async unblockItem(id: string): Promise<JobItem> {
        return this.update(id, {
            is_blocked: false,
            blocked_reason: undefined,
        });
    }

    /**
     * Return item (partial or full)
     */
    async returnItem(id: string, returnedQuantity: number, reason: string): Promise<JobItem> {
        return this.update(id, {
            returned_quantity: returnedQuantity,
            return_reason: reason,
        });
    }

    /**
     * Update item quantity
     */
    async updateQuantity(id: string, quantity: number): Promise<JobItem> {
        return this.update(id, { quantity });
    }

    /**
     * Update item price
     */
    async updatePrice(id: string, unitPrice: number, discountPercent?: number): Promise<JobItem> {
        return this.update(id, {
            unit_price: unitPrice,
            discount_percent: discountPercent,
        });
    }

    /**
     * Reorder items
     */
    async reorderItems(jobOrderId: string, itemIds: string[]): Promise<void> {
        const updates = itemIds.map((id, index) => ({
            id,
            sort_order: index + 1,
        }));

        const { error } = await supabase
            .from(this.tableName)
            .upsert(updates);

        if (error) handleSupabaseError(error);
    }

    /**
     * Get job order totals
     */
    async getJobOrderTotals(jobOrderId: string): Promise<{
        subtotal: number;
        discount: number;
        total: number;
        itemCount: number;
        completedCount: number;
    }> {
        const items = await this.getByJobOrder(jobOrderId);

        let subtotal = 0;
        let discount = 0;
        let completedCount = 0;

        items.forEach(item => {
            const itemTotal = item.quantity * item.unit_price;
            const itemDiscount = itemTotal * (item.discount_percent / 100);
            subtotal += itemTotal;
            discount += itemDiscount;
            if (item.is_completed) completedCount++;
        });

        return {
            subtotal,
            discount,
            total: subtotal - discount,
            itemCount: items.length,
            completedCount,
        };
    }

    /**
     * Delete all items for a job order
     */
    async deleteByJobOrder(jobOrderId: string): Promise<void> {
        const { error } = await supabase
            .from(this.tableName)
            .delete()
            .eq('job_order_id', jobOrderId);

        if (error) handleSupabaseError(error);
    }
}

export const jobItemService = new JobItemService();
export default jobItemService;
