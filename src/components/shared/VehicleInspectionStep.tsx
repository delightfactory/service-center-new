import React, { useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Minus,
    Camera,
    Trash2,
    MessageSquare,
    Snowflake,
    Lock,
    Lightbulb,
    Sun,
    Droplets,
    Gauge,
    Cog,
    Fan,
    Battery,
    AlertTriangle,
    AlertCircle,
    Circle,
    ShieldCheck,
    Shield,
    Square,
    MonitorSpeaker,
    Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { compressInspectionPhoto } from '@/lib/utils/image-compression';
import { logStorageFile } from '@/lib/services/storage-cleanup.service';
import {
    INSPECTION_ITEMS,
    CATEGORY_LABELS,
    createEmptyInspectionData,
    type InspectionData,
    type InspectionStatus,
    type InspectionItem,
} from '@/lib/constants/inspection-items';

// ============================================================
// Vehicle Inspection Step Component - Improved UX
// ============================================================
// تصميم محسّن للهاتف:
// - كروت مدمجة مع أزرار مباشرة
// - الكاميرا والملاحظات متاحة بنقرة واحدة
// - تصميم أنيق ومدمج
// ============================================================

interface VehicleInspectionStepProps {
    values: InspectionData;
    onChange: (values: InspectionData) => void;
    onSkip: () => void;
    onNext: () => void;
    className?: string;
}

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
    Snowflake,
    Lock,
    Lightbulb,
    Sun,
    Droplets,
    Gauge,
    Cog,
    Fan,
    Battery,
    AlertTriangle,
    AlertCircle,
    Circle,
    ShieldCheck,
    Shield,
    Square,
    MonitorSpeaker,
    Maximize2,
};

export function VehicleInspectionStep({
    values,
    onChange,
    onSkip,
    onNext,
    className,
}: VehicleInspectionStepProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>('electrical');
    const [showNotesFor, setShowNotesFor] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentItemForPhoto, setCurrentItemForPhoto] = useState<string | null>(null);

    // Update item status
    const updateItemStatus = (key: string, status: InspectionStatus) => {
        const newItems = values.items.map(item =>
            item.key === key ? { ...item, status } : item
        );
        onChange({ ...values, items: newItems });
    };

    // Update item notes
    const updateItemNotes = (key: string, notes: string) => {
        const newItems = values.items.map(item =>
            item.key === key ? { ...item, notes } : item
        );
        onChange({ ...values, items: newItems });
    };

    // Handle file input change
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentItemForPhoto) return;

        const itemKey = currentItemForPhoto;
        setUploading(itemKey);

        try {
            // ضغط الصورة قبل الرفع لتوفير المساحة
            const compressedFile = await compressInspectionPhoto(file);

            const fileName = `inspection/${Date.now()}_${compressedFile.name}`;
            const { data, error } = await supabase.storage
                .from('assessment-photos')
                .upload(fileName, compressedFile);

            if (error) throw error;

            // تسجيل الملف للتنظيف لاحقاً (مع حجم الملف)
            logStorageFile('assessment-photos', fileName, compressedFile.size).catch(console.error);

            // الحصول على public URL
            const { data: { publicUrl } } = supabase.storage
                .from('assessment-photos')
                .getPublicUrl(fileName);

            // تحديث الصور
            if (itemKey === 'general') {
                onChange({
                    ...values,
                    inspectionPhotos: [...values.inspectionPhotos, publicUrl],
                });
            } else {
                const newItems = values.items.map(item =>
                    item.key === itemKey
                        ? { ...item, photos: [...item.photos, publicUrl] }
                        : item
                );
                onChange({ ...values, items: newItems });
            }
        } catch (error) {
            console.error('Error uploading photo:', error);
        } finally {
            setUploading(null);
            setCurrentItemForPhoto(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Trigger file input
    const triggerPhotoCapture = (itemKey: string) => {
        setCurrentItemForPhoto(itemKey);
        fileInputRef.current?.click();
    };

    // Remove photo
    const removePhoto = (itemKey: string | 'general', photoUrl: string) => {
        if (itemKey === 'general') {
            onChange({
                ...values,
                inspectionPhotos: values.inspectionPhotos.filter(p => p !== photoUrl),
            });
        } else {
            const newItems = values.items.map(item =>
                item.key === itemKey
                    ? { ...item, photos: item.photos.filter(p => p !== photoUrl) }
                    : item
            );
            onChange({ ...values, items: newItems });
        }
    };

    // Get item by key
    const getItemState = (key: string) => {
        return values.items.find(item => item.key === key);
    };

    // Group items by category
    const categories = ['electrical', 'mechanical', 'exterior', 'safety'] as const;

    // Count completed items
    const completedCount = values.items.filter(item => item.status !== 'not_checked').length;
    const totalCount = values.items.length;

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="text-lg font-bold">فحص حالة المركبة</h2>
                    <p className="text-xs text-muted-foreground">
                        {completedCount} من {totalCount} بند
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                    تخطي
                    <ChevronLeft size={14} className="mr-1" />
                </Button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
            </div>

            {/* Inspection Items */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {categories.map(category => {
                    const categoryItems = INSPECTION_ITEMS.filter(item => item.category === category);
                    const isExpanded = expandedCategory === category;
                    const categoryCompleted = categoryItems.filter(i => getItemState(i.key)?.status !== 'not_checked').length;

                    return (
                        <div key={category} className="border rounded-xl overflow-hidden">
                            {/* Category Header */}
                            <button
                                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{CATEGORY_LABELS[category]}</span>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        categoryCompleted === categoryItems.length
                                            ? "bg-green-100 text-green-700"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        {categoryCompleted}/{categoryItems.length}
                                    </span>
                                </div>
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {/* Category Items - Compact Cards */}
                            {isExpanded && (
                                <div className="divide-y">
                                    {categoryItems.map(item => {
                                        const itemState = getItemState(item.key);
                                        const IconComponent = ICON_MAP[item.icon] || Circle;
                                        const hasNotes = showNotesFor === item.key;
                                        const hasPhotos = (itemState?.photos.length || 0) > 0;

                                        return (
                                            <div key={item.key} className="bg-background p-3">
                                                {/* Main Row */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    {/* Icon */}
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                                        itemState?.status === 'works' ? "bg-green-100" :
                                                            itemState?.status === 'not_working' ? "bg-red-100" : "bg-muted"
                                                    )}>
                                                        <IconComponent size={16} className={cn(
                                                            itemState?.status === 'works' ? "text-green-600" :
                                                                itemState?.status === 'not_working' ? "text-red-600" : "text-muted-foreground"
                                                        )} />
                                                    </div>
                                                    {/* Label */}
                                                    <span className="font-medium text-sm flex-1 truncate">{item.label}</span>
                                                </div>

                                                {/* Action Row */}
                                                <div className="flex items-center gap-1.5">
                                                    {/* Status Buttons */}
                                                    <div className="flex gap-1 flex-1">
                                                        <button
                                                            onClick={() => updateItemStatus(item.key, 'works')}
                                                            className={cn(
                                                                "flex-1 h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all",
                                                                itemState?.status === 'works'
                                                                    ? "bg-green-500 text-white shadow-sm"
                                                                    : "bg-green-50 text-green-700 hover:bg-green-100"
                                                            )}
                                                        >
                                                            <Check size={14} />
                                                            <span className="hidden xs:inline">يعمل</span>
                                                        </button>
                                                        <button
                                                            onClick={() => updateItemStatus(item.key, 'not_working')}
                                                            className={cn(
                                                                "flex-1 h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all",
                                                                itemState?.status === 'not_working'
                                                                    ? "bg-red-500 text-white shadow-sm"
                                                                    : "bg-red-50 text-red-700 hover:bg-red-100"
                                                            )}
                                                        >
                                                            <X size={14} />
                                                            <span className="hidden xs:inline">لا</span>
                                                        </button>
                                                        <button
                                                            onClick={() => updateItemStatus(item.key, 'not_checked')}
                                                            className={cn(
                                                                "h-9 px-2 rounded-lg text-xs font-medium flex items-center justify-center transition-all",
                                                                itemState?.status === 'not_checked'
                                                                    ? "bg-gray-500 text-white shadow-sm"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                            )}
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Divider */}
                                                    <div className="w-px h-6 bg-border" />

                                                    {/* Camera Button */}
                                                    <button
                                                        onClick={() => triggerPhotoCapture(item.key)}
                                                        disabled={uploading === item.key}
                                                        className={cn(
                                                            "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                                                            hasPhotos
                                                                ? "bg-blue-100 text-blue-600"
                                                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                        )}
                                                    >
                                                        {uploading === item.key ? (
                                                            <span className="animate-spin text-xs">⏳</span>
                                                        ) : (
                                                            <Camera size={16} />
                                                        )}
                                                    </button>

                                                    {/* Notes Button */}
                                                    <button
                                                        onClick={() => setShowNotesFor(hasNotes ? null : item.key)}
                                                        className={cn(
                                                            "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                                                            (itemState?.notes || hasNotes)
                                                                ? "bg-amber-100 text-amber-600"
                                                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                        )}
                                                    >
                                                        <MessageSquare size={16} />
                                                    </button>
                                                </div>

                                                {/* Photos Row */}
                                                {hasPhotos && (
                                                    <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                                                        {itemState?.photos.map((photo, idx) => (
                                                            <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0">
                                                                <img src={photo} alt="" className="w-full h-full object-cover" />
                                                                <button
                                                                    onClick={() => removePhoto(item.key, photo)}
                                                                    className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full shadow"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Notes Input */}
                                                {hasNotes && (
                                                    <div className="mt-2">
                                                        <Textarea
                                                            value={itemState?.notes || ''}
                                                            onChange={(e) => updateItemNotes(item.key, e.target.value)}
                                                            placeholder="أضف ملاحظة..."
                                                            className="min-h-[60px] text-sm resize-none"
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Additional Notes Section */}
                <div className="border rounded-xl p-4 space-y-4">
                    <h3 className="font-semibold text-sm">ملاحظات إضافية</h3>

                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                            ملاحظات أخرى
                        </Label>
                        <Textarea
                            value={values.additionalNotes}
                            onChange={(e) => onChange({ ...values, additionalNotes: e.target.value })}
                            placeholder="ملاحظات غير مذكورة في القائمة..."
                            className="min-h-[60px] text-sm"
                        />
                    </div>

                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                            طلب صيانة إضافية
                        </Label>
                        <Textarea
                            value={values.additionalWorkRequest}
                            onChange={(e) => onChange({ ...values, additionalWorkRequest: e.target.value })}
                            placeholder="طلبات صيانة إضافية من العميل..."
                            className="min-h-[60px] text-sm"
                        />
                    </div>

                    {/* General Photos */}
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                            صور عامة للمركبة
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {values.inspectionPhotos.map((photo, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                                    <img src={photo} alt="" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removePhoto('general', photo)}
                                        className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full shadow"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => triggerPhotoCapture('general')}
                                disabled={uploading === 'general'}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                            >
                                {uploading === 'general' ? (
                                    <span className="animate-spin">⏳</span>
                                ) : (
                                    <>
                                        <Camera size={18} className="text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground">إضافة</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Next Button */}
            <div className="pt-3 border-t mt-auto">
                <Button className="w-full h-11 text-base" onClick={onNext}>
                    التالي
                </Button>
            </div>
        </div>
    );
}

export default VehicleInspectionStep;
