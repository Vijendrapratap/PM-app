-- Today-first daily planning, work sessions and first-class blockers.
-- Extends the existing workday tables so old clients continue to function.

alter table workdays
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists timezone text,
  add column if not exists plan_status text,
  add column if not exists primary_outcome text,
  add column if not exists started_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists generated_summary text,
  add column if not exists closure_remarks text,
  add column if not exists reopened_count int not null default 0;

update workdays plan
set organization_id = member.organization_id,
    timezone = coalesce(plan.timezone, member.timezone, 'Asia/Dubai'),
    plan_status = coalesce(plan.plan_status, case plan.status when 'Completed' then 'CLOSED' else 'ACTIVE' end),
    primary_outcome = coalesce(plan.primary_outcome, plan.focus),
    started_at = coalesce(plan.started_at, plan.check_in_at),
    closed_at = coalesce(plan.closed_at, plan.check_out_at),
    closure_remarks = coalesce(plan.closure_remarks, plan.remarks)
from users member
where plan.user_id = member.id
  and (plan.organization_id is null or plan.timezone is null or plan.plan_status is null or plan.primary_outcome is null or plan.started_at is null);

alter table workdays alter column organization_id set not null;
alter table workdays drop constraint if exists workdays_plan_status_check;
alter table workdays add constraint workdays_plan_status_check
  check (plan_status is null or plan_status in ('DRAFT', 'ACTIVE', 'CLOSED', 'REOPENED'));

alter table workday_items
  add column if not exists source text,
  add column if not exists planned_estimate_minutes int,
  add column if not exists order_index int not null default 0,
  add column if not exists end_state text,
  add column if not exists carryover_reason text,
  add column if not exists carryover_count int not null default 0,
  add column if not exists carried_from_item_id uuid references workday_items(id) on delete set null;

update workday_items set source = coalesce(source, 'ASSIGNED') where source is null;
alter table workday_items drop constraint if exists workday_items_source_check;
alter table workday_items add constraint workday_items_source_check
  check (source is null or source in ('CARRYOVER', 'ASSIGNED', 'ADDED_TODAY'));
alter table workday_items drop constraint if exists workday_items_end_state_check;
alter table workday_items add constraint workday_items_end_state_check
  check (end_state is null or end_state in ('DONE', 'CARRY_OVER', 'RESCHEDULED', 'BACKLOG', 'BLOCKED', 'NO_LONGER_REQUIRED'));

create table if not exists work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  daily_plan_id uuid not null references workdays(id) on delete cascade,
  task_id uuid references project_tasks(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'CLOSED')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_work_sessions_one_active
  on work_sessions(user_id) where status = 'ACTIVE';

create table if not exists task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  author_user_id uuid not null references users(id),
  update_text text not null,
  progress_percent int,
  remaining_estimate_minutes int,
  attachment_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (progress_percent is null or progress_percent between 0 and 100)
);

create table if not exists blockers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid not null references project_tasks(id) on delete cascade,
  reported_by uuid not null references users(id),
  summary text not null,
  details text,
  waiting_on_type text not null check (waiting_on_type in ('PERSON', 'CLIENT', 'EXTERNAL_SYSTEM', 'DECISION', 'DEPENDENCY', 'OTHER')),
  waiting_on_user_id uuid references users(id) on delete set null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')),
  suggested_next_action text,
  resolution_owner_user_id uuid references users(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_blockers_one_open_per_task
  on blockers(task_id) where status in ('OPEN', 'IN_PROGRESS');

alter table notifications
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists priority text not null default 'NORMAL',
  add column if not exists read_at timestamptz;

update notifications notification
set organization_id = member.organization_id,
    read_at = case when notification.read then coalesce(notification.read_at, notification.created_at) else null end
from users member
where notification.user_id = member.id and notification.organization_id is null;

alter table notifications drop constraint if exists notifications_priority_check;
alter table notifications add constraint notifications_priority_check
  check (priority in ('LOW', 'NORMAL', 'HIGH', 'CRITICAL'));

create index if not exists idx_workdays_org_date on workdays(organization_id, work_date, plan_status);
create index if not exists idx_workday_items_source on workday_items(workday_id, source, order_index);
create index if not exists idx_work_sessions_plan on work_sessions(daily_plan_id, started_at);
create index if not exists idx_work_sessions_user on work_sessions(user_id, status, started_at desc);
create index if not exists idx_task_updates_task on task_updates(task_id, created_at desc);
create index if not exists idx_blockers_project on blockers(project_id, status, severity, created_at);
create index if not exists idx_blockers_reporter on blockers(reported_by, status, created_at desc);
