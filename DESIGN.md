# Pratap AI Operations Studio — Design System

## 1. Visual Theme & Atmosphere

**Direction: Midnight bone operations studio.** The product should feel focused, capable, and quietly premium: task-first clarity inside a bone application shell, anchored by deep navy navigation and black primary actions. White work surfaces keep dense information readable, while a soft light-gold accent adds warmth without the visual loudness of saturated yellow.

Reference 1 contributes a labeled collapsible sidebar, utility header, compact task summaries, prominent kanban controls, and dense readable work cards. Reference 2 contributes the inset shell, asymmetric bento composition, dark calendar/decision surface, generous internal spacing, and small areas of signal color. Reference 3 contributes the black, navy, white and light-neutral contrast structure; its orange is deliberately softened into light gold and its cool gray is warmed into bone. The product must not copy any reference's brand, exact card arrangement, icons, copy, or domain-specific visualizations.

Every screen should have one dominant decision area. Supporting information should be quieter and progressively disclosed. Dense operational screens may contain significant data, but never as an undifferentiated wall of cards.

## 2. Color

Use color by meaning, not decoration.

| Token | Value | Use |
|---|---:|---|
| Bone canvas | `#EDE8DC` | App background outside the primary shell |
| Bone shell | `#F5F1E7` | Main application frame and quiet panels |
| White surface | `#FFFFFF` | Primary work surfaces and forms |
| Light neutral | `#E5E5E5` | Dividers, disabled controls and secondary fills |
| Midnight navy | `#14213D` | Navigation, featured panels and primary text |
| Black | `#000000` | Highest-emphasis actions and compact focus surfaces |
| Secondary text | `#4F586A` | Explanations and metadata |
| Muted text | `#777E89` | Timestamps and low-priority labels |
| Light gold | `#D8C27A` | Selected states, active indicators and warm highlights |
| Deep gold | `#9B7D35` | Accessible links, labels and focus borders on light surfaces |
| Completion green | `#2F7D5B` | Approved, completed and healthy |
| Blocker vermilion | `#D9533F` | Blocked, failed and destructive actions only |

Rules:

- Light gold is the single decorative accent; do not use saturated yellow/orange, purple, or electric-blue gradients.
- Vermilion is reserved for exceptions and blockers, never generic decoration.
- Use midnight navy or black for navigation, calendar, approval queues and decision-focused modules—not random page sections.
- Meet WCAG AA contrast for text and controls. Light gold carries navy text, never small white text.

## 3. Typography

- Display and navigation: `Outfit`, weights 600–750.
- Body and controls: `Manrope`, weights 400–700.
- Data: use tabular numerals via `font-variant-numeric: tabular-nums`.
- Page title: 32–44px desktop, 28–34px tablet/mobile; tracking `-0.04em`.
- Section title: 18–22px; compact line height.
- Body: 14px for repeated product UI; 15–16px for descriptions.
- Metadata: 11–12px with normal sentence case. Avoid all-caps except short operational labels.
- Keep paragraphs below roughly 65 characters per line.

## 4. Spacing & Grid

- Base spacing unit: 4px. Default rhythm: 8, 12, 16, 24, 32, 48.
- Desktop shell: max-width 1480px with 18–24px outer inset.
- Navigation: 220px labeled sidebar by default; 72px collapsed mode; bottom dock on mobile.
- Header: 68–76px.
- Project workspace grid: 12 columns; primary content spans 8, decision rail spans 4.
- Dashboard modules use asymmetric spans such as 7/5 or 4/8. Avoid repeated equal three-card rows.
- Outer containers may use 20–26px radii; inner controls use 6–10px. Do not apply one rounded radius everywhere.
- Mobile: one-column content, sticky bottom action where approval or closeout is the primary job.

## 5. Layout & Composition

### Global shell

A midnight-navy labeled navigation sidebar anchors the product and can collapse to an icon rail. The main shell sits on the bone canvas with a soft 24px radius. The top bar remains white and contains breadcrumbs, command search, notifications, quick creation where authorized, and identity. Role changes both content priority and available navigation, so Team Members never see organization-admin destinations.

### Role dashboards

- **CEO / Super Admin:** portfolio health, approval queue, active blockers, delivery forecast, team capacity, agent activity.
- **Project Manager:** items awaiting Govind’s approval, projects at risk, unassigned/overdue tasks, agent drafts, team-day calendar.
- **Tech Lead / Lead:** assigned project health, technical delivery, review queue, team blockers, upcoming milestones, and project-scoped agent settings.
- **Team Member:** current workday, assigned tasks, blockers, project updates, personal calendar, relevant documents.

### Project workspace

Every project uses one stable workspace with tabs: `Overview`, `Plan`, `Board`, `Documents`, `Team`, `Activity`, `Calendar`. The header always shows status, owner, timeline, progress, current risk, next milestone, and the primary action.

The Overview tab provides the project story and health; it does not duplicate every tab. The right rail holds approvals, blockers, and recent decisions. Users should reach any project fact in two interactions or fewer.

### Team calendar

Use a dark scheduling surface inspired by the reference calendar. Desktop defaults to a person-by-day timeline; personal view defaults to day/week. It derives its contents from approved tasks, workday commitments, deadlines, and leave—never from a second manual calendar database.

### Team Member home

The primary surface is `My work`: today's selected outcomes followed by a kanban/list switch for assigned tasks. A compact week strip, current blockers, approved project decisions, and required documents sit beside it. Team Members update status, progress note, blocker, comment, attachment, and workday closeout inline; they cannot change scope, dates, assignments, approvals, agent prompts, or unrelated projects.

### Agent Studio

Project Manager, Tech Lead, and CEO can open a dedicated Agent Studio. It lists the Project Manager and Business Analyst agents, current model, last run, prompt version, and health. System prompts use a versioned editor with `Save draft`, `Test with sample project`, `Publish prompt`, and `Rollback`; Team Members never see this navigation. Prompt changes do not alter already-approved project artifacts.

## 6. Components

### Approval card

Shows artifact type, agent or author, project, version, generated time, key changes, open questions, and actions: `Review`, `Approve`, `Request changes`. Approval is explicit and version-bound.

### Agent run card

States: queued, working, needs input, ready for review, approved, failed. Show the input snapshot, output artifact, and run history. Never represent generated content as approved project truth.

### Project health module

A featured warm panel may use restrained overlapping circles to show delivery, scope, and risk, borrowing the reference’s visual rhythm. Always pair the visual with exact labels and values; circles are not the only carrier of information.

### Feature and task hierarchy

Use a structured outline: project → feature → task. Features expose outcome, acceptance criteria, estimate, dependencies, owner, and progress. Tasks expose assignee, estimate, dates, status, blockers, and source. Kanban is a view of the same tasks, not separate data.

### Document workspace

Documents have a left outline, central editor/preview, and right review rail. Required states: draft, in review, approved, superseded. Show version, author/agent, approver, related features, comments, and change history.

### Activity and notification entry

Each entry answers: who or what changed, what changed, where, and when. Group rapid edits into a single meaningful event. Provide direct links and a concise before/after diff when useful.

### Team-day row

Compact person row with avatar/squircle, current outcomes, project, work state, blockers, and progress segments. The row expands into a side panel; avoid opening a modal for routine inspection.

### Empty, loading, and failure states

- Empty: explain the next useful action.
- Loading: skeleton that matches the final structure.
- Agent failure: plain-language reason, retry action, and preserved inputs.
- Permission denial: explain what role or approval is required.

## 7. Motion & Interaction

- Standard transitions: 160–220ms with ease-out.
- Use opacity and transform for panel reveals and state changes.
- Status updates may briefly highlight the changed row; never animate the whole page.
- Agent generation uses a calm step indicator: reading context → structuring → drafting → ready for review.
- Approval actions require a short confirmation only when they publish shared project state.
- Support keyboard navigation, visible focus rings, escape-to-close, and reduced-motion preferences.
- Avoid drag-and-drop as the only way to move tasks; always provide a status menu.

## 8. Voice & Brand

The voice is direct, specific, and supportive. It should make ownership clear without blaming people.

- Prefer: “Waiting for Govind’s approval.”
- Prefer: “Blocked by API credentials. Pratap can resolve this.”
- Prefer: “The planning agent created 6 features and 24 draft tasks.”
- Avoid: “AI magic completed!”
- Avoid productivity theatre such as “You worked 12 hours.” Focus on outcomes, decisions, blockers, and delivery confidence.
- Use “agent draft” until a human approves it.

## 9. Anti-patterns

- Do not let agents publish plans, dates, requirements, or documents without human approval.
- Do not create separate task records for calendar, kanban, agent output, and workday views.
- Do not show all organizational data to Team Members.
- Do not notify everyone for each keystroke; emit meaningful saved-change events and batch low-priority activity.
- Do not make dashboards collections of equal white cards with decorative icons.
- Do not use saturated yellow/orange, purple-blue AI gradients, glowing robot avatars, chat bubbles as the primary workflow, or “Ask AI” buttons everywhere.
- Do not hide project information across unrelated pages; the project workspace is the canonical home.
- Do not calculate employee value from logged hours. Highlight completed outcomes, aging blockers, scope stability, and forecast confidence.
- Do not copy the reference’s exact fitness layout, calorie bubbles, brand, copy, or imagery.
- Do not copy Taskify's logo, task identifiers, labels, card arrangement, or proprietary workflow language.
