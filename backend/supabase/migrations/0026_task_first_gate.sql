-- Task-first gate: lifecycle kind, standing ops projects, task-required work
-- logs, daily commitments, per-organization limits and daily signals.

-- Projects -----------------------------------------------------------------
alter table projects add column if not exists kind text not null default 'DELIVERY';
do $$ begin
  alter table projects add constraint projects_kind_check check (kind in ('DELIVERY', 'STANDING'));
exception when duplicate_object then null; end $$;

-- canonical_status was only backfilled once (0012) and nothing wrote it
-- afterwards, so it is null or stale. Resync every delivery project from the
-- legacy status with 0012's mapping. Archived projects keep the mapped stage
-- (archiving is the separate `archived` flag, not the ARCHIVED stage).
update projects set canonical_status = case status::text
  when 'Draft' then 'DRAFT' when 'Saved' then 'DRAFT'
  when 'Planning' then 'PLANNING'
  when 'In Progress' then 'ACTIVE' when 'Review' then 'ACTIVE' when 'Testing' then 'ACTIVE'
  when 'Completed' then 'COMPLETED' when 'Cancelled' then 'CANCELLED' when 'On Hold' then 'ON_HOLD'
  else 'DRAFT' end
where kind = 'DELIVERY';
alter table projects alter column canonical_status set default 'DRAFT';

-- Standing ops projects: one per active department, owned by its lead (or
-- the first CEO), plus one Founder Office owned by the first CEO.
--
-- Wrapped in a function (rather than run inline) because `supabase db
-- reset` applies migrations BEFORE supabase/seed_operations_studio.sql: on
-- a fresh local DB there are no departments/users yet when this migration
-- runs, so nothing would be created. The seed file calls this function
-- again after seeding departments/users. Idempotent via `on conflict`.
create or replace function ensure_standing_projects() returns void as $$
begin
  insert into projects (name, description, objective, status, canonical_status, kind, priority,
                        owner_id, created_by, organization_id, department, department_id)
  select d.name || ' Ops',
         'Standing project for ongoing ' || d.name || ' work that is not part of a delivery project.',
         'Keep ongoing ' || d.name || ' work visible as tasks.',
         'In Progress', 'ACTIVE', 'STANDING', 'Medium', owner.id, owner.id, d.organization_id, d.name, d.id
  from departments d
  cross join lateral (
    select coalesce(d.lead_user_id, (
      select u.id from users u
      where u.organization_id = d.organization_id and u.platform_role = 'CEO'
      order by u.created_at limit 1)) as id
  ) owner
  where d.active and owner.id is not null
  on conflict (name) do nothing;

  insert into projects (name, description, objective, status, canonical_status, kind, priority,
                        owner_id, created_by, organization_id)
  select 'Founder Office', 'Standing project for founder work: fundraising, hiring, partnerships, admin.',
         'Keep founder work visible and prioritised.', 'In Progress', 'ACTIVE', 'STANDING', 'High',
         ceo.id, ceo.id, ceo.organization_id
  from (select id, organization_id from users
        where platform_role = 'CEO' and organization_id is not null
        order by created_at limit 1) ceo
  on conflict (name) do nothing;

  -- Department members see their ops project; CEOs see Founder Office.
  insert into project_members (project_id, user_id)
  select p.id, u.id from projects p join users u on u.department_id = p.department_id
  where p.kind = 'STANDING' and p.department_id is not null
  on conflict do nothing;
  insert into project_members (project_id, user_id)
  select p.id, u.id from projects p join users u on u.organization_id = p.organization_id and u.platform_role = 'CEO'
  where p.kind = 'STANDING' and p.name = 'Founder Office'
  on conflict do nothing;
end;
$$ language plpgsql;

select ensure_standing_projects();

-- Work logs ----------------------------------------------------------------
alter table work_logs add column if not exists minutes int;
do $$ begin
  alter table work_logs add constraint work_logs_minutes_check check (minutes is null or minutes between 1 and 720);
exception when duplicate_object then null; end $$;
-- NOT VALID: historic free-text logs stay; every new log needs a task.
do $$ begin
  alter table work_logs add constraint work_logs_task_required check (task_id is not null) not valid;
exception when duplicate_object then null; end $$;

-- Tasks --------------------------------------------------------------------
alter table project_tasks add column if not exists carry_forward_count int not null default 0;

-- Daily commitments --------------------------------------------------------
create table if not exists daily_work_commitments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_work_sessions(id) on delete cascade,
  task_id uuid not null references project_tasks(id) on delete cascade,
  position int not null check (position between 1 and 10),
  outcome text check (outcome in ('DONE', 'CARRIED', 'BLOCKED')),
  carry_reason text,
  created_at timestamptz not null default now(),
  unique (session_id, task_id),
  unique (session_id, position)
);
create index if not exists idx_daily_work_commitments_task on daily_work_commitments(task_id);

-- Limits -------------------------------------------------------------------
create table if not exists org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  max_active_projects_per_owner int not null default 2 check (max_active_projects_per_owner >= 1),
  max_active_projects_org int not null default 6 check (max_active_projects_org >= 1),
  max_in_progress_per_person int not null default 2 check (max_in_progress_per_person >= 1),
  max_daily_commitments int not null default 3 check (max_daily_commitments between 1 and 10),
  stale_project_days int not null default 5 check (stale_project_days >= 1),
  stale_task_days int not null default 3 check (stale_task_days >= 1),
  updated_at timestamptz not null default now()
);
insert into org_settings (organization_id) select id from organizations on conflict do nothing;

-- Signals ------------------------------------------------------------------
create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('STALE_PROJECT', 'STALE_TASK', 'UNASSIGNED_READY_TASK', 'OVERDUE_PROJECT', 'REPEATED_CARRY')),
  subject_type text not null check (subject_type in ('PROJECT', 'TASK')),
  subject_id uuid not null,
  project_id uuid references projects(id) on delete cascade,
  signal_date date not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, kind, subject_id, signal_date)
);
create index if not exists idx_signals_open on signals(organization_id, signal_date desc) where resolved_at is null;

notify pgrst, 'reload schema';
