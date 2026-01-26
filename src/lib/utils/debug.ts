// ============================================================
// Debug Logging Helpers
// ============================================================

export function isDebugLogsEnabled(): boolean {
    if (import.meta.env.DEV) return true;
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem('debug_logs') === '1';
    } catch {
        return false;
    }
}

export function debugLog(...args: unknown[]) {
    if (!isDebugLogsEnabled()) return;
    console.log('[Debug]', ...args);
}

export function debugWarn(...args: unknown[]) {
    if (!isDebugLogsEnabled()) return;
    console.warn('[Debug]', ...args);
}

export function debugError(...args: unknown[]) {
    if (!isDebugLogsEnabled()) return;
    console.error('[Debug]', ...args);
}
