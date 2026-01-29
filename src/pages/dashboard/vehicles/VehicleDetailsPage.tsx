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
    Car, ArrowRight, Edit, User, Wrench, Calendar, Gauge,
    Palette, Settings, Shield, Plus
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
import { cn, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared';
import { IfCanUpdate } from '@/components/auth';

// ============================================================
// Vehicle Details Page - صفحة تفاصيل المركبة
// ============================================================

interface Vehicle {
    id: string;
    customer_id: string;
    plate_number: string;
    vin: string | null;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    engine_type: string | null;
    transmission: string | null;
    current_mileage: number;
    last_service_date: string | null;
    next_service_mileage: number | null;
    insurance_expiry: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    customer?: { id: string; name: string; phone: string };
}

interface JobOrder {
    id: string;
    code: string;
    status: string;
    job_category: string;
    created_at: string;
    notes: string | null;
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    delivered: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    pending: 'معلق',
    in_progress: 'جاري العمل',
    paused: 'متوقف',
    review: 'مراجعة',
    completed: 'مكتمل',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
};

export function VehicleDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('info');
    const [showEditDialog, setShowEditDialog] = useState(false);

    // Edit form state
    const [editPlate, setEditPlate] = useState('');
    const [editVin, setEditVin] = useState('');
    const [editMake, setEditMake] = useState('');
    const [editModel, setEditModel] = useState('');
    const [editYear, setEditYear] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editMileage, setEditMileage] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Fetch vehicle
    const { data: vehicle, isLoading } = useQuery({
        queryKey: ['vehicle', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vehicles')
                .select(`
                    *,
                    customer:customers(id, name, phone)
                `)
                .eq('id', id)
                .single();
            if (error) throw error;
            return {
                ...data,
                customer: Array.isArray(data.customer) ? data.customer[0] : data.customer,
            } as Vehicle;
        },
        enabled: !!id,
    });

    // Fetch job orders
    const { data: jobOrders } = useQuery({
        queryKey: ['vehicle-jobs', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_orders')
                .select('id, code, status, job_category, created_at, notes')
                .eq('vehicle_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as JobOrder[];
        },
        enabled: !!id,
    });

    // Open edit dialog
    const openEditDialog = () => {
        if (vehicle) {
            setEditPlate(vehicle.plate_number);
            setEditVin(vehicle.vin || '');
            setEditMake(vehicle.make);
            setEditModel(vehicle.model);
            setEditYear(vehicle.year?.toString() || '');
            setEditColor(vehicle.color || '');
            setEditMileage(vehicle.current_mileage?.toString() || '0');
            setEditNotes(vehicle.notes || '');
            setShowEditDialog(true);
        }
    };

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editPlate.trim()) throw new Error('يرجى إدخال رقم اللوحة');
            if (!editMake.trim()) throw new Error('يرجى إدخال الماركة');
            if (!editModel.trim()) throw new Error('يرجى إدخال الموديل');

            const { error } = await supabase
                .from('vehicles')
                .update({
                    plate_number: editPlate.trim(),
                    vin: editVin.trim() || null,
                    make: editMake.trim(),
                    model: editModel.trim(),
                    year: editYear ? parseInt(editYear) : null,
                    color: editColor.trim() || null,
                    current_mileage: parseInt(editMileage) || 0,
                    notes: editNotes.trim() || null,
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
            setShowEditDialog(false);
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل تحديث المركبة');
        },
    });

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

    if (!vehicle) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-muted-foreground">المركبة غير موجودة</h2>
                <Button variant="link" onClick={() => navigate('/dashboard/vehicles')}>
                    العودة للمركبات
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
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/vehicles')}>
                        <ArrowRight size={20} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold font-mono">{vehicle.plate_number}</h1>
                            <Badge variant={vehicle.is_active ? 'default' : 'secondary'}>
                                {vehicle.is_active ? 'نشط' : 'غير نشط'}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year || ''}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <IfCanUpdate resource="vehicles">
                        <Button variant="outline" onClick={openEditDialog}>
                            <Edit size={16} className="ml-2" />
                            تعديل
                        </Button>
                    </IfCanUpdate>
                    <Button onClick={() => navigate(`/dashboard/reception/new?vehicle=${id}`)}>
                        <Plus size={16} className="ml-2" />
                        استقبال جديد
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-md" onClick={() => vehicle.customer && navigate(`/dashboard/customers/${vehicle.customer.id}`)}>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <User className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">المالك</p>
                                <p className="font-medium truncate">{vehicle.customer?.name || '-'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <Gauge className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">العداد</p>
                                <p className="font-medium">{vehicle.current_mileage?.toLocaleString() || 0} كم</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100">
                                <Wrench className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">أوامر الشغل</p>
                                <p className="font-medium">{jobOrders?.length || 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100">
                                <Calendar className="text-orange-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">آخر صيانة</p>
                                <p className="font-medium text-sm">
                                    {vehicle.last_service_date ? formatDate(vehicle.last_service_date) : '-'}
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
                                    <Car size={16} className="ml-2" />
                                    البيانات
                                </TabsTrigger>
                                <TabsTrigger value="history" className="rounded-none px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                                    <Wrench size={16} className="ml-2" />
                                    سجل الصيانة ({jobOrders?.length || 0})
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Info Tab */}
                        <TabsContent value="info" className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                        <Car size={18} className="text-muted-foreground" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">الماركة / الموديل</p>
                                            <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                                        </div>
                                    </div>
                                    {vehicle.year && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Calendar size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">سنة الصنع</p>
                                                <p className="font-medium">{vehicle.year}</p>
                                            </div>
                                        </div>
                                    )}
                                    {vehicle.color && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Palette size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">اللون</p>
                                                <p className="font-medium">{vehicle.color}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {vehicle.vin && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Settings size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">رقم الهيكل (VIN)</p>
                                                <p className="font-medium font-mono text-sm">{vehicle.vin}</p>
                                            </div>
                                        </div>
                                    )}
                                    {vehicle.engine_type && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Settings size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">نوع المحرك</p>
                                                <p className="font-medium">{vehicle.engine_type}</p>
                                            </div>
                                        </div>
                                    )}
                                    {vehicle.insurance_expiry && (
                                        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                            <Shield size={18} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">انتهاء التأمين</p>
                                                <p className="font-medium">{formatDate(vehicle.insurance_expiry)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {vehicle.notes && (
                                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                                    <p className="text-yellow-700">{vehicle.notes}</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* History Tab */}
                        <TabsContent value="history" className="p-6">
                            {!jobOrders?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد سجلات صيانة
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[500px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الكود</TableHead>
                                                <TableHead>الحالة</TableHead>
                                                <TableHead>التاريخ</TableHead>
                                                <TableHead>ملاحظات</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {jobOrders.map(job => (
                                                <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => navigate(`/dashboard/workshop/${job.id}`)}>
                                                    <TableCell className="font-mono">{job.code}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[job.status] || 'bg-gray-100'}>
                                                            {statusLabels[job.status] || job.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(job.created_at)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                                                        {job.notes || '-'}
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
                        <DialogTitle>تعديل بيانات المركبة</DialogTitle>
                        <DialogDescription>تحديث معلومات المركبة</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>رقم اللوحة *</Label>
                                <Input
                                    value={editPlate}
                                    onChange={(e) => setEditPlate(e.target.value)}
                                    placeholder="ABC 123"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>رقم الهيكل (VIN)</Label>
                                <Input
                                    value={editVin}
                                    onChange={(e) => setEditVin(e.target.value)}
                                    placeholder="VIN"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الماركة *</Label>
                                <Input
                                    value={editMake}
                                    onChange={(e) => setEditMake(e.target.value)}
                                    placeholder="Toyota"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الموديل *</Label>
                                <Input
                                    value={editModel}
                                    onChange={(e) => setEditModel(e.target.value)}
                                    placeholder="Camry"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>السنة</Label>
                                <Input
                                    type="number"
                                    value={editYear}
                                    onChange={(e) => setEditYear(e.target.value)}
                                    placeholder="2024"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>اللون</Label>
                                <Input
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    placeholder="أبيض"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>العداد (كم)</Label>
                                <Input
                                    type="number"
                                    value={editMileage}
                                    onChange={(e) => setEditMileage(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
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

export default VehicleDetailsPage;
