import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService, type CreateCustomerDTO } from '@/lib/services/crm/customer.service';
import { useAuth } from '@/contexts/AuthContext';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, Save, User, Building2 } from 'lucide-react';
import type { CustomerType } from '@/types/enums';

export function NewCustomerPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { profile } = useAuth();

    const [formData, setFormData] = useState<Partial<CreateCustomerDTO>>({
        customer_type: 'individual',
        name: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        notes: '',
        branch_id: profile?.branch_id || null,  // Use null instead of empty string
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: CreateCustomerDTO) => customerService.create(data),
        onSuccess: (newCustomer) => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            navigate(`/dashboard/customers/${newCustomer.id}`);
        },
        onError: (error: Error) => {
            setErrors({ submit: error.message });
        },
    });

    // Validate form
    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name?.trim()) {
            newErrors.name = 'اسم العميل مطلوب';
        }

        if (!formData.phone?.trim()) {
            newErrors.phone = 'رقم الهاتف مطلوب';
        } else if (!/^[\d\s+()-]+$/.test(formData.phone)) {
            newErrors.phone = 'رقم الهاتف غير صحيح';
        }

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'البريد الإلكتروني غير صحيح';
        }

        // branch_id is optional in the database schema

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            // Clean up data before sending - remove empty strings, convert to null
            const cleanedData = {
                ...formData,
                branch_id: formData.branch_id || null,
                email: formData.email?.trim() || null,
                address: formData.address?.trim() || null,
                tax_number: formData.tax_number?.trim() || null,
                notes: formData.notes?.trim() || null,
            } as CreateCustomerDTO;

            createMutation.mutate(cleanedData);
        }
    };

    // Update form field
    const updateField = <K extends keyof CreateCustomerDTO>(field: K, value: CreateCustomerDTO[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const { [field]: _, ...rest } = prev;
                return rest;
            });
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowRight size={20} />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">إضافة عميل جديد</h1>
                    <p className="text-muted-foreground">أضف بيانات العميل الجديد</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">بيانات العميل</CardTitle>
                        <CardDescription>المعلومات الأساسية للعميل</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Error message */}
                        {errors.submit && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                                {errors.submit}
                            </div>
                        )}

                        {/* Customer type */}
                        <div className="space-y-2">
                            <Label>نوع العميل</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => updateField('customer_type', 'individual' as CustomerType)}
                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${formData.customer_type === 'individual'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${formData.customer_type === 'individual' ? 'bg-primary/10 text-primary' : 'bg-muted'
                                        }`}>
                                        <User size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">فرد</p>
                                        <p className="text-sm text-muted-foreground">عميل شخصي</p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updateField('customer_type', 'company' as CustomerType)}
                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${formData.customer_type === 'company'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${formData.customer_type === 'company' ? 'bg-primary/10 text-primary' : 'bg-muted'
                                        }`}>
                                        <Building2 size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">شركة</p>
                                        <p className="text-sm text-muted-foreground">عميل مؤسسي</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name" required>
                                {formData.customer_type === 'company' ? 'اسم الشركة' : 'اسم العميل'}
                            </Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                placeholder={formData.customer_type === 'company' ? 'اسم الشركة' : 'الاسم بالكامل'}
                                error={!!errors.name}
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">{errors.name}</p>
                            )}
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="phone" required>رقم الهاتف</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => updateField('phone', e.target.value)}
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                                className="text-left"
                                error={!!errors.phone}
                            />
                            {errors.phone && (
                                <p className="text-sm text-destructive">{errors.phone}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                placeholder="email@example.com"
                                dir="ltr"
                                className="text-left"
                                error={!!errors.email}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email}</p>
                            )}
                        </div>

                        {/* Tax number (for companies) */}
                        {formData.customer_type === 'company' && (
                            <div className="space-y-2">
                                <Label htmlFor="tax_number">الرقم الضريبي</Label>
                                <Input
                                    id="tax_number"
                                    value={formData.tax_number || ''}
                                    onChange={(e) => updateField('tax_number', e.target.value)}
                                    placeholder="رقم التسجيل الضريبي"
                                    dir="ltr"
                                    className="text-left"
                                />
                            </div>
                        )}

                        {/* Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address">العنوان</Label>
                            <Textarea
                                id="address"
                                value={formData.address || ''}
                                onChange={(e) => updateField('address', e.target.value)}
                                placeholder="عنوان العميل"
                                rows={2}
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes || ''}
                                onChange={(e) => updateField('notes', e.target.value)}
                                placeholder="ملاحظات إضافية..."
                                rows={3}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                size="lg"
                                className="flex-1 gap-2"
                                loading={createMutation.isPending}
                            >
                                <Save size={18} />
                                حفظ العميل
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={() => navigate(-1)}
                            >
                                إلغاء
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
