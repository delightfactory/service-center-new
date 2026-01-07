/**
 * DevMaintenanceToggle - Developer-Only Maintenance Mode Toggle
 * 
 * IMPORTANT: This component is ONLY rendered in development mode.
 * It will NEVER appear in production builds.
 * 
 * This check happens at the component level AND at the import level
 * to ensure maximum security.
 */

import { useState } from 'react';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';

/**
 * DEV-ONLY: Floating toggle button for maintenance mode
 * This component checks import.meta.env.DEV to ensure it only renders in development
 */
export function DevMaintenanceToggle() {
    // CRITICAL: Exit immediately if not in development mode
    // This is the PRIMARY security check
    if (!import.meta.env.DEV) {
        return null;
    }

    return <DevMaintenanceToggleInner />;
}

/**
 * Inner component that contains the actual toggle logic
 * Separated to avoid hook rules violation with early return
 */
function DevMaintenanceToggleInner() {
    const { isMaintenanceMode, isLoading, toggleMaintenanceMode } = useMaintenanceMode();
    const [isOpen, setIsOpen] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    const handleToggle = async () => {
        setIsToggling(true);
        await toggleMaintenanceMode(!isMaintenanceMode);
        setIsToggling(false);
    };

    return (
        <>
            {/* Floating Toggle Button - Fixed Position */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    fixed bottom-24 left-4 z-[9999] 
                    w-12 h-12 rounded-full 
                    flex items-center justify-center 
                    shadow-lg transition-all duration-300
                    ${isMaintenanceMode
                        ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
                        : 'bg-slate-700 hover:bg-slate-600 shadow-slate-500/30'
                    }
                `}
                title="Dev: Maintenance Mode Toggle"
            >
                <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>

                {/* Status indicator dot */}
                <span className={`
                    absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900
                    ${isMaintenanceMode ? 'bg-red-500 animate-pulse' : 'bg-green-500'}
                `} />
            </button>

            {/* Control Panel */}
            {isOpen && (
                <div className="fixed bottom-40 left-4 z-[9999] w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 border-b border-slate-600">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-amber-500 text-lg">⚙️</span>
                                <span className="text-white font-semibold text-sm">DEV TOOLS</span>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-mono">
                                DEV ONLY
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <h3 className="text-white font-medium mb-2">Maintenance Mode</h3>
                        <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                            Toggle maintenance mode to show the payment suspension page to all visitors.
                            This setting is stored in the database.
                        </p>

                        {/* Status */}
                        <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3 mb-4">
                            <span className="text-slate-300 text-sm">Current Status:</span>
                            <span className={`
                                px-3 py-1 rounded-full text-xs font-medium
                                ${isMaintenanceMode
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-green-500/20 text-green-400'
                                }
                            `}>
                                {isLoading ? 'Loading...' : isMaintenanceMode ? 'SUSPENDED' : 'ACTIVE'}
                            </span>
                        </div>

                        {/* Toggle Button */}
                        <button
                            onClick={handleToggle}
                            disabled={isLoading || isToggling}
                            className={`
                                w-full py-3 rounded-xl font-medium text-sm transition-all duration-300
                                flex items-center justify-center gap-2
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${isMaintenanceMode
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-red-600 hover:bg-red-500 text-white'
                                }
                            `}
                        >
                            {isToggling ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Processing...</span>
                                </>
                            ) : isMaintenanceMode ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Restore Service</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                    <span>Suspend Service</span>
                                </>
                            )}
                        </button>

                        {/* Warning */}
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                            <p className="text-amber-400 text-xs leading-relaxed">
                                ⚠️ This panel is only visible in development mode.
                                It will not appear in production builds.
                            </p>
                        </div>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </>
    );
}

export default DevMaintenanceToggle;
