-- 006: Add public contact info fields to admin_settings
-- These are displayed on the home page contact section and can be
-- changed from the dashboard configuration panel.

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'info@terapiasilvanalopez.com',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '+1 754 308 0643';
