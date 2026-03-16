/**
 * useMaintenanceMode Hook - Service Center
 * 
 * A hook for accessing and controlling maintenance mode state from the database.
 * Used to suspend service when payment obligations are not met.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

// Default maintenance mode is OFF
const DEFAULT_MAINTENANCE_MODE = false;

interface SettingsRow {
    key: string;
    value: string;
}

/**
 * Parse a JSON value from the settings table
 */
function parseSettingValue(value: string): boolean {
    try {
        return JSON.parse(value);
    } catch {
        return value === 'true';
    }
}

/**
 * Hook to get maintenance mode status and toggle function
 * Used for payment suspension feature
 */
export function useMaintenanceMode() {
    const queryClient = useQueryClient();

    const { data: isMaintenanceMode, isLoading, refetch } = useQuery({
        queryKey: ['maintenance-mode'],
        queryFn: async (): Promise<boolean> => {
            const { data, error } = await supabase
                .from('settings')
                .select('key, value')
                .eq('key', 'maintenance_mode')
                .single();

            if (error) {
                console.log('[Maintenance] Read error or no data:', error.message);
                return DEFAULT_MAINTENANCE_MODE;
            }

            const value = parseSettingValue((data as SettingsRow).value);
            console.log('[Maintenance] Current mode:', value);
            return value;
        },
        // لا نعيد المحاولة - إذا فشل الطلب نستخدم القيمة الافتراضية (false)
        // إعادة المحاولة مع توكن منتهي تسبب تعليق التطبيق
        retry: false,
        staleTime: 1000 * 30, // 30 seconds — no need to check every 5s
        gcTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: true,
        // Provide immediate default so loading is never blocking
        placeholderData: DEFAULT_MAINTENANCE_MODE,
    });

    const toggleMaintenanceMode = async (enabled: boolean) => {
        console.log('[Maintenance] Attempting to set mode to:', enabled);

        try {
            // Use upsert to ensure the value is set regardless of whether row exists
            const { data, error } = await supabase
                .from('settings')
                .upsert(
                    {
                        key: 'maintenance_mode',
                        value: JSON.stringify(enabled),
                        description: 'Enable/disable maintenance mode for payment suspension'
                    },
                    {
                        onConflict: 'key',
                        ignoreDuplicates: false
                    }
                )
                .select();

            if (error) {
                console.error('[Maintenance] Upsert failed:', error.message, error.details, error.hint);
                return false;
            }

            console.log('[Maintenance] Upsert result:', data);
            console.log('[Maintenance] Successfully set mode to:', enabled);

            // Clear the cache and force immediate refetch
            queryClient.setQueryData(['maintenance-mode'], enabled);

            // Also refetch to confirm
            setTimeout(() => refetch(), 500);

            return true;
        } catch (error) {
            console.error('[Maintenance] Failed to toggle maintenance mode:', error);
            return false;
        }
    };

    return {
        isMaintenanceMode: isMaintenanceMode ?? DEFAULT_MAINTENANCE_MODE,
        isLoading,
        toggleMaintenanceMode,
    };
}

export default useMaintenanceMode;
