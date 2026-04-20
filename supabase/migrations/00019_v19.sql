-- ─────────────────────────────────────────────────────────────────────────────
-- v19: Legacy NULL company_id audit + cleanup
-- ─────────────────────────────────────────────────────────────────────────────
-- The codebase supports "legacy unscoped" rows (company_id IS NULL) for single-
-- tenant deployments that pre-date multi-tenancy.  This migration:
--   1. Reports how many orphan rows exist per table.
--   2. Backfills them to the single company when only one company exists.
--   3. Optionally adds a NOT NULL constraint once no orphans remain.
--
-- SAFE TO RUN MULTIPLE TIMES (idempotent checks).
-- Run step 3 only after confirming step 1 returns zero rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── STEP 1: Audit orphan rows ────────────────────────────────────────────────
-- Run this first and verify all counts are 0 before proceeding to step 3.

SELECT 'appointments'   AS tbl, count(*) FROM public.appointments    WHERE company_id IS NULL
UNION ALL
SELECT 'clients',       count(*) FROM public.clients          WHERE company_id IS NULL
UNION ALL
SELECT 'services',      count(*) FROM public.services         WHERE company_id IS NULL
UNION ALL
SELECT 'barbers',       count(*) FROM public.barbers          WHERE company_id IS NULL
UNION ALL
SELECT 'payments',      count(*) FROM public.payments         WHERE company_id IS NULL
UNION ALL
SELECT 'cash_registers',count(*) FROM public.cash_registers   WHERE company_id IS NULL
UNION ALL
SELECT 'cash_movements',count(*) FROM public.cash_movements   WHERE company_id IS NULL
UNION ALL
SELECT 'user_roles',    count(*) FROM public.user_roles       WHERE company_id IS NULL
UNION ALL
SELECT 'branches',      count(*) FROM public.branches         WHERE company_id IS NULL;

-- ─── STEP 2: Backfill NULL company_id rows when only one company exists ───────
-- This block is a NO-OP if more than one company exists, so it is safe to run.

DO $$
DECLARE
  single_company_id uuid;
BEGIN
  SELECT id INTO single_company_id FROM public.companies WHERE active = true;

  -- Only backfill when exactly one company is registered
  IF (SELECT count(*) FROM public.companies WHERE active = true) <> 1 THEN
    RAISE NOTICE 'Skipping backfill: more than one active company exists. Update manually.';
    RETURN;
  END IF;

  UPDATE public.appointments    SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.clients         SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.services        SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.barbers         SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.payments        SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.cash_registers  SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.cash_movements  SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.user_roles      SET company_id = single_company_id WHERE company_id IS NULL;
  UPDATE public.branches        SET company_id = single_company_id WHERE company_id IS NULL;

  RAISE NOTICE 'Backfill complete — all NULL company_id rows assigned to %', single_company_id;
END $$;

-- ─── STEP 3: Add NOT NULL constraints (run ONLY after step 1 shows 0 orphans) ─
-- Uncomment and execute once you have confirmed zero orphan rows above.

-- ALTER TABLE public.appointments    ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.clients         ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.services        ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.barbers         ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.payments        ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.cash_registers  ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.cash_movements  ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.user_roles      ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.branches        ALTER COLUMN company_id SET NOT NULL;
