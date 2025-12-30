import React from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Home, User, LogOut, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

// ============================================================
// Technician Layout - Professional Mobile-First Design
// ============================================================

export function TechLayout() {
    const { profile, signOut, isAuthenticated, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Protect route
    if (!loading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Redirect non-technicians
    if (!loading && profile && profile.role !== 'technician') {
        return <Navigate to="/dashboard" replace />;
    }

    const navItems = [
        { path: '/tech', label: 'مهامي', icon: Home },
        { path: '/tech/profile', label: 'حسابي', icon: User },
    ];

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col" dir="rtl">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                            <span className="text-lg font-bold text-primary-foreground">
                                {profile?.full_name?.charAt(0) || 'ف'}
                            </span>
                        </div>
                        <div>
                            <p className="font-semibold">{profile?.full_name || 'الفني'}</p>
                            <p className="text-xs text-muted-foreground">فني صيانة</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <LogOut size={20} />
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-24">
                <Outlet />
            </main>

            {/* Bottom Navigation - iOS Style */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t shadow-lg">
                <div className="flex items-center justify-around py-2 pb-safe">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    'flex flex-col items-center gap-1 px-8 py-3 rounded-2xl transition-all duration-200',
                                    isActive
                                        ? 'text-primary bg-primary/10 scale-105'
                                        : 'text-muted-foreground hover:text-foreground active:scale-95'
                                )}
                            >
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                <span className={cn(
                                    'text-xs font-medium',
                                    isActive && 'font-semibold'
                                )}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}

export default TechLayout;
