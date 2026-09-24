# Task-First Consolidation (Phases 0–1) — Design

Status: awaiting review · Date: 2026-09-25 · Scope: Phase 0 (one data model) and Phase 1 (task-first workflow)

## 1. Why

Pratap AI runs many projects at once and few get delivered. Team members start work without creating tasks, so nobody can see what is in flight, what is blocked, or what to do next. The long-term goal is an agentic PM platform: a **PM agent** that team members talk to, and a **co-founder agent** that steers the founder toward growth work. Agents can only act reliably on a clean, single source of truth. This spec builds that foundation and the discipline rules. Agents come in later specs.

### What the user decided

- Audience: the Pratap AI team only (one organization) for the next 3–6 months.
- "Harness" means both an agent tool-calling runtime (Phase 2) **and** a platform-enforced task-first workflow (this spec).
- Discipline: hard gate plus fast task creation. No work is logged without a task, but creating one takes seconds.
- Agents get tiered autonomy later: own-work changes apply instantly; changes to others or to scope become proposals.
- PM agent lives in-app first. Slack or WhatsApp comes later on the same runtime.
- Model provider: keep OpenRouter.
- Co-founder agent inputs, later: goals/OKRs, delivery health, founder work log, sales pipeline and revenue.
- Non-project work lives in **standing ops projects**.
- Caps: at most 2 ACTIVE projects per owner, 6 per company, 2 IN_PROGRESS tasks per person, 3 daily commitments.
- Approach A: consolidate first, then workflow, then agents.

### Assumptions

- The stack stays React 19 + Vite, Express 5, and Supabase. The design contract in `DESIGN.md` is unchanged.
- Govind (PM) remains the default approver.
- A hosted production database holds real data that must survive the migration.

### Success criteria

1. Every `work_logs` row created after release references a task.
2. Exactly one table holds tasks (`project_tasks`), one holds day tracking (`daily_work_sessions` + `work_logs`), and one holds activity (`activity_events`).
3. A project cannot become ACTIVE without a complete brief, or beyond the caps without a logged CEO override.
4. Stale projects and stale tasks are flagged automatically each day.
5. Sidebar goes from 12 items to 7. No page or endpoint without a caller remains.

## 2. Current state

Findings from the 2026-09-25 codebase survey:

- **Work logs don't link to tasks.** The live Home (`DailyWorkday` → `POST /api/daily-work/logs`) stores free-text logs. The UI never sends `taskId`, and the server doesn't check it. The previous flow (`workdayService.start`) turned untracked work into tasks. It was replaced on 2026-08-22.
- **Four task models:** `project_tasks`, `daily_todos`, `workday_items`, `project_features`.
- **Three day-tracking generations:**
  - `workdays` / `workday_items` / `work_sessions`
  - `daily_work_sessions` / `work_logs`
  - `todayService`
- **Two hierarchies:** milestones → deliverables, and `project_features`.
- **Two status fields each on projects and on tasks.** The mapping between them loses information: CANCELLED and DEFERRED both become 'Pending'.
- **Two activity tables:** `activity_logs` and `activity_events`.
- **Two project registries:** `projects` and `document_link_projects`.
- **Review bypass:** an assignee can `PUT {status:'Completed'}` and skip review.
- **Intake is thin.** Only `name` is required. `objective`, `success_criteria_json`, `target_date` and `client_name` exist but are never collected.
- **Stale metrics:** `reportService.dailyPlanCompletion` and `workdayService.getTeam` read legacy `workdays`, which nothing writes any more.
- **Dead code:**
  - Pages: `Dashboard.tsx`, `TeamMemberDashboard.tsx`, `LeadershipDashboards.tsx`, `DeadlineTimer.tsx`, `Register.tsx`, `AddUpdateModal.tsx`, `DemoPersonaBar.tsx`, `ProjectActivityFeed.tsx`, and `LegacyWorkday` inside `Workday.tsx`.
  - Endpoints: `/api/today`, `/api/daily-plans`, `/api/agent-runs`, `/api/agents/pm|ba/run`, `/projects/:id/health`.
- **Bugs:**
  - CEO gets 403 on `GET /api/daily-work/admin` (`dailyWorkService.ts:58` uses `isManager`).
  - Frontend `canApproveAgentWork` excludes Lead; the backend includes Lead.
- **Duplicate migration versions** `0021_*` and `0022_*` break `supabase start` on a fresh database.

## 3. Phase 0 — one data model

### 3.1 Tasks

`project_tasks` becomes the only task table.

- Add columns:
  - `recurrence text not null default 'NONE'`
  - `recurrence_anchor date`
  - `work_type text not null default 'TASK'` (TASK | MEETING | UPDATE)
  - `carry_forward_count int not null default 0`
  - `original_due_date date`
- The carry-forward and recurrence logic moves from `todoService` / `utils/recurringTodo.ts` into `projectTaskService`. It stays lazy: computed on read, with no cron.
- Migrate `daily_todos` (+ subtasks and documents) into tasks in the owner's department ops project (§3.3). Status maps directly; the `domain_type` is dropped because the ops project now carries it.
- Migrate `workday_items` without a `task_id` into tasks the same way.
- `canonical_status` becomes the only task status: BACKLOG, READY, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED, DEFERRED. The `blocked` flag and `blockers` table stay orthogonal. The legacy `status` column is dropped in step 3 (§6).

### 3.2 Hierarchy

The hierarchy is **Project → Milestone → Task**.

- Each `deliverable` becomes a milestone named "<milestone> · <deliverable>". Its acceptance criteria move onto its tasks.
- Each `project_feature` becomes a milestone.
- Tasks keep `milestone_id` only. `deliverable_id` and `feature_id` are dropped in step 3.
- The PM agent's `publishFeaturesAndTasks` writes milestones instead of features.

### 3.3 Projects

- Add columns:
  - `kind text not null default 'DELIVERY'` (DELIVERY | STANDING)
  - `live_link text`
  - `private_notes text not null default ''`
- **Lifecycle reuses `canonical_status`.** No new status column. The UI labels map as:

  | UI label | `canonical_status` |
  |---|---|
  | Proposed | `DRAFT` |
  | Ready | `PLANNING` |
  | Active | `ACTIVE` |
  | Parked | `ON_HOLD` |
  | Delivered | `COMPLETED` |
  | Cancelled | `CANCELLED` |
  | (hidden) | `ARCHIVED` |

  The legacy `status` column is dropped in step 3.
- **Standing ops projects:** one `kind='STANDING'` project per department (e.g. Sales Ops, Development Ops), plus one **Founder Office**.
  - They are always ACTIVE and don't count toward caps.
  - Their brief can't be edited and they can't be closed.
  - The department head owns each one; the CEO owns Founder Office.
- **`document_link_projects`:**
  - Match each row to `projects` by case-insensitive name. On a match, copy `live_link` and `private_notes`.
  - If there's no match, create a DELIVERED project.
  - Files move to `project_documents`.
  - `/documents-links` becomes a Projects view filtered to projects with a live link. `documentsLinksService` and its routes are removed. The edit permission becomes the normal `canManageProject`, and private notes stay visible only to CEO/Founder.

### 3.4 Day tracking, reports, activity

- **Day tracking:** `daily_work_sessions` + `work_logs` are the only model.
  - Remove `workdayService`, `workSessionService`, `todayService`, and the routes `/api/workdays`, `/api/work-sessions`, `/api/daily-plans`, `/api/today`.
  - The legacy tables are dropped in step 3, after their history has been copied into `work_logs`. That copy keeps the original `created_at` and runs with the immutability trigger temporarily disabled inside the migration.
  - `work_logs.session_id` is NOT NULL. For each (user, date) in legacy history without a `daily_work_sessions` row, the backfill first creates a COMPLETED session, respecting `unique (user_id, work_date)`.
  - Add `work_logs.minutes int check (minutes between 1 and 720)`, nullable, so logs can feed `project_tasks.actual_minutes`.
- **Commitments:** add `daily_work_commitments (session_id, task_id, position 1–3, outcome null|'DONE'|'CARRIED'|'BLOCKED', carry_reason text)`.
- **Reports:** `daily_reports` becomes a view over `work_logs` grouped by user, project and date, so project detail pages keep working. `task_updates` merges into `work_logs`, since a progress note is a work log on a task. `updates` stays for project announcements.
- **Activity:** `activity_events` is the only activity table. `activityLogRepository` stops the dual write, and `activity_logs` is dropped in step 3.

### 3.5 Deletions and fixes

- Delete the dead pages and endpoints listed in §2.
- Close the review bypass. `PUT /projects/:id/tasks/:taskId` rejects any `canonical_status` change. Status changes only go through `/api/tasks/:id/{start,pause,block,unblock,request-review,approve,reject,complete}`.
- Fix the CEO 403. `dailyWorkService.admin` uses `canApproveAgentWork` (CEO or MANAGER).
- Align the frontend `canApproveAgentWork` with the backend, so Lead is included.
- Rename `0021_users_account_status_schema_cache.sql` → `00211_…` and `0022_productive_workday_time.sql` → `00221_…`. The pairs are independent, so order doesn't matter. The runbook includes `supabase migration repair` for the hosted database.

## 4. Phase 1 — task-first workflow

All rules live in a new pure module, `backend/src/policies/workGatePolicy.ts`. The limits are read from a new `org_settings` table (one row per organization) with these defaults:

| Setting | Default |
|---|---|
| `max_active_projects_per_owner` | 2 |
| `max_active_projects_org` | 6 |
| `max_in_progress_per_person` | 2 |
| `max_daily_commitments` | 3 |
| `stale_project_days` | 5 |
| `stale_task_days` | 3 |

### 4.1 Project lifecycle

| Transition | Who | Guard |
|---|---|---|
| → DRAFT (Proposed) | anyone who can create projects; idea conversion | name only |
| DRAFT → PLANNING (Ready) | owner, PM, CEO | **brief complete**: objective, success criteria (≥1), owner, target date, ≥1 milestone, ≥1 task, every task has assignee + estimate |
| PLANNING → ACTIVE | PM, CEO | brief still complete; owner < per-owner cap; org < org cap. CEO may override a cap with a required reason, which is logged to `activity_events` |
| ACTIVE → ON_HOLD (Parked) | owner, PM, CEO | reason required |
| ON_HOLD → ACTIVE | PM, CEO | caps apply |
| ACTIVE → COMPLETED | existing `validate-completion` / `finish` | unchanged |
| any → CANCELLED | PM, CEO | reason required |

STANDING projects skip the lifecycle entirely.

**The brief is collected in the Brief tab, not at creation.** `CreateProjectModal` still asks only for the name. The PM agent's plan draft pre-fills milestones and tasks.

### 4.2 Task gate

1. **Start my day.** `POST /api/daily-work/start` accepts `commitments: taskId[]` (1 to `max_daily_commitments` items). Each task must be assigned to the user (or list them as a collaborator) and be in READY or IN_PROGRESS, in an ACTIVE or STANDING project.
2. **Log work.** `POST /api/daily-work/logs` **requires** `taskId`. The server checks that the user is the assignee or a collaborator and that the project is ACTIVE or STANDING. `minutes` (optional) is added to `project_tasks.actual_minutes`. A database constraint `work_logs_task_required check (task_id is not null) not valid` enforces this for new rows only.
3. **Quick-add.** `POST /api/daily-work/logs` also accepts `newTask: { title, projectId? }` instead of `taskId`. It creates a READY task assigned to the user with a 60-minute estimate, in `projectId` or, by default, the user's department ops project, then logs against it. It's one request.
   - Team members may quick-add only into STANDING projects or ACTIVE projects they are a member of.
   - Tasks quick-added into DELIVERY projects are tagged `source='QUICK_ADD'` and appear in the Review inbox so the PM sees unplanned scope.
4. **WIP limit.** `/api/tasks/:id/start` fails with 409 if the user already has `max_in_progress_per_person` tasks IN_PROGRESS. The error names those tasks.
5. **End my day.** `POST /api/daily-work/end` requires an outcome for each commitment.
   - A CARRIED outcome increments `carry_forward_count`.
   - If the count exceeds 2, `carry_reason` is required (reusing the `utils/dailyPlanRules.ts` logic).
   - The auto-close job marks unresolved commitments CARRIED without a reason and flags them.

### 4.3 Daily signals

`backend/src/jobs/dailySignals.ts` runs from the existing `server.ts` interval, once per organization per day. It is idempotent via a `signals(org_id, kind, subject_id, date)` unique key. Signals:

- STALE_PROJECT: ACTIVE DELIVERY project with no work log in `stale_project_days` working days.
- STALE_TASK: IN_PROGRESS with no log in `stale_task_days`.
- UNASSIGNED_READY_TASK.
- OVERDUE_PROJECT: past `target_date`.
- REPEATED_CARRY: carried more than 2 times. This replaces the hard-coded `repeatedCarryovers = 0` in health.

Each signal creates a Review inbox item and a notification to the project owner and PM. Signals are stored so Phase 2 agents can read them.

## 5. UI

Sidebar, 7 items:

| Item | Audience | Content | Replaces |
|---|---|---|---|
| My Day (`/`) | all | start/end day, pick ≤3 commitments, log-work box (task picker + quick-add), today's log, month history | Home, `/workday` |
| My Tasks (`/tasks`) | all | my tasks across projects, kanban/list, grouped by project | `/daily-todo` |
| Projects (`/projects`) | all, scoped | portfolio board: Proposed · Ready · Active (n/cap) · Parked · Delivered; stale/overdue badges; filters incl. "has live link" | Projects, Completed, Documents & Links |
| Ideas | all | unchanged; convert → DRAFT project | — |
| Review (`/review`) | PM, Lead, CEO | one inbox: plan drafts, tasks in review, quick-add scope, signals, carry reasons, cap-override requests | AI workspace review queue |
| Team (`/team`) | managers | team day (commitments, logs, blockers, idle), member admin | Team, daily-work admin |
| Insights (`/insights`) | CEO, PM | throughput, cycle time, on-time %, carry rate, active vs cap | Reports |

- **Header:** a notification bell with pinned announcements (replaces `/messages`). Settings live under the profile menu: caps, ops projects, agent prompts (formerly AI workspace).
- **Project page tabs:**
  - **Brief:** readiness checklist with progress, and an Activate button with the reason why it's disabled. The PM-agent plan draft appears here as an approve/edit banner, replacing the assistant tab.
  - **Board:** status columns × milestone lanes, WIP shown.
  - **Docs:** includes live link and private notes.
  - **Activity.**
- **Layout:** reserves a collapsible right-edge **assistant dock** in `Layout`, empty in this phase, for the Phase 2 PM agent.
- **Redirects:** old routes redirect (`/workday` → `/`, `/daily-todo` → `/tasks`, `/documents-links` → `/projects?view=links`, `/completed` → `/projects?stage=delivered`, `/reports` → `/insights`, `/messages` → `/`).
- `DESIGN.md` and `design-contract.md` apply unchanged.

## 6. Migration and rollout

| Step | Migration | Content | Undo |
|---|---|---|---|
| 1 Expand | `0026_task_first_expand.sql` | new columns (§3.1, §3.3, `work_logs.minutes`), `daily_work_commitments`, `org_settings`, `signals`, standing ops projects, `work_logs_task_required … not valid` | additive only |
| 2 Backfill | `0027_task_first_backfill.sql` | `daily_todos`/`workday_items` → tasks; deliverables/features → milestones; `document_link_projects` → projects; legacy workday history → `work_logs`; `task_updates` → `work_logs`; `activity_logs` rows not yet in `activity_events` copied; status → canonical where null | idempotent (source-id markers); sources untouched |
| 3 Contract | `0028_task_first_contract.sql`, separate release ≥1 week later | drop legacy tables/columns; `daily_reports` → view | irreversible; run only after verified backup |

Rollout:

1. Dump production and restore it into local Supabase.
2. Run 0026–0027 there and compare row counts: sources vs migrated, with a per-table count report in the migration's final `raise notice`. Also spot-check 10 users.
3. Deploy backend and frontend together.
4. On the PM's first login after release, the Projects board shows a "Get under the cap" prompt: projects mapped ACTIVE beyond caps must be parked or explicitly overridden. Until then, activation of *new* projects is blocked; existing work continues.
5. After one week without issues, back up and ship 0028.

## 7. Testing

TDD throughout.

- **Unit tests** (`node --test`, existing runner):
  - `workGatePolicy`: every lifecycle transition and guard, brief completeness, each cap incl. CEO override, commitment limits, WIP limit, log authorization, quick-add destination rules, carry-reason rule.
  - `dailySignals` detection functions (pure, given rows).
- **Integration tests** against local Supabase (new `backend/scripts/run-integration-tests.js`, skipped when Supabase isn't reachable):
  - The backfill on seed data produces expected counts.
  - A log without a task gives 400.
  - Activation beyond the cap gives 409.
  - `PUT` with a status change gives 400.
  - Signals are idempotent across two runs.
- **E2E:** one Playwright test: log in → start day with 2 commitments → quick-add → log work → end day with outcomes.

## 8. Out of scope

These get their own specs later:

- **Phase 2:** agent runtime with an OpenRouter tool-calling loop and tiered tools. The PM assistant fills the dock: takes updates, moves cards, creates tasks, answers "what should I work on?", and interviews for project briefs.
- **Phase 3:** co-founder agent with goals/OKRs and a lightweight sales pipeline; daily top-3 and weekly founder review.
- Slack and WhatsApp channels; multi-tenant SaaS concerns.

This spec's hooks for them are the stored signals, the Review inbox, the assistant dock, and the single task model.
