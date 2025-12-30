import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    Plus, ArrowLeftRight, Package, Warehouse,
    Check, X, Trash2, Search
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { cn, formatDate } from '@/lib/utils';

// ============================================================
// Warehouse Transfers Page - التحويلات بين المخازن (متعدد الأصناف)
// ============================================================

interface WarehouseItem {
    id: string;
    name: string;
    is_default: boolean;
}

interface Product {
    id: string;
    code: string;
    name: string;
}

interface InventoryItem {
    product_id: string;
    quantity: number;
    product: Product;
}

interface TransferItem {
    product_id: string;
    product_name: string;
    product_code: string;
    quantity: number;
    available: number;
}

export function WarehouseTransfersPage() {
    const queryClient = useQueryClient();
    const [showDialog, setShowDialog] = useState(false);

    // Form state
    const [fromWarehouseId, setFromWarehouseId] = useState('');
    const [toWarehouseId, setToWarehouseId] = useState('');
    const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
    const [notes, setNotes] = useState('');

    // Add item state
    const [selectedProductId, setSelectedProductId] = useState('');
    const [itemQuantity, setItemQuantity] = useState('1');

    // Fetch warehouses
    const { data: warehouses } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('warehouses')
                .select('id, name, is_default')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data as WarehouseItem[];
        },
    });

    // Fetch products with inventory in from_warehouse
    const { data: inventoryItems } = useQuery({
        queryKey: ['inventory-for-transfer', fromWarehouseId],
        queryFn: async () => {
            if (!fromWarehouseId) return [];
            const { data, error } = await supabase
                .from('inventory_items')
                .select(`
                    product_id,
                    quantity,
                    product:products (id, code, name)
                `)
                .eq('warehouse_id', fromWarehouseId)
                .gt('quantity', 0);
            if (error) throw error;
            return (data || []).map(item => ({
                ...item,
                product: Array.isArray(item.product) ? item.product[0] : item.product,
            })) as InventoryItem[];
        },
        enabled: !!fromWarehouseId,
    });

    // Filter out already added items
    const availableProducts = inventoryItems?.filter(
        item => !transferItems.some(ti => ti.product_id === item.product_id)
    );

    // Get selected product available quantity
    const selectedInventory = inventoryItems?.find(i => i.product_id === selectedProductId);
    const availableQty = selectedInventory?.quantity || 0;

    // Fetch transfers history
    const { data: transfers, isLoading } = useQuery({
        queryKey: ['warehouse-transfers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
                    id, code, quantity, notes, created_at,
                    product:products (id, code, name)
                `)
                .eq('transaction_type', 'transfer_out')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            return (data || []).map(t => ({
                ...t,
                product: Array.isArray(t.product) ? t.product[0] : t.product,
            }));
        },
    });

    // Add item to transfer list
    const handleAddItem = () => {
        if (!selectedProductId) {
            alert('يرجى اختيار المنتج أولاً');
            return;
        }
        const inventory = inventoryItems?.find(i => i.product_id === selectedProductId);
        if (!inventory || !inventory.product) {
            alert('المنتج غير موجود');
            return;
        }

        const qty = parseFloat(itemQuantity) || 0;
        if (qty <= 0) {
            alert('يرجى إدخال كمية صحيحة');
            return;
        }
        if (qty > inventory.quantity) {
            alert(`الكمية المطلوبة (${qty}) أكبر من المتاح (${inventory.quantity})`);
            return;
        }

        // Check if product already exists in list
        const existingIndex = transferItems.findIndex(ti => ti.product_id === selectedProductId);
        if (existingIndex >= 0) {
            // Update quantity instead of adding duplicate
            const updated = [...transferItems];
            const newQty = updated[existingIndex].quantity + qty;
            if (newQty > inventory.quantity) {
                alert(`الكمية الإجمالية (${newQty}) أكبر من المتاح (${inventory.quantity})`);
                return;
            }
            updated[existingIndex].quantity = newQty;
            setTransferItems(updated);
        } else {
            // Add new item
            setTransferItems(prev => [...prev, {
                product_id: inventory.product_id,
                product_name: inventory.product?.name || '',
                product_code: inventory.product?.code || '',
                quantity: qty,
                available: inventory.quantity,
            }]);
        }

        // Reset selection
        setSelectedProductId('');
        setItemQuantity('1');
    };

    // Remove item from list
    const handleRemoveItem = (index: number) => {
        setTransferItems(transferItems.filter((_, i) => i !== index));
    };

    // Update item quantity
    const handleUpdateQuantity = (index: number, newQty: number) => {
        if (newQty <= 0) return;
        const item = transferItems[index];
        if (newQty > item.available) {
            alert('الكمية أكبر من المتاح');
            return;
        }
        const updated = [...transferItems];
        updated[index].quantity = newQty;
        setTransferItems(updated);
    };

    // Create transfer mutation
    const transferMutation = useMutation({
        mutationFn: async () => {
            if (!fromWarehouseId || !toWarehouseId) {
                throw new Error('يرجى اختيار المخزنين');
            }
            if (fromWarehouseId === toWarehouseId) {
                throw new Error('لا يمكن التحويل لنفس المخزن');
            }
            // Filter out any invalid items
            const validItems = transferItems.filter(item =>
                item.product_id && item.quantity > 0
            );

            if (validItems.length === 0) {
                throw new Error('يرجى إضافة أصناف للتحويل');
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // Generate transfer code for this batch
            const transferCode = `TRF-${Date.now().toString(36).toUpperCase()}`;

            // Process each valid item
            for (const item of validItems) {
                // Get source inventory item
                const { data: sourceItem } = await supabase
                    .from('inventory_items')
                    .select('quantity')
                    .eq('product_id', item.product_id)
                    .eq('warehouse_id', fromWarehouseId)
                    .single();

                const sourceQty = sourceItem?.quantity || 0;
                if (item.quantity > sourceQty) {
                    throw new Error(`الكمية المطلوبة لـ ${item.product_name} أكبر من المتاح (${sourceQty})`);
                }

                // Create transfer_out transaction
                const { error: outError } = await supabase
                    .from('inventory_transactions')
                    .insert({
                        code: transferCode,
                        product_id: item.product_id,
                        warehouse_id: fromWarehouseId,
                        transaction_type: 'transfer_out',
                        quantity: item.quantity,
                        balance_before: sourceQty,
                        balance_after: sourceQty - item.quantity,
                        reference_type: 'warehouse_transfer',
                        notes: notes || `تحويل إلى مخزن آخر`,
                        created_by: user?.id,
                    });
                if (outError) throw outError;

                // Decrease source inventory
                const { error: decreaseError } = await supabase
                    .from('inventory_items')
                    .update({
                        quantity: sourceQty - item.quantity,
                        last_updated: new Date().toISOString(),
                    })
                    .eq('product_id', item.product_id)
                    .eq('warehouse_id', fromWarehouseId);
                if (decreaseError) throw decreaseError;

                // Get destination inventory
                const { data: destItem } = await supabase
                    .from('inventory_items')
                    .select('quantity')
                    .eq('product_id', item.product_id)
                    .eq('warehouse_id', toWarehouseId)
                    .single();

                const destQty = destItem?.quantity || 0;

                // Upsert destination inventory
                const { error: upsertError } = await supabase
                    .from('inventory_items')
                    .upsert({
                        product_id: item.product_id,
                        warehouse_id: toWarehouseId,
                        quantity: destQty + item.quantity,
                        last_updated: new Date().toISOString(),
                    }, {
                        onConflict: 'product_id,warehouse_id',
                    });
                if (upsertError) throw upsertError;

                // Create transfer_in transaction
                const { error: inError } = await supabase
                    .from('inventory_transactions')
                    .insert({
                        code: transferCode + '-IN',
                        product_id: item.product_id,
                        warehouse_id: toWarehouseId,
                        transaction_type: 'transfer_in',
                        quantity: item.quantity,
                        balance_before: destQty,
                        balance_after: destQty + item.quantity,
                        reference_type: 'warehouse_transfer',
                        notes: notes || `تحويل من مخزن آخر`,
                        created_by: user?.id,
                    });
                if (inError) throw inError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouse-transfers'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            handleCloseDialog();
        },
        onError: (error: Error) => {
            console.error('Transfer error:', error);
            alert(error.message || 'فشل التحويل');
        },
    });

    const handleCloseDialog = () => {
        setShowDialog(false);
        setFromWarehouseId('');
        setToWarehouseId('');
        setTransferItems([]);
        setSelectedProductId('');
        setItemQuantity('1');
        setNotes('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        transferMutation.mutate();
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">التحويلات بين المخازن</h1>
                        <p className="text-muted-foreground">نقل المنتجات بين المخازن المختلفة</p>
                    </div>
                    <Button className="gap-2" onClick={() => setShowDialog(true)}>
                        <Plus size={18} />
                        تحويل جديد
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <ArrowLeftRight size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{transfers?.length || 0}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي التحويلات</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Warehouse size={20} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{warehouses?.length || 0}</p>
                                    <p className="text-xs text-muted-foreground">المخازن</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Transfers Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>سجل التحويلات</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : transfers && transfers.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>الكود</TableHead>
                                            <TableHead>المنتج</TableHead>
                                            <TableHead>الكمية</TableHead>
                                            <TableHead>الملاحظات</TableHead>
                                            <TableHead>التاريخ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transfers.map((transfer: any) => (
                                            <TableRow key={transfer.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {transfer.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <span className="font-medium">{transfer.product?.name}</span>
                                                        <span className="text-xs text-muted-foreground mr-2">
                                                            ({transfer.product?.code})
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{transfer.quantity}</TableCell>
                                                <TableCell>{transfer.notes || '-'}</TableCell>
                                                <TableCell>
                                                    {formatDate(transfer.created_at)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <ArrowLeftRight size={48} className="mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">لا توجد تحويلات</h3>
                                <p className="text-muted-foreground mb-4">
                                    ابدأ بإنشاء أول تحويل بين المخازن
                                </p>
                                <Button onClick={() => setShowDialog(true)}>
                                    <Plus size={18} className="ml-2" />
                                    تحويل جديد
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Transfer Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowLeftRight size={20} />
                            تحويل بين المخازن
                        </DialogTitle>
                        <DialogDescription>
                            نقل عدة أصناف من مخزن لآخر في تحويل واحد
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Warehouses Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>من مخزن *</Label>
                                <Select value={fromWarehouseId} onValueChange={(v) => {
                                    setFromWarehouseId(v);
                                    setTransferItems([]); // Reset items when warehouse changes
                                    setSelectedProductId('');
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر المخزن المصدر" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses?.filter(w => w.id !== toWarehouseId).map((warehouse) => (
                                            <SelectItem key={warehouse.id} value={warehouse.id}>
                                                {warehouse.name}
                                                {warehouse.is_default && ' (الافتراضي)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>إلى مخزن *</Label>
                                <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر المخزن الهدف" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses?.filter(w => w.id !== fromWarehouseId).map((warehouse) => (
                                            <SelectItem key={warehouse.id} value={warehouse.id}>
                                                {warehouse.name}
                                                {warehouse.is_default && ' (الافتراضي)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Add Item Section */}
                        {fromWarehouseId && toWarehouseId && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">إضافة صنف للتحويل</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="اختر المنتج" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableProducts?.map((item) => (
                                                        <SelectItem key={item.product_id} value={item.product_id}>
                                                            <span>{item.product?.name}</span>
                                                            <span className="text-muted-foreground mr-2">
                                                                (متاح: {item.quantity})
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                    {availableProducts?.length === 0 && (
                                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                                            لا توجد منتجات متاحة
                                                        </div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                min="0.001"
                                                step="0.001"
                                                max={availableQty > 0 ? availableQty : undefined}
                                                value={itemQuantity}
                                                onChange={(e) => setItemQuantity(e.target.value)}
                                                placeholder="الكمية"
                                                className="w-24"
                                            />
                                        </div>
                                    </div>
                                    {selectedProductId && (
                                        <p className="text-sm text-muted-foreground">
                                            الكمية المتاحة: <span className="font-medium">{availableQty}</span>
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddItem}
                                        disabled={!selectedProductId}
                                        className="w-full"
                                    >
                                        <Plus size={16} className="ml-1" />
                                        إضافة للقائمة
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Items List */}
                        {transferItems.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center justify-between">
                                        <span>الأصناف ({transferItems.length})</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الصنف</TableHead>
                                                <TableHead className="w-24">الكمية</TableHead>
                                                <TableHead className="w-16"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transferItems.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <div>
                                                            <span className="font-medium">{item.product_name}</span>
                                                            <span className="text-xs text-muted-foreground mr-2">
                                                                ({item.product_code})
                                                            </span>
                                                            <p className="text-xs text-muted-foreground">
                                                                متاح: {item.available}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            max={item.available}
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQuantity(index, parseFloat(e.target.value) || 0)}
                                                            className="w-20 h-8"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive"
                                                            onClick={() => handleRemoveItem(index)}
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="سبب التحويل..."
                                rows={2}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseDialog}
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={transferMutation.isPending || transferItems.length === 0}
                                className="gap-2"
                            >
                                {transferMutation.isPending ? 'جاري التحويل...' : (
                                    <>
                                        <Check size={16} />
                                        تأكيد التحويل ({transferItems.length} صنف)
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default WarehouseTransfersPage;
