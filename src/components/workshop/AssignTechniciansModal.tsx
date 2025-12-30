import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X, Check, Crown, Users, Search, Wrench, Clock, Star, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// ============================================================
// Assign Technicians Modal - محسّن مع إحصائيات الفنيين
// ============================================================

interface AssignTechniciansModalProps {
    jobOrderId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface TechnicianWithStats {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
    // إحصائيات
    active_jobs_count: number;
    completed_today: number;
    is_available: boolean;
    current_job_code: string | null;
    hours_today: number;
}

interface AssignedTechnician {
    id: string;
    technician_id: string;
    is_lead: boolean;
}

export function AssignTechniciansModal({
    jobOrderId,
    open,
    onOpenChange,
    onSuccess,
}: AssignTechniciansModalProps) {
    const queryClient = useQueryClient();
    const [selectedTechnicians, setSelectedTechnicians] = useState<Map<string, boolean>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // جلب الفنيين مع الإحصائيات
    const { data: technicians, isLoading: techLoading } = useQuery({
        queryKey: ['technicians-with-stats'],
        queryFn: async () => {
            // جلب الفنيين
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .eq('role', 'technician')
                .eq('is_active', true)
                .order('full_name');

            if (profilesError) throw profilesError;
            if (!profiles) return [];

            // جلب الإحصائيات لكل فني
            const techIds = profiles.map(p => p.id);

            // عدد الأوامر النشطة لكل فني
            const { data: activeJobs } = await supabase
                .from('job_technicians')
                .select(`
                    technician_id,
                    job_order:job_orders!inner (id, code, status)
                `)
                .in('technician_id', techIds)
                .in('job_order.status', ['pending', 'in_progress', 'paused']);

            // حساب الإحصائيات
            const statsMap = new Map<string, { count: number; currentCode: string | null }>();
            activeJobs?.forEach(aj => {
                const current = statsMap.get(aj.technician_id) || { count: 0, currentCode: null };
                current.count++;
                if ((aj.job_order as any)?.status === 'in_progress') {
                    current.currentCode = (aj.job_order as any)?.code || null;
                }
                statsMap.set(aj.technician_id, current);
            });

            // تجميع البيانات
            return profiles.map(p => {
                const stats = statsMap.get(p.id) || { count: 0, currentCode: null };
                return {
                    ...p,
                    active_jobs_count: stats.count,
                    completed_today: 0,
                    is_available: stats.count === 0,
                    current_job_code: stats.currentCode,
                    hours_today: 0,
                } as TechnicianWithStats;
            });
        },
        enabled: open,
        staleTime: 30000,
    });

    // جلب الفنيين المعينين حالياً
    const { data: assignedTechnicians } = useQuery({
        queryKey: ['job-technicians', jobOrderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_technicians')
                .select('id, technician_id, is_lead')
                .eq('job_order_id', jobOrderId);

            if (error) throw error;
            return data as AssignedTechnician[];
        },
        enabled: open && !!jobOrderId,
    });

    // تهيئة الاختيارات من التعيينات الحالية
    useEffect(() => {
        if (assignedTechnicians) {
            const map = new Map<string, boolean>();
            assignedTechnicians.forEach(at => {
                map.set(at.technician_id, at.is_lead);
            });
            setSelectedTechnicians(map);
        }
    }, [assignedTechnicians]);

    // فلترة الفنيين بناءً على البحث
    const filteredTechnicians = technicians?.filter(tech =>
        tech.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // ترتيب: المتاحين أولاً
    const sortedTechnicians = [...filteredTechnicians].sort((a, b) => {
        if (a.is_available && !b.is_available) return -1;
        if (!a.is_available && b.is_available) return 1;
        return a.active_jobs_count - b.active_jobs_count;
    });

    // تبديل اختيار فني
    const toggleTechnician = (techId: string) => {
        const newMap = new Map(selectedTechnicians);
        if (newMap.has(techId)) {
            newMap.delete(techId);
        } else {
            newMap.set(techId, false);
        }
        setSelectedTechnicians(newMap);
    };

    // تبديل حالة الفني الرئيسي
    const toggleLead = (techId: string) => {
        const newMap = new Map(selectedTechnicians);
        const currentIsLead = newMap.get(techId) || false;
        // فني رئيسي واحد فقط
        if (!currentIsLead) {
            newMap.forEach((_, key) => newMap.set(key, false));
        }
        newMap.set(techId, !currentIsLead);
        setSelectedTechnicians(newMap);
    };

    // حفظ التعيينات
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            // حذف التعيينات الحالية
            await supabase
                .from('job_technicians')
                .delete()
                .eq('job_order_id', jobOrderId);

            // إضافة التعيينات الجديدة
            if (selectedTechnicians.size > 0) {
                const insertData = Array.from(selectedTechnicians.entries()).map(([techId, isLead]) => ({
                    job_order_id: jobOrderId,
                    technician_id: techId,
                    is_lead: isLead,
                }));

                const { error: insertError } = await supabase
                    .from('job_technicians')
                    .insert(insertData);

                if (insertError) throw insertError;
            }

            // تحديث الكاش
            queryClient.invalidateQueries({ queryKey: ['job-technicians', jobOrderId] });
            queryClient.invalidateQueries({ queryKey: ['job-order', jobOrderId] });
            queryClient.invalidateQueries({ queryKey: ['technicians-with-stats'] });

            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            console.error('Error saving technicians:', err);
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setError(null);
        setSearchQuery('');
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-right">
                        <Users size={20} />
                        تعيين الفنيين
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        اختر الفنيين المسؤولين عن هذا أمر الشغل
                    </DialogDescription>
                </DialogHeader>

                {/* شريط البحث */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        placeholder="بحث عن فني..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10 text-right"
                    />
                </div>

                {/* قائمة الفنيين */}
                <div className="py-2 space-y-2 max-h-[400px] overflow-y-auto">
                    {techLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            جاري التحميل...
                        </div>
                    ) : sortedTechnicians.length > 0 ? (
                        sortedTechnicians.map((tech) => {
                            const isSelected = selectedTechnicians.has(tech.id);
                            const isLead = selectedTechnicians.get(tech.id) || false;

                            return (
                                <div
                                    key={tech.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                                        isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                    onClick={() => toggleTechnician(tech.id)}
                                >
                                    {/* Avatar مع مؤشر الحالة */}
                                    <div className="relative">
                                        <Avatar className="w-12 h-12">
                                            <AvatarImage src={tech.avatar_url || undefined} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                {tech.full_name?.charAt(0) || 'ف'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={cn(
                                            'absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full border-2 border-background',
                                            tech.is_available ? 'bg-green-500' : 'bg-amber-500'
                                        )} />
                                    </div>

                                    {/* معلومات الفني */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold truncate">{tech.full_name}</p>
                                            {tech.is_available ? (
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                                    متاح
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                                                    مشغول
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Wrench size={12} />
                                                {tech.active_jobs_count} أوامر نشطة
                                            </span>
                                            {tech.current_job_code && (
                                                <span className="text-amber-600">
                                                    يعمل على: {tech.current_job_code}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* زر الفني الرئيسي */}
                                    {isSelected && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleLead(tech.id);
                                            }}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
                                                isLead
                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                        >
                                            <Crown size={14} className={cn(isLead && "text-amber-600")} />
                                            {isLead ? 'رئيسي' : 'جعله رئيسي'}
                                        </button>
                                    )}

                                    {/* مؤشر الاختيار */}
                                    <div
                                        className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                            isSelected
                                                ? "border-primary bg-primary"
                                                : "border-muted-foreground/30"
                                        )}
                                    >
                                        {isSelected && <Check size={14} className="text-primary-foreground" />}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users size={40} className="mx-auto mb-2 opacity-50" />
                            <p>لا يوجد فنيين متاحين</p>
                        </div>
                    )}
                </div>

                {/* ملخص + خطأ */}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">
                        تم اختيار <span className="font-bold text-foreground">{selectedTechnicians.size}</span> فني
                    </span>
                    {error && (
                        <span className="text-destructive flex items-center gap-1">
                            <AlertCircle size={14} />
                            {error}
                        </span>
                    )}
                </div>

                <DialogFooter className="flex-row-reverse gap-2 sm:gap-2">
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                جاري الحفظ...
                            </>
                        ) : (
                            <>
                                <UserPlus size={18} />
                                حفظ التعيينات
                            </>
                        )}
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                        إلغاء
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AssignTechniciansModal;
