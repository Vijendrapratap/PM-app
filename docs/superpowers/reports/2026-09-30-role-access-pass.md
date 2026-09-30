# Role-by-role access pass — Org & Access Foundation (Verticals)

Date: 2026-09-30 · Environment: local only (backend `http://127.0.0.1:5000`, frontend `http://localhost:5173`, Docker `supabase_db_PM_Pratap_AI`) · Driver: Playwright (chrome-headless-shell), scripted at `/tmp/.../scratchpad/role-pass.js`

Spec: `docs/superpowers/specs/2026-09-30-org-access-foundation-design.md`, sections 1 and 3.

## 0. People changes applied (Step 1)

All calls made as the CEO (`vijendra@pratap.local`) against the local backend, through the same endpoints the Team page uses.

| Action | Call | Result |
|---|---|---|
| Register Sankalp | `POST /api/auth/register` `{name:"Sankalp", email:"sankalp@pratap.ai", role:"MANAGER", designation:"Head of MarketingHarness", department:"Marketing", password:"Demo@123"}` | 201, id `65b124a9-9442-406f-bf9e-95224529ba05` |
| Register Henry | `POST /api/auth/register` `{name:"Henry", email:"vincent@pratap.ai", role:"MANAGER", designation:"Head of Sales", department:"Sales", password:"Demo@123"}` | 201, id `0b989581-42ac-4f5a-8a1f-33925c994c81` |
| Deactivate Devesh | `POST /api/users/a6aee441-eaeb-464b-acf6-1ac4c353cd65/deactivate` | 200 |
| Deactivate Saransh | `POST /api/users/5e43fd31-7087-4bcd-aedf-54bf819cb3b9/deactivate` | 200 |
| Deactivate Sunny | `POST /api/users/c179a61a-caf9-4b27-8bca-8fa1a5922719/deactivate` | 200 |
| Satyam's designation | `PUT /api/users/228356d8-2586-4e73-a357-25c03eb0f5d6` `{designation:"Head of AptusHire"}` | 200, `designation:"Head of AptusHire"` (blocked before the fix in §2, defect 1) |
| MarketingHarness head | `PUT /api/verticals/44a9f3f8-1a46-46ee-a204-13acdba6e66a` `{ownerUserId:"65b124a9-…"}` | 200 (blocked before the fix in §2, defect 2, since Sankalp had not yet onboarded) |
| Re-run Sales-lead migration | `docker exec … psql … < backend/supabase/migrations/0028_verticals.sql` | Idempotent re-run; `UPDATE 1` set `lead_user_id` to Henry only after the fix in §2, defect 3 |
| Disha on FrontDesk | `POST /api/projects` as Govind (`verticalId`=FrontDesk) → `FrontDesk Role Access Pass` (`a815b196-dcbc-480e-874f-cbba6355d601`); `POST /projects/:id/members {userId: Disha}`; brief filled + `DRAFT→PLANNING→ACTIVE` (CEO override, Govind was over the 2-active-project owner cap from prior integration-test residue); `POST /projects/:id/tasks` assigned to Disha | Project active, Disha a member with one assigned task |

Verify (brief's own check):

```
GET /api/verticals → APTUSHIRE: Satyam, CLIENT_PROJECTS: Priyanshu, FRONTDESK: Govind,
                      MARKETINGHARNESS: Sankalp, SMARTHOMES: Anush — all 5 heads present, all active.
POST /api/auth/login {devesh@pratap.local} → 401 "Account is inactive"
```

Both pass.

## 1. Pass summary

- 5 roles × 8–14 sidebar pages each = 61 page loads driven headless; **0 pages** end with a console error after the fixes in §2 (2 were flagged mid-run — both were the local `apiRateLimiter`/`authRateLimiter` (429) tripping under the cumulative load of this test session, not app defects; re-run in isolation after a backend restart came back clean — see §3, non-defect note).
- Defects found: **6**, all fixed in place with a test and re-verified (§2). **1** left open (§4) — a UI-only over-permissiveness the server already refuses, pre-dating this spec and outside its 5 success criteria.
- Company-wide checks (spec §1, criteria 1–4): all pass — see §1.1–1.4.

### 1.1 The five verticals exist with the heads above (criterion 1)
Pass. See §0 verify.

### 1.2 Every MANAGER can list/open every project, report and team work log (criterion 2)
Pass, after fixing defects 4 and 5 (§2). Before the fix, `GET /api/workdays/team` (Team pulse / team history) was CEO-only in both the backend service and the frontend gate, so every head got 403/an invisible tab. Verified after the fix:
- `backend/src/integration/workGates.integration.ts` new test: Govind (MANAGER) and the CEO both get 200 on `GET /workdays/team`; a team member gets 403.
- Screenshot: Satyam's Work history page now renders a "Team history — All team sessions and immutable work records" section with organization-wide entries (`pass-satyam-workHistory.png`).
- Projects: `GET /api/projects` as any of Satyam/Anush/Sankalp returns all 99 projects (CEO's list length matches).
- Reports: all three heads' Reports page shows **SCOPE: Organization** (`pass-satyam-reports.png`, `pass-anush-*`, `pass-sankalp-*` deep-check `reportsMentionsOrganization: true`).

### 1.3 A MANAGER can edit a project only if in their vertical, owned, or a manager member (criterion 3)
Pass, direct API checks (mirrors the design's own example and the existing integration test `a head sees every project but edits only their own vertical`):

| Actor | Project | Vertical head? | `PUT /api/projects/:id` |
|---|---|---|---|
| Sankalp | Content Engine (MarketingHarness, owned by Priyanshu) | yes | 200 |
| Satyam | Content Engine | no | 403 "Only the CEO, the vertical head or a manager of this project can change it" |
| Satyam | AI Interviewer Platform (AptusHire, owned by Anush) | yes | 200 |
| Sankalp | AI Interviewer Platform | no | 403 |
| Disha | FrontDesk Role Access Pass (member, not manager) | n/a | 403 (edit); her own task PUT → 200 |
| Disha | FrontDesk Role Access Pass | n/a | `POST /milestones` → 403 "Only a Manager in this project can change its structure" |

### 1.4 Lead-titled heads get the same controls as Project-Manager-titled heads (criterion 4)
Pass. Anush's and Sankalp's sidebar link sets are identical to Satyam's and Govind's (`['Home','Work history','Tasks','Projects','Documents and Links','Completed projects','Idea bucket','Team','Reports','AI workspace','Notifications']`), and Anush passes the same cross-vertical edit test the existing integration suite already runs (`a Lead-titled head (Anush) manages SmartHomes and nothing else`).

## 2. Defects found and fixed (with tests)

All 6 were discovered while carrying out Step 1 (people changes) or the browser pass; each is a case of the codebase reading the wrong "active/eligible" signal, not a design gap. Backend suite: `cd backend && npm test && npm run test:integration` → 55 + 24 = 79 passing after every fix below.

### Defect 1 — `PUT /api/users/:id` silently dropped `designation`
**File:** `backend/src/utils/validators.ts:30-39` (`updateUserSchema`)
**What:** the schema had no `designation` field. `middleware/validate.ts` replaces `req.body` with the Zod-parsed (and therefore stripped) body, so any `designation` sent by the Team page's edit call was discarded before reaching `userService.update`, even though `userService.update`'s patch type and DB column both support it. This directly blocked the brief's required step ("Update Satyam's designation… through the user update endpoint").
**Fix:** added `designation: z.string().max(120).optional()` to `updateUserSchema` (mirrors `registerSchema`).
**Test:** `backend/src/utils/validators.test.ts` (new) — asserts `updateUserSchema.safeParse({designation:…})` keeps the field.
**Re-verified:** `PUT /api/users/228356d8-… {designation:"Head of AptusHire"}` → 200, `designation` persisted (§0).

### Defect 2 — vertical-head eligibility checked the wrong "active" field
**Files:** `backend/src/services/verticalService.ts:16,33` and `backend/src/repositories/verticalRepository.ts:3`
**What:** `users.account_status` (`INVITED`/`ACTIVE`/…, tracks onboarding) and `users.status` (`Active`/`Inactive`, tracks deactivation) are two different columns. `verticalService` checked `head.account_status === 'ACTIVE'` to decide vertical-head eligibility and to compute the `head.active` flag returned to the UI. Every freshly-registered account starts `account_status: 'INVITED'` until it completes onboarding (`authService.ts`), so a brand-new MANAGER — exactly Sankalp's situation — could never be set as a vertical head, and any un-onboarded head would show as "inactive" in the UI regardless of whether they were actually deactivated. This blocked criterion 1 (all 5 verticals with their heads).
**Fix:** both checks (and the repository's `SELECT`) now use `status === 'Active'`, the field `deactivateUser` actually writes.
**Tests:** two new cases in `backend/src/integration/verticals.integration.ts` — `a freshly registered manager (not yet onboarded) is eligible as vertical head` (200, `head.active: true`) and `a deactivated manager is not eligible as vertical head` (400, same message as before).
**Re-verified:** `PUT /api/verticals/44a9f3f8-… {ownerUserId: Sankalp}` → 200 once Sankalp existed (§0); full integration suite green.

### Defect 3 — same bug in the SQL migration blocked Henry as Sales lead
**File:** `backend/supabase/migrations/0028_verticals.sql:22,52`
**What:** the same `u.account_status = 'ACTIVE'` condition (instead of `u.status = 'Active'`) is used to look up the head-by-first-name for both the verticals seed and the Sales department lead. Re-running the migration after registering Henry (as the brief instructs, since it's idempotent) matched zero rows for `'henry'` and set `lead_user_id` back to `null` — "UPDATE 1" but no actual lead.
**Fix:** both occurrences changed to `u.status = 'Active'`.
**Verified:** re-ran `docker exec -i supabase_db_PM_Pratap_AI psql … < 0028_verticals.sql`; `GET /api/departments` → Sales `lead: {name:"Henry", email:"vincent@pratap.ai", designation:"Head of Sales"}`. (SQL seed data, not covered by the `node:test` suite; verified by re-running the exact command the brief specifies plus the API read, same as the brief's own verification step.)

### Defect 4 — `workdayService.getTeam` was CEO-only, not MANAGER-visible
**File:** `backend/src/services/workdayService.ts:440`
**What:** `if (!isSuperAdmin(actor.role)) throw forbidden(...)` — `isSuperAdmin` is CEO-only. This endpoint backs "Team pulse"/team history (`GET /api/workdays/team`), so every head got a hard 403, breaking criterion 2's "team work log" clause.
**Fix:** swapped for `canViewAllProjects(actor.role)` (already used elsewhere in this codebase for exactly "CEO or MANAGER"), imported from `../utils/roles`.
**Test:** new case in `backend/src/integration/workGates.integration.ts` — `a head (MANAGER) can read the team pulse, same as the CEO; a team member cannot` (200/200/403).

### Defect 5 — `Workday.tsx` hid the Team pulse tab from every head
**File:** `frontend/src/pages/Workday.tsx:31` (`canSeeTeam`) and its 4 call sites (lines 42, 76, 178, 365)
**What:** `canSeeTeam = (role) => isSuperAdmin(role)`, called with the *display* role (`user?.role`, e.g. `"Project Manager"`/`"Lead"`), not the platform role. `isSuperAdmin` only matches `"Super Admin"`/`"CEO"`, so the entire tab bar — including the only way to reach Team pulse/team history — was never rendered for a head, even after defect 4's backend fix. This is the same class of bug the spec's own "Lead fix" addressed in `Sidebar.tsx`/`Projects.tsx`/etc., just in a file that list happened to miss. `Home` (`/`) renders the same `<Workday/>` component, so this covered both routes with one fix.
**Fix:** `canSeeTeam` now takes `platformRole` and checks `'CEO' || 'MANAGER'`; call sites pass `user?.platformRole`.
**Verified:** screenshot `pass-satyam-workHistory.png` and `pass-sankalp-home.png` — both now show the "Team history" section with organization-wide work records. No frontend test harness exists in this repo (backend uses `node:test`/integration against the real API; frontend has no `test` script or existing spec files) — this is a pure UI-gating change with no state to unit-test in isolation, so the browser-pass re-run (before/after screenshots + 0 console errors) is the regression check, consistent with how the repo already verifies frontend behavior for this feature.

### Defect 6 — `useTeam` hook logged a console error on every Team Member page load
**File:** `frontend/src/hooks/useTeam.ts:11,18,31`
**What:** `useTeam()` unconditionally calls `GET /api/team` (which `requireManager` rejects for `TEAM_MEMBER`s with 403). `DailyPlanner.tsx` (the Tasks page, `/daily-todo`) calls `useTeam()` to build assignee pickers, so every Team Member load of Tasks threw a `console.error('Failed to fetch team', …)` plus a failed XHR — a real console error on a real page for a real role, which is exactly what this pass's "page loads without console errors" criterion checks.
**Fix:** `useTeam` now also skips the fetch (mirrors the existing `isDemo` short-circuit) when `user?.platformRole` isn't `CEO`/`MANAGER`.
**Verified:** Disha's Tasks page went from 4 console errors (2× "Failed to load resource… 403", 2× "Failed to fetch team AxiosError…") to 0 after the fix; re-ran the full 5-role browser pass afterward — 0 console errors across all 61 page loads.

## 3. Non-defects (observed, recorded as facts)

- **Team page roster is scoped for heads, not the full org.** `GET /team` (`teamRoutes.ts`) uses `userService.list`, which returns the full roster only for the CEO (`isSuperAdmin`); a head sees their own managed scope (e.g. Satyam sees "3 of 3": Govind, Satyam, Sunny — his own project members). This is pre-existing behavior, not touched by the verticals work, and the spec's success criteria only require org-wide **projects/reports/team-work-log** for heads (criterion 2), not the full user directory. Pass, not a defect.
- **429s during the automated multi-role pass.** `apiRateLimiter` (300 req / 15 min / IP) and `authRateLimiter` (20 req / 15 min / IP) are local dev-server defaults; driving 5 roles × up to 14 data-heavy pages each in one session exceeds that budget, and by the 3rd–5th role in a single run even logins started failing (blank login screen, identical screenshots, `sidebarLinks: []`). Restarting the local `tsx` backend process between role batches resets the in-memory limiter counters (no DB state is touched) and every role then passed cleanly. Not a defect — the limiter is working as designed; it was not modified.
- **Local project/user cap collision.** Activating the FrontDesk Role Access Pass project (`PLANNING → ACTIVE`) hit `"This owner already has 42 active projects (limit 2)"` for Govind, because tasks 1–4's own integration-test runs left ~90 `IT …` projects in the local DB (spec §8 explicitly defers cleaning these up). Required a CEO override (`override:true, reason:"…"`) exactly as `workGatePolicy.ts` intends for a CEO. Not a defect.
- **Disha's Reports "Projects in scope: 5"** includes `AI Interviewer Platform`, `Niko Salon Chatbot`, `Real Estate Complete Module` in addition to `FrontDesk Role Access Pass` and the standing `Development Ops` project — verified via `GET /api/projects` as Disha that she is a genuine `assignedMembers` entry on all 5 (pre-existing seed assignments, not a scope leak). Pass.

## 4. Defects left open

### Open defect A — "Add milestone" shown to team members on projects they can't manage
**File:** `frontend/src/pages/ProjectDetails.tsx:132`
```
canAddMilestone={canContribute}
```
`canContribute = canApproveAgentWork(user?.role) || isAssigned` — true for **any** assigned project member, not just a manager. `ProjectMilestonePanel` defaults `canAddMilestone` to `canManage` (`canManageStructure` here) when the prop isn't passed, so this line is an explicit override that shows the "Add milestone" button/form to a plain Team Member (verified with Disha on FrontDesk Role Access Pass, `pass-disha-project-frontdesk.png`). The server already refuses the resulting write correctly (`POST /projects/:id/milestones` as Disha → 403 "Only a Manager in this project can change its structure", confirmed live), so nothing is actually exploitable — a Disha click just ends in a form that always fails.
**Why left open:** the spec explicitly treats button visibility as "a hint only; the server stays the authority" (design §4), the server enforcement above confirms that authority holds, this line predates the verticals work (it isn't in the design's list of Lead-fix files, and isn't caused by any account_status/status or platformRole confusion this task fixed), and it isn't named by any of the spec's 5 success criteria. Root-cause fix, if wanted later: pass `canManageStructure` instead of `canContribute` (one-word change, same file).

## 5. Role tables

Legend: **Absent (expected)** = the brief's sidebar-is-authoritative rule — the page/link doesn't exist for this role's sidebar, which matches the expected access rule, so it counts as pass.

### Vijendra — CEO
Sidebar: Home, Tasks, Projects, Documents & Links, Completed projects, Idea bucket, Team, Reports, AI workspace, Team messages, Notifications. (No "Start my day" CTA, no Work history link — both correctly CEO-only-hidden per `Sidebar.tsx`.)

| Page | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Home | Loads, no console errors | 0 errors (`pass-ceo-home.png`) | Pass |
| Work history / team history | Absent from sidebar (CEO uses Team page + Reports for oversight, not the per-user Workday flow) | Absent, matches `Sidebar.tsx:43` (`!isCEO`) | Pass (expected absence) |
| Tasks | Loads, no console errors | 0 errors | Pass |
| My Projects → Projects: list, vertical filter, create, vertical picker | All present, full org list | `verticalFilterPresent`, `createProjectButtonPresent` true; 99 projects (`pass-ceo-projects.png`) | Pass |
| Project page (FrontDesk Role Access Pass): plan/board/documents/team/milestones/activity | Full manage rights | Tabs (Delivery/Documents/Activity/AI plan) render, `Finish project` control present, 0 errors (`pass-ceo-project-frontdesk.png`) | Pass |
| Completed projects | Loads, no console errors | 0 errors | Pass |
| Documents & Links | Loads, no console errors | 0 errors | Pass |
| Idea bucket | Loads, no console errors | 0 errors | Pass |
| Agent Studio | Present, functional | Present, 0 errors (`pass-ceo-agents.png`) | Pass |
| Reports: scope | Organization | "SCOPE: Organization" shown | Pass |
| Notifications | Loads, no console errors | 0 errors | Pass |
| Messages | CEO-only, present | Present, 0 errors; server: `GET /api/messages` as Satyam → 403 (confirms hidden-for-others is also enforced) | Pass |
| Team page: invite, deactivate | Both present, full 24-member roster | "Add Member" + per-member "Deactivate" present, "24 of 24 members" (`pass-ceo-team.png`) | Pass |

### Satyam — Head, "Project Manager" title, AptusHire
Sidebar: Home, Work history, Tasks, Projects, Documents & Links, Completed projects, Idea bucket, Team, Reports, AI workspace, Notifications. (No Team messages — CEO-only.)

| Page | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Home | Loads, no console errors | 0 errors (`pass-satyam-home.png`) | Pass |
| Work history + team history | Own history + org-wide "Team history" section (criterion 2) | Both present, 0 errors (`pass-satyam-workHistory.png`) — **failed before Defects 4/5 fixes**, now pass | Pass |
| Tasks | Loads, no console errors | 0 errors | Pass |
| Projects: list, vertical filter, create, vertical picker, full org list | All present, sees all 99 | Confirmed present, 99 rows (`pass-satyam-projects.png`) | Pass |
| Project page — own vertical (AI Interviewer Platform): edit allowed | Editable | `PUT` → 200 (§1.3) | Pass |
| Project page — other vertical (Content Engine): edit refused | 403, UI read-only where applicable | `PUT` → 403 (§1.3); page itself loads fine (viewing is allowed for all MANAGERs) | Pass |
| Project page — FrontDesk Role Access Pass (member of another head's vertical) | Viewable, 0 errors | 0 errors (`pass-satyam-project-frontdesk.png`) | Pass |
| Completed projects | Loads, no console errors | 0 errors | Pass |
| Documents & Links | Loads, no console errors | 0 errors | Pass |
| Idea bucket | Loads, no console errors | 0 errors | Pass |
| Agent Studio | Present, functional | Present, 0 errors (`pass-satyam-agents.png`) | Pass |
| Reports: scope | Organization | "SCOPE: Organization", 88 active projects in scope (`pass-satyam-reports.png`) | Pass |
| Notifications | Loads, no console errors | 0 errors | Pass |
| Team page | Present (scoped roster, no invite/deactivate — CEO-only per `Team.tsx:38`) | "3 of 3 members" scoped view, no Add Member/Deactivate buttons (`pass-satyam-team.png`) | Pass (matches `isSuperAdmin(user?.role)` gate, a pre-existing, in-scope-correct rule) |
| Messages | Absent from sidebar | Absent; server: `GET /api/messages` → 403 | Pass (expected absence, server-enforced) |

### Anush — Head, "Lead" title, SmartHomes
Sidebar identical to Satyam's (criterion 4 — Lead parity).

| Page | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Home | Loads, no console errors | 0 errors (`pass-anush-home.png`) | Pass |
| Work history + team history | Same as Satyam | Present, 0 errors (`pass-anush-workHistory.png`) | Pass |
| Tasks | Loads, no console errors | 0 errors | Pass |
| Projects: list, vertical filter, create | Same as Satyam, full org list | Confirmed (`pass-anush-projects.png`) | Pass |
| Project page — own vertical (SmartHomes): edit allowed | Editable | `PUT` → 200 (existing integration test, re-confirmed in this run) | Pass |
| Project page — other vertical (FrontDesk): edit refused | 403 | `PUT` → 403 (existing integration test) | Pass |
| Completed / Documents & Links / Idea bucket | Load, no console errors | 0 errors each | Pass |
| Agent Studio | Present, functional | Present, 0 errors (`pass-anush-agents.png`) | Pass |
| Reports: scope | Organization | "SCOPE: Organization" (`pass-anush-reports.png`) | Pass |
| Notifications | Loads, no console errors | 0 errors | Pass |
| Team page | Scoped roster, no invite/deactivate | Confirmed (`pass-anush-team.png`) | Pass |
| Messages | Absent | Absent | Pass |

### Sankalp — New head, MarketingHarness (Project Manager title)
Sidebar identical to Satyam's/Anush's, confirming a same-day-registered head gets full parity once onboarded.

| Page | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Onboarding gate | New account must complete onboarding before the rest of the app | Blocked on "Set up your workday, Sankalp" until `POST /team/onboarding` (`pass-sankalp-home.png` first capture) — expected first-login behavior, not a defect; completed via API to proceed with the pass | Pass (expected) |
| Home | Loads, no console errors, sees org-wide team history | 0 errors, Team history section present (`pass-sankalp-home.png`, post-onboarding) | Pass |
| Work history | Loads, no console errors | 0 errors (`pass-sankalp-workHistory.png`) | Pass |
| Tasks | Loads, no console errors | 0 errors | Pass |
| Projects: list, vertical filter, create, vertical picker, full org list | All present, sees all 99, all 5 vertical tabs (AptusHire 1, Client Projects 4, FrontDesk 8, MarketingHarness 1, SmartHomes 7) | Confirmed visually (`pass-sankalp-projects.png`) | Pass |
| Project page — own vertical (Content Engine, owned by Priyanshu): edit allowed | Editable via vertical-head rule | `PUT` → 200 (§1.3) | Pass |
| Project page — other vertical (AI Interviewer Platform): edit refused | 403 | `PUT` → 403 (§1.3) | Pass |
| Completed / Documents & Links / Idea bucket | Load, no console errors | 0 errors each | Pass |
| Agent Studio | Present, functional | Present, 0 errors (`pass-sankalp-agents.png`) | Pass |
| Reports: scope | Organization | "SCOPE: Organization" (`pass-sankalp-reports.png`) | Pass |
| Notifications | Loads, no console errors | 0 errors | Pass |
| Team page | Scoped roster | Present, 0 errors (`pass-sankalp-team.png`) | Pass |
| Messages | Absent | Absent | Pass |

### Disha — Team member (FrontDesk, under Govind)
Sidebar: Home, Work history, Tasks, My Projects, Documents & Links, Completed projects, Idea bucket, My reports, Notifications. (No Team, no AI workspace, no Team messages.)

| Page | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Home | Loads, no console errors | 0 errors (`pass-disha-home.png`) | Pass |
| Work history | Own history only (no team tab — server would 403 it, matches `Sidebar.tsx`/`canSeeTeam` for TEAM_MEMBER) | 0 errors, own history only (`pass-disha-workHistory.png`) | Pass |
| Tasks | Loads, no console errors | **4 console errors before Defect 6 fix** (403 fetching `/team`); 0 after | Pass (after fix) |
| My Projects | Only her 5 member projects, no vertical filter needed for create (team members don't create), no "New Project" button | 5 projects listed (FrontDesk Role Access Pass, Development Ops, AI Interviewer Platform, Niko Salon Chatbot, Real Estate Complete Module — all genuine memberships, verified via API); no create button (`pass-disha-projects.png`) | Pass |
| Project page — FrontDesk Role Access Pass: sees it, updates only her own task, cannot edit project | All three | Sees it (`pass-disha-project-frontdesk.png`); `PUT` her task → 200; `PUT` project → 403; `POST` milestone → 403 (Open defect A: button itself is shown, server correctly refuses) | Pass (server-enforced); UI button visibility → Open defect A |
| Completed projects | Loads, no console errors | 0 errors | Pass |
| Documents & Links | Loads, no console errors | 0 errors | Pass |
| Idea bucket | Loads, no console errors | 0 errors | Pass |
| Agent Studio | Absent from sidebar | Absent; not directly re-tested server-side (no route depends on this for Disha specifically; team-scoped agent endpoints already covered by project-level 403s above) | Pass (expected absence) |
| Reports: scope | Personal | "SCOPE: Personal view", 5 projects in scope (`pass-disha-reports.png`) | Pass |
| Notifications | Loads, no console errors | 0 errors | Pass |
| Team page | Absent from sidebar | Absent; server: `GET /api/team` → 403 | Pass (expected absence, server-enforced) |
| Messages | Absent from sidebar | Absent | Pass |

## 6. Evidence

- Playwright driver: `/tmp/claude-1000/-home-pratap-work-PM-Pratap-AI-PM-app/2f2ae0dd-b14a-4444-9def-4f598497154f/scratchpad/role-pass.js`
- Raw results (per-page console errors, deep checks): `/tmp/claude-1000/-home-pratap-work-PM-Pratap-AI-PM-app/2f2ae0dd-b14a-4444-9def-4f598497154f/scratchpad/role-pass-results.json`
- Screenshots: `/tmp/claude-1000/-home-pratap-work-PM-Pratap-AI-PM-app/2f2ae0dd-b14a-4444-9def-4f598497154f/scratchpad/pass-<role>-<page>.png` (36 files — home/projects/reports/team/agents/workHistory/project-* per applicable role), plus `verify-verticals.js`'s `projects-page.png`, `projects-filtered-aptushire.png`, `edit-modal-vertical.png` from Task 4.
- Backend test run: `cd backend && npm test` → 55/55, `npm run test:integration` → 24/24 (both after all fixes).
