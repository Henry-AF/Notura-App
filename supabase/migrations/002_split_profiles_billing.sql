-- ─────────────────────────────────────────────────────────────────────────────
-- Split mutable user profile data from billing-controlled state
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'team')) default 'free',
  meetings_this_month integer not null default 0,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_accounts (
  user_id,
  plan,
  meetings_this_month,
  stripe_customer_id,
  created_at,
  updated_at
)
select
  id,
  coalesce(plan, 'free'),
  coalesce(meetings_this_month, 0),
  stripe_customer_id,
  coalesce(created_at, now()),
  now()
from public.profiles
on conflict (user_id) do update
set
  plan = excluded.plan,
  meetings_this_month = excluded.meetings_this_month,
  stripe_customer_id = excluded.stripe_customer_id,
  updated_at = now();

alter table public.billing_accounts enable row level security;

create policy "billing_accounts_own_select"
  on public.billing_accounts
  for select
  using (auth.uid() = user_id);

alter table public.profiles
  drop column if exists plan,
  drop column if exists meetings_this_month,
  drop column if exists stripe_customer_id;

create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;

  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
