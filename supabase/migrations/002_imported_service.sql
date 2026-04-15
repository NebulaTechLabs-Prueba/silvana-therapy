-- ─── 002: Imported service flag ────────────────────────────
-- Añade un flag para marcar servicios internos que no deben
-- aparecer en el sitio público (/services, /booking), pero sí
-- están disponibles para uso interno del dashboard.
-- Caso de uso: servicio "placeholder" para bookings importadas
-- desde Google Calendar que no tienen un servicio conocido.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

-- Servicio semilla para imports de Google Calendar.
-- Idempotente vía slug UNIQUE.
INSERT INTO services (name, slug, description, duration_min, price, is_free, active, is_internal, sort_order, modality, features, color)
VALUES (
  'Importado de Google Calendar',
  'imported-google',
  'Servicio placeholder para eventos importados desde Google Calendar cuyo servicio original se desconoce. Editable por el administrador.',
  50,
  NULL,
  FALSE,
  TRUE,
  TRUE,
  9999,
  'Online · Videollamada',
  '[]'::jsonb,
  '#849884'
)
ON CONFLICT (slug) DO UPDATE SET
  is_internal = TRUE,
  active = TRUE;
