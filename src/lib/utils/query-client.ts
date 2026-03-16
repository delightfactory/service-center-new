// ============================================================
// React Query Client Configuration
// Optimized for large-scale data (100K+ rows)
// ============================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // البيانات تُعتبر قديمة بعد 5 دقائق
            staleTime: 5 * 60 * 1000,

            // الاحتفاظ بالبيانات في الكاش لمدة 30 دقيقة
            gcTime: 30 * 60 * 1000,

            // إعادة المحاولة مرة واحدة فقط مع تأخير قصير
            // استخدام 3 محاولات يسبب تعليق التحميل عند انتهاء صلاحية التوكن
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),

            // نعيد الطلب عند التركيز لضمان تحديث البيانات بعد التنقل
            // استخدام true بدل 'always' ليحترم staleTime ويتجنب طلبات بتوكن منتهي
            refetchOnWindowFocus: true,

            // لا نعيد الطلب عند إعادة الاتصال إذا كانت البيانات حديثة
            refetchOnReconnect: true,

            // نعيد الطلب عند mount دائماً لتفادي بقاء بيانات فارغة بسبب كاش سابق
            refetchOnMount: true,

            // الشبكة: نستخدم 'always' بدل 'online' — navigator.onLine غير موثوق
            // ويسبب تعليق الطلبات في pending/idle عند التنقل بين التابات
            networkMode: 'always',
        },
        mutations: {
            // إعادة المحاولة للـ mutations
            retry: 1,
            retryDelay: 1000,

            // Network mode
            networkMode: 'always',
        },
    },
});

// ============================================================
// Query Invalidation Helpers
// ============================================================

export const invalidateQueries = {
    // Core
    profiles: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    branches: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),

    // CRM
    customers: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
    vehicles: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
    suppliers: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),

    // Operations
    assessments: () => queryClient.invalidateQueries({ queryKey: ['assessments'] }),
    jobOrders: () => queryClient.invalidateQueries({ queryKey: ['jobOrders'] }),
    jobItems: () => queryClient.invalidateQueries({ queryKey: ['jobItems'] }),

    // Inventory
    products: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    inventory: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),

    // Finance
    invoices: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    payments: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
    treasuries: () => queryClient.invalidateQueries({ queryKey: ['treasuries'] }),

    // All
    all: () => queryClient.invalidateQueries(),
};

export default queryClient;
