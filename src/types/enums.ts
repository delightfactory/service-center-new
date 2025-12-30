// ============================================================
// نظام إدارة مركز صيانة السيارات - Database Enums
// تم التوليد من: supabase/migrations/00_enums.sql
// ============================================================

// 1. أدوار المستخدمين
export type UserRole = 
  | 'admin'        // مدير النظام
  | 'manager'      // مدير فرع
  | 'supervisor'   // مشرف
  | 'engineer'     // مهندس استقبال
  | 'technician'   // فني
  | 'warehouse'    // أمين مخزن
  | 'accountant';  // محاسب

export const USER_ROLES: Record<UserRole, string> = {
  admin: 'مدير النظام',
  manager: 'مدير الفرع',
  supervisor: 'المشرف',
  engineer: 'مهندس الاستقبال',
  technician: 'الفني',
  warehouse: 'أمين المخزن',
  accountant: 'المحاسب',
};

// 2. أنواع العملاء
export type CustomerType = 
  | 'individual'   // فرد
  | 'company';     // شركة

export const CUSTOMER_TYPES: Record<CustomerType, string> = {
  individual: 'فرد',
  company: 'شركة',
};

// 3. أنواع الدخول
export type EntryType = 
  | 'vehicle'      // سيارة كاملة
  | 'bench_work'   // قطعة/كنترول
  | 'quick_check'; // كشف سريع

export const ENTRY_TYPES: Record<EntryType, string> = {
  vehicle: 'سيارة كاملة',
  bench_work: 'قطعة/كنترول',
  quick_check: 'كشف سريع',
};

// 4. حالات تقرير الدخول
export type AssessmentStatus = 
  | 'pending'      // في الانتظار
  | 'received'     // تم الاستلام
  | 'in_workshop'; // في ساحة العمل

export const ASSESSMENT_STATUSES: Record<AssessmentStatus, string> = {
  pending: 'في الانتظار',
  received: 'تم الاستلام',
  in_workshop: 'في ساحة العمل',
};

// 5. تصنيفات أوامر الشغل
export type JobCategory = 
  | 'maintenance'   // صيانة عامة
  | 'repair'        // إصلاح
  | 'quick_check'   // كشف سريع
  | 'bench_repair'  // إصلاح كنترول
  | 'body_work'     // سمكرة ودهان
  | 'electrical'    // كهرباء
  | 'ac_service';   // تكييف

export const JOB_CATEGORIES: Record<JobCategory, string> = {
  maintenance: 'صيانة عامة',
  repair: 'إصلاح',
  quick_check: 'كشف سريع',
  bench_repair: 'إصلاح كنترول',
  body_work: 'سمكرة ودهان',
  electrical: 'كهرباء',
  ac_service: 'تكييف',
};

// 6. حالات أوامر الشغل
export type JobStatus = 
  | 'draft'        // مسودة
  | 'pending'      // في الانتظار
  | 'in_progress'  // جاري العمل
  | 'paused'       // متوقف
  | 'review'       // مراجعة فنية
  | 'completed'    // مكتمل
  | 'delivered'    // تم التسليم
  | 'cancelled';   // ملغي

export const JOB_STATUSES: Record<JobStatus, string> = {
  draft: 'مسودة',
  pending: 'في الانتظار',
  in_progress: 'جاري العمل',
  paused: 'متوقف',
  review: 'مراجعة فنية',
  completed: 'مكتمل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

// 7. مستويات الأولوية
export type PriorityLevel = 
  | 'low'      // منخفضة
  | 'normal'   // عادية
  | 'high'     // عالية
  | 'urgent';  // عاجلة

export const PRIORITY_LEVELS: Record<PriorityLevel, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عالية',
  urgent: 'عاجلة',
};

// 8. أنواع بنود أمر الشغل
export type JobItemType = 
  | 'labor'      // عمالة
  | 'part'       // قطعة غيار
  | 'consumable' // مستهلك
  | 'external'   // خدمة خارجية
  | 'note'       // ملاحظة فنية
  | 'warranty';  // ضمان

export const JOB_ITEM_TYPES: Record<JobItemType, string> = {
  labor: 'عمالة',
  part: 'قطعة غيار',
  consumable: 'مستهلك',
  external: 'خدمة خارجية',
  note: 'ملاحظة فنية',
  warranty: 'ضمان',
};

// 9. أنواع المنتجات
export type ProductType = 
  | 'part'       // قطعة غيار
  | 'consumable' // مستهلك
  | 'service';   // خدمة

export const PRODUCT_TYPES: Record<ProductType, string> = {
  part: 'قطعة غيار',
  consumable: 'مستهلك',
  service: 'خدمة',
};

// 10. أنواع حركات المخزون
export type InventoryTxType = 
  | 'purchase'        // شراء
  | 'sale'            // بيع
  | 'job_consumption' // استهلاك أمر شغل
  | 'job_return'      // إرجاع من أمر شغل
  | 'transfer_in'     // تحويل وارد
  | 'transfer_out'    // تحويل صادر
  | 'adjustment'      // تسوية
  | 'damage'          // تالف
  | 'opening';        // رصيد افتتاحي

export const INVENTORY_TX_TYPES: Record<InventoryTxType, string> = {
  purchase: 'شراء',
  sale: 'بيع',
  job_consumption: 'استهلاك أمر شغل',
  job_return: 'إرجاع من أمر شغل',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  adjustment: 'تسوية',
  damage: 'تالف',
  opening: 'رصيد افتتاحي',
};

// 11. أنواع الخزينة
export type TreasuryType = 
  | 'cash'   // نقدية
  | 'bank'   // بنكية
  | 'pos'    // نقاط بيع
  | 'online'; // إلكترونية

export const TREASURY_TYPES: Record<TreasuryType, string> = {
  cash: 'نقدية',
  bank: 'بنكية',
  pos: 'نقاط بيع',
  online: 'إلكترونية',
};

// 12. أنواع حركات الخزينة
export type TreasuryTxType = 
  | 'deposit'          // إيداع
  | 'withdrawal'       // سحب
  | 'transfer_in'      // تحويل وارد
  | 'transfer_out'     // تحويل صادر
  | 'customer_receipt' // تحصيل من عميل
  | 'supplier_payment' // دفع لمورد
  | 'expense'          // مصروف
  | 'income'           // إيراد
  | 'opening_balance'  // رصيد افتتاحي
  | 'adjustment';      // تسوية

export const TREASURY_TX_TYPES: Record<TreasuryTxType, string> = {
  deposit: 'إيداع',
  withdrawal: 'سحب',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  customer_receipt: 'تحصيل من عميل',
  supplier_payment: 'دفع لمورد',
  expense: 'مصروف',
  income: 'إيراد',
  opening_balance: 'رصيد افتتاحي',
  adjustment: 'تسوية',
};

// 13. حالات التحويل
export type TransferStatus = 
  | 'pending'   // في الانتظار
  | 'approved'  // معتمد
  | 'rejected'  // مرفوض
  | 'cancelled'; // ملغي

export const TRANSFER_STATUSES: Record<TransferStatus, string> = {
  pending: 'في الانتظار',
  approved: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
};

// 14. أنواع الفواتير
export type InvoiceType = 
  | 'sales'           // مبيعات
  | 'purchase'        // مشتريات
  | 'sales_return'    // مرتجع مبيعات
  | 'purchase_return'; // مرتجع مشتريات

export const INVOICE_TYPES: Record<InvoiceType, string> = {
  sales: 'مبيعات',
  purchase: 'مشتريات',
  sales_return: 'مرتجع مبيعات',
  purchase_return: 'مرتجع مشتريات',
};

// 15. حالات الفواتير
export type InvoiceStatus = 
  | 'draft'     // مسودة
  | 'approved'  // معتمدة
  | 'partial'   // مدفوعة جزئياً
  | 'paid'      // مدفوعة بالكامل
  | 'overdue'   // متأخرة
  | 'cancelled'; // ملغاة

export const INVOICE_STATUSES: Record<InvoiceStatus, string> = {
  draft: 'مسودة',
  approved: 'معتمدة',
  partial: 'مدفوعة جزئياً',
  paid: 'مدفوعة بالكامل',
  overdue: 'متأخرة',
  cancelled: 'ملغاة',
};

// 16. أنواع المدفوعات
export type PaymentType = 
  | 'customer_receipt'    // سند قبض من عميل
  | 'supplier_payment'    // سند صرف لمورد
  | 'advance_payment'     // دفعة مقدمة (عربون)
  | 'refund_to_customer'  // مرتجع للعميل
  | 'refund_from_supplier'; // مرتجع من مورد

export const PAYMENT_TYPES: Record<PaymentType, string> = {
  customer_receipt: 'سند قبض من عميل',
  supplier_payment: 'سند صرف لمورد',
  advance_payment: 'دفعة مقدمة (عربون)',
  refund_to_customer: 'مرتجع للعميل',
  refund_from_supplier: 'مرتجع من مورد',
};

// 17. طرق الدفع
export type PaymentMethod = 
  | 'cash'          // نقدي
  | 'card'          // بطاقة
  | 'bank_transfer' // تحويل بنكي
  | 'cheque'        // شيك
  | 'online';       // دفع إلكتروني

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  bank_transfer: 'تحويل بنكي',
  cheque: 'شيك',
  online: 'دفع إلكتروني',
};

// 18. حالات المصروفات
export type ExpenseStatus = 
  | 'pending'   // في انتظار الاعتماد
  | 'approved'  // معتمد
  | 'paid'      // مدفوع
  | 'rejected'  // مرفوض
  | 'cancelled'; // ملغي

export const EXPENSE_STATUSES: Record<ExpenseStatus, string> = {
  pending: 'في انتظار الاعتماد',
  approved: 'معتمد',
  paid: 'مدفوع',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
};

// 19. أنواع بنود الحسابات
export type AccountCategoryType = 
  | 'income'   // إيراد
  | 'expense'; // مصروف

export const ACCOUNT_CATEGORY_TYPES: Record<AccountCategoryType, string> = {
  income: 'إيراد',
  expense: 'مصروف',
};

// 20. أنواع الإشعارات الدائنة/المدينة
export type NoteType = 
  | 'credit'  // إشعار دائن
  | 'debit';  // إشعار مدين

export const NOTE_TYPES: Record<NoteType, string> = {
  credit: 'إشعار دائن',
  debit: 'إشعار مدين',
};

// 21. حالات الإشعارات الدائنة/المدينة
export type NoteStatus = 
  | 'pending'   // في الانتظار
  | 'approved'  // معتمد
  | 'applied'   // مطبق
  | 'cancelled'; // ملغي

export const NOTE_STATUSES: Record<NoteStatus, string> = {
  pending: 'في الانتظار',
  approved: 'معتمد',
  applied: 'مطبق',
  cancelled: 'ملغي',
};
