import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, User, Car, ChevronLeft, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { customerService } from '@/lib/services/crm/customer.service';
import { vehicleService } from '@/lib/services/crm/vehicle.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EgyptianPlateInput } from './EgyptianPlateInput';
import type { Customer, Vehicle } from '@/types/database';

// ============================================================
// Customer Vehicle Step Component
// ============================================================
// Combined customer and vehicle selection/creation step
// - Search existing customers
// - Add new customer inline
// - Select from customer's vehicles or add new
// ============================================================

interface CustomerVehicleStepProps {
    customerId: string | null;
    vehicleId: string | null;
    onCustomerChange: (customer: Customer | null) => void;
    onVehicleChange: (vehicle: Vehicle | null) => void;
    onAddNewCustomer: (name: string, phone: string) => Promise<Customer>;
    onAddNewVehicle: (customerId: string, plateNumber: string) => Promise<Vehicle>;
    isLoading?: boolean;
    className?: string;
}

type ViewMode = 'search' | 'new-customer' | 'select-vehicle' | 'new-vehicle';

export function CustomerVehicleStep({
    customerId,
    vehicleId,
    onCustomerChange,
    onVehicleChange,
    onAddNewCustomer,
    onAddNewVehicle,
    isLoading = false,
    className,
}: CustomerVehicleStepProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

    // New customer form
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    // New vehicle form
    const [newVehiclePlate, setNewVehiclePlate] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search customers
    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['customers', 'search', searchQuery],
        queryFn: () => customerService.searchCustomers(searchQuery),
        enabled: searchQuery.length >= 2,
        staleTime: 30000,
    });

    // Get customer vehicles
    const { data: customerVehicles, isLoading: isLoadingVehicles } = useQuery({
        queryKey: ['vehicles', 'customer', selectedCustomer?.id],
        queryFn: () => vehicleService.getByCustomer(selectedCustomer!.id),
        enabled: !!selectedCustomer?.id,
        staleTime: 30000,
    });

    // Handle customer selection
    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setSelectedVehicle(null);
        onCustomerChange(customer);
        onVehicleChange(null);
        setViewMode('select-vehicle');
    };

    // Handle vehicle selection
    const handleSelectVehicle = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        onVehicleChange(vehicle);
    };

    // Handle new customer creation
    const handleCreateCustomer = async () => {
        if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
            setError('يرجى إدخال الاسم ورقم الهاتف');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const customer = await onAddNewCustomer(newCustomerName.trim(), newCustomerPhone.trim());
            setSelectedCustomer(customer);
            onCustomerChange(customer);
            setViewMode('new-vehicle');
            setNewCustomerName('');
            setNewCustomerPhone('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle new vehicle creation
    const handleCreateVehicle = async () => {
        if (!selectedCustomer?.id) {
            setError('يرجى اختيار العميل أولاً');
            return;
        }

        const cleanPlate = newVehiclePlate.replace(/\s+/g, ' ').trim();
        if (!cleanPlate) {
            setError('يرجى إدخال رقم اللوحة');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const vehicle = await onAddNewVehicle(selectedCustomer.id, cleanPlate);
            setSelectedVehicle(vehicle);
            onVehicleChange(vehicle);
            setNewVehiclePlate('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ');
        } finally {
            setIsSaving(false);
        }
    };

    // Reset to search view
    const handleReset = () => {
        setSelectedCustomer(null);
        setSelectedVehicle(null);
        onCustomerChange(null);
        onVehicleChange(null);
        setViewMode('search');
        setSearchQuery('');
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header with selected info */}
            {selectedCustomer && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <User size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{selectedCustomer.name}</p>
                                <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleReset}>
                            <X size={18} />
                        </Button>
                    </div>

                    {selectedVehicle && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/20">
                            <Car size={18} className="text-primary" />
                            <span className="font-medium">{selectedVehicle.plate_number}</span>
                            {selectedVehicle.make && selectedVehicle.model && (
                                <span className="text-sm text-muted-foreground">
                                    ({selectedVehicle.make} {selectedVehicle.model})
                                </span>
                            )}
                            <Check size={16} className="text-green-500 mr-auto" />
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4 text-center">
                    {error}
                </div>
            )}

            {/* Content based on view mode */}
            <div className="flex-1 overflow-y-auto">
                {/* Search Mode */}
                {viewMode === 'search' && (
                    <div className="space-y-4">
                        {/* Search Input */}
                        <div className="relative">
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="ابحث بالاسم أو رقم الهاتف..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10 h-12 text-base"
                                autoFocus
                            />
                        </div>

                        {/* Search Results */}
                        {isSearching ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                                جاري البحث...
                            </div>
                        ) : searchResults && searchResults.length > 0 ? (
                            <div className="space-y-2">
                                {searchResults.map((customer) => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelectCustomer(customer)}
                                        className="w-full p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all flex items-center gap-3 text-right"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                            <User size={24} className="text-muted-foreground" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{customer.name}</p>
                                            <p className="text-sm text-muted-foreground">{customer.phone}</p>
                                        </div>
                                        <ChevronLeft size={20} className="text-muted-foreground" />
                                    </button>
                                ))}
                            </div>
                        ) : searchQuery.length >= 2 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                لم يتم العثور على عملاء
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                ابدأ بكتابة اسم العميل أو رقم الهاتف
                            </div>
                        )}

                        {/* Add New Customer Button */}
                        <Button
                            variant="outline"
                            className="w-full h-14 text-base gap-2 border-dashed"
                            onClick={() => setViewMode('new-customer')}
                        >
                            <Plus size={20} />
                            إضافة عميل جديد
                        </Button>
                    </div>
                )}

                {/* New Customer Mode */}
                {viewMode === 'new-customer' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Button variant="ghost" size="icon" onClick={() => setViewMode('search')}>
                                <ChevronLeft size={20} className="rotate-180" />
                            </Button>
                            <h3 className="text-lg font-semibold">إضافة عميل جديد</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="customer-name">اسم العميل *</Label>
                                <Input
                                    id="customer-name"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    placeholder="أدخل اسم العميل"
                                    className="h-12 mt-1"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <Label htmlFor="customer-phone">رقم الهاتف *</Label>
                                <Input
                                    id="customer-phone"
                                    type="tel"
                                    inputMode="numeric"
                                    value={newCustomerPhone}
                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                    placeholder="01xxxxxxxxx"
                                    className="h-12 mt-1"
                                    dir="ltr"
                                />
                            </div>

                            <Button
                                className="w-full h-12 text-base"
                                onClick={handleCreateCustomer}
                                disabled={isSaving || !newCustomerName.trim() || !newCustomerPhone.trim()}
                            >
                                {isSaving ? 'جاري الحفظ...' : 'حفظ ومتابعة'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Select Vehicle Mode */}
                {viewMode === 'select-vehicle' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">اختر المركبة</h3>

                        {isLoadingVehicles ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                                جاري تحميل المركبات...
                            </div>
                        ) : customerVehicles && customerVehicles.length > 0 ? (
                            <div className="grid gap-2">
                                {customerVehicles.map((vehicle) => (
                                    <button
                                        key={vehicle.id}
                                        onClick={() => handleSelectVehicle(vehicle)}
                                        className={cn(
                                            "w-full p-4 rounded-xl border transition-all flex items-center gap-3 text-right",
                                            selectedVehicle?.id === vehicle.id
                                                ? "border-primary bg-primary/10"
                                                : "border-border bg-card hover:bg-accent hover:border-primary/50"
                                        )}
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                                            <Car size={24} className="text-muted-foreground" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-lg">{vehicle.plate_number}</p>
                                            {vehicle.make && vehicle.model && (
                                                <p className="text-sm text-muted-foreground">
                                                    {vehicle.make} {vehicle.model} {vehicle.year || ''}
                                                </p>
                                            )}
                                        </div>
                                        {selectedVehicle?.id === vehicle.id && (
                                            <Check size={24} className="text-primary" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                لا توجد مركبات مسجلة لهذا العميل
                            </div>
                        )}

                        {/* Add New Vehicle Button */}
                        <Button
                            variant="outline"
                            className="w-full h-14 text-base gap-2 border-dashed"
                            onClick={() => setViewMode('new-vehicle')}
                        >
                            <Plus size={20} />
                            إضافة مركبة جديدة
                        </Button>
                    </div>
                )}

                {/* New Vehicle Mode */}
                {viewMode === 'new-vehicle' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewMode(customerVehicles?.length ? 'select-vehicle' : 'search')}
                            >
                                <ChevronLeft size={20} className="rotate-180" />
                            </Button>
                            <h3 className="text-lg font-semibold">إضافة مركبة جديدة</h3>
                        </div>

                        <EgyptianPlateInput
                            value={newVehiclePlate}
                            onChange={setNewVehiclePlate}
                            autoFocus
                        />

                        <Button
                            className="w-full h-12 text-base"
                            onClick={handleCreateVehicle}
                            disabled={isSaving || !newVehiclePlate.trim()}
                        >
                            {isSaving ? 'جاري الحفظ...' : 'حفظ المركبة'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CustomerVehicleStep;
