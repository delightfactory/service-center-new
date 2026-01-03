import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveTableProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Responsive table wrapper that adds horizontal scroll on mobile
 * while maintaining full-width on desktop
 */
export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
    return (
        <div className={cn(
            // Mobile: horizontal scroll with negative margin to use full width
            '-mx-4 md:mx-0',
            // Add padding back inside
            'px-4 md:px-0',
            className
        )}>
            <div className="overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface ResponsiveCardGridProps {
    children: React.ReactNode;
    className?: string;
    cols?: {
        default?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
}

/**
 * Responsive grid for cards that adapts to screen size
 */
export function ResponsiveCardGrid({
    children,
    className,
    cols = { default: 1, sm: 2, lg: 3, xl: 4 }
}: ResponsiveCardGridProps) {
    const gridCols = cn(
        cols.default && `grid-cols-${cols.default}`,
        cols.sm && `sm:grid-cols-${cols.sm}`,
        cols.md && `md:grid-cols-${cols.md}`,
        cols.lg && `lg:grid-cols-${cols.lg}`,
        cols.xl && `xl:grid-cols-${cols.xl}`,
    );

    return (
        <div className={cn('grid gap-4', gridCols, className)}>
            {children}
        </div>
    );
}

interface ResponsiveFormGridProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Form grid that stacks on mobile and uses 2 columns on larger screens
 */
export function ResponsiveFormGrid({ children, className }: ResponsiveFormGridProps) {
    return (
        <div className={cn(
            'grid grid-cols-1 md:grid-cols-2 gap-4',
            className
        )}>
            {children}
        </div>
    );
}

interface MobileCardViewProps<T> {
    data: T[];
    renderCard: (item: T, index: number) => React.ReactNode;
    className?: string;
}

/**
 * Component to render data as cards on mobile (alternative to tables)
 */
export function MobileCardView<T>({ data, renderCard, className }: MobileCardViewProps<T>) {
    return (
        <div className={cn('space-y-3', className)}>
            {data.map((item, index) => renderCard(item, index))}
        </div>
    );
}

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Standard page container with responsive padding
 */
export function PageContainer({ children, className }: PageContainerProps) {
    return (
        <div className={cn(
            'space-y-4 md:space-y-6',
            className
        )}>
            {children}
        </div>
    );
}

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

/**
 * Responsive page header with title and optional actions
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div className={cn(
            'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
            className
        )}>
            <div className="space-y-1">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

/**
 * Responsive stat card for dashboards
 */
export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
    return (
        <div className={cn(
            'bg-card rounded-lg border p-4 md:p-6',
            className
        )}>
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                {icon && (
                    <div className="text-muted-foreground">{icon}</div>
                )}
            </div>
            <div className="mt-2">
                <p className="text-2xl md:text-3xl font-bold">{value}</p>
                {trend && (
                    <p className={cn(
                        'text-xs mt-1',
                        trend.isPositive ? 'text-green-600' : 'text-red-600'
                    )}>
                        {trend.isPositive ? '+' : ''}{trend.value}%
                    </p>
                )}
            </div>
        </div>
    );
}
