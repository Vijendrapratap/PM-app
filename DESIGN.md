# Pratap AI Operations Studio — Design System

## 1. Visual Theme & Atmosphere

**Direction: Calm operations studio.** The product should feel focused, capable, and human: a quiet warm canvas, crisp work surfaces, dark high-attention panels, and one yellow-gold signal color. It should help a team understand work in seconds without looking like surveillance software or a generic analytics dashboard.

The reference image contributes its compact navigation rail, asymmetric bento composition, warm neutral palette, near-black calendar surface, generous internal spacing, and small areas of vivid signal color. The product must not copy the fitness subject matter, exact card arrangement, brand, icons, or bubble visualization.

Every screen should have one dominant decision area. Supporting information should be quieter and progressively disclosed. Dense operational screens may contain significant data, but never as an undifferentiated wall of cards.

## 2. Color

Use color by meaning, not decoration.

| Token | Value | Use |
|---|---:|---|
| Canvas | `#E8E4DC` | App background outside the primary shell |
| Shell | `#F8F6F1` | Main application frame |
| Surface | `#FFFDF8` | Primary work surfaces and forms |
| Warm surface | `#D6CEBC` | Featured summaries and calm data regions |
| Ink | `#1C1D22` | Primary text and dark panels |
| Ink raised | `#25272E` | Hovered dark surfaces |
| Secondary text | `#69665F` | Explanations and metadata |
| Muted text | `#918B81` | Timestamps and low-priority labels |
| Signal yellow | `#E6C24A` | Primary action, active day, selected dates |
| Completion green | `#78956D` | Approved, completed, healthy |
| Blocker coral | `#D96855` | Blocked, failed, destructive actions |
| Review amber | `#B88A35` | Awaiting approval, at risk |

Rules:

- Yellow-gold is the single product accent; do not introduce purple or electric-blue gradients.
- Coral is reserved for exceptions and blockers, never generic decoration.
- Use near-black panels for calendar, approval queue, and decision-focused modules—not random page sections.
- Meet WCAG AA contrast for text and controls. Never put small white text on signal yellow.

## 3. Typography

- Display and navigation: `Space Grotesk`, weights 600–700.
- Body and controls: `Inter`, weights 400–650.
- Data: use tabular numerals via `font-variant-numeric: tabular-nums`.
- Page title: 32–44px desktop, 28–34px tablet/mobile; tracking `-0.04em`.
- Section title: 18–22px; compact line height.
- Body: 14px for repeated product UI; 15–16px for descriptions.
- Metadata: 11–12px with normal sentence case. Avoid all-caps except short operational labels.
- Keep paragraphs below roughly 65 characters per line.

## 4. Spacing & Grid

- Base spacing unit: 4px. Default rhythm: 8, 12, 16, 24, 32, 48.
- Desktop shell: max-width 1480px with 18–24px outer inset.
- Navigation rail: 72px collapsed; 224px expanded only when needed.
- Header: 68–76px.
- Project workspace grid: 12 columns; primary content spans 8, decision rail spans 4.
- Dashboard modules use asymmetric spans such as 7/5 or 4/8. Avoid repeated equal three-card rows.
- Outer containers may use 20–26px radii; inner controls use 6–10px. Do not apply one rounded radius everywhere.
- Mobile: one-column content, sticky bottom action where approval or closeout is the primary job.

## 5. Layout & Composition

### Global shell

A slim dark icon rail anchors the product. The main shell sits on the warm canvas with a soft 24px radius. The top bar contains contextual title/breadcrumbs, command search, notifications, and identity. Role changes alter content priority, not the navigation model.

### Role dashboards

- **CEO / Super Admin:** portfolio health, approval queue, active blockers, delivery forecast, team capacity, agent activity.
- **Project Manager:** items awaiting Govind’s approval, projects at risk, unassigned/overdue tasks, agent drafts, team-day calendar.
- **Lead:** assigned project health, team blockers, task review queue, upcoming milestones.
- **Team Member:** current workday, assigned tasks, blockers, project updates, personal calendar, relevant documents.

### Project workspace

Every project uses one stable workspace with tabs: `Overview`, `Plan`, `Board`, `Documents`, `Team`, `Activity`, `Calendar`. The header always shows status, owner, timeline, progress, current risk, next milestone, and the primary action.

The Overview tab provides the project story and health; it does not duplicate every tab. The right rail holds approvals, blockers, and recent decisions. Users should reach any project fact in two interactions or fewer.

### Team calendar

Use a dark scheduling surface inspired by the reference calendar. Desktop defaults to a person-by-day timeline; personal view defaults to day/week. It derives its contents from approved tasks, workday commitments, deadlines, and leave—never from a second manual calendar database.

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
- Do not use purple-blue AI gradients, glowing robot avatars, chat bubbles as the primary workflow, or “Ask AI” buttons everywhere.
- Do not hide project information across unrelated pages; the project workspace is the canonical home.
- Do not calculate employee value from logged hours. Highlight completed outcomes, aging blockers, scope stability, and forecast confidence.
- Do not copy the reference’s exact fitness layout, calorie bubbles, brand, copy, or imagery.
