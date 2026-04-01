alter table public.billing_accounts
  add column if not exists abacatepay_customer_sync_started_at timestamptz;
