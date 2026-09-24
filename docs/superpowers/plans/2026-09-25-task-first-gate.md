# Task-First Gate (Plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the task-first workflow (project lifecycle with brief + caps, daily commitments, every work log tied to a task, WIP limit, review-only completion, daily signals) on top of the existing `project_tasks` model, without breaking the current UI.

**Architecture:** All rules live in one pure, unit-tested module (`policies/workGatePolicy.ts`). Services (`projectLifecycleService`, `dailyWorkService`, `projectTaskService`) load facts through a focused `workGateRepository`, ask the policy, then write. A migration adds the new columns and tables and seeds standing ops projects. The existing 60-second interval drives a daily signals job. The My Day page gains commitments, a task picker and quick-add.

**Tech Stack:** Express 5 + TypeScript (ts-node/tsx), Supabase Postgres via `@supabase/supabase-js`, zod validators, `node:test`, React 19 + Vite.

**Spec:** `docs/superpowers/specs/2026-09-25-task-first-consolidation-design.md`

**Split from the spec:** this plan implements spec §4 (Phase 1) plus the §3.5 fixes it depends on. Spec §3.1–3.4 (moving `daily_todos`, `workday_items`, deliverables/features and `document_link_projects` into the single model), §5 (new navigation) and migrations 0027/0028 are **Plan 2**. They have to ship with the UI that replaces the old screens; otherwise the old screens would write to tables that were already migrated.

**Two deliberate deviations from the spec (reported to the user):**

1. **Task status changes stay allowed on `PUT`.** The kanban drag (`ProjectTaskList.tsx:259`) and the checkboxes depend on them. What the spec actually wanted closed was the review bypass. So in this plan, `PUT` may move a task to any stage **except DONE**, which requires project-manage rights. Moving to IN_PROGRESS is subject to the WIP limit.
2. **BACKLOG counts as startable/committable along with READY and IN_PROGRESS.** Today `pause` maps to `Pending` → BACKLOG, so most live tasks are BACKLOG. Plan 2 introduces a real READY step.

## Global Constraints

- Default limits, in `org_settings` per organization:

  | Setting | Default |
  |---|---|
  | `max_active_projects_per_owner` | 2 |
  | `max_active_projects_org` | 6 |
  | `max_in_progress_per_person` | 2 |
  | `max_daily_commitments` | 3 |
  | `stale_project_days` | 5 |
  | `stale_task_days` | 3 |

- Project lifecycle uses `projects.canonical_status`: DRAFT (Proposed), PLANNING (Ready), ACTIVE, ON_HOLD (Parked), COMPLETED (Delivered), CANCELLED, ARCHIVED. `projects.kind` is DELIVERY or STANDING. STANDING projects are always ACTIVE, skip the lifecycle and don't count toward caps.
- Brief complete means:
  - non-empty `objective`
  - at least 1 entry in `success_criteria_json`
  - `owner_id` set
  - `target_date` set
  - at least 1 milestone
  - at least 1 non-cancelled task
  - every non-cancelled task has `assigned_to` and `estimate_minutes`
- Quick-add creates a task with a 60-minute estimate, assigned to the actor, with `agent_source_key` = null and `source = 'QUICK_ADD'` recorded in the activity payload.
- Carry reason is required when the task's previous `carry_forward_count` ≥ 2 (existing `requiresCarryoverReason` in `utils/dailyPlanRules.ts`).
- CEO means `isSuperAdmin(actor.role)`. PM/Lead authority on a project means `canManageProject(actor, resource)` from `policies/accessPolicy.ts`.
- Keep the existing code style: one-line arrow helpers, `badRequest`/`forbidden`/`notFound` from `utils/httpError.ts`, and a `HttpError(409, …)` for limit conflicts.
- Git identity: `Vijendrapratap <44225657+Vijendrapratap@users.noreply.github.com>`. Work on a feature branch, not `main`.

## Review Focus

1. **A task is cancelled or completed while it's still in someone's commitments.** Logging against it must fail with a clear 400 ("This task is closed"), and end-of-day must still accept an outcome for it. The Task 2 policy test covers the log side; the Task 8 integration test covers end-of-day.
2. **Projects are already over the cap on release day.** Existing ACTIVE projects keep working: logging continues, and parking works. Only *new* activations are blocked. Caps must exclude the project being transitioned. Covered by a Task 2 policy test.
3. **A user with no department uses quick-add without choosing a project.** They must get a 400 "Choose a project for this task", not a 500 or a task in a random project. Covered by the Task 8 integration test.
4. **The Edit Project modal still sends a legacy `status` on every save.** Saving without changing the status must not trigger a transition. Choosing "Completed" must return 400 "Use Finish project". Covered by the Task 3 unit test on `stageForLegacyStatus` and by the Task 8 integration test.
5. **A task that has logged work gets deleted.** `work_logs` is immutable, so the foreign key's `set null` fails. The user must get a 400 "This task has logged work; cancel it instead", not a 500. Covered by the Task 8 integration test.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/supabase/migrations/00211_users_account_status_schema_cache.sql`, `00221_productive_workday_time.sql` (renamed) | unique migration versions |
| `backend/supabase/migrations/0026_task_first_gate.sql` (new) | `projects.kind`, canonical backfill, standing ops projects, `work_logs.minutes` + task-required constraint, `project_tasks.carry_forward_count`, `daily_work_commitments`, `org_settings`, `signals` |
| `backend/src/policies/workGatePolicy.ts` (+ `.test.ts`) (new) | every rule as a pure function |
| `backend/src/repositories/workGateRepository.ts` (new) | the queries the gates need: limits, counts, brief facts, collaborators, ops project, commitments, signals |
| `backend/src/services/projectLifecycleService.ts` (new) | `transition()`: load facts → policy → write both status columns → activity |
| `backend/src/services/projectService.ts`, `mappers.ts`, `agentWorkflowService.ts`, `repositories/projectRepository.ts` (modify) | create → DRAFT; legacy status edits routed through the lifecycle; plan approval no longer sets 'Planning'; finish sets COMPLETED; DTO exposes `stage`/`kind` |
| `backend/src/services/projectTaskService.ts`, `controllers/projectTaskController.ts` (modify) | WIP limit, DONE-only-by-manager on PUT, delete guard |
| `backend/src/services/dailyWorkService.ts`, `controllers/dailyWorkController.ts`, `utils/validators.ts`, `types/models.ts` (modify) | commitments, task-required logs, quick-add, outcomes, CEO fix |
| `backend/src/jobs/dailySignals.ts` (+ `.test.ts`) (new), `backend/src/server.ts` (modify) | daily signal detection and delivery |
| `backend/src/integration/workGates.integration.ts`, `backend/scripts/run-integration-tests.js` (new), `backend/package.json` (modify) | end-to-end API checks against local Supabase |
| `frontend/src/api/dailyWorkApi.ts`, `frontend/src/pages/DailyWorkday.tsx`, `frontend/src/types/index.ts` (modify) | commitments, task picker, quick-add, end-of-day outcomes |

---

### Task 0: Branch and unique migration versions

**Files:**
- Rename: `backend/supabase/migrations/0021_users_account_status_schema_cache.sql` → `00211_users_account_status_schema_cache.sql`
- Rename: `backend/supabase/migrations/0022_productive_workday_time.sql` → `00221_productive_workday_time.sql`
- Modify: `docs/HOSTINGER_VPS_DEPLOYMENT.md` (append a section)

**Interfaces:** Produces a repo from which `supabase start` / `supabase db reset` works on a fresh database.

- [ ] **Step 1: Create the branch from `main`**

```bash
cd /home/pratap/work/PM_Pratap_AI/PM-app
git switch main && git switch -c feat/task-first-gate
git config user.name "Vijendrapratap" && git config user.email "44225657+Vijendrapratap@users.noreply.github.com"
git checkout spec/task-first-consolidation -- docs/superpowers
```

- [ ] **Step 2: Reproduce the failure**

Run: `cd backend && supabase db reset 2>&1 | tail -3`
Expected: `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"` … `Key (version)=(0021) already exists.`

(If Supabase isn't running: `supabase start --ignore-health-check` first. Storage is slow to become healthy on WSL.)

- [ ] **Step 3: Rename**

```bash
git mv supabase/migrations/0021_users_account_status_schema_cache.sql supabase/migrations/00211_users_account_status_schema_cache.sql
git mv supabase/migrations/0022_productive_workday_time.sql supabase/migrations/00221_productive_workday_time.sql
```

Each pair is independent (account_status vs. estimate columns; productive_minutes vs. report backfill), so the new sort order (`00211` before `0021_`, `00221` before `0022_`) is safe.

- [ ] **Step 4: Verify**

Run: `supabase db reset 2>&1 | grep -E "Applying migration 002|ERROR|Finished"`
Expected: `00211_…`, `0021_expected_task_time`, `00221_…`, `0022_backfill…`, 0023–0025 applied, no ERROR.

- [ ] **Step 5: Document the hosted-database repair**

Append to `docs/HOSTINGER_VPS_DEPLOYMENT.md`:

```markdown
## Migration version repair (one time, 2026-09)

Two migrations were renamed so every version is unique:
`0021_users_account_status_schema_cache.sql` → `00211_…` and
`0022_productive_workday_time.sql` → `00221_…`.
On a hosted database that already applied them, record the new versions once:

    supabase migration repair --status applied 00211 00221

Do not re-run the SQL; both files are idempotent anyway.
```

- [ ] **Step 6: Commit**

```bash
git add -A supabase/migrations docs
git commit -m "fix(db): give duplicate migration versions unique numbers"
```

---

### Task 1: Migration 0026 — task-first foundation

**Files:**
- Create: `backend/supabase/migrations/0026_task_first_gate.sql`

**Interfaces:** Produces these tables and columns, used by every later task:
- `projects.kind`: `'DELIVERY' | 'STANDING'`. `projects.canonical_status` is never null for existing rows and defaults to `'DRAFT'`.
- `work_logs.minutes int null`. Constraint `work_logs_task_required` (NOT VALID) and `work_logs_minutes_check`.
- `project_tasks.carry_forward_count int not null default 0`.
- `daily_work_commitments(id, session_id, task_id, position, outcome, carry_reason, created_at)`.
- `org_settings(organization_id pk, max_active_projects_per_owner, max_active_projects_org, max_in_progress_per_person, max_daily_commitments, stale_project_days, stale_task_days, updated_at)`.
- `signals(id, organization_id, kind, subject_type, subject_id, project_id, signal_date, details, resolved_at, created_at)` with a unique key on `(organization_id, kind, subject_id, signal_date)`.
- Standing projects named `<Department name> Ops` and `Founder Office`.

- [ ] **Step 1: Write the migration**

```sql
-- Task-first gate: lifecycle kind, standing ops projects, task-required work
-- logs, daily commitments, per-organization limits and daily signals.

-- Projects -----------------------------------------------------------------
alter table projects add column if not exists kind text not null default 'DELIVERY';
do $$ begin
  alter table projects add constraint projects_kind_check check (kind in ('DELIVERY', 'STANDING'));
exception when duplicate_object then null; end $$;

-- canonical_status was only backfilled once (0012); projects created since
-- then have null. Map them the same way 0012 did.
update projects set canonical_status = case status::text
  when 'Draft' then 'DRAFT' when 'Saved' then 'DRAFT'
  when 'Planning' then 'PLANNING'
  when 'In Progress' then 'ACTIVE' when 'Review' then 'ACTIVE' when 'Testing' then 'ACTIVE'
  when 'Completed' then 'COMPLETED' when 'Cancelled' then 'CANCELLED' when 'On Hold' then 'ON_HOLD'
  else 'DRAFT' end
where canonical_status is null;
alter table projects alter column canonical_status set default 'DRAFT';

-- Standing ops projects: one per active department, owned by its lead (or
-- the first CEO), plus one Founder Office owned by the first CEO.
insert into projects (name, description, objective, status, canonical_status, kind, priority,
                      owner_id, created_by, organization_id, department, department_id)
select d.name || ' Ops',
       'Standing project for ongoing ' || d.name || ' work that is not part of a delivery project.',
       'Keep ongoing ' || d.name || ' work visible as tasks.',
       'In Progress', 'ACTIVE', 'STANDING', 'Medium', owner.id, owner.id, d.organization_id, d.name, d.id
from departments d
cross join lateral (
  select coalesce(d.lead_user_id, (
    select u.id from users u
    where u.organization_id = d.organization_id and u.platform_role = 'CEO'
    order by u.created_at limit 1)) as id
) owner
where d.active and owner.id is not null
on conflict (name) do nothing;

insert into projects (name, description, objective, status, canonical_status, kind, priority,
                      owner_id, created_by, organization_id)
select 'Founder Office', 'Standing project for founder work: fundraising, hiring, partnerships, admin.',
       'Keep founder work visible and prioritised.', 'In Progress', 'ACTIVE', 'STANDING', 'High',
       ceo.id, ceo.id, ceo.organization_id
from (select id, organization_id from users
      where platform_role = 'CEO' and organization_id is not null
      order by created_at limit 1) ceo
on conflict (name) do nothing;

-- Department members see their ops project; CEOs see Founder Office.
insert into project_members (project_id, user_id)
select p.id, u.id from projects p join users u on u.department_id = p.department_id
where p.kind = 'STANDING' and p.department_id is not null
on conflict do nothing;
insert into project_members (project_id, user_id)
select p.id, u.id from projects p join users u on u.organization_id = p.organization_id and u.platform_role = 'CEO'
where p.kind = 'STANDING' and p.name = 'Founder Office'
on conflict do nothing;

-- Work logs ----------------------------------------------------------------
alter table work_logs add column if not exists minutes int;
do $$ begin
  alter table work_logs add constraint work_logs_minutes_check check (minutes is null or minutes between 1 and 720);
exception when duplicate_object then null; end $$;
-- NOT VALID: historic free-text logs stay; every new log needs a task.
do $$ begin
  alter table work_logs add constraint work_logs_task_required check (task_id is not null) not valid;
exception when duplicate_object then null; end $$;

-- Tasks --------------------------------------------------------------------
alter table project_tasks add column if not exists carry_forward_count int not null default 0;

-- Daily commitments --------------------------------------------------------
create table if not exists daily_work_commitments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_work_sessions(id) on delete cascade,
  task_id uuid not null references project_tasks(id) on delete cascade,
  position int not null check (position between 1 and 10),
  outcome text check (outcome in ('DONE', 'CARRIED', 'BLOCKED')),
  carry_reason text,
  created_at timestamptz not null default now(),
  unique (session_id, task_id),
  unique (session_id, position)
);
create index if not exists idx_daily_work_commitments_task on daily_work_commitments(task_id);

-- Limits -------------------------------------------------------------------
create table if not exists org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  max_active_projects_per_owner int not null default 2 check (max_active_projects_per_owner >= 1),
  max_active_projects_org int not null default 6 check (max_active_projects_org >= 1),
  max_in_progress_per_person int not null default 2 check (max_in_progress_per_person >= 1),
  max_daily_commitments int not null default 3 check (max_daily_commitments between 1 and 10),
  stale_project_days int not null default 5 check (stale_project_days >= 1),
  stale_task_days int not null default 3 check (stale_task_days >= 1),
  updated_at timestamptz not null default now()
);
insert into org_settings (organization_id) select id from organizations on conflict do nothing;

-- Signals ------------------------------------------------------------------
create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('STALE_PROJECT', 'STALE_TASK', 'UNASSIGNED_READY_TASK', 'OVERDUE_PROJECT', 'REPEATED_CARRY')),
  subject_type text not null check (subject_type in ('PROJECT', 'TASK')),
  subject_id uuid not null,
  project_id uuid references projects(id) on delete cascade,
  signal_date date not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, kind, subject_id, signal_date)
);
create index if not exists idx_signals_open on signals(organization_id, signal_date desc) where resolved_at is null;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
supabase db reset 2>&1 | grep -E "0026|ERROR"
docker exec supabase_db_PM_Pratap_AI psql -U postgres -Atc "select name, kind, canonical_status from projects where kind='STANDING' order by name; select count(*) from projects where canonical_status is null; select * from org_settings;"
```
Expected: `Applying migration 0026_task_first_gate.sql...` and no ERROR. There's one `<Dept> Ops` row per seeded department (Development Ops, Sales Ops, …) plus `Founder Office`, all `STANDING|ACTIVE`. The null count is `0`, and there's one `org_settings` row with defaults `2|6|2|3|5|3`.

- [ ] **Step 3: Verify the constraint only affects new rows**

Run:
```bash
docker exec supabase_db_PM_Pratap_AI psql -U postgres -Atc "insert into work_logs (session_id, organization_id, user_id, title, description) select s.id, s.organization_id, s.user_id, 'x', 'x' from daily_work_sessions s limit 1;" 2>&1 | tail -1
```
Expected: either `ERROR: new row for relation "work_logs" violates check constraint "work_logs_task_required"`, or `INSERT 0 0` if the seed has no sessions. Both are fine.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0026_task_first_gate.sql
git commit -m "feat(db): add task-first gate schema, standing ops projects and limits"
```

---

### Task 2: workGatePolicy (pure rules)

**Files:**
- Create: `backend/src/policies/workGatePolicy.ts`
- Test: `backend/src/policies/workGatePolicy.test.ts`

**Interfaces — Produces** (exact exports used by Tasks 3–7):

```ts
export type ProjectStage = 'DRAFT' | 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';
export type ProjectKind = 'DELIVERY' | 'STANDING';
export type TaskStage = 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'DEFERRED';
export interface WorkLimits { maxActiveProjectsPerOwner: number; maxActiveProjectsOrg: number; maxInProgressPerPerson: number; maxDailyCommitments: number; staleProjectDays: number; staleTaskDays: number }
export const DEFAULT_LIMITS: WorkLimits;
export interface BriefFacts { objective: string | null; successCriteria: unknown[]; ownerId: string | null; targetDate: string | null; milestoneCount: number; tasks: { assignedTo: string | null; estimateMinutes: number | null; stage: TaskStage }[] }
export type GateResult = { ok: true; overrideUsed?: boolean } | { ok: false; status: 400 | 403 | 409; message: string };
export const briefGaps: (brief: BriefFacts) => string[];
export const OPEN_TASK_STAGES: TaskStage[]; // BACKLOG, READY, IN_PROGRESS
export const isLoggableProject: (project: { kind: ProjectKind; stage: ProjectStage }) => boolean;
export const checkProjectTransition: (input: TransitionInput) => GateResult;
export const checkCommitments: (input: { taskIds: string[]; limits: WorkLimits }) => GateResult;
export const checkWorkTarget: (input: { actorId: string; task: { assignedTo: string | null; collaboratorIds: string[]; stage: TaskStage }; project: { kind: ProjectKind; stage: ProjectStage } }) => GateResult;
export const checkQuickAddTarget: (input: { project: { kind: ProjectKind; stage: ProjectStage }; isMember: boolean }) => GateResult;
export const checkStartTask: (input: { inProgressCount: number; limits: WorkLimits }) => GateResult;
```

`TransitionInput`:

```ts
{ from: ProjectStage; to: ProjectStage; kind: ProjectKind; isOwner: boolean; canManage: boolean; isCeo: boolean;
  reason?: string; override?: boolean; brief: BriefFacts; activeCounts: { owner: number; org: number }; limits: WorkLimits }
```

`activeCounts` excludes the project being transitioned.

- [ ] **Step 1: Write the failing tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LIMITS, briefGaps, checkCommitments, checkProjectTransition, checkQuickAddTarget,
  checkStartTask, checkWorkTarget, isLoggableProject, type BriefFacts,
} from './workGatePolicy';

const completeBrief: BriefFacts = {
  objective: 'Launch the resort site', successCriteria: ['Live on domain'], ownerId: 'owner', targetDate: '2026-12-01',
  milestoneCount: 1, tasks: [{ assignedTo: 'dev', estimateMinutes: 60, stage: 'BACKLOG' }],
};
const base = {
  kind: 'DELIVERY' as const, isOwner: false, canManage: true, isCeo: false,
  brief: completeBrief, activeCounts: { owner: 0, org: 0 }, limits: DEFAULT_LIMITS,
};

test('brief gaps list every missing item and ignore cancelled tasks', () => {
  assert.deepEqual(briefGaps(completeBrief), []);
  const gaps = briefGaps({ objective: ' ', successCriteria: [], ownerId: null, targetDate: null, milestoneCount: 0,
    tasks: [{ assignedTo: null, estimateMinutes: null, stage: 'BACKLOG' }, { assignedTo: null, estimateMinutes: null, stage: 'CANCELLED' }] });
  assert.deepEqual(gaps, ['objective', 'success criteria', 'owner', 'target date', 'at least one milestone', 'every task needs an assignee and estimate']);
  assert.deepEqual(briefGaps({ ...completeBrief, tasks: [{ assignedTo: 'a', estimateMinutes: 30, stage: 'CANCELLED' }] }), ['at least one task']);
});

test('DRAFT to PLANNING needs a complete brief and owner or manager', () => {
  assert.deepEqual(checkProjectTransition({ ...base, from: 'DRAFT', to: 'PLANNING' }), { ok: true, overrideUsed: false });
  assert.deepEqual(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'DRAFT', to: 'PLANNING' }), { ok: true, overrideUsed: false });
  assert.equal(checkProjectTransition({ ...base, canManage: false, from: 'DRAFT', to: 'PLANNING' }).ok, false);
  const incomplete = checkProjectTransition({ ...base, brief: { ...completeBrief, targetDate: null }, from: 'DRAFT', to: 'PLANNING' });
  assert.deepEqual(incomplete, { ok: false, status: 400, message: 'Complete the brief first: target date' });
});

test('activation respects per-owner and org caps, excluding the project itself', () => {
  assert.deepEqual(checkProjectTransition({ ...base, from: 'PLANNING', to: 'ACTIVE', activeCounts: { owner: 1, org: 5 } }), { ok: true, overrideUsed: false });
  const owner = checkProjectTransition({ ...base, from: 'PLANNING', to: 'ACTIVE', activeCounts: { owner: 2, org: 2 } });
  assert.deepEqual(owner, { ok: false, status: 409, message: 'This owner already has 2 active projects (limit 2). Park or finish one first.' });
  const org = checkProjectTransition({ ...base, from: 'ON_HOLD', to: 'ACTIVE', activeCounts: { owner: 0, org: 6 } });
  assert.deepEqual(org, { ok: false, status: 409, message: 'The company already has 6 active projects (limit 6). Park or finish one first.' });
});

test('only a CEO can override a cap, and only with a reason', () => {
  const over = { ...base, from: 'PLANNING' as const, to: 'ACTIVE' as const, activeCounts: { owner: 2, org: 6 } };
  assert.equal(checkProjectTransition({ ...over, override: true, reason: 'Board priority' }).ok, false);
  assert.equal(checkProjectTransition({ ...over, isCeo: true, override: true }).ok, false);
  assert.deepEqual(checkProjectTransition({ ...over, isCeo: true, override: true, reason: 'Board priority' }), { ok: true, overrideUsed: true });
});

test('activation, resume and cancel need a manager; parking allows the owner; reasons required', () => {
  assert.equal(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'PLANNING', to: 'ACTIVE' }).ok, false);
  assert.deepEqual(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'ACTIVE', to: 'ON_HOLD' }), { ok: false, status: 400, message: 'Give a reason for parking this project' });
  assert.deepEqual(checkProjectTransition({ ...base, canManage: false, isOwner: true, from: 'ACTIVE', to: 'ON_HOLD', reason: 'Client paused' }), { ok: true, overrideUsed: false });
  assert.equal(checkProjectTransition({ ...base, from: 'DRAFT', to: 'CANCELLED' }).ok, false);
  assert.equal(checkProjectTransition({ ...base, from: 'DRAFT', to: 'CANCELLED', reason: 'Duplicate' }).ok, true);
});

test('unsupported transitions and standing projects are rejected', () => {
  assert.deepEqual(checkProjectTransition({ ...base, from: 'ACTIVE', to: 'COMPLETED' }), { ok: false, status: 400, message: 'Use Finish project to deliver a project' });
  assert.equal(checkProjectTransition({ ...base, from: 'DRAFT', to: 'ACTIVE' }).ok, false);
  assert.deepEqual(checkProjectTransition({ ...base, kind: 'STANDING', from: 'ACTIVE', to: 'ON_HOLD', reason: 'x' }), { ok: false, status: 400, message: 'Standing ops projects are always active' });
  assert.equal(checkProjectTransition({ ...base, from: 'CANCELLED', to: 'ACTIVE' }).ok, false);
});

test('commitments: 1..max, no duplicates', () => {
  assert.deepEqual(checkCommitments({ taskIds: ['a'], limits: DEFAULT_LIMITS }), { ok: true });
  assert.deepEqual(checkCommitments({ taskIds: [], limits: DEFAULT_LIMITS }), { ok: false, status: 400, message: 'Commit to at least one task for today' });
  assert.deepEqual(checkCommitments({ taskIds: ['a', 'b', 'c', 'd'], limits: DEFAULT_LIMITS }), { ok: false, status: 400, message: 'Commit to at most 3 tasks per day' });
  assert.deepEqual(checkCommitments({ taskIds: ['a', 'a'], limits: DEFAULT_LIMITS }), { ok: false, status: 400, message: 'Each task can be committed once' });
});

test('work target: must be your open task in an active or standing project', () => {
  const project = { kind: 'DELIVERY' as const, stage: 'ACTIVE' as const };
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'me', collaboratorIds: [], stage: 'IN_PROGRESS' }, project }), { ok: true });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'you', collaboratorIds: ['me'], stage: 'BACKLOG' }, project }), { ok: true });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'you', collaboratorIds: [], stage: 'READY' }, project }), { ok: false, status: 403, message: 'You can only record work on tasks assigned to you' });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'me', collaboratorIds: [], stage: 'DONE' }, project }), { ok: false, status: 400, message: 'This task is closed' });
  assert.deepEqual(checkWorkTarget({ actorId: 'me', task: { assignedTo: 'me', collaboratorIds: [], stage: 'READY' }, project: { kind: 'DELIVERY', stage: 'DRAFT' } }), { ok: false, status: 400, message: 'This project is not active' });
  assert.equal(isLoggableProject({ kind: 'STANDING', stage: 'ACTIVE' }), true);
  assert.equal(isLoggableProject({ kind: 'DELIVERY', stage: 'ON_HOLD' }), false);
});

test('quick-add: standing projects for anyone, active delivery projects for members', () => {
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'STANDING', stage: 'ACTIVE' }, isMember: false }), { ok: true });
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'DELIVERY', stage: 'ACTIVE' }, isMember: true }), { ok: true });
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'DELIVERY', stage: 'ACTIVE' }, isMember: false }), { ok: false, status: 403, message: 'You can only add tasks to projects you are a member of' });
  assert.deepEqual(checkQuickAddTarget({ project: { kind: 'DELIVERY', stage: 'PLANNING' }, isMember: true }), { ok: false, status: 400, message: 'This project is not active' });
});

test('WIP limit on starting a task', () => {
  assert.deepEqual(checkStartTask({ inProgressCount: 1, limits: DEFAULT_LIMITS }), { ok: true });
  assert.deepEqual(checkStartTask({ inProgressCount: 2, limits: DEFAULT_LIMITS }), { ok: false, status: 409, message: 'You already have 2 tasks in progress (limit 2). Finish, pause or send one for review first.' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && node --import tsx --test src/policies/workGatePolicy.test.ts`
Expected: FAIL with `Cannot find module './workGatePolicy'`.

- [ ] **Step 3: Implement**

```ts
// Every task-first rule in one place. Pure functions: services load the facts,
// call these, and only write when the result is ok.
export type ProjectStage = 'DRAFT' | 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';
export type ProjectKind = 'DELIVERY' | 'STANDING';
export type TaskStage = 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'DEFERRED';

export interface WorkLimits {
  maxActiveProjectsPerOwner: number;
  maxActiveProjectsOrg: number;
  maxInProgressPerPerson: number;
  maxDailyCommitments: number;
  staleProjectDays: number;
  staleTaskDays: number;
}

export const DEFAULT_LIMITS: WorkLimits = {
  maxActiveProjectsPerOwner: 2, maxActiveProjectsOrg: 6, maxInProgressPerPerson: 2,
  maxDailyCommitments: 3, staleProjectDays: 5, staleTaskDays: 3,
};

export interface BriefFacts {
  objective: string | null;
  successCriteria: unknown[];
  ownerId: string | null;
  targetDate: string | null;
  milestoneCount: number;
  tasks: { assignedTo: string | null; estimateMinutes: number | null; stage: TaskStage }[];
}

export type GateResult = { ok: true; overrideUsed?: boolean } | { ok: false; status: 400 | 403 | 409; message: string };

export interface TransitionInput {
  from: ProjectStage;
  to: ProjectStage;
  kind: ProjectKind;
  isOwner: boolean;
  canManage: boolean;
  isCeo: boolean;
  reason?: string;
  override?: boolean;
  brief: BriefFacts;
  activeCounts: { owner: number; org: number };
  limits: WorkLimits;
}

// BACKLOG is startable until Plan 2 introduces a real READY step: `pause`
// maps to Pending/BACKLOG today, so most live tasks sit there.
export const OPEN_TASK_STAGES: TaskStage[] = ['BACKLOG', 'READY', 'IN_PROGRESS'];

const fail = (status: 400 | 403 | 409, message: string): GateResult => ({ ok: false, status, message });
const hasText = (value?: string | null) => Boolean(value && value.trim());

export const briefGaps = (brief: BriefFacts): string[] => {
  const tasks = brief.tasks.filter((task) => task.stage !== 'CANCELLED');
  return [
    !hasText(brief.objective) && 'objective',
    !brief.successCriteria.length && 'success criteria',
    !brief.ownerId && 'owner',
    !brief.targetDate && 'target date',
    brief.milestoneCount < 1 && 'at least one milestone',
    !tasks.length && 'at least one task',
    tasks.some((task) => !task.assignedTo || !task.estimateMinutes) && 'every task needs an assignee and estimate',
  ].filter((gap): gap is string => Boolean(gap));
};

type Rule = { who: 'owner' | 'manager'; brief?: boolean; caps?: boolean; reason?: string };
const RULES: Partial<Record<ProjectStage, Partial<Record<ProjectStage, Rule>>>> = {
  DRAFT: { PLANNING: { who: 'owner', brief: true }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
  PLANNING: { ACTIVE: { who: 'manager', brief: true, caps: true }, ON_HOLD: { who: 'owner', reason: 'parking' }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
  ACTIVE: { ON_HOLD: { who: 'owner', reason: 'parking' }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
  ON_HOLD: { ACTIVE: { who: 'manager', caps: true }, CANCELLED: { who: 'manager', reason: 'cancelling' } },
};

export const checkProjectTransition = (input: TransitionInput): GateResult => {
  if (input.kind === 'STANDING') return fail(400, 'Standing ops projects are always active');
  if (input.to === 'COMPLETED') return fail(400, 'Use Finish project to deliver a project');
  const rule = RULES[input.from]?.[input.to];
  if (!rule) return fail(400, `A project cannot move from ${input.from} to ${input.to}`);
  const allowed = rule.who === 'owner' ? input.isOwner || input.canManage : input.canManage;
  if (!allowed) return fail(403, rule.who === 'owner' ? 'Only the project owner or a manager can do this' : 'Only a project manager or the CEO can do this');
  if (rule.reason && !hasText(input.reason)) return fail(400, `Give a reason for ${rule.reason} this project`);
  if (rule.brief) {
    const gaps = briefGaps(input.brief);
    if (gaps.length) return fail(400, `Complete the brief first: ${gaps.join(', ')}`);
  }
  if (rule.caps) {
    const { owner, org } = input.activeCounts;
    const { maxActiveProjectsPerOwner: ownerCap, maxActiveProjectsOrg: orgCap } = input.limits;
    const breach = owner >= ownerCap
      ? `This owner already has ${owner} active projects (limit ${ownerCap}). Park or finish one first.`
      : org >= orgCap ? `The company already has ${org} active projects (limit ${orgCap}). Park or finish one first.` : null;
    if (breach) {
      if (input.override && input.isCeo && hasText(input.reason)) return { ok: true, overrideUsed: true };
      return fail(409, breach);
    }
  }
  return { ok: true, overrideUsed: false };
};

export const checkCommitments = ({ taskIds, limits }: { taskIds: string[]; limits: WorkLimits }): GateResult => {
  if (!taskIds.length) return fail(400, 'Commit to at least one task for today');
  if (taskIds.length > limits.maxDailyCommitments) return fail(400, `Commit to at most ${limits.maxDailyCommitments} tasks per day`);
  if (new Set(taskIds).size !== taskIds.length) return fail(400, 'Each task can be committed once');
  return { ok: true };
};

export const isLoggableProject = (project: { kind: ProjectKind; stage: ProjectStage }) =>
  project.kind === 'STANDING' || project.stage === 'ACTIVE';

export const checkWorkTarget = (input: {
  actorId: string;
  task: { assignedTo: string | null; collaboratorIds: string[]; stage: TaskStage };
  project: { kind: ProjectKind; stage: ProjectStage };
}): GateResult => {
  if (input.task.assignedTo !== input.actorId && !input.task.collaboratorIds.includes(input.actorId)) return fail(403, 'You can only record work on tasks assigned to you');
  if (!OPEN_TASK_STAGES.includes(input.task.stage)) return fail(400, 'This task is closed');
  if (!isLoggableProject(input.project)) return fail(400, 'This project is not active');
  return { ok: true };
};

export const checkQuickAddTarget = (input: { project: { kind: ProjectKind; stage: ProjectStage }; isMember: boolean }): GateResult => {
  if (input.project.kind === 'STANDING') return { ok: true };
  if (input.project.stage !== 'ACTIVE') return fail(400, 'This project is not active');
  if (!input.isMember) return fail(403, 'You can only add tasks to projects you are a member of');
  return { ok: true };
};

export const checkStartTask = ({ inProgressCount, limits }: { inProgressCount: number; limits: WorkLimits }): GateResult =>
  inProgressCount >= limits.maxInProgressPerPerson
    ? fail(409, `You already have ${inProgressCount} tasks in progress (limit ${limits.maxInProgressPerPerson}). Finish, pause or send one for review first.`)
    : { ok: true };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/policies/workGatePolicy.test.ts`
Expected: PASS, 10 tests.

Two of the test expectations must match this code exactly:
- The owner-cap message is checked before the org-cap message.
- `DRAFT→CANCELLED` without a reason fails with "Give a reason for cancelling this project".

- [ ] **Step 5: Run the whole suite, then commit**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`.

```bash
git add src/policies/workGatePolicy.ts src/policies/workGatePolicy.test.ts
git commit -m "feat: add task-first work gate policy"
```

---

### Task 3: Gate repository and project lifecycle service

**Files:**
- Create: `backend/src/repositories/workGateRepository.ts`
- Create: `backend/src/services/projectLifecycleService.ts`
- Create: `backend/src/services/projectLifecycleStages.ts` (pure legacy-status ↔ stage maps)
- Create: `backend/src/services/projectLifecycle.test.ts` (tests the pure `stageForLegacyStatus`)
- Modify: `backend/src/controllers/projectController.ts`, `backend/src/routes/projectRoutes.ts`, `backend/src/utils/validators.ts`
- Modify: `backend/src/services/projectService.ts` (create ~line 117, update ~line 249)
- Modify: `backend/src/services/agentWorkflowService.ts:295`
- Modify: `backend/src/repositories/projectRepository.ts` (`finish`, `remove`)
- Modify: `backend/src/services/mappers.ts` (`mapProject`)

**Interfaces:**
- Consumes: everything from Task 2.
- Produces:
  - `workGateRepository.limits(organizationId: string): Promise<WorkLimits>`
  - `workGateRepository.activeProjectCounts(organizationId: string, ownerId: string, excludeProjectId: string): Promise<{ owner: number; org: number }>`
  - `workGateRepository.briefFacts(project: any): Promise<BriefFacts>`
  - `workGateRepository.collaboratorIds(taskId: string): Promise<string[]>`
  - `workGateRepository.inProgressCount(userId: string, excludeTaskId?: string): Promise<number>`
  - `workGateRepository.opsProjectFor(user: { organizationId?: string; departmentId?: string | null }): Promise<any | null>`
  - `taskStage(task: any): TaskStage`
  - `projectStage(project: any): ProjectStage`
  - `projectLifecycleService.transition(projectId: string, to: ProjectStage, options: { reason?: string; override?: boolean }, actor: Actor): Promise<ReturnType<typeof mapProject>>`
  - `stageForLegacyStatus(status: string): ProjectStage | null` (`null` means Completed/unknown)
  - HTTP route: `POST /api/projects/:id/lifecycle` with body `{ to, reason?, override? }`
  - `mapProject` output gains `stage` and `kind`.

- [ ] **Step 1: Write the failing test for the legacy status mapping**

`backend/src/services/projectLifecycle.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageForLegacyStatus } from './projectLifecycleStages';

test('legacy project statuses map onto lifecycle stages', () => {
  assert.equal(stageForLegacyStatus('Draft'), 'DRAFT');
  assert.equal(stageForLegacyStatus('Saved'), 'DRAFT');
  assert.equal(stageForLegacyStatus('Planning'), 'PLANNING');
  for (const status of ['In Progress', 'Review', 'Testing']) assert.equal(stageForLegacyStatus(status), 'ACTIVE');
  assert.equal(stageForLegacyStatus('On Hold'), 'ON_HOLD');
  assert.equal(stageForLegacyStatus('Cancelled'), 'CANCELLED');
  assert.equal(stageForLegacyStatus('Completed'), null);
  assert.equal(stageForLegacyStatus('Blocked'), null);
});
```

The mapping lives in a tiny module with no Supabase import, so the test doesn't need database env vars.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/services/projectLifecycle.test.ts`
Expected: FAIL, `Cannot find module './projectLifecycleStages'`.

- [ ] **Step 3: Create `backend/src/services/projectLifecycleStages.ts`**

```ts
import type { ProjectStage } from '../policies/workGatePolicy';

const LEGACY_TO_STAGE: Record<string, ProjectStage> = {
  Draft: 'DRAFT', Saved: 'DRAFT', Planning: 'PLANNING', 'In Progress': 'ACTIVE', Review: 'ACTIVE', Testing: 'ACTIVE',
  'On Hold': 'ON_HOLD', Cancelled: 'CANCELLED',
};
// Legacy `status` is still shown by the current UI; the lifecycle writes both.
export const STAGE_TO_LEGACY: Partial<Record<ProjectStage, string>> = {
  DRAFT: 'Draft', PLANNING: 'Planning', ACTIVE: 'In Progress', ON_HOLD: 'On Hold', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

export const stageForLegacyStatus = (status: string): ProjectStage | null => LEGACY_TO_STAGE[status] ?? null;
```

Run: `node --import tsx --test src/services/projectLifecycle.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `workGateRepository.ts`**

```ts
import { supabase } from '../config/supabase';
import { DEFAULT_LIMITS, type BriefFacts, type ProjectStage, type TaskStage, type WorkLimits } from '../policies/workGatePolicy';

const LEGACY_TASK_STAGE: Record<string, TaskStage> = { Pending: 'BACKLOG', 'In Progress': 'IN_PROGRESS', 'In Review': 'IN_REVIEW', Completed: 'DONE', Blocked: 'IN_PROGRESS', Cancelled: 'CANCELLED', Deferred: 'DEFERRED' };
export const taskStage = (task: any): TaskStage => task.canonical_status || LEGACY_TASK_STAGE[task.status] || 'BACKLOG';
export const projectStage = (project: any): ProjectStage => project.canonical_status || 'DRAFT';

export const workGateRepository = {
  async limits(organizationId: string): Promise<WorkLimits> {
    const { data, error } = await supabase.from('org_settings').select('*').eq('organization_id', organizationId).maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_LIMITS;
    return {
      maxActiveProjectsPerOwner: data.max_active_projects_per_owner, maxActiveProjectsOrg: data.max_active_projects_org,
      maxInProgressPerPerson: data.max_in_progress_per_person, maxDailyCommitments: data.max_daily_commitments,
      staleProjectDays: data.stale_project_days, staleTaskDays: data.stale_task_days,
    };
  },
  async activeProjectCounts(organizationId: string, ownerId: string, excludeProjectId: string) {
    const { data, error } = await supabase.from('projects').select('id, owner_id')
      .eq('organization_id', organizationId).eq('kind', 'DELIVERY').eq('canonical_status', 'ACTIVE').eq('archived', false).neq('id', excludeProjectId);
    if (error) throw error;
    const rows = data || [];
    return { owner: rows.filter((row) => row.owner_id === ownerId).length, org: rows.length };
  },
  async briefFacts(project: any): Promise<BriefFacts> {
    const [milestones, tasks] = await Promise.all([
      supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
      supabase.from('project_tasks').select('assigned_to, estimate_minutes, status, canonical_status').eq('project_id', project.id),
    ]);
    if (milestones.error) throw milestones.error;
    if (tasks.error) throw tasks.error;
    return {
      objective: project.objective, successCriteria: Array.isArray(project.success_criteria_json) ? project.success_criteria_json : [],
      ownerId: project.owner_id, targetDate: project.target_date, milestoneCount: milestones.count || 0,
      tasks: (tasks.data || []).map((task: any) => ({ assignedTo: task.assigned_to, estimateMinutes: task.estimate_minutes, stage: taskStage(task) })),
    };
  },
  async collaboratorIds(taskId: string) {
    const { data, error } = await supabase.from('task_collaborators').select('user_id').eq('task_id', taskId);
    if (error) throw error;
    return (data || []).map((row) => row.user_id as string);
  },
  async inProgressCount(userId: string, excludeTaskId?: string) {
    let query = supabase.from('project_tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('canonical_status', 'IN_PROGRESS');
    if (excludeTaskId) query = query.neq('id', excludeTaskId);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },
  async opsProjectFor(user: { organizationId?: string; departmentId?: string | null }) {
    if (!user.organizationId || !user.departmentId) return null;
    const { data, error } = await supabase.from('projects').select('*').eq('organization_id', user.organizationId)
      .eq('department_id', user.departmentId).eq('kind', 'STANDING').limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
};
```

- [ ] **Step 5: Create `projectLifecycleService.ts`**

```ts
import { canManageProject } from '../policies/accessPolicy';
import { checkProjectTransition, type ProjectStage } from '../policies/workGatePolicy';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectStage, workGateRepository } from '../repositories/workGateRepository';
import { HttpError, notFound } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';
import { mapProject } from './mappers';
import { STAGE_TO_LEGACY } from './projectLifecycleStages';

interface Actor { id: string; role: string; organizationId?: string; departmentId?: string | null }

const resourceFor = (project: any) => ({
  organizationId: project.organization_id, departmentId: project.department_id, ownerUserId: project.owner_id,
  members: (project.project_members || []).map((membership: any) => ({ userId: membership.user?.id, projectRole: membership.project_role, permissions: membership.permissions_json })),
});

export const projectLifecycleService = {
  async transition(projectId: string, to: ProjectStage, options: { reason?: string; override?: boolean }, actor: Actor) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound('Project not found');
    const from = projectStage(project);
    const [limits, activeCounts, brief] = await Promise.all([
      workGateRepository.limits(project.organization_id),
      workGateRepository.activeProjectCounts(project.organization_id, project.owner_id, project.id),
      workGateRepository.briefFacts(project),
    ]);
    const result = checkProjectTransition({
      from, to, kind: project.kind || 'DELIVERY', isOwner: project.owner_id === actor.id,
      canManage: canManageProject(actor, resourceFor(project)), isCeo: isSuperAdmin(actor.role),
      reason: options.reason, override: options.override, brief, activeCounts, limits,
    });
    if (!result.ok) throw new HttpError(result.status, result.message);
    const updated = await projectRepository.update(projectId, { canonical_status: to, status: STAGE_TO_LEGACY[to] as any } as any);
    await activityLogRepository.create({
      action: 'Project Stage Changed', user_id: actor.id, project_id: projectId,
      details: `${project.name} moved from ${from} to ${to}${options.reason ? `: ${options.reason.trim()}` : ''}.`,
      event: { eventType: result.overrideUsed ? 'PROJECT_CAP_OVERRIDDEN' : 'PROJECT_STAGE_CHANGED', entityType: 'PROJECT', entityId: projectId, payload: { from, to, reason: options.reason?.trim() || null, override: Boolean(result.overrideUsed) } },
    });
    return mapProject(updated);
  },
};
```

- [ ] **Step 6: Wire the route, validator and controller**

`utils/validators.ts`, after `updateProjectSchema`:

```ts
export const projectLifecycleSchema = z.object({
  to: z.enum(['DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'CANCELLED']),
  reason: z.string().trim().max(500).optional(),
  override: z.boolean().optional(),
});
```

`controllers/projectController.ts` (add the import of `projectLifecycleService` at the top):

```ts
export const transitionProject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await projectLifecycleService.transition(param(req, 'id'), req.body.to, { reason: req.body.reason, override: req.body.override }, actorOf(req)));
});
```

`routes/projectRoutes.ts`, next to `/:id/archive` (import `transitionProject` and `projectLifecycleSchema`):

```ts
router.post('/:id/lifecycle', validateBody(projectLifecycleSchema), transitionProject);
```

- [ ] **Step 7: Route legacy writers through the lifecycle**

In `projectService.ts` `createProject` (~line 117), replace `status: (input.status as any) || 'Draft',` with:

```ts
      // Every project starts Proposed; the brief and activation gate come later.
      status: 'Draft',
      canonical_status: 'DRAFT',
```

In `projectService.ts` `update`:
- Remove the line `...(patch.status !== undefined && { status: patch.status as any }),` from the `projectRepository.update` object.
- Insert this block right after `if (!existing) throw notFound('Project not found');`. `actor` is threaded from the controller in the next step.

```ts
    // The Edit modal re-sends the current legacy status on every save; only a
    // real change is a lifecycle transition.
    if (patch.status !== undefined && patch.status !== existing.status) {
      const target = stageForLegacyStatus(patch.status);
      if (!target) throw badRequest(patch.status === 'Completed' ? 'Use Finish project to deliver a project' : `Unknown project status ${patch.status}`);
      if (target !== (existing.canonical_status || 'DRAFT')) {
        if (!actor) throw badRequest('A signed-in user is required to change the project stage');
        await projectLifecycleService.transition(id, target, {}, actor);
      } else await projectRepository.update(id, { status: patch.status as any });
    }
```

- Change the signature from `actorId?: string` to `actor?: { id: string; role: string; organizationId?: string; departmentId?: string | null }` and replace the two uses of `actorId` in that method with `actor?.id`.
- Update the caller in `controllers/projectController.ts` (`updateProject`) to pass `actorOf(req)` instead of `actorOf(req).id`. Check first: `grep -n "projectService.update(" src/controllers/projectController.ts`.
- Add imports to `projectService.ts`: `import { projectLifecycleService } from './projectLifecycleService';`, `import { stageForLegacyStatus } from './projectLifecycleStages';`, and `badRequest` from `../utils/httpError` if missing.

In `agentWorkflowService.ts:295`, delete `await projectRepository.update(projectId, { status: 'Planning' });`. Approving an agent plan no longer changes the project stage; the brief gate does.

In `projectRepository.finish`, add `canonical_status: 'COMPLETED',` next to `status: 'Completed',`. In `projectRepository.remove`, add `canonical_status: 'CANCELLED',` next to `status: 'Cancelled',`.

In `mappers.ts` `mapProject`, after `status: row.status,` add:

```ts
  stage: row.canonical_status || 'DRAFT',
  kind: row.kind || 'DELIVERY',
```

- [ ] **Step 8: Typecheck and test**

Run: `npx tsc -p tsconfig.json --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: no tsc output; `fail 0`.

- [ ] **Step 9: Smoke-test against the running backend**

With `npm run dev` running on :5000:

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"govind@pratap.local","password":"Demo@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
PID=$(curl -s localhost:5000/api/projects -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).find(p=>p.stage==="DRAFT"&&p.kind==="DELIVERY")._id')
curl -s -X POST localhost:5000/api/projects/$PID/lifecycle -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"to":"PLANNING"}'
```

Expected: HTTP 400 with `{"message":"Complete the brief first: …"}` listing the missing items. (If the seed has no DRAFT project, create one in the UI first.)

- [ ] **Step 10: Commit**

```bash
git add src/repositories/workGateRepository.ts src/services/projectLifecycleService.ts src/services/projectLifecycleStages.ts src/services/projectLifecycle.test.ts src/controllers/projectController.ts src/routes/projectRoutes.ts src/utils/validators.ts src/services/projectService.ts src/services/agentWorkflowService.ts src/repositories/projectRepository.ts src/services/mappers.ts
git commit -m "feat: gate project lifecycle on brief completeness and active-project caps"
```

---

### Task 4: Task WIP limit, review-only completion, delete guard

**Files:**
- Modify: `backend/src/services/projectTaskService.ts` (`update` ~line 200, `remove`)
- Modify: `backend/src/controllers/projectTaskController.ts:31-34`

**Interfaces:**
- Consumes: `checkStartTask`, `workGateRepository.limits`, `workGateRepository.inProgressCount`, `taskStage` (Tasks 2–3).
- Produces: `projectTaskService.updateFromClient(projectId, taskId, patch, actor)`, used by the PUT controller. `projectTaskService.update` (used by the workflow actions) keeps its signature.

- [ ] **Step 1: Add the WIP check inside `projectTaskService.update`**

Right after the `isStatusOnlyPatch` / `assertCanManageTasks` block (~line 213), insert:

```ts
    const nextStage = patch.canonicalStatus ?? ({ Pending: 'BACKLOG', 'In Progress': 'IN_PROGRESS', 'In Review': 'IN_REVIEW', Completed: 'DONE', Blocked: 'IN_PROGRESS' } as Record<string, string>)[patch.status || ''];
    const assignee = patch.assignedTo !== undefined ? patch.assignedTo : existing.assigned_to;
    if (nextStage === 'IN_PROGRESS' && taskStage(existing) !== 'IN_PROGRESS' && assignee) {
      const project = await projectRepository.findById(projectId);
      const gate = checkStartTask({ inProgressCount: await workGateRepository.inProgressCount(assignee, taskId), limits: await workGateRepository.limits(project.organization_id) });
      if (!gate.ok) throw new HttpError(gate.status, gate.message);
    }
```

The WIP limit belongs to the assignee, not to whoever moves the card. Every start path (the `/start` action, kanban drag, TaskDetailPanel) goes through `update`, so this one check covers all of them. Check that `projectRepository` is already imported at the top of the file (`grep -n "projectRepository" src/services/projectTaskService.ts | head -1`) and add the import if not. Also import `checkStartTask` from `../policies/workGatePolicy`, `taskStage` and `workGateRepository` from `../repositories/workGateRepository`, and `HttpError` from `../utils/httpError`.

- [ ] **Step 2: Add `updateFromClient` and `remove` guard**

Add to `projectTaskService` (before `update`):

```ts
  // PUT from the UI: any stage except DONE. Completion goes through
  // request-review → approve, or a project manager.
  async updateFromClient(projectId: string, taskId: string, patch: Parameters<typeof projectTaskService.update>[2], actor: Actor) {
    const toDone = patch.canonicalStatus === 'DONE' || patch.status === 'Completed';
    if (toDone) await assertCanManageTasks(projectId, actor).catch(() => { throw forbidden('Send the task for review instead of marking it complete'); });
    return this.update(projectId, taskId, patch, actor);
  },
```

(If TypeScript rejects the self-referencing `Parameters<typeof projectTaskService.update>`, declare the patch type once as `type TaskPatch = {...}`, copying the inline type from `update`'s signature, and use it in both methods.)

In `remove`, before the delete call, add:

```ts
    const { count: logCount } = await supabase.from('work_logs').select('id', { count: 'exact', head: true }).eq('task_id', taskId);
    if (logCount) throw badRequest('This task has logged work; cancel it instead');
```

Import `supabase` from `../config/supabase` if it isn't imported yet. Keeping this one query inline is fine: it's a single guard.

In `controllers/projectTaskController.ts:32`, change `projectTaskService.update(` to `projectTaskService.updateFromClient(`.

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc -p tsconfig.json --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: no tsc output; `fail 0`. The API behaviour is covered by the Task 7 integration tests.

- [ ] **Step 4: Commit**

```bash
git add src/services/projectTaskService.ts src/controllers/projectTaskController.ts
git commit -m "feat: enforce WIP limit and review-only completion on tasks"
```

---

### Task 5: Daily work gate — commitments, task-required logs, quick-add, outcomes

**Files:**
- Modify: `backend/src/services/dailyWorkService.ts`
- Modify: `backend/src/repositories/dailyWorkRepository.ts`
- Modify: `backend/src/controllers/dailyWorkController.ts`
- Modify: `backend/src/routes/dailyWorkRoutes.ts`
- Modify: `backend/src/utils/validators.ts:287-290`
- Modify: `backend/src/types/models.ts:335-345`

**Interfaces:**
- Consumes: `checkCommitments`, `checkWorkTarget`, `checkQuickAddTarget`, `OPEN_TASK_STAGES`, `workGateRepository.*`, `taskStage`, `projectStage`; also `requiresCarryoverReason` from `utils/dailyPlanRules.ts`.
- Produces the HTTP contract that the frontend in Task 7 uses:
  - `POST /api/daily-work/start` body `{ commitments: string[] }` or `{ newTask: { title: string; projectId?: string } }` → session DTO. The `newTask` form is for people with no open tasks: it quick-adds one and commits to it.
  - `POST /api/daily-work/logs` body `{ taskId?: string; newTask?: { title: string; projectId?: string }; title: string; description: string; minutes?: number }`. Exactly one of `taskId` / `newTask` must be given.
  - `POST /api/daily-work/end` body `{ outcomes: { taskId: string; outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason?: string }[] }`.
  - The session DTO gains `commitments: { taskId, position, outcome, carryReason, task: { _id, title, projectId, projectName, stage, carryForwardCount } }[]`, and each log gains `minutes`.

- [ ] **Step 1: Validators**

Replace `dailyWorkLogSchema` and add the two new schemas:

```ts
export const dailyWorkStartSchema = z.object({
  commitments: z.array(z.string().uuid()).max(10).optional(),
  newTask: z.object({ title: z.string().trim().min(1).max(180), projectId: z.string().uuid().optional() }).optional(),
}).refine((body) => Boolean(body.commitments?.length) !== Boolean(body.newTask), { message: 'Pick tasks to commit to, or add one new task' });
export const dailyWorkLogSchema = z.object({
  taskId: z.string().uuid().optional(),
  newTask: z.object({ title: z.string().trim().min(1).max(180), projectId: z.string().uuid().optional() }).optional(),
  title: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(3000),
  minutes: z.coerce.number().int().min(1).max(720).optional(),
}).refine((body) => Boolean(body.taskId) !== Boolean(body.newTask), { message: 'Pick a task or add a new one' });
export const dailyWorkEndSchema = z.object({
  outcomes: z.array(z.object({ taskId: z.string().uuid(), outcome: z.enum(['DONE', 'CARRIED', 'BLOCKED']), reason: z.string().trim().max(500).optional() })).max(10).default([]),
});
```

- [ ] **Step 2: Repository additions (`dailyWorkRepository`)**

```ts
  async commitments(sessionId: string) {
    const { data, error } = await supabase.from('daily_work_commitments')
      .select('*, task:task_id(id, title, project_id, status, canonical_status, carry_forward_count, project:project_id(id, name))')
      .eq('session_id', sessionId).order('position');
    if (error) throw error;
    return data || [];
  },
  async addCommitments(rows: { session_id: string; task_id: string; position: number }[]) {
    const { error } = await supabase.from('daily_work_commitments').insert(rows);
    if (error) throw error;
  },
  async setOutcome(sessionId: string, taskId: string, outcome: string, carryReason: string | null) {
    const { error } = await supabase.from('daily_work_commitments').update({ outcome, carry_reason: carryReason }).eq('session_id', sessionId).eq('task_id', taskId);
    if (error) throw error;
  },
  async markUnresolvedCarried(sessionId: string) {
    const { data, error } = await supabase.from('daily_work_commitments').update({ outcome: 'CARRIED' }).eq('session_id', sessionId).is('outcome', null).select('task_id');
    if (error) throw error;
    return (data || []).map((row) => row.task_id as string);
  },
  async incrementCarry(taskIds: string[]) {
    for (const id of taskIds) {
      const { data, error } = await supabase.from('project_tasks').select('carry_forward_count').eq('id', id).single();
      if (error) throw error;
      const { error: updateError } = await supabase.from('project_tasks').update({ carry_forward_count: (data.carry_forward_count || 0) + 1 }).eq('id', id);
      if (updateError) throw updateError;
    }
  },
  async addActualMinutes(taskId: string, minutes: number) {
    const { data, error } = await supabase.from('project_tasks').select('actual_minutes').eq('id', taskId).single();
    if (error) throw error;
    const { error: updateError } = await supabase.from('project_tasks').update({ actual_minutes: (data.actual_minutes || 0) + minutes }).eq('id', taskId);
    if (updateError) throw updateError;
  },
```

`# ponytail: read-then-write increments; a concurrent write can lose one count. Move to an RPC (update … set x = x + 1) if two people ever log on the same task in the same second.` Put this comment above `incrementCarry`.

`project_tasks.actual_minutes` already exists (added in 0010, nullable), which is why the code uses `|| 0`.

In `types/models.ts` `WorkLog`, add `minutes: number | null;` after `description`.

- [ ] **Step 3: Service changes (`dailyWorkService.ts`)**

Add imports:

```ts
import { checkCommitments, checkQuickAddTarget, checkWorkTarget } from '../policies/workGatePolicy';
import { projectStage, taskStage, workGateRepository } from '../repositories/workGateRepository';
import { projectTaskRepository } from '../repositories/projectTaskRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { HttpError } from '../utils/httpError';
import { requiresCarryoverReason } from '../utils/dailyPlanRules';
import { canApproveAgentWork } from '../utils/roles';
```

Replace `import { isManager } from '../utils/roles';` with the `canApproveAgentWork` import above. Also change `interface Actor` to include `departmentId?: string | null`.

Extend `dto` to accept commitments, and map `minutes` on each log:

```ts
const dto = (session: any, logs: any[] = [], commitments: any[] = []) => ({
  _id: session.id, userId: session.user_id, user: session.user, date: session.work_date, timezone: session.timezone,
  startAt: session.start_at, endAt: session.end_at, status: session.status, logs: logs.map((log: any) => ({
    _id: log.id, sessionId: log.session_id, userId: log.user_id, projectId: log.project_id, project: log.project,
    taskId: log.task_id, task: log.task, title: log.title, description: log.description, minutes: log.minutes ?? null, createdAt: log.created_at,
  })),
  commitments: commitments.map((row: any) => ({
    taskId: row.task_id, position: row.position, outcome: row.outcome, carryReason: row.carry_reason,
    task: row.task ? { _id: row.task.id, title: row.task.title, projectId: row.task.project_id, projectName: row.task.project?.name || null, stage: taskStage(row.task), carryForwardCount: row.task.carry_forward_count || 0 } : null,
  })),
});
const gate = (result: { ok: boolean; status?: number; message?: string }) => { if (!result.ok) throw new HttpError(result.status!, result.message!); };
const full = async (session: any) => dto(session, await dailyWorkRepository.logs(session.id), await dailyWorkRepository.commitments(session.id));
```

Replace `current`:

```ts
  async current(actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    return session ? full(session) : null;
  },
```

Replace `start`:

```ts
  async start(input: { commitments?: string[]; newTask?: { title: string; projectId?: string } }, actor: Actor) {
    if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
    const existing = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (existing) {
      if (existing.status === 'ACTIVE') throw badRequest(`You already started your day at ${new Date(existing.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`);
      throw badRequest('Your workday is already completed for today.');
    }
    const commitments = input.newTask ? [(await this.quickAdd(input.newTask, actor)).id] : input.commitments || [];
    gate(checkCommitments({ taskIds: commitments, limits: await workGateRepository.limits(actor.organizationId) }));
    for (const taskId of commitments) await this.assertWorkTarget(taskId, actor);
    const session = await dailyWorkRepository.create({ organization_id: actor.organizationId, user_id: actor.id, work_date: dateOf(actor), timezone: timezoneOf(actor) });
    await dailyWorkRepository.addCommitments(commitments.map((taskId, index) => ({ session_id: session.id, task_id: taskId, position: index + 1 })));
    return full(session);
  },
  async assertWorkTarget(taskId: string, actor: Actor) {
    const task = await projectTaskRepository.findById(taskId);
    if (!task) throw notFound('Task not found');
    const project = await projectRepository.findById(task.project_id);
    if (!project || project.archived) throw notFound('Project not found');
    gate(checkWorkTarget({
      actorId: actor.id,
      task: { assignedTo: task.assigned_to, collaboratorIds: await workGateRepository.collaboratorIds(taskId), stage: taskStage(task) },
      project: { kind: project.kind || 'DELIVERY', stage: projectStage(project) },
    }));
    return { task, project };
  },
```

Replace `end`:

```ts
  async end(outcomes: { taskId: string; outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason?: string }[], actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (!session) throw notFound('Start your day before ending it');
    if (session.status !== 'ACTIVE') throw badRequest('SESSION ALREADY COMPLETED');
    const commitments = await dailyWorkRepository.commitments(session.id);
    const byTask = new Map(outcomes.map((item) => [item.taskId, item]));
    const missing = commitments.filter((row: any) => !byTask.has(row.task_id));
    if (missing.length) throw badRequest(`Tell us how today went for: ${missing.map((row: any) => row.task?.title || 'a committed task').join(', ')}`);
    for (const row of commitments) {
      const item = byTask.get(row.task_id)!;
      if (item.outcome === 'CARRIED' && requiresCarryoverReason(row.task?.carry_forward_count || 0) && !item.reason?.trim()) throw badRequest(`"${row.task?.title}" has been carried over ${row.task?.carry_forward_count} times. Say why before carrying it again.`);
    }
    for (const row of commitments) {
      const item = byTask.get(row.task_id)!;
      await dailyWorkRepository.setOutcome(session.id, row.task_id, item.outcome, item.reason?.trim() || null);
    }
    await dailyWorkRepository.incrementCarry(commitments.filter((row: any) => byTask.get(row.task_id)!.outcome === 'CARRIED').map((row: any) => row.task_id));
    return full(await dailyWorkRepository.complete(session.id, 'COMPLETED', new Date().toISOString()));
  },
```

`DONE`/`BLOCKED` outcomes are the person's own account of the day. They don't move the task; status changes stay in the task workflow (request-review, block). Keep it that way.

Replace `addLog`:

```ts
  async addLog(input: { taskId?: string; newTask?: { title: string; projectId?: string }; title: string; description: string; minutes?: number }, actor: Actor) {
    const session = await dailyWorkRepository.current(actor.id, dateOf(actor));
    if (!session || session.status !== 'ACTIVE') throw badRequest('Please Start My Day before recording work.');
    const taskId = input.taskId || (await this.quickAdd(input.newTask!, actor)).id;
    const { task } = await this.assertWorkTarget(taskId, actor);
    const log = await dailyWorkRepository.addLog({ session_id: session.id, organization_id: session.organization_id, user_id: actor.id, project_id: task.project_id, task_id: taskId, title: input.title.trim(), description: input.description.trim(), minutes: input.minutes ?? null });
    if (input.minutes) await dailyWorkRepository.addActualMinutes(taskId, input.minutes);
    return { ...dto(session), logs: [dto(session, [log]).logs[0]] };
  },
  async quickAdd(input: { title: string; projectId?: string }, actor: Actor) {
    const project = input.projectId ? await projectRepository.findById(input.projectId) : await workGateRepository.opsProjectFor(actor);
    if (!project) throw badRequest(input.projectId ? 'Project not found' : 'Choose a project for this task');
    if (project.organization_id !== actor.organizationId) throw forbidden('You can only add tasks to your own organization');
    const isMember = project.owner_id === actor.id || await projectRepository.isMemberAssigned(project.id, actor.id);
    gate(checkQuickAddTarget({ project: { kind: project.kind || 'DELIVERY', stage: projectStage(project) }, isMember }));
    if (!isMember) await projectRepository.addMembers(project.id, [actor.id]);
    const task = await projectTaskRepository.create({
      project_id: project.id, organization_id: project.organization_id, title: input.title.trim(), status: 'Pending', canonical_status: 'BACKLOG',
      priority: 'Medium', assigned_to: actor.id, created_by: actor.id, reporter_user_id: actor.id, estimate_minutes: 60, remaining_estimate_minutes: 60,
    } as any);
    await activityLogRepository.create({
      action: 'Task Created', user_id: actor.id, project_id: project.id, details: `${input.title.trim()} was quick-added from My Day.`,
      event: { eventType: 'TASK_CREATED', entityType: 'TASK', entityId: task.id, payload: { source: 'QUICK_ADD', projectKind: project.kind || 'DELIVERY' } },
    });
    return task;
  },
```

Replace the first line of `admin`:

```ts
    if (!canApproveAgentWork(actor.role)) throw forbidden('You do not have permission to view team work logs');
```

In `autoCloseExpired`, after `await dailyWorkRepository.complete(session.id, 'AUTO_COMPLETED', now.toISOString());` add:

```ts
        await dailyWorkRepository.incrementCarry(await dailyWorkRepository.markUnresolvedCarried(session.id));
```

(Wrap the two statements in `{ … }` so both run under the `if`.)

- [ ] **Step 4: Controller and routes**

`dailyWorkController.ts`:

```ts
export const startDailyWork = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await dailyWorkService.start(req.body, actorOf(req))));
export const endDailyWork = asyncHandler(async (req: Request, res: Response) => res.json(await dailyWorkService.end(req.body.outcomes || [], actorOf(req))));
```

`dailyWorkRoutes.ts` (import the two new schemas):

```ts
router.post('/start', validateBody(dailyWorkStartSchema), startDailyWork);
router.post('/end', validateBody(dailyWorkEndSchema), endDailyWork);
```

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc -p tsconfig.json --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: no tsc output; `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/services/dailyWorkService.ts src/repositories/dailyWorkRepository.ts src/controllers/dailyWorkController.ts src/routes/dailyWorkRoutes.ts src/utils/validators.ts src/types/models.ts
git commit -m "feat: require a task for every work log, with daily commitments and quick-add"
```

---

### Task 6: Daily signals job

**Files:**
- Create: `backend/src/jobs/dailySignals.ts`
- Test: `backend/src/jobs/dailySignals.test.ts`
- Modify: `backend/src/server.ts:17`

**Interfaces:**
- Consumes: `WorkLimits`, `taskStage`, `projectStage`, `workGateRepository.limits`; `notificationService.notify(userId, type, title, message, { link, relatedType, relatedId })` (existing signature, see `taskWorkflowService.ts`).
- Produces:
  - `detectSignals(facts: SignalFacts, limits: WorkLimits, today: string): DetectedSignal[]`
  - `runDailySignals(now?: Date): Promise<number>`, which returns the number of new signals.
  - Types:

```ts
export interface SignalFacts {
  projects: { id: string; ownerId: string; kind: 'DELIVERY' | 'STANDING'; stage: string; targetDate: string | null; lastLogDate: string | null; activatedDate: string }[];
  tasks: { id: string; projectId: string; assignedTo: string | null; stage: string; lastLogDate: string | null; startedDate: string | null; carryForwardCount: number }[];
}
export interface DetectedSignal { kind: 'STALE_PROJECT' | 'STALE_TASK' | 'UNASSIGNED_READY_TASK' | 'OVERDUE_PROJECT' | 'REPEATED_CARRY'; subjectType: 'PROJECT' | 'TASK'; subjectId: string; projectId: string; notify: string | null; message: string }
```

- [ ] **Step 1: Write the failing tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LIMITS } from '../policies/workGatePolicy';
import { detectSignals, workingDaysBetween } from './dailySignals';

const project = { id: 'p1', ownerId: 'o1', kind: 'DELIVERY' as const, stage: 'ACTIVE', targetDate: null, lastLogDate: '2026-09-24', activatedDate: '2026-09-01' };
const task = { id: 't1', projectId: 'p1', assignedTo: 'u1', stage: 'IN_PROGRESS', lastLogDate: '2026-09-24', startedDate: '2026-09-20', carryForwardCount: 0 };
const kinds = (facts: Parameters<typeof detectSignals>[0]) => detectSignals(facts, DEFAULT_LIMITS, '2026-09-25').map((signal) => `${signal.kind}:${signal.subjectId}`);

test('working days skip Saturday and Sunday', () => {
  assert.equal(workingDaysBetween('2026-09-18', '2026-09-25'), 5); // Fri → Fri
  assert.equal(workingDaysBetween('2026-09-25', '2026-09-25'), 0);
});

test('a healthy project and task produce no signals', () => {
  assert.deepEqual(kinds({ projects: [project], tasks: [task] }), []);
});

test('stale project after 5 working days without a log; standing and inactive projects ignored', () => {
  const stale = { ...project, lastLogDate: '2026-09-18' };
  assert.deepEqual(kinds({ projects: [stale], tasks: [] }), ['STALE_PROJECT:p1']);
  assert.deepEqual(kinds({ projects: [{ ...stale, kind: 'STANDING' }], tasks: [] }), []);
  assert.deepEqual(kinds({ projects: [{ ...stale, stage: 'ON_HOLD' }], tasks: [] }), []);
  assert.deepEqual(kinds({ projects: [{ ...project, lastLogDate: null, activatedDate: '2026-09-10' }], tasks: [] }), ['STALE_PROJECT:p1']);
});

test('overdue delivery project', () => {
  assert.deepEqual(kinds({ projects: [{ ...project, targetDate: '2026-09-24' }], tasks: [] }), ['OVERDUE_PROJECT:p1']);
  assert.deepEqual(kinds({ projects: [{ ...project, targetDate: '2026-09-25' }], tasks: [] }), []);
});

test('stale in-progress task, unassigned open task, repeated carry', () => {
  assert.deepEqual(kinds({ projects: [project], tasks: [{ ...task, lastLogDate: '2026-09-21' }] }), ['STALE_TASK:t1']);
  assert.deepEqual(kinds({ projects: [project], tasks: [{ ...task, stage: 'READY', assignedTo: null }] }), ['UNASSIGNED_READY_TASK:t1']);
  assert.deepEqual(kinds({ projects: [project], tasks: [{ ...task, carryForwardCount: 3 }] }), ['REPEATED_CARRY:t1']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/jobs/dailySignals.test.ts`
Expected: FAIL, `Cannot find module './dailySignals'`.

- [ ] **Step 3: Implement the pure part in `dailySignals.ts`**

```ts
import type { WorkLimits } from '../policies/workGatePolicy';

export interface SignalFacts {
  projects: { id: string; ownerId: string; kind: 'DELIVERY' | 'STANDING'; stage: string; targetDate: string | null; lastLogDate: string | null; activatedDate: string }[];
  tasks: { id: string; projectId: string; assignedTo: string | null; stage: string; lastLogDate: string | null; startedDate: string | null; carryForwardCount: number }[];
}
export interface DetectedSignal {
  kind: 'STALE_PROJECT' | 'STALE_TASK' | 'UNASSIGNED_READY_TASK' | 'OVERDUE_PROJECT' | 'REPEATED_CARRY';
  subjectType: 'PROJECT' | 'TASK';
  subjectId: string;
  projectId: string;
  notify: string | null;
  message: string;
}

const dayMs = 86_400_000;
export const workingDaysBetween = (from: string, to: string) => {
  let days = 0;
  for (let time = Date.parse(`${from}T00:00:00Z`) + dayMs; time <= Date.parse(`${to}T00:00:00Z`); time += dayMs) {
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
};

export const detectSignals = (facts: SignalFacts, limits: WorkLimits, today: string): DetectedSignal[] => {
  const projectById = new Map(facts.projects.map((project) => [project.id, project]));
  const signals: DetectedSignal[] = [];
  for (const project of facts.projects) {
    if (project.kind !== 'DELIVERY' || project.stage !== 'ACTIVE') continue;
    const idleDays = workingDaysBetween(project.lastLogDate || project.activatedDate, today);
    if (idleDays >= limits.staleProjectDays) signals.push({ kind: 'STALE_PROJECT', subjectType: 'PROJECT', subjectId: project.id, projectId: project.id, notify: project.ownerId, message: `No work logged for ${idleDays} working days. Park it or plan the next task.` });
    if (project.targetDate && project.targetDate < today) signals.push({ kind: 'OVERDUE_PROJECT', subjectType: 'PROJECT', subjectId: project.id, projectId: project.id, notify: project.ownerId, message: `Past its target date (${project.targetDate}).` });
  }
  for (const task of facts.tasks) {
    const owner = projectById.get(task.projectId)?.ownerId || null;
    if (task.stage === 'IN_PROGRESS') {
      const idleDays = workingDaysBetween(task.lastLogDate || task.startedDate || today, today);
      if (idleDays >= limits.staleTaskDays) signals.push({ kind: 'STALE_TASK', subjectType: 'TASK', subjectId: task.id, projectId: task.projectId, notify: task.assignedTo, message: `In progress with no work logged for ${idleDays} working days.` });
    }
    if (['READY', 'BACKLOG'].includes(task.stage) && !task.assignedTo) signals.push({ kind: 'UNASSIGNED_READY_TASK', subjectType: 'TASK', subjectId: task.id, projectId: task.projectId, notify: owner, message: 'Open task with nobody assigned.' });
    if (task.carryForwardCount > 2) signals.push({ kind: 'REPEATED_CARRY', subjectType: 'TASK', subjectId: task.id, projectId: task.projectId, notify: owner, message: `Carried over ${task.carryForwardCount} times.` });
  }
  return signals;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/jobs/dailySignals.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add the runner (I/O part) to the same file**

```ts
import { supabase } from '../config/supabase';
import { projectStage, taskStage, workGateRepository } from '../repositories/workGateRepository';
import { notificationService } from '../services/notificationService';

const lastRunByOrg = new Map<string, string>();

export const runDailySignals = async (now = new Date()) => {
  const today = now.toISOString().slice(0, 10);
  const { data: orgs, error } = await supabase.from('organizations').select('id');
  if (error) throw error;
  let created = 0;
  for (const { id: organizationId } of orgs || []) {
    if (lastRunByOrg.get(organizationId) === today) continue;
    const [projects, tasks, logs] = await Promise.all([
      supabase.from('projects').select('id, owner_id, kind, status, canonical_status, target_date, updated_at').eq('organization_id', organizationId).eq('archived', false),
      supabase.from('project_tasks').select('id, project_id, assigned_to, status, canonical_status, carry_forward_count, updated_at').eq('organization_id', organizationId),
      supabase.from('work_logs').select('project_id, task_id, created_at').eq('organization_id', organizationId).gte('created_at', new Date(now.getTime() - 30 * 86_400_000).toISOString()),
    ]);
    for (const result of [projects, tasks, logs]) if (result.error) throw result.error;
    const lastLog = (key: 'project_id' | 'task_id', id: string) => (logs.data || []).filter((log: any) => log[key] === id).map((log: any) => log.created_at.slice(0, 10)).sort().pop() || null;
    const facts: SignalFacts = {
      projects: (projects.data || []).map((row: any) => ({ id: row.id, ownerId: row.owner_id, kind: row.kind || 'DELIVERY', stage: projectStage(row), targetDate: row.target_date, lastLogDate: lastLog('project_id', row.id), activatedDate: row.updated_at.slice(0, 10) })),
      tasks: (tasks.data || []).map((row: any) => ({ id: row.id, projectId: row.project_id, assignedTo: row.assigned_to, stage: taskStage(row), lastLogDate: lastLog('task_id', row.id), startedDate: row.updated_at.slice(0, 10), carryForwardCount: row.carry_forward_count || 0 })),
    };
    for (const signal of detectSignals(facts, await workGateRepository.limits(organizationId), today)) {
      const { data: inserted, error: insertError } = await supabase.from('signals')
        .upsert({ organization_id: organizationId, kind: signal.kind, subject_type: signal.subjectType, subject_id: signal.subjectId, project_id: signal.projectId, signal_date: today, details: { message: signal.message } }, { onConflict: 'organization_id,kind,subject_id,signal_date', ignoreDuplicates: true })
        .select('id');
      if (insertError) throw insertError;
      if (!inserted?.length) continue;
      created += 1;
      if (signal.notify) await notificationService.notify(signal.notify, 'work_signal', signal.kind.replace(/_/g, ' ').toLowerCase(), signal.message, { link: `/projects/${signal.projectId}`, relatedType: signal.subjectType === 'PROJECT' ? 'project' : 'project_task', relatedId: signal.subjectId });
    }
    lastRunByOrg.set(organizationId, today);
  }
  return created;
};
```

`# ponytail: activatedDate/startedDate use updated_at as a proxy, which is good enough for 30-day staleness. Read activity_events for exact stage-change dates if false positives show up.` Put this comment above `facts`.

`notificationService.notify(userId, type: string, …)` accepts any type string, so no change is needed there.

- [ ] **Step 6: Wire into `server.ts`**

Replace line 17 with:

```ts
    setInterval(() => {
      dailyWorkService.autoCloseExpired().catch((error) => logger.error('Failed to auto-close daily work sessions', { error }));
      runDailySignals().catch((error) => logger.error('Failed to compute daily signals', { error }));
    }, 60_000);
```

and add `import { runDailySignals } from './jobs/dailySignals';`.

- [ ] **Step 7: Typecheck, test, commit**

Run: `npx tsc -p tsconfig.json --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `fail 0`.

```bash
git add src/jobs src/server.ts
git commit -m "feat: flag stale, overdue, unassigned and repeatedly carried work daily"
```

---

### Task 7: My Day UI — commitments, task picker, quick-add, outcomes

**Files:**
- Modify: `frontend/src/api/dailyWorkApi.ts`
- Modify: `frontend/src/pages/DailyWorkday.tsx`
- Modify: `frontend/src/types/index.ts` (`Project` gains `stage?: string; kind?: 'DELIVERY' | 'STANDING'`)

**Interfaces:**
- Consumes: the Task 5 HTTP contract; `projectTaskApi.assignedToMe()` → `AssignedProjectTask[]` (`_id`, `title`, `projectId`, `project.name`, `status`); `projectApi.list()` → `Project[]` (now with `stage`, `kind`).
- Produces: UI only.

- [ ] **Step 1: API client**

In `dailyWorkApi.ts`:
- Add `minutes: number | null;` to `WorkLog`.
- Add to `DailyWorkSession`: `commitments: { taskId: string; position: number; outcome: 'DONE' | 'CARRIED' | 'BLOCKED' | null; carryReason: string | null; task: { _id: string; title: string; projectId: string; projectName: string | null; stage: string; carryForwardCount: number } | null }[];`
- Replace these three methods:

```ts
  start: (body: { commitments: string[] } | { newTask: { title: string; projectId?: string } }) => api.post<DailyWorkSession>('/daily-work/start', body).then((response) => response.data),
  end: (outcomes: { taskId: string; outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason?: string }[]) => api.post<DailyWorkSession>('/daily-work/end', { outcomes }).then((response) => response.data),
  addLog: (payload: { taskId?: string; newTask?: { title: string; projectId?: string }; title: string; description: string; minutes?: number }) => api.post<DailyWorkSession>('/daily-work/logs', payload).then((response) => response.data),
```

In `types/index.ts` `Project`, add after `status: string;`:

```ts
  stage?: 'DRAFT' | 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';
  kind?: 'DELIVERY' | 'STANDING';
```

- [ ] **Step 2: Page state and loaders (`DailyWorkday.tsx`)**

Add the import `import { projectTaskApi, type AssignedProjectTask } from '../api/projectTaskApi';`.

Replace the `projectId` state with:

```tsx
  const [myTasks, setMyTasks] = useState<AssignedProjectTask[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [taskId, setTaskId] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [ending, setEnding] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: 'DONE' | 'CARRIED' | 'BLOCKED'; reason: string }>>({});
```

Replace the first `useEffect` loader body with:

```tsx
    Promise.all([dailyWorkApi.current(), projectApi.list(), projectTaskApi.assignedToMe()]).then(([current, available, tasks]) => {
      setSession(current);
      setProjects(available.filter((project) => !project.archived && (project.kind === 'STANDING' || project.stage === 'ACTIVE')));
      setMyTasks(tasks.filter((task) => !['Completed', 'In Review', 'Cancelled'].includes(task.status)));
    }).catch((loadError) => setError(getErrorMessage(loadError, 'We could not load your day.'))).finally(() => setLoading(false));
```

(`projectApi.list()` already returns only projects the user can see.)

Replace `start`, `end`, `add`:

```tsx
  const togglePick = (id: string) => setPicked((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 3 ? current : [...current, id]);
  const start = async () => { try { setSaving(true); setError(''); setSession(await dailyWorkApi.start(picked.length ? { commitments: picked } : { newTask: { title: newTaskTitle } })); setNewTaskTitle(''); } catch (saveError) { setError(getErrorMessage(saveError, 'We could not start your day.')); } finally { setSaving(false); } };
  const openEnd = () => { setOutcomes(Object.fromEntries((session?.commitments || []).map((row) => [row.taskId, { outcome: 'DONE' as const, reason: '' }]))); setEnding(true); };
  const end = async () => {
    try { setSaving(true); setError(''); setSession(await dailyWorkApi.end(Object.entries(outcomes).map(([id, value]) => ({ taskId: id, outcome: value.outcome, reason: value.reason.trim() || undefined })))); setEnding(false); }
    catch (saveError) { setError(getErrorMessage(saveError, 'We could not end your day.')); } finally { setSaving(false); }
  };
  const add = async () => {
    if (!title.trim() || !description.trim() || (!taskId && !newTaskTitle.trim())) return;
    try {
      setSaving(true); setError('');
      await dailyWorkApi.addLog({ title, description, minutes: minutes ? Number(minutes) : undefined, ...(taskId ? { taskId } : { newTask: { title: newTaskTitle, projectId: newTaskProjectId || undefined } }) });
      setTitle(''); setDescription(''); setTaskId(''); setNewTaskTitle(''); setNewTaskProjectId(''); setMinutes(''); setAdding(false);
      await refresh();
      setMyTasks((await projectTaskApi.assignedToMe()).filter((task) => !['Completed', 'In Review', 'Cancelled'].includes(task.status)));
    } catch (saveError) { setError(getErrorMessage(saveError, 'We could not save this work record.')); } finally { setSaving(false); }
  };
```

- [ ] **Step 3: Markup changes**

**Start card.** In the `!session` start section, insert this before the `Start My Day` button:

```tsx
<fieldset className="commit-picker"><legend>Pick up to 3 tasks you will finish today</legend>
  {!myTasks.length ? <p className="home-project-empty">No open tasks assigned to you yet. Add one below.</p> :
    myTasks.map((task) => <label key={task._id} className={picked.includes(task._id) ? 'is-picked' : ''}><input type="checkbox" checked={picked.includes(task._id)} disabled={!picked.includes(task._id) && picked.length >= 3} onChange={() => togglePick(task._id)} /><span><strong>{task.title}</strong><small>{task.project?.name || 'Project'}</small></span></label>)}
</fieldset>
```

**No-open-tasks case.** Inside the same fieldset, after the list, add a one-line quick-add so someone with no open tasks can still commit. This uses the Task 5 `newTask` form of `/start`:

```tsx
{!myTasks.length && <label><span>Or add today's task</span><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} maxLength={180} placeholder="e.g. Follow up with resort client" /></label>}
```

Change the Start button's `disabled` to `disabled={saving || (!picked.length && !newTaskTitle.trim())}`.

**Active day.** Above the logs list, render the commitments:

```tsx
<ol className="commit-list">{session.commitments.map((row) => <li key={row.taskId}><span className="outcome-number">{row.position}</span><div><small>{row.task?.projectName}</small><strong>{row.task?.title}</strong>{row.outcome && <em>{row.outcome.toLowerCase()}</em>}</div></li>)}</ol>
```

- Replace the `End My Day` button's `onClick={end}` with `onClick={openEnd}`.
- In log items, show `{log.minutes ? ` · ${log.minutes} min` : ''}` after the recorded time.

**Add-work modal.** Replace the Project `<label>` with:

```tsx
<label><span>Task</span><select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">+ New task…</option>{myTasks.map((task) => <option key={task._id} value={task._id}>{task.title} · {task.project?.name}</option>)}</select></label>
{!taskId && <><label><span>New task title</span><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} maxLength={180} placeholder="e.g. Fix OTP retry on login" /></label>
<label><span>Project</span><select value={newTaskProjectId} onChange={(event) => setNewTaskProjectId(event.target.value)}><option value="">My department ops project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}{project.kind === 'STANDING' ? ' (ops)' : ''}</option>)}</select></label></>}
<label><span>Minutes spent (optional)</span><input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>
```

Change the save button's `disabled` to `saving || !title.trim() || !description.trim() || (!taskId && !newTaskTitle.trim())`.

**End-day modal.** Add after the add-work modal:

```tsx
{ending && session && <div className="modal-backdrop" role="presentation"><div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="end-day-title"><div className="modal-header"><div><div className="modal-title" id="end-day-title">How did today go?</div><p className="modal-subtitle">One answer per commitment. Carrying a task a third time needs a reason.</p></div><button className="icon-btn" aria-label="Close" onClick={() => setEnding(false)}><X size={18} /></button></div>
  <div className="modal-body start-work-form">{session.commitments.map((row) => <fieldset key={row.taskId}><legend>{row.task?.title}</legend>
    <select aria-label={`Outcome for ${row.task?.title}`} value={outcomes[row.taskId]?.outcome || 'DONE'} onChange={(event) => setOutcomes((current) => ({ ...current, [row.taskId]: { ...current[row.taskId], outcome: event.target.value as 'DONE' | 'CARRIED' | 'BLOCKED' } }))}><option value="DONE">Done</option><option value="CARRIED">Carry to tomorrow</option><option value="BLOCKED">Blocked</option></select>
    {outcomes[row.taskId]?.outcome !== 'DONE' && <input aria-label={`Reason for ${row.task?.title}`} placeholder={(row.task?.carryForwardCount || 0) >= 2 ? 'Reason (required)' : 'Reason (optional)'} value={outcomes[row.taskId]?.reason || ''} onChange={(event) => setOutcomes((current) => ({ ...current, [row.taskId]: { ...current[row.taskId], reason: event.target.value } }))} />}
  </fieldset>)}</div>
  <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setEnding(false)}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={end}>{saving ? 'Ending...' : 'End My Day'} <CheckCircle2 size={15} /></button></div></div></div>}
```

- [ ] **Step 4: Styles**

Append to the stylesheet that defines `.home-start` (`grep -rln "home-start" frontend/src --include=*.css`). Use existing tokens only:

```css
.commit-picker { border: 1px solid var(--border, #E5E5E5); border-radius: 12px; padding: 12px; margin: 16px auto; max-width: 520px; text-align: left; display: grid; gap: 8px; }
.commit-picker legend { font-weight: 600; padding: 0 6px; }
.commit-picker label { display: flex; gap: 10px; align-items: flex-start; padding: 8px; border-radius: 8px; cursor: pointer; }
.commit-picker label.is-picked { background: #F5F1E7; outline: 1px solid #D8C27A; }
.commit-picker small, .commit-list small { display: block; color: var(--text-muted); }
.commit-list { list-style: none; padding: 0; margin: 0 0 16px; display: grid; gap: 8px; }
.commit-list li { display: flex; gap: 12px; align-items: center; }
.commit-list em { font-style: normal; font-size: .75rem; text-transform: capitalize; color: #9B7D35; }
```

- [ ] **Step 5: Typecheck and build**

Run: `cd ../frontend && npx tsc -b && npx vite build 2>&1 | tail -3`
Expected: no tsc errors; `✓ built in …`.

- [ ] **Step 6: Manual check in the browser**

With backend and frontend running, log in as `devesh@pratap.local` / `Demo@123`:
1. The start card lists open assigned tasks, and the checkboxes stop at 3.
2. Start → the commitments show.
3. Add work → pick a task → save → the log shows the task's project.
4. Add work → "+ New task…" with project left on default → saves under "Development Ops".
5. End My Day → mark one Carried → the day closes.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend/src backend/src
git commit -m "feat(ui): My Day commitments, task-linked work logs and quick-add"
```

---

### Task 8: Integration tests against local Supabase

**Files:**
- Create: `backend/scripts/run-integration-tests.js`
- Create: `backend/src/integration/workGates.integration.ts`
- Modify: `backend/package.json` (script `test:integration`)

**Interfaces:** Consumes the running backend on `http://127.0.0.1:5000` and the local Supabase service client (`src/config/supabase.ts`, which reads `backend/.env.local`).

- [ ] **Step 1: Runner**

```js
// Runs *.integration.ts against a running backend + local Supabase.
// Skips (exit 0) when the backend isn't reachable so CI without a DB stays green.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const base = process.env.API_URL || 'http://127.0.0.1:5000';
fetch(`${base}/api/auth/me`).then(() => {
  const tests = readdirSync('src/integration').filter((file) => file.endsWith('.integration.ts')).map((file) => join('src/integration', file));
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...tests], { stdio: 'inherit', env: { ...process.env, API_URL: base } });
  process.exit(result.status ?? 1);
}).catch(() => { console.log(`Backend not reachable at ${base}; skipping integration tests.`); process.exit(0); });
```

In `package.json` scripts, add `"test:integration": "node scripts/run-integration-tests.js",`.

- [ ] **Step 2: Write the integration tests**

```ts
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';

const API = `${process.env.API_URL}/api`;
const login = async (email: string) => {
  const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo@123' }) });
  const body = await response.json();
  return { id: body._id as string, token: body.token as string, organizationId: '' };
};
const call = async (token: string, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
};

let dev: Awaited<ReturnType<typeof login>>, pm: Awaited<ReturnType<typeof login>>, ceo: Awaited<ReturnType<typeof login>>;
let orgId: string, projectId: string, taskIds: string[];

before(async () => {
  [pm, ceo] = await Promise.all([login('govind@pratap.local'), login('vijendra@pratap.local')]);
  // A fresh team member per run: work_logs are immutable, so a reused user's
  // session for today could never be reset.
  const { data: template } = await supabase.from('users').select('organization_id, department_id, department').eq('email', 'devesh@pratap.local').single();
  orgId = template!.organization_id;
  const stamp = Date.now();
  const email = `it-${stamp}@pratap.local`;
  const { error: userError } = await supabase.from('users').insert({
    name: `IT Member ${stamp}`, email, password_hash: await bcrypt.hash('Demo@123', 10), role: 'Team Member', platform_role: 'TEAM_MEMBER',
    organization_id: orgId, department_id: template!.department_id, department: template!.department,
    account_status: 'ACTIVE', status: 'Active', onboarding_completed_at: new Date().toISOString(), timezone: 'Asia/Dubai',
  });
  if (userError) throw userError;
  dev = await login(email);
  // Fixture: an ACTIVE delivery project with the member and three open tasks.
  const { data: project } = await supabase.from('projects').insert({ name: `IT gate ${stamp}`, status: 'In Progress', canonical_status: 'ACTIVE', kind: 'DELIVERY', owner_id: pm.id, created_by: pm.id, organization_id: orgId, priority: 'Medium' }).select('id').single();
  projectId = project!.id;
  await supabase.from('project_members').insert({ project_id: projectId, user_id: dev.id });
  const { data: tasks } = await supabase.from('project_tasks').insert([1, 2, 3].map((n) => ({ project_id: projectId, organization_id: orgId, title: `IT task ${n}`, status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' }))).select('id');
  taskIds = tasks!.map((task) => task.id);
});

test('start rejects more than 3 commitments and a task you do not own', async () => {
  assert.equal((await call(dev.token, 'POST', '/daily-work/start', { commitments: [...taskIds, taskIds[0]] })).status, 400);
  const { data: other } = await supabase.from('project_tasks').insert({ project_id: projectId, organization_id: orgId, title: 'IT not mine', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: pm.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' }).select('id').single();
  assert.equal((await call(dev.token, 'POST', '/daily-work/start', { commitments: [other!.id] })).status, 403);
});

test('start with commitments, log requires a task, quick-add lands in the ops project', async () => {
  const started = await call(dev.token, 'POST', '/daily-work/start', { commitments: taskIds.slice(0, 2) });
  assert.equal(started.status, 201);
  assert.equal(started.body.commitments.length, 2);
  assert.equal((await call(dev.token, 'POST', '/daily-work/logs', { title: 'x', description: 'no task' })).status, 400);
  const logged = await call(dev.token, 'POST', '/daily-work/logs', { taskId: taskIds[0], title: 'API', description: 'built it', minutes: 30 });
  assert.equal(logged.status, 201);
  const quick = await call(dev.token, 'POST', '/daily-work/logs', { newTask: { title: 'IT quick-add' }, title: 'Quick', description: 'untracked work' });
  assert.equal(quick.status, 201);
  const { data: created } = await supabase.from('project_tasks').select('project:project_id(kind)').eq('assigned_to', dev.id).eq('title', 'IT quick-add').single();
  assert.equal((created as any).project.kind, 'STANDING');
});

test('quick-add without a department and without a project asks for a project', async () => {
  const { data: before } = await supabase.from('users').select('department_id').eq('id', dev.id).single();
  await supabase.from('users').update({ department_id: null }).eq('id', dev.id);
  const response = await call(dev.token, 'POST', '/daily-work/logs', { newTask: { title: 'IT orphan' }, title: 'x', description: 'x' });
  await supabase.from('users').update({ department_id: before!.department_id }).eq('id', dev.id);
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Choose a project for this task');
});

test('logging on a closed task fails with a clear message', async () => {
  await supabase.from('project_tasks').update({ canonical_status: 'CANCELLED' }).eq('id', taskIds[1]);
  const response = await call(dev.token, 'POST', '/daily-work/logs', { taskId: taskIds[1], title: 'x', description: 'x' });
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'This task is closed');
});

test('end requires an outcome per commitment and still accepts a cancelled commitment', async () => {
  assert.equal((await call(dev.token, 'POST', '/daily-work/end', { outcomes: [{ taskId: taskIds[0], outcome: 'DONE' }] })).status, 400);
  const ended = await call(dev.token, 'POST', '/daily-work/end', { outcomes: [{ taskId: taskIds[0], outcome: 'DONE' }, { taskId: taskIds[1], outcome: 'CARRIED' }] });
  assert.equal(ended.status, 200);
  assert.equal(ended.body.status, 'COMPLETED');
});

test('team member cannot PUT a task to DONE; WIP limit blocks a third start', async () => {
  assert.equal((await call(dev.token, 'PUT', `/projects/${projectId}/tasks/${taskIds[0]}`, { status: 'Completed' })).status, 403);
  await supabase.from('project_tasks').update({ canonical_status: 'IN_PROGRESS', status: 'In Progress' }).in('id', [taskIds[0], taskIds[2]]);
  const { data: extra } = await supabase.from('project_tasks').insert({ project_id: projectId, organization_id: orgId, title: 'IT third', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' }).select('id').single();
  assert.equal((await call(dev.token, 'POST', `/tasks/${extra!.id}/start`)).status, 409);
});

test('a task with logged work cannot be deleted', async () => {
  const response = await call(pm.token, 'DELETE', `/projects/${projectId}/tasks/${taskIds[0]}`);
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'This task has logged work; cancel it instead');
});

test('lifecycle: brief gate, cap with CEO override, legacy status edits', async () => {
  const { data: draft } = await supabase.from('projects').insert({ name: `IT draft ${Date.now()}`, status: 'Draft', canonical_status: 'DRAFT', kind: 'DELIVERY', owner_id: pm.id, created_by: pm.id, organization_id: orgId, priority: 'Medium' }).select('*').single();
  const gap = await call(pm.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'PLANNING' });
  assert.equal(gap.status, 400);
  assert.match(gap.body.message, /^Complete the brief first: /);
  // Complete the brief directly, then activate with the org cap forced to 1.
  const { data: milestone } = await supabase.from('milestones').insert({ project_id: draft!.id, name: 'M1', status: 'PLANNED' }).select('id').single();
  await supabase.from('project_tasks').insert({ project_id: draft!.id, organization_id: orgId, milestone_id: milestone!.id, title: 'IT brief task', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' });
  await supabase.from('projects').update({ objective: 'Ship', success_criteria_json: ['Live'], target_date: '2026-12-31' }).eq('id', draft!.id);
  assert.equal((await call(pm.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'PLANNING' })).status, 200);
  const { data: settings } = await supabase.from('org_settings').select('max_active_projects_org').eq('organization_id', orgId).single();
  await supabase.from('org_settings').update({ max_active_projects_org: 1 }).eq('organization_id', orgId);
  try {
    assert.equal((await call(pm.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'ACTIVE' })).status, 409);
    assert.equal((await call(ceo.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'ACTIVE', override: true, reason: 'IT override' })).status, 200);
  } finally {
    await supabase.from('org_settings').update({ max_active_projects_org: settings!.max_active_projects_org }).eq('organization_id', orgId);
  }
  // Legacy edit modal: unchanged status is a no-op, Completed is refused.
  const { data: current } = await supabase.from('projects').select('status').eq('id', draft!.id).single();
  assert.equal((await call(pm.token, 'PUT', `/projects/${draft!.id}`, { name: 'IT renamed', status: current!.status })).status, 200);
  const done = await call(pm.token, 'PUT', `/projects/${draft!.id}`, { status: 'Completed' });
  assert.equal(done.status, 400);
  assert.equal(done.body.message, 'Use Finish project to deliver a project');
});

test('CEO can read team work logs', async () => {
  assert.equal((await call(ceo.token, 'GET', '/daily-work/admin')).status, 200);
});
```


- [ ] **Step 3: Run against a fresh database**

```bash
cd backend && supabase db reset >/dev/null && (npm run dev > /tmp/pm-backend.log 2>&1 &) && timeout 60 bash -c 'until curl -s localhost:5000/api/auth/me >/dev/null; do sleep 1; done'
npm run test:integration
```

Expected: all 9 tests pass. Any failure points at the task whose contract it names. Fix it in that task's code, not in the test.

- [ ] **Step 4: Stop the dev server and commit**

```bash
lsof -ti:5000 -sTCP:LISTEN | xargs -r kill
git add scripts/run-integration-tests.js src/integration package.json
git commit -m "test: add integration tests for task-first gates"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full checks**

```bash
cd backend && npx tsc -p tsconfig.json --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"
cd ../frontend && npx tsc -b && npx vite build 2>&1 | tail -1
```

Expected: no type errors, `fail 0`, and the build succeeds. Then run Task 8 Step 3 again: all pass.

- [ ] **Step 2: Rollout notes**

Append to `docs/HOSTINGER_VPS_DEPLOYMENT.md`:

```markdown
## Task-first gate release (0026)

1. Back up production, restore it locally, run `supabase db reset` with the dump, and check that the standing ops projects exist (`select name from projects where kind='STANDING'`).
2. Deploy backend and frontend together: the new My Day requires the new API.
3. After release the Projects list may show more ACTIVE projects than the cap (2 per owner, 6 company-wide). Existing work continues; new activations are blocked until the PM parks projects or the CEO overrides with a reason.
4. Limits live in `org_settings`; change them with SQL until the Settings screen ships (Plan 2).
```

```bash
git add docs/HOSTINGER_VPS_DEPLOYMENT.md && git commit -m "docs: task-first gate rollout notes"
```
