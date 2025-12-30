// ============================================================
// Job Order Service (أوامر الشغل)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { JobOrder, JobItem, JobTechnician, Customer, Vehicle, Profile } from '@/types/database';
import type { JobCategory, JobStatus, PriorityLevel } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateJobOrderDTO {
    assessment_id?: string | null;
    vehicle_id?: string | null;
    customer_id: string;
    branch_id?: string | null;  // Made optional
    job_category: JobCategory;
    priority?: PriorityLevel;
    manager_instructions?: string;
    notes?: string;
    estimated_hours?: number;
    promised_date?: string;
}

export interface UpdateJobOrderDTO extends Partial<CreateJobOrderDTO> {
    status?: JobStatus;
    actual_hours?: number;
    started_at?: string;
    completed_at?: string;
    approved_by?: string;
}

export interface JobOrderFilters {
    status?: JobStatus | JobStatus[];
    job_category?: JobCategory;
    priority?: PriorityLevel;
    branch_id?: string;
    customer_id?: string;
    vehicle_id?: string;
    technician_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface JobOrderWithRelations extends JobOrder {
    customer: Pick<Customer, 'id' | 'name' | 'phone'>;
    vehicle?: Pick<Vehicle, 'id' | 'plate_number' | 'make' | 'model' | 'year'> | null;
    items?: JobItem[];
    technicians?: (JobTechnician & { technician: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> })[];
}

// ============================================================
// Job Order Service
// ============================================================

class JobOrderService extends BaseService<JobOrder, CreateJobOrderDTO, UpdateJobOrderDTO> {
    protected tableName = 'job_orders';
    protected selectColumns = `
    id, code, assessment_id, vehicle_id, customer_id, branch_id,
    job_category, status, priority, manager_instructions, notes,
    estimated_hours, actual_hours, promised_date,
    started_at, completed_at, external_reference,
    created_by, approved_by, created_at, updated_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get job orders with filters and relations
     */
    async getJobOrders(
        params: Partial<PaginationParams> = {},
        filters: JobOrderFilters = {}
    ): Promise<PaginatedResponse<JobOrderWithRelations>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        vehicle:vehicles (id, plate_number, make, model, year)
      `, { count: 'exact' });

        // Apply filters
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }
        if (filters.job_category) {
            query = query.eq('job_category', filters.job_category);
        }
        if (filters.priority) {
            query = query.eq('priority', filters.priority);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }
        if (filters.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters.vehicle_id) {
            query = query.eq('vehicle_id', filters.vehicle_id);
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
            data: (data as unknown as JobOrderWithRelations[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Get active job orders (not completed/cancelled/delivered)
     */
    async getActiveJobOrders(branchId?: string): Promise<JobOrderWithRelations[]> {
        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        vehicle:vehicles (id, plate_number, make, model)
      `)
            .not('status', 'in', '("completed","cancelled","delivered")')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as JobOrderWithRelations[];
    }

    /**
     * Get job orders by technician
     */
    async getByTechnician(technicianId: string, activeOnly: boolean = true): Promise<JobOrderWithRelations[]> {
        // First get job order IDs for this technician
        const { data: techJobs, error: techError } = await supabase
            .from('job_technicians')
            .select('job_order_id')
            .eq('technician_id', technicianId);

        if (techError) handleSupabaseError(techError);
        if (!techJobs?.length) return [];

        const jobIds = techJobs.map(j => j.job_order_id);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (id, name, phone),
        vehicle:vehicles (id, plate_number, make, model)
      `)
            .in('id', jobIds)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (activeOnly) {
            query = query.not('status', 'in', '("completed","cancelled","delivered")');
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);
        return data as unknown as JobOrderWithRelations[];
    }

    /**
     * Get job order with full details
     */
    async getJobOrderDetail(id: string): Promise<JobOrderWithRelations> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        customer:customers (*),
        vehicle:vehicles (*),
        items:job_items (*),
        technicians:job_technicians (
          *,
          technician:profiles (id, full_name, avatar_url, specialization)
        )
      `)
            .eq('id', id)
            .single();

        if (error) handleSupabaseError(error);
        return data as unknown as JobOrderWithRelations;
    }

    /**
     * Update job order status
     */
    async updateStatus(id: string, status: JobStatus, userId?: string): Promise<JobOrder> {
        const updates: UpdateJobOrderDTO = { status };

        // Auto-set timestamps based on status
        if (status === 'in_progress') {
            updates.started_at = new Date().toISOString();
        }
        if (status === 'completed' || status === 'delivered') {
            updates.completed_at = new Date().toISOString();
        }
        if (status === 'completed' && userId) {
            updates.approved_by = userId;
        }

        return this.update(id, updates);
    }

    /**
     * Assign technician to job order
     */
    async assignTechnician(
        jobOrderId: string,
        technicianId: string,
        isLead: boolean = false,
        assignedBy?: string
    ): Promise<void> {
        const { error } = await supabase
            .from('job_technicians')
            .upsert({
                job_order_id: jobOrderId,
                technician_id: technicianId,
                is_lead: isLead,
                assigned_by: assignedBy,
                assigned_at: new Date().toISOString(),
            }, {
                onConflict: 'job_order_id,technician_id',
            });

        if (error) handleSupabaseError(error);
    }

    /**
     * Remove technician from job order
     */
    async removeTechnician(jobOrderId: string, technicianId: string): Promise<void> {
        const { error } = await supabase
            .from('job_technicians')
            .delete()
            .eq('job_order_id', jobOrderId)
            .eq('technician_id', technicianId);

        if (error) handleSupabaseError(error);
    }

    /**
     * Get job order summary for dashboard
     */
    async getStatusSummary(branchId?: string): Promise<Record<JobStatus, number>> {
        let query = supabase
            .from(this.tableName)
            .select('status');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) handleSupabaseError(error);

        // Count by status
        const summary: Record<JobStatus, number> = {
            draft: 0,
            pending: 0,
            in_progress: 0,
            paused: 0,
            review: 0,
            completed: 0,
            delivered: 0,
            cancelled: 0,
        };

        data?.forEach(row => {
            summary[row.status as JobStatus]++;
        });

        return summary;
    }
}

export const jobOrderService = new JobOrderService();
export default jobOrderService;
