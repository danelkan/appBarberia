-- ============================================================
-- Migration v5: Daily cash registers, movements, and audit logs
-- Run this in Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  opening_amount numeric(10,2) NOT NULL DEFAULT 0,
  expected_cash_amount numeric(10,2),
  counted_cash_amount numeric(10,2),
  difference_amount numeric(10,2),
  opened_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  opening_notes text,
  closing_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income_service', 'income_product', 'income_extra', 'expense', 'adjustment')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  reference_type text,
  reference_id text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  performed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_branch_status ON cash_registers(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_company ON cash_registers(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(cash_register_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_branch ON cash_movements(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_audit_logs_register ON cash_audit_logs(cash_register_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cash_register_open_per_branch
  ON cash_registers(branch_id)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION set_cash_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cash_registers_updated_at ON cash_registers;
CREATE TRIGGER trigger_cash_registers_updated_at
  BEFORE UPDATE ON cash_registers
  FOR EACH ROW EXECUTE FUNCTION set_cash_updated_at();

DROP TRIGGER IF EXISTS trigger_cash_movements_updated_at ON cash_movements;
CREATE TRIGGER trigger_cash_movements_updated_at
  BEFORE UPDATE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION set_cash_updated_at();

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_registers_auth_all" ON cash_registers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "cash_movements_auth_all" ON cash_movements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "cash_audit_logs_auth_all" ON cash_audit_logs FOR ALL USING (auth.role() = 'authenticated');
