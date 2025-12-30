import React from 'react';
import { FileText, Wrench, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ============================================================
// Job Details Section Component
// ============================================================

interface JobDetailsSectionProps {
    complaint: string | null;
    instructions: string | null;
    onEditInstructions: () => void;
}

export function JobDetailsSection({
    complaint,
    instructions,
    onEditInstructions,
}: JobDetailsSectionProps) {
    return (
        <div className="space-y-4">
            {/* شكوى العميل */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText size={18} />
                        شكوى العميل
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                        {complaint || 'لا توجد شكوى مسجلة'}
                    </p>
                </CardContent>
            </Card>

            {/* توجيهات المدير */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Wrench size={18} />
                        توجيهات المدير
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={onEditInstructions}>
                        <Edit size={14} className="ml-1" />
                        {instructions ? 'تعديل' : 'إضافة'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {instructions ? (
                        <p className="text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                            {instructions}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            لم يتم إضافة توجيهات بعد
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
