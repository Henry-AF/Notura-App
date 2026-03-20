-- ─────────────────────────────────────────────────────────────────────────────
-- Notura — Initial Database Schema
-- Run this in Supabase SQL Editor or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  role text check (role in ('rh', 'juridico', 'administrativo', 'outro')),
  company text,
  whatsapp_number text,
  plan text check (plan in ('free', 'pro', 'team')) default 'free',
  meetings_this_month integer default 0,
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Meetings
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text,
  client_name text,
  meeting_date text,
  audio_r2_key text,
  transcript text,
  summary_whatsapp text,
  summary_json jsonb,
  whatsapp_number text not null,
  whatsapp_status text check (whatsapp_status in ('pending', 'sent', 'failed')) default 'pending',
  status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  source text check (source in ('upload', 'zoom_webhook', 'chrome_extension')) default 'upload',
  duration_seconds integer,
  cost_usd numeric(10, 4),
  prompt_version text,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Tasks (extracted from summary_json)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  owner text,
  due_date text,
  priority text check (priority in ('alta', 'média', 'baixa')) default 'média',
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Decisions
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  decided_by text,
  confidence text check (confidence in ('alta', 'média')) default 'média',
  created_at timestamptz default now()
);

-- Open items
create table if not exists open_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  context text,
  created_at timestamptz default now()
);

-- Jobs (worker tracking)
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade not null,
  status text check (status in ('queued', 'processing', 'completed', 'failed')) default 'queued',
  current_step text,
  error_message text,
  attempts integer default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index if not exists idx_meetings_user_id on meetings(user_id);
create index if not exists idx_meetings_status on meetings(status);
create index if not exists idx_meetings_created_at on meetings(created_at desc);
create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_meeting_id on tasks(meeting_id);
create index if not exists idx_tasks_completed on tasks(completed);
create index if not exists idx_decisions_meeting_id on decisions(meeting_id);
create index if not exists idx_open_items_meeting_id on open_items(meeting_id);
create index if not exists idx_jobs_meeting_id on jobs(meeting_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table meetings enable row level security;
alter table tasks enable row level security;
alter table decisions enable row level security;
alter table open_items enable row level security;
alter table jobs enable row level security;

-- Profiles: users can only access their own
create policy "profiles_own" on profiles for all using (auth.uid() = id);

-- Meetings: users can only access their own
create policy "meetings_own" on meetings for all using (auth.uid() = user_id);

-- Tasks: users can only access their own
create policy "tasks_own" on tasks for all using (auth.uid() = user_id);

-- Decisions: users can access decisions from their meetings
create policy "decisions_own" on decisions for all
  using (user_id = auth.uid());

-- Open items: users can access open items from their meetings
create policy "open_items_own" on open_items for all
  using (user_id = auth.uid());

-- Jobs: users can view jobs for their meetings
create policy "jobs_own" on jobs for select
  using (meeting_id in (select id from meetings where user_id = auth.uid()));

-- ─── Auto-create profile on signup ──────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table meetings;
