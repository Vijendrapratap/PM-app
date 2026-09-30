import test, { before, after } from 'node:test';
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

after(async () => {
  await supabase.from('projects').delete().in('id', [aptusProjectId, frontdeskProjectId, smartHomesProjectId]);
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

test('structural writes on another vertical are refused (milestones)', async () => {
  assert.equal((await call(satyam.token, 'POST', `/projects/${frontdeskProjectId}/milestones`, { name: 'Not mine' })).status, 403);
  assert.equal((await call(govind.token, 'POST', `/projects/${frontdeskProjectId}/milestones`, { name: 'Mine' })).status, 201);
});
