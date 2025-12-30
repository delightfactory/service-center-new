// ============================================================
// Invoice Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    invoiceService,
    CreateInvoiceDTO,
    UpdateInvoiceDTO,
    InvoiceFilters
} from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get invoices with filters and pagination
 */
export function useInvoices(
    params?: { page?: number; limit?: number },
    filters?: InvoiceFilters
) {
    return useQuery({
        queryKey: queryKeys.invoices.list({ ...params, ...filters }),
        queryFn: () => invoiceService.getInvoices(params, filters),
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get single invoice by ID
 */
export function useInvoice(id: string) {
    return useQuery({
        queryKey: queryKeys.invoices.detail(id),
        queryFn: () => invoiceService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get invoice with payments
 */
export function useInvoiceDetail(id: string) {
    return useQuery({
        queryKey: [...queryKeys.invoices.detail(id), 'full'],
        queryFn: () => invoiceService.getInvoiceDetail(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get unpaid invoices
 */
export function useUnpaidInvoices(type?: 'sales' | 'purchase') {
    return useQuery({
        queryKey: queryKeys.invoices.unpaid(type),
        queryFn: () => invoiceService.getUnpaidInvoices(type),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get overdue invoices
 */
export function useOverdueInvoices() {
    return useQuery({
        queryKey: queryKeys.invoices.overdue,
        queryFn: () => invoiceService.getOverdueInvoices(),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get revenue summary
 */
export function useRevenueSummary(branchId?: string, dateFrom?: string, dateTo?: string) {
    return useQuery({
        queryKey: [...queryKeys.invoices.all, 'revenue', branchId, dateFrom, dateTo],
        queryFn: () => invoiceService.getRevenueSummary(branchId, dateFrom, dateTo),
        staleTime: 1000 * 60 * 5,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create invoice mutation
 */
export function useCreateInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateInvoiceDTO) => invoiceService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
        },
    });
}

/**
 * Update invoice mutation
 */
export function useUpdateInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceDTO }) =>
            invoiceService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.id) });
        },
    });
}

/**
 * Approve invoice
 */
export function useApproveInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) =>
            invoiceService.approveInvoice(id, approvedBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.id) });
        },
    });
}

/**
 * Cancel invoice
 */
export function useCancelInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, cancelledBy, reason }: { id: string; cancelledBy: string; reason: string }) =>
            invoiceService.cancelInvoice(id, cancelledBy, reason),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.id) });
        },
    });
}

/**
 * Delete invoice mutation
 */
export function useDeleteInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => invoiceService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
        },
    });
}
