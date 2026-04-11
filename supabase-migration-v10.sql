-- ============================================================
-- Migration v10: Make Usuarios the only booking source of truth
--
-- Context:
--   Reservas must only show barbers that come from a real current user in
--   Usuarios. Historical barbers rows may remain for appointment history, but
--   they must not stay bookable unless they are linked to an active auth user
--   through user_roles and still have barber_branches assignments.
--
--   This migration cleans legacy visibility by removing barber_branches rows
--   for orphan/inactive barbers and reports the canonical visible set after.
--
-- Run this ONCE in Supabase > SQL Editor.
-- ============================================================

-- 1. Remove rows whose branch or barber no longer exists
DELETE FROM barber_branches
WHERE branch_id NOT IN (SELECT id FROM branches);

DELETE FROM barber_branches
WHERE barber_id NOT IN (SELECT id FROM barbers);

-- 2. Remove agenda visibility for barbers that are NOT backed by a valid user:
--    - missing user_roles row
--    - user_roles.user_id is null
--    - auth user no longer exists
--    - user_roles.active = false
DELETE FROM barber_branches bb
WHERE NOT EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE ur.barber_id = bb.barber_id
    AND ur.user_id IS NOT NULL
    AND ur.active IS DISTINCT FROM FALSE
);

-- 3. Clear stale barber links on user_roles that point to deleted barbers.
UPDATE user_roles
SET barber_id = NULL
WHERE barber_id IS NOT NULL
  AND barber_id NOT IN (SELECT id FROM barbers);

-- 4. Report canonical visible booking barbers after cleanup.
SELECT
  au.email              AS user_email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', b.name) AS user_name,
  ur.role               AS app_role,
  ur.active             AS user_active,
  b.id                  AS barber_id,
  b.name                AS barber_name,
  br.id                 AS branch_id,
  br.name               AS branch_name
FROM user_roles ur
JOIN auth.users au       ON au.id = ur.user_id
JOIN barbers b           ON b.id = ur.barber_id
JOIN barber_branches bb  ON bb.barber_id = b.id
JOIN branches br         ON br.id = bb.branch_id
WHERE ur.user_id IS NOT NULL
  AND ur.barber_id IS NOT NULL
  AND ur.active IS DISTINCT FROM FALSE
ORDER BY user_name, branch_name;
