import React, { forwardRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Car, User, FileText, Wrench, Phone, Calendar, Clock, CheckCircle2 } from 'lucide-react';

// ============================================================
// Delivery Receipt Print Template - إيصال تسليم السيارة
// Professional Print-Optimized Design
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
    }[];
    mileage_out?: number | null;
    centerName?: string;
    centerPhone?: string;
}

export const DeliveryReceiptPrint = forwardRef<HTMLDivElement, DeliveryReceiptProps>(
    ({ jobOrder, vehicle, customer, assessment, invoice, items, mileage_out, centerName = 'مركز صيانة السيارات', centerPhone }, ref) => {
        const today = new Date().toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        return (
            <div ref={ref} className="p-8 bg-white text-black min-h-[297mm] w-[210mm] mx-auto print:p-6" dir="rtl">
                {/* Header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{centerName}</h1>
                    {centerPhone && (
                        <p className="text-gray-600 mt-1">تليفون: {centerPhone}</p>
                    )}
                    <div className="mt-4 inline-block bg-gray-100 px-6 py-2 rounded-lg">
                        <h2 className="text-xl font-bold">إيصال تسليم سيارة</h2>
                    </div>
                </div>

                {/* Document Info */}
                <div className="flex justify-between mb-6 text-sm">
                    <div className="flex items-center gap-2">
                        <FileText size={16} />
                        <span>رقم أمر الشغل: <strong>{jobOrder.code}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>تاريخ التسليم: <strong>{today}</strong></span>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                            <User size={18} />
                            بيانات العميل
                        </h3>
                        <div className="space-y-2 text-sm">
                            <p><strong>الاسم:</strong> {customer.name}</p>
                            {customer.phone && (
                                <p className="flex items-center gap-1">
                                    <Phone size={14} />
                                    <strong>الهاتف:</strong> {customer.phone}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                            <Car size={18} />
                            بيانات السيارة
                        </h3>
                        <div className="space-y-2 text-sm">
                            <p><strong>رقم اللوحة:</strong> {vehicle.plate_number}</p>
                            <p><strong>النوع:</strong> {vehicle.make} {vehicle.model}</p>
                            {vehicle.color && <p><strong>اللون:</strong> {vehicle.color}</p>}
                        </div>
                    </div>
                </div>

                {/* Mileage Info */}
                {(assessment?.mileage_in || mileage_out) && (
                    <div className="border rounded-lg p-4 mb-6 bg-gray-50">
                        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                            <Clock size={18} />
                            قراءة العداد
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {assessment?.mileage_in && (
                                <p><strong>عند الاستلام:</strong> {assessment.mileage_in.toLocaleString()} كم</p>
                            )}
                            {mileage_out && (
                                <p><strong>عند التسليم:</strong> {mileage_out.toLocaleString()} كم</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Services Performed */}
                <div className="border rounded-lg p-4 mb-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                        <Wrench size={18} />
                        الأعمال المنفذة
                    </h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-right py-2 font-bold">#</th>
                                <th className="text-right py-2 font-bold">البند</th>
                                <th className="text-center py-2 font-bold">الكمية</th>
                                <th className="text-left py-2 font-bold">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} className="border-b border-gray-200">
                                    <td className="py-2">{index + 1}</td>
                                    <td className="py-2">{item.description}</td>
                                    <td className="py-2 text-center">{item.quantity}</td>
                                    <td className="py-2 text-left">{formatCurrency(item.total_price)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Invoice Summary */}
                {invoice && (
                    <div className="border-2 border-gray-800 rounded-lg p-4 mb-6 bg-gray-50">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-600">رقم الفاتورة: {invoice.code}</p>
                            </div>
                            <div className="text-left">
                                <p className="text-sm">الإجمالي: <strong>{formatCurrency(invoice.total_amount)}</strong></p>
                                <p className="text-sm">المدفوع: <strong className="text-green-700">{formatCurrency(invoice.paid_amount)}</strong></p>
                                {invoice.total_amount - invoice.paid_amount > 0 && (
                                    <p className="text-sm">المتبقي: <strong className="text-red-700">{formatCurrency(invoice.total_amount - invoice.paid_amount)}</strong></p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirmation */}
                <div className="border rounded-lg p-4 mb-8 bg-green-50 border-green-200">
                    <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle2 size={20} />
                        <p className="font-bold">تم استلام السيارة بحالة جيدة وإتمام جميع الأعمال المطلوبة</p>
                    </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t">
                    <div className="text-center">
                        <p className="font-bold mb-12">توقيع المستلم (العميل)</p>
                        <div className="border-b border-gray-400 w-48 mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-2">{customer.name}</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold mb-12">توقيع المسؤول</p>
                        <div className="border-b border-gray-400 w-48 mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-2">مسؤول الاستلام</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-4 border-t text-center text-xs text-gray-500">
                    <p>شكراً لثقتكم في خدماتنا • نتمنى لكم قيادة آمنة</p>
                    <p className="mt-1">تم الطباعة: {new Date().toLocaleString('ar-EG')}</p>
                </div>
            </div>
        );
    }
);

DeliveryReceiptPrint.displayName = 'DeliveryReceiptPrint';

export default DeliveryReceiptPrint;
