-- Persist the task-session total on the closed workday for reporting while
-- retaining the individual work_sessions as the auditable source of truth.
alter table workdays
  add column if not exists productive_minutes int not null default 0;

do $$ begin
  alter table workdays add constraint workdays_productive_minutes_check
    check (productive_minutes >= 0);
exception when duplicate_object then null; end $$;
