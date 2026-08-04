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
