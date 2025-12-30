import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Product Import/Export - استيراد وتصدير المنتجات
// ============================================================

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
}

interface ProductImportExportProps {
    onComplete?: () => void;
}

// Export products to CSV
export function useExportProducts() {
    const [isExporting, setIsExporting] = useState(false);

    const exportToCSV = async () => {
        setIsExporting(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    code, name, name_en, description, product_type,
                    unit, purchase_price, selling_price, min_stock,
                    is_trackable, is_composite, barcode, brand, warranty_months,
                    duration_minutes, labor_cost, is_active,
                    category:categories(name)
                `)
                .order('code');

            if (error) throw error;

            // Convert to CSV
            const headers = [
                'الكود', 'الاسم', 'الاسم الإنجليزي', 'الوصف', 'النوع',
                'التصنيف', 'الوحدة', 'سعر الشراء', 'سعر البيع', 'الحد الأدنى',
                'قابل للتتبع', 'مركب', 'الباركود', 'الماركة', 'الضمان (شهر)',
                'مدة التنفيذ (دقيقة)', 'تكلفة العمالة', 'نشط'
            ];

            const productTypeLabels: Record<string, string> = {
                part: 'قطعة غيار',
                consumable: 'مستهلك',
                service: 'خدمة'
            };

            const rows = data.map(p => {
                const categoryData = p.category as { name: string } | { name: string }[] | null;
                const categoryName = Array.isArray(categoryData) ? categoryData[0]?.name || '' : categoryData?.name || '';
                return [
                    p.code || '',
                    p.name,
                    p.name_en || '',
                    p.description || '',
                    productTypeLabels[p.product_type] || p.product_type,
                    categoryName,
                    p.unit,
                    p.purchase_price,
                    p.selling_price,
                    p.min_stock,
                    p.is_trackable ? 'نعم' : 'لا',
                    p.is_composite ? 'نعم' : 'لا',
                    p.barcode || '',
                    p.brand || '',
                    p.warranty_months || '',
                    p.duration_minutes || '',
                    p.labor_cost || '',
                    p.is_active ? 'نعم' : 'لا'
                ];
            });

            // Build CSV content with BOM for Arabic support
            const BOM = '\uFEFF';
            const csvContent = BOM + [
                headers.join(','),
                ...rows.map(row => row.map(cell =>
                    typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))
                        ? `"${cell.replace(/"/g, '""')}"`
                        : cell
                ).join(','))
            ].join('\n');

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export error:', error);
            alert('حدث خطأ أثناء التصدير');
        } finally {
            setIsExporting(false);
        }
    };

    return { exportToCSV, isExporting };
}

// Import Modal Component
export function ProductImportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const productTypeMap: Record<string, string> = {
        'قطعة غيار': 'part',
        'مستهلك': 'consumable',
        'خدمة': 'service',
        'part': 'part',
        'consumable': 'consumable',
        'service': 'service'
    };

    const parseCSV = (text: string): string[][] => {
        const lines: string[][] = [];
        let currentLine: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentLine.push(currentField.trim());
                currentField = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentLine.push(currentField.trim());
                if (currentLine.some(f => f)) lines.push(currentLine);
                currentLine = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
        if (currentField || currentLine.length) {
            currentLine.push(currentField.trim());
            if (currentLine.some(f => f)) lines.push(currentLine);
        }
        return lines;
    };

    const handleImport = async () => {
        if (!file) return;

        setIsImporting(true);
        setProgress(0);
        const errors: string[] = [];
        let success = 0;
        let failed = 0;

        try {
            const text = await file.text();
            const rows = parseCSV(text);

            if (rows.length < 2) {
                throw new Error('الملف فارغ أو لا يحتوي على بيانات');
            }

            // Skip header row
            const dataRows = rows.slice(1);
            const total = dataRows.length;

            // Get categories for mapping
            const { data: categories } = await supabase
                .from('categories')
                .select('id, name');
            const categoryMap = new Map(categories?.map(c => [c.name, c.id]) || []);

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                try {
                    const [
                        code, name, name_en, description, product_type,
                        category, unit, purchase_price, selling_price, min_stock,
                        is_trackable, is_composite, barcode, brand, warranty_months,
                        duration_minutes, labor_cost, is_active
                    ] = row;

                    if (!name) {
                        throw new Error('اسم المنتج مطلوب');
                    }

                    const productData = {
                        code: code || null,
                        name: name.trim(),
                        name_en: name_en?.trim() || null,
                        description: description?.trim() || null,
                        product_type: productTypeMap[product_type?.trim()] || 'part',
                        category_id: categoryMap.get(category?.trim()) || null,
                        unit: unit?.trim() || 'قطعة',
                        purchase_price: parseFloat(purchase_price) || 0,
                        selling_price: parseFloat(selling_price) || 0,
                        min_stock: parseFloat(min_stock) || 0,
                        is_trackable: is_trackable === 'نعم' || is_trackable === 'true',
                        is_composite: is_composite === 'نعم' || is_composite === 'true',
                        barcode: barcode?.trim() || null,
                        brand: brand?.trim() || null,
                        warranty_months: warranty_months ? parseInt(warranty_months) : null,
                        duration_minutes: duration_minutes ? parseInt(duration_minutes) : null,
                        labor_cost: labor_cost ? parseFloat(labor_cost) : 0,
                        is_active: is_active !== 'لا' && is_active !== 'false'
                    };

                    const { error } = await supabase
                        .from('products')
                        .upsert(productData, { onConflict: 'code' });

                    if (error) throw error;
                    success++;
                } catch (err: any) {
                    failed++;
                    errors.push(`سطر ${i + 2}: ${err.message}`);
                }

                setProgress(Math.round(((i + 1) / total) * 100));
            }

            setResult({ success, failed, errors });
            queryClient.invalidateQueries({ queryKey: ['products'] });

        } catch (error: any) {
            setResult({ success: 0, failed: 1, errors: [error.message] });
        } finally {
            setIsImporting(false);
        }
    };

    const handleClose = () => {
        if (!isImporting) {
            setFile(null);
            setProgress(0);
            setResult(null);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload size={20} />
                        استيراد المنتجات
                    </DialogTitle>
                    <DialogDescription>
                        رفع ملف CSV يحتوي على بيانات المنتجات
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File Input */}
                    <div
                        onClick={() => !isImporting && fileInputRef.current?.click()}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                            file ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-muted hover:border-primary"
                        )}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isImporting}
                        />
                        <FileSpreadsheet size={40} className="mx-auto mb-2 text-muted-foreground" />
                        {file ? (
                            <p className="font-medium text-green-600">{file.name}</p>
                        ) : (
                            <>
                                <p className="font-medium">اسحب الملف هنا أو انقر للاختيار</p>
                                <p className="text-sm text-muted-foreground">CSV فقط</p>
                            </>
                        )}
                    </div>

                    {/* Progress */}
                    {isImporting && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>جاري الاستيراد...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className={cn(
                            "p-4 rounded-lg",
                            result.failed === 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                {result.failed === 0 ? (
                                    <CheckCircle className="text-green-600" size={20} />
                                ) : (
                                    <AlertTriangle className="text-amber-600" size={20} />
                                )}
                                <span className="font-medium">
                                    نجح: {result.success} | فشل: {result.failed}
                                </span>
                            </div>
                            {result.errors.length > 0 && (
                                <ul className="text-sm text-destructive space-y-1 max-h-32 overflow-y-auto">
                                    {result.errors.slice(0, 10).map((err, i) => (
                                        <li key={i}>• {err}</li>
                                    ))}
                                    {result.errors.length > 10 && (
                                        <li>... و{result.errors.length - 10} أخطاء أخرى</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Template Download */}
                    <div className="text-center text-sm text-muted-foreground">
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                // Create template CSV
                                const headers = 'الكود,الاسم,الاسم الإنجليزي,الوصف,النوع,التصنيف,الوحدة,سعر الشراء,سعر البيع,الحد الأدنى,قابل للتتبع,مركب,الباركود,الماركة,الضمان (شهر),مدة التنفيذ (دقيقة),تكلفة العمالة,نشط';
                                const example = 'PRD001,زيت محرك 5W30,Engine Oil 5W30,زيت محرك عالي الجودة,مستهلك,زيوت,لتر,50,75,10,نعم,لا,123456789,Castrol,12,,,نعم';
                                const content = '\uFEFF' + headers + '\n' + example;
                                const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = 'products_template.csv';
                                link.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="text-primary hover:underline"
                        >
                            تحميل نموذج الملف
                        </a>
                    </div>
                </div>

                <DialogFooter className="flex-row-reverse gap-2">
                    <Button
                        onClick={handleImport}
                        disabled={!file || isImporting}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 size={16} className="animate-spin ml-2" />
                                جاري الاستيراد...
                            </>
                        ) : (
                            <>
                                <Upload size={16} className="ml-2" />
                                استيراد
                            </>
                        )}
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                        {result ? 'إغلاق' : 'إلغاء'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Export Button Component
export function ExportProductsButton() {
    const { exportToCSV, isExporting } = useExportProducts();

    return (
        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={isExporting}>
            {isExporting ? (
                <Loader2 size={16} className="animate-spin ml-2" />
            ) : (
                <Download size={16} className="ml-2" />
            )}
            تصدير
        </Button>
    );
}

export default ProductImportModal;
