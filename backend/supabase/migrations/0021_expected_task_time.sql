-- Every newly-created task carries a usable estimate. Existing rows receive a
-- conservative one-hour default so daily planning can rely on the field.
alter table daily_todos
  add column if not exists estimate_minutes int;

update daily_todos
set estimate_minutes = 60
where work_type = 'TASK' and estimate_minutes is null;

update project_tasks
set estimate_minutes = 60
where estimate_minutes is null;

do $$ begin
  alter table daily_todos add constraint daily_todos_estimate_minutes_check
    check (estimate_minutes is null or estimate_minutes between 15 and 480);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table project_tasks add constraint project_tasks_estimate_minutes_check
    check (estimate_minutes is null or estimate_minutes between 15 and 480);
exception when duplicate_object then null; end $$;
