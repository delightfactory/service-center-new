// ============================================================
// Zod Validation Schemas (مخططات التحقق)
// ============================================================

import { z } from 'zod';

// ============================================================
// Common Validators
// ============================================================

export const uuidSchema = z.string().uuid('معرف غير صالح');

export const phoneSchema = z.string()
    .regex(/^01[0125][0-9]{8}$/, 'رقم الهاتف غير صالح (يجب أن يبدأ بـ 01)')
    .or(z.literal(''));

export const emailSchema = z.string()
    .email('البريد الإلكتروني غير صالح')
    .or(z.literal(''));

export const plateNumberSchema = z.string()
    .min(2, 'رقم اللوحة مطلوب')
    .max(20, 'رقم اللوحة طويل جداً');

export const positiveNumber = z.number()
    .positive('يجب أن يكون رقم موجب');

export const nonNegativeNumber = z.number()
    .min(0, 'لا يمكن أن يكون سالب');

// ============================================================
// Customer Schema
// ============================================================

export const customerSchema = z.object({
    name: z.string()
        .min(2, 'اسم العميل يجب أن يكون حرفين على الأقل')
        .max(100, 'اسم العميل طويل جداً'),
    phone: phoneSchema,
    phone2: phoneSchema.optional(),
    email: emailSchema.optional(),
    company_name: z.string().max(100).optional(),
    tax_number: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    customer_type: z.enum(['individual', 'company']).default('individual'),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// ============================================================
// Vehicle Schema
// ============================================================

export const vehicleSchema = z.object({
    customer_id: uuidSchema,
    plate_number: plateNumberSchema,
    make: z.string().min(1, 'الماركة مطلوبة').max(50),
    model: z.string().max(50).optional(),
    year: z.number()
        .min(1980, 'سنة الصنع غير صالحة')
        .max(new Date().getFullYear() + 1, 'سنة الصنع غير صالحة')
        .optional()
        .nullable(),
    color: z.string().max(30).optional(),
    vin: z.string().max(30).optional(),
    engine_number: z.string().max(30).optional(),
    current_mileage: nonNegativeNumber.optional().nullable(),
    notes: z.string().max(1000).optional(),
});

export type VehicleFormData = z.infer<typeof vehicleSchema>;

// ============================================================
// Job Order Schema
// ============================================================

export const jobOrderSchema = z.object({
    assessment_id: uuidSchema.optional().nullable(),
    customer_id: uuidSchema,
    vehicle_id: uuidSchema,
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    entry_mileage: nonNegativeNumber.optional().nullable(),
    customer_notes: z.string().max(2000).optional(),
    internal_notes: z.string().max(2000).optional(),
    estimated_cost: nonNegativeNumber.optional().nullable(),
    estimated_completion: z.string().datetime().optional().nullable(),
});

export type JobOrderFormData = z.infer<typeof jobOrderSchema>;

// ============================================================
// Job Item Schema
// ============================================================

export const jobItemSchema = z.object({
    job_order_id: uuidSchema,
    product_id: uuidSchema.optional().nullable(),
    item_type: z.enum(['service', 'part', 'consumable']),
    description: z.string().min(1, 'الوصف مطلوب').max(500),
    quantity: positiveNumber.default(1),
    unit_price: nonNegativeNumber,
    discount: nonNegativeNumber.default(0),
    warehouse_id: uuidSchema.optional().nullable(),
    notes: z.string().max(500).optional(),
});

export type JobItemFormData = z.infer<typeof jobItemSchema>;

// ============================================================
// Payment Schema
// ============================================================

export const paymentSchema = z.object({
    payment_type: z.enum([
        'customer_receipt',
        'supplier_payment',
        'advance_payment',
        'refund_to_customer',
        'refund_from_supplier',
    ]),
    payment_method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'other']),
    amount: positiveNumber,
    treasury_id: uuidSchema,
    invoice_id: uuidSchema.optional().nullable(),
    customer_id: uuidSchema.optional().nullable(),
    supplier_id: uuidSchema.optional().nullable(),
    payment_date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    reference_number: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
}).refine(
    (data) => data.customer_id || data.supplier_id,
    { message: 'يجب تحديد العميل أو المورد' }
);

export type PaymentFormData = z.infer<typeof paymentSchema>;

// ============================================================
// Invoice Schema
// ============================================================

export const invoiceSchema = z.object({
    invoice_type: z.enum(['sales', 'purchase', 'sales_return', 'purchase_return']),
    customer_id: uuidSchema.optional().nullable(),
    supplier_id: uuidSchema.optional().nullable(),
    job_order_id: uuidSchema.optional().nullable(),
    due_date: z.string().optional().nullable(),
    discount_type: z.enum(['percentage', 'fixed']).default('fixed'),
    discount_value: nonNegativeNumber.default(0),
    tax_rate: nonNegativeNumber.default(0),
    notes: z.string().max(1000).optional(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// ============================================================
// Product Schema
// ============================================================

export const productSchema = z.object({
    name: z.string().min(2, 'اسم المنتج مطلوب').max(200),
    product_type: z.enum(['part', 'consumable', 'service']),
    category_id: uuidSchema.optional().nullable(),
    unit: z.string().max(20).default('قطعة'),
    purchase_price: nonNegativeNumber.default(0),
    selling_price: positiveNumber,
    min_stock: nonNegativeNumber.default(0),
    is_active: z.boolean().default(true),
    is_trackable: z.boolean().default(true),
    is_composite: z.boolean().default(false),
    description: z.string().max(1000).optional(),
    barcode: z.string().max(50).optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

// ============================================================
// Expense Schema
// ============================================================

export const expenseSchema = z.object({
    category_id: uuidSchema,
    treasury_id: uuidSchema,
    amount: positiveNumber,
    expense_date: z.string(),
    description: z.string().min(3, 'الوصف مطلوب').max(500),
    payment_method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'other']).default('cash'),
    reference_number: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
    attachments: z.array(z.string()).optional(),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Validate form data and return errors in Arabic
 */
export function validateForm<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        errors[path] = issue.message;
    }

    return { success: false, errors };
}

/**
 * Get first error message from Zod error
 */
export function getFirstError(error: z.ZodError): string {
    return error.issues[0]?.message || 'خطأ في البيانات';
}
