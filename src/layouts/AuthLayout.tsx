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
                    <div className="w-24 h-24 mx-auto bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <svg
                            className="w-16 h-16 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                            />
                        </svg>
                    </div>

                    <div>
                        <h1 className="text-4xl font-bold mb-4">نظام إدارة مركز الصيانة</h1>
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
