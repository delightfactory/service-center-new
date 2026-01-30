import type { JobStatus, PriorityLevel, JobItemType } from '@/types/enums';

// ============================================================
// Job Order Types
// ============================================================

export interface JobOrderDetails {
    id: string;
    code: string;
    job_category: string;
    status: JobStatus;
    priority: PriorityLevel;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    estimated_hours: number | null;
    actual_hours: number | null;
    notes: string | null;
    manager_instructions: string | null;
    vehicle: {
        id: string;
        plate_number: string;
        make: string | null;
        model: string | null;
        year: number | null;
        color: string | null;
        vin: string | null;
    } | null;
    customer: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
    } | null;
    assessment: {
        id: string;
        mileage_in: number | null;
        fuel_level: number | null;
        customer_complaint: string | null;
    } | null;
}

export interface JobItem {
    id: string;
    item_type: JobItemType;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    total_price: number;
    product_id: string | null;
    technician_id: string | null;
    notes: string | null;
    is_completed: boolean;
    is_dispensed?: boolean;
    // معلومات المنتج للخدمات المركبة
    product?: {
        is_composite: boolean;
        components?: {
            id: string;
            quantity: number;
            component: {
                id: string;
                name: string;
            };
        }[];
    } | null;
}

export interface JobTask {
    id: string;
    description: string;
    notes: string | null;
    is_completed: boolean;
    is_blocked: boolean;
    blocked_reason: string | null;
    assigned_to: {
        id: string;
        full_name: string;
    } | null;
}

export interface AssignedTech {
    id: string;
    technician_id: string;
    is_lead: boolean;
    technician: {
        id: string;
        full_name: string;
        avatar_url: string | null;
    };
}

export interface LinkedInvoice {
    id: string;
    code: string;
    status: string;
    total_amount: number;
    paid_amount: number;
}
