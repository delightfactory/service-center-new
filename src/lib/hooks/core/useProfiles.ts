// ============================================================
// Profile Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService, UpdateProfileDTO, ProfileFilters } from '@/lib/services';
import { queryKeys } from '../query-keys';
import type { UserRole } from '@/types/enums';

// ============================================================
// Queries
// ============================================================

/**
 * Get profiles with filters
 */
export function useProfiles(
    params?: { page?: number; limit?: number },
    filters?: ProfileFilters
) {
    return useQuery({
        queryKey: queryKeys.profiles.list({ ...params, ...filters }),
        queryFn: () => profileService.getProfiles(params, filters),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get single profile by ID
 */
export function useProfile(id: string) {
    return useQuery({
        queryKey: queryKeys.profiles.detail(id),
        queryFn: () => profileService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get technicians for assignment
 */
export function useTechnicians(branchId?: string) {
    return useQuery({
        queryKey: [...queryKeys.profiles.all, 'technicians', branchId],
        queryFn: () => profileService.getTechnicians(branchId),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get profiles by role
 */
export function useProfilesByRole(role: UserRole) {
    return useQuery({
        queryKey: [...queryKeys.profiles.all, 'role', role],
        queryFn: () => profileService.getByRole(role),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Search profiles
 */
export function useSearchProfiles(query: string) {
    return useQuery({
        queryKey: [...queryKeys.profiles.all, 'search', query],
        queryFn: () => profileService.searchProfiles(query),
        enabled: query.length >= 2,
        staleTime: 1000 * 60 * 2,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Update profile mutation
 */
export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateProfileDTO }) =>
            profileService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(variables.id) });
        },
    });
}

/**
 * Update my profile mutation
 */
export function useUpdateMyProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateProfileDTO) => profileService.updateMyProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
        },
    });
}

/**
 * Change user role mutation
 */
export function useChangeRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, newRole }: { userId: string; newRole: UserRole }) =>
            profileService.changeRole(userId, newRole),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(variables.userId) });
        },
    });
}

/**
 * Assign user to branch mutation
 */
export function useAssignToBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, branchId }: { userId: string; branchId: string | null }) =>
            profileService.assignToBranch(userId, branchId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(variables.userId) });
        },
    });
}
