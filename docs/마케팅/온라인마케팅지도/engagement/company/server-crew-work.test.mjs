import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createCompanyApp } from './server.mjs';

const profile = changes => ({ skills: ['planning'], preferredTasks: ['design'], communication: 'async', workMode: 'solo', availableHours: 4, participates: true, confirmed: true, ...changes });
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-crew-work-'));
  const options = { dataDir: directory, port: 0, allowTestHost: true, schedule: false, messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } };
  let app = createCompanyApp(options), address = await app.start();
  t.after(async () => { await app.stop(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true }); });
  app.store.put('teams', 'team-a', { id: 'team-a', name: '마케팅팀', active: true }); app.store.put('teams', 'team-b', { id: 'team-b', name: '디자인팀', active: true });
  const users = Object.fromEntries([['admin', 'admin', null], ['manager', 'manager', 'team-a'], ['member', 'member', 'team-a'], ['peer', 'member', 'team-b'], ['viewer', 'viewer', 'team-a'], ['hidden', 'member', 'team-a']].map(([key, role, teamId]) => [key, app.store.createUser({ name: `검증 ${key}`, email: `${key}@example.test`, role, teamId })]));
  const tokens = Object.fromEntries(Object.entries(users).map(([key, user]) => [key, app.store.mint('session', user.id, { csrfToken: key }, 60)]));
  const base = () => `http://127.0.0.1:${address.port}`;
  const headers = key => ({ Cookie: `synk_company_session=${tokens[key]}`, Origin: app.origin, 'X-CSRF-Token': key, 'Content-Type': 'application/json' });
  async function json(key, path, method = 'GET', body, expected = 200, extra = {}) {
    const response = await fetch(base() + path, { method, headers: { ...headers(key), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }), data = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`); return data;
  }
  const get = key => json(key, '/api/crew-profile');
  async function save(key, changes = {}) { const state = await get(key); return json(key, '/api/crew-profile', 'POST', profile({ ...changes, expectedRevision: state.revision })); }
  const evaluate = (key, memberKeys, changes = {}, expected = 200) => json(key, '/api/crew-work/evaluate', 'POST', { requiredSkills: ['planning'], memberIds: memberKeys.map(member => users[member]?.id || member), minAvailableHours: 2, ...changes }, expected);
  return { get app() { return app; }, users, tokens, headers, base, json, get, save, evaluate, async restart() { await app.stop(); app = createCompanyApp(options); address = await app.start(); } };
}

test('self-confirmed profiles are private, catalog-only, CSRF protected and editable by the owning viewer', async t => {
  const f = await fixture(t);
  const blank = await f.get('viewer'); assert.equal(blank.profile, null); assert.equal(blank.revision, null); assert.equal(blank.permissions.canEvaluate, false); assert.equal(blank.catalog.skills.length, 10);
  await f.json('member', '/api/crew-profile', 'POST', profile({ expectedRevision: null, confirmed: false }), 400);
  for (const changes of [{ skills: ['INTJ'] }, { rawChat: 'private chat' }, { userId: f.users.peer.id }, { communication: 'outgoing' }, { availableHours: '2' }]) await f.json('admin', '/api/crew-profile', 'POST', profile({ ...changes, expectedRevision: null }), 400);
  await f.json('viewer', '/api/crew-profile', 'POST', profile({ expectedRevision: null }), 403, { 'X-CSRF-Token': 'wrong' });
  await f.json('viewer', '/api/crew-profile', 'POST', profile({ expectedRevision: null }), 403, { Origin: 'https://invalid.example' });
  const saved = await f.save('viewer'); assert.equal(saved.profile.userId, f.users.viewer.id); assert.ok(saved.profile.confirmedAt); assert.equal(saved.profile.revision, saved.revision);
  assert.equal((await f.get('admin')).profile, null);
  await f.json('admin', '/api/crew-profile?userId=' + f.users.viewer.id, 'GET', undefined, 400);
  const before = JSON.stringify(f.app.store.get('crewWorkProfiles', f.users.viewer.id));
  await f.json('admin', '/api/crew-profile/delete', 'POST', { expectedRevision: null, userId: f.users.viewer.id }, 400);
  assert.equal(JSON.stringify(f.app.store.get('crewWorkProfiles', f.users.viewer.id)), before);
  const deleted = await f.json('viewer', '/api/crew-profile/delete', 'POST', { expectedRevision: saved.revision }); assert.equal(deleted.profile, null); assert.equal(f.app.store.get('crewWorkProfiles', f.users.viewer.id), null);
});

test('roster exposes shared work cards only within current active organization scope', async t => {
  const f = await fixture(t);
  await f.save('member'); await f.save('peer', { skills: ['development'] }); await f.save('viewer', { participates: false, skills: ['research'] }); await f.save('hidden');
  f.app.store.put('users', f.users.hidden.id, { ...f.users.hidden, active: false });
  const admin = await f.json('admin', '/api/crew-work/roster'); assert.equal(admin.scope.type, 'company'); assert.equal(admin.summary.activeCount, 5); assert.equal(admin.summary.sharedCount, 2);
  const unshared = admin.members.find(member => member.id === f.users.viewer.id); assert.equal(unshared.shared, false); assert.equal(unshared.profile, undefined); assert.equal(unshared.completeness, undefined); assert.doesNotMatch(JSON.stringify(admin), /@example|passwordHash/);
  const manager = await f.json('manager', '/api/crew-work/roster'); assert.equal(manager.scope.teamId, 'team-a'); assert.equal(manager.members.some(member => member.id === f.users.peer.id), false); assert.equal(manager.members.some(member => member.id === f.users.hidden.id), false);
  for (const key of ['member', 'viewer']) await f.json(key, '/api/crew-work/roster', 'GET', undefined, 403);
  await f.json('manager', '/api/crew-work/roster?teamId=team-b', 'GET', undefined, 400);
  const row = f.app.store.get('crewWorkProfiles', f.users.member.id); f.app.store.put('crewWorkProfiles', f.users.member.id, { ...row, confirmedAt: null });
  assert.equal((await f.json('manager', '/api/crew-work/roster')).members.find(member => member.id === f.users.member.id).shared, false);
  f.app.store.put('teams', 'team-a', { id: 'team-a', name: '비활성팀', active: false });
  await f.json('manager', '/api/crew-work/roster', 'GET', undefined, 403); assert.equal((await f.get('manager')).permissions.canEvaluate, false);
});

test('manual review selects only explicit cards, preserves missing and zero information and never changes teams', async t => {
  const f = await fixture(t);
  await f.save('member', { availableHours: 0 }); await f.save('viewer', { skills: ['planning', 'design'], availableHours: null, communication: null, workMode: null }); await f.save('peer', { skills: ['filming'], availableHours: 80 });
  const before = JSON.stringify(f.app.store.all('users'));
  const result = await f.evaluate('manager', ['viewer', 'member', 'viewer'], { requiredSkills: ['planning', 'planning', 'filming'] });
  assert.deepEqual(result.selected.map(member => member.id), [f.users.viewer.id, f.users.member.id]); assert.equal(result.coverage.length, 2); assert.equal(result.coverage[0].memberIds.length, 2); assert.deepEqual(result.missingSkills, ['filming']);
  assert.deepEqual(result.availability.map(row => row.status), ['unknown', 'zero']); assert.equal(result.availability[0].shortfall, null); assert.equal(result.collaboration.communication.unknown, 1); assert.equal(result.metadata.automaticAssignment, false); assert.equal(result.metadata.automaticSelection, false); assert.equal(result.engine.version, 'atlas-work-1');
  assert.equal(JSON.stringify(f.app.store.all('users')), before); assert.equal(f.app.store.all('audit').length, 0); assert.equal(f.app.store.all('crewWorkEvaluations').length, 0);
  await f.evaluate('manager', [], {}, 400); await f.evaluate('manager', ['peer'], {}, 404); await f.evaluate('member', ['member'], {}, 403);
  const zero = await f.evaluate('manager', ['member'], { minAvailableHours: 0 }); assert.equal(zero.availability[0].status, 'zero'); assert.equal(zero.complete, false);
});

test('withdrawal, deletion, deactivation and team changes revoke card review immediately', async t => {
  const f = await fixture(t); await f.save('member');
  await f.evaluate('manager', ['member']);
  const old = f.app.store.get('crewWorkProfiles', f.users.member.id); f.app.store.put('crewWorkProfiles', f.users.member.id, { ...old, confirmedAt: '2026-01-01T00:00:00.000Z' });
  const withdrawn = await f.save('member', { participates: false }); assert.equal(withdrawn.profile.confirmedAt, '2026-01-01T00:00:00.000Z', 'sharing changes must not pretend the work information was reconfirmed');
  await f.evaluate('admin', ['member'], {}, 404); assert.equal((await f.get('member')).profile.skills[0], 'planning');
  const saved = await f.save('member'); await f.json('member', '/api/crew-profile/delete', 'POST', { expectedRevision: saved.revision }); await f.evaluate('admin', ['member'], {}, 404);
  await f.save('member'); f.app.store.put('users', f.users.member.id, { ...f.users.member, teamId: 'team-b' }); await f.evaluate('manager', ['member'], {}, 404); await f.evaluate('admin', ['member']);
  f.app.store.put('users', f.users.member.id, { ...f.users.member, active: false }); await f.evaluate('admin', ['member'], {}, 404);
});

test('profile revisions prevent old tabs from restoring withdrawn or deleted sharing, and persist across restart', async t => {
  const f = await fixture(t), empty = await f.get('member'), saved = await f.save('member');
  const withdrawn = await f.save('member', { participates: false });
  await f.json('member', '/api/crew-profile', 'POST', profile({ expectedRevision: saved.revision }), 409);
  assert.equal((await f.get('member')).profile.participates, false);
  const deleted = await f.json('member', '/api/crew-profile/delete', 'POST', { expectedRevision: withdrawn.revision });
  assert.notEqual(deleted.revision, withdrawn.revision); assert.equal(deleted.profile, null);
  for (const expectedRevision of [empty.revision, saved.revision, withdrawn.revision]) await f.json('member', '/api/crew-profile', 'POST', profile({ expectedRevision }), 409);
  assert.equal(f.app.store.get('crewWorkProfiles', f.users.member.id), null); assert.deepEqual(Object.keys(f.app.store.get('crewWorkRevisions', f.users.member.id)), ['revision']);
  await f.restart(); assert.equal((await f.get('member')).revision, deleted.revision); assert.equal((await f.get('member')).profile, null);
  const fresh = await f.save('member'); assert.ok(fresh.profile); assert.notEqual(fresh.revision, deleted.revision);
});

test('a revoked session or changed role while the POST body is arriving cannot save or review cards', async t => {
  const f = await fixture(t); await f.save('member');
  async function delayed(key, path, body, mutate) {
    const bytes = Buffer.from(JSON.stringify(body)); let request;
    const entered = new Promise(resolve => f.app.server.once('request', resolve));
    const response = new Promise((resolve, reject) => { request = httpRequest(f.base() + path, { method: 'POST', headers: { ...f.headers(key), 'Content-Length': bytes.length } }, result => { let text = ''; result.on('data', chunk => text += chunk); result.on('end', () => resolve({ status: result.statusCode, body: JSON.parse(text) })); }); request.on('error', reject); request.write(bytes.subarray(0, 4)); });
    const incoming = await entered;
    // Central identity validation may await before the body reader starts.
    // Revoke only after that reader is waiting for the unfinished JSON body.
    const deadline = Date.now() + 3000;
    while (!incoming.listenerCount('readable') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(incoming.listenerCount('readable'), 'request body reader started');
    mutate(); request.end(bytes.subarray(4)); return response;
  }
  const changed = await delayed('manager', '/api/crew-work/evaluate', { requiredSkills: ['planning'], memberIds: [f.users.member.id], minAvailableHours: 2 }, () => f.app.store.put('users', f.users.manager.id, { ...f.users.manager, role: 'member' }));
  assert.equal(changed.status, 403); assert.equal(changed.body.selected, undefined);
  const state = await f.get('member'), before = JSON.stringify(f.app.store.get('crewWorkProfiles', f.users.member.id));
  const revoked = await delayed('member', '/api/crew-profile', profile({ expectedRevision: state.revision, skills: ['research'] }), () => f.app.store.revokeUser(f.users.member.id));
  assert.equal(revoked.status, 401); assert.equal(JSON.stringify(f.app.store.get('crewWorkProfiles', f.users.member.id)), before);
});
