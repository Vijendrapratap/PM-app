# Role Experience Map

This file is the permission and dashboard contract for the role-first redesign. UI visibility never replaces backend authorization.

## 1. Team Member

### Sees

- `My work` as the default home: current workday, up to three outcomes, assigned tasks, due dates and acceptance criteria.
- Assigned-project kanban/list views only.
- Personal week calendar derived from task dates and workday commitments.
- Own blockers and blocker responses.
- Approved project decisions, documents and meaningful notifications for assigned projects.

### Can update

- Start and close own workday.
- Task status, progress note, blocker reason, comments and attachments on assigned work.
- Own selected outcomes and closeout remarks.

### Cannot update or see

- Unrelated projects, portfolio financials, private team capacity, agent drafts or prompts.
- Project scope, dates, team assignment, approvals, roles or organization settings.

## 2. Project Manager — Govind

### Sees

- All projects, people, team-day commitments, capacity, overdue/unassigned work and delivery forecast.
- PM/BA agent runs, drafts, failures, prompt versions and approval queue.
- Full project plan, board, documents, team, activity and calendar.

### Can update

- Project brief, scope, dates, members, features, tasks, estimates and status.
- Agent plan/document drafts before approval.
- Approve and publish plan/document versions.
- Edit, test, publish and roll back agent system prompts with audit history.

## 3. Tech Lead — Anush MK

### Sees

- Assigned projects and team delivery, technical features, review queue, blockers, dependencies and release readiness.
- Agent drafts and prompt versions for assigned project workflows.

### Can update

- Assigned-project features, technical tasks, estimates, acceptance criteria, dependencies and task reviews.
- Request agent regeneration and edit project-scoped system prompts.
- Add architecture decisions, risks and blocker responses.

### Cannot update

- Company roles, unrelated projects or final agent plan/document approval unless explicitly promoted.

## 4. CEO / Super Admin — Pratap

### Sees

- All portfolio health, forecasts, scope/date movement, company blockers, capacity risk, approvals and agent health.
- All projects, people, documents, audit history and prompt versions.

### Can update

- Everything Govind can update, plus role management, organization policy, agent governance and approval override.
- Edit, test, publish and roll back global agent system prompts.

## Shared navigation contract

- Team Member: Home, My work, Projects, Calendar, Notifications.
- Govind: Overview, Projects, Team pulse, Calendar, Approvals, Agent Studio.
- Anush: Delivery, Projects, Reviews, Team pulse, Calendar, Agent Studio.
- Pratap: Portfolio, Projects, People, Calendar, Governance, Agent Studio.

The sidebar is labeled and light at desktop widths, collapsible to icons, and becomes a five-action bottom dock on mobile.
