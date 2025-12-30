// ============================================================
// Low Stock Alerts Card - بطاقة تنبيهات نقص المخزون
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, ChevronLeft, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLowStockAlerts } from '@/lib/hooks/inventory/useInventoryAlerts';

interface LowStockAlertsCardProps {
    branchId?: string;
    limit?: number;
    className?: string;
}

export function LowStockAlertsCard({ branchId, limit = 5, className }: LowStockAlertsCardProps) {
    const { data: products, isLoading, error, refetch, isFetching } = useLowStockAlerts({
        branchId,
        limit,
    });

    const getStockLevelColor = (percentage: number) => {
        if (percentage <= 0) return 'bg-red-500';
        if (percentage <= 25) return 'bg-red-400';
        if (percentage <= 50) return 'bg-orange-400';
        if (percentage <= 75) return 'bg-yellow-400';
        return 'bg-green-400';
    };

    const getStockLevelBadge = (percentage: number) => {
        if (percentage <= 0) return { label: 'نفذ', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
        if (percentage <= 25) return { label: 'حرج', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
        if (percentage <= 50) return { label: 'منخفض', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
        return { label: 'تحذير', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
    };

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-2 w-full" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={className}>
                <CardContent className="p-6 text-center">
                    <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">خطأ في تحميل تنبيهات المخزون</p>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">
                        إعادة المحاولة
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const hasAlerts = products && products.length > 0;

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className={cn(
                            "w-5 h-5",
                            hasAlerts ? "text-orange-500" : "text-muted-foreground"
                        )} />
                        تنبيهات المخزون
                        {hasAlerts && (
                            <Badge variant="secondary" className="mr-2">
                                {products.length}
                            </Badge>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="h-8 w-8"
                    >
                        <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {!hasAlerts ? (
                    <div className="text-center py-6">
                        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">
                            جميع المنتجات فوق الحد الأدنى ✓
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {products.map((product) => {
                            const badge = getStockLevelBadge(product.stock_percentage);
                            return (
                                <Link
                                    key={product.id}
                                    to={`/dashboard/inventory/products/${product.id}`}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm truncate">
                                                {product.name}
                                            </span>
                                            <Badge className={cn("text-xs", badge.color)}>
                                                {badge.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Progress
                                                value={Math.max(0, Math.min(100, product.stock_percentage))}
                                                className="h-1.5 flex-1"
                                                indicatorClassName={getStockLevelColor(product.stock_percentage)}
                                            />
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {product.available_quantity} / {product.min_stock} {product.unit}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            );
                        })}

                        {products.length >= limit && (
                            <Link
                                to="/dashboard/inventory?filter=low-stock"
                                className="block text-center text-sm text-primary hover:underline pt-2"
                            >
                                عرض الكل ({products.length}+)
                            </Link>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default LowStockAlertsCard;
