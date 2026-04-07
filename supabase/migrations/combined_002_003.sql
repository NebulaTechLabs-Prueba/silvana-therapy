-- ============================================================
-- COMBINED Migration 002 + 003
-- ============================================================
-- Paste this entire script into Supabase Dashboard > SQL Editor
-- and click "Run" to execute both migrations at once.
-- ============================================================

-- ============================================================
-- Migration 002: Extend Services Table
-- ============================================================

-- New columns
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug         TEXT UNIQUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS subtitle     TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tag          TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS type_label   TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price        TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS modality     TEXT DEFAULT 'Online · Videollamada';
ALTER TABLE services ADD COLUMN IF NOT EXISTS features     JSONB DEFAULT '[]';

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);

-- Update existing seed data: Primera consulta gratuita
UPDATE services
SET
  slug       = 'consulta-gratis',
  subtitle   = 'Sin cargo · Sin compromiso',
  tag        = 'Consulta inicial',
  type_label = 'Sin cargo',
  price      = 'Gratis',
  duration_min = 30,
  features   = '["Conversación inicial sin costo ni compromiso", "Evaluación de tu situación actual", "Orientación sobre el proceso terapéutico", "Espacio seguro y confidencial", "Definición de objetivos iniciales"]'::jsonb
WHERE is_free = TRUE AND name = 'Primera consulta gratuita';

-- Update existing seed data: Sesión de terapia
UPDATE services
SET
  slug       = 'terapia-individual',
  subtitle   = 'Sesión personalizada de 50 min',
  tag        = 'Proceso individual',
  type_label = 'Proceso continuo',
  price      = '45',
  features   = '["Sesión personalizada de 50 minutos", "Enfoque integrativo (TCC, Mindfulness, ACT)", "Plan terapéutico a medida", "Herramientas prácticas para el día a día", "Seguimiento entre sesiones"]'::jsonb
WHERE is_free = FALSE AND name = 'Sesión de terapia';

-- Insert additional services
INSERT INTO services (name, slug, subtitle, tag, type_label, description, duration_min, price, is_free, active, sort_order, features)
VALUES (
  'Terapia de Pareja',
  'terapia-pareja',
  'Sesión conjunta de 60 min',
  'Pareja',
  'Sesión conjunta',
  'Espacio conjunto para trabajar la comunicación, resolver conflictos y fortalecer el vínculo de pareja.',
  60,
  '60',
  FALSE,
  TRUE,
  3,
  '["Sesión conjunta de 60 minutos", "Trabajo en comunicación y resolución de conflictos", "Herramientas para fortalecer el vínculo", "Ambiente neutral y profesional", "Plan de trabajo conjunto"]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO services (name, slug, subtitle, tag, type_label, description, duration_min, price, is_free, active, sort_order, features)
VALUES (
  'Sesión de Seguimiento',
  'seguimiento',
  'Para pacientes activos · 50 min',
  'Pacientes activos',
  'Solo pacientes activos',
  'Para pacientes que ya están en proceso terapéutico y necesitan continuar con su acompañamiento regular.',
  50,
  '40',
  FALSE,
  TRUE,
  4,
  '["Continuidad de tu proceso terapéutico", "Revisión de progreso y objetivos", "Profundización en temas actuales", "Ajuste de estrategias según evolución", "Acompañamiento constante"]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Migration 003: Dashboard Tables & Extensions
-- ============================================================

-- 1. Extend services with color
ALTER TABLE services ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4a7a4a';

-- 2. Invoice status enum
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pendiente', 'pagada', 'vencida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente      TEXT NOT NULL,
  email         TEXT,
  concepto      TEXT NOT NULL DEFAULT 'Sesión individual',
  monto         DECIMAL(10,2) NOT NULL,
  estado        invoice_status NOT NULL DEFAULT 'pendiente',
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  link          TEXT,
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_estado ON invoices(estado);
CREATE INDEX IF NOT EXISTS idx_invoices_fecha  ON invoices(fecha);

-- Auto-update timestamps (only if trigger doesn't exist)
DO $$ BEGIN
  CREATE TRIGGER trg_invoices_updated
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Payment method type enum
DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('Transferencia', 'Tarjeta', 'PayPal', 'Efectivo', 'Otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              payment_method_type NOT NULL DEFAULT 'Transferencia',
  nombre            TEXT NOT NULL,
  banco             TEXT,
  titular           TEXT,
  cuenta_visible    TEXT,
  cuenta_completa   TEXT,
  moneda            TEXT DEFAULT 'USD',
  tiempo_confirm    TEXT DEFAULT '24–48h',
  instrucciones     TEXT,
  notas_internas    TEXT,
  correo_proveedor  TEXT,
  comision          TEXT,
  estado_conexion   TEXT DEFAULT 'desconectado',
  monedas_aceptadas TEXT DEFAULT 'USD',
  pagos_recurrentes BOOLEAN DEFAULT FALSE,
  clave_publica     TEXT,
  clave_secreta     TEXT,
  id_comercio       TEXT,
  tipo_cuenta       TEXT,
  tiempo_acredit    TEXT DEFAULT 'Instantáneo',
  politica_reembolso TEXT,
  activo            BOOLEAN DEFAULT TRUE,
  prioridad         INTEGER DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_activo ON payment_methods(activo);

DO $$ BEGIN
  CREATE TRIGGER trg_payment_methods_updated
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Admin profile columns
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS nombre       TEXT DEFAULT 'Lda. Silvana López';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS especialidad TEXT DEFAULT 'Psicoterapia Online';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS cedula       TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS telefono     TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS direccion    TEXT DEFAULT 'Consulta Online';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS horario      TEXT DEFAULT 'Lun-Vie 9:00-18:00';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS bio          TEXT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS notepad      TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS nickname     TEXT DEFAULT 'Silvana';

-- 7. RLS policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access invoices"
    ON invoices FOR ALL
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full access payment_methods"
    ON payment_methods FOR ALL
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Seed default payment methods
INSERT INTO payment_methods (tipo, nombre, banco, titular, cuenta_visible, moneda, activo, prioridad)
VALUES
  ('Transferencia', 'Transferencia bancaria', '', '', '', 'USD', false, 1),
  ('Tarjeta', 'Tarjeta (Stripe)', 'Stripe', '', '', 'USD', false, 2),
  ('PayPal', 'PayPal', 'PayPal', '', '', 'USD', false, 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration 004: Admin Links, Booking Preferences, Security Q&A
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
