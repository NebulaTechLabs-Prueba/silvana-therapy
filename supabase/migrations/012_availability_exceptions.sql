-- ============================================================
-- Migration 012: Availability, Exceptions & Booking Metadata
-- ============================================================
-- Bloque 1 — Gestión de Disponibilidad y Excepciones.
-- Bloque 3 — Prep para Google Calendar/Meet (tablas + columnas).
--
-- Cambios principales:
--   1. bookings: drop columnas muertas (agreed_price, payment_provider)
--      y add meet_link, reminder_channels, reminder_sent_at.
--   2. admin_settings: drop horario (derivable) + transform working_hours
--      a formato multi-rango (máx 3 por día).
--   3. payment_link_status: add 'failed'.
--   4. booking_events: tabla de auditoría.
--   5. availability_exceptions + availability_exception_dates.
--   6. google_external_events (eventos externos que bloquean slots).
--   7. get_active_exceptions() y check_slot_conflicts() RPCs.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BOOKINGS: cleanup + Google/notificación metadata
-- ─────────────────────────────────────────────────────────────

-- Drop columnas legacy no usadas en producción.
-- agreed_price: Silvana gestiona pagos vía payment_links (N por booking).
-- payment_provider: su función la cumple preferred_payment (TEXT libre).
ALTER TABLE bookings DROP COLUMN IF EXISTS agreed_price;
ALTER TABLE bookings DROP COLUMN IF EXISTS payment_provider;

-- Nuevas columnas para Google Meet + recordatorios.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS meet_link         TEXT,
  ADD COLUMN IF NOT EXISTS reminder_channels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reminder_sent_at  TIMESTAMPTZ;

COMMENT ON COLUMN bookings.meet_link         IS 'Google Meet URL (se llena al confirmar si la integración Google está activa)';
COMMENT ON COLUMN bookings.reminder_channels IS 'Canales por los que el cliente acepta recordatorios: email, whatsapp';
COMMENT ON COLUMN bookings.reminder_sent_at  IS 'Timestamp del último recordatorio 24h enviado';
COMMENT ON COLUMN bookings.google_event_id   IS 'ID del evento en Google Calendar (bidirectional sync)';
COMMENT ON COLUMN bookings.rejection_reason  IS 'Motivo libre de rechazo/cancelación — opcional, se usa en plantilla de correo';

-- ─────────────────────────────────────────────────────────────
-- 2. ADMIN_SETTINGS: drop horario + working_hours multi-rango
-- ─────────────────────────────────────────────────────────────

-- El campo horario era una versión cacheada en texto de working_hours
-- ("Lun 9-18, Mar 9-18, ..."). Redundante — lo derivamos en TS.
ALTER TABLE admin_settings DROP COLUMN IF EXISTS horario;

-- Transformar working_hours:
--   ANTES: { monday: { start, end, enabled } }
--   AHORA: { monday: { enabled, ranges: [ { start, end } ] } }
-- Máximo 3 ranges por día (validado en aplicación, no en DB por flexibilidad).
UPDATE admin_settings
SET working_hours = (
  SELECT jsonb_object_agg(
    day_key,
    jsonb_build_object(
      'enabled', COALESCE((day_val->>'enabled')::boolean, false),
      'ranges',  CASE
        WHEN COALESCE((day_val->>'enabled')::boolean, false)
             AND day_val ? 'start'
             AND day_val ? 'end'
        THEN jsonb_build_array(
               jsonb_build_object('start', day_val->>'start', 'end', day_val->>'end')
             )
        ELSE '[]'::jsonb
      END
    )
  )
  FROM jsonb_each(working_hours) AS kv(day_key, day_val)
)
WHERE working_hours IS NOT NULL
  AND NOT (
    -- Idempotente: si ya está en el nuevo formato, no tocar.
    working_hours->'monday' ? 'ranges'
  );

-- Actualizar default del schema al nuevo formato.
ALTER TABLE admin_settings
  ALTER COLUMN working_hours SET DEFAULT '{
    "monday":    {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "tuesday":   {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "wednesday": {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "thursday":  {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "friday":    {"enabled": true,  "ranges": [{"start": "09:00", "end": "14:00"}]},
    "saturday":  {"enabled": false, "ranges": []},
    "sunday":    {"enabled": false, "ranges": []}
  }'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3. PAYMENT_LINK_STATUS: add 'failed'
-- ─────────────────────────────────────────────────────────────
-- Para que Silvana pueda marcar un link como fallido (ej. transferencia
-- Zelle rechazada) sin tener que borrarlo — queda el histórico.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_link_status' AND e.enumlabel = 'failed'
  ) THEN
    ALTER TYPE payment_link_status ADD VALUE 'failed';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────
-- 4. BOOKING_EVENTS: auditoría de cambios de estado
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'created','status_changed','rescheduled','notified',
                  'reminder_sent','meet_generated','payment_updated','note_added'
                )),
  from_status   booking_status,
  to_status     booking_status,
  notified      TEXT[] DEFAULT '{}',
  reason        TEXT,
  actor         TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id, created_at DESC);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_booking_events"
  ON booking_events FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 5. AVAILABILITY_EXCEPTIONS: parent + child dates (normalizado)
-- ─────────────────────────────────────────────────────────────
-- Reemplaza la tabla previa con diseño normalizado.
DROP FUNCTION IF EXISTS get_active_exceptions(DATE, DATE);
DROP TABLE IF EXISTS availability_exceptions CASCADE;

-- Parent: metadatos comunes (título, tipo, ventana horaria, notas).
CREATE TABLE availability_exceptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,

  -- 'dates'     → N fechas sueltas (lista en availability_exception_dates)
  -- 'range'     → rango continuo (start_date..end_date)
  -- 'recurring' → días de la semana repetidos entre start_date y end_date
  type         TEXT NOT NULL CHECK (type IN ('dates','range','recurring')),

  -- Para 'range' y 'recurring'. Para 'dates' se ignoran (usar child table).
  start_date   DATE,
  end_date     DATE,

  -- Ventana horaria del bloqueo. Si ambos NULL, bloquea día(s) completo(s).
  start_time   TIME,
  end_time     TIME,
  all_day      BOOLEAN DEFAULT FALSE,

  -- Solo 'recurring': 0=domingo .. 6=sábado
  days_of_week SMALLINT[],

  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_exc_range_dates CHECK (
    type <> 'range' OR (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
  ),
  CONSTRAINT chk_exc_recurring CHECK (
    type <> 'recurring' OR (
      start_date IS NOT NULL
      AND days_of_week IS NOT NULL
      AND array_length(days_of_week, 1) > 0
    )
  ),
  CONSTRAINT chk_exc_time_pair CHECK (
    all_day = TRUE
    OR (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  CONSTRAINT chk_exc_allday_no_times CHECK (
    all_day = FALSE OR (start_time IS NULL AND end_time IS NULL)
  )
);

-- Child: fechas específicas para type='dates' (N fechas por excepción).
CREATE TABLE availability_exception_dates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id  UUID NOT NULL REFERENCES availability_exceptions(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  UNIQUE (exception_id, date)
);

CREATE INDEX idx_exc_type                  ON availability_exceptions(type);
CREATE INDEX idx_exc_range_dates           ON availability_exceptions(start_date, end_date);
CREATE INDEX idx_exc_dates_date            ON availability_exception_dates(date);
CREATE INDEX idx_exc_dates_exception       ON availability_exception_dates(exception_id);

CREATE TRIGGER trg_availability_exceptions_updated
  BEFORE UPDATE ON availability_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE availability_exceptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exception_dates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_exceptions"
  ON availability_exceptions FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_manage_exception_dates"
  ON availability_exception_dates FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 6. GOOGLE_EXTERNAL_EVENTS: eventos externos que bloquean slots
-- ─────────────────────────────────────────────────────────────
-- Cuando Silvana crea un evento directamente en Google Calendar (no desde
-- el sistema), lo sincronizamos aquí vía webhook. Bloquea disponibilidad
-- pública pero NO crea un booking.
CREATE TABLE IF NOT EXISTS google_external_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT NOT NULL UNIQUE,
  summary         TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  all_day         BOOLEAN DEFAULT FALSE,
  raw             JSONB DEFAULT '{}',
  synced_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_gee_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_gee_range ON google_external_events(start_at, end_at);

ALTER TABLE google_external_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_gee"
  ON google_external_events FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: get_active_exceptions(from_date, to_date)
-- ─────────────────────────────────────────────────────────────
-- Expuesta al booking público (SECURITY DEFINER). Devuelve solo los
-- campos necesarios para calcular bloqueos. Para type='dates' devuelve
-- una fila por cada fecha específica en el rango.
CREATE OR REPLACE FUNCTION get_active_exceptions(from_date DATE, to_date DATE)
RETURNS TABLE (
  type          TEXT,
  the_date      DATE,
  start_date    DATE,
  end_date      DATE,
  start_time    TIME,
  end_time      TIME,
  all_day       BOOLEAN,
  days_of_week  SMALLINT[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Fechas sueltas
  SELECT
    ae.type,
    d.date       AS the_date,
    NULL::date   AS start_date,
    NULL::date   AS end_date,
    ae.start_time,
    ae.end_time,
    ae.all_day,
    NULL::smallint[] AS days_of_week
  FROM availability_exceptions ae
  JOIN availability_exception_dates d ON d.exception_id = ae.id
  WHERE ae.type = 'dates'
    AND d.date BETWEEN from_date AND to_date

  UNION ALL

  -- Rango continuo
  SELECT
    ae.type,
    NULL::date,
    ae.start_date,
    ae.end_date,
    ae.start_time,
    ae.end_time,
    ae.all_day,
    NULL::smallint[]
  FROM availability_exceptions ae
  WHERE ae.type = 'range'
    AND NOT (ae.end_date < from_date OR ae.start_date > to_date)

  UNION ALL

  -- Recurrente
  SELECT
    ae.type,
    NULL::date,
    ae.start_date,
    ae.end_date,
    ae.start_time,
    ae.end_time,
    ae.all_day,
    ae.days_of_week
  FROM availability_exceptions ae
  WHERE ae.type = 'recurring'
    AND ae.start_date <= to_date
    AND (ae.end_date IS NULL OR ae.end_date >= from_date);
$$;

GRANT EXECUTE ON FUNCTION get_active_exceptions(DATE, DATE) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. RPC: check_slot_conflicts(date, time, duration, exclude_booking_id)
-- ─────────────────────────────────────────────────────────────
-- Fuente de verdad única para conflictos de agenda. Evalúa las 4
-- fuentes de bloqueo:
--   a) bookings activas (excluye cancelled/rejected/expired y opcionalmente
--      el booking que se está editando)
--   b) availability_exceptions (todos los tipos)
--   c) google_external_events
--   d) working_hours del admin_settings (fuera de horario)
--
-- Devuelve una fila por cada conflicto encontrado. Vacío = libre.
CREATE OR REPLACE FUNCTION check_slot_conflicts(
  p_date        DATE,
  p_time        TIME,
  p_duration    INTEGER,
  p_exclude_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  source       TEXT,
  label        TEXT,
  ref_id       UUID,
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_slot_start TIMESTAMPTZ := (p_date + p_time) AT TIME ZONE 'America/New_York';
  v_slot_end   TIMESTAMPTZ := v_slot_start + make_interval(mins => p_duration);
  v_dow        INTEGER     := EXTRACT(DOW FROM p_date);
  v_wh         JSONB;
  v_day_keys   TEXT[]      := ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  v_day_cfg    JSONB;
  v_rng        JSONB;
  v_in_range   BOOLEAN     := FALSE;
BEGIN
  -- (a) Bookings solapadas
  RETURN QUERY
  SELECT
    'booking'::TEXT,
    ('Reserva ' || COALESCE(c.full_name,'(sin nombre)'))::TEXT,
    b.id,
    b.preferred_date,
    b.preferred_date + make_interval(mins => COALESCE(s.duration_min, 60))
  FROM bookings b
  LEFT JOIN clients  c ON c.id = b.client_id
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.status NOT IN ('cancelled','rejected','expired')
    AND (p_exclude_id IS NULL OR b.id <> p_exclude_id)
    AND b.preferred_date IS NOT NULL
    AND b.preferred_date < v_slot_end
    AND (b.preferred_date + make_interval(mins => COALESCE(s.duration_min, 60))) > v_slot_start;

  -- (b) Excepciones — fechas sueltas
  RETURN QUERY
  SELECT
    'exception'::TEXT,
    ae.title,
    ae.id,
    CASE WHEN ae.all_day OR ae.start_time IS NULL
         THEN (d.date::timestamp AT TIME ZONE 'America/New_York')
         ELSE ((d.date + ae.start_time) AT TIME ZONE 'America/New_York')
    END,
    CASE WHEN ae.all_day OR ae.end_time IS NULL
         THEN ((d.date + INTERVAL '1 day')::timestamp AT TIME ZONE 'America/New_York')
         ELSE ((d.date + ae.end_time) AT TIME ZONE 'America/New_York')
    END
  FROM availability_exceptions ae
  JOIN availability_exception_dates d ON d.exception_id = ae.id
  WHERE ae.type = 'dates'
    AND d.date = p_date
    AND (
      ae.all_day OR ae.start_time IS NULL
      OR (ae.start_time < (p_time + make_interval(mins => p_duration))::time
          AND ae.end_time > p_time)
    );

  -- (b') Excepciones — rango continuo
  RETURN QUERY
  SELECT
    'exception'::TEXT,
    ae.title,
    ae.id,
    CASE WHEN ae.all_day OR ae.start_time IS NULL
         THEN (p_date::timestamp AT TIME ZONE 'America/New_York')
         ELSE ((p_date + ae.start_time) AT TIME ZONE 'America/New_York')
    END,
    CASE WHEN ae.all_day OR ae.end_time IS NULL
         THEN ((p_date + INTERVAL '1 day')::timestamp AT TIME ZONE 'America/New_York')
         ELSE ((p_date + ae.end_time) AT TIME ZONE 'America/New_York')
    END
  FROM availability_exceptions ae
  WHERE ae.type = 'range'
    AND p_date BETWEEN ae.start_date AND ae.end_date
    AND (
      ae.all_day OR ae.start_time IS NULL
      OR (ae.start_time < (p_time + make_interval(mins => p_duration))::time
          AND ae.end_time > p_time)
    );

  -- (b'') Excepciones — recurrente
  RETURN QUERY
  SELECT
    'exception'::TEXT,
    ae.title,
    ae.id,
    CASE WHEN ae.all_day OR ae.start_time IS NULL
         THEN (p_date::timestamp AT TIME ZONE 'America/New_York')
         ELSE ((p_date + ae.start_time) AT TIME ZONE 'America/New_York')
    END,
    CASE WHEN ae.all_day OR ae.end_time IS NULL
         THEN ((p_date + INTERVAL '1 day')::timestamp AT TIME ZONE 'America/New_York')
         ELSE ((p_date + ae.end_time) AT TIME ZONE 'America/New_York')
    END
  FROM availability_exceptions ae
  WHERE ae.type = 'recurring'
    AND ae.start_date <= p_date
    AND (ae.end_date IS NULL OR ae.end_date >= p_date)
    AND v_dow = ANY(ae.days_of_week)
    AND (
      ae.all_day OR ae.start_time IS NULL
      OR (ae.start_time < (p_time + make_interval(mins => p_duration))::time
          AND ae.end_time > p_time)
    );

  -- (c) Google external events
  RETURN QUERY
  SELECT
    'google'::TEXT,
    COALESCE(g.summary, 'Evento Google'),
    g.id,
    g.start_at,
    g.end_at
  FROM google_external_events g
  WHERE g.start_at < v_slot_end
    AND g.end_at   > v_slot_start;

  -- (d) Working hours — el slot debe caer COMPLETAMENTE dentro de algún rango habilitado
  SELECT working_hours INTO v_wh
  FROM admin_settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_wh IS NOT NULL THEN
    v_day_cfg := v_wh -> v_day_keys[v_dow + 1];

    IF COALESCE((v_day_cfg->>'enabled')::boolean, false) = TRUE THEN
      FOR v_rng IN SELECT * FROM jsonb_array_elements(COALESCE(v_day_cfg->'ranges','[]'::jsonb))
      LOOP
        IF (v_rng->>'start')::time <= p_time
           AND (v_rng->>'end')::time >= (p_time + make_interval(mins => p_duration))::time THEN
          v_in_range := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_in_range THEN
      RETURN QUERY SELECT
        'working_hours'::TEXT,
        'Fuera del horario laboral'::TEXT,
        NULL::UUID,
        v_slot_start,
        v_slot_end;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_slot_conflicts(DATE, TIME, INTEGER, UUID) TO anon, authenticated;
