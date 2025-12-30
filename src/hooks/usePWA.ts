import { useState, useEffect, useCallback } from 'react';

interface PWAState {
    isOnline: boolean;
    updateAvailable: boolean;
    isInstalled: boolean;
    canInstall: boolean;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWA() {
    const [state, setState] = useState<PWAState>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        updateAvailable: false,
        isInstalled: false,
        canInstall: false,
    });

    // Check if app is installed
    useEffect(() => {
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;

        setState(prev => ({ ...prev, isInstalled: isStandalone }));
    }, []);

    // Handle online/offline status
    useEffect(() => {
        const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
        const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Handle service worker updates
    useEffect(() => {
        const handleSWUpdated = () => {
            console.log('[usePWA] Service worker update available');
            setState(prev => ({ ...prev, updateAvailable: true }));
        };

        window.addEventListener('swUpdated', handleSWUpdated);

        return () => {
            window.removeEventListener('swUpdated', handleSWUpdated);
        };
    }, []);

    // Handle install prompt
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            deferredPrompt = e as BeforeInstallPromptEvent;
            setState(prev => ({ ...prev, canInstall: true }));
        };

        const handleAppInstalled = () => {
            deferredPrompt = null;
            setState(prev => ({ ...prev, canInstall: false, isInstalled: true }));
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Apply update - triggers page reload
    const applyUpdate = useCallback(() => {
        if (typeof window !== 'undefined' && 'skipWaiting' in window) {
            (window as unknown as { skipWaiting: () => void }).skipWaiting();
            // The page will reload automatically when the new SW takes control
        }
    }, []);

    // Dismiss update notification
    const dismissUpdate = useCallback(() => {
        setState(prev => ({ ...prev, updateAvailable: false }));
    }, []);

    // Prompt to install PWA
    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) return false;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setState(prev => ({ ...prev, canInstall: false }));
            }

            deferredPrompt = null;
            return outcome === 'accepted';
        } catch (error) {
            console.error('[usePWA] Install prompt error:', error);
            return false;
        }
    }, []);

    // Force check for updates
    const checkForUpdates = useCallback(async () => {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    console.log('[usePWA] Manual update check completed');
                }
            } catch (error) {
                console.error('[usePWA] Update check failed:', error);
            }
        }
    }, []);

    return {
        ...state,
        applyUpdate,
        dismissUpdate,
        promptInstall,
        checkForUpdates,
    };
}
