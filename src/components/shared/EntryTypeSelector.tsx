import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Settings, Zap, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENTRY_TYPES, type EntryType } from '@/types/enums';

// ============================================================
// Entry Type Selector Component
// ============================================================
// Displays 3 entry type options vertically, optimized for mobile
// - سيارة كاملة (vehicle) - continues wizard
// - كنترول/قطعة (bench_work) - redirects to dedicated page
// - كشف سريع (quick_check) - redirects to dedicated page
// ============================================================

interface EntryTypeSelectorProps {
    value: EntryType | null;
    onChange: (type: EntryType) => void;
    className?: string;
}

interface EntryTypeOption {
    value: EntryType;
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    redirectTo?: string; // Optional redirect URL
}

const entryTypeOptions: EntryTypeOption[] = [
    {
        value: 'vehicle',
        label: 'سيارة كاملة',
        description: 'استلام سيارة للصيانة أو الإصلاح',
        icon: Car,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
        value: 'bench_work',
        label: 'كنترول / قطعة',
        description: 'استلام جهاز أو قطعة بدون سيارة',
        icon: Settings,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        redirectTo: '/dashboard/bench-work',
    },
    {
        value: 'quick_check',
        label: 'كشف سريع',
        description: 'فحص وتشخيص سريع بدون أمر شغل',
        icon: Zap,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        redirectTo: '/dashboard/quick-check',
    },
];

export function EntryTypeSelector({
    value,
    onChange,
    className,
}: EntryTypeSelectorProps) {
    const navigate = useNavigate();

    const handleSelect = (option: EntryTypeOption) => {
        if (option.redirectTo) {
            // Redirect to dedicated page
            navigate(option.redirectTo);
        } else {
            // Continue with wizard
            onChange(option.value);
        }
    };

    return (
        <div className={cn("flex flex-col gap-4 p-4", className)}>
            {/* Header */}
            <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-foreground">اختر نوع الاستلام</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    حدد نوع الخدمة المطلوبة
                </p>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-3">
                {entryTypeOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value === option.value;
                    const hasRedirect = !!option.redirectTo;

                    return (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option)}
                            className={cn(
                                "w-full p-4 rounded-2xl border-2 transition-all duration-300",
                                "flex items-center gap-4",
                                "hover:scale-[1.02] active:scale-[0.98]",
                                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                isSelected
                                    ? "border-primary bg-primary/10 shadow-lg"
                                    : "border-border bg-card hover:border-primary/50 hover:shadow-md"
                            )}
                        >
                            {/* Icon */}
                            <div
                                className={cn(
                                    "w-16 h-16 rounded-xl flex items-center justify-center",
                                    "transition-all duration-300",
                                    isSelected ? "bg-primary text-primary-foreground" : option.bgColor
                                )}
                            >
                                <Icon
                                    size={32}
                                    className={cn(
                                        "transition-colors duration-300",
                                        isSelected ? "text-primary-foreground" : option.color
                                    )}
                                />
                            </div>

                            {/* Text */}
                            <div className="flex-1 text-right">
                                <h3
                                    className={cn(
                                        "text-lg font-bold transition-colors duration-300",
                                        isSelected ? "text-primary" : "text-foreground"
                                    )}
                                >
                                    {option.label}
                                    {hasRedirect && (
                                        <ExternalLink size={14} className="inline-block mr-2 opacity-50" />
                                    )}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {option.description}
                                </p>
                            </div>

                            {/* Selection Indicator */}
                            <div
                                className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                    "transition-all duration-300",
                                    isSelected
                                        ? "border-primary bg-primary"
                                        : "border-muted-foreground/30"
                                )}
                            >
                                {isSelected && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Helper Text */}
            <p className="text-xs text-muted-foreground text-center mt-2">
                اضغط على الخيار للمتابعة
            </p>
        </div>
    );
}

export default EntryTypeSelector;

