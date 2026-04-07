-- 007: Add client contact fields and booking association to invoices
-- Invoices can optionally be linked to a booking.
-- If not linked, client contact info is stored directly on the invoice.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS telefono  TEXT,
  ADD COLUMN IF NOT EXISTS cedula    TEXT,
  ADD COLUMN IF NOT EXISTS pais      TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
