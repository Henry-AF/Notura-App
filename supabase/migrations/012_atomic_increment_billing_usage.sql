-- Atomic monthly usage increment for billing_accounts.
-- Source of truth for processed meetings should be billing_accounts.meetings_this_month,
-- never a count over meetings rows.

create or replace function public.increment_billing_meetings_this_month(
  p_user_id uuid,
  p_increment integer default 1
)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  next_meetings_this_month integer;
begin
  if p_increment is null or p_increment < 1 then
    raise exception 'Billing usage increment must be >= 1.' using errcode = '22023';
  end if;

  insert into public.billing_accounts (user_id, meetings_this_month)
  values (p_user_id, p_increment)
  on conflict (user_id)
  do update set
    meetings_this_month = public.billing_accounts.meetings_this_month + p_increment,
    updated_at = now()
  returning meetings_this_month into next_meetings_this_month;

  return next_meetings_this_month;
end;
$$;

revoke all on function public.increment_billing_meetings_this_month(uuid, integer) from public;
revoke all on function public.increment_billing_meetings_this_month(uuid, integer) from anon;
revoke all on function public.increment_billing_meetings_this_month(uuid, integer) from authenticated;
grant execute on function public.increment_billing_meetings_this_month(uuid, integer) to service_role;
