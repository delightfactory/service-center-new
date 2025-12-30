// ============================================================
// Treasury Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    treasuryService,
    CreateTreasuryDTO,
    UpdateTreasuryDTO,
    TreasuryTransactionFilters
} from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get all treasuries
 */
export function useTreasuries(branchId?: string) {
    return useQuery({
        queryKey: queryKeys.treasuries.list({ branchId }),
        queryFn: () => treasuryService.getTreasuries(branchId),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get single treasury by ID
 */
export function useTreasury(id: string) {
    return useQuery({
        queryKey: queryKeys.treasuries.detail(id),
        queryFn: () => treasuryService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get default treasury for branch
 */
export function useDefaultTreasury(branchId: string) {
    return useQuery({
        queryKey: [...queryKeys.treasuries.all, 'default', branchId],
        queryFn: () => treasuryService.getDefaultTreasury(branchId),
        enabled: !!branchId,
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Get treasury transactions
 */
export function useTreasuryTransactions(
    params?: { page?: number; limit?: number },
    filters?: TreasuryTransactionFilters
) {
    return useQuery({
        queryKey: queryKeys.treasuries.transactions({ ...params, ...filters }),
        queryFn: () => treasuryService.getTransactions(params, filters),
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get total balances
 */
export function useTotalBalances(branchId?: string) {
    return useQuery({
        queryKey: queryKeys.treasuries.balances(branchId),
        queryFn: () => treasuryService.getTotalBalances(branchId),
        staleTime: 1000 * 60 * 2,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create treasury mutation
 */
export function useCreateTreasury() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateTreasuryDTO) => treasuryService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.all });
        },
    });
}

/**
 * Update treasury mutation
 */
export function useUpdateTreasury() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateTreasuryDTO }) =>
            treasuryService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.detail(variables.id) });
        },
    });
}

/**
 * Transfer between treasuries
 */
export function useTransferBetweenTreasuries() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            fromTreasuryId,
            toTreasuryId,
            amount,
            notes,
            createdBy,
            branchId,
        }: {
            fromTreasuryId: string;
            toTreasuryId: string;
            amount: number;
            notes?: string;
            createdBy?: string;
            branchId?: string;
        }) => treasuryService.transferBetweenTreasuries(
            fromTreasuryId, toTreasuryId, amount, notes, createdBy, branchId
        ),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.detail(variables.fromTreasuryId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.detail(variables.toTreasuryId) });
        },
    });
}

/**
 * Delete treasury mutation
 */
export function useDeleteTreasury() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => treasuryService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.all });
        },
    });
}
