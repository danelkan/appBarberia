-- ==================================================================
-- db-seed-elcorteclasico.sql
-- Onboarding: Barbería El Corte Clásico — Pocitos, Montevideo
-- Corre en el mismo Supabase que felitobarber (multi-tenant).
--
-- Para correr: Supabase Dashboard > SQL Editor > pegar y ejecutar
-- ==================================================================

BEGIN;

-- ── 1. Company ────────────────────────────────────────────────────
INSERT INTO public.companies (name, slug, email, active, plan_tier, max_branches, max_barbers)
VALUES (
  'Barbería El Corte Clásico',
  'elcorteclasico',
  'elcorteclasico@gmail.com',
  true,
  'pro',
  1,
  2
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Branch ─────────────────────────────────────────────────────
INSERT INTO public.branches (company_id, name, address, phone, active)
SELECT id, 'Pocitos', 'Pocitos, Montevideo, Uruguay', '+598 98 123 456', true
FROM public.companies WHERE slug = 'elcorteclasico'
ON CONFLICT DO NOTHING;

-- ── 3. Barbers ────────────────────────────────────────────────────
INSERT INTO public.barbers (name, email, company_id)
SELECT 'Martín', 'martin@elcorteclasico.com', c.id
FROM public.companies c WHERE c.slug = 'elcorteclasico'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.barbers (name, email, company_id)
SELECT 'Nicolás', 'nicolas@elcorteclasico.com', c.id
FROM public.companies c WHERE c.slug = 'elcorteclasico'
ON CONFLICT (email) DO NOTHING;

-- ── 4. Link barbers to branch ─────────────────────────────────────
INSERT INTO public.barber_branches (barber_id, branch_id)
SELECT b.id, br.id
FROM public.barbers b
JOIN public.branches br ON br.company_id = b.company_id
WHERE b.email IN ('martin@elcorteclasico.com', 'nicolas@elcorteclasico.com')
ON CONFLICT DO NOTHING;

-- ── 5. Services ───────────────────────────────────────────────────
INSERT INTO public.services (name, price, duration_minutes, active, company_id)
SELECT s.name, s.price, s.duration_minutes, true, c.id
FROM public.companies c,
(VALUES
  ('Corte clásico',   400, 30),
  ('Corte + barba',   600, 50),
  ('Arreglo de barba',300, 20),
  ('Corte premium',   700, 60)
) AS s(name, price, duration_minutes)
WHERE c.slug = 'elcorteclasico'
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Próximos pasos ────────────────────────────────────────────────
-- 1. Crear usuario admin en Supabase Dashboard > Authentication > Users
--    Email: elcorteclasico@gmail.com
--
-- 2. Copiar el UUID del usuario creado y ejecutar:
--    INSERT INTO public.user_roles (user_id, company_id, role, active, permissions)
--    SELECT '<AUTH_USER_UUID>', id, 'admin', true, '[]'
--    FROM public.companies WHERE slug = 'elcorteclasico';
--
-- 3. El cliente accede a:
--    https://tudominio.com/reservar?company=elcorteclasico
--    https://tudominio.com/admin  (con su usuario)
--
-- ── Cleanup si hay que borrar ─────────────────────────────────────
-- DELETE FROM public.companies WHERE slug = 'elcorteclasico';
-- (Cascada a branches, barbers, services, appointments)
