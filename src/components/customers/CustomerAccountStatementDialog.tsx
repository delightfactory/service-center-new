import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Calendar, Printer, FileText, Receipt, TrendingUp, TrendingDown,
    Wallet, Clock, Download
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
    AccountStatementPrintTemplate,
    type AccountStatementData,
    type StatementInvoice,
    type StatementPayment,
} from '@/components/print/AccountStatementPrintTemplate';

// ============================================================
// Customer Account Statement Dialog - كشف حساب العميل
// ============================================================

interface CustomerInfo {
    id: string;
    code: string;
    name: string;
    phone: string;
    phone_alt?: string | null;
    email?: string | null;
    address?: string | null;
    customer_type: 'individual' | 'company';
    tax_number?: string | null;
    balance: number;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customer: CustomerInfo;
}

type PresetPeriod = 'week' | '2weeks' | 'month' | '3months' | 'custom';

const presetOptions: { value: PresetPeriod; label: string; icon: React.ReactNode }[] = [
    { value: 'week', label: 'آخر أسبوع', icon: <Clock size={14} /> },
    { value: '2weeks', label: 'آخر أسبوعين', icon: <Clock size={14} /> },
    { value: 'month', label: 'آخر شهر', icon: <Calendar size={14} /> },
    { value: '3months', label: 'آخر 3 أشهر', icon: <Calendar size={14} /> },
    { value: 'custom', label: 'فترة مخصصة', icon: <Calendar size={14} /> },
];

/** Get the most recent Monday (or today if it's Monday) */
function getMostRecentMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, ...
    const diff = day === 0 ? 6 : day - 1; // days back to reach Monday
    d.setDate(d.getDate() - diff);
    return d;
}

function getPresetDates(preset: PresetPeriod): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from: Date;

    switch (preset) {
        case 'week': {
            // من بداية الأسبوع الحالي (الاثنين) إلى اليوم
            from = getMostRecentMonday(now);
            break;
        }
        case '2weeks': {
            // من بداية الأسبوع الماضي (اثنين قبل الماضي) إلى اليوم
            const thisMonday = getMostRecentMonday(now);
            from = new Date(thisMonday);
            from.setDate(from.getDate() - 7);
            break;
        }
        case 'month':
            from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
        case '3months':
            from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            break;
        default:
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }

    return { from: from.toISOString().split('T')[0], to };
}

export function CustomerAccountStatementDialog({ open, onOpenChange, customer }: Props) {
    const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Calculate effective dates
    const effectiveDates = useMemo(() => {
        if (selectedPreset === 'custom') {
            return {
                from: customFrom || getPresetDates('month').from,
                to: customTo || getPresetDates('month').to,
            };
        }
        return getPresetDates(selectedPreset);
    }, [selectedPreset, customFrom, customTo]);

    // Fetch invoices for the period
    const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
        queryKey: ['statement-invoices', customer.id, effectiveDates.from, effectiveDates.to],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select(`
                    id, code, invoice_type, total_amount, paid_amount, remaining_amount, status, created_at,
                    job_order:job_orders(code, vehicle:vehicles(plate_number, make, model))
                `)
                .eq('customer_id', customer.id)
                .gte('created_at', `${effectiveDates.from}T00:00:00`)
                .lte('created_at', `${effectiveDates.to}T23:59:59`)
                .order('created_at', { ascending: true });
            if (error) throw error;

            // Fetch invoice items for each invoice
            const invoiceIds = (data || []).map(inv => inv.id);
            let itemsByInvoice: Record<string, { description: string; quantity: number; unit_price: number; total_price: number }[]> = {};

            if (invoiceIds.length > 0) {
                const { data: items, error: itemsError } = await supabase
                    .from('invoice_items')
                    .select('invoice_id, description, quantity, unit_price, total_price')
                    .in('invoice_id', invoiceIds)
                    .order('sort_order');
                if (!itemsError && items) {
                    for (const item of items) {
                        const invId = (item as any).invoice_id;
                        if (!itemsByInvoice[invId]) itemsByInvoice[invId] = [];
                        itemsByInvoice[invId].push({
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.total_price,
                        });
                    }
                }
            }

            return (data || []).map(inv => {
                const jo = Array.isArray(inv.job_order) ? inv.job_order[0] : inv.job_order;
                let vehicle = null;
                if (jo?.vehicle) {
                    vehicle = Array.isArray(jo.vehicle) ? jo.vehicle[0] : jo.vehicle;
                }
                return {
                    id: inv.id,
                    code: inv.code,
                    invoice_type: inv.invoice_type,
                    total_amount: inv.total_amount,
                    paid_amount: inv.paid_amount,
                    remaining_amount: inv.remaining_amount,
                    status: inv.status,
                    created_at: inv.created_at,
                    vehicle,
                    job_order: jo ? { code: jo.code } : null,
                    items: itemsByInvoice[inv.id] || [],
                } as StatementInvoice;
            });
        },
        enabled: open,
    });

    // Fetch payments for the period
    const { data: payments, isLoading: isLoadingPayments } = useQuery({
        queryKey: ['statement-payments', customer.id, effectiveDates.from, effectiveDates.to],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    id, code, payment_type, payment_method, amount, payment_date, notes,
                    invoice:invoices(code)
                `)
                .eq('customer_id', customer.id)
                .gte('payment_date', effectiveDates.from)
                .lte('payment_date', effectiveDates.to)
                .order('payment_date', { ascending: true });
            if (error) throw error;
            return (data || []).map(p => ({
                ...p,
                invoice: Array.isArray(p.invoice) ? p.invoice[0] : p.invoice,
            })) as StatementPayment[];
        },
        enabled: open,
    });

    // Calculate opening balance (balance before the period)
    const { data: openingBalance, isLoading: isLoadingOpening } = useQuery({
        queryKey: ['statement-opening', customer.id, effectiveDates.from],
        queryFn: async () => {
            // Sum of all invoices before the period (active only)
            const { data: prevInvoices, error: invError } = await supabase
                .from('invoices')
                .select('total_amount, status')
                .eq('customer_id', customer.id)
                .lt('created_at', `${effectiveDates.from}T00:00:00`)
                .not('status', 'in', '("cancelled","draft")');
            if (invError) throw invError;

            const totalPrevInvoices = (prevInvoices || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

            // Sum of all payments before the period
            const { data: prevPayments, error: payError } = await supabase
                .from('payments')
                .select('amount')
                .eq('customer_id', customer.id)
                .lt('payment_date', effectiveDates.from);
            if (payError) throw payError;

            const totalPrevPayments = (prevPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

            return totalPrevInvoices - totalPrevPayments;
        },
        enabled: open,
    });

    const isLoading = isLoadingInvoices || isLoadingPayments || isLoadingOpening;

    // Stats for preview
    const activeInvoices = (invoices || []).filter(i => i.status !== 'cancelled' && i.status !== 'draft');
    const totalInvoices = activeInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalPayments = (payments || []).reduce((sum, p) => sum + p.amount, 0);
    const closingBalance = (openingBalance || 0) + totalInvoices - totalPayments;

    // Build statement data for print
    const statementData: AccountStatementData | null = (!isLoading && invoices && payments && openingBalance !== undefined)
        ? {
            customer,
            dateFrom: effectiveDates.from,
            dateTo: effectiveDates.to,
            openingBalance: openingBalance || 0,
            invoices: invoices,
            payments: payments,
        }
        : null;

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `كشف حساب - ${customer.name} (${customer.code}) - من ${effectiveDates.from} إلى ${effectiveDates.to}`,
    });

    const pdfFileName = `كشف حساب - ${customer.name} (${customer.code}) - من ${effectiveDates.from} إلى ${effectiveDates.to}.pdf`;

    const handleExportPdf = useCallback(async () => {
        if (!printRef.current) return;
        setIsExporting(true);
        try {
            const element = printRef.current;
            const opt = {
                margin: [12, 12, 12, 12] as [number, number, number, number],
                filename: pdfFileName,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
                pagebreak: { mode: ['avoid-all' as const, 'css' as const] },
            };
            await html2pdf().set(opt).from(element).save();
        } catch (err) {
            console.error('PDF export failed:', err);
            alert('فشل تصدير الملف، يرجى المحاولة مرة أخرى');
        } finally {
            setIsExporting(false);
        }
    }, [pdfFileName]);

    const hasData = activeInvoices.length > 0 || (payments || []).length > 0;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText size={20} />
                            كشف حساب العميل
                        </DialogTitle>
                        <DialogDescription>
                            {customer.name} ({customer.code})
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Period Selection */}
                        <div className="space-y-3">
                            <Label className="font-bold">اختر الفترة الزمنية</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {presetOptions.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setSelectedPreset(option.value)}
                                        className={cn(
                                            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
                                            selectedPreset === option.value
                                                ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                                                : 'border-gray-200 hover:border-primary/50 hover:bg-muted/50'
                                        )}
                                    >
                                        {option.icon}
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom date inputs */}
                            {selectedPreset === 'custom' && (
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">من تاريخ</Label>
                                        <Input
                                            type="date"
                                            value={customFrom || effectiveDates.from}
                                            onChange={(e) => setCustomFrom(e.target.value)}
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">إلى تاريخ</Label>
                                        <Input
                                            type="date"
                                            value={customTo || effectiveDates.to}
                                            onChange={(e) => setCustomTo(e.target.value)}
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview Stats */}
                        <div className="border rounded-lg p-4 bg-muted/30">
                            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                <Wallet size={16} />
                                ملخص الفترة
                                <Badge variant="outline" className="mr-auto">
                                    {formatDate(effectiveDates.from)} — {formatDate(effectiveDates.to)}
                                </Badge>
                            </h4>

                            {isLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-2 p-2 bg-background rounded border">
                                        <div className="p-1.5 rounded bg-blue-100">
                                            <Wallet size={14} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">رصيد افتتاحي</p>
                                            <p className="font-bold text-sm font-mono">{formatCurrency(openingBalance || 0)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-background rounded border">
                                        <div className="p-1.5 rounded bg-red-100">
                                            <TrendingUp size={14} className="text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">فواتير ({activeInvoices.length})</p>
                                            <p className="font-bold text-sm font-mono text-red-600">{formatCurrency(totalInvoices)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-background rounded border">
                                        <div className="p-1.5 rounded bg-green-100">
                                            <TrendingDown size={14} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">مدفوعات ({(payments || []).length})</p>
                                            <p className="font-bold text-sm font-mono text-green-600">{formatCurrency(totalPayments)}</p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        'flex items-center gap-2 p-2 rounded border-2',
                                        closingBalance > 0 ? 'border-red-300 bg-red-50' : closingBalance < 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'
                                    )}>
                                        <div className={cn(
                                            'p-1.5 rounded',
                                            closingBalance > 0 ? 'bg-red-200' : closingBalance < 0 ? 'bg-green-200' : 'bg-gray-200'
                                        )}>
                                            <Receipt size={14} className={closingBalance > 0 ? 'text-red-700' : closingBalance < 0 ? 'text-green-700' : 'text-gray-700'} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">الرصيد النهائي</p>
                                            <p className={cn(
                                                'font-bold text-sm font-mono',
                                                closingBalance > 0 ? 'text-red-700' : closingBalance < 0 ? 'text-green-700' : ''
                                            )}>
                                                {formatCurrency(closingBalance)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* No data message */}
                        {!isLoading && activeInvoices.length === 0 && (payments || []).length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                                لا توجد حركات في هذه الفترة
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            إغلاق
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handlePrint()}
                                disabled={isLoading || !hasData}
                                className="gap-2"
                            >
                                <Printer size={16} />
                                طباعة
                            </Button>
                            <Button
                                onClick={handleExportPdf}
                                disabled={isLoading || !hasData || isExporting}
                                className="gap-2"
                            >
                                <Download size={16} />
                                {isExporting ? 'جاري التصدير...' : 'تحميل PDF'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden Print Template */}
            <div style={{ display: 'none' }}>
                {statementData && (
                    <AccountStatementPrintTemplate
                        ref={printRef}
                        data={statementData}
                    />
                )}
            </div>
        </>
    );
}

export default CustomerAccountStatementDialog;
