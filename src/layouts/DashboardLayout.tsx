import React, { useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TECH_ROLES, getDefaultRouteForRole } from '@/components/auth';
import {
    LayoutDashboard,
    ClipboardList,
    Wrench,
    Users,
    Package,
    Wallet,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Bell,
    Search,
    Menu,
    X,
    Building2,
    Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
    title: string;
    href: string;
    icon: React.ElementType;
    roles?: string[];
    children?: { title: string; href: string }[];
}

const navigation: NavItem[] = [
    {
        title: 'الرئيسية',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'الاستقبال',
        href: '/dashboard/reception',
        icon: ClipboardList,
        children: [
            { title: 'تقارير الدخول', href: '/dashboard/reception' },
            { title: 'استلام جديد', href: '/dashboard/reception/new' },
            { title: 'كشف سريع', href: '/dashboard/quick-check' },
            { title: 'صيانة كنترول', href: '/dashboard/bench-work' },
        ],
    },
    {
        title: 'ساحة العمل',
        href: '/dashboard/workshop',
        icon: Wrench,
        children: [
            { title: 'أوامر الشغل', href: '/dashboard/workshop' },
            { title: 'عرض Kanban', href: '/dashboard/workshop/kanban' },
            { title: 'مراجعة المشرف', href: '/dashboard/workshop/review' },
        ],
    },
    {
        title: 'العملاء والمركبات',
        href: '/dashboard/customers',
        icon: Car,
        children: [
            { title: 'قائمة العملاء', href: '/dashboard/customers' },
            { title: 'المركبات', href: '/dashboard/vehicles' },
        ],
    },
    {
        title: 'الموردين',
        href: '/dashboard/suppliers',
        icon: Building2,
    },
    {
        title: 'المخزون',
        href: '/dashboard/inventory',
        icon: Package,
        roles: ['admin', 'manager', 'warehouse'],
        children: [
            { title: 'المنتجات', href: '/dashboard/inventory/products' },
            { title: 'التصنيفات', href: '/dashboard/inventory/categories' },
            { title: 'المخازن', href: '/dashboard/inventory/warehouses' },
            { title: 'الأرصدة', href: '/dashboard/inventory/stock' },
            { title: 'التحويلات', href: '/dashboard/inventory/transfers' },
            { title: 'الحركات', href: '/dashboard/inventory/movements' },
        ],
    },
    {
        title: 'المالية',
        href: '/dashboard/finance',
        icon: Wallet,
        roles: ['admin', 'manager', 'accountant'],
        children: [
            { title: 'الفواتير', href: '/dashboard/finance/invoices' },
            { title: 'المشتريات', href: '/dashboard/finance/purchases' },
            { title: 'المدفوعات', href: '/dashboard/finance/payments' },
            { title: 'الخزن', href: '/dashboard/finance/treasuries' },
            { title: 'المصروفات', href: '/dashboard/finance/expenses' },
            { title: 'بنود المصروفات', href: '/dashboard/finance/expense-categories' },
        ],
    },
    {
        title: 'الإعدادات',
        href: '/dashboard/settings',
        icon: Settings,
        roles: ['admin', 'manager'],
    },
];


export function DashboardLayout() {
    const { user, profile, signOut, isAuthenticated, loading } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Redirect to login if not authenticated
    if (!loading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Redirect technicians to their dedicated app
    // الفني له تطبيق خاص به ولا يجب أن يصل للـ Dashboard العام
    if (profile && TECH_ROLES.includes(profile.role as any)) {
        const techRoute = getDefaultRouteForRole(profile.role as any);
        return <Navigate to={techRoute} replace />;
    }

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2);
    };

    const isActiveLink = (href: string) => {
        return location.pathname === href || location.pathname.startsWith(href + '/');
    };

    const filterNavByRole = (items: NavItem[]) => {
        if (!profile) return [];
        return items.filter((item) => {
            if (!item.roles) return true;
            return item.roles.includes(profile.role);
        });
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile sidebar overlay */}
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed right-0 top-0 z-50 h-full bg-card border-l border-border transition-all duration-300',
                    sidebarOpen ? 'w-64' : 'w-20',
                    mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
                )}
            >
                {/* Logo */}
                <div className="flex h-16 items-center justify-between px-4 border-b border-border">
                    {sidebarOpen && (
                        <h1 className="text-lg font-bold">مركز الصيانة</h1>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="hidden lg:flex"
                    >
                        {sidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileSidebarOpen(false)}
                        className="lg:hidden"
                    >
                        <X size={20} />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    <ul className="space-y-1">
                        {filterNavByRole(navigation).map((item) => {
                            const hasChildren = item.children && item.children.length > 0;
                            const isActive = isActiveLink(item.href);
                            const isChildActive = hasChildren && item.children?.some(child => isActiveLink(child.href));
                            const isExpanded = isActive || isChildActive;

                            return (
                                <li key={item.href}>
                                    <Link
                                        to={item.href}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                                            (isActive && !isChildActive)
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        )}
                                        onClick={() => setMobileSidebarOpen(false)}
                                    >
                                        <item.icon size={20} />
                                        {sidebarOpen && <span>{item.title}</span>}
                                    </Link>
                                    {/* Sub-items */}
                                    {hasChildren && sidebarOpen && isExpanded && (
                                        <ul className="mr-6 mt-1 space-y-1 border-r-2 border-primary/20 pr-3">
                                            {item.children?.map((child) => (
                                                <li key={child.href}>
                                                    <Link
                                                        to={child.href}
                                                        className={cn(
                                                            'block px-3 py-2 rounded-md text-sm transition-colors',
                                                            isActiveLink(child.href)
                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                                        )}
                                                        onClick={() => setMobileSidebarOpen(false)}
                                                    >
                                                        {child.title}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User section */}
                <div className="border-t border-border p-4">
                    <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
                        <Avatar>
                            <AvatarImage src={profile?.avatar_url || ''} />
                            <AvatarFallback>{getInitials(profile?.full_name || 'U')}</AvatarFallback>
                        </Avatar>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {profile?.role === 'admin' && 'مدير النظام'}
                                    {profile?.role === 'manager' && 'مدير الفرع'}
                                    {profile?.role === 'supervisor' && 'المشرف'}
                                    {profile?.role === 'engineer' && 'مهندس الاستقبال'}
                                    {profile?.role === 'technician' && 'فني'}
                                    {profile?.role === 'warehouse' && 'أمين المخزن'}
                                    {profile?.role === 'accountant' && 'محاسب'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div
                className={cn(
                    'min-h-screen transition-all duration-300',
                    sidebarOpen ? 'lg:mr-64' : 'lg:mr-20'
                )}
            >
                {/* Top header */}
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden"
                    >
                        <Menu size={20} />
                    </Button>

                    {/* Search */}
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="بحث..."
                                className="w-full h-10 pr-10 pl-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        {/* Notifications */}
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell size={20} />
                            <span className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                                3
                            </span>
                        </Button>

                        {/* User menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={profile?.avatar_url || ''} />
                                        <AvatarFallback>{getInitials(profile?.full_name || 'U')}</AvatarFallback>
                                    </Avatar>
                                    <span className="hidden md:inline">{profile?.full_name}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/dashboard/settings/profile">الملف الشخصي</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to="/dashboard/settings">الإعدادات</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={signOut} className="text-destructive">
                                    <LogOut className="ml-2 h-4 w-4" />
                                    تسجيل الخروج
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
