import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// ActionButtons - أزرار إجراءات أنيقة ومتجاوبة
// ============================================================

export interface ActionButtonConfig {
    key: string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: "default" | "success" | "warning" | "danger" | "info" | "ghost";
    disabled?: boolean;
    loading?: boolean;
    show?: boolean;
}

interface ActionButtonsProps {
    actions: ActionButtonConfig[];
    size?: "sm" | "md";
    className?: string;
}

const variantStyles = {
    default: "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300",
    success: "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400",
    warning: "bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400",
    danger: "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400",
    info: "bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400",
    ghost: "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-400",
};

const sizeStyles = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
};

export function ActionButtons({ actions, size = "sm", className }: ActionButtonsProps) {
    const visibleActions = actions.filter((action) => action.show !== false);

    if (visibleActions.length === 0) return null;

    return (
        <TooltipProvider delayDuration={300}>
            <div className={cn("flex items-center gap-1", className)}>
                {visibleActions.map((action) => {
                    const buttonContent = (
                        <button
                            type="button"
                            onClick={action.onClick}
                            disabled={action.disabled || action.loading}
                            className={cn(
                                "inline-flex items-center justify-center rounded-lg transition-all duration-200",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "active:scale-95",
                                sizeStyles[size],
                                variantStyles[action.variant || "default"],
                                action.loading && "animate-pulse"
                            )}
                        >
                            {action.icon}
                        </button>
                    );

                    const wrappedButton = action.href ? (
                        <Link to={action.href} key={action.key}>
                            {buttonContent}
                        </Link>
                    ) : (
                        <React.Fragment key={action.key}>{buttonContent}</React.Fragment>
                    );

                    return (
                        <Tooltip key={action.key}>
                            <TooltipTrigger asChild>
                                {action.href ? (
                                    <Link to={action.href}>
                                        {buttonContent}
                                    </Link>
                                ) : (
                                    buttonContent
                                )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                                {action.label}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}

// ============================================================
// StatusActionButton - زر تغيير الحالة مع تأثير جميل
// ============================================================

interface StatusActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: "success" | "danger" | "warning" | "info";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    disabled?: boolean;
    className?: string;
}

export function StatusActionButton({
    icon,
    label,
    onClick,
    variant = "success",
    size = "sm",
    loading,
    disabled,
    className,
}: StatusActionButtonProps) {
    const variantClasses = {
        success: "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-emerald-200",
        danger: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-red-200",
        warning: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200",
        info: "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-blue-200",
    };

    const sizeClasses = {
        sm: "h-8 px-3 text-xs gap-1.5",
        md: "h-9 px-4 text-sm gap-2",
        lg: "h-10 px-5 text-sm gap-2",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className={cn(
                "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
                "shadow-sm hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
                "active:scale-[0.98]",
                variantClasses[variant],
                sizeClasses[size],
                loading && "animate-pulse",
                className
            )}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

export default ActionButtons;
