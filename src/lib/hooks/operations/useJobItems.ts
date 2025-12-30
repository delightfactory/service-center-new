// ============================================================
// Job Item Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobItemService, CreateJobItemDTO, UpdateJobItemDTO } from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get job items by job order
 */
export function useJobItems(jobOrderId: string) {
    return useQuery({
        queryKey: queryKeys.jobItems.byJobOrder(jobOrderId),
        queryFn: () => jobItemService.getByJobOrder(jobOrderId),
        enabled: !!jobOrderId,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get job order totals
 */
export function useJobOrderTotals(jobOrderId: string) {
    return useQuery({
        queryKey: [...queryKeys.jobItems.byJobOrder(jobOrderId), 'totals'],
        queryFn: () => jobItemService.getJobOrderTotals(jobOrderId),
        enabled: !!jobOrderId,
        staleTime: 1000 * 60 * 2,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create job item mutation
 */
export function useCreateJobItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateJobItemDTO) => jobItemService.create(data),
        onSuccess: (item) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(item.job_order_id)
            });
        },
    });
}

/**
 * Add item from product
 */
export function useAddItemFromProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            jobOrderId,
            productId,
            quantity,
            warehouseId,
        }: {
            jobOrderId: string;
            productId: string;
            quantity?: number;
            warehouseId?: string;
        }) => jobItemService.addFromProduct(jobOrderId, productId, quantity, warehouseId),
        onSuccess: (item) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(item.job_order_id)
            });
        },
    });
}

/**
 * Update job item mutation
 */
export function useUpdateJobItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateJobItemDTO; jobOrderId: string }) =>
            jobItemService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
        },
    });
}

/**
 * Mark item as completed
 */
export function useMarkItemCompleted() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, completedBy, jobOrderId }: { id: string; completedBy: string; jobOrderId: string }) =>
            jobItemService.markAsCompleted(id, completedBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobOrders.detail(variables.jobOrderId)
            });
        },
    });
}

/**
 * Block item
 */
export function useBlockItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason, jobOrderId }: { id: string; reason: string; jobOrderId: string }) =>
            jobItemService.blockItem(id, reason),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
        },
    });
}

/**
 * Unblock item
 */
export function useUnblockItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, jobOrderId }: { id: string; jobOrderId: string }) =>
            jobItemService.unblockItem(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
        },
    });
}

/**
 * Return item
 */
export function useReturnItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            returnedQuantity,
            reason,
            jobOrderId,
        }: {
            id: string;
            returnedQuantity: number;
            reason: string;
            jobOrderId: string;
        }) => jobItemService.returnItem(id, returnedQuantity, reason),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
        },
    });
}

/**
 * Update item quantity
 */
export function useUpdateItemQuantity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, quantity, jobOrderId }: { id: string; quantity: number; jobOrderId: string }) =>
            jobItemService.updateQuantity(id, quantity),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
        },
    });
}

/**
 * Delete job item mutation
 */
export function useDeleteJobItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, jobOrderId }: { id: string; jobOrderId: string }) =>
            jobItemService.delete(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobItems.byJobOrder(variables.jobOrderId)
            });
        },
    });
}
