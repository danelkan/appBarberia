-- ============================================================
-- Migration v2: Branches, Barber-Branch assignments, Payments
-- Run this in Supabase > SQL Editor
-- ============================================================

-- ─── Branches ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  address     text,
  phone       text,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ─── Barber ↔ Branch (many-to-many) ───────────────────────
CREATE TABLE IF NOT EXISTS barber_branches (
  barber_id   uuid REFERENCES barbers(id) ON DELETE CASCADE,
  branch_id   uuid REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, branch_id)
);

-- ─── Add branch_id to appointments ────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);

-- ─── Payments (caja) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id  uuid REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  amount          numeric(10,2) NOT NULL,
  method          text NOT NULL CHECK (method IN ('efectivo','mercado_pago','debito','transferencia')),
  receipt_number  text UNIQUE,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_branch ON appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_barber_branches_branch ON barber_branches(branch_id);

-- ─── RLS Policies ─────────────────────────────────────────
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Branches: public read, authenticated write
CREATE POLICY "branches_public_read" ON branches FOR SELECT USING (true);
CREATE POLICY "branches_auth_write"  ON branches FOR ALL USING (auth.role() = 'authenticated');

-- Barber branches: public read
CREATE POLICY "barber_branches_public_read" ON barber_branches FOR SELECT USING (true);
CREATE POLICY "barber_branches_auth_write"  ON barber_branches FOR ALL USING (auth.role() = 'authenticated');

-- Payments: authenticated only
CREATE POLICY "payments_auth_all" ON payments FOR ALL USING (auth.role() = 'authenticated');

-- ─── Seed: Branches ───────────────────────────────────────
INSERT INTO branches (id, name, address, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Cordón',         'José Enrique Rodó 1969, Montevideo', '096374477'),
  ('22222222-2222-2222-2222-222222222222', 'Punta Carretas',  'Punta Carretas, Montevideo',         '096374477')
ON CONFLICT DO NOTHING;

-- ─── Update services with real UYU prices ─────────────────
DELETE FROM services;
INSERT INTO services (name, price, duration_minutes, active) VALUES
  ('Corte de Cabello',          490,   40,  true),
  ('Corte + Barba',             700,   60,  true),
  ('Barba',                     300,   20,  true),
  ('Facial',                    500,   35,  true),
  ('Colorimetría (Mechas)',      1500,  180, true),
  ('Colorimetría (Completo)',    2000,  240, true),
  ('Clase de Barbería',         2000,  120, true);

-- ─── Assign barbers to branches ───────────────────────────
-- Run AFTER you know the barber UUIDs. Example:
-- INSERT INTO barber_branches (barber_id, branch_id) VALUES
--   ('<kike-uuid>',   '11111111-1111-1111-1111-111111111111'),
--   ('<kike-uuid>',   '22222222-2222-2222-2222-222222222222'),
--   ('<stephi-uuid>', '11111111-1111-1111-1111-111111111111');

-- ─── Receipt number sequence ──────────────────────────────
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1000;

-- Auto-generate receipt number on payment insert
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'REC-' || LPAD(nextval('receipt_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_receipt_number ON payments;
CREATE TRIGGER trigger_set_receipt_number
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION set_receipt_number();
