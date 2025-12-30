// ============================================================
// Product Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    productService,
    CreateProductDTO,
    UpdateProductDTO,
    ProductFilters
} from '@/lib/services';
import { queryKeys } from '../query-keys';
import type { ProductType } from '@/types/enums';

// ============================================================
// Queries
// ============================================================

/**
 * Get products with filters and pagination
 */
export function useProducts(
    params?: { page?: number; limit?: number },
    filters?: ProductFilters
) {
    return useQuery({
        queryKey: queryKeys.products.list({ ...params, ...filters }),
        queryFn: () => productService.getProducts(params, filters),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get single product by ID
 */
export function useProduct(id: string) {
    return useQuery({
        queryKey: queryKeys.products.detail(id),
        queryFn: () => productService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Search products
 */
export function useSearchProducts(query: string, typeFilter?: ProductType | null, limit?: number) {
    return useQuery({
        queryKey: queryKeys.products.search(query),
        queryFn: () => productService.searchProducts(query, typeFilter, limit),
        enabled: query.length >= 2,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get services only
 */
export function useServices() {
    return useQuery({
        queryKey: [...queryKeys.products.all, 'services'],
        queryFn: () => productService.getServices(),
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Get parts only
 */
export function useParts() {
    return useQuery({
        queryKey: [...queryKeys.products.all, 'parts'],
        queryFn: () => productService.getParts(),
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Get product by barcode
 */
export function useProductByBarcode(barcode: string) {
    return useQuery({
        queryKey: [...queryKeys.products.all, 'barcode', barcode],
        queryFn: () => productService.getByBarcode(barcode),
        enabled: !!barcode,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get low stock products
 */
export function useLowStockProducts(warehouseId?: string) {
    return useQuery({
        queryKey: queryKeys.products.lowStock(warehouseId),
        queryFn: () => productService.getLowStockProducts(warehouseId),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get service components
 */
export function useServiceComponents(serviceId: string) {
    return useQuery({
        queryKey: [...queryKeys.products.detail(serviceId), 'components'],
        queryFn: () => productService.getServiceComponents(serviceId),
        enabled: !!serviceId,
        staleTime: 1000 * 60 * 10,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create product mutation
 */
export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateProductDTO) => productService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
    });
}

/**
 * Update product mutation
 */
export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateProductDTO }) =>
            productService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(variables.id) });
        },
    });
}

/**
 * Delete product mutation
 */
export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => productService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
    });
}
