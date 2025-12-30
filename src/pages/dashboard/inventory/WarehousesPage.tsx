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
import { Switch } from '@/components/ui/switch';
import {
    Plus, Warehouse, MoreVertical, Edit, Trash2,
    Package, Star, Search, AlertTriangle
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
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared';


// ============================================================
// Warehouses Page - إدارة المخازن
// ============================================================

interface WarehouseData {
    id: string;
    code: string;
    name: string;
    is_default: boolean;
    is_active: boolean;
}

export function WarehousesPage() {
    const queryClient = useQueryClient();
    const [showDialog, setShowDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
    const [deletingWarehouse, setDeletingWarehouse] = useState<WarehouseData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [name, setName] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [isActive, setIsActive] = useState(true);

    // Fetch warehouses
    const { data: warehouses, isLoading } = useQuery({
        queryKey: ['warehouses-management'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('warehouses')
                .select('id, code, name, is_default, is_active')
                .order('is_default', { ascending: false })
                .order('name');
            if (error) throw error;
            return (data || []) as WarehouseData[];
        },
    });

    // Filter warehouses
    const filteredWarehouses = warehouses?.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats
    const stats = React.useMemo(() => {
        if (!warehouses) return { total: 0, active: 0 };
        return {
            total: warehouses.length,
            active: warehouses.filter(w => w.is_active).length,
        };
    }, [warehouses]);

    // Reset form
    const resetForm = () => {
        setName('');
        setIsDefault(false);
        setIsActive(true);
        setEditingWarehouse(null);
    };

    // Open edit dialog
    const openEditDialog = (warehouse: WarehouseData) => {
        setEditingWarehouse(warehouse);
        setName(warehouse.name);
        setIsDefault(warehouse.is_default);
        setIsActive(warehouse.is_active);
        setShowDialog(true);
    };

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('يرجى إدخال اسم المخزن');

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

            // If setting as default, unset other defaults first
            if (isDefault && !editingWarehouse?.is_default) {
                await supabase
                    .from('warehouses')
                    .update({ is_default: false })
                    .eq('is_default', true);
            }

            if (editingWarehouse) {
                // Update
                const { error } = await supabase
                    .from('warehouses')
                    .update({
                        name,
                        is_default: isDefault,
                        is_active: isActive,
                    })
                    .eq('id', editingWarehouse.id);
                if (error) throw error;
            } else {
                // Create - include branch_id
                const { error } = await supabase
                    .from('warehouses')
                    .insert({
                        name,
                        branch_id: profile.branch_id,
                        is_default: isDefault,
                        is_active: isActive,
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses-management'] });
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            setShowDialog(false);
            resetForm();
        },
        onError: (error: Error) => {
            console.error('Save error:', error);
            alert(error.message || 'فشل حفظ المخزن');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (warehouse: WarehouseData) => {
            // Check if warehouse has inventory
            const { count } = await supabase
                .from('inventory_items')
                .select('*', { count: 'exact', head: true })
                .eq('warehouse_id', warehouse.id)
                .gt('quantity', 0);

            if (count && count > 0) {
                throw new Error('لا يمكن حذف مخزن يحتوي على أرصدة');
            }

            const { error } = await supabase
                .from('warehouses')
                .delete()
                .eq('id', warehouse.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses-management'] });
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            setShowDeleteDialog(false);
            setDeletingWarehouse(null);
        },
        onError: (error: Error) => {
            console.error('Delete error:', error);
            alert(error.message || 'فشل حذف المخزن');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate();
    };

    const handleDelete = (warehouse: WarehouseData) => {
        setDeletingWarehouse(warehouse);
        setShowDeleteDialog(true);
    };

    const confirmDelete = () => {
        if (deletingWarehouse) {
            deleteMutation.mutate(deletingWarehouse);
        }
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    title="إدارة المخازن"
                    description="إنشاء وتعديل وحذف المخازن"
                    actions={
                        <Button className="gap-2" onClick={() => { resetForm(); setShowDialog(true); }}>
                            <Plus size={18} />
                            مخزن جديد
                        </Button>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Warehouse size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي المخازن</p>
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
                                    <p className="text-xs text-muted-foreground">مخازن نشطة</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Card>
                    <CardContent className="p-4">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="بحث بالاسم أو الكود..."
                                className="pr-10"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Warehouses Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>قائمة المخازن</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : filteredWarehouses && filteredWarehouses.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>الكود</TableHead>
                                            <TableHead>الاسم</TableHead>
                                            <TableHead>الموقع</TableHead>
                                            <TableHead>الحالة</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredWarehouses.map((warehouse) => (
                                            <TableRow key={warehouse.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {warehouse.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{warehouse.name}</span>
                                                        {warehouse.is_default && (
                                                            <Badge variant="default" className="text-xs">
                                                                <Star size={12} className="ml-1" />
                                                                افتراضي
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={warehouse.is_active ? 'default' : 'secondary'}>
                                                        {warehouse.is_active ? 'نشط' : 'غير نشط'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical size={16} />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start">
                                                            <DropdownMenuItem
                                                                className="gap-2"
                                                                onClick={() => openEditDialog(warehouse)}
                                                            >
                                                                <Edit size={16} />
                                                                تعديل
                                                            </DropdownMenuItem>
                                                            {!warehouse.is_default && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        className="gap-2 text-destructive"
                                                                        onClick={() => handleDelete(warehouse)}
                                                                    >
                                                                        <Trash2 size={16} />
                                                                        حذف
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
                            <div className="text-center py-12">
                                <Warehouse size={48} className="mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">لا توجد مخازن</h3>
                                <p className="text-muted-foreground mb-4">
                                    ابدأ بإنشاء أول مخزن
                                </p>
                                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                                    <Plus size={18} className="ml-2" />
                                    مخزن جديد
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={(open) => {
                setShowDialog(open);
                if (!open) resetForm();
            }}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Warehouse size={20} />
                            {editingWarehouse ? 'تعديل مخزن' : 'مخزن جديد'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingWarehouse ? 'تعديل بيانات المخزن' : 'أدخل بيانات المخزن الجديد'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>اسم المخزن *</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: المخزن الرئيسي"
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label>المخزن الافتراضي</Label>
                            <Switch
                                checked={isDefault}
                                onCheckedChange={setIsDefault}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label>نشط</Label>
                            <Switch
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowDialog(false)}
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

            {/* Delete Confirmation */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle size={20} />
                            تأكيد الحذف
                        </DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من حذف المخزن "{deletingWarehouse?.name}"؟
                            <br />
                            لا يمكن التراجع عن هذا الإجراء.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default WarehousesPage;
