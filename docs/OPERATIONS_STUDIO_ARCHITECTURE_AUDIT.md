# Pratap AI Operations Studio — Repository Audit

Date: 2026-08-02
Specification target: Operations Studio v1.0
Baseline commit state: clean worktree before this document was added

## Executive summary

The repository already contains a usable operations portal and should be extended rather than replaced. Its strongest reusable foundations are the Express service/repository boundary, Supabase/Postgres persistence, JWT request authentication, project membership relation, daily `workdays` flow, notifications, immutable-in-practice activity logging, and a human-reviewed PM/BA agent workflow.

The implementation will preserve the React/Vite and Express/Supabase stack. New concepts will be introduced through additive migrations and compatibility mappings. Legacy `workdays`, `project_tasks`, and `activity_logs` will remain readable while their v1 equivalents are introduced or normalized. Existing API response casing (`_id`, camelCase) remains the client contract until a separately versioned API is justified.

## Current architecture

| Concern | Current implementation | v1 implementation direction |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 | Preserve; add role-aware routes and composed Today UI |
| Backend | Express 5, TypeScript, controller/service/repository layers | Preserve; put authorization in reusable policy services |
| Database | Supabase-hosted PostgreSQL, ordered SQL migrations | Add backward-compatible migrations after `0009` |
| ORM/data access | Supabase JS query builder, no ORM | Preserve repository conventions |
| Authentication | Email/password with bcrypt, JWT bearer token, current user reloaded per request | Preserve; add organization and normalized role claims from DB state |
| Authorization | String-role helpers plus project membership checks | Replace ad-hoc checks with centralized role/scope policies while retaining legacy aliases during migration |
| Client state | Component state, hooks, Auth context, Axios API modules | Preserve; no global state library is currently required |
| Validation | Zod request schemas and validation middleware | Preserve and extend |
| Uploads | Multer plus Supabase Storage | Preserve behind attachment services |
| AI | Provider abstraction, PM/BA definitions, reviewed plan/document versions | Generalize to agent runs and idempotent proposals; no direct agent DB access |
| Tests | No automated test suite configured | Add backend unit/integration tests first; add frontend/E2E harness with feature phases |
| Deployment | Vercel descriptors for both apps; backend comments also reference Railway | Preserve deployment entry points and env conventions |

## Current routes and modules

### Frontend routes

- `/`: role-dependent dashboard/demo dashboard
- `/projects`, `/projects/:id`, `/completed`: project portfolio and delivery
- `/team`: team administration/visibility
- `/daily-todo`: legacy personal todos
- `/workday`: start/close workday and manager pulse
- `/ideas`: idea bucket
- `/agents`: current top-level agent administration/review surface
- `/messages`: Super Admin important messages
- `/login`, `/admin/login`, `/register`: authentication

### Backend modules

- Authentication and users
- Projects, memberships, updates, reports, files, tasks, subtasks and comments
- Daily todos and workdays
- Ideas
- Notifications and activity logs
- PM/BA agent definitions, runs, plan versions, published features/tasks and knowledge-document versions

## Existing data model mapping

| v1 concept | Existing concept | Decision |
|---|---|---|
| Organization | implicit single organization | Add `organizations`; backfill a default organization |
| Department | `users.department` / `projects.department` text | Add `departments`; retain text as a compatibility projection during rollout |
| CEO | `Super Admin` | Canonicalize to `CEO`; accept legacy value at boundaries during migration |
| Manager | `Project Manager` and `Lead` | Canonicalize to `MANAGER`; move Lead/PM to `designation` |
| Team Member | `Team Member` | Canonicalize to `TEAM_MEMBER` |
| Daily Plan | `workdays` | Extend/rename behavior without destructive table replacement |
| Daily Plan Item | `workday_items` | Extend with source, ordering, estimate, end state and carryover metadata |
| Work Session | check-in/check-out on `workdays` | Add separate `work_sessions` for multiple and cross-midnight sessions |
| Project Task | `project_tasks` | Normalize status fields and add milestone/deliverable/task metadata |
| Milestone | no direct equivalent (`project_features` is closest) | Add `milestones`; keep agent features readable during migration |
| Deliverable | `project_features` is partial equivalent | Add `deliverables`; agent publication targets the new hierarchy after cutover |
| Blocker | task status/reason and workday-item reason | Add first-class `blockers`; keep task `blocked` as a condition |
| Activity Event | `activity_logs` | Add structured append-only fields/table and dual-write during migration |
| Project Document | uploaded files plus knowledge documents/versions | Preserve uploads; normalize authored documents and version metadata |
| Agent Proposal | plan/document versions | Generalize into explicit proposal actions and approvals |

## Reusable UI and theme

Reusable components include `Layout`, `Sidebar`, `Header`, `NotificationBell`, `ConfirmDialog`, project/task modals, `TaskDetailPanel`, `SharedStartDayPlanner`, leadership/team-member dashboards, and `AgentWorkflowPanel`.

The visual system is custom CSS rather than a component framework. It uses a compact icon rail, white/slate surfaces, blue primary actions, rounded cards and modal primitives, Lucide icons, responsive grid/list patterns, and shared badge/button/card classes from `index.css`. New components should consume these existing primitives before introducing new tokens.

## Important gaps and risks

1. Roles are free-text and currently include four values (`Super Admin`, `Project Manager`, `Lead`, `Team Member`) instead of the required three canonical roles.
2. Public self-registration is currently supported, conflicting with CEO-only invitations.
3. Organization and department boundaries are not first-class database resources.
4. Several comments describe project visibility as transparent, while v1 requires strict assigned/managed scope.
5. Task write access currently permits assigned members to perform structural edits through broad project edit checks.
6. Task status uses `Blocked` as a status; v1 requires an independent blocker condition.
7. Dubai timezone is hard-coded in the workday service instead of organization/user configuration.
8. `activity_logs` contains prose rather than structured event type/entity/payload/correlation data.
9. Some repositories hard-delete records that must retain history.
10. Agent plan publication is human-approved but is not yet a generic proposal/diff/idempotency transaction model.
11. The current top-level Agent Studio conflicts with contextual agent placement; administration can move to settings while project assistance remains contextual.
12. No automated test or E2E harness exists. Baseline confidence currently comes from builds and lint only.
13. The frontend production bundle is approximately 635 kB before gzip and should be route-split during later refinement.
14. Baseline lint passes with five warnings in existing code; these should be removed as touched areas are refactored.

## Implementation map

### Phase 1 — data and policy foundation

- Add default organization and departments, canonical roles, designation/manager/timezone/capacity/status fields.
- Add milestones, deliverables, structured activity events and scope/permission metadata.
- Introduce authorization policies for organization, project management, membership, ownership and invitation.
- Use compatibility role helpers so existing sessions and rows continue to work during backfill.
- Add append-only enforcement and soft-delete conventions.

### Phase 2 — Today

- Evolve `workdays` into the Daily Plan API contract.
- Add sources/carryover metadata to plan items and separate work sessions/blockers.
- Add a composed `/api/today` service and role-specific summaries.
- Replace dashboard request fan-out with the composed payload incrementally.

### Phase 3 — project hierarchy

- Add milestone/deliverable services and task status compatibility.
- Introduce task-action endpoints, review flow, board projections and health signals.
- Retain old project/task endpoints while new routes are adopted by the UI.

### Phases 4–8

- Scope team views using department/project policies.
- Extend ideas and conversion lineage.
- Generalize agent runs into proposal actions applied only by application services.
- Normalize project documents, approvals, case studies, reports and digests.

## Migration and rollback plan

1. Every migration is additive first: nullable columns, new tables, indexes and constraints that accept both legacy and canonical values.
2. Backfill the default organization, departments, canonical roles and foreign keys in deterministic SQL.
3. Deploy code that can read both legacy and canonical values and dual-write critical compatibility fields.
4. Migrate UI/API consumers in slices. Do not remove old endpoints during v1 implementation.
5. Tighten `NOT NULL`/check constraints only after backfill verification queries succeed.
6. Prefer feature flags for composed Today, normalized task statuses and proposal application until production data is verified.
7. Rollback is performed by disabling the feature flag and deploying the previous code. Additive tables/columns remain in place; no production rollback requires destructive SQL.
8. Destructive cleanup of legacy columns/tables is explicitly outside these phases and requires a later retention-reviewed migration.

## Baseline verification

Executed on 2026-08-02:

- Backend TypeScript build: pass
- Frontend TypeScript and Vite production build: pass
- Frontend Oxlint: pass with five pre-existing warnings
- Automated tests at baseline: unavailable because no test command/harness existed; the implementation now adds a backend test command and rule tests
- Backend local runtime: blocked in this workspace by missing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`
- Frontend local runtime: reachable at `http://127.0.0.1:5173/`

## Phase 0 done criteria

- [x] Framework, routing, auth, database, roles, UI, theme, API and state approach inventoried
- [x] Existing product modules and overlaps mapped
- [x] Risks and permission mismatches identified
- [x] Additive migration and rollback approach defined
- [x] Baseline build and lint executed
- [x] No application functionality changed
