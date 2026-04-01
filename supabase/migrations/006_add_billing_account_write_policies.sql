create policy "billing_accounts_own_insert"
  on public.billing_accounts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "billing_accounts_own_update"
  on public.billing_accounts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
