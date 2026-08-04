-- Personal operating workspace: classify daily work and support scheduled,
-- recurring tasks, meetings and updates without creating parallel modules.
alter table daily_todos
  add column if not exists domain_type text not null default 'PERSONAL',
  add column if not exists work_type text not null default 'TASK',
  add column if not exists recurrence text not null default 'NONE',
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists meeting_with text,
  add column if not exists channel text;

do $$ begin
  alter table daily_todos add constraint daily_todos_domain_type_check
    check (domain_type in ('PERSONAL', 'DEVELOPMENT', 'MARKETING', 'SALES', 'OPERATIONS'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table daily_todos add constraint daily_todos_work_type_check
    check (work_type in ('TASK', 'MEETING', 'UPDATE'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table daily_todos add constraint daily_todos_recurrence_check
    check (recurrence in ('NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY'));
exception when duplicate_object then null; end $$;

create index if not exists daily_todos_assignee_domain_due_idx
  on daily_todos (assigned_to, domain_type, due_date);
