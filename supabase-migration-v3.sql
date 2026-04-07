-- ============================================================
-- Migration v3: Companies, Permissions, User management
-- Run this in Supabase > SQL Editor
-- ============================================================

-- ─── Companies ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text UNIQUE,
  email       text,
  phone       text,
  address     text,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ─── Add company_id to branches ───────────────────────────
ALTER TABLE branches ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

-- ─── Extend user_roles ────────────────────────────────────
-- permissions: array of permission strings e.g. ["view_caja","manage_barbers"]
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- ─── user_roles: ensure user_id is unique ─────────────────
-- (this may already exist — safe to run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END$$;

-- ─── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);

-- ─── RLS Policies ─────────────────────────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Companies: authenticated users can read, admins manage
CREATE POLICY "companies_auth_read"  ON companies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "companies_auth_write" ON companies FOR ALL   USING (auth.role() = 'authenticated');

-- ─── Seed: Default company (Felito Studios) ───────────────
INSERT INTO companies (id, name, slug, email, phone, active)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Felito Studios',
  'felito-studios',
  'admin@felitostudios.com',
  '096374477',
  true
) ON CONFLICT DO NOTHING;

-- Assign existing branches to default company
UPDATE branches
SET company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE company_id IS NULL;
