import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ============================================================
// LoadingState - حالات التحميل الموحدة
// ============================================================

interface LoadingStateProps {
    variant?: 'page' | 'card' | 'table' | 'inline';
    rows?: number;
    className?: string;
}

export function LoadingState({
    variant = 'page',
    rows = 5,
    className,
}: LoadingStateProps) {
    if (variant === 'inline') {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-24" />
            </div>
        );
    }

    if (variant === 'table') {
        return (
            <div className={cn("space-y-3", className)}>
                {Array.from({ length: rows }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <Card className={className}>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: rows }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    // Default: page
    return (
        <div className={cn("space-y-6", className)}>
            <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64" />
        </div>
    );
}

export default LoadingState;
