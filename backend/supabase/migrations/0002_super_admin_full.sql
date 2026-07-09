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
