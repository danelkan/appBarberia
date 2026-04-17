-- Make email and phone optional on clients (walk-in support)
-- The v14 partial unique index already anticipated nullable emails.

ALTER TABLE public.clients
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;
