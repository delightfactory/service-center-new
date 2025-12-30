import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Save } from 'lucide-react';
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

// ============================================================
// Edit Job Task Modal Component
// ============================================================

interface EditJobTaskModalProps {
    task: {
        id: string;
        description: string;
        notes: string | null;
        is_completed: boolean;
        is_blocked: boolean;
        blocked_reason: string | null;
    } | null;
    jobOrderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditJobTaskModal({
    task,
    jobOrderId,
    open,
    onOpenChange,
}: EditJobTaskModalProps) {
    const queryClient = useQueryClient();
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Reset form when task changes
    useEffect(() => {
        if (task) {
            setDescription(task.description);
            setNotes(task.notes || '');
        }
    }, [task]);

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!task) return;
            const { error } = await supabase
                .from('job_tasks')
                .update({
                    description,
                    notes: notes || null,
                })
                .eq('id', task.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-tasks', jobOrderId] });
            onOpenChange(false);
            setError(null);
        },
        onError: (err) => {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
        },
    });

    const handleSubmit = () => {
        if (!description.trim()) {
            setError('يرجى إدخال وصف المهمة');
            return;
        }
        updateMutation.mutate();
    };

    if (!task) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit size={20} />
                        تعديل المهمة
                    </DialogTitle>
                    <DialogDescription>
                        تعديل تفاصيل المهمة
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="description">وصف المهمة *</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ملاحظات إضافية..."
                            className="mt-1 min-h-[80px]"
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

export default EditJobTaskModal;
