import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Car, Save, User } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared';

// ============================================================
// New Vehicle Page - إضافة مركبة جديدة
// ============================================================

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    code: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 50 }, (_, i) => CURRENT_YEAR - i);

const COMMON_MAKES = [
    'تويوتا', 'نيسان', 'هيونداي', 'كيا', 'شيفروليه', 'فورد',
    'مرسيدس', 'بي إم دبليو', 'أودي', 'هوندا', 'مازدا', 'ميتسوبيشي',
    'سوزوكي', 'رينو', 'بيجو', 'ستروين', 'فيات', 'سكودا', 'فولكس واجن',
    'بورش', 'جيب', 'دودج', 'كرايسلر', 'جي إم سي', 'كاديلاك',
    'لاند روفر', 'جاكوار', 'فولفو', 'إم جي', 'بي واي دي', 'شيري',
    'جيلي', 'هافال', 'سيات', 'أخرى'
];

export function NewVehiclePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const preselectedCustomerId = searchParams.get('customer_id');

    // Form state
    const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
    const [plateNumber, setPlateNumber] = useState('');
    const [vin, setVin] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState<string>('');
    const [color, setColor] = useState('');
    const [mileage, setMileage] = useState('');
    const [insuranceExpiry, setInsuranceExpiry] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Fetch customers for select
    const { data: customers } = useQuery({
        queryKey: ['customers-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, code')
                .eq('is_active', true)
                .order('name')
                .limit(100);
            if (error) throw error;
            return data as Customer[];
        },
    });

    // Fetch preselected customer
    const { data: preselectedCustomer } = useQuery({
        queryKey: ['customer', preselectedCustomerId],
        queryFn: async () => {
            if (!preselectedCustomerId) return null;
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, code')
                .eq('id', preselectedCustomerId)
                .single();
            if (error) throw error;
            return data as Customer;
        },
        enabled: !!preselectedCustomerId,
    });

    // Create vehicle mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!customerId) throw new Error('يرجى اختيار العميل');
            if (!plateNumber.trim()) throw new Error('يرجى إدخال رقم اللوحة');

            const { error } = await supabase
                .from('vehicles')
                .insert({
                    customer_id: customerId,
                    plate_number: plateNumber.trim().toUpperCase(),
                    vin: vin.trim().toUpperCase() || null,
                    make: make || null,
                    model: model.trim() || null,
                    year: year ? parseInt(year) : null,
                    color: color.trim() || null,
                    mileage: mileage ? parseInt(mileage) : null,
                    insurance_expiry: insuranceExpiry || null,
                    notes: notes.trim() || null,
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['customer-vehicles', customerId] });
            alert('تم إضافة المركبة بنجاح');
            if (preselectedCustomerId) {
                navigate(`/dashboard/customers/${preselectedCustomerId}`);
            } else {
                navigate('/dashboard/vehicles');
            }
        },
        onError: (err: Error) => {
            setError(err.message || 'فشل إضافة المركبة');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        createMutation.mutate();
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <PageHeader
                title="إضافة مركبة جديدة"
                description="أدخل بيانات المركبة"
                backLink="/dashboard/vehicles"
            />

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User size={20} />
                            المالك
                        </CardTitle>
                        <CardDescription>اختر العميل مالك المركبة</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {preselectedCustomer ? (
                            <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="font-medium">{preselectedCustomer.name}</p>
                                <p className="text-sm text-muted-foreground">{preselectedCustomer.phone}</p>
                            </div>
                        ) : (
                            <Select value={customerId} onValueChange={setCustomerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر العميل..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers?.map((customer) => (
                                        <SelectItem key={customer.id} value={customer.id}>
                                            {customer.name} • {customer.phone || customer.code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </CardContent>
                </Card>

                {/* Vehicle Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Car size={20} />
                            بيانات المركبة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plate">رقم اللوحة *</Label>
                                <Input
                                    id="plate"
                                    value={plateNumber}
                                    onChange={(e) => setPlateNumber(e.target.value)}
                                    placeholder="أ ب ج 1234"
                                    dir="ltr"
                                    className="text-center font-mono text-lg"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vin">رقم الشاسيه (VIN)</Label>
                                <Input
                                    id="vin"
                                    value={vin}
                                    onChange={(e) => setVin(e.target.value)}
                                    placeholder="WVWZZZ3CZWE123456"
                                    dir="ltr"
                                    className="font-mono"
                                    maxLength={17}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="make">الماركة</Label>
                                <Select value={make} onValueChange={setMake}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر الماركة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COMMON_MAKES.map((m) => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="model">الموديل</Label>
                                <Input
                                    id="model"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="كامري، اكسنت..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">سنة الصنع</Label>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر السنة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {YEARS.map((y) => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="color">اللون</Label>
                                <Input
                                    id="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    placeholder="أبيض، أسود..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mileage">عداد الكيلومتر</Label>
                                <Input
                                    id="mileage"
                                    type="number"
                                    value={mileage}
                                    onChange={(e) => setMileage(e.target.value)}
                                    placeholder="50000"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="insurance">انتهاء التأمين</Label>
                                <Input
                                    id="insurance"
                                    type="date"
                                    value={insuranceExpiry}
                                    onChange={(e) => setInsuranceExpiry(e.target.value)}
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="أي ملاحظات إضافية عن المركبة..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Error */}
                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(-1)}
                        className="flex-1"
                    >
                        إلغاء
                    </Button>
                    <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="flex-1 gap-2"
                    >
                        <Save size={18} />
                        {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ المركبة'}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default NewVehiclePage;
