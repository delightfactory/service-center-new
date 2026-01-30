import React from 'react';
import { Package, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { JOB_ITEM_TYPES } from '@/types/enums';
import type { JobItem } from './types';

// ============================================================
// Job Items Section Component
// ============================================================

interface JobItemsSectionProps {
    items: JobItem[];
    onAddItem: () => void;
    onEditItem: (item: JobItem) => void;

    onDeleteItem: (itemId: string) => void;
    onDispense?: () => void;
    isDispensing?: boolean;
}

export function JobItemsSection({
    items,
    onAddItem,
    onEditItem,
    onDeleteItem,
    onDispense,
    isDispensing,
}: JobItemsSectionProps) {
    // حساب الإجماليات
    const totals = React.useMemo(() => {
        const labor = items
            .filter(i => i.item_type === 'labor')
            .reduce((sum, i) => sum + i.total_price, 0);
        const parts = items
            .filter(i => i.item_type === 'part')
            .reduce((sum, i) => sum + i.total_price, 0);
        const total = items.reduce((sum, i) => sum + i.total_price, 0);
        return { labor, parts, total };
    }, [items]);

    const hasUndispensedItems = items.some(i =>
        !!i.product_id &&
        (i.item_type === 'part' || i.item_type === 'consumable') &&
        !i.is_dispensed
    );

    // Permission checks
    const permissions = usePermissions();
    const canUpdateJobOrder = permissions.canUpdate('job_orders');
    const canManageInventory = permissions.canManage('inventory');

    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <Package size={18} />
                    البنود
                </CardTitle>
                <div className="flex items-center gap-2">
                    {onDispense && hasUndispensedItems && canManageInventory && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onDispense}
                            disabled={isDispensing}
                            className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                        >
                            {isDispensing ? 'جاري الصرف...' : 'صرف القطع'}
                        </Button>
                    )}
                    {canUpdateJobOrder && (
                        <Button size="sm" onClick={onAddItem}>
                            <Plus size={14} className="ml-1" />
                            إضافة بند
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        لا توجد بنود مضافة
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div key={item.id} className="p-2.5 rounded-lg border group hover:bg-muted/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{JOB_ITEM_TYPES[item.item_type]}</Badge>
                                        <span className="text-sm">{item.description}</span>
                                        {item.is_dispensed && (
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-green-100 text-green-700 hover:bg-green-100 flex items-center gap-1">
                                                <Package size={10} />
                                                تم الصرف
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{formatCurrency(item.total_price)}</span>
                                        <span className="text-xs text-muted-foreground">({item.quantity}×{formatCurrency(item.unit_price)})</span>
                                        {!item.is_completed && canUpdateJobOrder && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditItem(item)}>
                                                    <Edit size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => { if (confirm('هل تريد حذف هذا البند؟')) onDeleteItem(item.id); }}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* عرض مكونات الخدمة المركبة */}
                                {item.product?.is_composite && item.product.components && item.product.components.length > 0 && (
                                    <div className="mr-8 mt-2 pt-2 border-t border-dashed space-y-1">
                                        <span className="text-xs text-muted-foreground font-medium">المكونات:</span>
                                        {item.product.components.map(comp => (
                                            <div key={comp.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                                <span>{comp.component?.name || 'منتج'}</span>
                                                <span className="text-muted-foreground/70">×{comp.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {/* الإجماليات */}
                        <div className="border-t pt-3 mt-3 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">العمالة</span>
                                <span>{formatCurrency(totals.labor)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">القطع</span>
                                <span>{formatCurrency(totals.parts)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base pt-2 border-t">
                                <span>الإجمالي</span>
                                <span className="text-primary">{formatCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
