import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight, Car, User, Phone, Clock, CheckCircle2,
    XCircle, AlertTriangle, PlayCircle, PauseCircle, FileText,
    Send, PartyPopper, RefreshCw
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
// Technician Job Details Page - Enhanced UX
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

// Haptic feedback helper
const triggerHaptic = (type: 'light' | 'medium' | 'success' | 'error') => {
    if ('vibrate' in navigator) {
        switch (type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(30);
                break;
            case 'success':
                navigator.vibrate([50, 30, 50]);
                break;
            case 'error':
                navigator.vibrate([100, 50, 100]);
                break;
        }
    }
};

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
        sm: 'text-xl',
        lg: 'text-4xl',
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
        sm: 'text-xl',
        lg: 'text-4xl',
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
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockingTask, setBlockingTask] = useState<JobTask | null>(null);
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState('');

    // Smart Auto-Clock modal
    const [showAutoClockPrompt, setShowAutoClockPrompt] = useState(false);
    const [hasShownAutoClockPrompt, setHasShownAutoClockPrompt] = useState(false);

    // Long press state for tasks
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

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
                    id, code, status, priority, manager_instructions, notes, review_notes,
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
        refetchInterval: 5000,
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
        refetchInterval: 5000,
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
        refetchInterval: 5000,
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

    // Smart Auto-Clock: Show prompt if not clocked in and job is active (improved logic)
    useEffect(() => {
        if (!isLoading && job && !activeTimeLog && !hasShownAutoClockPrompt && totalPreviousSeconds !== undefined) {
            // Check if already dismissed for this job (persisted per job)
            const dismissedKey = `auto-clock-dismissed-${id}`;
            const wasDismissed = sessionStorage.getItem(dismissedKey);
            if (wasDismissed) return;

            // Only show for active jobs (in_progress or assigned)
            const activeStatuses = ['assigned', 'in_progress'];
            const isJobActive = activeStatuses.includes(job.status);

            // Don't show if technician already has logged time on this job
            const hasWorkedBefore = (totalPreviousSeconds || 0) > 0;

            if (isJobActive && !hasWorkedBefore) {
                // Delay to allow the page to render first
                const timer = setTimeout(() => {
                    setShowAutoClockPrompt(true);
                    setHasShownAutoClockPrompt(true);
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [isLoading, job, activeTimeLog, hasShownAutoClockPrompt, totalPreviousSeconds, id]);

    // Toggle task completion with haptic
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
        onSuccess: (_, { isCompleted }) => {
            queryClient.invalidateQueries({ queryKey: ['tech-job-tasks', id] });
            if (isCompleted) {
                triggerHaptic('success');
            }
        },
        onError: (error) => {
            console.error('Task update failed:', error);
            triggerHaptic('error');
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
            triggerHaptic('medium');
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
            triggerHaptic('medium');
            setShowAutoClockPrompt(false);
        },
        onError: (error) => {
            console.error('Clock mutation failed:', error);
            triggerHaptic('error');
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
            triggerHaptic('success');
            alert('تم إرسال طلب المراجعة بنجاح! سيتم إشعار المشرف.');
        },
        onError: (error) => {
            console.error('Request review failed:', error);
            triggerHaptic('error');
            alert('فشل إرسال طلب المراجعة.');
        },
    });

    // Quick task completion (single tap)
    const handleQuickComplete = (task: JobTask) => {
        if (task.is_completed || task.is_blocked) return;
        triggerHaptic('light');
        toggleTaskMutation.mutate({ taskId: task.id, isCompleted: true });
    };

    // Long press handlers for block
    const handleTouchStart = (task: JobTask) => {
        if (task.is_completed || task.is_blocked) return;
        const timer = setTimeout(() => {
            triggerHaptic('medium');
            setBlockingTask(task);
            setShowBlockModal(true);
        }, 600);
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
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
    const isCompleted = job.status === 'completed';
    const isDelivered = job.status === 'delivered';
    const isFinished = isInReview || isCompleted || isDelivered;


    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-8">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/tech')} className="shrink-0">
                    <ArrowRight size={20} />
                </Button>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{job.vehicle?.make} {job.vehicle?.model}</p>
                    <p className="text-sm text-muted-foreground font-mono">{job.vehicle?.plate_number}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-sm">{job.code}</Badge>
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
                        'text-base mb-3 font-medium',
                        activeTimeLog ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}>
                        ⏱️ الوقت المستغرق
                    </p>

                    {activeTimeLog ? (
                        <LiveTimer startTime={activeTimeLog.clock_in} previousSeconds={totalPreviousSeconds || 0} size="xl" />
                    ) : (
                        <StaticTimer seconds={totalPreviousSeconds || 0} size="xl" />
                    )}

                    {!isFinished && (
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

                {/* All Tasks Completed + Request Review - Hide when job was returned with review notes */}
                {allTasksCompleted && !isFinished && !job.review_notes && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl border border-green-200 dark:border-green-800 p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                            <PartyPopper size={32} className="text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">
                            🎉 أحسنت! تم إكمال جميع المهام
                        </h3>
                        <p className="text-base text-green-700 dark:text-green-400 mb-4">
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

                {/* Re-submit for Review - When job was returned with notes and corrections are done */}
                {allTasksCompleted && !isFinished && job.review_notes && (
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                            <RefreshCw size={32} className="text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-2">
                            ✅ تم إتمام التعديلات المطلوبة
                        </h3>
                        <p className="text-base text-blue-700 dark:text-blue-400 mb-4">
                            يمكنك الآن إعادة إرسال الأمر للمراجعة
                        </p>
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg font-semibold rounded-xl gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg"
                            onClick={() => requestReviewMutation.mutate()}
                            disabled={requestReviewMutation.isPending}
                        >
                            <Send size={20} />
                            إعادة الإرسال للمراجعة
                        </Button>
                    </div>
                )}

                {/* In Review Status */}
                {isInReview && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                            <Clock size={32} className="text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-2">
                            في انتظار المراجعة
                        </h3>
                        <p className="text-base text-blue-700 dark:text-blue-400">
                            تم إرسال الأمر للمشرف للمراجعة والاعتماد
                        </p>
                    </div>
                )}

                {/* Customer Info */}
                <div className="bg-card rounded-2xl border p-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-muted to-muted/50 rounded-xl flex items-center justify-center">
                            <User size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xl">{job.customer?.name}</p>
                            <p className="text-base text-muted-foreground">{job.customer?.phone}</p>
                        </div>
                        {job.customer?.phone && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 rounded-xl h-14 w-14"
                                asChild
                            >
                                <a href={`tel:${job.customer.phone}`}>
                                    <Phone size={24} />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Review Notes - ملاحظات الإرجاع من المشرف */}
                {job.review_notes && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 rounded-2xl border-2 border-red-300 dark:border-red-700 p-5 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-200 dark:bg-red-900/50 rounded-xl flex items-center justify-center shrink-0">
                                <AlertTriangle size={24} className="text-red-700 dark:text-red-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-base font-bold text-red-800 dark:text-red-300 mb-2">
                                    ⚠️ ملاحظات المشرف - يرجى المراجعة
                                </p>
                                <p className="text-lg text-red-900 dark:text-red-200 leading-relaxed font-medium">
                                    {job.review_notes}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manager Instructions - Enhanced visibility */}
                {job.manager_instructions && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border-2 border-amber-300 dark:border-amber-700 p-5">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-200 dark:bg-amber-900/50 rounded-xl flex items-center justify-center shrink-0">
                                <FileText size={24} className="text-amber-700 dark:text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-base font-bold text-amber-800 dark:text-amber-300 mb-2">
                                    📋 توجيهات المشرف
                                </p>
                                <p className="text-lg text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                                    {job.manager_instructions}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tasks - Enhanced with quick complete */}
                <div className="bg-card rounded-2xl border overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="font-bold text-xl">📋 المهام</h2>
                            <Badge variant="secondary" className="text-base px-3 py-1">{completedCount}/{totalCount}</Badge>
                        </div>
                        <div className="w-28">
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
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

                    {/* Quick Complete Hint */}
                    {!isInReview && tasks && tasks.some(t => !t.is_completed && !t.is_blocked) && (
                        <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground text-center border-b">
                            💡 انقر على المهمة للإتمام • اضغط مطولاً للإبلاغ عن تعثر
                        </div>
                    )}

                    {!tasks || tasks.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <CheckCircle2 size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-lg">لا توجد مهام محددة</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={() => !isInReview && handleQuickComplete(task)}
                                    onTouchStart={() => !isInReview && handleTouchStart(task)}
                                    onTouchEnd={handleTouchEnd}
                                    onMouseDown={() => !isInReview && handleTouchStart(task)}
                                    onMouseUp={handleTouchEnd}
                                    onMouseLeave={handleTouchEnd}
                                    className={cn(
                                        'p-5 transition-all select-none',
                                        task.is_completed && 'bg-green-50/50 dark:bg-green-950/20',
                                        task.is_blocked && 'bg-red-50/50 dark:bg-red-950/20',
                                        !task.is_completed && !task.is_blocked && !isInReview && 'cursor-pointer active:bg-muted/50 hover:bg-muted/30'
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Status Icon - Larger */}
                                        <div className={cn(
                                            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-transform',
                                            task.is_completed
                                                ? 'bg-green-500 text-white scale-110'
                                                : task.is_blocked
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-muted border-2 border-muted-foreground/30'
                                        )}>
                                            {task.is_completed && <CheckCircle2 size={22} />}
                                            {task.is_blocked && <XCircle size={22} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                'font-semibold text-lg leading-relaxed',
                                                task.is_completed && 'line-through text-muted-foreground'
                                            )}>
                                                {task.description}
                                            </p>

                                            {/* Task notes - More visible */}
                                            {task.notes && (
                                                <p className="text-base text-muted-foreground mt-2 bg-muted/70 p-3 rounded-xl leading-relaxed">
                                                    💡 {task.notes}
                                                </p>
                                            )}

                                            {/* Show blocked reason */}
                                            {task.is_blocked && task.blocked_reason && (
                                                <div className="flex items-center gap-2 mt-3 text-red-600 dark:text-red-400 text-base font-medium">
                                                    <AlertTriangle size={18} />
                                                    <span>{task.blocked_reason}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Undo button for completed/blocked */}
                                    {(task.is_completed || task.is_blocked) && !isFinished && (
                                        <div className="mt-3 mr-14">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-muted-foreground"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTaskMutation.mutate({ taskId: task.id, isCompleted: false });
                                                }}
                                                disabled={toggleTaskMutation.isPending}
                                            >
                                                ↩️ تراجع
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Smart Auto-Clock Prompt */}
            <Dialog open={showAutoClockPrompt} onOpenChange={setShowAutoClockPrompt}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right text-xl">⏱️ بدء العمل؟</DialogTitle>
                        <DialogDescription className="text-right text-base">
                            هل تريد تسجيل بدء العمل على هذا الأمر الآن؟
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row-reverse gap-2 mt-4">
                        <Button
                            size="lg"
                            onClick={() => clockMutation.mutate()}
                            disabled={clockMutation.isPending}
                            className="flex-1 h-12 text-lg bg-gradient-to-r from-primary to-primary/90"
                        >
                            <PlayCircle size={20} className="ml-2" />
                            نعم، ابدأ الآن
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => {
                                sessionStorage.setItem(`auto-clock-dismissed-${id}`, 'true');
                                setShowAutoClockPrompt(false);
                            }}
                            className="flex-1 h-12 text-lg"
                        >
                            لاحقاً
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Block Reason Modal */}
            <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right text-xl">⚠️ إبلاغ عن تعثر</DialogTitle>
                        <DialogDescription className="text-right text-base">
                            اختر سبب التعثر أو اكتب سبباً مخصصاً
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        {BLOCK_REASONS.map((reason) => (
                            <button
                                key={reason}
                                onClick={() => setSelectedReason(reason)}
                                className={cn(
                                    'w-full p-4 text-right rounded-xl border transition-all text-base',
                                    selectedReason === reason
                                        ? 'border-primary bg-primary/5 text-primary font-medium'
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
                                className="mt-3 text-base"
                                rows={3}
                            />
                        )}
                    </div>

                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button
                            size="lg"
                            onClick={handleSubmitBlock}
                            disabled={!selectedReason || (selectedReason === 'أخرى (يرجى التحديد)' && !customReason.trim()) || blockTaskMutation.isPending}
                            className="bg-red-500 hover:bg-red-600 h-12 text-lg"
                        >
                            تأكيد الإبلاغ
                        </Button>
                        <Button size="lg" variant="outline" onClick={() => setShowBlockModal(false)} className="h-12 text-lg">
                            إلغاء
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default TechJobDetailsPage;
