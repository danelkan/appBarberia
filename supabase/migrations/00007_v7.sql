-- ============================================================
-- Migration v7: Fix user_roles role check constraint
-- Adds 'superadmin' as valid role value
-- Run this in Supabase > SQL Editor
-- ============================================================

-- Drop the old constraint that only allowed ('admin', 'barber')
ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Re-create it with 'superadmin' included
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('superadmin', 'admin', 'barber'));

-- Fix any existing rows that might have ended up with NULL or invalid role
UPDATE user_roles
  SET role = 'barber'
  WHERE role IS NULL OR role NOT IN ('superadmin', 'admin', 'barber');
