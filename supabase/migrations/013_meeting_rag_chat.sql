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
  embedding_model text not null default 'gemini-embedding-001',
  embedding_dimensions integer not null default 768,
  chunking_version text not null default 'utterance-merge-v1-400',
  created_at timestamptz default now(),
  unique (
    meeting_id,
    embedding_model,
    embedding_dimensions,
    chunking_version,
    chunk_index
  )
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

create table if not exists ai_usage_daily (
  user_id uuid not null references auth.users on delete cascade,
  usage_date date not null,
  feature text not null,
  used_count integer not null default 0 check (used_count >= 0),
  quota_limit integer not null check (quota_limit > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, usage_date, feature)
);

create index if not exists idx_meeting_transcript_chunks_meeting_id
  on meeting_transcript_chunks(meeting_id);

create index if not exists idx_meeting_transcript_chunks_user_id
  on meeting_transcript_chunks(user_id);

create index if not exists idx_meeting_transcript_chunks_embedding_hnsw
  on meeting_transcript_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_meeting_transcript_chunks_index_version
  on meeting_transcript_chunks(
    meeting_id,
    embedding_model,
    embedding_dimensions,
    chunking_version
  );

create index if not exists idx_meeting_chats_meeting_id_created_at
  on meeting_chats(meeting_id, created_at desc);

create index if not exists idx_meeting_chats_user_id
  on meeting_chats(user_id);

create index if not exists idx_meeting_chat_outbox_status_next_attempt_at
  on meeting_chat_outbox(status, next_attempt_at);

create index if not exists idx_meeting_chat_outbox_chat_id
  on meeting_chat_outbox(chat_id);

create index if not exists idx_ai_usage_daily_feature_usage_date
  on ai_usage_daily(feature, usage_date);

alter table meeting_transcript_chunks enable row level security;
alter table meeting_chats enable row level security;
alter table meeting_chat_outbox enable row level security;
alter table ai_usage_daily enable row level security;

drop policy if exists "meeting_transcript_chunks_own" on meeting_transcript_chunks;
drop policy if exists "meeting_chats_own" on meeting_chats;
drop policy if exists "meeting_chat_outbox_own" on meeting_chat_outbox;
drop policy if exists "ai_usage_daily_own" on ai_usage_daily;

revoke all on table meeting_transcript_chunks from authenticated;
revoke all on table meeting_transcript_chunks from anon;
revoke all on table meeting_transcript_chunks from public;

revoke all on table meeting_chats from authenticated;
revoke all on table meeting_chats from anon;
revoke all on table meeting_chats from public;

revoke all on table meeting_chat_outbox from authenticated;
revoke all on table meeting_chat_outbox from anon;
revoke all on table meeting_chat_outbox from public;

revoke all on table ai_usage_daily from authenticated;
revoke all on table ai_usage_daily from anon;
revoke all on table ai_usage_daily from public;

grant all on table meeting_transcript_chunks to service_role;
grant all on table meeting_chats to service_role;
grant all on table meeting_chat_outbox to service_role;
grant all on table ai_usage_daily to service_role;

drop function if exists create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text
);

create or replace function create_meeting_chat_with_outbox(
  p_user_id uuid,
  p_meeting_id uuid,
  p_question text,
  p_ai_feature text default 'meeting_chat',
  p_ai_daily_quota_limit integer default 10
)
returns table (
  chat_id uuid,
  status text,
  ai_daily_quota_used integer,
  ai_daily_quota_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_status text;
  v_usage_date date := current_date;
  v_ai_daily_quota_used integer;
  v_ai_daily_quota_limit integer;
begin
  p_ai_feature := nullif(btrim(p_ai_feature), '');

  if p_ai_feature is null then
    raise exception 'p_ai_feature must not be blank';
  end if;

  if p_ai_daily_quota_limit is null or p_ai_daily_quota_limit <= 0 then
    raise exception 'p_ai_daily_quota_limit must be positive';
  end if;

  insert into public.ai_usage_daily as usage (
    user_id,
    usage_date,
    feature,
    used_count,
    quota_limit
  )
  values (
    p_user_id,
    v_usage_date,
    p_ai_feature,
    0,
    p_ai_daily_quota_limit
  )
  on conflict (user_id, usage_date, feature) do update
    set
      quota_limit = excluded.quota_limit,
      updated_at = now();

  update public.ai_usage_daily
    set
      used_count = public.ai_usage_daily.used_count + 1,
      quota_limit = p_ai_daily_quota_limit,
      updated_at = now()
  where user_id = p_user_id
    and usage_date = v_usage_date
    and feature = p_ai_feature
    and used_count < p_ai_daily_quota_limit
  returning
    used_count,
    quota_limit
  into v_ai_daily_quota_used, v_ai_daily_quota_limit;

  if v_ai_daily_quota_used is null then
    raise exception 'ai_chat_daily_quota_exceeded' using errcode = 'AI001';
  end if;

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

  return query select
    v_chat_id,
    v_status,
    v_ai_daily_quota_used,
    v_ai_daily_quota_limit;
end;
$$;

revoke execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text,
  text,
  integer
) from authenticated;

revoke execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text,
  text,
  integer
) from anon;

revoke execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text,
  text,
  integer
) from public;

grant execute on function create_meeting_chat_with_outbox(
  uuid,
  uuid,
  text,
  text,
  integer
) to service_role;

create or replace function upsert_meeting_transcript_chunks_with_lock(
  p_user_id uuid,
  p_meeting_id uuid,
  p_chunks jsonb,
  p_embedding_model text default 'gemini-embedding-001',
  p_embedding_dimensions integer default 768,
  p_chunking_version text default 'utterance-merge-v1-400'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  p_chunks := coalesce(p_chunks, '[]'::jsonb);
  p_embedding_model := nullif(btrim(p_embedding_model), '');
  p_chunking_version := nullif(btrim(p_chunking_version), '');

  if jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'p_chunks must be a JSON array';
  end if;

  if p_embedding_model is null then
    raise exception 'p_embedding_model must not be blank';
  end if;

  if p_embedding_dimensions is null or p_embedding_dimensions <= 0 then
    raise exception 'p_embedding_dimensions must be positive';
  end if;

  if p_chunking_version is null then
    raise exception 'p_chunking_version must not be blank';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_meeting_id::text, 0));

  insert into public.meeting_transcript_chunks (
    meeting_id,
    user_id,
    chunk_index,
    text,
    speaker,
    start_ms,
    end_ms,
    metadata,
    embedding,
    embedding_model,
    embedding_dimensions,
    chunking_version
  )
  select
    p_meeting_id,
    p_user_id,
    (chunk->>'chunk_index')::integer,
    chunk->>'text',
    nullif(chunk->>'speaker', ''),
    (chunk->>'start_ms')::integer,
    (chunk->>'end_ms')::integer,
    coalesce(chunk->'metadata', '{}'::jsonb),
    ((chunk->'embedding')::text)::vector(768),
    p_embedding_model,
    p_embedding_dimensions,
    p_chunking_version
  from jsonb_array_elements(p_chunks) as chunk
  on conflict (
    meeting_id,
    embedding_model,
    embedding_dimensions,
    chunking_version,
    chunk_index
  ) do update
    set
      user_id = excluded.user_id,
      text = excluded.text,
      speaker = excluded.speaker,
      start_ms = excluded.start_ms,
      end_ms = excluded.end_ms,
      metadata = excluded.metadata,
      embedding = excluded.embedding,
      embedding_model = excluded.embedding_model,
      embedding_dimensions = excluded.embedding_dimensions,
      chunking_version = excluded.chunking_version;

  delete from public.meeting_transcript_chunks
  where meeting_id = p_meeting_id
    and user_id = p_user_id
    and embedding_model = p_embedding_model
    and embedding_dimensions = p_embedding_dimensions
    and chunking_version = p_chunking_version
    and chunk_index >= jsonb_array_length(p_chunks);
end;
$$;

revoke execute on function upsert_meeting_transcript_chunks_with_lock(
  uuid,
  uuid,
  jsonb,
  text,
  integer,
  text
) from authenticated;

revoke execute on function upsert_meeting_transcript_chunks_with_lock(
  uuid,
  uuid,
  jsonb,
  text,
  integer,
  text
) from anon;

revoke execute on function upsert_meeting_transcript_chunks_with_lock(
  uuid,
  uuid,
  jsonb,
  text,
  integer,
  text
) from public;

grant execute on function upsert_meeting_transcript_chunks_with_lock(
  uuid,
  uuid,
  jsonb,
  text,
  integer,
  text
) to service_role;

create or replace function match_meeting_transcript_chunks(
  p_user_id uuid,
  p_meeting_id uuid,
  p_query_embedding vector(768),
  p_limit integer default 5,
  p_similarity_threshold double precision default 0.6,
  p_embedding_model text default 'gemini-embedding-001',
  p_embedding_dimensions integer default 768,
  p_chunking_version text default 'utterance-merge-v1-400'
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
    and c.embedding_model = p_embedding_model
    and c.embedding_dimensions = p_embedding_dimensions
    and c.chunking_version = p_chunking_version
    and 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_limit, 0), 5);
$$;

revoke execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision,
  text,
  integer,
  text
) from authenticated;

revoke execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision,
  text,
  integer,
  text
) from anon;

revoke execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision,
  text,
  integer,
  text
) from public;

grant execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector,
  integer,
  double precision,
  text,
  integer,
  text
) to service_role;
