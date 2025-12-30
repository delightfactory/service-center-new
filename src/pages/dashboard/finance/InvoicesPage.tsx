import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
    Plus, Search, FileText, Filter, MoreVertical,
    Eye, Printer, CheckCircle2, XCircle, DollarSign,
    TrendingUp, Clock, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PaymentModal } from '@/components/finance';
import { PageHeader, EmptyState } from '@/components/shared';
import { useRealtime } from '@/hooks';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

// ============================================================
// Invoices Page - صفحة الفواتير
// ============================================================

type InvoiceStatus = 'draft' | 'approved' | 'partially_paid' | 'paid' | 'cancelled';
type InvoiceType = 'sales' | 'sales_return' | 'purchase' | 'purchase_return';

interface Invoice {
    id: string;
    code: string;
    invoice_type: InvoiceType;
    status: InvoiceStatus;
    customer: { id: string; name: string } | null;
    supplier: { id: string; name: string } | null;
    job_order: { id: string; code: string } | null;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    due_date: string | null;
    created_at: string;
}

const invoiceTypeConfig: Record<InvoiceType, { label: string; color: string }> = {
    sales: { label: 'مبيعات', color: 'bg-green-100 text-green-700' },
    sales_return: { label: 'مرتجع مبيعات', color: 'bg-orange-100 text-orange-700' },
    purchase: { label: 'مشتريات', color: 'bg-blue-100 text-blue-700' },
    purchase_return: { label: 'مرتجع مشتريات', color: 'bg-purple-100 text-purple-700' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
    approved: { label: 'معتمدة', color: 'bg-blue-100 text-blue-700' },
    partial: { label: 'مدفوعة جزئياً', color: 'bg-amber-100 text-amber-700' },
    partially_paid: { label: 'مدفوعة جزئياً', color: 'bg-amber-100 text-amber-700' },
    paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-700' },
};

// Default fallback for unknown statuses
const getStatusConfig = (status: string) => statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-700' };

export function InvoicesPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Payment modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<{
        id: string;
        code: string;
        total_amount: number;
        paid_amount: number;
        remaining_amount: number;
        customer_id?: string;
        customer_name?: string;
    } | null>(null);

    // Fetch invoices
    const { data: invoices, isLoading } = useQuery({
        queryKey: ['invoices', searchQuery, typeFilter, statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('invoices')
                .select(`
                    id, code, invoice_type, status,
                    subtotal, discount_amount, tax_amount,
                    total_amount, paid_amount, remaining_amount,
                    due_date, created_at,
                    customer:customers (id, name),
                    supplier:suppliers (id, name),
                    job_order:job_orders (id, code)
                `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (typeFilter !== 'all') {
                query = query.eq('invoice_type', typeFilter);
            }
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            let items = (data || []).map(inv => ({
                ...inv,
                customer: Array.isArray(inv.customer) ? inv.customer[0] : inv.customer,
                supplier: Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier,
                job_order: Array.isArray(inv.job_order) ? inv.job_order[0] : inv.job_order,
            })) as Invoice[];

            // Apply search filter
            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                items = items.filter(inv =>
                    inv.code?.toLowerCase().includes(search) ||
                    inv.customer?.name?.toLowerCase().includes(search) ||
                    inv.supplier?.name?.toLowerCase().includes(search)
                );
            }

            return items;
        },
    });

    // Real-time updates - use base queryKey for broader invalidation
    useRealtime({
        table: 'invoices',
        queryKey: ['invoices'],
    });
    useRealtime({
        table: 'payments',
        queryKey: ['invoices'],
    });

    // Calculate stats
    const stats = React.useMemo(() => {
        if (!invoices) return { total: 0, totalSales: 0, unpaid: 0, overdue: 0 };

        const salesInvoices = invoices.filter(i => i.invoice_type === 'sales');
        const totalSales = salesInvoices.reduce((sum, i) => sum + i.total_amount, 0);
        const unpaid = invoices.filter(i => i.remaining_amount > 0 && i.status !== 'cancelled').length;
        const today = new Date().toISOString().split('T')[0];
        const overdue = invoices.filter(i =>
            i.due_date && i.due_date < today && i.remaining_amount > 0
        ).length;

        return {
            total: invoices.length,
            totalSales,
            unpaid,
            overdue,
        };
    }, [invoices]);

    // Approve invoice mutation
    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('invoices')
                .update({ status: 'approved' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (error: Error) => {
            console.error('Error approving invoice:', error);
            alert(error.message || 'فشل اعتماد الفاتورة');
        },
    });

    // Cancel invoice mutation
    const cancelMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('invoices')
                .update({ status: 'cancelled' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (error: Error) => {
            console.error('Error cancelling invoice:', error);
            alert(error.message || 'فشل إلغاء الفاتورة');
        },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="الفواتير"
                description="إدارة فواتير المبيعات والمشتريات"
                actions={
                    <Button className="gap-2" onClick={() => navigate('/dashboard/finance/invoices/new')}>
                        <Plus size={18} />
                        فاتورة جديدة
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <TrendingUp size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
                                <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn(stats.unpaid > 0 && 'border-amber-200 bg-amber-50/50')}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                stats.unpaid > 0 ? 'bg-amber-100' : 'bg-gray-100'
                            )}>
                                <Clock size={20} className={stats.unpaid > 0 ? 'text-amber-600' : 'text-gray-400'} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.unpaid}</p>
                                <p className="text-xs text-muted-foreground">غير مدفوعة</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn(stats.overdue > 0 && 'border-red-200 bg-red-50/50')}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                stats.overdue > 0 ? 'bg-red-100' : 'bg-gray-100'
                            )}>
                                <AlertCircle size={20} className={stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.overdue}</p>
                                <p className="text-xs text-muted-foreground">متأخرة</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                placeholder="البحث بالكود أو اسم العميل..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="النوع" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأنواع</SelectItem>
                                <SelectItem value="sales">مبيعات</SelectItem>
                                <SelectItem value="sales_return">مرتجع مبيعات</SelectItem>
                                <SelectItem value="purchase">مشتريات</SelectItem>
                                <SelectItem value="purchase_return">مرتجع مشتريات</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                <SelectItem value="draft">مسودة</SelectItem>
                                <SelectItem value="approved">معتمدة</SelectItem>
                                <SelectItem value="partially_paid">مدفوعة جزئياً</SelectItem>
                                <SelectItem value="paid">مدفوعة</SelectItem>
                                <SelectItem value="cancelled">ملغاة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Invoices Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign size={20} />
                        قائمة الفواتير
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : !invoices || invoices.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="لا توجد فواتير"
                            description="لم يتم العثور على فواتير مطابقة للبحث"
                            action={
                                <Button onClick={() => navigate('/dashboard/finance/invoices/new')}>
                                    <Plus size={18} className="ml-2" />
                                    إنشاء فاتورة جديدة
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الكود</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>العميل/المورد</TableHead>
                                        <TableHead>أمر الشغل</TableHead>
                                        <TableHead className="text-left">الإجمالي</TableHead>
                                        <TableHead className="text-left">المدفوع</TableHead>
                                        <TableHead className="text-left">المتبقي</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>التاريخ</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.map((invoice) => {
                                        const typeConfig = invoiceTypeConfig[invoice.invoice_type];
                                        const status = getStatusConfig(invoice.status);
                                        const partyName = invoice.customer?.name || invoice.supplier?.name || '-';

                                        return (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-mono text-sm font-semibold">
                                                    {invoice.code}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={typeConfig.color}>
                                                        {typeConfig.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {partyName}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm text-muted-foreground">
                                                    {invoice.job_order?.code || '-'}
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-semibold">
                                                    {formatCurrency(invoice.total_amount)}
                                                </TableCell>
                                                <TableCell className="text-left font-mono text-green-600">
                                                    {formatCurrency(invoice.paid_amount)}
                                                </TableCell>
                                                <TableCell className={cn(
                                                    'text-left font-mono',
                                                    invoice.remaining_amount > 0 && 'text-red-600 font-semibold'
                                                )}>
                                                    {formatCurrency(invoice.remaining_amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={status.color}>
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(invoice.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {/* View button - always visible */}
                                                        <Link
                                                            to={`/dashboard/finance/invoices/${invoice.id}`}
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                                            title="عرض"
                                                        >
                                                            <Eye size={15} />
                                                        </Link>

                                                        {/* Approve button - only for draft */}
                                                        {invoice.status === 'draft' && (
                                                            <button
                                                                onClick={() => approveMutation.mutate(invoice.id)}
                                                                disabled={approveMutation.isPending}
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-50"
                                                                title="اعتماد"
                                                            >
                                                                <CheckCircle2 size={15} />
                                                            </button>
                                                        )}

                                                        {/* Payment button - if has remaining and not cancelled */}
                                                        {invoice.remaining_amount > 0 && invoice.status !== 'cancelled' && invoice.status !== 'draft' && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedInvoice({
                                                                        id: invoice.id,
                                                                        code: invoice.code,
                                                                        total_amount: invoice.total_amount,
                                                                        paid_amount: invoice.paid_amount,
                                                                        remaining_amount: invoice.remaining_amount,
                                                                        customer_id: invoice.customer?.id,
                                                                        customer_name: invoice.customer?.name,
                                                                    });
                                                                    setShowPaymentModal(true);
                                                                }}
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                                                                title="دفعة"
                                                            >
                                                                <DollarSign size={15} />
                                                            </button>
                                                        )}

                                                        {/* Cancel button - only for draft */}
                                                        {invoice.status === 'draft' && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) {
                                                                        cancelMutation.mutate(invoice.id);
                                                                    }
                                                                }}
                                                                disabled={cancelMutation.isPending}
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                                                                title="إلغاء"
                                                            >
                                                                <XCircle size={15} />
                                                            </button>
                                                        )}

                                                        {/* Print button */}
                                                        <button
                                                            onClick={() => window.print()}
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                                                            title="طباعة"
                                                        >
                                                            <Printer size={15} />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payment Modal */}
            <PaymentModal
                open={showPaymentModal}
                onOpenChange={setShowPaymentModal}
                invoice={selectedInvoice}
            />
        </div>
    );
}

export default InvoicesPage;

