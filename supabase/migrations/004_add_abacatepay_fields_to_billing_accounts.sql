-- ─────────────────────────────────────────────────────────────────────────────
-- Store AbacatePay customer and pending checkout state in billing accounts
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.billing_accounts
  add column if not exists abacatepay_customer_id text,
  add column if not exists abacatepay_pending_checkout_id text,
  add column if not exists abacatepay_pending_plan text
    check (abacatepay_pending_plan in ('free', 'pro', 'team'));
