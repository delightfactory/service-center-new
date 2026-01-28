import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// ============================================================
// Add Job Task Modal Component - Multi-Task Support
// ============================================================
// إضافة مهام متعددة لأمر الشغل دفعة واحدة
// تحسين تجربة المستخدم بدلاً من إضافة مهمة واحدة في كل مرة
// ============================================================

interface AddJobTaskModalProps {
    jobOrderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface TaskItem {
    id: string;
    description: string;
}

// Quick task templates
const QUICK_TASKS = [
    'فحص الفرامل',
    'تغيير الزيت',
    'فحص التكييف',
    'فحص العفشة',
    'فحص الكهرباء',
    'تغيير الفلتر',
    'فحص البطارية',
    'فحص الإطارات',
    'فحص المحرك',
    'فحص ناقل الحركة',
];

export function AddJobTaskModal({
    jobOrderId,
    open,
    onOpenChange,
    onSuccess,
}: AddJobTaskModalProps) {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Generate unique ID for each task
    const generateId = () => `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Add task to list
    const addTask = (description: string) => {
        const trimmed = description.trim();
        if (!trimmed) return;

        // Check for duplicates
        if (tasks.some(t => t.description.toLowerCase() === trimmed.toLowerCase())) {
            setError('هذه المهمة موجودة بالفعل');
            return;
        }

        setTasks([...tasks, { id: generateId(), description: trimmed }]);
        setCurrentInput('');
        setError(null);
    };

    // Remove task from list
    const removeTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    // Handle quick task click
    const handleQuickTaskClick = (task: string) => {
        if (!tasks.some(t => t.description.toLowerCase() === task.toLowerCase())) {
            addTask(task);
        }
    };

    // Handle input key press (Enter to add)
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTask(currentInput);
        }
    };

    // Create mutation for batch insert
    const createMutation = useMutation({
        mutationFn: async (taskList: TaskItem[]) => {
            const insertData = taskList.map(task => ({
                job_order_id: jobOrderId,
                description: task.description,
                created_by: profile?.id,
            }));

            const { data, error } = await supabase
                .from('job_tasks')
                .insert(insertData)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-tasks', jobOrderId] });
            handleClose();
            onSuccess?.();
        },
        onError: (err) => {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
        },
    });

    const handleSubmit = () => {
        if (tasks.length === 0) {
            setError('يرجى إضافة مهمة واحدة على الأقل');
            return;
        }
        createMutation.mutate(tasks);
    };

    const handleClose = () => {
        onOpenChange(false);
        setTasks([]);
        setCurrentInput('');
        setError(null);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList size={20} />
                        إضافة مهام
                    </DialogTitle>
                    <DialogDescription>
                        يمكنك إضافة عدة مهام دفعة واحدة - حدد من القائمة أو أدخل مهمة مخصصة
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Quick Tasks as chips */}
                    <div>
                        <Label className="mb-2 block text-sm">اختر من المهام السريعة</Label>
                        <div className="flex flex-wrap gap-2">
                            {QUICK_TASKS.map((task) => {
                                const isSelected = tasks.some(t => t.description.toLowerCase() === task.toLowerCase());
                                return (
                                    <button
                                        key={task}
                                        type="button"
                                        onClick={() => handleQuickTaskClick(task)}
                                        disabled={isSelected}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${isSelected
                                                ? 'bg-primary text-primary-foreground border-primary cursor-not-allowed'
                                                : 'hover:bg-primary/10 hover:border-primary'
                                            }`}
                                    >
                                        {isSelected && <CheckCircle2 size={12} className="inline-block ml-1" />}
                                        {task}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom task input */}
                    <div>
                        <Label htmlFor="customTask">أو أدخل مهمة مخصصة</Label>
                        <div className="flex gap-2 mt-1">
                            <Input
                                id="customTask"
                                value={currentInput}
                                onChange={(e) => setCurrentInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="اكتب وصف المهمة واضغط Enter أو +"
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                onClick={() => addTask(currentInput)}
                                disabled={!currentInput.trim()}
                            >
                                <Plus size={18} />
                            </Button>
                        </div>
                    </div>

                    {/* Tasks list */}
                    {tasks.length > 0 && (
                        <div>
                            <Label className="mb-2 block text-sm">
                                المهام المحددة ({tasks.length})
                            </Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-muted/30 rounded-lg">
                                {tasks.map((task, index) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between gap-2 p-2 bg-background rounded-md border"
                                    >
                                        <span className="flex items-center gap-2 text-sm">
                                            <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                                                {index + 1}
                                            </Badge>
                                            {task.description}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeTask(task.id)}
                                            className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={createMutation.isPending || tasks.length === 0}
                        className="gap-2"
                    >
                        {createMutation.isPending ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                جاري الحفظ...
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                حفظ {tasks.length > 0 ? `(${tasks.length} مهام)` : ''}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AddJobTaskModal;
