// ============================================================
// Product Service (المنتجات والخدمات)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Product, Category } from '@/types/database';
import type { ProductType } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateProductDTO {
    name: string;
    code?: string;
    product_type: ProductType;
    category_id?: string | null;
    unit?: string;
    barcode?: string;
    sku?: string;
    description?: string;
    cost_price?: number;
    selling_price: number;
    min_stock?: number;
    max_stock?: number;
    is_trackable?: boolean;
    is_composite?: boolean;
    duration_minutes?: number;
    labor_cost?: number;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
    is_active?: boolean;
}

export interface ProductFilters {
    product_type?: ProductType;
    category_id?: string;
    is_trackable?: boolean;
    is_composite?: boolean;
    is_active?: boolean;
    low_stock?: boolean;
}

export interface ProductWithCategory extends Product {
    category?: Pick<Category, 'id' | 'name'> | null;
}

// ============================================================
// Product Service
// ============================================================

class ProductService extends BaseService<Product, CreateProductDTO, UpdateProductDTO> {
    protected tableName = 'products';
    protected selectColumns = `
    id, code, name, product_type, category_id, unit, barcode, sku,
    description, cost_price, selling_price, min_stock, max_stock,
    is_trackable, is_composite, duration_minutes, labor_cost,
    is_active, created_at, updated_at
  `;
    protected sortColumn = 'name';

    /**
     * Get products with filters
     */
    async getProducts(
        params: Partial<PaginationParams> = {},
        filters: ProductFilters = {}
    ): Promise<PaginatedResponse<ProductWithCategory>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        category:categories (id, name)
      `, { count: 'exact' });

        // Apply filters
        if (filters.product_type) {
            query = query.eq('product_type', filters.product_type);
        }
        if (filters.category_id) {
            query = query.eq('category_id', filters.category_id);
        }
        if (filters.is_trackable !== undefined) {
            query = query.eq('is_trackable', filters.is_trackable);
        }
        if (filters.is_composite !== undefined) {
            query = query.eq('is_composite', filters.is_composite);
        }
        if (filters.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }

        const sortBy = normalizedParams.sortBy || 'name';
        const ascending = normalizedParams.sortOrder === 'asc' || sortBy === 'name';

        query = query
            .range(from, to)
            .order(sortBy, { ascending });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as ProductWithCategory[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Search products
     */
    async searchProducts(query: string, typeFilter?: ProductType | null, limit: number = 20): Promise<Product[]> {
        if (!query.trim()) return [];

        let dbQuery = supabase
            .from(this.tableName)
            .select('id, code, name, product_type, selling_price, unit')
            .or(`name.ilike.%${query}%,code.ilike.%${query}%,barcode.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(limit)
            .order('name');

        if (typeFilter) {
            dbQuery = dbQuery.eq('product_type', typeFilter);
        }

        const { data, error } = await dbQuery;

        if (error) handleSupabaseError(error);
        return data as Product[];
    }

    /**
     * Get services only
     */
    async getServices(): Promise<Product[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, selling_price, duration_minutes, labor_cost, is_composite')
            .eq('product_type', 'service')
            .eq('is_active', true)
            .order('name');

        if (error) handleSupabaseError(error);
        return data as Product[];
    }

    /**
     * Get parts only
     */
    async getParts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('id, code, name, selling_price, unit, min_stock')
            .eq('product_type', 'part')
            .eq('is_active', true)
            .order('name');

        if (error) handleSupabaseError(error);
        return data as Product[];
    }

    /**
     * Get product by barcode
     */
    async getByBarcode(barcode: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('barcode', barcode)
            .single();

        if (error && error.code !== 'PGRST116') handleSupabaseError(error);
        return data as Product | null;
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts(warehouseId?: string): Promise<{
        product: Product;
        current_stock: number;
        min_stock: number;
    }[]> {
        let query = supabase
            .from('inventory_items')
            .select(`
        quantity,
        product:products (id, code, name, min_stock, unit)
      `)
            .gt('products.min_stock', 0);

        if (warehouseId) {
            query = query.eq('warehouse_id', warehouseId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);

        // Filter where quantity < min_stock
        return (data || [])
            .filter(item => item.quantity < (item.product as unknown as Product)?.min_stock)
            .map(item => ({
                product: item.product as unknown as Product,
                current_stock: item.quantity,
                min_stock: (item.product as unknown as Product)?.min_stock || 0,
            }));
    }

    /**
     * Get service components
     */
    async getServiceComponents(serviceId: string): Promise<{
        component: Product;
        quantity: number;
        is_optional: boolean;
    }[]> {
        const { data, error } = await supabase
            .from('service_components')
            .select(`
        quantity,
        is_optional,
        component:products!component_id (id, code, name, product_type, selling_price, unit)
      `)
            .eq('service_id', serviceId);

        if (error) handleSupabaseError(error);

        return (data || []).map(item => ({
            component: item.component as unknown as Product,
            quantity: item.quantity,
            is_optional: item.is_optional,
        }));
    }
}

export const productService = new ProductService();
export default productService;
