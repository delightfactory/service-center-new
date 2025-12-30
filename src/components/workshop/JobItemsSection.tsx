import React from 'react';
import { Package, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
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
}

export function JobItemsSection({
    items,
    onAddItem,
    onEditItem,
    onDeleteItem,
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

    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <Package size={18} />
                    البنود
                </CardTitle>
                <Button size="sm" onClick={onAddItem}>
                    <Plus size={14} className="ml-1" />
                    إضافة بند
                </Button>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        لا توجد بنود مضافة
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border group hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{JOB_ITEM_TYPES[item.item_type]}</Badge>
                                    <span className="text-sm">{item.description}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{formatCurrency(item.total_price)}</span>
                                    <span className="text-xs text-muted-foreground">({item.quantity}×{formatCurrency(item.unit_price)})</span>
                                    {!item.is_completed && (
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
