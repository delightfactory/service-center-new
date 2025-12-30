import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// EmptyState - مكون حالة الفراغ الموحدة
// ============================================================

interface EmptyStateProps {
    icon?: React.ElementType;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-12 px-4 text-center",
            className
        )}>
            {Icon && (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Icon size={32} className="text-muted-foreground" />
                </div>
            )}
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}

export default EmptyState;
