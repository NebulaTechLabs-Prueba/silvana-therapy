-- ============================================================
-- Migration 010: Schema Hardening & Field Constraints
-- ============================================================

-- 1. Standardize recargo_pct type to DECIMAL(5,2)
ALTER TABLE payment_methods
  ALTER COLUMN recargo_pct TYPE DECIMAL(5,2) USING recargo_pct::DECIMAL(5,2);

-- 2. CHECK constraints for non-negative monetary values
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_monto_positive CHECK (monto >= 0);

ALTER TABLE payments
  ADD CONSTRAINT chk_payments_amount_positive CHECK (amount >= 0),
  ADD CONSTRAINT chk_payments_total_positive CHECK (total >= 0),
  ADD CONSTRAINT chk_payments_surcharge_range CHECK (surcharge_pct >= 0 AND surcharge_pct <= 100);

ALTER TABLE payment_links
  ADD CONSTRAINT chk_payment_links_amount_positive CHECK (amount >= 0),
  ADD CONSTRAINT chk_payment_links_total_positive CHECK (total >= 0),
  ADD CONSTRAINT chk_payment_links_surcharge_range CHECK (surcharge_pct >= 0 AND surcharge_pct <= 100);

ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_price_positive CHECK (agreed_price IS NULL OR agreed_price >= 0);

-- 3. CHECK constraints for sort/priority fields
ALTER TABLE payment_methods
  ADD CONSTRAINT chk_payment_methods_prioridad CHECK (prioridad >= 0),
  ADD CONSTRAINT chk_payment_methods_recargo_range CHECK (recargo_pct >= 0 AND recargo_pct <= 100);

ALTER TABLE services
  ADD CONSTRAINT chk_services_sort_order CHECK (sort_order >= 0),
  ADD CONSTRAINT chk_services_duration CHECK (duration_min > 0);

-- 4. Add length constraints to prevent abuse on text fields
-- Clients table
ALTER TABLE clients
  ADD CONSTRAINT chk_clients_name_length CHECK (char_length(full_name) <= 200),
  ADD CONSTRAINT chk_clients_email_length CHECK (char_length(email) <= 320),
  ADD CONSTRAINT chk_clients_phone_length CHECK (phone IS NULL OR char_length(phone) <= 30),
  ADD CONSTRAINT chk_clients_country_length CHECK (country IS NULL OR char_length(country) <= 100),
  ADD CONSTRAINT chk_clients_reason_length CHECK (reason IS NULL OR char_length(reason) <= 2000);

-- Bookings table
ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_notes_length CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000),
  ADD CONSTRAINT chk_bookings_rejection_length CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 1000),
  ADD CONSTRAINT chk_bookings_idempotency_length CHECK (idempotency_key IS NULL OR char_length(idempotency_key) <= 100),
  ADD CONSTRAINT chk_bookings_payment_length CHECK (preferred_payment IS NULL OR char_length(preferred_payment) <= 100),
  ADD CONSTRAINT chk_bookings_localtime_length CHECK (client_local_time IS NULL OR char_length(client_local_time) <= 20);

-- Invoices table
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_paciente_length CHECK (char_length(paciente) <= 200),
  ADD CONSTRAINT chk_invoices_email_length CHECK (email IS NULL OR char_length(email) <= 320),
  ADD CONSTRAINT chk_invoices_concepto_length CHECK (char_length(concepto) <= 300),
  ADD CONSTRAINT chk_invoices_link_length CHECK (link IS NULL OR char_length(link) <= 2048),
  ADD CONSTRAINT chk_invoices_notas_length CHECK (notas IS NULL OR char_length(notas) <= 2000),
  ADD CONSTRAINT chk_invoices_telefono_length CHECK (telefono IS NULL OR char_length(telefono) <= 30),
  ADD CONSTRAINT chk_invoices_cedula_length CHECK (cedula IS NULL OR char_length(cedula) <= 30),
  ADD CONSTRAINT chk_invoices_pais_length CHECK (pais IS NULL OR char_length(pais) <= 100),
  ADD CONSTRAINT chk_invoices_direccion_length CHECK (direccion IS NULL OR char_length(direccion) <= 300);

-- Payment methods table
ALTER TABLE payment_methods
  ADD CONSTRAINT chk_pm_nombre_length CHECK (char_length(nombre) <= 200),
  ADD CONSTRAINT chk_pm_titular_length CHECK (titular IS NULL OR char_length(titular) <= 200),
  ADD CONSTRAINT chk_pm_banco_length CHECK (banco IS NULL OR char_length(banco) <= 200),
  ADD CONSTRAINT chk_pm_cuenta_vis_length CHECK (cuenta_visible IS NULL OR char_length(cuenta_visible) <= 50),
  ADD CONSTRAINT chk_pm_cuenta_comp_length CHECK (cuenta_completa IS NULL OR char_length(cuenta_completa) <= 100),
  ADD CONSTRAINT chk_pm_instrucciones_length CHECK (instrucciones IS NULL OR char_length(instrucciones) <= 1000),
  ADD CONSTRAINT chk_pm_notas_length CHECK (notas_internas IS NULL OR char_length(notas_internas) <= 1000);

-- Services table
ALTER TABLE services
  ADD CONSTRAINT chk_services_name_length CHECK (char_length(name) <= 200),
  ADD CONSTRAINT chk_services_desc_length CHECK (description IS NULL OR char_length(description) <= 2000);

-- Admin settings
ALTER TABLE admin_settings
  ADD CONSTRAINT chk_settings_question_length CHECK (security_question IS NULL OR char_length(security_question) <= 500),
  ADD CONSTRAINT chk_settings_answer_length CHECK (security_answer IS NULL OR char_length(security_answer) <= 200);

-- 5. Email format validation at DB level
ALTER TABLE clients
  ADD CONSTRAINT chk_clients_email_format CHECK (email ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$');

-- 6. Ensure RLS read policy for payment_methods (public needs to see active methods for booking form)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_methods' AND policyname = 'Anyone can read active payment methods'
  ) THEN
    CREATE POLICY "Anyone can read active payment methods" ON payment_methods
      FOR SELECT USING (activo = TRUE);
  END IF;
END $$;

-- 7. Index for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_invoices_paciente ON invoices (paciente);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON bookings (preferred_date);
