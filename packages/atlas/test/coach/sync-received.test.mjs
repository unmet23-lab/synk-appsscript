// 서버 길 계정이 받은 요약의 자리(summary().storage.sync.received)와 처음 장부 칸(summary().carried) — 단계 4 계획 §21-22.
//   received: 받은 요약의 { edition, gen, foldedUntil }. 손님과 동의를 끈 계정, 첫 받기 전은 null. 받은 요약이 바뀐 뒤에만 바뀐다.
//   carried: 서버 접기가 머리에 적어 요약에 실은 칸. 받은 요약이 없으면 null.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS, STEP } from './support.mjs';

const { acquireHost, releaseHost } = await subject('coach/host.mjs');
const { createEvent, eventId } = await subject('record/events.mjs');
const { firstLedgerCells } = await subject('record/carry.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:received-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check, label, ms = 3000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (await check()) return;
    await settle();
  }
  assert.fail(`기다림 한도 — ${label}`);
}
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const routeOf = server => ({
  async post(events, since) {
    return server.post(events, since);
  },
  async get(since) {
    return { summary: await server.summary(since), serverTime: server.now };
  },
});
const positionOf = summary => ({
  edition: summary.edition,
  gen: summary.gen ?? null,
  foldedUntil: summary.foldedUntil,
});

test('storage.sync.received — 서버 길 계정은 받은 요약의 자리다. 받은 요약이 없으면 null이고, 받은 요약이 바뀐 뒤에만 바뀐다', async () => {
  const items = bankOf(rng(2201), { items: 4 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(2202), index: indexOfMap(map) });
  const time = clock();
  const key = keyOf('account');
  const coach = createCoach({
    gameId: 'received',
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-received',
      revision: 1,
      key,
      port: memoryPort(),
      transport: routeOf(server),
      now: time.now,
    },
  });
  await coach.ready;
  await coach.synced();
  assert.equal(coach.summary().storage.sync.received, null, '서버에 머리가 없어 받은 요약이 없다');
  for (const item of items.slice(0, 2)) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false });
  try {
    await handle.upload();
    await server.fold();
    await handle.pull({ force: true });
    const served = await server.summary(null);
    await until(
      () => coach.summary().storage.sync.received?.foldedUntil === served.foldedUntil,
      '받은 요약의 자리',
    );
    assert.deepEqual(coach.summary().storage.sync.received, positionOf(served));
    const first = coach.summary().storage.sync.received;
    await handle.pull({ force: true }); // 달라진 것이 없는 받기
    assert.deepEqual(
      coach.summary().storage.sync.received,
      first,
      '받은 요약이 그대로면 자리도 그대로',
    );
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});

test('storage.sync.received — 손님은 null이다(storage.sync는 그대로 객체 — pulled를 읽는 셸이 깨지지 않는다)', async () => {
  const items = bankOf(rng(2211), { items: 3 });
  const time = clock();
  const coach = createCoach({
    gameId: 'guest-received',
    map: fakeMap(items),
    seed: 's',
    dayOffset: 0,
    host: { guest: true, key: keyOf('guest'), port: memoryPort(), now: time.now },
  });
  await coach.ready;
  const sync = coach.summary().storage.sync;
  assert.equal(typeof sync, 'object');
  assert.equal(sync.received, null);
  coach.dispose();
});

test('summary().carried — 서버 길 계정은 서버가 접어 요약에 실은 처음 장부 칸을 낸다(받은 요약이 없으면 null)', async () => {
  const items = bankOf(rng(2221), { items: 4 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(2222), index: indexOfMap(map) });
  const time = clock();
  const key = keyOf('carried');
  const coach = createCoach({
    gameId: 'carried',
    map,
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-carried',
      revision: 1,
      key,
      port: memoryPort(),
      transport: routeOf(server),
      now: time.now,
    },
  });
  await coach.ready;
  assert.equal(coach.summary().carried, null, '받은 요약이 없으면 null');
  const atMs = server.now - 60_000;
  const ledger = createEvent(
    'record.carried',
    {
      families: { [items[0].familyKey]: 1 },
      items: {},
      after: null,
      cells: [
        {
          skillId: items[0].skillId,
          difficulty: 1,
          independent: 2,
          correct: 2,
          helped: 0,
          lastAt: null,
        },
      ],
    },
    { id: eventId(atMs, 1, 'ledger00'), atMs, revision: 1 },
  );
  server.server.append([ledger], server.now);
  await server.fold();
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: false });
  try {
    await handle.pull({ force: true });
    await until(() => coach.summary().carried != null, '받은 요약의 칸');
    assert.deepEqual(coach.summary().carried, firstLedgerCells([ledger]));
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});
