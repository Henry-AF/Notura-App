alter table public.billing_accounts
  add column if not exists billing_cycle text,
  add column if not exists quota_period_start timestamptz,
  add column if not exists quota_period_end timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_accounts_billing_cycle_check'
  ) then
    alter table public.billing_accounts
      add constraint billing_accounts_billing_cycle_check
      check (billing_cycle is null or billing_cycle in ('monthly', 'yearly'));
  end if;
end $$;

update public.billing_accounts
set billing_cycle = 'monthly'
where billing_cycle is null
  and plan <> 'free';

update public.billing_accounts
set
  quota_period_start = coalesce(quota_period_start, current_period_start),
  quota_period_end = coalesce(
    quota_period_end,
    case
      when billing_cycle = 'yearly'
        and current_period_start is not null
        and current_period_end is not null
      then least(current_period_start + interval '1 month', current_period_end)
      else current_period_end
    end
  )
where plan <> 'free';

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
  next_quota_period_start timestamptz;
  next_quota_period_end timestamptz;
begin
  select
    billing_accounts.plan,
    billing_accounts.billing_cycle,
    billing_accounts.meetings_used,
    billing_accounts.current_period_start,
    billing_accounts.current_period_end,
    billing_accounts.quota_period_start,
    billing_accounts.quota_period_end,
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
      billing_accounts.billing_cycle,
      billing_accounts.meetings_used,
      billing_accounts.current_period_start,
      billing_accounts.current_period_end,
      billing_accounts.quota_period_start,
      billing_accounts.quota_period_end,
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

  if account.plan <> 'free'
    and account.billing_cycle = 'yearly'
    and account.quota_period_end is not null
    and account.quota_period_end <= now()
    and account.current_period_end is not null
    and account.current_period_end > now()
  then
    next_quota_period_start := account.quota_period_end;
    next_quota_period_end := account.quota_period_end + interval '1 month';

    while next_quota_period_end <= now()
      and next_quota_period_end < account.current_period_end
    loop
      next_quota_period_start := next_quota_period_end;
      next_quota_period_end := next_quota_period_end + interval '1 month';
    end loop;

    if next_quota_period_end > account.current_period_end then
      next_quota_period_end := account.current_period_end;
    end if;

    update public.billing_accounts
    set
      meetings_used = 0,
      meetings_this_month = 0,
      quota_period_start = next_quota_period_start,
      quota_period_end = next_quota_period_end,
      updated_at = now()
    where public.billing_accounts.user_id = p_user_id
    returning
      billing_accounts.plan,
      billing_accounts.billing_cycle,
      billing_accounts.meetings_used,
      billing_accounts.current_period_start,
      billing_accounts.current_period_end,
      billing_accounts.quota_period_start,
      billing_accounts.quota_period_end,
      billing_accounts.abacatepay_auto_renew_enabled,
      billing_accounts.abacatepay_renewal_status
    into account;
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
