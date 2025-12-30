// ============================================================
// Vehicle Service
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Vehicle, Customer } from '@/types/database';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateVehicleDTO {
    customer_id: string;
    plate_number: string;
    vin?: string | null;
    make: string;
    model: string;
    year?: number | null;
    color?: string | null;
    engine_type?: string | null;  // Corrected from engine_number
    transmission?: string | null;
    current_mileage?: number | null;
    notes?: string | null;
}

export interface UpdateVehicleDTO extends Partial<Omit<CreateVehicleDTO, 'customer_id'>> {
    is_active?: boolean;
    last_service_date?: string | null;
    next_service_mileage?: number | null;
    insurance_expiry?: string | null;
}

export interface VehicleWithCustomer extends Vehicle {
    customer: Customer;
}

// ============================================================
// Vehicle Service
// ============================================================

class VehicleService extends BaseService<Vehicle, CreateVehicleDTO, UpdateVehicleDTO> {
    protected tableName = 'vehicles';
    protected selectColumns = `
    id, customer_id, plate_number, vin, make, model, year, color,
    engine_type, transmission, current_mileage, last_service_date,
    next_service_mileage, insurance_expiry, notes, is_active,
    created_at, updated_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get vehicles with customer info
     */
    async getVehiclesWithCustomer(
        params: Partial<PaginationParams> = {}
    ): Promise<PaginatedResponse<VehicleWithCustomer>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        const { data, count, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone)
      `, { count: 'exact' })
            .eq('is_active', true)
            .range(from, to)
            .order('created_at', { ascending: false });

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as VehicleWithCustomer[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get vehicles by customer ID
     */
    async getByCustomer(customerId: string): Promise<Vehicle[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('customer_id', customerId)
            .eq('is_active', true)
            .order('plate_number');

        if (error) handleSupabaseError(error);
        return (data as unknown as Vehicle[]) || [];
    }

    /**
     * Search vehicles by plate number or VIN
     */
    async searchVehicles(query: string, limit: number = 20): Promise<VehicleWithCustomer[]> {
        if (!query.trim()) return [];

        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        id, plate_number, vin, make, model, year, color,
        customer:customers (id, name, phone)
      `)
            .or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(limit)
            .order('plate_number');

        if (error) handleSupabaseError(error);
        return data as unknown as VehicleWithCustomer[];
    }

    /**
     * Get vehicle by plate number
     */
    async getByPlateNumber(plateNumber: string): Promise<Vehicle | null> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(this.selectColumns)
            .eq('plate_number', plateNumber)
            .single();

        if (error && error.code !== 'PGRST116') handleSupabaseError(error);
        return data as Vehicle | null;
    }

    /**
     * Get vehicle service history
     */
    async getServiceHistory(vehicleId: string): Promise<{
        id: string;
        code: string;
        job_category: string;
        status: string;
        created_at: string;
        completed_at: string | null;
    }[]> {
        const { data, error } = await supabase
            .from('job_orders')
            .select('id, code, job_category, status, created_at, completed_at')
            .eq('vehicle_id', vehicleId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) handleSupabaseError(error);
        return data || [];
    }

    /**
     * Transfer vehicle to another customer
     */
    async transferToCustomer(vehicleId: string, newCustomerId: string): Promise<Vehicle> {
        const { data, error } = await supabase
            .from(this.tableName)
            .update({ customer_id: newCustomerId })
            .eq('id', vehicleId)
            .select(this.selectColumns)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as Vehicle;
    }
}

export const vehicleService = new VehicleService();
export default vehicleService;
