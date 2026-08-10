-- Idempotency claims for trial lifecycle emails sent via Resend events.
-- No RLS changes needed: billing_accounts writes are already service-role-only
-- (see 019_secure_billing_accounts_write_policies.sql).

alter table public.billing_accounts
  add column if not exists trial_started_email_event_at timestamptz,
  add column if not exists trial_converted_email_event_at timestamptz;
