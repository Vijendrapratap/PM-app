# Operations Studio v1 — Implementation Status

Date: 2026-08-03

This document maps the v1 specification to the implementation now present in this repository. The original React/Express/Supabase architecture and visual language are preserved.

## Phase checklist

### Phase 0 — audit and protection

- [x] Repository, routes, auth, data access, roles, state, components, and theme audited
- [x] Additive migration and rollback strategy documented
- [x] Baseline build and lint recorded

### Phase 1 — roles, departments, and data foundation

- [x] Canonical `CEO`, `MANAGER`, and `TEAM_MEMBER` roles with legacy aliases
- [x] Designation separated from platform role
- [x] Organization and department records/backfill
- [x] Central role/scope policies and current-database-state authorization
- [x] Milestone/deliverable hierarchy
- [x] Append-only structured activity events with legacy dual-write
- [x] Organization/user timezone support and soft archival

### Phase 2 — Today and the daily workflow

- [x] Composed `GET /api/today`
- [x] Today-first default route and role-aware navigation
- [x] Plan My Day with suggestions, sources, capacity warning, and primary outcome
- [x] Confirmed carryover handling and repeated-carryover reasons
- [x] Work sessions, including cross-midnight duration handling
- [x] Task start/pause/update/review/complete actions
- [x] First-class blockers independent of task status
- [x] Close My Day, explicit incomplete-item outcomes, reopen audit
- [x] Manager team pulse

### Phase 3 — projects and execution

- [x] Three-step project creation wizard with AI/manual planning choice and final review
- [x] Delivery-first project workspace with Structure/Kanban views, Documents, AI plan, and a persistent activity rail
- [x] Milestone and deliverable management
- [x] Five-column canonical task board and task drawer actions
- [x] First-class blocker reporting and resolution inside the task drawer
- [x] Review workflow and structured project activity feed
- [x] Project-health recommendation and human override
- [x] Closure validation for tasks, blockers, milestones, and deliverables

### Phase 4 — team and onboarding

- [x] Organization/scoped Team API
- [x] CEO-only invitation endpoint
- [x] Manager visibility limited to managed projects/departments
- [x] First-login onboarding for timezone, working hours, and notification preference
- [x] Invitation and account-status enforcement on every authenticated request

### Phase 5 — Idea Bucket

- [x] Canonical lifecycle from Inbox through review, approval, incubation, and conversion
- [x] One-minute capture with progressive optional fields
- [x] 1–5 scoring and calculated priority
- [x] Author-before-review edit boundary and Manager/CEO decisions
- [x] CEO-approved conversion to a linked draft project
- [x] Source idea remains intact and archived ideas retain history

### Phase 6 — proposal-based AI

- [x] Existing PM/BA provider abstraction retained
- [x] Durable agent-run metadata extended
- [x] Explicit proposal summaries, assumptions, warnings, and action allowlist
- [x] Human review/diff surface remains contextual inside the project
- [x] Server revalidates role and project scope on apply/reject
- [x] Idempotent claim/apply state and duplicate publication guards
- [x] Applied/rejected proposal activity events
- [x] No agent receives SQL, ORM, filesystem, or secret access

### Phase 7 — BA documents

- [x] Versioned project knowledge documents and approvals
- [x] Source references, missing-information flags, and AI provenance
- [x] Confirmed Requirement / Assumption / Open Question classifications
- [x] Document creation, edit, submit-review, and approval endpoints
- [x] BA approval represented as an agent proposal

### Phase 8 — case studies, reports, and refinement

- [x] Source-grounded retrospective, external draft, and demo package
- [x] Metric provenance validation and confidentiality flags
- [x] Manager editing and CEO-only external approval
- [x] Role-scoped report payload with links to source projects/tasks/blockers
- [x] Immediate-versus-digest notification routing rules
- [x] Responsive onboarding, Ideas, project wizard, and case-study workspace
- [x] Route-level code splitting (main JS reduced from roughly 650 kB to roughly 302 kB before gzip)

## Database rollout order

Apply the existing migrations first, followed by:

1. `0010_operations_foundation.sql`
2. `0011_today_workflow.sql`
3. `0012_project_execution.sql`
4. `0013_team_onboarding.sql`
5. `0014_idea_bucket.sql`
6. `0015_agent_proposals.sql`
7. `0016_project_knowledge.sql`
8. `0017_case_studies.sql`
9. `0018_agent_prompt_storage_repair.sql`
10. `0019_personal_work_routines.sql`
11. `0020_project_module_terminology.sql`

For local/demo data, run `backend/supabase/seed_operations_studio.sql` after all migrations. The nine seeded Pratap AI team accounts use `Demo@123` and `.local` email addresses documented in that script.

## Primary new API surfaces

- Today/daily plans: `/api/today`, `/api/daily-plans`, `/api/work-sessions`
- Task actions: `/api/tasks/:id/start|pause|update|block|unblock|request-review|approve|reject|complete`
- Hierarchy: `/api/projects/:id/milestones`, `/api/milestones`, `/api/deliverables`
- Team/onboarding: `/api/team`, `/api/team/invite`, `/api/team/onboarding`
- Ideas: `/api/ideas/:id/review|approve|reject|convert`
- Agent contract: `/api/agents`, `/api/agent-runs`, `/api/agent-proposals`
- Documents: `/api/projects/:id/documents`, `/api/documents`
- Case studies: `/api/agents/case-study/run`, `/api/case-studies`
- Reports: `/api/reports/overview`

## Verification

- Backend TypeScript build: passing
- Frontend TypeScript + production build: passing
- Backend unit tests: 29 passing
- Frontend lint: passing with no warnings
- `git diff --check`: expected to pass before handoff

## Production rollout gates

These are environment/release activities, not silent code assumptions:

1. Apply migrations to a staging Supabase project and run the seed only in development.
2. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`; configure an AI provider only if hosted generation is desired (the local structured provider remains available).
3. Exercise the eight acceptance scenarios against staging data. This repository had no existing E2E harness; add Playwright to the deployment pipeline before declaring the production release complete.
4. Validate email/digest delivery through the deployment's notification provider. The repository currently persists routed notifications but does not contain an external email transport.
5. Run accessibility tooling and manual keyboard/screen-reader checks in the deployed browser environment.

The code is intentionally backward-compatible. Legacy routes and data projections remain available so rollout can be staged without destructive cleanup.
