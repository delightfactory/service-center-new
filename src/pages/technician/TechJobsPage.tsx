import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Car, Clock, CheckCircle2, PlayCircle, PauseCircle, User2, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { JobStatus, PriorityLevel } from '@/types/enums';

// ============================================================
// Technician Jobs Page - Complete Redesign with Real-time
// ============================================================

interface TechJob {
    id: string;
    code: string;
    status: JobStatus;
    priority: PriorityLevel;
    created_at: string;
    manager_instructions: string | null;
    vehicle: {
        id: string;
        plate_number: string;
        make: string | null;
        model: string | null;
        year: number | null;
        color: string | null;
    } | null;
    customer: {
        id: string;
        name: string;
        phone: string | null;
    } | null;
    tasks_count: number;
    completed_tasks_count: number;
    active_time_log: {
        id: string;
        clock_in: string;
    } | null;
}

const priorityConfig: Record<PriorityLevel, { color: string; label: string; bgColor: string }> = {
    low: { color: 'text-slate-600', label: 'عادي', bgColor: 'bg-slate-100' },
    normal: { color: 'text-blue-600', label: 'متوسط', bgColor: 'bg-blue-100' },
    high: { color: 'text-orange-600', label: 'مرتفع', bgColor: 'bg-orange-100' },
    urgent: { color: 'text-red-600', label: 'عاجل', bgColor: 'bg-red-100' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
    pending: { label: 'جديد', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'جاري العمل', color: 'bg-yellow-100 text-yellow-700' },
    paused: { label: 'متوقف', color: 'bg-orange-100 text-orange-700' },
    review: { label: 'قيد المراجعة', color: 'bg-purple-100 text-purple-700' },
};

// Live Timer Component
function LiveTimer({ startTime }: { startTime: string }) {
    const [elapsed, setElapsed] = React.useState(0);

    useEffect(() => {
        const start = new Date(startTime).getTime();
        const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    return (
        <span className="font-mono font-bold text-lg tabular-nums">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
    );
}

export function TechJobsPage() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // ============================================================
    // Real-time Subscriptions
    // ============================================================
    useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase
            .channel('tech-jobs-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_time_logs',
                filter: `technician_id=eq.${profile.id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_tasks',
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_technicians',
                filter: `technician_id=eq.${profile.id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_orders',
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, queryClient]);

    // Fetch jobs assigned to this technician
    const { data: jobs, isLoading } = useQuery({
        queryKey: ['tech-jobs', profile?.id],
        queryFn: async () => {
            if (!profile?.id) return [];

            const { data: techJobs, error: techError } = await supabase
                .from('job_technicians')
                .select('job_order_id')
                .eq('technician_id', profile.id);

            if (techError) throw techError;
            if (!techJobs || techJobs.length === 0) return [];

            const jobIds = techJobs.map(tj => tj.job_order_id);

            const { data: jobOrders, error: jobsError } = await supabase
                .from('job_orders')
                .select(`
                    id, code, status, priority, created_at, manager_instructions,
                    vehicle:vehicles (id, plate_number, make, model, year, color),
                    customer:customers (id, name, phone)
                `)
                .in('id', jobIds)
                .in('status', ['draft', 'pending', 'in_progress', 'paused', 'review'])
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });

            if (jobsError) throw jobsError;

            const jobsWithDetails = await Promise.all(
                (jobOrders || []).map(async (job) => {
                    const { data: tasks } = await supabase
                        .from('job_tasks')
                        .select('id, is_completed')
                        .eq('job_order_id', job.id);

                    const { data: activeLog } = await supabase
                        .from('job_time_logs')
                        .select('id, clock_in')
                        .eq('job_order_id', job.id)
                        .eq('technician_id', profile.id)
                        .is('clock_out', null)
                        .maybeSingle();

                    return {
                        ...job,
                        vehicle: Array.isArray(job.vehicle) ? job.vehicle[0] : job.vehicle,
                        customer: Array.isArray(job.customer) ? job.customer[0] : job.customer,
                        tasks_count: tasks?.length || 0,
                        completed_tasks_count: tasks?.filter(t => t.is_completed).length || 0,
                        active_time_log: activeLog || null,
                    };
                })
            );

            return jobsWithDetails as TechJob[];
        },
        enabled: !!profile?.id,
        refetchInterval: 5000, // Polling fallback every 5 seconds
    });

    // Clock in/out mutation with status change
    const clockMutation = useMutation({
        mutationFn: async ({ jobId, activeLogId }: { jobId: string; activeLogId?: string }) => {
            if (activeLogId) {
                // Clock out
                const { error } = await supabase
                    .from('job_time_logs')
                    .update({ clock_out: new Date().toISOString() })
                    .eq('id', activeLogId);
                if (error) throw error;
            } else {
                // Clock in + Change job status to in_progress
                const { error: logError } = await supabase
                    .from('job_time_logs')
                    .insert({
                        job_order_id: jobId,
                        technician_id: profile?.id,
                        clock_in: new Date().toISOString(),
                    });
                if (logError) throw logError;

                // Update job status to in_progress
                const { error: statusError } = await supabase
                    .from('job_orders')
                    .update({ status: 'in_progress' })
                    .eq('id', jobId)
                    .in('status', ['pending', 'draft', 'paused']);

                if (statusError) console.warn('Could not update job status:', statusError);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tech-jobs', profile?.id] });
        },
        onError: (error) => {
            console.error('Clock mutation failed:', error);
            alert('فشل تسجيل الوقت. يرجى المحاولة مرة أخرى.');
        },
    });

    const handleClockToggle = (job: TechJob, e: React.MouseEvent) => {
        e.stopPropagation();
        clockMutation.mutate({
            jobId: job.id,
            activeLogId: job.active_time_log?.id,
        });
    };

    if (isLoading) {
        return (
            <div className="p-4 space-y-4">
                <div className="h-8 mb-6" />
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (!jobs || jobs.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh]">
                <div className="text-center">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                        <CheckCircle2 size={48} className="text-primary" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">لا توجد مهام حالياً</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto">
                        سيتم إشعارك فور تعيين أوامر شغل جديدة لك
                    </p>
                </div>
            </div>
        );
    }

    // Separate active, in-review and pending jobs
    const activeJob = jobs.find(j => j.active_time_log);
    const inReviewJobs = jobs.filter(j => !j.active_time_log && j.status === 'review');
    const pendingJobs = jobs.filter(j => !j.active_time_log && j.status !== 'review');

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            مهامي
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {jobs.length} أمر شغل معين لك
                        </p>
                    </div>
                    {activeJob && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5">
                            <span className="w-2 h-2 bg-primary rounded-full animate-pulse ml-2" />
                            جاري العمل
                        </Badge>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Active Job - Highlighted */}
                {activeJob && (
                    <div className="mb-6">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                            قيد التنفيذ الآن
                        </p>
                        <JobCard
                            job={activeJob}
                            onNavigate={() => navigate(`/tech/job/${activeJob.id}`)}
                            onClockToggle={(e) => handleClockToggle(activeJob, e)}
                            isActive
                            isPending={clockMutation.isPending}
                        />
                    </div>
                )}

                {/* In Review Jobs */}
                {inReviewJobs.length > 0 && (
                    <div className="mb-6">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                            قيد المراجعة ({inReviewJobs.length})
                        </p>
                        <div className="space-y-4">
                            {inReviewJobs.map((job) => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    onNavigate={() => navigate(`/tech/job/${job.id}`)}
                                    onClockToggle={(e) => handleClockToggle(job, e)}
                                    isInReview
                                    isPending={clockMutation.isPending}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Jobs */}
                {pendingJobs.length > 0 && (
                    <div>
                        {(activeJob || inReviewJobs.length > 0) && (
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                                في الانتظار ({pendingJobs.length})
                            </p>
                        )}
                        <div className="space-y-4">
                            {pendingJobs.map((job) => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    onNavigate={() => navigate(`/tech/job/${job.id}`)}
                                    onClockToggle={(e) => handleClockToggle(job, e)}
                                    isPending={clockMutation.isPending}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Job Card Component
interface JobCardProps {
    job: TechJob;
    onNavigate: () => void;
    onClockToggle: (e: React.MouseEvent) => void;
    isActive?: boolean;
    isInReview?: boolean;
    isPending?: boolean;
}

function JobCard({ job, onNavigate, onClockToggle, isActive = false, isInReview = false, isPending = false }: JobCardProps) {
    const priority = priorityConfig[job.priority];
    const status = statusConfig[job.status] || { label: job.status, color: 'bg-gray-100' };
    const progress = job.tasks_count > 0 ? (job.completed_tasks_count / job.tasks_count) * 100 : 0;

    return (
        <div
            onClick={onNavigate}
            className={cn(
                'rounded-2xl overflow-hidden cursor-pointer transition-all duration-300',
                'bg-card border shadow-sm hover:shadow-md',
                'active:scale-[0.98] active:shadow-sm',
                isActive && 'ring-2 ring-primary shadow-lg shadow-primary/10',
                isInReview && 'ring-2 ring-purple-400 shadow-lg shadow-purple/10'
            )}
        >
            {/* Top Section */}
            <div className="p-4">
                <div className="flex items-start gap-4">
                    {/* Car Icon */}
                    <div className={cn(
                        'w-16 h-16 rounded-2xl flex items-center justify-center shrink-0',
                        'transition-colors duration-300',
                        isActive
                            ? 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30'
                            : isInReview
                                ? 'bg-gradient-to-br from-purple-500 to-purple-400 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-gradient-to-br from-muted to-muted/50'
                    )}>
                        <Car size={32} />
                    </div>

                    {/* Vehicle Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                            <h3 className="font-bold text-lg leading-tight">
                                {job.vehicle?.make} {job.vehicle?.model}
                            </h3>
                            <div className="flex gap-2">
                                <Badge className={cn(status.color, 'text-xs font-medium border-0')}>
                                    {status.label}
                                </Badge>
                                {job.priority !== 'low' && (
                                    <Badge className={cn(priority.bgColor, priority.color, 'text-xs font-medium border-0')}>
                                        {priority.label}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <p className="text-sm font-mono text-muted-foreground mb-2">
                            {job.vehicle?.plate_number}
                        </p>
                        {/* تم إخفاء بيانات العميل عن الفني */}
                    </div>
                </div>
            </div>

            {/* Progress Section */}
            <div className="px-4 py-3 bg-muted/30 border-t">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-muted-foreground" />
                        <span className="text-muted-foreground">المهام:</span>
                        <span className="font-semibold">
                            {job.completed_tasks_count} / {job.tasks_count}
                        </span>
                    </div>
                    {isActive && job.active_time_log && (
                        <div className="flex items-center gap-2 text-primary">
                            <Clock size={16} />
                            <LiveTimer startTime={job.active_time_log.clock_in} />
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
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

            {/* Manager Instructions Preview */}
            {job.manager_instructions && (
                <div className="px-4 py-3 bg-amber-50/50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
                    <p className="text-xs text-amber-700 dark:text-amber-400 line-clamp-2">
                        📝 {job.manager_instructions}
                    </p>
                </div>
            )}

            {/* Action Button */}
            <div className="p-4 border-t">
                {isInReview ? (
                    <Button
                        size="lg"
                        variant="outline"
                        className="w-full h-14 text-base font-semibold rounded-xl gap-3 border-purple-200 text-purple-600 hover:bg-purple-50"
                        onClick={(e) => { e.stopPropagation(); onNavigate(); }}
                    >
                        <Eye size={24} />
                        عرض التفاصيل
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        className={cn(
                            'w-full h-14 text-base font-semibold rounded-xl gap-3 transition-all',
                            isActive
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/20'
                                : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary shadow-lg shadow-primary/20'
                        )}
                        onClick={onClockToggle}
                        disabled={isPending}
                    >
                        {isActive ? (
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
        </div>
    );
}

export default TechJobsPage;
