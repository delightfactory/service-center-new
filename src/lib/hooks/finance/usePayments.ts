// ============================================================
// Payment Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService, CreatePaymentDTO, PaymentFilters } from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get payments with filters and pagination
 */
export function usePayments(
    params?: { page?: number; limit?: number },
    filters?: PaymentFilters
) {
    return useQuery({
        queryKey: queryKeys.payments.list({ ...params, ...filters }),
        queryFn: () => paymentService.getPayments(params, filters),
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get payments by invoice
 */
export function usePaymentsByInvoice(invoiceId: string) {
    return useQuery({
        queryKey: queryKeys.payments.byInvoice(invoiceId),
        queryFn: () => paymentService.getByInvoice(invoiceId),
        enabled: !!invoiceId,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get payments by customer
 */
export function usePaymentsByCustomer(customerId: string, limit?: number) {
    return useQuery({
        queryKey: [...queryKeys.payments.all, 'customer', customerId],
        queryFn: () => paymentService.getByCustomer(customerId, limit),
        enabled: !!customerId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get today's payments
 */
export function useTodayPayments(branchId?: string) {
    return useQuery({
        queryKey: queryKeys.payments.today(branchId),
        queryFn: () => paymentService.getTodayPayments(branchId),
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get payment summary
 */
export function usePaymentSummary(branchId?: string, dateFrom?: string, dateTo?: string) {
    return useQuery({
        queryKey: [...queryKeys.payments.all, 'summary', branchId, dateFrom, dateTo],
        queryFn: () => paymentService.getPaymentSummary(branchId, dateFrom, dateTo),
        staleTime: 1000 * 60 * 5,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create payment mutation
 */
export function useCreatePayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreatePaymentDTO) => paymentService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.all });
        },
    });
}

/**
 * Create payment for invoice
 */
export function useCreatePaymentForInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            invoiceId,
            paymentData,
        }: {
            invoiceId: string;
            paymentData: Omit<CreatePaymentDTO, 'invoice_id'>;
        }) => paymentService.createPaymentForInvoice(invoiceId, paymentData),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.treasuries.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        },
    });
}
