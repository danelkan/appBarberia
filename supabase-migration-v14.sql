-- ============================================================
-- Migration v14: definitive multi-tenant hardening
--   • Close remaining direct-DB leak paths with strict RLS
--   • Enforce tenant consistency with triggers
--   • Normalize company_id across all operational tables
--   • Remove legacy/test data that crosses tenants
--   • Add tenant indexes for the hottest paths
-- ============================================================

BEGIN;

-- ─── 1. Missing tenant columns ───────────────────────────────────

ALTER TABLE public.barber_branches
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- ─── 2. Backfill company_id everywhere relevant ──────────────────

UPDATE public.branches br
SET company_id = (
  SELECT id
  FROM public.companies
  WHERE active = true
  ORDER BY created_at
  LIMIT 1
)
WHERE br.company_id IS NULL;

UPDATE public.services s
SET company_id = (
  SELECT id
  FROM public.companies
  WHERE active = true
  ORDER BY created_at
  LIMIT 1
)
WHERE s.company_id IS NULL;

UPDATE public.barbers b
SET company_id = ur.company_id
FROM public.user_roles ur
WHERE ur.barber_id = b.id
  AND ur.company_id IS NOT NULL
  AND b.company_id IS DISTINCT FROM ur.company_id;

UPDATE public.barbers b
SET company_id = br.company_id
FROM public.barber_branches bb
JOIN public.branches br ON br.id = bb.branch_id
WHERE bb.barber_id = b.id
  AND br.company_id IS NOT NULL
  AND b.company_id IS NULL;

UPDATE public.clients c
SET company_id = a.company_id
FROM public.appointments a
WHERE a.client_id = c.id
  AND a.company_id IS NOT NULL
  AND c.company_id IS DISTINCT FROM a.company_id;

UPDATE public.appointments a
SET company_id = br.company_id
FROM public.branches br
WHERE a.branch_id = br.id
  AND br.company_id IS NOT NULL
  AND a.company_id IS DISTINCT FROM br.company_id;

UPDATE public.payments p
SET company_id = a.company_id
FROM public.appointments a
WHERE p.appointment_id = a.id
  AND a.company_id IS NOT NULL
  AND p.company_id IS DISTINCT FROM a.company_id;

UPDATE public.cash_registers cr
SET company_id = br.company_id
FROM public.branches br
WHERE cr.branch_id = br.id
  AND br.company_id IS NOT NULL
  AND cr.company_id IS DISTINCT FROM br.company_id;

UPDATE public.cash_movements cm
SET company_id = cr.company_id,
    branch_id = cr.branch_id
FROM public.cash_registers cr
WHERE cm.cash_register_id = cr.id
  AND (
    cm.company_id IS DISTINCT FROM cr.company_id
    OR cm.branch_id IS DISTINCT FROM cr.branch_id
  );

UPDATE public.cash_audit_logs cal
SET company_id = cr.company_id,
    branch_id = cr.branch_id
FROM public.cash_registers cr
WHERE cal.cash_register_id = cr.id
  AND (
    cal.company_id IS DISTINCT FROM cr.company_id
    OR cal.branch_id IS DISTINCT FROM cr.branch_id
  );

UPDATE public.barber_branches bb
SET company_id = br.company_id
FROM public.branches br
WHERE bb.branch_id = br.id
  AND br.company_id IS NOT NULL
  AND bb.company_id IS DISTINCT FROM br.company_id;

-- ─── 3. Legacy cleanup ───────────────────────────────────────────

DELETE FROM public.branches
WHERE name ILIKE 'Sucursal Test';

DELETE FROM public.barber_branches bb
USING public.barbers b, public.branches br
WHERE bb.barber_id = b.id
  AND bb.branch_id = br.id
  AND (
    b.company_id IS NULL
    OR br.company_id IS NULL
    OR b.company_id IS DISTINCT FROM br.company_id
  );

DELETE FROM public.appointments a
USING public.clients c, public.barbers b, public.services s, public.branches br
WHERE a.client_id = c.id
  AND a.barber_id = b.id
  AND a.service_id = s.id
  AND a.branch_id = br.id
  AND (
    a.company_id IS NULL
    OR c.company_id IS NULL
    OR b.company_id IS NULL
    OR s.company_id IS NULL
    OR br.company_id IS NULL
    OR a.company_id IS DISTINCT FROM c.company_id
    OR a.company_id IS DISTINCT FROM b.company_id
    OR a.company_id IS DISTINCT FROM s.company_id
    OR a.company_id IS DISTINCT FROM br.company_id
  );

DELETE FROM public.payments p
USING public.appointments a
WHERE p.appointment_id = a.id
  AND (
    p.company_id IS NULL
    OR a.company_id IS NULL
    OR p.company_id IS DISTINCT FROM a.company_id
  );

DELETE FROM public.cash_registers cr
USING public.branches br
WHERE cr.branch_id = br.id
  AND (
    cr.company_id IS NULL
    OR br.company_id IS NULL
    OR cr.company_id IS DISTINCT FROM br.company_id
  );

DELETE FROM public.cash_movements cm
USING public.cash_registers cr
WHERE cm.cash_register_id = cr.id
  AND (
    cm.company_id IS NULL
    OR cr.company_id IS NULL
    OR cm.company_id IS DISTINCT FROM cr.company_id
    OR cm.branch_id IS DISTINCT FROM cr.branch_id
  );

DELETE FROM public.cash_audit_logs cal
USING public.cash_registers cr
WHERE cal.cash_register_id = cr.id
  AND (
    cal.company_id IS NULL
    OR cr.company_id IS NULL
    OR cal.company_id IS DISTINCT FROM cr.company_id
    OR cal.branch_id IS DISTINCT FROM cr.branch_id
  );

DELETE FROM public.clients
WHERE company_id IS NULL;

DELETE FROM public.barbers
WHERE company_id IS NULL;

DELETE FROM public.services
WHERE company_id IS NULL;

DELETE FROM public.appointments
WHERE company_id IS NULL
   OR branch_id IS NULL;

DELETE FROM public.payments
WHERE company_id IS NULL;

DELETE FROM public.cash_registers
WHERE company_id IS NULL;

DELETE FROM public.cash_movements
WHERE company_id IS NULL;

DELETE FROM public.barber_branches
WHERE company_id IS NULL;

-- ─── 4. Tenant-safe uniqueness + indexes ────────────────────────

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_clients_company_email
  ON public.clients(company_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_company_phone
  ON public.clients(company_id, phone);

CREATE INDEX IF NOT EXISTS idx_services_company_active
  ON public.services(company_id, active, price);

CREATE INDEX IF NOT EXISTS idx_branches_company_active
  ON public.branches(company_id, active, name);

CREATE INDEX IF NOT EXISTS idx_appointments_company_branch_date
  ON public.appointments(company_id, branch_id, date, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_company_barber_date
  ON public.appointments(company_id, barber_id, date, start_time);

CREATE INDEX IF NOT EXISTS idx_payments_company_created
  ON public.payments(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_company_appointment
  ON public.payments(company_id, appointment_id);

CREATE INDEX IF NOT EXISTS idx_cash_registers_company_branch_status
  ON public.cash_registers(company_id, branch_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_company_register
  ON public.cash_movements(company_id, cash_register_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_barber_branches_company_branch
  ON public.barber_branches(company_id, branch_id, barber_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_company_user
  ON public.user_roles(company_id, user_id);

-- ─── 5. Hard tenant constraints via triggers ─────────────────────

CREATE OR REPLACE FUNCTION public.enforce_appointment_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_company uuid;
  v_client_company uuid;
  v_barber_company uuid;
  v_service_company uuid;
BEGIN
  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'appointments.branch_id is required for multi-tenant isolation';
  END IF;

  SELECT company_id INTO v_branch_company FROM public.branches WHERE id = NEW.branch_id;
  SELECT company_id INTO v_client_company FROM public.clients WHERE id = NEW.client_id;
  SELECT company_id INTO v_barber_company FROM public.barbers WHERE id = NEW.barber_id;
  SELECT company_id INTO v_service_company FROM public.services WHERE id = NEW.service_id;

  IF v_branch_company IS NULL OR v_client_company IS NULL OR v_barber_company IS NULL OR v_service_company IS NULL THEN
    RAISE EXCEPTION 'appointment references a row without company_id';
  END IF;

  IF v_branch_company <> v_client_company
     OR v_branch_company <> v_barber_company
     OR v_branch_company <> v_service_company THEN
    RAISE EXCEPTION 'cross-tenant appointment references are not allowed';
  END IF;

  NEW.company_id := v_branch_company;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_payment_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.appointments
  WHERE id = NEW.appointment_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'payment requires an appointment with company_id';
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cash_register_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'cash register branch must belong to a company';
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cash_movement_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid;
  v_branch_id uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company_id, v_branch_id
  FROM public.cash_registers
  WHERE id = NEW.cash_register_id;

  IF v_company_id IS NULL OR v_branch_id IS NULL THEN
    RAISE EXCEPTION 'cash movement requires a valid cash register';
  END IF;

  NEW.company_id := v_company_id;
  NEW.branch_id := v_branch_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_barber_branch_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_barber_company uuid;
  v_branch_company uuid;
BEGIN
  SELECT company_id INTO v_barber_company
  FROM public.barbers
  WHERE id = NEW.barber_id;

  SELECT company_id INTO v_branch_company
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF v_barber_company IS NULL OR v_branch_company IS NULL THEN
    RAISE EXCEPTION 'barber_branch requires company_id on both sides';
  END IF;

  IF v_barber_company <> v_branch_company THEN
    RAISE EXCEPTION 'barber cannot be assigned to another company branch';
  END IF;

  NEW.company_id := v_branch_company;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_appointment_company ON public.appointments;
CREATE TRIGGER trigger_enforce_appointment_company
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_company();

DROP TRIGGER IF EXISTS trigger_enforce_payment_company ON public.payments;
CREATE TRIGGER trigger_enforce_payment_company
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_company();

DROP TRIGGER IF EXISTS trigger_enforce_cash_register_company ON public.cash_registers;
CREATE TRIGGER trigger_enforce_cash_register_company
  BEFORE INSERT OR UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_register_company();

DROP TRIGGER IF EXISTS trigger_enforce_cash_movement_company ON public.cash_movements;
CREATE TRIGGER trigger_enforce_cash_movement_company
  BEFORE INSERT OR UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_movement_company();

DROP TRIGGER IF EXISTS trigger_enforce_barber_branch_company ON public.barber_branches;
CREATE TRIGGER trigger_enforce_barber_branch_company
  BEFORE INSERT OR UPDATE ON public.barber_branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_barber_branch_company();

-- ─── 6. NOT NULL where tenant ownership is mandatory ─────────────

ALTER TABLE public.branches        ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.services        ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.barbers         ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.clients         ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.appointments    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.payments        ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cash_registers  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cash_movements  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cash_audit_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.barber_branches ALTER COLUMN company_id SET NOT NULL;

-- ─── 7. Strict RLS helpers ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.request_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid,
    (
      SELECT ur.company_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_company_access(row_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_superadmin()
      OR row_company_id = public.request_company_id()
    );
$$;

-- ─── 8. Replace permissive RLS policies ──────────────────────────

ALTER TABLE public.companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_branches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_audit_logs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_public_read" ON public.branches;
DROP POLICY IF EXISTS "branches_auth_write" ON public.branches;
DROP POLICY IF EXISTS "barber_branches_public_read" ON public.barber_branches;
DROP POLICY IF EXISTS "barber_branches_auth_write" ON public.barber_branches;
DROP POLICY IF EXISTS "payments_auth_all" ON public.payments;
DROP POLICY IF EXISTS "cash_registers_auth_all" ON public.cash_registers;
DROP POLICY IF EXISTS "cash_movements_auth_all" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_audit_logs_auth_all" ON public.cash_audit_logs;
DROP POLICY IF EXISTS "companies_auth_read" ON public.companies;
DROP POLICY IF EXISTS "companies_auth_write" ON public.companies;
DROP POLICY IF EXISTS "Public read barbers" ON public.barbers;
DROP POLICY IF EXISTS "Public read services" ON public.services;
DROP POLICY IF EXISTS "Public insert clients" ON public.clients;
DROP POLICY IF EXISTS "Public insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "clients_company_read" ON public.clients;
DROP POLICY IF EXISTS "appointments_company_read" ON public.appointments;

CREATE POLICY companies_tenant_select ON public.companies
  FOR SELECT USING (public.is_superadmin() OR id = public.request_company_id());

CREATE POLICY companies_superadmin_write ON public.companies
  FOR ALL USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY branches_company_all ON public.branches
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY barbers_company_all ON public.barbers
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY services_company_all ON public.services
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY clients_company_all ON public.clients
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY appointments_company_all ON public.appointments
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY payments_company_all ON public.payments
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY user_roles_company_all ON public.user_roles
  FOR ALL USING (
    public.is_superadmin()
    OR (
      company_id IS NOT NULL
      AND public.has_company_access(company_id)
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR (
      company_id IS NOT NULL
      AND public.has_company_access(company_id)
    )
  );

CREATE POLICY barber_branches_company_all ON public.barber_branches
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY cash_registers_company_all ON public.cash_registers
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY cash_movements_company_all ON public.cash_movements
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY cash_audit_logs_company_all ON public.cash_audit_logs
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

COMMIT;
