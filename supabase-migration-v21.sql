-- Scope Web Push subscriptions by company so appointment pushes can target
-- the assigned barber without leaking notifications across tenants.

alter table public.push_subscriptions
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

update public.push_subscriptions ps
set company_id = ur.company_id
from public.user_roles ur
where ps.user_id = ur.user_id
  and ps.company_id is null
  and ur.company_id is not null;

-- If user_roles.company_id is stale or missing, derive the company from the
-- barber's assigned branches. This mirrors the app-side company resolver.
update public.push_subscriptions ps
set company_id = br.company_id
from public.user_roles ur
join public.barber_branches bb on bb.barber_id = ur.barber_id
join public.branches br on br.id = bb.branch_id
where ps.user_id = ur.user_id
  and ps.company_id is null
  and br.company_id is not null;

create index if not exists push_subscriptions_company_user_idx
  on public.push_subscriptions(company_id, user_id);

create index if not exists push_subscriptions_company_endpoint_idx
  on public.push_subscriptions(company_id, endpoint);

drop policy if exists "Users can read their push subscriptions" on public.push_subscriptions;
create policy "Users can read their push subscriptions"
  on public.push_subscriptions
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.company_id = push_subscriptions.company_id
          or ur.role = 'superadmin'
        )
    )
  );

drop policy if exists "Users can insert their push subscriptions" on public.push_subscriptions;
create policy "Users can insert their push subscriptions"
  on public.push_subscriptions
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.company_id = push_subscriptions.company_id
          or ur.role = 'superadmin'
        )
    )
  );

drop policy if exists "Users can update their push subscriptions" on public.push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.push_subscriptions
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.company_id = push_subscriptions.company_id
          or ur.role = 'superadmin'
        )
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.company_id = push_subscriptions.company_id
          or ur.role = 'superadmin'
        )
    )
  );

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions
  for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.company_id = push_subscriptions.company_id
          or ur.role = 'superadmin'
        )
    )
  );
