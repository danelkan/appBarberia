-- Fix: assign orphan barbers (Kike, Felito) to both branches
-- Run this once in Supabase SQL editor

-- Kike
INSERT INTO barber_branches (barber_id, branch_id) VALUES
  ('50688a7c-018d-4cec-81ac-12352dd489e1', '11111111-1111-1111-1111-111111111111'),
  ('50688a7c-018d-4cec-81ac-12352dd489e1', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Felito (email correcto: integral.edu.uy)
INSERT INTO barber_branches (barber_id, branch_id) VALUES
  ('24c3ef14-a48c-4f13-9406-12a1a77a8b66', '11111111-1111-1111-1111-111111111111'),
  ('24c3ef14-a48c-4f13-9406-12a1a77a8b66', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Eliminar registro duplicado de Felito con typo en email (integrao.edu.uy)
DELETE FROM barbers WHERE id = '32adaf31-b3f2-4de0-bbd8-a7f94507ef37';
