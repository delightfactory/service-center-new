// ============================================================
// Supplier Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService, CreateSupplierDTO, UpdateSupplierDTO } from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get suppliers with pagination
 */
export function useSuppliers(
    params?: { page?: number; limit?: number },
    activeOnly: boolean = true
) {
    return useQuery({
        queryKey: queryKeys.suppliers.list({ ...params, activeOnly }),
        queryFn: () => supplierService.getSuppliers(params, activeOnly),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get single supplier by ID
 */
export function useSupplier(id: string) {
    return useQuery({
        queryKey: queryKeys.suppliers.detail(id),
        queryFn: () => supplierService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get active suppliers for dropdown
 */
export function useActiveSuppliers() {
    return useQuery({
        queryKey: [...queryKeys.suppliers.all, 'active'],
        queryFn: () => supplierService.getActiveSuppliers(),
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Search suppliers
 */
export function useSearchSuppliers(query: string, limit?: number) {
    return useQuery({
        queryKey: queryKeys.suppliers.search(query),
        queryFn: () => supplierService.searchSuppliers(query, limit),
        enabled: query.length >= 2,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get suppliers with outstanding balance
 */
export function useSuppliersWithBalance() {
    return useQuery({
        queryKey: queryKeys.suppliers.withBalance,
        queryFn: () => supplierService.getSuppliersWithBalance(),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get supplier purchase history
 */
export function useSupplierPurchaseHistory(supplierId: string, limit?: number) {
    return useQuery({
        queryKey: [...queryKeys.suppliers.detail(supplierId), 'purchases'],
        queryFn: () => supplierService.getPurchaseHistory(supplierId, limit),
        enabled: !!supplierId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get supplier statement of account
 */
export function useSupplierStatement(
    supplierId: string,
    dateFrom?: string,
    dateTo?: string
) {
    return useQuery({
        queryKey: [...queryKeys.suppliers.detail(supplierId), 'statement', dateFrom, dateTo],
        queryFn: () => supplierService.getStatementOfAccount(supplierId, dateFrom, dateTo),
        enabled: !!supplierId,
        staleTime: 1000 * 60 * 5,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create supplier mutation
 */
export function useCreateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateSupplierDTO) => supplierService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
        },
    });
}

/**
 * Update supplier mutation
 */
export function useUpdateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateSupplierDTO }) =>
            supplierService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(variables.id) });
        },
    });
}

/**
 * Delete supplier mutation
 */
export function useDeleteSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => supplierService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
        },
    });
}

/**
 * Recalculate supplier balance mutation
 */
export function useRecalculateSupplierBalance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (supplierId: string) => supplierService.recalculateBalance(supplierId),
        onSuccess: (_, supplierId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplierId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.withBalance });
        },
    });
}
