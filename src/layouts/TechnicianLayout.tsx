import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    Home,
    ListTodo,
    User,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsPopover } from '@/components/shared/NotificationsPopover';

export function TechnicianLayout() {
    const { user, profile, signOut, isAuthenticated, loading } = useAuth();
    const location = useLocation();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingActions, setPendingActions] = useState(0);

    // Check if user is a technician
    const isTechnician = profile?.role === 'technician';

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Redirect non-technicians
    if (!loading && isAuthenticated && !isTechnician) {
        return <Navigate to="/dashboard" replace />;
    }

    // Redirect to login if not authenticated
    if (!loading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const navItems = [
        { icon: Home, label: 'الرئيسية', href: '/technician' },
        { icon: ListTodo, label: 'المهام', href: '/technician/tasks' },
        { icon: User, label: 'حسابي', href: '/technician/profile' },
    ];

    const isActive = (href: string) => {
        if (href === '/technician') return location.pathname === href;
        return location.pathname.startsWith(href);
    };

    const getInitials = (name: string) =>
        name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Offline banner */}
            {!isOnline && (
                <div className="bg-warning text-warning-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
                    <WifiOff size={16} />
                    <span>غير متصل بالإنترنت</span>
                    {pendingActions > 0 && (
                        <span className="bg-warning-foreground/20 px-2 py-0.5 rounded-full text-xs">
                            {pendingActions} إجراءات معلقة
                        </span>
                    )}
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-30 bg-card border-b border-border safe-area-inset-top">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={profile?.avatar_url || ''} />
                            <AvatarFallback className="text-sm">
                                {getInitials(profile?.full_name || 'T')}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-medium">{profile?.full_name}</p>
                            <p className="text-xs text-muted-foreground">فني</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <NotificationsPopover />
                        {/* Connection status */}
                        <div
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                isOnline ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                            )}
                        >
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span>{isOnline ? 'متصل' : 'غير متصل'}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 pb-20">
                <Outlet />
            </main>

            {/* Bottom navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom z-30">
                <div className="flex items-center justify-around py-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                'flex flex-col items-center gap-1 px-4 py-2 min-w-[64px] transition-colors relative',
                                isActive(item.href)
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            )}
                        >
                            <div className="relative">
                                <item.icon size={24} />
                            </div>
                            <span className="text-xs">{item.label}</span>
                            {isActive(item.href) && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                            )}
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
