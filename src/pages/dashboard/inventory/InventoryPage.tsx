import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Warehouse, Search, AlertTriangle, TrendingUp, TrendingDown, Filter, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/shared';
import {
    InventoryReportPrintTemplate,
    type InventoryReportData,
    type InventoryReportItem,
} from '@/components/print';

// ============================================================
// Inventory Page - صفحة الأرصدة
// ============================================================

interface InventoryItem {
    id: string;
    product: {
        id: string;
        code: string;
        name: string;
        product_type: string;
        unit: string;
        min_stock: number;
        selling_price: number;
    };
    warehouse: {
        id: string;
        name: string;
    };
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    avg_cost: number;
    last_updated: string;
}

interface WarehouseOption {
    id: string;
    name: string;
}

const productTypeLabels: Record<string, string> = {
    part: 'قطعة غيار',
    consumable: 'مستهلك',
    service: 'خدمة',
};

export function InventoryPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
    const [stockFilter, setStockFilter] = useState<string>('all');
    const [isExporting, setIsExporting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Fetch warehouses for filter
    const { data: warehouses } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('warehouses')
                .select('id, name')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data as WarehouseOption[];
        },
    });

    // Fetch inventory items
    const { data: inventoryItems, isLoading } = useQuery({
        queryKey: ['inventory-items', searchQuery, warehouseFilter, stockFilter],
        queryFn: async () => {
            let query = supabase
                .from('inventory_items')
                .select(`
                    id, quantity, reserved_quantity, available_quantity, avg_cost, last_updated,
                    product:products (id, code, name, product_type, unit, min_stock, selling_price),
                    warehouse:warehouses (id, name)
                `)
                .gt('quantity', 0) // Only show items with stock
                .order('last_updated', { ascending: false });

            if (warehouseFilter !== 'all') {
                query = query.eq('warehouse_id', warehouseFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            let items = (data || []).map(item => ({
                ...item,
                product: Array.isArray(item.product) ? item.product[0] : item.product,
                warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse,
            })) as InventoryItem[];

            // Apply search filter
            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                items = items.filter(item =>
                    item.product?.name?.toLowerCase().includes(search) ||
                    item.product?.code?.toLowerCase().includes(search)
                );
            }

            // Apply stock filter
            if (stockFilter === 'low') {
                items = items.filter(item =>
                    item.quantity <= (item.product?.min_stock || 0)
                );
            } else if (stockFilter === 'out') {
                items = items.filter(item => item.quantity <= 0);
            }

            return items;
        },
    });

    // Calculate stats
    const stats = React.useMemo(() => {
        if (!inventoryItems) return { totalItems: 0, totalValue: 0, lowStock: 0, outOfStock: 0 };

        const lowStock = inventoryItems.filter(i => i.quantity <= (i.product?.min_stock || 0) && i.quantity > 0).length;
        const outOfStock = inventoryItems.filter(i => i.quantity <= 0).length;
        const totalValue = inventoryItems.reduce((sum, i) => sum + (i.quantity * i.avg_cost), 0);

        return {
            totalItems: inventoryItems.length,
            totalValue,
            lowStock,
            outOfStock,
        };
    }, [inventoryItems]);

    // Build report data for PDF export
    const reportData: InventoryReportData | null = useMemo(() => {
        if (!inventoryItems || inventoryItems.length === 0) return null;
        const warehouseName = warehouseFilter === 'all'
            ? 'كل المخازن'
            : warehouses?.find(w => w.id === warehouseFilter)?.name || warehouseFilter;

        const items: InventoryReportItem[] = inventoryItems.map(item => {
            const isLow = item.quantity <= (item.product?.min_stock || 0) && item.quantity > 0;
            const isOut = item.quantity <= 0;
            return {
                productCode: item.product?.code || '',
                productName: item.product?.name || '',
                productType: item.product?.product_type || '',
                unit: item.product?.unit || '',
                warehouseName: item.warehouse?.name || '',
                quantity: item.quantity,
                reservedQuantity: item.reserved_quantity,
                availableQuantity: item.available_quantity,
                avgCost: item.avg_cost,
                minStock: item.product?.min_stock || 0,
                totalValue: item.quantity * item.avg_cost,
                status: isOut ? 'out' : isLow ? 'low' : 'available',
            };
        });

        return {
            items,
            filters: { warehouse: warehouseName, stockFilter, search: searchQuery },
            stats,
        };
    }, [inventoryItems, warehouseFilter, warehouses, stockFilter, searchQuery, stats]);

    // Excel export
    const handleExportExcel = useCallback(() => {
        if (!inventoryItems || inventoryItems.length === 0) return;

        const rows = inventoryItems.map((item, i) => ({
            '#': i + 1,
            'الكود': item.product?.code || '',
            'المنتج': item.product?.name || '',
            'النوع': productTypeLabels[item.product?.product_type] || item.product?.product_type || '',
            'المخزن': item.warehouse?.name || '',
            'الوحدة': item.product?.unit || '',
            'الكمية': item.quantity,
            'محجوز': item.reserved_quantity,
            'متاح': item.available_quantity,
            'متوسط التكلفة': item.avg_cost,
            'إجمالي القيمة': item.quantity * item.avg_cost,
            'الحد الأدنى': item.product?.min_stock || 0,
            'الحالة': item.quantity <= 0 ? 'نفد' : item.quantity <= (item.product?.min_stock || 0) ? 'نقص' : 'متوفر',
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 15 },
            { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 },
            { wch: 14 }, { wch: 10 }, { wch: 10 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'أرصدة المخزون');
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `أرصدة المخزون - ${today}.xlsx`);
    }, [inventoryItems]);

    // PDF export
    const handleExportPdf = useCallback(async () => {
        if (!printRef.current) return;
        setIsExporting(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const opt = {
                margin: [10, 8, 10, 8] as [number, number, number, number],
                filename: `أرصدة المخزون - ${today}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
                pagebreak: { mode: ['avoid-all' as const, 'css' as const] },
            };
            await html2pdf().set(opt).from(printRef.current).save();
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    const hasData = inventoryItems && inventoryItems.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="أرصدة المخزون"
                description="متابعة الأرصدة في كل المخازن"
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportExcel}
                            disabled={!hasData}
                            className="gap-2"
                        >
                            <FileSpreadsheet size={16} />
                            Excel
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportPdf}
                            disabled={!hasData || isExporting}
                            className="gap-2"
                        >
                            <Download size={16} />
                            {isExporting ? 'جاري...' : 'PDF'}
                        </Button>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.totalItems}</p>
                                <p className="text-xs text-muted-foreground">إجمالي الأصناف</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <TrendingUp size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                                <p className="text-xs text-muted-foreground">قيمة المخزون</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn(stats.lowStock > 0 && 'border-amber-200 bg-amber-50/50')}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                stats.lowStock > 0 ? 'bg-amber-100' : 'bg-gray-100'
                            )}>
                                <TrendingDown size={20} className={stats.lowStock > 0 ? 'text-amber-600' : 'text-gray-400'} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.lowStock}</p>
                                <p className="text-xs text-muted-foreground">نقص مخزون</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn(stats.outOfStock > 0 && 'border-red-200 bg-red-50/50')}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                stats.outOfStock > 0 ? 'bg-red-100' : 'bg-gray-100'
                            )}>
                                <AlertTriangle size={20} className={stats.outOfStock > 0 ? 'text-red-600' : 'text-gray-400'} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.outOfStock}</p>
                                <p className="text-xs text-muted-foreground">نفد المخزون</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                placeholder="البحث بالاسم أو الكود..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="المخزن" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المخازن</SelectItem>
                                {warehouses?.map(wh => (
                                    <SelectItem key={wh.id} value={wh.id}>
                                        {wh.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="حالة المخزون" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="low">نقص مخزون</SelectItem>
                                <SelectItem value="out">نفد المخزون</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Inventory Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Warehouse size={20} />
                        قائمة الأرصدة
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : !inventoryItems || inventoryItems.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title="لا توجد أرصدة"
                            description="لم يتم العثور على أرصدة مخزون"
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الكود</TableHead>
                                        <TableHead>المنتج</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>المخزن</TableHead>
                                        <TableHead className="text-left">الكمية</TableHead>
                                        <TableHead className="text-left">المحجوز</TableHead>
                                        <TableHead className="text-left">المتاح</TableHead>
                                        <TableHead className="text-left">التكلفة</TableHead>
                                        <TableHead>الحالة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventoryItems.map((item) => {
                                        const isLowStock = item.quantity <= (item.product?.min_stock || 0);
                                        const isOutOfStock = item.quantity <= 0;

                                        return (
                                            <TableRow key={item.id} className={cn(
                                                isOutOfStock && 'bg-red-50',
                                                isLowStock && !isOutOfStock && 'bg-amber-50'
                                            )}>
                                                <TableCell className="font-mono text-sm">
                                                    {item.product?.code}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {item.product?.name}
                                                </TableCell>
                                                <TableCell>
                                                    {productTypeLabels[item.product?.product_type] || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {item.warehouse?.name}
                                                </TableCell>
                                                <TableCell className="text-left font-mono">
                                                    {item.quantity} {item.product?.unit}
                                                </TableCell>
                                                <TableCell className="text-left font-mono text-muted-foreground">
                                                    {item.reserved_quantity}
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-semibold">
                                                    {item.available_quantity}
                                                </TableCell>
                                                <TableCell className="text-left font-mono">
                                                    {formatCurrency(item.avg_cost)}
                                                </TableCell>
                                                <TableCell>
                                                    {isOutOfStock ? (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <AlertTriangle size={12} />
                                                            نفد
                                                        </Badge>
                                                    ) : isLowStock ? (
                                                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                                                            <AlertTriangle size={12} />
                                                            نقص
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary">متوفر</Badge>
                                                    )}
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
            {/* Hidden Print Template for PDF */}
            <div style={{ display: 'none' }}>
                {reportData && (
                    <InventoryReportPrintTemplate ref={printRef} data={reportData} />
                )}
            </div>
        </div>
    );
}

export default InventoryPage;
