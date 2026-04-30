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

alter table meeting_transcript_chunks enable row level security;
alter table meeting_chats enable row level security;

create policy "meeting_transcript_chunks_own" on meeting_transcript_chunks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "meeting_chats_own" on meeting_chats
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

grant execute on function match_meeting_transcript_chunks(
  uuid,
  uuid,
  vector(768),
  integer,
  double precision
) to authenticated;
