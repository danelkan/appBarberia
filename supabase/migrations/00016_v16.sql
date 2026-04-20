-- Branch-specific service pricing plus appointment price snapshots.
-- The global services.price remains the fallback/base price.

create table if not exists public.service_branch_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  price numeric(10,2) not null check (price > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_id, branch_id)
);

create index if not exists idx_service_branch_prices_company_branch
  on public.service_branch_prices(company_id, branch_id);

create index if not exists idx_service_branch_prices_service
  on public.service_branch_prices(service_id);

alter table public.appointments
  add column if not exists service_price numeric(10,2);

update public.appointments a
set service_price = s.price
from public.services s
where a.service_id = s.id
  and a.service_price is null;

create index if not exists idx_appointments_service_price
  on public.appointments(service_price);

alter table public.service_branch_prices enable row level security;

drop policy if exists service_branch_prices_company_all on public.service_branch_prices;
create policy service_branch_prices_company_all on public.service_branch_prices
  for all
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.active is distinct from false
        and (
          ur.role = 'superadmin'
          or ur.company_id = service_branch_prices.company_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.active is distinct from false
        and (
          ur.role = 'superadmin'
          or ur.company_id = service_branch_prices.company_id
        )
    )
  );
