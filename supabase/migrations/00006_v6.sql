-- ============================================================
-- Migration v6: Master admin, multi-tenant plans, and WhatsApp
-- Run this in Supabase > SQL Editor
-- ============================================================

-- ─── 1. Plan tiers on companies ──────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan_tier        text NOT NULL DEFAULT 'starter'
                                              CHECK (plan_tier IN ('starter','pro','enterprise')),
  ADD COLUMN IF NOT EXISTS max_branches     int  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_barbers      int  NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS master_notes     text,
  ADD COLUMN IF NOT EXISTS plan_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS billing_email    text;

-- Existing companies default to starter limits
UPDATE companies SET max_branches = 1, max_barbers = 3 WHERE max_branches IS NULL;

-- ─── 2. Master admin role ─────────────────────────────────────────
-- Add 'master' as a valid role in user_roles (app-level enforcement via SUPERADMIN_UUID env var)
-- The DB doesn't enforce this yet — role check is in api-auth.ts via SUPERADMIN_UUID.
-- This comment is intentional: master == superadmin in DB, distinct at app level.

-- ─── 3. WhatsApp messaging queue ─────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid        REFERENCES companies(id) ON DELETE CASCADE,
  branch_id       uuid        REFERENCES branches(id) ON DELETE SET NULL,
  appointment_id  uuid        REFERENCES appointments(id) ON DELETE SET NULL,
  client_id       uuid        REFERENCES clients(id) ON DELETE SET NULL,
  phone           text        NOT NULL,
  message_type    text        NOT NULL CHECK (message_type IN (
                                'confirmation', 'reminder', 'birthday', 'custom'
                              )),
  body            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','sent','failed','cancelled')),
  provider        text        NOT NULL DEFAULT 'twilio'
                                CHECK (provider IN ('twilio','meta_cloud_api','gupshup')),
  provider_msg_id text,
  error_message   text,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON whatsapp_messages(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company
  ON whatsapp_messages(company_id, created_at DESC);

-- ─── 4. Plan enforcement helper function ─────────────────────────
-- Returns true if the company can add a new branch
CREATE OR REPLACE FUNCTION can_add_branch(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (
    SELECT COUNT(*) FROM branches
    WHERE company_id = p_company_id AND active = true
  ) < (
    SELECT max_branches FROM companies WHERE id = p_company_id
  );
$$;

-- Returns true if the company can add a new barber
CREATE OR REPLACE FUNCTION can_add_barber(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (
    SELECT COUNT(*) FROM barbers b
    JOIN barber_branches bb ON bb.barber_id = b.id
    JOIN branches br ON br.id = bb.branch_id
    WHERE br.company_id = p_company_id
  ) < (
    SELECT max_barbers FROM companies WHERE id = p_company_id
  );
$$;

-- ─── 5. Indexes on existing tables (performance) ─────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON appointments(barber_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);

-- ─── 6. RLS: protect plan data from tenant admins ─────────────────
-- Only the service_role key (used by the Next.js backend) can update plan fields.
-- This prevents tenant admins from self-upgrading their plan via direct API calls.
-- All plan mutations must go through the master admin UI (which uses service role).

-- Note: if RLS is not yet enabled on companies, enable it:
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- Then create a policy that allows read for authenticated, but restricts plan updates.
