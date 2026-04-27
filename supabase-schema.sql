-- ============================================================
-- FELITO STUDIOS — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── BARBERS ─────────────────────────────────────────────────────
create table public.barbers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text not null unique,
  photo_url text,
  availability jsonb not null default '{
    "monday":    {"enabled": true,  "start": "10:00", "end": "20:00"},
    "tuesday":   {"enabled": true,  "start": "10:00", "end": "20:00"},
    "wednesday": {"enabled": true,  "start": "10:00", "end": "20:00"},
    "thursday":  {"enabled": true,  "start": "10:00", "end": "20:00"},
    "friday":    {"enabled": true,  "start": "10:00", "end": "20:00"},
    "saturday":  {"enabled": true,  "start": "10:00", "end": "20:00"},
    "sunday":    {"enabled": false, "start": "10:00", "end": "20:00"}
  }'::jsonb,
  created_at timestamptz default now()
);

-- ─── SERVICES ────────────────────────────────────────────────────
create table public.services (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price numeric(10,2) not null,
  duration_minutes integer not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ─── CLIENTS ─────────────────────────────────────────────────────
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text not null,
  created_at timestamptz default now()
);

-- ─── APPOINTMENTS ─────────────────────────────────────────────────
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'completada', 'cancelada')),
  created_at timestamptz default now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────
create index idx_appointments_date on public.appointments(date);
create index idx_appointments_barber on public.appointments(barber_id);
create index idx_appointments_status on public.appointments(status);
create index idx_appointments_client on public.appointments(client_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;

-- Public read for booking flow
create policy "Public read barbers" on public.barbers for select using (true);
create policy "Public read services" on public.services for select using (true);

-- Public insert for booking
create policy "Public insert clients" on public.clients for insert with check (true);
create policy "Public insert appointments" on public.appointments for insert with check (true);

-- Public read appointments (needed for availability check)
create policy "Public read appointments" on public.appointments for select using (true);
create policy "Public read clients" on public.clients for select using (true);

-- Service role has full access (used in API routes)
-- This is handled automatically by Supabase service role key

-- ─── SEED DATA ────────────────────────────────────────────────────
insert into public.barbers (name, email) values
  ('Felipe', 'felipe@felitostudios.com'),
  ('Marcos', 'marcos@felitostudios.com');

insert into public.services (name, price, duration_minutes) values
  ('Corte',          15.00, 30),
  ('Barba',          10.00, 20),
  ('Corte + barba',  22.00, 45);

-- ─── USEFUL VIEWS ─────────────────────────────────────────────────
create view public.appointments_full as
  select
    a.*,
    c.first_name, c.last_name, c.email as client_email, c.phone,
    b.name as barber_name, b.photo_url as barber_photo,
    s.name as service_name, s.price as service_price,
    s.duration_minutes
  from public.appointments a
  join public.clients c on a.client_id = c.id
  join public.barbers b on a.barber_id = b.id
  join public.services s on a.service_id = s.id;
