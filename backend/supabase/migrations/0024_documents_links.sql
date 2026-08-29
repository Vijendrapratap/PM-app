-- Organization-scoped project links with relational document metadata.
create table if not exists document_link_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  serial_number bigint generated always as identity,
  project_name text not null check (length(trim(project_name)) > 0),
  live_link text not null check (live_link ~* '^https?://'),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_link_project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references document_link_projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  file_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_link_projects_org
  on document_link_projects(organization_id, serial_number);
create index if not exists idx_document_link_documents_project
  on document_link_project_documents(project_id, created_at);
