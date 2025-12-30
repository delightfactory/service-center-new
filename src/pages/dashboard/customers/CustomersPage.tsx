import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerService, type CustomerWithVehicles } from '@/lib/services/crm/customer.service';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Search,
    Plus,
    Phone,
    Mail,
    Building2,
    User,
    Car,
    MoreVertical,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, EmptyState } from '@/components/shared';
import { cn, formatPhone, getInitials } from '@/lib/utils';
import type { Customer } from '@/types';
import type { CustomerType } from '@/types/enums';

export function CustomersPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [customerType, setCustomerType] = useState<'all' | CustomerType>('all');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch customers
    const { data: result, isLoading, error } = useQuery({
        queryKey: ['customers', debouncedSearch, customerType],
        queryFn: async () => {
            if (debouncedSearch) {
                const customers = await customerService.searchCustomers(debouncedSearch);
                return { data: customers };
            }
            return customerService.getCustomers(
                { page: 1, pageSize: 50 },
                customerType !== 'all' ? { customer_type: customerType } : {}
            );
        },
    });

    const customers = result?.data || [];

    // Filter by type on client side if searching
    const filteredCustomers = debouncedSearch && customerType !== 'all'
        ? customers.filter((c: Customer) => c.customer_type === customerType)
        : customers;

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="العملاء"
                description="إدارة بيانات العملاء ومركباتهم"
                actions={
                    <Button asChild size="lg" className="gap-2">
                        <Link to="/dashboard/customers/new">
                            <Plus size={20} />
                            <span>عميل جديد</span>
                        </Link>
                    </Button>
                }
            />

            {/* Search and filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search input */}
                        <div className="flex-1">
                            <Input
                                placeholder="بحث بالاسم، الهاتف، أو الكود..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                icon={<Search size={18} />}
                                iconPosition="start"
                                className="h-11"
                            />
                        </div>

                        {/* Type filter */}
                        <div className="flex gap-2">
                            <Button
                                variant={customerType === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCustomerType('all')}
                            >
                                الكل
                            </Button>
                            <Button
                                variant={customerType === 'individual' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCustomerType('individual')}
                                className="gap-1"
                            >
                                <User size={16} />
                                أفراد
                            </Button>
                            <Button
                                variant={customerType === 'company' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCustomerType('company')}
                                className="gap-1"
                            >
                                <Building2 size={16} />
                                شركات
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results count */}
            {!isLoading && (
                <p className="text-sm text-muted-foreground">
                    عرض {filteredCustomers.length} عميل
                </p>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
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
            {!isLoading && !error && filteredCustomers.length === 0 && (
                <EmptyState
                    icon={User}
                    title="لا يوجد عملاء"
                    description={searchQuery ? 'لا توجد نتائج للبحث' : 'ابدأ بإضافة أول عميل'}
                    action={
                        !searchQuery ? (
                            <Button asChild>
                                <Link to="/dashboard/customers/new">
                                    <Plus size={18} className="ml-2" />
                                    إضافة عميل
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />
            )}

            {/* Customers grid */}
            {!isLoading && !error && filteredCustomers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCustomers.map((customer: Customer) => (
                        <CustomerCard key={customer.id} customer={customer} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Customer Card Component
function CustomerCard({ customer }: { customer: Customer }) {
    const isCompany = customer.customer_type === 'company';
    const hasDebt = customer.balance !== undefined && customer.balance > 0;

    return (
        <Link to={`/dashboard/customers/${customer.id}`} className="block">
            <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer group">
                <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <Avatar className="h-12 w-12 shrink-0">
                            <AvatarFallback
                                className={cn(
                                    isCompany
                                        ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                        : 'bg-primary/10 text-primary'
                                )}
                            >
                                {isCompany ? (
                                    <Building2 size={24} />
                                ) : (
                                    getInitials(customer.name)
                                )}
                            </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-1">
                                        {customer.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge
                                            variant={isCompany ? 'secondary' : 'outline'}
                                            className="text-xs"
                                        >
                                            {isCompany ? 'شركة' : 'فرد'}
                                        </Badge>
                                        {customer.code && (
                                            <span className="text-xs text-muted-foreground font-mono">{customer.code}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Balance Badge */}
                                {hasDebt && (
                                    <Badge variant="destructive" className="shrink-0">
                                        {customer.balance.toFixed(0)} ج.م
                                    </Badge>
                                )}
                            </div>

                            {/* Contact info */}
                            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                                {customer.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} className="shrink-0" />
                                        <span dir="ltr" className="truncate">{formatPhone(customer.phone)}</span>
                                    </div>
                                )}
                                {customer.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail size={14} className="shrink-0" />
                                        <span className="truncate">{customer.email}</span>
                                    </div>
                                )}
                            </div>

                            {/* Balance indicator bar */}
                            {hasDebt && (
                                <div className="mt-3 pt-2 border-t">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">مستحق لنا</span>
                                        <span className="font-medium text-destructive">
                                            {customer.balance.toFixed(2)} ج.م
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
