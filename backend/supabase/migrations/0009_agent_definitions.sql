-- Versioned, human-managed system prompts for authorized agent operators.
create table if not exists agent_definitions (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique check (agent_key in ('project-manager', 'business-analyst')),
  name text not null,
  description text not null,
  system_prompt text not null,
  active boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_definition_id uuid not null references agent_definitions(id) on delete cascade,
  version int not null,
  system_prompt text not null,
  change_note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(agent_definition_id, version)
);

insert into agent_definitions (agent_key, name, description, system_prompt)
values
  ('project-manager', 'Project Manager Agent', 'Turns a project brief into reviewable features, tasks, estimates, risks and acceptance criteria.', 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Create outcome-based features and small executable tasks. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.'),
  ('business-analyst', 'Business Analyst Agent', 'Turns an approved delivery plan into versioned business requirements and project guidance.', 'You are a senior business analyst. Produce a concise, complete Business Requirements Document in Markdown. Base every requirement on the supplied project and approved plan. Do not invent facts; label uncertainty as an assumption or open question. Include project overview, goals, scope, exclusions, functional and non-functional requirements, acceptance criteria, dependencies, risks, open questions and approval status. Clearly label all output as an agent draft until Govind or Pratap approves it.')
on conflict (agent_key) do nothing;

create index if not exists idx_agent_prompt_versions_definition on agent_prompt_versions(agent_definition_id, version desc);
