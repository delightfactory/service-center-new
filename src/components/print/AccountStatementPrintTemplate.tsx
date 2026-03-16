import React, { forwardRef } from 'react';
import { User, FileText, Receipt, Car, Calendar, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import {
    PrintContainer,
    PrintHeader,
    PrintFooter,
    PrintDataSection,
    PrintDataRow,
    PrintTable,
    PrintSignature,
    PRINT_CONFIG,
} from './PrintDesignSystem';

// ============================================================
// Account Statement Print Template - قالب طباعة كشف حساب العميل
// ============================================================

// ---- English-numeral formatters for print output ----

/** Format currency with English digits: 3,000.00 ج.م */
function fmtMoney(amount: number): string {
    return new Intl.NumberFormat('en-EG', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount) + ' ج.م';
}

/** Format date with English digits: 16 مارس 2026 */
function fmtDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    // Use ar-u-nu-latn to get Arabic month names with Latin (English) numerals
    return new Intl.DateTimeFormat('ar-u-nu-latn', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(d);
}

// ---- Types ----

export interface StatementInvoice {
    id: string;
    code: string;
    invoice_type: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    created_at: string;
    vehicle?: { plate_number: string; make?: string; model?: string } | null;
    job_order?: { code: string } | null;
    items?: { description: string; quantity: number; unit_price: number; total_price: number }[];
}

export interface StatementPayment {
    id: string;
    code: string;
    payment_type: string;
    payment_method: string;
    amount: number;
    payment_date: string;
    notes?: string | null;
    invoice?: { code: string } | null;
}

export interface AccountStatementData {
    customer: {
        id: string;
        code: string;
        name: string;
        phone: string;
        phone_alt?: string | null;
        email?: string | null;
        address?: string | null;
        customer_type: 'individual' | 'company';
        tax_number?: string | null;
        balance: number;
    };
    dateFrom: string;
    dateTo: string;
    openingBalance: number;
    invoices: StatementInvoice[];
    payments: StatementPayment[];
}

// ---- Label maps ----

const invoiceTypeLabels: Record<string, string> = {
    sales: 'فاتورة مبيعات',
    purchase: 'فاتورة مشتريات',
    sales_return: 'مرتجع مبيعات',
    purchase_return: 'مرتجع مشتريات',
};

const invoiceStatusLabels: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمدة',
    partial: 'مدفوعة جزئياً',
    paid: 'مدفوعة',
    overdue: 'متأخرة',
    cancelled: 'ملغاة',
};

const paymentTypeLabels: Record<string, string> = {
    customer_receipt: 'سند قبض',
    supplier_payment: 'سند صرف',
    advance_payment: 'دفعة مقدمة',
    refund_to_customer: 'مرتجع للعميل',
    refund_from_supplier: 'مرتجع من مورد',
};

const paymentMethodLabels: Record<string, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    bank_transfer: 'تحويل بنكي',
    cheque: 'شيك',
    online: 'إلكتروني',
};

// ---- Ledger builder ----

interface AccountStatementPrintProps {
    data: AccountStatementData;
}

function buildLedger(data: AccountStatementData) {
    type LedgerEntry = {
        date: string;
        type: 'invoice' | 'payment';
        description: string;
        reference: string;
        debit: number;
        credit: number;
        balance: number;
    };

    const entries: LedgerEntry[] = [];

    for (const inv of data.invoices) {
        if (inv.status === 'cancelled' || inv.status === 'draft') continue;
        const vehicleInfo = inv.vehicle
            ? ` | ${inv.vehicle.plate_number}${inv.vehicle.make ? ` ${inv.vehicle.make}` : ''}${inv.vehicle.model ? ` ${inv.vehicle.model}` : ''}`
            : '';
        const jobInfo = inv.job_order ? ` (${inv.job_order.code})` : '';

        entries.push({
            date: inv.created_at,
            type: 'invoice',
            description: `${invoiceTypeLabels[inv.invoice_type] || inv.invoice_type}${vehicleInfo}${jobInfo}`,
            reference: inv.code,
            debit: inv.total_amount,
            credit: 0,
            balance: 0,
        });
    }

    for (const pay of data.payments) {
        const methodLabel = paymentMethodLabels[pay.payment_method] || pay.payment_method;
        const invoiceRef = pay.invoice?.code ? ` | ${pay.invoice.code}` : '';

        entries.push({
            date: pay.payment_date,
            type: 'payment',
            description: `${paymentTypeLabels[pay.payment_type] || pay.payment_type} - ${methodLabel}${invoiceRef}`,
            reference: pay.code,
            debit: 0,
            credit: pay.amount,
            balance: 0,
        });
    }

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = data.openingBalance;
    for (const entry of entries) {
        runningBalance = runningBalance + entry.debit - entry.credit;
        entry.balance = runningBalance;
    }

    return { entries, closingBalance: runningBalance };
}

// ---- Shared inline styles (avoid Tailwind in print - html2pdf can miss some) ----

const cellStyle: React.CSSProperties = {
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    fontSize: '11px',
    lineHeight: '1.5',
    verticalAlign: 'middle',
};

const cellCenter: React.CSSProperties = { ...cellStyle, textAlign: 'center' };
const cellRight: React.CSSProperties = { ...cellStyle, textAlign: 'right' };
const cellMono: React.CSSProperties = { ...cellCenter, fontFamily: 'monospace', whiteSpace: 'nowrap' as const };

const thStyle: React.CSSProperties = {
    ...cellCenter,
    backgroundColor: PRINT_CONFIG.primaryColor,
    color: '#fff',
    fontWeight: 700,
    fontSize: '11px',
    padding: '8px 8px',
};

// ---- Component ----

export const AccountStatementPrintTemplate = forwardRef<HTMLDivElement, AccountStatementPrintProps>(
    ({ data }, ref) => {
        const { entries, closingBalance } = buildLedger(data);
        const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
        const activeInvoices = data.invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft');

        return (
            <PrintContainer ref={ref}>
                {/* Header */}
                <PrintHeader
                    title="كشف حساب عميل"
                    subtitle="Customer Account Statement"
                    documentNumber={`STM-${data.customer.code}`}
                    documentDate={fmtDate(new Date())}
                />

                {/* Period Info */}
                <div
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
                        padding: '10px 16px', borderRadius: '8px', marginBottom: '16px',
                        backgroundColor: '#f0f7ff', border: `1px solid ${PRINT_CONFIG.primaryColor}30`,
                        fontSize: '13px',
                    }}
                >
                    <Calendar size={14} style={{ color: PRINT_CONFIG.primaryColor }} />
                    <span style={{ fontWeight: 700, color: PRINT_CONFIG.primaryColor }}>
                        الفترة من: {fmtDate(data.dateFrom)}
                    </span>
                    <span style={{ color: PRINT_CONFIG.primaryColor }}>—</span>
                    <span style={{ fontWeight: 700, color: PRINT_CONFIG.primaryColor }}>
                        إلى: {fmtDate(data.dateTo)}
                    </span>
                </div>

                {/* Customer Info + Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', pageBreakInside: 'avoid' }}>
                    <PrintDataSection title="بيانات العميل" icon={<User size={16} />}>
                        <PrintDataRow label="الاسم" value={data.customer.name} highlight />
                        <PrintDataRow label="كود العميل" value={data.customer.code} />
                        <PrintDataRow label="النوع" value={data.customer.customer_type === 'company' ? 'شركة / تاجر' : 'فرد'} />
                        <PrintDataRow label="الهاتف" value={data.customer.phone} />
                        {data.customer.phone_alt && <PrintDataRow label="هاتف بديل" value={data.customer.phone_alt} />}
                        {data.customer.address && <PrintDataRow label="العنوان" value={data.customer.address} />}
                        {data.customer.tax_number && <PrintDataRow label="الرقم الضريبي" value={data.customer.tax_number} />}
                    </PrintDataSection>

                    {/* Summary Stats */}
                    <div style={{ border: `2px solid ${PRINT_CONFIG.primaryColor}`, borderRadius: '8px', padding: '14px' }}>
                        <h3 style={{
                            color: PRINT_CONFIG.primaryColor, fontWeight: 700, fontSize: '13px',
                            marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e5e7eb',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            <Wallet size={16} />
                            ملخص الحساب للفترة
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Opening */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                <span style={{ color: '#4b5563', fontSize: '12px' }}>الرصيد الافتتاحي</span>
                                <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>{fmtMoney(data.openingBalance)}</span>
                            </div>
                            {/* Debit */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                                <span style={{ color: '#b91c1c', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <TrendingUp size={13} />
                                    إجمالي المستحق (فواتير)
                                </span>
                                <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px', color: '#b91c1c' }}>{fmtMoney(totalDebit)}</span>
                            </div>
                            {/* Credit */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                                <span style={{ color: '#15803d', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <TrendingDown size={13} />
                                    إجمالي المدفوعات
                                </span>
                                <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px', color: '#15803d' }}>{fmtMoney(totalCredit)}</span>
                            </div>
                            {/* Closing */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 12px', borderRadius: '6px', marginTop: '4px',
                                backgroundColor: PRINT_CONFIG.primaryColor, color: '#fff', fontWeight: 700, fontSize: '14px',
                            }}>
                                <span>الرصيد النهائي</span>
                                <span style={{ fontFamily: 'monospace' }}>{fmtMoney(closingBalance)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===================== Chronological Ledger ===================== */}
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ color: PRINT_CONFIG.primaryColor, fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} />
                        كشف الحركات التفصيلي
                    </h3>

                    {entries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                            لا توجد حركات في هذه الفترة
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '32px' }}>#</th>
                                    <th style={{ ...thStyle, width: '90px', textAlign: 'right' }}>التاريخ</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>البيان</th>
                                    <th style={{ ...thStyle, width: '85px' }}>المرجع</th>
                                    <th style={{ ...thStyle, width: '100px' }}>مدين</th>
                                    <th style={{ ...thStyle, width: '100px' }}>دائن</th>
                                    <th style={{ ...thStyle, width: '110px' }}>الرصيد</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Opening balance row */}
                                <tr style={{ backgroundColor: '#eff6ff', fontWeight: 700 }}>
                                    <td style={cellCenter}>-</td>
                                    <td style={{ ...cellRight, fontSize: '10px' }}>{fmtDate(data.dateFrom)}</td>
                                    <td style={{ ...cellRight, color: PRINT_CONFIG.primaryColor }}>رصيد افتتاحي</td>
                                    <td style={cellCenter}>-</td>
                                    <td style={cellCenter}>-</td>
                                    <td style={cellCenter}>-</td>
                                    <td style={{ ...cellMono, fontWeight: 700, color: PRINT_CONFIG.primaryColor }}>{fmtMoney(data.openingBalance)}</td>
                                </tr>

                                {entries.map((entry, i) => (
                                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                        <td style={{ ...cellCenter, color: '#9ca3af' }}>{i + 1}</td>
                                        <td style={{ ...cellRight, fontSize: '10px' }}>{fmtDate(entry.date)}</td>
                                        <td style={cellRight}>
                                            <span style={{ color: entry.type === 'invoice' ? '#b91c1c' : '#15803d', marginLeft: '4px' }}>
                                                {entry.type === 'invoice' ? '📄' : '💰'}
                                            </span>
                                            {entry.description}
                                        </td>
                                        <td style={{ ...cellCenter, fontFamily: 'monospace', fontSize: '10px' }}>{entry.reference}</td>
                                        <td style={cellMono}>
                                            {entry.debit > 0
                                                ? <span style={{ color: '#dc2626' }}>{fmtMoney(entry.debit)}</span>
                                                : '-'}
                                        </td>
                                        <td style={cellMono}>
                                            {entry.credit > 0
                                                ? <span style={{ color: '#16a34a' }}>{fmtMoney(entry.credit)}</span>
                                                : '-'}
                                        </td>
                                        <td style={{ ...cellMono, fontWeight: 700, color: entry.balance > 0 ? '#b91c1c' : entry.balance < 0 ? '#15803d' : undefined }}>
                                            {fmtMoney(entry.balance)}
                                        </td>
                                    </tr>
                                ))}

                                {/* Totals row */}
                                <tr style={{ fontWeight: 700, backgroundColor: `${PRINT_CONFIG.primaryColor}15` }}>
                                    <td colSpan={4} style={{ ...cellRight, color: PRINT_CONFIG.primaryColor, fontSize: '12px', padding: '8px 10px' }}>
                                        الإجمالي
                                    </td>
                                    <td style={{ ...cellMono, color: '#b91c1c', padding: '8px 8px' }}>{fmtMoney(totalDebit)}</td>
                                    <td style={{ ...cellMono, color: '#15803d', padding: '8px 8px' }}>{fmtMoney(totalCredit)}</td>
                                    <td style={{ ...cellMono, backgroundColor: PRINT_CONFIG.primaryColor, color: '#fff', padding: '8px 8px' }}>{fmtMoney(closingBalance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ===================== Invoice Details ===================== */}
                {activeInvoices.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ color: PRINT_CONFIG.primaryColor, fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Receipt size={16} />
                            تفصيل الفواتير ({activeInvoices.length} فاتورة)
                        </h3>

                        {activeInvoices.map((inv, idx) => (
                            <div key={inv.id} style={{ marginBottom: '14px', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden', pageBreakInside: 'avoid' }}>
                                {/* Invoice header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 12px', backgroundColor: PRINT_CONFIG.secondaryColor,
                                    color: '#fff', fontSize: '11px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontWeight: 700 }}>{idx + 1}. {inv.code}</span>
                                        <span style={{ opacity: 0.85 }}>{invoiceTypeLabels[inv.invoice_type] || inv.invoice_type}</span>
                                        {inv.vehicle && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
                                                <Car size={11} />
                                                {inv.vehicle.plate_number}
                                                {inv.vehicle.make && ` ${inv.vehicle.make}`}
                                                {inv.vehicle.model && ` ${inv.vehicle.model}`}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span>{fmtDate(inv.created_at)}</span>
                                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
                                            {invoiceStatusLabels[inv.status] || inv.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Invoice items table */}
                                {inv.items && inv.items.length > 0 && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                                                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#4b5563', borderBottom: '1px solid #d1d5db', width: '32px', fontSize: '11px' }}>#</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#4b5563', borderBottom: '1px solid #d1d5db', fontSize: '11px' }}>الوصف</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'center', color: '#4b5563', borderBottom: '1px solid #d1d5db', width: '60px', fontSize: '11px' }}>الكمية</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'center', color: '#4b5563', borderBottom: '1px solid #d1d5db', width: '90px', fontSize: '11px' }}>السعر</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'center', color: '#4b5563', borderBottom: '1px solid #d1d5db', width: '90px', fontSize: '11px' }}>الإجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inv.items.map((item, itemIdx) => (
                                                <tr key={itemIdx} style={{ backgroundColor: itemIdx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>{itemIdx + 1}</td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px' }}>{item.description}</td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontSize: '11px' }}>{item.quantity}</td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px' }}>{fmtMoney(item.unit_price)}</td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px' }}>{fmtMoney(item.total_price)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {/* Invoice totals */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', backgroundColor: '#f9fafb', borderTop: '1px solid #d1d5db', fontSize: '12px',
                                    pageBreakInside: 'avoid',
                                }}>
                                    <span style={{ color: '#4b5563' }}>
                                        الإجمالي: <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmtMoney(inv.total_amount)}</span>
                                    </span>
                                    <span style={{ color: '#15803d' }}>
                                        المدفوع: <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmtMoney(inv.paid_amount)}</span>
                                    </span>
                                    <span style={{ color: inv.remaining_amount > 0 ? '#b91c1c' : '#4b5563', fontWeight: inv.remaining_amount > 0 ? 700 : 400 }}>
                                        المتبقي: <span style={{ fontFamily: 'monospace' }}>{fmtMoney(inv.remaining_amount)}</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ===================== Payments Summary ===================== */}
                {data.payments.length > 0 && (
                    <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
                        <h3 style={{ color: PRINT_CONFIG.primaryColor, fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Receipt size={16} />
                            ملخص المدفوعات ({data.payments.length} عملية)
                        </h3>
                        <PrintTable
                            columns={[
                                { key: 'code', label: 'المرجع', align: 'center', width: '90px' },
                                { key: 'date', label: 'التاريخ', align: 'center', width: '100px' },
                                { key: 'type', label: 'النوع', align: 'right' },
                                { key: 'method', label: 'طريقة الدفع', align: 'center', width: '90px' },
                                { key: 'invoice', label: 'الفاتورة', align: 'center', width: '90px' },
                                { key: 'amount', label: 'المبلغ', align: 'center', width: '100px' },
                            ]}
                            data={data.payments.map(p => ({
                                code: p.code,
                                date: fmtDate(p.payment_date),
                                type: paymentTypeLabels[p.payment_type] || p.payment_type,
                                method: paymentMethodLabels[p.payment_method] || p.payment_method,
                                invoice: p.invoice?.code || '-',
                                amount: fmtMoney(p.amount),
                            }))}
                        />
                    </div>
                )}

                {/* ===================== Closing Balance Highlight ===================== */}
                <div style={{
                    padding: '16px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center',
                    backgroundColor: closingBalance > 0 ? '#fef2f2' : closingBalance < 0 ? '#f0fdf4' : '#f8fafc',
                    border: `2px solid ${closingBalance > 0 ? '#ef4444' : closingBalance < 0 ? '#22c55e' : '#94a3b8'}`,
                    pageBreakInside: 'avoid',
                }}>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                        الرصيد النهائي كما في {fmtDate(data.dateTo)}
                    </p>
                    <p style={{
                        fontSize: '22px', fontWeight: 700, fontFamily: 'monospace',
                        color: closingBalance > 0 ? '#b91c1c' : closingBalance < 0 ? '#15803d' : '#374151',
                        margin: 0,
                    }}>
                        {fmtMoney(Math.abs(closingBalance))}
                        <span style={{ fontSize: '13px', fontWeight: 400, marginRight: '8px', fontFamily: 'inherit' }}>
                            {closingBalance > 0 ? '(مستحق على العميل)' : closingBalance < 0 ? '(رصيد لصالح العميل)' : '(الحساب مسوّى)'}
                        </span>
                    </p>
                </div>

                {/* Signatures */}
                <PrintSignature
                    signatures={[
                        { title: 'المحاسب' },
                        { title: 'المدير' },
                        { title: 'العميل' },
                    ]}
                />

                {/* Footer */}
                <PrintFooter message="هذا الكشف صادر بناءً على سجلات المركز ويعتبر صحيحاً ما لم يُعترض عليه خلال 7 أيام من تاريخ الاستلام" />
            </PrintContainer>
        );
    }
);

AccountStatementPrintTemplate.displayName = 'AccountStatementPrintTemplate';

export default AccountStatementPrintTemplate;
