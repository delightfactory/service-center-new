import React, { forwardRef } from 'react';
import { ClipboardCheck, User, Car, Gauge, Fuel, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
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
// Entry Report Print Template - قالب طباعة تقرير الدخول (محسّن)
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
            code?: string;
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

const entryTypeLabels: Record<string, string> = {
    full_car: 'دخول سيارة كاملة',
    control_unit: 'صيانة كنترول',
    quick_check: 'كشف سريع',
};

const entryTypeSubtitles: Record<string, string> = {
    full_car: 'Full Vehicle Entry',
    control_unit: 'Control Unit Service',
    quick_check: 'Quick Check',
};

const statusLabels: Record<string, { icon: string; label: string }> = {
    ok: { icon: '✓', label: 'جيد' },
    warning: { icon: '⚠', label: 'تحذير' },
    critical: { icon: '✗', label: 'حرج' },
    not_checked: { icon: '-', label: 'لم يفحص' },
};

const statusColors: Record<string, string> = {
    ok: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    critical: 'text-red-600 bg-red-50',
    not_checked: 'text-gray-400 bg-gray-50',
};

export const EntryReportPrintTemplate = forwardRef<HTMLDivElement, EntryReportPrintProps>(
    ({ assessment, checklist, companyInfo }, ref) => {
        return (
            <PrintContainer ref={ref}>
                {/* Header */}
                <PrintHeader
                    title="تقرير الاستقبال"
                    subtitle={entryTypeSubtitles[assessment.entry_type] || 'Entry Report'}
                    documentNumber={assessment.code}
                    documentDate={formatDate(assessment.created_at)}
                />

                {/* Entry Type Badge */}
                <div
                    className="text-center p-2 rounded-lg mb-6"
                    style={{ backgroundColor: `${PRINT_CONFIG.primaryColor}15` }}
                >
                    <span className="font-bold" style={{ color: PRINT_CONFIG.primaryColor }}>
                        نوع الدخول: {entryTypeLabels[assessment.entry_type] || assessment.entry_type}
                    </span>
                </div>

                {/* Customer & Vehicle Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {assessment.customer && (
                        <PrintDataSection title="بيانات العميل" icon={<User size={18} />}>
                            <PrintDataRow label="الاسم" value={assessment.customer.name} />
                            {assessment.customer.code && (
                                <PrintDataRow label="كود العميل" value={assessment.customer.code} />
                            )}
                            {assessment.customer.phone && (
                                <PrintDataRow label="الهاتف" value={assessment.customer.phone} />
                            )}
                        </PrintDataSection>
                    )}

                    {assessment.vehicle && (
                        <PrintDataSection title="بيانات السيارة" icon={<Car size={18} />} variant="highlight">
                            <PrintDataRow
                                label="رقم اللوحة"
                                value={
                                    <span className="font-mono text-lg font-bold">
                                        {assessment.vehicle.plate_number}
                                    </span>
                                }
                            />
                            <PrintDataRow
                                label="النوع/الموديل"
                                value={`${assessment.vehicle.make || ''} ${assessment.vehicle.model || ''} ${assessment.vehicle.year || ''}`}
                            />
                            {assessment.vehicle.color && (
                                <PrintDataRow label="اللون" value={assessment.vehicle.color} />
                            )}
                            {assessment.vehicle.vin && (
                                <PrintDataRow
                                    label="رقم الشاسيه"
                                    value={<span className="font-mono text-xs">{assessment.vehicle.vin}</span>}
                                />
                            )}
                        </PrintDataSection>
                    )}
                </div>

                {/* Vehicle Status Meters */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {assessment.mileage_in && (
                        <div
                            className="rounded-lg p-4 text-center"
                            style={{ backgroundColor: `${PRINT_CONFIG.primaryColor}10` }}
                        >
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Gauge size={20} style={{ color: PRINT_CONFIG.primaryColor }} />
                                <span className="text-gray-600">قراءة العداد</span>
                            </div>
                            <p
                                className="text-3xl font-bold"
                                style={{ color: PRINT_CONFIG.primaryColor }}
                            >
                                {assessment.mileage_in.toLocaleString('ar-EG')}
                                <span className="text-lg mr-1">كم</span>
                            </p>
                        </div>
                    )}
                    {assessment.fuel_level !== undefined && (
                        <div
                            className="rounded-lg p-4 text-center"
                            style={{ backgroundColor: `${PRINT_CONFIG.accentColor}15` }}
                        >
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Fuel size={20} style={{ color: PRINT_CONFIG.accentColor }} />
                                <span className="text-gray-600">مستوى الوقود</span>
                            </div>
                            <p
                                className="text-3xl font-bold"
                                style={{ color: PRINT_CONFIG.accentColor }}
                            >
                                {assessment.fuel_level}%
                            </p>
                            <div className="mt-2 h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${assessment.fuel_level}%`,
                                        backgroundColor: PRINT_CONFIG.accentColor
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Customer Complaint */}
                {assessment.customer_complaint && (
                    <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                        <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                            <AlertCircle size={18} />
                            شكوى العميل
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{assessment.customer_complaint}</p>
                    </div>
                )}

                {/* Diagnosis Notes */}
                {assessment.diagnosis_notes && (
                    <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                        <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <ClipboardCheck size={18} />
                            ملاحظات الفحص المبدئي
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{assessment.diagnosis_notes}</p>
                    </div>
                )}

                {/* Checklist */}
                {checklist && checklist.length > 0 && (
                    <div className="mb-6">
                        <h3
                            className="font-bold text-lg mb-3 flex items-center gap-2"
                            style={{ color: PRINT_CONFIG.primaryColor }}
                        >
                            <CheckCircle size={18} />
                            قائمة فحص الاستلام
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {checklist.map((cat, idx) => (
                                <div key={idx} className="border rounded-lg overflow-hidden">
                                    <h4
                                        className="font-medium p-2 text-white"
                                        style={{ backgroundColor: PRINT_CONFIG.primaryColor }}
                                    >
                                        {cat.category}
                                    </h4>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {cat.items.map((item, i) => (
                                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2">{item.name}</td>
                                                    <td className={`p-2 text-center w-16 font-bold ${statusColors[item.status]}`}>
                                                        {statusLabels[item.status].icon}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="mt-3 flex gap-4 justify-center text-sm">
                            <span className="flex items-center gap-1">
                                <span className="text-green-600 font-bold">✓</span> جيد
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="text-yellow-600 font-bold">⚠</span> تحذير
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="text-red-600 font-bold">✗</span> يحتاج إصلاح
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="text-gray-400 font-bold">-</span> لم يفحص
                            </span>
                        </div>
                    </div>
                )}

                {/* Terms */}
                <div className="p-4 bg-gray-100 rounded-lg mb-6 text-sm">
                    <p className="font-bold mb-2">إقرار الاستلام:</p>
                    <p className="text-gray-600">
                        أقر أنا الموقع أدناه بتسليم السيارة الموصوفة أعلاه للمركز لإجراء الفحص والصيانة اللازمة،
                        وأعلم أن المركز غير مسؤول عن أي محتويات شخصية داخل السيارة.
                    </p>
                </div>

                {/* Signatures */}
                <PrintSignature
                    signatures={[
                        { title: 'مسؤول الاستقبال', name: assessment.received_by?.full_name },
                        { title: 'توقيع العميل', name: assessment.customer?.name },
                    ]}
                />

                {/* Footer */}
                <PrintFooter message="شكراً لثقتكم بمركز أبو زياد" />
            </PrintContainer>
        );
    }
);

EntryReportPrintTemplate.displayName = 'EntryReportPrintTemplate';

export default EntryReportPrintTemplate;
