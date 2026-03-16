import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { vehicleService, type VehicleWithCustomer } from '@/lib/services/crm/vehicle.service';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Search,
    Plus,
    Car,
    User,
    MoreVertical,
    Calendar,
    Palette,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, EmptyState } from '@/components/shared';

export function VehiclesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch vehicles
    const { data: result, isLoading, error } = useQuery({
        queryKey: ['vehicles', debouncedSearch],
        queryFn: async () => {
            if (debouncedSearch) {
                const vehicles = await vehicleService.searchVehicles(debouncedSearch);
                return { data: vehicles };
            }
            return vehicleService.getVehiclesWithCustomer({ page: 1, pageSize: 50 });
        },
    });

    const vehicles = result?.data || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="المركبات"
                description="جميع المركبات المسجلة في النظام"
                actions={
                    <Button asChild size="lg" className="gap-2">
                        <Link to="/dashboard/vehicles/new">
                            <Plus size={20} />
                            <span>مركبة جديدة</span>
                        </Link>
                    </Button>
                }
            />

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <Input
                        placeholder="بحث برقم اللوحة، الماركة، الموديل، الشاسيه، اللون، أو اسم العميل..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search size={18} />}
                        iconPosition="start"
                        className="h-11"
                    />
                </CardContent>
            </Card>

            {/* Results count */}
            {!isLoading && (
                <p className="text-sm text-muted-foreground">
                    عرض {vehicles.length} مركبة
                </p>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Error state */}
            {error && (
                <Card className="border-destructive">
                    <CardContent className="p-6 text-center text-destructive">
                        <p>حدث خطأ أثناء تحميل البيانات</p>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!isLoading && !error && vehicles.length === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                            <Car size={32} className="text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">لا توجد مركبات</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchQuery ? 'لا توجد نتائج للبحث' : 'ابدأ بإضافة أول مركبة'}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Vehicles grid */}
            {!isLoading && !error && vehicles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vehicles.map((vehicle: VehicleWithCustomer) => (
                        <VehicleCard key={vehicle.id} vehicle={vehicle} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Vehicle Card Component
function VehicleCard({ vehicle }: { vehicle: VehicleWithCustomer }) {
    return (
        <Card className="card-interactive group">
            <CardContent className="p-4">
                <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Car size={20} className="text-primary" />
                            </div>
                            <div>
                                <Link
                                    to={`/dashboard/vehicles/${vehicle.id}`}
                                    className="font-medium hover:text-primary transition-colors"
                                >
                                    {vehicle.make || 'غير محدد'} {vehicle.model || ''}
                                </Link>
                                <Badge variant="outline" className="mt-1">
                                    {vehicle.plate_number}
                                </Badge>
                            </div>
                        </div>

                        {/* Actions menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <MoreVertical size={16} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem asChild>
                                    <Link to={`/dashboard/vehicles/${vehicle.id}`}>
                                        عرض التفاصيل
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={`/dashboard/reception/new?vehicle=${vehicle.id}`}>
                                        استلام للصيانة
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Vehicle info */}
                    <div className="space-y-2 text-sm text-muted-foreground">
                        {vehicle.year && (
                            <div className="flex items-center gap-2">
                                <Calendar size={14} />
                                <span>موديل {vehicle.year}</span>
                            </div>
                        )}
                        {vehicle.color && (
                            <div className="flex items-center gap-2">
                                <Palette size={14} />
                                <span>{vehicle.color}</span>
                            </div>
                        )}
                        {vehicle.vin && (
                            <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                VIN: {vehicle.vin}
                            </div>
                        )}
                    </div>

                    {/* Customer link */}
                    {vehicle.customer && (
                        <div className="pt-3 border-t border-border">
                            <Link
                                to={`/dashboard/customers/${vehicle.customer_id}`}
                                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                            >
                                <User size={14} />
                                <span>{vehicle.customer.name}</span>
                            </Link>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
