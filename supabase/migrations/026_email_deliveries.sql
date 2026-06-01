create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  campaign text not null,
  resend_email_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, email_type, campaign)
);

alter table public.email_deliveries enable row level security;

drop policy if exists email_deliveries_service_role_all
  on public.email_deliveries;

create policy email_deliveries_service_role_all
  on public.email_deliveries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
