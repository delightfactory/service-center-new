import React, { forwardRef } from 'react';
import { Car, User, FileText, Wrench, Phone, Gauge, CheckCircle2, Package } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
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
// Delivery Receipt Print Template - إيصال تسليم السيارة (محسّن)
// ============================================================

interface DeliveryReceiptProps {
    jobOrder: {
        code: string;
        created_at: string;
        completed_at: string | null;
        delivered_at?: string | null;
    };
    vehicle: {
        plate_number: string;
        make: string | null;
        model: string | null;
        color: string | null;
    };
    customer: {
        name: string;
        phone: string | null;
        code?: string;
    };
    assessment?: {
        mileage_in: number | null;
        fuel_level: number | null;
        customer_complaint: string | null;
    } | null;
    invoice?: {
        code: string;
        total_amount: number;
        paid_amount: number;
    } | null;
    items: {
        description: string;
        quantity: number;
        total_price: number;
        type?: 'service' | 'part';
    }[];
    mileage_out?: number | null;
    centerName?: string;
    centerPhone?: string;
}

export const DeliveryReceiptPrint = forwardRef<HTMLDivElement, DeliveryReceiptProps>(
    ({ jobOrder, vehicle, customer, assessment, invoice, items, mileage_out }, ref) => {
        const services = items.filter(i => i.type === 'service' || !i.type);
        const parts = items.filter(i => i.type === 'part');
        const today = new Date().toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        return (
            <PrintContainer ref={ref}>
                {/* Header */}
                <PrintHeader
                    title="إيصال تسليم سيارة"
                    subtitle="Vehicle Delivery Receipt"
                    documentNumber={jobOrder.code}
                    documentDate={today}
                />

                {/* Main Info */}
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

                    {/* Vehicle Info */}
                    <PrintDataSection title="بيانات السيارة" icon={<Car size={18} />} variant="highlight">
                        <PrintDataRow
                            label="رقم اللوحة"
                            value={
                                <span className="font-mono text-lg font-bold">
                                    {vehicle.plate_number}
                                </span>
                            }
                        />
                        <PrintDataRow
                            label="النوع/الموديل"
                            value={`${vehicle.make || ''} ${vehicle.model || ''}`}
                        />
                        {vehicle.color && (
                            <PrintDataRow label="اللون" value={vehicle.color} />
                        )}
                    </PrintDataSection>
                </div>

                {/* Mileage Comparison */}
                {(assessment?.mileage_in || mileage_out) && (
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        {assessment?.mileage_in && (
                            <div
                                className="rounded-lg p-4 text-center"
                                style={{ backgroundColor: '#f3f4f6' }}
                            >
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Gauge size={18} className="text-gray-500" />
                                    <span className="text-gray-600">عند الاستلام</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-700">
                                    {assessment.mileage_in.toLocaleString()} كم
                                </p>
                            </div>
                        )}
                        {mileage_out && (
                            <div
                                className="rounded-lg p-4 text-center"
                                style={{ backgroundColor: `${PRINT_CONFIG.primaryColor}10` }}
                            >
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Gauge size={18} style={{ color: PRINT_CONFIG.primaryColor }} />
                                    <span className="text-gray-600">عند التسليم</span>
                                </div>
                                <p
                                    className="text-2xl font-bold"
                                    style={{ color: PRINT_CONFIG.primaryColor }}
                                >
                                    {mileage_out.toLocaleString()} كم
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Work Performed */}
                {items.length > 0 && (
                    <div className="mb-6">
                        <h3
                            className="font-bold text-lg mb-3 flex items-center gap-2"
                            style={{ color: PRINT_CONFIG.primaryColor }}
                        >
                            <Wrench size={18} />
                            الأعمال المنفذة
                        </h3>
                        <PrintTable
                            columns={[
                                { key: 'description', label: 'البند', align: 'right' },
                                { key: 'quantity', label: 'الكمية', align: 'center', width: '80px' },
                                { key: 'total', label: 'المبلغ', align: 'center', width: '100px' },
                            ]}
                            data={items.map(item => ({
                                description: item.description,
                                quantity: item.quantity,
                                total: formatCurrency(item.total_price),
                            }))}
                        />
                    </div>
                )}

                {/* Invoice Summary */}
                {invoice && (
                    <div
                        className="p-4 rounded-lg mb-6 border-2"
                        style={{ borderColor: PRINT_CONFIG.primaryColor }}
                    >
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">رقم الفاتورة</p>
                                <p className="font-bold font-mono">{invoice.code}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">الإجمالي</p>
                                <p className="font-bold">{formatCurrency(invoice.total_amount)}</p>
                            </div>
                            <div className="bg-green-50 rounded p-1">
                                <p className="text-xs text-green-600 mb-1">المدفوع</p>
                                <p className="font-bold text-green-700">{formatCurrency(invoice.paid_amount)}</p>
                            </div>
                            <div className={invoice.total_amount - invoice.paid_amount > 0 ? 'bg-orange-50 rounded p-1' : 'bg-green-50 rounded p-1'}>
                                <p className={`text-xs mb-1 ${invoice.total_amount - invoice.paid_amount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    المتبقي
                                </p>
                                <p className={`font-bold ${invoice.total_amount - invoice.paid_amount > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                                    {formatCurrency(invoice.total_amount - invoice.paid_amount)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirmation */}
                <div
                    className="p-4 rounded-lg mb-6 text-center"
                    style={{ backgroundColor: '#dcfce7' }}
                >
                    <div className="flex items-center justify-center gap-2 text-green-800">
                        <CheckCircle2 size={24} />
                        <p className="font-bold text-lg">تم تسليم السيارة بحالة جيدة وإتمام جميع الأعمال المطلوبة</p>
                    </div>
                </div>

                {/* Customer Acknowledgment */}
                <div className="p-4 bg-gray-100 rounded-lg mb-6 text-sm">
                    <p className="font-bold mb-2">إقرار الاستلام:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                        <li>أقر باستلام السيارة الموصوفة أعلاه بحالة جيدة</li>
                        <li>تم الاطلاع على جميع الأعمال المنفذة والموافقة عليها</li>
                        <li>الضمان يسري حسب سياسة المركز المعلنة</li>
                    </ul>
                </div>

                {/* Signatures */}
                <PrintSignature
                    signatures={[
                        { title: 'توقيع المستلم (العميل)', name: customer.name },
                        { title: 'مسؤول التسليم' },
                    ]}
                />

                {/* Footer */}
                <PrintFooter message="نتمنى لكم قيادة آمنة • شكراً لثقتكم في خدماتنا" />
            </PrintContainer>
        );
    }
);

DeliveryReceiptPrint.displayName = 'DeliveryReceiptPrint';

export default DeliveryReceiptPrint;
