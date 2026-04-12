-- ==================================================================
-- db-seed-new-barbershop.sql
-- Template seed for onboarding a new barbershop.
-- Replace ALL {{PLACEHOLDERS}} before running.
-- ==================================================================

-- Variables (set these before running):
--   {{COMPANY_NAME}}    e.g. 'Mi Barbería'
--   {{COMPANY_SLUG}}    e.g. 'mi-barberia' (lowercase, no spaces/accents)
--   {{COMPANY_EMAIL}}   e.g. 'contacto@mibarberia.com'
--   {{BRANCH_NAME}}     e.g. 'Sucursal Centro'
--   {{BRANCH_ADDRESS}}  e.g. 'Av. Principal 123, Ciudad'
--   {{BRANCH_PHONE}}    e.g. '099 000 000'
--   {{PLAN_TIER}}       e.g. 'starter' | 'pro' | 'enterprise'
--   {{MAX_BRANCHES}}    e.g. 1
--   {{MAX_BARBERS}}     e.g. 3

BEGIN;

-- ── 1. Company ────────────────────────────────────────────────────
INSERT INTO public.companies (name, slug, email, active, plan_tier, max_branches, max_barbers)
VALUES (
  '{{COMPANY_NAME}}',
  '{{COMPANY_SLUG}}',
  '{{COMPANY_EMAIL}}',
  true,
  '{{PLAN_TIER}}',
  {{MAX_BRANCHES}},
  {{MAX_BARBERS}}
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Branch ─────────────────────────────────────────────────────
INSERT INTO public.branches (company_id, name, address, phone, active)
SELECT id, '{{BRANCH_NAME}}', '{{BRANCH_ADDRESS}}', '{{BRANCH_PHONE}}', true
FROM public.companies WHERE slug = '{{COMPANY_SLUG}}'
ON CONFLICT DO NOTHING;

-- ── 3. Base services ──────────────────────────────────────────────
-- Customize names, prices and durations per barbershop.
INSERT INTO public.services (name, price, duration_minutes, active, company_id)
SELECT s.name, s.price, s.duration_minutes, true, c.id
FROM public.companies c,
(VALUES
  ('Corte de Cabello',  0, 40),
  ('Corte + Barba',     0, 60),
  ('Barba',             0, 20),
  ('Facial',            0, 35)
) AS s(name, price, duration_minutes)
WHERE c.slug = '{{COMPANY_SLUG}}'
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Next steps ────────────────────────────────────────────────────
-- 1. Create auth user in Supabase Dashboard > Authentication > Users
-- 2. Insert user_roles row linking the new user to this company:
--    INSERT INTO user_roles (user_id, company_id, role, active, permissions)
--    VALUES ('<AUTH_USER_UUID>', '<COMPANY_UUID>', 'admin', true, '[]');
-- 3. Set SUPERADMIN_UUID or ADMIN_EMAIL in .env.local for platform access
-- 4. Configure NEXT_PUBLIC_APP_NAME, APP_LOCATION in .env.local
-- 5. Run the app and verify login at /login
