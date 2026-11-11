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

const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
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
  const untagged = Object.freeze({
    itemKey: 'h.i6',
    familyKey: 'h.f6',
    skillId: 'ko.reading.h',
    difficulty: 1,
    responseFormat: 'single-choice',
    order: 6,
    modality: 'reading',
  });
  return [
    row(0, [U]),
    row(1, [U]),
    row(2, ['ko.word.v1']),
    row(3, ['ko.word.v2']),
    row(4, ['ko.word.v3']),
    row(5, ['ko.word.v4']),
    untagged,
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
  const stated = await retryAfter(async ({ coach, other, port, time }) => {
    // 태그 없는 문항(계열이 곧 단위)의 답이 판에 있어도 다시 세우기가 던지지 않는다(Fable 다시 확인 N2)
    const untagged = handBank()[6];
    await coach.answer(coach.present(untagged), { correct: true, assessable: true }).stored;
    time.advance(STEP);
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
  const early = createCoach({
    ...base,
    gameId: 'early',
    host: { document: true, wait: 0 },
    scope: frame,
  });
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

test('코치는 조각이 낱말 이름(words)을 실었으면 낱말 표 전체를 받지 않는다 — 실리지 않은 조각이 있을 때만 받는다(atlas-1b 11-11)', async () => {
  const fs = await import('node:fs');
  const { PACKAGE_ROOT } = await import('../support/subject.mjs');
  const read = name => JSON.parse(fs.readFileSync(`${PACKAGE_ROOT}/map/${name}`, 'utf8'));
  const slice = read('index.json');
  const units = read('units.json');
  const words = read('words.json');
  const fetched = [];
  const real = globalThis.fetch;
  const open = async withWords => {
    fetched.length = 0;
    globalThis.fetch = async url => {
      const name = String(url).split('/map/')[1];
      fetched.push(name);
      const body =
        name === 'units.json'
          ? units
          : name === 'words.json'
            ? words
            : withWords
              ? { ...slice, words: { prefix: 'ko.word.', fields: words.fields, units: [] } }
              : slice;
      return { ok: true, status: 200, json: async () => body };
    };
    const coach = createCoach({
      gameId: 'words',
      banks: ['topik-items'],
      words: true,
      host: { guest: true, port: memoryPort(), key: keyOf('words'), now: clock().now },
    });
    await coach.ready;
    coach.dispose();
    return [...fetched];
  };
  try {
    assert.ok(
      (await open(false)).includes('words.json'),
      '조각에 낱말 이름이 없으면 낱말 표를 받는다',
    );
    assert.ok(!(await open(true)).includes('words.json'), '조각이 실었으면 받지 않는다');
  } finally {
    globalThis.fetch = real;
  }
});

test('판을 닫지 않는 제품도 판 길이만큼 나가면 다음 set은 새 판이다 — 새것이 둘째 판부터 굶지 않는다, 닫기만 하는 finishSet은 종류를 묻지 않는다(Fable 다시 확인 N1)', async () => {
  const words = Array.from({ length: 40 }, (_, i) =>
    Object.freeze({
      itemKey: `w.i${i}`,
      familyKey: `w.f${i}`,
      skillId: 'ko.reading.w',
      difficulty: 1,
      responseFormat: 'single-choice',
      units: Object.freeze([`ko.word.n${i}`]),
      order: i,
      modality: 'reading',
    }),
  );
  const port = memoryPort();
  const time = clock();
  const coach = coachOn({ items: words, time, port, key: keyOf('unclosed') });
  await coach.ready;
  const fresh = [];
  for (let run = 0; run < 4; run += 1) {
    let introduced = 0;
    for (let step = 0; step < 6; step += 1) {
      const picked = coach.recommend(words, { set: { length: 6, newLimit: 6 } }); // 판마다 · 문항마다 같은 set, 닫지 않는다
      if (picked.status === 'none') break;
      const pid = coach.present(picked.selected);
      const event = (await eventsOf(port)).find(e => e.id === pid);
      introduced += event.reason.introduced.length;
      await coach.answer(pid, { correct: true, assessable: true }).stored;
      time.advance(STEP);
    }
    fresh.push(introduced);
  }
  assert.deepEqual(fresh, [6, 6, 6, 2], `판마다 새 단위 — 하루 한도 20(${fresh.join(' · ')})`);
  assert.doesNotThrow(
    () => coach.finishSet({ record: false }),
    '게임처럼 종류가 없는 제품도 닫을 수 있다',
  );
  assert.throws(() => coach.finishSet({ kind: 'round' }), TypeError, '판 기록은 정한 종류만');
  coach.dispose();
});

test('문서 호스트는 셸이 연 호스트만 — 틀이 먼저 연 저장소는 문서 호스트가 아니고, 첫 셸 호스트가 닫히면 남은 셸 호스트로 넘어간다(Fable 다시 확인 N3)', async () => {
  const items = bankOf(rng(12));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const frame = { location: origin, parent: top, addEventListener() {}, removeEventListener() {} };
  const base = { map: fakeMap(items), seed: 's', dayOffset: 0 };
  const open = (gameId, host, scope) => {
    const coach = createCoach({ ...base, gameId, host: { now: time.now, ...host }, scope });
    return coach.ready.then(() => coach);
  };
  // 틀이 자기 열쇠로 먼저 연다 → 문서 호스트가 아니다
  const early = await open('early', { guest: true, key: keyOf('frame-own') }, frame);
  assert.equal(
    top.__synkAtlasHosts.document ?? null,
    null,
    '틀이 연 저장소는 문서 호스트가 아니다',
  );
  // 셸이 손님 저장소, 이어서 계정 저장소를 연다(로그인 — 새 주인을 먼저 열고 옛 주인을 닫는 차례)
  const guestKey = keyOf('shell-guest');
  const guest = await open('shell-guest', { guest: true, key: guestKey }, top);
  assert.equal(top.__synkAtlasHosts.document, guestKey);
  const accountKey = keyOf('shell-account');
  const account = await open('shell-account', { guest: true, key: accountKey }, top);
  guest.dispose();
  assert.equal(top.__synkAtlasHosts.document, accountKey, '남은 셸 호스트로 넘어간다');
  const game = await open('game', { document: true, wait: 0 }, frame);
  const pid = game.present(items[0]);
  await game.answer(pid, { correct: true, assessable: true }).stored;
  assert.equal(account.exposure(items[0]).seen, true, '틀이 셸의 계정 기록부에 쓴다');
  for (const coach of [early, account, game]) coach.dispose();
});

test('셸의 첫 코치가 지도를 받는 동안 연 틀은 문서 호스트를 잠깐 기다린다(Fable 다시 확인 N5)', async () => {
  const items = bankOf(rng(13));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const frame = { location: origin, parent: top, addEventListener() {}, removeEventListener() {} };
  const base = { map: fakeMap(items), seed: 's', dayOffset: 0 };
  const game = createCoach({
    ...base,
    gameId: 'game',
    host: { document: true, wait: 2000 },
    scope: frame,
  });
  const shell = createCoach({
    ...base,
    gameId: 'shell',
    host: { guest: true, key: keyOf('race'), now: time.now },
    scope: top,
  });
  await Promise.all([game.ready, shell.ready]);
  assert.equal(shell.exposure(items[0]).seen, false);
  await game.answer(game.present(items[0]), { correct: true, assessable: true }).stored;
  assert.equal(shell.exposure(items[0]).seen, true, '기다린 틀이 셸의 기록부를 받았다');
  game.dispose();
  shell.dispose();
});

test('다른 코치가 낸 새 단위도 이 판의 하루 한도에 든다 — 판이 열린 뒤 낸 것까지(GPT GC1)', async () => {
  const words = Array.from({ length: 40 }, (_, i) =>
    Object.freeze({
      itemKey: `d.i${i}`,
      familyKey: `d.f${i}`,
      skillId: 'ko.reading.d',
      difficulty: 1,
      responseFormat: 'single-choice',
      units: Object.freeze([`ko.word.d${i}`]),
      order: i,
      modality: 'reading',
    }),
  );
  const port = memoryPort();
  const time = clock();
  const key = keyOf('day-share');
  const a = coachOn({ items: words, time, port, key, gameId: 'a' });
  const b = coachOn({ items: words, time, port, key, gameId: 'b' });
  await Promise.all([a.ready, b.ready]);
  a.recommend(words, { set: { length: 30, newLimit: 50 } }); // A가 먼저 판을 연다
  for (const item of words.slice(20, 38)) {
    await b.answer(b.present(item), { correct: true, assessable: true }).stored; // B가 새 단위 18개
    time.advance(STEP);
  }
  await settle();
  let fresh = 0;
  for (let step = 0; step < 10; step += 1) {
    const picked = a.recommend(words.slice(0, 20));
    if (picked.status !== 'ready') break;
    const pid = a.present(picked.selected);
    fresh += (await eventsOf(port)).find(e => e.id === pid).reason.introduced.length;
    await a.answer(pid, { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  assert.ok(fresh <= 2, `A가 낸 새 단위 ${fresh} — 하루 20 가운데 B가 18`);
  a.dispose();
  b.dispose();
});

test('다른 코치가 제외한 내 답도 이 판에서 없던 것이다(GPT GC2)', async () => {
  const excluded = await retryAfter(async ({ other, miss }) => {
    other.exclude(miss.eventId);
    await settle();
    await settle();
  });
  assert.notEqual(excluded.why.code, 'unit.retry');
});

test('닫은 판의 제시 번호에는 답을 받지 않는다(GPT GC4)', async () => {
  const items = bankOf(rng(14));
  const time = clock();
  const coach = coachOn({ items, time, port: memoryPort(), key: keyOf('stale-pid') });
  await coach.ready;
  const first = coach.recommend(items, { set: { length: 2 } });
  const pid = coach.present(first.selected);
  coach.finishSet({ record: false });
  assert.throws(
    () => coach.answer(pid, { correct: true, assessable: true }),
    /끝났거나 모르는 제시/,
    '닫은 직후',
  );
  coach.recommend(items, { set: { length: 2 } });
  assert.throws(
    () => coach.answer(pid, { correct: true, assessable: true }),
    /끝났거나 모르는 제시/,
  );
  // 닫지 않고 새 판을 열어도(더 배우기) 앞 판의 제시는 받지 않는다
  const again = coach.recommend(items, { set: { length: 2 } });
  const old = coach.present(again.selected);
  coach.recommend(items, { set: { length: 2, more: true } });
  assert.throws(
    () => coach.answer(old, { correct: true, assessable: true }),
    /끝났거나 모르는 제시/,
  );
  coach.dispose();
});

test('계정 호스트는 한 묶음(256) 넘게 남은 사건을 이어서 올린다(GPT GC3)', async () => {
  const items = bankOf(rng(15), { items: 140, units: 60 });
  const time = clock();
  let seq = 0;
  const batches = [];
  const transport = async events => {
    batches.push(events.length);
    return {
      accepted: events.map(event => ({ id: event.id, seq: (seq += 1) })),
      clamped: [],
      rejected: [],
    };
  };
  const coach = coachOn({
    items,
    time,
    port: memoryPort(),
    key: keyOf('upload'),
    guest: false,
    account: 'acct-upload',
    revision: 1,
    transport,
  });
  await coach.ready;
  for (const item of items.slice(0, 130)) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  for (let wait = 0; wait < 40 && coach.summary().storage.unsent > 0; wait += 1)
    await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(coach.summary().storage.unsent, 0, `남은 사건 — 묶음 ${batches.join(' · ')}`);
  assert.ok(batches.length >= 2 && batches[0] === 256);
  coach.dispose();
});

test('「모르겠어요」 표지는 지도 문항에서 실어 준다 — 제품 문항 객체에 칸이 없어도(아르곤 끝 판)', async () => {
  const items = bankOf(rng(16)).map((item, i) =>
    i === 0 ? { ...item, unknownOption: true } : item,
  );
  const time = clock();
  const coach = coachOn({ items, time, port: memoryPort(), key: keyOf('unknown') });
  await coach.ready;
  const picked = coach.recommend([items[0]], { set: { length: 3, newLimit: 10 } });
  assert.equal(picked.status, 'ready');
  assert.equal(picked.unknownOption, true);
  const plain = coach.recommend([items[1]]);
  assert.equal(plain.unknownOption, false);
  coach.dispose();
});

test('plan()은 코치의 하루 경계(현지 새벽 4시)로 하루 한도를 센다(아르곤 끝 판 C1)', async () => {
  const words = Array.from({ length: 30 }, (_, i) =>
    Object.freeze({
      itemKey: `k.i${i}`,
      familyKey: `k.f${i}`,
      skillId: 'ko.reading.k',
      difficulty: 1,
      responseFormat: 'single-choice',
      units: Object.freeze([`ko.word.k${i}`]),
      order: i,
      modality: 'reading',
    }),
  );
  const time = clock(Date.UTC(2026, 10, 10, 18, 0, 0)); // 서울 11-11 03:00 — 서울로는 11-10의 하루
  const coach = createCoach({
    gameId: 'day',
    map: fakeMap(words),
    seed: 's',
    dayOffset: 540,
    host: { guest: true, port: memoryPort(), key: keyOf('plan-day'), now: time.now },
  });
  await coach.ready;
  coach.recommend(words, { set: { length: 30, newLimit: 30 } });
  for (const item of words.slice(0, 20)) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(1000);
  }
  time.advance(7 * HOUR); // 서울 11-11 10:00 — 새 하루(UTC로는 아직 같은 하루)
  const [top] = coach.plan([{ id: 'lesson', candidates: words.slice(20) }]);
  assert.equal(top.tier, 2, '서울의 새 하루라 새것을 다시 낸다');
  coach.dispose();
});

test('답보다 앞선 도움도 그 제시의 만남이다 — 첫 만남 판정은 그 제시 안에서(아르곤 끝 판 C2)', async () => {
  const items = bankOf(rng(17));
  const time = clock();
  const coach = coachOn({ items, time, port: memoryPort(), key: keyOf('help-first') });
  await coach.ready;
  coach.recommend([items[0]], { set: { length: 3, newLimit: 10 } });
  const pid = coach.present(items[0]);
  coach.help(pid, 'hint');
  time.advance(1000);
  const evidence = await coach.answer(pid, { correct: true, assessable: true }).evidence;
  assert.equal(evidence.exposure, 'new', '처음 보는 문항의 답이다');
  assert.equal(evidence.independent, false, '힌트를 본 답은 혼자 낸 답이 아니다');
  coach.dispose();
});

test('저장이 실패한 도움은 그 답을 도움받은 답으로 만들지 않는다 — 기록부 · 서버 접기와 같게(아르곤 끝 판 C6)', async () => {
  const items = bankOf(rng(18));
  const time = clock();
  const port = memoryPort();
  const coach = coachOn({ items, time, port, key: keyOf('help-failed') });
  await coach.ready;
  coach.recommend([items[0]], { set: { length: 3, newLimit: 10 } });
  const pid = coach.present(items[0]);
  await settle();
  port.failNext(new Error('quota'));
  coach.help(pid, 'hint');
  await settle();
  port.heal();
  time.advance(1000);
  const evidence = await coach.answer(pid, { correct: true, assessable: true }).evidence;
  assert.equal(evidence.assisted, false);
  coach.dispose();
});

test('같은 판을 두 번 기록하지 않는다 — 닫기만 한 판은 뒤의 기록이 그 판 번호로 한 번 남긴다(아르곤 끝 판 C7)', async () => {
  const items = bankOf(rng(19));
  const time = clock();
  const port = memoryPort();
  const coach = coachOn({ items, time, port, key: keyOf('record-once') });
  await coach.ready;
  const picked = coach.recommend(items, { set: { length: 3 } });
  const pid = coach.present(picked.selected);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  coach.finishSet({ record: false }); // 판을 끝낸 제품 모듈이 닫기만
  const set = coach.finishSet({ kind: 'short' }); // 셸이 응답과 함께 기록
  const again = coach.finishSet({ kind: 'short' });
  await set.folded;
  const events = await eventsOf(port);
  const setId = events.find(e => e.id === pid).setId;
  assert.equal(events.find(e => e.id === set.completionId).setId, setId);
  assert.equal(again.completionId, null, '두 번째는 남기지 않는다');
  assert.equal(events.filter(e => e.type === 'experience.completed').length, 1);
  coach.dispose();
});

test('셸이 호스트를 받는 사이 다른 코치가 닫아도 그 호스트는 닫히지 않는다(아르곤 끝 판 C3)', async () => {
  const items = bankOf(rng(20));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const key = keyOf('claim');
  const base = { map: fakeMap(items), seed: 's', dayOffset: 0, scope: top };
  const first = createCoach({ ...base, gameId: 'a', host: { guest: true, key, now: time.now } });
  await first.ready;
  const second = createCoach({ ...base, gameId: 'b', host: { guest: true, key, now: time.now } });
  await Promise.resolve();
  first.dispose(); // 둘째가 받기를 기다리는 사이
  await second.ready;
  assert.equal(top.__synkAtlasHosts.has(key), true, '둘째가 쓰는 호스트가 등록부에 남는다');
  second.dispose();
  assert.equal(top.__synkAtlasHosts.has(key), false);
});

test('본인 말로 거둔 「다시」는 그 뒤에 건너뛴 답으로 되살아나지 않는다(아르곤 끝 판 C8 ②)', async () => {
  const revived = await retryAfter(async ({ coach, other, time }) => {
    other.tell(U, 'known');
    await settle();
    // U가 든 다른 문항을 건너뛴다(판정 못 한 답) — 놓친 것이 아니다
    const pid = coach.present(handBank()[1]);
    await coach.answer(pid, { correct: null, assessable: false, reason: 'unanswered' }).stored;
    time.advance(STEP);
    other.tell('ko.word.zz', 'known'); // 판을 다시 세우게
    await settle();
  });
  assert.notEqual(revived.why.code, 'unit.retry');
});

test('recommend 뒤 present 전에 판이 다시 서면 고른 줄을 지금 상태로 새로 잰다 — 처음 낸 단위를 두 번 세지 않는다(아르곤 끝 판 C8 ③)', async () => {
  const items = handBank();
  const port = memoryPort();
  const time = clock();
  const key = keyOf('rechoose');
  const a = coachOn({ items, time, port, key, gameId: 'a' });
  const b = coachOn({ items, time, port, key, gameId: 'b' });
  await Promise.all([a.ready, b.ready]);
  const picked = a.recommend([items[0]], { set: { length: 4, newLimit: 10 } }); // U가 처음 나갈 문항
  assert.ok(picked.selected);
  await b.answer(b.present(items[1]), { correct: true, assessable: true }).stored; // B가 먼저 U를 낸다
  await settle();
  const pid = a.present(picked.selected);
  const event = (await eventsOf(port)).find(e => e.id === pid);
  assert.deepEqual(event.reason.introduced, [], 'U는 오늘 이미 나갔다');
  a.dispose();
  b.dispose();
});

test('서버가 뺀 사건의 까닭(rejectedCode)은 계기 코드로 그대로 간다 — 부모 · 차례가 안 맞음(EVENT_LINK)(단계 3 bed650c2f)', async () => {
  const { createHealth } = await subject('health/index.mjs');
  const health = createHealth();
  const items = bankOf(rng(21));
  const time = clock();
  let first = true;
  const transport = async events => {
    if (!first) return { accepted: events.map((event, i) => ({ id: event.id, seq: 100 + i })) };
    first = false;
    return { accepted: [], rejected: [events[0].id], rejectedCode: 'EVENT_LINK' };
  };
  const coach = coachOn({
    items,
    time,
    port: memoryPort(),
    key: keyOf('rejected'),
    guest: false,
    account: 'acct-rejected',
    revision: 1,
    transport,
    health,
  });
  await coach.ready;
  await coach.answer(coach.present(items[0]), { correct: true, assessable: true }).stored;
  for (let wait = 0; wait < 30 && !health.snapshot().save.codes.EVENT_LINK; wait += 1)
    await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(health.snapshot().save.codes.EVENT_LINK, 1);
  coach.dispose();
});

test('태그 없는 문항(계열이 곧 단위)을 놓친 판에서도 다른 코치의 본인 말이 「다시」를 거둔다 — 다시 세우기가 던지지 않는다(Fable 다시 확인 N2)', async () => {
  const items = handBank();
  const port = memoryPort();
  const time = clock();
  const key = keyOf('untagged-miss');
  const coach = coachOn({ items, time, port, key });
  const other = coachOn({ items, time, port, key, gameId: 'other' });
  await Promise.all([coach.ready, other.ready]);
  coach.recommend(items, { set: { length: 8, newLimit: 50 } });
  await coach.answer(coach.present(items[0]), { correct: false, assessable: true }).stored; // U를 놓침
  time.advance(STEP);
  await coach.answer(coach.present(items[6]), { correct: false, assessable: true }).stored; // 태그 없는 문항도 놓침
  time.advance(STEP);
  other.tell(U, 'known');
  await settle();
  for (const item of [items[2], items[3]]) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  const picked = coach.recommend(items.slice(0, 6)); // 태그 없는 문항은 빼고 — U의 「다시」만 본다
  assert.notEqual(
    picked.why.code,
    'unit.retry',
    `U의 다시가 거둬졌다(${picked.why.code} · ${picked.target})`,
  );
  coach.dispose();
  other.dispose();
});

test('같은 계열을 둘이 띄워도 첫 만남은 먼저 만난 제시 하나의 것이다 — 시각만으로 가르지 않는다(GPT 다시 GA1)', async () => {
  const items = bankOf(rng(22)); // items[0] · items[1]은 같은 계열(t.f0)
  const time = clock();
  const coach = coachOn({ items, time, port: memoryPort(), key: keyOf('two-shows') });
  await coach.ready;
  const a = coach.present(items[0]);
  time.advance(1000);
  const b = coach.present(items[1]);
  time.advance(1000);
  const first = await coach.answer(a, { correct: true, assessable: true }).evidence;
  time.advance(1000);
  const second = await coach.answer(b, { correct: true, assessable: true }).evidence;
  assert.equal(first.exposure, 'new');
  assert.equal(second.exposure, 'repeat', '먼저 띄운 제시가 먼저 답했어도 뒤 제시는 처음이 아니다');
  assert.equal(second.independent, false);
  coach.dispose();
});

test('틀이 먼저 연 손님 저장소를 셸이 받으면 셸의 읽개로 옛 기록을 옮긴다(GPT 다시 GA2 · GA5)', async () => {
  const items = bankOf(rng(23));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const frame = { location: origin, parent: top, addEventListener() {}, removeEventListener() {} };
  const key = keyOf('adopt-legacy');
  const base = { map: fakeMap(items), seed: 's', dayOffset: 0 };
  const game = createCoach({
    ...base,
    gameId: 'game',
    host: { guest: true, key, now: time.now },
    scope: frame,
  });
  await game.ready;
  const legacy = async () => ({
    log: [],
    ledger: { keys: { [`family:${items[0].familyKey}`]: 1 }, cells: {} },
  });
  const shell = createCoach({
    ...base,
    gameId: 'shell',
    host: { guest: true, key, now: time.now, legacy },
    scope: top,
  });
  await shell.ready;
  const pid = shell.present(items[0]);
  await settle();
  assert.equal(shell.exposure(items[0]).met, true, '옛 판에서 만난 계열이 옮겨 왔다');
  game.dispose();
  shell.dispose();
  assert.ok(pid);
});

test('문서 호스트를 기다리던 틀은 그 호스트가 서는 순간 쓰는 사람으로 센다 — 깨어나기 전에 셸이 놓아도 남는다(GPT 다시 GA4)', async () => {
  const items = bankOf(rng(24));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  const frame = { location: origin, parent: top };
  const key = keyOf('doc-race');
  const common = { params: PARAMS, now: time.now, map: fakeMap(items), revision: 0, guest: true };
  const waiting = acquireHost({ ...common, document: true, wait: 2000 }, frame);
  const shellHost = await acquireHost({ ...common, key, port: memoryPort() }, top);
  releaseHost(shellHost); // 틀이 깨어나기 전에 셸이 놓는다
  const frameHost = await waiting;
  assert.equal(frameHost, shellHost);
  assert.equal(top.__synkAtlasHosts.has(key), true, '틀이 쓰는 동안 호스트가 남는다');
  releaseHost(frameHost);
  assert.equal(top.__synkAtlasHosts.has(key), false);
});

test('셸이 틀이 연 호스트를 받으면 그 뒤 저장 계기도 셸의 계기에 남는다(아르곤 다시 A2)', async () => {
  const { createHealth } = await subject('health/index.mjs');
  const items = bankOf(rng(25));
  const time = clock();
  const origin = { origin: 'https://world.test' };
  const top = { location: origin };
  top.parent = top;
  let port = null;
  installHostMaker(top, {
    openPort: () => {
      port = memoryPort();
      return port;
    },
  });
  const frame = { location: origin, parent: top, addEventListener() {}, removeEventListener() {} };
  const key = keyOf('adopt-health');
  const base = { map: fakeMap(items), seed: 's', dayOffset: 0 };
  const frameHealth = createHealth();
  const shellHealth = createHealth();
  const game = createCoach({
    ...base,
    gameId: 'game',
    host: { guest: true, key, now: time.now, health: frameHealth },
    scope: frame,
  });
  await game.ready;
  const shell = createCoach({
    ...base,
    gameId: 'shell',
    host: { guest: true, key, now: time.now, health: shellHealth },
    scope: top,
  });
  await shell.ready;
  port.failNext(new Error('quota'));
  shell.present(items[0]);
  await settle();
  assert.equal(shellHealth.snapshot().save.failures, 1, '셸의 계기에 남는다');
  assert.equal(frameHealth.snapshot().save.failures, 0);
  game.dispose();
  shell.dispose();
});
