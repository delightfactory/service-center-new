import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Plus, Search, Package, Wrench, Droplet, Filter,
    MoreVertical, Edit, Trash2, Eye, BarChart3, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/shared';
import { AddProductModal, ProductImportModal, ExportProductsButton } from '@/components/inventory';
import { IfCanCreate } from '@/components/auth';

// ============================================================
// Products Page - صفحة المنتجات والخدمات
// ============================================================

type ProductType = 'part' | 'consumable' | 'service';

interface Product {
    id: string;
    code: string;
    name: string;
    name_en: string | null;
    product_type: ProductType;
    category: { id: string; name: string } | null;
    unit: string;
    purchase_price: number;
    selling_price: number;
    min_stock: number;
    is_trackable: boolean;
    is_composite: boolean;
    is_active: boolean;
    created_at: string;
    // Computed from inventory_items
    total_quantity?: number;
}

interface Category {
    id: string;
    name: string;
}

const productTypeConfig: Record<ProductType, { label: string; icon: React.ReactNode; color: string }> = {
    part: { label: 'قطعة غيار', icon: <Package size={16} />, color: 'bg-blue-100 text-blue-700' },
    consumable: { label: 'مستهلك', icon: <Droplet size={16} />, color: 'bg-amber-100 text-amber-700' },
    service: { label: 'خدمة', icon: <Wrench size={16} />, color: 'bg-purple-100 text-purple-700' },
};

export function ProductsPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Fetch products
    const { data: products, isLoading } = useQuery({
        queryKey: ['products', searchQuery, typeFilter, categoryFilter],
        queryFn: async () => {
            let query = supabase
                .from('products')
                .select(`
                    id, code, name, name_en, product_type, unit,
                    purchase_price, selling_price, min_stock,
                    is_trackable, is_composite, is_active, created_at,
                    category:categories (id, name)
                `)
                .order('created_at', { ascending: false });

            // Apply filters
            if (searchQuery) {
                query = query.or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
            }
            if (typeFilter !== 'all') {
                query = query.eq('product_type', typeFilter);
            }
            if (categoryFilter !== 'all') {
                query = query.eq('category_id', categoryFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Transform data
            return (data || []).map(product => ({
                ...product,
                category: Array.isArray(product.category) ? product.category[0] : product.category,
            })) as Product[];
        },
    });

    // Fetch categories for filter
    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name')
                .eq('is_active', true)
                .order('sort_order');
            if (error) throw error;
            return data as Category[];
        },
    });

    // Fetch inventory totals
    const { data: inventoryTotals } = useQuery({
        queryKey: ['inventory-totals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('product_id, quantity');
            if (error) throw error;

            // Group by product_id
            const totals: Record<string, number> = {};
            (data || []).forEach(item => {
                totals[item.product_id] = (totals[item.product_id] || 0) + item.quantity;
            });
            return totals;
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (productId: string) => {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    // Stats
    const stats = React.useMemo(() => {
        if (!products) return { total: 0, parts: 0, consumables: 0, services: 0, lowStock: 0 };

        const lowStockCount = products.filter(p => {
            const qty = inventoryTotals?.[p.id] || 0;
            return p.is_trackable && qty <= p.min_stock;
        }).length;

        return {
            total: products.length,
            parts: products.filter(p => p.product_type === 'part').length,
            consumables: products.filter(p => p.product_type === 'consumable').length,
            services: products.filter(p => p.product_type === 'service').length,
            lowStock: lowStockCount,
        };
    }, [products, inventoryTotals]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="المنتجات والخدمات"
                description="إدارة قطع الغيار والمستهلكات والخدمات"
                actions={
                    <div className="flex items-center gap-2">
                        <ExportProductsButton />
                        <IfCanCreate resource="products">
                            <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
                                استيراد
                            </Button>
                            <Button className="gap-2" onClick={() => setShowAddModal(true)}>
                                <Plus size={18} />
                                إضافة منتج
                            </Button>
                        </IfCanCreate>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Package size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.parts}</p>
                                <p className="text-xs text-muted-foreground">قطع غيار</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Droplet size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.consumables}</p>
                                <p className="text-xs text-muted-foreground">مستهلكات</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Wrench size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.services}</p>
                                <p className="text-xs text-muted-foreground">خدمات</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn(stats.lowStock > 0 && 'border-red-200 bg-red-50/50')}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                stats.lowStock > 0 ? 'bg-red-100' : 'bg-gray-100'
                            )}>
                                <AlertTriangle size={20} className={stats.lowStock > 0 ? 'text-red-600' : 'text-gray-400'} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.lowStock}</p>
                                <p className="text-xs text-muted-foreground">نقص مخزون</p>
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
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="النوع" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأنواع</SelectItem>
                                <SelectItem value="part">قطع غيار</SelectItem>
                                <SelectItem value="consumable">مستهلكات</SelectItem>
                                <SelectItem value="service">خدمات</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="التصنيف" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل التصنيفات</SelectItem>
                                {categories?.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 size={20} />
                        قائمة المنتجات
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : !products || products.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title="لا توجد منتجات"
                            description="ابدأ بإضافة منتجات وخدمات جديدة"
                            action={
                                <Button onClick={() => setShowAddModal(true)}>
                                    <Plus size={18} className="ml-2" />
                                    إضافة منتج جديد
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الكود</TableHead>
                                        <TableHead>الاسم</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>التصنيف</TableHead>
                                        <TableHead className="text-left">سعر الشراء</TableHead>
                                        <TableHead className="text-left">سعر البيع</TableHead>
                                        <TableHead className="text-left">الرصيد</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => {
                                        const typeConfig = productTypeConfig[product.product_type];
                                        const quantity = inventoryTotals?.[product.id] || 0;
                                        const isLowStock = product.is_trackable && quantity <= product.min_stock;

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {product.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{product.name}</p>
                                                        {product.name_en && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {product.name_en}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn('gap-1', typeConfig.color)}>
                                                        {typeConfig.icon}
                                                        {typeConfig.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {product.category?.name || '-'}
                                                </TableCell>
                                                <TableCell className="text-left font-mono">
                                                    {formatCurrency(product.purchase_price)}
                                                </TableCell>
                                                <TableCell className="text-left font-mono">
                                                    {formatCurrency(product.selling_price)}
                                                </TableCell>
                                                <TableCell className="text-left">
                                                    {product.is_trackable ? (
                                                        <span className={cn(
                                                            'font-mono',
                                                            isLowStock && 'text-red-600 font-bold'
                                                        )}>
                                                            {quantity} {product.unit}
                                                            {isLowStock && (
                                                                <AlertTriangle size={14} className="inline mr-1" />
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                                        {product.is_active ? 'نشط' : 'معطل'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical size={16} />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start">
                                                            <DropdownMenuItem asChild>
                                                                <Link to={`/dashboard/inventory/products/${product.id}`} className="gap-2">
                                                                    <Eye size={16} />
                                                                    عرض التفاصيل
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link to={`/dashboard/inventory/products/${product.id}?edit=true`} className="gap-2">
                                                                    <Edit size={16} />
                                                                    تعديل
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="gap-2 text-destructive"
                                                                onClick={() => {
                                                                    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                                                        deleteMutation.mutate(product.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 size={16} />
                                                                حذف
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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

            {/* Add Product Modal */}
            <AddProductModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
            />

            {/* Import Modal */}
            <ProductImportModal
                open={showImportModal}
                onOpenChange={setShowImportModal}
            />
        </div>
    );
}

export default ProductsPage;
