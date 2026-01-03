import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    User, Phone, Mail, MapPin, Edit, Car, FileText, Receipt,
    ArrowRight, Wallet, Building, Plus, History, Wrench,
    Calendar, CheckCircle, Clock, AlertCircle
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

// ============================================================
// Customer Details Page - صفحة تفاصيل العميل
// ============================================================

interface Customer {
    id: string;
    code: string;
    name: string;
    phone: string;
    phone_alt: string | null;
    email: string | null;
    address: string | null;
    customer_type: 'individual' | 'company';
    tax_number: string | null;
    notes: string | null;
    balance: number;
    is_active: boolean;
    created_at: string;
}

interface Vehicle {
    id: string;
    plate_number: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    current_mileage: number;
    is_active: boolean;
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

interface JobOrder {
    id: string;
    code: string;
    status: string;
    job_category: string;
    created_at: string;
    vehicle?: { plate_number: string; make: string; model: string };
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    partial: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    delivered: 'bg-purple-100 text-purple-800',
};

const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    pending: 'معلق',
    approved: 'معتمد',
    partial: 'مدفوع جزئياً',
    paid: 'مدفوع',
    cancelled: 'ملغي',
    in_progress: 'جاري العمل',
    completed: 'مكتمل',
    delivered: 'تم التسليم',
};

export function CustomerDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('info');

    // Edit form state
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editPhoneAlt, setEditPhoneAlt] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Fetch customer
    const { data: customer, isLoading } = useQuery({
        queryKey: ['customer', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data as Customer;
        },
        enabled: !!id,
    });

    // Fetch vehicles
    const { data: vehicles } = useQuery({
        queryKey: ['customer-vehicles', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vehicles')
                .select('id, plate_number, make, model, year, color, current_mileage, is_active')
                .eq('customer_id', id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as Vehicle[];
        },
        enabled: !!id,
    });

    // Fetch invoices
    const { data: invoices } = useQuery({
        queryKey: ['customer-invoices', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('id, code, invoice_type, total_amount, paid_amount, remaining_amount, status, created_at')
                .eq('customer_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as Invoice[];
        },
        enabled: !!id,
    });

    // Fetch payments
    const { data: payments } = useQuery({
        queryKey: ['customer-payments', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select('id, code, payment_type, payment_method, amount, payment_date')
                .eq('customer_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as Payment[];
        },
        enabled: !!id,
    });

    // Fetch job orders
    const { data: jobOrders } = useQuery({
        queryKey: ['customer-jobs', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_orders')
                .select(`
                    id, code, status, job_category, created_at,
                    vehicle:vehicles(plate_number, make, model)
                `)
                .eq('customer_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return (data || []).map(j => ({
                ...j,
                vehicle: Array.isArray(j.vehicle) ? j.vehicle[0] : j.vehicle,
            })) as JobOrder[];
        },
        enabled: !!id,
    });

    // Open edit dialog
    const openEditDialog = () => {
        if (customer) {
            setEditName(customer.name);
            setEditPhone(customer.phone);
            setEditPhoneAlt(customer.phone_alt || '');
            setEditEmail(customer.email || '');
            setEditAddress(customer.address || '');
            setEditNotes(customer.notes || '');
            setShowEditDialog(true);
        }
    };

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editName.trim()) throw new Error('يرجى إدخال اسم العميل');
            if (!editPhone.trim()) throw new Error('يرجى إدخال رقم الهاتف');

            const { error } = await supabase
                .from('customers')
                .update({
                    name: editName.trim(),
                    phone: editPhone.trim(),
                    phone_alt: editPhoneAlt.trim() || null,
                    email: editEmail.trim() || null,
                    address: editAddress.trim() || null,
                    notes: editNotes.trim() || null,
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', id] });
            setShowEditDialog(false);
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل تحديث العميل');
        },
    });

    // Stats
    const stats = {
        vehiclesCount: vehicles?.length || 0,
        totalInvoices: invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0,
        totalPaid: payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        // المستحق = إجمالي الفواتير - إجمالي المدفوعات (وليس من remaining_amount)
        get pendingAmount() {
            return Math.max(0, this.totalInvoices - this.totalPaid);
        },
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-muted-foreground">العميل غير موجود</h2>
                <Button variant="link" onClick={() => navigate('/dashboard/customers')}>
                    العودة للعملاء
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={customer.name}
                description={customer.code}
                backLink="/dashboard/customers"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={openEditDialog}>
                            <Edit size={16} className="ml-2" />
                            تعديل
                        </Button>
                        <Button onClick={() => navigate(`/dashboard/reception/new?customer=${id}`)}>
                            <Plus size={16} className="ml-2" />
                            استقبال جديد
                        </Button>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <Car className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">السيارات</p>
                                <p className="text-2xl font-bold">{stats.vehiclesCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <FileText className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
                                <p className="text-lg font-bold">{formatCurrency(stats.totalInvoices)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100">
                                <Receipt className="text-emerald-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي المدفوعات</p>
                                <p className="text-lg font-bold">{formatCurrency(stats.totalPaid)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", stats.pendingAmount > 0 ? "bg-red-100" : "bg-gray-100")}>
                                <Wallet className={stats.pendingAmount > 0 ? "text-red-600" : "text-gray-600"} size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">مستحق لنا</p>
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
                                    <User size={16} className="ml-2" />
                                    البيانات
                                </TabsTrigger>
                                <TabsTrigger value="vehicles" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <Car size={16} className="ml-2" />
                                    السيارات ({vehicles?.length || 0})
                                </TabsTrigger>
                                <TabsTrigger value="jobs" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <Wrench size={16} className="ml-2" />
                                    أوامر الشغل
                                </TabsTrigger>
                                <TabsTrigger value="invoices" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <FileText size={16} className="ml-2" />
                                    الفواتير
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
                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                        <Phone size={18} className="text-muted-foreground" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">الهاتف</p>
                                            <p className="font-medium">{customer.phone}</p>
                                        </div>
                                    </div>
                                    {customer.phone_alt && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Phone size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">هاتف بديل</p>
                                                <p className="font-medium">{customer.phone_alt}</p>
                                            </div>
                                        </div>
                                    )}
                                    {customer.email && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Mail size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                                                <p className="font-medium">{customer.email}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {customer.address && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <MapPin size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">العنوان</p>
                                                <p className="font-medium">{customer.address}</p>
                                            </div>
                                        </div>
                                    )}
                                    {customer.tax_number && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Building size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">الرقم الضريبي</p>
                                                <p className="font-medium font-mono">{customer.tax_number}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                        <Calendar size={18} className="text-muted-foreground" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">تاريخ التسجيل</p>
                                            <p className="font-medium">{formatDate(customer.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {customer.notes && (
                                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                                    <p className="text-yellow-700">{customer.notes}</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Vehicles Tab */}
                        <TabsContent value="vehicles" className="p-6">
                            {!vehicles?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد سيارات مسجلة
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {vehicles.map(vehicle => (
                                        <Card key={vehicle.id} className="cursor-pointer hover:shadow-md transition-shadow"
                                            onClick={() => navigate(`/dashboard/vehicles/${vehicle.id}`)}>
                                            <CardContent className="pt-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-mono font-bold text-lg">{vehicle.plate_number}</p>
                                                        <p className="text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                                                        {vehicle.year && <p className="text-sm text-muted-foreground">{vehicle.year}</p>}
                                                    </div>
                                                    <Car size={24} className="text-muted-foreground" />
                                                </div>
                                                {vehicle.current_mileage > 0 && (
                                                    <p className="text-sm text-muted-foreground mt-2">
                                                        العداد: {vehicle.current_mileage.toLocaleString()} كم
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Job Orders Tab */}
                        <TabsContent value="jobs" className="p-6">
                            {!jobOrders?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد أوامر شغل
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[500px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الكود</TableHead>
                                                <TableHead>السيارة</TableHead>
                                                <TableHead>الحالة</TableHead>
                                                <TableHead>التاريخ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {jobOrders.map(job => (
                                                <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => navigate(`/dashboard/workshop/${job.id}`)}>
                                                    <TableCell className="font-mono">{job.code}</TableCell>
                                                    <TableCell>
                                                        {job.vehicle ? `${job.vehicle.plate_number} - ${job.vehicle.make} ${job.vehicle.model}` : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[job.status] || 'bg-gray-100'}>
                                                            {statusLabels[job.status] || job.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(job.created_at)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* Invoices Tab */}
                        <TabsContent value="invoices" className="p-6">
                            {!invoices?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد فواتير
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
                                                    <TableCell className="font-medium text-green-600">
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
                        <DialogTitle>تعديل بيانات العميل</DialogTitle>
                        <DialogDescription>تحديث معلومات العميل</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                        <div className="space-y-2">
                            <Label>الاسم *</Label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="اسم العميل"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الهاتف *</Label>
                                <Input
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    placeholder="رقم الهاتف"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>هاتف بديل</Label>
                                <Input
                                    value={editPhoneAlt}
                                    onChange={(e) => setEditPhoneAlt(e.target.value)}
                                    placeholder="رقم بديل"
                                    dir="ltr"
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

export default CustomerDetailsPage;
