import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

export function LoginPage() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error, profile } = await signIn(email, password);
            if (error) {
                setError('بيانات الدخول غير صحيحة');
            } else {
                // توجيه حسب دور المستخدم
                if (profile?.role === 'technician') {
                    navigate('/tech');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (err) {
            setError('حدث خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            {/* Mobile logo */}
            <div className="mb-8 text-center lg:hidden">
                <div className="w-20 h-20 mx-auto mb-4">
                    <img src="/icons/android-chrome-192x192.webp" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-2xl font-bold">مركز أبو زياد</h1>
            </div>

            <Card className="border-0 shadow-none lg:border lg:shadow-sm">
                <CardHeader className="space-y-1 text-center lg:text-right">
                    <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
                    <CardDescription>
                        أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Error message */}
                        {error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="example@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={<Mail size={18} />}
                                iconPosition="start"
                                required
                                autoComplete="email"
                                dir="ltr"
                                className="text-left"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">كلمة المرور</Label>
                                <Link
                                    to="/forgot-password"
                                    className="text-sm text-primary hover:underline"
                                >
                                    نسيت كلمة المرور؟
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    icon={<Lock size={18} />}
                                    iconPosition="start"
                                    required
                                    autoComplete="current-password"
                                    dir="ltr"
                                    className="text-left pl-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit button */}
                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            loading={loading}
                            disabled={loading}
                        >
                            تسجيل الدخول
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">أو</span>
                        </div>
                    </div>

                    {/* Demo accounts */}
                    <div className="space-y-2 text-center">
                        <p className="text-sm text-muted-foreground">حسابات تجريبية:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setEmail('admin@demo.com');
                                    setPassword('demo123');
                                }}
                                className="p-2 border rounded-lg hover:bg-accent transition-colors"
                            >
                                <span className="font-medium">مدير النظام</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEmail('technician@demo.com');
                                    setPassword('demo123');
                                }}
                                className="p-2 border rounded-lg hover:bg-accent transition-colors"
                            >
                                <span className="font-medium">فني</span>
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
