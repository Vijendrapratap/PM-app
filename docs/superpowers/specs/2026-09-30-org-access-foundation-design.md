# Org & Access Foundation (Verticals) — Design

Status: awaiting review · Date: 2026-09-30 · Sub-project 1 of 5

## 1. Why

Pratap AI runs internal product brands (verticals) and client work side by side. Goals, the PM agent and the co-founder agent all need to know which vertical a project belongs to and who heads it. The app has no verticals today, heads are not recorded, and "Lead" managers are blocked in parts of the UI.

### Sequence this unlocks

1. **Org & access foundation** (this spec)
2. Goals — company / vertical / personal (data model already agreed in chat)
3. PM agent for every team member
4. Sales and marketing pipelines (data the co-founder agent needs)
5. Co-founder agent for the CEO

### What the user decided

- Verticals are internal product brands plus Client Projects: **AptusHire, FrontDesk, MarketingHarness, SmartHomes, Client Projects**.
- Heads: SmartHomes — Anush, AptusHire — Satyam, FrontDesk — Govind, MarketingHarness — Sankalp, Client Projects — Priyanshu.
- Sales (head: Henry) and Intern (Disha) are **departments**, not verticals.
- Vertical heads **see everything, manage their own vertical**.
- Devesh, Saransh and Sunny are **deactivated** (kept for history).
- Agent model: `deepseek/deepseek-v4.1-flash` (done 2026-09-30, not part of this spec).

### Defaults to confirm at review

- New accounts: `sankalp@pratap.local`, `henry@pratap.local`. Replace with real emails.
- Satyam's designation becomes "Head of AptusHire"; his department stays whatever the CEO sets.
- Project → vertical backfill:

| Project | Vertical |
|---|---|
| AI Interviewer Platform | AptusHire |
| Niko Salon Chatbot | Client Projects |
| Vishvas Foundation | Client Projects |
| Real Estate Complete Module | Client Projects |
| Competitor Analysis (Resort) | Client Projects |
| Content Engine | MarketingHarness |
| Hermes + Obsidian Brain | unassigned |
| Standing ops projects | unassigned (by design) |

### Success criteria

1. The five verticals exist with the heads above. A project belongs to at most one vertical.
2. Every MANAGER can list and open every project, report and team work log in the organization.
3. A MANAGER can edit a project only if it is in a vertical they head, they own it, or they are a manager member of it. CEO can edit everything. Team members are unchanged.
4. Anush and Priyanshu (display role "Lead") get the same UI controls as Govind.
5. The project → policy resource mapping exists in exactly one place.

## 2. Data — migration `0028_verticals.sql`

```sql
create table verticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  code text not null,
  kind text not null check (kind in ('PRODUCT', 'CLIENT_SERVICES')),
  owner_user_id uuid references users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
alter table projects add column vertical_id uuid references verticals(id) on delete set null;
create index idx_projects_vertical on projects(vertical_id);
```

- Seed the five verticals for each organization. `owner_user_id` is looked up by email. When an account does not exist yet (Sankalp), the column stays null and the CEO sets it later.
- Backfill `projects.vertical_id` by exact project name, using the table above. Unmatched projects stay null.
- Henry becomes `lead_user_id` of the Sales department, by email lookup (null if absent).
- Idempotent: `if not exists` / `on conflict do nothing`, safe to re-run.

## 3. Access rule

One change in `backend/src/utils/roles.ts` and one in `backend/src/policies/accessPolicy.ts`:

- `canViewAllProjects(role)` returns true for CEO **and MANAGER**. It already drives project lists, reports, agent workflows and agent proposals, so every head sees everything.
- `ProjectPolicyResource` gains `verticalOwnerUserId: string | null`.
- `canManageProject` adds one allow rule for a MANAGER: `resource.verticalOwnerUserId === actor.id`. The existing rules (CEO, owner, manager membership) stay.
- `canViewProject` adds: MANAGER → true (same organization).

### One resource builder

The same object is built in `middleware/auth.ts`, `projectService.ts` (×2), `projectTaskService.ts` (×2), `taskWorkflowService.ts`, `hierarchyService.ts`, `blockerService.ts` and `projectLifecycleService.ts`. Replace all of them with `toPolicyResource(project)` in `accessPolicy.ts`. `PROJECT_SELECT` joins `vertical:vertical_id(id, name, owner_user_id)` so every caller gets the head.

## 4. API and UI

- `GET /api/verticals` (any signed-in user) lists verticals with their head.
- `PUT /api/verticals/:id` (CEO only) sets name, head and active.
- Project create/edit takes an optional `verticalId`. Only the CEO or that vertical's head may put a project in a vertical.
- The project list and project page show the vertical; the project list can be filtered by vertical.
- **Lead fix:** frontend `canApproveAgentWork`, and every manager check in `Projects.tsx`, `ProjectDetails.tsx`, `AgentWorkflowPanel.tsx`, `DailyPlanner.tsx`, `Sidebar.tsx` and `AgentStudio.tsx`, reads `platformRole` (CEO / MANAGER) instead of the display role. Button visibility is a hint only; the server stays the authority.

## 5. People changes (data, no code)

These go through the CEO's existing Team page (`/auth/register`, `/users/:id/deactivate`, profile edit) in production:

- Add Sankalp (MANAGER, head of MarketingHarness) and Henry (MANAGER, Sales).
- Deactivate Devesh, Saransh and Sunny.
- Set Satyam's designation.
- Then set the MarketingHarness head to Sankalp via `PUT /api/verticals/:id`.

The same steps are applied to the local database for testing.

## 6. Errors

- Assigning a project to a vertical you don't head: 403 "Only the CEO or the vertical head can move a project into this vertical".
- Unknown `verticalId`: 400.
- Deactivating a vertical's head leaves `owner_user_id` in place. The vertical shows "Head inactive" until the CEO reassigns it.

## 7. Testing

- `accessPolicy.test.ts`: the rule table (CEO / head of this vertical / head of another vertical / project owner / member / team member) × (view / manage).
- One integration test: Satyam lists all projects, can edit an AptusHire project, and gets 403 editing a FrontDesk project. Govind can edit it.
- Migration is rehearsed on a restored copy before production, as for 0026.

## 8. Out of scope

- Vertical-scoped goals (sub-project 2).
- Per-vertical dashboards. Filtering the project list is enough for now.
- Cleaning up integration-test projects in the local database. Tests should clean up after themselves; this is tracked separately.
