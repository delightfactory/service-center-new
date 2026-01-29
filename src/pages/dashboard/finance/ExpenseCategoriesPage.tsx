import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Folder, Edit, Trash2, MoreVertical, CheckCircle2
} from 'lucide-react';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { IfCanCreate, IfCanUpdate, IfCanDelete } from '@/components/auth';

// ============================================================
// Expense Categories Page - صفحة بنود المصروفات
// ============================================================

interface ExpenseCategory {
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
}

export function ExpenseCategoriesPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Fetch categories
    const { data: categories, isLoading } = useQuery({
        queryKey: ['expense-categories-all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('account_categories')
                .select('id, code, name, description, is_active, created_at')
                .eq('category_type', 'expense')
                .order('name');
            if (error) throw error;

            let items = data as ExpenseCategory[];

            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                items = items.filter(cat =>
                    cat.name.toLowerCase().includes(search) ||
                    cat.code?.toLowerCase().includes(search)
                );
            }

            return items;
        },
    });

    // Reset form
    const resetForm = () => {
        setName('');
        setCode('');
        setDescription('');
        setIsActive(true);
        setEditingCategory(null);
    };

    // Open edit modal
    const openEditModal = (category: ExpenseCategory) => {
        setEditingCategory(category);
        setName(category.name);
        setCode(category.code || '');
        setDescription(category.description || '');
        setIsActive(category.is_active);
        setShowAddModal(true);
    };

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (editingCategory) {
                // Update
                const { error } = await supabase
                    .from('account_categories')
                    .update({
                        name,
                        code: code || null,
                        description: description || null,
                        is_active: isActive,
                    })
                    .eq('id', editingCategory.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('account_categories')
                    .insert({
                        name,
                        code: code || null,
                        description: description || null,
                        is_active: isActive,
                        category_type: 'expense',
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
            setShowAddModal(false);
            resetForm();
            toast.success(editingCategory ? 'تم تحديث البند' : 'تم إضافة البند');
        },
        onError: (error: Error) => {
            console.error('Error saving category:', error);
            toast.error(error.message || 'فشل حفظ البند');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('account_categories')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
            setDeletingId(null);
            toast.success('تم حذف البند');
        },
        onError: (error: Error) => {
            console.error('Error deleting category:', error);
            toast.error(error.message || 'فشل حذف البند');
        },
    });

    // Toggle active status
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase
                .from('account_categories')
                .update({ is_active })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('يرجى إدخال اسم البند');
            return;
        }
        saveMutation.mutate();
    };

    const activeCount = categories?.filter(c => c.is_active).length || 0;
    const totalCount = categories?.length || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="بنود المصروفات"
                description="إدارة تصنيفات المصروفات"
                actions={
                    <IfCanCreate resource="expense_categories">
                        <Button className="gap-2" onClick={() => { resetForm(); setShowAddModal(true); }}>
                            <Plus size={18} />
                            بند جديد
                        </Button>
                    </IfCanCreate>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Folder size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalCount}</p>
                                <p className="text-xs text-muted-foreground">إجمالي البنود</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <CheckCircle2 size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{activeCount}</p>
                                <p className="text-xs text-muted-foreground">البنود النشطة</p>
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
                            placeholder="البحث بالاسم أو الكود..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Folder size={20} />
                        قائمة البنود
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : !categories || categories.length === 0 ? (
                        <div className="text-center py-12">
                            <Folder size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">لا توجد بنود مصروفات</p>
                            <Button variant="link" onClick={() => setShowAddModal(true)}>
                                إضافة بند جديد
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الكود</TableHead>
                                        <TableHead>الاسم</TableHead>
                                        <TableHead>الوصف</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell className="font-mono text-sm">
                                                {category.code || '-'}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {category.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                                                {category.description || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={category.is_active}
                                                    onCheckedChange={(checked) =>
                                                        toggleActiveMutation.mutate({ id: category.id, is_active: checked })
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical size={16} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <IfCanUpdate resource="expense_categories">
                                                            <DropdownMenuItem
                                                                className="gap-2"
                                                                onClick={() => openEditModal(category)}
                                                            >
                                                                <Edit size={16} />
                                                                تعديل
                                                            </DropdownMenuItem>
                                                        </IfCanUpdate>
                                                        <IfCanDelete resource="expense_categories">
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="gap-2 text-destructive"
                                                                onClick={() => setDeletingId(category.id)}
                                                            >
                                                                <Trash2 size={16} />
                                                                حذف
                                                            </DropdownMenuItem>
                                                        </IfCanDelete>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Modal */}
            <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) resetForm(); setShowAddModal(open); }}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'تعديل البند' : 'بند جديد'}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? 'تعديل بيانات بند المصروف' : 'إضافة بند مصروف جديد'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>اسم البند *</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: إيجار، كهرباء، رواتب..."
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الكود</Label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="كود اختياري"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الوصف</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="وصف اختياري..."
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>نشط</Label>
                            <Switch
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>
                        <DialogFooter className="flex-row-reverse gap-2">
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف البند</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف هذا البند؟ هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogAction
                            onClick={() => deletingId && deleteMutation.mutate(deletingId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            حذف
                        </AlertDialogAction>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default ExpenseCategoriesPage;
