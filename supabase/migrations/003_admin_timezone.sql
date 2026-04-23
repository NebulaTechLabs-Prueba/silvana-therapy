-- ─── 003: Admin timezone preference ────────────────────────
-- Permite que el admin (Silvana) elija la zona horaria en la
-- que ve su agenda en el panel y en la que interpreta las
-- horas que teclea al crear/editar reservas.
--
-- Default: 'America/New_York' (Miami) — zona del negocio.
-- Caso real que motivó la migración: Silvana opera desde
-- Argentina (Mendoza, UTC-3). Sin esta preferencia las horas
-- del panel se muestran en UTC y las reservas importadas de
-- su Google Calendar aparecen con la hora "equivocada" a su
-- ojo.
--
-- Dónde se usa:
--   - Panel admin: lectura (formatInTz) y escritura (combineToUtc)
--   - Preview del import de Google Calendar
--   - No afecta emails al cliente (esos usan TZ del cliente +
--     Miami como referencia, independiente de esta preferencia)

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS admin_timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- Soft-validation por constraint: lista común de TZs válidas
-- para el admin. Se puede ampliar en migraciones futuras si
-- hace falta más cobertura.
ALTER TABLE admin_settings
  ADD CONSTRAINT chk_admin_timezone_valid CHECK (
    admin_timezone IN (
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Argentina/Buenos_Aires',
      'America/Argentina/Mendoza',
      'America/Argentina/Cordoba',
      'America/Mexico_City',
      'America/Bogota',
      'America/Lima',
      'America/Santiago',
      'America/Caracas',
      'America/Guayaquil',
      'America/La_Paz',
      'America/Asuncion',
      'America/Montevideo',
      'America/Sao_Paulo',
      'Europe/Madrid'
    )
  );
