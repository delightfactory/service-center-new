import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Clock, Timer, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ============================================================
// Job Time Tracker Component
// ============================================================
// Tracks time spent by technicians on a job order
// Features:
// - Clock in/out functionality
// - Live timer display
// - Time logs history
// ============================================================

interface JobTimeTrackerProps {
    jobOrderId: string;
    className?: string;
}

interface TimeLog {
    id: string;
    job_order_id: string;
    technician_id: string;
    clock_in: string;
    clock_out: string | null;
    duration_minutes: number | null;
    notes: string | null;
    activity_type: string;
    technician: {
        id: string;
        full_name: string;
        avatar_url: string | null;
    };
}

export function JobTimeTracker({ jobOrderId, className }: JobTimeTrackerProps) {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [elapsedTime, setElapsedTime] = useState(0);

    // Check if current user is a technician
    const isTechnician = profile?.role === 'technician';

    // Fetch time logs for this job order
    const { data: timeLogs, isLoading } = useQuery({
        queryKey: ['job-time-logs', jobOrderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_time_logs')
                .select(`
          id, job_order_id, technician_id, clock_in, clock_out,
          duration_minutes, notes, activity_type,
          technician:profiles (id, full_name, avatar_url)
        `)
                .eq('job_order_id', jobOrderId)
                .order('clock_in', { ascending: false });

            if (error) throw error;
            return data.map(log => ({
                ...log,
                technician: Array.isArray(log.technician) ? log.technician[0] : log.technician
            })) as TimeLog[];
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    // Check if current user has an active clock-in
    const activeLog = timeLogs?.find(
        log => log.technician_id === profile?.id && !log.clock_out
    );

    // Live timer effect
    useEffect(() => {
        if (!activeLog) {
            setElapsedTime(0);
            return;
        }

        const startTime = new Date(activeLog.clock_in).getTime();

        const updateTimer = () => {
            const now = Date.now();
            setElapsedTime(Math.floor((now - startTime) / 1000));
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeLog]);

    // Clock In mutation
    const clockInMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase
                .from('job_time_logs')
                .insert({
                    job_order_id: jobOrderId,
                    technician_id: profile?.id,
                    activity_type: 'work',
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-time-logs', jobOrderId] });
        },
    });

    // Clock Out mutation
    const clockOutMutation = useMutation({
        mutationFn: async (logId: string) => {
            const { data, error } = await supabase
                .from('job_time_logs')
                .update({ clock_out: new Date().toISOString() })
                .eq('id', logId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-time-logs', jobOrderId] });
            queryClient.invalidateQueries({ queryKey: ['job-order', jobOrderId] });
        },
    });

    // Format duration
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatMinutes = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}س ${mins}د`;
        }
        return `${mins}د`;
    };

    // Calculate total time
    const totalMinutes = timeLogs?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0;

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Timer size={20} />
                    تتبع الوقت
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Clock In/Out Button (for technicians only) */}
                {isTechnician && (
                    <div className="space-y-3">
                        {activeLog ? (
                            <>
                                {/* Active Timer */}
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                                    <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                                        جاري العمل...
                                    </p>
                                    <p className="text-4xl font-mono font-bold text-green-700 dark:text-green-300">
                                        {formatDuration(elapsedTime)}
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    className="w-full gap-2"
                                    onClick={() => clockOutMutation.mutate(activeLog.id)}
                                    disabled={clockOutMutation.isPending}
                                >
                                    <Pause size={18} />
                                    {clockOutMutation.isPending ? 'جاري الإيقاف...' : 'إيقاف المؤقت'}
                                </Button>
                            </>
                        ) : (
                            <Button
                                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                                onClick={() => clockInMutation.mutate()}
                                disabled={clockInMutation.isPending}
                            >
                                <Play size={18} />
                                {clockInMutation.isPending ? 'جاري البدء...' : 'بدء العمل'}
                            </Button>
                        )}
                    </div>
                )}

                {/* Total Time */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">إجمالي الوقت</span>
                    <span className="text-xl font-bold text-primary">
                        {formatMinutes(totalMinutes)}
                    </span>
                </div>

                {/* Time Logs History */}
                {isLoading ? (
                    <div className="text-center py-4 text-muted-foreground">
                        جاري التحميل...
                    </div>
                ) : timeLogs && timeLogs.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        <p className="text-sm font-medium text-muted-foreground">السجلات</p>
                        {timeLogs.map((log) => (
                            <div
                                key={log.id}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg border",
                                    !log.clock_out && "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                                )}
                            >
                                <Avatar className="w-8 h-8">
                                    <AvatarImage src={log.technician?.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                        {log.technician?.full_name?.charAt(0) || 'ف'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {log.technician?.full_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(log.clock_in).toLocaleTimeString('ar-EG', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                        {log.clock_out && (
                                            <>
                                                {' - '}
                                                {new Date(log.clock_out).toLocaleTimeString('ar-EG', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="text-left">
                                    {log.clock_out ? (
                                        <Badge variant="outline" className="text-xs">
                                            {formatMinutes(log.duration_minutes || 0)}
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-green-500 text-xs">
                                            <Clock size={12} className="ml-1 animate-pulse" />
                                            جاري
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                        لا توجد سجلات وقت بعد
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default JobTimeTracker;
