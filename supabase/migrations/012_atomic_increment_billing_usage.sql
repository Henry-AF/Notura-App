-- Billing quota usage is owned by the server.
-- Free users consume a lifetime quota. Paid users consume the current paid period.

alter table public.billing_accounts
  add column if not exists meetings_used integer not null default 0,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

insert into public.billing_accounts (user_id)
select distinct user_id
from public.meetings
on conflict (user_id) do nothing;

with historical_usage as (
  select
    user_id,
    count(*)::integer as meetings_used
  from public.meetings
  group by user_id
)
update public.billing_accounts
set
  meetings_used = historical_usage.meetings_used,
  meetings_this_month = historical_usage.meetings_used,
  updated_at = now()
from historical_usage
where public.billing_accounts.user_id = historical_usage.user_id;

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
    billing_accounts.current_period_end
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
      billing_accounts.current_period_end
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
  ) then
    raise exception 'subscription_expired' using errcode = 'P0001';
  end if;

  if account.meetings_used >= quota_limit then
    if account.plan = 'free' then
      raise exception 'lifetime_quota_exceeded' using errcode = 'P0001';
    end if;

    raise exception 'period_quota_exceeded' using errcode = 'P0001';
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

create or replace function public.refund_meeting_quota(p_user_id uuid)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  next_meetings_used integer;
begin
  update public.billing_accounts
  set
    meetings_used = greatest(public.billing_accounts.meetings_used - 1, 0),
    meetings_this_month = greatest(public.billing_accounts.meetings_used - 1, 0),
    updated_at = now()
  where public.billing_accounts.user_id = p_user_id
  returning billing_accounts.meetings_used into next_meetings_used;

  if not found then
    insert into public.billing_accounts (
      user_id,
      meetings_used,
      meetings_this_month
    )
    values (p_user_id, 0, 0)
    on conflict (user_id)
    do update set
      meetings_used = greatest(public.billing_accounts.meetings_used - 1, 0),
      meetings_this_month = greatest(public.billing_accounts.meetings_used - 1, 0),
      updated_at = now()
    returning billing_accounts.meetings_used into next_meetings_used;
  end if;

  return next_meetings_used;
end;
$$;

revoke all on function public.consume_meeting_quota(uuid) from public;
revoke all on function public.consume_meeting_quota(uuid) from anon;
revoke all on function public.consume_meeting_quota(uuid) from authenticated;
grant execute on function public.consume_meeting_quota(uuid) to service_role;

revoke all on function public.refund_meeting_quota(uuid) from public;
revoke all on function public.refund_meeting_quota(uuid) from anon;
revoke all on function public.refund_meeting_quota(uuid) from authenticated;
grant execute on function public.refund_meeting_quota(uuid) to service_role;
