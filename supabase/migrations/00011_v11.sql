-- ============================================================
-- Migration v11 — Add birthday to clients
-- Run in Supabase SQL editor
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birthday date;
