import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/utils/query-client';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { PWAUpdatePrompt } from '@/components/common/PWAUpdatePrompt';
import { MaintenanceScreen } from '@/components/common/MaintenanceScreen';
import { DevMaintenanceToggle } from '@/components/common/DevMaintenanceToggle';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { AppRouter } from '@/router';
import './index.css';

// Inner app component that uses hooks
function AppContent() {
    const { isMaintenanceMode, isLoading } = useMaintenanceMode();

    // Show maintenance screen if enabled (from database)
    // Skip during initial loading to prevent flash
    if (!isLoading && isMaintenanceMode) {
        return (
            <>
                <MaintenanceScreen />
                {/* Dev toggle still available to disable maintenance mode */}
                <DevMaintenanceToggle />
            </>
        );
    }

    return (
        <>
            <AppRouter />
            <NotificationToast />
            <PWAUpdatePrompt />
            {/* Dev-only toggle for maintenance mode - NEVER appears in production */}
            <DevMaintenanceToggle />
        </>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <NotificationProvider>
                    <AppContent />
                </NotificationProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;

