-- Migration 017 — Meeting RAG chat outbox
--
-- Creates a durable outbox for chat answer events. The route commits the chat
-- and the pending event together; Inngest dispatches the outbox separately.

create table if not exists meeting_chat_outbox (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references meeting_chats on delete cascade,
  meeting_id uuid not null references meetings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  event_name text not null default 'meeting/chat.answer',
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (chat_id)
);

create index if not exists idx_meeting_chat_outbox_status_next_attempt_at
  on meeting_chat_outbox(status, next_attempt_at);

create index if not exists idx_meeting_chat_outbox_chat_id
  on meeting_chat_outbox(chat_id);

alter table meeting_chat_outbox enable row level security;

drop policy if exists "meeting_chat_outbox_own" on meeting_chat_outbox;

revoke all on table meeting_chat_outbox from authenticated;
revoke all on table meeting_chat_outbox from anon;
revoke all on table meeting_chat_outbox from public;

grant all on table meeting_chat_outbox to service_role;

create or replace function create_meeting_chat_with_outbox(
  p_user_id uuid,
  p_meeting_id uuid,
  p_question text
)
returns table (
  chat_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_status text;
begin
  insert into public.meeting_chats as c (
    meeting_id,
    user_id,
    question,
    status
  )
  values (
    p_meeting_id,
    p_user_id,
    p_question,
    'processing'
  )
  returning c.id, c.status into v_chat_id, v_status;

  insert into public.meeting_chat_outbox (
    chat_id,
    meeting_id,
    user_id,
    event_name,
    payload,
    status
  )
  values (
    v_chat_id,
    p_meeting_id,
    p_user_id,
    'meeting/chat.answer',
    jsonb_build_object(
      'chatId', v_chat_id::text,
      'meetingId', p_meeting_id::text,
      'userId', p_user_id::text
    ),
    'pending'
  );

  return query select v_chat_id, v_status;
end;
$$;

revoke execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text
) from authenticated;

revoke execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text
) from anon;

revoke execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text
) from public;

grant execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text
) to service_role;
