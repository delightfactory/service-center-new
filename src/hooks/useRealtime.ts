import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// Realtime Subscription Hook
// ============================================================

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
    table: string;
    schema?: string;
    event?: ChangeEvent;
    filter?: string;
    queryKey: (string | undefined)[];
    onInsert?: (record: Record<string, any>) => void;
    onUpdate?: (record: Record<string, any>) => void;
    onDelete?: (record: Record<string, any>) => void;
    enabled?: boolean;
}

/**
 * Hook for subscribing to realtime changes on a Supabase table
 * Automatically invalidates React Query cache on changes
 */
export function useRealtime({
    table,
    schema = 'public',
    event = '*',
    filter,
    queryKey,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
}: UseRealtimeOptions) {
    const queryClient = useQueryClient();
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!enabled) return;

        // Create channel with unique name
        const channelName = `realtime:${table}:${filter || 'all'}:${Date.now()}`;

        const channel = supabase.channel(channelName);

        // Subscribe to postgres changes
        channel
            .on(
                'postgres_changes' as any,
                {
                    event,
                    schema,
                    table,
                    ...(filter ? { filter } : {}),
                },
                (payload: any) => {
                    console.log(`[Realtime] ${table}:`, payload.eventType, payload);

                    // Invalidate query cache - filter out undefined values
                    const filteredQueryKey = queryKey.filter((k): k is string => k !== undefined);
                    queryClient.invalidateQueries({ queryKey: filteredQueryKey });

                    // Call specific handlers
                    switch (payload.eventType) {
                        case 'INSERT':
                            onInsert?.(payload.new);
                            break;
                        case 'UPDATE':
                            onUpdate?.(payload.new);
                            break;
                        case 'DELETE':
                            onDelete?.(payload.old);
                            break;
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[Realtime] Subscribed to ${table}`);
                }
            });

        channelRef.current = channel;

        // Cleanup on unmount
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [table, schema, event, filter, enabled, JSON.stringify(queryKey)]);

    return channelRef.current;
}

// ============================================================
// Specialized hooks for common use cases
// ============================================================

/**
 * Hook for technicians to receive realtime updates on their tasks
 */
export function useTechnicianRealtime(technicianId: string, jobOrderId?: string) {
    // Subscribe to job_tasks changes
    useRealtime({
        table: 'job_tasks',
        filter: technicianId ? `technician_id=eq.${technicianId}` : undefined,
        queryKey: ['technician-tasks', technicianId],
        enabled: !!technicianId,
    });

    // Subscribe to job_time_logs changes
    useRealtime({
        table: 'job_time_logs',
        filter: technicianId ? `technician_id=eq.${technicianId}` : undefined,
        queryKey: ['technician-time-logs', technicianId],
        enabled: !!technicianId,
    });

    // Subscribe to specific job order if provided
    useRealtime({
        table: 'job_orders',
        filter: jobOrderId ? `id=eq.${jobOrderId}` : undefined,
        queryKey: ['job-order', jobOrderId],
        enabled: !!jobOrderId,
    });
}

/**
 * Hook for workshop managers to receive realtime updates
 */
export function useWorkshopRealtime() {
    // Subscribe to job_orders changes
    useRealtime({
        table: 'job_orders',
        queryKey: ['job-orders'],
    });

    // Subscribe to assessments changes
    useRealtime({
        table: 'assessments',
        queryKey: ['assessments'],
    });
}

/**
 * Hook for inventory updates
 */
export function useInventoryRealtime(warehouseId?: string) {
    useRealtime({
        table: 'inventory_items',
        filter: warehouseId ? `warehouse_id=eq.${warehouseId}` : undefined,
        queryKey: ['inventory-items', warehouseId],
    });

    useRealtime({
        table: 'inventory_transactions',
        filter: warehouseId ? `warehouse_id=eq.${warehouseId}` : undefined,
        queryKey: ['inventory-transactions', warehouseId],
    });
}

/**
 * Hook for finance updates
 */
export function useFinanceRealtime() {
    useRealtime({
        table: 'invoices',
        queryKey: ['invoices'],
    });

    useRealtime({
        table: 'payments',
        queryKey: ['payments'],
    });
}

export default useRealtime;
