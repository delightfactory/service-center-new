// ============================================================
// Vehicle Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleService, CreateVehicleDTO, UpdateVehicleDTO } from '@/lib/services';
import { queryKeys } from '../query-keys';

// ============================================================
// Queries
// ============================================================

/**
 * Get vehicles with customer info
 */
export function useVehicles(params?: { page?: number; limit?: number }) {
    return useQuery({
        queryKey: queryKeys.vehicles.list(params || {}),
        queryFn: () => vehicleService.getVehiclesWithCustomer(params),
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get single vehicle by ID
 */
export function useVehicle(id: string) {
    return useQuery({
        queryKey: queryKeys.vehicles.detail(id),
        queryFn: () => vehicleService.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 3,
    });
}

/**
 * Get vehicles by customer
 */
export function useVehiclesByCustomer(customerId: string) {
    return useQuery({
        queryKey: queryKeys.vehicles.byCustomer(customerId),
        queryFn: () => vehicleService.getByCustomer(customerId),
        enabled: !!customerId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Search vehicles by plate or VIN
 */
export function useSearchVehicles(query: string, limit?: number) {
    return useQuery({
        queryKey: queryKeys.vehicles.search(query),
        queryFn: () => vehicleService.searchVehicles(query, limit),
        enabled: query.length >= 2,
        staleTime: 1000 * 60 * 2,
    });
}

/**
 * Get vehicle by plate number
 */
export function useVehicleByPlate(plateNumber: string) {
    return useQuery({
        queryKey: [...queryKeys.vehicles.all, 'plate', plateNumber],
        queryFn: () => vehicleService.getByPlateNumber(plateNumber),
        enabled: !!plateNumber,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Get vehicle service history
 */
export function useVehicleServiceHistory(vehicleId: string) {
    return useQuery({
        queryKey: queryKeys.vehicles.serviceHistory(vehicleId),
        queryFn: () => vehicleService.getServiceHistory(vehicleId),
        enabled: !!vehicleId,
        staleTime: 1000 * 60 * 5,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create vehicle mutation
 */
export function useCreateVehicle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateVehicleDTO) => vehicleService.create(data),
        onSuccess: (vehicle) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
            queryClient.invalidateQueries({
                queryKey: queryKeys.vehicles.byCustomer(vehicle.customer_id)
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.customers.detail(vehicle.customer_id),
            });
        },
    });
}

/**
 * Update vehicle mutation
 */
export function useUpdateVehicle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDTO }) =>
            vehicleService.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.detail(variables.id) });
        },
    });
}

/**
 * Delete vehicle mutation
 */
export function useDeleteVehicle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => vehicleService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
        },
    });
}

/**
 * Transfer vehicle to another customer
 */
export function useTransferVehicle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ vehicleId, newCustomerId }: { vehicleId: string; newCustomerId: string }) =>
            vehicleService.transferToCustomer(vehicleId, newCustomerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        },
    });
}
