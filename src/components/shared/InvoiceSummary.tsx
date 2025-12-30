import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Trash2, ShoppingCart } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================================
// InvoiceSummary - مكون ملخص الفاتورة
// ============================================================

interface InvoiceItem {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface InvoiceSummaryProps {
    items: InvoiceItem[];
    onRemoveItem?: (itemId: string) => void;
    onCheckout?: () => void;
    checkoutLabel?: string;
    checkoutDisabled?: boolean;
    isLoading?: boolean;
    subtotal?: number;
    discount?: number;
    tax?: number;
    taxRate?: number;
    className?: string;
}

// Simple Divider component
const Divider = () => <div className="border-t my-2" />;

export function InvoiceSummary({
    items,
    onRemoveItem,
    onCheckout,
    checkoutLabel = 'إتمام العملية',
    checkoutDisabled = false,
    isLoading = false,
    subtotal: externalSubtotal,
    discount = 0,
    tax: externalTax,
    taxRate = 14,
    className,
}: InvoiceSummaryProps) {
    // حساب المجاميع
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.total, 0);
    const subtotal = externalSubtotal ?? calculatedSubtotal;
    const taxAmount = externalTax ?? (subtotal - discount) * (taxRate / 100);
    const total = subtotal - discount + taxAmount;

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Receipt size={18} />
                    ملخص الفاتورة
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* قائمة البنود */}
                {items.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-auto">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.quantity} × {formatCurrency(item.unit_price)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">
                                        {formatCurrency(item.total)}
                                    </span>
                                    {onRemoveItem && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                            onClick={() => onRemoveItem(item.id)}
                                        >
                                            <Trash2 size={14} className="text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <ShoppingCart size={40} className="mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">
                            لم تتم إضافة أي بنود
                        </p>
                    </div>
                )}

                {/* المجاميع */}
                {items.length > 0 && (
                    <>
                        <Divider />
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">المجموع الفرعي</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>الخصم</span>
                                    <span>- {formatCurrency(discount)}</span>
                                </div>
                            )}
                            {taxAmount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        الضريبة ({taxRate}%)
                                    </span>
                                    <span>{formatCurrency(taxAmount)}</span>
                                </div>
                            )}
                            <Divider />
                            <div className="flex justify-between text-lg font-bold">
                                <span>الإجمالي</span>
                                <span className="text-primary">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </>
                )}

                {/* زر الإتمام */}
                {onCheckout && items.length > 0 && (
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={onCheckout}
                        disabled={checkoutDisabled || isLoading}
                    >
                        {isLoading ? 'جاري المعالجة...' : checkoutLabel}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

export default InvoiceSummary;
