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
