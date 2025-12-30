import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, FileCheck, CreditCard, ExternalLink, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import type { LinkedInvoice } from './types';

// ============================================================
// Job Invoice Card Component
// ============================================================

interface JobInvoiceCardProps {
    jobOrderId: string;
    linkedInvoice: LinkedInvoice | null;
    hasItems: boolean;
    itemsTotal: number;
}

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    draft: { label: 'مسودة', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Receipt },
    approved: { label: 'معتمدة', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileCheck },
    paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    partially_paid: { label: 'مدفوعة جزئياً', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: CreditCard },
    cancelled: { label: 'ملغاة', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: AlertCircle },
};

export function JobInvoiceCard({ jobOrderId, linkedInvoice, hasItems, itemsTotal }: JobInvoiceCardProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Approve invoice mutation
    const approveInvoiceMutation = useMutation({
        mutationFn: async () => {
            if (!linkedInvoice) return;
            const { error } = await supabase
                .from('invoices')
                .update({ status: 'approved' })
                .eq('id', linkedInvoice.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-invoice', jobOrderId] });
        },
        onError: (error) => {
            console.error('Approve invoice failed:', error);
            alert('فشل اعتماد الفاتورة');
        },
    });

    const handleCreateInvoice = () => {
        navigate(`/dashboard/finance/invoices/new?job_order_id=${jobOrderId}`);
    };

    // No invoice yet
    if (!linkedInvoice) {
        return (
            <Card className="border-dashed border-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Receipt size={18} />
                        الفاتورة
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {hasItems ? (
                        <div className="space-y-3">
                            <div className="text-center py-2">
                                <p className="text-2xl font-bold text-primary">{formatCurrency(itemsTotal)}</p>
                                <p className="text-sm text-muted-foreground">إجمالي البنود</p>
                            </div>
                            <Button className="w-full gap-2" onClick={handleCreateInvoice}>
                                <Plus size={16} />
                                إنشاء فاتورة
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground">
                            <Receipt size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">أضف بنود لإنشاء فاتورة</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Has invoice
    const statusConfig = INVOICE_STATUS_CONFIG[linkedInvoice.status] || INVOICE_STATUS_CONFIG.draft;
    const StatusIcon = statusConfig.icon;
    const paidPercent = linkedInvoice.total_amount > 0
        ? Math.round((linkedInvoice.paid_amount / linkedInvoice.total_amount) * 100)
        : 0;
    const remaining = linkedInvoice.total_amount - linkedInvoice.paid_amount;

    return (
        <Card className={cn(
            linkedInvoice.status === 'paid' && 'border-green-300 dark:border-green-800',
            linkedInvoice.status === 'approved' && 'border-blue-300 dark:border-blue-800',
            linkedInvoice.status === 'draft' && 'border-amber-300 dark:border-amber-800'
        )}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Receipt size={18} />
                        الفاتورة
                    </CardTitle>
                    <Badge className={cn(statusConfig.color, 'gap-1')}>
                        <StatusIcon size={12} />
                        {statusConfig.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Invoice Code */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">رقم الفاتورة</span>
                    <Badge variant="outline" className="font-mono">{linkedInvoice.code}</Badge>
                </div>

                {/* Amount Summary */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">الإجمالي</span>
                        <span className="font-bold text-lg">{formatCurrency(linkedInvoice.total_amount)}</span>
                    </div>
                    {linkedInvoice.status !== 'draft' && (
                        <>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">المدفوع</span>
                                <span className="text-green-600 font-medium">{formatCurrency(linkedInvoice.paid_amount)}</span>
                            </div>
                            {remaining > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">المتبقي</span>
                                    <span className="text-red-600 font-medium">{formatCurrency(remaining)}</span>
                                </div>
                            )}
                            {/* Payment Progress */}
                            <div className="pt-2">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>نسبة السداد</span>
                                    <span>{paidPercent}%</span>
                                </div>
                                <Progress value={paidPercent} className="h-2" />
                            </div>
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    {linkedInvoice.status === 'draft' && (
                        <Button
                            className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                            onClick={() => approveInvoiceMutation.mutate()}
                            disabled={approveInvoiceMutation.isPending}
                        >
                            <FileCheck size={16} />
                            اعتماد الفاتورة
                        </Button>
                    )}
                    {linkedInvoice.status === 'approved' && remaining > 0 && (
                        <Button
                            className="w-full gap-2 bg-green-600 hover:bg-green-700"
                            onClick={() => navigate(`/dashboard/finance/invoices/${linkedInvoice.id}`)}
                        >
                            <CreditCard size={16} />
                            تسجيل دفعة
                        </Button>
                    )}
                    <Button variant="outline" className="w-full gap-2" asChild>
                        <Link to={`/dashboard/finance/invoices/${linkedInvoice.id}`}>
                            <ExternalLink size={14} />
                            عرض الفاتورة
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
