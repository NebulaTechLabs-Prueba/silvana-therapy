-- ============================================================
-- Silvana López — Terapia Online
-- Migration 001: Initial Schema
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- =========================
-- 1. CUSTOM TYPES (ENUMS)
-- =========================

CREATE TYPE booking_status AS ENUM (
  'pending',           -- Cliente envió formulario, esperando revisión
  'accepted',          -- Silvana aceptó, esperando pago (si aplica)
  'payment_pending',   -- Link de pago enviado, esperando confirmación
  'confirmed',         -- Pagado o gratuito, cita confirmada
  'rescheduled',       -- Cita fue reagendada (se mantiene confirmed)
  'completed',         -- Sesión realizada
  'rejected',          -- Silvana rechazó la solicitud
  'cancelled',         -- Cliente o Silvana canceló
  'expired'            -- Payment link expiró sin pago
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'completed',
  'failed'
);

CREATE TYPE payment_provider AS ENUM (
  'stripe',
  'paypal'
);

CREATE TYPE payment_link_status AS ENUM (
  'active',
  'paid',
  'expired',
  'cancelled'
);

-- =========================
-- 2. TABLES
-- =========================

-- ── Clients ──────────────────────────────────────────────────
-- No auth. Public-facing data collected from booking form.
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  country     TEXT,
  reason      TEXT,              -- Motivo de consulta (texto libre)
  is_returning BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup when checking if client is returning
CREATE INDEX idx_clients_email ON clients(email);

-- ── Services ─────────────────────────────────────────────────
-- Configurable by admin. Initially: "Primera consulta gratuita"
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  duration_min INTEGER NOT NULL DEFAULT 50,
  is_free      BOOLEAN DEFAULT FALSE,
  active       BOOLEAN DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed the initial service
INSERT INTO services (name, description, duration_min, is_free, active, sort_order)
VALUES (
  'Primera consulta gratuita',
  'Sesión inicial sin costo para conocernos y evaluar cómo puedo acompañarte.',
  50,
  TRUE,
  TRUE,
  1
);

INSERT INTO services (name, description, duration_min, is_free, active, sort_order)
VALUES (
  'Sesión de terapia',
  'Sesión de psicoterapia online personalizada.',
  50,
  FALSE,
  TRUE,
  2
);

-- ── Bookings ─────────────────────────────────────────────────
CREATE TABLE bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  status           booking_status NOT NULL DEFAULT 'pending',
  
  -- Scheduling
  preferred_date   TIMESTAMPTZ,       -- Fecha que el cliente prefiere
  confirmed_date   TIMESTAMPTZ,       -- Fecha que Silvana confirma
  original_date    TIMESTAMPTZ,       -- Se llena si se reagenda (guarda la anterior)
  
  -- Payment (set by Silvana)
  agreed_price     DECIMAL(10,2),     -- NULL = gratis
  payment_provider payment_provider,  -- stripe | paypal (chosen by Silvana when creating link)
  
  -- Google Calendar
  google_event_id  TEXT,
  
  -- Metadata
  is_first_session BOOLEAN DEFAULT TRUE,
  admin_notes      TEXT,
  rejection_reason TEXT,
  idempotency_key  TEXT UNIQUE,       -- Prevents duplicate submissions
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_client   ON bookings(client_id);
CREATE INDEX idx_bookings_status   ON bookings(status);
CREATE INDEX idx_bookings_date     ON bookings(confirmed_date);

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider          payment_provider NOT NULL,
  provider_tx_id    TEXT UNIQUE,      -- Stripe payment_intent ID or PayPal order ID
  
  amount            DECIMAL(10,2) NOT NULL,
  surcharge_pct     DECIMAL(5,2) DEFAULT 0,  -- 10 for PayPal
  total             DECIMAL(10,2) NOT NULL,
  currency          TEXT DEFAULT 'USD',
  
  status            payment_status NOT NULL DEFAULT 'pending',
  provider_metadata JSONB DEFAULT '{}',
  
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_booking  ON payments(booking_id);
CREATE INDEX idx_payments_provider ON payments(provider_tx_id);

-- ── Payment Links ────────────────────────────────────────────
-- Silvana generates these from admin panel
CREATE TABLE payment_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider         payment_provider NOT NULL,
  provider_link_id TEXT,             -- Stripe payment_link ID or PayPal order ID
  url              TEXT NOT NULL,
  
  amount           DECIMAL(10,2) NOT NULL,
  surcharge_pct    DECIMAL(5,2) DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  
  status           payment_link_status NOT NULL DEFAULT 'active',
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_links_booking ON payment_links(booking_id);

-- ── Admin Settings ───────────────────────────────────────────
-- Single row, always id = 1. Config for the whole system.
CREATE TABLE admin_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_price        DECIMAL(10,2) DEFAULT 60.00,
  paypal_surcharge_pct DECIMAL(5,2) DEFAULT 10.00,
  notification_email   TEXT DEFAULT 'info@terapiasilvanalopez.com',
  google_calendar_id   TEXT,
  working_hours        JSONB DEFAULT '{
    "monday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "tuesday":   {"start": "09:00", "end": "18:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "thursday":  {"start": "09:00", "end": "18:00", "enabled": true},
    "friday":    {"start": "09:00", "end": "14:00", "enabled": true},
    "saturday":  {"start": "00:00", "end": "00:00", "enabled": false},
    "sunday":    {"start": "00:00", "end": "00:00", "enabled": false}
  }',
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO admin_settings (default_price, paypal_surcharge_pct, notification_email)
VALUES (60.00, 10.00, 'info@terapiasilvanalopez.com');

-- =========================
-- 3. AUTO-UPDATE TIMESTAMPS
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_admin_settings_updated
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================
-- 4. DETECT RETURNING CLIENT
-- =========================
-- When a new booking is created, check if the client has
-- any previous CONFIRMED booking. If so, mark is_first_session = false.

CREATE OR REPLACE FUNCTION check_first_session()
RETURNS TRIGGER AS $$
DECLARE
  has_previous BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE client_id = NEW.client_id
      AND id != NEW.id
      AND status IN ('confirmed', 'completed', 'rescheduled')
  ) INTO has_previous;
  
  IF has_previous THEN
    NEW.is_first_session = FALSE;
  END IF;
  
  -- Also update client.is_returning
  UPDATE clients SET is_returning = has_previous WHERE id = NEW.client_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_first_session
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_first_session();

-- =========================
-- 5. AUTO-EXPIRE PAYMENT LINKS
-- =========================
-- This can be called by a cron job (Supabase pg_cron or external)

CREATE OR REPLACE FUNCTION expire_payment_links()
RETURNS void AS $$
BEGIN
  UPDATE payment_links
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();
    
  -- Also update related bookings
  UPDATE bookings
  SET status = 'expired'
  WHERE status = 'payment_pending'
    AND id IN (
      SELECT DISTINCT booking_id FROM payment_links
      WHERE status = 'expired'
    )
    AND id NOT IN (
      SELECT DISTINCT booking_id FROM payment_links
      WHERE status = 'active'
    );
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 6. ROW LEVEL SECURITY (RLS)
-- =========================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- ── Public access: anon can read active services ─────────────
CREATE POLICY "Anyone can read active services"
  ON services FOR SELECT
  USING (active = TRUE);

-- ── Public access: anon can insert clients ────────────────────
CREATE POLICY "Anyone can create a client"
  ON clients FOR INSERT
  WITH CHECK (TRUE);

-- ── Public access: anon can insert bookings ───────────────────
CREATE POLICY "Anyone can create a booking"
  ON bookings FOR INSERT
  WITH CHECK (TRUE);

-- ── Admin: full access to everything ──────────────────────────
-- Uses Supabase auth.uid() to check if user is authenticated admin

CREATE POLICY "Admin full access clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access services"
  ON services FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access bookings"
  ON bookings FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access payments"
  ON payments FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access payment_links"
  ON payment_links FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access settings"
  ON admin_settings FOR ALL
  USING (auth.role() = 'authenticated');

-- ── Service role bypass (for API routes with service key) ─────
-- The service_role key bypasses RLS automatically in Supabase.
-- We use it in server-side API routes for webhook processing.

-- =========================
-- 7. ENABLE pg_cron FOR LINK EXPIRY (optional)
-- =========================
-- Uncomment if pg_cron is enabled in your Supabase project:
-- SELECT cron.schedule('expire-payment-links', '*/30 * * * *', 'SELECT expire_payment_links()');
