import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// VehiclePicker - مكون اختيار المركبة
// ============================================================

interface Vehicle {
    id: string;
    plate_number: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color?: string | null;
}

interface VehiclePickerProps {
    vehicles: Vehicle[];
    selectedVehicle: Vehicle | null;
    onSelect: (vehicle: Vehicle | null) => void;
    onAddNew?: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
}

export function VehiclePicker({
    vehicles,
    selectedVehicle,
    onSelect,
    onAddNew,
    isLoading = false,
    disabled = false,
    className,
}: VehiclePickerProps) {

    const handleClear = () => {
        onSelect(null);
    };

    const getVehicleName = (v: Vehicle) => {
        const parts = [v.make, v.model, v.year].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : 'مركبة';
    };

    return (
        <Card className={cn(disabled && 'opacity-50', className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Car size={18} />
                    المركبة
                </CardTitle>
            </CardHeader>
            <CardContent>
                {selectedVehicle ? (
                    // عرض المركبة المختارة
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Car size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="font-medium font-mono" dir="ltr">
                                    {selectedVehicle.plate_number}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {getVehicleName(selectedVehicle)}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClear} disabled={disabled}>
                            <X size={16} />
                        </Button>
                    </div>
                ) : disabled ? (
                    // رسالة عند عدم اختيار عميل
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        اختر عميل أولاً
                    </div>
                ) : vehicles && vehicles.length > 0 ? (
                    // قائمة المركبات
                    <div className="space-y-2">
                        {vehicles.map((vehicle) => (
                            <button
                                key={vehicle.id}
                                onClick={() => onSelect(vehicle)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-right"
                            >
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <Car size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium font-mono" dir="ltr">
                                        {vehicle.plate_number}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {getVehicleName(vehicle)}
                                    </p>
                                </div>
                            </button>
                        ))}

                        {/* زر إضافة مركبة جديدة */}
                        {onAddNew && (
                            <Button
                                variant="outline"
                                className="w-full gap-2"
                                onClick={onAddNew}
                            >
                                <Plus size={16} />
                                إضافة مركبة جديدة
                            </Button>
                        )}
                    </div>
                ) : (
                    // لا توجد مركبات
                    <div className="text-center py-6">
                        <Car size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                            لا توجد مركبات لهذا العميل
                        </p>
                        {onAddNew && (
                            <Button variant="outline" onClick={onAddNew} className="gap-2">
                                <Plus size={16} />
                                إضافة مركبة
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default VehiclePicker;
