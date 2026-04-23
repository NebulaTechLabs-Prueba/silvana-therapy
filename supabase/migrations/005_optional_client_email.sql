-- ─── 005: Optional client email (WhatsApp-first contact) ───
-- Hasta ahora `clients.email` era NOT NULL, lo que obligaba a
-- inventar datos cuando Silvana importaba eventos de Google
-- Calendar sin invitado, o cuando un paciente solo coordina
-- por WhatsApp y nunca entregó correo.
--
-- Cambios:
--   1. email pasa a NULL permitido.
--   2. La UNIQUE constraint global sobre email se sustituye por
--      un índice único parcial que aplica solo cuando email IS NOT NULL.
--      Así múltiples clientes pueden tener email=NULL a la vez, pero
--      si lo tienen, sigue siendo único por cliente.
--   3. CHECK (email IS NOT NULL OR phone IS NOT NULL): todo cliente
--      debe tener AL MENOS un canal de contacto. Sin esto perderíamos
--      toda forma de comunicarnos.
--
-- Backfill: no hace falta — filas existentes con email no nulo siguen
-- cumpliendo el CHECK y el índice parcial.

-- Permitir NULL en email
ALTER TABLE clients
  ALTER COLUMN email DROP NOT NULL;

-- Sustituir la UNIQUE constraint sobre email por un índice parcial.
-- El nombre histórico del constraint en el baseline es `clients_email_key`
-- (generado automáticamente por UNIQUE en CREATE TABLE). Lo dropeamos
-- de forma segura con IF EXISTS para tolerar variantes.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique_when_set
  ON clients (email)
  WHERE email IS NOT NULL;

-- Exigir al menos un canal de contacto (email o phone).
-- Idempotente: si ya existe (re-run de la migración), se dropea primero.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_contact_present;

ALTER TABLE clients
  ADD CONSTRAINT chk_clients_contact_present CHECK (
    email IS NOT NULL OR phone IS NOT NULL
  );
