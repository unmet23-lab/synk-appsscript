// 판 열기 startSet(단계 4 계획 §23-6 · 설계 주인 11-19 밤): recommend 없이 present만 하는 판(정해진 차례 게임)이 판 길이를 코치에 넘긴다.
// 새것 한도는 recommend 길과 같은 3n이다. 이 코치의 판이 이미 열려 있으면 새 판을 열지 않는다 — 앞서 낸 제시가 PRESENTATION_GONE이 되지
// 않게(이야기 교실 GPT GA3). 낡은 기본 판(날이 바뀜)은 다음 제시가 어차피 새로 여니 이 판으로 연다. 규칙마다 tools/mutants/coach.mjs에 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { clock, EVENT_TYPES, openCoach } from './support.mjs';

// 문항마다 제 단위 하나 — 낸 문항 수가 곧 새로 낸 단위 수다.
const itemOf = i =>
  Object.freeze({
    itemKey: `t.s${i}`,
    familyKey: `t.s${i}`,
    skillId: 'ko.reading.s0',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([`ko.word.s${i}`]),
    order: i,
    modality: 'reading',
  });
const BANK = Array.from({ length: 9 }, (_, i) => itemOf(i));
const RIGHT = { correct: true, assessable: true };
const DAY = 25 * 3_600_000;

async function presented(port) {
  const rows = await port.read();
  return rows.map(row => row.value.event).filter(event => event?.type === EVENT_TYPES.presented);
}

test('startSet — 판을 열고 그 판 번호로 제시가 선다, 새것 한도는 판 길이의 세 배', async () => {
  const time = clock();
  const { coach, port } = await openCoach({ items: BANK, time });
  const set = coach.startSet({ length: 3 });
  assert.equal(set.opened, true);
  assert.equal(typeof set.setId, 'string');
  assert.ok(Object.isFrozen(set));
  for (const item of BANK) {
    time.advance();
    coach.present(item);
  }
  const events = await presented(port);
  assert.equal(events.length, 9);
  assert.deepEqual(
    events.map(event => event.setId),
    BANK.map(() => set.setId),
  );
  assert.deepEqual(
    events.map(event => event.reason.tier),
    BANK.map(() => events[0].reason.tier),
    '새 단위 아홉이 한도(3 × 3) 안이다 — 층 9(한도 넘음)가 없다',
  );
  assert.notEqual(events[0].reason.tier, 9);
  coach.dispose();
});

test('startSet 없이 present만 하면 기본 판의 새것 한도(6)를 넘은 문항이 층 9로 선다 — 대조', async () => {
  const time = clock();
  const { coach, port } = await openCoach({ items: BANK, time });
  for (const item of BANK) {
    time.advance();
    coach.present(item);
  }
  const tiers = (await presented(port)).map(event => event.reason.tier);
  assert.deepEqual(tiers.slice(6), [9, 9, 9]);
  assert.ok(tiers.slice(0, 6).every(tier => tier !== 9));
  coach.dispose();
});

test('startSet — 제시가 든 기본 판이 열려 있으면 새 판을 열지 않고, 앞 제시에 답할 수 있다', async () => {
  const time = clock();
  const { coach, port } = await openCoach({ items: BANK, time });
  const first = coach.present(BANK[0]);
  time.advance();
  const set = coach.startSet({ length: 4 });
  assert.equal(set.opened, false);
  const [event] = await presented(port);
  assert.equal(set.setId, event.setId, '열린 판 번호를 그대로 낸다');
  time.advance();
  assert.doesNotThrow(() => coach.answer(first, RIGHT));
  coach.dispose();
});

test('startSet — 연 판에 다시 startSet해도 새 판이 서지 않는다(길이가 달라도)', async () => {
  const time = clock();
  const { coach } = await openCoach({ items: BANK, time });
  const set = coach.startSet({ length: 3 });
  const pid = coach.present(BANK[0]);
  time.advance();
  const again = coach.startSet({ length: 6 });
  assert.deepEqual({ ...again }, { opened: false, setId: set.setId });
  time.advance();
  assert.doesNotThrow(() => coach.answer(pid, RIGHT));
  coach.dispose();
});

test('startSet — 판을 닫으면(finishSet) 다음 startSet은 새 판을 연다', async () => {
  const time = clock();
  const { coach } = await openCoach({ items: BANK, time });
  const set = coach.startSet({ length: 2 });
  coach.present(BANK[0]);
  coach.finishSet({ record: false });
  time.advance();
  const next = coach.startSet({ length: 2 });
  assert.equal(next.opened, true);
  assert.notEqual(next.setId, set.setId);
  coach.dispose();
});

test('startSet — 날이 바뀐 기본 판은 새로 열고, 연 판은 날이 바뀌어도 그대로 둔다', async () => {
  const time = clock();
  const { coach } = await openCoach({ items: BANK, time });
  coach.present(BANK[0]); // 기본 판
  time.advance(DAY);
  const fresh = coach.startSet({ length: 3 });
  assert.equal(fresh.opened, true, '낡은 기본 판은 다음 제시가 어차피 새로 연다');
  coach.present(BANK[1]);
  time.advance(DAY);
  const kept = coach.startSet({ length: 3 });
  assert.deepEqual({ ...kept }, { opened: false, setId: fresh.setId });
  coach.dispose();
});

test('startSet — 판 길이는 1 이상의 정수만 받는다', async () => {
  const time = clock();
  const { coach } = await openCoach({ items: BANK, time });
  for (const length of [0, -1, 2.5, '3', null, undefined])
    assert.throws(() => coach.startSet({ length }), TypeError, String(length));
  assert.throws(() => coach.startSet(), TypeError);
  assert.equal(coach.startSet({ length: 1 }).opened, true);
  coach.dispose();
});
