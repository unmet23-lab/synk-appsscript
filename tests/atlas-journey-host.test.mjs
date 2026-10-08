import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createMeetingAdapter } from '../experiences/atlas-lab/meeting.mjs';
import { createJourneyHost } from '../experiences/atlas-lab/journey-host.mjs';

const PREFIX = '/api/atlas-journey';
const seed = () => ({ version: 'discovery-meeting-seed-1', key: 'journey-test-candidate-1', candidateId: 'candidate-1', sourceRevision: 6,
  people: [{ id: 'person-a', label: '나 · 가상 역할', availability: 'weekend' }, { id: 'person-b', label: '가상 성인 1', availability: 'weekend' }] });
async function fixture(t, options = {}) {
  let time = Date.parse('2026-10-07T10:00:00.000Z');
  const adapter = createMeetingAdapter({ Domain, Ask, Personalization });
  const host = createJourneyHost({ adapter, clock: () => time, ...options });
  const server = http.createServer(async (req, res) => { if (!await host.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { host.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  async function call(path, { method = 'GET', json, cookie, csrf, headers = {}, withOrigin = true } = {}) {
    const response = await fetch(origin + path, { method, headers: { ...(withOrigin ? { Origin: origin } : {}),
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, ...(json !== undefined ? { body: JSON.stringify(json) } : {}) });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  async function create(extra = {}) {
    const response = await call(`${PREFIX}/create`, { method: 'POST', json: { requestId: randomUUID(), seed: seed(), ...extra } });
    assert.equal(response.status, 201); return response.data;
  }
  async function join(capability) {
    const response = await call(`${PREFIX}/session`, { method: 'POST', json: { capability } });
    assert.equal(response.status, 200);
    return { ...response.data, cookie: response.headers.get('set-cookie').split(';')[0], cookieHeader: response.headers.get('set-cookie') };
  }
  async function read(role) { return call(`${role.sessionPath}/state`, { cookie: role.cookie }); }
  async function action(role, action, extras = {}) {
    const current = await read(role); assert.equal(current.status, 200);
    return call(`${role.sessionPath}/action`, { method: 'POST', cookie: role.cookie, csrf: role.csrfToken,
      json: { requestId: randomUUID(), expectedRevision: current.data.revision, action, ...extras } });
  }
  async function act(role, value) { const response = await action(role, value); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data; }
  async function pair() { const created = await create(); return { created, a: await join(created.participants[0].capability), b: await join(created.participants[1].capability) }; }
  return { host, origin, call, create, join, read, action, act, pair, advance: ms => { time += ms; } };
}
async function delayedPost(f, path, value, beforeFinish, headers = {}) {
  const json = JSON.stringify(value);
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(f.origin + path), { method: 'POST', headers: {
      Origin: f.origin, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json), ...headers
    } }, result => {
      const chunks = []; result.on('data', chunk => chunks.push(chunk));
      result.on('end', () => resolve({ status: result.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    request.on('error', reject); request.write(json.slice(0, -1));
    setTimeout(async () => {
      try { await beforeFinish(); request.end(json.slice(-1)); } catch (error) { request.destroy(); reject(error); }
    }, 20);
  });
}
const setting = (field, value, extra = {}) => ({ kind: 'set', field, value, duration: 'ongoing', share: true, required: false, ...extra });
async function prepare(f, a, b, complete = false) {
  for (const role of [a, b]) for (const [field, value] of Object.entries({ consent: true, atmosphere: 'quiet', duration: '90', activity: 'cafe' })) await f.act(role, setting(field, value));
  await f.act(a, { kind: 'propose' });
  for (const role of [a, b]) { await f.act(role, { kind: 'view' }); await f.act(role, { kind: 'respond', value: 'accept' }); }
  if (complete) await f.act(a, { kind: 'met' });
}

test('local status makes its fictional, memory-only and non-identity scope explicit', async t => {
  const f = await fixture(t), response = await f.call(`${PREFIX}/status`);
  assert.equal(response.status, 200); assert.equal(response.data.localOnly, true); assert.equal(response.data.synthetic, true);
  assert.equal(response.data.persistence, 'memory-only'); assert.equal(response.data.authenticatedIdentity, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const request = http.request(new URL(f.origin + `${PREFIX}/status`), { headers: { Host: 'example.com', Origin: f.origin } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await f.call(`${PREFIX}/status`, { headers: { Origin: 'http://evil.test' } })).status, 403);
  assert.equal((await f.call(`${PREFIX}/status`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});

test('one-time capabilities establish independent HttpOnly path-scoped roles, including two tabs sharing a browser', async t => {
  const f = await fixture(t), { created, a, b } = await f.pair();
  assert.notEqual(a.sessionId, b.sessionId); assert.notEqual(a.sessionPath, b.sessionPath); assert.notEqual(a.cookie, b.cookie);
  assert.match(a.cookieHeader, /HttpOnly/); assert.match(a.cookieHeader, /SameSite=Strict/); assert.ok(a.cookieHeader.includes(`Path=${a.sessionPath};`));
  assert.ok(b.cookieHeader.includes(`Path=${b.sessionPath};`));
  assert.equal(a.actor, 'person-a'); assert.equal(b.actor, 'person-b');
  assert.equal(a.view.partner.label, '가상 성인 1'); assert.equal(b.view.partner.label, '나 · 가상 역할');
  assert.equal(a.view.me.fields.find(field => field.id === 'consent').state, 'unknown');
  assert.equal((await f.call(`${PREFIX}/session`, { method: 'POST', json: { capability: created.participants[0].capability } })).status, 401);
  assert.equal((await f.call(`${a.sessionPath}/state`, { cookie: b.cookie })).status, 401);
  assert.equal((await f.call(`${a.sessionPath}/state`)).status, 401);
  assert.equal((await f.read(a)).data.actor, 'person-a'); assert.equal((await f.read(b)).data.actor, 'person-b');
});

test('bootstrap requires the local origin; malformed or extra seed identity data is refused', async t => {
  const f = await fixture(t), request = { requestId: randomUUID(), seed: seed() };
  assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: request, withOrigin: false })).status, 403);
  assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: request, headers: { Origin: 'http://evil.test' } })).status, 403);
  assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: { ...request, seed: { ...seed(), realIdentity: 'forbidden' } } })).status, 400);
  assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: { ...request, person: 'person-b' } })).status, 400);
});

test('the server owns actor/time and rejects missing CSRF, foreign sessions and forged nested actors', async t => {
  const f = await fixture(t), { a } = await f.pair();
  const request = { requestId: randomUUID(), expectedRevision: 0, action: setting('consent', true) };
  assert.equal((await f.call(`${a.sessionPath}/action`, { method: 'POST', cookie: a.cookie, json: request })).status, 403);
  assert.equal((await f.call(`${a.sessionPath}/action`, { method: 'POST', cookie: a.cookie, csrf: 'wrong', json: request })).status, 403);
  assert.equal((await f.action(a, { ...setting('consent', true), person: 'person-b' })).status, 400);
  assert.equal((await f.action(a, { ...setting('consent', true), at: '2099-01-01T00:00:00.000Z' })).status, 400);
  assert.equal((await f.action(a, { kind: 'reconnect', action: { kind: 'pause', person: 'person-b' } })).status, 400);
  assert.equal((await f.read(a)).data.revision, 0);
});

test('concurrent edits are serialized and an old expected revision cannot overwrite a newer decision', async t => {
  const f = await fixture(t), { a, b } = await f.pair();
  const make = role => f.call(`${role.sessionPath}/action`, { method: 'POST', cookie: role.cookie, csrf: role.csrfToken,
    json: { requestId: randomUUID(), expectedRevision: 0, action: setting('consent', true) } });
  const responses = await Promise.all([make(a), make(b)]);
  assert.deepEqual(responses.map(x => x.status).sort(), [200, 409]);
  assert.equal(responses.find(x => x.status === 409).data.error, 'revision-conflict');
  assert.equal((await f.read(a)).data.revision, 1);
  const loser = responses[0].status === 409 ? a : b;
  await f.act(loser, setting('consent', true)); assert.equal((await f.read(a)).data.revision, 2);
});

test('exact idempotent retries produce one event and conflicting UUID reuse is rejected', async t => {
  const f = await fixture(t), { a } = await f.pair();
  const request = { requestId: randomUUID(), expectedRevision: 0, action: setting('consent', true) };
  const call = json => f.call(`${a.sessionPath}/action`, { method: 'POST', cookie: a.cookie, csrf: a.csrfToken, json });
  const results = await Promise.all([call(request), call(request)]);
  assert.deepEqual(results.map(x => x.status), [200, 200]); assert.equal(results.filter(x => x.data.replayed).length, 1);
  assert.equal(results[0].data.appliedRevision, 1); assert.equal((await f.read(a)).data.revision, 1);
  const conflict = await call({ ...request, action: setting('consent', false) });
  assert.equal(conflict.status, 409); assert.equal(conflict.data.error, 'idempotency-conflict');
});

test('private feedback and reconnect intent stay with their actor, and remote read receipts are not disclosed', async t => {
  const f = await fixture(t), { a, b } = await f.pair(); await prepare(f, a, b, true);
  const own = await f.act(a, { kind: 'feedback', value: 'too-long' });
  assert.equal(own.view.me.feedback.length, 1);
  await f.act(a, { kind: 'reconnect', action: { kind: 'intent', encounterId: own.view.encounter.id, value: 'yes' } });
  const mine = (await f.read(a)).data, other = (await f.read(b)).data;
  assert.equal(mine.view.reconnect.me.intent.value, 'yes'); assert.equal(other.view.reconnect.me.intent, null);
  assert.deepEqual(other.view.me.feedback, []); assert.deepEqual(other.view.me.pendingProposals, []);
  assert.ok(!JSON.stringify(other).includes('too-long')); assert.ok(!JSON.stringify(other).includes('feedback-confirmed'));
  assert.equal(Object.hasOwn(other.view.proposal.people.find(person => person.id === 'person-a'), 'seen'), false);
  for (const key of ['events', 'state', 'preferences']) assert.equal(Object.hasOwn(mine, key) || Object.hasOwn(mine.view, key), false);
  assert.equal(other.view.proposal.people.find(person => person.id === 'person-b').seen, true);
});

test('a private yes does not send an invitation; only an explicit send reaches the other role', async t => {
  const f = await fixture(t), { a, b } = await f.pair(); await prepare(f, a, b, true);
  await f.act(a, { kind: 'reconnect', action: { kind: 'intent', encounterId: 'meeting-1', value: 'yes' } });
  assert.equal((await f.read(b)).data.view.reconnect.invitation, null);
  await f.act(a, { kind: 'reconnect', action: { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음에도 카페에서 이야기할까요?' } });
  const before = (await f.read(b)).data.view, invitation = before.reconnect.invitation;
  assert.equal(invitation.message, '다음에도 카페에서 이야기할까요?'); assert.equal(before.reconnect.me.intent, null);
  const replied = await f.act(b, { kind: 'reconnect', action: { kind: 'respond', invitationId: invitation.id, value: 'accept' } });
  assert.equal(replied.view.reconnect.invitation.status, 'accepted'); assert.equal(replied.view.encounter.id, 'meeting-1');
  assert.deepEqual(replied.view.proposal.people.map(person => person.response), before.proposal.people.map(person => person.response));
});

test('blocking immediately removes partner access, refuses stale mutations and prevents cached-response disclosure', async t => {
  const f = await fixture(t), { a, b } = await f.pair();
  const request = { requestId: randomUUID(), expectedRevision: 0, action: setting('consent', true) };
  const original = await f.call(`${b.sessionPath}/action`, { method: 'POST', cookie: b.cookie, csrf: b.csrfToken, json: request }); assert.equal(original.status, 200);
  await f.act(a, { kind: 'reconnect', action: { kind: 'block' } });
  const blocked = (await f.read(b)).data;
  assert.equal(blocked.view.access.allowed, false); assert.equal(blocked.view.reconnect.me.blocking, false);
  assert.equal(Object.hasOwn(blocked.view, 'partner'), false); assert.equal(Object.hasOwn(blocked.view, 'people'), false);
  const retry = await f.call(`${b.sessionPath}/action`, { method: 'POST', cookie: b.cookie, csrf: b.csrfToken, json: request });
  assert.equal(retry.status, 200); assert.equal(retry.data.replayed, true); assert.equal(retry.data.view.access.allowed, false);
  assert.ok(!JSON.stringify(retry.data).includes('가상 성인 1'));
  assert.equal((await f.action(b, setting('atmosphere', 'quiet'))).status, 403);
  await f.act(a, { kind: 'reconnect', action: { kind: 'unblock' } }); assert.equal((await f.read(b)).data.view.access.allowed, true);
});

test('pause leaves an agreed plan intact while preventing a new invitation until the owner resumes', async t => {
  const f = await fixture(t), { a, b } = await f.pair(); await prepare(f, a, b, true);
  const original = (await f.read(a)).data.view.proposal;
  await f.act(a, { kind: 'reconnect', action: { kind: 'pause' } });
  assert.deepEqual((await f.read(a)).data.view.proposal, original);
  assert.equal((await f.action(a, { kind: 'reconnect', action: { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다시 만날까요?' } })).status, 400);
  await f.act(a, { kind: 'reconnect', action: { kind: 'resume' } });
  await f.act(a, { kind: 'reconnect', action: { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다시 만날까요?' } });
});

test('invitation expiry follows the host clock and an old acceptance cannot revive it', async t => {
  const f = await fixture(t, { pairTtlMs: 7 * 86400000, sessionTtlMs: 7 * 86400000 }), { a, b } = await f.pair();
  await prepare(f, a, b, true);
  const sent = await f.act(a, { kind: 'reconnect', action: { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다시 만날까요?' } });
  const id = sent.view.reconnect.invitation.id;
  f.advance(72 * 3600000 + 1000);
  assert.equal((await f.read(b)).data.view.reconnect.invitation.status, 'expired');
  assert.equal((await f.action(b, { kind: 'reconnect', action: { kind: 'respond', invitationId: id, value: 'accept' } })).status, 400);
});

test('deletion/revocation remove the pair and all role access, including idempotent replays and unclaimed capabilities', async t => {
  for (const command of ['delete', 'revoke']) {
    const f = await fixture(t), requestId = randomUUID(), created = await f.create({ requestId }), a = await f.join(created.participants[0].capability);
    const request = { requestId: randomUUID(), expectedRevision: 0, action: command };
    const response = await f.call(`${a.sessionPath}/control`, { method: 'POST', cookie: a.cookie, csrf: a.csrfToken, json: request });
    assert.equal(response.status, 200); assert.equal(response.data.closed, true); assert.equal(response.data.deleted, command === 'delete');
    assert.equal((await f.read(a)).status, 410);
    assert.equal((await f.call(`${a.sessionPath}/control`, { method: 'POST', cookie: a.cookie, csrf: a.csrfToken, json: request })).status, 410);
    assert.equal((await f.call(`${PREFIX}/session`, { method: 'POST', json: { capability: created.participants[1].capability } })).status, 401);
    assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: { requestId, seed: seed() } })).status, 410);
  }
});

test('expiry is not extended by reads, sessions never outlive their journey, and a fresh host does not restore old memory', async t => {
  const f = await fixture(t, { pairTtlMs: 3000, sessionTtlMs: 2000 }), { created, a } = await f.pair();
  const expires = a.expiresAt; f.advance(1500); assert.equal((await f.read(a)).data.expiresAt, expires);
  f.advance(500); assert.equal((await f.read(a)).status, 401);
  f.advance(1000); assert.equal((await f.call(`${PREFIX}/session`, { method: 'POST', json: { capability: created.participants[1].capability } })).status, 401);
  const fresh = await fixture(t);
  assert.equal((await fresh.call(`${a.sessionPath}/state`, { cookie: a.cookie })).status, 401);
  assert.equal((await fresh.call(`${PREFIX}/session`, { method: 'POST', json: { capability: created.participants[0].capability } })).status, 401);
});

test('creation idempotency does not create duplicate roles, and finite memory capacity is enforced', async t => {
  const f = await fixture(t, { maxPairs: 1 }), requestId = randomUUID(), created = await f.create({ requestId });
  const retry = await f.call(`${PREFIX}/create`, { method: 'POST', json: { requestId, seed: seed() } });
  assert.equal(retry.status, 200); assert.deepEqual(retry.data, created);
  const other = seed(); other.sourceRevision++;
  assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: { requestId, seed: other } })).status, 409);
  assert.equal((await f.call(`${PREFIX}/create`, { method: 'POST', json: { requestId: randomUUID(), seed: seed() } })).status, 429);
});

test('a deletion and an edit sharing a revision cannot revive or overwrite each other', async t => {
  const f = await fixture(t), { a, b } = await f.pair();
  const results = await Promise.all([
    f.call(`${a.sessionPath}/control`, { method: 'POST', cookie: a.cookie, csrf: a.csrfToken,
      json: { requestId: randomUUID(), expectedRevision: 0, action: 'delete' } }),
    f.call(`${b.sessionPath}/action`, { method: 'POST', cookie: b.cookie, csrf: b.csrfToken,
      json: { requestId: randomUUID(), expectedRevision: 0, action: setting('consent', true) } })
  ]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  if (results[0].status === 200) {
    assert.equal(results[1].status, 410);
    assert.equal((await f.read(b)).status, 410);
  } else {
    assert.equal(results[0].status, 409);
    assert.equal((await f.read(b)).data.revision, 1);
  }
});

test('closing the memory host during a body upload cannot create new sessions afterwards', async t => {
  const f = await fixture(t), json = JSON.stringify({ requestId: randomUUID(), seed: seed() });
  const response = new Promise((resolve, reject) => {
    const request = http.request(new URL(f.origin + `${PREFIX}/create`), { method: 'POST',
      headers: { Origin: f.origin, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) } }, result => {
      result.resume(); result.on('end', () => resolve(result.statusCode));
    });
    request.on('error', reject); request.write(json.slice(0, -1));
    setTimeout(() => { f.host.close(); request.end(json.slice(-1)); }, 20);
  });
  assert.equal(await response, 503);
  assert.equal((await f.call(`${PREFIX}/status`)).status, 503);
});

test('a create retry whose journey expires during upload cannot return expired role capabilities', async t => {
  const f = await fixture(t, { pairTtlMs: 1000, sessionTtlMs: 1000 }), requestId = randomUUID();
  await f.create({ requestId });
  const result = await delayedPost(f, `${PREFIX}/create`, { requestId, seed: seed() }, () => f.advance(1000));
  assert.equal(result.status, 410); assert.equal(result.data.error, 'journey-unavailable');
  assert.equal(Object.hasOwn(result.data, 'participants'), false);
});

test('an expired journey does not consume capacity when a new create finishes its upload', async t => {
  const f = await fixture(t, { pairTtlMs: 1000, sessionTtlMs: 1000, maxPairs: 1 }); await f.create();
  const result = await delayedPost(f, `${PREFIX}/create`, { requestId: randomUUID(), seed: seed() }, () => f.advance(1000));
  assert.equal(result.status, 201); assert.equal(result.data.participants.length, 2);
});

test('a valid session at upload start cannot mutate after session expiry or pair deletion', async t => {
  const expiring = await fixture(t, { pairTtlMs: 5000, sessionTtlMs: 1000 }), created = await expiring.create();
  const a = await expiring.join(created.participants[0].capability);
  const request = { requestId: randomUUID(), expectedRevision: 0, action: setting('consent', true) };
  const late = await delayedPost(expiring, `${a.sessionPath}/action`, request, () => expiring.advance(1000), {
    Cookie: a.cookie, 'X-CSRF-Token': a.csrfToken
  });
  assert.equal(late.status, 401); assert.equal(Object.hasOwn(late.data, 'view'), false);
  const b = await expiring.join(created.participants[1].capability);
  assert.equal(b.revision, 0, 'an expired actor did not record its attempted consent');

  const deleted = await fixture(t), pair = await deleted.pair();
  const duringDeletion = await delayedPost(deleted, `${pair.a.sessionPath}/action`, request, async () => {
    const result = await deleted.call(`${pair.b.sessionPath}/control`, { method: 'POST', cookie: pair.b.cookie, csrf: pair.b.csrfToken,
      json: { requestId: randomUUID(), expectedRevision: 0, action: 'delete' } });
    assert.equal(result.status, 200);
  }, { Cookie: pair.a.cookie, 'X-CSRF-Token': pair.a.csrfToken });
  assert.equal(duringDeletion.status, 410); assert.equal(Object.hasOwn(duringDeletion.data, 'view'), false);
  assert.equal((await deleted.read(pair.a)).status, 410);
});

test('request receipts and CSRF tokens cannot cross participant or journey boundaries', async t => {
  const f = await fixture(t), { a, b } = await f.pair(), other = await f.pair(), requestId = randomUUID();
  const post = (role, revision, csrf = role.csrfToken) => f.call(`${role.sessionPath}/action`, {
    method: 'POST', cookie: role.cookie, csrf, json: { requestId, expectedRevision: revision, action: setting('consent', true) }
  });
  assert.equal((await post(b, 0, a.csrfToken)).status, 403);
  const mine = await post(a, 0); assert.equal(mine.status, 200); assert.equal(mine.data.actor, 'person-a');
  const partner = await post(b, 1); assert.equal(partner.status, 200); assert.equal(partner.data.actor, 'person-b');
  assert.equal(partner.data.replayed, false, 'the same UUID from a different actor is its own action');
  const separate = await post(other.a, 0); assert.equal(separate.status, 200); assert.equal(separate.data.replayed, false);
  assert.notEqual(separate.data.pairId, mine.data.pairId); assert.equal(separate.data.revision, 1);
  assert.equal((await f.call(`${a.sessionPath}/state`, { cookie: `${a.cookie}; ${b.cookie}` })).status, 401);
  assert.equal((await f.read(a)).data.revision, 2);
});
