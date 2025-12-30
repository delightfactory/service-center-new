import React, { forwardRef } from 'react';
import { formatDate } from '@/lib/utils';

// ============================================================
// Entry Report Print Template - قالب طباعة تقرير الدخول
// ============================================================

interface EntryReportPrintProps {
    assessment: {
        code: string;
        entry_type: string;
        created_at: string;
        customer_complaint?: string;
        diagnosis_notes?: string;
        mileage_in?: number;
        fuel_level?: number;
        status: string;
        customer?: {
            name: string;
            phone?: string;
        };
        vehicle?: {
            plate_number: string;
            make?: string;
            model?: string;
            year?: number;
            color?: string;
            vin?: string;
        };
        received_by?: {
            full_name: string;
        };
    };
    checklist?: {
        category: string;
        items: { name: string; status: 'ok' | 'warning' | 'critical' | 'not_checked' }[];
    }[];
    companyInfo?: {
        name: string;
        address?: string;
        phone?: string;
        logo_url?: string;
    };
}

export const EntryReportPrintTemplate = forwardRef<HTMLDivElement, EntryReportPrintProps>(
    ({ assessment, checklist, companyInfo }, ref) => {
        const entryTypeLabels: Record<string, string> = {
            full_car: 'دخول سيارة كاملة',
            control_unit: 'صيانة كنترول',
            quick_check: 'كشف سريع',
        };

        const statusLabels: Record<string, string> = {
            ok: '✓',
            warning: '⚠',
            critical: '✗',
            not_checked: '-',
        };

        const statusColors: Record<string, string> = {
            ok: 'text-green-600',
            warning: 'text-yellow-600',
            critical: 'text-red-600',
            not_checked: 'text-gray-400',
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
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl font-bold text-primary mb-2">
                            تقرير الدخول
                        </h2>
                        <p className="text-lg font-mono font-bold">{assessment.code}</p>
                        <p className="text-sm text-gray-600">
                            {entryTypeLabels[assessment.entry_type] || assessment.entry_type}
                        </p>
                        <p className="text-sm text-gray-600">
                            التاريخ: {formatDate(assessment.created_at)}
                        </p>
                    </div>
                </div>

                {/* Customer & Vehicle Side by Side */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    {assessment.customer && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">بيانات العميل</h3>
                            <p className="font-medium text-lg">{assessment.customer.name}</p>
                            {assessment.customer.phone && (
                                <p className="text-gray-600">هاتف: {assessment.customer.phone}</p>
                            )}
                        </div>
                    )}

                    {/* Vehicle Info */}
                    {assessment.vehicle && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">بيانات السيارة</h3>
                            <p className="font-medium font-mono text-xl mb-1">{assessment.vehicle.plate_number}</p>
                            <p className="text-gray-600">
                                {assessment.vehicle.make} {assessment.vehicle.model} {assessment.vehicle.year}
                            </p>
                            {assessment.vehicle.color && (
                                <p className="text-gray-600">اللون: {assessment.vehicle.color}</p>
                            )}
                            {assessment.vehicle.vin && (
                                <p className="text-xs text-gray-500 font-mono">VIN: {assessment.vehicle.vin}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Vehicle Status */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {assessment.mileage_in && (
                        <div className="border rounded-lg p-3 text-center">
                            <span className="text-gray-600">عداد الكيلومتر</span>
                            <p className="text-2xl font-bold">{assessment.mileage_in.toLocaleString('ar-EG')} كم</p>
                        </div>
                    )}
                    {assessment.fuel_level !== undefined && (
                        <div className="border rounded-lg p-3 text-center">
                            <span className="text-gray-600">مستوى الوقود</span>
                            <p className="text-2xl font-bold">{assessment.fuel_level}%</p>
                        </div>
                    )}
                </div>

                {/* Customer Complaint */}
                {assessment.customer_complaint && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h3 className="font-bold text-yellow-800 mb-2">شكوى العميل:</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{assessment.customer_complaint}</p>
                    </div>
                )}

                {/* Diagnosis Notes */}
                {assessment.diagnosis_notes && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-bold text-blue-800 mb-2">ملاحظات الفحص:</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{assessment.diagnosis_notes}</p>
                    </div>
                )}

                {/* Checklist */}
                {checklist && checklist.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-700 mb-3">قائمة الفحص:</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {checklist.map((cat, idx) => (
                                <div key={idx} className="border rounded-lg p-3">
                                    <h4 className="font-medium mb-2 border-b pb-1">{cat.category}</h4>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {cat.items.map((item, i) => (
                                                <tr key={i}>
                                                    <td className="py-1">{item.name}</td>
                                                    <td className={`py-1 text-center font-bold ${statusColors[item.status]}`}>
                                                        {statusLabels[item.status]}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Signatures */}
                <div className="mt-8 grid grid-cols-2 gap-8">
                    <div className="border-t-2 pt-4 text-center">
                        <p className="mb-8">توقيع المستلم</p>
                        <p className="font-medium">{assessment.received_by?.full_name || '____________'}</p>
                    </div>
                    <div className="border-t-2 pt-4 text-center">
                        <p className="mb-8">توقيع العميل</p>
                        <p>____________</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                    <p>شكراً لثقتكم بنا</p>
                </div>

                <style>{`
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                `}</style>
            </div>
        );
    }
);

EntryReportPrintTemplate.displayName = 'EntryReportPrintTemplate';

export default EntryReportPrintTemplate;
