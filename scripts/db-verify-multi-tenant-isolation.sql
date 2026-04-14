-- ==================================================================
-- db-verify-multi-tenant-isolation.sql
-- Run AFTER applying supabase-migration-v14.sql and seeding two tenants.
--
-- Goal:
--   1. Detect rows still mixed across tenants
--   2. Confirm every operational table is company-scoped
--   3. Leave a repeatable checklist for direct endpoint / JWT validation
-- ==================================================================

-- ── 1. Tenant ownership by table ──────────────────────────────────
SELECT 'branches'         AS table_name, company_id, COUNT(*) FROM public.branches        GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'services'         AS table_name, company_id, COUNT(*) FROM public.services        GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'barbers'          AS table_name, company_id, COUNT(*) FROM public.barbers         GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'clients'          AS table_name, company_id, COUNT(*) FROM public.clients         GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'appointments'     AS table_name, company_id, COUNT(*) FROM public.appointments    GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'payments'         AS table_name, company_id, COUNT(*) FROM public.payments        GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'cash_registers'   AS table_name, company_id, COUNT(*) FROM public.cash_registers  GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'cash_movements'   AS table_name, company_id, COUNT(*) FROM public.cash_movements  GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'barber_branches'  AS table_name, company_id, COUNT(*) FROM public.barber_branches GROUP BY 1, 2 ORDER BY 1, 2;
SELECT 'user_roles'       AS table_name, company_id, COUNT(*) FROM public.user_roles      GROUP BY 1, 2 ORDER BY 1, 2;

-- ── 2. Cross-tenant integrity checks: every query below must return 0 ──────

SELECT COUNT(*) AS appointments_cross_tenant
FROM public.appointments a
JOIN public.clients  c  ON c.id = a.client_id
JOIN public.barbers  b  ON b.id = a.barber_id
JOIN public.services s  ON s.id = a.service_id
JOIN public.branches br ON br.id = a.branch_id
WHERE a.company_id IS DISTINCT FROM c.company_id
   OR a.company_id IS DISTINCT FROM b.company_id
   OR a.company_id IS DISTINCT FROM s.company_id
   OR a.company_id IS DISTINCT FROM br.company_id;

SELECT COUNT(*) AS payments_cross_tenant
FROM public.payments p
JOIN public.appointments a ON a.id = p.appointment_id
WHERE p.company_id IS DISTINCT FROM a.company_id;

SELECT COUNT(*) AS cash_registers_cross_tenant
FROM public.cash_registers cr
JOIN public.branches br ON br.id = cr.branch_id
WHERE cr.company_id IS DISTINCT FROM br.company_id;

SELECT COUNT(*) AS cash_movements_cross_tenant
FROM public.cash_movements cm
JOIN public.cash_registers cr ON cr.id = cm.cash_register_id
WHERE cm.company_id IS DISTINCT FROM cr.company_id
   OR cm.branch_id IS DISTINCT FROM cr.branch_id;

SELECT COUNT(*) AS barber_branches_cross_tenant
FROM public.barber_branches bb
JOIN public.barbers b ON b.id = bb.barber_id
JOIN public.branches br ON br.id = bb.branch_id
WHERE bb.company_id IS DISTINCT FROM b.company_id
   OR bb.company_id IS DISTINCT FROM br.company_id
   OR b.company_id IS DISTINCT FROM br.company_id;

-- ── 3. Null company_id sanity check: every query below must return 0 ───────

SELECT COUNT(*) AS branches_without_company      FROM public.branches        WHERE company_id IS NULL;
SELECT COUNT(*) AS services_without_company      FROM public.services        WHERE company_id IS NULL;
SELECT COUNT(*) AS barbers_without_company       FROM public.barbers         WHERE company_id IS NULL;
SELECT COUNT(*) AS clients_without_company       FROM public.clients         WHERE company_id IS NULL;
SELECT COUNT(*) AS appointments_without_company  FROM public.appointments    WHERE company_id IS NULL;
SELECT COUNT(*) AS payments_without_company      FROM public.payments        WHERE company_id IS NULL;
SELECT COUNT(*) AS cash_registers_without_company FROM public.cash_registers WHERE company_id IS NULL;
SELECT COUNT(*) AS cash_movements_without_company FROM public.cash_movements WHERE company_id IS NULL;
SELECT COUNT(*) AS barber_branches_without_company FROM public.barber_branches WHERE company_id IS NULL;

-- ── 4. Direct endpoint/JWT verification checklist ───────────────────────────
--
-- Create two auth users: one in company A and one in company B.
-- Then test all of the following with each session or JWT:
--
-- 1. /api/branches?all=1
-- 2. /api/services
-- 3. /api/barbers?branch_id=<company-branch>
-- 4. /api/clients
-- 5. /api/appointments?from=<today>&to=<today+7>
-- 6. /api/payments
-- 7. /api/payments/summary
-- 8. /api/cash-registers
-- 9. /api/users
--
-- Expected result:
--   each response contains ONLY rows whose company_id belongs to the logged-in tenant.
--
-- Also verify request manipulation:
--   - swap branch_id from company A while logged in as company B
--   - call item endpoints by raw UUID from another tenant
--   - try direct Supabase SELECT/INSERT/UPDATE/DELETE with a tenant JWT
--
-- Expected result:
--   all manipulated attempts return zero rows or are blocked by RLS/403.
