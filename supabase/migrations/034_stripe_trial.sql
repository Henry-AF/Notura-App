-- 7-day free Pro (internal plan "team") trial via Stripe Checkout.
-- No RLS changes needed: billing_accounts writes are already service-role-only
-- (see 019_secure_billing_accounts_write_policies.sql).

alter table public.billing_accounts
  add column if not exists has_used_trial boolean not null default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_end_at timestamptz,
  add column if not exists trial_offer_dismissed_at timestamptz,
  add column if not exists trial_offer_dismiss_count integer not null default 0;
