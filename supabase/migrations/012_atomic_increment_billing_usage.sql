-- Atomic monthly usage increment for billing_accounts.
-- Source of truth for processed meetings should be billing_accounts.meetings_this_month,
-- never a count over meetings rows.

create or replace function public.increment_billing_meetings_this_month(
  p_user_id uuid,
  p_increment integer default 1
)
returns integer
language sql
volatile
as $$
  with upserted as (
    insert into public.billing_accounts (user_id, meetings_this_month)
    values (p_user_id, greatest(coalesce(p_increment, 0), 0))
    on conflict (user_id)
    do update set
      meetings_this_month = greatest(0, public.billing_accounts.meetings_this_month + coalesce(p_increment, 0)),
      updated_at = now()
    returning meetings_this_month
  )
  select meetings_this_month
  from upserted;
$$;
