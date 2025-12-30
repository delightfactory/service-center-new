// ============================================================
// Branch Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchService, CreateBranchDTO, UpdateBranchDTO } from '@/lib/services';
import { queryKeys } from '../query-keys';
import type { Branch } from '@/types/database';

// ============================================================
// Queries
// ============================================================

/**
 * Get all branches with pagination
 */
export function useBranches(params?: { page?: number; limit?: number }) {
    return useQuery({
        queryKey: queryKeys.branches.list(params || {}),
        queryFn: () => branchService.getAll(params),
        staleTime: 1000 * 60 * 10, // 10 minutes - branches rarely change
    });
}

/**
 * Get single branch by ID
 */
export function useBranch(id: string) {
    return useQuery({
        queryKey: queryKeys.branches.detail(id),
        queryFn: () => branchService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Get active branches only
 */
export function useActiveBranches() {
    return useQuery({
        queryKey: [...queryKeys.branches.all, 'active'],
        queryFn: () => branchService.getActiveBranches(),
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Get main branch
 */
export function useMainBranch() {
    return useQuery({
        queryKey: [...queryKeys.branches.all, 'main'],
        queryFn: () => branchService.getMainBranch(),
        staleTime: 1000 * 60 * 10,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create branch mutation
 */
export function useCreateBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateBranchDTO) => branchService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
        },
    });
}

/**
 * Update branch mutation
 */
export function useUpdateBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateBranchDTO }) =>
            branchService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.branches.detail(variables.id) });
        },
    });
}

/**
 * Delete branch mutation
 */
export function useDeleteBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => branchService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
        },
    });
}

/**
 * Set branch as main
 */
export function useSetMainBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (branchId: string) => branchService.setAsMain(branchId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
        },
    });
}
