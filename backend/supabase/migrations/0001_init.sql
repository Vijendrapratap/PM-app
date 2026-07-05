-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Also run the storage bucket statement at the bottom.

create extension if not exists pgcrypto;

create type user_status as enum ('Active', 'Inactive');
create type user_availability as enum ('Available', 'Busy', 'On Leave');
create type project_status as enum ('Draft', 'Saved', 'Planning', 'In Progress', 'Review', 'Testing', 'Completed', 'Cancelled', 'On Hold');
create type project_priority as enum ('Low', 'Medium', 'High', 'Critical');

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text,
  role text not null,
  department text default 'General',
  phone text,
  skills text[] not null default '{}',
  status user_status not null default 'Active',
  availability user_availability not null default 'Available',
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category text,
  department text,
  status project_status not null default 'Draft',
  priority project_priority not null default 'Medium',
  start_date date,
  estimated_completion_date date,
  deadline date,
  budget numeric,
  owner_id uuid not null references users(id),
  tags text[] not null default '{}',
  progress int not null default 0,
  final_github text,
  final_google_drive text,
  final_live_website text,
  final_notes text,
  is_locked boolean not null default false,
  completion_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (project_id, user_id)
);

create table project_initial_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create table updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text not null,
  progress int not null,
  status text not null,
  comments text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table update_documents (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references updates(id) on delete cascade,
  name text not null,
  storage_path text not null
);

create table update_links (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references updates(id) on delete cascade,
  url text not null,
  label text
);

create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid not null references users(id),
  team_member_name text not null,
  role text not null,
  report_date date not null,
  work_date date not null,
  description text not null,
  document_url text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, work_date, member_id)
);

create table daily_report_documents (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references daily_reports(id) on delete cascade,
  name text not null,
  storage_path text not null
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  user_id uuid not null references users(id),
  project_id uuid references projects(id) on delete set null,
  details text not null,
  created_at timestamptz not null default now()
);

-- Kept for parity with pre-existing (unused-by-API) Mongoose models; not wired to any route.
create table project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id),
  comment text not null,
  attachment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references project_comments(id) on delete cascade,
  user_id uuid references users(id),
  comment text,
  created_at timestamptz not null default now()
);

create table project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  uploader_id uuid not null references users(id),
  name text not null,
  file_type text not null,
  storage_path text not null,
  size int,
  created_at timestamptz not null default now()
);

create table project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  added_by uuid not null references users(id),
  title text not null,
  url text not null,
  type text not null,
  created_at timestamptz not null default now()
);

create index idx_daily_reports_project on daily_reports(project_id);
create index idx_updates_project on updates(project_id);
create index idx_activity_logs_project on activity_logs(project_id);
create index idx_project_members_user on project_members(user_id);

-- Storage bucket for uploaded documents (project files, daily report attachments, etc.)
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', true)
on conflict (id) do nothing;
