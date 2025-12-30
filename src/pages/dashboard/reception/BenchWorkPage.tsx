import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Plus, Settings, Search, User, Check, X
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared';

// ============================================================
// Bench Work Page - صفحة صيانة الكنترولات
// ============================================================

interface Customer {
    id: string;
    name: string;
    phone: string;
    code: string;
}

export function BenchWorkPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Customer state
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);

    // Item details
    const [itemDescription, setItemDescription] = useState('');
    const [itemType, setItemType] = useState('');
    const [customerComplaint, setCustomerComplaint] = useState('');
    const [notes, setNotes] = useState('');

    // New customer form
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    // Common item types
    const itemTypes = [
        { value: 'ecu', label: 'ECU - كمبيوتر سيارة' },
        { value: 'abs', label: 'ABS - مانع انغلاق الفرامل' },
        { value: 'airbag', label: 'Airbag - وسادة هوائية' },
        { value: 'cluster', label: 'Cluster - عداد' },
        { value: 'bcm', label: 'BCM - وحدة التحكم المركزية' },
        { value: 'immobilizer', label: 'Immobilizer - مانع السرقة' },
        { value: 'key', label: 'Key - مفتاح' },
        { value: 'other', label: 'أخرى' },
    ];

    // Search customers
    const { data: customers, isLoading: loadingCustomers } = useQuery({
        queryKey: ['customers-search-bench', customerSearch],
        queryFn: async () => {
            if (!customerSearch || customerSearch.length < 2) return [];
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, code')
                .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
                .limit(10);
            if (error) throw error;
            return data as Customer[];
        },
        enabled: customerSearch.length >= 2,
    });

    // Select customer
    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch('');
    };

    // Create new customer mutation
    const createCustomerMutation = useMutation({
        mutationFn: async () => {
            if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
                throw new Error('يرجى إدخال اسم ورقم هاتف العميل');
            }

            const { data, error } = await supabase
                .from('customers')
                .insert({
                    name: newCustomerName.trim(),
                    phone: newCustomerPhone.trim(),
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            setSelectedCustomer(data);
            setShowNewCustomerDialog(false);
            setNewCustomerName('');
            setNewCustomerPhone('');
            queryClient.invalidateQueries({ queryKey: ['customers-search-bench'] });
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل إنشاء العميل');
        },
    });

    // Create job order mutation
    const createJobOrderMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCustomer) throw new Error('يرجى اختيار العميل');
            if (!itemDescription.trim()) throw new Error('يرجى إدخال وصف القطعة');
            if (!customerComplaint.trim()) throw new Error('يرجى إدخال شكوى العميل');

            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('يرجى تسجيل الدخول');

            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user.id)
                .single();

            if (!profile?.branch_id) {
                throw new Error('لا يوجد فرع محدد للمستخدم. يرجى التواصل مع المسؤول.');
            }

            // Create assessment first (with bench_work type)
            const { data: assessment, error: assessmentError } = await supabase
                .from('assessments')
                .insert({
                    customer_id: selectedCustomer.id,
                    vehicle_id: null, // لا يوجد سيارة
                    entry_type: 'bench_work',
                    customer_complaint: customerComplaint,
                    device_type: itemType || null,
                    device_description: itemDescription,
                    status: 'received',
                    branch_id: profile?.branch_id,
                    received_by: user?.id,
                })
                .select()
                .single();
            if (assessmentError) throw assessmentError;

            // Create job order
            const { data: jobOrder, error: jobOrderError } = await supabase
                .from('job_orders')
                .insert({
                    assessment_id: assessment.id,
                    customer_id: selectedCustomer.id,
                    vehicle_id: null,
                    job_category: 'bench_repair',
                    status: 'pending',
                    priority: 'normal',
                    notes: notes || null,
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                })
                .select()
                .single();
            if (jobOrderError) throw jobOrderError;

            return jobOrder;
        },
        onSuccess: (jobOrder) => {
            alert(`تم إنشاء أمر الشغل بنجاح: ${jobOrder.code}`);
            navigate(`/dashboard/workshop/${jobOrder.id}`);
        },
        onError: (error: Error) => {
            console.error('Job order creation error:', error);
            alert(error.message || 'فشل إنشاء أمر الشغل');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createJobOrderMutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <PageHeader title="" showBreadcrumbs={true} className="pb-0" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Settings className="text-blue-500" />
                        صيانة كنترول / قطعة
                    </h1>
                    <p className="text-muted-foreground">
                        استلام قطعة لإصلاحها بدون سيارة
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Customer Selection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User size={18} />
                                بيانات العميل
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!selectedCustomer ? (
                                <>
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                        <Input
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            placeholder="ابحث بالاسم أو رقم الهاتف..."
                                            className="pr-10"
                                        />
                                    </div>

                                    {loadingCustomers && <Skeleton className="h-10 w-full" />}

                                    {customers && customers.length > 0 && (
                                        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                                            {customers.map(customer => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => handleSelectCustomer(customer)}
                                                    className="w-full p-3 text-right hover:bg-muted/50 transition-colors"
                                                >
                                                    <div className="font-medium">{customer.name}</div>
                                                    <div className="text-sm text-muted-foreground">{customer.phone}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={() => setShowNewCustomerDialog(true)}
                                    >
                                        <Plus size={16} />
                                        عميل جديد
                                    </Button>
                                </>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                    <div>
                                        <div className="font-medium text-lg">{selectedCustomer.name}</div>
                                        <div className="text-muted-foreground">{selectedCustomer.phone}</div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedCustomer(null)}
                                    >
                                        <X size={18} />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Item Details */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings size={18} />
                                بيانات القطعة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>نوع القطعة</Label>
                                <Select value={itemType} onValueChange={setItemType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر نوع القطعة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {itemTypes.map(type => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>وصف القطعة *</Label>
                                <Input
                                    value={itemDescription}
                                    onChange={(e) => setItemDescription(e.target.value)}
                                    placeholder="مثال: كمبيوتر كامري 2018"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>شكوى العميل *</Label>
                                <Textarea
                                    value={customerComplaint}
                                    onChange={(e) => setCustomerComplaint(e.target.value)}
                                    placeholder="وصف المشكلة..."
                                    rows={3}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>ملاحظات إضافية</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="ملاحظات..."
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/dashboard/reception')}
                    >
                        إلغاء
                    </Button>
                    <Button
                        type="submit"
                        size="lg"
                        className="gap-2"
                        disabled={!selectedCustomer || !itemDescription || !customerComplaint || createJobOrderMutation.isPending}
                    >
                        <Check size={18} />
                        {createJobOrderMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء أمر شغل'}
                    </Button>
                </div>
            </form>

            {/* New Customer Dialog */}
            <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>عميل جديد</DialogTitle>
                        <DialogDescription>أدخل بيانات العميل الجديد</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>الاسم *</Label>
                            <Input
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="اسم العميل"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الهاتف *</Label>
                            <Input
                                value={newCustomerPhone}
                                onChange={(e) => setNewCustomerPhone(e.target.value)}
                                placeholder="رقم الهاتف"
                                dir="ltr"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowNewCustomerDialog(false)}
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="button"
                            onClick={() => createCustomerMutation.mutate()}
                            disabled={createCustomerMutation.isPending}
                        >
                            {createCustomerMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default BenchWorkPage;
