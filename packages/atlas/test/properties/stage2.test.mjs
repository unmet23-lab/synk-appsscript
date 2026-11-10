// 단계 2가 시제품에 더한 규칙의 장면(단계 2 계획 §3 · §8 — Fable 설계 검토 반영). 장면 하나가 test() 하나다.
//   ⑰ 자리 잡기 — 고른 수준의 윗 끝에서 한 칸 아래부터, 놓치면 내린다. 선행값은 고르기에만 있고 접힌 θ에는 없다.
//   ⑱ 끈질긴 단위 — 최근 창에서 예상보다 자주 놓친 단위를 가려내고, 맞힌 자리가 쌓이면 풀린다. 판 몫 · 다른 꼴 먼저 · 이유.
//   ⑲ 다시 켜도 「한 단계 올려 볼게요」 — 난도의 기준(마지막 측정 답의 난도)이 접힌 값이다.
//   ⑳ 활동 고르기 · 설정 거르기 · 접기 사건 검사.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const {
  PARAMS,
  checkFoldEvent,
  choose,
  createLearner,
  createMemory,
  filterCandidates,
  overlay,
  planActivities,
  present,
  reasonLine,
  record,
  startSession,
  stubbornCapOf,
} = await subject();
const memory = createMemory();
const DAY = 86_400_000;
const T0 = Date.parse('2026-12-01T09:00:00Z');
const WIDE = { ...PARAMS, newPerSession: 30, newPerDay: 30 };
const SKILL = 'ko.listening.detail';

const level = (d, i, extra = {}) => ({
  itemKey: `d${d}.${i}`,
  familyKey: `d${d}.${i}`,
  skillId: SKILL,
  difficulty: d,
  responseFormat: 'single-choice',
  order: 0,
  ...extra,
});
const LADDER = [1, 2, 3].flatMap(d => Array.from({ length: 10 }, (_, i) => level(d, i)));
const word = (id, i, extra = {}) => ({
  itemKey: id,
  familyKey: id,
  units: [`word:${id}`],
  skillId: 'ko.reading.vocabulary',
  difficulty: 1,
  responseFormat: 'single-choice',
  order: i,
  ...extra,
});

// 고르고 · 보이고 · 답한다. 고른 줄을 돌려준다.
function play(learner, items, correct, now, params = WIDE) {
  const row = choose(items, learner, memory, now, { params })[0];
  present(learner, row);
  record(learner, memory, row.item, { correct, target: row.target }, now, params);
  return row;
}
const walk = (learner, answers, now, items = LADDER) =>
  answers.map((correct, i) => play(learner, items, correct, now + i * 20000));

test('⑰ 자리 잡기 — 고른 수준의 윗 끝에서 한 칸 아래부터, 놓치면 내린다(선행값은 고르기에만)', () => {
  const plain = createLearner();
  startSession(plain, T0, WIDE);
  const first = walk(plain, [true, true, true, true, true], T0);
  assert.deepEqual(
    first.map(row => row.item.difficulty),
    [1, 1, 1, 1, 2],
    '수준을 고르지 않으면 난도 1부터, 넷 맞히면 오른다',
  );
  assert.equal(first[4].why.code, 'skill.up');

  const placed = createLearner();
  startSession(placed, T0, WIDE, { level: { min: 1, max: 3 } });
  assert.equal(placed.session.prior, PARAMS.difficultyLogit[3]);
  const [start, after] = walk(placed, [false, true], T0);
  assert.equal(start.item.difficulty, 2, '1~3을 고르면 윗 끝의 한 칸 아래(난도 2)부터');
  assert.equal(after.item.difficulty, 1, '첫 문항을 놓치면 한 칸 내린다');
  assert.equal(after.why.code, 'skill.ease');

  // 선행값은 접힌 θ에 들지 않는다: 같은 문항 · 같은 답을 수준 없이 받은 학습자와 능력 줄이 같다(서버는 수준을 모른다).
  const replay = createLearner();
  startSession(replay, T0, WIDE);
  [start, after].forEach((row, i) => {
    present(replay, choose([row.item], replay, memory, T0 + i * 20000, { params: WIDE })[0]);
    record(
      replay,
      memory,
      row.item,
      { correct: i === 1, target: row.target },
      T0 + i * 20000,
      WIDE,
    );
  });
  assert.deepEqual(replay.ability.get(SKILL), placed.ability.get(SKILL));
});

// 단위 하나를 날마다 제때 만난다 — grades 차례대로(놓침 again · 고르는 꼴 맞힘 weak).
function history(grades) {
  let state = null;
  let at = T0;
  for (const grade of grades) {
    state = memory.append(state, { at, grade, responseFormat: 'single-choice' });
    at += Math.max(1, Math.ceil(memory.intervalDays(state))) * DAY;
  }
  return state;
}

test('⑱ 끈질긴 단위 — 예상보다 자주 놓치면 가려내고, 맞힌 자리가 쌓이면 풀린다', () => {
  const shaky = history(['weak', 'again', 'weak', 'again', 'weak', 'again']);
  assert.equal(shaky.stubborn, true, '제때 만났는데 셋을 놓쳤다');
  assert.deepEqual(shaky.missed, ['single-choice'], '놓친 꼴을 기억한다');
  const once = history(['weak', 'weak', 'again', 'weak', 'weak']);
  assert.equal(once.stubborn, false, '한 번 놓친 것은 끈질긴 것이 아니다');
  const recovered = history([
    'weak',
    'again',
    'again',
    'again',
    ...Array(PARAMS.stubbornWindow).fill('weak'),
  ]);
  assert.equal(recovered.stubborn, false, '맞힌 자리가 창을 채우면 풀린다');
  // 같은 자리에서 맞힌 뒤 놓치면 창의 마지막 칸도 놓침으로 고쳐진다(처음부터 접은 것과 같다)
  const rows = [
    { at: T0, grade: 'weak' },
    { at: T0 + DAY, grade: 'weak' },
    { at: T0 + DAY + 600_000, grade: 'again', responseFormat: 'cup-compose' },
  ];
  const folded = memory.fold(rows);
  assert.deepEqual(
    folded.recent.map(cell => cell.m),
    [1],
  );
  assert.deepEqual(folded.missed, ['cup-compose']);
});

// 끈질긴 단위 셋과 보통 단위 셋이 모두 돌아온 날의 판.
function stubbornDay() {
  const learner = createLearner();
  const hard = ['h0', 'h1', 'h2'];
  const easy = ['e0', 'e1', 'e2'];
  for (const id of hard)
    learner.memory.set(`word:${id}`, history(['weak', 'again', 'weak', 'again', 'weak', 'again']));
  for (const id of easy) learner.memory.set(`word:${id}`, history(['weak', 'weak', 'weak']));
  const now = Math.max(...[...learner.memory.values()].map(s => s.lastAt)) + 40 * DAY;
  const items = [
    ...hard.flatMap((id, i) => [
      word(id, i),
      word(`${id}.c`, i, { units: [`word:${id}`], responseFormat: 'cup-compose' }),
    ]),
    ...easy.map((id, i) => word(id, 10 + i)),
  ];
  return { learner, now, items };
}

test('⑱ 끈질긴 단위 — 한 판의 몫을 넘기지 않고, 놓친 적 없는 꼴을 먼저 내고, 남은 것이 그것뿐이면 그렇게 말한다', () => {
  const { learner, now, items } = stubbornDay();
  assert.equal(stubbornCapOf({ length: 10 }), 2);
  startSession(learner, now, PARAMS, { length: 10 });
  const shown = [];
  let last = null;
  for (let i = 0; i < 10; i += 1) {
    const rows = choose(items, learner, memory, now + i * 20000);
    last = rows[0];
    if (last.none || last.idle) break;
    shown.push(last);
    present(learner, last);
    record(learner, memory, last.item, { correct: true, target: last.target }, now + i * 20000);
  }
  const stubborn = shown.filter(row => row.tier === 1 && row.stubborn);
  assert.equal(stubborn.length, 2, '판 길이 10이면 끈질긴 단위는 둘까지');
  assert.ok(
    stubborn.every(row => row.item.responseFormat === 'cup-compose'),
    '놓친 적 없는 꼴(조립)을 먼저 낸다',
  );
  assert.equal(
    shown.filter(row => row.tier === 1 && !row.stubborn).length,
    3,
    '보통 단위는 그대로 다 낸다',
  );
  assert.ok(last.idle, '남은 할 것이 미룬 끈질긴 단위뿐이다');
  assert.equal(last.why.code, 'pace.stubborn');
  assert.match(reasonLine(last.why), /자꾸 놓치는 말/);
});

test('⑱ 끈질긴 단위 — 놓친 직후의 「다시」는 몫에 세지도 막지도 않는다', () => {
  const { learner, now, items } = stubbornDay();
  startSession(learner, now, PARAMS, { length: 5 }); // 몫 1
  const first = choose(items, learner, memory, now)[0];
  assert.ok(first.stubborn && first.tier === 1);
  present(learner, first);
  record(learner, memory, first.item, { correct: false, target: first.target }, now);
  const filler = items.filter(item => !item.units[0].startsWith(first.target));
  for (let i = 1; i <= 2; i += 1) {
    const row = choose(filler, learner, memory, now + i * 20000)[0];
    present(learner, row);
    record(learner, memory, row.item, { correct: true, target: row.target }, now + i * 20000);
  }
  const again = choose(items, learner, memory, now + 60000)[0];
  assert.equal(again.tier, 0, '몫을 다 썼어도 방금 놓친 끈질긴 단위는 다시 낸다');
  assert.equal(again.target, first.target);
  assert.equal(learner.session.stubbornServed, 1);
});

test('⑲ 다시 켜도 「한 단계 올려 볼게요」 — 난도의 기준이 접힌 값이다', () => {
  const learner = createLearner();
  startSession(learner, T0, WIDE);
  walk(learner, [true, true, true, true], T0);
  // 앱을 다시 켰다: 요약(기억 · 능력 · 만난 표)만 남고 판 상태는 없다
  const summary = { memory: learner.memory, ability: learner.ability, met: learner.met };
  const restarted = createLearner(summary);
  startSession(restarted, T0 + 3_600_000, WIDE);
  const next = choose(LADDER, restarted, memory, T0 + 3_600_000, { params: WIDE })[0];
  assert.equal(next.item.difficulty, 2);
  assert.equal(next.why.code, 'skill.up');
  assert.equal(next.why.slots.streak, 4);
  assert.equal(next.why.slots.from, 1);
});

test('⑳ 활동 고르기 — 사실이 순위를 앞지르고, 그다음은 할 것이 있는 활동이며, 학습자를 바꾸지 않는다', () => {
  const learner = createLearner();
  startSession(learner, T0, WIDE);
  walk(learner, [true, true], T0, [word('a', 0), word('b', 1)]);
  const before = JSON.stringify([
    ...learner.memory.keys(),
    learner.shown.length,
    learner.log.length,
  ]);
  const fresh = { id: 'lesson', candidates: [word('c', 2), word('d', 3)] };
  const known = { id: 'review', candidates: [word('a', 0), word('b', 1)] };
  const hangul = { id: 'hangul', candidates: [word('a', 0)], facts: { prerequisite: true } };
  const shut = { id: 'locked', candidates: [word('e', 4)], facts: { locked: true } };
  const plan = planActivities([shut, known, fresh, hangul], learner, memory, T0 + 120_000, {
    params: WIDE,
  });
  assert.deepEqual(
    plan.map(entry => entry.id),
    ['hangul', 'lesson', 'review', 'locked'],
  );
  assert.equal(plan[0].why.code, 'host.prerequisite');
  assert.equal(plan[1].why.code, 'unit.new');
  assert.ok(plan[2].idle, '방금 다 맞힌 복습은 할 것이 없다');
  assert.equal(
    JSON.stringify([...learner.memory.keys(), learner.shown.length, learner.log.length]),
    before,
  );
  // 판이 열려 있지 않아도 학습자에 판을 열지 않는다
  const closed = createLearner();
  planActivities([fresh], closed, memory, T0);
  assert.equal(closed.session, null);
});

test('⑳ 설정 거르기 — 소리 없는 자리 · 「지금은 아니에요」를 후보에서 뺀다', () => {
  const items = [
    word('a', 0, { audioRequired: true }),
    word('b', 1, { topic: 'cafe' }),
    word('c', 2),
    word('d', 3),
  ];
  const kept = filterCandidates(items, { audio: false, notNow: ['cafe', 'word:d'] });
  assert.deepEqual(
    kept.map(item => item.itemKey),
    ['c'],
  );
  assert.equal(filterCandidates(items).length, 4);
});

test('⑳ 접기 사건 검사 — 꼴이 어긋나면 접기 전에 던진다', () => {
  const item = level(1, 0);
  assert.ok(checkFoldEvent({ kind: 'answer', id: 'e1', at: T0, item, answer: { correct: true } }));
  assert.ok(checkFoldEvent({ kind: 'carry', id: 'e2', at: T0, families: ['f'] }));
  assert.ok(checkFoldEvent({ kind: 'exclude', id: 'e3', at: T0, ref: 'e1' }));
  for (const bad of [
    {
      kind: 'answer',
      id: 'e1',
      at: T0,
      item: { ...item, difficulty: 4 },
      answer: { correct: true },
    },
    { kind: 'answer', id: 'e1', at: Number.NaN, item, answer: { correct: true } },
    { kind: 'say', id: 'e1', at: T0, unit: 'word:a', say: 'maybe' },
    { kind: 'exclude', id: 'e1', at: T0, ref: 'e0', touches: { units: 'word:a' } },
    { kind: 'decision', id: 'e1', at: T0 },
  ])
    assert.throws(() => checkFoldEvent(bad), TypeError);
});

test('⑳ 기기 얹기 — 요약 met의 null(JSON으로 내려온 −∞)을 −∞와 같게 읽고, 색인 없이 밀린 장부는 얹지 않는다', () => {
  const item = level(1, 50);
  const answer = { kind: 'answer', id: 'q2', at: T0 + 1000, item, answer: { correct: true } };
  const view = met =>
    overlay(
      { memory: new Map(), ability: new Map(), met: new Map([[item.familyKey, met]]) },
      [answer],
      memory,
      PARAMS,
      { familySkills: new Map([[item.familyKey, [SKILL]]]) },
    );
  const fromJson = view(null);
  const native = view(Number.NEGATIVE_INFINITY);
  assert.deepEqual(fromJson.ability.get(SKILL), native.ability.get(SKILL));
  assert.deepEqual([...fromJson.waitSkills], [...native.waitSkills]);
  assert.equal(native.ability.get(SKILL).n, 0, '장부에 든 계열의 답은 측정 답이 아니다');
  const carry = { kind: 'carry', id: 'c1', at: T0 + 2000, families: [item.familyKey] };
  const summary = { memory: new Map(), ability: new Map(), met: new Map() };
  assert.equal(overlay(summary, [carry], memory, PARAMS).waitAll, true, '색인이 없으면 기다린다');
  assert.equal(
    overlay(summary, [carry], memory, PARAMS, { familySkills: new Map() }).waitAll,
    false,
  );
});
