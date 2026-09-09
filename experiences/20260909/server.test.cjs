'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const { createExperienceServer } = require('./server.cjs');

async function fixture(t) {
  const app = createExperienceServer();
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (route, body, token, headers = {}) => {
    const r = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const create = async () => (await post('/api/rooms', { name: '정비사', role: 'signal' })).body;
  const join = async (code, role, name = role) => (await post(`/api/rooms/${code}/join`, { name, role })).body;
  const action = (p, type, payload = {}) => post(`/api/rooms/${p.code}/actions`, { type, payload }, p.token);
  const snapshot = async p => {
    const r = await fetch(`${base}/api/rooms/${p.code}`, { headers: { Authorization: `Bearer ${p.token}` } });
    return { status: r.status, body: await r.json() };
  };
  return { ...app, base, post, create, join, action, snapshot };
}

async function restorePower(f, person) {
  let result;
  for (const [index, rotation] of [[0, 3], [1, 1], [2, 2]]) {
    result = await f.action(person, 'restore', { kind: 'power', index, rotation });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  return result.body.state;
}

async function restoreBoth(f, powerPerson, radioPerson) {
  await f.action(powerPerson, 'inspect', { objectId: 'tram' });
  await restorePower(f, powerPerson);
  await f.action(radioPerson, 'inspect', { objectId: 'radio' });
  const result = await f.action(radioPerson, 'restore', { kind: 'radio', frequency: 96.4 });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.state.phase, 'vote');
  return result.body.state;
}

test('two players complete a story; private evidence stays private until explicitly shared', async t => {
  const f = await fixture(t), host = await f.create();
  assert.match(host.code, /^[A-Z2-9]{6}$/);
  assert.equal((await f.action(host, 'start')).status, 409);
  const other = await f.join(host.code, 'archive');
  assert.equal((await f.action(other, 'start')).status, 403);
  assert.equal((await f.action(host, 'start')).body.state.phase, 'explore');
  assert.equal((await f.action(host, 'vote', { choiceId: 'lighthouse' })).status, 409);
  const seen = (await f.action(host, 'inspect', { objectId: 'tram' })).body.state;
  assert.equal(seen.privateClues.length, 2);
  assert.equal(seen.sharedClues.length, 0);
  assert.equal(JSON.stringify(seen.players).includes('token'), false);
  const otherSeen = (await f.action(other, 'inspect', { objectId: 'radio' })).body.state;
  assert.equal(otherSeen.privateClues.some(c => c.id.startsWith('signal')), false);
  assert.equal((await f.action(other, 'share', { clueId: 'signal-battery' })).status, 403);
  for (const clue of seen.privateClues) await f.action(host, 'share', { clueId: clue.id });
  let s;
  for (const clue of otherSeen.privateClues) s = (await f.action(other, 'share', { clueId: clue.id })).body.state;
  assert.equal(s.phase, 'explore'); assert.equal(s.sharedClues.length, 4);
  assert.equal((await f.action(host, 'vote', { choiceId: 'lighthouse' })).status, 409);
  assert.equal((await restorePower(f, host)).phase, 'explore');
  s = (await f.action(other, 'restore', { kind: 'radio', frequency: 96.4 })).body.state;
  assert.equal(s.phase, 'vote');
  await f.action(host, 'vote', { choiceId: 'lighthouse' });
  assert.equal((await f.action(host, 'finalize')).status, 409);
  await f.action(other, 'vote', { choiceId: 'homes' });
  assert.equal((await f.action(host, 'finalize')).status, 409);
  await f.action(other, 'vote', { choiceId: 'lighthouse' });
  assert.equal((await f.action(other, 'finalize')).status, 403);
  const end = (await f.action(host, 'finalize')).body.state;
  assert.equal(end.phase, 'ended'); assert.equal(end.ending.choiceId, 'lighthouse');
  assert.equal((await f.action(host, 'reset')).body.state.phase, 'lobby');
  const reset = (await f.action(host, 'start')).body.state;
  assert.deepEqual(reset.privateClues, []); assert.deepEqual(reset.sharedClues, []); assert.deepEqual(reset.votes, {});
  assert.equal(reset.restoration.power.solved, false); assert.equal(reset.restoration.radio.solved, false);
  assert.deepEqual(reset.restoration.order, []); assert.deepEqual(reset.restoration.marks, []);
});

test('room separation, unique roles and authentication hold at the HTTP boundary', async t => {
  const f = await fixture(t), a = await f.create(), b = await f.create();
  assert.equal((await f.post(`/api/rooms/${a.code}/actions`, { type: 'start' }, b.token)).status, 401);
  assert.equal((await f.post(`/api/rooms/${a.code}/join`, { name: '또 다른 정비사', role: 'signal' })).status, 409);
  assert.equal((await f.post('/api/rooms', { name: ' ', role: 'archive' })).status, 400);
  assert.equal((await f.post('/api/rooms', { name: '사람', role: '__proto__' })).status, 400);
  assert.equal((await f.post('/api/rooms', { name: '사람', role: 'archive' }, null, { Origin: 'https://elsewhere.invalid' })).status, 403);
  for (const pathname of ['/server.cjs', '/server/story.cjs', '/pulse/%2e%2e/server/story.cjs', '/pulse/%5c..%5cserver.cjs', '/.git/config']) {
    assert.equal((await fetch(f.base + pathname)).status, 404, pathname);
  }
  assert.equal((await fetch(`${f.base}/api/rooms/${a.code}/events?token=bad`)).status, 401);
});

test('recovery snapshot distinguishes a missing room from a revoked role and keeps evidence private', async t => {
  const f = await fixture(t), host = await f.create(), other = await f.join(host.code, 'archive');
  const snapshot = p => fetch(`${f.base}/api/rooms/${p.code}`, { headers: { Authorization: `Bearer ${p.token}` } });
  assert.equal((await snapshot({ ...host, token: 'wrong' })).status, 401);
  await f.action(host, 'start');
  await f.action(host, 'inspect', { objectId: 'tram' });
  const mine = await (await snapshot(host)).json(), theirs = await (await snapshot(other)).json();
  assert.equal(mine.state.privateClues.length, 2);
  assert.deepEqual(theirs.state.privateClues, []);
  assert.equal(JSON.stringify(theirs).includes(host.token), false);
  f.rooms.get(host.code).players.delete(other.playerId);
  assert.equal((await snapshot(other)).status, 401);
  f.rooms.delete(host.code);
  assert.equal((await snapshot(host)).status, 404);
});

test('SSE supplies only the reconnecting player state and continues after another player acts', async t => {
  const f = await fixture(t), host = await f.create(), other = await f.join(host.code, 'archive');
  const abort = new AbortController(); t.after(() => abort.abort());
  const response = await fetch(`${f.base}/api/rooms/${host.code}/events?token=${other.token}`, { signal: abort.signal });
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  const first = decoder.decode((await reader.read()).value);
  assert.ok(first.includes('event: state')); assert.ok(first.includes('"role":"archive"'));
  await f.action(host, 'start');
  const update = decoder.decode((await reader.read()).value);
  assert.ok(update.includes('"phase":"explore"'));
  assert.ok(!update.includes(host.token));
  abort.abort();
});

test('all three endings can be reached by a four-player group and late joins are rejected', async t => {
  const f = await fixture(t), h = await f.create();
  const a = await f.join(h.code, 'archive'), c = await f.join(h.code, 'coast'), p = await f.join(h.code, 'courier');
  for (const target of ['lighthouse', 'station', 'homes']) {
    await f.action(h, 'start');
    assert.equal((await f.post(`/api/rooms/${h.code}/join`, { name: '늦은 손님', role: 'coast' })).status, 409);
    const restored = await restoreBoth(f, h, a);
    assert.equal(restored.sharedClues.length, 0, 'spoken cooperation does not require share-button collection');
    for (const person of [h, a, c]) await f.action(person, 'vote', { choiceId: target });
    assert.equal((await f.action(h, 'finalize')).status, 409);
    await f.action(p, 'vote', { choiceId: target });
    const s = (await f.action(h, 'finalize')).body.state;
    assert.equal(s.ending.choiceId, target); assert.ok(s.ending.body.length > 80);
    await f.action(h, 'reset');
  }
});

test('restoration needs a visited place, validates input, and allows another role to operate equipment', async t => {
  const f = await fixture(t), host = await f.create(), archive = await f.join(host.code, 'archive');
  assert.equal((await f.action(host, 'restore', { kind: 'power', index: 0, rotation: 3 })).status, 409);
  await f.action(host, 'start');
  const beforeVisit = (await f.snapshot(host)).body.state;
  assert.equal((await f.action(host, 'restore', { kind: 'power', index: 0, rotation: 3 })).status, 409);
  assert.equal((await f.action(archive, 'restore', { kind: 'radio', frequency: 96.4 })).status, 409);
  assert.deepEqual((await f.snapshot(host)).body.state.restoration, beforeVisit.restoration);

  await f.action(archive, 'inspect', { objectId: 'tram' });
  await f.action(host, 'inspect', { objectId: 'radio' });
  const beforeInvalid = (await f.snapshot(host)).body.state;
  for (const payload of [
    { kind: 'power', index: -1, rotation: 0 }, { kind: 'power', index: 3, rotation: 0 },
    { kind: 'power', index: 0, rotation: 4 }, { kind: 'power', index: 0, rotation: '3' },
    { kind: 'radio', frequency: 89.9 }, { kind: 'radio', frequency: 104.1 },
    { kind: 'radio', frequency: 96.41 }, { kind: 'radio', frequency: '96.4' },
  ]) {
    const operator = payload.kind === 'power' ? archive : host;
    assert.equal((await f.action(operator, 'restore', payload)).status, 400, JSON.stringify(payload));
  }
  const afterInvalid = (await f.snapshot(host)).body.state;
  assert.equal(afterInvalid.revision, beforeInvalid.revision);
  assert.deepEqual(afterInvalid.restoration, beforeInvalid.restoration);

  const wrongConnection = (await f.action(archive, 'restore', { kind: 'power', index: 0, rotation: 1 })).body.state;
  assert.equal(wrongConnection.restoration.power.solved, false); assert.equal(wrongConnection.phase, 'explore');
  assert.ok(wrongConnection.restoration.power.feedback.length > 10); assert.deepEqual(wrongConnection.restoration.order, []);

  const wrong = (await f.action(host, 'restore', { kind: 'radio', frequency: 96.3 })).body.state;
  assert.equal(wrong.restoration.radio.solved, false); assert.equal(wrong.phase, 'explore');
  assert.equal(wrong.restoration.radio.broadcast, undefined);
  const radioFirst = (await f.action(host, 'restore', { kind: 'radio', frequency: 96.4 })).body.state;
  assert.equal(radioFirst.restoration.radio.solved, true); assert.equal(radioFirst.phase, 'explore');
  assert.match(radioFirst.restoration.radio.broadcast, /승객은 모두 안전/);
  assert.equal((await f.action(host, 'vote', { choiceId: 'homes' })).status, 409);
  const incomplete = (await f.action(archive, 'restore', { kind: 'power', index: 0, rotation: 3 })).body.state;
  assert.equal(incomplete.restoration.power.solved, false); assert.equal(incomplete.phase, 'explore');
  const ready = await restorePower(f, archive);
  assert.equal(ready.phase, 'vote'); assert.equal(ready.sharedClues.length, 0);
  assert.deepEqual(ready.restoration.order.map(event => [event.kind, event.role]), [['radio', 'signal'], ['power', 'archive']]);
  assert.equal((await f.action(host, 'restore', { kind: 'radio', frequency: 96.4 })).status, 409);
  assert.deepEqual((await f.snapshot(host)).body.state.restoration, ready.restoration);
});

test('a three-player group cannot finalize until every participant agrees', async t => {
  const f = await fixture(t), host = await f.create(), archive = await f.join(host.code, 'archive'), coast = await f.join(host.code, 'coast');
  await f.action(host, 'start'); await restoreBoth(f, coast, archive);
  for (const person of [host, archive]) await f.action(person, 'vote', { choiceId: 'station' });
  assert.equal((await f.action(host, 'finalize')).status, 409);
  await f.action(coast, 'vote', { choiceId: 'homes' });
  assert.equal((await f.action(host, 'finalize')).status, 409);
  await f.action(coast, 'vote', { choiceId: 'station' });
  const ended = (await f.action(host, 'finalize')).body.state;
  assert.equal(ended.phase, 'ended'); assert.equal(ended.ending.choiceId, 'station');
  assert.equal(ended.ending.chronicle.length, 2);
  assert.equal(ended.ending.chronicle[0].role, 'coast');
  assert.equal((await f.action(archive, 'vote', { choiceId: 'homes' })).status, 409);
});

test('each participant leaves one visible ending sentence; reset and a new room begin without old marks', async t => {
  const f = await fixture(t), host = await f.create(), archive = await f.join(host.code, 'archive');
  assert.equal((await f.action(host, 'mark', { text: '아직 시작하지 않았다.' })).status, 409);
  await f.action(host, 'start');
  assert.equal((await f.action(archive, 'mark', { text: '아직 복원하지 않았다.' })).status, 409);
  await restoreBoth(f, host, archive);
  assert.equal((await f.action(host, 'mark', { text: '아직 선택하지 않았다.' })).status, 409);
  await f.action(host, 'vote', { choiceId: 'homes' }); await f.action(archive, 'vote', { choiceId: 'homes' });
  await f.action(host, 'finalize');
  for (const text of [' ', '가'.repeat(121), null]) assert.equal((await f.action(host, 'mark', { text })).status, 400);
  assert.deepEqual((await f.snapshot(host)).body.state.restoration.marks, []);
  assert.equal((await f.action(host, 'mark', { text: '  함께 켠 창을 기억하자.  ' })).status, 200);
  await f.action(archive, 'mark', { text: '내일은 남은 이웃에게 가자.' });
  await f.action(host, 'mark', { text: '아침에는 그 창을 다시 찾아가자.' });
  const ours = (await f.snapshot(host)).body.state, theirs = (await f.snapshot(archive)).body.state;
  assert.equal(ours.phase, 'ended'); assert.equal(ours.ending.choiceId, 'homes');
  assert.deepEqual(ours.restoration.marks, [
    { role: 'signal', text: '아침에는 그 창을 다시 찾아가자.' },
    { role: 'archive', text: '내일은 남은 이웃에게 가자.' },
  ]);
  assert.deepEqual(theirs.restoration.marks, ours.restoration.marks);
  const fresh = (await f.create()).state;
  assert.deepEqual(fresh.restoration.marks, []); assert.deepEqual(fresh.restoration.order, []);
  assert.equal(fresh.restoration.power.solved, false); assert.equal(fresh.restoration.radio.solved, false);
  assert.deepEqual((await f.snapshot(host)).body.state.restoration.marks, ours.restoration.marks);
  assert.equal((await f.action(archive, 'reset')).status, 403);
  const reset = (await f.action(host, 'reset')).body.state;
  assert.equal(reset.phase, 'lobby'); assert.equal(reset.ending, null);
  assert.deepEqual(reset.restoration.marks, []); assert.deepEqual(reset.restoration.order, []);
  assert.deepEqual(reset.restoration.power.rotations, [0, 0, 0]); assert.equal(reset.restoration.radio.solved, false);
});

test('Korean names survive network chunks split inside a UTF-8 character', async t => {
  const f = await fixture(t);
  const payload = Buffer.from(JSON.stringify({ name: '가나다', role: 'signal' }));
  const boundary = payload.indexOf(Buffer.from('가')) + 1;
  const result = new Promise((resolve, reject) => {
    const req = http.request(f.base + '/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    req.on('error', reject); req.write(payload.subarray(0, boundary)); setTimeout(() => req.end(payload.subarray(boundary)), 25);
  });
  const response = await result;
  assert.equal(response.status, 201); assert.equal(response.body.state.me.name, '가나다');
});

test('removal revokes a request whose body was still arriving', async t => {
  const f = await fixture(t), host = await f.create(), removed = await f.join(host.code, 'archive');
  const payload = JSON.stringify({ type: 'inspect', payload: { objectId: 'radio' } });
  let request;
  const pending = new Promise((resolve, reject) => {
    request = http.request(`${f.base}/api/rooms/${host.code}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Authorization: `Bearer ${removed.token}` } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    request.on('error', reject); request.write(payload.slice(0, 1));
  });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal((await f.action(host, 'remove', { playerId: removed.playerId })).status, 200);
  await f.join(host.code, 'archive', '새 기록원');
  await f.action(host, 'start');
  request.end(payload.slice(1));
  const result = await pending;
  assert.equal(result.status, 401); assert.equal(JSON.stringify(result.body).includes('방송 원고'), false);
});
