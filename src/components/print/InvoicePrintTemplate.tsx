import React, { forwardRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';

// ============================================================
// Invoice Print Template - قالب طباعة الفاتورة
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

export const InvoicePrintTemplate = forwardRef<HTMLDivElement, InvoicePrintProps>(
    ({ invoice, items, companyInfo }, ref) => {
        const invoiceTypeLabels: Record<string, string> = {
            sales: 'فاتورة مبيعات',
            purchase: 'فاتورة مشتريات',
            sales_return: 'مرتجع مبيعات',
            purchase_return: 'مرتجع مشتريات',
        };

        return (
            <div
                ref={ref}
                className="bg-white text-black p-8 max-w-[210mm] mx-auto print:p-0 print:max-w-none"
                style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
                dir="rtl"
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-300">
                    <div>
                        {companyInfo?.logo_url && (
                            <img
                                src={companyInfo.logo_url}
                                alt="Logo"
                                className="h-16 mb-2"
                            />
                        )}
                        <h1 className="text-2xl font-bold text-gray-800">
                            {companyInfo?.name || 'مركز الصيانة'}
                        </h1>
                        {companyInfo?.address && (
                            <p className="text-sm text-gray-600">{companyInfo.address}</p>
                        )}
                        {companyInfo?.phone && (
                            <p className="text-sm text-gray-600">هاتف: {companyInfo.phone}</p>
                        )}
                        {companyInfo?.tax_number && (
                            <p className="text-sm text-gray-600">الرقم الضريبي: {companyInfo.tax_number}</p>
                        )}
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl font-bold text-primary mb-2">
                            {invoiceTypeLabels[invoice.invoice_type] || 'فاتورة'}
                        </h2>
                        <p className="text-lg font-mono font-bold">{invoice.code}</p>
                        <p className="text-sm text-gray-600">
                            التاريخ: {formatDate(invoice.created_at)}
                        </p>
                        {invoice.due_date && (
                            <p className="text-sm text-gray-600">
                                تاريخ الاستحقاق: {formatDate(invoice.due_date)}
                            </p>
                        )}
                    </div>
                </div>

                {/* Customer & Vehicle Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {invoice.customer && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">بيانات العميل</h3>
                            <p className="font-medium">{invoice.customer.name}</p>
                            {invoice.customer.phone && (
                                <p className="text-sm text-gray-600">هاتف: {invoice.customer.phone}</p>
                            )}
                            {invoice.customer.address && (
                                <p className="text-sm text-gray-600">{invoice.customer.address}</p>
                            )}
                            {invoice.customer.tax_number && (
                                <p className="text-sm text-gray-600">
                                    الرقم الضريبي: {invoice.customer.tax_number}
                                </p>
                            )}
                        </div>
                    )}
                    {invoice.vehicle && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">بيانات السيارة</h3>
                            <p className="font-medium font-mono text-lg">{invoice.vehicle.plate_number}</p>
                            {(invoice.vehicle.make || invoice.vehicle.model) && (
                                <p className="text-sm text-gray-600">
                                    {invoice.vehicle.make} {invoice.vehicle.model}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <table className="w-full mb-6 border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="p-2 text-right border">#</th>
                            <th className="p-2 text-right border">الوصف</th>
                            <th className="p-2 text-center border w-20">الكمية</th>
                            <th className="p-2 text-center border w-28">سعر الوحدة</th>
                            <th className="p-2 text-center border w-24">الخصم</th>
                            <th className="p-2 text-center border w-28">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-2 border text-center">{index + 1}</td>
                                <td className="p-2 border">{item.description}</td>
                                <td className="p-2 border text-center">{item.quantity}</td>
                                <td className="p-2 border text-center">{formatCurrency(item.unit_price)}</td>
                                <td className="p-2 border text-center">
                                    {item.discount_amount > 0 ? formatCurrency(item.discount_amount) : '-'}
                                </td>
                                <td className="p-2 border text-center font-medium">
                                    {formatCurrency(item.total)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end">
                    <div className="w-72 border rounded-lg overflow-hidden">
                        <div className="flex justify-between p-2 bg-gray-50 border-b">
                            <span>الإجمالي الفرعي:</span>
                            <span>{formatCurrency(invoice.subtotal)}</span>
                        </div>
                        {invoice.discount_amount > 0 && (
                            <div className="flex justify-between p-2 border-b text-green-600">
                                <span>الخصم:</span>
                                <span>- {formatCurrency(invoice.discount_amount)}</span>
                            </div>
                        )}
                        {invoice.tax_amount > 0 && (
                            <div className="flex justify-between p-2 border-b">
                                <span>الضريبة (15%):</span>
                                <span>{formatCurrency(invoice.tax_amount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between p-3 bg-gray-800 text-white font-bold text-lg">
                            <span>الإجمالي:</span>
                            <span>{formatCurrency(invoice.total_amount)}</span>
                        </div>
                        {invoice.paid_amount > 0 && (
                            <>
                                <div className="flex justify-between p-2 border-b bg-green-50 text-green-700">
                                    <span>المدفوع:</span>
                                    <span>{formatCurrency(invoice.paid_amount)}</span>
                                </div>
                                <div className="flex justify-between p-2 bg-orange-50 text-orange-700 font-medium">
                                    <span>المتبقي:</span>
                                    <span>{formatCurrency(invoice.remaining_amount)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Notes */}
                {invoice.notes && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-bold mb-2">ملاحظات:</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                    <p>شكراً لتعاملكم معنا</p>
                    <p className="text-xs mt-2">
                        تم الإنشاء بتاريخ: {new Date().toLocaleDateString('ar-EG')}
                    </p>
                </div>

                {/* Print Styles */}
                <style>{`
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none !important; }
                    }
                `}</style>
            </div>
        );
    }
);

InvoicePrintTemplate.displayName = 'InvoicePrintTemplate';

export default InvoicePrintTemplate;
