import React from 'react';
import { CheckCircle2, Plus, Edit, Trash2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import type { JobTask } from './types';

// ============================================================
// Job Tasks Section Component
// ============================================================

interface JobTasksSectionProps {
    tasks: JobTask[];
    onAddTask: () => void;
    onEditTask: (task: JobTask) => void;
    onDeleteTask: (taskId: string) => void;
    onToggleTask: (taskId: string, isCompleted: boolean) => void;
    isToggling: boolean;
}

export function JobTasksSection({
    tasks,
    onAddTask,
    onEditTask,
    onDeleteTask,
    onToggleTask,
    isToggling,
}: JobTasksSectionProps) {
    const completedCount = tasks.filter(t => t.is_completed).length;
    const permissions = usePermissions();

    // Permission checks for job_tasks resource
    const canCreateTask = permissions.canCreate('job_tasks');
    const canUpdateTask = permissions.canUpdate('job_tasks');
    const canDeleteTask = permissions.canDelete('job_tasks');

    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    المهام ({completedCount}/{tasks.length})
                </CardTitle>
                {canCreateTask && (
                    <Button size="sm" variant="outline" onClick={onAddTask}>
                        <Plus size={14} className="ml-1" />
                        إضافة
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {tasks.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        لا توجد مهام - أضف مهام ليراها الفني
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className={cn(
                                    'flex items-center gap-3 p-2.5 rounded-lg border transition-colors group',
                                    task.is_completed && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                                    task.is_blocked && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                                )}
                            >
                                <button
                                    onClick={() => onToggleTask(task.id, !task.is_completed)}
                                    disabled={isToggling}
                                    className={cn(
                                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                        task.is_completed ? 'bg-green-500 border-green-500' :
                                            task.is_blocked ? 'bg-red-200 border-red-400' :
                                                'border-gray-300 hover:border-primary'
                                    )}
                                >
                                    {task.is_completed && <Check size={12} className="text-white" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-sm', task.is_completed && 'line-through text-muted-foreground')}>
                                        {task.description}
                                    </p>
                                    {task.is_blocked && task.blocked_reason && (
                                        <p className="text-xs text-red-600 mt-0.5">⚠️ {task.blocked_reason}</p>
                                    )}
                                </div>
                                {!task.is_completed && (canUpdateTask || canDeleteTask) && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                        {canUpdateTask && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditTask(task)}>
                                                <Edit size={14} />
                                            </Button>
                                        )}
                                        {canDeleteTask && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => { if (confirm('هل تريد حذف هذه المهمة؟')) onDeleteTask(task.id); }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
