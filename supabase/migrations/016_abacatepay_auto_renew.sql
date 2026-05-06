-- Notura owns AbacatePay renewal orchestration through current_period_end.
-- Turning auto-renew off must not cancel the provider subscription immediately.

alter table public.billing_accounts
  add column if not exists abacatepay_subscription_id text,
  add column if not exists abacatepay_auto_renew_enabled boolean not null default true,
  add column if not exists abacatepay_auto_renew_updated_at timestamptz,
  add column if not exists abacatepay_renewal_attempts integer not null default 0,
  add column if not exists abacatepay_renewal_status text not null default 'idle',
  add column if not exists abacatepay_renewal_period_end timestamptz,
  add column if not exists abacatepay_next_renewal_attempt_at timestamptz,
  add column if not exists abacatepay_last_renewal_error text;

alter table public.billing_accounts
  add constraint billing_accounts_abacatepay_renewal_attempts_nonnegative
  check (abacatepay_renewal_attempts >= 0) not valid;

alter table public.billing_accounts
  add constraint billing_accounts_abacatepay_renewal_status_check
  check (
    abacatepay_renewal_status in (
      'idle',
      'active',
      'checkout_created',
      'retrying',
      'suspended'
    )
  ) not valid;

create or replace function public.consume_meeting_quota(p_user_id uuid)
returns table (
  meetings_used integer,
  plan text,
  current_period_start timestamptz,
  current_period_end timestamptz
)
language plpgsql
volatile
set search_path = public
as $$
declare
  account record;
  quota_limit integer;
begin
  select
    billing_accounts.plan,
    billing_accounts.meetings_used,
    billing_accounts.current_period_start,
    billing_accounts.current_period_end,
    billing_accounts.abacatepay_auto_renew_enabled,
    billing_accounts.abacatepay_renewal_status
  into account
  from public.billing_accounts
  where billing_accounts.user_id = p_user_id
  for update;

  if not found then
    insert into public.billing_accounts (user_id)
    values (p_user_id)
    returning
      billing_accounts.plan,
      billing_accounts.meetings_used,
      billing_accounts.current_period_start,
      billing_accounts.current_period_end,
      billing_accounts.abacatepay_auto_renew_enabled,
      billing_accounts.abacatepay_renewal_status
    into account;
  end if;

  if account.plan = 'free' then
    quota_limit := 3;
  elsif account.plan = 'pro' then
    quota_limit := 30;
  elsif account.plan = 'team' then
    quota_limit := 100;
  else
    raise exception 'invalid_plan' using errcode = '22023';
  end if;

  if account.plan <> 'free' and (
    account.current_period_end is null or account.current_period_end <= now()
  ) and not (
    account.abacatepay_auto_renew_enabled is true
    and account.abacatepay_renewal_status = 'retrying'
  ) then
    raise exception 'subscription_expired' using errcode = 'BP001';
  end if;

  if account.meetings_used >= quota_limit then
    if account.plan = 'free' then
      raise exception 'lifetime_quota_exceeded' using errcode = 'BP002';
    end if;

    raise exception 'period_quota_exceeded' using errcode = 'BP003';
  end if;

  update public.billing_accounts
  set
    meetings_used = public.billing_accounts.meetings_used + 1,
    meetings_this_month = public.billing_accounts.meetings_used + 1,
    updated_at = now()
  where public.billing_accounts.user_id = p_user_id
  returning
    billing_accounts.meetings_used,
    billing_accounts.plan,
    billing_accounts.current_period_start,
    billing_accounts.current_period_end
  into account;

  return query select
    account.meetings_used,
    account.plan,
    account.current_period_start,
    account.current_period_end;
end;
$$;

revoke all on function public.consume_meeting_quota(uuid) from public;
revoke all on function public.consume_meeting_quota(uuid) from anon;
revoke all on function public.consume_meeting_quota(uuid) from authenticated;
grant execute on function public.consume_meeting_quota(uuid) to service_role;
