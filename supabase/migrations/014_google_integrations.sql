-- ============================================================
-- 014_google_integrations.sql
-- ------------------------------------------------------------
-- Almacena los tokens OAuth del administrador para Google
-- Calendar + Meet. Una sola fila por ahora (Silvana).
--
-- Notas:
-- - Los tokens son sensibles: acceso restringido a service_role.
-- - No exponer a anon/authenticated: toda escritura/lectura va
--   por server actions y route handlers que usan admin client.
-- ============================================================

CREATE TABLE IF NOT EXISTS google_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Email de la cuenta Google conectada (display y sanity check)
  account_email   TEXT NOT NULL,
  -- Tokens OAuth
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_type      TEXT DEFAULT 'Bearer',
  scope           TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  -- Calendar preferido (usualmente 'primary')
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  google_integrations IS 'OAuth tokens de Google Calendar/Meet del admin. Solo accesible vía service_role.';
COMMENT ON COLUMN google_integrations.refresh_token IS 'Refresh token de larga duración — NO exponer al cliente';
COMMENT ON COLUMN google_integrations.expires_at    IS 'Expiración del access_token; se refresca automáticamente';

-- RLS: ninguna política permisiva; solo service_role accede.
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

-- Solo debe existir una fila activa. Trigger + constraint parcial.
CREATE UNIQUE INDEX IF NOT EXISTS google_integrations_single_row
  ON google_integrations ((true));

CREATE OR REPLACE FUNCTION touch_google_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_google_integrations_updated ON google_integrations;
CREATE TRIGGER trg_google_integrations_updated
  BEFORE UPDATE ON google_integrations
  FOR EACH ROW EXECUTE FUNCTION touch_google_integrations_updated_at();
