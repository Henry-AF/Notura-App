alter table public.billing_accounts
  add column if not exists active_billing_provider text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_accounts_active_billing_provider_check'
      and conrelid = 'public.billing_accounts'::regclass
  ) then
    alter table public.billing_accounts
      add constraint billing_accounts_active_billing_provider_check
      check (
        active_billing_provider is null or
        active_billing_provider in ('stripe', 'abacatepay')
      );
  end if;
end $$;

update public.billing_accounts
set active_billing_provider = case
  when stripe_subscription_id is not null then 'stripe'
  when abacatepay_subscription_id is not null then 'abacatepay'
  else active_billing_provider
end
where active_billing_provider is null
  and plan <> 'free';
