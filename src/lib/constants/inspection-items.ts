/**
 * Vehicle Inspection Items - قائمة بنود فحص استلام السيارة
 * 
 * بنود الفحص المستخدمة في نموذج استلام السيارة
 */

export type InspectionStatus = 'works' | 'not_working' | 'not_checked';

export interface InspectionItem {
    key: string;
    label: string;
    icon: string; // Lucide icon name
    category: 'electrical' | 'mechanical' | 'exterior' | 'safety';
}

export interface InspectionItemState {
    key: string;
    status: InspectionStatus;
    notes: string;
    photos: string[]; // Array of photo URLs
}

export interface InspectionData {
    items: InspectionItemState[];
    additionalNotes: string;
    additionalWorkRequest: string;
    inspectionPhotos: string[]; // General inspection photos
}

/**
 * قائمة بنود الفحص الثابتة
 */
export const INSPECTION_ITEMS: InspectionItem[] = [
    // بنود كهربائية
    { key: 'ac', label: 'تكييف', icon: 'Snowflake', category: 'electrical' },
    { key: 'power_windows', label: 'زجاج كهرباء', icon: 'Square', category: 'electrical' },
    { key: 'central_lock', label: 'سنتر لوك', icon: 'Lock', category: 'electrical' },
    { key: 'dashboard_lights', label: 'أنوار التابلون', icon: 'Lightbulb', category: 'electrical' },
    { key: 'all_lights', label: 'أنوار السيارة بالكامل', icon: 'Sun', category: 'electrical' },
    { key: 'wipers', label: 'مساحات', icon: 'Droplets', category: 'electrical' },
    { key: 'dashboard_indicators', label: 'مؤشرات التابلون', icon: 'Gauge', category: 'electrical' },

    // بنود ميكانيكية
    { key: 'engine_condition', label: 'حالة الماتور', icon: 'Cog', category: 'mechanical' },
    { key: 'car_fans', label: 'مراوح السيارة', icon: 'Fan', category: 'mechanical' },
    { key: 'battery', label: 'مواصفات البطارية', icon: 'Battery', category: 'mechanical' },

    // بنود خارجية
    { key: 'glass_cracks', label: 'شروخ الزجاج', icon: 'AlertTriangle', category: 'exterior' },
    { key: 'mirrors', label: 'مرايات', icon: 'Maximize2', category: 'exterior' },
    { key: 'scratches_dents', label: 'حكات وخبطات بالسيارة', icon: 'AlertCircle', category: 'exterior' },
    { key: 'tires', label: 'إطارات/كوتشات', icon: 'Circle', category: 'exterior' },
    { key: 'dashboard_cover', label: 'لمبة التابلون', icon: 'MonitorSpeaker', category: 'exterior' },

    // أنظمة السلامة
    { key: 'srs', label: 'SRS (نظام الأمان)', icon: 'ShieldCheck', category: 'safety' },
    { key: 'abs', label: 'ABS', icon: 'Shield', category: 'safety' },
];

/**
 * تصنيفات البنود بالعربية
 */
export const CATEGORY_LABELS: Record<InspectionItem['category'], string> = {
    electrical: 'البنود الكهربائية',
    mechanical: 'البنود الميكانيكية',
    exterior: 'الحالة الخارجية',
    safety: 'أنظمة السلامة',
};

/**
 * حالات الفحص بالعربية
 */
export const STATUS_LABELS: Record<InspectionStatus, string> = {
    works: 'يعمل',
    not_working: 'لا يعمل',
    not_checked: 'غير محدد',
};

/**
 * إنشاء حالة فحص فارغة
 */
export function createEmptyInspectionData(): InspectionData {
    return {
        items: INSPECTION_ITEMS.map(item => ({
            key: item.key,
            status: 'not_checked' as InspectionStatus,
            notes: '',
            photos: [],
        })),
        additionalNotes: '',
        additionalWorkRequest: '',
        inspectionPhotos: [],
    };
}

/**
 * الحصول على بنود الفحص حسب التصنيف
 */
export function getItemsByCategory(category: InspectionItem['category']): InspectionItem[] {
    return INSPECTION_ITEMS.filter(item => item.category === category);
}
