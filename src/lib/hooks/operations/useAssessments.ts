// ============================================================
// Assessment Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    assessmentService,
    CreateAssessmentDTO,
    UpdateAssessmentDTO,
    AssessmentFilters
} from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get assessments with filters and pagination
 */
export function useAssessments(
    params?: { page?: number; limit?: number },
    filters?: AssessmentFilters
) {
    return useQuery({
        queryKey: queryKeys.assessments.list({ ...params, ...filters }),
        queryFn: () => assessmentService.getAssessments(params, filters),
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get single assessment by ID
 */
export function useAssessment(id: string) {
    return useQuery({
        queryKey: queryKeys.assessments.detail(id),
        queryFn: () => assessmentService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get assessment with full details
 */
export function useAssessmentDetail(id: string) {
    return useQuery({
        queryKey: [...queryKeys.assessments.detail(id), 'full'],
        queryFn: () => assessmentService.getAssessmentDetail(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get today's assessments
 */
export function useTodayAssessments(branchId?: string) {
    return useQuery({
        queryKey: queryKeys.assessments.today(branchId),
        queryFn: () => assessmentService.getTodayAssessments(branchId),
        staleTime: 1000 * 60 * 2,
        refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
    });
}

/**
 * Get pending assessments
 */
export function usePendingAssessments(branchId?: string) {
    return useQuery({
        queryKey: queryKeys.assessments.pending(branchId),
        queryFn: () => assessmentService.getPendingAssessments(branchId),
        staleTime: 1000 * 60 * 2,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create assessment mutation
 */
export function useCreateAssessment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateAssessmentDTO) => assessmentService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
        },
    });
}

/**
 * Update assessment mutation
 */
export function useUpdateAssessment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateAssessmentDTO }) =>
            assessmentService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.detail(variables.id) });
        },
    });
}

/**
 * Mark assessment as received
 */
export function useMarkAssessmentReceived() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, receivedBy }: { id: string; receivedBy: string }) =>
            assessmentService.markAsReceived(id, receivedBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.detail(variables.id) });
        },
    });
}

/**
 * Move assessment to workshop
 */
export function useMoveToWorkshop() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => assessmentService.moveToWorkshop(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.detail(id) });
        },
    });
}

/**
 * Add photos to assessment
 */
export function useAddAssessmentPhotos() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, photoUrls }: { id: string; photoUrls: string[] }) =>
            assessmentService.addPhotos(id, photoUrls),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.detail(variables.id) });
        },
    });
}

/**
 * Delete assessment mutation
 */
export function useDeleteAssessment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => assessmentService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
        },
    });
}
