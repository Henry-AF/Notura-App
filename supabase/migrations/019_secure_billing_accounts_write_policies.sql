drop policy if exists "billing_accounts_own_insert" on public.billing_accounts;
drop policy if exists "billing_accounts_own_update" on public.billing_accounts;

revoke insert, update, delete on table public.billing_accounts from authenticated;
revoke insert, update, delete on table public.billing_accounts from anon;

grant select on table public.billing_accounts to authenticated;
