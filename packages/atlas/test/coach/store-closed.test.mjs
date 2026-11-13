// 계정 저장소가 닫힌 뒤 · 물러서는 중의 올리기(Fable 5.2 끝 판 F2 · F5 · 넘친 #3 · #14 — 단계 4 계획 §18-5-2 · §18-5-5).
//   다른 탭이 판이 오른 저장소를 열어 이 판 저장소의 연결이 닫히면(포트의 onClosed) 호스트가 셸에 알린다(kind store) · 저장이 실패하기
//   시작하면 받기를 한 번 강제해 서버의 판 울타리 답을 받는다 · 제품이 준 포트는 호스트가 닫지 않는다 · 물러서는 중에 답이 이어져도
//   걸린 다시 보내기 기한을 미루지 않는다 · 쓰기 막힘(WRITES_DISABLED)은 긴 간격으로 다시 보내 본다.
// 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS, STEP } from './support.mjs';

const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
const { createSync } = await subject('coach/sync.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:closed-${process.pid}-${tag}-${(stores += 1)}`;
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const origin = { origin: 'https://synk.test' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 시험마다 자기 창 — 호스트가 포트를 스스로 열게(openPort) 하고, 열 때 받은 닫힘 알림(onClosed)을 붙들어 둔다.
function topWindow(openPort) {
  const top = { location: origin, addEventListener() {}, removeEventListener() {} };
  top.parent = top;
  installHostMaker(top, { openPort });
  return top;
}

function world(seed) {
  const items = bankOf(rng(seed), { items: 6 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(seed + 1), index: indexOfMap(map) });
  const calls = [];
  const route = {
    async post(events, since) {
      calls.push('post');
      return server.post(events, since);
    },
    async get(since) {
      calls.push('get');
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
  return { items, map, route, calls, time: clock() };
}

function accountCoach(w, scope, host = {}) {
  return createCoach({
    gameId: 'closed',
    map: w.map,
    seed: 's',
    dayOffset: 0,
    scope,
    host: {
      guest: false,
      account: 'acct-closed',
      revision: 1,
      key: keyOf('a'),
      transport: w.route,
      now: w.time.now,
      ...host,
    },
  });
}

test('저장소 연결이 닫히면(다른 탭이 판이 오른 저장소를 엶) 호스트가 셸에 알린다 — 호스트가 서기 전에 닫혀도 선 뒤에(Fable 5.2 끝 판 F5)', async () => {
  for (const early of [false, true]) {
    const w = world(early ? 12 : 11);
    let onClosed = null;
    const top = topWindow(async (_key, options) => {
      onClosed = options?.onClosed ?? null;
      if (early) onClosed?.();
      return memoryPort();
    });
    const notes = [];
    const coach = accountCoach(w, top, { onAccount: detail => notes.push(detail) });
    await coach.ready;
    assert.equal(typeof onClosed, 'function', '포트를 열 때 닫힘 알림을 건넨다');
    if (!early) onClosed();
    assert.deepEqual(
      notes.map(detail => [detail.kind, detail.code]),
      [['store', 'STORE_CLOSED']],
      early ? '서기 전에 닫힌 것도 선 뒤에 알린다' : '닫히면 곧 알린다',
    );
    coach.dispose();
  }
});

test('닫힘 알림은 호스트마다 한 번 · 닫은 호스트는 알리지 않는다 — 기기 길(올리지 않는 계정 저장소)도 셸에 알리고 손님 저장소는 계기만(F5 · 설계 주인 11-13)', async () => {
  const w = world(14);
  const closers = [];
  const top = topWindow(async (_key, options) => {
    closers.push(options?.onClosed ?? null);
    return memoryPort();
  });
  const notes = [];
  const health = {
    note: (kind, outcome) => notes.push(outcome?.code ?? null),
    snapshot: () => ({}),
  };
  const open = host =>
    createCoach({
      gameId: 'closed',
      map: w.map,
      seed: 's',
      dayOffset: 0,
      scope: top,
      host: { now: w.time.now, health, ...host },
    });
  // 기기 길 — guest + 그 계정 · 판의 기기 저장소(서버와 오가지 않음). 셸이 준 onAccount로 알린다.
  const told = [];
  const device = open({
    guest: true,
    account: 'acct-closed',
    revision: 2,
    key: keyOf('d'),
    onAccount: detail => told.push(detail.code),
  });
  await device.ready;
  const closeDevice = closers.at(-1);
  closeDevice();
  closeDevice();
  assert.deepEqual(told, ['STORE_CLOSED'], '기기 길도 알린다 — 호스트마다 한 번');
  device.dispose();
  // 닫은(닫는 중인) 호스트의 연결에 온 닫힘은 알리지 않는다 — 제 탭이 새 판을 열며 앞 판을 지울 때
  const late = [];
  const gone = accountCoach(w, top, {
    key: keyOf('g'),
    health,
    onAccount: detail => late.push(detail.code),
  });
  await gone.ready;
  const closeGone = closers.at(-1);
  gone.dispose();
  closeGone();
  assert.deepEqual(late, [], '닫은 호스트는 알리지 않는다');
  // 손님 저장소 — 셸이 onAccount를 주지 않는다(지우기 대상이 아니다): 계기만
  const before = notes.length;
  const guest = open({ guest: true, key: keyOf('u') });
  await guest.ready;
  closers.at(-1)();
  assert.deepEqual(
    notes.slice(before).filter(code => code === 'STORE_CLOSED'),
    ['STORE_CLOSED'],
    '손님 저장소의 닫힘은 계기에 남는다',
  );
  guest.dispose();
});

test('저장이 실패하기 시작하면 받기를 한 번 강제한다 — 판 울타리 답(409)으로 셸이 판을 다시 정하게, 실패가 이어지는 동안은 한 번(Fable 5.2 끝 판 F5)', async () => {
  const w = world(13);
  const port = memoryPort();
  const append = port.append;
  let broken = false;
  port.append = async values => {
    if (broken) throw Object.assign(new Error('closed'), { name: 'InvalidStateError' });
    return append.call(port, values);
  };
  const top = topWindow(async () => port);
  const coach = accountCoach(w, top);
  await coach.ready;
  await coach.synced(2000);
  await sleep(1700); // 열 때 잡힌 올리기가 지나간 뒤
  const before = w.calls.filter(call => call === 'get').length;
  broken = true;
  for (const item of w.items.slice(0, 3)) {
    const pid = coach.present(item);
    assert.equal(await coach.answer(pid, { correct: true, assessable: true }).stored, false);
    w.time.advance(STEP);
  }
  await sleep(50);
  assert.equal(
    w.calls.filter(call => call === 'get').length - before,
    1,
    '저장 실패가 이어지는 동안 받기를 한 번 강제한다',
  );
  coach.dispose();
});

test('제품이 준 포트는 호스트가 닫지 않는다 — 호스트가 연 포트만 닫는다(Fable 5.2 끝 판 넘친 #14)', async () => {
  const w = world(14);
  const closes = { given: 0, opened: 0 };
  const given = memoryPort();
  given.close = async () => {
    closes.given += 1;
  };
  const top = topWindow(async () => {
    const port = memoryPort();
    port.close = async () => {
      closes.opened += 1;
    };
    return port;
  });
  const first = accountCoach(w, top, { key: keyOf('given'), port: given });
  await first.ready;
  first.dispose();
  const second = accountCoach(w, top, { key: keyOf('opened') });
  await second.ready;
  second.dispose();
  await sleep(50);
  assert.equal(closes.given, 0, '준 포트는 제품이 닫는다');
  assert.equal(closes.opened, 1, '호스트가 연 포트는 놓을 때 닫는다');
});

// 동기 하나를 가짜 기록부 · 나르개로 — 타이머만 가짜로 돌린다.
function syncOn({ fail, now, clock, get = async () => ({ summary: null, serverTime: 0 }) }) {
  const events = [
    { schema: 2, id: 'e1', type: 'practice.presented', at: '2026-11-13T00:00:00.000Z' },
  ];
  const acked = new Set();
  const posts = [];
  const notes = [];
  const trail = {
    refresh: async () => {},
    saved: async () => {},
    unsent: (limit = 256, skip = null) =>
      events.filter(event => !acked.has(event.id) && !skip?.has?.(event.id)).slice(0, limit),
    since: () => null,
    receive: async answer => {
      for (const row of answer?.accepted ?? []) acked.add(row.id ?? row);
    },
    summary: () => null,
    compactDue: () => false,
  };
  const sync = createSync({
    trail: () => trail,
    carrier: () => ({
      post: async batch => {
        posts.push(batch.map(event => event.id));
        const error = fail();
        if (error) throw error;
        return { accepted: batch.map(event => ({ id: event.id, seq: 1 })) };
      },
      get,
    }),
    note: () => {},
    tell: () => {},
    announce: () => {},
    onAccount: detail => notes.push(detail.kind),
    writesRetryMs: 300_000,
    ...(now ? { now } : {}),
    ...(clock ? { clock } : {}),
  });
  return { sync, posts, notes, acked };
}
const flush = async () => {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
};
const fault = (status, code) =>
  Object.assign(new Error(code), { status, code, retryable: status >= 500 });

test('물러서는 중에 답이 이어져도 걸린 다시 보내기 기한을 미루지 않는다 — 15초 간격보다 자주 답해도 그 기한에 POST가 돈다(Fable 5.2 끝 판 F2)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let down = true;
  const { sync, posts, acked } = syncOn({
    fail: () => (down ? fault(503, 'SERVICE_UNAVAILABLE') : null),
  });
  sync.schedule();
  t.mock.timers.tick(1_500);
  await flush();
  assert.equal(posts.length, 1, '1.5초 뒤 첫 POST(실패)');
  t.mock.timers.tick(5_000);
  await flush();
  assert.equal(posts.length, 2, '5초 물러선 뒤 둘째 POST(실패) — 다음 간격 15초');
  // 10초마다 답한다(쓰기마다 schedule) — 걸린 15초 기한을 미루지 않는다
  for (let i = 0; i < 2; i += 1) {
    t.mock.timers.tick(10_000);
    sync.schedule();
    await flush();
  }
  assert.equal(posts.length, 3, '15초 기한에 셋째 POST가 돈다');
  down = false;
  sync.online();
  t.mock.timers.tick(1_500);
  await flush();
  assert.ok(acked.has('e1'), '다시 온라인이면 곧 올라간다');
});

test('물러서는 중 받기(GET)가 되면 걸린 긴 기한을 버리고 곧 다시 보낸다 — 화면만 다시 본 사람의 판이 5분 기한까지 기기에만 남지 않는다(Fable 5.2 끝 판 둘째 넘친 #17)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let down = true;
  const { sync, posts, acked } = syncOn({
    fail: () => (down ? fault(503, 'SERVICE_UNAVAILABLE') : null),
  });
  sync.schedule();
  for (const wait of [1_500, 5_000, 15_000, 60_000]) {
    t.mock.timers.tick(wait);
    await flush();
  }
  assert.equal(posts.length, 4, '네 번 실패 — 다음 기한은 300초 뒤');
  down = false;
  sync.visible(); // 화면이 다시 보인다 — 받기가 된다
  await flush();
  t.mock.timers.tick(1_500);
  await flush();
  assert.equal(posts.length, 5, '받기가 되면 1.5초 뒤 다시 보낸다(300초를 기다리지 않는다)');
  assert.ok(acked.has('e1'));
});

test('화면 복귀 받기 간격은 서버 시각으로 고치지 않은 시계로 잰다 — 기기 시계가 10분 앞서도 5분 뒤 다시 받는다(Fable 5.2 끝 판 둘째 넘친 #18)', async () => {
  let device = 1_800_000_000_000;
  let offset = 0;
  let gets = 0;
  const { sync } = syncOn({
    fail: () => null,
    now: () => device + offset, // 서버 시각으로 고친 시계 — 첫 받기 뒤 10분 뒤로 간다
    clock: () => device,
    get: async () => {
      gets += 1;
      offset = -600_000;
      return { summary: null, serverTime: device - 600_000 };
    },
  });
  await sync.first();
  assert.equal(gets, 1);
  device += 5 * 60_000;
  sync.visible();
  await flush();
  assert.equal(gets, 2, '5분 뒤 화면이 다시 보이면 받는다');
  device += 60_000;
  sync.visible();
  await flush();
  assert.equal(gets, 2, '5분 안이면 받지 않는다');
});

test('기기 시계가 뒤로 가면(틀리게 앞서 있던 시계를 OS가 맞춤) 화면 복귀 받기를 「5분 안」으로 치지 않고 받는다 — 음수 간격(Fable 5.2 합친 끝 판 넘친 #17)', async () => {
  let device = 1_800_000_000_000;
  let gets = 0;
  const { sync } = syncOn({
    fail: () => null,
    now: () => device,
    clock: () => device,
    get: async () => {
      gets += 1;
      return { summary: null, serverTime: device };
    },
  });
  await sync.first();
  assert.equal(gets, 1);
  device -= 3_600_000; // 첫 받기 뒤 기기 시계가 1시간 뒤로
  sync.visible();
  await flush();
  assert.equal(gets, 2, '간격이 음수면 받는다(뒤로 간 만큼 + 5분을 기다리지 않는다)');
  device += 60_000;
  sync.visible();
  await flush();
  assert.equal(gets, 2, '받은 뒤로는 그 시계로 다시 5분');
});

test('호스트는 동기에 서버 시각으로 고치지 않은 시계를 넘긴다 — 첫 받기의 서버 시각이 10분 앞서도 1분 뒤 받기는 5분 안이고 5분 뒤에 받는다(진짜 호스트, Fable 5.2 합친 끝 판 넘친 #15 ②)', async () => {
  const time = clock();
  let gets = 0;
  const transport = {
    post: async events => ({
      accepted: events.map((event, i) => ({ id: event.id, seq: i + 1 })),
      clamped: [],
      rejected: [],
    }),
    get: async () => {
      gets += 1;
      return { summary: null, serverTime: time.t + 10 * 60_000 }; // 서버 시각이 기기보다 10분 앞선다
    },
  };
  const host = await acquireHost({
    key: keyOf('raw-clock'),
    port: memoryPort(),
    params: PARAMS,
    now: time.now,
    guest: false,
    account: 'acct-raw-clock',
    revision: 1,
    transport,
  });
  assert.equal((await host.firstPull(1000)).ok, true);
  await sleep(10); // 첫 받기가 다 끝나 받는 중(pulling)이 풀리기를 기다린다 — 그 사이 pull()은 그 받기를 돌려준다
  assert.equal(gets, 1, '열 때 받았다');
  assert.ok(host.now() - time.t >= 9 * 60_000, '고친 시계는 서버 시각을 따른다');
  time.advance(60_000);
  await host.pull();
  assert.equal(gets, 1, '고치지 않은 시계로 1분 — 5분 안이라 받지 않는다(고친 시계로 재면 11분)');
  time.advance(4 * 60_000);
  await host.pull();
  assert.equal(gets, 2, '5분 뒤에는 받는다');
  releaseHost(host);
});

test('쓰기 막힘(WRITES_DISABLED)은 긴 간격으로 다시 보내 본다 — 문이 열리면 같은 동기가 올리고, 또 막히면 또 알린다(Fable 5.2 끝 판 넘친 #3)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let shut = 2;
  const { sync, posts, notes, acked } = syncOn({
    fail: () => (shut-- > 0 ? fault(403, 'WRITES_DISABLED') : null),
  });
  sync.schedule();
  t.mock.timers.tick(1_500);
  await flush();
  assert.deepEqual(notes, ['writes']);
  assert.equal(sync.status().writesOff, true);
  sync.schedule();
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(posts.length, 1, '막힌 동안은 보내지 않는다');
  t.mock.timers.tick(240_000); // 쓰기 막힘을 푼다 — 그때 거는 1.5초 모으기는 다음 틱에
  await flush();
  t.mock.timers.tick(1_500);
  await flush();
  assert.equal(posts.length, 2, '5분 뒤 다시 보내 본다(그때 쓰기의 1.5초 모으기)');
  assert.deepEqual(notes, ['writes', 'writes'], '또 막혔으면 또 알린다');
  t.mock.timers.tick(300_000);
  await flush();
  t.mock.timers.tick(1_500);
  await flush();
  assert.ok(acked.has('e1'), '문이 열리면 같은 동기가 올린다');
  assert.equal(sync.status().writesOff, false);
});
