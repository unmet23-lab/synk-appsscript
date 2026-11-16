// 지금 받기 coach.pull()(단계 4 계획 §21-22 「설계 다시 검수로 고친 것」 — 설계 주인 11-16 밤 승인). 셸이 학습일 답보다 기기가 뒤처졌을 때
// 그 답의 자리마다 한 번 부른다. 지킬 것 다섯 — 서버 길 계정에서만 곧 받고(5분 막이를 건너뛴다) 손님과 동의를 끈 계정은 null · 올리기 · 받기가
// 멈춘 코치(stopped · writesOff · switchOff)와 닫힌 코치는 받지 않는다 · 받는 중이면 그 받기의 약속을 같이 쓴다 · 셸에 예외를 던지지 않는다 ·
// 메서드 목록 둘(COACH_METHODS · 입구 METHODS)에 함께 든다(test/unit의 두 시험). 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS } from './support.mjs';

const { acquireHost, releaseHost } = await subject('coach/host.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:pull-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const fault = (status, code, extra = {}) =>
  Object.assign(new Error(code), { status, code, retryable: status >= 500, ...extra });

// 받기를 세는 나르개. hold가 있으면 받기는 그것이 풀릴 때까지 기다린다. refuse(method)가 오류를 돌려주면 그 오류를 던진다.
function routeOf(server) {
  const route = {
    gets: 0,
    hold: null,
    refuse: null,
    async post(events, since) {
      const error = route.refuse?.('post');
      if (error) throw error;
      return server.post(events, since);
    },
    async get(since) {
      route.gets += 1;
      if (route.hold) await route.hold;
      const error = route.refuse?.('get');
      if (error) throw error;
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
  return route;
}

// 받기만 하고 스스로 접지 않는 서버(접기는 시험이 부른다) · 서버 길 계정 코치(첫 받기까지 마침) · 그 코치의 호스트 손잡이(올리기를 시험이 부른다).
async function account(seed) {
  const items = bankOf(rng(seed), { items: 8 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(seed + 1), index: indexOfMap(map), foldChance: 0 });
  const route = routeOf(server);
  const time = clock();
  const key = keyOf('acct');
  const coach = createCoach({
    gameId: 'pull',
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-pull',
      revision: 1,
      key,
      port: memoryPort(),
      transport: route,
      now: time.now,
    },
  });
  await coach.ready;
  // 첫 받기가 끝날 때까지 — synced()는 받기가 끝나기 바로 전에 풀리므로 한 박자 더 기다린다(그 사이 pull()은 그 받기의 약속을 같이 쓴다).
  await coach.synced();
  await settle();
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: false },
    globalThis,
  );
  return { items, map, server, route, time, coach, handle };
}
const close = ({ coach, handle }) => {
  releaseHost(handle);
  coach.dispose();
};

// 답 하나를 올리고(서버는 받기만 한다) 서버가 접게 한다 — 기기는 아직 그 접은 요약을 모른다.
async function answered(world) {
  const pid = world.coach.present(world.items[0]);
  await world.coach.answer(pid, { correct: true, assessable: true }).stored;
  await world.handle.settled();
  await world.handle.upload();
  await settle();
}
async function foldedElsewhere(world) {
  await answered(world);
  await world.server.fold();
}

test('서버 길 계정 — 5분 막이 안이어도 곧 받는다(force). 받은 요약이 바뀌면 받기 알림이 나고 storage.sync.received가 그 자리다 · 받았으면 true', async () => {
  const world = await account(1101);
  const heard = [];
  world.coach.watch(event => heard.push(event.kind));
  await foldedElsewhere(world);
  const before = world.coach.summary().storage.sync.received;
  const gets = world.route.gets;
  assert.equal(await world.handle.pull(), null, '5분 막이 — 그냥 받기는 하지 않는다');
  assert.equal(world.route.gets, gets);
  assert.equal(await world.coach.pull(), true);
  assert.equal(world.route.gets, gets + 1, '곧 받았다');
  const after = world.coach.summary().storage.sync.received;
  assert.ok(after && after.foldedUntil > (before?.foldedUntil ?? -1), '접은 요약을 받았다');
  assert.ok(heard.includes('receive'), '받기 알림');
  close(world);
});

test('받는 중이면 그 받기의 약속을 같이 쓴다 — 같은 약속을 돌려주고 받기는 한 번이다', async () => {
  const world = await account(1102);
  await foldedElsewhere(world);
  let release = null;
  world.route.hold = new Promise(resolve => {
    release = resolve;
  });
  const gets = world.route.gets;
  const first = world.coach.pull();
  const second = world.coach.pull();
  assert.ok(first instanceof Promise);
  assert.equal(second, first, '같은 약속');
  await settle();
  release();
  world.route.hold = null;
  assert.equal(await first, true);
  assert.equal(world.route.gets, gets + 1, '받기는 한 번');
  const third = world.coach.pull();
  assert.notEqual(third, first, '끝난 받기 뒤에는 새로 받는다');
  assert.equal(await third, true);
  close(world);
});

test('손님 · 동의를 끈 계정(기기 길)은 null이다. 준비 전이거나 닫힌 코치도 null이고 예외를 던지지 않는다', async () => {
  const items = bankOf(rng(1103), { items: 4 });
  const map = fakeMap(items);
  const time = clock();
  const guest = createCoach({
    gameId: 'pull',
    map,
    seed: 's',
    dayOffset: 0,
    host: { guest: true, port: memoryPort(), key: keyOf('guest'), now: time.now },
  });
  assert.equal(guest.pull(), null, '준비 전');
  await guest.ready;
  assert.equal(guest.pull(), null, '손님');
  guest.dispose();
  assert.equal(guest.pull(), null, '닫힌 코치 — 던지지 않는다');
  const device = createCoach({
    gameId: 'pull',
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: true,
      account: 'acct-device',
      revision: 1,
      key: keyOf('device'),
      port: memoryPort(),
      now: time.now,
    },
  });
  await device.ready;
  assert.equal(device.pull(), null, '동의를 끈 계정 — 기기 길');
  device.dispose();
  const world = await account(1104);
  close(world);
  assert.equal(world.coach.pull(), null, '닫힌 서버 길 코치');
});

test('올리기 · 받기가 멈춘 코치는 받지 않는다 — 올리기만 막힌 코치(writesOff)도 null이고 받기를 내지 않는다(stopped · switchOff도)', async () => {
  // writesOff — POST 403 WRITES_DISABLED(올리기만 멈춤 — 호스트의 받기는 막지 않는다)
  const writes = await account(1105);
  writes.route.refuse = method => (method === 'post' ? fault(403, 'WRITES_DISABLED') : null);
  await answered(writes);
  assert.equal(writes.coach.summary().storage.sync.writesOff, true);
  let gets = writes.route.gets;
  assert.equal(writes.coach.pull(), null);
  await settle();
  assert.equal(writes.route.gets, gets, '받기를 내지 않는다');
  close(writes);
  // switchOff — GET 403 FEATURE_DISABLED
  const switched = await account(1106);
  switched.route.refuse = method => (method === 'get' ? fault(403, 'FEATURE_DISABLED') : null);
  assert.equal(await switched.coach.pull(), false, '받기가 꺼짐으로 끝났다 — 던지지 않는다');
  assert.equal(switched.coach.summary().storage.sync.switchOff, true);
  gets = switched.route.gets;
  assert.equal(switched.coach.pull(), null);
  assert.equal(switched.route.gets, gets);
  close(switched);
  // stopped — POST 409 REVISION_CONFLICT(올리기 · 받기 멈춤)
  const stopped = await account(1107);
  stopped.route.refuse = method =>
    method === 'post' ? fault(409, 'REVISION_CONFLICT', { revision: 2 }) : null;
  await answered(stopped);
  assert.equal(stopped.coach.summary().storage.sync.stopped, 'account');
  assert.equal(stopped.coach.pull(), null);
  close(stopped);
});

test('받기가 끊겨도 던지지 않고 false로 풀린다', async () => {
  const world = await account(1108);
  world.route.refuse = method => (method === 'get' ? fault(0, 'NETWORK') : null);
  assert.equal(await world.coach.pull(), false);
  close(world);
});
