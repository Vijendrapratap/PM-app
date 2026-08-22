-- Immutable daily sessions and append-only work records.
create table if not exists daily_work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  work_date date not null,
  timezone text not null default 'UTC',
  start_at timestamptz not null default now(),
  end_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'AUTO_COMPLETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create unique index if not exists idx_daily_work_sessions_active_user
  on daily_work_sessions(user_id) where status = 'ACTIVE';
create index if not exists idx_daily_work_sessions_org_date
  on daily_work_sessions(organization_id, work_date, status);

create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_work_sessions(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  project_id uuid references projects(id) on delete set null,
  task_id uuid references project_tasks(id) on delete set null,
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_logs_session on work_logs(session_id, created_at);
create index if not exists idx_work_logs_user_date on work_logs(user_id, created_at desc);
create index if not exists idx_work_logs_project on work_logs(project_id, created_at desc);

create or replace function prevent_work_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'This work record is immutable and cannot be modified.' using errcode = 'P0001';
end;
$$;

drop trigger if exists work_logs_immutable on work_logs;
create trigger work_logs_immutable
before update or delete on work_logs
for each row execute function prevent_work_log_mutation();


