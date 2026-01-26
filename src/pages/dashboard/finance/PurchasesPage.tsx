import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useRealtime } from '@/hooks';

// ============================================================
// Purchases Page - فواتير المشتريات
// ============================================================

interface Supplier {
    id: string;
    name: string;
    code: string;
}

interface Product {
    id: string;
    code: string;
    name: string;
}

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
    const [showDialog, setShowDialog] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [supplierId, setSupplierId] = useState('');
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [discount, setDiscount] = useState('0');
    const [notes, setNotes] = useState('');

    // Add item state
    const [selectedProductId, setSelectedProductId] = useState('');
    const [itemQuantity, setItemQuantity] = useState('1');
    const [itemPrice, setItemPrice] = useState('');

    // Fetch suppliers
    const { data: suppliers } = useQuery({
        queryKey: ['suppliers-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name, code')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data as Supplier[];
        },
    });

    // Fetch products
    const { data: products } = useQuery({
        queryKey: ['products-for-purchase'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, code, name')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data as Product[];
        },
    });

    // Fetch purchase invoices
    const { data: invoices, isLoading } = useQuery({
        queryKey: ['purchase-invoices', statusFilter],
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
        const product = products?.find(p => p.id === selectedProductId);
        if (!product) return;

        const qty = parseFloat(itemQuantity) || 1;
        const price = parseFloat(itemPrice) || 0;

        const existingIndex = items.findIndex(i => i.product_id === selectedProductId);
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
                product_code: product.code,
                quantity: qty,
                unit_price: price,
                total: qty * price,
            }]);
        }

        setSelectedProductId('');
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
            // Get invoice
            const { data: invoice } = await supabase
                .from('invoices')
                .select('*, invoice_items(*)')
                .eq('id', invoiceId)
                .single();

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // Update invoice status
            const { error: updateError } = await supabase
                .from('invoices')
                .update({ status: 'approved' })
                .eq('id', invoiceId);
            if (updateError) throw updateError;

            // Add inventory for each item
            const { data: defaultWarehouse } = await supabase
                .from('warehouses')
                .select('id')
                .eq('is_default', true)
                .single();

            for (const item of invoice.invoice_items) {
                if (!item.product_id) continue;

                // Get or create inventory item
                const { data: existingItem, error: existingItemError } = await supabase
                    .from('inventory_items')
                    .select('quantity')
                    .eq('product_id', item.product_id)
                    .eq('warehouse_id', defaultWarehouse?.id)
                    .maybeSingle();

                if (existingItemError) throw existingItemError;

                const currentQty = existingItem?.quantity || 0;

                // Create inventory transaction (التريجر سيحدث المخزون تلقائياً)
                const { error: txError } = await supabase
                    .from('inventory_transactions')
                    .insert({
                        product_id: item.product_id,
                        warehouse_id: defaultWarehouse?.id,
                        transaction_type: 'purchase',
                        quantity: item.quantity,
                        balance_before: currentQty,
                        balance_after: currentQty + item.quantity,
                        reference_type: 'invoice',
                        reference_id: invoiceId,
                        notes: `شراء - فاتورة ${invoice.code}`,
                        created_by: user?.id,
                    });
                if (txError) throw txError;
            }
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
        setItems([]);
        setDiscount('0');
        setNotes('');
        setSelectedProductId('');
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
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical size={16} />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start">
                                                            <DropdownMenuItem className="gap-2">
                                                                <Eye size={16} />
                                                                عرض التفاصيل
                                                            </DropdownMenuItem>
                                                            {invoice.status === 'draft' && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        className="gap-2 text-green-600"
                                                                        onClick={() => approveMutation.mutate(invoice.id)}
                                                                    >
                                                                        <Check size={16} />
                                                                        اعتماد وإضافة للمخزون
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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
                                    <Button onClick={() => setShowDialog(true)}>
                                        <Plus size={18} className="ml-2" />
                                        فاتورة شراء جديدة
                                    </Button>
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
                            <Select value={supplierId} onValueChange={setSupplierId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر المورد" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers?.map((supplier) => (
                                        <SelectItem key={supplier.id} value={supplier.id}>
                                            {supplier.name} ({supplier.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Add Item */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">إضافة صنف</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="col-span-2">
                                        <Select value={selectedProductId} onValueChange={(v) => {
                                            setSelectedProductId(v);
                                        }}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر المنتج" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products?.map((product) => (
                                                    <SelectItem key={product.id} value={product.id}>
                                                        {product.name} ({product.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        value={itemQuantity}
                                        onChange={(e) => setItemQuantity(e.target.value)}
                                        placeholder="الكمية"
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={itemPrice}
                                        onChange={(e) => setItemPrice(e.target.value)}
                                        placeholder="السعر"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddItem}
                                    disabled={!selectedProductId}
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
