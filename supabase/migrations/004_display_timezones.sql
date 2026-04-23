-- ─── 004: Display timezones for emails and public form ─────
-- Añade dos preferencias de display independientes de admin_timezone:
--   - email_display_tz: TZ que aparece en correos al paciente
--   - form_display_tz:  TZ que ven los visitantes en el formulario público
--
-- Por qué separadas de admin_timezone:
--   Silvana puede operar su panel en una zona (ej. Argentina, donde vive)
--   pero querer mostrar a pacientes la zona del negocio (Miami) o viceversa.
--   Cada contexto (panel / correo / formulario) se controla por separado
--   para maxima flexibilidad.
--
-- Importante: esto NO cambia cómo se guardan las reservas ni los horarios
-- laborales (working_hours siguen interpretándose en Miami = BASE_TZ del
-- sistema). Estas preferencias son puramente de display/etiqueta.
--
-- Default 'America/New_York' en ambas para preservar el comportamiento
-- previo al lanzamiento de admin_timezone.

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS email_display_tz TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS form_display_tz  TEXT NOT NULL DEFAULT 'America/New_York';

-- Bloque idempotente para los CHECK constraints: si ya existen (porque
-- una ejecución previa de esta migración llegó hasta aquí antes de fallar
-- en otro paso), los dropeamos y los volvemos a crear. Así la migración
-- se puede re-ejecutar sin errores si la primera corrida quedó a mitad.
ALTER TABLE admin_settings DROP CONSTRAINT IF EXISTS chk_email_display_tz_valid;
ALTER TABLE admin_settings DROP CONSTRAINT IF EXISTS chk_form_display_tz_valid;

ALTER TABLE admin_settings
  ADD CONSTRAINT chk_email_display_tz_valid CHECK (
    email_display_tz IN (
      'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
      'America/Argentina/Buenos_Aires','America/Argentina/Mendoza','America/Argentina/Cordoba',
      'America/Mexico_City','America/Bogota','America/Lima','America/Santiago','America/Caracas',
      'America/Guayaquil','America/La_Paz','America/Asuncion','America/Montevideo',
      'America/Sao_Paulo','Europe/Madrid'
    )
  ),
  ADD CONSTRAINT chk_form_display_tz_valid CHECK (
    form_display_tz IN (
      'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
      'America/Argentina/Buenos_Aires','America/Argentina/Mendoza','America/Argentina/Cordoba',
      'America/Mexico_City','America/Bogota','America/Lima','America/Santiago','America/Caracas',
      'America/Guayaquil','America/La_Paz','America/Asuncion','America/Montevideo',
      'America/Sao_Paulo','Europe/Madrid'
    )
  );

-- Extender get_public_contact para exponer form_display_tz al formulario
-- público. La RPC ya bypasea RLS vía SECURITY DEFINER solo para campos
-- publicables; añadimos form_display_tz porque la página pública necesita
-- saber en qué zona mostrar los slots.
-- (No exponemos email_display_tz porque eso solo aplica a correos, que se
-- gestionan en server code con permisos admin.)
--
-- Nota: CREATE OR REPLACE no sirve cuando cambia el tipo de retorno (Postgres
-- lo rechaza con 42P13). DROP + CREATE es el camino correcto para este caso.
DROP FUNCTION IF EXISTS get_public_contact();

CREATE FUNCTION get_public_contact()
RETURNS TABLE (
  contact_email   TEXT,
  contact_phone   TEXT,
  working_hours   JSONB,
  form_display_tz TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT contact_email, contact_phone, working_hours, form_display_tz
  FROM admin_settings
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_public_contact() TO anon, authenticated;
