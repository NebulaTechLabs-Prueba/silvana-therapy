-- ============================================================
-- Silvana Therapy — Baseline Schema
-- ============================================================
-- Consolidacion de las migraciones 001-015 en un unico archivo.
-- Generado el 2026-04-14 para simplificar la entrega.
--
-- Para instancias NUEVAS de Supabase: ejecutar solo este archivo.
-- Para la instancia actual de desarrollo: NO reaplicar, ya tiene todo.
--
-- Contenido:
--   1. Extensiones
--   2. Enums (tipos custom)
--   3. Tablas (en orden de dependencia FK)
--   4. Indices
--   5. Funciones y triggers
--   6. RLS policies
--   7. Seed data minimo (admin_settings singleton, servicios iniciales)
-- ============================================================


-- ============================================================
-- 1. EXTENSIONES
-- ============================================================
-- gen_random_uuid() viene de pgcrypto. En Supabase suele estar
-- habilitada por defecto, pero lo aseguramos explicitamente.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 2. ENUMS (tipos custom)
-- ============================================================

-- Ciclo de vida de una reserva, desde que el cliente la crea
-- hasta que se realiza / cancela / expira.
CREATE TYPE booking_status AS ENUM (
  'pending',          -- Cliente envio formulario, esperando revision
  'accepted',         -- Silvana acepto, esperando pago (si aplica)
  'payment_pending',  -- Link de pago enviado, esperando confirmacion
  'confirmed',        -- Pagado o gratuito, cita confirmada
  'rescheduled',      -- Cita fue reagendada (se mantiene confirmed)
  'completed',        -- Sesion realizada
  'rejected',         -- Silvana rechazo la solicitud
  'cancelled',        -- Cliente o Silvana cancelo
  'expired'           -- Payment link expiro sin pago
);

-- Estado de un pago concreto registrado en payments.
CREATE TYPE payment_status AS ENUM (
  'pending',
  'completed',
  'failed'
);

-- Proveedor de pago usado por payments / payment_links.
CREATE TYPE payment_provider AS ENUM (
  'stripe',
  'paypal'
);

-- Estado de un payment_link. 'failed' permite dejar el historico
-- cuando un Zelle o similar es rechazado sin borrar el link.
CREATE TYPE payment_link_status AS ENUM (
  'active',
  'paid',
  'expired',
  'cancelled',
  'failed'
);

-- Estado de las facturas del dashboard.
CREATE TYPE invoice_status AS ENUM (
  'pendiente',
  'pagada',
  'vencida',
  'cancelada'
);

-- Tipo de metodo de pago configurable por el admin. 'Zelle' se
-- anadio en la migracion 011.
CREATE TYPE payment_method_type AS ENUM (
  'Transferencia',
  'Tarjeta',
  'PayPal',
  'Efectivo',
  'Zelle',
  'Otro'
);


-- ============================================================
-- 3. TABLAS
-- ============================================================

-- ─── 3.1 clients ─────────────────────────────────────────────
-- Datos del paciente recogidos desde el formulario publico de
-- reserva. No hay auth asociada: un cliente es un registro, no
-- un usuario de Supabase Auth.
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  country      TEXT,
  reason       TEXT,                          -- Motivo libre de consulta
  is_returning BOOLEAN DEFAULT FALSE,         -- Se actualiza via trigger
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),

  -- Limites de longitud y formato (migracion 010)
  CONSTRAINT chk_clients_name_length    CHECK (char_length(full_name) <= 200),
  CONSTRAINT chk_clients_email_length   CHECK (char_length(email) <= 320),
  CONSTRAINT chk_clients_phone_length   CHECK (phone   IS NULL OR char_length(phone)   <= 30),
  CONSTRAINT chk_clients_country_length CHECK (country IS NULL OR char_length(country) <= 100),
  CONSTRAINT chk_clients_reason_length  CHECK (reason  IS NULL OR char_length(reason)  <= 2000),
  CONSTRAINT chk_clients_email_format   CHECK (email ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
);


-- ─── 3.2 services ────────────────────────────────────────────
-- Servicios que ofrece la terapeuta. Configurable por admin y
-- expuesto publicamente en /services. El campo `features` es un
-- array JSON de bullets para la pagina de detalle.
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE,                                   -- URL amigable
  subtitle     TEXT,
  tag          TEXT,
  type_label   TEXT,
  description  TEXT,
  duration_min INTEGER NOT NULL DEFAULT 50,
  price        TEXT,                                          -- Display price ("45", "Gratis")
  is_free      BOOLEAN DEFAULT FALSE,
  active       BOOLEAN DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  modality     TEXT DEFAULT 'Online · Videollamada',
  features     JSONB DEFAULT '[]',
  color        TEXT DEFAULT '#4a7a4a',                        -- Color identificador en el dashboard
  created_at   TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_services_sort_order CHECK (sort_order >= 0),
  CONSTRAINT chk_services_duration   CHECK (duration_min > 0),
  CONSTRAINT chk_services_name_length CHECK (char_length(name) <= 200),
  CONSTRAINT chk_services_desc_length CHECK (description IS NULL OR char_length(description) <= 2000)
);


-- ─── 3.3 admin_settings ──────────────────────────────────────
-- Tabla singleton (siempre exactamente 1 fila — se fuerza mas abajo
-- con un indice unico parcial). Contiene toda la configuracion del
-- sistema: precios, horarios, datos publicos de contacto, perfil
-- profesional, credenciales SMTP/Google, plantillas WA, pregunta
-- de seguridad, etc. El sitio maneja un solo admin por diseno.
CREATE TABLE admin_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Precios y recargo
  default_price        DECIMAL(10,2) DEFAULT 60.00,
  paypal_surcharge_pct DECIMAL(5,2)  DEFAULT 10.00,

  -- Email al que llegan notificaciones de nuevas reservas Y al que
  -- se envia el correo de recuperacion de contrasena del admin.
  notification_email   TEXT DEFAULT 'info@terapiasilvanalopez.com',
  google_calendar_id   TEXT,

  -- Horarios laborales en formato multi-rango (max 3 rangos por dia).
  -- Esquema: { <day>: { enabled: bool, ranges: [{start, end}, ...] } }
  working_hours        JSONB DEFAULT '{
    "monday":    {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "tuesday":   {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "wednesday": {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "thursday":  {"enabled": true,  "ranges": [{"start": "09:00", "end": "18:00"}]},
    "friday":    {"enabled": true,  "ranges": [{"start": "09:00", "end": "14:00"}]},
    "saturday":  {"enabled": false, "ranges": []},
    "sunday":    {"enabled": false, "ranges": []}
  }'::jsonb,

  -- Perfil profesional (tab "Mi Cuenta")
  nombre               TEXT DEFAULT 'Lda. Silvana Lopez',
  especialidad         TEXT DEFAULT 'Psicoterapia Online',
  cedula               TEXT,
  telefono             TEXT,
  direccion            TEXT DEFAULT 'Consulta Online',
  bio                  TEXT,
  notepad              TEXT DEFAULT '',

  -- Seguridad (recuperacion de contrasena tipo pregunta/respuesta)
  security_question    TEXT,
  security_answer      TEXT,

  -- Datos publicos de contacto (home page)
  contact_email        TEXT DEFAULT 'info@terapiasilvanalopez.com',
  contact_phone        TEXT DEFAULT '+1 754 308 0643',

  -- Integracion SMTP generica (Brevo, Mailgun, etc)
  smtp_host            TEXT,
  smtp_port            INTEGER DEFAULT 587,
  smtp_user            TEXT,
  smtp_password        TEXT,
  smtp_from_email      TEXT,
  smtp_from_name       TEXT,
  smtp_secure          BOOLEAN DEFAULT FALSE,

  -- Plantillas WhatsApp por evento (variables: {cliente} {servicio} {fecha} {hora} {precio} {link} {motivo})
  wa_templates         JSONB DEFAULT '{}'::jsonb,

  updated_at           TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_settings_question_length CHECK (security_question IS NULL OR char_length(security_question) <= 500),
  CONSTRAINT chk_settings_answer_length   CHECK (security_answer   IS NULL OR char_length(security_answer)   <= 200)
);

-- Forzar singleton: como maximo una fila en admin_settings.
-- El indice unico sobre una expresion constante hace que cualquier
-- INSERT adicional falle con unique violation.
CREATE UNIQUE INDEX admin_settings_singleton ON admin_settings ((true));

COMMENT ON COLUMN admin_settings.smtp_host         IS 'Host SMTP (ej. smtp-relay.brevo.com)';
COMMENT ON COLUMN admin_settings.smtp_port         IS 'Puerto SMTP (587 STARTTLS, 465 TLS)';
COMMENT ON COLUMN admin_settings.smtp_secure       IS 'TRUE si el puerto es 465 (TLS directo); FALSE para 587 (STARTTLS)';
COMMENT ON COLUMN admin_settings.wa_templates      IS 'Plantillas WA por evento. Variables: {cliente} {servicio} {fecha} {hora} {precio} {link} {motivo}';


-- ─── 3.4 bookings ────────────────────────────────────────────
-- Reserva concreta. Enlaza un cliente con un servicio y mantiene
-- todo el ciclo de vida (pending -> confirmed -> completed).
--
-- NOTA: las columnas agreed_price y payment_provider fueron
-- eliminadas en migracion 012 (Silvana gestiona pagos via N
-- payment_links por booking, no uno solo).
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  service_id        UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  status            booking_status NOT NULL DEFAULT 'pending',

  -- Scheduling (en hora Miami / America/New_York)
  preferred_date    TIMESTAMPTZ,                  -- Fecha que el cliente prefiere
  confirmed_date    TIMESTAMPTZ,                  -- Fecha que Silvana confirma
  original_date     TIMESTAMPTZ,                  -- Guarda la fecha previa si se reagenda
  client_local_time TEXT,                         -- "11:00" en zona del cliente (display only)

  -- Google Calendar / Meet
  google_event_id   TEXT,                         -- ID bidireccional con Google Calendar
  meet_link         TEXT,                         -- URL de Google Meet

  -- Recordatorios
  reminder_channels TEXT[] DEFAULT '{}',          -- Canales aceptados: email, whatsapp
  reminder_sent_at  TIMESTAMPTZ,                  -- Ultimo recordatorio 24h enviado

  -- Metadata
  is_first_session  BOOLEAN DEFAULT TRUE,
  admin_notes       TEXT,
  rejection_reason  TEXT,
  idempotency_key   TEXT UNIQUE,                  -- Previene submits duplicados
  preferred_payment TEXT,                         -- Metodo preferido (texto libre)

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_bookings_notes_length       CHECK (admin_notes       IS NULL OR char_length(admin_notes) <= 2000),
  CONSTRAINT chk_bookings_rejection_length   CHECK (rejection_reason  IS NULL OR char_length(rejection_reason) <= 1000),
  CONSTRAINT chk_bookings_idempotency_length CHECK (idempotency_key   IS NULL OR char_length(idempotency_key) <= 100),
  CONSTRAINT chk_bookings_payment_length     CHECK (preferred_payment IS NULL OR char_length(preferred_payment) <= 100),
  CONSTRAINT chk_bookings_localtime_length   CHECK (client_local_time IS NULL OR char_length(client_local_time) <= 20)
);

COMMENT ON COLUMN bookings.meet_link         IS 'Google Meet URL (se llena al confirmar si la integracion Google esta activa)';
COMMENT ON COLUMN bookings.reminder_channels IS 'Canales por los que el cliente acepta recordatorios: email, whatsapp';
COMMENT ON COLUMN bookings.reminder_sent_at  IS 'Timestamp del ultimo recordatorio 24h enviado';
COMMENT ON COLUMN bookings.google_event_id   IS 'ID del evento en Google Calendar (bidirectional sync)';
COMMENT ON COLUMN bookings.rejection_reason  IS 'Motivo libre de rechazo/cancelacion — opcional, se usa en plantilla de correo';


-- ─── 3.5 payments ────────────────────────────────────────────
-- Pagos efectivamente confirmados (webhook de Stripe/PayPal).
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider          payment_provider NOT NULL,
  provider_tx_id    TEXT UNIQUE,                  -- Stripe payment_intent / PayPal order ID
  amount            DECIMAL(10,2) NOT NULL,
  surcharge_pct     DECIMAL(5,2) DEFAULT 0,       -- 10 para PayPal
  total             DECIMAL(10,2) NOT NULL,
  currency          TEXT DEFAULT 'USD',
  status            payment_status NOT NULL DEFAULT 'pending',
  provider_metadata JSONB DEFAULT '{}',
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_payments_amount_positive  CHECK (amount >= 0),
  CONSTRAINT chk_payments_total_positive   CHECK (total >= 0),
  CONSTRAINT chk_payments_surcharge_range  CHECK (surcharge_pct >= 0 AND surcharge_pct <= 100)
);


-- ─── 3.6 payment_links ───────────────────────────────────────
-- Links de pago generados por Silvana desde el dashboard.
-- Un booking puede tener N links (si uno falla / expira se crea
-- otro). booking_id es nullable para soportar links standalone.
CREATE TABLE payment_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
  provider         payment_provider NOT NULL,
  provider_link_id TEXT,                          -- Stripe payment_link / PayPal order ID
  url              TEXT NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  surcharge_pct    DECIMAL(5,2) DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  status           payment_link_status NOT NULL DEFAULT 'active',
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_payment_links_amount_positive CHECK (amount >= 0),
  CONSTRAINT chk_payment_links_total_positive  CHECK (total >= 0),
  CONSTRAINT chk_payment_links_surcharge_range CHECK (surcharge_pct >= 0 AND surcharge_pct <= 100)
);


-- ─── 3.7 invoices ────────────────────────────────────────────
-- Facturacion. Puede estar enlazada opcionalmente a un booking;
-- si no, la info del paciente se guarda directamente.
CREATE TABLE invoices (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  paciente   TEXT NOT NULL,                        -- Nombre del paciente
  email      TEXT,
  telefono   TEXT,
  cedula     TEXT,
  pais       TEXT,
  direccion  TEXT,
  concepto   TEXT NOT NULL DEFAULT 'Sesion individual',
  monto      DECIMAL(10,2) NOT NULL,
  estado     invoice_status NOT NULL DEFAULT 'pendiente',
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  link       TEXT,                                 -- URL de pago
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_invoices_monto_positive  CHECK (monto >= 0),
  CONSTRAINT chk_invoices_paciente_length CHECK (char_length(paciente) <= 200),
  CONSTRAINT chk_invoices_email_length    CHECK (email     IS NULL OR char_length(email) <= 320),
  CONSTRAINT chk_invoices_concepto_length CHECK (char_length(concepto) <= 300),
  CONSTRAINT chk_invoices_link_length     CHECK (link      IS NULL OR char_length(link)  <= 2048),
  CONSTRAINT chk_invoices_notas_length    CHECK (notas     IS NULL OR char_length(notas) <= 2000),
  CONSTRAINT chk_invoices_telefono_length CHECK (telefono  IS NULL OR char_length(telefono)  <= 30),
  CONSTRAINT chk_invoices_cedula_length   CHECK (cedula    IS NULL OR char_length(cedula)    <= 30),
  CONSTRAINT chk_invoices_pais_length     CHECK (pais      IS NULL OR char_length(pais)      <= 100),
  CONSTRAINT chk_invoices_direccion_length CHECK (direccion IS NULL OR char_length(direccion) <= 300)
);


-- ─── 3.8 payment_methods ─────────────────────────────────────
-- Metodos de pago configurables por el admin (IBAN, Stripe, PayPal,
-- Zelle...). Los metodos activos se exponen publicamente para que
-- el cliente los pueda seleccionar en el formulario de reserva.
CREATE TABLE payment_methods (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo               payment_method_type NOT NULL DEFAULT 'Transferencia',
  nombre             TEXT NOT NULL,
  banco              TEXT,
  titular            TEXT,

  -- Display de cuenta
  cuenta_visible     TEXT,                          -- Enmascarado: **** 4521
  cuenta_completa    TEXT,                          -- IBAN / acct ID completo (sensible)

  -- Moneda y timing
  moneda             TEXT DEFAULT 'USD',
  tiempo_confirm     TEXT DEFAULT '24-48h',
  instrucciones      TEXT,
  notas_internas     TEXT,

  -- Proveedor (Stripe / PayPal)
  correo_proveedor   TEXT,
  comision           TEXT,                          -- "2.9% + $0.30"
  estado_conexion    TEXT DEFAULT 'desconectado',
  monedas_aceptadas  TEXT DEFAULT 'USD',
  pagos_recurrentes  BOOLEAN DEFAULT FALSE,

  -- API keys (sensibles)
  clave_publica      TEXT,
  clave_secreta      TEXT,
  id_comercio        TEXT,

  -- PayPal-specific
  tipo_cuenta        TEXT,                          -- Personal / Business
  tiempo_acredit     TEXT DEFAULT 'Instantaneo',
  politica_reembolso TEXT,

  -- Estado y orden
  activo             BOOLEAN DEFAULT TRUE,
  prioridad          INTEGER DEFAULT 1,

  -- Recargo adicional que paga el cliente por este metodo
  recargo_pct        DECIMAL(5,2) DEFAULT 0,

  -- Color identificador opcional para el dashboard
  color              TEXT DEFAULT NULL,

  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_payment_methods_prioridad     CHECK (prioridad >= 0),
  CONSTRAINT chk_payment_methods_recargo_range CHECK (recargo_pct >= 0 AND recargo_pct <= 100),
  CONSTRAINT chk_pm_nombre_length        CHECK (char_length(nombre) <= 200),
  CONSTRAINT chk_pm_titular_length       CHECK (titular IS NULL OR char_length(titular) <= 200),
  CONSTRAINT chk_pm_banco_length         CHECK (banco   IS NULL OR char_length(banco)   <= 200),
  CONSTRAINT chk_pm_cuenta_vis_length    CHECK (cuenta_visible  IS NULL OR char_length(cuenta_visible)  <= 50),
  CONSTRAINT chk_pm_cuenta_comp_length   CHECK (cuenta_completa IS NULL OR char_length(cuenta_completa) <= 100),
  CONSTRAINT chk_pm_instrucciones_length CHECK (instrucciones   IS NULL OR char_length(instrucciones)   <= 1000),
  CONSTRAINT chk_pm_notas_length         CHECK (notas_internas  IS NULL OR char_length(notas_internas)  <= 1000)
);


-- ─── 3.9 admin_links ─────────────────────────────────────────
-- Enlaces/tutoriales que Silvana quiere tener a mano en el dashboard.
CREATE TABLE admin_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─── 3.10 booking_events ─────────────────────────────────────
-- Auditoria de cambios en bookings. Se usa para el timeline en
-- el detalle de una reserva.
CREATE TABLE booking_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'created','status_changed','rescheduled','notified',
                'reminder_sent','meet_generated','payment_updated','note_added'
              )),
  from_status booking_status,
  to_status   booking_status,
  notified    TEXT[] DEFAULT '{}',
  reason      TEXT,
  actor       TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 3.11 availability_exceptions ────────────────────────────
-- Bloqueos de disponibilidad (vacaciones, eventos, feriados).
-- Diseno normalizado: un parent con la configuracion comun y un
-- child con fechas sueltas (solo para type='dates').
CREATE TABLE availability_exceptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,

  -- 'dates'     → N fechas sueltas (en availability_exception_dates)
  -- 'range'     → rango continuo (start_date..end_date)
  -- 'recurring' → dias de la semana entre start_date y end_date
  type         TEXT NOT NULL CHECK (type IN ('dates','range','recurring')),

  start_date   DATE,
  end_date     DATE,

  -- Ventana horaria del bloqueo. Si ambos NULL o all_day=true,
  -- bloquea el/los dia(s) completo(s).
  start_time   TIME,
  end_time     TIME,
  all_day      BOOLEAN DEFAULT FALSE,

  -- Solo 'recurring': 0=domingo .. 6=sabado
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


-- ─── 3.12 availability_exception_dates ───────────────────────
-- Fechas sueltas pertenecientes a una availability_exceptions
-- de type='dates'.
CREATE TABLE availability_exception_dates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id UUID NOT NULL REFERENCES availability_exceptions(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  UNIQUE (exception_id, date)
);


-- ─── 3.13 google_external_events ─────────────────────────────
-- Eventos que Silvana crea directamente en Google Calendar (no
-- desde el sistema). Se sincronizan via webhook y bloquean slots
-- publicos pero no crean bookings.
CREATE TABLE google_external_events (
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


-- ─── 3.14 google_integrations ────────────────────────────────
-- Tokens OAuth del admin para Google Calendar / Meet. Solo accesible
-- via service_role — ninguna policy permisiva.
CREATE TABLE google_integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_email TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type    TEXT DEFAULT 'Bearer',
  scope         TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  calendar_id   TEXT NOT NULL DEFAULT 'primary',
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  google_integrations IS 'OAuth tokens de Google Calendar/Meet del admin. Solo accesible via service_role.';
COMMENT ON COLUMN google_integrations.refresh_token IS 'Refresh token de larga duracion — NO exponer al cliente';
COMMENT ON COLUMN google_integrations.expires_at    IS 'Expiracion del access_token; se refresca automaticamente';


-- ============================================================
-- 4. INDICES
-- ============================================================

CREATE INDEX idx_clients_email             ON clients(email);

CREATE INDEX idx_services_slug             ON services(slug);

CREATE INDEX idx_bookings_client           ON bookings(client_id);
CREATE INDEX idx_bookings_status           ON bookings(status);
CREATE INDEX idx_bookings_date             ON bookings(confirmed_date);
CREATE INDEX idx_bookings_preferred_date   ON bookings(preferred_date);

CREATE INDEX idx_payments_booking          ON payments(booking_id);
CREATE INDEX idx_payments_provider         ON payments(provider_tx_id);

CREATE INDEX idx_payment_links_booking     ON payment_links(booking_id);

CREATE INDEX idx_invoices_estado           ON invoices(estado);
CREATE INDEX idx_invoices_fecha            ON invoices(fecha);
CREATE INDEX idx_invoices_booking          ON invoices(booking_id);
CREATE INDEX idx_invoices_paciente         ON invoices(paciente);

CREATE INDEX idx_payment_methods_activo    ON payment_methods(activo);

CREATE INDEX idx_booking_events_booking    ON booking_events(booking_id, created_at DESC);

CREATE INDEX idx_exc_type                  ON availability_exceptions(type);
CREATE INDEX idx_exc_range_dates           ON availability_exceptions(start_date, end_date);
CREATE INDEX idx_exc_dates_date            ON availability_exception_dates(date);
CREATE INDEX idx_exc_dates_exception       ON availability_exception_dates(exception_id);

CREATE INDEX idx_gee_range                 ON google_external_events(start_at, end_at);

-- Unique partial index que fuerza una unica fila en google_integrations
CREATE UNIQUE INDEX google_integrations_single_row ON google_integrations ((true));


-- ============================================================
-- 5. FUNCIONES Y TRIGGERS
-- ============================================================

-- ─── update_updated_at ──────────────────────────────────────
-- Trigger generico para refrescar updated_at.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_admin_settings_updated
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payment_methods_updated
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_availability_exceptions_updated
  BEFORE UPDATE ON availability_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── google_integrations: touch updated_at ──────────────────
-- Tiene su propio helper porque usa NOT NULL en updated_at.
CREATE OR REPLACE FUNCTION touch_google_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_google_integrations_updated
  BEFORE UPDATE ON google_integrations
  FOR EACH ROW EXECUTE FUNCTION touch_google_integrations_updated_at();


-- ─── check_first_session ────────────────────────────────────
-- Al insertar un booking, detecta si el cliente ya tuvo otra cita
-- confirmada. Si es asi, marca is_first_session=false y actualiza
-- clients.is_returning.
CREATE OR REPLACE FUNCTION check_first_session()
RETURNS TRIGGER AS $$
DECLARE
  has_previous BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE client_id = NEW.client_id
      AND id != NEW.id
      AND status IN ('confirmed', 'completed', 'rescheduled')
  ) INTO has_previous;

  IF has_previous THEN
    NEW.is_first_session = FALSE;
  END IF;

  UPDATE clients SET is_returning = has_previous WHERE id = NEW.client_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_first_session
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_first_session();


-- ─── expire_payment_links ───────────────────────────────────
-- Marca como expired los links vencidos y sus bookings asociados.
-- Pensado para ser llamado por pg_cron (ver seccion 7 del schema
-- original, deshabilitado por defecto).
CREATE OR REPLACE FUNCTION expire_payment_links()
RETURNS void AS $$
BEGIN
  UPDATE payment_links
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();

  UPDATE bookings
  SET status = 'expired'
  WHERE status = 'payment_pending'
    AND id IN (
      SELECT DISTINCT booking_id FROM payment_links
      WHERE status = 'expired' AND booking_id IS NOT NULL
    )
    AND id NOT IN (
      SELECT DISTINCT booking_id FROM payment_links
      WHERE status = 'active' AND booking_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;


-- ─── get_active_exceptions(from_date, to_date) ──────────────
-- Expuesta al booking publico (SECURITY DEFINER). Devuelve una
-- fila por cada bloqueo activo en el rango, normalizando los tres
-- tipos (dates, range, recurring).
CREATE OR REPLACE FUNCTION get_active_exceptions(from_date DATE, to_date DATE)
RETURNS TABLE (
  type         TEXT,
  the_date     DATE,
  start_date   DATE,
  end_date     DATE,
  start_time   TIME,
  end_time     TIME,
  all_day      BOOLEAN,
  days_of_week SMALLINT[]
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


-- ─── check_slot_conflicts(date, time, duration, exclude_id) ─
-- Fuente de verdad unica para conflictos de agenda. Evalua:
--   (a) bookings activas que solapen
--   (b) availability_exceptions (dates / range / recurring)
--   (c) google_external_events
--   (d) working_hours del admin_settings (fuera de horario)
-- Devuelve una fila por conflicto. Vacio = libre.
CREATE OR REPLACE FUNCTION check_slot_conflicts(
  p_date       DATE,
  p_time       TIME,
  p_duration   INTEGER,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  source    TEXT,
  label     TEXT,
  ref_id    UUID,
  starts_at TIMESTAMPTZ,
  ends_at   TIMESTAMPTZ
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

  -- (d) Working hours — el slot debe caer COMPLETAMENTE dentro de algun rango
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


-- ─── get_public_contact ─────────────────────────────────────
-- Funcion publica que expone SOLO los campos necesarios para
-- renderizar las paginas publicas (home, booking, detalle de
-- servicio), sin darle al rol anon acceso a toda la tabla
-- admin_settings (que contiene credenciales SMTP, Google, etc).
--
-- Creada en produccion via hotfix (commit 7737c07) para que
-- Silvana pueda cambiar su email / telefono / horarios desde el
-- dashboard y se reflejen en la web sin redeploy.
--
-- Devuelve:
--   - contact_email, contact_phone  (usados en home y footer)
--   - working_hours                 (usado en booking y detalle
--                                    de servicio para construir
--                                    el grid de slots disponibles)
--
-- SECURITY DEFINER: ejecuta con permisos del owner (postgres),
-- por eso bypasea la RLS de admin_settings. Es seguro porque
-- la funcion solo selecciona columnas publicas.
CREATE OR REPLACE FUNCTION get_public_contact()
RETURNS TABLE (
  contact_email TEXT,
  contact_phone TEXT,
  working_hours JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT contact_email, contact_phone, working_hours
  FROM admin_settings
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_public_contact() TO anon, authenticated;


-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE clients                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links                ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_links                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exception_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_external_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integrations          ENABLE ROW LEVEL SECURITY;
-- google_integrations: sin policy permisiva a proposito — solo service_role.


-- ─── Lectura publica ────────────────────────────────────────

-- Cualquiera puede ver los servicios activos (pagina /services).
CREATE POLICY "Anyone can read active services"
  ON services FOR SELECT
  USING (active = TRUE);

-- Cualquiera puede ver los metodos de pago activos (formulario de reserva).
CREATE POLICY "Anyone can read active payment methods"
  ON payment_methods FOR SELECT
  USING (activo = TRUE);


-- ─── Escritura publica (booking form) ───────────────────────

-- Crear cliente desde el formulario publico.
CREATE POLICY "Anyone can create a client"
  ON clients FOR INSERT
  WITH CHECK (TRUE);

-- Crear booking desde el formulario publico.
CREATE POLICY "Anyone can create a booking"
  ON bookings FOR INSERT
  WITH CHECK (TRUE);


-- ─── Admin (auth) full access ───────────────────────────────
-- Cualquier usuario autenticado (= Silvana tras login) puede hacer todo.
CREATE POLICY "Admin full access clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access services"
  ON services FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access bookings"
  ON bookings FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access payments"
  ON payments FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access payment_links"
  ON payment_links FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access settings"
  ON admin_settings FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access payment_methods"
  ON payment_methods FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access admin_links"
  ON admin_links FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_manage_booking_events"
  ON booking_events FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_manage_exceptions"
  ON availability_exceptions FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_manage_exception_dates"
  ON availability_exception_dates FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_manage_gee"
  ON google_external_events FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================
-- 7. SEED DATA MINIMO
-- ============================================================
-- Solo se inserta el singleton de admin_settings (imprescindible
-- para que el sistema arranque: sin esa fila el dashboard y las
-- paginas publicas crashean al leer contacto/horarios/SMTP).
--
-- NO se seedean services ni payment_methods: Silvana ya tiene su
-- catalogo real poblado en produccion. Un seed aqui borraria o
-- duplicaria su data al reaplicar el baseline.
--
-- Para datos de demo de presentacion ver seed_demo_data.sql aparte.

-- ─── admin_settings (singleton) ─────────────────────────────
-- ON CONFLICT DO NOTHING contra el indice unico singleton: si ya
-- existe la fila (reaplicacion accidental del baseline), no se
-- sobrescribe la configuracion actual de Silvana.
INSERT INTO admin_settings (
  default_price,
  paypal_surcharge_pct,
  notification_email,
  wa_templates
)
VALUES (
  60.00,
  10.00,
  'info@terapiasilvanalopez.com',
  jsonb_build_object(
    'booking_received',  'Hola {cliente} Recibi tu solicitud de *{servicio}* para el {fecha} a las {hora}. Te confirmo en breve.',
    'booking_confirmed', 'Hola {cliente} Tu cita de *{servicio}* queda confirmada para el {fecha} a las {hora} (hora Miami). Nos vemos!',
    'payment_link',      'Hola {cliente} Aqui esta tu enlace de pago para *{servicio}*: {link}. Monto: {precio} USD.',
    'reschedule',        'Hola {cliente} Tu cita de *{servicio}* fue reprogramada para el {fecha} a las {hora}. Cualquier duda, avisame.',
    'reminder_24h',      'Hola {cliente} Te recuerdo tu cita de *{servicio}* manana {fecha} a las {hora} (hora Miami).',
    'custom',            'Hola {cliente}, '
  )
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- FIN DEL BASELINE
-- ============================================================
-- Recordatorio: para habilitar expiracion automatica de payment_links
-- ejecutar (si pg_cron esta disponible en el proyecto):
--
--   SELECT cron.schedule('expire-payment-links', '*/30 * * * *',
--                        'SELECT expire_payment_links()');
