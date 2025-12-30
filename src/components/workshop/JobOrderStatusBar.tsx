import React from 'react';
import { Clock, Play, Pause, FileText, CheckCircle2, Car, Circle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JOB_STATUSES, type JobStatus } from '@/types/enums';

// ============================================================
// Job Order Status Bar Component
// ============================================================

// خط سير الحالات
const STATUS_WORKFLOW: JobStatus[] = ['draft', 'pending', 'in_progress', 'paused', 'review', 'completed', 'delivered'];

// ألوان الحالات
const statusStyles: Record<JobStatus, { bg: string; text: string; icon: React.ElementType }> = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: Circle },
    pending: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Clock },
    in_progress: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', icon: Play },
    paused: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: Pause },
    review: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: FileText },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
    delivered: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', icon: Car },
    cancelled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500', icon: XCircle },
};

// تحديد الحالات التالية المتاحة
function getNextStatuses(currentStatus: JobStatus): JobStatus[] {
    switch (currentStatus) {
        case 'draft':
            return ['pending'];
        case 'pending':
            return ['in_progress'];
        case 'in_progress':
            return ['paused', 'review'];
        case 'paused':
            return ['in_progress', 'review'];
        case 'review':
            return ['completed', 'in_progress'];
        case 'completed':
            return ['delivered'];
        case 'delivered':
        case 'cancelled':
            return [];
        default:
            return [];
    }
}

interface JobOrderStatusBarProps {
    currentStatus: JobStatus;
    onStatusChange: (status: JobStatus) => void;
    isUpdating: boolean;
}

export function JobOrderStatusBar({ currentStatus, onStatusChange, isUpdating }: JobOrderStatusBarProps) {
    const nextStatuses = getNextStatuses(currentStatus);

    if (nextStatuses.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-sm text-muted-foreground shrink-0">الإجراء التالي:</span>
            <div className="flex items-center gap-2 flex-wrap">
                {nextStatuses.map(status => {
                    const style = statusStyles[status];
                    const Icon = style.icon;
                    return (
                        <Button
                            key={status}
                            size="sm"
                            variant="outline"
                            className={cn("gap-1", style.bg, style.text, "hover:opacity-80")}
                            onClick={() => onStatusChange(status)}
                            disabled={isUpdating}
                        >
                            <Icon size={14} />
                            {status === 'in_progress' && currentStatus === 'paused'
                                ? 'استئناف'
                                : JOB_STATUSES[status]}
                            <ChevronLeft size={14} />
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

export { getNextStatuses };
