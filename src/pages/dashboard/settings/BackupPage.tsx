import React, { useState, useEffect } from 'react';
import { useBackup, BackupLog, BackupInfo } from '@/hooks/useBackup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Upload, History, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export function BackupPage() {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const {
        exportBackup,
        restoreBackup,
        getBackupInfo,
        getBackupLogs,
        isLoading,
        error: hookError
    } = useBackup();

    const [stats, setStats] = useState<BackupInfo | null>(null);
    const [logs, setLogs] = useState<BackupLog[]>([]);
    const [isRestoreOpen, setIsRestoreOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [confirmationText, setConfirmationText] = useState('');
    const [pageError, setPageError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const [infoData, logsData] = await Promise.all([
                getBackupInfo().catch(() => null), // Ignore error if no backup exists yet
                getBackupLogs()
            ]);
            setStats(infoData);
            setLogs(logsData || []);
        } catch (err) {
            console.error('Failed to load backup data:', err);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleExport = async () => {
        setPageError(null);
        setSuccessMessage(null);
        try {
            await exportBackup();
            setSuccessMessage('تم تصدير النسخة الاحتياطية بنجاح');
            loadData();
        } catch (err: any) {
            setPageError(err.message || 'فشل تصدير النسخة الاحتياطية');
        }
    };

    const handleRestoreClick = () => {
        setPageError(null);
        setSuccessMessage(null);
        setIsRestoreOpen(true);
        setSelectedFile(null);
        setConfirmationText('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleRestoreSubmit = async () => {
        if (!selectedFile) return;
        if (confirmationText !== 'استعادة') return;

        try {
            await restoreBackup(selectedFile);
            setSuccessMessage('تم استعادة النسخة الاحتياطية بنجاح. يرجى تحديث الصفحة.');
            setIsRestoreOpen(false);
            loadData();
        } catch (err: any) {
            setPageError(err.message || 'فشل استعادة النسخة الاحتياطية');
            setIsRestoreOpen(false); // Close dialog to show error clearly on page
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">النسخ الاحتياطي والاستعادة</h1>
                    <p className="text-muted-foreground mt-2">
                        إدارة نسخ قواعد البيانات، تصدير البيانات للنسخ الاحتياطي، واستعادتها عند الحاجة.
                    </p>
                </div>
            </div>

            {(pageError || hookError) && (
                <div className="bg-destructive/15 text-destructive border border-destructive/20 p-4 rounded-md flex items-start gap-4">
                    <AlertTriangle className="h-4 w-4 mt-1" />
                    <div>
                        <h5 className="font-medium mb-1">خطأ</h5>
                        <p className="text-sm">{pageError || hookError}</p>
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 text-green-900 border border-green-200 p-4 rounded-md flex items-start gap-4">
                    <CheckCircle className="h-4 w-4 mt-1 text-green-600" />
                    <div>
                        <h5 className="font-medium mb-1">تم بنجاح</h5>
                        <p className="text-sm">{successMessage}</p>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Status Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">آخر نسخة احتياطية</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats?.last_backup_date
                                ? formatDate(stats.last_backup_date)
                                : 'لا يوجد'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats ? `${stats.total_records} سجل • ${(stats.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'لم يتم إجراء نسخ احتياطي بعد'}
                        </p>
                    </CardContent>
                </Card>

                {/* Actions Card */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>عمليات سريعة</CardTitle>
                        <CardDescription>قم بتنفيذ عمليات النسخ الاحتياطي والاستعادة بحذر.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-4">
                        <Button onClick={handleExport} disabled={isLoading} className="gap-2">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            تصدير نسخة كاملة
                        </Button>

                        <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" onClick={handleRestoreClick} disabled={isLoading} className="gap-2">
                                    <Upload className="h-4 w-4" />
                                    استعادة نسخة
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>استعادة نسخة احتياطية</DialogTitle>
                                    <DialogDescription>
                                        تحذير: هذه العملية ستقوم بحذف جميع البيانات الحالية واستبدالها بالبيانات الموجودة في ملف النسخة الاحتياطية. لا يمكن التراجع عن هذه العملية.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="backup-file">ملف النسخة الاحتياطية (JSON)</Label>
                                        <Input
                                            id="backup-file"
                                            type="file"
                                            accept=".json"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-text" className="text-destructive font-bold">
                                            للتأكيد، اكتب كلمة "استعادة" في الخانة أدناه:
                                        </Label>
                                        <Input
                                            id="confirm-text"
                                            value={confirmationText}
                                            onChange={(e) => setConfirmationText(e.target.value)}
                                            placeholder="استعادة"
                                            className="border-destructive focus-visible:ring-destructive"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsRestoreOpen(false)}>إلغاء</Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleRestoreSubmit}
                                        disabled={!selectedFile || confirmationText !== 'استعادة' || isLoading}
                                    >
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        تأكيد الاستعادة
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </div>

            {/* Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>سجل العمليات</CardTitle>
                    <CardDescription>آخر العمليات التي تمت على النظام.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>العملية</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>عدد السجلات</TableHead>
                                <TableHead>ملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        لا توجد سجلات
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-medium">
                                            {log.operation === 'export' ? 'تصدير نسخة' : 'استعادة نسخة'}
                                        </TableCell>
                                        <TableCell>
                                            {formatDate(log.started_at)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                log.status === 'completed' ? 'default' :
                                                    log.status === 'failed' ? 'destructive' : 'secondary'
                                            }>
                                                {log.status === 'completed' ? 'مكتمل' :
                                                    log.status === 'failed' ? 'فشل' : 'جاري العمل'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{log.total_records}</TableCell>
                                        <TableCell className="max-w-[200px] truncate text-muted-foreground" title={log.error_message}>
                                            {log.error_message || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default BackupPage;
