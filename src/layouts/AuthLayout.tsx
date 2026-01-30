import React from 'react';
import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function AuthLayout() {
    const { isAuthenticated, loading } = useAuth();

    // Redirect to dashboard if already authenticated
    if (!loading && isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Left side - Form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md">
                    <Outlet />
                </div>
            </div>

            {/* Right side - Branding */}
            <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
                <div className="text-center text-white space-y-6 max-w-lg">
                    {/* Logo */}
                    <div className="w-28 h-28 mx-auto mb-6">
                        <img src="/icons/android-chrome-192x192.webp" alt="Logo" className="w-full h-full object-contain" />
                    </div>

                    <div>
                        <h1 className="text-4xl font-bold mb-4">مركز أبو زياد لصيانة السيارات</h1>
                        <p className="text-xl text-white/80">
                            نظام متكامل لإدارة مراكز صيانة السيارات
                        </p>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-4 text-right mt-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <h3 className="font-semibold mb-1">إدارة أوامر الشغل</h3>
                            <p className="text-sm text-white/70">تتبع كامل لحالة الإصلاح</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <h3 className="font-semibold mb-1">إدارة المخزون</h3>
                            <p className="text-sm text-white/70">قطع الغيار والمستهلكات</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <h3 className="font-semibold mb-1">الفوترة والمالية</h3>
                            <p className="text-sm text-white/70">فواتير ومدفوعات</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <h3 className="font-semibold mb-1">تطبيق الفنيين</h3>
                            <p className="text-sm text-white/70">واجهة موبايل سهلة</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
