// 계정 길 ①의 올리기 · 받기 장면(단계 4 계획 §18-5-2 · §18-5-5 — src/coach/sync.mjs). 나르개는 패키지 시험 서버(trail-sync — talk와
// 같은 partitionLinks · summaryOf)에 talk의 오류 꼴({ status, code, ids? })을 끼워 넣는 겉이다.
//   번호 없는 400 → 반씩 나눠 가려 이 세션 동안 건너뜀(그 제시의 답도) → 다음 세션에 함께(R12 — s9) · 413 → 반으로 · 409 + ids →
//   그 번호만 버림 · 가려낸 것이 여덟을 넘으면 쉼(R13) · 409 REVISION_CONFLICT → 올리기 · 받기 멈춤(덧붙이기는 계속) · POST의 403 →
//   올리기만 멈춤(스위치 꺼짐 아님) · GET의 403 FEATURE_DISABLED → 스위치 꺼짐 · GET 400 → since 없이 한 번 · 첫 받기 결과(synced) ·
//   닫힌 뒤 돌아온 답은 받지 않음. 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS, STEP } from './support.mjs';

const { acquireHost, releaseHost } = await subject('coach/host.mjs');
const { cutBatch, eventBytes, failureOf } = await subject('coach/sync.mjs');
const { storeName } = await subject('record/port.mjs');
const { createHealth } = await subject('health/index.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:sync-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const eventsOf = async port => (await port.read()).map(row => row.value.event).filter(Boolean);
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const fault = (status, code, extra = {}) =>
  Object.assign(new Error(code), { status, code, retryable: status >= 500, ...extra });

// talk 겉 — refuse(method, events|since)가 오류를 돌려주면 그 오류를 던진다.
function routeOf(server) {
  const route = {
    calls: [],
    refuse: null,
    async post(events, since) {
      route.calls.push({ method: 'post', size: events.length, since });
      const error = route.refuse?.('post', events);
      if (error) throw error;
      return server.post(events, since);
    },
    async get(since) {
      route.calls.push({ method: 'get', since });
      const error = route.refuse?.('get', since);
      if (error) throw error;
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
  return route;
}

function world(seed, size = 10) {
  const items = bankOf(rng(seed), { items: size });
  const map = fakeMap(items);
  const server = createServer({ random: rng(seed + 1), index: indexOfMap(map) });
  return { items, map, server, route: routeOf(server), time: clock(), port: memoryPort() };
}

async function open(w, key, extra = {}) {
  const coach = createCoach({
    gameId: 'sync',
    map: w.map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-sync',
      revision: 1,
      key,
      port: w.port,
      transport: w.route,
      now: w.time.now,
      ...extra,
    },
  });
  await coach.ready;
  const handle = await acquireHost({ key, params: PARAMS, now: w.time.now, guest: false });
  return { coach, handle };
}

async function answerAll(coach, items, time) {
  const shown = [];
  for (const item of items) {
    const pid = coach.present(item);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    shown.push(pid);
    time.advance(STEP);
  }
  return shown;
}

const close = ({ coach, handle }) => {
  releaseHost(handle);
  coach.dispose();
};
const onServer = server => new Set(server.server.log().map(record => record.event.id));

test('갈래 표 — 상태 번호 · 코드 · 방법(POST · GET)으로 가른다(§18-5-2)', () => {
  const cases = [
    [fault(0, 'NETWORK'), 'post', 'offline'],
    [{ code: 'NETWORK', retryable: true }, 'get', 'offline'],
    [new Error('끊김'), 'post', 'offline'],
    [{ code: 'AUTH_REQUIRED', retryable: false }, 'post', 'auth'],
    [{ code: 'CONFIG', retryable: false }, 'get', 'other'],
    [fault(503, 'SERVICE_UNAVAILABLE'), 'post', 'offline'],
    [fault(429, 'SERVICE_UNAVAILABLE'), 'get', 'offline'],
    [fault(401, 'AUTH_REQUIRED'), 'post', 'auth'],
    [fault(413, 'PAYLOAD_TOO_LARGE'), 'post', 'too-large'],
    [fault(409, 'EVENT_REVISION', { ids: ['x'] }), 'post', 'ids'],
    [fault(409, 'EVENT_CONFLICT', { ids: ['x'] }), 'post', 'ids'],
    [fault(409, 'EVENT_CONFLICT'), 'post', 'sift'],
    [fault(400, 'INVALID_EVENTS'), 'post', 'sift'],
    [fault(409, 'REVISION_CONFLICT', { revision: 2 }), 'post', 'account'],
    [fault(403, 'LEARNING_DISABLED'), 'get', 'account'],
    [fault(403, 'WRITES_DISABLED'), 'post', 'writes'],
    [fault(403, 'FEATURE_DISABLED'), 'post', 'writes'],
    [fault(403, 'FEATURE_DISABLED'), 'get', 'switch'],
    [fault(400, 'INVALID_SINCE'), 'get', 'bad-since'],
    [fault(426, 'CONTRACT_UNSUPPORTED'), 'post', 'other'],
    [fault(403, 'PRODUCT_FORBIDDEN'), 'get', 'other'],
  ];
  for (const [error, method, kind] of cases)
    assert.equal(failureOf(error, method), kind, `${error.status ?? '-'} ${error.code} ${method}`);
});

test('묶음은 건수와 바이트 둘로 자른다 — 첫 사건은 늘 넣는다', () => {
  const event = i => ({ id: `e${i}`, pad: 'ㄱ'.repeat(1000) });
  const events = Array.from({ length: 10 }, (_, i) => event(i));
  const size = eventBytes(events[0]);
  assert.equal(cutBatch(events, { limit: 256, bytes: size * 3 + 1 }).length, 3, '바이트로');
  assert.equal(cutBatch(events, { limit: 4, bytes: 1e9 }).length, 4, '건수로');
  assert.equal(
    cutBatch(events, { limit: 256, bytes: 10 }).length,
    1,
    '너무 커도 첫 사건은 낸다(413이 가려낸다)',
  );
});

test('번호 없는 400 — 걸린 제시를 가려 이 세션 동안 건너뛴다. 그 답도 함께, 나머지는 올라가고, 다음 세션(talk가 받음)에 둘이 함께 간다(R12 — s9)', async () => {
  const w = world(71);
  const key = keyOf('sift');
  const first = await open(w, key);
  const shown = await answerAll(first.coach, w.items.slice(0, 5), w.time);
  const bad = shown[2];
  w.route.refuse = (method, events) =>
    method === 'post' && events.some(event => event.id === bad)
      ? fault(400, 'INVALID_EVENTS')
      : null;
  await first.handle.upload();
  const children = (await eventsOf(w.port)).filter(e => e.presentationId === bad).map(e => e.id);
  assert.ok(children.length >= 1);
  const stored = onServer(w.server);
  assert.equal(stored.has(bad), false);
  for (const id of children)
    assert.equal(
      stored.has(id),
      false,
      '건너뛴 제시의 답은 보내지 않는다(EVENT_LINK로 버려지지 않게)',
    );
  for (const pid of shown.filter(id => id !== bad)) assert.ok(stored.has(pid), '나머지는 올라갔다');
  assert.equal(first.handle.syncStatus().skipped, 1);
  assert.deepEqual(
    new Set(first.handle.trail.unsent(256).map(e => e.id)),
    new Set([bad, ...children]),
    '버리지 않는다 — 대기열에 남는다',
  );
  close(first);
  w.route.refuse = null; // talk가 따라왔다
  const second = await open(w, key);
  await second.handle.upload();
  const after = onServer(w.server);
  assert.ok(
    after.has(bad) && children.every(id => after.has(id)),
    '다음 세션에 제시와 답이 함께 갔다',
  );
  assert.equal(second.handle.trail.unsent(256).length, 0);
  close(second);
});

test('413 — 묶음을 반으로 나눠 다 올린다', async () => {
  const w = world(73);
  const key = keyOf('half');
  const opened = await open(w, key);
  await answerAll(opened.coach, w.items.slice(0, 4), w.time);
  w.route.refuse = (method, events) =>
    method === 'post' && events.length > 3 ? fault(413, 'PAYLOAD_TOO_LARGE') : null;
  await opened.handle.upload();
  assert.equal(opened.handle.trail.unsent(256).length, 0);
  const sizes = w.route.calls.filter(call => call.method === 'post').map(call => call.size);
  assert.deepEqual(sizes, [8, 4, 2, 2, 4, 2, 2]);
  close(opened);
});

test('409 + ids — 서버가 짚은 번호만 버리고 나머지를 다시 보낸다(버리는 것은 이때뿐)', async () => {
  const w = world(75);
  const key = keyOf('ids');
  const opened = await open(w, key);
  const shown = await answerAll(opened.coach, w.items.slice(0, 4), w.time);
  const gone = shown[1];
  w.route.refuse = (method, events) =>
    method === 'post' && events.some(event => event.id === gone)
      ? fault(409, 'EVENT_REVISION', { ids: [gone], revision: 1 })
      : null;
  await opened.handle.upload();
  const stored = onServer(w.server);
  assert.equal(stored.has(gone), false);
  for (const pid of shown.filter(id => id !== gone)) assert.ok(stored.has(pid));
  assert.equal(
    opened.handle.trail.unsent(256).length,
    0,
    '짚은 번호(와 그 자식 — 서버가 EVENT_LINK로)만 빠지고 대기열이 빈다',
  );
  close(opened);
});

test('가려낸 사건이 여덟을 넘으면 그 세션은 올리기를 쉬고 계기에 남긴다(R13)', async () => {
  const w = world(77, 12);
  const key = keyOf('cap');
  const health = createHealth();
  const opened = await open(w, key, { health });
  await answerAll(opened.coach, w.items.slice(0, 12), w.time);
  w.route.refuse = method => (method === 'post' ? fault(400, 'INVALID_EVENTS') : null);
  await opened.handle.upload();
  assert.equal(opened.handle.syncStatus().paused, true);
  assert.equal(opened.handle.syncStatus().skipped, 9);
  const codes = health.snapshot().save.codes;
  assert.equal(codes.REJECTED_INVALID_EVENTS, 9);
  assert.equal(codes.UPLOAD_PAUSED, 1);
  const posts = w.route.calls.filter(call => call.method === 'post').length;
  assert.equal(await opened.handle.upload(), null, '쉬는 세션은 더 보내지 않는다');
  assert.equal(w.route.calls.filter(call => call.method === 'post').length, posts);
  close(opened);
});

test('409 REVISION_CONFLICT — 올리기 · 받기를 멈추고 셸에 알린다. 사건 덧붙이기는 계속된다(R14)', async () => {
  const w = world(79);
  const key = keyOf('revision');
  const notes = [];
  const opened = await open(w, key, { onAccount: detail => notes.push(detail) });
  await answerAll(opened.coach, w.items.slice(0, 2), w.time);
  w.route.refuse = () => fault(409, 'REVISION_CONFLICT', { revision: 2 });
  await opened.handle.upload();
  assert.deepEqual(notes, [
    { kind: 'account', code: 'REVISION_CONFLICT', status: 409, revision: 2 },
  ]);
  assert.equal(opened.handle.syncStatus().stopped, 'account');
  const calls = w.route.calls.length;
  const later = await answerAll(opened.coach, w.items.slice(2, 3), w.time);
  assert.equal(later.length, 1, '쓰기는 계속된다');
  assert.equal(await opened.handle.upload(), null);
  await opened.handle.pull({ force: true });
  assert.equal(w.route.calls.length, calls, '멈춘 뒤에는 POST도 GET도 없다');
  close(opened);
});

test('POST의 403(WRITES_DISABLED · 옛 talk의 FEATURE_DISABLED) — 올리기만 멈추고 받기는 계속, 스위치 꺼짐으로 읽지 않는다(B2 · R14)', async () => {
  for (const code of ['WRITES_DISABLED', 'FEATURE_DISABLED']) {
    const w = world(81);
    const key = keyOf(`writes-${code}`);
    const notes = [];
    const opened = await open(w, key, { onAccount: detail => notes.push(detail.kind) });
    await answerAll(opened.coach, w.items.slice(0, 2), w.time);
    w.route.refuse = method => (method === 'post' ? fault(403, code) : null);
    await opened.handle.upload();
    assert.deepEqual(notes, ['writes'], code);
    assert.equal(opened.handle.syncStatus().writesOff, true);
    assert.equal(opened.handle.syncStatus().switchOff, false);
    const gets = w.route.calls.filter(call => call.method === 'get').length;
    await opened.handle.pull({ force: true });
    assert.equal(
      w.route.calls.filter(call => call.method === 'get').length,
      gets + 1,
      '받기는 계속',
    );
    close(opened);
  }
});

test('GET의 403 FEATURE_DISABLED는 그 계정의 스위치 꺼짐 — 첫 받기의 결과로 셸이 지금 판으로 간다(B2 · G4)', async () => {
  const w = world(83);
  w.route.refuse = method => (method === 'get' ? fault(403, 'FEATURE_DISABLED') : null);
  const notes = [];
  const opened = await open(w, keyOf('switch'), { onAccount: detail => notes.push(detail.kind) });
  const result = await opened.coach.synced(1000);
  assert.deepEqual(
    { ok: result.ok, kind: result.kind, base: result.base },
    { ok: false, kind: 'switch', base: false },
  );
  assert.deepEqual(notes, ['switch']);
  assert.equal(opened.handle.syncStatus().switchOff, true);
  close(opened);
});

test('GET의 400 — since 없이 한 번 다시 받는다(통째)', async () => {
  const w = world(85);
  await w.server.fold(); // 처음 접는 계정도 빈 요약(talk와 같게 머리부터 — D4)
  const key = keyOf('since');
  const opened = await open(w, key);
  await answerAll(opened.coach, w.items.slice(0, 2), w.time);
  await opened.handle.upload(); // 요약이 생겨 since가 선다
  assert.ok(opened.handle.trail.since());
  w.route.refuse = (method, since) =>
    method === 'get' && since ? fault(400, 'INVALID_SINCE') : null;
  const before = w.route.calls.length;
  await opened.handle.pull({ force: true });
  const gets = w.route.calls.slice(before).filter(call => call.method === 'get');
  assert.equal(gets.length, 2);
  assert.ok(gets[0].since && gets[1].since === null);
  assert.equal(opened.handle.syncStatus().stopped, null);
  close(opened);
});

test('첫 받기(synced) — 받으면 { ok, base }, 끊겼으면 offline, 한도를 넘으면 timeout. coach.ready는 받기를 기다리지 않는다(G4)', async () => {
  const w = world(87);
  await w.server.fold();
  const ok = await open(w, keyOf('first-ok'));
  assert.deepEqual(await ok.coach.synced(1000), { ok: true, base: true });
  assert.equal(ok.coach.summary().storage.base, true);
  close(ok);

  const off = world(88);
  off.route.refuse = method => (method === 'get' ? { code: 'NETWORK', retryable: true } : null);
  const offline = await open(off, keyOf('first-off'));
  const result = await offline.coach.synced(1000);
  assert.deepEqual(
    { ok: result.ok, kind: result.kind, base: result.base },
    { ok: false, kind: 'offline', base: false },
  );
  close(offline);

  const slow = world(89);
  slow.route.get = () => new Promise(() => {}); // 답이 오지 않는다
  const waiting = await open(slow, keyOf('first-slow'));
  const late = await waiting.coach.synced(30);
  assert.equal(late.kind, 'timeout');
  close(waiting);
});

test('닫힌 뒤 돌아온 POST 답은 받지 않는다 — 닫힌 호스트가 저장소에 쓰지 않는다', async () => {
  const w = world(91);
  const key = keyOf('closed');
  const opened = await open(w, key);
  await answerAll(opened.coach, w.items.slice(0, 2), w.time);
  let open2 = null;
  const post = w.route.post;
  w.route.post = async (events, since) => {
    await new Promise(resolve => (open2 = resolve));
    return post(events, since);
  };
  const uploading = opened.handle.upload();
  while (!open2) await settle();
  const rows = (await w.port.read()).length;
  close(opened);
  open2();
  await uploading;
  await settle();
  assert.equal((await w.port.read()).length, rows, '받은 표지를 덧붙이지 않는다');
  // GET — 서버에 답을 올려 둔 뒤 새 기기(빈 저장소)의 첫 받기를 붙든 채 닫고 요약이 든 답을 돌려준다: 닫힌 호스트는 요약을
  // 저장소에 쓰지 않는다
  const g = world(92);
  const source = await open(g, keyOf('closed-get-src'));
  await source.coach.synced(1000);
  await answerAll(source.coach, g.items.slice(0, 2), g.time);
  await source.handle.upload();
  close(source);
  g.port = memoryPort();
  const server = g.route.get;
  let gRelease = null;
  g.route.get = async since => {
    await new Promise(resolve => (gRelease = resolve));
    return server.call(g.route, since);
  };
  const gOpened = await open(g, keyOf('closed-get-ok'));
  while (!gRelease) await settle();
  const gRows = (await g.port.read()).length;
  close(gOpened);
  gRelease();
  await settle();
  await settle();
  assert.equal(
    (await g.port.read()).length,
    gRows,
    '닫힌 뒤 돌아온 GET 답의 요약을 덧붙이지 않는다',
  );
});

test('손님 길로 여는 계정은 올리는 저장소 이름을 쓰지 않는다 — 기기 길 이름은 storeName이 짓는다(E1 · E4)', async () => {
  const items = bankOf(rng(93));
  const local = storeName({ account: 'acct-e4', revision: 3, local: true });
  assert.equal(local, 'synk-atlas:local:acct-e4:3');
  assert.notEqual(local, storeName({ account: 'acct-e4', revision: 3 }));
  const wrong = createCoach({
    map: fakeMap(items),
    host: {
      guest: true,
      account: 'acct-e4',
      revision: 3,
      key: storeName({ account: 'acct-e4', revision: 3 }),
      port: memoryPort(),
    },
  });
  await assert.rejects(wrong.ready, TypeError);
  const right = createCoach({
    map: fakeMap(items),
    host: {
      guest: true,
      account: 'acct-e4',
      revision: 3,
      key: `${local}-${process.pid}`,
      port: memoryPort(),
    },
  });
  await right.ready;
  assert.deepEqual(await right.synced(10), { ok: true, guest: true, base: true });
  right.dispose();
});

test('스위치가 꺼진 뒤에는 올리기도 하지 않는다 — 같은 403을 POST로 다시 받아 쓰기 문 닫힘으로 잘못 알리지 않는다(카본 끝 판 D)', async () => {
  const w = world(95);
  w.route.refuse = () => fault(403, 'FEATURE_DISABLED');
  const notes = [];
  const opened = await open(w, keyOf('switch-post'), {
    onAccount: detail => notes.push(detail.kind),
  });
  await opened.coach.synced(1000);
  await answerAll(opened.coach, w.items.slice(0, 1), w.time);
  const before = w.route.calls.length;
  await opened.handle.upload();
  assert.equal(
    w.route.calls.slice(before).filter(call => call.method === 'post').length,
    0,
    'POST를 보내지 않는다',
  );
  assert.deepEqual(notes, ['switch']);
  assert.equal(opened.handle.syncStatus().writesOff, false);
  close(opened);
});

test('닫힌 뒤 돌아온 실패는 가려내기 · 나머지 보내기 · 셸 알림을 잇지 않는다 — POST · GET 모두(카본 · GPT 끝 판 D)', async () => {
  const w = world(96);
  const notes = [];
  const opened = await open(w, keyOf('closed-fail'), {
    onAccount: detail => notes.push(detail.kind),
  });
  await opened.coach.synced(1000);
  await answerAll(opened.coach, w.items.slice(0, 2), w.time);
  let posts = 0;
  let release = null;
  w.route.post = async () => {
    posts += 1;
    if (posts === 1) await new Promise(resolve => (release = resolve));
    throw fault(400, 'INVALID_EVENTS');
  };
  const uploading = opened.handle.upload();
  while (!release) await settle();
  close(opened);
  release();
  await uploading?.catch(() => {});
  await settle();
  assert.equal(posts, 1, '닫힌 뒤 가려내기 POST를 잇지 않는다');
  assert.deepEqual(notes, [], '셸에 알리지 않는다');
  // GET — 첫 받기를 붙든 채 닫고 409 REVISION_CONFLICT로 돌려준다
  const g = world(97);
  const gNotes = [];
  let gRelease = null;
  g.route.get = async () => {
    await new Promise(resolve => (gRelease = resolve));
    throw fault(409, 'REVISION_CONFLICT', { revision: 2 });
  };
  const gOpened = await open(g, keyOf('closed-get'), {
    onAccount: detail => gNotes.push(detail.kind),
  });
  while (!gRelease) await settle();
  close(gOpened);
  gRelease();
  await settle();
  await settle();
  assert.deepEqual(gNotes, [], '닫힌 뒤 돌아온 GET 실패도 셸에 알리지 않는다');
});

test('나눠 보내는 사이 닫히면 앞 반쪽의 답을 받은 뒤에도 뒤 반쪽을 보내지 않는다(카본 · GPT 끝 판 D)', async () => {
  const w = world(98);
  const opened = await open(w, keyOf('closed-split'));
  await opened.coach.synced(1000);
  await answerAll(opened.coach, w.items.slice(0, 2), w.time);
  const post = w.route.post;
  let posts = 0;
  let release = null;
  w.route.post = async (events, since) => {
    posts += 1;
    if (posts === 1) throw fault(413, 'PAYLOAD_TOO_LARGE');
    if (posts === 2) await new Promise(resolve => (release = resolve));
    return post.call(w.route, events, since);
  };
  const uploading = opened.handle.upload();
  while (!release) await settle();
  close(opened);
  release();
  await uploading?.catch(() => {});
  await settle();
  assert.equal(posts, 2, '413으로 나눈 앞 반쪽까지만 — 닫힌 뒤 뒤 반쪽을 보내지 않는다');
});

test('받은 답을 기록부에 못 쓰면(저장소 예외) 계기에 남기고 거절이 새지 않으며, 첫 받기는 기다리게 두지 않는다(카본 끝 판 D)', async () => {
  const w = world(98);
  await w.server.fold();
  const health = createHealth();
  const leaked = [];
  const onLeak = reason => leaked.push(String(reason?.message ?? reason));
  process.on('unhandledRejection', onLeak);
  try {
    w.port.failNext(new Error('quota'));
    const opened = await open(w, keyOf('broken-receive'), { health });
    const first = await opened.coach.synced(2000);
    assert.notEqual(first.kind, 'timeout', '첫 받기를 한도까지 기다리게 두지 않는다');
    assert.equal(first.ok, false);
    await settle();
    await settle();
    assert.ok((health.snapshot().save.codes.SYNC_FAILED ?? 0) >= 1, '계기에 남긴다');
    assert.deepEqual(leaked, [], '처리되지 않은 거절이 새지 않는다');
    w.port.heal();
    close(opened);
  } finally {
    process.off('unhandledRejection', onLeak);
  }
});

test('올린 답을 기록부에 못 쓰면(저장소 예외) 계기에 남기고 올리기 약속은 거절로 새지 않는다(카본 끝 판 D)', async () => {
  const w = world(99);
  const health = createHealth();
  const opened = await open(w, keyOf('broken-ack'), { health });
  await opened.coach.synced(1000);
  await answerAll(opened.coach, w.items.slice(0, 2), w.time);
  w.port.failNext(new Error('quota'));
  await opened.handle.upload(); // 거절로 새면 여기서 던진다
  assert.ok((health.snapshot().save.codes.SYNC_FAILED ?? 0) >= 1, '계기에 남긴다');
  w.port.heal();
  close(opened);
});
