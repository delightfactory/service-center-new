import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardCheck, Car, User, Clock, CheckCircle2, XCircle,
    AlertTriangle, Eye, MessageSquare, ChevronLeft, RefreshCw,
    Wrench, Timer, Star, Plus, Trash2, Edit3, RotateCcw
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';
import type { PriorityLevel } from '@/types/enums';
import { PageHeader } from '@/components/shared';
import { IfCanApprove } from '@/components/auth';

// ============================================================
// Supervisor Review Page - صفحة مراجعة المشرف
// Modern, Professional Design
// ============================================================

interface ReviewJob {
    id: string;
    code: string;
    priority: PriorityLevel;
    created_at: string;
    submitted_for_review_at: string | null;
    manager_instructions: string | null;
    vehicle: {
        id: string;
        plate_number: string;
        make: string | null;
        model: string | null;
        color: string | null;
    } | null;
    customer: {
        id: string;
        name: string;
        phone: string | null;
    } | null;
    technicians: {
        technician: {
            id: string;
            full_name: string;
            avatar_url: string | null;
        };
        is_lead: boolean;
    }[];
    tasks_count: number;
    completed_tasks_count: number;
    items_count: number;
}

const priorityConfig: Record<PriorityLevel, { label: string; color: string; bgGradient: string }> = {
    low: { label: 'عادي', color: 'text-slate-600', bgGradient: 'from-slate-100 to-slate-50' },
    normal: { label: 'متوسط', color: 'text-blue-600', bgGradient: 'from-blue-100 to-blue-50' },
    high: { label: 'مرتفع', color: 'text-orange-600', bgGradient: 'from-orange-100 to-orange-50' },
    urgent: { label: 'عاجل', color: 'text-red-600', bgGradient: 'from-red-100 to-red-50' },
};

interface JobTask {
    id: string;
    description: string;
    is_completed: boolean;
    isNew?: boolean;
    isDeleted?: boolean;
    isEditing?: boolean;
}

export function SupervisorReviewPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [selectedJob, setSelectedJob] = useState<ReviewJob | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);

    // Task management state
    const [jobTasks, setJobTasks] = useState<JobTask[]>([]);
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);

    // Fetch jobs pending review
    const { data: reviewJobs, isLoading, refetch } = useQuery({
        queryKey: ['supervisor-review-jobs'],
        queryFn: async () => {
            // First get job orders in review status
            const { data: jobs, error } = await supabase
                .from('job_orders')
                .select(`
                    id, code, priority, created_at, submitted_for_review_at, manager_instructions,
                    vehicle:vehicles(id, plate_number, make, model, color),
                    customer:customers(id, name, phone)
                `)
                .eq('status', 'review')
                .order('submitted_for_review_at', { ascending: true, nullsFirst: false });

            if (error) throw error;

            // Fetch technicians and task counts for each job
            const enrichedJobs = await Promise.all((jobs || []).map(async (job) => {
                const [techsRes, tasksRes, itemsRes] = await Promise.all([
                    supabase
                        .from('job_technicians')
                        .select('is_lead, technician:profiles(id, full_name, avatar_url)')
                        .eq('job_order_id', job.id),
                    supabase
                        .from('job_tasks')
                        .select('id, is_completed')
                        .eq('job_order_id', job.id),
                    supabase
                        .from('job_items')
                        .select('id')
                        .eq('job_order_id', job.id)
                ]);

                const tasks = tasksRes.data || [];
                return {
                    ...job,
                    vehicle: Array.isArray(job.vehicle) ? job.vehicle[0] : job.vehicle,
                    customer: Array.isArray(job.customer) ? job.customer[0] : job.customer,
                    technicians: (techsRes.data || []).map(t => ({
                        ...t,
                        technician: Array.isArray(t.technician) ? t.technician[0] : t.technician
                    })),
                    tasks_count: tasks.length,
                    completed_tasks_count: tasks.filter(t => t.is_completed).length,
                    items_count: (itemsRes.data || []).length,
                };
            }));

            return enrichedJobs as ReviewJob[];
        },
        refetchInterval: 30000, // Poll every 30 seconds
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const { error } = await supabase
                .from('job_orders')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    review_notes: reviewNotes || null,
                })
                .eq('id', jobId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supervisor-review-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job-orders'] });
            setShowApproveDialog(false);
            setSelectedJob(null);
            setReviewNotes('');
        },
        onError: (error: Error) => {
            console.error('Approve error:', error);
            alert('فشل اعتماد الأمر: ' + error.message);
        },
    });

    // Reject/Return mutation - now includes task management
    const rejectMutation = useMutation({
        mutationFn: async (jobId: string) => {
            // Check if there are task changes
            const hasNewTasks = jobTasks.some(t => t.isNew && !t.isDeleted);
            const hasDeletedTasks = jobTasks.some(t => t.isDeleted && !t.isNew);
            const hasTaskChanges = hasNewTasks || hasDeletedTasks;

            // Require review notes OR task changes
            if (!reviewNotes.trim() && !hasTaskChanges) {
                throw new Error('يجب إدخال سبب الإرجاع أو إجراء تعديلات على المهام');
            }

            // 1. Handle task deletions
            const deletedTasks = jobTasks.filter(t => t.isDeleted && !t.isNew);
            for (const task of deletedTasks) {
                const { error } = await supabase.from('job_tasks').delete().eq('id', task.id);
                if (error) console.error('Error deleting task:', error);
            }

            // 2. Handle task updates (existing tasks that were modified)
            const updatedTasks = jobTasks.filter(t => !t.isNew && !t.isDeleted);
            for (const task of updatedTasks) {
                const { error } = await supabase
                    .from('job_tasks')
                    .update({
                        description: task.description,
                        is_completed: task.is_completed
                    })
                    .eq('id', task.id);
                if (error) console.error('Error updating task:', error);
            }

            // 3. Handle new tasks
            const newTasks = jobTasks.filter(t => t.isNew && !t.isDeleted);
            console.log('New tasks to insert:', newTasks);
            if (newTasks.length > 0) {
                const tasksToInsert = newTasks.map(t => ({
                    job_order_id: jobId,
                    description: t.description,
                    is_completed: false,
                }));
                const { error } = await supabase.from('job_tasks').insert(tasksToInsert);
                if (error) {
                    console.error('Error inserting new tasks:', error);
                    throw new Error('فشل في إضافة المهام الجديدة: ' + error.message);
                }
            }

            // 4. Update job status
            const { error } = await supabase
                .from('job_orders')
                .update({
                    status: 'in_progress',
                    review_notes: reviewNotes || 'تم تعديل المهام',
                    submitted_for_review_at: null,
                })
                .eq('id', jobId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supervisor-review-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job-orders'] });
            queryClient.invalidateQueries({ queryKey: ['job-tasks'] });
            setShowRejectDialog(false);
            setSelectedJob(null);
            setReviewNotes('');
            setJobTasks([]);
            setNewTaskDescription('');
        },
        onError: (error: Error) => {
            console.error('Reject error:', error);
            alert('فشل إرجاع الأمر: ' + error.message);
        },
    });

    const handleApprove = (job: ReviewJob) => {
        setSelectedJob(job);
        setReviewNotes('');
        setShowApproveDialog(true);
    };

    const handleReject = async (job: ReviewJob) => {
        setSelectedJob(job);
        setReviewNotes('');
        setNewTaskDescription('');
        setIsLoadingTasks(true);
        setShowRejectDialog(true);

        // Fetch tasks for this job
        const { data } = await supabase
            .from('job_tasks')
            .select('id, description, is_completed')
            .eq('job_order_id', job.id)
            .order('created_at', { ascending: true });

        setJobTasks((data || []).map(t => ({ ...t, isNew: false, isDeleted: false, isEditing: false })));
        setIsLoadingTasks(false);
    };

    // Task management helper functions
    const addNewTask = () => {
        if (!newTaskDescription.trim()) return;
        const newTask: JobTask = {
            id: `new-${Date.now()}`,
            description: newTaskDescription.trim(),
            is_completed: false,
            isNew: true,
            isDeleted: false,
        };
        setJobTasks([...jobTasks, newTask]);
        setNewTaskDescription('');
    };

    const deleteTask = (taskId: string) => {
        setJobTasks(jobTasks.map(t =>
            t.id === taskId ? { ...t, isDeleted: true } : t
        ));
    };

    const toggleTaskCompletion = (taskId: string) => {
        setJobTasks(jobTasks.map(t =>
            t.id === taskId ? { ...t, is_completed: !t.is_completed } : t
        ));
    };

    const updateTaskDescription = (taskId: string, description: string) => {
        setJobTasks(jobTasks.map(t =>
            t.id === taskId ? { ...t, description } : t
        ));
    };

    const toggleTaskEditing = (taskId: string) => {
        setJobTasks(jobTasks.map(t =>
            t.id === taskId ? { ...t, isEditing: !t.isEditing } : t
        ));
    };

    const getTimeSinceSubmission = (submittedAt: string | null) => {
        if (!submittedAt) return '-';
        const diff = Date.now() - new Date(submittedAt).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}س ${minutes}د`;
        return `${minutes}د`;
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <PageHeader title="" showBreadcrumbs={true} className="pb-0" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <ClipboardCheck className="text-white" size={22} />
                        </div>
                        مراجعة أوامر الشغل
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        الأوامر المرسلة من الفنيين في انتظار اعتمادك
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="gap-2">
                    <RefreshCw size={16} />
                    تحديث
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                <ClipboardCheck className="text-purple-600" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">بانتظار المراجعة</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {isLoading ? '-' : reviewJobs?.length || 0}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                <AlertTriangle className="text-amber-600" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">عاجل</p>
                                <p className="text-2xl font-bold text-amber-600">
                                    {isLoading ? '-' : reviewJobs?.filter(j => j.priority === 'urgent' || j.priority === 'high').length || 0}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                <CheckCircle2 className="text-green-600" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">جاهز للاعتماد</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {isLoading ? '-' : reviewJobs?.filter(j => j.completed_tasks_count === j.tasks_count && j.tasks_count > 0).length || 0}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Job Cards */}
            {isLoading ? (
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-48 rounded-2xl" />
                    ))}
                </div>
            ) : !reviewJobs || reviewJobs.length === 0 ? (
                <Card className="py-16">
                    <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                            <CheckCircle2 className="text-green-500" size={40} />
                        </div>
                        <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">
                            لا توجد أوامر بانتظار المراجعة
                        </h3>
                        <p className="text-muted-foreground mt-2">
                            جميع الأوامر تم اعتمادها ✓
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {reviewJobs.map((job) => {
                        const priorityStyle = priorityConfig[job.priority];
                        const leadTech = job.technicians.find(t => t.is_lead);
                        const allTasksComplete = job.completed_tasks_count === job.tasks_count && job.tasks_count > 0;

                        return (
                            <Card
                                key={job.id}
                                className={cn(
                                    "overflow-hidden transition-all hover:shadow-lg",
                                    job.priority === 'urgent' && "border-red-300 dark:border-red-700"
                                )}
                            >
                                {/* Priority Indicator */}
                                <div className={cn(
                                    "h-1.5 bg-gradient-to-r",
                                    job.priority === 'urgent' ? "from-red-500 to-rose-500" :
                                        job.priority === 'high' ? "from-orange-500 to-amber-500" :
                                            job.priority === 'normal' ? "from-blue-500 to-indigo-500" :
                                                "from-slate-400 to-slate-300"
                                )} />

                                <CardContent className="p-5">
                                    <div className="flex flex-col lg:flex-row gap-4">
                                        {/* Left: Vehicle & Customer Info */}
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                                        priorityStyle.bgGradient
                                                    )}>
                                                        <Car className={priorityStyle.color} size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-lg">
                                                                {job.vehicle?.make} {job.vehicle?.model}
                                                            </h3>
                                                            <Badge variant="outline" className="font-mono">
                                                                {job.code}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground font-mono">
                                                            {job.vehicle?.plate_number}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge className={cn(
                                                    "shrink-0",
                                                    job.priority === 'urgent' ? "bg-red-100 text-red-700" :
                                                        job.priority === 'high' ? "bg-orange-100 text-orange-700" :
                                                            "bg-blue-100 text-blue-700"
                                                )}>
                                                    {priorityStyle.label}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <User size={14} />
                                                    {job.customer?.name}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Timer size={14} />
                                                    في المراجعة: {getTimeSinceSubmission(job.submitted_for_review_at)}
                                                </div>
                                            </div>

                                            {/* Technician */}
                                            {leadTech && (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="w-7 h-7">
                                                        <AvatarImage src={leadTech.technician?.avatar_url || undefined} />
                                                        <AvatarFallback className="text-xs bg-primary/10">
                                                            {leadTech.technician?.full_name?.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm">
                                                        {leadTech.technician?.full_name}
                                                        <span className="text-muted-foreground"> (الفني المسؤول)</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Middle: Progress */}
                                        <div className="flex items-center gap-4 lg:border-x lg:px-6">
                                            <div className="text-center">
                                                <div className={cn(
                                                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-1",
                                                    allTasksComplete
                                                        ? "bg-green-100 dark:bg-green-900/30"
                                                        : "bg-amber-100 dark:bg-amber-900/30"
                                                )}>
                                                    <span className={cn(
                                                        "text-lg font-bold",
                                                        allTasksComplete ? "text-green-600" : "text-amber-600"
                                                    )}>
                                                        {job.completed_tasks_count}/{job.tasks_count}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">المهام</p>
                                            </div>
                                            <div className="text-center">
                                                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-1">
                                                    <span className="text-lg font-bold text-blue-600">
                                                        {job.items_count}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">البنود</p>
                                            </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex lg:flex-col gap-2 lg:w-40">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 gap-1"
                                                onClick={() => navigate(`/dashboard/workshop/${job.id}`)}
                                            >
                                                <Eye size={14} />
                                                عرض التفاصيل
                                            </Button>
                                            <IfCanApprove resource="job_orders">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 gap-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/20"
                                                    onClick={() => handleApprove(job)}
                                                >
                                                    <CheckCircle2 size={14} />
                                                    اعتماد
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                                                    onClick={() => handleReject(job)}
                                                >
                                                    <XCircle size={14} />
                                                    إرجاع
                                                </Button>
                                            </IfCanApprove>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Approve Dialog */}
            <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 size={20} />
                            اعتماد أمر الشغل
                        </DialogTitle>
                        <DialogDescription>
                            سيتم تغيير حالة الأمر إلى "مكتمل" وإتاحة إنشاء الفاتورة
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="bg-muted rounded-lg p-3 mb-4">
                            <p className="font-semibold">{selectedJob?.vehicle?.make} {selectedJob?.vehicle?.model}</p>
                            <p className="text-sm text-muted-foreground font-mono">{selectedJob?.code}</p>
                        </div>
                        <label className="text-sm font-medium">ملاحظات المراجعة (اختياري)</label>
                        <Textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="أي ملاحظات على العمل المنجز..."
                            className="mt-2"
                            rows={3}
                        />
                    </div>
                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button
                            onClick={() => selectedJob && approveMutation.mutate(selectedJob.id)}
                            disabled={approveMutation.isPending}
                            className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500"
                        >
                            {approveMutation.isPending ? 'جاري الاعتماد...' : (
                                <>
                                    <CheckCircle2 size={16} />
                                    تأكيد الاعتماد
                                </>
                            )}
                        </Button>
                        <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                            إلغاء
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog - Enhanced with Task Management */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XCircle size={20} />
                            إرجاع أمر الشغل
                        </DialogTitle>
                        <DialogDescription>
                            يمكنك تعديل المهام قبل إرجاع الأمر للفني
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {/* Job Info */}
                        <div className="bg-muted rounded-lg p-3">
                            <p className="font-semibold">{selectedJob?.vehicle?.make} {selectedJob?.vehicle?.model}</p>
                            <p className="text-sm text-muted-foreground font-mono">{selectedJob?.code}</p>
                        </div>

                        {/* Tasks Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Wrench size={16} />
                                    المهام الحالية
                                </label>
                                <span className="text-xs text-muted-foreground">
                                    {jobTasks.filter(t => !t.isDeleted).length} مهمة
                                </span>
                            </div>

                            {isLoadingTasks ? (
                                <div className="space-y-2">
                                    {[1, 2].map(i => (
                                        <Skeleton key={i} className="h-12 rounded-lg" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {jobTasks.filter(t => !t.isDeleted).map((task) => (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "flex items-center gap-2 p-3 rounded-lg border transition-all",
                                                task.isNew ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-card",
                                                task.is_completed && "opacity-60"
                                            )}
                                        >
                                            {/* Completion Toggle */}
                                            <button
                                                type="button"
                                                onClick={() => toggleTaskCompletion(task.id)}
                                                className={cn(
                                                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                                    task.is_completed
                                                        ? "bg-green-500 border-green-500 text-white"
                                                        : "border-muted-foreground/30 hover:border-primary"
                                                )}
                                            >
                                                {task.is_completed && <CheckCircle2 size={12} />}
                                            </button>

                                            {/* Task Description */}
                                            {task.isEditing ? (
                                                <Input
                                                    value={task.description}
                                                    onChange={(e) => updateTaskDescription(task.id, e.target.value)}
                                                    onBlur={() => toggleTaskEditing(task.id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && toggleTaskEditing(task.id)}
                                                    className="flex-1 h-8 text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span
                                                    className={cn(
                                                        "flex-1 text-sm",
                                                        task.is_completed && "line-through text-muted-foreground"
                                                    )}
                                                >
                                                    {task.description}
                                                </span>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1">
                                                {task.is_completed && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                        onClick={() => toggleTaskCompletion(task.id)}
                                                        title="إعادة فتح المهمة"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                    onClick={() => toggleTaskEditing(task.id)}
                                                    title="تعديل"
                                                >
                                                    <Edit3 size={14} />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteTask(task.id)}
                                                    title="حذف"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {jobTasks.filter(t => !t.isDeleted).length === 0 && (
                                        <p className="text-center text-sm text-muted-foreground py-4">
                                            لا توجد مهام
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Add New Task */}
                            <div className="flex gap-2">
                                <Input
                                    value={newTaskDescription}
                                    onChange={(e) => setNewTaskDescription(e.target.value)}
                                    placeholder="أضف مهمة جديدة..."
                                    className="flex-1"
                                    onKeyDown={(e) => e.key === 'Enter' && addNewTask()}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={addNewTask}
                                    disabled={!newTaskDescription.trim()}
                                    className="shrink-0"
                                >
                                    <Plus size={16} />
                                </Button>
                            </div>
                        </div>

                        {/* Review Notes */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">سبب الإرجاع *</label>
                            <Textarea
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder="اذكر سبب إرجاع الأمر والتعديلات المطلوبة..."
                                rows={3}
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button
                            variant="destructive"
                            onClick={() => selectedJob && rejectMutation.mutate(selectedJob.id)}
                            disabled={rejectMutation.isPending || (!reviewNotes.trim() && !jobTasks.some(t => t.isNew && !t.isDeleted) && !jobTasks.some(t => t.isDeleted && !t.isNew))}
                            className="gap-2"
                        >
                            {rejectMutation.isPending ? 'جاري الإرجاع...' : (
                                <>
                                    <XCircle size={16} />
                                    تأكيد الإرجاع
                                </>
                            )}
                        </Button>
                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                            إلغاء
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default SupervisorReviewPage;
