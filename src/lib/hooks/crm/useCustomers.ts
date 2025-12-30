// ============================================================
// Customer Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService, CreateCustomerDTO, UpdateCustomerDTO, CustomerFilters } from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get customers with filters and pagination
 */
export function useCustomers(
    params?: { page?: number; limit?: number },
    filters?: CustomerFilters
) {
    return useQuery({
        queryKey: queryKeys.customers.list({ ...params, ...filters }),
        queryFn: () => customerService.getCustomers(params, filters),
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get single customer by ID
 */
export function useCustomer(id: string) {
    return useQuery({
        queryKey: queryKeys.customers.detail(id),
        queryFn: () => customerService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get customer with vehicles
 */
export function useCustomerWithVehicles(customerId: string) {
    return useQuery({
        queryKey: [...queryKeys.customers.detail(customerId), 'vehicles'],
        queryFn: () => customerService.getCustomerWithVehicles(customerId),
        enabled: !!customerId,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Search customers
 */
export function useSearchCustomers(query: string, limit?: number) {
    return useQuery({
        queryKey: queryKeys.customers.search(query),
        queryFn: () => customerService.searchCustomers(query, limit),
        enabled: query.length >= 2,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get customers with outstanding balance
 */
export function useCustomersWithBalance() {
    return useQuery({
        queryKey: queryKeys.customers.withBalance,
        queryFn: () => customerService.getCustomersWithBalance(),
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get customer statistics
 */
export function useCustomerStats(customerId: string) {
    return useQuery({
        queryKey: [...queryKeys.customers.detail(customerId), 'stats'],
        queryFn: () => customerService.getCustomerStats(customerId),
        enabled: !!customerId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get customer statement of account
 */
export function useCustomerStatement(
    customerId: string,
    dateFrom?: string,
    dateTo?: string
) {
    return useQuery({
        queryKey: [...queryKeys.customers.detail(customerId), 'statement', dateFrom, dateTo],
        queryFn: () => customerService.getStatementOfAccount(customerId, dateFrom, dateTo),
        enabled: !!customerId,
        staleTime: 1000 * 60 * 5,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create customer mutation
 */
export function useCreateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateCustomerDTO) => customerService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        },
    });
}

/**
 * Update customer mutation
 */
export function useUpdateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateCustomerDTO }) =>
            customerService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.id) });
        },
    });
}

/**
 * Delete customer mutation
 */
export function useDeleteCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => customerService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        },
    });
}

/**
 * Recalculate customer balance mutation
 */
export function useRecalculateCustomerBalance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (customerId: string) => customerService.recalculateBalance(customerId),
        onSuccess: (_, customerId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.withBalance });
        },
    });
}
