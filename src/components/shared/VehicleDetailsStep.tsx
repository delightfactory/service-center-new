import React from 'react';
import { Car, Droplets, Gauge, Palette, Calendar, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// ============================================================
// Vehicle Details Step Component
// ============================================================
// Optional vehicle details (all fields are optional)
// - Make, Model, Year, Color
// - Fuel level (slider)
// - Mileage
// ============================================================

interface VehicleDetails {
    make?: string;
    model?: string;
    year?: string;
    color?: string;
    fuel_level?: number;
    mileage?: string;
}

interface VehicleDetailsStepProps {
    values: VehicleDetails;
    onChange: (values: VehicleDetails) => void;
    onSkip: () => void;
    onNext: () => void;
    className?: string;
}

// Common car makes in Egypt
const CAR_MAKES = [
    'تويوتا', 'نيسان', 'هيونداي', 'كيا', 'شيفروليه',
    'مرسيدس', 'بي إم دبليو', 'أودي', 'فولكس واجن', 'فيات',
    'بيجو', 'رينو', 'هوندا', 'مازدا', 'سوزوكي',
    'ميتسوبيشي', 'سكودا', 'جيلي', 'شيري', 'بروتون',
    'أخرى',
];

// Common colors
const CAR_COLORS = [
    { value: 'أبيض', color: '#FFFFFF' },
    { value: 'أسود', color: '#000000' },
    { value: 'فضي', color: '#C0C0C0' },
    { value: 'رمادي', color: '#808080' },
    { value: 'أحمر', color: '#FF0000' },
    { value: 'أزرق', color: '#0000FF' },
    { value: 'أخضر', color: '#008000' },
    { value: 'بيج', color: '#F5F5DC' },
    { value: 'ذهبي', color: '#FFD700' },
    { value: 'بني', color: '#8B4513' },
];

// Years range
const YEARS = Array.from({ length: 30 }, (_, i) => (2025 - i).toString());

export function VehicleDetailsStep({
    values,
    onChange,
    onSkip,
    onNext,
    className,
}: VehicleDetailsStepProps) {
    const handleChange = (key: keyof VehicleDetails, value: string | number) => {
        onChange({ ...values, [key]: value });
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">تفاصيل إضافية</h2>
                <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
                    تخطي
                    <ChevronLeft size={16} className="mr-1" />
                </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
                جميع الحقول اختيارية - يمكنك تخطي هذه الخطوة
            </p>

            {/* Form */}
            <div className="flex-1 overflow-y-auto space-y-6">
                {/* Make & Model Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="make" className="flex items-center gap-2 mb-2">
                            <Car size={16} className="text-muted-foreground" />
                            الماركة
                        </Label>
                        <Select
                            value={values.make || ''}
                            onValueChange={(val) => handleChange('make', val)}
                        >
                            <SelectTrigger id="make" className="h-12">
                                <SelectValue placeholder="اختر الماركة" />
                            </SelectTrigger>
                            <SelectContent>
                                {CAR_MAKES.map((make) => (
                                    <SelectItem key={make} value={make}>
                                        {make}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="model" className="flex items-center gap-2 mb-2">
                            الموديل
                        </Label>
                        <Input
                            id="model"
                            value={values.model || ''}
                            onChange={(e) => handleChange('model', e.target.value)}
                            placeholder="مثال: كامري"
                            className="h-12"
                        />
                    </div>
                </div>

                {/* Year & Color Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="year" className="flex items-center gap-2 mb-2">
                            <Calendar size={16} className="text-muted-foreground" />
                            سنة الصنع
                        </Label>
                        <Select
                            value={values.year || ''}
                            onValueChange={(val) => handleChange('year', val)}
                        >
                            <SelectTrigger id="year" className="h-12">
                                <SelectValue placeholder="اختر السنة" />
                            </SelectTrigger>
                            <SelectContent>
                                {YEARS.map((year) => (
                                    <SelectItem key={year} value={year}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="color" className="flex items-center gap-2 mb-2">
                            <Palette size={16} className="text-muted-foreground" />
                            اللون
                        </Label>
                        <Select
                            value={values.color || ''}
                            onValueChange={(val) => handleChange('color', val)}
                        >
                            <SelectTrigger id="color" className="h-12">
                                <SelectValue placeholder="اختر اللون" />
                            </SelectTrigger>
                            <SelectContent>
                                {CAR_COLORS.map((color) => (
                                    <SelectItem key={color.value} value={color.value}>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-4 h-4 rounded-full border"
                                                style={{ backgroundColor: color.color }}
                                            />
                                            {color.value}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Fuel Level - Using native range input */}
                <div>
                    <Label className="flex items-center gap-2 mb-4">
                        <Droplets size={16} className="text-muted-foreground" />
                        مستوى الوقود: {values.fuel_level ?? 50}%
                    </Label>
                    <div className="px-2">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={10}
                            value={values.fuel_level ?? 50}
                            onChange={(e) => handleChange('fuel_level', parseInt(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                            <span>E فارغ</span>
                            <span>F ممتلئ</span>
                        </div>
                    </div>
                </div>

                {/* Mileage */}
                <div>
                    <Label htmlFor="mileage" className="flex items-center gap-2 mb-2">
                        <Gauge size={16} className="text-muted-foreground" />
                        عداد الكيلومتر
                    </Label>
                    <div className="relative">
                        <Input
                            id="mileage"
                            type="text"
                            inputMode="numeric"
                            value={values.mileage || ''}
                            onChange={(e) => handleChange('mileage', e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="مثال: 50000"
                            className="h-12 pl-12"
                            dir="ltr"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            كم
                        </span>
                    </div>
                </div>
            </div>

            {/* Next Button */}
            <div className="pt-4 mt-auto">
                <Button className="w-full h-12 text-base" onClick={onNext}>
                    التالي
                </Button>
            </div>
        </div>
    );
}

export default VehicleDetailsStep;
