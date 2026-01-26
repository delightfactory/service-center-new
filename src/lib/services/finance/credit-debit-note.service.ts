// ============================================================
// Credit/Debit Note Service (الإشعارات الدائنة/المدينة)
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { BaseService } from '@/lib/services/base.service';
import { handleSupabaseError } from '@/lib/utils/error-handler';
import type { CreditDebitNote, Invoice, Customer } from '@/types/database';
import type { NoteType, NoteStatus } from '@/types/enums';
import type { PaginationParams, PaginatedResponse } from '@/lib/utils/pagination';
import { normalizePaginationParams, calculateRange, buildPaginationMeta } from '@/lib/utils/pagination';

// ============================================================
// Types
// ============================================================

export interface CreateNoteDTO {
    note_type: NoteType;
    invoice_id?: string | null;
    customer_id?: string | null;
    amount: number;
    reason: string;
    branch_id?: string;
}

export interface UpdateNoteDTO {
    status?: NoteStatus;
    applied_to_invoice_id?: string | null;
    refunded_amount?: number;
    approved_by?: string;
    approved_at?: string;
}

export interface NoteFilters {
    note_type?: NoteType;
    status?: NoteStatus;
    customer_id?: string;
    invoice_id?: string;
    branch_id?: string;
}

export interface NoteWithRelations extends CreditDebitNote {
    invoice?: Pick<Invoice, 'id' | 'code' | 'total_amount'> | null;
    customer?: Pick<Customer, 'id' | 'name'> | null;
}

// ============================================================
// Credit/Debit Note Service
// ============================================================

class CreditDebitNoteService extends BaseService<CreditDebitNote, CreateNoteDTO, UpdateNoteDTO> {
    protected tableName = 'credit_debit_notes';
    protected selectColumns = `
    id, code, note_type, invoice_id, customer_id, amount, reason,
    status, applied_to_invoice_id, refunded_amount,
    approved_by, approved_at, branch_id, created_by, created_at
  `;
    protected sortColumn = 'created_at';

    /**
     * Get notes with filters
     */
    async getNotes(
        params: Partial<PaginationParams> = {},
        filters: NoteFilters = {}
    ): Promise<PaginatedResponse<NoteWithRelations>> {
        const normalizedParams = normalizePaginationParams(params);
        const [from, to] = calculateRange(normalizedParams);

        let query = supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        invoice:invoices (id, code, total_amount),
        customer:customers (id, name)
      `, { count: 'exact' });

        // Apply filters
        if (filters.note_type) {
            query = query.eq('note_type', filters.note_type);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters.invoice_id) {
            query = query.eq('invoice_id', filters.invoice_id);
        }
        if (filters.branch_id) {
            query = query.eq('branch_id', filters.branch_id);
        }

        query = query
            .range(from, to)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) handleSupabaseError(error);

        return {
            data: (data as unknown as NoteWithRelations[]) || [],
            meta: buildPaginationMeta(count || 0, normalizedParams),
        };
    }

    /**
     * Create credit note (إشعار دائن)
     * يُستخدم عند: مرتجع مبيعات، خصم للعميل
     */
    async createCreditNote(
        invoiceId: string | null,
        customerId: string,
        amount: number,
        reason: string,
        branchId?: string,
        createdBy?: string
    ): Promise<CreditDebitNote> {
        const note = await this.create({
            note_type: 'credit',
            invoice_id: invoiceId,
            customer_id: customerId,
            amount,
            reason,
            branch_id: branchId,
        });

        // Update invoice if linked
        if (invoiceId) {
            await supabase
                .from('invoices')
                .update({ has_credit_notes: true })
                .eq('id', invoiceId);
        }

        return note;
    }

    /**
     * Create debit note (إشعار مدين)
     * يُستخدم عند: رسوم إضافية، فرق أسعار
     */
    async createDebitNote(
        invoiceId: string | null,
        customerId: string,
        amount: number,
        reason: string,
        branchId?: string,
        createdBy?: string
    ): Promise<CreditDebitNote> {
        const note = await this.create({
            note_type: 'debit',
            invoice_id: invoiceId,
            customer_id: customerId,
            amount,
            reason,
            branch_id: branchId,
        });

        // Update invoice if linked
        if (invoiceId) {
            await supabase
                .from('invoices')
                .update({ has_debit_notes: true })
                .eq('id', invoiceId);
        }

        return note;
    }

    /**
     * Approve note
     */
    async approveNote(id: string, approvedBy: string): Promise<CreditDebitNote> {
        return this.update(id, {
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
        });
    }

    /**
     * Apply note to invoice (تطبيق على فاتورة)
     */
    async applyToInvoice(noteId: string, targetInvoiceId: string): Promise<CreditDebitNote> {
        const note = await this.getById(noteId);

        if (note.status !== 'approved') {
            throw new Error('يجب اعتماد الإشعار أولاً');
        }

        // Get target invoice
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select('id, total_amount, paid_amount, remaining_amount')
            .eq('id', targetInvoiceId)
            .single();

        if (invoiceError) handleSupabaseError(invoiceError);

        // Apply note
        if (note.note_type === 'credit') {
            // Credit note offsets the remaining amount (without touching generated remaining_amount)
            const newPaidAmount = Math.min(invoice.total_amount, invoice.paid_amount + note.amount);
            const newStatus = newPaidAmount >= invoice.total_amount
                ? 'paid'
                : newPaidAmount > 0
                    ? 'partial'
                    : 'approved';

            await supabase
                .from('invoices')
                .update({
                    paid_amount: newPaidAmount,
                    status: newStatus,
                })
                .eq('id', targetInvoiceId);
        } else {
            // Debit note increases invoice amount; recompute status based on paid_amount
            const newTotalAmount = invoice.total_amount + note.amount;
            const newStatus = invoice.paid_amount >= newTotalAmount
                ? 'paid'
                : invoice.paid_amount > 0
                    ? 'partial'
                    : 'approved';

            await supabase
                .from('invoices')
                .update({
                    total_amount: newTotalAmount,
                    status: newStatus,
                })
                .eq('id', targetInvoiceId);
        }

        // Update note status
        return this.update(noteId, {
            status: 'applied',
            applied_to_invoice_id: targetInvoiceId,
        });
    }

    /**
     * Refund note (استرداد نقدي)
     */
    async refundNote(
        noteId: string,
        treasuryId: string,
        amount?: number
    ): Promise<CreditDebitNote> {
        const note = await this.getById(noteId);

        if (note.note_type !== 'credit') {
            throw new Error('الاسترداد متاح فقط للإشعارات الدائنة');
        }

        if (note.status !== 'approved') {
            throw new Error('يجب اعتماد الإشعار أولاً');
        }

        const refundAmount = amount || note.amount;

        // Create payment (refund)
        await supabase.from('payments').insert({
            payment_type: 'refund_to_customer',
            payment_method: 'cash',
            treasury_id: treasuryId,
            customer_id: note.customer_id,
            amount: refundAmount,
            notes: `استرداد بموجب الإشعار الدائن: ${note.code}`,
            branch_id: note.branch_id,
        });

        // Update note
        return this.update(noteId, {
            status: 'applied',
            refunded_amount: refundAmount,
        });
    }

    /**
     * Cancel note
     */
    async cancelNote(id: string): Promise<CreditDebitNote> {
        return this.update(id, { status: 'cancelled' });
    }

    /**
     * Get customer outstanding notes
     */
    async getCustomerNotes(customerId: string): Promise<NoteWithRelations[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select(`
        ${this.selectColumns},
        invoice:invoices (id, code, total_amount)
      `)
            .eq('customer_id', customerId)
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false });

        if (error) handleSupabaseError(error);
        return data as unknown as NoteWithRelations[];
    }
}

export const creditDebitNoteService = new CreditDebitNoteService();
export default creditDebitNoteService;
