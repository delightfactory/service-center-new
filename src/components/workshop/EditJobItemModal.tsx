import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Save, Package, Wrench, Settings, Truck, FileText, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
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
import type { JobItemType } from '@/types/enums';

// ============================================================
// Edit Job Item Modal Component
// ============================================================

interface EditJobItemModalProps {
    item: {
        id: string;
        item_type: JobItemType;
        description: string;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        notes: string | null;
        is_completed: boolean;
    } | null;
    jobOrderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ITEM_TYPE_OPTIONS: { value: JobItemType; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'labor', label: 'عمالة', icon: Wrench, color: 'text-blue-500' },
    { value: 'part', label: 'قطعة غيار', icon: Package, color: 'text-green-500' },
    { value: 'consumable', label: 'مستهلكات', icon: Settings, color: 'text-orange-500' },
    { value: 'external', label: 'خدمة خارجية', icon: Truck, color: 'text-purple-500' },
    { value: 'note', label: 'ملاحظة', icon: FileText, color: 'text-gray-500' },
    { value: 'warranty', label: 'ضمان', icon: Shield, color: 'text-green-500' },
];

export function EditJobItemModal({
    item,
    jobOrderId,
    open,
    onOpenChange,
}: EditJobItemModalProps) {
    const queryClient = useQueryClient();
    const [itemType, setItemType] = useState<JobItemType>('labor');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Reset form when item changes
    useEffect(() => {
        if (item) {
            setItemType(item.item_type);
            setDescription(item.description);
            setQuantity(item.quantity);
            setUnitPrice(item.unit_price);
            setDiscountPercent(item.discount_percent);
            setNotes(item.notes || '');
        }
    }, [item]);

    const total = quantity * unitPrice * (1 - discountPercent / 100);

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!item) return;
            const { error } = await supabase
                .from('job_items')
                .update({
                    item_type: itemType,
                    description,
                    quantity,
                    unit_price: unitPrice,
                    discount_percent: discountPercent,
                    notes: notes || null,
                })
                .eq('id', item.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-items', jobOrderId] });
            onOpenChange(false);
            setError(null);
        },
        onError: (err) => {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
        },
    });

    const handleSubmit = () => {
        if (!description.trim()) {
            setError('يرجى إدخال وصف البند');
            return;
        }
        updateMutation.mutate();
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit size={20} />
                        تعديل البند
                    </DialogTitle>
                    <DialogDescription>
                        تعديل تفاصيل بند الصيانة
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Item Type */}
                    <div>
                        <Label className="mb-2 block">نوع البند</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {ITEM_TYPE_OPTIONS.slice(0, 4).map((option) => {
                                const Icon = option.icon;
                                const isSelected = itemType === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setItemType(option.value)}
                                        className={cn(
                                            "p-2 rounded-lg border-2 flex items-center gap-2 transition-all text-sm",
                                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                        )}
                                    >
                                        <Icon size={16} className={option.color} />
                                        <span>{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">الوصف *</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 min-h-[60px]"
                        />
                    </div>

                    {/* Quantity, Price, Discount */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label>الكمية</Label>
                            <Input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={quantity}
                                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                className="mt-1"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <Label>سعر الوحدة</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={unitPrice}
                                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                                className="mt-1"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <Label>الخصم %</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={discountPercent}
                                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                                className="mt-1"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {/* Total */}
                    <div className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
                        <span className="text-muted-foreground">الإجمالي:</span>
                        <span className="text-xl font-bold text-primary">
                            {total.toLocaleString('ar-EG')} ج.م
                        </span>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="gap-2">
                        {updateMutation.isPending ? (
                            <>جاري الحفظ...</>
                        ) : (
                            <>
                                <Save size={18} />
                                حفظ التعديلات
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default EditJobItemModal;
