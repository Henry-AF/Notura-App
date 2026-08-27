create table if not exists public.activation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'signup',
    'primeira_gravacao_iniciada',
    'primeira_ata_entregue',
    'primeira_ata_visualizada'
  )),
  meeting_id uuid references public.meetings(id) on delete set null,
  channel text check (channel in ('in_app', 'whatsapp')),
  occurred_at timestamptz not null default now(),
  unique (user_id, event_name)
);

create index if not exists activation_events_cohort_idx
  on public.activation_events(event_name, occurred_at);

alter table public.activation_events enable row level security;
create policy "activation_events_own_select" on public.activation_events
  for select using (auth.uid() = user_id);

create or replace function public.record_activation_event(
  p_user_id uuid,
  p_event_name text,
  p_meeting_id uuid default null,
  p_channel text default null,
  p_occurred_at timestamptz default now()
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  signup_at timestamptz;
  prior_gate_count integer;
begin
  if p_event_name not in (
    'signup', 'primeira_gravacao_iniciada',
    'primeira_ata_entregue', 'primeira_ata_visualizada'
  ) then raise exception 'invalid activation event'; end if;

  if p_event_name = 'primeira_ata_visualizada' then
    select min(occurred_at) into signup_at from public.activation_events
      where user_id = p_user_id and event_name = 'signup';
    select count(*) into prior_gate_count from public.activation_events
      where user_id = p_user_id
        and event_name in ('primeira_gravacao_iniciada', 'primeira_ata_entregue');
    if signup_at is null or prior_gate_count <> 2
      or p_occurred_at > signup_at + interval '7 days' then return false; end if;
    select channel into p_channel from public.activation_events
      where user_id = p_user_id and event_name = 'primeira_ata_entregue';
  end if;

  insert into public.activation_events
    (user_id, event_name, meeting_id, channel, occurred_at)
  values (p_user_id, p_event_name, p_meeting_id, p_channel, p_occurred_at)
  on conflict (user_id, event_name) do nothing;
  return found;
end;
$$;

create or replace function public.track_meeting_activation_gate()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_activation_event(
      new.user_id, 'primeira_gravacao_iniciada', new.id, null, new.created_at
    );
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.record_activation_event(
      new.user_id, 'primeira_ata_entregue', new.id,
      case when new.whatsapp_status = 'sent' then 'whatsapp' else 'in_app' end,
      coalesce(new.completed_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_meeting_activation_gate on public.meetings;
create trigger on_meeting_activation_gate
  after insert or update of status on public.meetings
  for each row execute procedure public.track_meeting_activation_gate();

create or replace function public.get_activation_funnel_metrics(
  p_cohort_start timestamptz,
  p_cohort_end timestamptz
) returns table (
  signup_count bigint, recording_count bigint, delivered_count bigint,
  viewed_count bigint, signup_to_recording_pct numeric,
  recording_to_delivered_pct numeric, delivered_to_viewed_pct numeric,
  activation_rate_pct numeric, median_activation_minutes numeric,
  in_app_activations bigint, whatsapp_activations bigint
)
language sql security definer set search_path = ''
as $$
  with cohort as (
    select user_id, occurred_at as signup_at from public.activation_events
    where event_name = 'signup'
      and occurred_at >= p_cohort_start and occurred_at < p_cohort_end
  ), gates as (
    select c.user_id, c.signup_at,
      max(e.occurred_at) filter (where e.event_name = 'primeira_gravacao_iniciada') as recording_at,
      max(e.occurred_at) filter (where e.event_name = 'primeira_ata_entregue') as delivered_at,
      max(e.occurred_at) filter (where e.event_name = 'primeira_ata_visualizada') as viewed_at,
      max(e.channel) filter (where e.event_name = 'primeira_ata_visualizada') as channel
    from cohort c left join public.activation_events e on e.user_id = c.user_id
    group by c.user_id, c.signup_at
  )
  select count(*)::bigint,
    count(recording_at)::bigint, count(delivered_at)::bigint, count(viewed_at)::bigint,
    round(100.0 * count(recording_at) / nullif(count(*), 0), 1),
    round(100.0 * count(delivered_at) / nullif(count(recording_at), 0), 1),
    round(100.0 * count(viewed_at) / nullif(count(delivered_at), 0), 1),
    round(100.0 * count(viewed_at) / nullif(count(*), 0), 1),
    round((percentile_cont(0.5) within group (
      order by extract(epoch from (viewed_at - signup_at)) / 60
    ) filter (where viewed_at is not null))::numeric, 1),
    count(*) filter (where viewed_at is not null and channel = 'in_app')::bigint,
    count(*) filter (where viewed_at is not null and channel = 'whatsapp')::bigint
  from gates;
$$;

insert into public.activation_events (user_id, event_name, occurred_at)
select id, 'signup', created_at from public.profiles on conflict do nothing;

insert into public.activation_events (user_id, event_name, meeting_id, occurred_at)
select distinct on (user_id) user_id, 'primeira_gravacao_iniciada', id, created_at
from public.meetings order by user_id, created_at on conflict do nothing;

insert into public.activation_events (user_id, event_name, meeting_id, channel, occurred_at)
select distinct on (user_id) user_id, 'primeira_ata_entregue', id,
  case when whatsapp_status = 'sent' then 'whatsapp' else 'in_app' end,
  completed_at
from public.meetings where status = 'completed' and completed_at is not null
order by user_id, completed_at on conflict do nothing;

create or replace function public.handle_new_user()
returns trigger set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role, whatsapp_number)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'role',
    nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), ''))
  on conflict (id) do nothing;
  insert into public.billing_accounts (user_id) values (new.id) on conflict do nothing;
  perform public.record_activation_event(new.id, 'signup', null, null, new.created_at);
  return new;
end;
$$ language plpgsql security definer;

revoke all on function public.record_activation_event(uuid, text, uuid, text, timestamptz) from public;
revoke all on function public.get_activation_funnel_metrics(timestamptz, timestamptz) from public;
grant execute on function public.get_activation_funnel_metrics(timestamptz, timestamptz) to service_role;
grant execute on function public.record_activation_event(uuid, text, uuid, text, timestamptz) to service_role;
