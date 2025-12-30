import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
    Plus, Search, Filter, Car, User, Clock,
    ChevronLeft, AlertCircle, CheckCircle2, Wrench,
    Eye, FileText
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { assessmentService } from '@/lib/services/operations/assessment.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PageHeader, EmptyState } from '@/components/shared';
import { useRealtime } from '@/hooks';
import type { AssessmentStatus, EntryType } from '@/types/enums';

// ============================================================
// Reception List Page
// ============================================================
// Displays all assessments (reception entries) with filtering
// and ability to create job orders from them
// ============================================================

interface Assessment {
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
    } | null;
}

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
    received: { label: 'تم الاستلام', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2 },
    in_workshop: { label: 'في الورشة', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Wrench },
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
    vehicle: 'سيارة كاملة',
    bench_work: 'كنترول/قطعة',
    quick_check: 'كشف سريع',
};

export function ReceptionListPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<AssessmentStatus | 'all'>('all');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch assessments
    const { data: assessmentsData, isLoading, error } = useQuery({
        queryKey: ['assessments', debouncedSearch, statusFilter],
        queryFn: async () => {
            const filters: { status?: AssessmentStatus } = {};
            if (statusFilter !== 'all') {
                filters.status = statusFilter;
            }
            return assessmentService.getAssessments({ page: 1, pageSize: 50 }, filters);
        },
    });

    // Real-time updates
    useRealtime({
        table: 'assessments',
        queryKey: ['assessments', debouncedSearch, statusFilter],
    });

    const assessments = assessmentsData?.data || [];

    // Filter by search locally
    const filteredAssessments = assessments.filter((assessment) => {
        if (!debouncedSearch) return true;
        const search = debouncedSearch.toLowerCase();
        return (
            assessment.code?.toLowerCase().includes(search) ||
            assessment.customer?.name?.toLowerCase().includes(search) ||
            assessment.customer?.phone?.includes(search) ||
            assessment.vehicle?.plate_number?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="الاستقبال"
                description="إدارة طلبات الاستلام وتقارير الدخول"
                actions={
                    <Button onClick={() => navigate('/dashboard/reception/new')} className="gap-2">
                        <Plus size={18} />
                        استلام جديد
                    </Button>
                }
            />

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="بحث بالكود، اسم العميل، رقم اللوحة..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>

                        {/* Status Filter */}
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => setStatusFilter(val as AssessmentStatus | 'all')}
                        >
                            <SelectTrigger className="w-full sm:w-48">
                                <Filter size={16} className="ml-2" />
                                <SelectValue placeholder="فلترة حسب الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع الحالات</SelectItem>
                                <SelectItem value="pending">قيد الانتظار</SelectItem>
                                <SelectItem value="received">تم الاستلام</SelectItem>
                                <SelectItem value="in_workshop">في الورشة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(['pending', 'received', 'in_workshop'] as AssessmentStatus[]).map((status) => {
                    const config = STATUS_CONFIG[status];
                    const count = assessments.filter(a => a.status === status).length;
                    const Icon = config.icon;
                    return (
                        <Card
                            key={status}
                            className={cn(
                                "cursor-pointer transition-all hover:shadow-md",
                                statusFilter === status && "ring-2 ring-primary"
                            )}
                            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                        >
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", config.color)}>
                                    <Icon size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{count}</p>
                                    <p className="text-xs text-muted-foreground">{config.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Assessments List */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="w-32 h-4" />
                                        <Skeleton className="w-48 h-3" />
                                    </div>
                                    <Skeleton className="w-20 h-6 rounded-full" />
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
                    <CardContent className="p-8 text-center">
                        <Car size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">لا توجد طلبات استقبال</p>
                        <Button
                            onClick={() => navigate('/dashboard/reception/new')}
                            className="mt-4 gap-2"
                        >
                            <Plus size={18} />
                            استلام جديد
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredAssessments.map((assessment) => {
                        const statusConfig = STATUS_CONFIG[assessment.status];
                        const StatusIcon = statusConfig.icon;

                        return (
                            <Card
                                key={assessment.id}
                                className="hover:shadow-md transition-all cursor-pointer"
                                onClick={() => navigate(`/dashboard/reception/${assessment.id}`)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Car size={24} className="text-primary" />
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-lg">{assessment.code}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {ENTRY_TYPE_LABELS[assessment.entry_type]}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1">
                                                    <User size={14} />
                                                    {assessment.customer?.name}
                                                </span>
                                                {assessment.vehicle && (
                                                    <span className="flex items-center gap-1">
                                                        <Car size={14} />
                                                        {assessment.vehicle.plate_number}
                                                    </span>
                                                )}
                                            </div>

                                            {assessment.customer_complaint && (
                                                <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                                                    {assessment.customer_complaint}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                <Clock size={12} />
                                                {formatDate(assessment.created_at)}
                                            </div>
                                        </div>

                                        {/* Status & Actions */}
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <Badge className={cn("gap-1", statusConfig.color)}>
                                                <StatusIcon size={12} />
                                                {statusConfig.label}
                                            </Badge>
                                            <Button variant="ghost" size="sm" className="gap-1">
                                                <Eye size={14} />
                                                عرض
                                                <ChevronLeft size={14} />
                                            </Button>
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

export default ReceptionListPage;
