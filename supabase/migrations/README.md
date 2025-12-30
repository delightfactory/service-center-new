# ملفات قاعدة البيانات - نظام مركز صيانة السيارات

## الإصدار: 1.0
## التاريخ: 2024-12-25

---

## ترتيب التنفيذ

| # | الملف | المحتوى | الحالة |
|---|-------|---------|--------|
| 1 | `00_enums.sql` | 21 ENUM Type | ✅ |
| 2 | `01_core.sql` | branches, profiles, warehouses + دوال RLS | ✅ |
| 3 | `02_crm.sql` | customers, vehicles, suppliers | ✅ |
| 4 | `03_operations.sql` | assessments, job_orders, job_items, job_technicians | ✅ |
| 5 | `04_inventory.sql` | categories, products, service_components, inventory_items, inventory_transactions | ✅ |
| 6 | `05_finance.sql` | treasuries, account_categories, invoices, expenses, payments, treasury_transactions, treasury_transfers, credit_debit_notes | ✅ |
| 7 | `06_activity_log.sql` | activity_logs + 11 تريجر للتتبع | ✅ |
| 8 | `07_rls.sql` | سياسات أمان RLS لـ 24 جدول | ✅ |
| 9 | `08_seed.sql` | بيانات أولية وتجريبية | ✅ |
| 10 | `09_storage.sql` | Storage Buckets + سياسات التخزين | ✅ |

---

## طريقة التنفيذ

### عبر Supabase CLI:
```bash
# تثبيت Supabase CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref YOUR_PROJECT_REF

# تنفيذ الـ Migrations
supabase db push
```

### عبر SQL Editor في Supabase Dashboard:
1. افتح SQL Editor
2. انسخ محتوى كل ملف بالترتيب
3. نفذ كل ملف

---

## الإحصائيات النهائية

| العنصر | العدد |
|--------|-------|
| **الجداول** | 24 |
| **ENUM Types** | 21 |
| **Triggers** | 20+ |
| **سياسات RLS** | 50+ |
| **دوال مساعدة** | 15+ |

---

## ملاحظات مهمة

> ⚠️ **كل الملفات قابلة لإعادة التشغيل (Idempotent)**
> - تستخدم `CREATE TABLE IF NOT EXISTS`
> - تستخدم `DROP TRIGGER IF EXISTS` قبل الإنشاء
> - تستخدم `ON CONFLICT DO NOTHING` للبيانات

> 💡 **للإنتاج**: احذف أو عدّل ملف `08_seed.sql` لإزالة البيانات التجريبية
