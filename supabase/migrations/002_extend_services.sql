-- ============================================================
-- Migration 002: Extend Services Table
-- ============================================================
-- Adds fields needed for the public services page and detail view.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─── New columns ─────────────────────────────────────────────
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug         TEXT UNIQUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS subtitle     TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tag          TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS type_label   TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price        TEXT;            -- Display price ("45", "Gratis")
ALTER TABLE services ADD COLUMN IF NOT EXISTS modality     TEXT DEFAULT 'Online · Videollamada';
ALTER TABLE services ADD COLUMN IF NOT EXISTS features     JSONB DEFAULT '[]';

-- ─── Index for slug lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);

-- ─── Update existing seed data ───────────────────────────────

-- Primera consulta gratuita
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

-- Sesión de terapia
UPDATE services
SET
  slug       = 'terapia-individual',
  subtitle   = 'Sesión personalizada de 50 min',
  tag        = 'Proceso individual',
  type_label = 'Proceso continuo',
  price      = '45',
  features   = '["Sesión personalizada de 50 minutos", "Enfoque integrativo (TCC, Mindfulness, ACT)", "Plan terapéutico a medida", "Herramientas prácticas para el día a día", "Seguimiento entre sesiones"]'::jsonb
WHERE is_free = FALSE AND name = 'Sesión de terapia';

-- ─── Insert additional services ──────────────────────────────

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
