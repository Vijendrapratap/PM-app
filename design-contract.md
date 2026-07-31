# Design and Product Contract

## Goal and target artifact

Design a role-aware project operating system for Pratap AI where human team members and controlled AI agents collaborate on one shared project model. The first target artifact is a responsive web application redesign covering role dashboards, a canonical project workspace, agent review flows, notifications, and team-day scheduling.

Primary audiences are Pratap as CEO/Super Admin, Govind as Project Manager and accountable approver, Anush MK as Tech Lead, and assigned Team Members.

## Core need

The organization needs a single source of delivery truth. Today, project data exists, but planning, documentation, approvals, daily work, and change awareness are not yet one controlled workflow. The desired agents are useful only if their outputs enter that workflow as versioned drafts with ownership, review, and audit history.

The system therefore optimizes for five outcomes:

1. A new project becomes an executable, reviewable plan quickly.
2. Govind controls what becomes official without manually producing every artifact.
3. Each role sees the information and actions relevant to its responsibility.
4. All views—dashboard, kanban, calendar, documents, and daily work—read from shared records.
5. Meaningful changes are visible across the platform without notification overload.

## Evidence

| Evidence | Confidence | Finding |
|---|---|---|
| User’s role and agent workflow description | Provided | Two agents are required; Govind approves or edits outputs; CEO, PM, and Lead can edit; Team Members are project-scoped. |
| Reference 1: Taskify dashboard | Observed | Labeled left navigation, compact utility header, summary strip, view switcher, task-first kanban, dense readable work cards. |
| Reference 2: warm fitness dashboard | Observed | Inset warm shell, compact rail, dark calendar, yellow signal accent, asymmetric bento layout, repeated progress rows, soft surfaces. |
| Reference 3: “Black and Gold Elegance” palette | Provided / observed | White `#FFFFFF`, light gray `#E5E5E5`, orange-gold `#FCA311`, navy `#14213D`, and black `#000000`; user explicitly requested light gold and bone in place of yellow/orange and cool gray. |
| Existing repository | Observed | React/Vite frontend, Express/Supabase backend, authentication, three roles, projects, tasks/subtasks, uploaded documents, point notifications, activity logs, and newly added workday flow already exist. |
| Current role utilities | Observed | Team Member, Lead, Project Manager, and Super Admin are modeled; role dashboards still share too much presentation and need distinct information priorities. |
| Current project screen | Observed | Project information, updates, tasks, uploads, documentation checklist, and daily reports exist in one long page but lack a stable tabbed workspace and versioned approvals. |
| Single-company operation | Inferred | Initial release can remain single-organization unless multi-company support is planned. |
| Govind is the default project-plan/document approver | Provided / inferred boundary | Govind approves by default; Super Admin may override. Leads review but do not publish agent drafts unless explicitly delegated. |

## Reference boundaries

| Keep | Change | Do not copy |
|---|---|---|
| Warm neutral canvas and soft inset application shell from Reference 2 | Replace fitness content with project health, approvals, agent runs, blockers, and delivery work | Exact layout proportions and card placement |
| Labeled navigation and task-first board from Reference 1 | Make navigation role-aware and use existing Pratap AI task data | Taskify logo, copy, IDs, card composition, and brand assets |
| Collapsible navigation behavior across both references | Default to labeled midnight-navy sidebar; collapse to icon rail on demand | Either reference's navigation icons or exact spacing |
| Near-black calendar/attention module | Build person-by-day delivery calendar and approval modules | Training-day calendar semantics and dates |
| One warm signal accent and a separate exception color | Use restrained light gold for selection and vermilion only for blockers | Calorie colors, metrics, labels, and bubble sizes |
| Asymmetric high/low density composition | Make project workspace tabs canonical rather than showing everything at once | Workout bubble visualization as a literal project chart |
| Compact repeated progress rows | Use for features, tasks, team-day outcomes, and approval items | Habit/trainer content and row copy |
| Strong navy/black anchoring and crisp white contrast from Reference 3 | Warm the cool gray into bone and soften orange into light gold; retain vermilion only for blockers | The reference image, exact swatch composition, furniture imagery, title treatment, and saturated orange |

## Product model and workflow

### 1. New project intake

The creator supplies a minimum viable brief: problem, target user, desired outcome, constraints, deadline preference, owner, and known documents. A project starts in `Intake`, not immediately `In Progress`.

Creating the project emits `project.created` and queues the Project Management Agent. The HTTP request should finish immediately; agent work runs asynchronously with retries and idempotency.

### 2. Project Management Agent

The agent reads the immutable project-input snapshot and creates a **Planning Draft** containing:

- assumptions and clarification questions;
- feature hierarchy and desired outcome per feature;
- acceptance criteria;
- executable tasks and subtasks;
- dependencies and sequencing;
- suggested owners or required skills;
- estimates expressed as ranges, with confidence;
- milestones, risks, and proposed delivery forecast.

The run ends in `Ready for review`. It must not directly create approved tasks or dates.

Govind reviews a structured diff, edits inline, and chooses `Approve plan`, `Request changes`, or `Regenerate selected section`. Approval publishes one version of features and tasks atomically and records the approver and timestamp.

### 3. Business Analyst Agent

Approval of the detailed plan emits `project.plan.approved` and queues the Business Analyst Agent. It creates a versioned initial documentation set:

- project overview;
- business requirements document;
- functional requirements mapped to features;
- non-functional requirements;
- user roles and primary flows;
- acceptance matrix;
- assumptions, exclusions, open questions, and risks;
- glossary and traceability links to features/tasks.

Documents start as `Draft`, then move to `In review`, `Approved`, or `Superseded`. Govind can edit in a proper document workspace and approve a specific version. Agent regeneration never overwrites human edits; it produces a new proposed version with a diff.

### 4. Execution and shared truth

Approved tasks power the project board, personal task lists, workday commitments, calendar, progress reporting, and dashboards. A status update is one write to one task; all views reflect it. Project progress should be derived from weighted feature/task completion where possible, with an explicit manual override and audit reason.

### 5. Change awareness

Every meaningful save emits a domain event and an immutable audit record. Notification rules resolve recipients by role, assignment, ownership, and watch status.

High-priority immediate events:

- agent draft ready for review;
- plan or document approved/rejected;
- blocker created, escalated, or resolved;
- milestone/date/scope/owner changed;
- task reassigned or moved into review;
- project status changed.

Low-priority edits are grouped into an activity digest. Notifications describe the change and link to its source; they do not simply say “Project updated.”

## Roles and permissions

| Capability | CEO / Super Admin | Project Manager | Lead | Team Member | Agent service account |
|---|---:|---:|---:|---:|---:|
| View all portfolios and people | Yes | Yes | Assigned portfolio/projects | No | No |
| Create projects | Yes | Yes | Optional by policy | No | No |
| Edit project scope, dates, team | Yes | Yes | Assigned projects | No | No |
| Create/edit features and tasks | Yes | Yes | Assigned projects | Own task status/comment only | Draft output only |
| Approve agent plan/documents | Override | Yes | Review/request change | No | No |
| Manage roles | Yes | No | No | No | No |
| Edit/version agent system prompts | Yes | Yes | Assigned/project agents | No | No |
| View documents | All | All | Assigned projects | Approved docs for assigned projects | Run-scoped context |
| Daily work and blockers | Own + overview | Own + team overview | Own + assigned-team overview | Own | No |
| Delete/restore project records | Yes | Policy-controlled | No | No | No |

Lead must become a first-class role. Permissions should be capability-based on the backend, not inferred from hidden buttons.

## Dashboard information architecture

### CEO / Super Admin

Portfolio health is primary. Show delivery confidence, approvals waiting, scope/date movement, cross-project blockers, capacity risks, and agent run health. Avoid showing every task by default.

### Project Manager

The first screen is a decision queue: agent drafts awaiting review, blockers needing escalation, projects drifting from forecast, unassigned work, and today’s team commitments. Govind should be able to approve or open a review in one click.

### Tech Lead — Anush MK

Focus on assigned-project health, feature progress, technical tasks in review, team blockers, release readiness, and upcoming milestones. Anush can edit project-scoped agent prompts and request/regenerate drafts, but final plan/document publication remains with Govind or Pratap.

### Team Member

Lead with `My Workday`, then assigned task board, blockers, recent project decisions, approved documents, and personal calendar. Do not expose unrelated portfolios or private people data.

## Canonical project workspace

- **Overview:** objective, scope, outcome, project health, next milestone, major risks, recent decision.
- **Plan:** feature tree, estimates, dependencies, milestones, plan versions and approval state.
- **Board:** kanban/list views of approved tasks, filters, task drawer, acceptance criteria.
- **Documents:** editable/versioned documents, review comments, approval status, traceability.
- **Team:** roles, allocation, ownership, availability, project-specific permissions.
- **Activity:** meaningful audit timeline with diffs and agent/human attribution.
- **Calendar:** project milestones and team-day work derived from tasks/workdays.

## Calendar contract

The calendar is a projection, not a separate planning tool.

- Manager desktop view: team members as rows, days as columns; outcomes and tasks as compact blocks.
- Member view: personal day/week with planned outcomes, deadlines, and meetings if later integrated.
- Blocked work is vermilion, completed work is green, approved scheduled work is light gold, absence is muted hatch.
- Clicking a block opens a side panel with project, task, acceptance criteria, status, blocker, owner, and edit permissions.
- Filters: project, person, status, department, and work type.
- Never use it to reward long hours; show outcome load, overlap, and aged blockers.

## Data and system additions

Recommended concepts:

- `project_features` and feature dependencies;
- task estimate range, confidence, start date, feature link, and source version;
- `plan_versions`, `approval_requests`, and review comments;
- `documents` plus immutable `document_versions` and approvals;
- `agent_definitions`, `agent_runs`, input snapshots, outputs, status, retry metadata, and cost/usage fields;
- event-backed `audit_events` and notification preferences/watchers;
- capability-based role policy including Lead;
- existing workdays and project tasks as calendar inputs.

Agents should execute in a background worker/queue, use structured JSON contracts, validate output before persistence, and write only drafts. Each job must be idempotent and tied to a project/version so retries cannot duplicate features or tasks.

## Final design stance

Build a midnight bone operations studio: Taskify's immediate navigation and board clarity combined with an inset bone shell, asymmetric bento rhythm, deep navy navigation, black focus actions, crisp white work surfaces and restrained light-gold signals. Team Members land directly on simple task updates; Govind, Anush, and Pratap progressively gain decisions, team visibility, portfolio scope, and Agent Studio access. Automation stays visible but quiet: agents appear as accountable draft authors and configurable services, not a separate chatbot universe.

## Risks and explicit unknowns

- The first slice supports an optional OpenAI Responses API provider (`gpt-5.5` by default) with a local fallback; production cost ceilings and organization-specific retention policy still need approval.
- Required editable document format is unknown: rich text, Markdown, DOCX export, or all three.
- Estimation unit may vary by project; the system should support hours/days or relative points without pretending precision.
- Whether Leads may approve agent drafts is unresolved; default is review-only.
- External notification channels such as email, Slack, or WhatsApp are not specified.
- Current daily reports and the new workday flow overlap; they should be consolidated during implementation.
- Existing project edit permissions are broader/narrower than the requested role model and require a deliberate migration.

## Quality gate

- [ ] Agent output is always labeled Draft until a named human approves it.
- [ ] Govind can edit, compare, approve, reject, or selectively regenerate agent output.
- [ ] Project, board, calendar, dashboard, and workday views share records.
- [ ] Team Members cannot access unrelated project or people information through UI or API.
- [ ] Lead is a backend-enforced role with explicit capabilities.
- [ ] Every meaningful edit produces one useful audit event and appropriate notification.
- [ ] Project facts are reachable from the canonical project workspace in two interactions or fewer.
- [ ] Calendar highlights load and blockers without ranking people by hours.
- [ ] Responsive and keyboard workflows cover planning review, document review, and task updates.
- [ ] The UI follows the reference qualities without copying its protected content or exact composition.
- [ ] Core UI uses navy, black, white, bone and light gold; saturated orange/yellow is absent outside semantic warning states.
