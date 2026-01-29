import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Users, Receipt, RefreshCw, MoreVertical,
    Printer, XCircle, Crown, Clock, Play, Pause, FileText,
    CheckCircle2, Car, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { JOB_STATUSES, JOB_CATEGORIES, PRIORITY_LEVELS, type JobStatus, type PriorityLevel } from '@/types/enums';
import type { AssignedTech, LinkedInvoice } from './types';

// ============================================================
// Job Order Header Component
// ============================================================

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

// ألوان الأولوية
const priorityStyles: Record<PriorityLevel, string> = {
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    normal: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

interface JobOrderHeaderProps {
    code: string;
    status: JobStatus;
    priority: PriorityLevel;
    jobCategory: string;
    createdAt: string;
    linkedInvoice?: LinkedInvoice | null;
    assignedTechs?: AssignedTech[];
    hasItems: boolean;
    onRefresh: () => void;
    onAssignTech: () => void;
    onCreateInvoice: () => void;
    onStatusChange: (status: JobStatus) => void;
}

export function JobOrderHeader({
    code,
    status,
    priority,
    jobCategory,
    createdAt,
    linkedInvoice,
    assignedTechs,
    hasItems,
    onRefresh,
    onAssignTech,
    onCreateInvoice,
    onStatusChange,
}: JobOrderHeaderProps) {
    const currentStatusStyle = statusStyles[status];
    const StatusIcon = currentStatusStyle.icon;

    // Permission checks
    const permissions = usePermissions();
    const canManageJobOrders = permissions.canManage('job_orders') || permissions.canUpdate('job_orders');
    const canCreateInvoice = permissions.canCreate('invoices');
    const canDeleteJobOrder = permissions.canDelete('job_orders');

    return (
        <div className="bg-card border rounded-xl p-4 sticky top-0 z-10">
            {/* الصف العلوي */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                        <Link to="/dashboard/workshop">
                            <ArrowRight size={20} />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold">{code}</h1>
                            <Badge className={cn(currentStatusStyle.bg, currentStatusStyle.text)}>
                                <StatusIcon size={14} className="ml-1" />
                                {JOB_STATUSES[status]}
                            </Badge>
                            {priority !== 'normal' && (
                                <Badge className={priorityStyles[priority]}>
                                    {PRIORITY_LEVELS[priority]}
                                </Badge>
                            )}
                            {linkedInvoice && (
                                <Badge className={cn(
                                    linkedInvoice.status === 'draft'
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : linkedInvoice.status === 'approved'
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                            : linkedInvoice.status === 'paid'
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                )}>
                                    <Receipt size={12} className="ml-1" />
                                    {linkedInvoice.status === 'draft' ? 'فاتورة مسودة' :
                                        linkedInvoice.status === 'approved' ? 'فاتورة معتمدة' :
                                            linkedInvoice.status === 'paid' ? 'مدفوعة' :
                                                linkedInvoice.status === 'partially_paid' ? 'مدفوعة جزئياً' : 'مفوتر'}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {JOB_CATEGORIES[jobCategory as keyof typeof JOB_CATEGORIES] || jobCategory}
                            {' • '}
                            {formatDate(createdAt)}
                        </p>
                    </div>
                </div>

                {/* أزرار التحكم */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={onRefresh}>
                        <RefreshCw size={16} />
                    </Button>
                    {canManageJobOrders && (
                        <Button variant="outline" size="sm" onClick={onAssignTech} className="gap-1">
                            <Users size={16} />
                            <span className="hidden sm:inline">الفنيين</span>
                            {assignedTechs && assignedTechs.length > 0 && (
                                <Badge variant="secondary" className="mr-1">{assignedTechs.length}</Badge>
                            )}
                        </Button>
                    )}
                    {linkedInvoice ? (
                        <Button variant="outline" size="sm" asChild className="gap-1">
                            <Link to={`/dashboard/finance/invoices/${linkedInvoice.id}`}>
                                <Receipt size={16} />
                                <span className="hidden sm:inline">{linkedInvoice.code}</span>
                            </Link>
                        </Button>
                    ) : canCreateInvoice && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCreateInvoice}
                            disabled={!hasItems}
                            className="gap-1"
                        >
                            <Receipt size={16} />
                            <span className="hidden sm:inline">إنشاء فاتورة</span>
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <MoreVertical size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem className="gap-2">
                                <Printer size={16} />
                                طباعة
                            </DropdownMenuItem>
                            {canDeleteJobOrder && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="gap-2 text-destructive"
                                        onClick={() => onStatusChange('cancelled')}
                                        disabled={status === 'cancelled' || status === 'delivered'}
                                    >
                                        <XCircle size={16} />
                                        إلغاء الأمر
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* الفنيين المعينين */}
            {assignedTechs && assignedTechs.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <span className="text-sm text-muted-foreground">الفنيين:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                        {assignedTechs.map(at => (
                            <Badge
                                key={at.id}
                                variant="secondary"
                                className={cn("gap-1", at.is_lead && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400")}
                            >
                                {at.is_lead && <Crown size={12} />}
                                {at.technician?.full_name}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export { statusStyles, priorityStyles };
