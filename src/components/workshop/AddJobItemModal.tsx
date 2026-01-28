import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wrench, Package, Settings, Truck, Search, FileText, Shield, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import type { JobItemType, ProductType } from '@/types/enums';

// ============================================================
// Add Job Item Modal Component - Redesigned
// ============================================================
// يدعم:
// 1. اختيار من جدول products (قطع/خدمات/مستهلكات)
// 2. الخدمات المركبة ومكوناتها
// 3. إضافة بنود يدوية (عمالة/ملاحظة/ضمان)
// ============================================================

interface AddJobItemModalProps {
    jobOrderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface Product {
    id: string;
    code: string | null;
    name: string;
    product_type: ProductType;
    selling_price: number;
    unit: string;
    is_composite: boolean;
    is_trackable: boolean;
}

interface ServiceComponent {
    id: string;
    quantity: number;
    is_optional: boolean;
    component: Product;
}

interface ManualItemForm {
    item_type: JobItemType;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    notes: string;
}

const MANUAL_ITEM_TYPES: { value: JobItemType; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'labor', label: 'عمالة / مصنعية', icon: Wrench, color: 'text-blue-500' },
    { value: 'external', label: 'خدمة خارجية', icon: Truck, color: 'text-purple-500' },
    { value: 'note', label: 'ملاحظة فنية', icon: FileText, color: 'text-gray-500' },
    { value: 'warranty', label: 'ضمان', icon: Shield, color: 'text-green-500' },
];

const PRODUCT_TYPE_MAP: Record<ProductType, JobItemType> = {
    part: 'part',
    consumable: 'consumable',
    service: 'labor',
};

const initialManualForm: ManualItemForm = {
    item_type: 'labor',
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    notes: '',
};

export function AddJobItemModal({
    jobOrderId,
    open,
    onOpenChange,
    onSuccess,
}: AddJobItemModalProps) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'products' | 'manual'>('products');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<ProductType | 'all'>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [manualForm, setManualForm] = useState<ManualItemForm>(initialManualForm);
    const [productQuantity, setProductQuantity] = useState(1);
    const [productDiscount, setProductDiscount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Fetch products
    const { data: products, isLoading: productsLoading } = useQuery({
        queryKey: ['products-active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, code, name, product_type, selling_price, unit, is_composite, is_trackable')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            return data as Product[];
        },
        enabled: open,
    });

    // Fetch service components when a composite service is selected
    const { data: serviceComponents } = useQuery({
        queryKey: ['service-components', selectedProduct?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('service_components')
                .select(`
          id, quantity, is_optional,
          component:products!service_components_component_id_fkey (
            id, code, name, product_type, selling_price, unit, is_trackable
          )
        `)
                .eq('service_id', selectedProduct?.id);

            if (error) throw error;
            return data.map(sc => ({
                ...sc,
                component: Array.isArray(sc.component) ? sc.component[0] : sc.component
            })) as ServiceComponent[];
        },
        enabled: !!selectedProduct?.is_composite,
    });

    // Fetch inventory totals
    const { data: inventoryTotals } = useQuery({
        queryKey: ['inventory-totals-modal'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('product_id, quantity, reserved_quantity');
            if (error) throw error;

            const totals = new Map<string, number>();
            (data || []).forEach(item => {
                const current = totals.get(item.product_id) || 0;
                const available = Math.max(0, item.quantity - (item.reserved_quantity ?? 0));
                totals.set(item.product_id, current + available);
            });
            return totals;
        },
        enabled: open,
    });

    // Filter products
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        return products.filter(p => {
            const matchesSearch = !search ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.code?.toLowerCase().includes(search.toLowerCase());
            const matchesType = typeFilter === 'all' || p.product_type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [products, search, typeFilter]);

    // Calculate totals
    const productTotal = selectedProduct
        ? selectedProduct.selling_price * productQuantity * (1 - productDiscount / 100)
        : 0;
    const manualTotal = manualForm.quantity * manualForm.unit_price * (1 - manualForm.discount_percent / 100);

    // Mutation to add items
    const addItemsMutation = useMutation({
        mutationFn: async () => {
            const items: Array<{
                job_order_id: string;
                product_id: string | null;
                item_type: JobItemType;
                description: string;
                quantity: number;
                unit_price: number;
                discount_percent: number;
                notes: string | null;
            }> = [];

            if (activeTab === 'products' && selectedProduct) {
                // Add the main product/service
                items.push({
                    job_order_id: jobOrderId,
                    product_id: selectedProduct.id,
                    item_type: PRODUCT_TYPE_MAP[selectedProduct.product_type],
                    description: selectedProduct.name,
                    quantity: productQuantity,
                    unit_price: selectedProduct.selling_price,
                    discount_percent: productDiscount,
                    notes: null,
                });

            } else if (activeTab === 'manual') {
                items.push({
                    job_order_id: jobOrderId,
                    product_id: null,
                    item_type: manualForm.item_type,
                    description: manualForm.description,
                    quantity: manualForm.quantity,
                    unit_price: manualForm.unit_price,
                    discount_percent: manualForm.discount_percent,
                    notes: manualForm.notes || null,
                });
            }

            if (items.length === 0) {
                throw new Error('لا توجد بنود للإضافة');
            }

            const { error } = await supabase
                .from('job_items')
                .insert(items);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-items', jobOrderId] });
            handleClose();
            onSuccess?.();
        },
        onError: (err) => {
            console.error('Error adding items:', err);
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الإضافة');
        },
    });

    const handleClose = () => {
        onOpenChange(false);
        setActiveTab('products');
        setSearch('');
        setTypeFilter('all');
        setSelectedProduct(null);
        setManualForm(initialManualForm);
        setProductQuantity(1);
        setProductDiscount(0);
        setError(null);
    };

    const handleSubmit = () => {
        if (activeTab === 'products' && !selectedProduct) {
            setError('يرجى اختيار منتج أو خدمة');
            return;
        }

        // Validate stock
        if (activeTab === 'products' && selectedProduct?.is_trackable) {
            const stock = inventoryTotals?.get(selectedProduct.id) || 0;
            if (productQuantity > stock) {
                setError(`الكمية المطلوبة (${productQuantity}) أكبر من المتوفر (${stock})`);
                return;
            }
        }

        if (activeTab === 'manual' && !manualForm.description.trim()) {
            setError('يرجى إدخال وصف البند');
            return;
        }
        addItemsMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus size={20} />
                        إضافة بند جديد
                    </DialogTitle>
                    <DialogDescription>
                        اختر من المنتجات والخدمات أو أضف بنداً يدوياً
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'products' | 'manual')} className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="products" className="gap-2">
                            <Package size={16} />
                            من المنتجات
                        </TabsTrigger>
                        <TabsTrigger value="manual" className="gap-2">
                            <Wrench size={16} />
                            بند يدوي
                        </TabsTrigger>
                    </TabsList>

                    {/* Products Tab */}
                    <TabsContent value="products" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
                        {!selectedProduct ? (
                            <>
                                {/* Search & Filter */}
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="بحث بالاسم أو الكود..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="pr-9"
                                        />
                                    </div>
                                    <div className="flex gap-1">
                                        {(['all', 'part', 'consumable', 'service'] as const).map((type) => (
                                            <Button
                                                key={type}
                                                size="sm"
                                                variant={typeFilter === type ? 'default' : 'outline'}
                                                onClick={() => setTypeFilter(type)}
                                                className="text-xs"
                                            >
                                                {type === 'all' ? 'الكل' :
                                                    type === 'part' ? 'قطع' :
                                                        type === 'consumable' ? 'مستهلكات' : 'خدمات'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Products List */}
                                <div className="flex-1 overflow-y-auto border rounded-lg">
                                    {productsLoading ? (
                                        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
                                    ) : filteredProducts.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">لا توجد منتجات</div>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredProducts.map((product) => {
                                                const availableStock = inventoryTotals?.get(product.id) || 0;
                                                const isOutOfStock = product.is_trackable && availableStock <= 0;

                                                return (
                                                    <div
                                                        key={product.id}
                                                        className={cn(
                                                            "p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors",
                                                            isOutOfStock && "opacity-60 grayscale"
                                                        )}
                                                        onClick={() => {
                                                            if (isOutOfStock) {
                                                                alert('هذا المنتج غير متوفر في المخزون');
                                                                return;
                                                            }
                                                            setSelectedProduct(product);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                                                product.product_type === 'part' && "bg-green-100 text-green-600",
                                                                product.product_type === 'consumable' && "bg-orange-100 text-orange-600",
                                                                product.product_type === 'service' && "bg-blue-100 text-blue-600"
                                                            )}>
                                                                {product.product_type === 'part' && <Package size={20} />}
                                                                {product.product_type === 'consumable' && <Settings size={20} />}
                                                                {product.product_type === 'service' && <Wrench size={20} />}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium">{product.name}</p>
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                    {product.code && <span>{product.code}</span>}
                                                                    {product.is_composite && (
                                                                        <Badge variant="secondary" className="text-xs">مركبة</Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-bold">{product.selling_price.toLocaleString('ar-EG')} ج.م</p>
                                                            {product.is_trackable && (
                                                                <p className={cn(
                                                                    "text-xs font-medium",
                                                                    availableStock > 0 ? "text-green-600" : "text-destructive"
                                                                )}>
                                                                    {availableStock > 0 ? `متوفر: ${availableStock}` : 'غير متوفر'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Selected Product View */
                            <div className="space-y-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedProduct(null)}
                                    className="gap-1"
                                >
                                    <ChevronLeft size={16} className="rotate-180" />
                                    رجوع للقائمة
                                </Button>

                                {/* Product Info */}
                                <div className="p-4 bg-muted/50 rounded-lg">
                                    <p className="font-bold text-lg">{selectedProduct.name}</p>
                                    <p className="text-muted-foreground">
                                        {selectedProduct.selling_price.toLocaleString('ar-EG')} ج.م / {selectedProduct.unit}
                                    </p>
                                </div>

                                {/* Quantity & Discount */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>الكمية</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={productQuantity}
                                            onChange={(e) => setProductQuantity(parseFloat(e.target.value) || 1)}
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <Label>الخصم %</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={productDiscount}
                                            onChange={(e) => setProductDiscount(parseFloat(e.target.value) || 0)}
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {/* Composite Service Components */}
                                {selectedProduct.is_composite && serviceComponents && serviceComponents.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>مكونات الخدمة</Label>
                                        <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                                            {serviceComponents.map((sc) => (
                                                <div key={sc.id} className="p-2 flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{sc.component?.name}</span>
                                                        {sc.is_optional && (
                                                            <Badge variant="outline" className="text-xs">اختياري</Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-muted-foreground">x{sc.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            يتم صرف المكونات تلقائياً عند الصرف بناءً على تعريف الخدمة.
                                        </p>
                                    </div>
                                )}

                                {/* Total */}
                                <div className="bg-primary/10 rounded-lg p-4 flex justify-between items-center">
                                    <span>إجمالي المنتج:</span>
                                    <span className="text-2xl font-bold text-primary">
                                        {productTotal.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Manual Tab */}
                    <TabsContent value="manual" className="space-y-4 mt-4">
                        {/* Type Selection */}
                        <div>
                            <Label className="mb-3 block">نوع البند</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {MANUAL_ITEM_TYPES.map((option) => {
                                    const Icon = option.icon;
                                    const isSelected = manualForm.item_type === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setManualForm({ ...manualForm, item_type: option.value })}
                                            className={cn(
                                                "p-3 rounded-lg border-2 flex items-center gap-2 transition-all",
                                                isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                            )}
                                        >
                                            <Icon size={20} className={option.color} />
                                            <span className={cn("text-sm font-medium", isSelected && "text-primary")}>
                                                {option.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <Label htmlFor="description">الوصف *</Label>
                            <Textarea
                                id="description"
                                value={manualForm.description}
                                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                                placeholder="وصف البند..."
                                className="mt-1 min-h-[80px]"
                            />
                        </div>

                        {/* Quantity, Price, Discount */}
                        {manualForm.item_type !== 'note' && (
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label>الكمية</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={manualForm.quantity}
                                        onChange={(e) => setManualForm({ ...manualForm, quantity: parseFloat(e.target.value) || 1 })}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>السعر</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={manualForm.unit_price}
                                        onChange={(e) => setManualForm({ ...manualForm, unit_price: parseFloat(e.target.value) || 0 })}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label>الخصم %</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={manualForm.discount_percent}
                                        onChange={(e) => setManualForm({ ...manualForm, discount_percent: parseFloat(e.target.value) || 0 })}
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Total */}
                        {manualForm.item_type !== 'note' && (
                            <div className="bg-muted/50 rounded-lg p-4 flex justify-between items-center">
                                <span>الإجمالي:</span>
                                <span className="text-2xl font-bold text-primary">
                                    {manualTotal.toLocaleString('ar-EG')} ج.م
                                </span>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Error */}
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={handleClose} disabled={addItemsMutation.isPending}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={addItemsMutation.isPending} className="gap-2">
                        {addItemsMutation.isPending ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                جاري الإضافة...
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                إضافة البند
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AddJobItemModal;
