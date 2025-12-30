import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
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
    ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Search, Package,
    Filter, Calendar, Warehouse, RefreshCw, AlertTriangle
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/shared';

// ============================================================
// Stock Movements Page - صفحة حركات المخزون
// ============================================================

type TransactionType = 'purchase' | 'sale' | 'job_consumption' | 'job_return' |
    'transfer_in' | 'transfer_out' | 'adjustment' | 'damage' | 'opening';

interface InventoryTransaction {
    id: string;
    code: string;
    transaction_type: TransactionType;
    quantity: number;
    unit_cost: number | null;
    total_cost: number | null;
    balance_before: number | null;
    balance_after: number | null;
    notes: string | null;
    created_at: string;
    product?: { id: string; name: string; sku: string };
    warehouse?: { id: string; name: string };
}

interface WarehouseOption {
    id: string;
    name: string;
}

const transactionTypeConfig: Record<TransactionType, {
    label: string;
    color: string;
    icon: React.ElementType;
    direction: 'in' | 'out' | 'neutral';
}> = {
    purchase: { label: 'شراء', color: 'bg-green-100 text-green-800', icon: ArrowDownCircle, direction: 'in' },
    sale: { label: 'بيع', color: 'bg-blue-100 text-blue-800', icon: ArrowUpCircle, direction: 'out' },
    job_consumption: { label: 'استهلاك أمر شغل', color: 'bg-orange-100 text-orange-800', icon: ArrowUpCircle, direction: 'out' },
    job_return: { label: 'إرجاع من أمر شغل', color: 'bg-cyan-100 text-cyan-800', icon: ArrowDownCircle, direction: 'in' },
    transfer_in: { label: 'تحويل وارد', color: 'bg-purple-100 text-purple-800', icon: ArrowRightLeft, direction: 'in' },
    transfer_out: { label: 'تحويل صادر', color: 'bg-purple-100 text-purple-800', icon: ArrowRightLeft, direction: 'out' },
    adjustment: { label: 'تسوية', color: 'bg-yellow-100 text-yellow-800', icon: RefreshCw, direction: 'neutral' },
    damage: { label: 'تالف', color: 'bg-red-100 text-red-800', icon: AlertTriangle, direction: 'out' },
    opening: { label: 'رصيد افتتاحي', color: 'bg-gray-100 text-gray-800', icon: Package, direction: 'in' },
};

export function StockMovementsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterWarehouse, setFilterWarehouse] = useState<string>('all');

    // Fetch transactions
    const { data: transactions, isLoading, error, refetch } = useQuery({
        queryKey: ['inventory-transactions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
                    id, code, transaction_type, quantity, unit_cost, total_cost,
                    balance_before, balance_after, notes, created_at,
                    product_id, warehouse_id
                `)
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Query error:', error);
                throw error;
            }

            // Fetch product and warehouse names separately
            const productIds = [...new Set((data || []).map(t => t.product_id).filter(Boolean))];
            const warehouseIds = [...new Set((data || []).map(t => t.warehouse_id).filter(Boolean))];

            let productsMap = new Map<string, { id: string; name: string; sku: string }>();
            let warehousesMap = new Map<string, { id: string; name: string }>();

            // Fetch products - handle errors gracefully
            if (productIds.length > 0) {
                try {
                    const { data: productsData } = await supabase
                        .from('products')
                        .select('id, name, sku')
                        .in('id', productIds);
                    productsMap = new Map((productsData || []).map(p => [p.id, p]));
                } catch (err) {
                    console.warn('Could not fetch product names:', err);
                }
            }

            // Fetch warehouses - handle errors gracefully
            if (warehouseIds.length > 0) {
                try {
                    const { data: warehousesData } = await supabase
                        .from('warehouses')
                        .select('id, name')
                        .in('id', warehouseIds);
                    warehousesMap = new Map((warehousesData || []).map(w => [w.id, w]));
                } catch (err) {
                    console.warn('Could not fetch warehouse names:', err);
                }
            }

            return (data || []).map(t => ({
                ...t,
                product: productsMap.get(t.product_id) || { id: t.product_id, name: 'منتج محذوف', sku: '-' },
                warehouse: warehousesMap.get(t.warehouse_id) || { id: t.warehouse_id, name: 'مخزن محذوف' },
            })) as InventoryTransaction[];
        },
    });

    // Fetch warehouses for filter
    const { data: warehouses } = useQuery({
        queryKey: ['warehouses-list'],
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

    // Filter and search transactions
    const filteredTransactions = useMemo(() => {
        if (!transactions) return [];
        return transactions.filter(tx => {
            // Type filter
            if (filterType !== 'all' && tx.transaction_type !== filterType) {
                return false;
            }

            // Warehouse filter
            if (filterWarehouse !== 'all' && tx.warehouse?.id !== filterWarehouse) {
                return false;
            }

            // Search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    tx.code?.toLowerCase().includes(query) ||
                    tx.product?.name?.toLowerCase().includes(query) ||
                    tx.product?.sku?.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [transactions, filterType, filterWarehouse, searchQuery]);

    // Statistics
    const stats = useMemo(() => {
        if (!transactions) return { totalIn: 0, totalOut: 0, adjustments: 0, damages: 0 };

        let totalIn = 0;
        let totalOut = 0;
        let adjustments = 0;
        let damages = 0;

        transactions.forEach(tx => {
            const config = transactionTypeConfig[tx.transaction_type];
            if (config?.direction === 'in') totalIn += tx.quantity;
            else if (config?.direction === 'out') totalOut += tx.quantity;

            if (tx.transaction_type === 'adjustment') adjustments++;
            if (tx.transaction_type === 'damage') damages++;
        });

        return { totalIn, totalOut, adjustments, damages };
    }, [transactions]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="حركات المخزون"
                description="عرض جميع حركات الوارد والصادر والتسويات"
                actions={
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCw size={16} className="ml-2" />
                        تحديث
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <ArrowDownCircle className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي الوارد</p>
                                <p className="text-lg font-bold text-green-600">+{stats.totalIn.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100">
                                <ArrowUpCircle className="text-red-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي الصادر</p>
                                <p className="text-lg font-bold text-red-600">-{stats.totalOut.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-yellow-100">
                                <RefreshCw className="text-yellow-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">التسويات</p>
                                <p className="text-lg font-bold">{stats.adjustments}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100">
                                <AlertTriangle className="text-red-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">التالف</p>
                                <p className="text-lg font-bold">{stats.damages}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="بحث بالكود أو اسم المنتج..."
                                className="pr-10"
                            />
                        </div>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="نوع الحركة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأنواع</SelectItem>
                                {Object.entries(transactionTypeConfig).map(([value, { label }]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="المخزن" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المخازن</SelectItem>
                                {warehouses?.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-4 space-y-2">
                            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <EmptyState
                            icon={ArrowRightLeft}
                            title="لا توجد حركات"
                            description="لم يتم العثور على حركات مطابقة للبحث"
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الكود</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>المنتج</TableHead>
                                        <TableHead>المخزن</TableHead>
                                        <TableHead>الكمية</TableHead>
                                        <TableHead>الرصيد قبل</TableHead>
                                        <TableHead>الرصيد بعد</TableHead>
                                        <TableHead>التاريخ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.map(tx => {
                                        const config = transactionTypeConfig[tx.transaction_type];
                                        const TypeIcon = config?.icon || Package;
                                        const isOut = config?.direction === 'out';

                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {tx.code}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn("gap-1", config?.color)}>
                                                        <TypeIcon size={12} />
                                                        {config?.label || tx.transaction_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium truncate max-w-[200px]">{tx.product?.name || '-'}</p>
                                                        {tx.product?.sku && (
                                                            <p className="text-xs text-muted-foreground font-mono">{tx.product.sku}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Warehouse size={14} className="text-muted-foreground" />
                                                        {tx.warehouse?.name || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        "font-bold",
                                                        isOut ? "text-red-600" : "text-green-600"
                                                    )}>
                                                        {isOut ? '-' : '+'}{Math.abs(tx.quantity)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {tx.balance_before ?? '-'}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {tx.balance_after ?? '-'}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {formatDate(tx.created_at)}
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
        </div>
    );
}

export default StockMovementsPage;
