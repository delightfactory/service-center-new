import React, { forwardRef } from 'react';
import { CreditCard, FileText, User, Calendar, Banknote, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
    PrintContainer,
    PrintHeader,
    PrintFooter,
    PrintDataSection,
    PrintDataRow,
    PrintSignature,
    PRINT_CONFIG,
} from './PrintDesignSystem';

// ============================================================
// Payment Receipt Print Template - إيصال الدفع
// ============================================================

interface PaymentReceiptProps {
    payment: {
        id: string;
        code?: string;
        amount: number;
        payment_method: string;
        reference_number?: string;
        notes?: string;
        created_at: string;
    };
    invoice?: {
        code: string;
        total_amount: number;
        paid_amount: number;
        remaining_amount: number;
    } | null;
    customer: {
        name: string;
        phone?: string;
        code?: string;
    };
    receivedBy?: string;
}

const paymentMethodLabels: Record<string, string> = {
    cash: 'نقداً',
    card: 'بطاقة ائتمان',
    bank_transfer: 'تحويل بنكي',
    check: 'شيك',
    other: 'أخرى',
};

export const PaymentReceiptPrint = forwardRef<HTMLDivElement, PaymentReceiptProps>(
    ({ payment, invoice, customer, receivedBy }, ref) => {
        const paymentCode = payment.code || `PAY-${payment.id.slice(0, 8).toUpperCase()}`;

        return (
            <PrintContainer ref={ref}>
                {/* Header */}
                <PrintHeader
                    title="إيصال استلام"
                    subtitle="Payment Receipt"
                    documentNumber={paymentCode}
                    documentDate={formatDate(payment.created_at)}
                />

                {/* Main Content */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    <PrintDataSection title="بيانات العميل" icon={<User size={18} />}>
                        <PrintDataRow label="الاسم" value={customer.name} />
                        {customer.code && (
                            <PrintDataRow label="كود العميل" value={customer.code} />
                        )}
                        {customer.phone && (
                            <PrintDataRow label="الهاتف" value={customer.phone} />
                        )}
                    </PrintDataSection>

                    {/* Payment Info */}
                    <PrintDataSection title="بيانات الدفعة" icon={<CreditCard size={18} />} variant="highlight">
                        <PrintDataRow
                            label="المبلغ"
                            value={formatCurrency(payment.amount)}
                            highlight
                        />
                        <PrintDataRow
                            label="طريقة الدفع"
                            value={paymentMethodLabels[payment.payment_method] || payment.payment_method}
                        />
                        {payment.reference_number && (
                            <PrintDataRow label="رقم المرجع" value={payment.reference_number} />
                        )}
                    </PrintDataSection>
                </div>

                {/* Invoice Info */}
                {invoice && (
                    <PrintDataSection title="بيانات الفاتورة" icon={<FileText size={18} />}>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-gray-100 rounded">
                                <p className="text-xs text-gray-500 mb-1">رقم الفاتورة</p>
                                <p className="font-bold">{invoice.code}</p>
                            </div>
                            <div className="text-center p-3 bg-gray-100 rounded">
                                <p className="text-xs text-gray-500 mb-1">إجمالي الفاتورة</p>
                                <p className="font-bold">{formatCurrency(invoice.total_amount)}</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded">
                                <p className="text-xs text-green-600 mb-1">إجمالي المدفوع</p>
                                <p className="font-bold text-green-700">{formatCurrency(invoice.paid_amount)}</p>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded">
                                <p className="text-xs text-orange-600 mb-1">المتبقي</p>
                                <p className="font-bold text-orange-700">{formatCurrency(invoice.remaining_amount)}</p>
                            </div>
                        </div>
                    </PrintDataSection>
                )}

                {/* Amount in Words (Optional Enhancement) */}
                <div
                    className="p-4 rounded-lg mb-6 text-center"
                    style={{ backgroundColor: `${PRINT_CONFIG.primaryColor}10` }}
                >
                    <p className="text-lg">
                        <span className="text-gray-600">المبلغ المستلم: </span>
                        <span
                            className="font-bold text-xl"
                            style={{ color: PRINT_CONFIG.primaryColor }}
                        >
                            {formatCurrency(payment.amount)}
                        </span>
                        <span className="text-gray-600"> فقط لا غير</span>
                    </p>
                </div>

                {/* Notes */}
                {payment.notes && (
                    <div className="p-4 bg-gray-50 rounded-lg mb-6">
                        <p className="font-bold text-gray-700 mb-1">ملاحظات:</p>
                        <p className="text-gray-600">{payment.notes}</p>
                    </div>
                )}

                {/* Confirmation */}
                <div className="flex items-center justify-center gap-2 p-4 bg-green-50 rounded-lg mb-6 text-green-800">
                    <CheckCircle2 size={24} />
                    <p className="font-bold text-lg">تم استلام المبلغ بنجاح</p>
                </div>

                {/* Signatures */}
                <PrintSignature
                    signatures={[
                        { title: 'توقيع المستلم', name: receivedBy || 'أمين الصندوق' },
                        { title: 'توقيع العميل', name: customer.name },
                    ]}
                />

                {/* Footer */}
                <PrintFooter message="شكراً لتعاملكم معنا" />
            </PrintContainer>
        );
    }
);

PaymentReceiptPrint.displayName = 'PaymentReceiptPrint';

export default PaymentReceiptPrint;
