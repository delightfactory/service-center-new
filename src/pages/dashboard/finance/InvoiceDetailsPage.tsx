import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
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
    FileText, ArrowRight, User, Truck, Printer, Plus, Receipt,
    Calendar, CheckCircle, Banknote, CreditCard, Building, Wallet
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { InvoicePrintTemplate } from '@/components/print';
import { PageHeader } from '@/components/shared';

// ============================================================
// Invoice Details Page - صفحة تفاصيل الفاتورة
// ============================================================

type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'online';

interface Invoice {
    id: string;
    code: string;
    invoice_type: string;
    customer_id: string | null;
    supplier_id: string | null;
    job_order_id: string | null;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    due_date: string | null;
    notes: string | null;
    created_at: string;
    customer?: { id: string; name: string; phone: string };
    supplier?: { id: string; name: string };
    job_order?: { id: string; code: string };
}

interface Payment {
    id: string;
    code: string;
    payment_type: string;
    payment_method: string;
    amount: number;
    payment_date: string;
    reference: string | null;
    notes: string | null;
    treasury?: { name: string };
}

interface Treasury {
    id: string;
    name: string;
    balance: number;
}

interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    total_price: number;
}

const invoiceTypeLabels: Record<string, string> = {
    sales: 'فاتورة مبيعات',
    purchase: 'فاتورة مشتريات',
    sales_return: 'مرتجع مبيعات',
    purchase_return: 'مرتجع مشتريات',
};

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-blue-100 text-blue-800',
    partial: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمدة',
    partial: 'مدفوعة جزئياً',
    paid: 'مدفوعة بالكامل',
    overdue: 'متأخرة',
    cancelled: 'ملغاة',
};

const paymentMethodLabels: Record<string, { label: string; icon: React.ElementType }> = {
    cash: { label: 'نقدي', icon: Banknote },
    card: { label: 'بطاقة', icon: CreditCard },
    bank_transfer: { label: 'تحويل بنكي', icon: Building },
    cheque: { label: 'شيك', icon: FileText },
    online: { label: 'إلكتروني', icon: Wallet },
};

export function InvoiceDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('details');
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Payment form state
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [paymentTreasuryId, setPaymentTreasuryId] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    // Fetch invoice
    const { data: invoice, isLoading } = useQuery({
        queryKey: ['invoice', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select(`
                    *,
                    customer:customers(id, name, phone),
                    supplier:suppliers(id, name),
                    job_order:job_orders(id, code)
                `)
                .eq('id', id)
                .single();
            if (error) throw error;
            return {
                ...data,
                customer: Array.isArray(data.customer) ? data.customer[0] : data.customer,
                supplier: Array.isArray(data.supplier) ? data.supplier[0] : data.supplier,
                job_order: Array.isArray(data.job_order) ? data.job_order[0] : data.job_order,
            } as Invoice;
        },
        enabled: !!id,
    });

    // Print handler - after invoice is defined
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `فاتورة-${invoice?.code || ''}`,
    });

    // Fetch payments for this invoice
    const { data: payments } = useQuery({
        queryKey: ['invoice-payments', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    id, code, payment_type, payment_method, amount, payment_date, reference, notes,
                    treasury:treasuries(name)
                `)
                .eq('invoice_id', id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(p => ({
                ...p,
                treasury: Array.isArray(p.treasury) ? p.treasury[0] : p.treasury,
            })) as Payment[];
        },
        enabled: !!id,
    });

    // Fetch invoice items
    const { data: invoiceItems } = useQuery({
        queryKey: ['invoice-items', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoice_items')
                .select('id, description, quantity, unit_price, discount_amount, total_price')
                .eq('invoice_id', id)
                .order('sort_order');
            if (error) throw error;
            return data as InvoiceItem[];
        },
        enabled: !!id,
    });

    // Fetch treasuries for payment
    const { data: treasuries } = useQuery({
        queryKey: ['treasuries-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('treasuries')
                .select('id, name, balance')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data as Treasury[];
        },
    });

    // Add payment mutation
    const addPaymentMutation = useMutation({
        mutationFn: async () => {
            const amountNum = parseFloat(paymentAmount);
            if (!amountNum || amountNum <= 0) throw new Error('يرجى إدخال مبلغ صحيح');
            if (!paymentTreasuryId) throw new Error('يرجى اختيار الخزينة');
            if (amountNum > (invoice?.remaining_amount || 0)) {
                throw new Error('المبلغ أكبر من المستحق');
            }

            // Get user branch
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('يرجى تسجيل الدخول');

            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user.id)
                .single();

            if (!profile?.branch_id) throw new Error('لا يوجد فرع محدد');

            const isCustomerInvoice = invoice?.invoice_type === 'sales' || invoice?.invoice_type === 'sales_return';

            const { error } = await supabase
                .from('payments')
                .insert({
                    payment_type: isCustomerInvoice ? 'customer_receipt' : 'supplier_payment',
                    payment_method: paymentMethod,
                    amount: amountNum,
                    treasury_id: paymentTreasuryId,
                    invoice_id: id,
                    customer_id: invoice?.customer_id,
                    supplier_id: invoice?.supplier_id,
                    notes: paymentNotes || null,
                    branch_id: profile.branch_id,
                    created_by: user.id,
                });
            if (error) throw error;

            // Update invoice paid_amount
            const newPaidAmount = (invoice?.paid_amount || 0) + amountNum;
            const newStatus = newPaidAmount >= (invoice?.total_amount || 0) ? 'paid' : 'partial';

            await supabase
                .from('invoices')
                .update({ paid_amount: newPaidAmount, status: newStatus })
                .eq('id', id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
            queryClient.invalidateQueries({ queryKey: ['invoice-payments', id] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            setShowPaymentDialog(false);
            setPaymentAmount('');
            setPaymentNotes('');
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل إضافة الدفعة');
        },
    });

    // Open payment dialog
    const openPaymentDialog = () => {
        setPaymentAmount(invoice?.remaining_amount?.toString() || '');
        setShowPaymentDialog(true);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-muted-foreground">الفاتورة غير موجودة</h2>
                <Button variant="link" onClick={() => navigate('/dashboard/finance/invoices')}>
                    العودة للفواتير
                </Button>
            </div>
        );
    }

    const partyName = invoice.customer?.name || invoice.supplier?.name || '-';
    const partyType = invoice.customer ? 'عميل' : 'مورد';
    const canAddPayment = invoice.remaining_amount > 0 && invoice.status !== 'cancelled';

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={invoice.code}
                description={invoiceTypeLabels[invoice.invoice_type] || invoice.invoice_type}
                backLink="/dashboard/finance/invoices"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handlePrint()}>
                            <Printer size={16} className="ml-2" />
                            طباعة
                        </Button>
                        {canAddPayment && (
                            <Button onClick={openPaymentDialog}>
                                <Plus size={16} className="ml-2" />
                                استلام دفعة
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">{partyType}</p>
                        <p className="text-lg font-bold truncate">{partyName}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">الإجمالي</p>
                        <p className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">المدفوع</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(invoice.paid_amount)}</p>
                    </CardContent>
                </Card>
                <Card className={invoice.remaining_amount > 0 ? "border-red-200 bg-red-50" : ""}>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">المتبقي</p>
                        <p className={cn("text-lg font-bold", invoice.remaining_amount > 0 && "text-red-600")}>
                            {formatCurrency(invoice.remaining_amount)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Card>
                <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full justify-start rounded-none border-b p-0 h-auto">
                            <TabsTrigger value="details" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                <FileText size={16} className="ml-2" />
                                التفاصيل
                            </TabsTrigger>
                            <TabsTrigger value="payments" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                <Receipt size={16} className="ml-2" />
                                المدفوعات ({payments?.length || 0})
                            </TabsTrigger>
                        </TabsList>

                        {/* Details Tab */}
                        <TabsContent value="details" className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="p-4 bg-muted/30 rounded-lg">
                                        <p className="text-sm text-muted-foreground mb-1">{partyType}</p>
                                        <p className="font-medium">{partyName}</p>
                                        {invoice.customer?.phone && (
                                            <p className="text-sm text-muted-foreground mt-1">{invoice.customer.phone}</p>
                                        )}
                                    </div>
                                    {invoice.job_order && (
                                        <div className="p-4 bg-muted/30 rounded-lg">
                                            <p className="text-sm text-muted-foreground mb-1">أمر الشغل</p>
                                            <Button
                                                variant="link"
                                                className="p-0 h-auto"
                                                onClick={() => navigate(`/dashboard/workshop/${invoice.job_order?.id}`)}
                                            >
                                                {invoice.job_order.code}
                                            </Button>
                                        </div>
                                    )}
                                    <div className="p-4 bg-muted/30 rounded-lg">
                                        <p className="text-sm text-muted-foreground mb-1">التاريخ</p>
                                        <p className="font-medium">{formatDate(invoice.created_at)}</p>
                                    </div>
                                    {invoice.due_date && (
                                        <div className="p-4 bg-muted/30 rounded-lg">
                                            <p className="text-sm text-muted-foreground mb-1">تاريخ الاستحقاق</p>
                                            <p className="font-medium">{formatDate(invoice.due_date)}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {/* Invoice Items Table */}
                                    {invoiceItems && invoiceItems.length > 0 && (
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="text-right">البند</TableHead>
                                                        <TableHead className="text-center w-20">الكمية</TableHead>
                                                        <TableHead className="text-left w-28">السعر</TableHead>
                                                        <TableHead className="text-left w-24">الخصم</TableHead>
                                                        <TableHead className="text-left w-28">الإجمالي</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {invoiceItems.map((item) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium">{item.description}</TableCell>
                                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                                            <TableCell className="text-left font-mono">{formatCurrency(item.unit_price)}</TableCell>
                                                            <TableCell className="text-left font-mono text-green-600">
                                                                {item.discount_amount > 0 ? `-${formatCurrency(item.discount_amount)}` : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-left font-mono font-semibold">{formatCurrency(item.total_price)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {/* Totals */}
                                    <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">المجموع الفرعي</span>
                                            <span>{formatCurrency(invoice.subtotal)}</span>
                                        </div>
                                        {invoice.discount_amount > 0 && (
                                            <div className="flex justify-between text-green-600">
                                                <span>الخصم</span>
                                                <span>-{formatCurrency(invoice.discount_amount)}</span>
                                            </div>
                                        )}
                                        {invoice.tax_amount > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">الضريبة</span>
                                                <span>{formatCurrency(invoice.tax_amount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                            <span>الإجمالي</span>
                                            <span>{formatCurrency(invoice.total_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {invoice.notes && (
                                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                                    <p className="text-yellow-700 whitespace-pre-wrap">{invoice.notes}</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Payments Tab */}
                        <TabsContent value="payments" className="p-6">
                            {!payments?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Receipt size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>لا توجد مدفوعات</p>
                                    {canAddPayment && (
                                        <Button className="mt-4" onClick={openPaymentDialog}>
                                            <Plus size={16} className="ml-2" />
                                            استلام دفعة
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>الكود</TableHead>
                                            <TableHead>الطريقة</TableHead>
                                            <TableHead>المبلغ</TableHead>
                                            <TableHead>الخزينة</TableHead>
                                            <TableHead>التاريخ</TableHead>
                                            <TableHead>ملاحظات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payments.map(payment => {
                                            const methodInfo = paymentMethodLabels[payment.payment_method];
                                            const MethodIcon = methodInfo?.icon || Receipt;
                                            return (
                                                <TableRow key={payment.id}>
                                                    <TableCell className="font-mono">{payment.code}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <MethodIcon size={14} />
                                                            {methodInfo?.label || payment.payment_method}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-green-600">
                                                        {formatCurrency(payment.amount)}
                                                    </TableCell>
                                                    <TableCell>{payment.treasury?.name || '-'}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(payment.payment_date)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {payment.notes || '-'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Add Payment Dialog */}
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>استلام دفعة</DialogTitle>
                        <DialogDescription>
                            المتبقي: {formatCurrency(invoice.remaining_amount)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>المبلغ *</Label>
                            <Input
                                type="number"
                                min="0"
                                max={invoice.remaining_amount}
                                step="0.01"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="0.00"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>طريقة الدفع *</Label>
                            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(paymentMethodLabels).map(([value, { label, icon: Icon }]) => (
                                        <SelectItem key={value} value={value}>
                                            <div className="flex items-center gap-2">
                                                <Icon size={14} />
                                                {label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>الخزينة *</Label>
                            <Select value={paymentTreasuryId} onValueChange={setPaymentTreasuryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الخزينة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuries?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({formatCurrency(t.balance)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                placeholder="ملاحظات..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => addPaymentMutation.mutate()}
                            disabled={addPaymentMutation.isPending}
                        >
                            {addPaymentMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden Print Template */}
            <div style={{ display: 'none' }}>
                <InvoicePrintTemplate
                    ref={printRef}
                    invoice={{
                        code: invoice.code,
                        invoice_type: invoice.invoice_type,
                        created_at: invoice.created_at,
                        due_date: invoice.due_date || undefined,
                        status: invoice.status,
                        subtotal: invoice.subtotal,
                        discount_amount: invoice.discount_amount,
                        tax_amount: invoice.tax_amount,
                        total_amount: invoice.total_amount,
                        paid_amount: invoice.paid_amount,
                        remaining_amount: invoice.remaining_amount,
                        notes: invoice.notes || undefined,
                        customer: invoice.customer ? {
                            name: invoice.customer.name,
                            phone: invoice.customer.phone,
                        } : undefined,
                    }}
                    items={[]}
                />
            </div>
        </div>
    );
}

export default InvoiceDetailsPage;
