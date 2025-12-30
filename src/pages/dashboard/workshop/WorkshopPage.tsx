import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Search, Plus, Car, User, Clock, Wrench, AlertCircle,
    CheckCircle2, ChevronLeft, Filter, Fuel, Gauge
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PageHeader, EmptyState } from '@/components/shared';
import { useRealtime } from '@/hooks';
import { cn, formatDate } from '@/lib/utils';
import type { AssessmentStatus, EntryType } from '@/types/enums';

// ============================================================
// Workshop Page - Vehicle-Centric View
// ============================================================
// يعرض السيارات (Assessments) بدلاً من Job Orders
// النقر على الكارت يفتح تفاصيل الاستقبال
// ============================================================

interface VehicleAssessment {
    id: string;
    code: string;
    entry_type: EntryType;
    status: AssessmentStatus;
    customer_complaint: string | null;
    fuel_level: number | null;
    mileage_in: number | null;
    created_at: string;
    customer: {
        id: string;
        name: string;
        phone: string | null;
    };
    vehicle?: {
        id: string;
        plate_number: string;
        make: string | null;
        model: string | null;
        year: number | null;
        color: string | null;
    } | null;
    job_orders_count?: number;
}

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
    pending: {
        label: 'في الانتظار',
        color: 'text-yellow-700 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        icon: Clock
    },
    received: {
        label: 'تم الاستلام',
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        icon: CheckCircle2
    },
    in_workshop: {
        label: 'قيد العمل',
        color: 'text-green-700 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        icon: Wrench
    },
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
    vehicle: 'سيارة',
    bench_work: 'كنترول',
    quick_check: 'كشف سريع',
};

export function WorkshopPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<AssessmentStatus | 'all'>('all');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch assessments (vehicles in workshop)
    const { data: assessments, isLoading, error } = useQuery({
        queryKey: ['workshop-vehicles', debouncedSearch, statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('assessments')
                .select(`
          id, code, entry_type, status, customer_complaint,
          fuel_level, mileage_in, created_at,
          customer:customers (id, name, phone),
          vehicle:vehicles (id, plate_number, make, model, year, color)
        `)
                .order('created_at', { ascending: false })
                .limit(50);

            // Filter by status
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            } else {
                // بشكل افتراضي لا نعرض الحالات المنتهية (delivered/received)
                // نعرض فقط pending و in_workshop
                query = query.in('status', ['pending', 'in_workshop']);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data.map(a => ({
                ...a,
                customer: Array.isArray(a.customer) ? a.customer[0] : a.customer,
                vehicle: Array.isArray(a.vehicle) ? a.vehicle[0] : a.vehicle,
            })) as VehicleAssessment[];
        },
    });

    // Real-time updates
    useRealtime({
        table: 'assessments',
        queryKey: ['workshop-vehicles', debouncedSearch, statusFilter],
    });

    // Filter by search locally
    const filteredAssessments = assessments?.filter((a) => {
        if (!debouncedSearch) return true;
        const search = debouncedSearch.toLowerCase();
        return (
            a.code?.toLowerCase().includes(search) ||
            a.customer?.name?.toLowerCase().includes(search) ||
            a.customer?.phone?.includes(search) ||
            a.vehicle?.plate_number?.toLowerCase().includes(search) ||
            a.vehicle?.make?.toLowerCase().includes(search)
        );
    }) || [];

    // Count by status - فقط الحالات النشطة
    const statusCounts = {
        pending: assessments?.filter(a => a.status === 'pending').length || 0,
        in_workshop: assessments?.filter(a => a.status === 'in_workshop').length || 0,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="ساحة العمل"
                description="السيارات في الورشة حسب حالتها"
                actions={
                    <Button onClick={() => navigate('/dashboard/reception/new')} className="gap-2">
                        <Plus size={18} />
                        استلام جديد
                    </Button>
                }
            />

            {/* Status Cards - الحالات النشطة فقط */}
            <div className="grid grid-cols-2 gap-4">
                {(['pending', 'in_workshop'] as ('pending' | 'in_workshop')[]).map((status) => {
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;
                    const count = statusCounts[status];
                    const isActive = statusFilter === status;

                    return (
                        <Card
                            key={status}
                            className={cn(
                                "cursor-pointer transition-all hover:shadow-md",
                                isActive && "ring-2 ring-primary"
                            )}
                            onClick={() => setStatusFilter(isActive ? 'all' : status)}
                        >
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={cn("p-3 rounded-xl", config.bgColor)}>
                                    <Icon size={24} className={config.color} />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold">{count}</p>
                                    <p className="text-xs text-muted-foreground">{config.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Search & Filter */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="بحث بالكود، اسم العميل، رقم اللوحة..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => setStatusFilter(val as AssessmentStatus | 'all')}
                        >
                            <SelectTrigger className="w-full sm:w-48">
                                <Filter size={16} className="ml-2" />
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع الحالات</SelectItem>
                                <SelectItem value="pending">في الانتظار</SelectItem>
                                <SelectItem value="in_workshop">قيد العمل</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Vehicles Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-16 h-16 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="w-32 h-5" />
                                        <Skeleton className="w-24 h-4" />
                                        <Skeleton className="w-20 h-4" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <AlertCircle size={48} className="mx-auto text-destructive mb-4" />
                        <p className="text-destructive">حدث خطأ أثناء تحميل البيانات</p>
                    </CardContent>
                </Card>
            ) : filteredAssessments.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Car size={64} className="mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">لا توجد سيارات</h3>
                        <p className="text-muted-foreground mb-4">
                            {statusFilter !== 'all'
                                ? 'لا توجد سيارات بهذه الحالة'
                                : 'ابدأ باستلام سيارة جديدة'}
                        </p>
                        <Button onClick={() => navigate('/dashboard/reception/new')} className="gap-2">
                            <Plus size={18} />
                            استلام جديد
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAssessments.map((assessment) => {
                        const statusConfig = STATUS_CONFIG[assessment.status];
                        const StatusIcon = statusConfig.icon;

                        return (
                            <Card
                                key={assessment.id}
                                className="cursor-pointer hover:shadow-lg transition-all group border-2 hover:border-primary/50"
                                onClick={() => navigate(`/dashboard/reception/${assessment.id}`)}
                            >
                                <CardContent className="p-0">
                                    {/* Status Header */}
                                    <div className={cn("px-4 py-2 flex items-center justify-between", statusConfig.bgColor)}>
                                        <div className="flex items-center gap-2">
                                            <StatusIcon size={16} className={statusConfig.color} />
                                            <span className={cn("text-sm font-medium", statusConfig.color)}>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs bg-white/80 dark:bg-gray-900/80">
                                            {ENTRY_TYPE_LABELS[assessment.entry_type]}
                                        </Badge>
                                    </div>

                                    {/* Main Content */}
                                    <div className="p-4">
                                        {/* Vehicle Info */}
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                                <Car size={28} className="text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {assessment.vehicle ? (
                                                    <>
                                                        <p className="font-bold text-lg truncate">
                                                            {assessment.vehicle.plate_number}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {assessment.vehicle.make} {assessment.vehicle.model}
                                                            {assessment.vehicle.year && ` ${assessment.vehicle.year}`}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-bold text-lg">كنترول/قطعة</p>
                                                        <p className="text-sm text-muted-foreground">بدون سيارة</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Customer */}
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                            <User size={14} />
                                            <span className="truncate">{assessment.customer?.name}</span>
                                        </div>

                                        {/* Complaint Preview */}
                                        {assessment.customer_complaint && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 bg-muted/50 p-2 rounded-lg">
                                                {assessment.customer_complaint}
                                            </p>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-3 border-t">
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {assessment.mileage_in && (
                                                    <span className="flex items-center gap-1">
                                                        <Gauge size={12} />
                                                        {assessment.mileage_in.toLocaleString()}
                                                    </span>
                                                )}
                                                {assessment.fuel_level !== null && (
                                                    <span className="flex items-center gap-1">
                                                        <Fuel size={12} />
                                                        {assessment.fuel_level}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
                                                عرض
                                                <ChevronLeft size={16} />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default WorkshopPage;
