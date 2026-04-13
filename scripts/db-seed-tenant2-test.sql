-- ==================================================================
-- db-seed-tenant2-test.sql
-- Creates a second barbershop (Tenant 2) for multi-tenant isolation testing.
-- Run AFTER applying supabase-migration-v13.sql.
--
-- Purpose: verify that Tenant 1 (Felito Studios) data is NOT accessible
-- to Tenant 2 admins/barbers through any API endpoint.
--
-- To run: paste into Supabase SQL Editor > Run
-- ==================================================================

BEGIN;

-- ── 1. Company ────────────────────────────────────────────────────
INSERT INTO public.companies (name, slug, email, active, plan_tier, max_branches, max_barbers)
VALUES (
  'Barbería Test Tenant 2',
  'test-tenant-2',
  'admin@test-tenant-2.com',
  true,
  'starter',
  1,
  3
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Branch ────────────────────────────────────────────────────
INSERT INTO public.branches (company_id, name, address, phone, active)
SELECT id, 'Sucursal Test', 'Calle Falsa 123', '099 999 999', true
FROM public.companies WHERE slug = 'test-tenant-2'
ON CONFLICT DO NOTHING;

-- ── 3. Barber (no auth user — we insert directly for isolation testing) ──
-- This barber has company_id = test-tenant-2, so they should NOT be
-- returned by /api/barbers when called from a Tenant 1 session.
INSERT INTO public.barbers (name, email, company_id)
SELECT 'Barbero Tenant2', 'barbero@test-tenant-2.com', c.id
FROM public.companies c WHERE c.slug = 'test-tenant-2'
ON CONFLICT (email) DO NOTHING;

-- Link the barber to the test branch so they appear in listing queries
INSERT INTO public.barber_branches (barber_id, branch_id)
SELECT b.id, br.id
FROM public.barbers b
JOIN public.branches br ON br.company_id = (
  SELECT id FROM public.companies WHERE slug = 'test-tenant-2'
)
WHERE b.email = 'barbero@test-tenant-2.com'
ON CONFLICT DO NOTHING;

-- ── 4. Services ──────────────────────────────────────────────────
INSERT INTO public.services (name, price, duration_minutes, active, company_id)
SELECT s.name, s.price, s.duration_minutes, true, c.id
FROM public.companies c,
(VALUES
  ('Corte Tenant2',       800, 30),
  ('Barba Tenant2',       500, 20),
  ('Corte + Barba Tenant2', 1200, 50)
) AS s(name, price, duration_minutes)
WHERE c.slug = 'test-tenant-2'
ON CONFLICT DO NOTHING;

-- ── 5. Client (tenant-scoped) ─────────────────────────────────────
-- This client belongs to Tenant 2 and must NOT appear in Tenant 1 client lists.
INSERT INTO public.clients (first_name, last_name, email, phone, company_id)
SELECT 'Cliente', 'Tenant2', 'cliente@test-tenant-2.com', '099111222', c.id
FROM public.companies c WHERE c.slug = 'test-tenant-2'
ON CONFLICT DO NOTHING;

-- ── 6. Appointment (tenant-scoped) ───────────────────────────────
-- Links the Tenant 2 client to the Tenant 2 barber + branch.
-- Must NOT be returned by /api/appointments when called by a Tenant 1 session.
INSERT INTO public.appointments (
  client_id, barber_id, service_id, branch_id, company_id,
  date, start_time, end_time, status
)
SELECT
  cl.id,
  ba.id,
  sv.id,
  br.id,
  co.id,
  CURRENT_DATE + 1,   -- tomorrow
  '10:00',
  '10:30',
  'pendiente'
FROM
  public.companies co
  JOIN public.branches br   ON br.company_id = co.id
  JOIN public.barbers ba    ON ba.company_id = co.id
  JOIN public.services sv   ON sv.company_id = co.id
  JOIN public.clients cl    ON cl.company_id = co.id
WHERE co.slug = 'test-tenant-2'
  AND sv.name = 'Corte Tenant2'
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Next steps: manual validation ─────────────────────────────────
-- 1. Log in as a Felito Studios (Tenant 1) admin
-- 2. GET /api/clients        → must NOT include 'cliente@test-tenant-2.com'
-- 3. GET /api/appointments   → must NOT include the Tenant 2 appointment
-- 4. GET /api/barbers        → must NOT include 'barbero@test-tenant-2.com'
-- 5. GET /api/services       → must NOT include 'Corte Tenant2'
--
-- 6. Create a test auth user for Tenant 2 in Supabase Dashboard > Authentication
-- 7. Insert user_roles row:
--    INSERT INTO user_roles (user_id, company_id, role, active)
--    VALUES ('<TENANT2_AUTH_USER_UUID>', '<TENANT2_COMPANY_UUID>', 'admin', true);
-- 8. Log in as the Tenant 2 admin and repeat steps 2–5 in reverse —
--    Tenant 2 must see ONLY its own data, nothing from Tenant 1.
--
-- ── Cleanup (run when done) ───────────────────────────────────────
-- DELETE FROM public.companies WHERE slug = 'test-tenant-2';
-- (Cascades to branches, appointments, clients via ON DELETE CASCADE)
