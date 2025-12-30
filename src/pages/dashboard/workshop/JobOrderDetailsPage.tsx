import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowRight,
    Car,
    User,
    Users,
    Clock,
    AlertCircle,
    Calendar,
    Phone,
    FileText,
    Wrench,
    Package,
    Plus,
    Play,
    Pause,
    CheckCircle2,
    Check,
    XCircle,
    Edit,
    Printer,
    MoreVertical,
    Timer,
    DollarSign,
    Trash2,
    Receipt,
    Crown,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Circle,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import {
    JOB_STATUSES,
    JOB_CATEGORIES,
    PRIORITY_LEVELS,
    JOB_ITEM_TYPES,
    type JobStatus,
    type PriorityLevel,
    type JobItemType,
} from '@/types/enums';
import { AddJobItemModal, AddJobTaskModal, AssignTechniciansModal, EditJobItemModal, EditJobTaskModal, JobTimeTracker } from '@/components/workshop';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ============================================================
// Job Order Details Page - محسّنة
// ============================================================

interface JobOrderDetails {
    id: string;
    code: string;
    job_category: string;
    status: JobStatus;
    priority: PriorityLevel;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    estimated_hours: number | null;
    actual_hours: number | null;
    notes: string | null;
    manager_instructions: string | null;
    vehicle: {
        id: string;
        plate_number: string;
        make: string | null;
        model: string | null;
        year: number | null;
        color: string | null;
        vin: string | null;
    } | null;
    customer: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
    } | null;
    assessment: {
        id: string;
        mileage_in: number | null;
        fuel_level: number | null;
        customer_complaint: string | null;
    } | null;
}

interface JobItem {
    id: string;
    item_type: JobItemType;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    total_price: number;
    product_id: string | null;
    technician_id: string | null;
    notes: string | null;
    is_completed: boolean;
}

interface JobTask {
    id: string;
    description: string;
    notes: string | null;
    is_completed: boolean;
    is_blocked: boolean;
    blocked_reason: string | null;
    assigned_to: {
        id: string;
        full_name: string;
    } | null;
}

interface AssignedTech {
    id: string;
    technician_id: string;
    is_lead: boolean;
    technician: {
        id: string;
        full_name: string;
        avatar_url: string | null;
    };
}

// خط سير الحالات
const STATUS_WORKFLOW: JobStatus[] = ['draft', 'pending', 'in_progress', 'paused', 'review', 'completed', 'delivered'];

// ألوان الحالات
const statusStyles: Record<JobStatus, { bg: string; text: string; icon: React.ElementType }> = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: Circle },
    pending: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Clock },
    in_progress: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', icon: Play },
    paused: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: Pause },
    review: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: FileText },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
    delivered: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', icon: Car },
    cancelled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500', icon: XCircle },
};

// ألوان الأولوية
const priorityStyles: Record<PriorityLevel, string> = {
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    normal: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export function JobOrderDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Modal states
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [showAssignTechModal, setShowAssignTechModal] = useState(false);
    const [showEditItemModal, setShowEditItemModal] = useState(false);
    const [showEditTaskModal, setShowEditTaskModal] = useState(false);
    const [showInstructionsModal, setShowInstructionsModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState<{ action: string; status: JobStatus } | null>(null);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [mileageOut, setMileageOut] = useState('');
    const [instructionsText, setInstructionsText] = useState('');
    const [editingItem, setEditingItem] = useState<JobItem | null>(null);
    const [editingTask, setEditingTask] = useState<JobTask | null>(null);

    // Fetch job order details
    const { data: jobOrder, isLoading, error, refetch } = useQuery({
        queryKey: ['job-order', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_orders')
                .select(`
                    id, code, job_category, status, priority,
                    created_at, started_at, completed_at,
                    estimated_hours, actual_hours, notes, manager_instructions,
                    vehicle:vehicles (id, plate_number, make, model, year, color, vin),
                    customer:customers (id, name, phone, email),
                    assessment:assessments (id, mileage_in, fuel_level, customer_complaint)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                ...data,
                vehicle: Array.isArray(data.vehicle) ? data.vehicle[0] || null : data.vehicle,
                customer: Array.isArray(data.customer) ? data.customer[0] || null : data.customer,
                assessment: Array.isArray(data.assessment) ? data.assessment[0] || null : data.assessment,
            } as JobOrderDetails;
        },
        enabled: !!id,
    });

    // Fetch assigned technicians
    const { data: assignedTechs } = useQuery({
        queryKey: ['job-technicians', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_technicians')
                .select(`
                    id, technician_id, is_lead,
                    technician:profiles (id, full_name, avatar_url)
                `)
                .eq('job_order_id', id);

            if (error) throw error;
            return data.map(d => ({
                ...d,
                technician: Array.isArray(d.technician) ? d.technician[0] : d.technician
            })) as AssignedTech[];
        },
        enabled: !!id,
    });

    // Fetch job items
    const { data: jobItems } = useQuery({
        queryKey: ['job-items', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_items')
                .select('*')
                .eq('job_order_id', id)
                .order('created_at');

            if (error) throw error;
            return data as JobItem[];
        },
        enabled: !!id,
    });

    // Fetch job tasks
    const { data: jobTasks } = useQuery({
        queryKey: ['job-tasks', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_tasks')
                .select(`
                    id, description, is_completed, is_blocked, blocked_reason,
                    completed_at, notes, sort_order, created_at,
                    assigned_to:profiles!job_tasks_assigned_to_fkey (id, full_name)
                `)
                .eq('job_order_id', id)
                .order('sort_order')
                .order('created_at');

            if (error) throw error;
            return data.map(task => ({
                ...task,
                assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to[0] || null : task.assigned_to
            }));
        },
        enabled: !!id,
    });

    // Fetch linked invoice
    const { data: linkedInvoice } = useQuery({
        queryKey: ['job-invoice', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('id, code, status, total_amount, paid_amount')
                .eq('job_order_id', id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
        enabled: !!id,
    });

    // Mutations
    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const { error } = await supabase.from('job_items').delete().eq('id', itemId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-items', id] }),
    });

    const deleteTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-tasks', id] }),
    });

    const toggleTaskMutation = useMutation({
        mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
            const { error } = await supabase
                .from('job_tasks')
                .update({
                    is_completed: isCompleted,
                    completed_at: isCompleted ? new Date().toISOString() : null,
                })
                .eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-tasks', id] }),
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: JobStatus) => {
            const updateData: any = { status: newStatus };
            if (newStatus === 'in_progress' && !jobOrder?.started_at) {
                updateData.started_at = new Date().toISOString();
            }
            if (newStatus === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }

            const { error } = await supabase.from('job_orders').update(updateData).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-order', id] });
            setShowConfirmModal(null);
        },
        onError: (error) => {
            console.error('Status update failed:', error);
            alert('فشل تحديث الحالة');
        },
    });

    const updateInstructionsMutation = useMutation({
        mutationFn: async (instructions: string) => {
            const { error } = await supabase
                .from('job_orders')
                .update({ manager_instructions: instructions })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-order', id] });
            setShowInstructionsModal(false);
        },
    });

    // Delivery mutation
    const deliverMutation = useMutation({
        mutationFn: async (mileage: number | null) => {
            const { error } = await supabase
                .from('job_orders')
                .update({
                    status: 'delivered',
                    delivered_at: new Date().toISOString(),
                    mileage_out: mileage,
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-order', id] });
            setShowDeliveryModal(false);
            setMileageOut('');
        },
        onError: (error) => {
            console.error('Delivery failed:', error);
            alert('فشل تسليم السيارة');
        },
    });

    // Calculate totals
    const totals = React.useMemo(() => {
        if (!jobItems) return { labor: 0, parts: 0, total: 0 };
        const labor = jobItems.filter(item => item.item_type === 'labor').reduce((sum, item) => sum + item.total_price, 0);
        const parts = jobItems.filter(item => ['part', 'consumable'].includes(item.item_type)).reduce((sum, item) => sum + item.total_price, 0);
        return { labor, parts, total: jobItems.reduce((sum, item) => sum + item.total_price, 0) };
    }, [jobItems]);

    // حالة التغيير المسموح بها
    const getNextStatuses = (current: JobStatus): JobStatus[] => {
        switch (current) {
            case 'draft': return ['pending'];
            case 'pending': return ['in_progress', 'cancelled'];
            case 'in_progress': return ['paused', 'review'];
            case 'paused': return ['in_progress', 'cancelled'];
            case 'review': return ['in_progress', 'completed'];
            case 'completed': return ['delivered'];
            case 'delivered': return [];
            case 'cancelled': return [];
            default: return [];
        }
    };

    // تغيير الحالة مع تأكيد
    const handleStatusChange = (newStatus: JobStatus) => {
        if (newStatus === 'cancelled') {
            setShowConfirmModal({ action: 'إلغاء أمر الشغل', status: newStatus });
        } else if (newStatus === 'completed' && (!jobItems || jobItems.length === 0)) {
            setShowConfirmModal({ action: 'إكمال أمر شغل بدون بنود', status: newStatus });
        } else if (newStatus === 'delivered') {
            // التحقق من وجود فاتورة معتمدة قبل التسليم
            if (!linkedInvoice) {
                alert('⚠️ يجب إنشاء فاتورة أولاً قبل تسليم السيارة');
                return;
            }
            // التحقق من حالة الفاتورة (يجب أن تكون معتمدة أو مدفوعة)
            if (linkedInvoice.status === 'draft') {
                alert('⚠️ يجب اعتماد الفاتورة أولاً قبل تسليم السيارة\n\nالفاتورة الحالية في حالة مسودة');
                return;
            }
            if (linkedInvoice.status === 'cancelled') {
                alert('⚠️ الفاتورة المرتبطة ملغاة. يرجى إنشاء فاتورة جديدة');
                return;
            }
            setShowDeliveryModal(true);
        } else {
            updateStatusMutation.mutate(newStatus);
        }
    };

    // إنشاء فاتورة
    const handleCreateInvoice = () => {
        navigate(`/dashboard/finance/invoices/new?job_order_id=${id}`);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-20" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 lg:col-span-2" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (error || !jobOrder) {
        return (
            <Card className="border-destructive">
                <CardContent className="p-12 text-center">
                    <AlertCircle className="mx-auto mb-4 text-destructive" size={48} />
                    <h2 className="text-xl font-semibold mb-2">أمر الشغل غير موجود</h2>
                    <p className="text-muted-foreground mb-4">لم يتم العثور على أمر الشغل المطلوب</p>
                    <Button asChild>
                        <Link to="/dashboard/workshop">العودة للقائمة</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const currentStatusStyle = statusStyles[jobOrder.status];
    const StatusIcon = currentStatusStyle.icon;
    const nextStatuses = getNextStatuses(jobOrder.status);

    return (
        <div className="space-y-4">
            {/* ============ HEADER ============ */}
            <div className="bg-card border rounded-xl p-4 sticky top-0 z-10">
                {/* الصف العلوي */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" asChild className="shrink-0">
                            <Link to="/dashboard/workshop">
                                <ArrowRight size={20} />
                            </Link>
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-bold">{jobOrder.code}</h1>
                                <Badge className={cn(currentStatusStyle.bg, currentStatusStyle.text)}>
                                    <StatusIcon size={14} className="ml-1" />
                                    {JOB_STATUSES[jobOrder.status]}
                                </Badge>
                                {jobOrder.priority !== 'normal' && (
                                    <Badge className={priorityStyles[jobOrder.priority]}>
                                        {PRIORITY_LEVELS[jobOrder.priority]}
                                    </Badge>
                                )}
                                {linkedInvoice && (
                                    <Badge className={cn(
                                        linkedInvoice.status === 'draft'
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                            : linkedInvoice.status === 'approved'
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                : linkedInvoice.status === 'paid'
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                    )}>
                                        <Receipt size={12} className="ml-1" />
                                        {linkedInvoice.status === 'draft' ? 'فاتورة مسودة' :
                                            linkedInvoice.status === 'approved' ? 'فاتورة معتمدة' :
                                                linkedInvoice.status === 'paid' ? 'مدفوعة' :
                                                    linkedInvoice.status === 'partially_paid' ? 'مدفوعة جزئياً' : 'مفوتر'}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {JOB_CATEGORIES[jobOrder.job_category as keyof typeof JOB_CATEGORIES] || jobOrder.job_category}
                                {' • '}
                                {formatDate(jobOrder.created_at)}
                            </p>
                        </div>
                    </div>

                    {/* أزرار التحكم */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw size={16} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowAssignTechModal(true)} className="gap-1">
                            <Users size={16} />
                            <span className="hidden sm:inline">الفنيين</span>
                            {assignedTechs && assignedTechs.length > 0 && (
                                <Badge variant="secondary" className="mr-1">{assignedTechs.length}</Badge>
                            )}
                        </Button>
                        {linkedInvoice ? (
                            <Button variant="outline" size="sm" asChild className="gap-1">
                                <Link to={`/dashboard/finance/invoices/${linkedInvoice.id}`}>
                                    <Receipt size={16} />
                                    <span className="hidden sm:inline">{linkedInvoice.code}</span>
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCreateInvoice}
                                disabled={!jobItems || jobItems.length === 0}
                                className="gap-1"
                            >
                                <Receipt size={16} />
                                <span className="hidden sm:inline">إنشاء فاتورة</span>
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <MoreVertical size={16} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem className="gap-2">
                                    <Printer size={16} />
                                    طباعة
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="gap-2 text-destructive"
                                    onClick={() => handleStatusChange('cancelled')}
                                    disabled={jobOrder.status === 'cancelled' || jobOrder.status === 'delivered'}
                                >
                                    <XCircle size={16} />
                                    إلغاء الأمر
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* الفنيين المعينين */}
                {assignedTechs && assignedTechs.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <span className="text-sm text-muted-foreground">الفنيين:</span>
                        <div className="flex items-center gap-1 flex-wrap">
                            {assignedTechs.map(at => (
                                <Badge
                                    key={at.id}
                                    variant="secondary"
                                    className={cn("gap-1", at.is_lead && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400")}
                                >
                                    {at.is_lead && <Crown size={12} />}
                                    {at.technician?.full_name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* شريط تغيير الحالة */}
                {nextStatuses.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <span className="text-sm text-muted-foreground shrink-0">الإجراء التالي:</span>
                        <div className="flex items-center gap-2 flex-wrap">
                            {nextStatuses.map(status => {
                                const style = statusStyles[status];
                                const Icon = style.icon;
                                return (
                                    <Button
                                        key={status}
                                        variant="outline"
                                        size="sm"
                                        className={cn("gap-1", style.text)}
                                        onClick={() => handleStatusChange(status)}
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        <Icon size={14} />
                                        {JOB_STATUSES[status]}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ============ MAIN CONTENT ============ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* العمود الأيسر */}
                <div className="lg:col-span-2 space-y-4">
                    {/* شكوى العميل */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText size={18} />
                                شكوى العميل
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">
                                {jobOrder.assessment?.customer_complaint || 'لا توجد شكوى مسجلة'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* توجيهات المدير */}
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Wrench size={18} />
                                توجيهات المدير
                            </CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => setShowInstructionsModal(true)}>
                                <Edit size={14} className="ml-1" />
                                {jobOrder.manager_instructions ? 'تعديل' : 'إضافة'}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {jobOrder.manager_instructions ? (
                                <p className="text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                                    {jobOrder.manager_instructions}
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    لم يتم إضافة توجيهات بعد
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* المهام */}
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle2 size={18} />
                                المهام ({jobTasks?.filter(t => t.is_completed).length || 0}/{jobTasks?.length || 0})
                            </CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setShowAddTaskModal(true)}>
                                <Plus size={14} className="ml-1" />
                                إضافة
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {!jobTasks || jobTasks.length === 0 ? (
                                <div className="text-center py-6 text-sm text-muted-foreground">
                                    لا توجد مهام - أضف مهام ليراها الفني
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {jobTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                'flex items-center gap-3 p-2.5 rounded-lg border transition-colors group',
                                                task.is_completed && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                                                task.is_blocked && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                                            )}
                                        >
                                            <button
                                                onClick={() => toggleTaskMutation.mutate({ taskId: task.id, isCompleted: !task.is_completed })}
                                                disabled={toggleTaskMutation.isPending}
                                                className={cn(
                                                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                                    task.is_completed ? 'bg-green-500 border-green-500' :
                                                        task.is_blocked ? 'bg-red-200 border-red-400' :
                                                            'border-gray-300 hover:border-primary'
                                                )}
                                            >
                                                {task.is_completed && <Check size={12} className="text-white" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn('text-sm', task.is_completed && 'line-through text-muted-foreground')}>
                                                    {task.description}
                                                </p>
                                                {task.is_blocked && task.blocked_reason && (
                                                    <p className="text-xs text-red-600 mt-0.5">⚠️ {task.blocked_reason}</p>
                                                )}
                                            </div>
                                            {!task.is_completed && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTask(task as JobTask); setShowEditTaskModal(true); }}>
                                                        <Edit size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('هل تريد حذف هذه المهمة؟')) deleteTaskMutation.mutate(task.id); }}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* البنود */}
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package size={18} />
                                البنود
                            </CardTitle>
                            <Button size="sm" onClick={() => setShowAddItemModal(true)}>
                                <Plus size={14} className="ml-1" />
                                إضافة بند
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {!jobItems || jobItems.length === 0 ? (
                                <div className="text-center py-6 text-sm text-muted-foreground">
                                    لا توجد بنود مضافة
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {jobItems.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border group hover:bg-muted/50">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">{JOB_ITEM_TYPES[item.item_type]}</Badge>
                                                <span className="text-sm">{item.description}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold">{formatCurrency(item.total_price)}</span>
                                                <span className="text-xs text-muted-foreground">({item.quantity}×{formatCurrency(item.unit_price)})</span>
                                                {!item.is_completed && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setShowEditItemModal(true); }}>
                                                            <Edit size={14} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('هل تريد حذف هذا البند؟')) deleteItemMutation.mutate(item.id); }}>
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {/* الإجماليات */}
                                    <div className="border-t pt-3 mt-3 space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">العمالة</span>
                                            <span>{formatCurrency(totals.labor)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">القطع</span>
                                            <span>{formatCurrency(totals.parts)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-base pt-2 border-t">
                                            <span>الإجمالي</span>
                                            <span className="text-primary">{formatCurrency(totals.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* العمود الأيمن */}
                <div className="space-y-4">
                    {/* Time Tracker */}
                    {id && <JobTimeTracker jobOrderId={id} />}

                    {/* المركبة */}
                    {jobOrder.vehicle && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Car size={18} />
                                    المركبة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">الماركة</span>
                                    <span className="font-medium">{jobOrder.vehicle.make} {jobOrder.vehicle.model}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">اللوحة</span>
                                    <Badge variant="secondary">{jobOrder.vehicle.plate_number}</Badge>
                                </div>
                                {jobOrder.vehicle.year && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">السنة</span>
                                        <span>{jobOrder.vehicle.year}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* العميل */}
                    {jobOrder.customer && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <User size={18} />
                                    العميل
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="font-medium">{jobOrder.customer.name}</p>
                                {jobOrder.customer.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone size={14} className="text-muted-foreground" />
                                        <a href={`tel:${jobOrder.customer.phone}`} className="hover:text-primary">
                                            {jobOrder.customer.phone}
                                        </a>
                                    </div>
                                )}
                                <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                                    <Link to={`/dashboard/customers/${jobOrder.customer.id}`}>
                                        عرض ملف العميل
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* ملخص التكلفة */}
                    <Card className="bg-primary/5">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DollarSign size={20} className="text-primary" />
                                    <span className="font-medium">الإجمالي</span>
                                </div>
                                <span className="text-2xl font-bold text-primary">{formatCurrency(totals.total)}</span>
                            </div>
                            {linkedInvoice && (
                                <div className="mt-2 pt-2 border-t text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">الفاتورة</span>
                                        <Link to={`/dashboard/finance/invoices/${linkedInvoice.id}`} className="text-primary hover:underline">
                                            {linkedInvoice.code}
                                        </Link>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">المدفوع</span>
                                        <span className="text-green-600">{formatCurrency(linkedInvoice.paid_amount || 0)}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ============ MODALS ============ */}
            {id && (
                <>
                    <AddJobItemModal jobOrderId={id} open={showAddItemModal} onOpenChange={setShowAddItemModal} />
                    <AddJobTaskModal jobOrderId={id} open={showAddTaskModal} onOpenChange={setShowAddTaskModal} />
                    <AssignTechniciansModal jobOrderId={id} open={showAssignTechModal} onOpenChange={setShowAssignTechModal} />
                    <EditJobTaskModal task={editingTask} jobOrderId={id} open={showEditTaskModal} onOpenChange={(open) => { setShowEditTaskModal(open); if (!open) setEditingTask(null); }} />
                    <EditJobItemModal item={editingItem} jobOrderId={id} open={showEditItemModal} onOpenChange={(open) => { setShowEditItemModal(open); if (!open) setEditingItem(null); }} />

                    {/* Manager Instructions Modal */}
                    <Dialog open={showInstructionsModal} onOpenChange={(open) => { setShowInstructionsModal(open); if (open) setInstructionsText(jobOrder?.manager_instructions || ''); }}>
                        <DialogContent className="sm:max-w-lg" dir="rtl">
                            <DialogHeader>
                                <DialogTitle className="text-right">توجيهات المدير للفنيين</DialogTitle>
                                <DialogDescription className="text-right">
                                    اكتب التوجيهات والملاحظات التي ستظهر للفنيين
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Textarea
                                    placeholder="مثال: يرجى فحص نظام الفرامل بعناية..."
                                    value={instructionsText}
                                    onChange={(e) => setInstructionsText(e.target.value)}
                                    rows={4}
                                    className="text-right"
                                />
                            </div>
                            <DialogFooter className="flex-row-reverse gap-2">
                                <Button onClick={() => updateInstructionsMutation.mutate(instructionsText)} disabled={updateInstructionsMutation.isPending}>
                                    حفظ
                                </Button>
                                <Button variant="outline" onClick={() => setShowInstructionsModal(false)}>
                                    إلغاء
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Confirm Modal */}
                    <Dialog open={!!showConfirmModal} onOpenChange={() => setShowConfirmModal(null)}>
                        <DialogContent className="sm:max-w-md" dir="rtl">
                            <DialogHeader>
                                <DialogTitle className="text-right flex items-center gap-2 text-destructive">
                                    <AlertCircle size={20} />
                                    تأكيد الإجراء
                                </DialogTitle>
                                <DialogDescription className="text-right">
                                    هل أنت متأكد من {showConfirmModal?.action}؟
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex-row-reverse gap-2">
                                <Button
                                    variant="destructive"
                                    onClick={() => showConfirmModal && updateStatusMutation.mutate(showConfirmModal.status)}
                                    disabled={updateStatusMutation.isPending}
                                >
                                    تأكيد
                                </Button>
                                <Button variant="outline" onClick={() => setShowConfirmModal(null)}>
                                    إلغاء
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    {/* Delivery Modal */}
                    <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
                        <DialogContent className="sm:max-w-md" dir="rtl">
                            <DialogHeader>
                                <DialogTitle className="text-right flex items-center gap-2">
                                    <Car size={20} />
                                    تسليم السيارة
                                </DialogTitle>
                                <DialogDescription className="text-right">
                                    السيارة ستخرج من الورشة وينتهي أمر الشغل
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                    <p className="text-sm text-green-700 dark:text-green-400">
                                        ✅ الفاتورة: <strong>{linkedInvoice?.code}</strong>
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        عداد الكيلومترات عند الخروج (اختياري)
                                    </label>
                                    <input
                                        type="number"
                                        value={mileageOut}
                                        onChange={(e) => setMileageOut(e.target.value)}
                                        placeholder={jobOrder?.assessment?.mileage_in ? `الدخول: ${jobOrder.assessment.mileage_in} كم` : 'أدخل القراءة'}
                                        className="w-full px-3 py-2 border rounded-lg text-left"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <DialogFooter className="flex-row-reverse gap-2">
                                <Button
                                    onClick={() => deliverMutation.mutate(mileageOut ? parseInt(mileageOut) : null)}
                                    disabled={deliverMutation.isPending}
                                    className="gap-2 bg-teal-600 hover:bg-teal-700"
                                >
                                    {deliverMutation.isPending ? 'جاري التسليم...' : (
                                        <>
                                            <Car size={18} />
                                            تأكيد التسليم
                                        </>
                                    )}
                                </Button>
                                <Button variant="outline" onClick={() => setShowDeliveryModal(false)}>
                                    إلغاء
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}

export default JobOrderDetailsPage;
