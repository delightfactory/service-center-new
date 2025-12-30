import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Building2, MoreVertical, Edit, Trash2,
    MapPin, Phone, Mail, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared';

// ============================================================
// Branches Page - صفحة الفروع
// ============================================================

interface Branch {
    id: string;
    code: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    is_main: boolean;
    is_active: boolean;
    working_hours: string | null;
    created_at: string;
}

export function BranchesPage() {
    const queryClient = useQueryClient();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [workingHours, setWorkingHours] = useState('');

    // Fetch branches
    const { data: branches, isLoading } = useQuery({
        queryKey: ['branches-all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .order('is_main', { ascending: false })
                .order('name');
            if (error) throw error;
            return data as Branch[];
        },
    });

    // Reset form
    const resetForm = () => {
        setName('');
        setAddress('');
        setPhone('');
        setEmail('');
        setWorkingHours('');
        setEditingBranch(null);
    };

    // Open edit modal
    const openEditModal = (branch: Branch) => {
        setEditingBranch(branch);
        setName(branch.name);
        setAddress(branch.address || '');
        setPhone(branch.phone || '');
        setEmail(branch.email || '');
        setWorkingHours(branch.working_hours || '');
        setShowAddModal(true);
    };

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const branchData = {
                name,
                address: address || null,
                phone: phone || null,
                email: email || null,
                working_hours: workingHours || null,
            };

            if (editingBranch) {
                const { error } = await supabase
                    .from('branches')
                    .update(branchData)
                    .eq('id', editingBranch.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('branches')
                    .insert(branchData);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches-all'] });
            setShowAddModal(false);
            resetForm();
        },
        onError: (error) => {
            console.error('Error saving branch:', error);
            alert('فشل حفظ الفرع');
        },
    });

    // Toggle active mutation
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const { error } = await supabase
                .from('branches')
                .update({ is_active: isActive })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches-all'] });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('يرجى إدخال اسم الفرع');
            return;
        }
        saveMutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="الفروع"
                description="إدارة فروع مركز الصيانة"
                actions={
                    <Button className="gap-2" onClick={() => { resetForm(); setShowAddModal(true); }}>
                        <Plus size={18} />
                        فرع جديد
                    </Button>
                }
            />

            {/* Branches Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            ) : !branches || branches.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Building2 size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">لا توجد فروع</p>
                        <Button variant="link" onClick={() => setShowAddModal(true)}>
                            إضافة فرع جديد
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branches.map((branch) => (
                        <Card key={branch.id} className={cn(
                            'relative',
                            !branch.is_active && 'opacity-60',
                            branch.is_main && 'ring-2 ring-primary'
                        )}>
                            {branch.is_main && (
                                <div className="absolute top-3 left-3">
                                    <Badge variant="default" className="text-xs">
                                        الرئيسي
                                    </Badge>
                                </div>
                            )}
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <Building2 size={24} className="text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{branch.name}</CardTitle>
                                            <CardDescription className="font-mono text-xs">
                                                {branch.code}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical size={16} />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            <DropdownMenuItem
                                                className="gap-2"
                                                onClick={() => openEditModal(branch)}
                                            >
                                                <Edit size={16} />
                                                تعديل
                                            </DropdownMenuItem>
                                            {!branch.is_main && (
                                                <>
                                                    <DropdownMenuItem
                                                        className="gap-2"
                                                        onClick={() => toggleActiveMutation.mutate({
                                                            id: branch.id,
                                                            isActive: !branch.is_active,
                                                        })}
                                                    >
                                                        {branch.is_active ? 'تعطيل' : 'تفعيل'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="gap-2 text-destructive">
                                                        <Trash2 size={16} />
                                                        حذف
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {branch.address && (
                                    <div className="flex items-start gap-2 text-muted-foreground">
                                        <MapPin size={14} className="mt-0.5 shrink-0" />
                                        <span>{branch.address}</span>
                                    </div>
                                )}
                                {branch.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone size={14} />
                                        <span className="font-mono" dir="ltr">{branch.phone}</span>
                                    </div>
                                )}
                                {branch.email && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Mail size={14} />
                                        <span dir="ltr">{branch.email}</span>
                                    </div>
                                )}
                                {branch.working_hours && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock size={14} />
                                        <span>{branch.working_hours}</span>
                                    </div>
                                )}
                                <div className="pt-2">
                                    <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                                        {branch.is_active ? 'نشط' : 'معطل'}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) resetForm(); }}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingBranch ? 'تعديل الفرع' : 'فرع جديد'}</DialogTitle>
                        <DialogDescription>
                            {editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>اسم الفرع *</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="الفرع الرئيسي"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>العنوان</Label>
                            <Textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="العنوان التفصيلي..."
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الهاتف</Label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="01xxxxxxxxx"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>البريد الإلكتروني</Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="branch@example.com"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>ساعات العمل</Label>
                            <Input
                                value={workingHours}
                                onChange={(e) => setWorkingHours(e.target.value)}
                                placeholder="مثال: 8 ص - 8 م"
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

export default BranchesPage;
