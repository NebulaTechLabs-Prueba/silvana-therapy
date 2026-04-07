-- 005: Add client_local_time to bookings + flexible payment_links relationship
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add client_local_time field to bookings
--    Stores the session time converted to the client's timezone (e.g., "11:00")
--    alongside the country context. preferred_date remains in Argentina time.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS client_local_time TEXT,
  ADD COLUMN IF NOT EXISTS preferred_payment TEXT;

-- preferred_payment may already exist from migration 004; IF NOT EXISTS handles that.

-- 2. Make payment_links.booking_id nullable and change to SET NULL on delete.
--    This allows:
--    - A payment link to exist without a booking (standalone link)
--    - Deleting a booking without force-deleting its payment links
ALTER TABLE payment_links
  ALTER COLUMN booking_id DROP NOT NULL;

-- Drop the old CASCADE constraint and recreate with SET NULL
ALTER TABLE payment_links
  DROP CONSTRAINT IF EXISTS payment_links_booking_id_fkey;

ALTER TABLE payment_links
  ADD CONSTRAINT payment_links_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
