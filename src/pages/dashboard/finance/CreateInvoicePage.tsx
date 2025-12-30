import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowRight, Plus, Trash2, Calculator, Save, FileText, Percent, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
    TableFooter,
} from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================================
// Create Invoice Page - إنشاء فاتورة
// ============================================================

interface JobOrder {
    id: string;
    code: string;
    status: string;
    customer: { id: string; name: string; phone: string } | null;
    vehicle: { id: string; plate_number: string; model: string } | null;
}

interface JobItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    total_price: number;
    product: { id: string; name: string; code: string } | null;
}

interface InvoiceItem {
    id: string;
    job_item_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    total: number;
}

export function CreateInvoicePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const [searchParams] = useSearchParams();
    const jobOrderId = searchParams.get('job_order_id');

    // Invoice state
    const [invoiceType, setInvoiceType] = useState<'sales' | 'purchase' | 'sales_return' | 'purchase_return'>('sales');
    const [customerId, setCustomerId] = useState('');
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [taxRate, setTaxRate] = useState('15');
    const [discountAmount, setDiscountAmount] = useState('0');
    const [notes, setNotes] = useState('');

    // Fetch job order if provided
    const { data: jobOrder, isLoading: isLoadingJob } = useQuery({
        queryKey: ['job-order-for-invoice', jobOrderId],
        queryFn: async () => {
            if (!jobOrderId) return null;

            const { data, error } = await supabase
                .from('job_orders')
                .select(`
                    id, code, status,
                    customer:customers (id, name, phone),
                    vehicle:vehicles (id, plate_number, model)
                `)
                .eq('id', jobOrderId)
                .single();
            if (error) throw error;

            // Set customer if found
            if (data?.customer) {
                const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
                setCustomerId(customer?.id || '');
            }

            return {
                ...data,
                customer: Array.isArray(data.customer) ? data.customer[0] : data.customer,
                vehicle: Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle,
            } as JobOrder;
        },
        enabled: !!jobOrderId,
    });

    // Check if invoice already exists for this job order
    const { data: existingInvoice } = useQuery({
        queryKey: ['existing-invoice-check', jobOrderId],
        queryFn: async () => {
            if (!jobOrderId) return null;

            const { data, error } = await supabase
                .from('invoices')
                .select('id, code, status')
                .eq('job_order_id', jobOrderId)
                .neq('status', 'cancelled')
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
        enabled: !!jobOrderId,
    });

    // Fetch job items
    const { data: jobItems, isLoading: isLoadingItems } = useQuery({
        queryKey: ['job-items-for-invoice', jobOrderId],
        queryFn: async () => {
            if (!jobOrderId) return [];

            const { data, error } = await supabase
                .from('job_items')
                .select(`
                    id, description, quantity, unit_price, discount_percent, total_price,
                    product:products (id, name, code)
                `)
                .eq('job_order_id', jobOrderId);
            if (error) throw error;

            // Convert to invoice items
            const invoiceItems: InvoiceItem[] = (data || []).map(item => {
                const product = Array.isArray(item.product) ? item.product[0] : item.product;
                const discountAmount = (item.quantity * item.unit_price * (item.discount_percent / 100));
                return {
                    id: crypto.randomUUID(),
                    job_item_id: item.id,
                    description: product?.name || item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: discountAmount,
                    total: item.total_price,
                };
            });

            setItems(invoiceItems);
            return (data || []).map(item => ({
                ...item,
                product: Array.isArray(item.product) ? item.product[0] : item.product,
            })) as JobItem[];
        },
        enabled: !!jobOrderId,
    });

    // Add empty item
    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            job_item_id: null,
            description: '',
            quantity: 1,
            unit_price: 0,
            discount: 0,
            total: 0,
        }]);
    };

    // Update item
    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(item => {
            if (item.id !== id) return item;

            const updated = { ...item, [field]: value };

            // Recalculate total
            if (['quantity', 'unit_price', 'discount'].includes(field)) {
                const subtotal = updated.quantity * updated.unit_price;
                updated.total = subtotal - updated.discount;
            }

            return updated;
        }));
    };

    // Remove item
    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    // Calculate totals
    const totals = React.useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const discount = parseFloat(discountAmount) || 0;
        const afterDiscount = subtotal - discount;
        const tax = afterDiscount * (parseFloat(taxRate) / 100);
        const total = afterDiscount + tax;

        return { subtotal, discount, tax, total };
    }, [items, discountAmount, taxRate]);

    // Create invoice mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (items.length === 0) {
                throw new Error('يجب إضافة بند واحد على الأقل');
            }

            // Create invoice
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    invoice_type: invoiceType,
                    customer_id: customerId || null,
                    job_order_id: jobOrderId || null,
                    branch_id: profile?.branch_id || null,
                    subtotal: totals.subtotal,
                    discount_amount: totals.discount,
                    tax_amount: totals.tax,
                    total_amount: totals.total,
                    paid_amount: 0,
                    notes: notes || null,
                    status: 'draft',
                })
                .select('id')
                .single();

            if (invoiceError) throw invoiceError;

            // Create invoice items
            if (items.length > 0) {
                const invoiceItems = items.map((item, index) => ({
                    invoice_id: invoice.id,
                    job_item_id: item.job_item_id || null,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount_amount: item.discount,
                    sort_order: index,
                }));

                const { error: itemsError } = await supabase
                    .from('invoice_items')
                    .insert(invoiceItems);

                if (itemsError) throw itemsError;
            }

            return invoice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            alert('تم إنشاء الفاتورة بنجاح');
            navigate('/dashboard/finance/invoices');
        },
        onError: (error: Error) => {
            console.error('Error creating invoice:', error);
            alert(error.message || 'فشل إنشاء الفاتورة');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate();
    };

    if (jobOrderId && (isLoadingJob || isLoadingItems)) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-40" />
                <Skeleton className="h-60" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowRight size={20} />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">إنشاء فاتورة</h1>
                    {jobOrder && (
                        <p className="text-muted-foreground">
                            من أمر الشغل: {jobOrder.code}
                        </p>
                    )}
                </div>
            </div>

            {/* Warning if job order not completed */}
            {jobOrder && !['completed', 'review'].includes(jobOrder.status) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-yellow-800">تحذير: أمر الشغل غير مكتمل</p>
                        <p className="text-sm text-yellow-700">
                            حالة أمر الشغل الحالية: <strong>{jobOrder.status === 'in_progress' ? 'قيد التنفيذ' :
                                jobOrder.status === 'pending' ? 'في الانتظار' :
                                    jobOrder.status === 'paused' ? 'متوقف مؤقتاً' : jobOrder.status}</strong>.
                            يُفضل إكمال أمر الشغل قبل إنشاء الفاتورة.
                        </p>
                    </div>
                </div>
            )}

            {/* Error: Invoice already exists */}
            {existingInvoice && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <p className="font-medium text-red-800">⚠️ توجد فاتورة مسبقة لأمر الشغل هذا</p>
                        <p className="text-sm text-red-700 mt-1">
                            الفاتورة: <strong>{existingInvoice.code}</strong> -
                            الحالة: <strong>{existingInvoice.status === 'draft' ? 'مسودة' :
                                existingInvoice.status === 'approved' ? 'معتمدة' :
                                    existingInvoice.status === 'paid' ? 'مدفوعة' : existingInvoice.status}</strong>
                        </p>
                        <div className="mt-3">
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => navigate(`/dashboard/finance/invoices/${existingInvoice.id}`)}
                            >
                                عرض الفاتورة الموجودة
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Invoice Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText size={20} />
                            بيانات الفاتورة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>نوع الفاتورة</Label>
                                <Select
                                    value={invoiceType}
                                    onValueChange={(v) => setInvoiceType(v as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sales">مبيعات</SelectItem>
                                        <SelectItem value="purchase">مشتريات</SelectItem>
                                        <SelectItem value="sales_return">مرتجع مبيعات</SelectItem>
                                        <SelectItem value="purchase_return">مرتجع مشتريات</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {jobOrder && (
                                <>
                                    <div className="space-y-2">
                                        <Label>العميل</Label>
                                        <Input
                                            value={jobOrder.customer?.name || 'غير محدد'}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>السيارة</Label>
                                        <Input
                                            value={jobOrder.vehicle ?
                                                `${jobOrder.vehicle.plate_number} - ${jobOrder.vehicle.model}` :
                                                'غير محدد'}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice Items */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">البنود</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
                                <Plus size={16} />
                                إضافة بند
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                لا توجد بنود - أضف بند للفاتورة
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[300px]">الوصف</TableHead>
                                            <TableHead className="w-20">الكمية</TableHead>
                                            <TableHead className="w-28">السعر</TableHead>
                                            <TableHead className="w-24">الخصم</TableHead>
                                            <TableHead className="w-28 text-left">الإجمالي</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <Input
                                                        value={item.description}
                                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                        placeholder="وصف البند..."
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                        dir="ltr"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.unit_price}
                                                        onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                        dir="ltr"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.discount}
                                                        onChange={(e) => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                                                        dir="ltr"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-semibold">
                                                    {formatCurrency(item.total)}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeItem(item.id)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">ملاحظات</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="ملاحظات على الفاتورة..."
                                rows={4}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calculator size={20} />
                                الإجماليات
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">المجموع الفرعي</span>
                                <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground flex-1">الخصم</span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discountAmount}
                                    onChange={(e) => setDiscountAmount(e.target.value)}
                                    className="w-28"
                                    dir="ltr"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground flex-1">الضريبة %</span>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={taxRate}
                                    onChange={(e) => setTaxRate(e.target.value)}
                                    className="w-20"
                                    dir="ltr"
                                />
                                <span className="font-mono text-sm">= {formatCurrency(totals.tax)}</span>
                            </div>

                            <hr />

                            <div className="flex justify-between text-lg font-bold">
                                <span>الإجمالي</span>
                                <span className="text-primary font-mono">{formatCurrency(totals.total)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                        إلغاء
                    </Button>
                    <Button
                        type="submit"
                        disabled={createMutation.isPending || items.length === 0 || !!existingInvoice}
                        className="gap-2"
                    >
                        {createMutation.isPending ? 'جاري الحفظ...' : (
                            <>
                                <Save size={18} />
                                حفظ الفاتورة
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CreateInvoicePage;
