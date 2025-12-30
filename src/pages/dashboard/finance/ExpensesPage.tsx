import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Receipt, Calendar, MoreVertical,
    Edit, Trash2, CheckCircle2, XCircle, TrendingDown
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/shared';
import { useRealtime } from '@/hooks';

// ============================================================
// Expenses Page - صفحة المصروفات
// ============================================================

type ExpenseStatus = 'pending' | 'approved' | 'rejected';

interface Expense {
    id: string;
    code: string;
    amount: number;
    description: string;
    expense_date: string;
    reference: string | null;
    status: ExpenseStatus;
    notes: string | null;
    created_at: string;
    category: { id: string; name: string } | null;
    treasury: { id: string; name: string } | null;
}

interface Category {
    id: string;
    name: string;
}

interface Treasury {
    id: string;
    name: string;
}

const statusConfig: Record<ExpenseStatus, { label: string; color: string }> = {
    pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-700' },
    approved: { label: 'معتمد', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
};

export function ExpensesPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);

    // Form state
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [treasuryId, setTreasuryId] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    // Fetch expenses
    const { data: expenses, isLoading } = useQuery({
        queryKey: ['expenses', statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('expenses')
                .select(`
                    id, code, amount, description, expense_date, reference, status, notes, created_at,
                    category:account_categories (id, name),
                    treasury:treasuries (id, name)
                `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            let items = (data || []).map(exp => ({
                ...exp,
                category: Array.isArray(exp.category) ? exp.category[0] : exp.category,
                treasury: Array.isArray(exp.treasury) ? exp.treasury[0] : exp.treasury,
            })) as Expense[];

            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                items = items.filter(exp =>
                    exp.code?.toLowerCase().includes(search) ||
                    exp.description?.toLowerCase().includes(search)
                );
            }

            return items;
        },
    });

    // Real-time updates
    useRealtime({
        table: 'expenses',
        queryKey: ['expenses', statusFilter],
    });

    // Fetch categories for form
    const { data: categories } = useQuery({
        queryKey: ['expense-categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('account_categories')
                .select('id, name')
                .eq('category_type', 'expense')
                .eq('is_active', true);
            if (error) throw error;
            return data as Category[];
        },
        enabled: showAddModal,
    });

    // Fetch treasuries for form
    const { data: treasuries } = useQuery({
        queryKey: ['treasuries-active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('treasuries')
                .select('id, name')
                .eq('is_active', true);
            if (error) throw error;
            return data as Treasury[];
        },
        enabled: showAddModal,
    });

    // Reset form
    const resetForm = () => {
        setAmount('');
        setDescription('');
        setCategoryId('');
        setTreasuryId('');
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setReference('');
        setNotes('');
    };

    // Create expense mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user?.id)
                .single();

            if (!profile?.branch_id) {
                throw new Error('لا يوجد فرع محدد للمستخدم');
            }

            const { error } = await supabase
                .from('expenses')
                .insert({
                    amount: parseFloat(amount),
                    description,
                    category_id: categoryId || null,
                    treasury_id: treasuryId || null,
                    expense_date: expenseDate,
                    reference: reference || null,
                    notes: notes || null,
                    branch_id: profile.branch_id,
                    created_by: user?.id,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            setShowAddModal(false);
            resetForm();
        },
        onError: (error: Error) => {
            console.error('Error creating expense:', error);
            alert(error.message || 'فشل إنشاء المصروف');
        },
    });

    // Approve expense mutation
    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('expenses')
                .update({
                    status: 'approved',
                    approved_by: user?.id,
                    approved_at: new Date().toISOString(),
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            alert('تم اعتماد المصروف');
        },
        onError: (error: Error) => {
            console.error('Error approving expense:', error);
            alert(error.message || 'فشل اعتماد المصروف');
        },
    });

    // Reject expense mutation
    const rejectMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('expenses')
                .update({
                    status: 'rejected',
                    approved_by: user?.id,
                    approved_at: new Date().toISOString(),
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            alert('تم رفض المصروف');
        },
        onError: (error: Error) => {
            console.error('Error rejecting expense:', error);
            alert(error.message || 'فشل رفض المصروف');
        },
    });

    // Calculate totals
    const totals = React.useMemo(() => {
        if (!expenses) return { total: 0, pending: 0, approved: 0 };

        const approved = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
        const pending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);

        return { total, pending, approved };
    }, [expenses]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description.trim()) {
            alert('يرجى ملء المبلغ والوصف');
            return;
        }
        createMutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="المصروفات"
                description="إدارة ومتابعة المصروفات"
                actions={
                    <Button className="gap-2" onClick={() => { resetForm(); setShowAddModal(true); }}>
                        <Plus size={18} />
                        مصروف جديد
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <TrendingDown size={20} className="text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.total)}</p>
                                <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
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
                                <p className="text-2xl font-bold">{formatCurrency(totals.approved)}</p>
                                <p className="text-xs text-muted-foreground">المعتمد</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Receipt size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(totals.pending)}</p>
                                <p className="text-xs text-muted-foreground">قيد المراجعة</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                placeholder="البحث بالكود أو الوصف..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                <SelectItem value="pending">قيد المراجعة</SelectItem>
                                <SelectItem value="approved">معتمد</SelectItem>
                                <SelectItem value="rejected">مرفوض</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Expenses Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt size={20} />
                        قائمة المصروفات
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : !expenses || expenses.length === 0 ? (
                        <EmptyState
                            icon={Receipt}
                            title="لا توجد مصروفات"
                            description="لم يتم العثور على مصروفات"
                            action={
                                <Button onClick={() => setShowAddModal(true)}>
                                    <Plus size={18} className="ml-2" />
                                    إضافة مصروف جديد
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الكود</TableHead>
                                        <TableHead>الوصف</TableHead>
                                        <TableHead>التصنيف</TableHead>
                                        <TableHead className="text-left">المبلغ</TableHead>
                                        <TableHead>الخزنة</TableHead>
                                        <TableHead>التاريخ</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expenses.map((expense) => {
                                        const status = statusConfig[expense.status];

                                        return (
                                            <TableRow key={expense.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {expense.code}
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate">
                                                    {expense.description}
                                                </TableCell>
                                                <TableCell>
                                                    {expense.category?.name || '-'}
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-semibold text-red-600">
                                                    {formatCurrency(expense.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    {expense.treasury?.name || '-'}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatDate(expense.expense_date)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={status.color}>
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {/* Edit button */}
                                                        <button
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                                            title="تعديل"
                                                        >
                                                            <Edit size={15} />
                                                        </button>

                                                        {/* Approve button - only for pending */}
                                                        {expense.status === 'pending' && (
                                                            <button
                                                                onClick={() => approveMutation.mutate(expense.id)}
                                                                disabled={approveMutation.isPending}
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-50"
                                                                title="اعتماد"
                                                            >
                                                                <CheckCircle2 size={15} />
                                                            </button>
                                                        )}

                                                        {/* Reject button - only for pending */}
                                                        {expense.status === 'pending' && (
                                                            <button
                                                                onClick={() => rejectMutation.mutate(expense.id)}
                                                                disabled={rejectMutation.isPending}
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                                                                title="رفض"
                                                            >
                                                                <XCircle size={15} />
                                                            </button>
                                                        )}

                                                        {/* Delete button */}
                                                        <button
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                            title="حذف"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Expense Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>مصروف جديد</DialogTitle>
                        <DialogDescription>أدخل بيانات المصروف</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>المبلغ *</Label>
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    dir="ltr"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>التاريخ</Label>
                                <Input
                                    type="date"
                                    value={expenseDate}
                                    onChange={(e) => setExpenseDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>الوصف *</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="وصف المصروف..."
                                rows={2}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>التصنيف</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر التصنيف" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories?.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>الخزنة</Label>
                                <Select value={treasuryId} onValueChange={setTreasuryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر الخزنة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {treasuries?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>المرجع</Label>
                            <Input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="رقم الفاتورة أو المرجع..."
                            />
                        </div>
                        <DialogFooter className="flex-row-reverse gap-2">
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
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

export default ExpensesPage;
