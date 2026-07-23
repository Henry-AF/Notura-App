-- Custom meeting ATA templates (docx). Only exposed to paid users; the
-- default template ships as a static file in the repo, not a row here.

create table if not exists public.meeting_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  r2_key text not null,
  original_filename text,
  placeholders text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_templates_user_id
  on public.meeting_templates(user_id);

create or replace function public.touch_meeting_templates_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_meeting_templates_updated_at on public.meeting_templates;
create trigger touch_meeting_templates_updated_at
  before update on public.meeting_templates
  for each row
  execute function public.touch_meeting_templates_updated_at();

alter table public.meeting_templates enable row level security;

drop policy if exists "meeting_templates_own_select" on public.meeting_templates;
drop policy if exists "meeting_templates_own_insert" on public.meeting_templates;
drop policy if exists "meeting_templates_own_update" on public.meeting_templates;
drop policy if exists "meeting_templates_own_delete" on public.meeting_templates;

create policy "meeting_templates_own_select"
  on public.meeting_templates for select
  using (auth.uid() = user_id);

create policy "meeting_templates_own_insert"
  on public.meeting_templates for insert
  with check (auth.uid() = user_id);

create policy "meeting_templates_own_update"
  on public.meeting_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "meeting_templates_own_delete"
  on public.meeting_templates for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.meeting_templates to authenticated;
grant all on public.meeting_templates to service_role;

notify pgrst, 'reload schema';
