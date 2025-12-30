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
    Plus, Zap, Search, User, Car, Trash2, Printer, Check, X
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
import { cn, formatCurrency } from '@/lib/utils';

// ============================================================
// Quick Check Page - صفحة الكشف السريع
// ============================================================

interface Customer {
    id: string;
    name: string;
    phone: string;
    code: string;
}

interface Vehicle {
    id: string;
    plate_number: string;
    make: string | null;
    model: string | null;
    year: number | null;
}

interface Service {
    id: string;
    name: string;
    code: string;
    price: number;
}

interface InvoiceItem {
    service_id: string;
    service_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export function QuickCheckPage() {
    const queryClient = useQueryClient();

    // Customer state
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);

    // Vehicle state
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [plateNumber, setPlateNumber] = useState('');
    const [showNewVehicleDialog, setShowNewVehicleDialog] = useState(false);

    // Invoice items
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [itemQuantity, setItemQuantity] = useState('1');
    const [itemPrice, setItemPrice] = useState('');

    // Notes
    const [notes, setNotes] = useState('');

    // New customer form
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    // New vehicle form
    const [newVehiclePlate, setNewVehiclePlate] = useState('');
    const [newVehicleMake, setNewVehicleMake] = useState('');
    const [newVehicleModel, setNewVehicleModel] = useState('');

    // Search customers
    const { data: customers, isLoading: loadingCustomers } = useQuery({
        queryKey: ['customers-search', customerSearch],
        queryFn: async () => {
            if (!customerSearch || customerSearch.length < 2) return [];
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, code')
                .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
                .limit(10);
            if (error) throw error;
            return data as Customer[];
        },
        enabled: customerSearch.length >= 2,
    });

    // Fetch customer vehicles when customer selected
    const { data: customerVehicles } = useQuery({
        queryKey: ['customer-vehicles', selectedCustomer?.id],
        queryFn: async () => {
            if (!selectedCustomer) return [];
            const { data, error } = await supabase
                .from('vehicles')
                .select('id, plate_number, make, model, year')
                .eq('customer_id', selectedCustomer.id);
            if (error) throw error;
            return data as Vehicle[];
        },
        enabled: !!selectedCustomer,
    });

    // Fetch services (for quick check)
    const { data: services } = useQuery({
        queryKey: ['quick-check-services'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, code, selling_price')
                .eq('product_type', 'service')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data?.map(s => ({ ...s, price: s.selling_price || 0 })) as Service[];
        },
    });

    // Calculate totals
    const totals = React.useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        return { subtotal, total: subtotal };
    }, [items]);

    // Add service to invoice
    const handleAddService = () => {
        const service = services?.find(s => s.id === selectedServiceId);
        if (!service) return;

        const qty = parseFloat(itemQuantity) || 1;
        const price = parseFloat(itemPrice) || service.price;

        // Check if already exists
        const existingIndex = items.findIndex(i => i.service_id === selectedServiceId);
        if (existingIndex >= 0) {
            const updated = [...items];
            updated[existingIndex].quantity += qty;
            updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
            setItems(updated);
        } else {
            setItems([...items, {
                service_id: service.id,
                service_name: service.name,
                quantity: qty,
                unit_price: price,
                total: qty * price,
            }]);
        }

        setSelectedServiceId('');
        setItemQuantity('1');
        setItemPrice('');
    };

    // Remove item
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // Select customer
    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch('');
        setSelectedVehicle(null);
        setPlateNumber('');
    };

    // Select vehicle
    const handleSelectVehicle = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setPlateNumber(vehicle.plate_number);
    };

    // Create new customer mutation
    const createCustomerMutation = useMutation({
        mutationFn: async () => {
            if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
                throw new Error('يرجى إدخال اسم ورقم هاتف العميل');
            }

            const { data, error } = await supabase
                .from('customers')
                .insert({
                    name: newCustomerName.trim(),
                    phone: newCustomerPhone.trim(),
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            setSelectedCustomer(data);
            setShowNewCustomerDialog(false);
            setNewCustomerName('');
            setNewCustomerPhone('');
            queryClient.invalidateQueries({ queryKey: ['customers-search'] });
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل إنشاء العميل');
        },
    });

    // Create new vehicle mutation
    const createVehicleMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCustomer) throw new Error('يرجى اختيار العميل أولاً');
            if (!newVehiclePlate.trim()) throw new Error('يرجى إدخال رقم اللوحة');

            const { data, error } = await supabase
                .from('vehicles')
                .insert({
                    customer_id: selectedCustomer.id,
                    plate_number: newVehiclePlate.trim(),
                    make: newVehicleMake.trim() || null,
                    model: newVehicleModel.trim() || null,
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            setSelectedVehicle(data);
            setPlateNumber(data.plate_number);
            setShowNewVehicleDialog(false);
            setNewVehiclePlate('');
            setNewVehicleMake('');
            setNewVehicleModel('');
            queryClient.invalidateQueries({ queryKey: ['customer-vehicles'] });
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل إضافة السيارة');
        },
    });

    // Create invoice mutation
    const createInvoiceMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCustomer) throw new Error('يرجى اختيار العميل');
            if (!plateNumber.trim()) throw new Error('يرجى إدخال رقم اللوحة');
            if (items.length === 0) throw new Error('يرجى إضافة خدمات');

            // Get current user and branch
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('يرجى تسجيل الدخول');

            const { data: profile } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('id', user.id)
                .single();

            if (!profile?.branch_id) {
                throw new Error('لا يوجد فرع محدد للمستخدم. يرجى التواصل مع المسؤول.');
            }

            // Build detailed notes with services list
            const servicesDetails = items.map(item =>
                `• ${item.service_name} × ${item.quantity} = ${item.total.toFixed(2)}`
            ).join('\n');

            const fullNotes = `كشف سريع - لوحة: ${plateNumber}\n\n--- الخدمات ---\n${servicesDetails}${notes ? '\n\n--- ملاحظات ---\n' + notes : ''}`;

            // Create invoice
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    invoice_type: 'sales',
                    status: 'approved', // مباشرة معتمدة
                    customer_id: selectedCustomer.id,
                    subtotal: totals.subtotal,
                    discount_amount: 0,
                    tax_amount: 0,
                    total_amount: totals.total,
                    paid_amount: 0,
                    notes: fullNotes,
                    branch_id: profile.branch_id,
                    created_by: user.id,
                })
                .select()
                .single();
            if (invoiceError) throw invoiceError;

            return invoice;
        },
        onSuccess: (invoice) => {
            alert(`تم إنشاء الفاتورة بنجاح: ${invoice.code}`);
            // Reset form
            setSelectedCustomer(null);
            setSelectedVehicle(null);
            setPlateNumber('');
            setItems([]);
            setNotes('');
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (error: Error) => {
            console.error('Invoice creation error:', error);
            alert(error.message || 'فشل إنشاء الفاتورة');
        },
    });

    const handleCreateInvoice = () => {
        createInvoiceMutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Zap className="text-amber-500" />
                        كشف سريع
                    </h1>
                    <p className="text-muted-foreground">
                        فحص سريع بدون دخول السيارة للورشة
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Right Side - Customer & Vehicle */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Selection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User size={18} />
                                بيانات العميل
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!selectedCustomer ? (
                                <>
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                        <Input
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            placeholder="ابحث بالاسم أو رقم الهاتف..."
                                            className="pr-10"
                                        />
                                    </div>

                                    {loadingCustomers && <Skeleton className="h-10 w-full" />}

                                    {customers && customers.length > 0 && (
                                        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                                            {customers.map(customer => (
                                                <button
                                                    key={customer.id}
                                                    onClick={() => handleSelectCustomer(customer)}
                                                    className="w-full p-3 text-right hover:bg-muted/50 transition-colors"
                                                >
                                                    <div className="font-medium">{customer.name}</div>
                                                    <div className="text-sm text-muted-foreground">{customer.phone}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={() => setShowNewCustomerDialog(true)}
                                    >
                                        <Plus size={16} />
                                        عميل جديد
                                    </Button>
                                </>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                    <div>
                                        <div className="font-medium text-lg">{selectedCustomer.name}</div>
                                        <div className="text-muted-foreground">{selectedCustomer.phone}</div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setSelectedVehicle(null);
                                            setPlateNumber('');
                                        }}
                                    >
                                        <X size={18} />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Vehicle Selection */}
                    {selectedCustomer && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Car size={18} />
                                    بيانات السيارة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Existing vehicles */}
                                {customerVehicles && customerVehicles.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {customerVehicles.map(vehicle => (
                                            <button
                                                key={vehicle.id}
                                                onClick={() => handleSelectVehicle(vehicle)}
                                                className={cn(
                                                    "p-3 border rounded-lg text-center transition-all",
                                                    selectedVehicle?.id === vehicle.id
                                                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                                                        : "hover:border-primary/50"
                                                )}
                                            >
                                                <div className="font-mono font-bold text-lg">
                                                    {vehicle.plate_number}
                                                </div>
                                                {vehicle.make && (
                                                    <div className="text-sm text-muted-foreground">
                                                        {vehicle.make} {vehicle.model}
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Input
                                            value={plateNumber}
                                            onChange={(e) => {
                                                setPlateNumber(e.target.value);
                                                setSelectedVehicle(null);
                                            }}
                                            placeholder="أو أدخل رقم اللوحة مباشرة..."
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowNewVehicleDialog(true)}
                                    >
                                        <Plus size={16} className="ml-1" />
                                        سيارة جديدة
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Services */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">خدمات الكشف</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add service row */}
                            <div className="flex flex-wrap gap-2">
                                <div className="flex-1 min-w-[200px]">
                                    <Select value={selectedServiceId} onValueChange={(v) => {
                                        setSelectedServiceId(v);
                                        const service = services?.find(s => s.id === v);
                                        if (service) setItemPrice(service.price.toString());
                                    }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الخدمة" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {services?.map(service => (
                                                <SelectItem key={service.id} value={service.id}>
                                                    {service.name} - {formatCurrency(service.price)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input
                                    type="number"
                                    min="1"
                                    value={itemQuantity}
                                    onChange={(e) => setItemQuantity(e.target.value)}
                                    placeholder="الكمية"
                                    className="w-20"
                                />
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={itemPrice}
                                    onChange={(e) => setItemPrice(e.target.value)}
                                    placeholder="السعر"
                                    className="w-24"
                                    dir="ltr"
                                />
                                <Button onClick={handleAddService} disabled={!selectedServiceId}>
                                    <Plus size={16} className="ml-1" />
                                    إضافة
                                </Button>
                            </div>

                            {/* Items list */}
                            {items.length > 0 && (
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الخدمة</TableHead>
                                                <TableHead className="w-20">الكمية</TableHead>
                                                <TableHead className="w-28">السعر</TableHead>
                                                <TableHead className="w-28">الإجمالي</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{item.service_name}</TableCell>
                                                    <TableCell>{item.quantity}</TableCell>
                                                    <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                                                    <TableCell className="font-medium">{formatCurrency(item.total)}</TableCell>
                                                    <TableCell>
                                                        <Button
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
                                </div>
                            )}

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label>ملاحظات</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="ملاحظات إضافية..."
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Left Side - Summary */}
                <div className="space-y-6">
                    <Card className="sticky top-6">
                        <CardHeader>
                            <CardTitle>ملخص الفاتورة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Summary info */}
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">العميل:</span>
                                    <span className="font-medium">{selectedCustomer?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">رقم اللوحة:</span>
                                    <span className="font-mono font-medium">{plateNumber || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">عدد الخدمات:</span>
                                    <span>{items.length}</span>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>الإجمالي:</span>
                                    <span className="text-primary">{formatCurrency(totals.total)}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Button
                                    className="w-full gap-2"
                                    size="lg"
                                    onClick={handleCreateInvoice}
                                    disabled={!selectedCustomer || !plateNumber || items.length === 0 || createInvoiceMutation.isPending}
                                >
                                    <Check size={18} />
                                    {createInvoiceMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء فاتورة'}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    disabled={!selectedCustomer || !plateNumber || items.length === 0}
                                >
                                    <Printer size={18} />
                                    إنشاء وطباعة
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* New Customer Dialog */}
            <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>عميل جديد</DialogTitle>
                        <DialogDescription>أدخل بيانات العميل الجديد</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>الاسم *</Label>
                            <Input
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="اسم العميل"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الهاتف *</Label>
                            <Input
                                value={newCustomerPhone}
                                onChange={(e) => setNewCustomerPhone(e.target.value)}
                                placeholder="رقم الهاتف"
                                dir="ltr"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewCustomerDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => createCustomerMutation.mutate()}
                            disabled={createCustomerMutation.isPending}
                        >
                            {createCustomerMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Vehicle Dialog */}
            <Dialog open={showNewVehicleDialog} onOpenChange={setShowNewVehicleDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>سيارة جديدة</DialogTitle>
                        <DialogDescription>أدخل بيانات السيارة الجديدة</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>رقم اللوحة *</Label>
                            <Input
                                value={newVehiclePlate}
                                onChange={(e) => setNewVehiclePlate(e.target.value)}
                                placeholder="مثال: أ ب ج 1234"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الشركة المصنعة</Label>
                                <Input
                                    value={newVehicleMake}
                                    onChange={(e) => setNewVehicleMake(e.target.value)}
                                    placeholder="مثال: Toyota"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الموديل</Label>
                                <Input
                                    value={newVehicleModel}
                                    onChange={(e) => setNewVehicleModel(e.target.value)}
                                    placeholder="مثال: Camry"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewVehicleDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => createVehicleMutation.mutate()}
                            disabled={createVehicleMutation.isPending}
                        >
                            {createVehicleMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default QuickCheckPage;
