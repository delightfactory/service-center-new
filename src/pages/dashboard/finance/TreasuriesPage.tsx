import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Wallet, Building2, CreditCard, Smartphone,
    MoreVertical, Edit, Eye, ArrowRightLeft, TrendingUp, TrendingDown
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
import { cn, formatCurrency } from '@/lib/utils';

// ============================================================
// Treasuries Page - صفحة الخزن
// ============================================================

type TreasuryType = 'cash' | 'bank' | 'pos' | 'wallet';

interface Treasury {
    id: string;
    code: string;
    name: string;
    treasury_type: TreasuryType;
    balance: number;
    opening_balance: number;
    bank_name: string | null;
    account_number: string | null;
    is_default: boolean;
    is_active: boolean;
    branch: { id: string; name: string } | null;
}

const treasuryTypeConfig: Record<TreasuryType, { label: string; icon: React.ReactNode; color: string }> = {
    cash: { label: 'نقدية', icon: <Wallet size={20} />, color: 'bg-green-100 text-green-700' },
    bank: { label: 'بنكية', icon: <Building2 size={20} />, color: 'bg-blue-100 text-blue-700' },
    pos: { label: 'نقاط بيع', icon: <CreditCard size={20} />, color: 'bg-purple-100 text-purple-700' },
    wallet: { label: 'إلكترونية', icon: <Smartphone size={20} />, color: 'bg-amber-100 text-amber-700' },
};

export function TreasuriesPage() {
    const queryClient = useQueryClient();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [treasuryType, setTreasuryType] = useState<TreasuryType>('cash');
    const [openingBalance, setOpeningBalance] = useState('0');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');

    // Transfer state
    const [fromTreasuryId, setFromTreasuryId] = useState('');
    const [toTreasuryId, setToTreasuryId] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNote, setTransferNote] = useState('');

    // Fetch treasuries
    const { data: treasuries, isLoading } = useQuery({
        queryKey: ['treasuries'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('treasuries')
                .select(`
                    id, code, name, treasury_type, balance, opening_balance,
                    bank_name, account_number, is_default, is_active,
                    branch:branches (id, name)
                `)
                .order('is_default', { ascending: false })
                .order('name');
            if (error) throw error;
            return (data || []).map(t => ({
                ...t,
                branch: Array.isArray(t.branch) ? t.branch[0] : t.branch,
            })) as Treasury[];
        },
    });

    // Reset form
    const resetForm = () => {
        setName('');
        setTreasuryType('cash');
        setOpeningBalance('0');
        setBankName('');
        setAccountNumber('');
    };

    // Create treasury mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('treasuries')
                .insert({
                    name,
                    treasury_type: treasuryType,
                    opening_balance: parseFloat(openingBalance) || 0,
                    balance: parseFloat(openingBalance) || 0,
                    bank_name: treasuryType === 'bank' ? bankName : null,
                    account_number: treasuryType === 'bank' ? accountNumber : null,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasuries'] });
            setShowAddModal(false);
            resetForm();
        },
        onError: (error) => {
            console.error('Error creating treasury:', error);
            alert('فشل إنشاء الخزنة');
        },
    });

    // Transfer mutation
    const transferMutation = useMutation({
        mutationFn: async () => {
            const amount = parseFloat(transferAmount);
            if (!amount || amount <= 0) throw new Error('المبلغ غير صحيح');
            if (!fromTreasuryId || !toTreasuryId) throw new Error('يرجى اختيار الخزنتين');
            if (fromTreasuryId === toTreasuryId) throw new Error('لا يمكن التحويل لنفس الخزنة');

            const fromTreasury = treasuries?.find(t => t.id === fromTreasuryId);
            const toTreasury = treasuries?.find(t => t.id === toTreasuryId);
            if (!fromTreasury) throw new Error('الخزنة المصدر غير موجودة');
            if (amount > fromTreasury.balance) throw new Error('رصيد الخزنة المصدر غير كافي');

            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user?.id)
                .single();

            // Create treasury transfer record
            const { data: transfer, error: transferError } = await supabase
                .from('treasury_transfers')
                .insert({
                    from_treasury_id: fromTreasuryId,
                    to_treasury_id: toTreasuryId,
                    amount,
                    transfer_date: new Date().toISOString().split('T')[0],
                    notes: transferNote || null,
                    status: 'approved',
                    created_by: user?.id,
                })
                .select()
                .single();
            if (transferError) throw transferError;

            // Create transaction: withdrawal from source
            const { error: outError } = await supabase
                .from('treasury_transactions')
                .insert({
                    treasury_id: fromTreasuryId,
                    transaction_type: 'transfer_out',
                    amount: amount,
                    reference_type: 'treasury_transfer',
                    reference_id: transfer.id,
                    description: `تحويل إلى ${toTreasury?.name}`,
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                });
            if (outError) throw outError;

            // Create transaction: deposit to destination
            const { error: inError } = await supabase
                .from('treasury_transactions')
                .insert({
                    treasury_id: toTreasuryId,
                    transaction_type: 'transfer_in',
                    amount: amount,
                    reference_type: 'treasury_transfer',
                    reference_id: transfer.id,
                    description: `تحويل من ${fromTreasury?.name}`,
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                });
            if (inError) throw inError;

            // Update treasury balances
            const { error: fromError } = await supabase
                .from('treasuries')
                .update({ balance: fromTreasury.balance - amount })
                .eq('id', fromTreasuryId);
            if (fromError) throw fromError;

            const { error: toError } = await supabase
                .from('treasuries')
                .update({ balance: (toTreasury?.balance || 0) + amount })
                .eq('id', toTreasuryId);
            if (toError) throw toError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasuries'] });
            setShowTransferModal(false);
            setFromTreasuryId('');
            setToTreasuryId('');
            setTransferAmount('');
            setTransferNote('');
        },
        onError: (error: Error) => {
            console.error('Transfer error:', error);
            alert(error.message || 'فشل التحويل');
        },
    });

    // Calculate totals
    const totals = React.useMemo(() => {
        if (!treasuries) return { total: 0, cash: 0, bank: 0, other: 0 };

        const active = treasuries.filter(t => t.is_active);
        const total = active.reduce((sum, t) => sum + t.balance, 0);
        const cash = active.filter(t => t.treasury_type === 'cash').reduce((sum, t) => sum + t.balance, 0);
        const bank = active.filter(t => t.treasury_type === 'bank').reduce((sum, t) => sum + t.balance, 0);
        const other = total - cash - bank;

        return { total, cash, bank, other };
    }, [treasuries]);

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('يرجى إدخال اسم الخزنة');
            return;
        }
        createMutation.mutate();
    };

    const handleTransferSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromTreasuryId || !toTreasuryId || !transferAmount) {
            alert('يرجى ملء كل الحقول المطلوبة');
            return;
        }
        if (fromTreasuryId === toTreasuryId) {
            alert('لا يمكن التحويل لنفس الخزنة');
            return;
        }
        transferMutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">الخزن</h1>
                    <p className="text-muted-foreground">
                        إدارة الخزن والأرصدة
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setShowTransferModal(true)}>
                        <ArrowRightLeft size={18} />
                        تحويل
                    </Button>
                    <Button className="gap-2" onClick={() => { resetForm(); setShowAddModal(true); }}>
                        <Plus size={18} />
                        خزنة جديدة
                    </Button>
                </div>
            </div>

            {/* Totals Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <TrendingUp size={24} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
                                <p className="text-sm text-muted-foreground">إجمالي الأرصدة</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Wallet size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{formatCurrency(totals.cash)}</p>
                                <p className="text-xs text-muted-foreground">النقدية</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Building2 size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{formatCurrency(totals.bank)}</p>
                                <p className="text-xs text-muted-foreground">البنوك</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <CreditCard size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{formatCurrency(totals.other)}</p>
                                <p className="text-xs text-muted-foreground">أخرى</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Treasury Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-40" />
                    ))}
                </div>
            ) : !treasuries || treasuries.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Wallet size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">لا توجد خزن</p>
                        <Button variant="link" onClick={() => setShowAddModal(true)}>
                            إضافة خزنة جديدة
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {treasuries.map((treasury) => {
                        const config = treasuryTypeConfig[treasury.treasury_type];

                        return (
                            <Card key={treasury.id} className={cn(
                                'relative overflow-hidden',
                                !treasury.is_active && 'opacity-60',
                                treasury.is_default && 'ring-2 ring-primary'
                            )}>
                                {treasury.is_default && (
                                    <div className="absolute top-2 left-2">
                                        <Badge variant="default" className="text-xs">
                                            الافتراضية
                                        </Badge>
                                    </div>
                                )}
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.color)}>
                                                {config.icon}
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{treasury.name}</CardTitle>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-mono text-xs text-muted-foreground">{treasury.code}</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {config.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical size={16} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem className="gap-2">
                                                    <Eye size={16} />
                                                    عرض الحركات
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2">
                                                    <Edit size={16} />
                                                    تعديل
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="mt-4">
                                        <p className={cn(
                                            'text-3xl font-bold',
                                            treasury.balance >= 0 ? 'text-green-600' : 'text-red-600'
                                        )}>
                                            {formatCurrency(treasury.balance)}
                                        </p>
                                        {treasury.bank_name && (
                                            <p className="text-sm text-muted-foreground mt-2">
                                                {treasury.bank_name}
                                                {treasury.account_number && ` - ${treasury.account_number}`}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add Treasury Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>إضافة خزنة جديدة</DialogTitle>
                        <DialogDescription>أدخل بيانات الخزنة الجديدة</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>الاسم *</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: الصندوق الرئيسي"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>النوع</Label>
                            <Select value={treasuryType} onValueChange={(v) => setTreasuryType(v as TreasuryType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">نقدية</SelectItem>
                                    <SelectItem value="bank">بنكية</SelectItem>
                                    <SelectItem value="pos">نقاط بيع</SelectItem>
                                    <SelectItem value="wallet">إلكترونية</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {treasuryType === 'bank' && (
                            <>
                                <div className="space-y-2">
                                    <Label>اسم البنك</Label>
                                    <Input
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        placeholder="مثال: البنك الأهلي"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>رقم الحساب</Label>
                                    <Input
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        placeholder="رقم الحساب"
                                        dir="ltr"
                                    />
                                </div>
                            </>
                        )}
                        <div className="space-y-2">
                            <Label>الرصيد الافتتاحي</Label>
                            <Input
                                type="number"
                                value={openingBalance}
                                onChange={(e) => setOpeningBalance(e.target.value)}
                                placeholder="0"
                                dir="ltr"
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

            {/* Transfer Modal */}
            <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تحويل بين الخزن</DialogTitle>
                        <DialogDescription>تحويل مبلغ من خزنة إلى أخرى</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleTransferSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>من خزنة *</Label>
                            <Select value={fromTreasuryId} onValueChange={setFromTreasuryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الخزنة المصدر" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuries?.filter(t => t.is_active).map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({formatCurrency(t.balance)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>إلى خزنة *</Label>
                            <Select value={toTreasuryId} onValueChange={setToTreasuryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الخزنة الهدف" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuries?.filter(t => t.is_active && t.id !== fromTreasuryId).map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>المبلغ *</Label>
                            <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="0.00"
                                dir="ltr"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Input
                                value={transferNote}
                                onChange={(e) => setTransferNote(e.target.value)}
                                placeholder="سبب التحويل..."
                            />
                        </div>
                        <DialogFooter className="flex-row-reverse gap-2">
                            <Button type="submit" disabled={transferMutation.isPending}>
                                {transferMutation.isPending ? 'جاري التحويل...' : 'تحويل'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default TreasuriesPage;
