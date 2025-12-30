import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderTree, Edit, Trash2, MoreVertical } from 'lucide-react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// Categories Page - صفحة التصنيفات
// ============================================================

interface Category {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    parent: { id: string; name: string } | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
}

export function CategoriesPage() {
    const queryClient = useQueryClient();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [parentId, setParentId] = useState<string>('');
    const [sortOrder, setSortOrder] = useState('0');

    // Fetch categories
    const { data: categories, isLoading } = useQuery({
        queryKey: ['categories-all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('categories')
                .select(`
                    id, name, description, parent_id, sort_order, is_active, created_at,
                    parent:categories!parent_id (id, name)
                `)
                .order('sort_order');
            if (error) throw error;
            return (data || []).map(cat => ({
                ...cat,
                parent: Array.isArray(cat.parent) ? cat.parent[0] : cat.parent,
            })) as Category[];
        },
    });

    // Reset form
    const resetForm = () => {
        setName('');
        setDescription('');
        setParentId('');
        setSortOrder('0');
        setEditingCategory(null);
    };

    // Open edit modal
    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setName(category.name);
        setDescription(category.description || '');
        setParentId(category.parent_id || '');
        setSortOrder(category.sort_order.toString());
        setShowAddModal(true);
    };

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const categoryData = {
                name,
                description: description || null,
                parent_id: parentId || null,
                sort_order: parseInt(sortOrder) || 0,
            };

            if (editingCategory) {
                const { error } = await supabase
                    .from('categories')
                    .update(categoryData)
                    .eq('id', editingCategory.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('categories')
                    .insert(categoryData);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories-all'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setShowAddModal(false);
            resetForm();
        },
        onError: (error) => {
            console.error('Error saving category:', error);
            alert('فشل حفظ التصنيف');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (categoryId: string) => {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', categoryId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories-all'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
    });

    // Toggle active mutation
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const { error } = await supabase
                .from('categories')
                .update({ is_active: isActive })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories-all'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('يرجى إدخال اسم التصنيف');
            return;
        }
        saveMutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">التصنيفات</h1>
                    <p className="text-muted-foreground">
                        إدارة تصنيفات المنتجات والخدمات
                    </p>
                </div>
                <Button className="gap-2" onClick={() => { resetForm(); setShowAddModal(true); }}>
                    <Plus size={18} />
                    إضافة تصنيف
                </Button>
            </div>

            {/* Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FolderTree size={20} />
                        قائمة التصنيفات
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
                            <FolderTree size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">لا توجد تصنيفات</p>
                            <Button variant="link" onClick={() => setShowAddModal(true)}>
                                إضافة تصنيف جديد
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>الاسم</TableHead>
                                    <TableHead>التصنيف الأب</TableHead>
                                    <TableHead>الوصف</TableHead>
                                    <TableHead>الترتيب</TableHead>
                                    <TableHead>الحالة</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell className="font-medium">
                                            {category.name}
                                        </TableCell>
                                        <TableCell>
                                            {category.parent?.name || '-'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-xs truncate">
                                            {category.description || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {category.sort_order}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={category.is_active ? 'default' : 'secondary'}>
                                                {category.is_active ? 'نشط' : 'معطل'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical size={16} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start">
                                                    <DropdownMenuItem
                                                        className="gap-2"
                                                        onClick={() => openEditModal(category)}
                                                    >
                                                        <Edit size={16} />
                                                        تعديل
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="gap-2"
                                                        onClick={() => toggleActiveMutation.mutate({
                                                            id: category.id,
                                                            isActive: !category.is_active,
                                                        })}
                                                    >
                                                        {category.is_active ? 'تعطيل' : 'تفعيل'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="gap-2 text-destructive"
                                                        onClick={() => {
                                                            if (confirm('هل أنت متأكد من حذف هذا التصنيف؟')) {
                                                                deleteMutation.mutate(category.id);
                                                            }
                                                        }}
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
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Modal */}
            <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) resetForm(); }}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? 'تعديل بيانات التصنيف' : 'أدخل بيانات التصنيف الجديد'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">الاسم *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: زيوت ومستهلكات"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="parent">التصنيف الأب</Label>
                            <Select value={parentId} onValueChange={setParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="بدون تصنيف أب" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">بدون</SelectItem>
                                    {categories?.filter(c => c.id !== editingCategory?.id).map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">الوصف</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="وصف التصنيف..."
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sortOrder">الترتيب</Label>
                            <Input
                                id="sortOrder"
                                type="number"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                placeholder="0"
                                dir="ltr"
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
        </div>
    );
}

export default CategoriesPage;
