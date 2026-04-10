-- ============================================================
-- Migration v9: Clean fake/orphan barber_branches entries
--
-- Context:
--   A debug endpoint (now deleted) inserted barber_branches rows
--   with hardcoded fake UUIDs (11111111-... and 22222222-...) that
--   don't correspond to real branches. This caused barbers to appear
--   invisible in the booking flow because barber_branches lookups
--   by real branch IDs returned no results.
--
--   This migration:
--     1. Removes barber_branches entries pointing to non-existent branches
--     2. Removes barber_branches entries pointing to non-existent barbers
--     3. Re-populates valid entries from user_roles.branch_ids for barbers
--        that ended up with NO valid barber_branches after the cleanup
--
-- Run this ONCE in Supabase > SQL Editor.
-- ============================================================

-- 1. Delete rows where the branch doesn't exist (catches fake UUIDs)
DELETE FROM barber_branches
WHERE branch_id NOT IN (SELECT id FROM branches);

-- 2. Delete rows where the barber doesn't exist (orphan cleanup)
DELETE FROM barber_branches
WHERE barber_id NOT IN (SELECT id FROM barbers);

-- 3. Re-populate from user_roles.branch_ids for barbers that now have
--    NO barber_branches entries after the cleanup above
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
  -- Only for barbers that have NO valid barber_branches after cleanup
  AND NOT EXISTS (
    SELECT 1 FROM barber_branches bb WHERE bb.barber_id = ur.barber_id
  )
  -- The branch must exist and be active
  AND EXISTS (
    SELECT 1 FROM branches b
    WHERE b.id = branch_id_value::uuid
      AND b.active = TRUE
  )
ON CONFLICT DO NOTHING;

-- 4. Report current state after cleanup
SELECT
  b.name  AS barber_name,
  br.name AS branch_name,
  br.id   AS branch_id
FROM barber_branches bb
  JOIN barbers  b  ON b.id  = bb.barber_id
  JOIN branches br ON br.id = bb.branch_id
ORDER BY b.name, br.name;
