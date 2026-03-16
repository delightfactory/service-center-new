// ============================================================
// Tab Visibility Handler
// ============================================================
//
// Previously contained a workaround that forced page reload
// when returning to the app tab after inactivity.
//
// ROOT CAUSE FIXED: The infinite loading was caused by a
// getSession() deadlock in onAuthStateChange callback.
// See AuthContext.tsx for the fix (setTimeout wrapper).
//
// This handler is no longer needed.
// ============================================================

export { };
