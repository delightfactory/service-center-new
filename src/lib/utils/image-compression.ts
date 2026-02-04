/**
 * ============================================================
 * أداة ضغط الصور - Image Compression Utility
 * ============================================================
 * ضغط الصور قبل رفعها لتوفير مساحة التخزين
 * يستخدم Canvas API (مدعوم من جميع المتصفحات)
 * ============================================================
 */

interface CompressionOptions {
    maxWidth?: number;      // الحد الأقصى للعرض (default: 1920)
    maxHeight?: number;     // الحد الأقصى للارتفاع (default: 1080)
    quality?: number;       // جودة الضغط 0.1-1 (default: 0.7)
    maxSizeKB?: number;     // الحد الأقصى للحجم بالكيلوبايت (default: 500)
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.7,
    maxSizeKB: 500,
};

/**
 * ضغط صورة وإرجاعها كـ File جديد
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // إذا كانت الصورة أصغر من الحد الأقصى، لا نضغطها
    if (file.size <= opts.maxSizeKB * 1024) {
        console.log(`Image already small: ${(file.size / 1024).toFixed(1)}KB`);
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // حساب الأبعاد الجديدة مع الحفاظ على النسبة
                let { width, height } = img;

                if (width > opts.maxWidth) {
                    height = (height * opts.maxWidth) / width;
                    width = opts.maxWidth;
                }

                if (height > opts.maxHeight) {
                    width = (width * opts.maxHeight) / height;
                    height = opts.maxHeight;
                }

                // إنشاء Canvas للضغط
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // رسم الصورة على Canvas
                ctx.drawImage(img, 0, 0, width, height);

                // تحويل إلى Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        // إنشاء File جديد
                        const compressedFile = new File(
                            [blob],
                            file.name.replace(/\.[^.]+$/, '.webp'),
                            { type: 'image/webp' }
                        );

                        console.log(
                            `Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB ` +
                            `(${((1 - compressedFile.size / file.size) * 100).toFixed(0)}% reduction)`
                        );

                        resolve(compressedFile);
                    },
                    'image/webp',
                    opts.quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * ضغط صورة للفحص (أبعاد أصغر للتوفير)
 */
export async function compressInspectionPhoto(file: File): Promise<File> {
    return compressImage(file, {
        maxWidth: 1280,     // أصغر من الافتراضي
        maxHeight: 960,
        quality: 0.6,       // جودة متوسطة (كافية للفحص)
        maxSizeKB: 300,     // حد أقصى 300KB
    });
}

/**
 * حساب حجم الصورة التقريبي
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
