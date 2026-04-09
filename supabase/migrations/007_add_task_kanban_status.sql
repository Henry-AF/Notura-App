-- Add kanban_status to tasks for multi-column kanban persistence
alter table tasks
  add column if not exists kanban_status text default 'todo';

-- Sync existing data
update tasks set kanban_status = 'done' where completed = true;
update tasks set kanban_status = 'todo' where completed = false;
