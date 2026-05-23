import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';

export interface InvoiceCustomerOption {
    id: string;
    name: string;
    phone: string | null;
    code: string | null;
}

export interface InvoiceSupplierOption {
    id: string;
    name: string;
    phone: string | null;
    code: string | null;
}

export interface InvoiceProductOption {
    id: string;
    code: string | null;
    name: string;
    product_type: string;
    selling_price: number;
    purchase_price: number;
}

interface SearchBoxProps<T> {
    selectedLabel?: string;
    selectedMeta?: string | null;
    placeholder: string;
    emptyText: string;
    queryKey: (search: string) => readonly unknown[];
    queryFn: (search: string) => Promise<T[]>;
    getKey: (item: T) => string;
    renderItem: (item: T) => React.ReactNode;
    onSelect: (item: T) => void;
    onClear?: () => void;
    disabled?: boolean;
    className?: string;
}

function SearchBox<T>({
    selectedLabel,
    selectedMeta,
    placeholder,
    emptyText,
    queryKey,
    queryFn,
    getKey,
    renderItem,
    onSelect,
    onClear,
    disabled = false,
    className,
}: SearchBoxProps<T>) {
    const [search, setSearch] = React.useState('');
    const [isOpen, setIsOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLDivElement | null>(null);
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});

    const { data, isLoading } = useQuery({
        queryKey: queryKey(search.trim()),
        queryFn: () => queryFn(search.trim()),
        enabled: !disabled && search.trim().length >= 2,
        staleTime: 1000 * 60 * 2,
    });

    const handleSelect = (item: T) => {
        onSelect(item);
        setSearch('');
        setIsOpen(false);
    };

    React.useEffect(() => {
        if (!isOpen || search.trim().length < 2) return;

        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const viewportPadding = 8;
            const availableWidth = Math.max(240, window.innerWidth - viewportPadding * 2);
            const width = Math.min(Math.max(rect.width, 240), availableWidth);
            const right = Math.max(viewportPadding, window.innerWidth - rect.right);

            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                right,
                width,
                maxHeight: Math.max(180, window.innerHeight - rect.bottom - 16),
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, search]);

    const dropdown = isOpen && search.trim().length >= 2 && !disabled ? (
        <div
            className="z-[100] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg"
            style={dropdownStyle}
            dir="rtl"
        >
            {isLoading ? (
                <div className="space-y-2 p-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ) : data && data.length > 0 ? (
                <div className="p-1">
                    {data.map((item) => (
                        <button
                            key={getKey(item)}
                            type="button"
                            className="w-full rounded-sm px-3 py-2 text-right text-sm transition-colors hover:bg-accent"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelect(item)}
                        >
                            {renderItem(item)}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
        </div>
    ) : null;

    if (selectedLabel) {
        return (
            <div className={cn('flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm', disabled && 'opacity-60', className)}>
                <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{selectedLabel}</div>
                    {selectedMeta && (
                        <div className="truncate text-xs text-muted-foreground">{selectedMeta}</div>
                    )}
                </div>
                {onClear && !disabled && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClear}>
                        <X size={14} />
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div ref={triggerRef} className={cn('relative w-full min-w-0', className)}>
            <Search className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
                value={search}
                onChange={(event) => {
                    setSearch(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                className="w-full min-w-0 pr-9"
                disabled={disabled}
            />
            {dropdown ? createPortal(dropdown, document.body) : null}
        </div>
    );
}

interface CustomerSearchSelectProps {
    value: string;
    selected?: InvoiceCustomerOption | null;
    branchId?: string | null;
    onSelect: (customer: InvoiceCustomerOption | null) => void;
    disabled?: boolean;
}

export function CustomerSearchSelect({ value, selected, branchId, onSelect, disabled }: CustomerSearchSelectProps) {
    const selectedLabel = selected?.id === value ? selected.name : undefined;

    return (
        <SearchBox
            selectedLabel={selectedLabel}
            selectedMeta={selected?.phone || selected?.code}
            placeholder="ابحث بالاسم أو الهاتف أو الكود..."
            emptyText="لا توجد نتائج"
            queryKey={(search) => ['invoice-customer-search', branchId, search]}
            queryFn={async (search) => {
                let query = supabase
                    .from('customers')
                    .select('id, name, phone, code')
                    .or(`name.ilike.%${search}%,phone.ilike.%${search}%,code.ilike.%${search}%`)
                    .eq('is_active', true);

                if (branchId) {
                    query = query.eq('branch_id', branchId);
                }

                const { data, error } = await query.order('name').limit(10);
                if (error) throw error;
                return (data || []) as InvoiceCustomerOption[];
            }}
            getKey={(customer: InvoiceCustomerOption) => customer.id}
            renderItem={(customer: InvoiceCustomerOption) => (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate font-medium">{customer.name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{customer.phone || '-'}</div>
                    </div>
                    {customer.code && <Badge variant="outline">{customer.code}</Badge>}
                </div>
            )}
            onSelect={onSelect}
            onClear={() => onSelect(null)}
            disabled={disabled}
            className="min-w-0 sm:min-w-[220px]"
        />
    );
}

interface SupplierSearchSelectProps {
    value: string;
    selected?: InvoiceSupplierOption | null;
    onSelect: (supplier: InvoiceSupplierOption | null) => void;
    disabled?: boolean;
}

export function SupplierSearchSelect({ value, selected, onSelect, disabled }: SupplierSearchSelectProps) {
    const selectedLabel = selected?.id === value ? selected.name : undefined;

    return (
        <SearchBox
            selectedLabel={selectedLabel}
            selectedMeta={selected?.phone || selected?.code}
            placeholder="ابحث باسم المورد أو الكود..."
            emptyText="لا توجد نتائج"
            queryKey={(search) => ['invoice-supplier-search', search]}
            queryFn={async (search) => {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('id, name, phone, code')
                    .or(`name.ilike.%${search}%,phone.ilike.%${search}%,code.ilike.%${search}%`)
                    .eq('is_active', true)
                    .order('name')
                    .limit(10);

                if (error) throw error;
                return (data || []) as InvoiceSupplierOption[];
            }}
            getKey={(supplier: InvoiceSupplierOption) => supplier.id}
            renderItem={(supplier: InvoiceSupplierOption) => (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate font-medium">{supplier.name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{supplier.phone || '-'}</div>
                    </div>
                    {supplier.code && <Badge variant="outline">{supplier.code}</Badge>}
                </div>
            )}
            onSelect={onSelect}
            onClear={() => onSelect(null)}
            disabled={disabled}
            className="min-w-0 sm:min-w-[220px]"
        />
    );
}

interface ProductSearchSelectProps {
    selectedLabel?: string;
    selectedCode?: string | null;
    onSelect: (product: InvoiceProductOption | null) => void;
    excludeServices?: boolean;
    disabled?: boolean;
}

export function ProductSearchSelect({ selectedLabel, selectedCode, onSelect, excludeServices = false, disabled }: ProductSearchSelectProps) {
    return (
        <SearchBox
            selectedLabel={selectedLabel}
            selectedMeta={selectedCode || null}
            placeholder="ابحث بالاسم أو الكود أو الباركود..."
            emptyText="لا توجد نتائج"
            queryKey={(search) => ['invoice-product-search', excludeServices, search]}
            queryFn={async (search) => {
                let query = supabase
                    .from('products')
                    .select('id, code, name, product_type, selling_price, purchase_price')
                    .or(`name.ilike.%${search}%,code.ilike.%${search}%,barcode.ilike.%${search}%`)
                    .eq('is_active', true);

                if (excludeServices) {
                    query = query.neq('product_type', 'service');
                }

                const { data, error } = await query.order('name').limit(10);
                if (error) throw error;
                return (data || []) as InvoiceProductOption[];
            }}
            getKey={(product: InvoiceProductOption) => product.id}
            renderItem={(product: InvoiceProductOption) => (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.code || '-'}</div>
                    </div>
                    <div className="shrink-0 text-left text-xs">
                        <div>{formatCurrency(product.selling_price || 0)}</div>
                        <div className="text-muted-foreground">{product.product_type}</div>
                    </div>
                </div>
            )}
            onSelect={onSelect}
            onClear={() => onSelect(null)}
            disabled={disabled}
            className="min-w-0 sm:min-w-[280px]"
        />
    );
}
