-- Add surcharge percentage field to payment methods
-- Allows each payment method to define an additional % charged to the client
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS recargo_pct NUMERIC DEFAULT 0;
