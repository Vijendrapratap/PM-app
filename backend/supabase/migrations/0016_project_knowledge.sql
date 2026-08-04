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
