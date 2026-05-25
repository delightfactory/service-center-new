import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    Plus, Search, Package, Building2, FileText,
    Check, X, Clock, Eye, MoreVertical, Calendar,
    TrendingUp, Truck
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/shared';
import {
    SupplierSearchSelect,
    ProductSearchSelect,
    type InvoiceSupplierOption,
    type InvoiceProductOption,
} from '@/components/finance';
import { useRealtime } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { IfCanCreate, IfCanApprove, IfCanDelete } from '@/components/auth';

// ============================================================
// Purchases Page - فواتير المشتريات
// ============================================================

interface PurchaseItem {
    product_id: string;
    product_name: string;
    product_code: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface Invoice {
    id: string;
    code: string;
    invoice_type: string;
    status: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    created_at: string;
    supplier: { id: string; name: string } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
    approved: { label: 'معتمدة', color: 'bg-green-100 text-green-700' },
    paid: { label: 'مدفوعة', color: 'bg-blue-100 text-blue-700' },
    partial: { label: 'مدفوعة جزئياً', color: 'bg-amber-100 text-amber-700' },
    cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-700' },
};

export function PurchasesPage() {
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const branchId = profile?.branch_id || null;
    const [showDialog, setShowDialog] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [supplierId, setSupplierId] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<InvoiceSupplierOption | null>(null);
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [discount, setDiscount] = useState('0');
    const [notes, setNotes] = useState('');

    // Add item state
    const [selectedProduct, setSelectedProduct] = useState<InvoiceProductOption | null>(null);
    const [itemQuantity, setItemQuantity] = useState('1');
    const [itemPrice, setItemPrice] = useState('');

    // Fetch purchase invoices
    const { data: invoices, isLoading } = useQuery({
        queryKey: ['purchase-invoices', statusFilter, branchId],
        queryFn: async () => {
            let query = supabase
                .from('invoices')
                .select(`
                    id, code, invoice_type, status,
                    subtotal, discount_amount, tax_amount,
                    total_amount, paid_amount, created_at,
                    supplier:suppliers (id, name)
                `)
                .eq('invoice_type', 'purchase')
                .order('created_at', { ascending: false })
                .limit(100);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(inv => ({
                ...inv,
                supplier: Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier,
            })) as Invoice[];
        },
    });

    // Real-time updates
    useRealtime({
        table: 'invoices',
        filter: "invoice_type=eq.purchase",
        queryKey: ['purchase-invoices'],
    });

    // Calculate stats
    const stats = React.useMemo(() => {
        if (!invoices) return { total: 0, pending: 0, totalAmount: 0, unpaid: 0 };
        return {
            total: invoices.length,
            pending: invoices.filter(i => i.status === 'draft').length,
            totalAmount: invoices
                .filter(i => i.status !== 'cancelled')
                .reduce((sum, i) => sum + i.total_amount, 0),
            unpaid: invoices
                .filter(i => ['approved', 'partial'].includes(i.status))
                .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0),
        };
    }, [invoices]);

    // Calculate totals
    const totals = React.useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const discountAmount = parseFloat(discount) || 0;
        const total = subtotal - discountAmount;
        return { subtotal, discountAmount, total };
    }, [items, discount]);

    // Add item to list
    const handleAddItem = () => {
        const product = selectedProduct;
        if (!product) return;

        const qty = parseFloat(itemQuantity) || 1;
        const price = parseFloat(itemPrice) || 0;

        const existingIndex = items.findIndex(i => i.product_id === product.id);
        if (existingIndex >= 0) {
            // Update existing
            const updated = [...items];
            updated[existingIndex].quantity += qty;
            updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
            setItems(updated);
        } else {
            // Add new
            setItems([...items, {
                product_id: product.id,
                product_name: product.name,
                product_code: product.code || '',
                quantity: qty,
                unit_price: price,
                total: qty * price,
            }]);
        }

        setSelectedProduct(null);
        setItemQuantity('1');
        setItemPrice('');
    };

    // Remove item
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // Create purchase mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!supplierId) throw new Error('يرجى اختيار المورد');
            if (items.length === 0) throw new Error('يرجى إضافة أصناف');

            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user?.id)
                .single();

            // Create invoice
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    invoice_type: 'purchase',
                    status: 'draft',
                    supplier_id: supplierId,
                    subtotal: totals.subtotal,
                    discount_amount: totals.discountAmount,
                    tax_amount: 0,
                    total_amount: totals.total,
                    paid_amount: 0,
                    notes: notes || null,
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                })
                .select()
                .single();
            if (invoiceError) throw invoiceError;

            // Create invoice items (total_price is a generated column, so don't include it)
            const invoiceItems = items.map(item => ({
                invoice_id: invoice.id,
                product_id: item.product_id,
                description: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
            }));

            const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(invoiceItems);
            if (itemsError) throw itemsError;

            return invoice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
            handleCloseDialog();
        },
        onError: (error: Error) => {
            console.error('Create error:', error);
            alert(error.message || 'فشل إنشاء الفاتورة');
        },
    });

    // Approve invoice mutation
    const approveMutation = useMutation({
        mutationFn: async (invoiceId: string) => {
            const { error } = await supabase
                .from('invoices')
                .update({ status: 'approved' })
                .eq('id', invoiceId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
        onError: (error: Error) => {
            console.error('Approve error:', error);
            alert(error.message || 'فشل اعتماد الفاتورة');
        },
    });

    const handleCloseDialog = () => {
        setShowDialog(false);
        setSupplierId('');
        setSelectedSupplier(null);
        setItems([]);
        setDiscount('0');
        setNotes('');
        setSelectedProduct(null);
        setItemQuantity('1');
        setItemPrice('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate();
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    title="فواتير المشتريات"
                    description="إدارة مشتريات الأصناف من الموردين"
                    actions={
                        <Button className="gap-2" onClick={() => setShowDialog(true)}>
                            <Plus size={18} />
                            فاتورة شراء جديدة
                        </Button>
                    }
                />

                {/* Stats */}
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
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <Clock size={20} className="text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.pending}</p>
                                    <p className="text-xs text-muted-foreground">في انتظار الاعتماد</p>
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
                                    <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={cn(stats.unpaid > 0 && 'border-red-200 bg-red-50/50')}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    stats.unpaid > 0 ? 'bg-red-100' : 'bg-gray-100'
                                )}>
                                    <Truck size={20} className={stats.unpaid > 0 ? 'text-red-600' : 'text-gray-400'} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{formatCurrency(stats.unpaid)}</p>
                                    <p className="text-xs text-muted-foreground">مستحقات للموردين</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={statusFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('all')}
                            >
                                الكل
                            </Button>
                            <Button
                                variant={statusFilter === 'draft' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('draft')}
                            >
                                مسودة
                            </Button>
                            <Button
                                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('approved')}
                            >
                                معتمدة
                            </Button>
                            <Button
                                variant={statusFilter === 'paid' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('paid')}
                            >
                                مدفوعة
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoices Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>قائمة الفواتير</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : invoices && invoices.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>رقم الفاتورة</TableHead>
                                            <TableHead>المورد</TableHead>
                                            <TableHead>المبلغ</TableHead>
                                            <TableHead>المدفوع</TableHead>
                                            <TableHead>الحالة</TableHead>
                                            <TableHead>التاريخ</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.map((invoice) => (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {invoice.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Building2 size={16} className="text-muted-foreground" />
                                                        {invoice.supplier?.name || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {formatCurrency(invoice.total_amount)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatCurrency(invoice.paid_amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={statusConfig[invoice.status]?.color}>
                                                        {statusConfig[invoice.status]?.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {formatDate(invoice.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {/* View button - always visible */}
                                                        <Link
                                                            to={`/dashboard/finance/invoices/${invoice.id}`}
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                                            title="عرض التفاصيل"
                                                        >
                                                            <Eye size={15} />
                                                        </Link>

                                                        {/* Approve button - only for draft */}
                                                        {invoice.status === 'draft' && (
                                                            <IfCanApprove resource="purchases">
                                                                <button
                                                                    onClick={() => approveMutation.mutate(invoice.id)}
                                                                    disabled={approveMutation.isPending}
                                                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-50"
                                                                    title="اعتماد وإضافة للمخزون"
                                                                >
                                                                    <Check size={15} />
                                                                </button>
                                                            </IfCanApprove>
                                                        )}

                                                        {/* Cancel button - only for draft */}
                                                        {invoice.status === 'draft' && (
                                                            <IfCanDelete resource="purchases">
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) {
                                                                            // TODO: add cancel mutation
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                                                                    title="إلغاء"
                                                                >
                                                                    <X size={15} />
                                                                </button>
                                                            </IfCanDelete>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="لا توجد فواتير مشتريات"
                                description="ابدأ بإنشاء أول فاتورة شراء"
                                action={
                                    <IfCanCreate resource="purchases">
                                        <Button onClick={() => setShowDialog(true)}>
                                            <Plus size={18} className="ml-2" />
                                            فاتورة شراء جديدة
                                        </Button>
                                    </IfCanCreate>
                                }
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create Purchase Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package size={20} />
                            فاتورة شراء جديدة
                        </DialogTitle>
                        <DialogDescription>
                            أدخل بيانات فاتورة الشراء
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Supplier */}
                        <div className="space-y-2">
                            <Label>المورد *</Label>
                            <SupplierSearchSelect
                                value={supplierId}
                                selected={selectedSupplier}
                                onSelect={(supplier) => {
                                    setSelectedSupplier(supplier);
                                    setSupplierId(supplier?.id || '');
                                }}
                            />
                        </div>

                        {/* Add Item */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">إضافة صنف</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label className="text-xs text-muted-foreground">الصنف</Label>
                                        <ProductSearchSelect
                                            selectedLabel={selectedProduct?.name}
                                            selectedCode={selectedProduct?.code}
                                            excludeServices
                                            onSelect={(product) => {
                                                setSelectedProduct(product);
                                                setItemPrice(product?.purchase_price?.toString() || '');
                                            }}
                                        />
                                        {selectedProduct && (
                                            <p className="text-[11px] text-muted-foreground">
                                                اضغط على الصنف لتغييره أو على علامة الإزالة لمسحه
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">الكمية</Label>
                                        <Input
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            value={itemQuantity}
                                            onChange={(e) => setItemQuantity(e.target.value)}
                                            placeholder="الكمية"
                                            className="min-w-0"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">السعر</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={itemPrice}
                                            onChange={(e) => setItemPrice(e.target.value)}
                                            placeholder="السعر"
                                            className="min-w-0"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddItem}
                                    disabled={!selectedProduct}
                                    className="w-full"
                                >
                                    <Plus size={16} className="ml-1" />
                                    إضافة
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Items List */}
                        {items.length > 0 && (
                            <Card>
                                <CardContent className="p-0">
                                    <div className="space-y-2 p-3 md:hidden">
                                        {items.map((item, index) => (
                                            <div key={index} className="rounded-lg border bg-background p-3 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">{item.product_name}</div>
                                                        {item.product_code && (
                                                            <div className="text-xs text-muted-foreground">{item.product_code}</div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-destructive"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <X size={16} />
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 text-sm">
                                                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                                                        <div className="text-xs text-muted-foreground">الكمية</div>
                                                        <div className="font-medium">{item.quantity}</div>
                                                    </div>
                                                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                                                        <div className="text-xs text-muted-foreground">السعر</div>
                                                        <div className="font-medium">{formatCurrency(item.unit_price)}</div>
                                                    </div>
                                                    <div className="rounded-md bg-primary/10 px-2 py-1.5">
                                                        <div className="text-xs text-muted-foreground">الإجمالي</div>
                                                        <div className="font-semibold text-primary">{formatCurrency(item.total)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الصنف</TableHead>
                                                <TableHead>الكمية</TableHead>
                                                <TableHead>السعر</TableHead>
                                                <TableHead>الإجمالي</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <div>
                                                            <span className="font-medium">{item.product_name}</span>
                                                            <span className="text-xs text-muted-foreground mr-2">
                                                                ({item.product_code})
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{item.quantity}</TableCell>
                                                    <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                                                    <TableCell className="font-medium">
                                                        {formatCurrency(item.total)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive"
                                                            onClick={() => handleRemoveItem(index)}
                                                        >
                                                            <X size={16} />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Totals */}
                        {items.length > 0 && (
                            <Card>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between">
                                        <span>الإجمالي الفرعي:</span>
                                        <span>{formatCurrency(totals.subtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>الخصم:</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={discount}
                                            onChange={(e) => setDiscount(e.target.value)}
                                            className="w-32"
                                        />
                                    </div>
                                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                                        <span>الإجمالي:</span>
                                        <span>{formatCurrency(totals.total)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="ملاحظات إضافية..."
                                rows={2}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseDialog}
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || items.length === 0}
                            >
                                {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default PurchasesPage;
