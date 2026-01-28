// ============================================================
// Tab Visibility Handler
// Reloads page when returning from hidden tab to fix stuck queries
// ============================================================

const MIN_HIDE_DURATION = 3000; // 3 seconds
let lastHideTime = 0;

if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            lastHideTime = Date.now();
        } else if (document.visibilityState === 'visible') {
            const hideDuration = Date.now() - lastHideTime;
            if (hideDuration >= MIN_HIDE_DURATION) {
                // Reload the page to fix stuck Supabase queries
                window.location.reload();
            }
        }
    });
}

export { };
