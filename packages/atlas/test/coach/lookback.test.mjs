// 30일째 문장의 수(coach.lookback — 단계 4 계획 §21-7, 설계 주인 승인 21-10의 9 · 13). 진짜 코치(손님 기록부 · 시계)로 한 달 넘게 답을
// 지어 넣고 네 조건을 넘은 단위만 내는지 본다. 판을 닫지 않은 답(아직 접히지 않은 내 답)과 같은 문서의 다른 코치가 쓴 답도 센다.
// 서버 길 계정은 null이다(제품이 서버의 돌아보기 읽기로 묻는다). 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { clock, createCoach, fakeMap, memoryPort, T0 } from './support.mjs';

const { COACH_METHODS } = await subject('coach/methods.mjs');
const { lookbackWindows } = await subject('memory/lookback.mjs');

const DAY = 86_400_000;
const HOUR = 3_600_000;
const itemOf = i =>
  Object.freeze({
    itemKey: `t.i${i}`,
    familyKey: `t.f${i}`,
    skillId: 'ko.reading.s0',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([`ko.word.u${i}`]),
    order: i,
    modality: 'reading',
  });
const ITEMS = Object.freeze([itemOf(0), itemOf(1), itemOf(2)]);
const START = T0 + 10 * HOUR; // 학습일 한가운데(UTC 11:00 — dayOffset 0)
const NOW = START + 31 * DAY; // 앞 창 = 1 · 0일째가 든 7학습일, 뒤 창 = 그다음 날부터

let stores = 0;
const keyOf = tag => `synk-atlas:lookback-${process.pid}-${tag}-${(stores += 1)}`;

async function guestCoach(
  time,
  { port = memoryPort(), key = keyOf('guest'), items = ITEMS, dayOffset = 0 } = {},
) {
  const coach = createCoach({
    gameId: 'lookback',
    map: fakeMap(items),
    seed: 's',
    dayOffset,
    host: { guest: true, port, key, now: time.now },
  });
  await coach.ready;
  return coach;
}

async function answerAt(coach, time, at, item, { correct, hint = false }) {
  time.advance(at - time.t);
  const pid = coach.present(item);
  if (hint) coach.help(pid, 'hint');
  await coach.answer(pid, { correct, assessable: true }).stored;
}

// u0: 앞 창에 놓친 자리 둘(0 · 1일째), 그 뒤 혼자 맞힌 자리 셋(10 · 20 · 30일째) — 문장을 말한다.
// u1: 앞 창에 놓친 자리 하나 — 말하지 않는다. u2: 놓친 자리 둘이지만 뒤 창에 힌트를 보고 맞힌 답 — 말하지 않는다.
async function month(coach, time) {
  const [u0, u1, u2] = ITEMS;
  for (const day of [0, 1]) {
    await answerAt(coach, time, START + day * DAY, u0, { correct: false });
    await answerAt(coach, time, START + day * DAY + HOUR, u2, { correct: false });
  }
  await answerAt(coach, time, START + 2 * HOUR, u1, { correct: false });
  for (const day of [10, 20, 30]) {
    await answerAt(coach, time, START + day * DAY, u0, { correct: true });
    await answerAt(coach, time, START + day * DAY + HOUR, u1, { correct: true });
    await answerAt(coach, time, START + day * DAY + 2 * HOUR, u2, {
      correct: true,
      hint: day === 20,
    });
  }
}

test('손님 코치는 네 조건을 넘은 단위만 그 수와 함께 낸다 — 앞 창 놓친 자리 · 뒤 창 자리 · 마지막 자리 · 근거 칸의 두 창', async () => {
  const time = clock(START);
  const coach = await guestCoach(time);
  try {
    await month(coach, time);
    time.advance(NOW - time.t);
    const out = coach.lookback({ now: NOW });
    const windows = lookbackWindows(NOW, { offset: 0 });
    assert.deepEqual(out.windows, windows, '창은 학습일(새벽 4시 · 코치의 dayOffset)로 센다');
    assert.deepEqual(
      out.month.map(row => [row.unit, row.misses, row.reviews]),
      [['ko.word.u0', 2, 3]],
    );
    const [row] = out.month;
    // 마지막 자리는 30일째 그 자리의 답 시각이다(기록부 시계가 같은 밀리초를 피해 조금 뒤로 찍을 수 있다).
    assert.ok(
      row.last >= START + 30 * DAY && row.last < START + 30 * DAY + HOUR,
      '마지막 자리는 30일째',
    );
    assert.deepEqual(row.evidence, { ...windows, misses: 2, reviews: 3, last: row.last });
    assert.ok(Object.isFrozen(out) && Object.isFrozen(out.month) && Object.isFrozen(row));
    // now를 주지 않으면 코치의 시계(지금)로 센다. 주면 그 때로 센다 — 한 주 뒤에는 앞 창이 놓친 자리를 벗어난다.
    assert.deepEqual(coach.lookback(), out);
    assert.deepEqual(coach.lookback({ now: NOW + 7 * DAY }).month, [], 'now를 주면 그 때로 센다');
  } finally {
    coach.dispose();
  }
});

test('창은 코치의 기기 시간대(dayOffset)로 센다 — 몽골(UTC+8)의 학습일 경계', async () => {
  const time = clock(START);
  const coach = await guestCoach(time, { dayOffset: 480 });
  try {
    assert.deepEqual(coach.lookback({ now: NOW }).windows, lookbackWindows(NOW, { offset: 480 }));
  } finally {
    coach.dispose();
  }
});

test('앞 창이 끝난 뒤 「이미 알아요」를 말한 단위는 고르지 않는다 — 본인 말 줄도 읽는다(검토 S4)', async () => {
  const time = clock(START);
  const coach = await guestCoach(time);
  try {
    await month(coach, time);
    time.advance(NOW - time.t);
    assert.equal(coach.lookback({ now: NOW }).month.length, 1);
    coach.tell('ko.word.u0', 'known');
    // 기록부는 저장이 끝난 사건을 든다 — 본인 말의 저장(메모리 포트)이 끝나기를 기다린다.
    await new Promise(resolve => setTimeout(resolve, 0));
    time.advance(1000);
    assert.deepEqual(coach.lookback({ now: time.t }).month, []);
  } finally {
    coach.dispose();
  }
});

test('조건을 넘은 단위가 여럿이면 단위 이름 차례로 낸다 — 기기 · 답 차례를 타지 않는다', async () => {
  const items = [itemOf(9), itemOf(1)].map((item, i) => ({ ...item, order: i }));
  const time = clock(START);
  const coach = await guestCoach(time, { items });
  try {
    for (const day of [0, 1, 10, 20, 30])
      for (const [i, item] of items.entries())
        await answerAt(coach, time, START + day * DAY + i * HOUR, item, { correct: day >= 10 });
    time.advance(NOW - time.t);
    assert.deepEqual(
      coach.lookback({ now: NOW }).month.map(row => row.unit),
      ['ko.word.u1', 'ko.word.u9'],
    );
  } finally {
    coach.dispose();
  }
});

test('판을 닫지 않은 답(아직 접히지 않은 내 답)도 센다 — 손님 요약을 다시 접기 전에도 같은 수다(카본 설계 검토 A3)', async () => {
  const time = clock(START);
  const coach = await guestCoach(time);
  try {
    await month(coach, time);
    time.advance(NOW - time.t);
    const before = coach.lookback({ now: NOW });
    await coach.finishSet({ kind: 'short' }).folded;
    assert.deepEqual(coach.lookback({ now: NOW }), before, '접은 뒤에도 같다');
    assert.equal(before.month.length, 1);
  } finally {
    coach.dispose();
  }
});

test('같은 문서의 다른 코치(판)가 쓴 답도 센다 — 기록부는 호스트 하나다', async () => {
  const time = clock(START);
  const port = memoryPort();
  const key = keyOf('shared');
  const writer = await guestCoach(time, { port, key });
  const reader = await guestCoach(time, { port, key });
  try {
    await month(writer, time);
    time.advance(NOW - time.t);
    assert.deepEqual(
      reader.lookback({ now: NOW }).month.map(row => row.unit),
      ['ko.word.u0'],
    );
  } finally {
    writer.dispose();
    reader.dispose();
  }
});

test('창이 바뀌면 다시 센다 — 한 주 뒤에는 앞 창이 놓친 자리를 벗어나 말하지 않는다', async () => {
  const time = clock(START);
  const coach = await guestCoach(time);
  try {
    await month(coach, time);
    time.advance(NOW + 7 * DAY - time.t);
    assert.deepEqual(coach.lookback({ now: NOW + 7 * DAY }).month, []);
  } finally {
    coach.dispose();
  }
});

test('서버 길 계정은 null이다 — 기기에 이틀 치만 있어 처음부터 세지 못한다', async () => {
  const time = clock(START);
  let seq = 0;
  const transport = async events => ({
    accepted: events.map(event => ({ id: event.id, seq: (seq += 1) })),
    clamped: [],
    rejected: [],
    summary: null,
    serverTime: time.t,
  });
  const coach = createCoach({
    gameId: 'lookback-account',
    map: fakeMap(ITEMS),
    seed: 's',
    dayOffset: 0,
    host: {
      guest: false,
      account: 'acct-lookback',
      revision: 1,
      key: keyOf('account'),
      port: memoryPort(),
      transport,
      now: time.now,
    },
  });
  await coach.ready;
  try {
    assert.equal(coach.lookback({ now: NOW }), null);
  } finally {
    coach.dispose();
  }
});

test('코치 메서드 목록에 lookback이 있다(입구 METHODS와 같은 목록 — 시험 loader.test가 두 목록을 견준다)', () => {
  assert.ok(COACH_METHODS.includes('lookback'));
});
