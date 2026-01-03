import React, { forwardRef } from 'react';
import { FileText, User, Car, Package } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
    PrintContainer,
    PrintHeader,
    PrintFooter,
    PrintDataSection,
    PrintDataRow,
    PrintTable,
    PrintTotals,
    PrintSignature,
    PRINT_CONFIG,
} from './PrintDesignSystem';

// ============================================================
// Invoice Print Template - قالب طباعة الفاتورة (محسّن)
// ============================================================

interface InvoiceItem {
    description: string;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    total: number;
}

interface InvoicePrintProps {
    invoice: {
        code: string;
        invoice_type: string;
        created_at: string;
        due_date?: string;
        status: string;
        subtotal: number;
        tax_amount: number;
        discount_amount: number;
        total_amount: number;
        paid_amount: number;
        remaining_amount: number;
        notes?: string;
        customer?: {
            name: string;
            phone?: string;
            address?: string;
            tax_number?: string;
            code?: string;
        };
        vehicle?: {
            plate_number: string;
            make?: string;
            model?: string;
        };
    };
    items: InvoiceItem[];
    companyInfo?: {
        name: string;
        address?: string;
        phone?: string;
        tax_number?: string;
        logo_url?: string;
    };
}

const invoiceTypeLabels: Record<string, string> = {
    sales: 'فاتورة مبيعات',
    purchase: 'فاتورة مشتريات',
    sales_return: 'مرتجع مبيعات',
    purchase_return: 'مرتجع مشتريات',
};

const invoiceTypeSubtitles: Record<string, string> = {
    sales: 'Sales Invoice',
    purchase: 'Purchase Invoice',
    sales_return: 'Sales Return',
    purchase_return: 'Purchase Return',
};

export const InvoicePrintTemplate = forwardRef<HTMLDivElement, InvoicePrintProps>(
    ({ invoice, items, companyInfo }, ref) => {
        // Build totals array with proper type
        type TotalItem = {
            label: string;
            value: string;
            type?: 'normal' | 'discount' | 'total' | 'paid' | 'remaining';
        };

        const totalsItems: TotalItem[] = [
            { label: 'الإجمالي الفرعي', value: formatCurrency(invoice.subtotal) },
        ];

        if (invoice.discount_amount > 0) {
            totalsItems.push({
                label: 'الخصم',
                value: `- ${formatCurrency(invoice.discount_amount)}`,
                type: 'discount',
            });
        }

        if (invoice.tax_amount > 0) {
            totalsItems.push({
                label: 'الضريبة (15%)',
                value: formatCurrency(invoice.tax_amount),
            });
        }

        totalsItems.push({
            label: 'الإجمالي',
            value: formatCurrency(invoice.total_amount),
            type: 'total',
        });

        if (invoice.paid_amount > 0) {
            totalsItems.push({
                label: 'المدفوع',
                value: formatCurrency(invoice.paid_amount),
                type: 'paid',
            });
            totalsItems.push({
                label: 'المتبقي',
                value: formatCurrency(invoice.remaining_amount),
                type: 'remaining',
            });
        }

        return (
            <PrintContainer ref={ref}>
                {/* Header */}
                <PrintHeader
                    title={invoiceTypeLabels[invoice.invoice_type] || 'فاتورة'}
                    subtitle={invoiceTypeSubtitles[invoice.invoice_type] || 'Invoice'}
                    documentNumber={invoice.code}
                    documentDate={formatDate(invoice.created_at)}
                />

                {/* Due Date Alert */}
                {invoice.due_date && invoice.remaining_amount > 0 && (
                    <div
                        className="p-3 rounded-lg mb-4 text-center"
                        style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                    >
                        <span className="font-bold">تاريخ الاستحقاق: </span>
                        {formatDate(invoice.due_date)}
                    </div>
                )}

                {/* Customer & Vehicle Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {invoice.customer && (
                        <PrintDataSection title="بيانات العميل" icon={<User size={18} />}>
                            <PrintDataRow label="الاسم" value={invoice.customer.name} />
                            {invoice.customer.code && (
                                <PrintDataRow label="كود العميل" value={invoice.customer.code} />
                            )}
                            {invoice.customer.phone && (
                                <PrintDataRow label="الهاتف" value={invoice.customer.phone} />
                            )}
                            {invoice.customer.address && (
                                <PrintDataRow label="العنوان" value={invoice.customer.address} />
                            )}
                            {invoice.customer.tax_number && (
                                <PrintDataRow label="الرقم الضريبي" value={invoice.customer.tax_number} />
                            )}
                        </PrintDataSection>
                    )}

                    {invoice.vehicle && (
                        <PrintDataSection title="بيانات السيارة" icon={<Car size={18} />} variant="highlight">
                            <PrintDataRow
                                label="رقم اللوحة"
                                value={
                                    <span className="font-mono text-lg font-bold">
                                        {invoice.vehicle.plate_number}
                                    </span>
                                }
                            />
                            {(invoice.vehicle.make || invoice.vehicle.model) && (
                                <PrintDataRow
                                    label="النوع/الموديل"
                                    value={`${invoice.vehicle.make || ''} ${invoice.vehicle.model || ''}`}
                                />
                            )}
                        </PrintDataSection>
                    )}
                </div>

                {/* Items Table */}
                <div className="mb-6">
                    <h3
                        className="font-bold text-lg mb-3 flex items-center gap-2"
                        style={{ color: PRINT_CONFIG.primaryColor }}
                    >
                        <Package size={18} />
                        البنود
                    </h3>
                    <PrintTable
                        columns={[
                            { key: 'description', label: 'الوصف', align: 'right' },
                            { key: 'quantity', label: 'الكمية', align: 'center', width: '70px' },
                            { key: 'unit_price', label: 'سعر الوحدة', align: 'center', width: '100px' },
                            { key: 'discount', label: 'الخصم', align: 'center', width: '80px' },
                            { key: 'total', label: 'الإجمالي', align: 'center', width: '100px' },
                        ]}
                        data={items.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: formatCurrency(item.unit_price),
                            discount: item.discount_amount > 0 ? formatCurrency(item.discount_amount) : '-',
                            total: formatCurrency(item.total),
                        }))}
                    />
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-6">
                    <PrintTotals items={totalsItems} />
                </div>

                {/* Notes */}
                {invoice.notes && (
                    <div className="p-4 bg-gray-50 rounded-lg mb-6">
                        <p className="font-bold text-gray-700 mb-1">ملاحظات:</p>
                        <p className="text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                )}

                {/* Payment Status */}
                {invoice.remaining_amount === 0 && invoice.paid_amount > 0 && (
                    <div
                        className="p-4 rounded-lg mb-6 text-center text-white font-bold text-lg"
                        style={{ backgroundColor: '#10b981' }}
                    >
                        ✓ تم السداد بالكامل
                    </div>
                )}

                {/* Footer */}
                <PrintFooter message="شكراً لتعاملكم معنا" />
            </PrintContainer>
        );
    }
);

InvoicePrintTemplate.displayName = 'InvoicePrintTemplate';

export default InvoicePrintTemplate;
