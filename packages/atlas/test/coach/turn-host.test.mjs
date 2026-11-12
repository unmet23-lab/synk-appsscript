// 계정 길 ②의 호스트 쪽 장면(단계 4 계획 §18-5-1 R1 · R2): 차례를 쥐는 겹은 호스트 하나다. 다시 들어갈 수 없는 가짜 자물쇠(진짜
// Web Locks와 같다)로 모든 일 — 열기 · 옛 기록 옮기기 · 답 · 판 끝 · 올리기 · 받기 · 치우기 — 을 한 바퀴 돌려 한도 안에 끝나고 못 얻음이
// 없다(차례 안에서 또 청하면 그 저장소의 일이 모두 멈춘다 — s8). 쥔 채 안 놓는 탭이 있으면 다른 탭의 대기열은 한도 뒤 올라간다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import {
  bankOf,
  clock,
  createCoach,
  fakeLocks,
  fakeMap,
  memoryPort,
  PARAMS,
  STEP,
} from './support.mjs';

const { acquireHost, releaseHost } = await subject('coach/host.mjs');
const { TURN_JOBS } = await subject('coach/turn.mjs');
const { createHealth } = await subject('health/index.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:turn-${process.pid}-${tag}-${(stores += 1)}`;
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
// 시험용 짧은 한도(표의 갈래는 그대로).
const SHORT = Object.fromEntries(
  Object.entries(TURN_JOBS).map(([job, rule]) => [job, { ...rule, wait: 50 }]),
);

function routeOf(server) {
  return {
    posts: 0,
    async post(events, since) {
      this.posts += 1;
      return server.post(events, since);
    },
    async get(since) {
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
}

async function answerAll(coach, items, time) {
  for (const item of items) {
    const pid = coach.present(item);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
}

// 옛 기록 읽개 — 옛 꼴 사건 없이 장부만. 옮기기가 장부 사건 하나를 쓰고 손님 요약을 다시 접어 저장한다 — 차례 안에서 다시 청하면
// coach.ready가 멈추던 자리(s8).
const legacyOf = item => () => ({
  log: [],
  ledger: { keys: { [`family:${item.familyKey}`]: 1 }, cells: {} },
});
const tick = (ms = 2) => new Promise(resolve => setTimeout(resolve, ms));

test('다시 들어갈 수 없는 자물쇠로 손님 길 한 바퀴 — 열기 · 옛 기록 옮기기 · 답 · 판 끝이 한도 안에 끝나고 못 얻음이 없다(R1)', {
  timeout: 10_000,
}, async () => {
  const items = bankOf(rng(3), { items: 6 });
  const time = clock();
  const locks = fakeLocks();
  const health = createHealth();
  const coach = createCoach({
    gameId: 'turn-guest',
    map: fakeMap(items),
    seed: 't',
    dayOffset: 0,
    host: {
      guest: true,
      key: keyOf('guest'),
      port: memoryPort(),
      now: time.now,
      locks,
      legacy: legacyOf(items[5]),
      health,
      turnJobs: SHORT,
    },
  });
  await coach.ready;
  assert.equal(coach.exposure(items[5]).met, true, '옛 장부의 계열이 옮겨 왔다(차례 안에서)');
  await answerAll(coach, items.slice(0, 3), time);
  const set = coach.finishSet({ kind: 'short' });
  await set?.folded;
  coach.dispose();
  assert.equal(health.snapshot().save.codes.TURN_BUSY ?? 0, 0, '차례를 못 얻은 일이 없다');
  assert.deepEqual(
    locks.reentered,
    [],
    '차례 안에서 같은 저장소의 차례를 또 청하지 않는다(R1 · s8)',
  );
  assert.ok(locks.requests.length > 0, '자물쇠를 썼다');
  assert.ok(
    locks.requests.every(row => row.name === locks.requests[0].name),
    '저장소 하나의 이름',
  );
});

test('다시 들어갈 수 없는 자물쇠로 계정 길 한 바퀴 — 올리기 · 받기 · 치우기가 한도 안에 끝나고 못 얻음이 없다(R1)', {
  timeout: 10_000,
}, async () => {
  const items = bankOf(rng(5), { items: 6 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(6), index: indexOfMap(map) });
  const route = routeOf(server);
  const time = clock();
  const locks = fakeLocks();
  const health = createHealth();
  const key = keyOf('acct');
  const port = memoryPort();
  const coach = createCoach({
    gameId: 'turn-acct',
    map,
    seed: 't',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-turn',
      revision: 1,
      key,
      port,
      transport: route,
      now: time.now,
      locks,
      health,
      turnJobs: SHORT,
    },
  });
  await coach.ready;
  assert.equal((await coach.synced(2000)).ok, true, '첫 받기');
  await answerAll(coach, items, time);
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false });
  await handle.upload();
  await handle.pull({ force: true });
  assert.equal(handle.trail.unsent().length, 0, '모두 올라갔다');
  // 서버 시각을 받았으니 하루 한 번 치우기가 같은 줄에서 차례 안에 돈다.
  const swept = async () => (await port.read()).some(row => row.value.swept);
  for (let i = 0; i < 100 && !(await swept()); i += 1) await tick();
  assert.ok(await swept(), '치우기가 차례 안에서 끝났다');
  releaseHost(handle);
  coach.dispose();
  assert.equal(health.snapshot().save.codes.TURN_BUSY ?? 0, 0);
  assert.deepEqual(
    locks.reentered,
    [],
    '차례 안에서 같은 저장소의 차례를 또 청하지 않는다(R1 · s8)',
  );
  assert.ok(locks.requests.length >= 2);
});

test('다른 탭이 차례를 쥐고 안 놓아도 대기열은 올라간다 — 이번 바퀴를 쉬다가 못 얻는 일이 이어지면 차례 없이(R2)', {
  timeout: 15_000,
}, async () => {
  const items = bankOf(rng(7), { items: 4 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(8), index: indexOfMap(map) });
  const route = routeOf(server);
  const time = clock();
  const locks = fakeLocks();
  const key = keyOf('stuck');
  const release = locks.hold(`synk-atlas:${key}`); // 쥔 채 멈춘 탭
  const port = memoryPort();
  const coach = createCoach({
    gameId: 'turn-stuck',
    map,
    seed: 't',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-stuck',
      revision: 1,
      key,
      port,
      transport: route,
      now: time.now,
      locks,
      turnJobs: SHORT,
    },
  });
  await coach.ready;
  await answerAll(coach, items, time);
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false });
  for (let round = 0; round < 6 && handle.trail.unsent().length; round += 1) await handle.upload();
  assert.equal(handle.trail.unsent().length, 0, '쥔 탭이 놓지 않아도 한도 뒤 올라갔다');
  await new Promise(resolve => setTimeout(resolve, 120)); // 하루 한 번 치우기가 청하고 한도에 걸릴 만큼
  assert.equal(
    (await port.read()).some(row => row.value.swept),
    false,
    '치우기는 차례를 얻었을 때만 — 이어져도 차례 없이 하지 않는다(R2)',
  );
  release();
  releaseHost(handle);
  coach.dispose();
});
