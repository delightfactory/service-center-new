import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ClipboardList,
    Wrench,
    CheckCircle2,
    Wallet,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Users,
    Package,
    CreditCard,
    RefreshCw,
    Clock,
    UserCircle,
    Car,
    Receipt,
    Search,
    Plus,
    ArrowLeft,
    Phone,
    Eye,
    UserPlus,
    Play,
    Pause,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { LowStockAlertsCard } from '@/components/inventory/LowStockAlertsCard';

// ============================================================
// Dashboard Page - لوحة التحكم المحسنة للمدير
// ============================================================

// Helper function for relative time
function getRelativeTime(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} د`;
    if (diffHours < 24) return `منذ ${diffHours} س`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return then.toLocaleDateString('ar-EG');
}

// Calculate percentage change
function getPercentChange(current: number, previous: number): { value: number; positive: boolean } {
    if (previous === 0) return { value: current > 0 ? 100 : 0, positive: current >= 0 };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(Math.round(change)), positive: change >= 0 };
}

// ============================================================
// Stat Card Component
// ============================================================
interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trend?: { value: number; positive: boolean };
    color?: 'primary' | 'success' | 'warning' | 'destructive';
    isLoading?: boolean;
    onClick?: () => void;
}

function StatCard({ title, value, icon: Icon, trend, color = 'primary', isLoading, onClick }: StatCardProps) {
    const colorClasses = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        destructive: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    };

    const Wrapper = onClick ? 'button' : 'div';

    return (
        <Card className={cn(onClick && 'cursor-pointer hover:shadow-md transition-shadow')}>
            <Wrapper onClick={onClick} className="w-full text-right">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">{title}</p>
                            {isLoading ? (
                                <div className="h-7 w-16 bg-muted animate-pulse rounded" />
                            ) : (
                                <p className="text-xl font-bold">{value}</p>
                            )}
                            {trend && trend.value > 0 && (
                                <p className={cn(
                                    'text-xs flex items-center gap-1',
                                    trend.positive ? 'text-green-600' : 'text-red-600'
                                )}>
                                    {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {trend.value}%
                                </p>
                            )}
                        </div>
                        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
                            <Icon size={20} />
                        </div>
                    </div>
                </CardContent>
            </Wrapper>
        </Card>
    );
}

// ============================================================
// Technician Card Component
// ============================================================
interface TechnicianData {
    technician_id: string;
    full_name: string;
    avatar_url: string | null;
    status: 'available' | 'busy';
    current_job: { job_id: string; job_code: string; job_status: string } | null;
    hours_today: number;
    completed_today: number;
}

function TechnicianCard({ tech }: { tech: TechnicianData }) {
    const navigate = useNavigate();

    return (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <UserCircle size={24} className="text-primary" />
                    </div>
                    <div className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background',
                        tech.status === 'available' ? 'bg-green-500' : 'bg-amber-500'
                    )} />
                </div>
                <div>
                    <p className="font-medium text-sm">{tech.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                        {tech.status === 'available' ? 'متاح' : 'مشغول'}
                        {tech.current_job && (
                            <span className="mr-1">- {tech.current_job.job_code}</span>
                        )}
                    </p>
                </div>
            </div>
            <div className="text-left">
                <p className="text-sm font-medium">{tech.hours_today.toFixed(1)} س</p>
                <p className="text-xs text-muted-foreground">{tech.completed_today} منجز</p>
            </div>
        </div>
    );
}

// ============================================================
// Urgent Job Card Component
// ============================================================
interface UrgentJob {
    id: string;
    code: string;
    status: string;
    priority: string;
    created_at: string;
    plate_number: string;
    vehicle_name: string;
    customer_name: string;
    customer_phone: string;
    days_paused: number;
    urgency_reason: string;
    technicians: { id: string; name: string }[] | null;
}

function UrgentJobCard({ job, onStatusChange }: { job: UrgentJob; onStatusChange: () => void }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const statusMutation = useMutation({
        mutationFn: async (newStatus: string) => {
            const { error } = await supabase
                .from('job_orders')
                .update({ status: newStatus })
                .eq('id', job.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            onStatusChange();
        },
    });

    const priorityColors: Record<string, string> = {
        urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        normal: 'bg-blue-100 text-blue-700',
        low: 'bg-gray-100 text-gray-700',
    };

    return (
        <div className="p-3 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{job.code}</span>
                    <Badge className={priorityColors[job.priority] || priorityColors.normal} variant="secondary">
                        {job.urgency_reason}
                    </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{getRelativeTime(job.created_at)}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                    <Car size={14} className="text-muted-foreground" />
                    {job.plate_number}
                </span>
                <span className="text-muted-foreground">{job.vehicle_name}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{job.customer_name}</span>
                <div className="flex gap-1">
                    {job.status === 'paused' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => statusMutation.mutate('in_progress')}
                            disabled={statusMutation.isPending}
                        >
                            <Play size={12} className="ml-1" />
                            استئناف
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => navigate(`/dashboard/workshop/${job.id}`)}
                    >
                        <Eye size={12} className="ml-1" />
                        عرض
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Main Dashboard Component
// ============================================================
export function DashboardPage() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Fetch all dashboard data using optimized RPC
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['dashboard', 'today-stats'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_dashboard_today_stats');
            if (error) throw error;
            return data as {
                today_receptions: number;
                yesterday_receptions: number;
                in_progress: number;
                today_completed: number;
                yesterday_completed: number;
                today_revenue: number;
                yesterday_revenue: number;
                today_collected: number;
                total_receivables: number;
                total_payables: number;
                treasury_balance: number;
                active_customers: number;
            };
        },
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Auto refresh every minute
    });

    // Fetch jobs by status
    const { data: jobsByStatus } = useQuery({
        queryKey: ['dashboard', 'jobs-by-status'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_jobs_by_status');
            if (error) throw error;
            return data as { status: string; count: number }[];
        },
        staleTime: 30000,
    });

    // Fetch technicians status
    const { data: technicians } = useQuery({
        queryKey: ['dashboard', 'technicians-status'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_technicians_status');
            if (error) throw error;
            return data as TechnicianData[];
        },
        staleTime: 30000,
    });

    // Fetch urgent jobs
    const { data: urgentJobs, refetch: refetchUrgent } = useQuery({
        queryKey: ['dashboard', 'urgent-jobs'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_urgent_jobs', { p_limit: 5 });
            if (error) throw error;
            return data as UrgentJob[];
        },
        staleTime: 30000,
    });

    // Fetch alerts
    const { data: alerts } = useQuery({
        queryKey: ['dashboard', 'alerts'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_dashboard_alerts');
            if (error) throw error;
            return data as { type: string; category: string; message: string; count: number; link: string | null }[];
        },
        staleTime: 60000,
    });

    // Fetch recent assessments
    const { data: recentAssessments } = useQuery({
        queryKey: ['dashboard', 'recent-assessments'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_recent_assessments', { p_limit: 5 });
            if (error) throw error;
            return data as {
                id: string;
                code: string;
                entry_type: string;
                status: string;
                created_at: string;
                plate_number: string;
                vehicle_name: string;
                customer_name: string;
                has_job_order: boolean;
            }[];
        },
        staleTime: 30000,
    });

    // Status labels and colors
    const statusConfig: Record<string, { label: string; color: string }> = {
        draft: { label: 'مسودة', color: 'bg-gray-500' },
        pending: { label: 'جديد', color: 'bg-blue-500' },
        in_progress: { label: 'قيد العمل', color: 'bg-amber-500' },
        paused: { label: 'متوقف', color: 'bg-red-500' },
        review: { label: 'مراجعة', color: 'bg-purple-500' },
        completed: { label: 'منجز', color: 'bg-green-500' },
        delivered: { label: 'تم التسليم', color: 'bg-teal-500' },
        cancelled: { label: 'ملغي', color: 'bg-gray-400' },
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">
                        مرحباً، {profile?.full_name?.split(' ')[0]} 👋
                    </h1>
                    <p className="text-muted-foreground">إليك ملخص أعمال اليوم</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw size={16} className="ml-2" />
                    تحديث
                </Button>
            </div>

            {/* Main Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard
                    title="استقبال اليوم"
                    value={stats?.today_receptions ?? 0}
                    icon={ClipboardList}
                    color="primary"
                    isLoading={statsLoading}
                    trend={stats ? getPercentChange(stats.today_receptions, stats.yesterday_receptions) : undefined}
                    onClick={() => navigate('/dashboard/reception')}
                />
                <StatCard
                    title="قيد العمل"
                    value={stats?.in_progress ?? 0}
                    icon={Wrench}
                    color="warning"
                    isLoading={statsLoading}
                    onClick={() => navigate('/dashboard/workshop')}
                />
                <StatCard
                    title="منجز اليوم"
                    value={stats?.today_completed ?? 0}
                    icon={CheckCircle2}
                    color="success"
                    isLoading={statsLoading}
                    trend={stats ? getPercentChange(stats.today_completed, stats.yesterday_completed) : undefined}
                />
                <StatCard
                    title="إيرادات اليوم"
                    value={formatCurrency(stats?.today_revenue ?? 0)}
                    icon={Wallet}
                    color="primary"
                    isLoading={statsLoading}
                    trend={stats ? getPercentChange(stats.today_revenue, stats.yesterday_revenue) : undefined}
                    onClick={() => navigate('/dashboard/finance/invoices')}
                />
                <StatCard
                    title="مستحقات العملاء"
                    value={formatCurrency(stats?.total_receivables ?? 0)}
                    icon={CreditCard}
                    color="destructive"
                    isLoading={statsLoading}
                    onClick={() => navigate('/dashboard/customers')}
                />
            </div>

            {/* Second Row - Urgent Jobs & Technicians */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Urgent Jobs */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle size={18} className="text-amber-500" />
                                أوامر تحتاج تدخل
                            </CardTitle>
                            <Badge variant="secondary">{urgentJobs?.length || 0}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                        {!urgentJobs?.length ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <CheckCircle2 size={40} className="mx-auto mb-2 text-green-500" />
                                <p>لا توجد أوامر عاجلة</p>
                            </div>
                        ) : (
                            urgentJobs.map((job) => (
                                <UrgentJobCard
                                    key={job.id}
                                    job={job}
                                    onStatusChange={() => refetchUrgent()}
                                />
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Technicians Status */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users size={18} className="text-primary" />
                                حالة الفنيين
                            </CardTitle>
                            <Badge variant="secondary">
                                {technicians?.filter(t => t.status === 'available').length || 0} متاح
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {!technicians?.length ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users size={40} className="mx-auto mb-2 opacity-50" />
                                <p>لا يوجد فنيون</p>
                            </div>
                        ) : (
                            technicians.map((tech) => (
                                <TechnicianCard key={tech.technician_id} tech={tech} />
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Third Row - Chart & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Job status chart */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">توزيع أوامر الشغل</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between gap-2 h-32">
                            {(jobsByStatus || []).map((item) => {
                                const config = statusConfig[item.status] || { label: item.status, color: 'bg-gray-500' };
                                const maxCount = Math.max(...(jobsByStatus || []).map(j => j.count), 1);
                                return (
                                    <div key={item.status} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className={cn('w-full rounded-t-lg transition-all', config.color)}
                                            style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: item.count > 0 ? '8px' : '2px' }}
                                        />
                                        <div className="text-center">
                                            <p className="text-lg font-bold">{item.count}</p>
                                            <p className="text-xs text-muted-foreground">{config.label}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Alerts */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            تنبيهات
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {(alerts || []).map((alert, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    'p-3 rounded-lg text-sm cursor-pointer hover:opacity-80 transition-opacity',
                                    alert.type === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                    alert.type === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                    alert.type === 'info' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                    alert.type === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                )}
                                onClick={() => alert.link && navigate(alert.link)}
                            >
                                {alert.message}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Fourth Row - Recent & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent assessments */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">آخر تقارير الدخول</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/reception')}>
                                عرض الكل
                                <ArrowLeft size={14} className="mr-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {(recentAssessments || []).map((assessment) => (
                            <div
                                key={assessment.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => navigate(`/dashboard/reception/${assessment.id}`)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Car size={20} className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{assessment.vehicle_name || 'غير محدد'}</p>
                                        <p className="text-xs text-muted-foreground">{assessment.plate_number}</p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <span className="text-xs text-muted-foreground">{getRelativeTime(assessment.created_at)}</span>
                                    {assessment.has_job_order && (
                                        <Badge variant="secondary" className="mr-2 text-xs">تم الإنشاء</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Quick actions */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
                        <CardDescription>الوصول السريع للمهام الشائعة</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto p-4"
                                onClick={() => navigate('/dashboard/reception/new')}
                            >
                                <ClipboardList size={24} className="text-primary" />
                                <span className="text-xs font-medium">استلام سيارة</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto p-4"
                                onClick={() => navigate('/dashboard/workshop')}
                            >
                                <Wrench size={24} className="text-amber-500" />
                                <span className="text-xs font-medium">أوامر الشغل</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto p-4"
                                onClick={() => navigate('/dashboard/customers/new')}
                            >
                                <UserPlus size={24} className="text-green-500" />
                                <span className="text-xs font-medium">عميل جديد</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto p-4"
                                onClick={() => navigate('/dashboard/finance/payments')}
                            >
                                <Receipt size={24} className="text-blue-500" />
                                <span className="text-xs font-medium">تسجيل دفعة</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto p-4"
                                onClick={() => navigate('/dashboard/inventory')}
                            >
                                <Package size={24} className="text-purple-500" />
                                <span className="text-xs font-medium">المخزون</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto p-4"
                                onClick={() => navigate('/dashboard/finance/invoices')}
                            >
                                <CreditCard size={24} className="text-teal-500" />
                                <span className="text-xs font-medium">الفواتير</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Financial Summary and Low Stock Alerts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Financial Summary - Takes 2 columns on large screens */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Wallet size={18} className="text-primary" />
                            الملخص المالي
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">المُحصل اليوم</p>
                                <p className="text-xl font-bold text-green-600">{formatCurrency(stats?.today_collected ?? 0)}</p>
                            </div>
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">رصيد الخزينة</p>
                                <p className="text-xl font-bold text-blue-600">{formatCurrency(stats?.treasury_balance ?? 0)}</p>
                            </div>
                            <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">مستحقات العملاء</p>
                                <p className="text-xl font-bold text-amber-600">{formatCurrency(stats?.total_receivables ?? 0)}</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">مستحقات الموردين</p>
                                <p className="text-xl font-bold text-red-600">{formatCurrency(stats?.total_payables ?? 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Low Stock Alerts - Takes 1 column on large screens */}
                <LowStockAlertsCard limit={5} />
            </div>
        </div>
    );
}

export default DashboardPage;
