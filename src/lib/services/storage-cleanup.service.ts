/**
 * ============================================================
 * خدمة تنظيف Storage التلقائي - Auto Storage Cleanup Service
 * ============================================================
 * نظام احترافي وعملي للتنظيف:
 * - Debounce: لتجنب التنظيف المتكرر
 * - Batch Delete: حذف مجموعة ملفات دفعة واحدة
 * - Smart Throttle: فحص كل 10 رفعات فقط
 * - Lazy Cleanup: 5 ملفات فقط في كل مرة
 * ============================================================
 */

import { supabase } from '@/lib/supabase/client';

// ============================================================
// Types
// ============================================================

interface StorageUsage {
    total_files: number;
    total_size_bytes: number;
    total_size_mb: number;
    max_storage_mb: number;
    usage_percent: number;
    files_older_than_retention: number;
    size_older_than_retention_bytes: number;
    needs_cleanup: boolean;
}

interface CleanupCheck {
    needs_cleanup: boolean;
    reason: string;
    usage_percent: number;
    old_files_count: number;
}

interface FileToCleanup {
    file_id: string;
    bucket_id: string;
    file_path: string;
    file_size_bytes: number;
    uploaded_at: string;
    age_days: number;
    cleanup_reason: string;
}

interface CleanupResult {
    success: boolean;
    deleted: number;
    failed: number;
    freedBytes: number;
    errors: string[];
    skipped?: boolean;
    reason?: string;
}

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
    // عدد الملفات المحذوفة في كل تنظيف (للسرعة)
    CLEANUP_BATCH_SIZE: 5,

    // فحص التنظيف كل X رفعة
    CHECK_EVERY_N_UPLOADS: 10,

    // الحد الأدنى بين عمليات التنظيف (بالثواني)
    MIN_CLEANUP_INTERVAL_SECONDS: 60,

    // تأخير الـ debounce (بالميللي ثانية)
    DEBOUNCE_DELAY_MS: 5000,
};

// ============================================================
// State Management
// ============================================================

let uploadCounter = 0;
let lastCleanupTime = 0;
let cleanupDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isCleanupRunning = false;

// ============================================================
// Core Functions
// ============================================================

/**
 * تسجيل ملف جديد في سجل التتبع
 * @param bucketId اسم الـ bucket
 * @param filePath مسار الملف
 * @param fileSizeBytes حجم الملف بالبايت
 * @param assessmentId معرف أمر الاستلام (اختياري)
 */
export async function logStorageFile(
    bucketId: string,
    filePath: string,
    fileSizeBytes: number = 0,
    assessmentId?: string
): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc('log_storage_file', {
            p_bucket_id: bucketId,
            p_file_path: filePath,
            p_file_size_bytes: fileSizeBytes,
            p_assessment_id: assessmentId || null,
        });

        if (error) {
            console.error('[Storage] Error logging file:', error);
            return null;
        }

        // زيادة العداد وتشغيل التنظيف الذكي
        uploadCounter++;
        scheduleSmartCleanup();

        return data;
    } catch (error) {
        console.error('[Storage] Error in logStorageFile:', error);
        return null;
    }
}

/**
 * جدولة التنظيف الذكي (مع debounce وthrottle)
 */
function scheduleSmartCleanup(): void {
    // فحص كل N رفعة فقط
    if (uploadCounter % CONFIG.CHECK_EVERY_N_UPLOADS !== 0) {
        return;
    }

    // إلغاء أي timer سابق
    if (cleanupDebounceTimer) {
        clearTimeout(cleanupDebounceTimer);
    }

    // جدولة التنظيف بعد تأخير
    cleanupDebounceTimer = setTimeout(() => {
        triggerAutoCleanupIfNeeded().catch(console.error);
    }, CONFIG.DEBOUNCE_DELAY_MS);
}

/**
 * الحصول على إحصائيات استخدام التخزين
 */
export async function getStorageUsage(): Promise<StorageUsage | null> {
    const { data, error } = await supabase.rpc('get_storage_usage');

    if (error) {
        console.error('[Storage] Error getting usage:', error);
        return null;
    }

    return data?.[0] || null;
}

/**
 * فحص إذا كان التنظيف مطلوباً
 */
export async function shouldRunCleanup(): Promise<CleanupCheck | null> {
    const { data, error } = await supabase.rpc('should_run_cleanup');

    if (error) {
        console.error('[Storage] Error checking cleanup need:', error);
        return null;
    }

    return data?.[0] || null;
}

/**
 * الحصول على الملفات المرشحة للحذف
 */
export async function getFilesToCleanup(limit = CONFIG.CLEANUP_BATCH_SIZE): Promise<FileToCleanup[]> {
    const { data, error } = await supabase.rpc('get_files_to_cleanup', {
        p_limit: limit,
    });

    if (error) {
        console.error('[Storage] Error getting files to cleanup:', error);
        return [];
    }

    return data || [];
}

/**
 * حذف مجموعة ملفات دفعة واحدة (Batch Delete)
 */
export async function batchDeleteFiles(
    bucketId: string,
    filePaths: string[]
): Promise<{ success: boolean; deletedCount: number }> {
    if (filePaths.length === 0) {
        return { success: true, deletedCount: 0 };
    }

    try {
        // حذف جميع الملفات دفعة واحدة
        const { error: storageError } = await supabase.storage
            .from(bucketId)
            .remove(filePaths);

        if (storageError) {
            console.error('[Storage] Batch delete error:', storageError);
            return { success: false, deletedCount: 0 };
        }

        // تحديث السجلات في قاعدة البيانات
        for (const filePath of filePaths) {
            try {
                await supabase.rpc('mark_file_as_deleted', {
                    p_bucket_id: bucketId,
                    p_file_path: filePath,
                });
            } catch {
                // تجاهل الأخطاء الفردية
            }
        }

        return { success: true, deletedCount: filePaths.length };
    } catch (error) {
        console.error('[Storage] Error in batchDeleteFiles:', error);
        return { success: false, deletedCount: 0 };
    }
}

// ============================================================
// Auto Cleanup (Optimized)
// ============================================================

/**
 * تشغيل التنظيف التلقائي إذا لزم الأمر
 */
export async function triggerAutoCleanupIfNeeded(): Promise<CleanupResult | null> {
    // منع التشغيل المتزامن
    if (isCleanupRunning) {
        return {
            success: true,
            deleted: 0,
            failed: 0,
            freedBytes: 0,
            errors: [],
            skipped: true,
            reason: 'already_running'
        };
    }

    // فحص الفاصل الزمني
    const now = Date.now();
    if (now - lastCleanupTime < CONFIG.MIN_CLEANUP_INTERVAL_SECONDS * 1000) {
        return {
            success: true,
            deleted: 0,
            failed: 0,
            freedBytes: 0,
            errors: [],
            skipped: true,
            reason: 'too_soon'
        };
    }

    try {
        isCleanupRunning = true;

        // فحص إذا كان التنظيف مطلوباً
        const check = await shouldRunCleanup();

        if (!check || !check.needs_cleanup) {
            return null;
        }

        console.log(`[Storage] Auto cleanup triggered: ${check.reason} (${check.usage_percent.toFixed(1)}% used)`);

        // تشغيل التنظيف
        const result = await runCleanup(CONFIG.CLEANUP_BATCH_SIZE);
        lastCleanupTime = Date.now();

        return result;
    } catch (error) {
        console.error('[Storage] Error in auto cleanup:', error);
        return null;
    } finally {
        isCleanupRunning = false;
    }
}

/**
 * تشغيل عملية التنظيف (محسّنة)
 */
export async function runCleanup(limit = CONFIG.CLEANUP_BATCH_SIZE): Promise<CleanupResult> {
    const result: CleanupResult = {
        success: true,
        deleted: 0,
        failed: 0,
        freedBytes: 0,
        errors: [],
    };

    try {
        // الحصول على الملفات المرشحة للحذف
        const files = await getFilesToCleanup(limit);

        if (files.length === 0) {
            return result;
        }

        // تجميع الملفات حسب الـ bucket
        const filesByBucket: Record<string, { paths: string[]; sizes: number[] }> = {};

        for (const file of files) {
            if (!filesByBucket[file.bucket_id]) {
                filesByBucket[file.bucket_id] = { paths: [], sizes: [] };
            }
            filesByBucket[file.bucket_id].paths.push(file.file_path);
            filesByBucket[file.bucket_id].sizes.push(file.file_size_bytes || 0);
        }

        // حذف كل bucket دفعة واحدة
        for (const [bucketId, { paths, sizes }] of Object.entries(filesByBucket)) {
            const { success, deletedCount } = await batchDeleteFiles(bucketId, paths);

            if (success) {
                result.deleted += deletedCount;
                result.freedBytes += sizes.reduce((a, b) => a + b, 0);
            } else {
                result.failed += paths.length;
                result.errors.push(`Failed to delete from ${bucketId}`);
            }
        }

        // تحديث إحصائيات التنظيف
        if (result.deleted > 0) {
            try {
                await supabase.rpc('update_cleanup_stats', {
                    p_deleted_count: result.deleted,
                    p_freed_bytes: result.freedBytes,
                });
            } catch {
                // تجاهل أخطاء التحديث
            }

            console.log(`[Storage] Cleanup: ${result.deleted} files, ${formatBytes(result.freedBytes)} freed`);
        }

        result.success = result.failed === 0;

    } catch (error) {
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
}

/**
 * تنظيف يدوي شامل (للـ Admin)
 */
export async function runFullCleanup(): Promise<CleanupResult> {
    console.log('[Storage] Starting full cleanup...');

    const totalResult: CleanupResult = {
        success: true,
        deleted: 0,
        failed: 0,
        freedBytes: 0,
        errors: [],
    };

    // حذف على دفعات حتى لا يبقى شيء
    let hasMore = true;
    let iterations = 0;
    const MAX_ITERATIONS = 20; // حماية من اللوب اللانهائي

    while (hasMore && iterations < MAX_ITERATIONS) {
        const result = await runCleanup(50); // دفعة أكبر للتنظيف الشامل

        totalResult.deleted += result.deleted;
        totalResult.failed += result.failed;
        totalResult.freedBytes += result.freedBytes;
        totalResult.errors.push(...result.errors);

        hasMore = result.deleted > 0;
        iterations++;
    }

    totalResult.success = totalResult.failed === 0;

    console.log(`[Storage] Full cleanup complete: ${totalResult.deleted} files, ${formatBytes(totalResult.freedBytes)} freed`);

    return totalResult;
}

// ============================================================
// Utilities
// ============================================================

/**
 * تنسيق حجم الملف
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * إعادة تعيين العدادات (للاختبار)
 */
export function resetCleanupState(): void {
    uploadCounter = 0;
    lastCleanupTime = 0;
    if (cleanupDebounceTimer) {
        clearTimeout(cleanupDebounceTimer);
        cleanupDebounceTimer = null;
    }
    isCleanupRunning = false;
}

// ============================================================
// Exports
// ============================================================

export {
    CONFIG as CLEANUP_CONFIG,
    type StorageUsage,
    type CleanupCheck,
    type FileToCleanup,
    type CleanupResult,
};

