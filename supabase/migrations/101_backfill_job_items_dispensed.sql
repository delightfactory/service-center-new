-- ============================================================
-- Backfill job_items.is_dispensed for historical approved invoices
-- Migration: 101_backfill_job_items_dispensed.sql
-- Date: 2026-01-26
-- ============================================================

UPDATE job_items ji
SET is_dispensed = true
FROM invoices i
WHERE ji.job_order_id = i.job_order_id
  AND ji.product_id IS NOT NULL
  AND ji.is_cancelled = false
  AND i.invoice_type = 'sales'
  AND i.status IN ('approved', 'paid', 'partial')
  AND ji.is_dispensed IS DISTINCT FROM true;
