// ============================================================
// Assessment Service (تقارير الدخول)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { Assessment, Customer, Vehicle, Profile } from '@/types/database';
import type { EntryType, AssessmentStatus } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateAssessmentDTO {
    customer_id: string;
    vehicle_id?: string | null;
    branch_id?: string | null;  // Made optional
    entry_type: EntryType;
    mileage_in?: number;
    fuel_level?: number;
    device_type?: string;
    device_serial?: string;
    device_description?: string;
    customer_complaint?: string;
    initial_diagnosis?: string;
    inspection_notes?: Record<string, unknown>;
    photos?: string[];
}

export interface UpdateAssessmentDTO extends Partial<CreateAssessmentDTO> {
    status?: AssessmentStatus;
    received_by?: string;
    received_at?: string;
}

export interface AssessmentFilters {
    status?: AssessmentStatus;
    entry_type?: EntryType;
    branch_id?: string;
    customer_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface AssessmentWithRelations extends Assessment {
    customer: Pick<Customer, 'id' | 'name' | 'phone'>;
    vehicle?: Pick<Vehicle, 'id' | 'plate_number' | 'make' | 'model' | 'year'> | null;
    received_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

// ============================================================
// Assessment Service
// ============================================================

class AssessmentService extends BaseService<Assessment, CreateAssessmentDTO, UpdateAssessmentDTO> {
    protected tableName = 'assessments';
    protected selectColumns = `
    id, code, vehicle_id, customer_id, branch_id, entry_type,
    mileage_in, fuel_level, device_type, device_serial, device_description,
    customer_complaint, initial_diagnosis, inspection_notes, photos,
    status, received_by, received_at, created_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get assessments with relations
     */
    async getAssessments(
        params: Partial<PaginationParams> = {},
        filters: AssessmentFilters = {}
    ): Promise<PaginatedResponse<AssessmentWithRelations>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        vehicle:vehicles (id, plate_number, make, model, year),
        received_by_profile:profiles!received_by (id, full_name)
      `, { count: 'exact' });

        // Apply filters
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.entry_type) {
            query = query.eq('entry_type', filters.entry_type);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to);
        }

        query = query
            .range(from, to)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as AssessmentWithRelations[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get today's assessments
     */
    async getTodayAssessments(branchId?: string): Promise<AssessmentWithRelations[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        vehicle:vehicles (id, plate_number, make, model)
      `)
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as AssessmentWithRelations[];
    }

    /**
     * Get pending assessments (awaiting processing)
     */
    async getPendingAssessments(branchId?: string): Promise<AssessmentWithRelations[]> {
        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        vehicle:vehicles (id, plate_number, make, model)
      `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true }); // Oldest first

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as AssessmentWithRelations[];
    }

    /**
     * Mark assessment as received
     */
    async markAsReceived(id: string, receivedBy: string): Promise<Assessment> {
        return this.update(id, {
            status: 'received',
            received_by: receivedBy,
            received_at: new Date().toISOString(),
        });
    }

    /**
     * Move assessment to workshop
     */
    async moveToWorkshop(id: string): Promise<Assessment> {
        return this.update(id, { status: 'in_workshop' });
    }

    /**
     * Add photos to assessment
     */
    async addPhotos(id: string, photoUrls: string[]): Promise<Assessment> {
        const current = await this.getById(id);
        const existingPhotos = current.photos || [];

        return this.update(id, {
            photos: [...existingPhotos, ...photoUrls],
        });
    }

    /**
     * Get assessment with full relations (for detail view)
     */
    async getAssessmentDetail(id: string): Promise<AssessmentWithRelations> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (*),
        vehicle:vehicles (*),
        received_by_profile:profiles!received_by (id, full_name, avatar_url)
      `)
            .eq('id', id)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as AssessmentWithRelations;
    }
}

export const assessmentService = new AssessmentService();
export default assessmentService;
