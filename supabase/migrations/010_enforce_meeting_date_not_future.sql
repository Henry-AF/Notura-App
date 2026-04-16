do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meetings_meeting_date_not_future_check'
      and conrelid = 'public.meetings'::regclass
  ) then
    alter table public.meetings
      add constraint meetings_meeting_date_not_future_check
      check (
        meeting_date is null
        or (
          meeting_date ~ '^\d{4}-\d{2}-\d{2}$'
          and meeting_date::date <= current_date
        )
      ) not valid;
  end if;
end $$;
