import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Package, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

// ============================================================
// Service Components Editor - محرر مكونات الخدمة المركبة
// ============================================================

interface ServiceComponent {
    id: string;
    component_id: string;
    quantity: number;
    is_optional: boolean;
    notes: string | null;
    component: {
        id: string;
        name: string;
        code: string;
        product_type: string;
        unit: string;
        selling_price: number;
    };
}

interface AvailableProduct {
    id: string;
    name: string;
    code: string;
    product_type: string;
    unit: string;
}

interface ServiceComponentsEditorProps {
    serviceId: string;
    isComposite: boolean;
}

export function ServiceComponentsEditor({ serviceId, isComposite }: ServiceComponentsEditorProps) {
    const queryClient = useQueryClient();
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [isOptional, setIsOptional] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch current components
    const { data: components, isLoading } = useQuery({
        queryKey: ['service-components', serviceId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('service_components')
                .select(`
                    id, component_id, quantity, is_optional, notes,
                    component:products!component_id (id, name, code, product_type, unit, selling_price)
                `)
                .eq('service_id', serviceId);
            if (error) throw error;
            return (data || []).map(item => ({
                ...item,
                component: Array.isArray(item.component) ? item.component[0] : item.component,
            })) as ServiceComponent[];
        },
        enabled: !!serviceId && isComposite,
    });

    // Fetch available products (parts and consumables)
    const { data: products } = useQuery({
        queryKey: ['available-components'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, code, product_type, unit')
                .in('product_type', ['part', 'consumable'])
                .eq('is_active', true)
                .order('name')
                .limit(100);
            if (error) throw error;
            return data as AvailableProduct[];
        },
        enabled: isComposite,
    });

    // Filter out already added components
    const availableProducts = products?.filter(
        p => !components?.some(c => c.component_id === p.id)
    );

    // Add component mutation
    const addMutation = useMutation({
        mutationFn: async () => {
            if (!selectedProduct) throw new Error('يرجى اختيار المنتج');
            const qty = parseFloat(quantity);
            if (isNaN(qty) || qty <= 0) throw new Error('يرجى إدخال كمية صحيحة');

            const { error } = await supabase
                .from('service_components')
                .insert({
                    service_id: serviceId,
                    component_id: selectedProduct,
                    quantity: qty,
                    is_optional: isOptional,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-components', serviceId] });
            setSelectedProduct('');
            setQuantity('1');
            setIsOptional(false);
            setError(null);
        },
        onError: (err: Error) => {
            setError(err.message);
        },
    });

    // Remove component mutation
    const removeMutation = useMutation({
        mutationFn: async (componentId: string) => {
            const { error } = await supabase
                .from('service_components')
                .delete()
                .eq('id', componentId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-components', serviceId] });
        },
    });

    // Update quantity mutation
    const updateQuantityMutation = useMutation({
        mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
            const { error } = await supabase
                .from('service_components')
                .update({ quantity })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-components', serviceId] });
        },
    });

    if (!isComposite) {
        return (
            <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                <Package className="mx-auto mb-2 opacity-50" size={32} />
                <p>هذه الخدمة ليست مركبة</p>
                <p className="text-sm">فعّل خيار "خدمة مركبة" لإضافة مكونات</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                    <Package size={18} />
                    مكونات الخدمة
                </h3>
                <Badge variant="outline">
                    {components?.length || 0} مكون
                </Badge>
            </div>

            {/* Current Components Table */}
            {components && components.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>المكون</TableHead>
                                <TableHead className="w-24">الكمية</TableHead>
                                <TableHead className="w-24">اختياري</TableHead>
                                <TableHead className="w-16"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {components.map((comp) => (
                                <TableRow key={comp.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{comp.component.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {comp.component.code} • {comp.component.unit}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            defaultValue={comp.quantity}
                                            className="w-20 h-8"
                                            dir="ltr"
                                            onBlur={(e) => {
                                                const newQty = parseFloat(e.target.value);
                                                if (!isNaN(newQty) && newQty > 0 && newQty !== comp.quantity) {
                                                    updateQuantityMutation.mutate({ id: comp.id, quantity: newQty });
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {comp.is_optional ? (
                                            <Badge variant="secondary">اختياري</Badge>
                                        ) : (
                                            <Badge>إلزامي</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => removeMutation.mutate(comp.id)}
                                            disabled={removeMutation.isPending}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Add New Component */}
            <div className="border rounded-lg p-4 bg-muted/30">
                <Label className="mb-3 block">إضافة مكون جديد</Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر قطعة أو مستهلك..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableProducts?.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                        {product.name} ({product.code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="الكمية"
                            dir="ltr"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="optional"
                            checked={isOptional}
                            onCheckedChange={(checked) => setIsOptional(checked as boolean)}
                        />
                        <Label htmlFor="optional" className="text-sm">اختياري</Label>
                        <Button
                            size="sm"
                            onClick={() => addMutation.mutate()}
                            disabled={addMutation.isPending || !selectedProduct}
                            className="mr-auto"
                        >
                            <Plus size={16} />
                            إضافة
                        </Button>
                    </div>
                </div>
                {error && (
                    <div className="mt-2 text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}
            </div>

            {/* Empty State */}
            {(!components || components.length === 0) && !isLoading && (
                <p className="text-center text-muted-foreground text-sm py-4">
                    لم يتم إضافة مكونات بعد. أضف قطع غيار أو مستهلكات ستُضاف تلقائياً عند طلب هذه الخدمة.
                </p>
            )}
        </div>
    );
}

export default ServiceComponentsEditor;
