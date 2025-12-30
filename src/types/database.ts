// ============================================================
// نظام إدارة مركز صيانة السيارات - Database Table Types
// تم التوليد من: supabase/migrations/*.sql
// ============================================================

import type {
    UserRole,
    CustomerType,
    EntryType,
    AssessmentStatus,
    JobCategory,
    JobStatus,
    PriorityLevel,
    JobItemType,
    ProductType,
    InventoryTxType,
    TreasuryType,
    TreasuryTxType,
    TransferStatus,
    InvoiceType,
    InvoiceStatus,
    PaymentType,
    PaymentMethod,
    ExpenseStatus,
    AccountCategoryType,
    NoteType,
    NoteStatus,
} from './enums';

// ============================================================
// Base Types
// ============================================================

export interface BaseEntity {
    id: string;
    created_at: string;
}

export interface BaseEntityWithUpdate extends BaseEntity {
    updated_at: string;
}

// ============================================================
// Core - الجداول الأساسية
// ============================================================

// الفروع
export interface Branch extends BaseEntityWithUpdate {
    code: string | null;
    name: string;
    address: string | null;
    phone: string | null;
    is_main: boolean;
    is_active: boolean;
}

// الملفات الشخصية
export interface Profile extends BaseEntityWithUpdate {
    email: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    role: UserRole;
    branch_id: string | null;
    specialization: string | null;
    hourly_rate: number | null;
    hire_date: string | null;
    is_active: boolean;
}

// المخازن
export interface Warehouse extends BaseEntity {
    branch_id: string;
    code: string | null;
    name: string;
    is_default: boolean;
    is_active: boolean;
}

// ============================================================
// CRM - العملاء والموردين
// ============================================================

// العملاء
export interface Customer extends BaseEntityWithUpdate {
    code: string | null;
    name: string;
    customer_type: CustomerType;
    phone: string | null;
    phone2: string | null;
    email: string | null;
    address: string | null;
    tax_number: string | null;
    balance: number;
    notes: string | null;
    branch_id: string;
    is_active: boolean;
}

// المركبات
export interface Vehicle extends BaseEntityWithUpdate {
    customer_id: string;
    plate_number: string;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    engine_number: string | null;
    transmission: string | null;
    fuel_type: string | null;
    notes: string | null;
    is_active: boolean;
}

// الموردين
export interface Supplier extends BaseEntityWithUpdate {
    code: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    tax_number: string | null;
    balance: number;
    contact_person: string | null;
    notes: string | null;
    is_active: boolean;
}

// ============================================================
// Operations - العمليات
// ============================================================

// تقارير الدخول
export interface Assessment extends BaseEntity {
    code: string | null;
    vehicle_id: string | null;
    customer_id: string;
    branch_id: string;
    entry_type: EntryType;
    mileage_in: number | null;
    fuel_level: number | null;
    device_type: string | null;
    device_serial: string | null;
    device_description: string | null;
    customer_complaint: string | null;
    initial_diagnosis: string | null;
    inspection_notes: Record<string, unknown>;
    photos: string[];
    status: AssessmentStatus;
    received_by: string | null;
    received_at: string | null;
}

// أوامر الشغل
export interface JobOrder extends BaseEntityWithUpdate {
    code: string | null;
    assessment_id: string | null;
    vehicle_id: string | null;
    customer_id: string;
    branch_id: string;
    job_category: JobCategory;
    status: JobStatus;
    priority: PriorityLevel;
    manager_instructions: string | null;
    notes: string | null;
    estimated_hours: number | null;
    actual_hours: number | null;
    promised_date: string | null;
    started_at: string | null;
    completed_at: string | null;
    external_reference: string | null;
    created_by: string | null;
    approved_by: string | null;
}

// بنود أمر الشغل
export interface JobItem extends BaseEntity {
    job_order_id: string;
    product_id: string | null;
    item_type: JobItemType;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    total_price: number; // GENERATED
    external_cost: number;
    is_completed: boolean;
    completed_at: string | null;
    completed_by: string | null;
    is_blocked: boolean;
    blocked_reason: string | null;
    returned_quantity: number;
    return_reason: string | null;
    warehouse_id: string | null;
    sort_order: number;
    notes: string | null;
}

// الفنيين المعينين
export interface JobTechnician extends BaseEntity {
    job_order_id: string;
    technician_id: string;
    is_lead: boolean;
    assigned_at: string;
    assigned_by: string | null;
}

// ============================================================
// Inventory - المخزون
// ============================================================

// التصنيفات
export interface Category extends BaseEntity {
    name: string;
    description: string | null;
    parent_id: string | null;
    sort_order: number;
    is_active: boolean;
}

// المنتجات
export interface Product extends BaseEntityWithUpdate {
    code: string | null;
    name: string;
    product_type: ProductType;
    category_id: string | null;
    unit: string;
    barcode: string | null;
    sku: string | null;
    description: string | null;
    cost_price: number;
    selling_price: number;
    min_stock: number;
    max_stock: number | null;
    is_trackable: boolean;
    is_composite: boolean;
    duration_minutes: number | null;
    labor_cost: number;
    is_active: boolean;
}

// مكونات الخدمات
export interface ServiceComponent extends BaseEntity {
    service_id: string;
    component_id: string;
    quantity: number;
    is_optional: boolean;
}

// أرصدة المخزون
export interface InventoryItem {
    id: string;
    product_id: string;
    warehouse_id: string;
    quantity: number;
    reserved_quantity: number;
    avg_cost: number;
    last_purchase_price: number | null;
    updated_at: string;
}

// حركات المخزون
export interface InventoryTransaction extends BaseEntity {
    product_id: string;
    warehouse_id: string;
    transaction_type: InventoryTxType;
    quantity: number;
    unit_cost: number;
    reference_type: string | null;
    reference_id: string | null;
    notes: string | null;
    created_by: string | null;
}

// ============================================================
// Finance - المالية
// ============================================================

// الخزن
export interface Treasury extends BaseEntity {
    code: string | null;
    name: string;
    treasury_type: TreasuryType;
    branch_id: string | null;
    balance: number;
    opening_balance: number;
    bank_name: string | null;
    account_number: string | null;
    iban: string | null;
    is_default: boolean;
    is_active: boolean;
}

// بنود الحسابات
export interface AccountCategory extends BaseEntity {
    code: string | null;
    name: string;
    category_type: AccountCategoryType;
    parent_id: string | null;
    description: string | null;
    is_system: boolean;
    is_active: boolean;
}

// الفواتير
export interface Invoice extends BaseEntityWithUpdate {
    code: string | null;
    invoice_type: InvoiceType;
    job_order_id: string | null;
    customer_id: string | null;
    supplier_id: string | null;
    branch_id: string;
    subtotal: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number; // GENERATED
    status: InvoiceStatus;
    due_date: string | null;
    cancelled_by: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    has_credit_notes: boolean;
    has_debit_notes: boolean;
    notes: string | null;
    created_by: string | null;
    approved_by: string | null;
}

// المصروفات
export interface Expense extends BaseEntity {
    code: string | null;
    category_id: string | null;
    branch_id: string;
    treasury_id: string | null;
    supplier_id: string | null;
    amount: number;
    description: string;
    expense_date: string;
    reference: string | null;
    attachment: string | null;
    status: ExpenseStatus;
    approved_by: string | null;
    approved_at: string | null;
    notes: string | null;
    created_by: string | null;
}

// المدفوعات
export interface Payment extends BaseEntity {
    code: string | null;
    payment_type: PaymentType;
    payment_method: PaymentMethod;
    treasury_id: string | null;
    invoice_id: string | null;
    job_order_id: string | null;
    customer_id: string | null;
    supplier_id: string | null;
    amount: number;
    payment_date: string;
    reference: string | null;
    cheque_number: string | null;
    cheque_date: string | null;
    cheque_bank: string | null;
    notes: string | null;
    branch_id: string;
    created_by: string | null;
}

// حركات الخزينة
export interface TreasuryTransaction extends BaseEntity {
    code: string | null;
    treasury_id: string;
    transaction_type: TreasuryTxType;
    amount: number;
    balance_before: number | null;
    balance_after: number | null;
    reference_type: string | null;
    reference_id: string | null;
    party_type: string | null;
    party_id: string | null;
    description: string | null;
    branch_id: string | null;
    created_by: string | null;
}

// التحويلات بين الخزن
export interface TreasuryTransfer extends BaseEntity {
    code: string | null;
    from_treasury_id: string;
    to_treasury_id: string;
    amount: number;
    transfer_date: string;
    notes: string | null;
    status: TransferStatus;
    approved_by: string | null;
    branch_id: string | null;
    created_by: string | null;
}

// الإشعارات الدائنة/المدينة
export interface CreditDebitNote extends BaseEntity {
    code: string | null;
    note_type: NoteType;
    invoice_id: string | null;
    customer_id: string | null;
    amount: number;
    reason: string;
    status: NoteStatus;
    applied_to_invoice_id: string | null;
    refunded_amount: number;
    approved_by: string | null;
    approved_at: string | null;
    branch_id: string | null;
    created_by: string | null;
}

// ============================================================
// Activity Log - سجل النشاط
// ============================================================

export interface ActivityLog extends BaseEntity {
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_code: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    changed_fields: string[] | null;
    description: string | null;
    user_id: string | null;
    user_name: string | null;
    user_role: string | null;
    branch_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
}
