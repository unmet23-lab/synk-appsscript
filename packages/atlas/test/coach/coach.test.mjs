// 코치 3판(단계 4 계획 §3 · §11 코치 시험 1~6) — 계약, 제시 사건 칸, 두뇌와 같은 결정, 저장 실패 다시 세우기, 호스트 나누기,
// 제품 순서 문항.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import {
  answerOf,
  bankOf,
  checkEvent,
  choose,
  clock,
  createCoach,
  createLearner,
  createMemory,
  EVENT_TYPES,
  memoryPort,
  openCoach,
  PARAMS,
  present,
  record,
  STEP,
  startSession,
} from './support.mjs';

const { aimedUnit } = await subject('coach/fields.mjs');
const { PRESENTED_FIELDS_V2 } = await subject('record/events.mjs');

test('지도 없이 만든 코치는 ready가 MAP_FAILED로 거절되고, 순간 맞춤 · 오늘 · 표시 설정은 4-6b에서 지었다(reset은 4-5)', async () => {
  const bare = createCoach({});
  await assert.rejects(bare.ready, { code: 'MAP_FAILED' });
  assert.throws(() => bare.recommend([]), { code: 'NOT_READY' });
  assert.throws(() => createCoach(null), TypeError);
  // 게임 이름은 판 번호와 근거 셈이 읽는 꼴이다 — 꼴이 틀리면 만들 때 던진다(Fable 끝 판 F1 · 설계 주인 11-17 저녁 승인). 빠진 이름은 atlas다.
  for (const gameId of [
    '',
    'a..b',
    'world.',
    '.world',
    'g'.repeat(81),
    'world mock',
    '한글',
    1,
    {},
  ])
    assert.throws(() => createCoach({ gameId }), TypeError, JSON.stringify(gameId));
  for (const gameId of [
    undefined,
    'atlas',
    'world-mock',
    'world-mock.x',
    'set:1_a',
    'g'.repeat(80),
  ]) {
    const made = createCoach({ gameId });
    await assert.rejects(made.ready, { code: 'MAP_FAILED' }, String(gameId));
    made.dispose();
  }
  const time = clock();
  const { coach } = await openCoach({ items: bankOf(rng(1)), time });
  // 셸이 읽개를 넘기지 않으면 오늘 · 표시 설정은 null, 순간 맞춤은 내용 정의를 받아야 연다(test/coach/live.test.mjs가 자세히 본다).
  assert.equal(coach.today(), null);
  assert.equal(coach.presentation(), null);
  assert.throws(() => coach.live(), TypeError);
  assert.ok(Object.isFrozen(coach));
  coach.dispose();
  assert.throws(() => coach.recommend([]), { code: 'DISPOSED' });
});

test('제시 사건의 엔진 칸은 고른 줄과 같고 2판 검사를 지난다(§3-5)', async () => {
  const items = bankOf(rng(2));
  const time = clock();
  const { coach, port } = await openCoach({ items, time });
  const picked = coach.recommend(items, { set: { length: 6 } });
  assert.equal(picked.status, 'ready');
  const pid = coach.present(picked.selected);
  const rows = await port.read();
  const event = rows.map(row => row.value.event).find(e => e?.id === pid);
  assert.equal(event.type, EVENT_TYPES.presented);
  checkEvent(event);
  assert.deepEqual(event.editions, { ...PARAMS.editions, index: 'index-t' });
  assert.equal(event.arm, 'adaptive');
  assert.equal(event.reason.code, picked.why.code);
  assert.equal(event.reason.target, picked.target);
  assert.equal(event.reason.tier, picked.tier);
  assert.deepEqual(event.expected, picked.expected);
  assert.deepEqual(event.units, [...picked.selected.units]);
  assert.deepEqual(
    event.reason.introduced,
    [...picked.selected.units],
    '첫 문항의 단위는 모두 처음 낸 단위다',
  );
  assert.equal(event.firstExposure, true, '손님 기기는 기록 전체를 든다 — 만난 적 없으면 처음이다');
  assert.equal(typeof picked.why.line, 'string');
  coach.dispose();
});

// 두뇌만 돌린 판 — 코치와 같은 시각 · 같은 답.
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
    record(
      learner,
      memory,
      top.item,
      {
        correct,
        assisted: false,
        answerShown: false,
        unknown: false,
        assessable: true,
        target: top.target,
      },
      time.t + 1,
    );
    time.advance(STEP);
  }
  return out;
}

async function coachRun(items, { seed, length, steps, failAt = -1 }) {
  const time = clock();
  const { coach, port } = await openCoach({ items, time, seed });
  const out = [];
  for (let step = 0; step < steps; step += 1) {
    const picked = coach.recommend(items, step === 0 ? { set: { length } } : {});
    if (picked.status === 'none') break;
    const item = picked.selected;
    const pid = coach.present(item);
    out.push([item.itemKey, picked.tier, picked.why.code, picked.target]);
    if (step === failAt) port.failNext(new Error('quota'));
    const done = coach.answer(pid, { correct: answerOf(null, item, step), assessable: true });
    assert.equal(await done.stored, step !== failAt);
    port.heal();
    time.advance(STEP);
  }
  coach.dispose();
  return out;
}

test('저장이 다 되는 동안 코치의 결정은 두뇌만 돌린 것과 한 글자도 다르지 않다(§3-7 · 시험 3)', async () => {
  for (const seed of seedRange({ count: 12 })) {
    const items = bankOf(rng(seed));
    const options = { seed: `s${seed}`, length: 8, steps: 16 };
    assert.deepEqual(await coachRun(items, options), brainRun(items, options), `씨앗 ${seed}`);
  }
});

// 저장이 실패한 답은 없던 것이다 — 두뇌만 돌린 기준 판에서 그 걸음의 답을 적지 않은 것과 결정이 같다.
function brainRunSkipping(items, { seed, length, steps, failAt }) {
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
    if (step !== failAt) {
      const correct = answerOf(null, top.item, step);
      record(
        learner,
        memory,
        top.item,
        {
          correct,
          assisted: false,
          answerShown: false,
          unknown: false,
          assessable: true,
          target: top.target,
        },
        time.t + 1,
      );
    }
    time.advance(STEP);
  }
  return out;
}

test('답의 저장이 실패하면 판 상태까지 그 답이 없던 것처럼 다시 선다(아르곤 A5 · 시험 4)', async () => {
  for (const seed of seedRange({ count: 12 })) {
    const items = bankOf(rng(seed + 100));
    const failAt = 1 + (seed % 4);
    const options = { seed: `f${seed}`, length: 8, steps: 14, failAt };
    assert.deepEqual(
      await coachRun(items, options),
      brainRunSkipping(items, options),
      `씨앗 ${seed}`,
    );
  }
});

test('같은 저장소의 코치 둘은 기록부 하나를 나눠 쓴다 — 하루 한도가 코치를 넘어 이어진다(§3-2)', async () => {
  const items = bankOf(rng(5), { items: 30, units: 30 });
  const time = clock();
  const port = memoryPort();
  const key = `synk-atlas:test-share-${process.pid}`;
  const host = { guest: true, port, key, now: time.now };
  const map = (await import('./support.mjs')).fakeMap(items);
  const first = createCoach({ gameId: 'a', map, host, dayOffset: 0, seed: 'a' });
  const second = createCoach({ gameId: 'b', map, host, dayOffset: 0, seed: 'b' });
  await Promise.all([first.ready, second.ready]);
  const introduced = new Set();
  const shown = [];
  for (let step = 0; step < 12; step += 1) {
    const picked = first.recommend(items, step === 0 ? { set: { newLimit: 50 } } : {});
    if (picked.status !== 'ready') break;
    const pid = first.present(picked.selected);
    shown.push(picked.selected);
    for (const unit of picked.selected.units) introduced.add(unit);
    await first.answer(pid, { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  assert.ok(shown.length > 3);
  const picked = second.recommend(items, { set: { newLimit: 50 } });
  const left = PARAMS.newPerDay - introduced.size;
  if (picked.status === 'ready' && picked.tier === 2)
    assert.ok(
      picked.selected.units.filter(unit => !introduced.has(unit)).length <= left,
      '둘째 코치도 오늘 이미 낸 새 단위를 센다',
    );
  assert.equal(
    second.exposure(shown[0]).seen,
    true,
    '첫 코치가 낸 문항을 둘째 코치도 본 것으로 안다',
  );
  const families = new Set(shown.map(item => item.familyKey));
  const unseen = items.find(item => !families.has(item.familyKey));
  if (unseen) assert.equal(second.exposure(unseen).seen, false);
  first.dispose();
  second.dispose();
});

test('판 없이 present부터 불러도 판이 열리고, 제품 순서 문항은 회차 host · 겨눈 단위가 실린다(아르곤 A2 · 시험 6)', async () => {
  const items = bankOf(rng(7));
  const time = clock();
  const { coach, port } = await openCoach({ items, time });
  assert.ok(
    PRESENTED_FIELDS_V2.arm.includes('host'),
    '기록 사건 2판이 제품 순서 회차를 받는다(단계 3 d633708a7)',
  );
  const pid = coach.present(items[3]);
  const event = (await port.read()).map(row => row.value.event).find(e => e?.id === pid);
  assert.equal(event.arm, 'host');
  assert.equal(event.reason.code, 'host.order');
  assert.ok(items[3].units.includes(event.reason.target));
  coach.dispose();
});

// 한 학습자를 여러 걸음 돌리며 층 0~2인 줄마다 코치의 겨눈 단위와 choose의 값을 견준다. 견준 줄 수를 돌려준다.
function compareAims(seed) {
  const random = rng(seed);
  const items = bankOf(random);
  const memory = createMemory(PARAMS);
  const learner = createLearner(null);
  let t = clock().t;
  let checked = 0;
  startSession(learner, t, PARAMS, { length: 10, dayOffset: 0 });
  for (let step = 0; step < 24; step += 1) {
    const rows = choose(items, learner, memory, t, { params: PARAMS, seed: `a${seed}` });
    for (const row of rows.filter(row => row.tier <= 2)) {
      assert.equal(aimedUnit(row.item, learner, memory, t, PARAMS), row.target, `씨앗 ${seed}`);
      checked += 1;
    }
    const top = rows[0];
    if (!top || top.none) break;
    present(learner, { ...top, at: t });
    const answer = { correct: random() < 0.6, assisted: false, answerShown: false, unknown: false };
    record(learner, memory, top.item, { ...answer, assessable: true, target: top.target }, t + 1);
    t += step % 5 === 4 ? 3 * 86_400_000 : STEP;
  }
  return checked;
}

test('층 0~2 문항에서 코치가 채운 겨눈 단위는 choose의 값과 같다(§3-6 — 두뇌 aimOf의 정의를 옮긴 것)', () => {
  let checked = 0;
  for (const seed of seedRange({ count: 30 })) checked += compareAims(seed);
  assert.ok(checked > 100, `견준 줄 ${checked}`);
});

// 5-3 전 고침 GB3(설계 주인 11-25): 돌아온 말이 남았는데 채우기의 이유가 「오늘 돌아온 것은 다 만났어요」였다. 같은 코치의 due()가 남은
// 단위를 내는 날에는 recommend의 문장도 남은 것을 말한다(이유 종류는 idle 그대로 — 근거 칸 left).
test('돌아온 말이 남았으면 채우기의 문장이 남은 것을 말한다 — recommend의 문장과 같은 코치의 due()가 어긋나지 않는다(5-3 전 고침 GB3)', async () => {
  const DAY = 86_400_000;
  const word = (id, order, units = [`ko.word.${id.toLowerCase()}`]) =>
    Object.freeze({
      itemKey: id,
      familyKey: id,
      units,
      skillId: 'ko.reading.vocabulary',
      difficulty: 1,
      responseFormat: 'single-choice',
      order,
      modality: 'reading',
    });
  const items = [
    word('D', 0),
    word('K', 1),
    ...[1, 2, 3, 4, 5, 6].map(i => word(`N${i}`, 1 + i)),
    word('D+N7', 8, ['ko.word.d', 'ko.word.n7']),
  ];
  const byKey = new Map(items.map(item => [item.itemKey, item]));
  const time = clock();
  const { coach, port } = await openCoach({ items, time });
  const answer = async key => {
    const pid = coach.present(byKey.get(key));
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    time.advance(20_000);
  };
  try {
    await answer('D');
    coach.tell('ko.word.k', 'known');
    await new Promise(resolve => setTimeout(resolve, 0));
    time.advance(3 * DAY);
    for (let i = 1; i <= 6; i += 1) await answer(`N${i}`);
    const picked = coach.recommend([byKey.get('D+N7'), byKey.get('K')]);
    assert.deepEqual(
      coach.due().map(row => row.unit),
      ['ko.word.d'],
      '장면: 돌아온 d가 남았다',
    );
    assert.equal(picked.status, 'idle');
    assert.equal(picked.facts.limited, true, '장면: d가 든 문항은 새것 한도에 묶였다');
    assert.equal(picked.why.code, 'idle');
    assert.equal(picked.why.line, '돌아온 말은 이번 판에 여기까지예요. 남은 말은 다음에 만나요.');
    // 근거 칸 left가 든 이유도 제시 사건의 이유 검사를 지나 저장되고, 저장된 제시 사건에 그대로 실린다(앞 사슬 GA2 — 추천 결과만 보면
    // 사건에서 칸이 빠져도 지나간다).
    const pid = coach.present(picked.selected);
    assert.equal(await coach.answer(pid, { correct: true, assessable: true }).stored, true);
    const stored = (await port.read())
      .map(row => row.value?.event)
      .filter(event => event?.type === 'practice.presented')
      .at(-1);
    assert.deepEqual(
      [stored.itemKey, stored.reason.code, stored.reason.slots],
      [picked.selected.itemKey, 'idle', { left: true }],
      '저장된 제시 사건의 이유',
    );
  } finally {
    coach.dispose();
  }
});
