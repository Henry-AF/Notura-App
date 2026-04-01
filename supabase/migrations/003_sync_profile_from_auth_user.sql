-- ─────────────────────────────────────────────────────────────────────────────
-- Sync auth.users data into public.profiles on signup
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role, whatsapp_number)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'role',
    nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '')
  )
  on conflict (id) do nothing;

  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
