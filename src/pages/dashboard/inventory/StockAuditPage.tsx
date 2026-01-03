import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ClipboardCheck, Package, Warehouse, Search, AlertTriangle,
    Plus, Minus, Save, X, Loader2, Check, PlayCircle, StopCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { inventoryService } from '@/lib/services';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================
interface StockItem {
    id: string;
    product_id: string;
    warehouse_id: string;
    quantity: number;
    reserved_quantity: number;
    avg_cost: number;
    product: {
        id: string;
        code: string;
        name: string;
        product_type: string;
        unit: string;
        min_stock: number;
    };
    warehouse: {
        id: string;
        name: string;
    };
}

interface AuditEntry {
    id: string;
    product_id: string;
    warehouse_id: string;
    system_quantity: number;
    actual_quantity: number | null;
    difference: number;
    product_name: string;
    product_code: string;
    unit: string;
}

// ============================================================
// Stock Audit Page - صفحة جرد المخزون
// ============================================================
export default function StockAuditPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAuditMode, setIsAuditMode] = useState(false);
    const [auditEntries, setAuditEntries] = useState<Map<string, AuditEntry>>(new Map());
    const [auditReason, setAuditReason] = useState('');
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });

    // Fetch warehouses
    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('warehouses')
                .select('id, name')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data || [];
        },
    });

    // Fetch all products with their stock in selected warehouse
    const { data: stockItems = [], isLoading } = useQuery({
        queryKey: ['stock-audit', selectedWarehouse],
        queryFn: async () => {
            if (!selectedWarehouse) return [];

            // Get all physical products (exclude services)
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('id, code, name, product_type, unit, min_stock')
                .eq('is_active', true)
                .neq('product_type', 'service')
                .order('name');

            if (productsError) throw productsError;

            // Get inventory for selected warehouse
            const { data: inventory, error: inventoryError } = await supabase
                .from('inventory_items')
                .select('product_id, quantity, reserved_quantity, avg_cost')
                .eq('warehouse_id', selectedWarehouse);

            if (inventoryError) throw inventoryError;

            // Get warehouse info
            const warehouse = warehouses.find(w => w.id === selectedWarehouse);

            // Map inventory by product_id
            const inventoryMap = new Map(
                (inventory || []).map(i => [i.product_id, i])
            );

            // Combine products with their inventory
            return (products || []).map(product => {
                const inv = inventoryMap.get(product.id);
                return {
                    id: `${product.id}-${selectedWarehouse}`,
                    product_id: product.id,
                    warehouse_id: selectedWarehouse,
                    quantity: inv?.quantity || 0,
                    reserved_quantity: inv?.reserved_quantity || 0,
                    avg_cost: inv?.avg_cost || 0,
                    product: product,
                    warehouse: warehouse || { id: selectedWarehouse, name: '' },
                } as StockItem;
            });
        },
        enabled: !!selectedWarehouse && warehouses.length > 0,
    });

    // Filter items based on search
    const filteredItems = useMemo(() => {
        if (!searchTerm) return stockItems;
        const term = searchTerm.toLowerCase();
        return stockItems.filter(item =>
            item.product.name.toLowerCase().includes(term) ||
            item.product.code?.toLowerCase().includes(term)
        );
    }, [stockItems, searchTerm]);

    // Start audit session
    const startAudit = useCallback(() => {
        if (!selectedWarehouse) {
            toast.error('يرجى اختيار المخزن أولاً');
            return;
        }

        // Initialize audit entries with current quantities
        const entries = new Map<string, AuditEntry>();
        stockItems.forEach(item => {
            entries.set(item.id, {
                id: item.id,
                product_id: item.product_id,
                warehouse_id: item.warehouse_id,
                system_quantity: item.quantity,
                actual_quantity: null, // User hasn't entered yet
                difference: 0,
                product_name: item.product.name,
                product_code: item.product.code,
                unit: item.product.unit,
            });
        });

        setAuditEntries(entries);
        setIsAuditMode(true);
        setAuditReason(`جرد مخزن ${warehouses.find(w => w.id === selectedWarehouse)?.name} - ${new Date().toLocaleDateString('ar-EG')}`);
        toast.success('تم بدء جلسة الجرد');
    }, [selectedWarehouse, stockItems, warehouses]);

    // Cancel audit
    const cancelAudit = useCallback(() => {
        setIsAuditMode(false);
        setAuditEntries(new Map());
        setAuditReason('');
        setIsCancelDialogOpen(false);
        toast.info('تم إلغاء جلسة الجرد');
    }, []);

    // Update actual quantity
    const updateActualQuantity = useCallback((itemId: string, value: string) => {
        const numValue = value === '' ? null : parseFloat(value);

        setAuditEntries(prev => {
            const newEntries = new Map(prev);
            const entry = newEntries.get(itemId);
            if (entry) {
                const actualQty = numValue;
                newEntries.set(itemId, {
                    ...entry,
                    actual_quantity: actualQty,
                    difference: actualQty !== null ? actualQty - entry.system_quantity : 0,
                });
            }
            return newEntries;
        });
    }, []);

    // Get entries with changes
    const entriesWithChanges = useMemo(() => {
        return Array.from(auditEntries.values()).filter(
            entry => entry.actual_quantity !== null && entry.difference !== 0
        );
    }, [auditEntries]);

    // Get entries that were audited (even if no change)
    const auditedEntries = useMemo(() => {
        return Array.from(auditEntries.values()).filter(
            entry => entry.actual_quantity !== null
        );
    }, [auditEntries]);

    // Submit audit
    const handleSubmitAudit = async () => {
        if (entriesWithChanges.length === 0) {
            toast.info('لا توجد تغييرات للتنفيذ');
            setIsSubmitDialogOpen(false);
            setIsAuditMode(false);
            setAuditEntries(new Map());
            return;
        }

        if (!auditReason.trim()) {
            toast.error('يرجى إدخال سبب الجرد');
            return;
        }

        setIsSubmitting(true);
        setSubmitProgress({ current: 0, total: entriesWithChanges.length });

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < entriesWithChanges.length; i++) {
            const entry = entriesWithChanges[i];
            setSubmitProgress({ current: i + 1, total: entriesWithChanges.length });

            try {
                await inventoryService.recordAdjustment(
                    entry.product_id,
                    entry.warehouse_id,
                    entry.actual_quantity!,
                    auditReason,
                    user?.id
                );
                successCount++;
            } catch (error) {
                console.error(`Error adjusting ${entry.product_name}:`, error);
                errorCount++;
            }
        }

        setIsSubmitting(false);
        setIsSubmitDialogOpen(false);

        if (successCount > 0) {
            queryClient.invalidateQueries({ queryKey: ['stock-audit'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success(`تم تنفيذ ${successCount} تسوية بنجاح`);
        }

        if (errorCount > 0) {
            toast.error(`فشلت ${errorCount} تسوية`);
        }

        // End audit session
        setIsAuditMode(false);
        setAuditEntries(new Map());
        setAuditReason('');
    };

    // Stats
    const stats = useMemo(() => {
        const increases = entriesWithChanges.filter(e => e.difference > 0).length;
        const decreases = entriesWithChanges.filter(e => e.difference < 0).length;
        const totalItems = stockItems.length;
        const auditedCount = auditedEntries.length;
        const progressPercent = totalItems > 0 ? Math.round((auditedCount / totalItems) * 100) : 0;

        return { increases, decreases, totalItems, auditedCount, progressPercent, changesCount: entriesWithChanges.length };
    }, [stockItems, entriesWithChanges, auditedEntries]);

    return (
        <div className="space-y-4 sm:space-y-6">
            <PageHeader
                title="جرد المخزون"
                description={isAuditMode ? "أدخل الكميات الفعلية لكل صنف" : "اختر المخزن وابدأ جلسة جرد جديدة"}
            />

            {/* Control Bar */}
            <Card>
                <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            {/* Warehouse Selection */}
                            <Select
                                value={selectedWarehouse}
                                onValueChange={setSelectedWarehouse}
                                disabled={isAuditMode}
                            >
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <Warehouse className="h-4 w-4 ml-2" />
                                    <SelectValue placeholder="اختر المخزن" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Search - Only in audit mode */}
                            {isAuditMode && (
                                <div className="relative flex-1 sm:w-[250px]">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="بحث بالاسم أو الكود..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pr-10"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 w-full sm:w-auto">
                            {!isAuditMode ? (
                                <Button
                                    onClick={startAudit}
                                    disabled={!selectedWarehouse || isLoading}
                                    className="flex-1 sm:flex-none gap-2"
                                >
                                    <PlayCircle className="h-4 w-4" />
                                    بدء جلسة جرد
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsCancelDialogOpen(true)}
                                        className="flex-1 sm:flex-none gap-2"
                                    >
                                        <StopCircle className="h-4 w-4" />
                                        إلغاء
                                    </Button>
                                    <Button
                                        onClick={() => setIsSubmitDialogOpen(true)}
                                        disabled={entriesWithChanges.length === 0}
                                        className="flex-1 sm:flex-none gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        حفظ الجرد ({entriesWithChanges.length})
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Audit Progress - Only in audit mode */}
            {isAuditMode && (
                <Card className="border-primary bg-primary/5">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <ClipboardCheck className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">جلسة جرد نشطة</span>
                                    <Badge variant="outline">{stats.progressPercent}%</Badge>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${stats.progressPercent}%` }}
                                    />
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    تم جرد {stats.auditedCount} من {stats.totalItems} صنف
                                </p>
                            </div>

                            <div className="flex gap-3">
                                {stats.increases > 0 && (
                                    <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                                        <Plus className="h-3 w-3" />
                                        {stats.increases} زيادة
                                    </Badge>
                                )}
                                {stats.decreases > 0 && (
                                    <Badge variant="outline" className="text-red-600 border-red-600 gap-1">
                                        <Minus className="h-3 w-3" />
                                        {stats.decreases} نقص
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stock Items */}
            <Card>
                <CardHeader className="pb-3 px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg">
                        {isAuditMode ? 'أدخل الكميات الفعلية' : 'أصناف المخزون'}
                    </CardTitle>
                    {isAuditMode && (
                        <CardDescription>
                            أدخل الكمية الفعلية لكل صنف، اترك الحقل فارغاً للأصناف التي لم يتم جردها
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                    {!selectedWarehouse ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Warehouse className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>اختر المخزن لعرض الأصناف</p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>لا توجد أصناف في المخزون</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile View */}
                            <div className="sm:hidden divide-y">
                                {filteredItems.map(item => {
                                    const entry = auditEntries.get(item.id);
                                    const hasChange = entry && entry.difference !== 0;
                                    const isAudited = entry && entry.actual_quantity !== null;

                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                "p-4",
                                                isAudited && "bg-muted/30",
                                                hasChange && entry.difference > 0 && "bg-green-50",
                                                hasChange && entry.difference < 0 && "bg-red-50"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{item.product.name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.product.code}</p>
                                                </div>
                                                {isAudited && (
                                                    <Check className="h-4 w-4 text-green-600 ml-2" />
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">النظام: </span>
                                                    <span className="font-medium">{item.quantity} {item.product.unit}</span>
                                                </div>

                                                {isAuditMode && (
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <span className="text-sm text-muted-foreground">الفعلي:</span>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="—"
                                                            value={entry?.actual_quantity ?? ''}
                                                            onChange={e => updateActualQuantity(item.id, e.target.value)}
                                                            className={cn(
                                                                "w-24 h-9 text-center",
                                                                hasChange && entry.difference > 0 && "border-green-500 bg-green-50",
                                                                hasChange && entry.difference < 0 && "border-red-500 bg-red-50"
                                                            )}
                                                        />
                                                        {hasChange && (
                                                            <Badge
                                                                variant={entry.difference > 0 ? 'default' : 'destructive'}
                                                                className="text-xs"
                                                            >
                                                                {entry.difference > 0 ? '+' : ''}{entry.difference}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop View */}
                            <div className="hidden sm:block rounded-lg border overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-right p-3 font-medium">الصنف</th>
                                            <th className="text-center p-3 font-medium w-32">كمية النظام</th>
                                            {isAuditMode && (
                                                <>
                                                    <th className="text-center p-3 font-medium w-40">الكمية الفعلية</th>
                                                    <th className="text-center p-3 font-medium w-24">الفرق</th>
                                                </>
                                            )}
                                            <th className="text-center p-3 font-medium w-20">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredItems.map(item => {
                                            const entry = auditEntries.get(item.id);
                                            const hasChange = entry && entry.difference !== 0;
                                            const isAudited = entry && entry.actual_quantity !== null;
                                            const isLow = item.product.min_stock > 0 &&
                                                (item.quantity - item.reserved_quantity) < item.product.min_stock;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={cn(
                                                        isAudited && "bg-muted/30",
                                                        hasChange && entry.difference > 0 && "bg-green-50",
                                                        hasChange && entry.difference < 0 && "bg-red-50"
                                                    )}
                                                >
                                                    <td className="p-3">
                                                        <div>
                                                            <p className="font-medium">{item.product.name}</p>
                                                            <p className="text-xs text-muted-foreground">{item.product.code}</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center font-medium">
                                                        {item.quantity} {item.product.unit}
                                                    </td>
                                                    {isAuditMode && (
                                                        <>
                                                            <td className="p-3">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    placeholder="أدخل الكمية الفعلية"
                                                                    value={entry?.actual_quantity ?? ''}
                                                                    onChange={e => updateActualQuantity(item.id, e.target.value)}
                                                                    className={cn(
                                                                        "text-center",
                                                                        hasChange && entry.difference > 0 && "border-green-500",
                                                                        hasChange && entry.difference < 0 && "border-red-500"
                                                                    )}
                                                                />
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {hasChange ? (
                                                                    <Badge variant={entry.difference > 0 ? 'default' : 'destructive'}>
                                                                        {entry.difference > 0 ? '+' : ''}{entry.difference}
                                                                    </Badge>
                                                                ) : isAudited ? (
                                                                    <span className="text-muted-foreground">0</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="p-3 text-center">
                                                        {isAuditMode ? (
                                                            isAudited ? (
                                                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )
                                                        ) : isLow ? (
                                                            <Badge variant="destructive" className="gap-1">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                نقص
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-green-600">متوفر</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Submit Dialog */}
            <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>حفظ نتائج الجرد</DialogTitle>
                        <DialogDescription>
                            سيتم تنفيذ {entriesWithChanges.length} تسوية على المخزون
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="p-3 bg-muted rounded-lg text-sm">
                            <div className="flex justify-between mb-1">
                                <span>أصناف تم جردها:</span>
                                <span className="font-medium">{stats.auditedCount}</span>
                            </div>
                            <div className="flex justify-between mb-1">
                                <span>تسويات مطلوبة:</span>
                                <span className="font-medium">{entriesWithChanges.length}</span>
                            </div>
                            {stats.increases > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>زيادة:</span>
                                    <span>{stats.increases} صنف</span>
                                </div>
                            )}
                            {stats.decreases > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>نقص:</span>
                                    <span>{stats.decreases} صنف</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>سبب الجرد</Label>
                            <Textarea
                                value={auditReason}
                                onChange={e => setAuditReason(e.target.value)}
                                placeholder="مثال: جرد دوري شهر يناير 2026"
                                rows={2}
                            />
                        </div>

                        {isSubmitting && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>جاري التنفيذ...</span>
                                    <span>{submitProgress.current} / {submitProgress.total}</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{
                                            width: `${(submitProgress.current / submitProgress.total) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsSubmitDialogOpen(false)}
                            disabled={isSubmitting}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleSubmitAudit}
                            disabled={isSubmitting || !auditReason.trim()}
                            className="gap-2"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            تنفيذ التسويات
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Confirmation */}
            <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>إلغاء جلسة الجرد؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم فقدان جميع البيانات التي أدخلتها. هل أنت متأكد؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>استمرار الجرد</AlertDialogCancel>
                        <AlertDialogAction onClick={cancelAudit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            إلغاء الجرد
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
