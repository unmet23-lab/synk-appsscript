// 코치 3판 — Fable 5.2 설계 검토(11-11)가 짚은 자리: 측정용 「처음」(P1-2), 위 창이 만드는 호스트(P1-3), 옛 기기 기록 옮기기(P1-5 ①),
// 판 수명(P2-1 — 같은 set · 기본 판 · 본인 말 · due), 낙관 상태의 틈(P2-2 — 기다리는 보기 · 다른 코치의 본인 말 · 실패한 본인 말 · 제외).
// 단계 4 계획 §3 · §11 시험 4 · 5. 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import {
  answerOf,
  bankOf,
  choose,
  clock,
  createCoach,
  createLearner,
  createMemory,
  fakeMap,
  memoryPort,
  PARAMS,
  present,
  record,
  STEP,
  startSession,
} from './support.mjs';

const { installHostMaker } = await subject('coach/host.mjs');
const { emptySummary, packSummary } = await subject('record/summary.mjs');

const HOUR = 3_600_000;
let stores = 0;
const keyOf = tag => `synk-atlas:lifecycle-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const eventsOf = async port => (await port.read()).map(row => row.value.event).filter(Boolean);

function coachOn({ items, time, port, key, gameId = 'g', seed = 's', ...host }) {
  return createCoach({
    gameId,
    map: fakeMap(items),
    seed,
    dayOffset: 0,
    host: { guest: true, port, key, now: time.now, ...host },
  });
}

// 단위를 손으로 정한 작은 은행 — X1 · X2는 단위 U 하나, Y1 ~ Y4는 저마다 다른 단위.
const U = 'ko.word.u';
function handBank() {
  const row = (i, units) =>
    Object.freeze({
      itemKey: `h.i${i}`,
      familyKey: `h.f${i}`,
      skillId: 'ko.reading.h',
      difficulty: 1,
      responseFormat: 'single-choice',
      units: Object.freeze(units),
      order: i,
      modality: 'reading',
    });
  return [
    row(0, [U]),
    row(1, [U]),
    row(2, ['ko.word.v1']),
    row(3, ['ko.word.v2']),
    row(4, ['ko.word.v3']),
    row(5, ['ko.word.v4']),
  ];
}

test('띄우기만 하고 닫은 제시 뒤의 첫 답은 혼자 낸 첫 답이다 — 측정용 「처음」은 만남의 표로만 정한다(Fable P1-2)', async () => {
  const items = bankOf(rng(3));
  const X = items[0];
  const port = memoryPort();
  const time = clock();
  const key = keyOf('shown');
  const first = coachOn({ items, time, port, key });
  await first.ready;
  first.recommend([X], { set: { length: 1 } });
  first.present(X); // 답 · 도움 없이 창이 닫힌다
  await settle();
  first.dispose();
  time.advance(60_000);
  const second = coachOn({ items, time, port, key });
  await second.ready;
  assert.equal(second.exposure(X).seen, true, '화면용 exposure는 띄운 제시도 본 것으로 친다');
  second.recommend([X], { set: { length: 1 } });
  const pid = second.present(X);
  const event = (await eventsOf(port)).find(e => e.id === pid);
  assert.equal(
    event.firstExposure,
    true,
    '측정용 firstExposure는 만남(답 · 답 보기 · 도움)만 본다',
  );
  const evidence = await second.answer(pid, { correct: true, assessable: true }).evidence;
  assert.equal(evidence.independent, true);
  assert.equal(evidence.exposure, 'new');
  assert.equal(second.summary().skills.find(s => s.id === X.skillId).n, 1, '능력 답 수에 든다');
  second.dispose();
});

test('문항마다 같은 set을 넘겨도 판은 한 번만 열린다 — 놓친 단위가 「다시」로 돌아오고 판 번호가 하나다(Fable P2-1 가)', async () => {
  const items = bankOf(rng(4), { items: 20, units: 12 });
  const port = memoryPort();
  const time = clock();
  const coach = coachOn({ items, time, port, key: keyOf('repeat') });
  await coach.ready;
  const codes = [];
  for (let step = 0; step < 8; step += 1) {
    const picked = coach.recommend(items, { set: { length: 8, newLimit: 50 } });
    if (picked.status === 'none') break;
    codes.push(picked.why.code);
    const pid = coach.present(picked.selected);
    await coach.answer(pid, { correct: false, assessable: true }).stored;
    time.advance(STEP);
  }
  assert.ok(codes.includes('unit.retry'), `놓친 단위가 다시 나온다 — ${codes.join(' · ')}`);
  const presented = (await eventsOf(port)).filter(e => e.type === 'practice.presented');
  assert.equal(new Set(presented.map(e => e.setId)).size, 1, '판 번호가 하나다');
  // 「더 배우기」(more)는 새 판이다.
  const more = coach.recommend(items, { set: { length: 8, newLimit: 50, more: true } });
  if (more.status !== 'none') {
    const pid = coach.present(more.selected);
    const event = (await eventsOf(port)).find(e => e.id === pid);
    assert.notEqual(event.setId, presented[0].setId);
  }
  coach.dispose();
});

test('판 없이 연 기본 판은 날이 바뀌거나 오래 쉬면 새로 연다 — 어제의 판 번호 · 한도를 들지 않는다(Fable P2-1 나)', async () => {
  const items = bankOf(rng(6), { items: 20, units: 20 });
  const port = memoryPort();
  const time = clock();
  const coach = coachOn({ items, time, port, key: keyOf('fallback') });
  await coach.ready;
  const setOf = async pid => (await eventsOf(port)).find(e => e.id === pid).setId;
  const a = await setOf(coach.present(items[0]));
  time.advance(5 * 60_000);
  const b = await setOf(coach.present(items[1]));
  assert.equal(a, b, '잠깐 사이는 같은 기본 판');
  time.advance(31 * 60_000);
  const c = await setOf(coach.present(items[2]));
  assert.notEqual(b, c, '30분 넘게 쉬면 새 판');
  time.advance(26 * HOUR);
  const d = await setOf(coach.present(items[3]));
  assert.notEqual(c, d, '날이 바뀌면 새 판');
  coach.dispose();
});

test('본인 말은 판을 열지 않고, due()는 같은 문서 다른 코치의 답까지 본다(Fable P2-1 다)', async () => {
  const items = bankOf(rng(5), { items: 20, units: 10 });
  const port = memoryPort();
  const time = clock();
  const key = keyOf('due');
  const me = coachOn({ items, time, port, key, gameId: 'me' });
  const practice = coachOn({ items, time, port, key, gameId: 'practice' });
  await Promise.all([me.ready, practice.ready]);
  const told = me.tell(items[0].units[0], 'relearn');
  await settle();
  assert.equal(
    (await eventsOf(port)).find(e => e.id === told.id).type,
    'unit.stated',
    '본인 말 사건만 — 판 열기 없이',
  );
  practice.recommend(items, { set: { length: 6, newLimit: 30 } });
  for (let step = 0; step < 5; step += 1) {
    const picked = practice.recommend(items);
    if (picked.status !== 'ready') break;
    await practice.answer(practice.present(picked.selected), { correct: false, assessable: true })
      .stored;
    time.advance(STEP);
  }
  time.advance(26 * HOUR);
  const fresh = coachOn({ items, time, port, key, gameId: 'fresh' });
  await fresh.ready;
  const units = coach => coach.due().map(row => row.unit);
  assert.ok(units(fresh).length > 0);
  assert.deepEqual(units(me), units(fresh), '「나」 코치도 연습 코치의 답을 본다');
  for (const coach of [me, practice, fresh]) coach.dispose();
});

// 두뇌만 돌린 판(coach.test의 brainRun과 같다).
function brainRun(items, { seed, length, steps }) {
  const memory = createMemory(PARAMS);
  const learner = createLearner(null);
  const time = clock();
  startSession(learner, time.t, PARAMS, { length, dayOffset: 0 });
  const out = [];
  for (let step = 0; step < steps; step += 1) {
    const top = choose(items, learner, memory, time.t, { params: PARAMS, seed })[0];
    if (!top || top.none) break;
    out.push([top.item.itemKey, top.tier, top.why.code, top.target]);
    present(learner, { ...top, at: time.t });
    const correct = answerOf(null, top.item, step);
    const answer = { correct, assisted: false, answerShown: false, unknown: false };
    record(
      learner,
      memory,
      top.item,
      { ...answer, assessable: true, target: top.target },
      time.t + 1,
    );
    time.advance(STEP);
  }
  return out;
}

// 계정 기기 — 받아 둔 요약의 판 묶음이 지금 엔진과 달라 보기가 아무것도 얹지 못한다(waitAll). 걸음마다 같은 문서의 다른 코치가
// 써서 판을 다시 세우게 한다.
async function waitingRun(items, { seed, length, steps }) {
  const time = clock();
  const port = memoryPort();
  await port.append([
    {
      kind: 'ack',
      acks: [],
      clamped: [],
      dropped: [],
      summary: packSummary(emptySummary('other-edition')),
    },
  ]);
  const key = keyOf('wait');
  const host = { guest: false, account: 'acct-wait', revision: 1 };
  const coach = coachOn({ items, time, port, key, seed, ...host });
  const other = coachOn({ items, time, port, key, gameId: 'other', ...host });
  await Promise.all([coach.ready, other.ready]);
  const out = [];
  for (let step = 0; step < steps; step += 1) {
    const picked = coach.recommend(items, step === 0 ? { set: { length } } : {});
    if (picked.status === 'none') break;
    const pid = coach.present(picked.selected);
    out.push([picked.selected.itemKey, picked.tier, picked.why.code, picked.target]);
    const correct = answerOf(null, picked.selected, step);
    await coach.answer(pid, { correct, assessable: true }).stored;
    other.tell('ko.word.zz', 'known');
    await settle();
    time.advance(STEP);
  }
  coach.dispose();
  other.dispose();
  return out;
}

test('보기가 아무것도 얹지 못하는 동안에도 판 안의 결정은 두뇌만 돌린 것과 같다 — 이 판의 내 답은 늘 본 것이다(Fable P2-2 가)', async () => {
  for (const seed of seedRange({ count: 8 })) {
    const items = bankOf(rng(seed + 300));
    const options = { seed: `w${seed}`, length: 8, steps: 12 };
    assert.deepEqual(await waitingRun(items, options), brainRun(items, options), `씨앗 ${seed}`);
  }
});

// X1을 놓친 판에서 Y 둘을 맞힌 뒤 고르면 — 「다시」가 살아 있으면 X2가 unit.retry로 나온다.
async function retryAfter(between) {
  const items = handBank();
  const port = memoryPort();
  const time = clock();
  const key = keyOf('retry');
  const coach = coachOn({ items, time, port, key });
  const other = coachOn({ items, time, port, key, gameId: 'other' });
  await Promise.all([coach.ready, other.ready]);
  coach.recommend(items, { set: { length: 8, newLimit: 50 } });
  const miss = coach.answer(coach.present(items[0]), { correct: false, assessable: true });
  await miss.stored;
  time.advance(STEP);
  await between({ coach, other, port, miss, time });
  await settle();
  for (const item of [items[2], items[3]]) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  const picked = coach.recommend(items);
  coach.dispose();
  other.dispose();
  return picked;
}

test('다른 코치 · 다른 탭의 본인 말은 이 판의 「다시」를 거두고, 저장이 실패한 본인 말은 거두지 않는다(Fable P2-2 나 · 다)', async () => {
  const control = await retryAfter(async () => {});
  assert.equal(control.why.code, 'unit.retry', '대조: 놓친 단위는 다시 나온다');
  assert.equal(control.target, U);
  const stated = await retryAfter(async ({ other, port }) => {
    const said = other.tell(U, 'known');
    await settle();
    assert.ok(
      (await eventsOf(port)).some(e => e.id === said.id),
      '다른 코치의 본인 말이 저장됐다',
    );
  });
  assert.notEqual(stated.why.code, 'unit.retry', '다른 코치의 「이미 알아요」가 「다시」를 거둔다');
  const failed = await retryAfter(async ({ coach, port }) => {
    port.failNext(new Error('quota'));
    const said = coach.tell(U, 'known');
    await settle();
    port.heal();
    assert.equal(
      (await eventsOf(port)).some(e => e.id === said.id),
      false,
      '저장되지 않았다',
    );
  });
  assert.equal(
    failed.why.code,
    'unit.retry',
    '저장되지 않은 본인 말은 없던 것 — 「다시」가 되살아난다',
  );
});

test('제외한 답은 판 상태에서도 없던 것이다(Fable P2-2 라)', async () => {
  const excluded = await retryAfter(async ({ coach, miss }) => {
    coach.exclude(miss.eventId);
    await settle();
    await settle();
  });
  assert.notEqual(excluded.why.code, 'unit.retry');
});

test('틀의 코치는 위 창의 엔진이 만든 호스트를 쓴다 — 저장소도 위 창이 열고, 틀은 열쇠를 짓지 않으며, 틀이 사라지면 놓는다(Fable P1-3)', async () => {
  const items = bankOf(rng(8));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  const opened = [];
  installHostMaker(top, {
    openPort: key => {
      opened.push(key);
      return memoryPort();
    },
  });
  const pagehide = new Set();
  const frame = {
    location: origin,
    parent: top,
    addEventListener: (type, fn) => type === 'pagehide' && pagehide.add(fn),
    removeEventListener: (type, fn) => pagehide.delete(fn),
  };
  const key = keyOf('frame');
  const base = { map: fakeMap(items), seed: 's', dayOffset: 0 };
  // 틀이 셸보다 먼저 문서 호스트를 달라고 하면 없다(HOST_MISSING) — 틀은 저장소 열쇠를 스스로 짓지 않는다.
  const early = createCoach({ ...base, gameId: 'early', host: { document: true }, scope: frame });
  await assert.rejects(early.ready, { code: 'HOST_MISSING' });
  early.dispose();
  const shell = createCoach({
    ...base,
    gameId: 'shell',
    host: { guest: true, key, now: time.now },
    scope: top,
  });
  await shell.ready;
  assert.deepEqual(opened, [key], '셸의 저장소는 위 창의 엔진이 연다');
  const game = createCoach({
    ...base,
    gameId: 'game',
    host: { document: true },
    scope: frame,
  });
  await game.ready;
  assert.equal(opened.length, 1, '틀은 저장소를 따로 열지 않는다');
  assert.equal(Object.hasOwn(frame, '__synkAtlasHosts'), false, '틀에는 등록부가 없다');
  const pid = game.present(items[0]);
  assert.equal(await game.answer(pid, { correct: true, assessable: true }).stored, true);
  assert.equal(shell.exposure(items[0]).seen, true, '틀이 쓴 것을 셸이 같은 기록부에서 본다');
  assert.equal(pagehide.size, 1, '틀의 코치는 틀이 사라질 때 닫힌다');
  for (const fn of [...pagehide]) fn();
  assert.throws(() => game.recommend(items), { code: 'DISPOSED' });
  assert.equal(top.__synkAtlasHosts.has(key), true, '셸이 쓰는 동안 호스트는 남는다');
  shell.dispose();
  assert.equal(top.__synkAtlasHosts.has(key), false, '마지막 코치가 닫히면 등록부에서 빠진다');
  // 위 창에 엔진이 없는(혼자 뜬) 페이지만 자기 창에 등록부를 둔다.
  const bare = { location: origin };
  bare.parent = bare;
  const alone = { location: origin, parent: bare, addEventListener() {}, removeEventListener() {} };
  const solo = createCoach({
    ...base,
    gameId: 'solo',
    host: { guest: true, port: memoryPort(), key: keyOf('solo'), now: time.now },
    scope: alone,
  });
  await solo.ready;
  assert.equal(Object.hasOwn(bare, '__synkAtlasHosts'), false);
  assert.equal(alone.__synkAtlasHosts.size, 1);
  solo.dispose();
});

test('손님 호스트는 열 때마다 옛 기기 기록을 옮긴다 — 옛 장부의 계열은 앞선 만남이고, 같은 장부는 두 번 옮기지 않는다(Fable P1-5 ①)', async () => {
  const items = bankOf(rng(9));
  const old = items[0];
  const other = items.find(item => item.familyKey !== old.familyKey);
  const port = memoryPort();
  const time = clock();
  const key = keyOf('legacy');
  let reads = 0;
  const legacy = async () => {
    reads += 1;
    return { log: [], ledger: { keys: { [`family:${old.familyKey}`]: 1 }, cells: {} } };
  };
  const first = coachOn({ items, time, port, key, legacy });
  await first.ready;
  const shownOld = first.present(old);
  const shownNew = first.present(other);
  const events = await eventsOf(port);
  assert.equal(events.find(e => e.id === shownOld).firstExposure, false, '옛 판에서 만난 계열');
  assert.equal(events.find(e => e.id === shownNew).firstExposure, true);
  first.dispose();
  const again = coachOn({ items, time, port, key, legacy });
  await again.ready;
  again.dispose();
  assert.equal(reads, 2, '열 때마다 옛 저장소를 본다');
  const carried = (await eventsOf(port)).filter(e => e.type === 'record.carried');
  assert.equal(carried.length, 1, '새로 든 것이 없는 장부는 다시 옮기지 않는다');
  // 옛 저장소를 못 읽어도 새 길은 연다.
  const broken = coachOn({
    items,
    time,
    port: memoryPort(),
    key: keyOf('legacy-broken'),
    legacy: async () => {
      throw new Error('old store');
    },
  });
  await broken.ready;
  broken.dispose();
});

test('판을 닫으면 마침 사건에 그 판의 번호가 실리고, 손님은 쓰기가 다 저장된 뒤 요약을 다시 접어 칸에 방금 푼 답이 든다(Fable P2-1 라 · P2-3)', async () => {
  const items = bankOf(rng(10));
  const port = memoryPort();
  const time = clock();
  const coach = coachOn({ items, time, port, key: keyOf('finish') });
  await coach.ready;
  const picked = coach.recommend(items, { set: { length: 3 } });
  const pid = coach.present(picked.selected);
  coach.answer(pid, { correct: true, assessable: true }); // 저장을 기다리지 않고 판을 닫는다
  const set = coach.finishSet({ kind: 'short' });
  await set.folded;
  const events = await eventsOf(port);
  const presented = events.find(e => e.id === pid);
  for (const id of [set.decisionId, set.completionId])
    assert.equal(
      events.find(e => e.id === id).setId,
      presented.setId,
      '마침 사건이 그 판의 제시와 이어진다',
    );
  const skill = coach.summary().skills.find(s => s.id === picked.selected.skillId);
  assert.equal(skill.cells.length, 1, '다시 열지 않아도 방금 푼 답이 칸에 든다');
  // 판 기록 없이 닫아도(record: false) 다시 접는다.
  const next = coach.recommend(items, { set: { length: 3 } });
  coach.answer(coach.present(next.selected), { correct: true, assessable: true });
  const quiet = coach.finishSet({ kind: 'short', record: false });
  assert.equal(quiet.decisionId, null);
  await quiet.folded;
  coach.dispose();
});

test('제품이 후보를 좁힌 까닭(pool)은 고른 줄의 근거 칸에 실리고 회차는 그대로다(조율 11-11 — 처음 보는 문항으로 좁혀 다시 묻기)', async () => {
  const items = bankOf(rng(11));
  const port = memoryPort();
  const time = clock();
  const coach = coachOn({ items, time, port, key: keyOf('pool') });
  await coach.ready;
  const picked = coach.recommend(items, { set: { length: 4 }, pool: 'unseen' });
  assert.equal(picked.why.evidence.pool, 'unseen');
  const pid = coach.present(picked.selected);
  const event = (await eventsOf(port)).find(e => e.id === pid);
  assert.equal(event.reason.evidence.pool, 'unseen');
  assert.equal(event.arm, picked.tier >= 3 ? 'filler' : 'adaptive', '회차는 엔진의 것 그대로');
  const plain = coach.recommend(items, { pool: 'Not A Key!' });
  assert.equal(plain.why.evidence.pool, undefined, '꼴이 아닌 값은 싣지 않는다');
  coach.dispose();
});
