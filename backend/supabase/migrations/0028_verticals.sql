-- Verticals: internal product brands plus client services. Projects belong to at most one.
create table if not exists verticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  code text not null,
  kind text not null check (kind in ('PRODUCT', 'CLIENT_SERVICES')),
  owner_user_id uuid references users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table projects add column if not exists vertical_id uuid references verticals(id) on delete set null;
create index if not exists idx_projects_vertical on projects(vertical_id);

-- Heads are matched by first name: emails differ between local and production.
-- Only assign a head when exactly one active CEO/MANAGER matches the first
-- name; an ambiguous or absent match leaves the vertical unassigned.
insert into verticals (organization_id, name, code, kind, owner_user_id)
select org.id, seed.name, seed.code, seed.kind,
  (select matched.id from (
    select u.id, count(*) over () as match_count
    from users u
    where u.organization_id = org.id and u.status = 'Active'
      and u.platform_role in ('CEO', 'MANAGER')
      and lower(split_part(trim(u.name), ' ', 1)) = seed.head
  ) matched where matched.match_count = 1)
from organizations org
cross join (values
  ('AptusHire', 'APTUSHIRE', 'PRODUCT', 'satyam'),
  ('FrontDesk', 'FRONTDESK', 'PRODUCT', 'govind'),
  ('MarketingHarness', 'MARKETINGHARNESS', 'PRODUCT', 'sankalp'),
  ('SmartHomes', 'SMARTHOMES', 'PRODUCT', 'anush'),
  ('Client Projects', 'CLIENT_PROJECTS', 'CLIENT_SERVICES', 'priyanshu')
) as seed(name, code, kind, head)
on conflict (organization_id, code) do nothing;

-- Backfill by exact project name; anything unmatched stays unassigned.
update projects p
set vertical_id = v.id
from (values
  ('AI Interviewer Platform', 'APTUSHIRE'),
  ('Niko Salon Chatbot', 'CLIENT_PROJECTS'),
  ('Vishvas Foundation', 'CLIENT_PROJECTS'),
  ('Real Estate Complete Module', 'CLIENT_PROJECTS'),
  ('Competitor Analysis (Resort)', 'CLIENT_PROJECTS'),
  ('Content Engine', 'MARKETINGHARNESS')
) as map(project_name, code)
join verticals v on v.code = map.code
where p.name = map.project_name and p.organization_id = v.organization_id and p.vertical_id is null;

-- Henry heads Sales (null until his account exists, or if the name is ambiguous).
update departments d
set lead_user_id = (select matched.id from (
    select u.id, count(*) over () as match_count
    from users u
    where u.organization_id = d.organization_id and u.status = 'Active'
      and u.platform_role in ('CEO', 'MANAGER')
      and lower(split_part(trim(u.name), ' ', 1)) = 'henry'
  ) matched where matched.match_count = 1)
where d.code = 'SALES' and d.lead_user_id is null;

notify pgrst, 'reload schema';
