import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

// ============================================================
// Add Job Task Modal Component
// ============================================================
// إضافة مهمة جديدة لأمر الشغل (ToDo للفني)
// منفصل عن بنود الفاتورة (job_items)
// ============================================================

interface AddJobTaskModalProps {
    jobOrderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface TaskForm {
    description: string;
    notes: string;
}

const initialForm: TaskForm = {
    description: '',
    notes: '',
};

export function AddJobTaskModal({
    jobOrderId,
    open,
    onOpenChange,
    onSuccess,
}: AddJobTaskModalProps) {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<TaskForm>(initialForm);
    const [error, setError] = useState<string | null>(null);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: TaskForm) => {
            const { data: result, error } = await supabase
                .from('job_tasks')
                .insert({
                    job_order_id: jobOrderId,
                    description: data.description,
                    notes: data.notes || null,
                    created_by: profile?.id,
                })
                .select()
                .single();

            if (error) throw error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-tasks', jobOrderId] });
            onOpenChange(false);
            setForm(initialForm);
            setError(null);
            onSuccess?.();
        },
        onError: (err) => {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
        },
    });

    const handleSubmit = () => {
        if (!form.description.trim()) {
            setError('يرجى إدخال وصف المهمة');
            return;
        }
        createMutation.mutate(form);
    };

    const handleClose = () => {
        onOpenChange(false);
        setForm(initialForm);
        setError(null);
    };

    // Quick task templates
    const quickTasks = [
        'فحص الفرامل',
        'تغيير الزيت',
        'فحص التكييف',
        'فحص العفشة',
        'فحص الكهرباء',
        'تغيير الفلتر',
    ];

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList size={20} />
                        إضافة مهمة جديدة
                    </DialogTitle>
                    <DialogDescription>
                        مهمة للفني (ستظهر في قائمة ToDo)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Quick Tasks */}
                    <div>
                        <Label className="mb-2 block text-sm">مهام سريعة</Label>
                        <div className="flex flex-wrap gap-2">
                            {quickTasks.map((task) => (
                                <button
                                    key={task}
                                    type="button"
                                    onClick={() => setForm({ ...form, description: task })}
                                    className="px-3 py-1.5 text-xs rounded-full border hover:bg-primary/10 hover:border-primary transition-colors"
                                >
                                    {task}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">وصف المهمة *</Label>
                        <Input
                            id="description"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="مثال: فحص الفرامل الأمامية"
                            className="mt-1"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                        <Textarea
                            id="notes"
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="أي تفاصيل إضافية..."
                            className="mt-1 min-h-[80px]"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
                        {createMutation.isPending ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                جاري الحفظ...
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                إضافة المهمة
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AddJobTaskModal;
