// ============================================================
// Job Order Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    jobOrderService,
    CreateJobOrderDTO,
    UpdateJobOrderDTO,
    JobOrderFilters
} from '@/lib/services';
import { queryKeys } from '../query-keys';
import type { JobStatus } from '@/types/enums';

// ============================================================
// Queries
// ============================================================

/**
 * Get job orders with filters and pagination
 */
export function useJobOrders(
    params?: { page?: number; limit?: number },
    filters?: JobOrderFilters
) {
    return useQuery({
        queryKey: queryKeys.jobOrders.list({ ...params, ...filters }),
        queryFn: () => jobOrderService.getJobOrders(params, filters),
        staleTime: 1000 * 60 * 2, // 2 minutes - job orders change frequently
    });
}

/**
 * Get single job order by ID
 */
export function useJobOrder(id: string) {
    return useQuery({
        queryKey: queryKeys.jobOrders.detail(id),
        queryFn: () => jobOrderService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get job order with full details (items, technicians)
 */
export function useJobOrderDetail(id: string) {
    return useQuery({
        queryKey: [...queryKeys.jobOrders.detail(id), 'full'],
        queryFn: () => jobOrderService.getJobOrderDetail(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get active job orders
 */
export function useActiveJobOrders(branchId?: string) {
    return useQuery({
        queryKey: queryKeys.jobOrders.active(branchId),
        queryFn: () => jobOrderService.getActiveJobOrders(branchId),
        staleTime: 1000 * 60 * 1, // 1 minute
        refetchInterval: 1000 * 60 * 2, // Auto-refetch every 2 minutes
    });
}

/**
 * Get job orders by status
 */
export function useJobOrdersByStatus(status: JobStatus | JobStatus[], branchId?: string) {
    return useQuery({
        queryKey: queryKeys.jobOrders.byStatus(Array.isArray(status) ? status.join(',') : status),
        queryFn: () => jobOrderService.getJobOrders({}, { status, branch_id: branchId }),
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get job orders by technician
 */
export function useJobOrdersByTechnician(technicianId: string, activeOnly?: boolean) {
    return useQuery({
        queryKey: queryKeys.jobOrders.byTechnician(technicianId),
        queryFn: () => jobOrderService.getByTechnician(technicianId, activeOnly),
        enabled: !!technicianId,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get job order status summary for dashboard
 */
export function useJobOrderStatusSummary(branchId?: string) {
    return useQuery({
        queryKey: [...queryKeys.jobOrders.all, 'summary', branchId],
        queryFn: () => jobOrderService.getStatusSummary(branchId),
        staleTime: 1000 * 60 * 2,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create job order mutation
 */
export function useCreateJobOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateJobOrderDTO) => jobOrderService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.all });
        },
    });
}

/**
 * Update job order mutation
 */
export function useUpdateJobOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateJobOrderDTO }) =>
            jobOrderService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.detail(variables.id) });
        },
    });
}

/**
 * Update job order status mutation
 */
export function useUpdateJobOrderStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status, userId }: { id: string; status: JobStatus; userId?: string }) =>
            jobOrderService.updateStatus(id, status, userId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.detail(variables.id) });
        },
    });
}

/**
 * Assign technician to job order
 */
export function useAssignTechnician() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            jobOrderId,
            technicianId,
            isLead,
            assignedBy,
        }: {
            jobOrderId: string;
            technicianId: string;
            isLead?: boolean;
            assignedBy?: string;
        }) => jobOrderService.assignTechnician(jobOrderId, technicianId, isLead, assignedBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.detail(variables.jobOrderId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.byTechnician(variables.technicianId) });
        },
    });
}

/**
 * Remove technician from job order
 */
export function useRemoveTechnician() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            jobOrderId,
            technicianId,
        }: {
            jobOrderId: string;
            technicianId: string;
        }) => jobOrderService.removeTechnician(jobOrderId, technicianId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.detail(variables.jobOrderId) });
        },
    });
}

/**
 * Delete job order mutation
 */
export function useDeleteJobOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => jobOrderService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.jobOrders.all });
        },
    });
}
