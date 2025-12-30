import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

// ============================================================
// Treasury Transfer Modal - تحويل بين الخزن
// ============================================================

interface TreasuryTransferModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Treasury {
    id: string;
    name: string;
    treasury_type: string;
    balance: number;
}

export function TreasuryTransferModal({ open, onOpenChange }: TreasuryTransferModalProps) {
    const queryClient = useQueryClient();

    const [fromTreasuryId, setFromTreasuryId] = useState('');
    const [toTreasuryId, setToTreasuryId] = useState('');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');

    // Fetch treasuries
    const { data: treasuries } = useQuery({
        queryKey: ['treasuries-transfer'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('treasuries')
                .select('id, name, treasury_type, balance')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data as Treasury[];
        },
        enabled: open,
    });

    // Get selected treasuries
    const fromTreasury = treasuries?.find(t => t.id === fromTreasuryId);
    const toTreasury = treasuries?.find(t => t.id === toTreasuryId);

    // Reset form
    const resetForm = () => {
        setFromTreasuryId('');
        setToTreasuryId('');
        setAmount('');
        setNotes('');
    };

    // Create transfer mutation
    const transferMutation = useMutation({
        mutationFn: async () => {
            const transferAmount = parseFloat(amount);

            // Validations
            if (!fromTreasuryId || !toTreasuryId) {
                throw new Error('يرجى اختيار الخزنتين');
            }
            if (fromTreasuryId === toTreasuryId) {
                throw new Error('لا يمكن التحويل لنفس الخزنة');
            }
            if (!transferAmount || transferAmount <= 0) {
                throw new Error('يرجى إدخال مبلغ صحيح');
            }
            if (fromTreasury && transferAmount > fromTreasury.balance) {
                throw new Error('رصيد الخزنة المصدر غير كافي');
            }

            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user?.id)
                .single();

            // Create transfer record
            const { data: transfer, error: transferError } = await supabase
                .from('treasury_transfers')
                .insert({
                    from_treasury_id: fromTreasuryId,
                    to_treasury_id: toTreasuryId,
                    amount: transferAmount,
                    transfer_date: new Date().toISOString().split('T')[0],
                    notes: notes || null,
                    status: 'completed',
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                })
                .select()
                .single();
            if (transferError) throw transferError;

            // Create withdrawal transaction (from source)
            const { error: withdrawError } = await supabase
                .from('treasury_transactions')
                .insert({
                    treasury_id: fromTreasuryId,
                    transaction_type: 'transfer_out',
                    amount: transferAmount,
                    reference_type: 'treasury_transfer',
                    reference_id: transfer.id,
                    description: `تحويل إلى ${toTreasury?.name}`,
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                });
            if (withdrawError) throw withdrawError;

            // Create deposit transaction (to destination)
            const { error: depositError } = await supabase
                .from('treasury_transactions')
                .insert({
                    treasury_id: toTreasuryId,
                    transaction_type: 'transfer_in',
                    amount: transferAmount,
                    reference_type: 'treasury_transfer',
                    reference_id: transfer.id,
                    description: `تحويل من ${fromTreasury?.name}`,
                    branch_id: profile?.branch_id,
                    created_by: user?.id,
                });
            if (depositError) throw depositError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasuries'] });
            queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
            onOpenChange(false);
            resetForm();
        },
        onError: (error: Error) => {
            console.error('Transfer error:', error);
            alert(error.message || 'فشل التحويل');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        transferMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            onOpenChange(isOpen);
            if (!isOpen) resetForm();
        }}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight size={20} />
                        تحويل بين الخزن
                    </DialogTitle>
                    <DialogDescription>
                        نقل رصيد من خزنة لأخرى
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* From Treasury */}
                    <div className="space-y-2">
                        <Label>من خزنة</Label>
                        <Select value={fromTreasuryId} onValueChange={setFromTreasuryId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الخزنة المصدر" />
                            </SelectTrigger>
                            <SelectContent>
                                {treasuries?.filter(t => t.id !== toTreasuryId).map((treasury) => (
                                    <SelectItem key={treasury.id} value={treasury.id}>
                                        <div className="flex justify-between w-full gap-4">
                                            <span>{treasury.name}</span>
                                            <span className="text-muted-foreground">
                                                {formatCurrency(treasury.balance)}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fromTreasury && (
                            <p className="text-sm text-muted-foreground">
                                الرصيد الحالي: <span className="font-medium">{formatCurrency(fromTreasury.balance)}</span>
                            </p>
                        )}
                    </div>

                    {/* To Treasury */}
                    <div className="space-y-2">
                        <Label>إلى خزنة</Label>
                        <Select value={toTreasuryId} onValueChange={setToTreasuryId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الخزنة الهدف" />
                            </SelectTrigger>
                            <SelectContent>
                                {treasuries?.filter(t => t.id !== fromTreasuryId).map((treasury) => (
                                    <SelectItem key={treasury.id} value={treasury.id}>
                                        <div className="flex justify-between w-full gap-4">
                                            <span>{treasury.name}</span>
                                            <span className="text-muted-foreground">
                                                {formatCurrency(treasury.balance)}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">المبلغ</Label>
                        <Input
                            id="amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={fromTreasury?.balance || undefined}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="سبب التحويل..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="submit"
                            disabled={transferMutation.isPending || !fromTreasuryId || !toTreasuryId || !amount}
                        >
                            {transferMutation.isPending ? 'جاري التحويل...' : 'تنفيذ التحويل'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default TreasuryTransferModal;
