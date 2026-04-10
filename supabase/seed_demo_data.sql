-- ============================================================
-- SEED: Demo Data for Testing & Presentation
-- ============================================================
-- Run in Supabase SQL Editor.
-- Safe to re-run: deletes previous demo data before inserting.
-- ============================================================

-- ─── CLEANUP previous demo data ─────────────────────────────
DELETE FROM payment_links WHERE booking_id IN (SELECT id FROM bookings WHERE idempotency_key LIKE 'demo-%');
DELETE FROM payment_links WHERE url LIKE '%pay.example.com%';
DELETE FROM invoices WHERE email IN ('maria.gonzalez@gmail.com','carlos.ramirez@outlook.com','ana.martinez@yahoo.com','laura.fernandez@hotmail.com','pedro.silva@gmail.com');
DELETE FROM bookings WHERE idempotency_key LIKE 'demo-%';
DELETE FROM clients WHERE email IN ('maria.gonzalez@gmail.com','carlos.ramirez@outlook.com','ana.martinez@yahoo.com','laura.fernandez@hotmail.com','pedro.silva@gmail.com');
DELETE FROM payment_methods WHERE nombre IN ('Zelle — Bank of America','PayPal — Silvana López','Transferencia Bancaria — Argentina','Stripe — Tarjeta de crédito/débito');
DELETE FROM services WHERE slug IN ('demo-consulta-gratis','demo-terapia-individual','demo-terapia-pareja','demo-seguimiento');

-- ============================================================
-- 1. SERVICES (4) — with fixed IDs to avoid slug lookup issues
-- ============================================================

INSERT INTO services (id, name, slug, subtitle, tag, type_label, description, duration_min, price, is_free, active, sort_order, color, modality, features) VALUES
(
  'cc100000-0000-0000-0000-000000000001',
  'Primera Consulta Gratuita', 'demo-consulta-gratis',
  'Sin cargo · Sin compromiso', 'Consulta inicial', 'Sin cargo',
  'Sesión inicial sin costo para conocernos y evaluar cómo puedo acompañarte en tu proceso terapéutico.',
  30, 'Gratis', true, true, 1, '#4a7a4a',
  'Online · Videollamada',
  '["Conversación inicial sin costo ni compromiso","Evaluación de tu situación actual","Orientación sobre el proceso terapéutico","Espacio seguro y confidencial","Definición de objetivos iniciales"]'::jsonb
),
(
  'cc100000-0000-0000-0000-000000000002',
  'Sesión de Terapia Individual', 'demo-terapia-individual',
  'Sesión personalizada de 50 min', 'Proceso individual', 'Proceso continuo',
  'Sesión de psicoterapia online personalizada con enfoque integrativo.',
  50, '45', false, true, 2, '#2E7D32',
  'Online · Videollamada',
  '["Sesión personalizada de 50 minutos","Enfoque integrativo (TCC, Mindfulness, ACT)","Plan terapéutico a medida","Herramientas prácticas para el día a día","Seguimiento entre sesiones"]'::jsonb
),
(
  'cc100000-0000-0000-0000-000000000003',
  'Terapia de Pareja', 'demo-terapia-pareja',
  'Sesión conjunta de 60 min', 'Pareja', 'Sesión conjunta',
  'Espacio conjunto para trabajar la comunicación, resolver conflictos y fortalecer el vínculo de pareja.',
  60, '60', false, true, 3, '#1565C0',
  'Online · Videollamada',
  '["Sesión conjunta de 60 minutos","Trabajo en comunicación y resolución de conflictos","Herramientas para fortalecer el vínculo","Ambiente neutral y profesional","Plan de trabajo conjunto"]'::jsonb
),
(
  'cc100000-0000-0000-0000-000000000004',
  'Sesión de Seguimiento', 'demo-seguimiento',
  'Para pacientes activos · 50 min', 'Pacientes activos', 'Solo pacientes activos',
  'Para pacientes que ya están en proceso terapéutico y necesitan continuar con su acompañamiento regular.',
  50, '40', false, true, 4, '#FF8F00',
  'Online · Videollamada',
  '["Continuidad de tu proceso terapéutico","Revisión de progreso y objetivos","Profundización en temas actuales","Ajuste de estrategias según evolución","Acompañamiento constante"]'::jsonb
);

-- ============================================================
-- 2. PAYMENT METHODS (4) — Zelle, PayPal, Argentina, Stripe
-- ============================================================

INSERT INTO payment_methods (
  tipo, nombre, banco, titular, cuenta_visible, cuenta_completa,
  moneda, tiempo_confirm, instrucciones, notas_internas,
  correo_proveedor, comision, estado_conexion, monedas_aceptadas,
  pagos_recurrentes, tipo_cuenta, tiempo_acredit, politica_reembolso,
  activo, prioridad, recargo_pct, color
) VALUES
(
  'Zelle', 'Zelle — Bank of America',
  'Bank of America', 'Silvana López', '**** 7832', '021000322-4587832190',
  'USD', '1 hora',
  'Enviar Zelle al correo indicado. Adjuntar captura de pantalla como comprobante.',
  'Cuenta principal para pagos en USD desde USA',
  'lopez.silvana.psi@gmail.com', '0%', 'conectado', 'USD',
  false, 'Personal', 'Instantáneo',
  'Reembolso dentro de las primeras 24h previo a la cita.',
  true, 1, 0, '#1565C0'
),
(
  'PayPal', 'PayPal — Silvana López',
  'PayPal', 'Silvana López', 'lopez.silvana.psi@gmail.com', NULL,
  'USD', 'Instantáneo',
  'Se aplicará un recargo del 10% por comisiones de PayPal. Recibirás el enlace de pago por email.',
  'Recargo del 10% configurado automáticamente',
  'lopez.silvana.psi@gmail.com', '5.4% + $0.30', 'conectado', 'USD,EUR,GBP,ARS,MXN',
  false, 'Business', 'Instantáneo',
  'Reembolso hasta 24h antes de la cita, menos comisión de PayPal.',
  true, 2, 10, '#FF9800'
),
(
  'Transferencia', 'Transferencia Bancaria — Argentina',
  'Banco Nación', 'Silvana López', 'CBU **** 4920', '0110045830004501249200',
  'ARS', '24 horas',
  'Transferir al CBU indicado. Enviar comprobante por WhatsApp.',
  'Para pacientes en Argentina — pesos argentinos',
  NULL, '0%', 'conectado', 'ARS',
  false, 'Personal', '24 horas',
  'Reembolso completo si se cancela con 48h de anticipación.',
  true, 3, 0, '#43A047'
),
(
  'Tarjeta', 'Stripe — Tarjeta de crédito/débito',
  'Stripe', 'Silvana López', NULL, NULL,
  'USD', 'Instantáneo',
  'Pago seguro con tarjeta de crédito o débito. Visa, Mastercard, Amex aceptadas.',
  'Procesador principal para pagos con tarjeta',
  'lopez.silvana.psi@gmail.com', '2.9% + $0.30', 'conectado', 'USD,EUR,GBP,MXN,ARS',
  true, 'Business', 'Instantáneo',
  'Reembolso completo hasta 24h antes de la cita.',
  true, 4, 0, '#635BFF'
);

-- ============================================================
-- 3. CLIENTS (5)
-- ============================================================

INSERT INTO clients (id, full_name, email, phone, country, reason) VALUES
  ('aa100000-0000-0000-0000-000000000001', 'María González', 'maria.gonzalez@gmail.com', '+1 305 555 1234', 'Florida', 'Ansiedad y estrés laboral. Busco herramientas para manejar situaciones de presión en el trabajo.'),
  ('aa100000-0000-0000-0000-000000000002', 'Carlos Ramírez', 'carlos.ramirez@outlook.com', '+54 9 11 4567 8901', 'Otro', 'Problemas de pareja y comunicación. Quiero mejorar la relación con mi esposa.'),
  ('aa100000-0000-0000-0000-000000000003', 'Ana Martínez', 'ana.martinez@yahoo.com', '+52 55 1234 5678', 'Otro', 'Duelo por pérdida de un familiar cercano.'),
  ('aa100000-0000-0000-0000-000000000004', 'Laura Fernández', 'laura.fernandez@hotmail.com', '+58 412 555 6789', 'Otro', 'Primera consulta. Quiero explorar cómo la terapia puede ayudarme con mi autoestima.'),
  ('aa100000-0000-0000-0000-000000000005', 'Pedro Silva', 'pedro.silva@gmail.com', '+1 786 555 4321', 'Florida', 'Seguimiento de proceso terapéutico. Manejo de ansiedad social.');

-- ============================================================
-- 4. BOOKINGS (5) — 3 in April 2026, 2 in other months
-- ============================================================

-- Booking 1: April — Confirmed (María, individual therapy)
INSERT INTO bookings (id, client_id, service_id, status, preferred_date, confirmed_date, agreed_price, is_first_session, admin_notes, idempotency_key, client_local_time, preferred_payment)
VALUES ('bb100000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000002', 'confirmed',
  '2026-04-14T10:00:00-04:00', '2026-04-14T10:00:00-04:00', 45.00, false,
  'Paciente recurrente. Buen progreso con técnicas de respiración.',
  'demo-maria-20260414-1000', '10:00', 'Zelle — Bank of America');

-- Booking 2: April — Pending (Carlos, couples therapy)
INSERT INTO bookings (id, client_id, service_id, status, preferred_date, agreed_price, is_first_session, admin_notes, idempotency_key, client_local_time, preferred_payment)
VALUES ('bb100000-0000-0000-0000-000000000002', 'aa100000-0000-0000-0000-000000000002', 'cc100000-0000-0000-0000-000000000003', 'pending',
  '2026-04-22T15:00:00-04:00', 60.00, true,
  'Primera consulta de pareja. Viene con su esposa.',
  'demo-carlos-20260422-1500', '16:00', 'PayPal — Silvana López');

-- Booking 3: April — Cancelled (Ana, free consultation)
INSERT INTO bookings (id, client_id, service_id, status, preferred_date, agreed_price, is_first_session, rejection_reason, idempotency_key, client_local_time)
VALUES ('bb100000-0000-0000-0000-000000000003', 'aa100000-0000-0000-0000-000000000003', 'cc100000-0000-0000-0000-000000000001', 'cancelled',
  '2026-04-08T11:00:00-04:00', NULL, true,
  'Paciente canceló por motivos personales. Reagendar cuando esté lista.',
  'demo-ana-20260408-1100', '10:00');

-- Booking 4: February — Completed (Laura, free consultation)
INSERT INTO bookings (id, client_id, service_id, status, preferred_date, confirmed_date, agreed_price, is_first_session, admin_notes, idempotency_key, client_local_time, preferred_payment)
VALUES ('bb100000-0000-0000-0000-000000000004', 'aa100000-0000-0000-0000-000000000004', 'cc100000-0000-0000-0000-000000000001', 'completed',
  '2026-02-18T09:00:00-04:00', '2026-02-18T09:00:00-04:00', NULL, true,
  'Excelente primera sesión. La paciente mostró mucha disposición. Continuar con terapia individual.',
  'demo-laura-20260218-0900', '09:30', 'Transferencia Bancaria — Argentina');

-- Booking 5: June — Confirmed (Pedro, follow-up)
INSERT INTO bookings (id, client_id, service_id, status, preferred_date, confirmed_date, agreed_price, is_first_session, admin_notes, idempotency_key, client_local_time, preferred_payment)
VALUES ('bb100000-0000-0000-0000-000000000005', 'aa100000-0000-0000-0000-000000000005', 'cc100000-0000-0000-0000-000000000004', 'confirmed',
  '2026-06-03T14:00:00-04:00', '2026-06-03T14:00:00-04:00', 40.00, false,
  'Sesión de seguimiento #8. Progreso notable en habilidades sociales.',
  'demo-pedro-20260603-1400', '14:00', 'Stripe — Tarjeta de crédito/débito');

-- ============================================================
-- 5. INVOICES (7) — Various statuses
-- ============================================================

-- Invoice 1: Pagada — linked to booking 1 (María, April)
INSERT INTO invoices (paciente, email, telefono, pais, direccion, concepto, monto, estado, fecha, link, notas, booking_id)
VALUES ('María González', 'maria.gonzalez@gmail.com', '+1 305 555 1234', 'Florida', 'Miami',
  'Sesión de Terapia Individual', 45.00, 'pagada', '2026-04-14',
  'https://pay.example.com/inv-001', 'Pago recibido vía Zelle.', 'bb100000-0000-0000-0000-000000000001');

-- Invoice 2: Pendiente — linked to booking 2 (Carlos, April)
INSERT INTO invoices (paciente, email, telefono, cedula, pais, direccion, concepto, monto, estado, fecha, notas, booking_id)
VALUES ('Carlos Ramírez', 'carlos.ramirez@outlook.com', '+54 9 11 4567 8901', '30-12345678-9', 'Otro', 'Buenos Aires, Argentina',
  'Terapia de Pareja', 60.00, 'pendiente', '2026-04-22',
  'Pendiente de confirmación de cita y pago vía PayPal.', 'bb100000-0000-0000-0000-000000000002');

-- Invoice 3: Vencida — linked to booking 3 (Ana, cancelled)
INSERT INTO invoices (paciente, email, telefono, pais, concepto, monto, estado, fecha, notas, booking_id)
VALUES ('Ana Martínez', 'ana.martinez@yahoo.com', '+52 55 1234 5678', 'Otro',
  'Primera Consulta Gratuita', 0.00, 'vencida', '2026-04-08',
  'Cita cancelada por la paciente.', 'bb100000-0000-0000-0000-000000000003');

-- Invoice 4: Pagada — linked to booking 4 (Laura, completed Feb)
INSERT INTO invoices (paciente, email, telefono, pais, concepto, monto, estado, fecha, notas, booking_id)
VALUES ('Laura Fernández', 'laura.fernandez@hotmail.com', '+58 412 555 6789', 'Otro',
  'Primera Consulta Gratuita', 0.00, 'pagada', '2026-02-18',
  'Sesión gratuita completada exitosamente.', 'bb100000-0000-0000-0000-000000000004');

-- Invoice 5: Pendiente — linked to booking 5 (Pedro, June)
INSERT INTO invoices (paciente, email, telefono, pais, direccion, concepto, monto, estado, fecha, link, notas, booking_id)
VALUES ('Pedro Silva', 'pedro.silva@gmail.com', '+1 786 555 4321', 'Florida', 'Orlando',
  'Sesión de Seguimiento', 40.00, 'pendiente', '2026-06-03',
  'https://pay.example.com/inv-005', 'Enlace de pago enviado via Stripe.', 'bb100000-0000-0000-0000-000000000005');

-- Invoice 6: Pagada — standalone (no booking, March)
INSERT INTO invoices (paciente, email, telefono, pais, concepto, monto, estado, fecha, link, notas)
VALUES ('María González', 'maria.gonzalez@gmail.com', '+1 305 555 1234', 'Florida',
  'Sesión de Terapia Individual', 45.00, 'pagada', '2026-03-20',
  'https://pay.example.com/inv-006', 'Sesión de marzo. Pago recibido vía Zelle.');

-- Invoice 7: Pendiente — standalone (no booking, April)
INSERT INTO invoices (paciente, email, telefono, cedula, pais, direccion, concepto, monto, estado, fecha, link, notas)
VALUES ('Carlos Ramírez', 'carlos.ramirez@outlook.com', '+54 9 11 4567 8901', '30-12345678-9', 'Otro', 'Buenos Aires, Argentina',
  'Sesión de Terapia Individual', 45.00, 'pendiente', '2026-04-28',
  'https://pay.example.com/inv-007', 'Factura generada para próxima sesión.');

-- ============================================================
-- 6. PAYMENT LINKS (4) — only for paid services
-- ============================================================

-- Link 1: Paid — booking 1 (María, Stripe)
INSERT INTO payment_links (booking_id, provider, url, amount, surcharge_pct, total, status, expires_at)
VALUES ('bb100000-0000-0000-0000-000000000001', 'stripe', 'https://pay.example.com/link-001', 45.00, 0, 45.00, 'paid', '2026-04-14T23:59:00-04:00');

-- Link 2: Active — booking 2 (Carlos, PayPal +10%)
INSERT INTO payment_links (booking_id, provider, url, amount, surcharge_pct, total, status, expires_at)
VALUES ('bb100000-0000-0000-0000-000000000002', 'paypal', 'https://pay.example.com/link-002', 60.00, 10, 66.00, 'active', '2026-04-24T23:59:00-04:00');

-- Link 3: Active — booking 5 (Pedro, Stripe)
INSERT INTO payment_links (booking_id, provider, url, amount, surcharge_pct, total, status, expires_at)
VALUES ('bb100000-0000-0000-0000-000000000005', 'stripe', 'https://pay.example.com/link-003', 40.00, 0, 40.00, 'active', '2026-06-05T23:59:00-04:00');

-- Link 4: Expired — standalone (no booking)
INSERT INTO payment_links (booking_id, provider, url, amount, surcharge_pct, total, status, expires_at)
VALUES (NULL, 'paypal', 'https://pay.example.com/link-004', 45.00, 10, 49.50, 'expired', '2026-03-15T23:59:00-04:00');
