import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';

const API = `${process.env.API_URL}/api`;
const login = async (email: string) => {
  const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo@123' }) });
  const body = await response.json();
  return { id: body._id as string, token: body.token as string, organizationId: '' };
};
const call = async (token: string, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
};

let dev: Awaited<ReturnType<typeof login>>, pm: Awaited<ReturnType<typeof login>>, ceo: Awaited<ReturnType<typeof login>>;
let orgId: string, projectId: string, taskIds: string[];

before(async () => {
  [pm, ceo] = await Promise.all([login('govind@pratap.local'), login('vijendra@pratap.local')]);
  // A fresh team member per run: work_logs are immutable, so a reused user's
  // session for today could never be reset.
  const { data: template } = await supabase.from('users').select('organization_id, department_id, department').eq('email', 'devesh@pratap.local').single();
  orgId = template!.organization_id;
  const stamp = Date.now();
  const email = `it-${stamp}@pratap.local`;
  const { error: userError } = await supabase.from('users').insert({
    name: `IT Member ${stamp}`, email, password_hash: await bcrypt.hash('Demo@123', 10), role: 'Team Member', platform_role: 'TEAM_MEMBER',
    organization_id: orgId, department_id: template!.department_id, department: template!.department,
    account_status: 'ACTIVE', status: 'Active', onboarding_completed_at: new Date().toISOString(), timezone: 'Asia/Dubai',
  });
  if (userError) throw userError;
  dev = await login(email);
  // Fixture: an ACTIVE delivery project with the member and three open tasks.
  const { data: project } = await supabase.from('projects').insert({ name: `IT gate ${stamp}`, status: 'In Progress', canonical_status: 'ACTIVE', kind: 'DELIVERY', owner_id: pm.id, created_by: pm.id, organization_id: orgId, priority: 'Medium' }).select('id').single();
  projectId = project!.id;
  await supabase.from('project_members').insert({ project_id: projectId, user_id: dev.id });
  const { data: tasks } = await supabase.from('project_tasks').insert([1, 2, 3].map((n) => ({ project_id: projectId, organization_id: orgId, title: `IT task ${n}`, status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' }))).select('id');
  taskIds = tasks!.map((task) => task.id);
});

test('start rejects more than 3 commitments and a task you do not own', async () => {
  assert.equal((await call(dev.token, 'POST', '/daily-work/start', { commitments: [...taskIds, taskIds[0]] })).status, 400);
  const { data: other } = await supabase.from('project_tasks').insert({ project_id: projectId, organization_id: orgId, title: 'IT not mine', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: pm.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' }).select('id').single();
  assert.equal((await call(dev.token, 'POST', '/daily-work/start', { commitments: [other!.id] })).status, 403);
});

test('start with commitments, log requires a task, quick-add lands in the ops project', async () => {
  const started = await call(dev.token, 'POST', '/daily-work/start', { commitments: taskIds.slice(0, 2) });
  assert.equal(started.status, 201);
  assert.equal(started.body.commitments.length, 2);
  assert.equal((await call(dev.token, 'POST', '/daily-work/logs', { title: 'x', description: 'no task' })).status, 400);
  const logged = await call(dev.token, 'POST', '/daily-work/logs', { taskId: taskIds[0], title: 'API', description: 'built it', minutes: 30 });
  assert.equal(logged.status, 201);
  const quick = await call(dev.token, 'POST', '/daily-work/logs', { newTask: { title: 'IT quick-add' }, title: 'Quick', description: 'untracked work' });
  assert.equal(quick.status, 201);
  const { data: created } = await supabase.from('project_tasks').select('project:project_id(kind)').eq('assigned_to', dev.id).eq('title', 'IT quick-add').single();
  assert.equal((created as any).project.kind, 'STANDING');
});

test('quick-add without a department and without a project asks for a project', async () => {
  const { data: before } = await supabase.from('users').select('department_id').eq('id', dev.id).single();
  await supabase.from('users').update({ department_id: null }).eq('id', dev.id);
  const response = await call(dev.token, 'POST', '/daily-work/logs', { newTask: { title: 'IT orphan' }, title: 'x', description: 'x' });
  await supabase.from('users').update({ department_id: before!.department_id }).eq('id', dev.id);
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Choose a project for this task');
});

test('quick-add: only your own ops project auto-joins; department-less users fall back to their standing project', async () => {
  const { data: founder } = await supabase.from('projects').select('id').eq('organization_id', orgId).eq('kind', 'STANDING').is('department_id', null).limit(1).single();
  const denied = await call(dev.token, 'POST', '/daily-work/logs', { newTask: { title: 'IT not my office', projectId: founder!.id }, title: 'x', description: 'x' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.message, 'You can only add tasks to projects you are a member of');
  const { data: before } = await supabase.from('users').select('department_id').eq('id', dev.id).single();
  await supabase.from('project_members').insert({ project_id: founder!.id, user_id: dev.id });
  await supabase.from('users').update({ department_id: null }).eq('id', dev.id);
  try {
    assert.equal((await call(dev.token, 'POST', '/daily-work/logs', { newTask: { title: 'IT founder fallback' }, title: 'x', description: 'x' })).status, 201);
    const { data: created } = await supabase.from('project_tasks').select('project_id').eq('assigned_to', dev.id).eq('title', 'IT founder fallback').single();
    assert.equal(created!.project_id, founder!.id);
  } finally {
    await supabase.from('users').update({ department_id: before!.department_id }).eq('id', dev.id);
    await supabase.from('project_members').delete().eq('project_id', founder!.id).eq('user_id', dev.id);
  }
});

test('logging on a closed task fails with a clear message', async () => {
  await supabase.from('project_tasks').update({ canonical_status: 'CANCELLED' }).eq('id', taskIds[1]);
  const response = await call(dev.token, 'POST', '/daily-work/logs', { taskId: taskIds[1], title: 'x', description: 'x' });
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'This task is closed');
});

test('end requires an outcome per commitment and still accepts a cancelled commitment', async () => {
  assert.equal((await call(dev.token, 'POST', '/daily-work/end', { outcomes: [{ taskId: taskIds[0], outcome: 'DONE' }] })).status, 400);
  const ended = await call(dev.token, 'POST', '/daily-work/end', { outcomes: [{ taskId: taskIds[0], outcome: 'DONE' }, { taskId: taskIds[1], outcome: 'CARRIED' }] });
  assert.equal(ended.status, 200);
  assert.equal(ended.body.status, 'COMPLETED');
});

test('team member cannot PUT a task to DONE; WIP limit blocks a third start', async () => {
  assert.equal((await call(dev.token, 'PUT', `/projects/${projectId}/tasks/${taskIds[0]}`, { status: 'Completed' })).status, 403);
  await supabase.from('project_tasks').update({ canonical_status: 'IN_PROGRESS', status: 'In Progress' }).in('id', [taskIds[0], taskIds[2]]);
  const { data: extra } = await supabase.from('project_tasks').insert({ project_id: projectId, organization_id: orgId, title: 'IT third', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' }).select('id').single();
  assert.equal((await call(dev.token, 'POST', `/tasks/${extra!.id}/start`)).status, 409);
});

test('a task with logged work cannot be deleted', async () => {
  const response = await call(pm.token, 'DELETE', `/projects/${projectId}/tasks/${taskIds[0]}`);
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'This task has logged work; cancel it instead');
});

test('lifecycle: brief gate, cap with CEO override, legacy status edits', async () => {
  const { data: draft } = await supabase.from('projects').insert({ name: `IT draft ${Date.now()}`, status: 'Draft', canonical_status: 'DRAFT', kind: 'DELIVERY', owner_id: pm.id, created_by: pm.id, organization_id: orgId, priority: 'Medium' }).select('*').single();
  const gap = await call(pm.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'PLANNING' });
  assert.equal(gap.status, 400);
  assert.match(gap.body.message, /^Complete the brief first: /);
  // Complete the brief directly, then activate with the org cap forced to 1.
  const { data: milestone } = await supabase.from('milestones').insert({ project_id: draft!.id, name: 'M1', status: 'PLANNED' }).select('id').single();
  await supabase.from('project_tasks').insert({ project_id: draft!.id, organization_id: orgId, milestone_id: milestone!.id, title: 'IT brief task', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' });
  await supabase.from('projects').update({ objective: 'Ship', success_criteria_json: ['Live'], target_date: '2026-12-31' }).eq('id', draft!.id);
  assert.equal((await call(pm.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'PLANNING' })).status, 200);
  const { data: settings } = await supabase.from('org_settings').select('max_active_projects_org').eq('organization_id', orgId).single();
  await supabase.from('org_settings').update({ max_active_projects_org: 1 }).eq('organization_id', orgId);
  try {
    assert.equal((await call(pm.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'ACTIVE' })).status, 409);
    assert.equal((await call(ceo.token, 'POST', `/projects/${draft!.id}/lifecycle`, { to: 'ACTIVE', override: true, reason: 'IT override' })).status, 200);
  } finally {
    await supabase.from('org_settings').update({ max_active_projects_org: settings!.max_active_projects_org }).eq('organization_id', orgId);
  }
  // Legacy edit modal: unchanged status is a no-op, Completed is refused.
  // (Name is stamped: a fixed literal collides with the previous run's row
  // via the projects_name_key unique constraint, since fixtures aren't torn down.)
  const { data: current } = await supabase.from('projects').select('status').eq('id', draft!.id).single();
  assert.equal((await call(pm.token, 'PUT', `/projects/${draft!.id}`, { name: `IT renamed ${Date.now()}`, status: current!.status })).status, 200);
  const done = await call(pm.token, 'PUT', `/projects/${draft!.id}`, { status: 'Completed' });
  assert.equal(done.status, 400);
  assert.equal(done.body.message, 'Use Finish project to deliver a project');
});

test('CEO can read team work logs', async () => {
  assert.equal((await call(ceo.token, 'GET', '/daily-work/admin')).status, 200);
});

const activeProject = async (name: string) => {
  const { data } = await supabase.from('projects').insert({ name: `${name} ${Date.now()}`, status: 'In Progress', canonical_status: 'ACTIVE', kind: 'DELIVERY', owner_id: pm.id, created_by: pm.id, organization_id: orgId, priority: 'Medium' }).select('id').single();
  await supabase.from('project_members').insert({ project_id: data!.id, user_id: dev.id });
  return data!.id as string;
};
const devTask = async (project: string, title: string, stage: 'IN_PROGRESS' | 'IN_REVIEW', extra: Record<string, unknown> = {}) => {
  const { data } = await supabase.from('project_tasks').insert({ project_id: project, organization_id: orgId, title, status: stage === 'IN_PROGRESS' ? 'In Progress' : 'In Review', canonical_status: stage, assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium', ...extra }).select('id').single();
  return data!.id as string;
};

test('Edit Project saves the brief in the same save that moves the stage, and can park and cancel', async () => {
  const { data: draft } = await supabase.from('projects').insert({ name: `IT brief edit ${Date.now()}`, status: 'Draft', canonical_status: 'DRAFT', kind: 'DELIVERY', owner_id: pm.id, created_by: pm.id, organization_id: orgId, priority: 'Medium' }).select('id').single();
  await supabase.from('milestones').insert({ project_id: draft!.id, name: 'M1', status: 'PLANNED' });
  await supabase.from('project_tasks').insert({ project_id: draft!.id, organization_id: orgId, title: 'IT brief edit task', status: 'Pending', canonical_status: 'BACKLOG', assigned_to: dev.id, created_by: pm.id, estimate_minutes: 60, priority: 'Medium' });
  const planned = await call(pm.token, 'PUT', `/projects/${draft!.id}`, { objective: 'Ship it', successCriteria: [' Live on domain ', 'Client sign-off'], targetDate: '2026-12-31', status: 'Planning' });
  assert.equal(planned.status, 200);
  assert.equal(planned.body.stage, 'PLANNING');
  assert.deepEqual([planned.body.objective, planned.body.successCriteria, planned.body.targetDate], ['Ship it', ['Live on domain', 'Client sign-off'], '2026-12-31']);
  assert.equal((await call(pm.token, 'PUT', `/projects/${draft!.id}`, { successCriteria: [''] })).status, 400);

  const project = await activeProject('IT park');
  const parked = await call(pm.token, 'PUT', `/projects/${project}`, { status: 'On Hold' });
  assert.equal(parked.status, 200);
  assert.equal(parked.body.stage, 'ON_HOLD');
  const cancelled = await call(pm.token, 'PUT', `/projects/${project}`, { status: 'Cancelled' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.stage, 'CANCELLED');
});

test('an assignee completing a task sends it to the project owner for review; self-review is refused', async () => {
  const project = await activeProject('IT complete');
  const taskId = await devTask(project, 'IT complete me', 'IN_PROGRESS');
  assert.equal((await call(dev.token, 'POST', `/tasks/${taskId}/request-review`, { reviewerUserId: dev.id })).status, 400);
  assert.equal((await call(dev.token, 'POST', `/tasks/${taskId}/complete`, { completionNote: 'done' })).status, 200);
  const { data: task } = await supabase.from('project_tasks').select('canonical_status, status, reviewer_user_id').eq('id', taskId).single();
  assert.deepEqual(task, { canonical_status: 'IN_REVIEW', status: 'In Review', reviewer_user_id: pm.id });
});

test('reviewer can request changes while the assignee is at the WIP limit', async () => {
  const project = await activeProject('IT reject');
  await devTask(project, 'IT wip 1', 'IN_PROGRESS');
  await devTask(project, 'IT wip 2', 'IN_PROGRESS');
  const taskId = await devTask(project, 'IT under review', 'IN_REVIEW', { reviewer_user_id: pm.id });
  const rejected = await call(pm.token, 'POST', `/tasks/${taskId}/reject`, { note: 'Needs tests' });
  assert.equal(rejected.status, 200);
  const { data: task } = await supabase.from('project_tasks').select('canonical_status').eq('id', taskId).single();
  assert.equal(task!.canonical_status, 'IN_PROGRESS');
});
