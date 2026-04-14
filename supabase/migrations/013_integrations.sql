-- ============================================================
-- 013_integrations.sql
-- ------------------------------------------------------------
-- Añade configuración de integraciones y plantillas WhatsApp.
--
-- 1. admin_settings.resend_api_key / resend_from_email / resend_from_name
--    → credenciales y remitente para el proveedor de correo (Resend).
-- 2. admin_settings.wa_templates JSONB
--    → plantillas de WhatsApp por evento. Soporta variables {cliente},
--      {servicio}, {fecha}, {hora}, {precio}, {link}, {motivo}.
-- 3. Semilla inicial con plantillas por defecto en español.
-- ============================================================

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS resend_api_key     TEXT,
  ADD COLUMN IF NOT EXISTS resend_from_email  TEXT,
  ADD COLUMN IF NOT EXISTS resend_from_name   TEXT,
  ADD COLUMN IF NOT EXISTS wa_templates       JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN admin_settings.resend_api_key    IS 'API key de Resend (sólo servidor)';
COMMENT ON COLUMN admin_settings.resend_from_email IS 'Remitente verificado en Resend';
COMMENT ON COLUMN admin_settings.resend_from_name  IS 'Nombre amigable del remitente';
COMMENT ON COLUMN admin_settings.wa_templates      IS 'Plantillas WA por evento. Variables: {cliente} {servicio} {fecha} {hora} {precio} {link} {motivo}';

-- Plantillas por defecto (sólo si el registro aún no las tiene)
UPDATE admin_settings
SET wa_templates = jsonb_build_object(
  'booking_received',
    'Hola {cliente} 👋 Recibí tu solicitud de *{servicio}* para el {fecha} a las {hora}. Te confirmo en breve.',
  'booking_confirmed',
    'Hola {cliente} ✅ Tu cita de *{servicio}* queda confirmada para el {fecha} a las {hora} (hora Miami). ¡Nos vemos!',
  'payment_link',
    'Hola {cliente} 💳 Aquí está tu enlace de pago para *{servicio}*: {link}. Monto: {precio} USD.',
  'reschedule',
    'Hola {cliente} 🔁 Tu cita de *{servicio}* fue reprogramada para el {fecha} a las {hora}. Cualquier duda, avísame.',
  'reminder_24h',
    'Hola {cliente} ⏰ Te recuerdo tu cita de *{servicio}* mañana {fecha} a las {hora} (hora Miami).',
  'custom',
    'Hola {cliente}, '
)
WHERE wa_templates IS NULL OR wa_templates = '{}'::jsonb;
