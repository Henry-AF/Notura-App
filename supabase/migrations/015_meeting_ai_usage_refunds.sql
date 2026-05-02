-- Migration 015 — Meeting AI usage refunds
--
-- Provider/infrastructure failures should not burn the user's daily AI chat
-- quota. Refunds are recorded in a ledger so repeated workers cannot decrement
-- the same chat more than once.

create table if not exists ai_usage_refunds (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references meeting_chats on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  usage_date date not null,
  feature text not null,
  reason text not null,
  created_at timestamptz default now(),
  unique (chat_id, feature)
);

create index if not exists idx_ai_usage_refunds_user_usage_date
  on ai_usage_refunds(user_id, usage_date desc);

create index if not exists idx_ai_usage_refunds_feature_usage_date
  on ai_usage_refunds(feature, usage_date desc);

alter table ai_usage_refunds enable row level security;

revoke all on table ai_usage_refunds from authenticated;
revoke all on table ai_usage_refunds from anon;
revoke all on table ai_usage_refunds from public;

grant all on table ai_usage_refunds to service_role;

create or replace function refund_meeting_chat_ai_usage(
  p_user_id uuid,
  p_chat_id uuid,
  p_ai_feature text default 'meeting_chat',
  p_reason text default 'provider_error'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_date date;
  v_inserted_count integer;
begin
  p_ai_feature := nullif(btrim(p_ai_feature), '');
  p_reason := nullif(btrim(p_reason), '');

  if p_ai_feature is null then
    raise exception 'p_ai_feature must not be blank';
  end if;

  if p_reason is null then
    raise exception 'p_reason must not be blank';
  end if;

  select c.created_at::date
    into v_usage_date
  from public.meeting_chats c
  where c.id = p_chat_id
    and c.user_id = p_user_id
    and c.status = 'failed'
    and c.fallback_reason = 'provider_error';

  if v_usage_date is null then
    return false;
  end if;

  insert into public.ai_usage_refunds (
    chat_id,
    user_id,
    usage_date,
    feature,
    reason
  )
  values (
    p_chat_id,
    p_user_id,
    v_usage_date,
    p_ai_feature,
    p_reason
  )
  on conflict (chat_id, feature) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    return false;
  end if;

  update public.ai_usage_daily
    set
      used_count = greatest(public.ai_usage_daily.used_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and usage_date = v_usage_date
    and feature = p_ai_feature;

  return true;
end;
$$;

revoke execute on function refund_meeting_chat_ai_usage(
  uuid,
  uuid,
  text,
  text
) from authenticated;

revoke execute on function refund_meeting_chat_ai_usage(
  uuid,
  uuid,
  text,
  text
) from anon;

revoke execute on function refund_meeting_chat_ai_usage(
  uuid,
  uuid,
  text,
  text
) from public;

grant execute on function refund_meeting_chat_ai_usage(
  uuid,
  uuid,
  text,
  text
) to service_role;
