import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight, Car, User, Clock, Calendar, Fuel, Gauge,
    FileText, Wrench, AlertCircle, CheckCircle2, Edit,
    Printer, Trash2, Plus
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { jobOrderService, type CreateJobOrderDTO } from '@/lib/services/operations/job-order.service';
import type { AssessmentStatus, EntryType, JobCategory, PriorityLevel } from '@/types/enums';
import { PageHeader } from '@/components/shared';

// ============================================================
// Assessment Details Page
// ============================================================
// Shows assessment details and allows creating job order from it
// ============================================================

interface AssessmentDetails {
    id: string;
    code: string;
    entry_type: EntryType;
    status: AssessmentStatus;
    customer_complaint: string | null;
    initial_diagnosis: string | null;
    fuel_level: number | null;
    mileage_in: number | null;
    inspection_notes: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    customer_id: string;
    vehicle_id: string | null;
    branch_id: string | null;
    customer: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
    };
    vehicle?: {
        id: string;
        plate_number: string;
        make: string | null;
        model: string | null;
        year: number | null;
        color: string | null;
    } | null;
    job_orders?: {
        id: string;
        code: string;
        status: string;
    }[];
}

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string }> = {
    pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    received: { label: 'تم الاستلام', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    in_workshop: { label: 'في الورشة', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
    vehicle: 'سيارة كاملة',
    bench_work: 'كنترول/قطعة',
    quick_check: 'كشف سريع',
};

const JOB_CATEGORIES: { value: JobCategory; label: string }[] = [
    { value: 'maintenance', label: 'صيانة دورية' },
    { value: 'repair', label: 'إصلاح' },
    { value: 'electrical', label: 'كهرباء' },
    { value: 'body_work', label: 'سمكرة ودهان' },
    { value: 'ac_service', label: 'تكييف' },
    { value: 'quick_check', label: 'كشف سريع' },
    { value: 'bench_repair', label: 'إصلاح كنترول' },
];

const PRIORITY_OPTIONS: { value: PriorityLevel; label: string; color: string }[] = [
    { value: 'low', label: 'منخفضة', color: 'text-gray-500' },
    { value: 'normal', label: 'عادية', color: 'text-blue-500' },
    { value: 'high', label: 'عالية', color: 'text-orange-500' },
    { value: 'urgent', label: 'عاجلة', color: 'text-red-500' },
];

// ============================================================
// Inspection Notes Display Component
// ============================================================
interface InspectionNotesDisplayProps {
    data: Record<string, unknown>;
}

const STATUS_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
    works: { icon: <CheckCircle2 size={16} />, color: 'text-green-500' },
    not_working: { icon: <AlertCircle size={16} />, color: 'text-red-500' },
    not_checked: { icon: <Clock size={16} />, color: 'text-gray-400' },
};

const CATEGORY_LABELS_AR: Record<string, string> = {
    electrical: 'البنود الكهربائية',
    mechanical: 'البنود الميكانيكية',
    exterior: 'الحالة الخارجية',
    safety: 'أنظمة السلامة',
};

const STATUS_LABELS_AR: Record<string, string> = {
    works: 'يعمل',
    not_working: 'لا يعمل',
    not_checked: 'غير محدد',
};

function InspectionNotesDisplay({ data }: InspectionNotesDisplayProps) {
    const items = (data.items as Array<{
        key: string;
        status: string;
        notes: string;
        photos: string[];
    }>) || [];

    const additionalNotes = (data.additionalNotes as string) || '';
    const additionalWorkRequest = (data.additionalWorkRequest as string) || '';
    const inspectionPhotos = (data.inspectionPhotos as string[]) || [];

    // Group items by category
    const itemsByCategory: Record<string, typeof items> = {};
    const categoryMap: Record<string, string> = {
        ac: 'electrical', power_windows: 'electrical', central_lock: 'electrical',
        dashboard_lights: 'electrical', all_lights: 'electrical', wipers: 'electrical',
        dashboard_indicators: 'electrical', engine_condition: 'mechanical',
        car_fans: 'mechanical', battery: 'mechanical', glass_cracks: 'exterior',
        mirrors: 'exterior', scratches_dents: 'exterior', tires: 'exterior',
        dashboard_cover: 'exterior', srs: 'safety', abs: 'safety',
    };

    items.forEach(item => {
        const category = categoryMap[item.key] || 'other';
        if (!itemsByCategory[category]) itemsByCategory[category] = [];
        itemsByCategory[category].push(item);
    });

    const ITEM_LABELS: Record<string, string> = {
        ac: 'تكييف', power_windows: 'زجاج كهرباء', central_lock: 'سنتر لوك',
        dashboard_lights: 'أنوار التابلون', all_lights: 'أنوار السيارة بالكامل',
        wipers: 'مساحات', dashboard_indicators: 'مؤشرات التابلون',
        engine_condition: 'حالة الماتور', car_fans: 'مراوح السيارة',
        battery: 'مواصفات البطارية', glass_cracks: 'شروخ الزجاج',
        mirrors: 'مرايات', scratches_dents: 'حكات وخبطات بالسيارة',
        tires: 'إطارات/كوتشات', dashboard_cover: 'لمبة التابلون',
        srs: 'SRS (نظام الأمان)', abs: 'ABS',
    };

    // Count checked items
    const checkedItems = items.filter(i => i.status !== 'not_checked');
    const workingItems = items.filter(i => i.status === 'works');
    const notWorkingItems = items.filter(i => i.status === 'not_working');

    return (
        <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{checkedItems.length}/{items.length}</p>
                    <p className="text-xs text-muted-foreground">تم فحصه</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{workingItems.length}</p>
                    <p className="text-xs text-muted-foreground">يعمل</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{notWorkingItems.length}</p>
                    <p className="text-xs text-muted-foreground">لا يعمل</p>
                </div>
            </div>

            {/* Items by Category */}
            {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">
                        {CATEGORY_LABELS_AR[category] || category}
                    </div>
                    <div className="divide-y">
                        {categoryItems.map(item => {
                            const statusConfig = STATUS_ICONS[item.status] || STATUS_ICONS.not_checked;
                            return (
                                <div key={item.key} className="p-3 flex items-start gap-3">
                                    <div className={cn("mt-0.5", statusConfig.color)}>
                                        {statusConfig.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">
                                                {ITEM_LABELS[item.key] || item.key}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs",
                                                    item.status === 'works' && "border-green-500 text-green-600",
                                                    item.status === 'not_working' && "border-red-500 text-red-600"
                                                )}
                                            >
                                                {STATUS_LABELS_AR[item.status]}
                                            </Badge>
                                        </div>
                                        {item.notes && (
                                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                                        )}
                                        {item.photos && item.photos.length > 0 && (
                                            <div className="flex gap-2 mt-2">
                                                {item.photos.map((photo, idx) => (
                                                    <a key={idx} href={photo} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={photo}
                                                            alt=""
                                                            className="w-12 h-12 rounded-lg object-cover border hover:opacity-75 transition-opacity"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Additional Notes */}
            {additionalNotes && (
                <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">ملاحظات إضافية</p>
                    <p className="text-foreground">{additionalNotes}</p>
                </div>
            )}

            {/* Additional Work Request */}
            {additionalWorkRequest && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">طلب عمل صيانة إضافية</p>
                    <p className="text-foreground">{additionalWorkRequest}</p>
                </div>
            )}

            {/* General Photos */}
            {inspectionPhotos.length > 0 && (
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">صور عامة للمركبة</p>
                    <div className="flex flex-wrap gap-2">
                        {inspectionPhotos.map((photo, idx) => (
                            <a key={idx} href={photo} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={photo}
                                    alt=""
                                    className="w-20 h-20 rounded-lg object-cover border hover:opacity-75 transition-opacity"
                                />
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function AssessmentDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [showJobOrderModal, setShowJobOrderModal] = useState(false);
    const [jobOrderCategory, setJobOrderCategory] = useState<JobCategory>('maintenance');
    const [jobOrderPriority, setJobOrderPriority] = useState<PriorityLevel>('normal');
    const [jobOrderInstructions, setJobOrderInstructions] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Fetch assessment details
    const { data: assessment, isLoading, error } = useQuery({
        queryKey: ['assessment', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('assessments')
                .select(`
          *,
          customer:customers (id, name, phone, email),
          vehicle:vehicles (id, plate_number, make, model, year, color),
          job_orders (id, code, status)
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as AssessmentDetails;
        },
        enabled: !!id,
    });

    // Create job order from assessment
    const handleCreateJobOrder = async () => {
        if (!assessment) return;

        setIsCreating(true);
        setCreateError(null);

        try {
            const dto: CreateJobOrderDTO = {
                assessment_id: assessment.id,
                customer_id: assessment.customer_id,
                vehicle_id: assessment.vehicle_id || undefined,
                branch_id: assessment.branch_id || undefined,
                job_category: jobOrderCategory,
                priority: jobOrderPriority,
                manager_instructions: jobOrderInstructions || undefined,
                notes: assessment.customer_complaint || undefined,
            };

            const jobOrder = await jobOrderService.create(dto);

            // Update assessment status
            await supabase
                .from('assessments')
                .update({ status: 'in_workshop' })
                .eq('id', assessment.id);

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['assessment', id] });
            queryClient.invalidateQueries({ queryKey: ['assessments'] });
            queryClient.invalidateQueries({ queryKey: ['job-orders'] });

            setShowJobOrderModal(false);

            // Navigate to job order or workshop
            navigate('/dashboard/workshop');
        } catch (err) {
            console.error('Error creating job order:', err);
            setCreateError(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء أمر الشغل');
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="w-48 h-8" />
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <Skeleton className="w-full h-20" />
                        <Skeleton className="w-full h-20" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !assessment) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <AlertCircle size={48} className="mx-auto text-destructive mb-4" />
                    <p className="text-destructive">لم يتم العثور على الاستقبال</p>
                    <Button onClick={() => navigate('/dashboard/reception')} className="mt-4">
                        العودة للقائمة
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const statusConfig = STATUS_CONFIG[assessment.status];
    const hasJobOrder = assessment.job_orders && assessment.job_orders.length > 0;

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <PageHeader title="" showBreadcrumbs={true} className="pb-0" />

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/dashboard/reception')}
                >
                    <ArrowRight size={20} />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{assessment.code}</h1>
                    <p className="text-muted-foreground">تفاصيل الاستقبال</p>
                </div>
                <Badge className={cn("text-sm px-3 py-1", statusConfig.color)}>
                    {statusConfig.label}
                </Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Details */}
                <div className="md:col-span-2 space-y-6">
                    {/* Customer & Vehicle */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">معلومات العميل والمركبة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Customer */}
                            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User size={24} className="text-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">{assessment.customer.name}</p>
                                    <p className="text-sm text-muted-foreground">{assessment.customer.phone}</p>
                                </div>
                            </div>

                            {/* Vehicle */}
                            {assessment.vehicle && (
                                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Car size={24} className="text-blue-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-lg">{assessment.vehicle.plate_number}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {assessment.vehicle.make} {assessment.vehicle.model} {assessment.vehicle.year}
                                        </p>
                                    </div>
                                    {assessment.vehicle.color && (
                                        <Badge variant="outline">{assessment.vehicle.color}</Badge>
                                    )}
                                </div>
                            )}

                            {/* Entry Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                                <div className="text-center p-3 bg-muted/30 rounded-lg">
                                    <FileText size={20} className="mx-auto text-muted-foreground mb-1" />
                                    <p className="text-xs text-muted-foreground">نوع الدخول</p>
                                    <p className="font-medium text-sm">{ENTRY_TYPE_LABELS[assessment.entry_type]}</p>
                                </div>
                                {assessment.mileage_in && (
                                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                                        <Gauge size={20} className="mx-auto text-muted-foreground mb-1" />
                                        <p className="text-xs text-muted-foreground">العداد</p>
                                        <p className="font-medium text-sm">{assessment.mileage_in.toLocaleString()} كم</p>
                                    </div>
                                )}
                                {assessment.fuel_level !== null && (
                                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                                        <Fuel size={20} className="mx-auto text-muted-foreground mb-1" />
                                        <p className="text-xs text-muted-foreground">الوقود</p>
                                        <p className="font-medium text-sm">{assessment.fuel_level}%</p>
                                    </div>
                                )}
                                <div className="text-center p-3 bg-muted/30 rounded-lg">
                                    <Calendar size={20} className="mx-auto text-muted-foreground mb-1" />
                                    <p className="text-xs text-muted-foreground">تاريخ الاستلام</p>
                                    <p className="font-medium text-sm">{formatDate(assessment.created_at)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Complaint & Diagnosis */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">شكوى العميل والتشخيص</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {assessment.customer_complaint && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">شكوى العميل</p>
                                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                        <p className="text-foreground">{assessment.customer_complaint}</p>
                                    </div>
                                </div>
                            )}

                            {assessment.initial_diagnosis && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">التشخيص المبدئي</p>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-foreground">{assessment.initial_diagnosis}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Inspection Notes */}
                    {assessment.inspection_notes && Object.keys(assessment.inspection_notes).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CheckCircle2 size={20} className="text-green-500" />
                                    تقرير فحص المركبة
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <InspectionNotesDisplay data={assessment.inspection_notes} />
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Actions Sidebar */}
                <div className="space-y-4">
                    {/* Job Order Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">أمر الشغل</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {hasJobOrder ? (
                                <div className="space-y-3">
                                    {assessment.job_orders?.map((jo) => (
                                        <div
                                            key={jo.id}
                                            className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
                                            onClick={() => navigate(`/dashboard/workshop/${jo.id}`)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Wrench size={18} className="text-green-600" />
                                                    <span className="font-semibold">{jo.code}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
                                                    فتح
                                                    <ArrowRight size={16} className="rotate-180" />
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                الحالة: {jo.status}
                                            </p>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2 mt-2"
                                        onClick={() => setShowJobOrderModal(true)}
                                    >
                                        <Plus size={18} />
                                        إنشاء أمر شغل إضافي
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        لم يتم إنشاء أمر شغل بعد
                                    </p>
                                    <Button
                                        className="w-full gap-2"
                                        onClick={() => setShowJobOrderModal(true)}
                                    >
                                        <Plus size={18} />
                                        إنشاء أمر شغل
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full gap-2 justify-start">
                                <Printer size={18} />
                                طباعة تقرير الدخول
                            </Button>
                            <Button variant="outline" className="w-full gap-2 justify-start">
                                <Edit size={18} />
                                تعديل البيانات
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Create Job Order Modal */}
            <Dialog open={showJobOrderModal} onOpenChange={setShowJobOrderModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>إنشاء أمر شغل</DialogTitle>
                        <DialogDescription>
                            إنشاء أمر شغل جديد من هذا الاستقبال
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Category */}
                        <div>
                            <Label>نوع العمل</Label>
                            <Select
                                value={jobOrderCategory}
                                onValueChange={(val) => setJobOrderCategory(val as JobCategory)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {JOB_CATEGORIES.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority */}
                        <div>
                            <Label>الأولوية</Label>
                            <Select
                                value={jobOrderPriority}
                                onValueChange={(val) => setJobOrderPriority(val as PriorityLevel)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORITY_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <span className={opt.color}>{opt.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Instructions */}
                        <div>
                            <Label>توجيهات المدير (اختياري)</Label>
                            <Textarea
                                value={jobOrderInstructions}
                                onChange={(e) => setJobOrderInstructions(e.target.value)}
                                placeholder="توجيهات خاصة للعمل..."
                                className="mt-1"
                            />
                        </div>

                        {createError && (
                            <p className="text-sm text-destructive">{createError}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowJobOrderModal(false)}
                            disabled={isCreating}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleCreateJobOrder}
                            disabled={isCreating}
                            className="gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    جاري الإنشاء...
                                </>
                            ) : (
                                <>
                                    <Wrench size={18} />
                                    إنشاء أمر الشغل
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default AssessmentDetailsPage;
