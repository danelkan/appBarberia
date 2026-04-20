-- ============================================================
-- Migration v12: Scope services per company (multi-tenancy)
-- ============================================================

-- Add company_id to services (nullable initially for backwards compat)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Assign all existing services to the first/only active company
UPDATE public.services
SET company_id = (
  SELECT id FROM public.companies WHERE active = true ORDER BY created_at LIMIT 1
)
WHERE company_id IS NULL;

-- Index for fast company-scoped queries
CREATE INDEX IF NOT EXISTS idx_services_company ON public.services(company_id);

-- ── Seed: Base services template ─────────────────────────────────────────────
-- These are NOT inserted automatically; run the seed-new-barbershop.sql
-- script to create services for a new company.
