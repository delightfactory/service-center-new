import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileText, BarChart3, TrendingUp, TrendingDown, Calendar,
    Users, Car, Package, DollarSign, Loader2, Download,
    Wrench, Clock, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToExcel } from '@/lib/utils/export';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================
type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year';

// ============================================================
// Reports Page - صفحة التقارير الشاملة
// ============================================================
export default function ReportsPage() {
    const [dateRange, setDateRange] = useState<DateRange>('month');
    const [activeTab, setActiveTab] = useState('overview');

    // Calculate date range
    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        const start = new Date();

        switch (dateRange) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start.setMonth(start.getMonth() - 1);
                break;
            case 'quarter':
                start.setMonth(start.getMonth() - 3);
                break;
            case 'year':
                start.setFullYear(start.getFullYear() - 1);
                break;
        }

        return {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
        };
    }, [dateRange]);

    // Fetch overview stats
    const { data: overviewStats, isLoading: loadingOverview } = useQuery({
        queryKey: ['report-overview', startDate, endDate],
        queryFn: async () => {
            const [jobsRes, invoicesRes, customersRes, paymentsRes] = await Promise.all([
                supabase
                    .from('job_orders')
                    .select('id, status, actual_cost', { count: 'exact' })
                    .gte('created_at', startDate)
                    .lte('created_at', endDate),
                supabase
                    .from('invoices')
                    .select('id, invoice_type, total_amount, paid_amount, status')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate),
                supabase
                    .from('customers')
                    .select('id', { count: 'exact' })
                    .gte('created_at', startDate)
                    .lte('created_at', endDate),
                supabase
                    .from('payments')
                    .select('id, amount, payment_type')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate),
            ]);

            const jobs = jobsRes.data || [];
            const invoices = invoicesRes.data || [];
            const payments = paymentsRes.data || [];

            const salesInvoices = invoices.filter(i => i.invoice_type === 'sales');
            const totalSales = salesInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
            const totalCollected = payments
                .filter(p => p.payment_type === 'customer_receipt')
                .reduce((sum, p) => sum + (p.amount || 0), 0);

            return {
                totalJobs: jobs.length,
                completedJobs: jobs.filter(j => j.status === 'completed' || j.status === 'delivered').length,
                pendingJobs: jobs.filter(j => j.status === 'pending').length,
                newCustomers: customersRes.count || 0,
                totalSales,
                totalCollected,
                totalInvoices: invoices.length,
                unpaidInvoices: salesInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length,
            };
        },
    });

    // Fetch job status distribution
    const { data: jobsByStatus = [] } = useQuery({
        queryKey: ['report-jobs-status', startDate, endDate],
        queryFn: async () => {
            const { data } = await supabase
                .from('job_orders')
                .select('status')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const counts: Record<string, number> = {};
            (data || []).forEach(job => {
                counts[job.status] = (counts[job.status] || 0) + 1;
            });

            return Object.entries(counts).map(([status, count]) => ({ status, count }));
        },
    });

    // Fetch top customers
    const { data: topCustomers = [] } = useQuery({
        queryKey: ['report-top-customers', startDate, endDate],
        queryFn: async () => {
            const { data } = await supabase
                .from('invoices')
                .select(`
                    customer_id,
                    total_amount,
                    customer:customers!inner(id, name, code)
                `)
                .eq('invoice_type', 'sales')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const customerTotals: Record<string, { name: string; code: string; total: number; count: number }> = {};

            (data || []).forEach((inv: any) => {
                const customer = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
                if (customer) {
                    if (!customerTotals[customer.id]) {
                        customerTotals[customer.id] = { name: customer.name, code: customer.code, total: 0, count: 0 };
                    }
                    customerTotals[customer.id].total += inv.total_amount || 0;
                    customerTotals[customer.id].count += 1;
                }
            });

            return Object.values(customerTotals)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
        },
    });

    // Fetch inventory alerts
    const { data: inventoryAlerts = [] } = useQuery({
        queryKey: ['report-inventory-alerts'],
        queryFn: async () => {
            const { data } = await supabase
                .from('inventory_items')
                .select(`
                    id, quantity, reserved_quantity,
                    product:products!inner(id, name, code, min_stock, unit)
                `)
                .gt('product.min_stock', 0);

            return (data || [])
                .map((item: any) => {
                    const product = Array.isArray(item.product) ? item.product[0] : item.product;
                    const available = item.quantity - item.reserved_quantity;
                    return {
                        ...item,
                        product,
                        available,
                        isLow: available < (product?.min_stock || 0),
                    };
                })
                .filter(item => item.isLow)
                .slice(0, 10);
        },
    });

    // Fetch technician performance
    const { data: techPerformance = [] } = useQuery({
        queryKey: ['report-tech-performance', startDate, endDate],
        queryFn: async () => {
            const { data } = await supabase
                .from('job_time_logs')
                .select(`
                    technician_id,
                    duration_minutes,
                    technician:profiles!inner(id, full_name)
                `)
                .not('clock_out', 'is', null)
                .gte('clock_in', startDate)
                .lte('clock_in', endDate);

            const techStats: Record<string, { name: string; totalHours: number; jobCount: number }> = {};

            (data || []).forEach((log: any) => {
                const tech = Array.isArray(log.technician) ? log.technician[0] : log.technician;
                if (tech) {
                    if (!techStats[tech.id]) {
                        techStats[tech.id] = { name: tech.full_name, totalHours: 0, jobCount: 0 };
                    }
                    techStats[tech.id].totalHours += (log.duration_minutes || 0) / 60;
                    techStats[tech.id].jobCount += 1;
                }
            });

            return Object.values(techStats)
                .sort((a, b) => b.totalHours - a.totalHours)
                .slice(0, 10);
        },
    });

    const statusLabels: Record<string, string> = {
        pending: 'في الانتظار',
        in_progress: 'قيد العمل',
        review: 'مراجعة',
        completed: 'مكتمل',
        delivered: 'تم التسليم',
        cancelled: 'ملغي',
    };

    const dateRangeLabels: Record<DateRange, string> = {
        today: 'اليوم',
        week: 'آخر أسبوع',
        month: 'آخر شهر',
        quarter: 'آخر 3 أشهر',
        year: 'آخر سنة',
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="التقارير"
                description="تقارير شاملة عن أداء المركز والعمليات"
            />

            {/* Date Range Selector */}
            <div className="flex items-center gap-4">
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                    <SelectTrigger className="w-[200px]">
                        <Calendar className="h-4 w-4 ml-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(dateRangeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Badge variant="outline" className="text-muted-foreground">
                    {new Date(startDate).toLocaleDateString('ar-EG')} - {new Date(endDate).toLocaleDateString('ar-EG')}
                </Badge>
            </div>

            {/* Overview Stats */}
            {loadingOverview ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">إجمالي أوامر الشغل</p>
                                    <p className="text-2xl font-bold">{overviewStats?.totalJobs}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {overviewStats?.completedJobs} مكتمل
                                    </p>
                                </div>
                                <Wrench className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                                    <p className="text-2xl font-bold">{overviewStats?.totalSales?.toLocaleString('ar-EG')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">ج.م</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">إجمالي التحصيل</p>
                                    <p className="text-2xl font-bold">{overviewStats?.totalCollected?.toLocaleString('ar-EG')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">ج.م</p>
                                </div>
                                <DollarSign className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">عملاء جدد</p>
                                    <p className="text-2xl font-bold">{overviewStats?.newCustomers}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {overviewStats?.unpaidInvoices} فاتورة غير مسددة
                                    </p>
                                </div>
                                <Users className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                    <TabsList className="grid w-auto grid-cols-4">
                        <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                        <TabsTrigger value="customers">العملاء</TabsTrigger>
                        <TabsTrigger value="technicians">الفنيين</TabsTrigger>
                        <TabsTrigger value="inventory">المخزون</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                                let data: any[] = [];
                                let headers: { key: string; label: string }[] = [];
                                let filename = 'report';

                                if (activeTab === 'customers' && topCustomers.length > 0) {
                                    data = topCustomers;
                                    headers = [
                                        { key: 'name', label: 'العميل' },
                                        { key: 'code', label: 'الكود' },
                                        { key: 'count', label: 'عدد الفواتير' },
                                        { key: 'total', label: 'إجمالي المبيعات' },
                                    ];
                                    filename = 'customers_report';
                                } else if (activeTab === 'technicians' && techPerformance.length > 0) {
                                    data = techPerformance.map(t => ({
                                        name: t.name,
                                        jobCount: t.jobCount,
                                        totalHours: t.totalHours.toFixed(1),
                                    }));
                                    headers = [
                                        { key: 'name', label: 'الفني' },
                                        { key: 'jobCount', label: 'عدد المهام' },
                                        { key: 'totalHours', label: 'ساعات العمل' },
                                    ];
                                    filename = 'technicians_report';
                                } else if (activeTab === 'inventory' && inventoryAlerts.length > 0) {
                                    data = inventoryAlerts.map((item: any) => ({
                                        name: item.product?.name,
                                        code: item.product?.code,
                                        available: item.available,
                                        minStock: item.product?.min_stock,
                                        shortage: item.product?.min_stock - item.available,
                                    }));
                                    headers = [
                                        { key: 'name', label: 'المنتج' },
                                        { key: 'code', label: 'الكود' },
                                        { key: 'available', label: 'الكمية المتاحة' },
                                        { key: 'minStock', label: 'الحد الأدنى' },
                                        { key: 'shortage', label: 'النقص' },
                                    ];
                                    filename = 'inventory_alerts';
                                } else {
                                    toast.error('لا توجد بيانات للتصدير');
                                    return;
                                }

                                exportToCSV(data, filename, headers);
                                toast.success('تم التصدير بنجاح');
                            }}
                        >
                            <Download className="h-4 w-4" />
                            تصدير CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                                let data: any[] = [];
                                let headers: { key: string; label: string }[] = [];
                                let filename = 'report';
                                let title = 'تقرير';

                                if (activeTab === 'customers' && topCustomers.length > 0) {
                                    data = topCustomers;
                                    headers = [
                                        { key: 'name', label: 'العميل' },
                                        { key: 'code', label: 'الكود' },
                                        { key: 'count', label: 'عدد الفواتير' },
                                        { key: 'total', label: 'إجمالي المبيعات' },
                                    ];
                                    filename = 'customers_report';
                                    title = 'تقرير أفضل العملاء';
                                } else if (activeTab === 'technicians' && techPerformance.length > 0) {
                                    data = techPerformance.map(t => ({
                                        name: t.name,
                                        jobCount: t.jobCount,
                                        totalHours: t.totalHours.toFixed(1),
                                    }));
                                    headers = [
                                        { key: 'name', label: 'الفني' },
                                        { key: 'jobCount', label: 'عدد المهام' },
                                        { key: 'totalHours', label: 'ساعات العمل' },
                                    ];
                                    filename = 'technicians_report';
                                    title = 'تقرير أداء الفنيين';
                                } else if (activeTab === 'inventory' && inventoryAlerts.length > 0) {
                                    data = inventoryAlerts.map((item: any) => ({
                                        name: item.product?.name,
                                        code: item.product?.code,
                                        available: item.available,
                                        minStock: item.product?.min_stock,
                                        shortage: item.product?.min_stock - item.available,
                                    }));
                                    headers = [
                                        { key: 'name', label: 'المنتج' },
                                        { key: 'code', label: 'الكود' },
                                        { key: 'available', label: 'الكمية المتاحة' },
                                        { key: 'minStock', label: 'الحد الأدنى' },
                                        { key: 'shortage', label: 'النقص' },
                                    ];
                                    filename = 'inventory_alerts';
                                    title = 'تقرير تنبيهات المخزون';
                                } else {
                                    toast.error('لا توجد بيانات للتصدير');
                                    return;
                                }

                                exportToExcel(data, filename, headers, title);
                                toast.success('تم التصدير بنجاح');
                            }}
                        >
                            <Download className="h-4 w-4" />
                            تصدير Excel
                        </Button>
                    </div>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">توزيع حالات أوامر الشغل</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {jobsByStatus.map(item => (
                                    <div key={item.status} className="flex items-center gap-4">
                                        <div className="w-32 text-sm">
                                            {statusLabels[item.status] || item.status}
                                        </div>
                                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full",
                                                    item.status === 'completed' || item.status === 'delivered' ? 'bg-green-500' :
                                                        item.status === 'in_progress' ? 'bg-blue-500' :
                                                            item.status === 'cancelled' ? 'bg-red-500' :
                                                                'bg-yellow-500'
                                                )}
                                                style={{
                                                    width: `${Math.min(100, (item.count / (overviewStats?.totalJobs || 1)) * 100)}%`
                                                }}
                                            />
                                        </div>
                                        <div className="w-12 text-left text-sm font-medium">
                                            {item.count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">أفضل 10 عملاء</CardTitle>
                            <CardDescription>حسب إجمالي المبيعات</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>العميل</TableHead>
                                        <TableHead className="text-center">عدد الفواتير</TableHead>
                                        <TableHead className="text-left">إجمالي المبيعات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topCustomers.map((customer, index) => (
                                        <TableRow key={customer.code}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{customer.name}</p>
                                                    <p className="text-xs text-muted-foreground">{customer.code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">{customer.count}</TableCell>
                                            <TableCell className="text-left font-medium">
                                                {customer.total.toLocaleString('ar-EG')} ج.م
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {topCustomers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                لا توجد بيانات للفترة المحددة
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Technicians Tab */}
                <TabsContent value="technicians" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">أداء الفنيين</CardTitle>
                            <CardDescription>حسب ساعات العمل المسجلة</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>الفني</TableHead>
                                        <TableHead className="text-center">عدد المهام</TableHead>
                                        <TableHead className="text-left">ساعات العمل</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {techPerformance.map((tech, index) => (
                                        <TableRow key={tech.name + index}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{tech.name}</TableCell>
                                            <TableCell className="text-center">{tech.jobCount}</TableCell>
                                            <TableCell className="text-left">
                                                <Badge variant="outline">
                                                    <Clock className="h-3 w-3 ml-1" />
                                                    {tech.totalHours.toFixed(1)} ساعة
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {techPerformance.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                لا توجد بيانات للفترة المحددة
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Inventory Tab */}
                <TabsContent value="inventory" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-warning" />
                                تنبيهات المخزون
                            </CardTitle>
                            <CardDescription>أصناف تحت الحد الأدنى</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المنتج</TableHead>
                                        <TableHead className="text-center">الكمية المتاحة</TableHead>
                                        <TableHead className="text-center">الحد الأدنى</TableHead>
                                        <TableHead className="text-center">النقص</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventoryAlerts.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{item.product?.name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.available} {item.product?.unit}
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground">
                                                {item.product?.min_stock}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="destructive">
                                                    -{(item.product?.min_stock - item.available)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {inventoryAlerts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-green-600 py-8">
                                                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                جميع الأصناف متوفرة
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
