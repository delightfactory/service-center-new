import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    User, Mail, Phone, Building, Calendar, Shield, Save, Key, Eye, EyeOff
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';

// ============================================================
// Profile Page - صفحة الملف الشخصي
// ============================================================

const roleLabels: Record<string, string> = {
    admin: 'مدير النظام',
    manager: 'مدير فرع',
    accountant: 'محاسب',
    receptionist: 'موظف استقبال',
    technician: 'فني',
    warehouse_keeper: 'أمين مخزن',
};

export function ProfilePage() {
    const { user, profile, refreshProfile } = useAuth();
    const queryClient = useQueryClient();
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);

    // Form state
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);

    // Initialize form with profile data
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPhone(profile.phone || '');
        }
    }, [profile]);

    // Update profile mutation
    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            if (!fullName.trim()) throw new Error('يرجى إدخال الاسم الكامل');
            if (!user?.id) throw new Error('يرجى تسجيل الدخول');

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim(),
                    phone: phone.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;
        },
        onSuccess: () => {
            refreshProfile?.();
            setIsEditing(false);
            alert('تم تحديث الملف الشخصي بنجاح');
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل تحديث الملف الشخصي');
        },
    });

    // Change password mutation
    const changePasswordMutation = useMutation({
        mutationFn: async () => {
            if (!newPassword) throw new Error('يرجى إدخال كلمة المرور الجديدة');
            if (newPassword.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            if (newPassword !== confirmPassword) throw new Error('كلمات المرور غير متطابقة');

            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;
        },
        onSuccess: () => {
            setShowPasswordDialog(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            alert('تم تغيير كلمة المرور بنجاح');
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل تغيير كلمة المرور');
        },
    });

    // Cancel editing
    const cancelEditing = () => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPhone(profile.phone || '');
        }
        setIsEditing(false);
    };

    if (!user || !profile) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <User className="text-primary" />
                        الملف الشخصي
                    </h1>
                    <p className="text-muted-foreground">
                        إدارة معلومات الحساب
                    </p>
                </div>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={cancelEditing}>
                                إلغاء
                            </Button>
                            <Button
                                onClick={() => updateProfileMutation.mutate()}
                                disabled={updateProfileMutation.isPending}
                            >
                                <Save size={16} className="ml-2" />
                                {updateProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            تعديل البيانات
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User size={20} />
                            المعلومات الشخصية
                        </CardTitle>
                        <CardDescription>بياناتك الأساسية في النظام</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Avatar */}
                        <div className="flex items-center gap-4 pb-4 border-b">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <User size={32} className="text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-lg">{profile.full_name}</p>
                                <Badge variant="secondary">
                                    {roleLabels[profile.role] || profile.role}
                                </Badge>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>الاسم الكامل</Label>
                                {isEditing ? (
                                    <Input
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="الاسم الكامل"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                        <User size={16} className="text-muted-foreground" />
                                        <span>{profile.full_name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>البريد الإلكتروني</Label>
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                    <Mail size={16} className="text-muted-foreground" />
                                    <span dir="ltr">{profile.email}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>رقم الهاتف</Label>
                                {isEditing ? (
                                    <Input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="رقم الهاتف"
                                        dir="ltr"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                        <Phone size={16} className="text-muted-foreground" />
                                        <span dir="ltr">{profile.phone || '-'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield size={20} />
                            معلومات الحساب
                        </CardTitle>
                        <CardDescription>إعدادات الأمان والصلاحيات</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>الصلاحية</Label>
                            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                <Shield size={16} className="text-muted-foreground" />
                                <Badge>{roleLabels[profile.role] || profile.role}</Badge>
                            </div>
                        </div>

                        {profile.branch_id && (
                            <div className="space-y-2">
                                <Label>الفرع</Label>
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                    <Building size={16} className="text-muted-foreground" />
                                    <span>{profile.branch_id}</span>
                                </div>
                            </div>
                        )}

                        {profile.specialization && (
                            <div className="space-y-2">
                                <Label>التخصص</Label>
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                    <span>{profile.specialization}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>تاريخ التسجيل</Label>
                            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                <Calendar size={16} className="text-muted-foreground" />
                                <span>{formatDate(profile.created_at)}</span>
                            </div>
                        </div>

                        {/* Change Password Button */}
                        <div className="pt-4 border-t">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setShowPasswordDialog(true)}
                            >
                                <Key size={16} className="ml-2" />
                                تغيير كلمة المرور
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Change Password Dialog */}
            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تغيير كلمة المرور</DialogTitle>
                        <DialogDescription>
                            أدخل كلمة المرور الجديدة
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>كلمة المرور الجديدة</Label>
                            <div className="relative">
                                <Input
                                    type={showPasswords ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="كلمة المرور الجديدة"
                                    dir="ltr"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                >
                                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>تأكيد كلمة المرور</Label>
                            <Input
                                type={showPasswords ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="تأكيد كلمة المرور"
                                dir="ltr"
                            />
                        </div>
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-sm text-red-500">كلمات المرور غير متطابقة</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => changePasswordMutation.mutate()}
                            disabled={changePasswordMutation.isPending || newPassword !== confirmPassword}
                        >
                            {changePasswordMutation.isPending ? 'جاري التغيير...' : 'تغيير'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ProfilePage;
