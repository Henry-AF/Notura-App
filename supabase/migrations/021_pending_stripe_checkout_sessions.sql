alter table public.billing_accounts
  add column if not exists stripe_pending_checkout_session_id text,
  add column if not exists stripe_pending_plan text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_accounts_stripe_pending_plan_check'
      and conrelid = 'public.billing_accounts'::regclass
  ) then
    alter table public.billing_accounts
      add constraint billing_accounts_stripe_pending_plan_check
      check (
        stripe_pending_plan is null or
        stripe_pending_plan in ('pro', 'team')
      );
  end if;
end $$;
