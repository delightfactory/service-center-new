// ============================================================
// Category Service (التصنيفات)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Category } from '@/types/database';

// ============================================================
// Types
// ============================================================

export interface CreateCategoryDTO {
    name: string;
    parent_id?: string | null;
    description?: string;
    sort_order?: number;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {
    is_active?: boolean;
}

export interface CategoryTreeNode extends Category {
    children: CategoryTreeNode[];
    level: number;
    product_count?: number;
}

// ============================================================
// Category Service
// ============================================================

class CategoryService extends BaseService<Category, CreateCategoryDTO, UpdateCategoryDTO> {
    protected tableName = 'categories';
    protected selectColumns = `
    id, name, parent_id, description, sort_order, is_active, created_at
  `;
    protected sortColumn = 'sort_order';

    /**
     * Get all categories as flat list
     */
    async getCategories(): Promise<Category[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('is_active', true)
            .order('sort_order')
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Category[]) || [];
    }

    /**
     * Get categories as tree structure
     */
    async getCategoryTree(): Promise<CategoryTreeNode[]> {
        const categories = await this.getCategories();
        return this.buildTree(categories);
    }

    /**
     * Build tree structure from flat list
     */
    private buildTree(categories: Category[], parentId: string | null = null, level: number = 0): CategoryTreeNode[] {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .map(cat => ({
                ...cat,
                level,
                children: this.buildTree(categories, cat.id, level + 1),
            }));
    }

    /**
     * Get root categories (no parent)
     */
    async getRootCategories(): Promise<Category[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .is('parent_id', null)
            .eq('is_active', true)
            .order('sort_order')
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Category[]) || [];
    }

    /**
     * Get child categories
     */
    async getChildCategories(parentId: string): Promise<Category[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('parent_id', parentId)
            .eq('is_active', true)
            .order('sort_order')
            .order('name');

        if (error) handleSupabaseError(error);
        return (data as unknown as Category[]) || [];
    }

    /**
     * Get category with product count
     */
    async getCategoriesWithProductCount(): Promise<(Category & { product_count: number })[]> {
        const categories = await this.getCategories();

        // Get product counts
        const { data: counts, error } = await supabase
            .from('products')
            .select('category_id')
            .eq('is_active', true);

        if (error) handleSupabaseError(error);

        // Count products per category
        const countMap: Record<string, number> = {};
        (counts || []).forEach(p => {
            if (p.category_id) {
                countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
            }
        });

        return categories.map(cat => ({
            ...cat,
            product_count: countMap[cat.id] || 0,
        }));
    }

    /**
     * Move category to new parent
     */
    async moveCategory(categoryId: string, newParentId: string | null): Promise<Category> {
        // Prevent moving to itself
        if (categoryId === newParentId) {
            throw new Error('لا يمكن نقل التصنيف لنفسه');
        }

        // Prevent circular reference - check if newParentId is a descendant of categoryId
        if (newParentId) {
            const isCircular = await this.isDescendant(newParentId, categoryId);
            if (isCircular) {
                throw new Error('لا يمكن نقل التصنيف إلى أحد تصنيفاته الفرعية');
            }
        }

        return this.update(categoryId, { parent_id: newParentId });
    }

    /**
     * Check if childId is a descendant of parentId (to prevent circular reference)
     */
    private async isDescendant(childId: string, parentId: string): Promise<boolean> {
        // Get all categories
        const categories = await this.getCategories();

        // Build a map for quick lookup
        const categoryMap = new Map(categories.map(c => [c.id, c]));

        // Traverse up from childId to see if we reach parentId
        let currentId: string | null = childId;
        const visited = new Set<string>();

        while (currentId) {
            // Prevent infinite loop
            if (visited.has(currentId)) break;
            visited.add(currentId);

            if (currentId === parentId) {
                return true; // Found circular reference
            }

            const current = categoryMap.get(currentId);
            currentId = current?.parent_id || null;
        }

        return false;
    }

    /**
     * Reorder categories
     */
    async reorderCategories(orderedIds: string[]): Promise<void> {
        const updates = orderedIds.map((id, index) =>
            supabase
                .from(this.tableName)
                .update({ sort_order: index })
                .eq('id', id)
        );

        await Promise.all(updates);
    }
}

export const categoryService = new CategoryService();
export default categoryService;
