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
