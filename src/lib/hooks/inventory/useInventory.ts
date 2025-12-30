// ============================================================
// Inventory Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    inventoryService,
    RecordTransactionDTO,
    TransferItemDTO,
    InventoryFilters
} from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get stock by product across all warehouses
 */
export function useProductStock(productId: string) {
    return useQuery({
        queryKey: queryKeys.inventory.byProduct(productId),
        queryFn: () => inventoryService.getStockByProduct(productId),
        enabled: !!productId,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get stock by warehouse
 */
export function useWarehouseStock(warehouseId: string) {
    return useQuery({
        queryKey: queryKeys.inventory.byWarehouse(warehouseId),
        queryFn: () => inventoryService.getStockByWarehouse(warehouseId),
        enabled: !!warehouseId,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get inventory transactions with filters
 */
export function useInventoryTransactions(
    params?: { page?: number; limit?: number },
    filters?: InventoryFilters
) {
    return useQuery({
        queryKey: queryKeys.inventory.transactions({ ...params, ...filters }),
        queryFn: () => inventoryService.getTransactions(params, filters),
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get transactions by reference
 */
export function useTransactionsByReference(referenceType: string, referenceId: string) {
    return useQuery({
        queryKey: [...queryKeys.inventory.all, 'reference', referenceType, referenceId],
        queryFn: () => inventoryService.getByReference(referenceType, referenceId),
        enabled: !!referenceType && !!referenceId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Check if product has sufficient stock
 */
export function useHasStock(productId: string, warehouseId: string, requiredQuantity: number) {
    return useQuery({
        queryKey: [...queryKeys.inventory.all, 'hasStock', productId, warehouseId, requiredQuantity],
        queryFn: () => inventoryService.hasStock(productId, warehouseId, requiredQuantity),
        enabled: !!productId && !!warehouseId && requiredQuantity > 0,
        staleTime: 1000 * 60 * 1,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Record inventory transaction
 */
export function useRecordTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: RecordTransactionDTO) => inventoryService.recordTransaction(dto),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byProduct(variables.product_id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.warehouse_id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions({}) });
        },
    });
}

/**
 * Record purchase (add to inventory)
 */
export function useRecordPurchase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            productId,
            warehouseId,
            quantity,
            unitCost,
            referenceId,
            notes,
            createdBy,
        }: {
            productId: string;
            warehouseId: string;
            quantity: number;
            unitCost: number;
            referenceId?: string;
            notes?: string;
            createdBy?: string;
        }) => inventoryService.recordPurchase(productId, warehouseId, quantity, unitCost, referenceId, notes, createdBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byProduct(variables.productId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.warehouseId) });
        },
    });
}

/**
 * Record job consumption (deduct from inventory)
 */
export function useRecordJobConsumption() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            productId,
            warehouseId,
            quantity,
            jobOrderId,
            createdBy,
        }: {
            productId: string;
            warehouseId: string;
            quantity: number;
            jobOrderId: string;
            createdBy?: string;
        }) => inventoryService.recordJobConsumption(productId, warehouseId, quantity, jobOrderId, createdBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byProduct(variables.productId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.warehouseId) });
        },
    });
}

/**
 * Record job return (add back to inventory)
 */
export function useRecordJobReturn() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            productId,
            warehouseId,
            quantity,
            jobOrderId,
            reason,
            createdBy,
        }: {
            productId: string;
            warehouseId: string;
            quantity: number;
            jobOrderId: string;
            reason?: string;
            createdBy?: string;
        }) => inventoryService.recordJobReturn(productId, warehouseId, quantity, jobOrderId, reason, createdBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byProduct(variables.productId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.warehouseId) });
        },
    });
}

/**
 * Record stock adjustment
 */
export function useRecordAdjustment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            productId,
            warehouseId,
            newQuantity,
            reason,
            createdBy,
        }: {
            productId: string;
            warehouseId: string;
            newQuantity: number;
            reason: string;
            createdBy?: string;
        }) => inventoryService.recordAdjustment(productId, warehouseId, newQuantity, reason, createdBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byProduct(variables.productId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.warehouseId) });
        },
    });
}

/**
 * Transfer between warehouses
 */
export function useTransferStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            fromWarehouseId,
            toWarehouseId,
            items,
            notes,
            createdBy,
        }: {
            fromWarehouseId: string;
            toWarehouseId: string;
            items: TransferItemDTO[];
            notes?: string;
            createdBy?: string;
        }) => inventoryService.transfer(fromWarehouseId, toWarehouseId, items, notes, createdBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.fromWarehouseId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byWarehouse(variables.toWarehouseId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions({}) });
        },
    });
}
