-- Analytics views for editable meeting participants and cited entities.
-- Views run with the querying user's RLS context.

create or replace view public.meeting_participation_analytics
with (security_invoker = true) as
select
  meetings.user_id,
  meeting_participants.meeting_id,
  meeting_participants.id as participant_id,
  meeting_participants.display_name,
  meeting_participants.original_name,
  meeting_participants.role
from public.meeting_participants
join public.meetings
  on meetings.id = meeting_participants.meeting_id
where meeting_participants.role = 'participant';

create or replace view public.meeting_tasks_by_responsible
with (security_invoker = true) as
select
  meetings.user_id,
  meetings.id as meeting_id,
  meeting_participants.id as participant_id,
  meeting_participants.display_name,
  count(*)::integer as task_count
from public.meetings
join lateral jsonb_array_elements(
  coalesce(meetings.summary_structured->'action_items', '[]'::jsonb)
) as action_item(item)
  on true
join public.meeting_participants
  on meeting_participants.id = (action_item.item->>'participant_id')::uuid
  and meeting_participants.meeting_id = meetings.id
where meeting_participants.role = 'participant'
group by
  meetings.user_id,
  meetings.id,
  meeting_participants.id,
  meeting_participants.display_name;

create or replace view public.meetings_by_participant
with (security_invoker = true) as
select
  user_id,
  participant_id,
  display_name,
  original_name,
  count(distinct meeting_id)::integer as meeting_count
from public.meeting_participation_analytics
group by user_id, participant_id, display_name, original_name;

create or replace view public.meeting_entity_frequency
with (security_invoker = true) as
select
  meetings.user_id,
  meeting_participants.id as entity_id,
  meeting_participants.display_name,
  meeting_participants.original_name,
  count(distinct meeting_participants.meeting_id)::integer as meeting_count
from public.meeting_participants
join public.meetings
  on meetings.id = meeting_participants.meeting_id
where meeting_participants.role = 'entity'
group by
  meetings.user_id,
  meeting_participants.id,
  meeting_participants.display_name,
  meeting_participants.original_name;

grant select on public.meeting_participation_analytics to authenticated;
grant select on public.meeting_tasks_by_responsible to authenticated;
grant select on public.meetings_by_participant to authenticated;
grant select on public.meeting_entity_frequency to authenticated;
