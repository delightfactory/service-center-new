-- ============================================================
-- Create Settings Table for Service Center
-- This table stores application-wide settings including maintenance mode
-- ============================================================

-- Create settings table if not exists
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (public settings)
CREATE POLICY "Anyone can read settings" ON public.settings
    FOR SELECT
    USING (true);

-- Allow authenticated users to modify settings
-- (You can restrict this further based on your auth setup)
CREATE POLICY "Authenticated users can manage settings" ON public.settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert default maintenance_mode setting (disabled by default)
INSERT INTO public.settings (key, value, description)
VALUES ('maintenance_mode', 'false', 'Enable/disable maintenance mode for payment suspension')
ON CONFLICT (key) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_settings_updated_at ON public.settings;
CREATE TRIGGER trigger_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION update_settings_updated_at();

-- Grant permissions
GRANT SELECT ON public.settings TO anon;
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
