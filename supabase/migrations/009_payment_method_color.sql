-- Add color identifier field to payment methods
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;
