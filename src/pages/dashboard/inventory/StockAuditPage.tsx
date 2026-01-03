import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ClipboardCheck, Package, Warehouse, Search, AlertTriangle,
    Plus, Minus, Save, X, FileSpreadsheet, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { inventoryService } from '@/lib/services';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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

interface AdjustmentItem {
    id: string;
    product_id: string;
    product_name: string;
    product_code: string;
    warehouse_id: string;
    warehouse_name: string;
    current_quantity: number;
    new_quantity: number;
    difference: number;
    unit: string;
}

// ============================================================
// Stock Audit Page - صفحة جرد وتسويات المخزون
// ============================================================
export default function StockAuditPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([]);
    const [adjustmentReason, setAdjustmentReason] = useState('');
    const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
    const [newQuantity, setNewQuantity] = useState<string>('');

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

    // Fetch inventory items
    const { data: stockItems = [], isLoading } = useQuery({
        queryKey: ['stock-audit', selectedWarehouse],
        queryFn: async () => {
            let query = supabase
                .from('inventory_items')
                .select(`
                    id, product_id, warehouse_id, quantity, reserved_quantity, avg_cost,
                    product:products!inner(id, code, name, product_type, unit, min_stock),
                    warehouse:warehouses!inner(id, name)
                `)
                .gt('quantity', 0);

            if (selectedWarehouse !== 'all') {
                query = query.eq('warehouse_id', selectedWarehouse);
            }

            const { data, error } = await query.order('product(name)');
            if (error) throw error;
            // Transform the data to match StockItem type
            return ((data || []) as any[]).map(item => ({
                ...item,
                product: Array.isArray(item.product) ? item.product[0] : item.product,
                warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse,
            })) as StockItem[];
        },
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

    // Mutation for adjustment
    const adjustmentMutation = useMutation({
        mutationFn: async (item: AdjustmentItem) => {
            return inventoryService.recordAdjustment(
                item.product_id,
                item.warehouse_id,
                item.new_quantity,
                adjustmentReason || 'تسوية جرد',
                user?.id
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-audit'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
    });

    // Handle adding item to adjustment list
    const handleAddAdjustment = () => {
        if (!selectedItem || !newQuantity) return;

        const qty = parseFloat(newQuantity);
        if (isNaN(qty) || qty < 0) {
            toast.error('الكمية غير صالحة');
            return;
        }

        if (qty === selectedItem.quantity) {
            toast.error('الكمية الجديدة مساوية للكمية الحالية');
            return;
        }

        // Check if already in list
        if (adjustments.find(a => a.id === selectedItem.id)) {
            toast.error('هذا المنتج موجود بالفعل في قائمة التسويات');
            return;
        }

        setAdjustments(prev => [...prev, {
            id: selectedItem.id,
            product_id: selectedItem.product_id,
            product_name: selectedItem.product.name,
            product_code: selectedItem.product.code,
            warehouse_id: selectedItem.warehouse_id,
            warehouse_name: selectedItem.warehouse.name,
            current_quantity: selectedItem.quantity,
            new_quantity: qty,
            difference: qty - selectedItem.quantity,
            unit: selectedItem.product.unit,
        }]);

        setIsAdjustDialogOpen(false);
        setSelectedItem(null);
        setNewQuantity('');
        toast.success('تمت إضافة المنتج إلى قائمة التسويات');
    };

    // Handle removing item from adjustment list
    const handleRemoveAdjustment = (id: string) => {
        setAdjustments(prev => prev.filter(a => a.id !== id));
    };

    // Handle submitting all adjustments
    const handleSubmitAdjustments = async () => {
        if (adjustments.length === 0) {
            toast.error('لا توجد تسويات للتنفيذ');
            return;
        }

        if (!adjustmentReason.trim()) {
            toast.error('يرجى إدخال سبب التسوية');
            return;
        }

        try {
            for (const item of adjustments) {
                await adjustmentMutation.mutateAsync(item);
            }
            toast.success(`تم تنفيذ ${adjustments.length} تسوية بنجاح`);
            setAdjustments([]);
            setAdjustmentReason('');
        } catch (error) {
            toast.error('حدث خطأ أثناء تنفيذ التسويات');
            console.error(error);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const lowStock = stockItems.filter(
            item => item.quantity - item.reserved_quantity < item.product.min_stock && item.product.min_stock > 0
        ).length;
        const totalValue = stockItems.reduce(
            (sum, item) => sum + (item.quantity * item.avg_cost), 0
        );
        return { lowStock, totalValue, totalItems: stockItems.length };
    }, [stockItems]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="جرد وتسويات المخزون"
                description="مراجعة وتعديل كميات المخزون الفعلية"
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي الأصناف</p>
                                <p className="text-2xl font-bold">{stats.totalItems}</p>
                            </div>
                            <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">قيمة المخزون</p>
                                <p className="text-2xl font-bold">{stats.totalValue.toLocaleString('ar-EG')} ج.م</p>
                            </div>
                            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(stats.lowStock > 0 && "border-warning")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">نقص في المخزون</p>
                                <p className="text-2xl font-bold text-warning">{stats.lowStock}</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-warning" />
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(adjustments.length > 0 && "border-primary")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">تسويات معلقة</p>
                                <p className="text-2xl font-bold text-primary">{adjustments.length}</p>
                            </div>
                            <ClipboardCheck className="h-8 w-8 text-primary" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Adjustments */}
            {adjustments.length > 0 && (
                <Card className="border-primary">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5" />
                            التسويات المعلقة ({adjustments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المنتج</TableHead>
                                        <TableHead>المخزن</TableHead>
                                        <TableHead className="text-center">الكمية الحالية</TableHead>
                                        <TableHead className="text-center">الكمية الجديدة</TableHead>
                                        <TableHead className="text-center">الفرق</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {adjustments.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{item.product_name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.product_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>{item.warehouse_name}</TableCell>
                                            <TableCell className="text-center">{item.current_quantity} {item.unit}</TableCell>
                                            <TableCell className="text-center font-medium">{item.new_quantity} {item.unit}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={item.difference > 0 ? 'default' : 'destructive'}>
                                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveAdjustment(item.id)}
                                                >
                                                    <X className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="flex-1 space-y-2">
                                <Label>سبب التسوية *</Label>
                                <Textarea
                                    value={adjustmentReason}
                                    onChange={e => setAdjustmentReason(e.target.value)}
                                    placeholder="مثال: جرد دوري شهر يناير 2026"
                                    rows={2}
                                />
                            </div>
                            <Button
                                onClick={handleSubmitAdjustments}
                                disabled={adjustmentMutation.isPending || !adjustmentReason.trim()}
                                className="gap-2"
                            >
                                {adjustmentMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                تنفيذ التسويات
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث بالاسم أو الكود..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <Warehouse className="h-4 w-4 ml-2" />
                                <SelectValue placeholder="جميع المخازن" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع المخازن</SelectItem>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Stock Items Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">أرصدة المخزون</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>لا توجد أصناف في المخزون</p>
                        </div>
                    ) : (
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المنتج</TableHead>
                                        <TableHead>المخزن</TableHead>
                                        <TableHead className="text-center">الكمية</TableHead>
                                        <TableHead className="text-center">محجوز</TableHead>
                                        <TableHead className="text-center">متاح</TableHead>
                                        <TableHead className="text-center">الحد الأدنى</TableHead>
                                        <TableHead className="text-center">الحالة</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map(item => {
                                        const available = item.quantity - item.reserved_quantity;
                                        const isLow = item.product.min_stock > 0 && available < item.product.min_stock;
                                        const inAdjustments = adjustments.some(a => a.id === item.id);

                                        return (
                                            <TableRow key={item.id} className={cn(inAdjustments && "bg-muted/50")}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{item.product.name}</p>
                                                        <p className="text-xs text-muted-foreground">{item.product.code}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.warehouse.name}</TableCell>
                                                <TableCell className="text-center font-medium">
                                                    {item.quantity} {item.product.unit}
                                                </TableCell>
                                                <TableCell className="text-center text-muted-foreground">
                                                    {item.reserved_quantity}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {available}
                                                </TableCell>
                                                <TableCell className="text-center text-muted-foreground">
                                                    {item.product.min_stock || '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isLow ? (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            نقص
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-green-600">
                                                            متوفر
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={inAdjustments}
                                                        onClick={() => {
                                                            setSelectedItem(item);
                                                            setNewQuantity(item.quantity.toString());
                                                            setIsAdjustDialogOpen(true);
                                                        }}
                                                    >
                                                        تسوية
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Adjustment Dialog */}
            <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تسوية المخزون</DialogTitle>
                    </DialogHeader>

                    {selectedItem && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="font-medium">{selectedItem.product.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {selectedItem.product.code} • {selectedItem.warehouse.name}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>الكمية الحالية</Label>
                                    <Input
                                        value={`${selectedItem.quantity} ${selectedItem.product.unit}`}
                                        disabled
                                        className="text-center"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>الكمية الجديدة (الفعلية)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newQuantity}
                                        onChange={e => setNewQuantity(e.target.value)}
                                        className="text-center"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {newQuantity && parseFloat(newQuantity) !== selectedItem.quantity && (
                                <div className={cn(
                                    "p-3 rounded-lg flex items-center gap-2",
                                    parseFloat(newQuantity) > selectedItem.quantity
                                        ? "bg-green-50 text-green-700"
                                        : "bg-red-50 text-red-700"
                                )}>
                                    {parseFloat(newQuantity) > selectedItem.quantity ? (
                                        <Plus className="h-4 w-4" />
                                    ) : (
                                        <Minus className="h-4 w-4" />
                                    )}
                                    <span>
                                        فرق التسوية: {' '}
                                        <strong>
                                            {parseFloat(newQuantity) > selectedItem.quantity ? '+' : ''}
                                            {(parseFloat(newQuantity) - selectedItem.quantity).toFixed(2)}
                                        </strong>
                                        {' '}{selectedItem.product.unit}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={handleAddAdjustment}>
                            إضافة للتسويات
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
