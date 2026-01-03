import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    ArrowRight, Package, Wrench, Droplet, Edit, Trash2,
    Printer, MoreVertical, Warehouse, BarChart3, History,
    Tag, DollarSign, Box, Clock, AlertTriangle, CheckCircle2,
    Layers, Settings, Image as ImageIcon
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { EditProductModal } from '@/components/inventory';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { ProductType } from '@/types/enums';
import { PageHeader } from '@/components/shared';

// ============================================================
// Product Details Page - صفحة تفاصيل المنتج
// Professional Design with Complete Information
// ============================================================

interface Product {
    id: string;
    code: string | null;
    barcode: string | null;
    name: string;
    name_en: string | null;
    description: string | null;
    product_type: ProductType;
    category_id: string | null;
    category?: { id: string; name: string } | null;
    unit: string;
    purchase_price: number;
    selling_price: number;
    min_stock: number;
    is_trackable: boolean;
    is_composite: boolean;
    duration_minutes: number | null;
    labor_cost: number | null;
    brand: string | null;
    warranty_months: number | null;
    compatible_vehicles: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    image_url?: string | null;
}

interface InventoryItem {
    id: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    avg_cost: number;
    warehouse: { id: string; name: string };
}

interface InventoryTransaction {
    id: string;
    code: string;
    transaction_type: string;
    quantity: number;
    unit_cost: number | null;
    balance_after: number | null;
    created_at: string;
    warehouse: { id: string; name: string };
}

interface ServiceComponent {
    id: string;
    quantity: number;
    is_optional: boolean;
    component: {
        id: string;
        code: string;
        name: string;
        product_type: ProductType;
        selling_price: number;
        unit: string;
    };
}

const productTypeConfig: Record<ProductType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    part: { label: 'قطعة غيار', icon: <Package size={20} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    consumable: { label: 'مستهلك', icon: <Droplet size={20} />, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
    service: { label: 'خدمة', icon: <Wrench size={20} />, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

const transactionTypeLabels: Record<string, { label: string; color: string }> = {
    purchase: { label: 'شراء', color: 'text-green-600' },
    sale: { label: 'بيع', color: 'text-red-600' },
    job_consumption: { label: 'استهلاك أمر شغل', color: 'text-orange-600' },
    job_return: { label: 'إرجاع من أمر شغل', color: 'text-cyan-600' },
    transfer_in: { label: 'تحويل وارد', color: 'text-purple-600' },
    transfer_out: { label: 'تحويل صادر', color: 'text-purple-600' },
    adjustment: { label: 'تسوية', color: 'text-yellow-600' },
    damage: { label: 'تالف', color: 'text-red-600' },
    opening: { label: 'رصيد افتتاحي', color: 'text-gray-600' },
};

export function ProductDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const printRef = useRef<HTMLDivElement>(null);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Fetch product details
    const { data: product, isLoading, error } = useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    category:categories(id, name)
                `)
                .eq('id', id)
                .single();
            if (error) throw error;
            return {
                ...data,
                category: Array.isArray(data.category) ? data.category[0] : data.category,
            } as Product;
        },
        enabled: !!id,
    });

    // Fetch inventory items (stock by warehouse)
    const { data: inventoryItems } = useQuery({
        queryKey: ['product-inventory', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_items')
                .select(`
                    id, quantity, reserved_quantity, available_quantity, avg_cost,
                    warehouse:warehouses(id, name)
                `)
                .eq('product_id', id);
            if (error) throw error;
            return (data || []).map(item => ({
                ...item,
                warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse,
            })) as InventoryItem[];
        },
        enabled: !!id && product?.is_trackable,
    });

    // Fetch recent transactions
    const { data: transactions } = useQuery({
        queryKey: ['product-transactions', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
                    id, code, transaction_type, quantity, unit_cost, balance_after, created_at,
                    warehouse:warehouses(id, name)
                `)
                .eq('product_id', id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return (data || []).map(tx => ({
                ...tx,
                warehouse: Array.isArray(tx.warehouse) ? tx.warehouse[0] : tx.warehouse,
            })) as InventoryTransaction[];
        },
        enabled: !!id && product?.is_trackable,
    });

    // Fetch service components (for composite services)
    const { data: serviceComponents } = useQuery({
        queryKey: ['service-components', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('service_components')
                .select(`
                    id, quantity, is_optional,
                    component:products!component_id(id, code, name, product_type, selling_price, unit)
                `)
                .eq('service_id', id);
            if (error) throw error;
            return (data || []).map(sc => ({
                ...sc,
                component: Array.isArray(sc.component) ? sc.component[0] : sc.component,
            })) as ServiceComponent[];
        },
        enabled: !!id && product?.is_composite,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            navigate('/dashboard/inventory/products');
        },
        onError: (error: Error) => {
            alert('فشل في حذف المنتج: ' + error.message);
        },
    });

    // Print handler
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `منتج - ${product?.name}`,
    });

    // Calculate totals
    const totalStock = inventoryItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const totalAvailable = inventoryItems?.reduce((sum, item) => sum + item.available_quantity, 0) || 0;
    const avgCost = inventoryItems?.[0]?.avg_cost || product?.purchase_price || 0;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (error || !product) {
        return (
            <Card className="border-destructive">
                <CardContent className="p-12 text-center">
                    <AlertTriangle className="mx-auto mb-4 text-destructive" size={48} />
                    <h2 className="text-xl font-semibold mb-2">المنتج غير موجود</h2>
                    <p className="text-muted-foreground mb-4">لم يتم العثور على المنتج المطلوب</p>
                    <Button asChild>
                        <Link to="/dashboard/inventory/products">العودة للقائمة</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const typeConfig = productTypeConfig[product.product_type];

    return (
        <div className="space-y-6" ref={printRef}>
            {/* Breadcrumbs */}
            <PageHeader title="" showBreadcrumbs={true} className="pb-0" />

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" asChild className="shrink-0 print:hidden">
                        <Link to="/dashboard/inventory/products">
                            <ArrowRight size={20} />
                        </Link>
                    </Button>
                    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0", typeConfig.bgColor)}>
                        <span className={typeConfig.color}>{typeConfig.icon}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold">{product.name}</h1>
                            {product.code && (
                                <Badge variant="outline" className="font-mono">{product.code}</Badge>
                            )}
                            <Badge className={cn(typeConfig.bgColor, typeConfig.color)}>
                                {typeConfig.label}
                            </Badge>
                            {!product.is_active && (
                                <Badge variant="destructive">غير نشط</Badge>
                            )}
                        </div>
                        {product.name_en && (
                            <p className="text-muted-foreground">{product.name_en}</p>
                        )}
                        {product.category && (
                            <p className="text-sm text-muted-foreground mt-1">
                                <Tag size={14} className="inline ml-1" />
                                {product.category.name}
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={() => handlePrint()}>
                        <Printer size={16} className="ml-2" />
                        طباعة
                    </Button>
                    <Button size="sm" onClick={() => setShowEditModal(true)}>
                        <Edit size={16} className="ml-2" />
                        تعديل
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreVertical size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                                <Edit size={16} className="ml-2" />
                                تعديل
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setShowDeleteDialog(true)}
                            >
                                <Trash2 size={16} className="ml-2" />
                                حذف
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <DollarSign className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">سعر البيع</p>
                                <p className="text-lg font-bold text-green-600">
                                    {formatCurrency(product.selling_price)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                <DollarSign className="text-red-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">سعر الشراء</p>
                                <p className="text-lg font-bold text-red-600">
                                    {formatCurrency(product.purchase_price)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {product.is_trackable && (
                    <>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                        <Box className="text-blue-600" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">إجمالي المخزون</p>
                                        <p className="text-lg font-bold">
                                            {totalStock} {product.unit}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        totalAvailable < product.min_stock
                                            ? "bg-red-100 dark:bg-red-900/30"
                                            : "bg-emerald-100 dark:bg-emerald-900/30"
                                    )}>
                                        {totalAvailable < product.min_stock ? (
                                            <AlertTriangle className="text-red-600" size={20} />
                                        ) : (
                                            <CheckCircle2 className="text-emerald-600" size={20} />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">المتاح</p>
                                        <p className={cn(
                                            "text-lg font-bold",
                                            totalAvailable < product.min_stock ? "text-red-600" : "text-emerald-600"
                                        )}>
                                            {totalAvailable} {product.unit}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {product.product_type === 'service' && product.duration_minutes && (
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                    <Clock className="text-purple-600" size={20} />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">مدة التنفيذ</p>
                                    <p className="text-lg font-bold">{product.duration_minutes} دقيقة</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details" className="print:hidden">
                <div className="overflow-x-auto">
                    <TabsList className="grid w-full min-w-max grid-cols-4">
                        <TabsTrigger value="details">التفاصيل</TabsTrigger>
                        {product.is_trackable && <TabsTrigger value="stock">المخزون</TabsTrigger>}
                        {product.is_trackable && <TabsTrigger value="transactions">الحركات</TabsTrigger>}
                        {product.is_composite && <TabsTrigger value="components">المكونات</TabsTrigger>}
                    </TabsList>
                </div>

                {/* Details Tab */}
                <TabsContent value="details" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings size={20} />
                                معلومات المنتج
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">الكود</p>
                                        <p className="font-mono">{product.code || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">الباركود</p>
                                        <p className="font-mono">{product.barcode || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">الوحدة</p>
                                        <p>{product.unit}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">الحد الأدنى للمخزون</p>
                                        <p>{product.min_stock} {product.unit}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">الماركة</p>
                                        <p>{product.brand || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">مدة الضمان</p>
                                        <p>{product.warranty_months ? `${product.warranty_months} شهر` : '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">قابل للتتبع</p>
                                        <Badge variant={product.is_trackable ? "default" : "secondary"}>
                                            {product.is_trackable ? 'نعم' : 'لا'}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">تاريخ الإنشاء</p>
                                        <p>{formatDate(product.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                            {product.description && (
                                <div className="mt-6 pt-6 border-t">
                                    <p className="text-sm text-muted-foreground mb-2">الوصف</p>
                                    <p className="whitespace-pre-wrap">{product.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Stock Tab */}
                {product.is_trackable && (
                    <TabsContent value="stock" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Warehouse size={20} />
                                    الأرصدة في المخازن
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!inventoryItems || inventoryItems.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Box size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>لا يوجد رصيد في أي مخزن</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[500px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>المخزن</TableHead>
                                                    <TableHead>الرصيد</TableHead>
                                                    <TableHead>المحجوز</TableHead>
                                                    <TableHead>المتاح</TableHead>
                                                    <TableHead>متوسط التكلفة</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {inventoryItems.map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <Warehouse size={16} className="text-muted-foreground" />
                                                                {item.warehouse?.name}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{item.quantity}</TableCell>
                                                        <TableCell className="text-amber-600">{item.reserved_quantity}</TableCell>
                                                        <TableCell className={cn(
                                                            "font-medium",
                                                            item.available_quantity < product.min_stock ? "text-red-600" : "text-green-600"
                                                        )}>
                                                            {item.available_quantity}
                                                        </TableCell>
                                                        <TableCell>{formatCurrency(item.avg_cost)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Transactions Tab */}
                {product.is_trackable && (
                    <TabsContent value="transactions" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History size={20} />
                                    آخر الحركات
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!transactions || transactions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <History size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>لا توجد حركات</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[600px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>الكود</TableHead>
                                                    <TableHead>النوع</TableHead>
                                                    <TableHead>المخزن</TableHead>
                                                    <TableHead>الكمية</TableHead>
                                                    <TableHead>الرصيد بعد</TableHead>
                                                    <TableHead>التاريخ</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.map(tx => {
                                                    const txConfig = transactionTypeLabels[tx.transaction_type] || { label: tx.transaction_type, color: 'text-gray-600' };
                                                    const isNegative = ['sale', 'job_consumption', 'transfer_out', 'damage'].includes(tx.transaction_type);
                                                    return (
                                                        <TableRow key={tx.id}>
                                                            <TableCell className="font-mono text-sm">{tx.code}</TableCell>
                                                            <TableCell>
                                                                <span className={txConfig.color}>{txConfig.label}</span>
                                                            </TableCell>
                                                            <TableCell>{tx.warehouse?.name}</TableCell>
                                                            <TableCell className={isNegative ? 'text-red-600' : 'text-green-600'}>
                                                                {isNegative ? '-' : '+'}{Math.abs(tx.quantity)}
                                                            </TableCell>
                                                            <TableCell>{tx.balance_after ?? '-'}</TableCell>
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
                    </TabsContent>
                )}

                {/* Components Tab */}
                {product.is_composite && (
                    <TabsContent value="components" className="mt-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Layers size={20} />
                                    مكونات الخدمة
                                </CardTitle>
                                <Button size="sm" variant="outline" onClick={() => setShowEditModal(true)}>
                                    <Edit size={16} className="ml-2" />
                                    تعديل المكونات
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {!serviceComponents || serviceComponents.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Layers size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>لا توجد مكونات</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[600px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>الكود</TableHead>
                                                    <TableHead>المكون</TableHead>
                                                    <TableHead>النوع</TableHead>
                                                    <TableHead>الكمية</TableHead>
                                                    <TableHead>السعر</TableHead>
                                                    <TableHead>اختياري</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {serviceComponents.map(sc => (
                                                    <TableRow key={sc.id}>
                                                        <TableCell className="font-mono text-sm">
                                                            {sc.component?.code}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {sc.component?.name}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">
                                                                {productTypeConfig[sc.component?.product_type]?.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {sc.quantity} {sc.component?.unit}
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatCurrency(sc.component?.selling_price * sc.quantity)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={sc.is_optional ? "secondary" : "default"}>
                                                                {sc.is_optional ? 'اختياري' : 'أساسي'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* Delete Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف "{product.name}"؟ سيتم إخفاء المنتج من القوائم.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate()}
                            className="bg-destructive text-destructive-foreground"
                        >
                            حذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Modal */}
            {showEditModal && id && (
                <EditProductModal
                    open={showEditModal}
                    onOpenChange={setShowEditModal}
                    productId={id}
                />
            )}
        </div>
    );
}

export default ProductDetailsPage;
