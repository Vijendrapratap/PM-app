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
