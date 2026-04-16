-- Replace task completion flag with explicit workflow status.
-- Keeps legacy completed/completed_at columns in sync for compatibility.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'task_status'
  ) then
    create type task_status as enum ('todo', 'in_progress', 'completed');
  end if;
end $$;

alter table tasks
  add column if not exists status task_status;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'kanban_status'
  ) then
    execute $sql$
      update tasks
      set status = case
        when status is not null then status
        when kanban_status = 'in_progress' then 'in_progress'::task_status
        when kanban_status in ('completed', 'done') then 'completed'::task_status
        else 'todo'::task_status
      end
    $sql$;
  else
    execute $sql$
      update tasks
      set status = case
        when status is not null then status
        when completed = true then 'completed'::task_status
        else 'todo'::task_status
      end
    $sql$;
  end if;
end $$;

update tasks
set
  completed = (status = 'completed'),
  completed_at = case
    when status = 'completed' then coalesce(completed_at, now())
    else null
  end;

update tasks
set status = 'todo'
where status is null;

alter table tasks
  alter column status set default 'todo',
  alter column status set not null;

drop index if exists idx_tasks_completed;
create index if not exists idx_tasks_status on tasks(status);
