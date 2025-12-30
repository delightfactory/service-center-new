import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

// ============================================================
// PageHeader - مكون موحد لعنوان الصفحة
// ============================================================

interface PageHeaderProps {
    title: string;
    description?: string;
    backLink?: string;
    actions?: React.ReactNode;
    showBreadcrumbs?: boolean;
    className?: string;
}

export function PageHeader({
    title,
    description,
    backLink,
    actions,
    showBreadcrumbs = true,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("space-y-2", className)}>
            {/* Breadcrumbs */}
            {showBreadcrumbs && <Breadcrumbs />}

            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    {backLink && (
                        <Button variant="ghost" size="icon" asChild className="shrink-0">
                            <Link to={backLink}>
                                <ChevronLeft size={20} />
                            </Link>
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                        {description && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {actions && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PageHeader;
