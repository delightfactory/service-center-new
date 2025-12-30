-- ============================================================
-- Migration: Job Time Logs (تتبع الوقت)
-- ============================================================
-- جدول لتسجيل وقت عمل الفنيين على أوامر الشغل
-- ============================================================

-- Create job_time_logs table
CREATE TABLE IF NOT EXISTS job_time_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_order_id uuid NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    technician_id uuid NOT NULL REFERENCES profiles(id),
    
    -- Time tracking
    clock_in timestamptz NOT NULL DEFAULT now(),
    clock_out timestamptz,
    
    -- Duration in minutes (calculated or manual)
    duration_minutes integer GENERATED ALWAYS AS (
        CASE 
            WHEN clock_out IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60
            ELSE NULL 
        END::integer
    ) STORED,
    
    -- Notes
    notes text,
    
    -- Activity type
    activity_type text DEFAULT 'work', -- work, break, wait_parts, etc.
    
    -- Tracking
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_time_logs_job_order ON job_time_logs(job_order_id);
CREATE INDEX IF NOT EXISTS idx_job_time_logs_technician ON job_time_logs(technician_id);
CREATE INDEX IF NOT EXISTS idx_job_time_logs_clock_in ON job_time_logs(clock_in DESC);

-- Comments
COMMENT ON TABLE job_time_logs IS 'سجلات وقت عمل الفنيين على أوامر الشغل';
COMMENT ON COLUMN job_time_logs.clock_in IS 'وقت بدء العمل';
COMMENT ON COLUMN job_time_logs.clock_out IS 'وقت انتهاء العمل';
COMMENT ON COLUMN job_time_logs.duration_minutes IS 'المدة بالدقائق (محسوبة تلقائياً)';
COMMENT ON COLUMN job_time_logs.activity_type IS 'نوع النشاط: work, break, wait_parts';

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE job_time_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view time logs
CREATE POLICY "job_time_logs_select_policy" ON job_time_logs
    FOR SELECT TO authenticated
    USING (true);

-- Allow authenticated users to insert time logs
CREATE POLICY "job_time_logs_insert_policy" ON job_time_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow technicians to update their own time logs
CREATE POLICY "job_time_logs_update_policy" ON job_time_logs
    FOR UPDATE TO authenticated
    USING (technician_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'supervisor')
    ));

-- ============================================================
-- Helper function to get active clock-in
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_clock_in(p_job_order_id uuid, p_technician_id uuid)
RETURNS uuid AS $$
DECLARE
    v_log_id uuid;
BEGIN
    SELECT id INTO v_log_id
    FROM job_time_logs
    WHERE job_order_id = p_job_order_id
      AND technician_id = p_technician_id
      AND clock_out IS NULL
    ORDER BY clock_in DESC
    LIMIT 1;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger to update job_orders.actual_hours
-- ============================================================
CREATE OR REPLACE FUNCTION update_job_order_actual_hours()
RETURNS trigger AS $$
DECLARE
    v_total_hours numeric;
BEGIN
    -- Calculate total hours for the job order
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) INTO v_total_hours
    FROM job_time_logs
    WHERE job_order_id = COALESCE(NEW.job_order_id, OLD.job_order_id)
      AND clock_out IS NOT NULL;
    
    -- Update job order
    UPDATE job_orders
    SET actual_hours = v_total_hours,
        updated_at = now()
    WHERE id = COALESCE(NEW.job_order_id, OLD.job_order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_job_order_hours ON job_time_logs;
CREATE TRIGGER trg_update_job_order_hours
    AFTER INSERT OR UPDATE OF clock_out OR DELETE ON job_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_order_actual_hours();
