import { usePWA } from '@/hooks/usePWA';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function PWAUpdatePrompt() {
    const { updateAvailable, applyUpdate, dismissUpdate } = usePWA();
    const [isVisible, setIsVisible] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (updateAvailable) {
            // Small delay for smooth animation
            const timer = setTimeout(() => setIsVisible(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [updateAvailable]);

    const handleUpdate = () => {
        setIsUpdating(true);
        applyUpdate();
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(dismissUpdate, 300);
    };

    if (!updateAvailable) return null;

    return (
        <div
            className={`
        fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50
        bg-gradient-to-r from-blue-600 to-blue-700 
        text-white rounded-xl shadow-2xl 
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
            role="alert"
            aria-live="polite"
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
                        <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base">
                            تحديث جديد متاح
                        </h3>
                        <p className="text-sm text-blue-100 mt-1">
                            يتوفر إصدار جديد من التطبيق. قم بالتحديث للحصول على أحدث الميزات والتحسينات.
                        </p>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
                        aria-label="إغلاق"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="
              flex-1 px-4 py-2.5 rounded-lg font-medium
              bg-white text-blue-700 
              hover:bg-blue-50 
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              flex items-center justify-center gap-2
            "
                    >
                        {isUpdating ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                جاري التحديث...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                تحديث الآن
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="
              px-4 py-2.5 rounded-lg font-medium
              bg-white/10 hover:bg-white/20
              transition-colors
            "
                    >
                        لاحقاً
                    </button>
                </div>
            </div>
        </div>
    );
}
