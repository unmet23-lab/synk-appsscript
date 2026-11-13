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
  applyOwn,
  checkFoldEvent,
  choose,
  createLearner,
  createMemory,
  filterCandidates,
  foldServer,
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
// 학습자 전체(기억 · 능력 · 만남 · 판 · 하루 · 기록)를 값까지 글로 — 표와 모음도 펼친다(GPT 끝 판 GD2: 열쇠와 길이만 보면
// 판 상태나 기억 값을 덮어써도 통과한다).
const snapshot = learner =>
  JSON.stringify(learner, (_, value) =>
    value instanceof Map || value instanceof Set ? [...value] : value,
  );

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
  const before = snapshot(learner);
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
    snapshot(learner),
    before,
    '학습자의 기억 · 능력 · 판 · 하루 · 기록을 값까지 바꾸지 않는다',
  );
  // 판이 열려 있지 않아도 학습자에 판을 열지 않는다
  const closed = createLearner();
  planActivities([fresh], closed, memory, T0);
  assert.equal(closed.session, null);
});

// 숙제 · 관심은 목표다 — 앞지르지 않고 같은 층 안에서 맞춘 목표 수로 차례를 정한다(지금 Core 순위, 단계 4 Fable 설계 P2-4 · 조율 11-11).
test('⑳ 활동 고르기 — 목표(숙제 · 관심)는 층을 앞지르지 않고 같은 층 안에서 앞선다, 목표 수가 같으면 할 것의 수', () => {
  const learner = createLearner();
  startSession(learner, T0, WIDE);
  walk(learner, [false], T0, [word('a', 0)]); // 「a」를 놓쳤다 — 같은 판에서 다시 낼 차례
  walk(learner, [true, true], T0 + 40_000, [word('b', 1), word('c', 2)]);
  const now = T0 + 200_000;
  const homework = { kind: 'homework', skill: 'ko.reading.vocabulary', status: 'missed' };
  const plan = activities =>
    planActivities(activities, learner, memory, now, { params: WIDE }).map(e => e.id);
  // ① 숙제 + 돌아온 복습(방금 놓친 것) — 복습이 앞이다
  const retry = { id: 'retry', candidates: [word('a2', 3, { units: ['word:a'] })] };
  const hw = { id: 'homework', candidates: [word('h1', 4)], facts: { goals: [homework] } };
  assert.deepEqual(plan([hw, retry]), ['retry', 'homework'], '숙제가 놓친 것을 앞지르지 않는다');
  // ② 같은 층(새것)이면 숙제가 비숙제 앞 — 할 것이 더 많아도
  const lesson = { id: 'lesson', candidates: [word('n1', 5), word('n2', 6), word('n3', 7)] };
  assert.deepEqual(plan([lesson, hw]), ['homework', 'lesson']);
  const top = planActivities([lesson, hw], learner, memory, now, { params: WIDE })[0];
  assert.equal(top.why.code, 'host.homework', '새것뿐인 숙제 활동은 숙제 문장');
  assert.deepEqual(top.why.slots, { skill: 'ko.reading.vocabulary', status: 'missed' });
  assert.deepEqual(top.why.evidence, {
    fact: 'homework',
    skill: 'ko.reading.vocabulary',
    status: 'missed',
  });
  // ③ 관심 + 급한 것 — 급한 것이 앞, 관심 활동의 이유는 그 주제
  const interest = {
    id: 'interest',
    candidates: [word('i1', 8)],
    facts: { goals: [{ kind: 'interest', topic: 'cafe' }] },
  };
  const ranked = planActivities([interest, retry], learner, memory, now, { params: WIDE });
  assert.deepEqual(
    ranked.map(e => e.id),
    ['retry', 'interest'],
  );
  assert.equal(ranked[1].why.code, 'goal.match');
  assert.deepEqual(ranked[1].why.slots, { topic: 'cafe' });
  // 숙제의 상태(review · missed)를 모르면 숙제 문장을 짓지 않는다 — 관심 · 엔진의 이유로 넘기고, 목표 수에는 센다(조율 11-11 P3)
  const unsure = { kind: 'homework', skill: 'ko.reading.vocabulary' };
  const vague = { id: 'vague', candidates: [word('v1', 4)], facts: { goals: [unsure] } };
  const [vagueTop] = planActivities([vague, lesson], learner, memory, now, { params: WIDE });
  assert.equal(vagueTop.id, 'vague', '목표 수에는 센다');
  assert.equal(vagueTop.why.code, 'unit.new', '숙제 문장 대신 엔진의 이유');
  const mixed = { ...vague, facts: { goals: [unsure, { kind: 'interest', topic: 'cafe' }] } };
  assert.equal(
    planActivities([mixed], learner, memory, now, { params: WIDE })[0].why.code,
    'goal.match',
    '관심이 있으면 관심 문장',
  );
  // ④ 목표 수가 같으면 할 것의 수 — 같은 목표를 두 번 넘겨도 하나로 센다
  const one = { id: 'a-one', candidates: [word('o1', 9)], facts: { goals: [homework, homework] } };
  const many = {
    id: 'b-many',
    candidates: [word('m1', 10), word('m2', 11)],
    facts: { goals: [{ kind: 'interest', topic: 'cafe' }] },
  };
  assert.deepEqual(plan([one, many]), ['b-many', 'a-one']);
  // 돌아온 복습 활동에 숙제가 걸려도 이유는 엔진의 더 구체적인 말(다시)이다
  const both = { ...retry, facts: { goals: [homework] } };
  assert.equal(
    planActivities([both], learner, memory, now, { params: WIDE })[0].why.code,
    'unit.retry',
  );
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

test('⑳ 기기 얹기 — 이번 얹기에서 내 앞 사건이 첫 만남을 정한 계열은 같은 시각의 내 답도 얹고(서버와 같은 값), 요약의 첫 만남과 같은 시각이면 기다린다', () => {
  const item = level(1, 60);
  const answer = (id, at, extra = {}) => ({
    kind: 'answer',
    id,
    at,
    item: { ...item, ...extra },
    answer: {
      correct: true,
      assisted: false,
      answerShown: false,
      unknown: false,
      assessable: true,
    },
  });
  const empty = { memory: new Map(), ability: new Map(), met: new Map() };
  const index = { familySkills: new Map([[item.familyKey, [SKILL]]]) };
  // 같은 시각의 내 장부 만남(단계 3 priorOf — 앞선 노출) 뒤 내 답.
  const prior = { kind: 'carry', id: 'q1~', at: T0, families: [item.familyKey], after: T0 };
  const own = [prior, answer('q1', T0)];
  const view = overlay(empty, own, memory, PARAMS, index);
  assert.deepEqual([...view.waitSkills], [], '기다리지 않는다');
  assert.deepEqual(view.ability.get(SKILL), foldServer(own, memory, PARAMS).ability.get(SKILL));
  // 같은 시각의 내 앞 답(같은 계열 · 다른 능력 — 같은 능력이면 「그 줄의 마지막 사건보다 뒤」 규칙이 따로 기다린다) 뒤 내 답.
  const other = 'ko.reading.detail';
  const both = { familySkills: new Map([[item.familyKey, [SKILL, other]]]) };
  const twice = [answer('q1', T0), answer('q2', T0, { itemKey: 'other', skillId: other })];
  const second = overlay(empty, twice, memory, PARAMS, both);
  const server = foldServer(twice, memory, PARAMS);
  assert.deepEqual([...second.waitSkills], []);
  for (const skill of [SKILL, other])
    assert.deepEqual(second.ability.get(skill), server.ability.get(skill), skill);
  // 반대 — 요약의 첫 만남(다른 기기)과 같은 시각이면 내 답은 첫 만남을 바꿀 수 있어 기다린다. 색인이 없으면 답마다 그 능력을.
  const summary = { memory: new Map(), ability: new Map(), met: new Map([[item.familyKey, T0]]) };
  const pair = [answer('q1', T0), answer('q2', T0, { itemKey: 'other', skillId: other })];
  const waited = overlay(summary, pair, memory, PARAMS, { familySkills: new Map() });
  assert.deepEqual(
    [...waited.waitSkills].sort(),
    [other, SKILL].sort(),
    '두 답의 능력 모두 기다린다',
  );
});

// ㉑ 끝 판 GPT 보충 검수(11-11)가 짚은 셋 — 모두 기다리는 보기 · 판 안에서 넘어간 하루 · 숨 고르기가 맨 앞인 활동.
const said = (id, at, item, correct = true) => ({
  kind: 'answer',
  id,
  at,
  item,
  answer: {
    correct,
    assisted: false,
    answerShown: false,
    unknown: false,
    assessable: true,
    target: item.units[0],
  },
});

test('⑳ 기기 얹기 — 아무것도 얹지 못하게 되면(닿는 줄 모르는 제외) 이번 얹기에서 정한 첫 만남 표(mine)도 비운다 — 판 사본에서 요약의 첫 만남과 같은 시각의 답은 기다린다(카본 끝 판 둘째 E4)', () => {
  const item = level(1, 60, { units: ['u.e4'] });
  const other = 'ko.reading.detail';
  const sibling = { ...item, itemKey: 'other', skillId: other }; // 같은 계열 · 다른 능력
  const summary = { memory: new Map(), ability: new Map(), met: new Map([[item.familyKey, T0]]) };
  const index = { familySkills: new Map() }; // 색인이 그 계열을 모른다 — 답마다 그 능력만 기다린다
  // 내 앞 답(요약의 첫 만남보다 이름 — 첫 만남을 내 쪽으로 정한다) 뒤 닿는 줄을 모르는 제외 — 아무것도 얹지 못한다
  const own = [
    said('p1', T0 - 60_000, item),
    { kind: 'exclude', id: 'x1', at: T0 - 30_000, ref: 'gone' },
  ];
  const view = overlay(summary, own, memory, PARAMS, index);
  assert.equal(view.waitAll, true);
  assert.equal(view.met.get(item.familyKey), T0, '만남 표는 요약 값으로');
  assert.equal(view.mine.size, 0, '이번 얹기의 첫 만남 표도 비운다 — met과 한 몸');
  // 판 사본(코치 copyView — waitAll을 끄고 표를 옮김)
  const copy = {
    ...view,
    waitAll: false,
    memory: new Map(view.memory),
    ability: new Map(view.ability),
    met: new Map(view.met),
    waitUnits: new Set(view.waitUnits),
    waitSkills: new Set(view.waitSkills),
    mine: new Set(view.mine),
  };
  applyOwn(copy, said('p2', T0, sibling), memory, PARAMS, index);
  assert.ok(
    copy.waitSkills.has(other),
    '요약의 첫 만남과 같은 시각의 답은 첫 만남을 바꿀 수 있어 기다린다',
  );
});

test('㉑ 아무것도 얹지 못하는 보기(waitAll)에는 뒤에 오는 내 사건도 얹지 않는다 — 판 상태가 쓸 판정만 돌려준다(GA1)', () => {
  const a = word('wa', 0);
  const b = word('wb', 1);
  const summary = foldServer([said('s1', T0, a)], memory, PARAMS);
  // 이미 접힌 사건을 거두는데 부모도 닿는 줄도 모른다 → 모두 기다림
  const view = overlay(
    summary,
    [{ kind: 'exclude', id: 'x1', at: T0 + 1000, ref: 'gone' }],
    memory,
    PARAMS,
    {
      familySkills: new Map(),
    },
  );
  assert.equal(view.waitAll, true);
  const helped = applyOwn(
    view,
    { kind: 'help', id: 'h1', at: T0 + 20 * 60_000, item: a },
    memory,
    PARAMS,
  );
  const answered = applyOwn(view, said('s2', T0 + 30 * 60_000, b), memory, PARAMS);
  const told = applyOwn(
    view,
    { kind: 'say', id: 'k1', at: T0 + 40 * 60_000, unit: 'word:wa', say: 'known' },
    memory,
    PARAMS,
  );
  assert.deepEqual(
    view.ability.get('ko.reading.vocabulary'),
    summary.ability.get('ko.reading.vocabulary'),
    '능력 줄은 요약 값 그대로',
  );
  assert.deepEqual(
    view.memory.get('word:wa'),
    summary.memory.get('word:wa'),
    '본인 말도 얹지 않는다',
  );
  assert.equal(view.memory.has('word:wb'), false, '새 답도 얹지 않는다');
  assert.equal(view.met.has(b.familyKey), false, '만남도 적지 않는다');
  assert.deepEqual(helped, { grade: null, lead: false });
  assert.deepEqual(answered, { grade: 'weak', lead: true, credited: ['word:wb'] });
  assert.deepEqual(told, {});
});

test('㉑ 판이 열린 채 새벽 4시를 넘으면 새 하루의 한도로 센다 — 고르기는 학습자를 바꾸지 않고, 낼 때 갈아 끼운다(GB1)', () => {
  const P = { ...PARAMS, newPerSession: 100, newPerDay: 3 };
  const night = Date.parse('2026-12-02T03:40:00Z'); // 현지(offset 0) 03:40
  const items = Array.from({ length: 8 }, (_, i) => word(`n${i}`, i));
  const learner = createLearner();
  startSession(learner, night, P, { dayOffset: 0, length: 100 });
  for (let k = 0; k < 3; k += 1) play(learner, items, true, night + k * 60_000, P);
  const late = night + 2 * 60_000 + 20_000;
  const spent = choose(items, learner, memory, late, { params: P })[0];
  assert.equal(spent.tier >= 3 && spent.idle, true, '그날 새 셋을 다 써서 할 것이 없다');
  const dawn = Date.parse('2026-12-02T04:05:00Z');
  const before = learner.day;
  const top = choose(items, learner, memory, dawn, { params: P })[0];
  assert.equal(top.tier, 2, '새 하루에는 새것을 낸다');
  assert.equal(learner.day, before, '고르기는 하루를 갈아 끼우지 않는다');
  present(learner, top, P);
  assert.notEqual(learner.day.key, before.key, '낼 때 새 하루로 갈아 끼운다');
  assert.deepEqual([...learner.day.introduced], top.brandNew, '새 하루에는 방금 낸 것만 센다');
});

test('㉒ 「더 배우기」 판으로 하루 새 단위가 한도를 넘은 날에도 새 단위가 없는 문항은 낸다 — 한도는 새로 셀 단위가 든 문항만 막는다(설계 §3-5, 4-1 화면 Fable 5.2 최종 P1)', () => {
  const P = { ...PARAMS, newPerSession: 100, newPerDay: 3 };
  const items = Array.from({ length: 8 }, (_, i) => word(`m${i}`, i));
  const learner = createLearner();
  startSession(learner, T0, P, { dayOffset: 0, length: 100 });
  for (let k = 0; k < 3; k += 1) play(learner, items, true, T0 + k * 60_000, P);
  // 「더 배우기」 판 — 하루 한도를 넘겨 새 단위 둘을 더 낸다
  startSession(learner, T0 + 10 * 60_000, P, { dayOffset: 0, length: 100, more: true });
  for (let k = 0; k < 2; k += 1) play(learner, items, true, T0 + (11 + k) * 60_000, P);
  assert.equal(learner.day.introduced.size, 5, '그날 새 단위가 한도(3)를 넘었다');
  // 보통 판 — 이미 만난 문항(새 단위 없음)은 낼 수 있고, 새 단위가 든 문항만 막힌다
  startSession(learner, T0 + 20 * 60_000, P, { dayOffset: 0, length: 100 });
  const rows = choose(items, learner, memory, T0 + 21 * 60_000, { params: P });
  const seen = new Set(['m0', 'm1', 'm2', 'm3', 'm4']);
  const top = rows[0];
  assert.equal(top.none, false, '낼 문항이 있다');
  assert.ok(seen.has(top.item.itemKey), `만난 문항을 낸다(${top.item.itemKey})`);
  assert.deepEqual(top.brandNew, []);
  for (const row of rows.filter(r => !seen.has(r.item.itemKey)))
    assert.equal(row.tier, 9, `새 단위 문항 ${row.item.itemKey}는 막힌다`);
});

test('㉑ 숨 고르기가 맨 앞인 활동은 그 뒤 줄의 층으로 순위를 매긴다 — 할 것이 있는 활동이 채우기 활동 뒤로 가지 않는다(GB2)', () => {
  const HOUR = 3_600_000;
  const known = word('kk', 0);
  const faded = word('ff', 1);
  const learner = createLearner();
  for (const [item, at] of [
    [faded, T0 - 6 * DAY],
    [faded, T0 - 2 * DAY],
    [known, T0 - 3 * DAY],
    [known, T0 - 2 * DAY],
    [known, T0 - 7 * HOUR],
  ]) {
    learner.session = null;
    startSession(learner, at, WIDE);
    record(learner, memory, item, { correct: true, target: item.units[0] }, at, WIDE);
  }
  learner.session = null;
  startSession(learner, T0, WIDE);
  learner.session.missStreak = 2; // 이 판에서 이어서 둘 놓쳤다
  const lesson = [word('nn', 5), known];
  const rows = choose(lesson, learner, memory, T0, { params: WIDE });
  assert.equal(rows[0].breather, true, '맨 앞은 숨 고르기');
  assert.equal(rows[1].tier, 2, '그 뒤는 새것');
  const warm = choose([faded], learner, memory, T0, { params: WIDE })[0];
  assert.equal(
    warm.tier < rows[0].tier && warm.idle,
    true,
    '다른 활동은 할 것 없는 채우기(숨 고르기 줄보다 앞 층)',
  );
  const plan = planActivities(
    [
      { id: 'warm', candidates: [faded] },
      { id: 'lesson', candidates: lesson },
    ],
    learner,
    memory,
    T0,
    { params: WIDE },
  );
  assert.deepEqual(
    plan.map(entry => [entry.id, entry.tier]),
    [
      ['lesson', 2],
      ['warm', warm.tier],
    ],
  );
});

test('㉑ 판정 못 한 답(도움을 받았어도)을 거두는 제외 — 서버의 능력 줄 · 첫 만남이 그대로라 기기는 기다리지 않고 서버와 같다(단계 4 A3)', () => {
  const SKILL_V = 'ko.reading.vocabulary';
  const a = word('xa', 0);
  const b = word('xb', 1);
  const unjudged = { assessable: false, correct: null };
  for (const extra of [
    { ...unjudged, assisted: true },
    { ...unjudged, answerShown: true },
    unjudged,
  ]) {
    const first = said('y0', T0, b);
    const help = {
      ...said('y1', T0 + 60_000, a),
      answer: { ...said('y1', T0, a).answer, ...extra },
    };
    const after = said('y2', T0 + 120_000, b);
    const events = [first, help, after];
    const drop = { kind: 'exclude', id: 'yx', at: T0 + 180_000, ref: 'y1' };
    const before = foldServer(events, memory, PARAMS);
    const server = foldServer([...events, drop], memory, PARAMS);
    assert.deepEqual(server.ability.get(SKILL_V), before.ability.get(SKILL_V), '능력 줄은 그대로');
    assert.deepEqual([...server.met], [...before.met], '첫 만남도 그대로');
    const view = overlay(before, [drop], memory, PARAMS, {
      familySkills: new Map([
        ['xa', [SKILL_V]],
        ['xb', [SKILL_V]],
      ]),
      lookup: id => events.find(event => event.id === id),
    });
    assert.equal(view.waitAll || view.waitSkills.size > 0, false, '기다리지 않는다');
    assert.deepEqual(view.ability.get(SKILL_V), server.ability.get(SKILL_V), '서버와 같다');
  }
});
