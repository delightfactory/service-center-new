import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Banknote, Smartphone, CheckCircle2 } from 'lucide-react';
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
// Payment Modal - تسجيل دفعة
// ============================================================

interface PaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: {
        id: string;
        code: string;
        total_amount: number;
        paid_amount: number;
        remaining_amount: number;
        customer_name?: string;
        supplier_name?: string;
        invoice_type?: 'sales' | 'purchase' | 'sales_return' | 'purchase_return';
    } | null;
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'e_wallet' | 'check';

interface Treasury {
    id: string;
    name: string;
    treasury_type: string;
}

const paymentMethodConfig: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
    cash: { label: 'نقدي', icon: <Banknote size={20} /> },
    bank_transfer: { label: 'تحويل بنكي', icon: <CreditCard size={20} /> },
    card: { label: 'بطاقة', icon: <CreditCard size={20} /> },
    e_wallet: { label: 'محفظة إلكترونية', icon: <Smartphone size={20} /> },
    check: { label: 'شيك', icon: <CheckCircle2 size={20} /> },
};

export function PaymentModal({ open, onOpenChange, invoice }: PaymentModalProps) {
    const queryClient = useQueryClient();

    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [treasuryId, setTreasuryId] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    // Fetch treasuries
    const { data: treasuries } = useQuery({
        queryKey: ['treasuries-payment'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('treasuries')
                .select('id, name, treasury_type')
                .eq('is_active', true)
                .order('is_default', { ascending: false });
            if (error) throw error;
            return data as Treasury[];
        },
        enabled: open,
    });

    // Set default treasury when loaded
    React.useEffect(() => {
        if (treasuries && treasuries.length > 0 && !treasuryId) {
            setTreasuryId(treasuries[0].id);
        }
    }, [treasuries, treasuryId]);

    // Set default amount to remaining
    React.useEffect(() => {
        if (open && invoice && invoice.remaining_amount > 0) {
            setAmount(invoice.remaining_amount.toString());
        }
    }, [open, invoice]);

    // Reset form
    const resetForm = () => {
        setAmount('');
        setPaymentMethod('cash');
        setTreasuryId('');
        setReference('');
        setNotes('');
    };

    // Create payment mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!invoice) return;

            const paymentAmount = parseFloat(amount);
            if (!paymentAmount || paymentAmount <= 0) {
                throw new Error('يرجى إدخال مبلغ صحيح');
            }
            if (paymentAmount > invoice.remaining_amount) {
                throw new Error('المبلغ أكبر من المتبقي');
            }
            if (!treasuryId) {
                throw new Error('يرجى اختيار الخزنة');
            }

            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user?.id)
                .single();

            // Fetch the invoice to get customer_id, supplier_id, branch_id, and invoice_type
            const { data: invoiceData, error: invoiceFetchError } = await supabase
                .from('invoices')
                .select('customer_id, supplier_id, branch_id, invoice_type')
                .eq('id', invoice.id)
                .single();

            if (invoiceFetchError) throw invoiceFetchError;

            // Determine payment_type based on invoice_type
            const isPurchaseInvoice = invoiceData?.invoice_type === 'purchase' || invoiceData?.invoice_type === 'purchase_return';
            const paymentTypeValue = isPurchaseInvoice ? 'supplier_payment' : 'customer_receipt';

            // Get branch_id from profile or invoice
            const branchId = profile?.branch_id || invoiceData?.branch_id;
            if (!branchId) {
                throw new Error('لم يتم تحديد الفرع');
            }

            // Create payment record - trigger will create treasury_transaction automatically
            const paymentData = {
                payment_type: paymentTypeValue,
                payment_method: paymentMethod === 'e_wallet' ? 'online' :
                    paymentMethod === 'check' ? 'cheque' : paymentMethod,
                treasury_id: treasuryId,
                invoice_id: invoice.id,
                customer_id: isPurchaseInvoice ? null : (invoiceData?.customer_id || null),
                supplier_id: isPurchaseInvoice ? (invoiceData?.supplier_id || null) : null,
                amount: paymentAmount,
                payment_date: new Date().toISOString().split('T')[0],
                reference: reference || null,
                notes: notes || null,
                branch_id: branchId,
                created_by: user?.id,
            };

            console.log('Payment data:', paymentData);

            const { error: paymentError } = await supabase
                .from('payments')
                .insert(paymentData);

            if (paymentError) {
                console.error('Payment error details:', paymentError);
                throw paymentError;
            }

            // Note: invoice.paid_amount and status are updated by database trigger
            // No manual update needed - the trigger handles this automatically
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['treasuries'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            onOpenChange(false);
            resetForm();
        },
        onError: (error: Error) => {
            console.error('Payment error:', error);
            alert(error.message || 'فشل تسجيل الدفعة');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate();
    };

    if (!invoice) return null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            onOpenChange(isOpen);
            if (!isOpen) resetForm();
        }}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تسجيل دفعة</DialogTitle>
                    <DialogDescription>
                        فاتورة: {invoice.code}
                        {invoice.customer_name && ` - ${invoice.customer_name}`}
                    </DialogDescription>
                </DialogHeader>

                {/* Invoice Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg text-center">
                    <div>
                        <p className="text-xs text-muted-foreground">الإجمالي</p>
                        <p className="font-bold">{formatCurrency(invoice.total_amount)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">المدفوع</p>
                        <p className="font-bold text-green-600">{formatCurrency(invoice.paid_amount)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">المتبقي</p>
                        <p className="font-bold text-red-600">{formatCurrency(invoice.remaining_amount)}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>المبلغ *</Label>
                        <Input
                            type="number"
                            min="0.01"
                            max={invoice.remaining_amount}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            dir="ltr"
                            className="text-lg font-bold"
                            required
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setAmount(invoice.remaining_amount.toString())}
                        >
                            تسديد كامل المتبقي ({formatCurrency(invoice.remaining_amount)})
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>طريقة الدفع</Label>
                            <Select
                                value={paymentMethod}
                                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(paymentMethodConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            <div className="flex items-center gap-2">
                                                {config.icon}
                                                {config.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>الخزنة *</Label>
                            <Select value={treasuryId} onValueChange={setTreasuryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الخزنة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuries?.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {(paymentMethod === 'bank_transfer' || paymentMethod === 'check') && (
                        <div className="space-y-2">
                            <Label>رقم المرجع / الشيك</Label>
                            <Input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="رقم التحويل أو الشيك..."
                                dir="ltr"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ملاحظات إضافية..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="gap-2"
                        >
                            {createMutation.isPending ? 'جاري التسجيل...' : (
                                <>
                                    <CheckCircle2 size={18} />
                                    تأكيد الدفع
                                </>
                            )}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default PaymentModal;
