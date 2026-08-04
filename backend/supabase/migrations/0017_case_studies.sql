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
