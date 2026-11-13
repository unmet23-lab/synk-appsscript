import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-member-organization-'));
  const app = createCompanyApp({ dataDir: directory, port: 0, allowTestHost: true, schedule: false });
  const address = await app.start(), base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await app.stop(); await rm(directory, { recursive: true, force: true }); });
  const employee = (name, role = 'member', teamId = null) => app.store.createUser({ name, email: `${name}@example.test`, password: 'directory-fixture-password', role, teamId });
  const admin = employee('admin', 'admin'), team = id => app.store.put('teams', id, { id, name: id, active: true });
  function client(person) {
    const cookie = person ? `synk_company_session=${app.store.mint('session', person.id, { csrfToken: 'directory-csrf' }, 10)}` : '';
    return async (path, body, headers = {}) => {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: app.origin, 'X-CSRF-Token': 'directory-csrf' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() };
    };
  }
  return { app, employee, admin, team, client, a: client(admin) };
}
const initial = { jobTitle: '', responsibilities: '', expectedRevision: null };
const route = person => `/api/members/${person.id}/organization`;

test('existing team names do not infer brand assignments or work roles', async t => {
  const { a, employee, team } = await fixture(t);
  team('PULSE'); const member = employee('staff', 'member', 'PULSE');
  const response = await a('/api/state');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.members.find(row => row.id === member.id).organization, { brands: [], jobTitle: '', responsibilities: '', revision: null, updatedAt: null });
});

test('a malformed stored brand list cannot break the entire member directory', async t => {
  const { app, a, employee } = await fixture(t), member = employee('staff');
  app.store.put('memberOrganization', member.id, { id: member.id, brands: {}, jobTitle: '기획' });
  const response = await a('/api/state');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.members.find(row => row.id === member.id).organization.brands, []);
});

test('legacy descriptive brands cannot override company membership and membership changes appear immediately', async t => {
  const { app, a, employee } = await fixture(t), member = employee('staff');
  app.store.put('memberOrganization', member.id, { id: member.id, brands: ['PULSE'], jobTitle: '기획' });
  const assign = company => app.store.put('users',member.id,{...app.store.get('users',member.id),workspaceProfile:{version:1,memberships:[{company,role:'operations'}],duties:[]}});
  assign('LAB');
  let response = await a('/api/state');
  assert.deepEqual(response.data.members.find(row => row.id === member.id).organization.brands, ['LAB']);
  assert.equal((await a(route(member), {...initial,brands:['PULSE']})).status,400);
  assign('PATH');
  response = await a('/api/state');
  assert.deepEqual(response.data.members.find(row => row.id === member.id).organization.brands, ['PATH']);
  assert.equal(response.data.members.find(row => row.id === member.id).organization.jobTitle,'기획');
});

test('directory reads canonical memberships and saving descriptions never changes access, account or sessions', async t => {
  const { app, a, employee, client, admin } = await fixture(t);
  const member = employee('staff'), staff = client(member);
  app.store.put('users',member.id,{...app.store.get('users',member.id),workspaceProfile:{version:1,memberships:[{company:'PULSE',role:'producer'},{company:'LAB',role:'teacher'}],duties:[]}});
  const before = app.store.get('users', member.id);
  const saved = await a(route(member), { ...initial, jobTitle: ' 영상 제작 ', responsibilities: '촬영\n최종본 확인' });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data.organization.brands, ['LAB', 'PULSE']);
  assert.equal(saved.data.organization.jobTitle, '영상 제작');
  assert.equal(saved.data.organization.responsibilities, '촬영\n최종본 확인');
  assert.deepEqual(app.store.get('users', member.id), before);
  assert.equal((await staff('/api/state')).status, 200);
  assert.equal((await a(route(admin), { ...initial })).status, 200);
  const ownState = await staff('/api/state');
  assert.deepEqual(ownState.data.members.find(row => row.id === member.id).organization, saved.data.organization);
});

test('existing member visibility is preserved; matching brands never grant visibility', async t => {
  const { a, employee, team, client } = await fixture(t);
  team('alpha'); team('beta');
  const lead = employee('lead', 'manager', 'alpha'), own = employee('own', 'member', 'alpha'), other = employee('other', 'member', 'beta');
  for (const person of [lead, own, other]) assert.equal((await a(route(person), { ...initial, jobTitle: person.name })).status, 200);
  const teamState = await client(lead)('/api/state');
  assert.deepEqual(new Set(teamState.data.members.map(row => row.id)), new Set([lead.id, own.id]));
  const memberState = await client(own)('/api/state');
  assert.deepEqual(memberState.data.members.map(row => row.id), [own.id]);
  assert.ok(!JSON.stringify(memberState.data.members).includes(other.id));
});

test('manager, member, viewer and anonymous requests cannot edit organization metadata', async t => {
  const { app, employee, team, client } = await fixture(t);
  team('alpha'); const target = employee('target', 'member', 'alpha');
  for (const role of ['manager', 'member', 'viewer']) {
    const response = await client(employee(role, role, 'alpha'))(route(target), initial);
    assert.equal(response.status, 403, role);
  }
  assert.ok([401, 403].includes((await client(null)(route(target), initial)).status));
  assert.equal(app.store.get('memberOrganization', target.id), null);
});

test('strict fields reject access changes, invalid brands, malformed revisions and oversized text', async t => {
  const { app, a, employee } = await fixture(t), member = employee('staff');
  for (const input of [
    { ...initial, role: 'admin' }, { ...initial, teamId: 'alpha' }, { ...initial, brands: ['UNKNOWN'] },
    { ...initial, brands: 'LAB' }, { ...initial, brands: [null] }, { ...initial, brands: Array(5).fill('LAB') },
    { ...initial, jobTitle: {} }, { ...initial, jobTitle: 'a'.repeat(81) }, { ...initial, responsibilities: 'a'.repeat(601) },
    { ...initial, responsibilities: 'bad\u0000value' }, { ...initial, expectedRevision: 'old' }, { ...initial, expectedRevision: 'a'.repeat(36) },
    { jobTitle: '', responsibilities: '' },
  ]) assert.equal((await a(route(member), input)).status, 400, JSON.stringify(input));
  assert.equal(app.store.get('memberOrganization', member.id), null);
  assert.equal(app.store.get('users', member.id).role, 'member');
  assert.equal((await a('/api/members/not-a-member/organization', initial)).status, 404);
});

test('stale edits and old blank forms cannot overwrite current or cleared work information', async t => {
  const { a, employee } = await fixture(t), member = employee('staff');
  const first = await a(route(member), { ...initial, jobTitle: '안내' });
  assert.equal((await a(route(member), initial)).status, 409);
  const cleared = await a(route(member), { ...initial, expectedRevision: first.data.organization.revision });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.data.organization.brands, []);
  assert.equal(cleared.data.organization.jobTitle, '');
  assert.equal(cleared.data.organization.responsibilities, '');
  assert.notEqual(cleared.data.organization.revision, first.data.organization.revision);
  assert.equal((await a(route(member), { ...initial, expectedRevision: first.data.organization.revision, jobTitle: '덮기' })).status, 409);
  assert.equal((await a(route(member), { ...initial, jobTitle: '덮기' })).status, 409);
  const state = await a('/api/state');
  assert.deepEqual(state.data.members.find(row => row.id === member.id).organization, cleared.data.organization);
});

test('organization writes keep the normal origin and CSRF checks', async t => {
  const { a, employee, app } = await fixture(t), member = employee('staff');
  assert.equal((await a(route(member), initial, { Origin: 'https://example.invalid' })).status, 403);
  assert.equal((await a(route(member), initial, { 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal(app.store.get('memberOrganization', member.id), null);
});
