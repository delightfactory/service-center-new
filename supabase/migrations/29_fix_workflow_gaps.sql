-- ============================================================
-- Migration: Fix Workflow Gaps
-- Version: 29
-- Description: 
--   1. Prevent duplicate invoices per job order
--   2. Auto-update assessment status on job order changes
--   3. Add review submission tracking
-- ============================================================

-- ============================================================
-- 1. PREVENT DUPLICATE INVOICES PER JOB ORDER
-- ============================================================

-- Add unique partial index to prevent multiple non-cancelled invoices per job
-- This allows cancelled invoices to exist alongside active ones
DROP INDEX IF EXISTS idx_unique_job_order_invoice;
CREATE UNIQUE INDEX idx_unique_job_order_invoice 
ON invoices (job_order_id) 
WHERE job_order_id IS NOT NULL AND status != 'cancelled';

-- ============================================================
-- 2. AUTO-UPDATE ASSESSMENT STATUS
-- ============================================================

-- Function to update assessment status when job order is created
CREATE OR REPLACE FUNCTION update_assessment_on_job_created()
RETURNS trigger AS $$
BEGIN
    -- When a job order is created with an assessment_id, mark assessment as in_workshop
    IF NEW.assessment_id IS NOT NULL THEN
        UPDATE assessments 
        SET status = 'in_workshop'
        WHERE id = NEW.assessment_id 
        AND status != 'in_workshop';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on job order insert
DROP TRIGGER IF EXISTS trg_job_created_assessment ON job_orders;
CREATE TRIGGER trg_job_created_assessment
    AFTER INSERT ON job_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_assessment_on_job_created();

-- Function to update assessment when job order is delivered
CREATE OR REPLACE FUNCTION update_assessment_on_delivery()
RETURNS trigger AS $$
BEGIN
    -- When job order status changes to delivered
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        -- Update assessment if exists
        IF NEW.assessment_id IS NOT NULL THEN
            UPDATE assessments 
            SET status = 'received'
            WHERE id = NEW.assessment_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on job order delivery
DROP TRIGGER IF EXISTS trg_job_delivery_assessment ON job_orders;
CREATE TRIGGER trg_job_delivery_assessment
    AFTER UPDATE OF status ON job_orders
    FOR EACH ROW
    WHEN (NEW.status = 'delivered')
    EXECUTE FUNCTION update_assessment_on_delivery();

-- ============================================================
-- 3. ADD REVIEW SUBMISSION TRACKING
-- ============================================================

-- Add column to track when job was submitted for review
ALTER TABLE job_orders 
ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ;

ALTER TABLE job_orders 
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id);

-- ============================================================
-- 4. GRANT PERMISSIONS
-- ============================================================

-- Ensure RLS doesn't block trigger operations
GRANT EXECUTE ON FUNCTION update_assessment_on_job_created() TO authenticated;
GRANT EXECUTE ON FUNCTION update_assessment_on_delivery() TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
