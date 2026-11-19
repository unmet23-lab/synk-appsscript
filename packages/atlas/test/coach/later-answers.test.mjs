// 같은 제시의 뒤 답(단계 4 계획 §23-5 · 설계 주인 11-19): 두뇌 판 상태(낸 문항 · 이어서 놓친 수 · 「다시」 · 만난 단위 · blank)는 제시마다
// 첫 판정 답만 움직인다. 뒤 답(고쳐 다시 서빙 · 다시 놓기 · 맞힐 때까지)은 기억으로만 간다. 가르는 기준은 「이 제시에 이미 판정한 답이
// 있는가」다 — 판정 못 한 첫 답 뒤의 답은 첫 판정 답이다. 판 일지를 다시 세울 때도 같은 표가 선다.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clock,
  createLearner,
  createMemory,
  openCoach,
  PARAMS,
  record,
  startSession,
  T0,
} from './support.mjs';

const itemOf = (unit, variant, order) =>
  Object.freeze({
    itemKey: `t.${unit}.${variant}`,
    familyKey: `t.${unit}.${variant}`,
    skillId: 'ko.reading.s0',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([`ko.word.${unit}`]),
    order,
    modality: 'reading',
  });
// 단위마다 문항 둘 — 놓친 단위가 다른 문항으로 돌아올 수 있다.
const UNITS = ['u0', 'u1', 'u2', 'u3', 'u4', 'u5'];
const BANK = UNITS.flatMap((unit, i) => [itemOf(unit, 'a', i * 2), itemOf(unit, 'b', i * 2 + 1)]);

const WRONG = { correct: false, assessable: true };
const RIGHT = { correct: true, assessable: true };
const SKIP = { correct: null, assessable: false };

function brain(answers, { pid = 'p1' } = {}) {
  const memory = createMemory();
  const learner = createLearner();
  startSession(learner, T0, PARAMS, { length: 6 });
  const item = BANK[0];
  let at = T0;
  for (const answer of answers) {
    at += 5_000;
    record(
      learner,
      memory,
      item,
      { ...answer, ...(pid ? { presentationId: pid } : {}) },
      at,
      PARAMS,
    );
  }
  return { learner, unit: item.units[0], item };
}

test('두뇌 — 틀림 → 맞음(같은 제시): 「다시」가 남고 낸 문항은 한 줄이다', () => {
  const { learner, unit } = brain([WRONG, RIGHT]);
  const s = learner.session;
  assert.equal(s.retries.get(unit)?.pending, true);
  assert.equal(s.missStreak, 1);
  assert.equal(learner.shown.length, 1);
  assert.ok(s.met.has(unit));
  // 뒤 답도 기억에는 간다 — 같은 자리 규칙으로 그 자리는 놓침이다.
  assert.ok(learner.memory.get(unit));
});

test('두뇌 — 틀림 셋(같은 제시): 이어서 놓친 수 1 · 「다시」 한 자리', () => {
  const { learner, unit } = brain([WRONG, WRONG, WRONG]);
  assert.equal(learner.session.missStreak, 1);
  assert.equal(learner.session.retries.get(unit)?.tries, 0);
  assert.equal(learner.shown.length, 1);
});

test('두뇌 — 건너뜀 → 맞음: 맞음이 첫 판정 답으로 판을 움직인다', () => {
  const { learner, unit, item } = brain([SKIP, RIGHT]);
  const s = learner.session;
  assert.ok(s.met.has(unit), '맞음이 만난 단위를 적는다');
  assert.ok(s.blank.has(item.itemKey), '건너뛴 문항은 이 판에서 다시 내지 않는다');
  assert.equal(s.missStreak, 0);
  assert.equal(learner.shown.length, 1);
});

test('두뇌 — 건너뜀 → 틀림 → 맞음: 틀림만 판을 움직인다', () => {
  const { learner, unit } = brain([SKIP, WRONG, RIGHT]);
  assert.equal(learner.session.retries.get(unit)?.pending, true);
  assert.equal(learner.session.missStreak, 1);
  assert.equal(learner.shown.length, 1);
});

test('두뇌 — 제시 번호가 없는 답은 늘 첫 답이다(가상 학습자 · 옛 부름 그대로)', () => {
  const { learner, unit } = brain([WRONG, RIGHT], { pid: null });
  assert.equal(learner.session.retries.get(unit)?.pending, false);
  assert.equal(learner.shown.length, 2);
});

// 판 길이 6에서 다음 문항 셋의 단위 — 놓친 단위가 다른 문항으로 돌아오는가.
async function nextUnits(coach, time, n = 3) {
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    time.advance(20_000);
    const r = coach.recommend(BANK, { set: { length: 6 } });
    if (r.status !== 'ready') break;
    rows.push(r.selected);
    const p = coach.present(r.selected);
    time.advance(3_000);
    await coach.answer(p, RIGHT).stored;
  }
  return rows;
}

async function missedThenRight() {
  const time = clock(T0);
  const { coach } = await openCoach({ items: BANK, time });
  const first = coach.recommend(BANK, { set: { length: 6 } });
  const pid = coach.present(first.selected);
  time.advance(5_000);
  const wrong = coach.answer(pid, { ...WRONG, attemptNo: 1 });
  await wrong.stored;
  time.advance(5_000);
  await coach.answer(pid, { ...RIGHT, attemptNo: 2 }).stored;
  return { coach, time, first: first.selected, wrong };
}

test('코치 — 틀림 → 맞음(같은 제시) 뒤 그 단위가 이 판에서 다른 문항으로 돌아온다', async () => {
  const { coach, time, first } = await missedThenRight();
  const rows = await nextUnits(coach, time);
  const back = rows.find(item => item.units[0] === first.units[0]);
  assert.ok(back, `놓친 단위 ${first.units[0]}가 돌아오지 않았다: ${rows.map(i => i.itemKey)}`);
  assert.notEqual(back.itemKey, first.itemKey);
  coach.dispose();
});

test('코치 — 판을 다시 세워도(다른 답 제외) 같은 표가 선다', async () => {
  const { coach, time, first } = await missedThenRight();
  // 다른 제시의 답 하나를 내고 그 답을 제외한다 — 판 일지를 다시 돌린다.
  time.advance(20_000);
  const other = BANK.find(item => item.units[0] !== first.units[0]);
  const p = coach.present(other);
  time.advance(3_000);
  const made = coach.answer(p, RIGHT);
  await made.stored;
  coach.exclude(made.eventId);
  const rows = await nextUnits(coach, time);
  assert.ok(rows.some(item => item.units[0] === first.units[0]));
  coach.dispose();
});

test('코치 — 첫 틀림을 제외하면 뒤 맞음이 첫 판정 답이 된다', async () => {
  const { coach, time, first, wrong } = await missedThenRight();
  coach.exclude(wrong.eventId);
  const rows = await nextUnits(coach, time, 4);
  assert.ok(
    !rows.some(item => item.units[0] === first.units[0]),
    '제외된 틀림이 「다시」를 남겼다',
  );
  coach.dispose();
});
