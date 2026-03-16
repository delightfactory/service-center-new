import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Crown,
    Star,
    TrendingUp,
    ArrowLeft,
    Car,
    Receipt,
    Wallet,
    Building2,
} from 'lucide-react';
import { cn, formatCurrency, getInitials } from '@/lib/utils';

// ============================================================
// Top Customers Card - قائمة العملاء المفضلين
// ============================================================

interface TopCustomer {
    id: string;
    name: string;
    code: string;
    phone: string | null;
    customer_type: string;
    balance: number;
    total_invoices: number;
    invoice_count: number;
    vehicle_count: number;
}

// Rank medal component
function RankMedal({ rank }: { rank: number }) {
    if (rank === 1) return <Crown size={18} className="text-yellow-500" />;
    if (rank === 2) return <Star size={18} className="text-gray-400" />;
    if (rank === 3) return <Star size={18} className="text-amber-600" />;
    return (
        <span className="w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-muted-foreground">
            {rank}
        </span>
    );
}

interface TopCustomersCardProps {
    limit?: number;
    className?: string;
}

export function TopCustomersCard({ limit = 5, className }: TopCustomersCardProps) {
    const { data: topCustomers, isLoading } = useQuery({
        queryKey: ['top-customers', limit],
        queryFn: async () => {
            // Get customers with their invoice totals
            const { data: customers, error: custErr } = await supabase
                .from('customers')
                .select('id, name, code, phone, customer_type, balance')
                .eq('is_active', true);

            if (custErr) throw custErr;
            if (!customers || customers.length === 0) return [];

            // Get invoice totals per customer
            const { data: invoiceStats, error: invErr } = await supabase
                .from('invoices')
                .select('customer_id, total_amount')
                .in('status', ['approved', 'partial', 'paid']);

            if (invErr) throw invErr;

            // Get vehicle counts per customer
            const { data: vehicleStats, error: vehErr } = await supabase
                .from('vehicles')
                .select('customer_id')
                .eq('is_active', true);

            if (vehErr) throw vehErr;

            // Aggregate invoice totals per customer
            const invoiceTotals = new Map<string, { total: number; count: number }>();
            for (const inv of invoiceStats || []) {
                const existing = invoiceTotals.get(inv.customer_id) || { total: 0, count: 0 };
                existing.total += inv.total_amount || 0;
                existing.count += 1;
                invoiceTotals.set(inv.customer_id, existing);
            }

            // Aggregate vehicle counts per customer
            const vehicleCounts = new Map<string, number>();
            for (const v of vehicleStats || []) {
                vehicleCounts.set(v.customer_id, (vehicleCounts.get(v.customer_id) || 0) + 1);
            }

            // Build ranked list
            const ranked: TopCustomer[] = customers
                .map(c => {
                    const invStats = invoiceTotals.get(c.id) || { total: 0, count: 0 };
                    return {
                        id: c.id,
                        name: c.name,
                        code: c.code,
                        phone: c.phone,
                        customer_type: c.customer_type,
                        balance: c.balance || 0,
                        total_invoices: invStats.total,
                        invoice_count: invStats.count,
                        vehicle_count: vehicleCounts.get(c.id) || 0,
                    };
                })
                .filter(c => c.total_invoices > 0 || c.vehicle_count > 0) // Only customers with activity
                .sort((a, b) => b.total_invoices - a.total_invoices) // Sort by total invoice value
                .slice(0, limit);

            return ranked;
        },
        staleTime: 60000, // Cache for 1 minute
    });

    const maxInvoiceTotal = topCustomers?.[0]?.total_invoices || 1;

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Crown size={18} className="text-yellow-500" />
                        أهم العملاء
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/dashboard/customers">
                            عرض الكل
                            <ArrowLeft size={14} className="mr-1" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-1">
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: limit }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-1">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !topCustomers?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Star size={40} className="mx-auto mb-2 opacity-50" />
                        <p>لا توجد بيانات كافية</p>
                    </div>
                ) : (
                    topCustomers.map((customer, idx) => {
                        const rank = idx + 1;
                        const barWidth = (customer.total_invoices / maxInvoiceTotal) * 100;
                        const isCompany = customer.customer_type === 'company';

                        return (
                            <Link
                                key={customer.id}
                                to={`/dashboard/customers/${customer.id}`}
                                className="block"
                            >
                                <div className={cn(
                                    'flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-muted/80 group relative overflow-hidden',
                                    rank === 1 && 'bg-yellow-50/60 dark:bg-yellow-900/10',
                                    rank === 2 && 'bg-gray-50/60 dark:bg-gray-800/10',
                                    rank === 3 && 'bg-amber-50/40 dark:bg-amber-900/10',
                                )}>
                                    {/* Progress bar background */}
                                    <div
                                        className="absolute inset-y-0 right-0 bg-primary/[0.04] transition-all"
                                        style={{ width: `${barWidth}%` }}
                                    />

                                    {/* Rank */}
                                    <div className="relative z-10 w-6 flex-shrink-0 flex items-center justify-center">
                                        <RankMedal rank={rank} />
                                    </div>

                                    {/* Avatar */}
                                    <Avatar className="relative z-10 h-10 w-10 shrink-0">
                                        <AvatarFallback
                                            className={cn(
                                                'text-sm font-bold',
                                                isCompany
                                                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                                    : rank === 1
                                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30'
                                                        : 'bg-primary/10 text-primary'
                                            )}
                                        >
                                            {isCompany ? <Building2 size={18} /> : getInitials(customer.name)}
                                        </AvatarFallback>
                                    </Avatar>

                                    {/* Info */}
                                    <div className="relative z-10 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                                                {customer.name}
                                            </h4>
                                            {rank <= 3 && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    VIP
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Receipt size={11} />
                                                {customer.invoice_count} فاتورة
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Car size={11} />
                                                {customer.vehicle_count} مركبة
                                            </span>
                                            {customer.balance > 0 && (
                                                <span className="flex items-center gap-1 text-destructive">
                                                    <Wallet size={11} />
                                                    {formatCurrency(customer.balance)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Total value */}
                                    <div className="relative z-10 text-left shrink-0">
                                        <p className="text-sm font-bold text-primary">
                                            {formatCurrency(customer.total_invoices)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">إجمالي الفواتير</p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}

export default TopCustomersCard;
