// 받기 알림 다시 검수의 엔진 지적 둘(단계 4 계획 §21-21 F1 · F2 — 설계 주인 11-16 저녁 답, §21-22 「설계 검토로 고친 것」).
//   F1: 손님 요약을 덧붙이고 얹었으면 쓴 저장이다 — 앞 요약 줄 지우기만 실패해도 알린다(계기에만 남긴다). 남은 앞 줄은 다음 저장이 지운다.
//   F2: release는 동기 그대로 두고, 다른 탭에 알리는 채널은 저장 사슬(저장 중인 쓰기 → 손님 요약 저장 → 저장소 닫기) 끝에 닫는다.
//       사슬이 실패해도 닫는다. announce는 닫힘 표시가 아니라 채널이 열려 있는지를 본다.
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

const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
const { openRecord } = await subject('record/log.mjs');
const { createHealth } = await subject('health/index.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');
const { memory, PARAMS: SYNC_PARAMS } = await import('../support/trail-sync.mjs');
const { bank, indexOf, T0 } = await import('../support/trail-world.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:release-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const quiet = async (rounds = 10) => {
  for (let i = 0; i < rounds; i += 1) await settle();
};
async function until(check, label, ms = 3000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (check()) return;
    await settle();
  }
  assert.fail(`기다림 한도 — ${label}`);
}
const origin = { origin: 'https://world.test' };
function topWindow(openPort) {
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort });
  return top;
}

// 다른 탭처럼 엿듣는 채널 — 호스트의 채널 이름(synk-atlas:<열쇠>)과 같다.
function ear(key) {
  const posts = [];
  const channel = new BroadcastChannel(`synk-atlas:${key}`);
  channel.onmessage = event => posts.push(event.data);
  return { posts, close: () => channel.close() };
}

// 호스트를 연 뒤의 손님 요약 저장(열 때 접은 요약)과 그 알림이 다 지나가기를 기다린다 — 엿듣기는 그 뒤부터 센다.
async function settledOpen(handle) {
  await handle.trail.localSaved();
  await quiet(20);
}

// 손님 요약(kind 'local')을 덧붙이는 쓰기만 문 앞에서 기다리게 하는 포트.
function gatedPort(base = memoryPort()) {
  let gate = null;
  const port = {
    ...base,
    async append(values) {
      if (gate && values.some(value => value?.kind === 'local')) await gate.promise;
      return base.append(values);
    },
  };
  return {
    port,
    hold() {
      let open = null;
      gate = { promise: new Promise(resolve => (open = resolve)) };
      return () => {
        gate = null;
        open();
      };
    },
  };
}

// 손님 창 둘 — 같은 열쇠 · 같은 포트, 다른 위 창. A가 답 셋을 쓰고 B가 그 사건까지 읽은 뒤, A 창의 호스트를 시험이 한 번 더 받는다
// (코치를 닫아도 시험이 놓을 때까지 호스트가 남는다 — 마지막 놓기를 시험이 쥔다).
async function guestPair(tag, seed) {
  const items = bankOf(rng(seed), { items: 6 });
  const time = clock();
  const gated = gatedPort();
  const key = keyOf(tag);
  const [topA, topB] = [topWindow(() => gated.port), topWindow(() => gated.port)];
  const coachIn = (scope, gameId) =>
    createCoach({
      gameId,
      map: fakeMap(items),
      seed: 's',
      dayOffset: 0,
      scope,
      host: { guest: true, key, port: gated.port, now: time.now },
    });
  const a = coachIn(topA, 'a');
  const b = coachIn(topB, 'b');
  await Promise.all([a.ready, b.ready]);
  a.recommend(items, { set: { length: 6, newLimit: 6 } });
  for (const item of items.slice(0, 3)) {
    await a.answer(a.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  await until(() => b.summary().storage.unfolded > 0, 'B가 A의 답 사건까지 읽었다');
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: true }, topA);
  await handle.trail.localSaved();
  await quiet(20); // 답 사건의 알림이 다 오고 그친다
  return { items, time, gated, key, topA, a, b, handle, coachIn };
}
const shapeOf = coach => {
  const summary = coach.summary();
  return JSON.stringify([
    summary.units.length,
    summary.storage.unfolded,
    summary.skills.reduce((n, row) => n + row.n, 0),
  ]);
};

test('F2 — 손님 요약 저장 중에 호스트를 놓으면 그 저장이 끝난 뒤 다른 탭에 알림이 하나 가고, 사슬이 끝나 채널이 닫히면 그 뒤 알림은 없다(설계 주인 11-16 저녁)', async () => {
  const { gated, key, a, b, handle } = await guestPair('saving', 2101);
  const heard = ear(key);
  try {
    const open = gated.hold();
    await a.finishSet({ record: false }).folded; // 메모리에서 접혔다 — 저장은 문 앞에서 기다린다
    a.dispose();
    releaseHost(handle); // 마지막 놓기 — 저장 사슬이 그 저장을 기다린다
    await quiet();
    assert.equal(heard.posts.length, 0, '저장이 끝나기 전에는 알리지 않는다');
    open();
    await until(() => heard.posts.length === 1, '놓은 뒤 끝난 저장도 다른 탭에 알린다');
    await until(
      () => b.summary().storage.unfolded === 0,
      'B는 그 알림으로 꼬리를 읽어 접힌 요약을 본다',
    );
    await quiet(); // 사슬 끝 — 채널을 닫는다
    handle.landed(); // 닫힌 뒤의 알림
    await quiet();
    assert.equal(heard.posts.length, 1, '채널이 닫힌 뒤에는 알리지 않는다');
  } finally {
    heard.close();
    b.dispose();
  }
});

test('F2 — 진행 중인 저장이 없으면 놓은 뒤 곧 채널을 닫는다(설계 주인 11-16 저녁)', async () => {
  const port = memoryPort();
  const key = keyOf('idle');
  const time = clock();
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: true },
    topWindow(() => port),
  );
  await settledOpen(handle);
  const heard = ear(key);
  try {
    handle.landed();
    await until(() => heard.posts.length === 1, '열린 동안은 알린다');
    releaseHost(handle);
    await quiet(5);
    handle.landed();
    await quiet();
    assert.equal(heard.posts.length, 1, '곧 닫혀 그 뒤에는 알리지 않는다');
  } finally {
    heard.close();
  }
});

test('F2 — 같은 문서에서 같은 열쇠로 다시 연 호스트는 앞 호스트의 늦은 알림을 받아 꼬리를 바르게 읽는다(설계 주인 11-16 저녁)', async () => {
  const { items, time, gated, key, topA, a, b, handle, coachIn } = await guestPair('reopen', 2111);
  let again = null;
  try {
    const open = gated.hold();
    await a.finishSet({ record: false }).folded;
    a.dispose();
    releaseHost(handle);
    // 같은 위 창(같은 문서)에서 같은 열쇠로 다시 연다 — 닫히는 중인 호스트 대신 새 연결을 받는다.
    again = coachIn(topA, 'a2');
    await again.ready;
    const notes = [];
    again.watch(note => notes.push(note.kind));
    open();
    await until(() => notes.includes('refresh'), '앞 호스트의 늦은 알림을 받는다');
    await until(() => b.summary().storage.unfolded === 0, 'B도 접힌 요약을 읽는다');
    assert.equal(shapeOf(again), shapeOf(b), '다시 연 호스트가 읽은 꼬리 = 다른 탭이 읽은 꼬리');
    assert.equal(again.summary().units.length > 0, true);
    assert.ok(items.length > 0 && time.now() > 0);
  } finally {
    again?.dispose();
    b.dispose();
  }
});

test('F2 — 저장 사슬이 실패해도(저장소 닫기 실패) 채널은 닫힌다(설계 검토 Fable P3)', async () => {
  const base = memoryPort();
  const port = {
    ...base,
    async close() {
      throw new Error('close failed');
    },
  };
  const key = keyOf('chain-fails');
  const time = clock();
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: true },
    topWindow(() => port),
  );
  await settledOpen(handle);
  const heard = ear(key);
  try {
    releaseHost(handle); // 이 호스트가 연 포트 — 사슬이 닫기를 부르고 그 닫기가 던진다
    await quiet();
    handle.landed();
    await quiet();
    assert.equal(heard.posts.length, 0, '사슬이 실패해도 채널이 닫혀 알리지 않는다');
  } finally {
    heard.close();
  }
});

test('F2 — 차례를 기다리는 손님 요약 저장은 놓기가 거둔다 — 차례 한도(1초)를 기다리지 않고 곧 채널이 닫히고, 그 저장은 쓰지도 알리지도 않는다(설계 검토 Fable P3)', async () => {
  const items = bankOf(rng(2131), { items: 4 });
  const time = clock();
  const port = memoryPort();
  const key = keyOf('withdrawn');
  const locks = fakeLocks();
  const top = topWindow(() => port);
  const coach = createCoach({
    gameId: 'w',
    map: fakeMap(items),
    seed: 's',
    dayOffset: 0,
    scope: top,
    host: { guest: true, key, port, now: time.now, locks },
  });
  await coach.ready;
  for (const item of items.slice(0, 2)) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  const handle = await acquireHost({ key, params: PARAMS, now: time.now, guest: true }, top);
  await quiet(20);
  const stuck = locks.hold(`synk-atlas:${key}`); // 다른 탭이 차례를 쥐고 놓지 않는다
  const heard = ear(key);
  try {
    const locals = async () => (await port.read()).filter(row => row.value.kind === 'local').length;
    const before = await locals();
    await coach.finishSet({ record: false }).folded; // 저장은 차례를 기다린다
    coach.dispose();
    releaseHost(handle);
    await new Promise(resolve => setTimeout(resolve, 200)); // 차례 한도(1초)보다 짧게
    handle.landed();
    await quiet();
    assert.equal(
      heard.posts.length,
      0,
      '거둔 저장은 알리지 않고, 채널은 한도를 기다리지 않고 닫혔다',
    );
    assert.equal(await locals(), before, '거둔 저장은 쓰지 않았다');
  } finally {
    stuck();
    heard.close();
  }
});

test('F2 — 놓은 뒤 채널이 닫히기 전에 끝난 사건 쓰기는 알리고, 닫힌 뒤에 끝난 쓰기는 알리지 않는다(설계 검토 Fable P3)', async () => {
  const base = memoryPort();
  let gate = null;
  const port = {
    ...base,
    async append(values) {
      if (gate && values.some(value => value?.kind === 'event')) await gate.promise;
      return base.append(values);
    },
  };
  const hold = () => {
    let open = null;
    gate = { promise: new Promise(resolve => (open = resolve)) };
    return () => {
      gate = null;
      open();
    };
  };
  const items = bankOf(rng(2141), { items: 4 });
  const key = keyOf('late-write');
  const time = clock();
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: true },
    topWindow(() => port),
  );
  await settledOpen(handle);
  const heard = ear(key);
  try {
    const open = hold();
    const shown = handle.write(EVENT_TYPES.presented, presentedOf(items[0]));
    releaseHost(handle); // 저장 중인 쓰기가 있다 — 사슬이 그 쓰기를 기다린다
    await quiet();
    assert.equal(heard.posts.length, 0, '쓰기가 끝나기 전');
    open();
    assert.equal(await shown.stored, true);
    await until(() => heard.posts.length === 1, '채널이 닫히기 전에 끝난 쓰기는 알린다');
    await quiet(); // 사슬 끝 — 채널을 닫는다
    const late = handle.write(EVENT_TYPES.presented, presentedOf(items[1]));
    await late.stored;
    await quiet();
    assert.equal(heard.posts.length, 1, '채널이 닫힌 뒤에 끝난 쓰기는 알리지 않는다');
  } finally {
    heard.close();
  }
});

// 손님 기록부의 2판 제시 필드(호스트 write에 바로 넘긴다).
function presentedOf(item) {
  return {
    setId: 'set-release',
    itemKey: item.itemKey,
    familyKey: item.familyKey,
    skillId: item.skillId,
    difficulty: item.difficulty ?? 1,
    responseFormat: item.responseFormat ?? 'single-choice',
    modality: 'listening',
    audioRequired: false,
    confounded: false,
    units: item.units?.length ? item.units : ['u0'],
    firstExposure: true,
    editions: { ...PARAMS.editions, index: 'index-t' },
    expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
    arm: 'adaptive',
    reason: { code: 'unit.new', slots: {}, evidence: {}, target: null, tier: 2, introduced: [] },
  };
}

// ── F1 ─────────────────────────────────────────────────────────────────────────

const ledgerItems = bank(rng(2151));
const ledgerIndex = indexOf(ledgerItems, 'index-a');
const answerOf = (presentationId, verdict = 'correct') => ({
  presentationId,
  attemptNo: 1,
  verdict,
  errorTags: [],
});
async function practise(record, item) {
  const shown = record.add(EVENT_TYPES.presented, {
    ...presentedOf(item),
    editions: { ...SYNC_PARAMS.editions, index: 'index-a' },
  });
  await shown.stored;
  const made = record.add(EVENT_TYPES.attempted, answerOf(shown.event.id));
  await made.stored;
}

test('F1 — 손님 요약의 앞 줄 지우기만 실패해도 쓴 저장으로 세어 알리고 계기에만 남긴다 · 다음 저장이 남은 앞 줄까지 지워 저장소가 늘지 않는다(설계 주인 11-16 저녁)', async () => {
  const port = memoryPort();
  const remove = port.remove;
  let failing = 0;
  port.remove = async keys => {
    if (failing > 0) {
      failing -= 1;
      throw new Error('remove failed');
    }
    return remove(keys);
  };
  const health = createHealth();
  let saved = 0;
  const record = await openRecord({
    port,
    guest: true,
    memory,
    params: SYNC_PARAMS,
    index: ledgerIndex,
    now: () => T0,
    health,
    onLocalSaved: () => {
      saved += 1;
    },
  });
  await record.localSaved();
  const opened = saved;
  const locals = async () => (await port.read()).filter(row => row.value.kind === 'local').length;
  assert.equal(await locals(), 1, '열 때 접은 요약 하나');

  await practise(record, ledgerItems[0]);
  failing = 1;
  await record.refold();
  await record.localSaved();
  assert.equal(saved, opened + 1, '지우기만 실패한 저장도 알림이 하나 나간다');
  assert.equal(await locals(), 2, '지우지 못한 앞 요약 줄이 남았다');
  assert.ok(health.snapshot().save.codes.LOCAL_SUMMARY_DROP >= 1, '계기에 남긴다');

  await practise(record, ledgerItems[1]);
  await record.refold();
  await record.localSaved();
  assert.equal(saved, opened + 2);
  assert.equal(await locals(), 1, '다음 저장이 남은 앞 줄까지 지운다 — 저장소가 늘지 않는다');
});
