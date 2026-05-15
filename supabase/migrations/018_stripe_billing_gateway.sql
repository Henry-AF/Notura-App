alter table public.billing_accounts
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_auto_renew_enabled boolean not null default true,
  add column if not exists stripe_auto_renew_updated_at timestamptz,
  add column if not exists stripe_renewal_status text not null default 'idle';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_accounts_stripe_renewal_status_check'
  ) then
    alter table public.billing_accounts
      add constraint billing_accounts_stripe_renewal_status_check
      check (
        stripe_renewal_status in (
          'idle',
          'active',
          'canceling',
          'canceled',
          'past_due',
          'unpaid',
          'incomplete',
          'incomplete_expired',
          'trialing',
          'paused'
        )
      );
  end if;
end $$;
