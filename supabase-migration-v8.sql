-- ============================================================
-- Migration v8: Sync barber_branches from user_roles.branch_ids
--
-- Context:
--   getVisibleBarberIds now uses barber_branches as the SOLE
--   source of truth for which branches a barber works at.
--   Previous versions also checked user_roles.branch_ids, so
--   some older barber records may have branch_ids set there but
--   no corresponding rows in barber_branches.
--
--   This migration populates the missing barber_branches rows so
--   existing barbers remain visible in the booking flow.
--
-- Run this ONCE in Supabase > SQL Editor.
-- ============================================================

-- 1. Insert missing barber_branches rows from user_roles.branch_ids
--    Cast text to uuid explicitly — branch_ids is stored as text[] / jsonb
--    but barber_branches.branch_id and branches.id are uuid.
INSERT INTO barber_branches (barber_id, branch_id)
SELECT
  ur.barber_id,
  branch_id_value::uuid
FROM user_roles ur
  CROSS JOIN LATERAL unnest(
    CASE
      WHEN ur.branch_ids IS NULL THEN ARRAY[]::text[]
      WHEN jsonb_typeof(to_jsonb(ur.branch_ids)) = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(to_jsonb(ur.branch_ids)))
      ELSE ARRAY[]::text[]
    END
  ) AS branch_id_value
WHERE
  ur.barber_id IS NOT NULL
  AND ur.active IS DISTINCT FROM FALSE
  -- Only insert for barbers that currently have NO barber_branches at all
  AND NOT EXISTS (
    SELECT 1 FROM barber_branches bb WHERE bb.barber_id = ur.barber_id
  )
  -- Confirm the branch exists and is active (cast text → uuid)
  AND EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = branch_id_value::uuid
      AND b.active = TRUE
  )
ON CONFLICT DO NOTHING;

-- 2. Report what was synced
SELECT
  b.name  AS barber_name,
  br.name AS branch_name
FROM barber_branches bb
  JOIN barbers  b  ON b.id  = bb.barber_id
  JOIN branches br ON br.id = bb.branch_id
ORDER BY b.name, br.name;
