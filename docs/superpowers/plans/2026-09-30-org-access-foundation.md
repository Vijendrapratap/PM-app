# Org & Access Foundation (Verticals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verticals with heads. Every manager can see everything and can manage only their own vertical, and "Lead" managers stop being blocked in the UI.

**Architecture:**
- A `verticals` table plus `projects.vertical_id`.
- One `toPolicyResource(project)` helper replaces seven copies and carries the vertical head into `canManageProject`.
- `canViewAllProjects` widens to MANAGER, which already opens project lists, reports and agent views.
- The frontend reads verticals from a small `/api/verticals` API and replaces the keyword-guessed "portfolio" filter.

**Tech Stack:**
- Backend: Express 5, TypeScript, Supabase (Postgres) and zod. Unit tests use `node:test` via tsx (`npm test`); integration tests are `*.integration.ts` run against a live backend (`npm run test:integration`).
- Frontend: React 19 + Vite.

**Spec:** `docs/superpowers/specs/2026-09-30-org-access-foundation-design.md`

## Global Constraints

- Verticals, exact names and codes:
  - AptusHire / `APTUSHIRE` (PRODUCT)
  - FrontDesk / `FRONTDESK` (PRODUCT)
  - MarketingHarness / `MARKETINGHARNESS` (PRODUCT)
  - SmartHomes / `SMARTHOMES` (PRODUCT)
  - Client Projects / `CLIENT_PROJECTS` (CLIENT_SERVICES)
- Disha (intern) works under Govind on FrontDesk as a project member only.
- Heads: SmartHomes — Anush, AptusHire — Satyam, FrontDesk — Govind, MarketingHarness — Sankalp, Client Projects — Priyanshu. Sales department lead: Henry.
- New accounts: Sankalp `sankalp@pratap.ai`, Henry `vincent@pratap.ai`. Deactivate Devesh, Saransh and Sunny. Satyam's designation: "Head of AptusHire".
- Heads are matched by **first name** among active users of the same organization. Emails differ between local (`@pratap.local`) and production.
- Only the CEO or that vertical's head may put a project in a vertical. Error text: `Only the CEO or the vertical head can move a project into this vertical`.
- Authorization reads the platform role (CEO / MANAGER / TEAM_MEMBER). Display roles ('Lead', 'Project Manager') never gate features.
- Migrations are idempotent and rehearsed on a restored copy before production.
- Git identity: `Vijendrapratap <44225657+Vijendrapratap@users.noreply.github.com>`. Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A head of one vertical editing another vertical's project** must get 403. Pinned in Task 2 unit tests and the Task 3 integration test.
2. **A head moving a project out of their vertical into someone else's** must get 403, even though they can manage the project. Pinned in Task 3 (`verticalId` change checks the *target* vertical).
3. **Clearing a project's vertical** (`verticalId: null`) by the CEO must work, and by a non-head must be refused when the project's current vertical isn't theirs. Pinned in Task 3.
4. **A vertical whose head is inactive or missing** (Sankalp before his account exists) must still list, and no one but the CEO manages it by vertical rule. Pinned in Task 2 (`verticalOwnerUserId: null`).
5. **Team members must not gain visibility** from the MANAGER widening. Pinned in Task 2 (`TEAM_MEMBER` outsider cannot view).

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/supabase/migrations/0028_verticals.sql` (create) | table, column, seeds, backfill |
| `backend/src/policies/accessPolicy.ts` (modify) | `toPolicyResource`, vertical rule, manager view |
| `backend/src/utils/roles.ts` (modify) | `canViewAllProjects` includes MANAGER |
| `backend/src/repositories/projectRepository.ts` (modify) | `PROJECT_SELECT` joins vertical |
| 6 services + `middleware/auth.ts` (modify) | use `toPolicyResource` |
| `backend/src/repositories/verticalRepository.ts`, `services/verticalService.ts`, `controllers/verticalController.ts`, `routes/verticalRoutes.ts` (create) | verticals API, mirroring departments |
| `backend/src/services/projectService.ts`, `services/mappers.ts`, `utils/validators.ts` (modify) | `verticalId` on create and update |
| `backend/src/integration/verticals.integration.ts` (create) | role scenarios |
| `frontend/src/api/verticalApi.ts` (create), `types/index.ts`, `utils/roles.ts`, `pages/Projects.tsx`, `components/CreateProjectModal.tsx`, `components/EditProjectModal.tsx`, `pages/ProjectDetails.tsx` (modify) | UI |

---

### Task 1: Migration 0028 — verticals

**Files:**
- Create: `backend/supabase/migrations/0028_verticals.sql`

**Interfaces:**
- Produces: table `verticals(id, organization_id, name, code, kind, owner_user_id, active, created_at, updated_at)` and `projects.vertical_id uuid null`.

- [ ] **Step 1: Write the migration**

```sql
-- Verticals: internal product brands plus client services. Projects belong to at most one.
create table if not exists verticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  code text not null,
  kind text not null check (kind in ('PRODUCT', 'CLIENT_SERVICES')),
  owner_user_id uuid references users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table projects add column if not exists vertical_id uuid references verticals(id) on delete set null;
create index if not exists idx_projects_vertical on projects(vertical_id);

-- Heads are matched by first name: emails differ between local and production.
insert into verticals (organization_id, name, code, kind, owner_user_id)
select org.id, seed.name, seed.code, seed.kind,
  (select u.id from users u
    where u.organization_id = org.id and u.account_status = 'ACTIVE'
      and lower(split_part(trim(u.name), ' ', 1)) = seed.head
    order by u.created_at limit 1)
from organizations org
cross join (values
  ('AptusHire', 'APTUSHIRE', 'PRODUCT', 'satyam'),
  ('FrontDesk', 'FRONTDESK', 'PRODUCT', 'govind'),
  ('MarketingHarness', 'MARKETINGHARNESS', 'PRODUCT', 'sankalp'),
  ('SmartHomes', 'SMARTHOMES', 'PRODUCT', 'anush'),
  ('Client Projects', 'CLIENT_PROJECTS', 'CLIENT_SERVICES', 'priyanshu')
) as seed(name, code, kind, head)
on conflict (organization_id, code) do nothing;

-- Backfill by exact project name; anything unmatched stays unassigned.
update projects p
set vertical_id = v.id
from (values
  ('AI Interviewer Platform', 'APTUSHIRE'),
  ('Niko Salon Chatbot', 'CLIENT_PROJECTS'),
  ('Vishvas Foundation', 'CLIENT_PROJECTS'),
  ('Real Estate Complete Module', 'CLIENT_PROJECTS'),
  ('Competitor Analysis (Resort)', 'CLIENT_PROJECTS'),
  ('Content Engine', 'MARKETINGHARNESS')
) as map(project_name, code)
join verticals v on v.code = map.code
where p.name = map.project_name and p.organization_id = v.organization_id and p.vertical_id is null;

-- Henry heads Sales (null until his account exists).
update departments d
set lead_user_id = (select u.id from users u
    where u.organization_id = d.organization_id and u.account_status = 'ACTIVE'
      and lower(split_part(trim(u.name), ' ', 1)) = 'henry'
    order by u.created_at limit 1)
where d.code = 'SALES' and d.lead_user_id is null;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply to the local database and verify**

Run (local Docker database only):

```bash
docker exec -i supabase_db_PM_Pratap_AI psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backend/supabase/migrations/0028_verticals.sql
docker exec -i supabase_db_PM_Pratap_AI psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backend/supabase/migrations/0028_verticals.sql
docker exec supabase_db_PM_Pratap_AI psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations(version,name) values ('0028','verticals') on conflict do nothing;" -c "select v.name, u.name head, (select count(*) from projects p where p.vertical_id=v.id) projects from verticals v left join users u on u.id=v.owner_user_id order by v.name"
```

Expected:
- The second apply succeeds too (idempotent).
- Five rows: AptusHire (Satyam Tiwari, 1), Client Projects (Priyanshu Rajbhar, 4), FrontDesk (Govind, 0), MarketingHarness (null head, 1), SmartHomes (Anush MK, 0).

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/migrations/0028_verticals.sql
git commit -m "feat(db): verticals with heads, project vertical_id and backfill"
```

---

### Task 2: One policy resource and the vertical rule

**Files:**
- Modify: `backend/src/policies/accessPolicy.ts`, `backend/src/utils/roles.ts:33`, `backend/src/repositories/projectRepository.ts:4-9`
- Modify (swap inline builders for `toPolicyResource`):
  - `backend/src/middleware/auth.ts:100-109`
  - `backend/src/services/projectService.ts:69-77,85-93`
  - `backend/src/services/projectTaskService.ts:28-36,46-54`
  - `backend/src/services/taskWorkflowService.ts:12-15`
  - `backend/src/services/hierarchyService.ts:10-15`
  - `backend/src/services/blockerService.ts:11-20`
  - `backend/src/services/projectLifecycleService.ts:13-16`
- Test: `backend/src/policies/accessPolicy.test.ts`

**Interfaces:**
- Consumes: `projects.vertical_id` and `verticals.owner_user_id` from Task 1.
- Produces:
  - `toPolicyResource(project: any): ProjectPolicyResource`
  - `ProjectPolicyResource.verticalOwnerUserId: string | null`
  - `canViewAllProjects(role)` is true for CEO and MANAGER.

- [ ] **Step 1: Write the failing tests** (replace the visibility test and add the vertical table)

In `accessPolicy.test.ts`, add `toPolicyResource` to the import list and set `verticalOwnerUserId: 'aptushire-head'` on the `project` fixture. Then replace the test `'project visibility is organization and membership scoped'` with:

```ts
test('managers see every project in the organization; team members only their own', () => {
  assert.equal(canViewProject({ id: 'ceo', role: 'CEO', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'developer', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'any-head', role: 'MANAGER', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'lead-head', role: 'Lead', organizationId: 'org-1' }, project), true);
  assert.equal(canViewProject({ id: 'outsider', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), false);
  assert.equal(canViewProject({ id: 'ceo', role: 'CEO', organizationId: 'org-2' }, project), false);
  assert.equal(canViewProject({ id: 'any-head', role: 'MANAGER', organizationId: 'org-2' }, project), false);
});

test('a vertical head manages their vertical only', () => {
  assert.equal(canManageProject({ id: 'aptushire-head', role: 'MANAGER', organizationId: 'org-1' }, project), true);
  assert.equal(canManageProject({ id: 'frontdesk-head', role: 'MANAGER', organizationId: 'org-1' }, project), false);
  assert.equal(canManageProject({ id: 'aptushire-head', role: 'TEAM_MEMBER', organizationId: 'org-1' }, project), false);
  assert.equal(canManageProject({ id: 'aptushire-head', role: 'MANAGER', organizationId: 'org-1' }, { ...project, verticalOwnerUserId: null }), false);
  assert.equal(canManageProject({ id: 'ceo', role: 'CEO', organizationId: 'org-1' }, { ...project, verticalOwnerUserId: null }), true);
});

test('toPolicyResource maps a project row including its vertical head', () => {
  const resource = toPolicyResource({
    organization_id: 'org-1', department_id: 'd', owner_id: 'o', vertical: { id: 'v', owner_user_id: 'head' },
    project_members: [{ user: { id: 'u' }, project_role: 'MANAGER', permissions_json: { manageTasks: true } }],
  });
  assert.deepEqual(resource, {
    organizationId: 'org-1', departmentId: 'd', ownerUserId: 'o', verticalOwnerUserId: 'head',
    members: [{ userId: 'u', projectRole: 'MANAGER', permissions: { manageTasks: true } }],
  });
  assert.equal(toPolicyResource({ organization_id: 'org-1', owner_id: 'o' }).verticalOwnerUserId, null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test 2>&1 | grep -E "✖|^ℹ (pass|fail)"`
Expected: FAIL. `toPolicyResource` is not a function, and the manager-visibility asserts fail.

- [ ] **Step 3: Implement in `accessPolicy.ts`**

Add `verticalOwnerUserId?: string | null;` to `ProjectPolicyResource`. Add below `membershipFor`:

```ts
// The one place a project row becomes a policy resource. PROJECT_SELECT joins `vertical`.
export const toPolicyResource = (project: any): ProjectPolicyResource => ({
  organizationId: project.organization_id,
  departmentId: project.department_id,
  ownerUserId: project.owner_id,
  verticalOwnerUserId: project.vertical?.owner_user_id ?? null,
  members: (project.project_members || []).map((membership: any) => ({
    userId: membership.user?.id,
    projectRole: membership.project_role,
    permissions: membership.permissions_json,
  })),
});
```

In `canViewProject`, change `if (isSuperAdmin(actor.role)) return true;` to:

```ts
  if (isSuperAdmin(actor.role) || isManager(actor.role)) return true;
```

In `canManageProject`, after `if (resource.ownerUserId === actor.id) return true;`, add:

```ts
  if (resource.verticalOwnerUserId && resource.verticalOwnerUserId === actor.id) return true;
```

- [ ] **Step 4: Widen `canViewAllProjects` in `backend/src/utils/roles.ts`**

```ts
// Heads see everything; what they may change is decided per project by canManageProject.
export const canViewAllProjects = (role: string | undefined): boolean => ['CEO', 'MANAGER'].includes(toPlatformRole(role));
```

Delete the two comment lines above the old definition (`// Kept for existing call sites…`).

- [ ] **Step 5: Join the vertical in `PROJECT_SELECT`** (`projectRepository.ts`)

```ts
const PROJECT_SELECT = `
  *,
  owner:owner_id(id, name),
  vertical:vertical_id(id, name, code, owner_user_id),
  project_members(project_role, permissions_json, joined_at, user:user_id(id, name, email, role, platform_role, designation, phone, department, department_id, status, photo)),
  project_initial_documents(id, name, storage_path, uploaded_at)
`;
```

- [ ] **Step 6: Replace the seven inline builders**

- **`taskWorkflowService.ts`, `hierarchyService.ts`, `blockerService.ts`, `projectLifecycleService.ts`:** delete the local `resourceFor` / `projectResource` const. Import `toPolicyResource` from `'../policies/accessPolicy'`, and replace every call `resourceFor(project)` / `projectResource(project)` with `toPolicyResource(project)`.
- **`projectService.ts`, `projectTaskService.ts`, `middleware/auth.ts`:** replace each inline object literal `{ organizationId: project.organization_id, … members: … }` with `toPolicyResource(project)`. In `auth.ts`, that means `const resource = toPolicyResource(project);`.

Verify nothing inline is left:

Run: `cd backend && grep -rn "ownerUserId: project.owner_id" src | grep -v accessPolicy`
Expected: no output.

- [ ] **Step 7: Run tests and typecheck**

Run: `cd backend && npm test 2>&1 | grep -E "✖|^ℹ (pass|fail)" && npx tsc --noEmit -p .`
Expected: all pass, and no type errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(access): heads see everything and manage their own vertical; one policy resource builder"
```

---

### Task 3: Verticals API and project `verticalId`

**Files:**
- Create: `backend/src/repositories/verticalRepository.ts`, `backend/src/services/verticalService.ts`, `backend/src/controllers/verticalController.ts`, `backend/src/routes/verticalRoutes.ts`, `backend/src/integration/verticals.integration.ts`
- Modify: `backend/src/app.ts` (near line 98), `backend/src/utils/validators.ts` (createProjectSchema ~64, updateProjectSchema ~89), `backend/src/services/projectService.ts` (CreateProjectInput, createProject, updateProject), `backend/src/services/mappers.ts:28`

**Interfaces:**
- Consumes: `toPolicyResource`, `canManageProject` (Task 2).
- Produces:
  - `GET /api/verticals` returns `{ _id, name, code, kind, active, head: { _id, name, email, active } | null }[]`.
  - `PUT /api/verticals/:id` (CEO) accepts `{ name?, ownerUserId?: uuid | null, active? }`.
  - Project DTO gains `vertical: { _id, name, code } | null`.
  - Project create/update accept `verticalId?: uuid | null`.
  - `verticalService.assertCanAssign(verticalId: string | null, actor): Promise<void>`.

- [ ] **Step 1: Write the failing integration test** `backend/src/integration/verticals.integration.ts`

```ts
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../config/supabase';

const API = `${process.env.API_URL || 'http://127.0.0.1:5000'}/api`;
const login = async (email: string) => {
  const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo@123' }) });
  const body = await response.json();
  return { token: body.token as string, id: (body._id || body.id) as string };
};
const call = async (token: string, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
};

let ceo: Awaited<ReturnType<typeof login>>, satyam: typeof ceo, govind: typeof ceo, anush: typeof ceo, disha: typeof ceo;
let verticals: any[];
let aptusProjectId: string, frontdeskProjectId: string, smartHomesProjectId: string;

before(async () => {
  [ceo, satyam, govind, anush, disha] = await Promise.all(['vijendra', 'satyam', 'govind', 'anush', 'disha'].map((name) => login(`${name}@pratap.local`)));
  verticals = (await call(ceo.token, 'GET', '/verticals')).body;
  const byCode = (code: string) => verticals.find((v) => v.code === code)._id;
  const { data: org } = await supabase.from('users').select('organization_id').eq('id', ceo.id).single();
  const stamp = Date.now();
  const { data: rows } = await supabase.from('projects').insert([
    { name: `IT vert aptus ${stamp}`, organization_id: org!.organization_id, owner_id: ceo.id, created_by: ceo.id, vertical_id: byCode('APTUSHIRE'), status: 'Draft', canonical_status: 'DRAFT' },
    { name: `IT vert frontdesk ${stamp}`, organization_id: org!.organization_id, owner_id: ceo.id, created_by: ceo.id, vertical_id: byCode('FRONTDESK'), status: 'Draft', canonical_status: 'DRAFT' },
    { name: `IT vert smarthomes ${stamp}`, organization_id: org!.organization_id, owner_id: ceo.id, created_by: ceo.id, vertical_id: byCode('SMARTHOMES'), status: 'Draft', canonical_status: 'DRAFT' },
  ]).select('id');
  [aptusProjectId, frontdeskProjectId, smartHomesProjectId] = rows!.map((row) => row.id);
});

test('verticals list the five brands with their heads', () => {
  assert.deepEqual(verticals.map((v) => v.code).sort(), ['APTUSHIRE', 'CLIENT_PROJECTS', 'FRONTDESK', 'MARKETINGHARNESS', 'SMARTHOMES']);
  assert.equal(verticals.find((v) => v.code === 'APTUSHIRE').head.name.startsWith('Satyam'), true);
});

test('a head sees every project but edits only their own vertical', async () => {
  const list = (await call(satyam.token, 'GET', '/projects')).body;
  assert.ok(list.some((p: any) => p._id === frontdeskProjectId), 'head sees other verticals');
  assert.equal((await call(satyam.token, 'PUT', `/projects/${aptusProjectId}`, { description: 'head edit' })).status, 200);
  assert.equal((await call(satyam.token, 'PUT', `/projects/${frontdeskProjectId}`, { description: 'not mine' })).status, 403);
  assert.equal((await call(govind.token, 'PUT', `/projects/${frontdeskProjectId}`, { description: 'mine' })).status, 200);
});

test('a Lead-titled head (Anush) manages SmartHomes and nothing else', async () => {
  assert.equal((await call(anush.token, 'PUT', `/projects/${smartHomesProjectId}`, { description: 'head edit' })).status, 200);
  assert.equal((await call(anush.token, 'PUT', `/projects/${frontdeskProjectId}`, { description: 'not mine' })).status, 403);
});

test('an intern (Disha) cannot edit any vertical project', async () => {
  for (const id of [aptusProjectId, frontdeskProjectId, smartHomesProjectId]) {
    assert.equal((await call(disha.token, 'PUT', `/projects/${id}`, { description: 'intern edit' })).status, 403);
  }
});

test('only the CEO or the target vertical head can move a project into a vertical', async () => {
  const frontdesk = verticals.find((v) => v.code === 'FRONTDESK')._id;
  const moved = await call(satyam.token, 'PUT', `/projects/${aptusProjectId}`, { verticalId: frontdesk });
  assert.equal(moved.status, 403);
  assert.equal(moved.body.message, 'Only the CEO or the vertical head can move a project into this vertical');
  assert.equal((await call(ceo.token, 'PUT', `/projects/${aptusProjectId}`, { verticalId: '00000000-0000-4000-8000-000000000000' })).status, 400);
  assert.equal((await call(ceo.token, 'PUT', `/projects/${aptusProjectId}`, { verticalId: null })).status, 200);
  const cleared = (await call(ceo.token, 'GET', `/projects/${aptusProjectId}`)).body;
  assert.equal(cleared.vertical, null);
});

test('team members cannot manage verticals or see unassigned projects', async () => {
  assert.equal((await call(disha.token, 'PUT', `/verticals/${verticals[0]._id}`, { name: 'x' })).status, 403);
  const list = (await call(disha.token, 'GET', '/projects')).body;
  assert.equal(list.some((p: any) => p._id === frontdeskProjectId), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run (backend and local Supabase up): `cd backend && npx tsx --test src/integration/verticals.integration.ts 2>&1 | grep -E "✔|✖"`
Expected: FAIL. `/verticals` returns 404.

- [ ] **Step 3: Repository** `backend/src/repositories/verticalRepository.ts`

```ts
import { supabase } from '../config/supabase';

const SELECT = '*, head:owner_user_id(id, name, email, account_status)';

export const verticalRepository = {
  async list(organizationId: string) {
    const { data, error } = await supabase.from('verticals').select(SELECT).eq('organization_id', organizationId).order('name');
    if (error) throw error;
    return data || [];
  },
  async findById(id: string) {
    const { data, error } = await supabase.from('verticals').select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: { name?: string; owner_user_id?: string | null; active?: boolean }) {
    const { data, error } = await supabase.from('verticals').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT).maybeSingle();
    if (error) throw error;
    return data;
  },
};
```

- [ ] **Step 4: Service** `backend/src/services/verticalService.ts`

```ts
import { verticalRepository } from '../repositories/verticalRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { isSuperAdmin } from '../utils/roles';

interface Actor { id: string; role: string; organizationId?: string }

const orgOf = (actor: Actor) => {
  if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
  return actor.organizationId;
};

const toDto = (row: any) => ({
  _id: row.id, name: row.name, code: row.code, kind: row.kind, active: row.active,
  head: row.head ? { _id: row.head.id, name: row.head.name, email: row.head.email, active: row.head.account_status === 'ACTIVE' } : null,
});

export const verticalService = {
  async list(actor: Actor) {
    return (await verticalRepository.list(orgOf(actor))).map(toDto);
  },

  async update(id: string, patch: { name?: string; ownerUserId?: string | null; active?: boolean }, actor: Actor) {
    if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can manage verticals');
    const existing = await verticalRepository.findById(id);
    if (!existing || existing.organization_id !== orgOf(actor)) throw notFound('Vertical not found');
    const updated = await verticalRepository.update(id, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.ownerUserId !== undefined && { owner_user_id: patch.ownerUserId }),
      ...(patch.active !== undefined && { active: patch.active }),
    });
    await activityLogRepository.create({
      action: 'Vertical Updated', user_id: actor.id, details: `Vertical ${updated.name} was updated.`,
      event: { eventType: 'VERTICAL_UPDATED', entityType: 'VERTICAL', entityId: id, payload: patch },
    });
    return toDto(updated);
  },

  // Moving a project into (or out of) a vertical needs authority over the target.
  async assertCanAssign(verticalId: string | null, actor: Actor) {
    if (verticalId === null) {
      if (!isSuperAdmin(actor.role)) throw forbidden('Only the CEO can remove a project from its vertical');
      return;
    }
    const vertical = await verticalRepository.findById(verticalId);
    if (!vertical || vertical.organization_id !== orgOf(actor)) throw badRequest('Unknown vertical');
    if (!isSuperAdmin(actor.role) && vertical.owner_user_id !== actor.id) throw forbidden('Only the CEO or the vertical head can move a project into this vertical');
  },
};
```

If `activityLogRepository.create`'s `event.entityType` is a closed union that lacks `'VERTICAL'`, add `'VERTICAL'` to that union in the same file, following how `'DEPARTMENT'` is listed.

- [ ] **Step 5: Controller, routes and app wiring**

`backend/src/controllers/verticalController.ts`:

```ts
import { Request, Response } from 'express';
import { verticalService } from '../services/verticalService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const listVerticals = asyncHandler(async (req: Request, res: Response) => res.json(await verticalService.list(actorOf(req))));
export const updateVertical = asyncHandler(async (req: Request, res: Response) => res.json(await verticalService.update(param(req, 'id'), req.body, actorOf(req))));
```

`backend/src/routes/verticalRoutes.ts`:

```ts
import express from 'express';
import { listVerticals, updateVertical } from '../controllers/verticalController';
import { protect, requireCEO } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateVerticalSchema } from '../utils/validators';

const router = express.Router();
router.use(protect);
router.get('/', listVerticals);
router.put('/:id', requireCEO, validateBody(updateVerticalSchema), updateVertical);
export default router;
```

In `backend/src/app.ts`, next to `app.use('/api/departments', departmentRoutes);`:

```ts
app.use('/api/verticals', verticalRoutes);
```

Also add `import verticalRoutes from './routes/verticalRoutes';` with the other route imports.

- [ ] **Step 6: Validators** (`backend/src/utils/validators.ts`)

Add at the end:

```ts
export const updateVerticalSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});
```

Add this field to **both** `createProjectSchema` and `updateProjectSchema`:

```ts
  verticalId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform((value) => value === '' ? null : value),
```

- [ ] **Step 7: Projects accept and return the vertical**

In `projectService.ts`:
- Add `verticalId?: string | null;` to `CreateProjectInput` and to the `updateProject` patch type.
- Import `verticalService` from `'./verticalService'`.

In `createProject`, before `projectRepository.create`:

```ts
    if (input.verticalId) await verticalService.assertCanAssign(input.verticalId, { id: ownerId, role: input.actorRole || '', organizationId: input.organizationId });
```

In the `projectRepository.create` payload, add `vertical_id: input.verticalId || null,`.

In `updateProject`, after the `existing` lookup:

```ts
    if (patch.verticalId !== undefined && patch.verticalId !== (existing.vertical_id ?? null)) {
      if (!actor) throw badRequest('A signed-in user is required to change the vertical');
      await verticalService.assertCanAssign(patch.verticalId, actor);
    }
```

In the `projectRepository.update` object, add `...(patch.verticalId !== undefined && { vertical_id: patch.verticalId }),`.

In `mappers.ts` `mapProject`, after `kind:`:

```ts
  vertical: row.vertical ? { _id: row.vertical.id, name: row.vertical.name, code: row.vertical.code } : null,
```

If `projectRepository.create`/`update` has a typed input (the `Project` model in `backend/src/types/models.ts`), add `vertical_id?: string | null;` to it.

- [ ] **Step 8: Restart backend, run all tests**

Run:

```bash
lsof -ti:5000 -sTCP:LISTEN | xargs -r kill; (cd backend && nohup npx tsx src/server.ts > /tmp/pm-backend.log 2>&1 &); timeout 30 bash -c 'until curl -s -o /dev/null http://127.0.0.1:5000/api/auth/me; do sleep 1; done'
cd backend && npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npx tsc --noEmit -p . && npm run test:integration 2>&1 | grep -E "✖|^ℹ (pass|fail)"
```

Expected: unit tests all pass, and integration shows `fail 0` with the 6 new vertical tests passing.

- [ ] **Step 9: Commit**

```bash
git add backend/src
git commit -m "feat: verticals API; projects carry a vertical with head-only assignment"
```

---

### Task 4: Frontend — verticals in the UI and the Lead fix

**Files:**
- Create: `frontend/src/api/verticalApi.ts`
- Modify: `frontend/src/utils/roles.ts`, `frontend/src/types/index.ts` (Project), `frontend/src/pages/Projects.tsx`, `frontend/src/components/CreateProjectModal.tsx`, `frontend/src/components/EditProjectModal.tsx`, `frontend/src/pages/ProjectDetails.tsx`

**Interfaces:**
- Consumes: `GET /api/verticals` and the project `vertical` field (Task 3).
- Produces: `verticalApi.list(): Promise<Vertical[]>` and `type Vertical = { _id; name; code; kind; active; head: { _id; name; email; active } | null }`.

- [ ] **Step 1: The Lead fix** (`frontend/src/utils/roles.ts`)

The server treats Lead as a manager, so the client must too. Replace `canApproveAgentWork`:

```ts
// Mirrors the backend: Lead and Project Manager are both the MANAGER platform role.
export const canApproveAgentWork = (role: string | undefined): boolean => isSuperAdmin(role) || isProjectManager(role) || isLead(role);
```

- [ ] **Step 2: API client** `frontend/src/api/verticalApi.ts`

```ts
import api, { expectArray } from './index';

export interface Vertical {
  _id: string;
  name: string;
  code: string;
  kind: 'PRODUCT' | 'CLIENT_SERVICES';
  active: boolean;
  head: { _id: string; name: string; email: string; active: boolean } | null;
}

export const verticalApi = {
  list: () => api.get<Vertical[]>('/verticals').then((response) => expectArray<Vertical>(response.data)),
};
```

- [ ] **Step 3: Project type**

In `frontend/src/types/index.ts` `interface Project`, add:

```ts
  vertical?: { _id: string; name: string; code: string } | null;
```

- [ ] **Step 4: Projects list — the vertical filter replaces the guessed "portfolio"** (`Projects.tsx`)

- Remove the `PROJECT_PORTFOLIOS` / `getProjectPortfolio` import. `Dashboard.tsx` still uses them; that page is dead code and stays untouched.
- Load verticals once:

```tsx
const [verticals, setVerticals] = useState<Vertical[]>([]);
useEffect(() => { verticalApi.list().then(setVerticals).catch(() => setVerticals([])); }, []);
const verticalFilter = searchParams.get('vertical') || 'All';
```

- In the filter predicate, replace `(portfolioFilter === 'All' || getProjectPortfolio(project) === portfolioFilter)` with:

```tsx
(verticalFilter === 'All' || (verticalFilter === 'NONE' ? !project.vertical : project.vertical?._id === verticalFilter))
```

- Replace the "Domain" `<label>` block with:

```tsx
<label className="project-select"><FolderKanban size={14} /><span>Vertical</span>
  <select value={verticalFilter} onChange={(e) => setSearchParams(e.target.value === 'All' ? {} : { vertical: e.target.value })}>
    <option value="All">All verticals</option>
    {verticals.map((vertical) => <option key={vertical._id} value={vertical._id}>{vertical.name}</option>)}
    <option value="NONE">No vertical</option>
  </select>
</label>
```

- In `hasActiveFilters`, replace `portfolioFilter !== 'All'` with `verticalFilter !== 'All'`. Delete the `portfolioFilter` const.
- In each project row, show the vertical next to the existing category/department text: `{project.vertical?.name || 'No vertical'}`.

- [ ] **Step 5: Create and Edit modals**

Both modals load `verticalApi.list()` on open and add a select after the Department field:

```tsx
<label className="form-label">Vertical
  <select className="form-select" value={form.verticalId} onChange={set('verticalId')}>
    <option value="">No vertical</option>
    {verticals.filter((vertical) => vertical.active).map((vertical) => <option key={vertical._id} value={vertical._id}>{vertical.name}{vertical.head ? ` · ${vertical.head.name}${vertical.head.active ? '' : ' (head inactive)'}` : ' · no head'}</option>)}
  </select>
</label>
```

- **`CreateProjectModal`:** initial `verticalId: ''`, and append `verticalId: form.verticalId` to the create payload next to `department: form.department`. If the create call sends multipart `FormData`, append `formData.append('verticalId', form.verticalId)` instead.
- **`EditProjectModal`:** initial `verticalId: project.vertical?._id ?? ''`, and send `verticalId: form.verticalId` in the update payload. The server turns `''` into `null`.
- If `set(...)` is typed to a fixed key union, add `'verticalId'` to it.

- [ ] **Step 6: Project page**

In `ProjectDetails.tsx`, show the vertical in the header meta where category or department appear: `{project.vertical?.name || 'No vertical'}`.

- [ ] **Step 7: Typecheck, lint, build**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build 2>&1 | tail -2`
Expected: no errors, and the build completes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): vertical filter, picker and label; Lead managers get manager controls"
```

---

### Task 5: People changes (local), then the role-by-role pass

**Files:**
- Create: `docs/superpowers/reports/2026-09-30-role-access-pass.md` (the results)

**Interfaces:**
- Consumes: everything above. Production people changes are done by the CEO in the Team page and are **not** part of this task.

- [ ] **Step 1: Apply the people changes locally through the real API as the CEO**

Use `POST /api/auth/register`, the same call the Team page makes. Read the exact body in `backend/src/utils/validators.ts` `registerSchema`. Create:
- Sankalp: `sankalp@pratap.ai`, MANAGER, designation "Head of MarketingHarness", department Marketing.
- Henry: `vincent@pratap.ai`, MANAGER, designation "Head of Sales", department Sales.

Use the local password `Demo@123`. Then:
- `POST /api/users/:id/deactivate` for Devesh, Saransh and Sunny.
- Update Satyam's designation to "Head of AptusHire" through the user update endpoint used by the Team page.
- `PUT /api/verticals/<MarketingHarness id> { ownerUserId: <Sankalp id> }`.
- Disha works under Govind (FrontDesk). No new rule: Govind adds her as a member of FrontDesk projects. For the browser pass, add her to the FrontDesk project created by the integration test, then verify she sees it, can update only her own assigned tasks there, and cannot edit the project.
- Re-run the Sales-lead update from the migration (it is idempotent) so Henry becomes the Sales department lead:

```bash
docker exec -i supabase_db_PM_Pratap_AI psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backend/supabase/migrations/0028_verticals.sql
```

Verify: `GET /api/verticals` shows all five heads, and Devesh cannot log in (403 or 401).

- [ ] **Step 2: Browser pass**

For each role, drive the app headless (Playwright with the cached chrome-headless-shell):
- CEO: Vijendra
- Head with the "Project Manager" title: Satyam
- Head with the "Lead" title: Anush
- New head: Sankalp
- Team member: Disha

On every sidebar page, record per role: page loads without console errors, expected controls present, forbidden controls absent. Then check the server enforces the same rules with a direct API call for each "absent" control.

Pages to cover:
- Home / My Day (start, add work, end day)
- Work history and team history
- Tasks board
- My Projects: list, vertical filter, create, edit, vertical picker
- Project page: plan, board, documents, team, milestones, activity
- Completed projects
- Documents & Links
- Idea bucket
- Agent Studio (managers)
- Reports: personal vs organization scope
- Notifications, Messages
- Team page (CEO): invite, deactivate

Company-wide checks:
- CEO and every head see all 5 verticals' projects and the whole team's history.
- Disha sees only her own projects.
- Reports show ORGANIZATION scope for the CEO and heads.

- [ ] **Step 3: Write the results**

In `docs/superpowers/reports/2026-09-30-role-access-pass.md`, write one table per role (page, expected, actual, pass/fail), then a list of defects with file:line. Fix defects that break this spec's success criteria in place, with a test each, and re-run. List the rest for the user.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/reports/2026-09-30-role-access-pass.md
git commit -m "docs: role-by-role access pass after verticals"
```
