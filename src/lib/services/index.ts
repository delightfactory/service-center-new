// ============================================================
// Services Index - Re-export all services
// ============================================================

// Core Services
export { authService } from './core/auth.service';
export { branchService } from './core/branch.service';
export { profileService } from './core/profile.service';
export { warehouseService } from './core/warehouse.service';
export { activityLogService } from './core/activity-log.service';

// CRM Services
export { customerService } from './crm/customer.service';
export { vehicleService } from './crm/vehicle.service';
export { supplierService } from './crm/supplier.service';

// Operations Services
export { assessmentService } from './operations/assessment.service';
export { jobOrderService } from './operations/job-order.service';
export { jobItemService } from './operations/job-item.service';

// Inventory Services
export { productService } from './inventory/product.service';
export { categoryService } from './inventory/category.service';
export { inventoryService } from './inventory/inventory.service';

// Finance Services
export { invoiceService } from './finance/invoice.service';
export { paymentService } from './finance/payment.service';
export { treasuryService } from './finance/treasury.service';
export { expenseService } from './finance/expense.service';
export { creditDebitNoteService } from './finance/credit-debit-note.service';

// ============================================================
// Type Re-exports from services
// ============================================================

// Core
export type { SignInCredentials, SignUpCredentials } from './core/auth.service';
export type { CreateBranchDTO, UpdateBranchDTO } from './core/branch.service';
export type { UpdateProfileDTO, ProfileFilters } from './core/profile.service';
export type { CreateWarehouseDTO, UpdateWarehouseDTO, WarehouseStockItem } from './core/warehouse.service';
export type { LogActionDTO, ActivityLogFilters } from './core/activity-log.service';

// CRM
export type { CreateCustomerDTO, UpdateCustomerDTO, CustomerFilters, CustomerWithVehicles } from './crm/customer.service';
export type { CreateVehicleDTO, UpdateVehicleDTO, VehicleWithCustomer } from './crm/vehicle.service';
export type { CreateSupplierDTO, UpdateSupplierDTO } from './crm/supplier.service';

// Operations
export type { CreateAssessmentDTO, UpdateAssessmentDTO, AssessmentFilters, AssessmentWithRelations } from './operations/assessment.service';
export type { CreateJobOrderDTO, UpdateJobOrderDTO, JobOrderFilters, JobOrderWithRelations } from './operations/job-order.service';
export type { CreateJobItemDTO, UpdateJobItemDTO, JobItemWithProduct } from './operations/job-item.service';

// Inventory
export type { CreateProductDTO, UpdateProductDTO, ProductFilters, ProductWithCategory } from './inventory/product.service';
export type { CreateCategoryDTO, UpdateCategoryDTO, CategoryTreeNode } from './inventory/category.service';
export type { RecordTransactionDTO, TransferItemDTO, InventoryFilters, ProductStock } from './inventory/inventory.service';

// Finance
export type { CreateInvoiceDTO, UpdateInvoiceDTO, InvoiceFilters, InvoiceWithRelations } from './finance/invoice.service';
export type { CreatePaymentDTO, PaymentFilters, PaymentWithRelations } from './finance/payment.service';
export type { CreateTreasuryDTO, UpdateTreasuryDTO, TreasuryTransactionFilters } from './finance/treasury.service';
export type { CreateExpenseDTO, UpdateExpenseDTO, ExpenseFilters, ExpenseWithRelations } from './finance/expense.service';
export type { CreateNoteDTO, UpdateNoteDTO, NoteFilters, NoteWithRelations } from './finance/credit-debit-note.service';
