-- ─────────────────────────────────────────────────────────────────────────────
-- Add deterministic dedupe keys for summary-derived rows so retries can upsert
-- instead of creating duplicates.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists dedupe_key text;

alter table public.decisions
  add column if not exists dedupe_key text;

alter table public.open_items
  add column if not exists dedupe_key text;

with ranked_tasks as (
  select
    id,
    row_number() over (
      partition by
        meeting_id,
        lower(trim(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g'))),
        lower(trim(regexp_replace(coalesce(owner, ''), '\s+', ' ', 'g'))),
        lower(trim(regexp_replace(coalesce(due_date, ''), '\s+', ' ', 'g'))),
        lower(trim(regexp_replace(coalesce(priority, ''), '\s+', ' ', 'g')))
      order by
        completed desc,
        completed_at desc nulls last,
        created_at asc,
        id asc
    ) as rn
  from public.tasks
)
delete from public.tasks using ranked_tasks
where public.tasks.id = ranked_tasks.id
  and ranked_tasks.rn > 1;

with ranked_decisions as (
  select
    id,
    row_number() over (
      partition by
        meeting_id,
        lower(trim(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g'))),
        lower(trim(regexp_replace(coalesce(decided_by, ''), '\s+', ' ', 'g'))),
        lower(trim(regexp_replace(coalesce(confidence, ''), '\s+', ' ', 'g')))
      order by created_at asc, id asc
    ) as rn
  from public.decisions
)
delete from public.decisions using ranked_decisions
where public.decisions.id = ranked_decisions.id
  and ranked_decisions.rn > 1;

with ranked_open_items as (
  select
    id,
    row_number() over (
      partition by
        meeting_id,
        lower(trim(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g'))),
        lower(trim(regexp_replace(coalesce(context, ''), '\s+', ' ', 'g')))
      order by created_at asc, id asc
    ) as rn
  from public.open_items
)
delete from public.open_items using ranked_open_items
where public.open_items.id = ranked_open_items.id
  and ranked_open_items.rn > 1;

update public.tasks
set dedupe_key = encode(
  digest(
    'v1::task::'
    || lower(trim(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g')))
    || '::'
    || lower(trim(regexp_replace(coalesce(owner, ''), '\s+', ' ', 'g')))
    || '::'
    || lower(trim(regexp_replace(coalesce(due_date, ''), '\s+', ' ', 'g')))
    || '::'
    || lower(trim(regexp_replace(coalesce(priority, ''), '\s+', ' ', 'g')))
    || '::1',
    'sha256'
  ),
  'hex'
)
where dedupe_key is null;

update public.decisions
set dedupe_key = encode(
  digest(
    'v1::decision::'
    || lower(trim(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g')))
    || '::'
    || lower(trim(regexp_replace(coalesce(decided_by, ''), '\s+', ' ', 'g')))
    || '::'
    || lower(trim(regexp_replace(coalesce(confidence, ''), '\s+', ' ', 'g')))
    || '::1',
    'sha256'
  ),
  'hex'
)
where dedupe_key is null;

update public.open_items
set dedupe_key = encode(
  digest(
    'v1::open_item::'
    || lower(trim(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g')))
    || '::'
    || lower(trim(regexp_replace(coalesce(context, ''), '\s+', ' ', 'g')))
    || '::1',
    'sha256'
  ),
  'hex'
)
where dedupe_key is null;

alter table public.tasks
  alter column dedupe_key set not null;

alter table public.decisions
  alter column dedupe_key set not null;

alter table public.open_items
  alter column dedupe_key set not null;

create unique index if not exists idx_tasks_meeting_dedupe_key
  on public.tasks(meeting_id, dedupe_key);

create unique index if not exists idx_decisions_meeting_dedupe_key
  on public.decisions(meeting_id, dedupe_key);

create unique index if not exists idx_open_items_meeting_dedupe_key
  on public.open_items(meeting_id, dedupe_key);
