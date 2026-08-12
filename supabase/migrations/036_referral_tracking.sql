-- Referral tracking for the influencer affiliate program (NOT-193).
-- referral_codes / referrals are service-role-only: RLS is enabled with no
-- policies, same posture as 019_secure_billing_accounts_write_policies.sql.

create table if not exists public.referral_codes (
  id                 uuid primary key default gen_random_uuid(),
  influencer_name    text not null,
  code               text not null unique,
  commission_percent numeric(5,2) not null default 20,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referral_code_id  uuid not null references public.referral_codes(id) on delete restrict,
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  clicked_at        timestamptz,
  signed_up_at      timestamptz not null default now(),
  activated_at      timestamptz,
  converted_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists referrals_referral_code_id_idx on public.referrals(referral_code_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Attribution: record the referral on signup if a valid code was captured.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
declare
  v_referral_code_id uuid;
begin
  insert into public.profiles (id, name, role, whatsapp_number)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'role',
    nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '')
  )
  on conflict (id) do nothing;

  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  if new.raw_user_meta_data->>'referral_code' is not null then
    select id into v_referral_code_id
    from public.referral_codes
    where code = new.raw_user_meta_data->>'referral_code'
      and active = true;

    if v_referral_code_id is not null then
      insert into public.referrals (referral_code_id, user_id, clicked_at, signed_up_at)
      values (
        v_referral_code_id,
        new.id,
        nullif(new.raw_user_meta_data->>'referral_clicked_at', '')::timestamptz,
        now()
      )
      on conflict (user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────────
-- Activation: first meeting ever recorded by a referred user.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_meeting_activation()
returns trigger
set search_path = ''
as $$
begin
  update public.referrals
  set activated_at = now()
  where user_id = new.user_id
    and activated_at is null
    and not exists (
      select 1 from public.meetings m
      where m.user_id = new.user_id and m.id <> new.id
    );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_meeting_created_activation on public.meetings;

create trigger on_meeting_created_activation
  after insert on public.meetings
  for each row execute function public.handle_meeting_activation();
