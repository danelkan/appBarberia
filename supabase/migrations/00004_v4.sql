-- ============================================================
-- Migration v4: User scope for companies and branches
-- Run this in Supabase > SQL Editor
-- ============================================================

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS branch_ids jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON user_roles(company_id);
