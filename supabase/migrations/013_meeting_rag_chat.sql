-- Migration 013 — Meeting RAG chat

create extension if not exists vector;

create table if not exists meeting_transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  speaker text,
  start_ms integer,
  end_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768) not null,
  created_at timestamptz default now(),
  unique (meeting_id, chunk_index)
);

create table if not exists meeting_chats (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  question text not null,
  question_embedding vector(768),
  answer text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  fallback_reason text,
  model_confirmed boolean,
  sources jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sources) = 'array'),
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

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

create index if not exists idx_meeting_transcript_chunks_meeting_id
  on meeting_transcript_chunks(meeting_id);

create index if not exists idx_meeting_transcript_chunks_user_id
  on meeting_transcript_chunks(user_id);

create index if not exists idx_meeting_transcript_chunks_embedding_hnsw
  on meeting_transcript_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_meeting_chats_meeting_id_created_at
  on meeting_chats(meeting_id, created_at desc);

create index if not exists idx_meeting_chats_user_id
  on meeting_chats(user_id);

create index if not exists idx_meeting_chat_outbox_status_next_attempt_at
  on meeting_chat_outbox(status, next_attempt_at);

create index if not exists idx_meeting_chat_outbox_chat_id
  on meeting_chat_outbox(chat_id);

alter table meeting_transcript_chunks enable row level security;
alter table meeting_chats enable row level security;
alter table meeting_chat_outbox enable row level security;

drop policy if exists "meeting_transcript_chunks_own" on meeting_transcript_chunks;
drop policy if exists "meeting_chats_own" on meeting_chats;
drop policy if exists "meeting_chat_outbox_own" on meeting_chat_outbox;

revoke all on table meeting_transcript_chunks from authenticated;
revoke all on table meeting_transcript_chunks from anon;
revoke all on table meeting_transcript_chunks from public;

revoke all on table meeting_chats from authenticated;
revoke all on table meeting_chats from anon;
revoke all on table meeting_chats from public;

revoke all on table meeting_chat_outbox from authenticated;
revoke all on table meeting_chat_outbox from anon;
revoke all on table meeting_chat_outbox from public;

grant all on table meeting_transcript_chunks to service_role;
grant all on table meeting_chats to service_role;
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

create or replace function match_meeting_transcript_chunks(
  p_user_id uuid,
  p_meeting_id uuid,
  p_query_embedding vector(768),
  p_limit integer default 5,
  p_similarity_threshold double precision default 0.6
)
returns table (
  id uuid,
  meeting_id uuid,
  chunk_index integer,
  text text,
  speaker text,
  start_ms integer,
  end_ms integer,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.meeting_id,
    c.chunk_index,
    c.text,
    c.speaker,
    c.start_ms,
    c.end_ms,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.meeting_transcript_chunks c
  where c.user_id = p_user_id
    and c.meeting_id = p_meeting_id
    and 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_limit, 0), 5);
$$;

revoke execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision
) from authenticated;

revoke execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision
) from anon;

revoke execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision
) from public;

grant execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision
) to service_role;
