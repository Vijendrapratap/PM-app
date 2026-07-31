# Implementation Handoff

## Implemented vertical slice (2026-07-31)

- Lead is a first-class role; CEO/Super Admin and Project Manager can see and manage all projects, while Lead and Team Member access is project-scoped.
- New projects trigger a Project Manager Agent draft containing features, executable tasks, acceptance criteria, estimates, assumptions, risks, and questions.
- Govind/Project Manager or Super Admin can edit and approve a specific plan version. Approval publishes retry-safe shared feature/task records.
- Plan approval triggers the Business Analyst Agent, which creates a versioned BRD draft. Approval is explicit and version-bound.
- Project Plan and Documents tabs, document history, agent status, review actions, notifications, activity entries, and the dashboard approval queue are implemented.
- The daily Workday flow supports check-in commitments, progress/blockers, closeout, manager team pulse, and a closeout reminder on sign-out.
- Draft generation uses the local structured provider by default. A backend-only `OPENROUTER_API_KEY` switches it to OpenRouter (`deepseek/deepseek-v4-flash` by default); direct OpenAI remains supported as a secondary hosted option.

### Activation

1. Apply `backend/supabase/migrations/0007_daily_workflow.sql` and `0008_agent_workflow.sql` in order.
2. Deploy the backend with the existing required environment variables. Add `OPENAI_API_KEY` only when hosted model drafting is wanted; never expose it to the frontend.
3. Deploy the frontend against that backend, then create a test project and approve its generated plan and BRD.
4. Before high-volume production use, move hosted model runs from the project-create request into a durable background queue. The current synchronous trigger is appropriate for this first slice and the instant local provider, but a queue is needed for durable retries across server restarts/timeouts.

## Read first

1. `DESIGN.md`
2. `design-contract.md`
3. Existing role utilities, project service, task service, notifications, activity logs, workdays, and `ProjectDetails.tsx`

## Build order

1. **Governance foundation:** add Lead, capability checks, project-scoped access, audit events, notification recipients/watchers.
2. **Canonical project model:** add features, plan versions, task estimates/dependencies, approval requests, and derived progress.
3. **Project workspace:** replace the long project page with Overview, Plan, Board, Documents, Team, Activity, and Calendar tabs.
4. **Agent infrastructure:** background jobs, structured output validation, agent runs, retries, draft persistence, review diff.
5. **PM Agent:** trigger on project creation; produce plan draft; Govind edits/approves; publish atomically.
6. **BA Agent:** trigger on plan approval; produce versioned documentation; Govind edits/approves.
7. **Role dashboards and calendar:** read from the shared project/task/workday/event model.

## Binding constraints

- Agents can create drafts only; they cannot approve, publish, delete, or notify the whole organization directly.
- Govind is the default approver; Super Admin can override with an audit reason.
- One project/feature/task record powers board, calendar, workday, progress, and dashboards.
- Use event-driven notifications after successful writes; group low-value edits.
- Preserve the existing React, Express, and Supabase stack.
- Use Space Grotesk + Inter, warm neutrals, charcoal, yellow-gold, coral, and green from `DESIGN.md`.
- No purple/blue AI gradients, robot imagery, generic chat-first agent UI, or equal-card dashboard grids.

## First artifact should prove

Build one vertical slice: create a project → PM Agent run appears → structured feature/task draft → Govind edits and approves → approved plan populates the project Board → BA Agent starts and returns one versioned BRD draft → Govind reviews and approves → activity and notifications show the full chain.

Acceptance requires backend permission enforcement, immutable version/audit history, failure/retry states, responsive UI, keyboard operation, and no duplicate records after retried agent jobs.
