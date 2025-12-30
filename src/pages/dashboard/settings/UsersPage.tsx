import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Users, MoreVertical, Edit, Trash2,
    Shield, UserCheck, UserX, Phone, Mail, Building2
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { cn } from '@/lib/utils';

// ============================================================
// Users Page - صفحة المستخدمين
// ============================================================

type UserRole = 'admin' | 'manager' | 'supervisor' | 'engineer' | 'technician' | 'warehouse' | 'accountant';

interface User {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
    branch: { id: string; name: string } | null;
}

interface Branch {
    id: string;
    name: string;
}

const roleConfig: Record<UserRole, { label: string; color: string }> = {
    admin: { label: 'مدير النظام', color: 'bg-red-100 text-red-700' },
    manager: { label: 'مدير فرع', color: 'bg-purple-100 text-purple-700' },
    supervisor: { label: 'مشرف', color: 'bg-blue-100 text-blue-700' },
    engineer: { label: 'مهندس استقبال', color: 'bg-cyan-100 text-cyan-700' },
    technician: { label: 'فني', color: 'bg-green-100 text-green-700' },
    warehouse: { label: 'أمين مخزن', color: 'bg-amber-100 text-amber-700' },
    accountant: { label: 'محاسب', color: 'bg-pink-100 text-pink-700' },
};

export function UsersPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form state
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<UserRole>('technician');
    const [branchId, setBranchId] = useState('');
    const [password, setPassword] = useState('');

    // Fetch users
    const { data: users, isLoading } = useQuery({
        queryKey: ['users', roleFilter],
        queryFn: async () => {
            let query = supabase
                .from('profiles')
                .select(`
                    id, full_name, email, phone, role, is_active, created_at,
                    branch:branches (id, name)
                `)
                .order('created_at', { ascending: false });

            if (roleFilter !== 'all') {
                query = query.eq('role', roleFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            let items = (data || []).map(user => ({
                ...user,
                branch: Array.isArray(user.branch) ? user.branch[0] : user.branch,
            })) as User[];

            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                items = items.filter(user =>
                    user.full_name?.toLowerCase().includes(search) ||
                    user.email?.toLowerCase().includes(search) ||
                    user.phone?.includes(search)
                );
            }

            return items;
        },
    });

    // Fetch branches for form
    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name')
                .eq('is_active', true);
            if (error) throw error;
            return data as Branch[];
        },
    });

    // Reset form
    const resetForm = () => {
        setFullName('');
        setEmail('');
        setPhone('');
        setRole('technician');
        setBranchId('');
        setPassword('');
        setEditingUser(null);
    };

    // Open edit modal
    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFullName(user.full_name);
        setEmail(user.email);
        setPhone(user.phone || '');
        setRole(user.role);
        setBranchId(user.branch?.id || '');
        setPassword('');
        setShowAddModal(true);
    };

    // Create user mutation (via Edge Function)
    const createMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: {
                    email,
                    password,
                    full_name: fullName,
                    phone: phone || undefined,
                    role,
                    branch_id: branchId || undefined,
                },
            });

            if (error) {
                throw new Error(error.message || 'فشل إنشاء المستخدم');
            }

            // Check for error in response body
            if (data?.error) {
                throw new Error(data.error);
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowAddModal(false);
            resetForm();
            alert('تم إنشاء المستخدم بنجاح');
        },
        onError: (error: Error) => {
            console.error('Error creating user:', error);
            alert(error.message || 'فشل إنشاء المستخدم');
        },
    });

    // Update user mutation (via Edge Function)
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editingUser) return;

            const { data, error } = await supabase.functions.invoke('admin-update-user', {
                body: {
                    user_id: editingUser.id,
                    full_name: fullName,
                    phone: phone || null,
                    role,
                    branch_id: branchId || null,
                    new_password: password || undefined,
                },
            });

            if (error) {
                throw new Error(error.message || 'فشل تحديث المستخدم');
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowAddModal(false);
            resetForm();
        },
        onError: (error: Error) => {
            console.error('Error updating user:', error);
            alert(error.message || 'فشل تحديث المستخدم');
        },
    });

    // Toggle active mutation (via Edge Function)
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const { data, error } = await supabase.functions.invoke('admin-update-user', {
                body: {
                    user_id: id,
                    is_active: isActive,
                },
            });

            if (error) {
                throw new Error(error.message || 'فشل تغيير حالة المستخدم');
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (error: Error) => {
            console.error('Error toggling user:', error);
            alert(error.message);
        },
    });

    // Calculate stats
    const stats = React.useMemo(() => {
        if (!users) return { total: 0, active: 0, technicians: 0 };
        return {
            total: users.length,
            active: users.filter(u => u.is_active).length,
            technicians: users.filter(u => u.role === 'technician').length,
        };
    }, [users]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) {
            alert('يرجى إدخال الاسم');
            return;
        }
        if (editingUser) {
            updateMutation.mutate();
        } else {
            // Validate new user fields
            if (!email.trim()) {
                alert('يرجى إدخال البريد الإلكتروني');
                return;
            }
            if (!password || password.length < 6) {
                alert('يرجى إدخال كلمة مرور (6 أحرف على الأقل)');
                return;
            }
            createMutation.mutate();
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">المستخدمين</h1>
                    <p className="text-muted-foreground">
                        إدارة المستخدمين والصلاحيات
                    </p>
                </div>
                <Button className="gap-2" onClick={() => { resetForm(); setShowAddModal(true); }}>
                    <Plus size={18} />
                    مستخدم جديد
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <UserCheck size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.active}</p>
                                <p className="text-xs text-muted-foreground">نشط</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Shield size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.technicians}</p>
                                <p className="text-xs text-muted-foreground">فنيين</p>
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
                                placeholder="البحث بالاسم أو البريد أو الهاتف..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="الدور" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأدوار</SelectItem>
                                <SelectItem value="admin">مدير النظام</SelectItem>
                                <SelectItem value="manager">مدير فرع</SelectItem>
                                <SelectItem value="supervisor">مشرف</SelectItem>
                                <SelectItem value="engineer">مهندس استقبال</SelectItem>
                                <SelectItem value="technician">فني</SelectItem>
                                <SelectItem value="warehouse">أمين مخزن</SelectItem>
                                <SelectItem value="accountant">محاسب</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users size={20} />
                        قائمة المستخدمين
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : !users || users.length === 0 ? (
                        <div className="text-center py-12">
                            <Users size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">لا يوجد مستخدمين</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المستخدم</TableHead>
                                        <TableHead>الدور</TableHead>
                                        <TableHead>الفرع</TableHead>
                                        <TableHead>الهاتف</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => {
                                        const roleInfo = roleConfig[user.role];

                                        return (
                                            <TableRow key={user.id} className={cn(!user.is_active && 'opacity-60')}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarFallback className="bg-primary/10 text-primary">
                                                                {getInitials(user.full_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{user.full_name}</p>
                                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                                <Mail size={12} />
                                                                {user.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={roleInfo.color}>
                                                        {roleInfo.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {user.branch ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Building2 size={14} />
                                                            {user.branch.name}
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {user.phone ? (
                                                        <div className="flex items-center gap-1 text-sm font-mono">
                                                            <Phone size={14} />
                                                            {user.phone}
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                                                        {user.is_active ? 'نشط' : 'معطل'}
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
                                                                onClick={() => openEditModal(user)}
                                                            >
                                                                <Edit size={16} />
                                                                تعديل
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="gap-2"
                                                                onClick={() => toggleActiveMutation.mutate({
                                                                    id: user.id,
                                                                    isActive: !user.is_active,
                                                                })}
                                                            >
                                                                {user.is_active ? (
                                                                    <>
                                                                        <UserX size={16} />
                                                                        تعطيل
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserCheck size={16} />
                                                                        تفعيل
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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

            {/* Add/Edit Modal */}
            <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) resetForm(); }}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'تعديل المستخدم' : 'مستخدم جديد'}</DialogTitle>
                        <DialogDescription>
                            {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد للنظام'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>الاسم الكامل *</Label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="محمد أحمد"
                                required
                            />
                        </div>
                        {!editingUser && (
                            <div className="space-y-2">
                                <Label>البريد الإلكتروني *</Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    dir="ltr"
                                    required
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>رقم الهاتف</Label>
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الدور</Label>
                                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">مدير النظام</SelectItem>
                                        <SelectItem value="manager">مدير فرع</SelectItem>
                                        <SelectItem value="supervisor">مشرف</SelectItem>
                                        <SelectItem value="engineer">مهندس استقبال</SelectItem>
                                        <SelectItem value="technician">فني</SelectItem>
                                        <SelectItem value="warehouse">أمين مخزن</SelectItem>
                                        <SelectItem value="accountant">محاسب</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>الفرع</Label>
                                <Select value={branchId} onValueChange={setBranchId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر الفرع" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches?.map(b => (
                                            <SelectItem key={b.id} value={b.id}>
                                                {b.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {/* Password field - required for new users, optional for editing */}
                        <div className="space-y-2">
                            <Label>
                                {editingUser ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور *'}
                            </Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={editingUser ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : 'أدخل كلمة المرور'}
                                dir="ltr"
                                minLength={6}
                                required={!editingUser}
                            />
                            {!editingUser && (
                                <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
                            )}
                        </div>
                        <DialogFooter className="flex-row-reverse gap-2">
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {(createMutation.isPending || updateMutation.isPending) ? 'جاري الحفظ...' : 'حفظ'}
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

export default UsersPage;
