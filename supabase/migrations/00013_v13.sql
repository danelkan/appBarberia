-- ============================================================
-- Migration v13: Multi-tenant isolation
--   • Add company_id to barbers, clients, appointments, payments
--   • Backfill from existing relationships
--   • Drop dangerous public-read RLS on clients & appointments
--   • Add company-scoped RLS for direct DB access
-- ============================================================

-- ─── 1. Add company_id columns ───────────────────────────────────────────────

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- ─── 2. Backfill barbers ─────────────────────────────────────────────────────
-- Derive company_id via: barbers → user_roles.company_id

UPDATE public.barbers b
SET company_id = ur.company_id
FROM public.user_roles ur
WHERE ur.barber_id = b.id
  AND ur.company_id IS NOT NULL
  AND b.company_id IS NULL;

-- Fallback: assign remaining barbers to the single active company
UPDATE public.barbers
SET company_id = (
  SELECT id FROM public.companies WHERE active = true ORDER BY created_at LIMIT 1
)
WHERE company_id IS NULL;

-- ─── 3. Backfill appointments ────────────────────────────────────────────────
-- Derive company_id via: appointments.branch_id → branches.company_id

UPDATE public.appointments a
SET company_id = br.company_id
FROM public.branches br
WHERE a.branch_id = br.id
  AND br.company_id IS NOT NULL
  AND a.company_id IS NULL;

-- Fallback: assign remaining appointments (no branch) to single active company
UPDATE public.appointments
SET company_id = (
  SELECT id FROM public.companies WHERE active = true ORDER BY created_at LIMIT 1
)
WHERE company_id IS NULL;

-- ─── 4. Backfill clients ─────────────────────────────────────────────────────
-- Derive company_id via: clients → appointments.company_id (most recent wins)

UPDATE public.clients c
SET company_id = (
  SELECT a.company_id
  FROM public.appointments a
  WHERE a.client_id = c.id
    AND a.company_id IS NOT NULL
  ORDER BY a.created_at DESC
  LIMIT 1
)
WHERE company_id IS NULL;

-- Fallback: assign remaining clients (no appointments) to single active company
UPDATE public.clients
SET company_id = (
  SELECT id FROM public.companies WHERE active = true ORDER BY created_at LIMIT 1
)
WHERE company_id IS NULL;

-- ─── 5. Backfill payments ────────────────────────────────────────────────────
-- Derive company_id via: payments.appointment_id → appointments.company_id

UPDATE public.payments p
SET company_id = a.company_id
FROM public.appointments a
WHERE p.appointment_id = a.id
  AND a.company_id IS NOT NULL
  AND p.company_id IS NULL;

-- Fallback
UPDATE public.payments
SET company_id = (
  SELECT id FROM public.companies WHERE active = true ORDER BY created_at LIMIT 1
)
WHERE company_id IS NULL;

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_barbers_company     ON public.barbers(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company     ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company ON public.appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company    ON public.payments(company_id);

-- ─── 7. Fix RLS policies ─────────────────────────────────────────────────────
-- The two most dangerous policies: unrestricted public read on PII tables.
-- The API routes use the service role key (bypasses RLS entirely), so removing
-- these policies does NOT break any API — it only closes the direct-Supabase-
-- client / anon-key attack surface.

DROP POLICY IF EXISTS "Public read clients"     ON public.clients;
DROP POLICY IF EXISTS "Public read appointments" ON public.appointments;

-- Clients: authenticated users can only read their own company's clients.
-- The JWT app_metadata.company_id is set by your auth hook when the user logs in.
-- Service role bypasses this (all API routes go through service role).
CREATE POLICY "clients_company_read" ON public.clients
  FOR SELECT
  USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Appointments: same pattern — company-scoped read for authenticated users.
CREATE POLICY "appointments_company_read" ON public.appointments
  FOR SELECT
  USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Keep public insert for the booking flow (client-side self-booking).
-- These are already present; including here for documentation.
-- "Public insert clients"     ON public.clients     FOR INSERT WITH CHECK (true)
-- "Public insert appointments" ON public.appointments FOR INSERT WITH CHECK (true)

-- ─── 8. Tighten barbers public read ──────────────────────────────────────────
-- The existing "Public read barbers" policy exposes all barbers from all
-- companies. Replace with a company-scoped version.
-- The booking flow always passes ?branch_id=... so we can scope at the API
-- layer, but closing this at the DB level is belt-and-suspenders.

DROP POLICY IF EXISTS "Public read barbers" ON public.barbers;

-- Allow anon to read barbers only when querying for a known branch's company.
-- Since the API uses service role this policy targets direct client access only.
-- We keep it permissive (true) for now because the booking page fetches barbers
-- anonymously and our isolation is enforced at the API layer (company_id filter
-- added in v13 API fixes).  Mark this as a TODO for a future JWT-based policy
-- once the booking page passes a company token.
CREATE POLICY "Public read barbers" ON public.barbers
  FOR SELECT USING (true);

-- ─── END OF MIGRATION ────────────────────────────────────────────────────────
-- After applying this migration:
--   1. Deploy API code changes (v13 API fixes) so all writes populate company_id
--   2. Verify backfill counts: SELECT company_id, count(*) FROM barbers GROUP BY 1
--   3. Set company_id NOT NULL once you've confirmed no NULLs remain (optional):
--      ALTER TABLE barbers     ALTER COLUMN company_id SET NOT NULL;
--      ALTER TABLE clients     ALTER COLUMN company_id SET NOT NULL;
--      ALTER TABLE appointments ALTER COLUMN company_id SET NOT NULL;
--      ALTER TABLE payments    ALTER COLUMN company_id SET NOT NULL;
