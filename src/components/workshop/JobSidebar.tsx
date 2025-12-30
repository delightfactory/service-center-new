import React from 'react';
import { Link } from 'react-router-dom';
import { Car, User, Phone, Mail, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JobTimeTracker } from './JobTimeTracker';

// ============================================================
// Job Sidebar Component
// ============================================================

interface Vehicle {
    id: string;
    plate_number: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
}

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
}

interface JobSidebarProps {
    jobOrderId: string;
    vehicle: Vehicle | null;
    customer: Customer | null;
}

export function JobSidebar({ jobOrderId, vehicle, customer }: JobSidebarProps) {
    return (
        <div className="space-y-4">
            {/* Time Tracker */}
            <JobTimeTracker jobOrderId={jobOrderId} />

            {/* المركبة */}
            {vehicle && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Car size={18} />
                            المركبة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">الماركة</span>
                            <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">اللوحة</span>
                            <Badge variant="secondary">{vehicle.plate_number}</Badge>
                        </div>
                        {vehicle.year && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">السنة</span>
                                <span>{vehicle.year}</span>
                            </div>
                        )}
                        {vehicle.color && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">اللون</span>
                                <span>{vehicle.color}</span>
                            </div>
                        )}
                        <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                            <Link to={`/dashboard/vehicles/${vehicle.id}`}>
                                <Eye size={14} className="ml-1" />
                                عرض المركبة
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* العميل */}
            {customer && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <User size={18} />
                            العميل
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">الاسم</span>
                            <span className="font-medium">{customer.name}</span>
                        </div>
                        {customer.phone && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">الهاتف</span>
                                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                                    <Phone size={12} />
                                    {customer.phone}
                                </a>
                            </div>
                        )}
                        {customer.email && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">البريد</span>
                                <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-primary hover:underline">
                                    <Mail size={12} />
                                    {customer.email}
                                </a>
                            </div>
                        )}
                        <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                            <Link to={`/dashboard/customers/${customer.id}`}>
                                <Eye size={14} className="ml-1" />
                                عرض العميل
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
