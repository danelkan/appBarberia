-- ==================================================================
-- db-clean-for-delivery.sql
-- Clears ALL operational data for a clean delivery to a new client.
-- Preserves: structural tables (companies, branches, services, users)
-- Deletes:   clients, appointments, caja, payments, demo users
-- ==================================================================
-- ⚠️  Run in Supabase SQL Editor. This is IRREVERSIBLE.
-- ⚠️  Verify you have a backup before running.
-- ==================================================================

-- ── 1. Cash system ────────────────────────────────────────────────
TRUNCATE TABLE public.cash_movements  RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.cash_audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.cash_registers  RESTART IDENTITY CASCADE;

-- ── 2. Legacy payments ────────────────────────────────────────────
TRUNCATE TABLE public.payments RESTART IDENTITY CASCADE;

-- ── 3. Appointments ───────────────────────────────────────────────
TRUNCATE TABLE public.appointments RESTART IDENTITY CASCADE;

-- ── 4. Clients ────────────────────────────────────────────────────
TRUNCATE TABLE public.clients RESTART IDENTITY CASCADE;

-- ── Verify ────────────────────────────────────────────────────────
SELECT 'clients'         AS tbl, COUNT(*) FROM public.clients
UNION ALL
SELECT 'appointments',   COUNT(*) FROM public.appointments
UNION ALL
SELECT 'payments',       COUNT(*) FROM public.payments
UNION ALL
SELECT 'cash_registers', COUNT(*) FROM public.cash_registers
UNION ALL
SELECT 'cash_movements', COUNT(*) FROM public.cash_movements;
-- All rows should be 0.


-- ==================================================================
-- OPTIONAL: Remove demo/test users (run manually, carefully)
-- Identify demo users first:
-- ==================================================================
--
-- SELECT ur.user_id, u.email, ur.role, ur.active
-- FROM public.user_roles ur
-- JOIN auth.users u ON u.id = ur.user_id
-- ORDER BY ur.role, u.email;
--
-- To deactivate a user without deleting:
-- UPDATE public.user_roles SET active = false WHERE user_id = '<UUID>';
--
-- To fully remove a user (runs via Supabase Auth Admin API or Dashboard):
-- DELETE FROM auth.users WHERE id = '<UUID>';
-- ==================================================================
