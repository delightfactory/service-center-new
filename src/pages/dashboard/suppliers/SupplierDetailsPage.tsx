import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    Truck, ArrowRight, Edit, Phone, Mail, MapPin,
    FileText, Receipt, Building, User, Calendar
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
import { PageHeader } from '@/components/shared';
import { IfCanUpdate } from '@/components/auth';

// ============================================================
// Supplier Details Page - صفحة تفاصيل المورد
// ============================================================

interface Supplier {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    tax_number: string | null;
    contact_person: string | null;
    bank_name: string | null;
    bank_account: string | null;
    notes: string | null;
    balance: number;
    is_active: boolean;
    created_at: string;
}

interface Invoice {
    id: string;
    code: string;
    invoice_type: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    created_at: string;
}

interface Payment {
    id: string;
    code: string;
    payment_type: string;
    payment_method: string;
    amount: number;
    payment_date: string;
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-blue-100 text-blue-800',
    partial: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمدة',
    partial: 'مدفوعة جزئياً',
    paid: 'مدفوعة',
    cancelled: 'ملغاة',
};

export function SupplierDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('info');
    const [showEditDialog, setShowEditDialog] = useState(false);

    // Edit form state
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editContactPerson, setEditContactPerson] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Fetch supplier
    const { data: supplier, isLoading } = useQuery({
        queryKey: ['supplier', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data as Supplier;
        },
        enabled: !!id,
    });

    // Fetch invoices (purchases)
    const { data: invoices } = useQuery({
        queryKey: ['supplier-invoices', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('id, code, invoice_type, total_amount, paid_amount, remaining_amount, status, created_at')
                .eq('supplier_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as Invoice[];
        },
        enabled: !!id,
    });

    // Fetch payments
    const { data: payments } = useQuery({
        queryKey: ['supplier-payments', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select('id, code, payment_type, payment_method, amount, payment_date')
                .eq('supplier_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as Payment[];
        },
        enabled: !!id,
    });

    // Open edit dialog
    const openEditDialog = () => {
        if (supplier) {
            setEditName(supplier.name);
            setEditPhone(supplier.phone || '');
            setEditEmail(supplier.email || '');
            setEditAddress(supplier.address || '');
            setEditContactPerson(supplier.contact_person || '');
            setEditNotes(supplier.notes || '');
            setShowEditDialog(true);
        }
    };

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editName.trim()) throw new Error('يرجى إدخال اسم المورد');

            const { error } = await supabase
                .from('suppliers')
                .update({
                    name: editName.trim(),
                    phone: editPhone.trim() || null,
                    email: editEmail.trim() || null,
                    address: editAddress.trim() || null,
                    contact_person: editContactPerson.trim() || null,
                    notes: editNotes.trim() || null,
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier', id] });
            setShowEditDialog(false);
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل تحديث المورد');
        },
    });

    // Stats
    const stats = {
        totalPurchases: invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0,
        totalPaid: payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        // المستحق عليه = إجمالي المشتريات - إجمالي المدفوع (وليس من remaining_amount)
        get pendingAmount() {
            return Math.max(0, this.totalPurchases - this.totalPaid);
        },
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

    if (!supplier) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-muted-foreground">المورد غير موجود</h2>
                <Button variant="link" onClick={() => navigate('/dashboard/suppliers')}>
                    العودة للموردين
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <PageHeader title="" showBreadcrumbs={true} className="pb-0" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/suppliers')}>
                        <ArrowRight size={20} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">{supplier.name}</h1>
                            <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                                {supplier.is_active ? 'نشط' : 'غير نشط'}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-mono">{supplier.code}</p>
                    </div>
                </div>
                <IfCanUpdate resource="suppliers">
                    <Button variant="outline" onClick={openEditDialog}>
                        <Edit size={16} className="ml-2" />
                        تعديل
                    </Button>
                </IfCanUpdate>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <FileText className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                                <p className="text-lg font-bold">{formatCurrency(stats.totalPurchases)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <Receipt className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي المدفوع</p>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={stats.pendingAmount > 0 ? "border-red-200 bg-red-50" : ""}>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", stats.pendingAmount > 0 ? "bg-red-100" : "bg-gray-100")}>
                                <Receipt className={stats.pendingAmount > 0 ? "text-red-600" : "text-gray-600"} size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">مستحق لهم</p>
                                <p className={cn("text-lg font-bold", stats.pendingAmount > 0 && "text-red-600")}>
                                    {formatCurrency(stats.pendingAmount)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Card>
                <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <div className="overflow-x-auto">
                            <TabsList className="w-full min-w-max justify-start rounded-none border-b p-0 h-auto">
                                <TabsTrigger value="info" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <Truck size={16} className="ml-2" />
                                    البيانات
                                </TabsTrigger>
                                <TabsTrigger value="invoices" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <FileText size={16} className="ml-2" />
                                    فواتير الشراء
                                </TabsTrigger>
                                <TabsTrigger value="payments" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <Receipt size={16} className="ml-2" />
                                    المدفوعات
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Info Tab */}
                        <TabsContent value="info" className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    {supplier.phone && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Phone size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">الهاتف</p>
                                                <p className="font-medium">{supplier.phone}</p>
                                            </div>
                                        </div>
                                    )}
                                    {supplier.email && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Mail size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                                                <p className="font-medium">{supplier.email}</p>
                                            </div>
                                        </div>
                                    )}
                                    {supplier.contact_person && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <User size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">جهة الاتصال</p>
                                                <p className="font-medium">{supplier.contact_person}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {supplier.address && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <MapPin size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">العنوان</p>
                                                <p className="font-medium">{supplier.address}</p>
                                            </div>
                                        </div>
                                    )}
                                    {supplier.tax_number && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Building size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">الرقم الضريبي</p>
                                                <p className="font-medium font-mono">{supplier.tax_number}</p>
                                            </div>
                                        </div>
                                    )}
                                    {supplier.bank_name && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Building size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">البنك</p>
                                                <p className="font-medium">{supplier.bank_name}</p>
                                                {supplier.bank_account && <p className="text-sm font-mono text-muted-foreground">{supplier.bank_account}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {supplier.notes && (
                                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                                    <p className="text-yellow-700">{supplier.notes}</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Invoices Tab */}
                        <TabsContent value="invoices" className="p-6">
                            {!invoices?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد فواتير شراء
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[600px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الكود</TableHead>
                                                <TableHead>الإجمالي</TableHead>
                                                <TableHead>المدفوع</TableHead>
                                                <TableHead>المتبقي</TableHead>
                                                <TableHead>الحالة</TableHead>
                                                <TableHead>التاريخ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invoices.map(invoice => (
                                                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => navigate(`/dashboard/finance/invoices/${invoice.id}`)}>
                                                    <TableCell className="font-mono">{invoice.code}</TableCell>
                                                    <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                                                    <TableCell className="text-green-600">{formatCurrency(invoice.paid_amount)}</TableCell>
                                                    <TableCell className={invoice.remaining_amount > 0 ? "text-red-600 font-medium" : ""}>
                                                        {formatCurrency(invoice.remaining_amount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[invoice.status] || 'bg-gray-100'}>
                                                            {statusLabels[invoice.status] || invoice.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(invoice.created_at)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* Payments Tab */}
                        <TabsContent value="payments" className="p-6">
                            {!payments?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد مدفوعات
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[500px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الكود</TableHead>
                                                <TableHead>النوع</TableHead>
                                                <TableHead>الطريقة</TableHead>
                                                <TableHead>المبلغ</TableHead>
                                                <TableHead>التاريخ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map(payment => (
                                                <TableRow key={payment.id}>
                                                    <TableCell className="font-mono">{payment.code}</TableCell>
                                                    <TableCell>{payment.payment_type}</TableCell>
                                                    <TableCell>{payment.payment_method}</TableCell>
                                                    <TableCell className="font-medium text-red-600">
                                                        {formatCurrency(payment.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(payment.payment_date)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تعديل بيانات المورد</DialogTitle>
                        <DialogDescription>تحديث معلومات المورد</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                        <div className="space-y-2">
                            <Label>الاسم *</Label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="اسم المورد"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الهاتف</Label>
                                <Input
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    placeholder="رقم الهاتف"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>جهة الاتصال</Label>
                                <Input
                                    value={editContactPerson}
                                    onChange={(e) => setEditContactPerson(e.target.value)}
                                    placeholder="اسم جهة الاتصال"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>البريد الإلكتروني</Label>
                            <Input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="email@example.com"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>العنوان</Label>
                            <Input
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                placeholder="العنوان"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="ملاحظات..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default SupplierDetailsPage;
