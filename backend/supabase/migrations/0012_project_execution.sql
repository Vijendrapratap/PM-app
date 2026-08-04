-- Canonical project execution fields and hierarchy safeguards.

alter table projects
  add column if not exists canonical_status text,
  add column if not exists recommended_health text,
  add column if not exists health_note text,
  add column if not exists health_updated_by uuid references users(id) on delete set null,
  add column if not exists health_updated_at timestamptz;

update projects set canonical_status = case status::text
  when 'Draft' then 'DRAFT'
  when 'Saved' then 'DRAFT'
  when 'Planning' then 'PLANNING'
  when 'In Progress' then 'ACTIVE'
  when 'Review' then 'ACTIVE'
  when 'Testing' then 'ACTIVE'
  when 'Completed' then 'COMPLETED'
  when 'Cancelled' then 'CANCELLED'
  when 'On Hold' then 'ON_HOLD'
  else 'DRAFT'
end where canonical_status is null;

alter table projects drop constraint if exists projects_canonical_status_check;
alter table projects add constraint projects_canonical_status_check
  check (canonical_status is null or canonical_status in ('DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'CANCELLED'));
alter table projects drop constraint if exists projects_recommended_health_check;
alter table projects add constraint projects_recommended_health_check
  check (recommended_health is null or recommended_health in ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'NOT_SET'));

alter table project_tasks
  add column if not exists review_note text,
  add column if not exists review_requested_at timestamptz,
  add column if not exists reviewed_at timestamptz;

alter table project_tasks drop constraint if exists project_tasks_status_check;
alter table project_tasks add constraint project_tasks_status_check
  check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked', 'Cancelled', 'Deferred'));

create table if not exists task_collaborators (
  task_id uuid not null references project_tasks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists idx_projects_canonical_status on projects(organization_id, canonical_status, health);
create index if not exists idx_tasks_canonical_status on project_tasks(project_id, canonical_status, blocked, due_date);
create index if not exists idx_task_collaborators_user on task_collaborators(user_id, task_id);
