import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Search,
    Plus,
    Phone,
    Mail,
    Building2,
    MoreVertical,
    Edit,
    Trash2,
    Wallet,
    Package,
    FileText,
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';

// ============================================================
// Suppliers Page - صفحة إدارة الموردين
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
    balance: number;
    notes: string | null;
    is_active: boolean;
    created_at: string;
}

interface SupplierFormData {
    name: string;
    phone: string;
    email: string;
    address: string;
    tax_number: string;
    contact_person: string;
    notes: string;
}

const emptyFormData: SupplierFormData = {
    name: '',
    phone: '',
    email: '',
    address: '',
    tax_number: '',
    contact_person: '',
    notes: '',
};

export function SuppliersPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showDialog, setShowDialog] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [formData, setFormData] = useState<SupplierFormData>(emptyFormData);

    // Fetch suppliers
    const { data: suppliers, isLoading } = useQuery({
        queryKey: ['suppliers', searchQuery],
        queryFn: async () => {
            let query = supabase
                .from('suppliers')
                .select('*')
                .order('name');

            if (searchQuery) {
                query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Supplier[];
        },
    });

    // Calculate stats
    const stats = React.useMemo(() => {
        if (!suppliers) return { total: 0, active: 0, totalBalance: 0, withBalance: 0 };
        return {
            total: suppliers.length,
            active: suppliers.filter(s => s.is_active).length,
            totalBalance: suppliers.reduce((sum, s) => sum + (s.balance || 0), 0),
            withBalance: suppliers.filter(s => s.balance > 0).length,
        };
    }, [suppliers]);

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: SupplierFormData) => {
            if (editingSupplier) {
                const { error } = await supabase
                    .from('suppliers')
                    .update({
                        name: data.name,
                        phone: data.phone || null,
                        email: data.email || null,
                        address: data.address || null,
                        tax_number: data.tax_number || null,
                        contact_person: data.contact_person || null,
                        notes: data.notes || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingSupplier.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert({
                        name: data.name,
                        phone: data.phone || null,
                        email: data.email || null,
                        address: data.address || null,
                        tax_number: data.tax_number || null,
                        contact_person: data.contact_person || null,
                        notes: data.notes || null,
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            handleCloseDialog();
        },
        onError: (error: Error) => {
            console.error('Save error:', error);
            alert(error.message || 'حدث خطأ أثناء الحفظ');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
        onError: (error: Error) => {
            console.error('Delete error:', error);
            alert(error.message || 'لا يمكن حذف المورد - قد يكون مرتبطاً بفواتير');
        },
    });

    const handleOpenDialog = (supplier?: Supplier) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                phone: supplier.phone || '',
                email: supplier.email || '',
                address: supplier.address || '',
                tax_number: supplier.tax_number || '',
                contact_person: supplier.contact_person || '',
                notes: supplier.notes || '',
            });
        } else {
            setEditingSupplier(null);
            setFormData(emptyFormData);
        }
        setShowDialog(true);
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingSupplier(null);
        setFormData(emptyFormData);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('يرجى إدخال اسم المورد');
            return;
        }
        saveMutation.mutate(formData);
    };

    const handleDelete = (supplier: Supplier) => {
        if (supplier.balance > 0) {
            alert('لا يمكن حذف مورد له رصيد مستحق');
            return;
        }
        if (confirm(`هل أنت متأكد من حذف المورد "${supplier.name}"؟`)) {
            deleteMutation.mutate(supplier.id);
        }
    };

    return (
        <>
            <div className="space-y-6">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">الموردين</h1>
                        <p className="text-muted-foreground">إدارة بيانات الموردين ومستحقاتهم</p>
                    </div>
                    <Button className="gap-2" onClick={() => handleOpenDialog()}>
                        <Plus size={18} />
                        مورد جديد
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Building2 size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي الموردين</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <Package size={20} className="text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.active}</p>
                                    <p className="text-xs text-muted-foreground">نشط</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={cn(stats.totalBalance > 0 && 'border-amber-200 bg-amber-50/50')}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    stats.totalBalance > 0 ? 'bg-amber-100' : 'bg-gray-100'
                                )}>
                                    <Wallet size={20} className={stats.totalBalance > 0 ? 'text-amber-600' : 'text-gray-400'} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{formatCurrency(stats.totalBalance)}</p>
                                    <p className="text-xs text-muted-foreground">مستحق لهم</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <FileText size={20} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.withBalance}</p>
                                    <p className="text-xs text-muted-foreground">لهم مستحقات</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Card>
                    <CardContent className="p-4">
                        <Input
                            placeholder="بحث بالاسم، الهاتف، أو الكود..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            icon={<Search size={18} />}
                            iconPosition="start"
                            className="max-w-md"
                        />
                    </CardContent>
                </Card>

                {/* Suppliers Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>قائمة الموردين</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : suppliers && suppliers.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>الكود</TableHead>
                                            <TableHead>الاسم</TableHead>
                                            <TableHead>الهاتف</TableHead>
                                            <TableHead>المسؤول</TableHead>
                                            <TableHead>الرصيد</TableHead>
                                            <TableHead>الحالة</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {suppliers.map((supplier) => (
                                            <TableRow
                                                key={supplier.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => navigate(`/dashboard/suppliers/${supplier.id}`)}
                                            >
                                                <TableCell className="font-mono text-sm">
                                                    {supplier.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{supplier.name}</div>
                                                    {supplier.email && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Mail size={12} />
                                                            {supplier.email}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {supplier.phone && (
                                                        <div className="flex items-center gap-1">
                                                            <Phone size={14} />
                                                            <span dir="ltr">{formatPhone(supplier.phone)}</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{supplier.contact_person || '-'}</TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        'font-medium',
                                                        supplier.balance > 0 ? 'text-red-600' : 'text-green-600'
                                                    )}>
                                                        {formatCurrency(supplier.balance)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                                                        {supplier.is_active ? 'نشط' : 'غير نشط'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical size={16} />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start">
                                                            <DropdownMenuItem asChild>
                                                                <Link to={`/dashboard/suppliers/${supplier.id}`}>
                                                                    <FileText size={16} className="ml-2" />
                                                                    عرض التفاصيل
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="gap-2"
                                                                onClick={() => handleOpenDialog(supplier)}
                                                            >
                                                                <Edit size={16} />
                                                                تعديل
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="gap-2 text-destructive"
                                                                onClick={() => handleDelete(supplier)}
                                                            >
                                                                <Trash2 size={16} />
                                                                حذف
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Building2 size={48} className="mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">لا يوجد موردين</h3>
                                <p className="text-muted-foreground mb-4">
                                    {searchQuery ? 'لا توجد نتائج للبحث' : 'ابدأ بإضافة أول مورد'}
                                </p>
                                {!searchQuery && (
                                    <Button onClick={() => handleOpenDialog()}>
                                        <Plus size={18} className="ml-2" />
                                        إضافة مورد
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
                        </DialogTitle>
                        <DialogDescription>
                            أدخل بيانات المورد بالكامل
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="name">اسم المورد *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="مثال: شركة قطع الغيار"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="phone">الهاتف</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="01xxxxxxxxx"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <Label htmlFor="email">البريد الإلكتروني</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="supplier@example.com"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <Label htmlFor="contact_person">المسؤول</Label>
                                <Input
                                    id="contact_person"
                                    value={formData.contact_person}
                                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    placeholder="اسم المسؤول"
                                />
                            </div>
                            <div>
                                <Label htmlFor="tax_number">الرقم الضريبي</Label>
                                <Input
                                    id="tax_number"
                                    value={formData.tax_number}
                                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                                    placeholder="000-000-000"
                                    dir="ltr"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="address">العنوان</Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="العنوان الكامل"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="notes">ملاحظات</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="ملاحظات إضافية..."
                                    rows={3}
                                />
                            </div>
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
                                disabled={saveMutation.isPending}
                            >
                                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default SuppliersPage;
