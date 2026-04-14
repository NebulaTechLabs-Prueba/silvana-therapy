-- ============================================================
-- 015_smtp.sql
-- ------------------------------------------------------------
-- Reemplaza las columnas específicas de Resend por un esquema
-- genérico SMTP. Motivo: el dominio está registrado en Wix con
-- bloqueo ICANN de 60 días, lo que impedía verificar el dominio
-- en Resend dentro del tiempo de entrega. Brevo (antes Sendinblue)
-- permite enviar por SMTP estándar sin forzar verificación DNS
-- con registros MX en subdominios, y es intercambiable con
-- cualquier otro proveedor SMTP (Mailgun, Postmark, SES, Zoho, etc).
--
-- Esta migración:
--   1. Añade columnas smtp_* en admin_settings.
--   2. Copia resend_from_email/name → smtp_from_email/name si existen.
--   3. Deja las columnas resend_* en la tabla por compatibilidad
--      hacia atrás (no se usan — el código sólo lee smtp_*).
--      Pueden dropearse en una migración posterior si se desea.
-- ============================================================

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS smtp_host       TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port       INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user       TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password   TEXT,
  ADD COLUMN IF NOT EXISTS smtp_from_email TEXT,
  ADD COLUMN IF NOT EXISTS smtp_from_name  TEXT,
  ADD COLUMN IF NOT EXISTS smtp_secure     BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN admin_settings.smtp_host       IS 'Host SMTP (ej. smtp-relay.brevo.com)';
COMMENT ON COLUMN admin_settings.smtp_port       IS 'Puerto SMTP (587 STARTTLS, 465 TLS)';
COMMENT ON COLUMN admin_settings.smtp_user       IS 'Login SMTP (usuario)';
COMMENT ON COLUMN admin_settings.smtp_password   IS 'Clave SMTP — sensible, sólo servidor';
COMMENT ON COLUMN admin_settings.smtp_from_email IS 'Email remitente por defecto';
COMMENT ON COLUMN admin_settings.smtp_from_name  IS 'Nombre amigable del remitente';
COMMENT ON COLUMN admin_settings.smtp_secure     IS 'TRUE si el puerto es 465 (TLS directo); FALSE para 587 (STARTTLS)';

-- Migrar el remitente si ya estaba configurado con Resend
UPDATE admin_settings
  SET smtp_from_email = COALESCE(smtp_from_email, resend_from_email),
      smtp_from_name  = COALESCE(smtp_from_name,  resend_from_name)
  WHERE resend_from_email IS NOT NULL OR resend_from_name IS NOT NULL;
