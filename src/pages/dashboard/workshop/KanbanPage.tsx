import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowRight,
    List,
    Car,
    User,
    Clock,
    AlertCircle,
    GripVertical,
    Receipt,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared';
import { useRealtime } from '@/hooks';
import { JOB_STATUSES, JOB_CATEGORIES, PRIORITY_LEVELS, type JobStatus, type PriorityLevel } from '@/types/enums';

// ============================================================
// Kanban Board for Job Orders
// ============================================================

interface JobOrder {
    id: string;
    code: string;
    job_category: string;
    status: JobStatus;
    priority: PriorityLevel;
    created_at: string;
    notes: string | null;
    hasInvoice: boolean;
    vehicle: {
        plate_number: string;
        make: string | null;
        model: string | null;
    } | null;
    customer: {
        name: string;
    } | null;
}

// Kanban columns configuration
const KANBAN_COLUMNS: { status: JobStatus; title: string; color: string }[] = [
    { status: 'pending', title: 'في الانتظار', color: 'bg-yellow-500' },
    { status: 'in_progress', title: 'جاري العمل', color: 'bg-blue-500' },
    { status: 'paused', title: 'متوقف', color: 'bg-orange-500' },
    { status: 'review', title: 'مراجعة فنية', color: 'bg-purple-500' },
    { status: 'completed', title: 'مكتمل', color: 'bg-success' },
];

export function KanbanPage() {
    // Fetch all active job orders
    const { data: jobOrders, isLoading, error } = useQuery({
        queryKey: ['job-orders-kanban'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_orders')
                .select(`
          id, code, job_category, status, priority, 
          created_at, notes,
          vehicle:vehicles (plate_number, make, model),
          customer:customers (name)
        `)
                .in('status', ['pending', 'in_progress', 'paused', 'review', 'completed'])
                .order('priority', { ascending: false })
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Fetch invoices to check which jobs are invoiced
            const jobIds = (data || []).map((j: any) => j.id);
            const { data: invoices } = await supabase
                .from('invoices')
                .select('job_order_id')
                .in('job_order_id', jobIds);

            const invoicedJobIds = new Set((invoices || []).map(i => i.job_order_id));

            // Transform data - Supabase returns arrays for relations
            return (data || []).map((job: any) => ({
                ...job,
                vehicle: Array.isArray(job.vehicle) ? job.vehicle[0] || null : job.vehicle,
                customer: Array.isArray(job.customer) ? job.customer[0] || null : job.customer,
                hasInvoice: invoicedJobIds.has(job.id),
            })) as JobOrder[];
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    // Real-time updates
    useRealtime({
        table: 'job_orders',
        queryKey: ['job-orders-kanban'],
    });

    // Group jobs by status
    const jobsByStatus = React.useMemo(() => {
        const grouped: Record<JobStatus, JobOrder[]> = {
            draft: [],
            pending: [],
            in_progress: [],
            paused: [],
            review: [],
            completed: [],
            delivered: [],
            cancelled: [],
        };

        jobOrders?.forEach((job) => {
            if (grouped[job.status]) {
                grouped[job.status].push(job);
            }
        });

        return grouped;
    }, [jobOrders]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="لوحة Kanban"
                description="عرض أوامر الشغل بحسب الحالة"
                backLink="/dashboard/workshop"
                actions={
                    <Button variant="outline" asChild className="gap-2">
                        <Link to="/dashboard/workshop">
                            <List size={18} />
                            عرض القائمة
                        </Link>
                    </Button>
                }
            />

            {/* Loading */}
            {isLoading && (
                <div className="grid grid-cols-5 gap-4">
                    {KANBAN_COLUMNS.map((col) => (
                        <div key={col.status} className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <Card className="border-destructive">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="mx-auto mb-2 text-destructive" size={32} />
                        <p className="text-destructive">حدث خطأ أثناء تحميل البيانات</p>
                    </CardContent>
                </Card>
            )}

            {/* Kanban Board */}
            {!isLoading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
                    {KANBAN_COLUMNS.map((column) => (
                        <KanbanColumn
                            key={column.status}
                            title={column.title}
                            color={column.color}
                            jobs={jobsByStatus[column.status] || []}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// Kanban Column Component
// ============================================================
interface KanbanColumnProps {
    title: string;
    color: string;
    jobs: JobOrder[];
}

function KanbanColumn({ title, color, jobs }: KanbanColumnProps) {
    return (
        <div className="flex flex-col min-h-[500px]">
            {/* Column Header */}
            <div className={cn('rounded-t-lg px-4 py-3 text-white font-medium flex items-center justify-between', color)}>
                <span>{title}</span>
                <Badge variant="secondary" className="bg-white/20 text-white">
                    {jobs.length}
                </Badge>
            </div>

            {/* Column Content */}
            <div className="flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 overflow-y-auto">
                {jobs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4">
                        لا توجد أوامر
                    </div>
                ) : (
                    jobs.map((job) => (
                        <KanbanCard key={job.id} job={job} />
                    ))
                )}
            </div>
        </div>
    );
}

// ============================================================
// Kanban Card Component
// ============================================================
function KanbanCard({ job }: { job: JobOrder }) {
    const priorityStyles: Record<PriorityLevel, string> = {
        low: 'border-l-gray-400',
        normal: 'border-l-blue-400',
        high: 'border-l-orange-400',
        urgent: 'border-l-destructive',
    };

    return (
        <Link to={`/dashboard/workshop/${job.id}`}>
            <Card className={cn(
                'hover:shadow-md transition-shadow cursor-pointer border-l-4',
                priorityStyles[job.priority]
            )}>
                <CardContent className="p-3 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{job.code}</span>
                            {job.hasInvoice && (
                                <span className="text-emerald-600 dark:text-emerald-400" title="مفوتر">
                                    <Receipt size={14} />
                                </span>
                            )}
                        </div>
                        {job.priority !== 'normal' && (
                            <Badge
                                variant={job.priority === 'urgent' ? 'destructive' : 'secondary'}
                                className="text-xs"
                            >
                                {PRIORITY_LEVELS[job.priority]}
                            </Badge>
                        )}
                    </div>

                    {/* Category */}
                    <Badge variant="outline" className="text-xs">
                        {JOB_CATEGORIES[job.job_category as keyof typeof JOB_CATEGORIES] || job.job_category}
                    </Badge>

                    {/* Vehicle */}
                    {job.vehicle && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Car size={12} />
                            <span className="truncate">
                                {job.vehicle.make} {job.vehicle.model}
                            </span>
                        </div>
                    )}

                    {/* Customer */}
                    {job.customer && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User size={12} />
                            <span className="truncate">{job.customer.name}</span>
                        </div>
                    )}

                    {/* Time */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock size={12} />
                        <span>{formatDate(job.created_at)}</span>
                    </div>

                    {/* Notes preview */}
                    {job.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2 mt-2">
                            {job.notes}
                        </p>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
