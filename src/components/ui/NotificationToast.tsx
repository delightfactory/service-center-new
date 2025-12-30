import React from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotification, NotificationType } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================
// Notification Toast Component - عرض الإشعارات
// ============================================================

const icons: Record<NotificationType, React.ElementType> = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const styles: Record<NotificationType, { bg: string; border: string; icon: string }> = {
    success: {
        bg: 'bg-success/10',
        border: 'border-success/30',
        icon: 'text-success',
    },
    error: {
        bg: 'bg-destructive/10',
        border: 'border-destructive/30',
        icon: 'text-destructive',
    },
    warning: {
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        icon: 'text-warning',
    },
    info: {
        bg: 'bg-primary/10',
        border: 'border-primary/30',
        icon: 'text-primary',
    },
};

export function NotificationToast() {
    const { notifications, removeNotification } = useNotification();

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 space-y-2">
            {notifications.map((notification) => {
                const Icon = icons[notification.type];
                const style = styles[notification.type];

                return (
                    <div
                        key={notification.id}
                        className={cn(
                            'p-4 rounded-lg border shadow-lg backdrop-blur-sm',
                            'animate-in slide-in-from-right-5 fade-in-0 duration-300',
                            style.bg,
                            style.border
                        )}
                        role="alert"
                    >
                        <div className="flex items-start gap-3">
                            <Icon className={cn('shrink-0 mt-0.5', style.icon)} size={20} />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">
                                    {notification.title}
                                </p>
                                {notification.message && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {notification.message}
                                    </p>
                                )}
                                {notification.action && (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 mt-2"
                                        onClick={notification.action.onClick}
                                    >
                                        {notification.action.label}
                                    </Button>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => removeNotification(notification.id)}
                            >
                                <X size={14} />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default NotificationToast;
