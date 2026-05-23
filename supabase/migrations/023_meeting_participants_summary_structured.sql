alter table public.meetings
  add column if not exists summary_structured jsonb,
  add column if not exists summary_version integer not null default 1;

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  display_name text not null,
  original_name text not null,
  role text not null check (role in ('participant', 'entity')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_participants_display_name_not_blank
    check (char_length(trim(display_name)) > 0),
  constraint meeting_participants_display_name_length
    check (char_length(trim(display_name)) <= 80),
  constraint meeting_participants_original_name_not_blank
    check (char_length(trim(original_name)) > 0),
  constraint meeting_participants_unique_original_name
    unique (meeting_id, role, original_name)
);

create index if not exists idx_meeting_participants_meeting_id
  on public.meeting_participants(meeting_id);

create index if not exists idx_meeting_participants_meeting_role
  on public.meeting_participants(meeting_id, role);

create or replace function public.touch_meeting_participants_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_meeting_participants_updated_at
  on public.meeting_participants;
create trigger touch_meeting_participants_updated_at
  before update on public.meeting_participants
  for each row
  execute function public.touch_meeting_participants_updated_at();

alter table public.meeting_participants enable row level security;

drop policy if exists "meeting_participants_own_select"
  on public.meeting_participants;
drop policy if exists "meeting_participants_own_insert"
  on public.meeting_participants;
drop policy if exists "meeting_participants_own_update"
  on public.meeting_participants;
drop policy if exists "meeting_participants_own_delete"
  on public.meeting_participants;

create policy "meeting_participants_own_select"
  on public.meeting_participants for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

create policy "meeting_participants_own_insert"
  on public.meeting_participants for insert
  with check (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

create policy "meeting_participants_own_update"
  on public.meeting_participants for update
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

create policy "meeting_participants_own_delete"
  on public.meeting_participants for delete
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.meeting_participants
  to authenticated;
grant all on public.meeting_participants to service_role;
