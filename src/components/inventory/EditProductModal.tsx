import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Droplet, Wrench, Loader2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceComponentsEditor } from './ServiceComponentsEditor';

// ============================================================
// Edit Product Modal - تعديل منتج
// ============================================================

type ProductType = 'part' | 'consumable' | 'service';

interface Category {
    id: string;
    name: string;
}

interface Product {
    id: string;
    code: string | null;
    barcode: string | null;
    name: string;
    name_en: string | null;
    description: string | null;
    product_type: ProductType;
    category_id: string | null;
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
    is_active: boolean;
}

interface EditProductModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId: string;
}

export function EditProductModal({ open, onOpenChange, productId }: EditProductModalProps) {
    const queryClient = useQueryClient();

    // Form state
    const [productType, setProductType] = useState<ProductType>('part');
    const [name, setName] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [unit, setUnit] = useState('قطعة');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [minStock, setMinStock] = useState('0');
    const [isTrackable, setIsTrackable] = useState(true);
    const [isComposite, setIsComposite] = useState(false);
    const [barcode, setBarcode] = useState('');
    const [brand, setBrand] = useState('');
    const [warrantyMonths, setWarrantyMonths] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('');
    const [laborCost, setLaborCost] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Fetch product data
    const { data: product, isLoading: isLoadingProduct } = useQuery({
        queryKey: ['product-edit', productId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();
            if (error) throw error;
            return data as Product;
        },
        enabled: open && !!productId,
    });

    // Prefill form when product data is loaded
    useEffect(() => {
        if (product) {
            setProductType(product.product_type);
            setName(product.name || '');
            setNameEn(product.name_en || '');
            setDescription(product.description || '');
            setCategoryId(product.category_id || '');
            setUnit(product.unit || 'قطعة');
            setPurchasePrice(product.purchase_price?.toString() || '');
            setSellingPrice(product.selling_price?.toString() || '');
            setMinStock(product.min_stock?.toString() || '0');
            setIsTrackable(product.is_trackable);
            setIsComposite(product.is_composite);
            setBarcode(product.barcode || '');
            setBrand(product.brand || '');
            setWarrantyMonths(product.warranty_months?.toString() || '');
            setDurationMinutes(product.duration_minutes?.toString() || '');
            setLaborCost(product.labor_cost?.toString() || '');
            setIsActive(product.is_active);
        }
    }, [product]);

    // Fetch categories
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
        enabled: open,
    });

    // Update product mutation
    const updateMutation = useMutation({
        mutationFn: async () => {
            const productData = {
                name,
                name_en: nameEn || null,
                description: description || null,
                product_type: productType,
                category_id: categoryId && categoryId !== 'none' ? categoryId : null,
                unit,
                purchase_price: parseFloat(purchasePrice) || 0,
                selling_price: parseFloat(sellingPrice) || 0,
                min_stock: parseFloat(minStock) || 0,
                is_trackable: productType !== 'service' ? isTrackable : false,
                is_composite: productType === 'service' ? isComposite : false,
                barcode: barcode || null,
                brand: brand || null,
                warranty_months: warrantyMonths ? parseInt(warrantyMonths) : null,
                duration_minutes: productType === 'service' && durationMinutes ? parseInt(durationMinutes) : null,
                labor_cost: productType === 'service' ? parseFloat(laborCost) || 0 : 0,
                is_active: isActive,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('products')
                .update(productData)
                .eq('id', productId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['product', productId] });
            queryClient.invalidateQueries({ queryKey: ['product-edit', productId] });
            onOpenChange(false);
        },
        onError: (error) => {
            console.error('Error updating product:', error);
            alert('فشل تحديث المنتج. يرجى المحاولة مرة أخرى.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('يرجى إدخال اسم المنتج');
            return;
        }
        updateMutation.mutate();
    };

    const productTypeOptions = [
        { value: 'part', label: 'قطعة غيار', icon: Package, color: 'text-blue-600' },
        { value: 'consumable', label: 'مستهلك', icon: Droplet, color: 'text-amber-600' },
        { value: 'service', label: 'خدمة', icon: Wrench, color: 'text-purple-600' },
    ] as const;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تعديل المنتج</DialogTitle>
                    <DialogDescription>
                        تعديل بيانات المنتج "{product?.name}"
                    </DialogDescription>
                </DialogHeader>

                {isLoadingProduct ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Product Type Selection */}
                        <div className="space-y-2">
                            <Label>نوع المنتج</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {productTypeOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setProductType(option.value)}
                                        className={cn(
                                            'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                            productType === option.value
                                                ? 'border-primary bg-primary/5'
                                                : 'border-muted hover:border-muted-foreground/30'
                                        )}
                                    >
                                        <option.icon size={24} className={option.color} />
                                        <span className="text-sm font-medium">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <p className="font-medium">حالة المنتج</p>
                                <p className="text-sm text-muted-foreground">
                                    {isActive ? 'نشط - يظهر في القوائم' : 'غير نشط - مخفي'}
                                </p>
                            </div>
                            <Switch
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>

                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className={`grid w-full ${productType === 'service' && isComposite ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                                <TabsTrigger value="pricing">الأسعار والمخزون</TabsTrigger>
                                <TabsTrigger value="extra">بيانات إضافية</TabsTrigger>
                                {productType === 'service' && isComposite && (
                                    <TabsTrigger value="components" className="gap-1">
                                        <Layers size={14} />
                                        المكونات
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            {/* Basic Info Tab */}
                            <TabsContent value="basic" className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">الاسم بالعربي *</Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="مثال: زيت محرك 5W30"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nameEn">الاسم بالإنجليزي</Label>
                                        <Input
                                            id="nameEn"
                                            value={nameEn}
                                            onChange={(e) => setNameEn(e.target.value)}
                                            placeholder="Engine Oil 5W30"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">الوصف</Label>
                                    <Textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="وصف المنتج أو الخدمة..."
                                        rows={3}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="category">التصنيف</Label>
                                        <Select value={categoryId || 'none'} onValueChange={(val) => setCategoryId(val === 'none' ? '' : val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر التصنيف" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">بدون تصنيف</SelectItem>
                                                {categories?.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>
                                                        {cat.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="unit">الوحدة</Label>
                                        <Select value={unit} onValueChange={setUnit}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="قطعة">قطعة</SelectItem>
                                                <SelectItem value="لتر">لتر</SelectItem>
                                                <SelectItem value="كيلو">كيلو</SelectItem>
                                                <SelectItem value="متر">متر</SelectItem>
                                                <SelectItem value="علبة">علبة</SelectItem>
                                                <SelectItem value="طقم">طقم</SelectItem>
                                                <SelectItem value="ساعة">ساعة</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Pricing Tab */}
                            <TabsContent value="pricing" className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="purchasePrice">سعر الشراء</Label>
                                        <Input
                                            id="purchasePrice"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={purchasePrice}
                                            onChange={(e) => setPurchasePrice(e.target.value)}
                                            placeholder="0.00"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sellingPrice">سعر البيع</Label>
                                        <Input
                                            id="sellingPrice"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={sellingPrice}
                                            onChange={(e) => setSellingPrice(e.target.value)}
                                            placeholder="0.00"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {productType !== 'service' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="minStock">الحد الأدنى للمخزون</Label>
                                                <Input
                                                    id="minStock"
                                                    type="number"
                                                    min="0"
                                                    value={minStock}
                                                    onChange={(e) => setMinStock(e.target.value)}
                                                    placeholder="0"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="barcode">الباركود</Label>
                                                <Input
                                                    id="barcode"
                                                    value={barcode}
                                                    onChange={(e) => setBarcode(e.target.value)}
                                                    placeholder="1234567890123"
                                                    dir="ltr"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">تتبع المخزون</p>
                                                <p className="text-sm text-muted-foreground">
                                                    تفعيل متابعة الأرصدة والحركات
                                                </p>
                                            </div>
                                            <Switch
                                                checked={isTrackable}
                                                onCheckedChange={setIsTrackable}
                                            />
                                        </div>
                                    </>
                                )}

                                {productType === 'service' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="laborCost">تكلفة العمالة</Label>
                                                <Input
                                                    id="laborCost"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={laborCost}
                                                    onChange={(e) => setLaborCost(e.target.value)}
                                                    placeholder="0.00"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="durationMinutes">مدة الخدمة (بالدقائق)</Label>
                                                <Input
                                                    id="durationMinutes"
                                                    type="number"
                                                    min="0"
                                                    value={durationMinutes}
                                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                                    placeholder="60"
                                                    dir="ltr"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">خدمة مركبة</p>
                                                <p className="text-sm text-muted-foreground">
                                                    تحتوي على قطع ومستهلكات تُضاف تلقائياً
                                                </p>
                                            </div>
                                            <Switch
                                                checked={isComposite}
                                                onCheckedChange={setIsComposite}
                                            />
                                        </div>
                                    </>
                                )}
                            </TabsContent>

                            {/* Extra Info Tab */}
                            <TabsContent value="extra" className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="brand">العلامة التجارية</Label>
                                        <Input
                                            id="brand"
                                            value={brand}
                                            onChange={(e) => setBrand(e.target.value)}
                                            placeholder="مثال: Toyota, Castrol"
                                        />
                                    </div>
                                    {productType !== 'service' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="warrantyMonths">مدة الضمان (بالشهور)</Label>
                                            <Input
                                                id="warrantyMonths"
                                                type="number"
                                                min="0"
                                                value={warrantyMonths}
                                                onChange={(e) => setWarrantyMonths(e.target.value)}
                                                placeholder="12"
                                                dir="ltr"
                                            />
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Components Tab - For Composite Services */}
                            {productType === 'service' && isComposite && (
                                <TabsContent value="components" className="mt-4">
                                    <ServiceComponentsEditor
                                        serviceId={productId}
                                        isComposite={isComposite}
                                    />
                                </TabsContent>
                            )}
                        </Tabs>

                        <DialogFooter className="flex-row-reverse gap-2">
                            <Button type="submit" disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default EditProductModal;
