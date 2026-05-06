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
