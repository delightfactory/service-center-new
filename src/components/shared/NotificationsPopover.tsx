import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Wrench, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Types for fetched data
interface FetchedTask {
    id: string;
    description: string;
    job_order: {
        id: string;
        code: string;
    };
}

interface FetchedAssignment {
    job_order: {
        id: string;
        code: string;
        status: string;
        vehicle: {
            plate_number: string;
        } | null;
    };
}

interface FetchedReturnedJob {
    job_order: {
        id: string;
        code: string;
        status: string;
        review_notes: string | null;
        vehicle: {
            plate_number: string;
        } | null;
    };
}

export function NotificationsPopover() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [open, setOpen] = React.useState(false);
    const isTechnician = profile?.role === 'technician';
    const jobLinkBase = isTechnician ? '/tech/job/' : '/dashboard/workshop/';

    // Fetch notifications (Assigned Tasks & Jobs)
    const { data: notifications, isLoading } = useQuery({
        queryKey: ['notifications', profile?.id],
        queryFn: async () => {
            if (!profile?.id) return [];

            const notifs = [];

            // 1. Pending Tasks
            const { data: tasks } = await supabase
                .from('job_tasks')
                .select(`
                    id, description, 
                    job_order:job_orders!inner(id, code)
                `)
                .eq('assigned_to', profile.id)
                .eq('is_completed', false)
                .order('created_at', { ascending: false })
                .limit(5);

            if (tasks) {
                const typedTasks = tasks as unknown as FetchedTask[];
                notifs.push(...typedTasks.map(t => ({
                    id: t.id,
                    type: 'task',
                    title: 'مهمة جديدة',
                    message: t.description,
                    time: 'الآن', // Can be real time
                    link: `${jobLinkBase}${t.job_order.id}`,
                    icon: CheckCircle2,
                    color: 'text-blue-500 bg-blue-50'
                })));
            }

            // 2. Assigned Jobs (as Lead Tech) - Active jobs only
            const { data: assignments } = await supabase
                .from('job_technicians')
                .select(`
                    job_order:job_orders!inner(id, code, status, vehicle:vehicles(plate_number))
                `)
                .eq('technician_id', profile.id)
                .eq('is_lead', true)
                .limit(10);

            if (assignments) {
                const typedAssignments = assignments as unknown as FetchedAssignment[];
                // Filter client-side for active statuses
                const activeJobs = typedAssignments.filter(a =>
                    a.job_order.status === 'in_progress' || a.job_order.status === 'pending'
                );
                notifs.push(...activeJobs.slice(0, 5).map(a => ({
                    id: a.job_order.id,
                    type: 'job',
                    title: 'أمر شغل مسند إليك',
                    message: `أمر شغل #${a.job_order.code} - ${a.job_order.vehicle?.plate_number || 'بدون لوحة'}`,
                    time: 'الآن',
                    link: `${jobLinkBase}${a.job_order.id}`,
                    icon: Wrench,
                    color: 'text-orange-500 bg-orange-50'
                })));
            }

            // 3. Returned Jobs (مُرجعة من المراجعة)
            const { data: returnedJobs } = await supabase
                .from('job_technicians')
                .select(`
                    job_order:job_orders!inner(id, code, status, review_notes, vehicle:vehicles(plate_number))
                `)
                .eq('technician_id', profile.id)
                .limit(10);

            if (returnedJobs) {
                const typedReturned = returnedJobs as unknown as FetchedReturnedJob[];
                // Filter client-side for returned jobs with review_notes
                const returned = typedReturned.filter(r =>
                    r.job_order.status === 'in_progress' && r.job_order.review_notes
                );
                notifs.unshift(...returned.slice(0, 5).map(r => ({
                    id: `returned-${r.job_order.id}`,
                    type: 'returned',
                    title: '⚠️ أمر مُرجع للمراجعة',
                    message: `أمر #${r.job_order.code} - ${r.job_order.vehicle?.plate_number || ''} يحتاج تعديل`,
                    time: 'الآن',
                    link: `${jobLinkBase}${r.job_order.id}`,
                    icon: AlertTriangle,
                    color: 'text-red-500 bg-red-50'
                })));
            }

            return notifs;
        },
        enabled: !!profile?.id,
        refetchInterval: 30000,
        refetchIntervalInBackground: true,
    });

    const unreadCount = notifications?.length || 0;

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-in zoom-in">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={10}>
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <h4 className="font-semibold">الإشعارات</h4>
                    {unreadCount > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {unreadCount} جديد
                        </span>
                    )}
                </div>

                {/* Custom Scroll Area using simple div */}
                <div className="max-h-[300px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-8 h-8 bg-muted rounded-full" />
                                    <div className="space-y-1 flex-1">
                                        <div className="h-4 bg-muted rounded w-3/4" />
                                        <div className="h-3 bg-muted rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : unreadCount === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                            <Bell size={32} className="mb-2 opacity-20" />
                            <p>لا توجد إشعارات جديدة</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications?.map((notif) => (
                                <DropdownMenuItem
                                    key={`${notif.type}-${notif.id}`}
                                    className="w-full flex items-start gap-3 p-4 cursor-pointer focus:bg-muted/50"
                                    onClick={() => {
                                        setOpen(false);
                                        navigate(notif.link);
                                    }}
                                >
                                    <div className={cn("mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0", notif.color)}>
                                        <notif.icon size={16} />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <p className="text-sm font-medium leading-none">{notif.title}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {notif.message}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground pt-1">
                                            {notif.time}
                                        </p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                </DropdownMenuItem>
                            ))}
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
