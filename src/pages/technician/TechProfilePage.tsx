import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, Briefcase, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

// ============================================================
// Technician Profile Page - الملف الشخصي للفني
// ============================================================

export function TechProfilePage() {
    const { profile } = useAuth();

    // Fetch stats
    const { data: stats } = useQuery({
        queryKey: ['tech-stats', profile?.id],
        queryFn: async () => {
            if (!profile?.id) return null;

            // Get completed tasks count
            const { data: completedTasks } = await supabase
                .from('job_tasks')
                .select('id', { count: 'exact' })
                .eq('completed_by', profile.id)
                .eq('is_completed', true);

            // Get assigned jobs count
            const { data: assignedJobs } = await supabase
                .from('job_technicians')
                .select('id', { count: 'exact' })
                .eq('technician_id', profile.id);

            // Get total hours from time logs
            const { data: timeLogs } = await supabase
                .from('job_time_logs')
                .select('clock_in, clock_out')
                .eq('technician_id', profile.id)
                .not('clock_out', 'is', null);

            let totalHours = 0;
            timeLogs?.forEach(log => {
                const start = new Date(log.clock_in).getTime();
                const end = new Date(log.clock_out!).getTime();
                totalHours += (end - start) / (1000 * 60 * 60);
            });

            return {
                completedTasks: completedTasks?.length || 0,
                assignedJobs: assignedJobs?.length || 0,
                totalHours: Math.round(totalHours * 10) / 10,
            };
        },
        enabled: !!profile?.id,
    });

    return (
        <div className="p-4 space-y-4">
            {/* Profile Header */}
            <div className="bg-card rounded-xl border p-6 text-center">
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <User size={40} className="text-primary" />
                </div>
                <h1 className="text-xl font-bold">{profile?.full_name}</h1>
                <p className="text-muted-foreground">فني صيانة</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-xl border p-4 text-center">
                    <div className="w-10 h-10 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-2">
                        <Briefcase size={20} className="text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold">{stats?.assignedJobs || 0}</p>
                    <p className="text-xs text-muted-foreground">أوامر شغل</p>
                </div>

                <div className="bg-card rounded-xl border p-4 text-center">
                    <div className="w-10 h-10 mx-auto bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-2">
                        <CheckCircle2 size={20} className="text-green-600" />
                    </div>
                    <p className="text-2xl font-bold">{stats?.completedTasks || 0}</p>
                    <p className="text-xs text-muted-foreground">مهام مكتملة</p>
                </div>

                <div className="bg-card rounded-xl border p-4 text-center col-span-2">
                    <div className="w-10 h-10 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-2">
                        <Clock size={20} className="text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold">{stats?.totalHours || 0} ساعة</p>
                    <p className="text-xs text-muted-foreground">إجمالي ساعات العمل</p>
                </div>
            </div>

            {/* Info */}
            <div className="bg-muted/50 rounded-xl p-4 text-center text-sm text-muted-foreground">
                💡 يتم تحديث الإحصائيات تلقائياً عند إكمال المهام
            </div>
        </div>
    );
}

export default TechProfilePage;
