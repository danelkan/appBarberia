-- ─────────────────────────────────────────────────────────────────────────────
-- v18: Performance indexes + security hardening
-- ─────────────────────────────────────────────────────────────────────────────
-- All queries in the application scope by company_id first.  Without compound
-- indexes Postgres has to scan the full table and then filter.
-- These indexes are created CONCURRENTLY so they don't lock writes in production.
-- ─────────────────────────────────────────────────────────────────────────────

-- appointments: most-queried table — scope + date range + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_company_date
  ON public.appointments (company_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_company_barber_date
  ON public.appointments (company_id, barber_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_company_branch_date
  ON public.appointments (company_id, branch_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_company_status
  ON public.appointments (company_id, status);

-- payments: always filtered by company + appointment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_company_created
  ON public.payments (company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_appointment
  ON public.payments (appointment_id);

-- cash_registers: open-register lookup is hot path on every payment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_registers_branch_status
  ON public.cash_registers (branch_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_registers_company_status
  ON public.cash_registers (company_id, status);

-- cash_movements: summary queries scan by register
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_movements_register
  ON public.cash_movements (cash_register_id);

-- barber_branches: joins on barber_id happen on every agenda load
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_barber_branches_barber
  ON public.barber_branches (barber_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_barber_branches_branch
  ON public.barber_branches (branch_id);

-- user_roles: role resolution is cached 30s but cold-starts still hit this
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_company
  ON public.user_roles (company_id);

-- clients: search by company + text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_company
  ON public.clients (company_id);

-- services: company-scoped listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_company_active
  ON public.services (company_id, active);

-- branches: company-scoped listing (small table, cheap index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branches_company_active
  ON public.branches (company_id, active);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS hardening: ensure no table is readable without a policy
-- (belt-and-suspenders — v14 already set strict policies, this re-enforces)
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify RLS is enabled on all tenant tables (idempotent)
ALTER TABLE public.appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies       ENABLE ROW LEVEL SECURITY;
