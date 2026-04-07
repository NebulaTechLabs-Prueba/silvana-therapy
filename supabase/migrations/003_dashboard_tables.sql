-- ============================================================
-- Migration 003: Dashboard Tables & Extensions
-- ============================================================
-- Adds tables required by the admin dashboard:
--   • invoices — Facturación
--   • payment_methods — Métodos de pago (config + API keys)
--   • admin_profile — Perfil profesional
--   • Extends services with `color` column
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- =========================
-- 1. EXTEND SERVICES TABLE
-- =========================

ALTER TABLE services ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4a7a4a';

-- =========================
-- 2. INVOICE STATUS ENUM
-- =========================

CREATE TYPE invoice_status AS ENUM (
  'pendiente',
  'pagada',
  'vencida',
  'cancelada'
);

-- =========================
-- 3. INVOICES TABLE
-- =========================

CREATE TABLE invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente      TEXT NOT NULL,                    -- Patient name
  email         TEXT,                             -- Patient email (for sending)
  concepto      TEXT NOT NULL DEFAULT 'Sesión individual',
  monto         DECIMAL(10,2) NOT NULL,
  estado        invoice_status NOT NULL DEFAULT 'pendiente',
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  link          TEXT,                             -- Payment link URL
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoices_estado ON invoices(estado);
CREATE INDEX idx_invoices_fecha  ON invoices(fecha);

-- Auto-update timestamps
CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================
-- 4. PAYMENT METHODS CONFIG
-- =========================

CREATE TYPE payment_method_type AS ENUM (
  'Transferencia',
  'Tarjeta',
  'PayPal',
  'Efectivo',
  'Otro'
);

CREATE TABLE payment_methods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              payment_method_type NOT NULL DEFAULT 'Transferencia',
  nombre            TEXT NOT NULL,
  banco             TEXT,
  titular           TEXT,

  -- Account display
  cuenta_visible    TEXT,                         -- Masked: **** 4521
  cuenta_completa   TEXT,                         -- Full IBAN or acct ID (encrypted at rest)

  -- Currency & timing
  moneda            TEXT DEFAULT 'USD',
  tiempo_confirm    TEXT DEFAULT '24–48h',
  instrucciones     TEXT,
  notas_internas    TEXT,

  -- Provider-specific (Stripe / PayPal)
  correo_proveedor  TEXT,                         -- Provider account email
  comision          TEXT,                         -- "2.9% + $0.30"
  estado_conexion   TEXT DEFAULT 'desconectado',  -- conectado / desconectado
  monedas_aceptadas TEXT DEFAULT 'USD',
  pagos_recurrentes BOOLEAN DEFAULT FALSE,

  -- API Keys (encrypted at rest by Supabase)
  clave_publica     TEXT,                         -- Stripe publishable key / PayPal client ID
  clave_secreta     TEXT,                         -- Stripe secret key / PayPal secret
  id_comercio       TEXT,                         -- PayPal merchant ID

  -- PayPal-specific
  tipo_cuenta       TEXT,                         -- Personal / Business
  tiempo_acredit    TEXT DEFAULT 'Instantáneo',
  politica_reembolso TEXT,

  -- Status & ordering
  activo            BOOLEAN DEFAULT TRUE,
  prioridad         INTEGER DEFAULT 1,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_methods_activo ON payment_methods(activo);

CREATE TRIGGER trg_payment_methods_updated
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================
-- 5. ADMIN PROFILE
-- =========================
-- Extends admin_settings with professional profile fields
-- used by the "Mi Cuenta" tab in the dashboard.

ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS nombre       TEXT DEFAULT 'Lda. Silvana López';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS especialidad TEXT DEFAULT 'Psicoterapia Online';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS cedula       TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS telefono     TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS direccion    TEXT DEFAULT 'Consulta Online';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS horario      TEXT DEFAULT 'Lun-Vie 9:00-18:00';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS bio          TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS notepad      TEXT DEFAULT '';

-- =========================
-- 6. RLS POLICIES
-- =========================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access payment_methods"
  ON payment_methods FOR ALL
  USING (auth.role() = 'authenticated');

-- =========================
-- 7. SEED DEFAULT PAYMENT METHODS
-- =========================

INSERT INTO payment_methods (tipo, nombre, banco, titular, cuenta_visible, moneda, activo, prioridad)
VALUES
  ('Transferencia', 'Transferencia bancaria', '', '', '', 'USD', false, 1),
  ('Tarjeta', 'Tarjeta (Stripe)', 'Stripe', '', '', 'USD', false, 2),
  ('PayPal', 'PayPal', 'PayPal', '', '', 'USD', false, 3);
