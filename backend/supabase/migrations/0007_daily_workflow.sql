-- Daily work rhythm: a focused start-of-day commitment and end-of-day closeout.
-- Additive only. Run after 0001-0006.

create table if not exists workdays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  work_date date not null default current_date,
  status text not null check (status in ('Open', 'Completed')) default 'Open',
  focus text not null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  completed_summary text,
  blockers text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create table if not exists workday_items (
  id uuid primary key default gen_random_uuid(),
  workday_id uuid not null references workdays(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  task_id uuid references project_tasks(id) on delete set null,
  title text not null,
  planned_outcome text not null,
  status text not null check (status in ('Planned', 'In Progress', 'Completed', 'Blocked', 'Deferred')) default 'Planned',
  progress_note text,
  blocker_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workdays_date on workdays(work_date, status);
create index if not exists idx_workdays_user on workdays(user_id, work_date desc);
create index if not exists idx_workday_items_workday on workday_items(workday_id);
create index if not exists idx_workday_items_project on workday_items(project_id);
