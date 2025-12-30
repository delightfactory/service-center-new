import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight, Car, User, Phone, Clock, CheckCircle2,
    XCircle, AlertTriangle, PlayCircle, PauseCircle, FileText,
    Send, PartyPopper
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { PriorityLevel } from '@/types/enums';

// ============================================================
// Technician Job Details Page - Complete Redesign
// ============================================================

interface JobTask {
    id: string;
    description: string;
    notes: string | null;
    is_completed: boolean;
    is_blocked: boolean;
    blocked_reason: string | null;
}

interface TimeLog {
    id: string;
    clock_in: string;
    clock_out: string | null;
}

// Predefined block reasons
const BLOCK_REASONS = [
    'نقص قطع الغيار',
    'تحتاج موافقة العميل',
    'مشكلة فنية تحتاج مراجعة',
    'انتظار قطعة من المورد',
    'حالة الطقس غير مناسبة',
    'أخرى (يرجى التحديد)',
];

// Live Timer Component with total time support
function LiveTimer({ startTime, previousSeconds = 0, size = 'lg' }: { startTime: string; previousSeconds?: number; size?: 'sm' | 'lg' | 'xl' }) {
    const [elapsed, setElapsed] = React.useState(0);

    useEffect(() => {
        const start = new Date(startTime).getTime();
        const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const totalSeconds = previousSeconds + elapsed;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const sizes = {
        sm: 'text-lg',
        lg: 'text-3xl',
        xl: 'text-5xl',
    };

    return (
        <span className={cn('font-mono font-bold tabular-nums', sizes[size])}>
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
    );
}

// Static Timer Display
function StaticTimer({ seconds, size = 'lg' }: { seconds: number; size?: 'sm' | 'lg' | 'xl' }) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const sizes = {
        sm: 'text-lg',
        lg: 'text-3xl',
        xl: 'text-5xl',
    };

    return (
        <span className={cn('font-mono font-bold tabular-nums', sizes[size])}>
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </span>
    );
}

export function TechJobDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { profile } = useAuth();

    // Block reason modal state
    const [showBlockModal, setShowBlockModal] = React.useState(false);
    const [blockingTask, setBlockingTask] = React.useState<JobTask | null>(null);
    const [selectedReason, setSelectedReason] = React.useState<string>('');
    const [customReason, setCustomReason] = React.useState('');

    // ============================================================
    // Real-time Subscriptions
    // ============================================================
    useEffect(() => {
        if (!id || !profile?.id) return;

        const channel = supabase
            .channel(`tech-job-${id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_tasks',
                filter: `job_order_id=eq.${id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-job-tasks', id] });
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_time_logs',
                filter: `job_order_id=eq.${id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-active-timelog', id, profile?.id] });
                queryClient.invalidateQueries({ queryKey: ['tech-total-time', id, profile?.id] });
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_orders',
                filter: `id=eq.${id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-job-details', id] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, profile?.id, queryClient]);

    // Fetch job order details
    const { data: job, isLoading } = useQuery({
        queryKey: ['tech-job-details', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_orders')
                .select(`
                    id, code, status, priority, manager_instructions, notes,
                    vehicle:vehicles (id, plate_number, make, model, year, color),
                    customer:customers (id, name, phone)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return {
                ...data,
                vehicle: Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle,
                customer: Array.isArray(data.customer) ? data.customer[0] : data.customer,
            };
        },
        enabled: !!id,
        refetchInterval: 5000, // Polling fallback
    });

    // Fetch tasks
    const { data: tasks } = useQuery({
        queryKey: ['tech-job-tasks', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_tasks')
                .select('id, description, notes, is_completed, is_blocked, blocked_reason')
                .eq('job_order_id', id)
                .order('sort_order');

            if (error) throw error;
            return data as JobTask[];
        },
        enabled: !!id,
        refetchInterval: 5000, // Polling fallback
    });

    // Fetch active time log
    const { data: activeTimeLog } = useQuery({
        queryKey: ['tech-active-timelog', id, profile?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_time_logs')
                .select('id, clock_in')
                .eq('job_order_id', id)
                .eq('technician_id', profile?.id)
                .is('clock_out', null)
                .maybeSingle();

            if (error) throw error;
            return data as TimeLog | null;
        },
        enabled: !!id && !!profile?.id,
        refetchInterval: 5000, // Polling fallback
    });

    // Fetch total previous time
    const { data: totalPreviousSeconds } = useQuery({
        queryKey: ['tech-total-time', id, profile?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_time_logs')
                .select('clock_in, clock_out')
                .eq('job_order_id', id)
                .eq('technician_id', profile?.id)
                .not('clock_out', 'is', null);

            if (error) throw error;

            const total = (data || []).reduce((acc, log) => {
                const start = new Date(log.clock_in).getTime();
                const end = new Date(log.clock_out).getTime();
                return acc + Math.floor((end - start) / 1000);
            }, 0);

            return total;
        },
        enabled: !!id && !!profile?.id,
    });

    // Toggle task completion
    const toggleTaskMutation = useMutation({
        mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
            const { error } = await supabase
                .from('job_tasks')
                .update({
                    is_completed: isCompleted,
                    completed_at: isCompleted ? new Date().toISOString() : null,
                    completed_by: isCompleted ? profile?.id : null,
                    is_blocked: false,
                    blocked_reason: null,
                })
                .eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tech-job-tasks', id] });
        },
        onError: (error) => {
            console.error('Task update failed:', error);
            alert('فشل تحديث المهمة. يرجى المحاولة مرة أخرى.');
        },
    });

    // Block task mutation
    const blockTaskMutation = useMutation({
        mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
            const { error } = await supabase
                .from('job_tasks')
                .update({
                    is_blocked: true,
                    blocked_reason: reason,
                    is_completed: false,
                    completed_at: null,
                })
                .eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tech-job-tasks', id] });
            setShowBlockModal(false);
            setBlockingTask(null);
            setSelectedReason('');
            setCustomReason('');
        },
    });

    // Clock in/out mutation with status change
    const clockMutation = useMutation({
        mutationFn: async () => {
            if (activeTimeLog) {
                // Clock out
                const { error } = await supabase
                    .from('job_time_logs')
                    .update({ clock_out: new Date().toISOString() })
                    .eq('id', activeTimeLog.id);
                if (error) throw error;
            } else {
                // Clock in + Change job status to in_progress
                const { error: logError } = await supabase
                    .from('job_time_logs')
                    .insert({
                        job_order_id: id,
                        technician_id: profile?.id,
                        clock_in: new Date().toISOString(),
                    });
                if (logError) throw logError;

                // Update job status to in_progress
                const { error: statusError } = await supabase
                    .from('job_orders')
                    .update({ status: 'in_progress' })
                    .eq('id', id)
                    .in('status', ['pending', 'draft', 'paused']);

                if (statusError) console.warn('Could not update job status:', statusError);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tech-active-timelog', id, profile?.id] });
            queryClient.invalidateQueries({ queryKey: ['tech-total-time', id, profile?.id] });
            queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
            queryClient.invalidateQueries({ queryKey: ['tech-job-details', id] });
        },
        onError: (error) => {
            console.error('Clock mutation failed:', error);
            alert('فشل تسجيل الوقت. يرجى المحاولة مرة أخرى.');
        },
    });

    // Request review mutation
    const requestReviewMutation = useMutation({
        mutationFn: async () => {
            // First, clock out if still clocked in
            if (activeTimeLog) {
                await supabase
                    .from('job_time_logs')
                    .update({ clock_out: new Date().toISOString() })
                    .eq('id', activeTimeLog.id);
            }

            // Update job status to review with tracking
            const { error } = await supabase
                .from('job_orders')
                .update({
                    status: 'review',
                    submitted_for_review_at: new Date().toISOString(),
                    submitted_by: profile?.id
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tech-job-details', id] });
            queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
            queryClient.invalidateQueries({ queryKey: ['tech-active-timelog', id, profile?.id] });
            alert('تم إرسال طلب المراجعة بنجاح! سيتم إشعار المشرف.');
        },
        onError: (error) => {
            console.error('Request review failed:', error);
            alert('فشل إرسال طلب المراجعة.');
        },
    });

    const handleBlockTask = (task: JobTask) => {
        setBlockingTask(task);
        setShowBlockModal(true);
    };

    const handleSubmitBlock = () => {
        if (!blockingTask) return;
        const reason = selectedReason === 'أخرى (يرجى التحديد)' ? customReason : selectedReason;
        if (reason.trim()) {
            blockTaskMutation.mutate({ taskId: blockingTask.id, reason });
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        );
    }

    if (!job) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-muted-foreground">لم يتم العثور على أمر الشغل</p>
            </div>
        );
    }

    const completedCount = tasks?.filter(t => t.is_completed).length || 0;
    const totalCount = tasks?.length || 0;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const allTasksCompleted = totalCount > 0 && completedCount === totalCount;
    const isInReview = job.status === 'review';

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-8">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/tech')} className="shrink-0">
                    <ArrowRight size={20} />
                </Button>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{job.vehicle?.make} {job.vehicle?.model}</p>
                    <p className="text-xs text-muted-foreground font-mono">{job.vehicle?.plate_number}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">{job.code}</Badge>
            </div>

            <div className="p-4 space-y-4">
                {/* Timer Card */}
                <div className={cn(
                    'rounded-2xl p-6 text-center transition-all duration-300',
                    activeTimeLog
                        ? 'bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-xl shadow-primary/20'
                        : 'bg-card border'
                )}>
                    <p className={cn(
                        'text-sm mb-3 font-medium',
                        activeTimeLog ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}>
                        ⏱️ الوقت المستغرق
                    </p>

                    {activeTimeLog ? (
                        <LiveTimer startTime={activeTimeLog.clock_in} previousSeconds={totalPreviousSeconds || 0} size="xl" />
                    ) : (
                        <StaticTimer seconds={totalPreviousSeconds || 0} size="xl" />
                    )}

                    {!isInReview && (
                        <Button
                            size="lg"
                            className={cn(
                                'w-full mt-6 h-14 text-lg font-semibold rounded-xl gap-3 transition-all',
                                activeTimeLog
                                    ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
                                    : 'bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20'
                            )}
                            onClick={() => clockMutation.mutate()}
                            disabled={clockMutation.isPending}
                        >
                            {activeTimeLog ? (
                                <>
                                    <PauseCircle size={24} />
                                    إيقاف مؤقت
                                </>
                            ) : (
                                <>
                                    <PlayCircle size={24} />
                                    بدء العمل
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {/* All Tasks Completed + Request Review */}
                {allTasksCompleted && !isInReview && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl border border-green-200 dark:border-green-800 p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                            <PartyPopper size={32} className="text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">
                            🎉 أحسنت! تم إكمال جميع المهام
                        </h3>
                        <p className="text-sm text-green-700 dark:text-green-400 mb-4">
                            يمكنك الآن إرسال الأمر للمراجعة
                        </p>
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg font-semibold rounded-xl gap-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                            onClick={() => requestReviewMutation.mutate()}
                            disabled={requestReviewMutation.isPending}
                        >
                            <Send size={20} />
                            طلب مراجعة المشرف
                        </Button>
                    </div>
                )}

                {/* In Review Status */}
                {isInReview && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                            <Clock size={32} className="text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">
                            في انتظار المراجعة
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                            تم إرسال الأمر للمشرف للمراجعة والاعتماد
                        </p>
                    </div>
                )}

                {/* Customer Info */}
                <div className="bg-card rounded-2xl border p-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/50 rounded-xl flex items-center justify-center">
                            <User size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-lg">{job.customer?.name}</p>
                            <p className="text-sm text-muted-foreground">{job.customer?.phone}</p>
                        </div>
                        {job.customer?.phone && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 rounded-xl h-12 w-12"
                                asChild
                            >
                                <a href={`tel:${job.customer.phone}`}>
                                    <Phone size={20} />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Manager Instructions */}
                {job.manager_instructions && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border border-amber-200/50 dark:border-amber-800/50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center shrink-0">
                                <FileText size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                                    توجيهات المشرف
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                                    {job.manager_instructions}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tasks */}
                <div className="bg-card rounded-2xl border overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-lg">📋 المهام</h2>
                            <Badge variant="secondary">{completedCount}/{totalCount}</Badge>
                        </div>
                        <div className="w-24">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-500',
                                        progress === 100
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                            : 'bg-gradient-to-r from-primary to-primary/70'
                                    )}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {!tasks || tasks.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <CheckCircle2 size={48} className="mx-auto mb-3 opacity-50" />
                            <p>لا توجد مهام محددة</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className={cn(
                                        'p-4 transition-colors',
                                        task.is_completed && 'bg-green-50/50 dark:bg-green-950/20',
                                        task.is_blocked && 'bg-red-50/50 dark:bg-red-950/20'
                                    )}
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        {/* Status Icon */}
                                        <div className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                                            task.is_completed
                                                ? 'bg-green-500 text-white'
                                                : task.is_blocked
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-muted border-2 border-muted-foreground/20'
                                        )}>
                                            {task.is_completed && <CheckCircle2 size={18} />}
                                            {task.is_blocked && <XCircle size={18} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                'font-medium text-base',
                                                task.is_completed && 'line-through text-muted-foreground'
                                            )}>
                                                {task.description}
                                            </p>

                                            {/* Always show notes (task details) */}
                                            {task.notes && (
                                                <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-2 rounded-lg">
                                                    💡 {task.notes}
                                                </p>
                                            )}

                                            {/* Show blocked reason */}
                                            {task.is_blocked && task.blocked_reason && (
                                                <div className="flex items-center gap-1.5 mt-2 text-red-600 dark:text-red-400 text-sm">
                                                    <AlertTriangle size={14} />
                                                    <span>{task.blocked_reason}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {!task.is_completed && !task.is_blocked && !isInReview && (
                                        <div className="flex gap-2 mt-3 mr-11">
                                            <Button
                                                size="sm"
                                                className="flex-1 h-10 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/20"
                                                onClick={() => toggleTaskMutation.mutate({ taskId: task.id, isCompleted: true })}
                                                disabled={toggleTaskMutation.isPending}
                                            >
                                                <CheckCircle2 size={16} className="ml-1" />
                                                إتمام المهمة
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                                                onClick={() => handleBlockTask(task)}
                                            >
                                                <AlertTriangle size={16} className="ml-1" />
                                                إبلاغ تعثر
                                            </Button>
                                        </div>
                                    )}

                                    {/* Undo buttons */}
                                    {(task.is_completed || task.is_blocked) && !isInReview && (
                                        <div className="mt-3 mr-11">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-muted-foreground"
                                                onClick={() => toggleTaskMutation.mutate({ taskId: task.id, isCompleted: false })}
                                                disabled={toggleTaskMutation.isPending}
                                            >
                                                تراجع
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Block Reason Modal */}
            <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">إبلاغ عن تعثر</DialogTitle>
                        <DialogDescription className="text-right">
                            اختر سبب التعثر أو اكتب سبباً مخصصاً
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        {BLOCK_REASONS.map((reason) => (
                            <button
                                key={reason}
                                onClick={() => setSelectedReason(reason)}
                                className={cn(
                                    'w-full p-3 text-right rounded-xl border transition-all',
                                    selectedReason === reason
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-muted hover:border-muted-foreground/30'
                                )}
                            >
                                {reason}
                            </button>
                        ))}

                        {selectedReason === 'أخرى (يرجى التحديد)' && (
                            <Textarea
                                placeholder="اكتب سبب التعثر..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="mt-3"
                                rows={3}
                            />
                        )}
                    </div>

                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button
                            onClick={handleSubmitBlock}
                            disabled={!selectedReason || (selectedReason === 'أخرى (يرجى التحديد)' && !customReason.trim()) || blockTaskMutation.isPending}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            تأكيد الإبلاغ
                        </Button>
                        <Button variant="outline" onClick={() => setShowBlockModal(false)}>
                            إلغاء
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default TechJobDetailsPage;
