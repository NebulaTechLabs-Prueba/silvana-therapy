-- ============================================================
-- Migration 004: Admin Links, Booking Preferences, Security Q&A
-- ============================================================
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Admin links/tutorials table
CREATE TABLE IF NOT EXISTS admin_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access admin_links"
    ON admin_links FOR ALL
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Booking preferred payment method
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_payment TEXT;

-- 3. Security question/answer in admin_settings
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS security_question TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS security_answer TEXT;
