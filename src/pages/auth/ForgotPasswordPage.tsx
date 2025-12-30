import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

// ============================================================
// Forgot Password Page - استعادة كلمة المرور
// ============================================================

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;
            setIsSuccess(true);
        } catch (err: any) {
            setError(err.message || 'فشل إرسال رابط الاستعادة');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-success" />
                            </div>
                            <h2 className="text-xl font-bold">تم إرسال الرابط</h2>
                            <p className="text-muted-foreground">
                                تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.
                                يرجى التحقق من صندوق الوارد.
                            </p>
                            <Button asChild variant="outline" className="mt-4">
                                <Link to="/login">
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                    العودة لتسجيل الدخول
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">استعادة كلمة المرور</CardTitle>
                    <CardDescription>
                        أدخل بريدك الإلكتروني وسنرسل لك رابط لإعادة تعيين كلمة المرور
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                dir="ltr"
                                className="text-left"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading || !email}
                        >
                            {isLoading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
                        </Button>

                        <div className="text-center">
                            <Link
                                to="/login"
                                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                            >
                                <ArrowRight className="w-4 h-4" />
                                العودة لتسجيل الدخول
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default ForgotPasswordPage;
