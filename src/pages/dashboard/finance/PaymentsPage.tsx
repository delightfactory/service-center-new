import React, { useState, useMemo } from 'react';
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
    Plus, Search, Receipt, ArrowDownCircle, ArrowUpCircle,
    CreditCard, Banknote, Building, Wallet, Filter, Download,
    Calendar, User, Truck, FileText, Printer
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/shared';
import { useRealtime } from '@/hooks';

// ============================================================
// Payments Page - صفحة المدفوعات
// ============================================================

type PaymentType = 'customer_receipt' | 'supplier_payment' | 'advance_payment' | 'refund_to_customer' | 'refund_from_supplier';
type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'online';

interface Payment {
    id: string;
    code: string;
    payment_type: PaymentType;
    payment_method: PaymentMethod;
    treasury_id: string | null;
    invoice_id: string | null;
    customer_id: string | null;
    supplier_id: string | null;
    amount: number;
    payment_date: string;
    reference: string | null;
    cheque_number: string | null;
    cheque_date: string | null;
    cheque_bank: string | null;
    notes: string | null;
    created_at: string;
    customer?: { id: string; name: string; phone: string };
    supplier?: { id: string; name: string };
    treasury?: { id: string; name: string };
    invoice?: { id: string; code: string };
}

interface Customer {
    id: string;
    name: string;
    phone: string;
}

interface Supplier {
    id: string;
    name: string;
}

interface Treasury {
    id: string;
    name: string;
    balance: number;
}

const paymentTypeLabels: Record<PaymentType, { label: string; color: string; icon: React.ElementType }> = {
    customer_receipt: { label: 'سند قبض', color: 'bg-green-100 text-green-800', icon: ArrowDownCircle },
    supplier_payment: { label: 'سند صرف', color: 'bg-red-100 text-red-800', icon: ArrowUpCircle },
    advance_payment: { label: 'عربون', color: 'bg-blue-100 text-blue-800', icon: Wallet },
    refund_to_customer: { label: 'مرتجع للعميل', color: 'bg-orange-100 text-orange-800', icon: ArrowUpCircle },
    refund_from_supplier: { label: 'مرتجع من مورد', color: 'bg-purple-100 text-purple-800', icon: ArrowDownCircle },
};

const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: React.ElementType }> = {
    cash: { label: 'نقدي', icon: Banknote },
    card: { label: 'بطاقة', icon: CreditCard },
    bank_transfer: { label: 'تحويل بنكي', icon: Building },
    cheque: { label: 'شيك', icon: FileText },
    online: { label: 'إلكتروني', icon: Wallet },
};

export function PaymentsPage() {
    const queryClient = useQueryClient();
    const [showDialog, setShowDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterMethod, setFilterMethod] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<string>('all');

    // Form state
    const [paymentType, setPaymentType] = useState<PaymentType>('customer_receipt');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [amount, setAmount] = useState('');
    const [treasuryId, setTreasuryId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');
    const [chequeDate, setChequeDate] = useState('');
    const [chequeBank, setChequeBank] = useState('');

    // Fetch payments
    const { data: payments, isLoading } = useQuery({
        queryKey: ['payments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    id, code, payment_type, payment_method, treasury_id, invoice_id,
                    customer_id, supplier_id, amount, payment_date, reference,
                    cheque_number, cheque_date, cheque_bank, notes, created_at,
                    customer:customers(id, name, phone),
                    supplier:suppliers(id, name),
                    treasury:treasuries(id, name),
                    invoice:invoices(id, code)
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            // Map relations (Supabase returns arrays for relations)
            return (data || []).map(p => ({
                ...p,
                customer: Array.isArray(p.customer) ? p.customer[0] : p.customer,
                supplier: Array.isArray(p.supplier) ? p.supplier[0] : p.supplier,
                treasury: Array.isArray(p.treasury) ? p.treasury[0] : p.treasury,
                invoice: Array.isArray(p.invoice) ? p.invoice[0] : p.invoice,
            })) as Payment[];
        },
    });

    // Fetch customers for dropdown
    const { data: customers } = useQuery({
        queryKey: ['customers-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone')
                .order('name');
            if (error) throw error;
            return data as Customer[];
        },
    });

    // Fetch suppliers for dropdown
    const { data: suppliers } = useQuery({
        queryKey: ['suppliers-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name')
                .order('name');
            if (error) throw error;
            return data as Supplier[];
        },
    });

    // Fetch treasuries for dropdown
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

    // Real-time updates
    useRealtime({
        table: 'payments',
        queryKey: ['payments'],
    });
    useRealtime({
        table: 'treasuries',
        queryKey: ['treasuries-list'],
    });

    // Filter and search payments
    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        return payments.filter(payment => {
            // Tab filter
            if (activeTab === 'receipts' && !['customer_receipt', 'advance_payment', 'refund_from_supplier'].includes(payment.payment_type)) {
                return false;
            }
            if (activeTab === 'disbursements' && !['supplier_payment', 'refund_to_customer'].includes(payment.payment_type)) {
                return false;
            }

            // Type filter
            if (filterType !== 'all' && payment.payment_type !== filterType) {
                return false;
            }

            // Method filter
            if (filterMethod !== 'all' && payment.payment_method !== filterMethod) {
                return false;
            }

            // Search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    payment.code?.toLowerCase().includes(query) ||
                    payment.customer?.name?.toLowerCase().includes(query) ||
                    payment.supplier?.name?.toLowerCase().includes(query) ||
                    payment.reference?.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [payments, activeTab, filterType, filterMethod, searchQuery]);

    // Statistics
    const stats = useMemo(() => {
        if (!payments) return { totalReceipts: 0, totalDisbursements: 0, todayReceipts: 0, todayDisbursements: 0 };
        const today = new Date().toISOString().split('T')[0];

        let totalReceipts = 0;
        let totalDisbursements = 0;
        let todayReceipts = 0;
        let todayDisbursements = 0;

        payments.forEach(p => {
            const isReceipt = ['customer_receipt', 'advance_payment', 'refund_from_supplier'].includes(p.payment_type);
            if (isReceipt) {
                totalReceipts += p.amount;
                if (p.payment_date === today) todayReceipts += p.amount;
            } else {
                totalDisbursements += p.amount;
                if (p.payment_date === today) todayDisbursements += p.amount;
            }
        });

        return { totalReceipts, totalDisbursements, todayReceipts, todayDisbursements };
    }, [payments]);

    // Reset form
    const resetForm = () => {
        setPaymentType('customer_receipt');
        setPaymentMethod('cash');
        setAmount('');
        setTreasuryId('');
        setCustomerId('');
        setSupplierId('');
        setReference('');
        setNotes('');
        setChequeNumber('');
        setChequeDate('');
        setChequeBank('');
    };

    // Create payment mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            const amountNum = parseFloat(amount);
            if (!amountNum || amountNum <= 0) throw new Error('يرجى إدخال مبلغ صحيح');
            if (!treasuryId) throw new Error('يرجى اختيار الخزينة');

            // Validate party
            const isCustomerPayment = ['customer_receipt', 'advance_payment', 'refund_to_customer'].includes(paymentType);
            if (isCustomerPayment && !customerId) throw new Error('يرجى اختيار العميل');
            if (!isCustomerPayment && !supplierId) throw new Error('يرجى اختيار المورد');

            // Validate cheque data
            if (paymentMethod === 'cheque' && !chequeNumber) throw new Error('يرجى إدخال رقم الشيك');

            // Get user branch
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('يرجى تسجيل الدخول');

            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user.id)
                .single();

            if (!profile?.branch_id) throw new Error('لا يوجد فرع محدد للمستخدم');

            const { error } = await supabase
                .from('payments')
                .insert({
                    payment_type: paymentType,
                    payment_method: paymentMethod,
                    amount: amountNum,
                    treasury_id: treasuryId,
                    customer_id: isCustomerPayment ? customerId : null,
                    supplier_id: !isCustomerPayment ? supplierId : null,
                    reference: reference || null,
                    notes: notes || null,
                    cheque_number: paymentMethod === 'cheque' ? chequeNumber : null,
                    cheque_date: paymentMethod === 'cheque' && chequeDate ? chequeDate : null,
                    cheque_bank: paymentMethod === 'cheque' ? chequeBank : null,
                    branch_id: profile.branch_id,
                    created_by: user.id,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['treasuries'] });
            setShowDialog(false);
            resetForm();
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل إنشاء السند');
        },
    });

    const isCustomerPayment = ['customer_receipt', 'advance_payment', 'refund_to_customer'].includes(paymentType);

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="المدفوعات"
                description="إدارة سندات القبض والصرف"
                actions={
                    <Button onClick={() => setShowDialog(true)} className="gap-2">
                        <Plus size={18} />
                        سند جديد
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <ArrowDownCircle className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي القبض</p>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalReceipts)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100">
                                <ArrowUpCircle className="text-red-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي الصرف</p>
                                <p className="text-lg font-bold text-red-600">{formatCurrency(stats.totalDisbursements)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <Calendar className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">قبض اليوم</p>
                                <p className="text-lg font-bold">{formatCurrency(stats.todayReceipts)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100">
                                <Calendar className="text-red-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">صرف اليوم</p>
                                <p className="text-lg font-bold">{formatCurrency(stats.todayDisbursements)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs & Filters */}
            <Card>
                <CardContent className="p-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <div className="flex flex-col lg:flex-row gap-4">
                            <TabsList className="w-full lg:w-auto">
                                <TabsTrigger value="all" className="flex-1">الكل</TabsTrigger>
                                <TabsTrigger value="receipts" className="flex-1">سندات القبض</TabsTrigger>
                                <TabsTrigger value="disbursements" className="flex-1">سندات الصرف</TabsTrigger>
                            </TabsList>

                            <div className="flex flex-wrap gap-2 flex-1">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="بحث بالكود أو الاسم..."
                                        className="pr-10"
                                    />
                                </div>
                                <Select value={filterMethod} onValueChange={setFilterMethod}>
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="طريقة الدفع" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">كل الطرق</SelectItem>
                                        {Object.entries(paymentMethodLabels).map(([value, { label }]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mt-4">
                            {isLoading ? (
                                <div className="space-y-2">
                                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            ) : filteredPayments.length === 0 ? (
                                <EmptyState
                                    icon={Receipt}
                                    title="لا توجد مدفوعات"
                                    description="لم يتم العثور على سندات مطابقة للبحث"
                                />
                            ) : (
                                <div className="border rounded-lg overflow-x-auto">
                                    <Table className="min-w-[700px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الكود</TableHead>
                                                <TableHead>النوع</TableHead>
                                                <TableHead>الطرف</TableHead>
                                                <TableHead>المبلغ</TableHead>
                                                <TableHead>طريقة الدفع</TableHead>
                                                <TableHead>الخزينة</TableHead>
                                                <TableHead>التاريخ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPayments.map(payment => {
                                                const typeInfo = paymentTypeLabels[payment.payment_type];
                                                const methodInfo = paymentMethodLabels[payment.payment_method];
                                                const TypeIcon = typeInfo.icon;
                                                const MethodIcon = methodInfo.icon;
                                                const isReceipt = ['customer_receipt', 'advance_payment', 'refund_from_supplier'].includes(payment.payment_type);

                                                return (
                                                    <TableRow key={payment.id}>
                                                        <TableCell className="font-mono text-sm">
                                                            {payment.code}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={cn("gap-1", typeInfo.color)}>
                                                                <TypeIcon size={12} />
                                                                {typeInfo.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                {payment.customer ? (
                                                                    <>
                                                                        <User size={14} className="text-muted-foreground" />
                                                                        {payment.customer.name}
                                                                    </>
                                                                ) : payment.supplier ? (
                                                                    <>
                                                                        <Truck size={14} className="text-muted-foreground" />
                                                                        {payment.supplier.name}
                                                                    </>
                                                                ) : '-'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className={cn(
                                                                "font-bold",
                                                                isReceipt ? "text-green-600" : "text-red-600"
                                                            )}>
                                                                {isReceipt ? '+' : '-'}{formatCurrency(payment.amount)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1 text-sm">
                                                                <MethodIcon size={14} />
                                                                {methodInfo.label}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{payment.treasury?.name || '-'}</TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">
                                                            {formatDate(payment.payment_date)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Create Payment Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>سند جديد</DialogTitle>
                        <DialogDescription>إنشاء سند قبض أو صرف جديد</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                        {/* Payment Type */}
                        <div className="space-y-2">
                            <Label>نوع السند *</Label>
                            <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(paymentTypeLabels).map(([value, { label }]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Customer or Supplier */}
                        {isCustomerPayment ? (
                            <div className="space-y-2">
                                <Label>العميل *</Label>
                                <Select value={customerId} onValueChange={setCustomerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر العميل" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers?.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>المورد *</Label>
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر المورد" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers?.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Amount */}
                        <div className="space-y-2">
                            <Label>المبلغ *</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                dir="ltr"
                            />
                        </div>

                        {/* Payment Method */}
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

                        {/* Cheque fields */}
                        {paymentMethod === 'cheque' && (
                            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                                <div className="space-y-2">
                                    <Label>رقم الشيك *</Label>
                                    <Input
                                        value={chequeNumber}
                                        onChange={(e) => setChequeNumber(e.target.value)}
                                        placeholder="رقم الشيك"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>تاريخ الشيك</Label>
                                        <Input
                                            type="date"
                                            value={chequeDate}
                                            onChange={(e) => setChequeDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>البنك</Label>
                                        <Input
                                            value={chequeBank}
                                            onChange={(e) => setChequeBank(e.target.value)}
                                            placeholder="اسم البنك"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Treasury */}
                        <div className="space-y-2">
                            <Label>الخزينة *</Label>
                            <Select value={treasuryId} onValueChange={setTreasuryId}>
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

                        {/* Reference */}
                        <div className="space-y-2">
                            <Label>مرجع</Label>
                            <Input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="رقم مرجعي أو رقم فاتورة"
                            />
                        </div>

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
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default PaymentsPage;
