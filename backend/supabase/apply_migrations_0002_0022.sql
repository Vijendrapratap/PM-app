-- Existing database upgrade bundle.
-- Requires migration 0001 to have already created the base schema.
-- Generated from migrations 0002 through 0022; run this before seed_operations_studio.sql.

-- ===== 0002_super_admin_full.sql =====
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query),
-- the same way 0001_init.sql was run. Additive only - safe to run alongside existing data.

-- ── Users ────────────────────────────────────────────────────────────────
-- Soft delete: deleting a team member must not break the NOT NULL foreign
-- keys that historical rows (projects.owner_id, updates.created_by,
-- daily_reports.member_id, etc.) hold to users(id). The row stays so those
-- historical records keep resolving a name; deleted users are excluded from
-- active lists/pickers via `deleted_at is null`.
alter table users add column if not exists deleted_at timestamptz;
alter table users add column if not exists last_login_at timestamptz;

-- ── Important Messages ──────────────────────────────────────────────────
create table if not exists important_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  start_date date not null default current_date,
  expiry_date date not null,
  pinned boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Daily To-Do (personal planner, separate from project work) ─────────
create table if not exists daily_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  -- Preserved the first time a task carries forward; current `due_date` moves,
  -- `original_due_date` never changes again. See todoService for the lazy
  -- carry-forward pass (no cron - computed when the planner is read).
  original_due_date date,
  carry_forward_count int not null default 0,
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  status text not null check (status in ('Pending', 'In Progress', 'Completed', 'Blocked')) default 'Pending',
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists daily_todo_subtasks (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references daily_todos(id) on delete cascade,
  title text not null,
  status text not null check (status in ('Pending', 'In Progress', 'Completed', 'Blocked')) default 'Pending',
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  assigned_to uuid references users(id) on delete set null,
  due_date date,
  -- Single source of truth for "Today's To-Do": no separate row is created for
  -- the assignee's daily planner, it's just this flag on the subtask itself.
  add_to_today boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists daily_todo_documents (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references daily_todos(id) on delete cascade,
  name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists daily_todo_subtask_documents (
  id uuid primary key default gen_random_uuid(),
  subtask_id uuid not null references daily_todo_subtasks(id) on delete cascade,
  name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- ── Projects: archive + task/subtask system ─────────────────────────────
alter table projects add column if not exists archived boolean not null default false;

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  status text not null check (status in ('Pending', 'In Progress', 'Completed', 'Blocked')) default 'Pending',
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  title text not null,
  status text not null check (status in ('Pending', 'In Progress', 'Completed', 'Blocked')) default 'Pending',
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  assigned_to uuid references users(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_task_documents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists project_task_subtask_documents (
  id uuid primary key default gen_random_uuid(),
  subtask_id uuid not null references project_task_subtasks(id) on delete cascade,
  name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- ── Ideas (shared, visible to everyone) ─────────────────────────────────
create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- ── Notifications ────────────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  related_type text,
  related_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Makes the lazy "due soon" / "overdue" notification generators idempotent:
-- insert-on-conflict-do-nothing instead of a duplicate row on every read.
create unique index if not exists idx_notifications_dedupe
  on notifications(user_id, type, related_type, related_id)
  where related_id is not null;

-- ── Indexes ──────────────────────────────────────────────────────────────
create index if not exists idx_important_messages_active on important_messages(active, expiry_date);
create index if not exists idx_daily_todos_assigned_to on daily_todos(assigned_to);
create index if not exists idx_daily_todo_subtasks_todo on daily_todo_subtasks(todo_id);
create index if not exists idx_daily_todo_subtasks_assigned_to on daily_todo_subtasks(assigned_to);
create index if not exists idx_daily_todo_subtasks_today on daily_todo_subtasks(assigned_to, add_to_today) where add_to_today = true;
create index if not exists idx_project_tasks_project on project_tasks(project_id);
create index if not exists idx_project_tasks_assigned_to on project_tasks(assigned_to);
create index if not exists idx_project_task_subtasks_task on project_task_subtasks(task_id);
create index if not exists idx_project_task_subtasks_assigned_to on project_task_subtasks(assigned_to);
create index if not exists idx_notifications_user on notifications(user_id, read, created_at desc);


-- ===== 0003_idea_pipeline.sql =====
-- An idea should be easy to capture, but its decision should be visible to everyone.
alter table ideas
  add column if not exists status text not null default 'Inbox'
    check (status in ('Inbox', 'Evaluating', 'Planned', 'Building', 'Parked')),
  add column if not exists impact text not null default 'Medium'
    check (impact in ('Low', 'Medium', 'High')),
  add column if not exists effort text not null default 'Medium'
    check (effort in ('Small', 'Medium', 'Large')),
  add column if not exists category text;

create index if not exists idx_ideas_status_created_at on ideas(status, created_at desc);


-- ===== 0004_task_review_status.sql =====
-- Add a real review gate to both personal and project task workflows.
-- Constraint names are the PostgreSQL defaults created by 0002.
alter table daily_todos drop constraint if exists daily_todos_status_check;
alter table daily_todos add constraint daily_todos_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));

alter table daily_todo_subtasks drop constraint if exists daily_todo_subtasks_status_check;
alter table daily_todo_subtasks add constraint daily_todo_subtasks_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));

alter table project_tasks drop constraint if exists project_tasks_status_check;
alter table project_tasks add constraint project_tasks_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));

alter table project_task_subtasks drop constraint if exists project_task_subtasks_status_check;
alter table project_task_subtasks add constraint project_task_subtasks_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));


-- ===== 0005_project_demo_video.sql =====
-- Optional walkthrough/demo asset available throughout the project lifecycle.
alter table projects add column if not exists final_demo_video text;


-- ===== 0006_task_context.sql =====
-- Task-level context keeps blocker explanations and discussion with the work.
alter table project_tasks add column if not exists blocker_reason text;

create table if not exists project_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  author_id uuid not null references users(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_project_task_comments_task on project_task_comments(task_id, created_at);


-- ===== 0007_daily_workflow.sql =====
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


-- ===== 0008_agent_workflow.sql =====
-- Human-approved agent workflow: plan drafts, published features/tasks,
-- versioned project documents, and auditable agent runs.

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent_type text not null check (agent_type in ('Project Manager', 'Business Analyst')),
  status text not null check (status in ('Queued', 'Working', 'Ready for review', 'Approved', 'Changes requested', 'Failed')) default 'Queued',
  trigger_event text not null,
  provider text not null default 'Local structured provider',
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_by uuid not null references users(id),
  reviewed_by uuid references users(id),
  review_note text,
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_plan_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent_run_id uuid references agent_runs(id) on delete set null,
  version int not null,
  status text not null check (status in ('Draft', 'In review', 'Approved', 'Superseded')) default 'In review',
  content jsonb not null,
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version)
);

create table if not exists project_features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_plan_version_id uuid references project_plan_versions(id) on delete set null,
  source_key text not null,
  title text not null,
  outcome text not null,
  description text,
  acceptance_criteria text[] not null default '{}',
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  estimate_days numeric,
  confidence text check (confidence in ('Low', 'Medium', 'High')) default 'Medium',
  status text not null check (status in ('Planned', 'In Progress', 'In Review', 'Completed', 'Blocked', 'Deferred')) default 'Planned',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, source_plan_version_id, source_key)
);

alter table project_tasks add column if not exists feature_id uuid references project_features(id) on delete set null;
alter table project_tasks add column if not exists source_plan_version_id uuid references project_plan_versions(id) on delete set null;
alter table project_tasks add column if not exists agent_source_key text;
alter table project_tasks add column if not exists estimate_days numeric;
alter table project_tasks add column if not exists start_date date;
alter table project_tasks add column if not exists acceptance_criteria text[] not null default '{}';

create unique index if not exists idx_project_tasks_agent_source
  on project_tasks(source_plan_version_id, agent_source_key)
  where source_plan_version_id is not null and agent_source_key is not null;

create table if not exists project_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  document_type text not null,
  title text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, document_type)
);

create table if not exists project_knowledge_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references project_knowledge_documents(id) on delete cascade,
  agent_run_id uuid references agent_runs(id) on delete set null,
  version int not null,
  status text not null check (status in ('Draft', 'In review', 'Approved', 'Superseded')) default 'In review',
  content text not null,
  structured_content jsonb not null default '{}'::jsonb,
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, version)
);

create index if not exists idx_agent_runs_project on agent_runs(project_id, created_at desc);
create index if not exists idx_plan_versions_project on project_plan_versions(project_id, version desc);
create index if not exists idx_project_features_project on project_features(project_id, position);
create index if not exists idx_knowledge_documents_project on project_knowledge_documents(project_id);
create index if not exists idx_knowledge_versions_document on project_knowledge_document_versions(document_id, version desc);


-- ===== 0009_agent_definitions.sql =====
-- Versioned, human-managed system prompts for authorized agent operators.
create table if not exists agent_definitions (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique check (agent_key in ('project-manager', 'business-analyst')),
  name text not null,
  description text not null,
  system_prompt text not null,
  active boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_definition_id uuid not null references agent_definitions(id) on delete cascade,
  version int not null,
  system_prompt text not null,
  change_note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(agent_definition_id, version)
);

insert into agent_definitions (agent_key, name, description, system_prompt)
values
  ('project-manager', 'Project Manager Agent', 'Turns a project brief into reviewable features, tasks, estimates, risks and acceptance criteria.', 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Create outcome-based features and small executable tasks. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.'),
  ('business-analyst', 'Business Analyst Agent', 'Turns an approved delivery plan into versioned business requirements and project guidance.', 'You are a senior business analyst. Produce a concise, complete Business Requirements Document in Markdown. Base every requirement on the supplied project and approved plan. Do not invent facts; label uncertainty as an assumption or open question. Include project overview, goals, scope, exclusions, functional and non-functional requirements, acceptance criteria, dependencies, risks, open questions and approval status. Clearly label all output as an agent draft until Govind or Pratap approves it.')
on conflict (agent_key) do nothing;

create index if not exists idx_agent_prompt_versions_definition on agent_prompt_versions(agent_definition_id, version desc);


-- ===== 0010_operations_foundation.sql =====
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


-- ===== 0011_today_workflow.sql =====
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


-- ===== 0012_project_execution.sql =====
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


-- ===== 0013_team_onboarding.sql =====
-- Team invitation and first-login onboarding preferences.

alter table users
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists typical_work_start time,
  add column if not exists typical_work_end time,
  add column if not exists notification_preferences_json jsonb not null default '{"digest": true, "immediateCritical": true}'::jsonb;

create index if not exists idx_users_onboarding on users(organization_id, account_status, onboarding_completed_at);


-- ===== 0014_idea_bucket.sql =====
-- Phase 5: expand the existing lightweight idea pipeline without losing legacy rows.
alter table ideas drop constraint if exists ideas_status_check;

update ideas set status = case status
  when 'Inbox' then 'INBOX'
  when 'Evaluating' then 'UNDER_REVIEW'
  when 'Planned' then 'APPROVED'
  when 'Building' then 'CONVERTED_TO_PROJECT'
  when 'Parked' then 'INCUBATING'
  else upper(replace(status, ' ', '_')) end;

alter table ideas
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists department_id uuid references departments(id),
  add column if not exists submitted_by uuid references users(id),
  add column if not exists owner_user_id uuid references users(id),
  add column if not exists problem text,
  add column if not exists proposed_solution text,
  add column if not exists beneficiary text,
  add column if not exists expected_value text,
  add column if not exists business_value_score integer,
  add column if not exists strategic_alignment_score integer,
  add column if not exists urgency_score integer,
  add column if not exists delivery_effort_score integer,
  add column if not exists priority_score integer,
  add column if not exists ai_refinement_json jsonb,
  add column if not exists converted_project_id uuid references projects(id),
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update ideas i set
  organization_id = coalesce(i.organization_id, u.organization_id),
  submitted_by = coalesce(i.submitted_by, i.created_by),
  problem = coalesce(i.problem, i.description)
from users u where u.id = i.created_by;

alter table ideas add constraint ideas_status_check check (status in (
  'INBOX','NEEDS_CLARIFICATION','UNDER_REVIEW','VALIDATING','APPROVED',
  'INCUBATING','CONVERTED_TO_PROJECT','ARCHIVED','REJECTED'
));
alter table ideas drop constraint if exists ideas_score_range_check;
alter table ideas add constraint ideas_score_range_check check (
  (business_value_score is null or business_value_score between 1 and 5) and
  (strategic_alignment_score is null or strategic_alignment_score between 1 and 5) and
  (urgency_score is null or urgency_score between 1 and 5) and
  (delivery_effort_score is null or delivery_effort_score between 1 and 5)
);

create table if not exists idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  author_user_id uuid not null references users(id),
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ideas_org_status on ideas(organization_id, status, created_at desc) where archived_at is null;
create index if not exists idx_idea_comments_idea on idea_comments(idea_id, created_at);


-- ===== 0015_agent_proposals.sql =====
-- Phase 6: permission-aware, reviewable and idempotent agent proposals.
alter table agent_runs drop constraint if exists agent_runs_agent_type_check;
alter table agent_runs add constraint agent_runs_agent_type_check check (agent_type in ('Project Manager', 'Business Analyst', 'Case Study', 'Daily Summary'));
alter table agent_runs
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists context_refs_json jsonb not null default '[]'::jsonb,
  add column if not exists model text,
  add column if not exists token_cost_json jsonb,
  add column if not exists retry_count integer not null default 0;

update agent_runs r set organization_id = p.organization_id from projects p where p.id = r.project_id and r.organization_id is null;

create table if not exists agent_proposals (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  organization_id uuid references organizations(id),
  project_id uuid references projects(id) on delete cascade,
  proposal_type text not null,
  summary text not null,
  assumptions_json jsonb not null default '[]'::jsonb,
  actions_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','APPLYING','APPLIED','REJECTED','FAILED')),
  idempotency_key text not null,
  approved_by uuid references users(id),
  applied_actions_json jsonb,
  decision_note text,
  error text,
  applied_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, idempotency_key)
);
create index if not exists idx_agent_proposals_project_status on agent_proposals(project_id, status, created_at desc);


-- ===== 0016_project_knowledge.sql =====
-- Phase 7: source-grounded, classifiable project knowledge versions.
alter table project_knowledge_documents
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists archived_at timestamptz;
alter table project_knowledge_document_versions
  add column if not exists sources_json jsonb not null default '[]'::jsonb,
  add column if not exists missing_information_json jsonb not null default '[]'::jsonb,
  add column if not exists generated_by_agent boolean not null default false;
update project_knowledge_documents d set organization_id = p.organization_id from projects p where p.id = d.project_id and d.organization_id is null;
create index if not exists idx_knowledge_docs_org_project on project_knowledge_documents(organization_id, project_id) where archived_at is null;


-- ===== 0017_case_studies.sql =====
-- Phase 8: project closure outputs with explicit source and publication control.
create table if not exists case_studies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  project_id uuid not null references projects(id) on delete cascade,
  internal_retrospective_content text not null,
  external_case_study_content text not null,
  demo_package_content text not null,
  confidentiality_flags_json jsonb not null default '[]'::jsonb,
  metrics_sources_json jsonb not null default '[]'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','APPROVED','ARCHIVED')),
  created_by_agent_run_id uuid references agent_runs(id) on delete set null,
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id)
);
create index if not exists idx_case_studies_org_status on case_studies(organization_id, status, created_at desc);


-- ===== 0018_agent_prompt_storage_repair.sql =====
-- Compatibility repair for environments created before prompt versioning was enabled.
create table if not exists agent_definitions (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique check (agent_key in ('project-manager', 'business-analyst')),
  name text not null,
  description text not null,
  system_prompt text not null,
  active boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_definition_id uuid not null references agent_definitions(id) on delete cascade,
  version int not null,
  system_prompt text not null,
  change_note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(agent_definition_id, version)
);

insert into agent_definitions (agent_key, name, description, system_prompt)
values
  ('project-manager', 'Project Manager Agent', 'Turns a project brief into reviewable milestones, features, tasks, estimates, risks and acceptance criteria.', 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Organize the plan as project, milestones, outcome-based features, and small executable tasks. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.'),
  ('business-analyst', 'Business Analyst Agent', 'Turns an approved delivery plan into versioned business requirements and project guidance.', 'You are a senior business analyst. Produce a concise, complete Business Requirements Document in Markdown. Base every requirement on the supplied project and approved plan. Do not invent facts; label uncertainty as an assumption or open question. Include project overview, goals, scope, exclusions, functional and non-functional requirements, acceptance criteria, dependencies, risks, open questions and approval status. Clearly label all output as an agent draft until an authorized human approves it.')
on conflict (agent_key) do nothing;

create index if not exists idx_agent_prompt_versions_definition on agent_prompt_versions(agent_definition_id, version desc);


-- ===== 0019_personal_work_routines.sql =====
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


-- ===== 0020_project_module_terminology.sql =====
-- Keep the established feature-shaped JSON contract for backward compatibility,
-- while teaching the user-facing PM agent to produce Milestone -> Module -> Task.
update public.agent_definitions
set
  description = 'Turns a project brief into reviewable milestones, modules, tasks, estimates, risks and acceptance criteria.',
  system_prompt = 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Organize the plan as project, milestones, outcome-based modules, and small executable tasks. Return modules in the features field required by the application schema. Each module must belong to one milestone. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.',
  updated_at = timezone('utc', now())
where agent_key = 'project-manager';


-- ===== 0021_users_account_status_schema_cache.sql =====
-- Repair databases where the Operations Studio user migration was applied
-- incompletely, then make PostgREST see the repaired schema immediately.

alter table public.users
  add column if not exists account_status text;

update public.users
set account_status = case status::text
  when 'Active' then 'ACTIVE'
  else 'INACTIVE'
end
where account_status is null;

alter table public.users drop constraint if exists users_account_status_check;
alter table public.users add constraint users_account_status_check
  check (account_status in ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'));

notify pgrst, 'reload schema';


-- ===== 0022_backfill_project_daily_reports.sql =====
-- Publish existing closed workdays into each project represented in the day.
-- Future closeouts are written by workdayService; this only repairs history.

insert into public.daily_reports (
  project_id, member_id, team_member_name, role, report_date, work_date,
  description, created_by, created_at, updated_at
)
select
  item.project_id,
  workday.user_id,
  member.name,
  member.role,
  workday.work_date,
  workday.work_date,
  concat_ws(E'\n\n',
    nullif(trim(workday.completed_summary), ''),
    'Project work:' || E'\n' || string_agg(
      '- ' || item.title || ': ' || item.status
      || case when nullif(trim(item.progress_note), '') is null then '' else ' - ' || trim(item.progress_note) end
      || case when nullif(trim(item.blocker_reason), '') is null then '' else ' (Blocker: ' || trim(item.blocker_reason) || ')' end,
      E'\n' order by item.order_index, item.created_at
    ),
    case when nullif(trim(workday.blockers), '') is null then null else 'Blockers: ' || trim(workday.blockers) end,
    case when nullif(trim(workday.remarks), '') is null then null else 'Remarks: ' || trim(workday.remarks) end
  ),
  workday.user_id,
  coalesce(workday.closed_at, workday.check_out_at, workday.updated_at, workday.created_at),
  coalesce(workday.closed_at, workday.check_out_at, workday.updated_at, workday.created_at)
from public.workdays workday
join public.workday_items item on item.workday_id = workday.id
join public.users member on member.id = workday.user_id
where workday.status = 'Completed'
  and item.project_id is not null
group by
  item.project_id, workday.user_id, member.name, member.role, workday.work_date,
  workday.completed_summary, workday.blockers, workday.remarks, workday.closed_at,
  workday.check_out_at, workday.updated_at, workday.created_at
on conflict (project_id, work_date, member_id) do nothing;

notify pgrst, 'reload schema';

