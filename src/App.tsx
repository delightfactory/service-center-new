import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { PWAUpdatePrompt } from '@/components/common/PWAUpdatePrompt';
import { AppRouter } from '@/router';
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <NotificationProvider>
                    <AppRouter />
                    <NotificationToast />
                    <PWAUpdatePrompt />
                </NotificationProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;

