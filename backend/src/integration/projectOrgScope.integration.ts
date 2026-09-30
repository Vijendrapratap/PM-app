import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../config/supabase';

const API = `${process.env.API_URL || 'http://127.0.0.1:5000'}/api`;
const login = async (email: string) => {
  const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo@123' }) });
  const body = await response.json();
  return { token: body.token as string, id: (body._id || body.id) as string };
};
const call = async (token: string, method: string, path: string) => {
  const response = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  return { status: response.status, body: await response.json().catch(() => null) };
};

let ceo: Awaited<ReturnType<typeof login>>, satyam: Awaited<ReturnType<typeof login>>;
let otherOrgId: string;
let otherOrgProjectId: string;

before(async () => {
  [ceo, satyam] = await Promise.all(['vijendra', 'satyam'].map((name) => login(`${name}@pratap.local`)));
  const stamp = Date.now();
  const { data: org, error: orgError } = await supabase.from('organizations').insert({ name: `Org scope test ${stamp}` }).select('id').single();
  if (orgError) throw orgError;
  otherOrgId = org!.id;
  const { data: project, error: projectError } = await supabase.from('projects').insert({
    name: `Other org project ${stamp}`, organization_id: otherOrgId, owner_id: ceo.id, created_by: ceo.id, status: 'Draft', canonical_status: 'DRAFT',
  }).select('id').single();
  if (projectError) throw projectError;
  otherOrgProjectId = project!.id;
});

after(async () => {
  await supabase.from('projects').delete().eq('id', otherOrgProjectId);
  await supabase.from('organizations').delete().eq('id', otherOrgId);
});

test('a project in another organization is excluded from a head\'s GET /projects', async () => {
  const list = (await call(satyam.token, 'GET', '/projects')).body;
  assert.equal(list.some((p: any) => p._id === otherOrgProjectId), false);
});

test('a project in another organization is excluded from the CEO\'s GET /projects', async () => {
  const list = (await call(ceo.token, 'GET', '/projects')).body;
  assert.equal(list.some((p: any) => p._id === otherOrgProjectId), false);
});
