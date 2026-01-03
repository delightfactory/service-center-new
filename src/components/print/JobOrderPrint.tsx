import React, { forwardRef } from 'react';
import { Wrench, Car, User, Calendar, Phone, ClipboardList, Package, AlertCircle } from 'lucide-react';
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
// Job Order Print Template - أمر الشغل
// ============================================================

interface JobOrderItem {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    type: 'service' | 'part';
}

interface JobOrderPrintProps {
    jobOrder: {
        code: string;
        created_at: string;
        status: string;
        priority?: string;
        job_category?: string;
        started_at?: string;
        completed_at?: string;
        estimated_completion?: string;
        notes?: string;
        manager_instructions?: string;
    };
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
    assessment?: {
        mileage_in?: number;
        fuel_level?: number;
        customer_complaint?: string;
        technician_notes?: string;
    } | null;
    items: JobOrderItem[];
    assignedTechs?: {
        name: string;
        is_lead?: boolean;
    }[];
    totals?: {
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
    };
}

const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار',
    in_progress: 'جاري العمل',
    completed: 'مكتمل',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
};

const priorityLabels: Record<string, { label: string; color: string }> = {
    low: { label: 'عادي', color: '#6b7280' },
    normal: { label: 'متوسط', color: '#3b82f6' },
    high: { label: 'مرتفع', color: '#f59e0b' },
    urgent: { label: 'عاجل', color: '#ef4444' },
};

export const JobOrderPrint = forwardRef<HTMLDivElement, JobOrderPrintProps>(
    ({ jobOrder, customer, vehicle, assessment, items, totals }, ref) => {
        // Separate services and parts
        const services = items.filter(i => i.type === 'service');
        const parts = items.filter(i => i.type === 'part');

        const priorityInfo = priorityLabels[jobOrder.priority || 'normal'];

        return (
            <PrintContainer ref={ref}>
                {/* Header */}
                <PrintHeader
                    title="أمر شغل"
                    subtitle="Job Order"
                    documentNumber={jobOrder.code}
                    documentDate={formatDate(jobOrder.created_at)}
                />

                {/* Priority Badge - if urgent or high */}
                {(jobOrder.priority === 'high' || jobOrder.priority === 'urgent') && (
                    <div
                        className="flex items-center justify-center gap-2 p-2 rounded-lg mb-4 text-white"
                        style={{ backgroundColor: priorityInfo.color }}
                    >
                        <AlertCircle size={20} />
                        <span className="font-bold text-lg">أولوية: {priorityInfo.label}</span>
                    </div>
                )}

                {/* Main Info Grid */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    {customer && (
                        <PrintDataSection title="بيانات العميل" icon={<User size={18} />}>
                            <PrintDataRow label="الاسم" value={customer.name} />
                            {customer.code && (
                                <PrintDataRow label="كود العميل" value={customer.code} />
                            )}
                            {customer.phone && (
                                <PrintDataRow label="الهاتف" value={customer.phone} />
                            )}
                        </PrintDataSection>
                    )}

                    {/* Vehicle Info */}
                    {vehicle && (
                        <PrintDataSection title="بيانات السيارة" icon={<Car size={18} />} variant="highlight">
                            <PrintDataRow
                                label="رقم اللوحة"
                                value={
                                    <span className="font-mono text-lg font-bold">
                                        {vehicle.plate_number}
                                    </span>
                                }
                            />
                            {(vehicle.make || vehicle.model) && (
                                <PrintDataRow
                                    label="النوع/الموديل"
                                    value={`${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}`}
                                />
                            )}
                            {vehicle.color && (
                                <PrintDataRow label="اللون" value={vehicle.color} />
                            )}
                            {vehicle.vin && (
                                <PrintDataRow label="رقم الشاسيه" value={vehicle.vin} />
                            )}
                        </PrintDataSection>
                    )}
                </div>

                {/* Assessment Info */}
                {assessment && (
                    <PrintDataSection title="تقييم الاستلام" icon={<ClipboardList size={18} />}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                {assessment.mileage_in && (
                                    <PrintDataRow
                                        label="قراءة العداد"
                                        value={`${assessment.mileage_in.toLocaleString()} كم`}
                                    />
                                )}
                                {assessment.fuel_level !== undefined && (
                                    <PrintDataRow
                                        label="مستوى الوقود"
                                        value={`${assessment.fuel_level}%`}
                                    />
                                )}
                            </div>
                            <div>
                                {jobOrder.estimated_completion && (
                                    <PrintDataRow
                                        label="موعد التسليم المتوقع"
                                        value={formatDate(jobOrder.estimated_completion)}
                                    />
                                )}
                                <PrintDataRow
                                    label="الحالة"
                                    value={statusLabels[jobOrder.status] || jobOrder.status}
                                />
                            </div>
                        </div>

                        {assessment.customer_complaint && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                                <p className="font-bold text-yellow-800 mb-1">شكوى العميل:</p>
                                <p className="text-yellow-700">{assessment.customer_complaint}</p>
                            </div>
                        )}
                    </PrintDataSection>
                )}

                {/* Services */}
                {services.length > 0 && (
                    <div className="mb-4">
                        <h3
                            className="font-bold text-lg mb-3 flex items-center gap-2"
                            style={{ color: PRINT_CONFIG.primaryColor }}
                        >
                            <Wrench size={18} />
                            الخدمات والأعمال
                        </h3>
                        <PrintTable
                            columns={[
                                { key: 'description', label: 'الوصف', align: 'right' },
                                { key: 'quantity', label: 'الكمية', align: 'center', width: '80px' },
                                { key: 'unit_price', label: 'السعر', align: 'center', width: '100px' },
                                { key: 'total', label: 'الإجمالي', align: 'center', width: '100px' },
                            ]}
                            data={services.map(s => ({
                                description: s.description,
                                quantity: s.quantity,
                                unit_price: formatCurrency(s.unit_price),
                                total: formatCurrency(s.total),
                            }))}
                        />
                    </div>
                )}

                {/* Parts */}
                {parts.length > 0 && (
                    <div className="mb-4">
                        <h3
                            className="font-bold text-lg mb-3 flex items-center gap-2"
                            style={{ color: PRINT_CONFIG.primaryColor }}
                        >
                            <Package size={18} />
                            قطع الغيار
                        </h3>
                        <PrintTable
                            columns={[
                                { key: 'description', label: 'الصنف', align: 'right' },
                                { key: 'quantity', label: 'الكمية', align: 'center', width: '80px' },
                                { key: 'unit_price', label: 'السعر', align: 'center', width: '100px' },
                                { key: 'total', label: 'الإجمالي', align: 'center', width: '100px' },
                            ]}
                            data={parts.map(p => ({
                                description: p.description,
                                quantity: p.quantity,
                                unit_price: formatCurrency(p.unit_price),
                                total: formatCurrency(p.total),
                            }))}
                        />
                    </div>
                )}

                {/* Totals */}
                {totals && (
                    <div className="flex justify-end mb-6">
                        <PrintTotals
                            items={[
                                { label: 'الإجمالي الفرعي', value: formatCurrency(totals.subtotal) },
                                ...(totals.discount > 0 ? [{
                                    label: 'الخصم',
                                    value: `- ${formatCurrency(totals.discount)}`,
                                    type: 'discount' as const
                                }] : []),
                                ...(totals.tax > 0 ? [{
                                    label: 'الضريبة',
                                    value: formatCurrency(totals.tax)
                                }] : []),
                                {
                                    label: 'الإجمالي',
                                    value: formatCurrency(totals.total),
                                    type: 'total' as const
                                },
                            ]}
                        />
                    </div>
                )}

                {/* Notes */}
                {jobOrder.notes && (
                    <div className="p-4 bg-gray-50 rounded-lg mb-6">
                        <p className="font-bold text-gray-700 mb-1">ملاحظات:</p>
                        <p className="text-gray-600 whitespace-pre-wrap">{jobOrder.notes}</p>
                    </div>
                )}

                {/* Terms */}
                <div className="p-4 bg-blue-50 rounded-lg mb-6 text-sm text-blue-800">
                    <p className="font-bold mb-2">الشروط والأحكام:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                        <li>المركز غير مسؤول عن أي محتويات شخصية داخل السيارة</li>
                        <li>يلتزم العميل باستلام السيارة خلال 7 أيام من إتمام العمل</li>
                        <li>الضمان يسري على قطع الغيار والأعمال حسب سياسة المركز</li>
                    </ul>
                </div>

                {/* Customer Acknowledgment */}
                <div
                    className="p-4 rounded-lg mb-6 border-2"
                    style={{ borderColor: PRINT_CONFIG.primaryColor }}
                >
                    <p className="text-center font-bold" style={{ color: PRINT_CONFIG.primaryColor }}>
                        أقر أنا العميل بموافقتي على إجراء الأعمال المذكورة أعلاه والالتزام بالشروط والأحكام
                    </p>
                </div>

                {/* Signatures */}
                <PrintSignature
                    signatures={[
                        { title: 'توقيع العميل', name: customer?.name },
                        { title: 'مسؤول الاستقبال' },
                        { title: 'الفني المسؤول' },
                    ]}
                />

                {/* Footer */}
                <PrintFooter message="نتمنى لكم تجربة صيانة ممتازة" />
            </PrintContainer>
        );
    }
);

JobOrderPrint.displayName = 'JobOrderPrint';

export default JobOrderPrint;
