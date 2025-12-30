import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, User, Phone, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// CustomerPicker - مكون اختيار العميل مع البحث
// ============================================================

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    code: string;
}

interface CustomerPickerProps {
    selectedCustomer: Customer | null;
    onSelect: (customer: Customer | null) => void;
    onAddNew?: () => void;
    className?: string;
}

export function CustomerPicker({
    selectedCustomer,
    onSelect,
    onAddNew,
    className,
}: CustomerPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // البحث عن العملاء
    const { data: customers, isLoading } = useQuery({
        queryKey: ['customers-search', searchQuery],
        queryFn: async () => {
            if (!searchQuery || searchQuery.length < 2) return [];
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, code')
                .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`)
                .limit(10);
            if (error) throw error;
            return data as Customer[];
        },
        enabled: searchQuery.length >= 2,
    });

    // إعادة تعيين البحث عند الاختيار
    useEffect(() => {
        if (selectedCustomer) {
            setSearchQuery('');
            setIsOpen(false);
        }
    }, [selectedCustomer]);

    // التعامل مع الاختيار
    const handleSelect = (customer: Customer) => {
        onSelect(customer);
    };

    // إلغاء الاختيار
    const handleClear = () => {
        onSelect(null);
        setSearchQuery('');
        setIsOpen(true);
    };

    return (
        <Card className={className}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <User size={18} />
                    العميل
                </CardTitle>
            </CardHeader>
            <CardContent>
                {selectedCustomer ? (
                    // عرض العميل المختار
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="font-medium">{selectedCustomer.name}</p>
                                <p className="text-sm text-muted-foreground" dir="ltr">
                                    {selectedCustomer.phone || '-'}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClear}>
                            <X size={16} />
                        </Button>
                    </div>
                ) : (
                    // حقل البحث
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                placeholder="ابحث بالاسم أو الهاتف..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsOpen(true);
                                }}
                                onFocus={() => setIsOpen(true)}
                                className="pr-10"
                            />
                        </div>

                        {/* قائمة النتائج */}
                        {isOpen && searchQuery.length >= 2 && (
                            <div className="border rounded-lg shadow-sm bg-popover">
                                {isLoading ? (
                                    <div className="p-3 space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : customers && customers.length > 0 ? (
                                    <div className="max-h-48 overflow-auto">
                                        {customers.map((customer) => (
                                            <button
                                                key={customer.id}
                                                onClick={() => handleSelect(customer)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-right"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                    <User size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{customer.name}</p>
                                                    <p className="text-xs text-muted-foreground" dir="ltr">
                                                        {customer.phone || '-'}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="text-xs">
                                                    {customer.code}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        لا توجد نتائج
                                    </div>
                                )}

                                {/* زر إضافة عميل جديد */}
                                {onAddNew && (
                                    <div className="border-t p-2">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start gap-2"
                                            onClick={() => {
                                                setIsOpen(false);
                                                onAddNew();
                                            }}
                                        >
                                            <Plus size={16} />
                                            إضافة عميل جديد
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* رسالة البدء */}
                        {!isOpen || searchQuery.length < 2 ? (
                            <p className="text-xs text-muted-foreground text-center">
                                ابدأ بالكتابة للبحث عن عميل
                            </p>
                        ) : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default CustomerPicker;
