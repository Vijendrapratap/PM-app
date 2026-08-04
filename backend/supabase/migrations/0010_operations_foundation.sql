-- Operations Studio v1 foundation.
-- Additive/backward-compatible: legacy role, department, status and workday
-- fields remain available while the application migrates to normalized data.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Dubai',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into organizations (name, timezone)
select 'Pratap AI', 'Asia/Dubai'
where not exists (select 1 from organizations);

alter table users
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists platform_role text,
  add column if not exists designation text,
  add column if not exists manager_user_id uuid references users(id) on delete set null,
  add column if not exists timezone text,
  add column if not exists daily_capacity_minutes int,
  add column if not exists start_date date,
  add column if not exists account_status text,
  add column if not exists invited_at timestamptz;

update users
set organization_id = (select id from organizations order by created_at limit 1)
where organization_id is null;

update users
set platform_role = case role
  when 'Super Admin' then 'CEO'
  when 'Project Manager' then 'MANAGER'
  when 'Lead' then 'MANAGER'
  when 'Team Member' then 'TEAM_MEMBER'
  when 'CEO' then 'CEO'
  when 'MANAGER' then 'MANAGER'
  when 'TEAM_MEMBER' then 'TEAM_MEMBER'
  else 'TEAM_MEMBER'
end
where platform_role is null;

update users
set designation = case role
  when 'Project Manager' then 'Project Manager'
  when 'Lead' then 'Team Lead'
  when 'Super Admin' then 'CEO'
  else coalesce(designation, role)
end
where designation is null;

update users
set timezone = coalesce(timezone, (select timezone from organizations where id = users.organization_id), 'Asia/Dubai'),
    account_status = coalesce(account_status, case status::text when 'Active' then 'ACTIVE' else 'INACTIVE' end)
where timezone is null or account_status is null;

alter table users
  alter column organization_id set not null,
  alter column platform_role set not null;

alter table users drop constraint if exists users_platform_role_check;
alter table users add constraint users_platform_role_check
  check (platform_role in ('CEO', 'MANAGER', 'TEAM_MEMBER'));

alter table users drop constraint if exists users_daily_capacity_minutes_check;
alter table users add constraint users_daily_capacity_minutes_check
  check (daily_capacity_minutes is null or daily_capacity_minutes between 0 and 1440);

alter table users drop constraint if exists users_account_status_check;
alter table users add constraint users_account_status_check
  check (account_status is null or account_status in ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'));

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  code text not null,
  type text not null default 'OTHER' check (type in ('DEVELOPMENT', 'MARKETING', 'SALES', 'OPERATIONS', 'OTHER')),
  lead_user_id uuid references users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

insert into departments (organization_id, name, code, type)
select organization_id, department_name,
       upper(regexp_replace(department_name, '[^a-zA-Z0-9]+', '_', 'g')),
       case lower(department_name)
         when 'engineering' then 'DEVELOPMENT'
         when 'development' then 'DEVELOPMENT'
         when 'marketing' then 'MARKETING'
         when 'sales' then 'SALES'
         when 'operations' then 'OPERATIONS'
         else 'OTHER'
       end
from (
  select distinct organization_id, coalesce(nullif(trim(department), ''), 'General') as department_name
  from users
) source
on conflict (organization_id, code) do nothing;

-- Ensure the core departments exist even when legacy rows do not mention them.
insert into departments (organization_id, name, code, type)
select organization.id, seed.name, seed.code, seed.type
from organizations organization
cross join (values
  ('Development', 'DEVELOPMENT', 'DEVELOPMENT'),
  ('Marketing', 'MARKETING', 'MARKETING'),
  ('Sales', 'SALES', 'SALES')
) as seed(name, code, type)
on conflict (organization_id, code) do nothing;

alter table users add column if not exists department_id uuid references departments(id) on delete set null;

update users
set department_id = department.id
from departments department
where department.organization_id = users.organization_id
  and department.code = upper(regexp_replace(coalesce(nullif(trim(users.department), ''), 'General'), '[^a-zA-Z0-9]+', '_', 'g'))
  and users.department_id is null;

alter table projects
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists department_id uuid references departments(id) on delete set null,
  add column if not exists source_idea_id uuid references ideas(id) on delete set null,
  add column if not exists slug text,
  add column if not exists objective text,
  add column if not exists expected_outcome text,
  add column if not exists success_criteria_json jsonb not null default '[]'::jsonb,
  add column if not exists project_type text,
  add column if not exists client_name text,
  add column if not exists health text not null default 'NOT_SET',
  add column if not exists target_date date,
  add column if not exists created_by uuid references users(id) on delete set null,
  add column if not exists archived_at timestamptz;

update projects
set organization_id = owner.organization_id,
    created_by = coalesce(created_by, owner_id),
    objective = coalesce(projects.objective, projects.description, projects.name),
    target_date = coalesce(target_date, deadline, estimated_completion_date),
    slug = coalesce(projects.slug, trim(both '-' from lower(regexp_replace(projects.name, '[^a-zA-Z0-9]+', '-', 'g'))))
from users owner
where projects.owner_id = owner.id
  and (projects.organization_id is null or projects.created_by is null or projects.objective is null or projects.target_date is null or projects.slug is null);

update projects
set department_id = department.id
from departments department
where department.organization_id = projects.organization_id
  and department.code = upper(regexp_replace(coalesce(nullif(trim(projects.department), ''), 'General'), '[^a-zA-Z0-9]+', '_', 'g'))
  and projects.department_id is null;

alter table projects alter column organization_id set not null;
alter table projects drop constraint if exists projects_health_check;
alter table projects add constraint projects_health_check
  check (health in ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'NOT_SET'));
create unique index if not exists idx_projects_org_slug on projects(organization_id, slug) where slug is not null;

alter table project_members
  add column if not exists project_role text,
  add column if not exists permissions_json jsonb not null default '{}'::jsonb,
  add column if not exists joined_at timestamptz not null default now();

update project_members membership
set project_role = coalesce(membership.project_role, case member.platform_role when 'MANAGER' then 'MANAGER' else 'CONTRIBUTOR' end),
    permissions_json = case
      when member.platform_role = 'MANAGER' and membership.permissions_json = '{}'::jsonb
        then '{"manageProject": true, "manageTasks": true}'::jsonb
      else membership.permissions_json
    end
from users member
where membership.user_id = member.id;

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  sequence int not null default 0,
  owner_user_id uuid references users(id) on delete set null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED')),
  start_date date,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid not null references milestones(id) on delete cascade,
  name text not null,
  description text,
  owner_user_id uuid references users(id) on delete set null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'ACTIVE', 'IN_REVIEW', 'COMPLETED', 'CANCELLED')),
  acceptance_criteria_json jsonb not null default '[]'::jsonb,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_tasks
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists milestone_id uuid references milestones(id) on delete set null,
  add column if not exists deliverable_id uuid references deliverables(id) on delete set null,
  add column if not exists parent_task_id uuid references project_tasks(id) on delete set null,
  add column if not exists department_type text,
  add column if not exists task_type text,
  add column if not exists reporter_user_id uuid references users(id) on delete set null,
  add column if not exists reviewer_user_id uuid references users(id) on delete set null,
  add column if not exists canonical_status text,
  add column if not exists blocked boolean not null default false,
  add column if not exists estimate_minutes int,
  add column if not exists remaining_estimate_minutes int,
  add column if not exists actual_minutes int,
  add column if not exists completion_note text,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists archived_at timestamptz;

update project_tasks task
set organization_id = project.organization_id,
    reporter_user_id = coalesce(task.reporter_user_id, task.created_by),
    canonical_status = case task.status
      when 'Pending' then 'BACKLOG'
      when 'In Progress' then 'IN_PROGRESS'
      when 'In Review' then 'IN_REVIEW'
      when 'Completed' then 'DONE'
      when 'Blocked' then 'IN_PROGRESS'
      else 'BACKLOG'
    end,
    blocked = task.blocked or task.status = 'Blocked'
from projects project
where task.project_id = project.id
  and (task.organization_id is null or task.canonical_status is null or task.reporter_user_id is null or task.status = 'Blocked');

alter table project_tasks drop constraint if exists project_tasks_canonical_status_check;
alter table project_tasks add constraint project_tasks_canonical_status_check
  check (canonical_status is null or canonical_status in ('BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED', 'DEFERRED'));

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  actor_user_id uuid references users(id) on delete set null,
  actor_type text not null check (actor_type in ('USER', 'AGENT', 'SYSTEM')),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  project_id uuid references projects(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  agent_run_id uuid references agent_runs(id) on delete set null
);

create or replace function prevent_activity_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'activity_events are append-only';
end;
$$;

drop trigger if exists activity_events_append_only on activity_events;
create trigger activity_events_append_only
before update or delete on activity_events
for each row execute function prevent_activity_event_mutation();

create index if not exists idx_departments_organization on departments(organization_id, active, name);
create index if not exists idx_users_org_role on users(organization_id, platform_role, account_status);
create index if not exists idx_users_department on users(department_id, manager_user_id);
create index if not exists idx_projects_org_health on projects(organization_id, health, archived);
create index if not exists idx_milestones_project on milestones(project_id, sequence);
create index if not exists idx_deliverables_milestone on deliverables(milestone_id, target_date);
create index if not exists idx_project_tasks_hierarchy on project_tasks(project_id, milestone_id, deliverable_id);
create index if not exists idx_activity_events_project on activity_events(project_id, created_at desc);
create index if not exists idx_activity_events_entity on activity_events(entity_type, entity_id, created_at desc);
create index if not exists idx_activity_events_organization on activity_events(organization_id, created_at desc);
