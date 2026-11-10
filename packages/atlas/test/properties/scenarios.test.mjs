// 장면 단정(설계 §11 가상 학습자 관문 1) — 시제품 6판 prototype/scenarios.mjs의 장면 ①~⑯을 옮겼다. 장면 하나가 test() 하나이고,
// 단정(claim)은 설계서가 말하는 값이다 — 하나라도 어긋나면 그 장면이 실패한다. ①~⑤는 검수(2026-11-10)에서 재현된 결함 장면,
// ⑥~⑯은 설계 검토(아르곤 · 아스트라 네 번, Fable 구조 검토 한 번)가 시제품에서 짚은 장면이다. 장면의 글은 ATLAS_VERBOSE=1로 본다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const {
  PARAMS,
  createMemory,
  createLearner,
  choose,
  present,
  record,
  say,
  startSession,
  reasonLine,
  foldServer,
  overlay,
} = await subject();
const note = (...parts) => {
  if (process.env.ATLAS_VERBOSE) console.log(...parts);
};
const memory = createMemory();
const DAY = 86400000;
const HOUR = 3600000;
const T0 = Date.parse('2026-12-01T09:00:00Z');
const mk = (skill, d, i, extra = {}) => ({
  itemKey: `${skill}.d${d}.${i}`,
  familyKey: `${skill}.d${d}.${i}`,
  skillId: skill,
  difficulty: d,
  responseFormat: 'cup-compose',
  order: 0,
  ...extra,
});
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
const bare = id => String(id).replace('word:', '');
const play = (learner, item, correct, now, extra = {}, params = PARAMS) =>
  record(learner, memory, item, { correct, assessable: true, ...extra }, now, params);
// 고른 문항을 보이고 답한다(겨눈 단위를 답과 함께 넘긴다). 낼 것이 없으면 거기서 멈춘다.
const run = (learner, all, n, clock, answer = () => true, log = null, params = PARAMS) => {
  for (let i = 0; i < n; i += 1) {
    const row = choose(all, learner, memory, clock.now, { params })[0];
    if (row.none) {
      log?.(row);
      return i;
    }
    present(learner, row);
    play(learner, row.item, answer(row.item), clock.now, { target: row.target }, params);
    log?.(row);
    clock.now += 20000;
  }
  return n;
};

const claim = (what, ok) => assert.ok(ok, what);

// ①의 셈: 할 것 없음을 알리기 전까지 그 칸에서 낸 수 · 다시 본 문항 수 · 이유 종류, 알린 뒤 그 칸과 다른 칸의 수.
const cellTally = learner => ({
  inCell: 0,
  repeats: 0,
  count: 0,
  idleFrom: null,
  reasons: new Map(),
  seenBefore: new Set(learner.met.keys()),
  after: { cell: 0, other: 0 },
});
function tallyCell(t, row) {
  t.count += 1;
  if (row.idle && t.idleFrom == null) t.idleFrom = t.count;
  const here = row.item.skillId === 'ko.listening.negation';
  if (t.idleFrom != null) t.after[here ? 'cell' : 'other'] += 1;
  else {
    if (here) t.inCell += 1;
    if (here && t.seenBefore.has(row.item.familyKey)) t.repeats += 1;
    t.reasons.set(row.why.code, (t.reasons.get(row.why.code) || 0) + 1);
  }
  t.seenBefore.add(row.item.familyKey);
}

test('① 문항이 적은 칸에 갇힘', () => {
  // ① 문항이 적은 칸에 갇힘 — 지금 엔진: 40문항 중 38번이 그 칸(35번은 본 문항), 「최근 놓친 …」 38번, 29일째까지 그대로
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now);
  const cell = Array.from({ length: 6 }, (_, i) => mk('ko.listening.negation', 2, i));
  const others = ['ko.listening.detail', 'ko.listening.condition'].flatMap(s =>
    Array.from({ length: 6 }, (_, i) => mk(s, 1, i)),
  );
  const all = [...cell, ...others];
  for (const [item, ok] of [
    [cell[0], false],
    [cell[1], false],
    [cell[2], true],
  ]) {
    play(learner, item, ok, clock.now);
    clock.now += 20000;
  }
  const t = cellTally(learner);
  run(
    learner,
    all,
    40,
    clock,
    () => true,
    row => tallyCell(t, row),
  );
  const { inCell, repeats, idleFrom, reasons, after } = t;
  note('① 문항 6개 칸에서 틀림 · 틀림 · 맞음 뒤 40문항 전부 정답');
  note(
    `   ${idleFrom - 1}문항 뒤 「급한 것도 새것도 없다」고 알림. 그때까지 그 칸 ${inCell}회(다시 본 문항 ${repeats} — 틀린 둘을 한 번씩) · 다른 칸 ${idleFrom - 1 - inCell}회 · 이유 종류 ${JSON.stringify([...reasons])}`,
  );
  note(
    `   알린 뒤에도 판을 이어 가면(길이가 정해진 게임): 그 칸 ${after.cell}회 · 다른 칸 ${after.other}회`,
  );
  claim(
    '① 8문항 뒤 할 것 없음을 알리고, 그때까지 그 칸은 틀린 둘을 한 번씩 다시 낸 2번뿐이다',
    idleFrom === 9 && inCell === 2 && repeats === 2,
  );
  claim(
    '① 알린 뒤 판을 이어 가도 그 칸에 갇히지 않는다(문항 수 비율대로 고르게)',
    after.cell / (after.cell + after.other) < 0.5,
  );
  for (const days of [1, 8, 29]) {
    const now = T0 + days * DAY;
    startSession(learner, now);
    const due = all.filter(item =>
      memory.isDue(learner.memory.get(`family:${item.familyKey}`), now),
    );
    note(
      `   ${days}일 뒤 돌아올 때가 된 문항 ${due.length}개(그 칸 ${due.filter(i => i.skillId === 'ko.listening.negation').length})`,
    );
    if (days === 1)
      claim(
        '① 다음 날 돌아오는 것은 틀린 둘뿐이다',
        due.length === 2 && due.every(i => i.skillId === 'ko.listening.negation'),
      );
  }
});
test('② 찰칵 낱말 「약한 낱말 먼저」', () => {
  // ② 찰칵 낱말 「약한 낱말 먼저」 — 지금 엔진: 틀린 두 낱말이 12개 중 7·9위, 추적된 내용 0건
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now);
  const items = [
    'cat',
    'stop',
    'dorm',
    'store',
    'university',
    'bookstore',
    'bank',
    'cafeteria',
    'library',
    'office',
    'pharmacy',
    'post',
  ].map((w, i) => word(w, i));
  for (const item of items.slice(0, 8)) {
    play(learner, item, !['dorm', 'bookstore'].includes(item.itemKey), clock.now);
    clock.now += 15000;
  }
  const ranked = choose(items, learner, memory, clock.now);
  note('② 낱말 12개 중 8개를 풀고 dorm · bookstore를 틀림');
  note('   다음 순서:', ranked.map(r => r.item.itemKey).join(' > '));
  note('   첫 이유:', reasonLine(ranked[0].why, bare));
  startSession(learner, T0 + 14 * HOUR);
  note(
    '   같은 날 밤(14시간 뒤) 순서:',
    choose(items, learner, memory, T0 + 14 * HOUR)
      .slice(0, 4)
      .map(r => `${r.item.itemKey}(${r.why.code})`)
      .join(' > '),
  );
  startSession(learner, T0 + 3 * DAY);
  const later = choose(items, learner, memory, T0 + 3 * DAY);
  note(
    '   사흘 뒤 순서:',
    later
      .slice(0, 6)
      .map(r => `${r.item.itemKey}(${r.why.code})`)
      .join(' > '),
  );
  note('   사흘 뒤 첫 이유:', reasonLine(later[0].why, bare));
  claim(
    '② 틀린 둘이 바로 뒤에도 사흘 뒤에도 1 · 2위다',
    ranked[0].item.itemKey === 'dorm' &&
      ranked[1].item.itemKey === 'bookstore' &&
      ranked[0].why.code === 'unit.retry' &&
      later[0].item.itemKey === 'dorm' &&
      later[1].item.itemKey === 'bookstore' &&
      later[0].why.code === 'unit.shaky',
  );
});
test('③ 올라가는 순간의 이유', () => {
  // ③ 올라가는 순간의 이유 — 지금 엔진: 「… 아직 기록이 적어요. 짧게 확인해 봐요.」 (난도의 움직임만 보려고 새것 한도를 넉넉히 둔다)
  const P = { ...PARAMS, newPerSession: 30, newPerDay: 30 };
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now, P);
  const levels = [1, 2].map(d =>
    Array.from({ length: 10 }, (_, i) =>
      mk('ko.listening.detail', d, i, { responseFormat: 'single-choice' }),
    ),
  );
  const all = levels.flat();
  const label = () => '듣고 세부 정보 찾기';
  const lines = [];
  const pick = () => choose(all, learner, memory, clock.now, { params: P });
  const answer = (row, correct, extra = {}) => {
    present(learner, row);
    play(learner, row.item, correct, clock.now, { target: row.target, ...extra }, P);
    clock.now += 20000;
  };
  const step = (correct, extra) => {
    const row = pick()[0];
    answer(row, correct, extra);
    lines.push(
      `난도 ${row.item.difficulty}(${row.why.code}) ${extra?.assisted ? '힌트 보고 맞힘' : correct ? '맞힘' : '틀림'}`,
    );
    return row;
  };
  for (const item of levels[0].slice(0, 4))
    answer(
      pick().find(r => r.item === item),
      true,
    );
  const up = pick()[0];
  note('③ 난도 1을 혼자 네 번 맞힌 뒤');
  note(
    `   고른 문항 난도 ${up.item.difficulty} · 예상 성공 ${up.p.toFixed(2)} · 이유: ${reasonLine(up.why, label)}`,
  );
  claim(
    '③ 난도 1을 혼자 네 번 맞히면 난도 2를 고르고 이유가 「올려요」다',
    up.item.difficulty === 2 && up.why.code === 'skill.up' && up.why.slots.streak === 4,
  );
  for (let i = 0; i < 2; i += 1) step(false); // 올라간 난도에서 두 번 틀린다
  for (let i = 0; i < 9; i += 1) step(true);
  note('   그 뒤 열한 걸음(둘 틀리고 아홉 맞힘):\n     ' + lines.join(' → '));
  note(
    `   그 사이 「올려요 · 쉬운 것부터」 이유가 나온 횟수: ${lines.filter(line => /skill\./.test(line)).length}(난도가 실제로 바뀐 걸음에서만)`,
  );
  claim(
    '③ 「올려요 · 쉬운 것부터」는 난도가 실제로 바뀐 걸음에만 붙는다(열한 걸음에 세 번)',
    lines.filter(line => /skill\./.test(line)).length === 3 &&
      lines[0].startsWith('난도 2(skill.up) 틀림') &&
      lines[1].startsWith('난도 1(skill.ease)'),
  );
  // 이어서 혼자 맞힌 수는 힌트를 보면 끊긴다(아르곤 2차): 혼자 둘 맞힘 → 힌트 보고 맞힘 → 다음 난도 2 문항에 「올려요」가 붙지 않는다.
  const other = createLearner();
  startSession(other, T0, P);
  const seq = [
    [levels[0][0], true, {}],
    [levels[0][1], true, {}],
    [levels[0][2], true, { assisted: true }],
  ];
  for (const [i, [item, ok, extra]] of seq.entries()) {
    const row = choose(all, other, memory, T0 + i * 20000, { params: P }).find(
      r => r.item === item,
    );
    present(other, row);
    play(other, item, ok, T0 + i * 20000, { target: row.target, ...extra }, P);
  }
  const next = choose(levels[1], other, memory, T0 + 60000, { params: P })[0];
  note(
    `   혼자 둘 맞히고 셋째는 힌트를 본 뒤: 이어서 혼자 맞힌 수 ${other.ability.get('ko.listening.detail').streak} · 난도 2 문항의 이유 ${next.why.code}`,
  );
  claim(
    '③ 힌트를 보면 이어서 혼자 맞힌 수가 끊겨 「올려요」가 붙지 않는다',
    other.ability.get('ko.listening.detail').streak === 0 && next.why.code === 'unit.new',
  );
});
test('④ 한 번 틀린 낱말과 한 번 맞힌 낱말, 8일 뒤', () => {
  // ④ 한 번 틀린 낱말과 한 번 맞힌 낱말, 8일 뒤 — 지금 엔진: 맞힌 낱말이 앞선다
  const learner = createLearner();
  startSession(learner, T0);
  const w = ['w0001', 'w0002', 'w0003', 'w0004'].map((id, i) => word(id, i));
  play(learner, w[0], false, T0);
  play(learner, w[1], true, T0 + 20000);
  startSession(learner, T0 + 8 * DAY);
  note(
    '④ w0001 틀림 · w0002 맞음, 8일 뒤 순서:',
    choose(w, learner, memory, T0 + 8 * DAY)
      .map(r => `${r.item.itemKey}(${r.why.code})`)
      .join(' > '),
  );
  {
    const eight = choose(w, learner, memory, T0 + 8 * DAY);
    claim(
      '④ 8일 뒤 한 번 틀린 낱말이 한 번 맞힌 낱말보다 앞이다',
      eight[0].item.itemKey === 'w0001' &&
        eight[0].why.code === 'unit.shaky' &&
        eight[1].item.itemKey === 'w0002' &&
        eight[1].why.code === 'unit.due',
    );
  }
});
test('⑤ 다 아는 칸의 복습이 새것을 밀어냄', () => {
  // ⑤ 다 아는 칸의 복습이 새것을 밀어냄 — 지금 엔진: 30문항 중 26번이 다 쓴 칸의 같은 네 문항
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now);
  const a = Array.from({ length: 4 }, (_, i) =>
    mk('ko.reading.reason', 1, i, { responseFormat: 'single-choice' }),
  );
  const b = Array.from({ length: 12 }, (_, i) =>
    mk('ko.reading.detail', 1, i, { responseFormat: 'single-choice' }),
  );
  for (const item of a) {
    play(learner, item, true, clock.now);
    clock.now += 20000;
  }
  clock.now = T0 + 8 * DAY;
  startSession(learner, clock.now);
  let order = '';
  let idleFrom = null;
  run(
    learner,
    [...a, ...b],
    30,
    clock,
    () => true,
    row => {
      if (row.idle && idleFrom == null) idleFrom = order.length + 1;
      order += row.item.skillId.endsWith('reason') ? 'A' : 'b';
    },
  );
  note('⑤ 칸 A(4문항)를 첫날 다 맞히고 8일 뒤 30문항:', order);
  note(
    `   급한 것도 새것도 없다고 알린 때: ${idleFrom}번째부터 · 그 전까지 A ${[...order.slice(0, idleFrom - 1)].filter(c => c === 'A').length}회 · 새 문항 ${[...order.slice(0, idleFrom - 1)].filter(c => c === 'b').length}회(한 판 한도 ${PARAMS.newPerSession})`,
  );
  claim(
    '⑤ 복습 넷과 새 문항 여섯(한 판 한도) 뒤 할 것 없음을 알린다',
    idleFrom === 11 &&
      [...order.slice(0, 10)].filter(c => c === 'A').length === 4 &&
      [...order.slice(0, 10)].filter(c => c === 'b').length === PARAMS.newPerSession,
  );
});
test('⑥ 최대 간격 60일(아스트라)', () => {
  // ⑥ 최대 간격 60일(아스트라): 안정도를 60일에서 막으므로 61일 뒤에는 떠올릴 확률이 목표 아래로 내려와 돌아온다
  const learner = createLearner();
  let now = T0;
  startSession(learner, now);
  const old = word('known', 0, { responseFormat: 'cup-compose' });
  const fresh = Array.from({ length: 3 }, (_, i) => word(`new${i}`, i + 1));
  for (let i = 0; i < 7; i += 1) {
    play(learner, old, true, now);
    now += Math.ceil(memory.intervalDays(learner.memory.get('word:known'))) * DAY;
    startSession(learner, now);
  }
  const state = learner.memory.get('word:known');
  for (const days of [59, 61]) {
    const at = state.lastAt + days * DAY;
    startSession(learner, at);
    const top = choose([old, ...fresh], learner, memory, at)[0];
    note(
      `${days === 59 ? '⑥ 일곱 번 제때 맞힌 낱말(안정도 ' + state.stability.toFixed(0) + '일 — 상한)' : '  '} ${days}일 뒤: 떠올릴 확률 ${memory.retrievability(state, at).toFixed(3)} · 맨 앞 ${top.item.itemKey}(${top.why.code})`,
    );
    claim(
      `⑥ ${days}일 뒤 ${days === 59 ? '아직 안 나온다' : '돌아온다'}`,
      days === 59
        ? top.item.itemKey !== 'known' && memory.retrievability(state, at) >= PARAMS.retention
        : top.item.itemKey === 'known' && top.why.code === 'unit.due',
    );
    if (days === 59)
      claim('⑥ 안정도는 60일을 넘기지 않는다', state.stability === PARAMS.maxIntervalDays);
  }
});
test('⑦ 다시 내는 횟수(아스트라 · 아르곤)', () => {
  // ⑦ 다시 내는 횟수(아스트라 · 아르곤): 늘 틀리는 낱말은 한 판에 세 번(처음 + 다시 둘)까지만 나오고, 그 판에서는 채우는 데에도 쓰지 않는다
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now);
  const hard = Array.from({ length: 3 }, (_, i) => word(`hard${i}`, i));
  const easy = Array.from({ length: 24 }, (_, i) => word(`easy${i}`, i + 3));
  const shown = new Map();
  let order = '';
  run(
    learner,
    [...hard, ...easy],
    24,
    clock,
    item => !item.itemKey.startsWith('hard'),
    row => {
      shown.set(row.item.itemKey, (shown.get(row.item.itemKey) || 0) + 1);
      order += row.item.itemKey.startsWith('hard') ? 'H' : 'e';
    },
  );
  note(
    `⑦ 늘 틀리는 낱말 셋 + 쉬운 낱말 스물넷, 한 판 24문항: ${order} · 늘 틀리는 낱말이 나온 횟수 ${hard.map(i => shown.get(i.itemKey) || 0).join(' · ')}`,
  );
  startSession(learner, T0 + DAY);
  const next = choose([...hard, ...easy], learner, memory, T0 + DAY)[0];
  note(`   다음 날 맨 앞: ${next.item.itemKey}(${next.why.code}) — ${reasonLine(next.why, bare)}`);
  claim(
    '⑦ 늘 틀리는 낱말은 한 판에 세 번까지만 나오고 다음 날 맨 앞에 온다',
    hard.every(i => shown.get(i.itemKey) === 3) &&
      next.item.itemKey.startsWith('hard') &&
      next.why.code === 'unit.shaky',
  );
});
test('⑦-나 숨 고르기', () => {
  // ⑦-나 숨 고르기: 아는 낱말이 있는 사람이 새 낱말을 이어서 놓치면, 다시 내기 전에 잘 아는 것 하나를 먼저 낸다
  const learner = createLearner();
  startSession(learner, T0);
  const known = Array.from({ length: 8 }, (_, i) => word(`known${i}`, i));
  const hard = Array.from({ length: 4 }, (_, i) => word(`hard${i}`, i + 8));
  for (const [i, item] of known.entries()) play(learner, item, true, T0 + i * 20000);
  const at = T0 + DAY;
  startSession(learner, at); // 하루 뒤: 아는 낱말은 아직 또렷하다(돌아올 때가 아니다)
  let order = '';
  let line = '';
  const clock = { now: at };
  run(
    learner,
    [...known, ...hard],
    12,
    clock,
    item => !item.itemKey.startsWith('hard'),
    row => {
      order += row.breather ? 'B' : row.item.itemKey.startsWith('hard') ? 'H' : 'k';
      if (row.breather && !line) line = `${row.why.code} ${reasonLine(row.why, bare)}`;
    },
  );
  note(
    `⑦-나 아는 낱말 여덟 + 늘 틀리는 새 낱말 넷: ${order}(H 놓친 새 낱말 · B 숨 고르기 · k 아는 낱말) — ${line}`,
  );
  claim(
    '⑦-나 두 번 이어서 놓치면 잘 아는 것 하나로 숨을 고른다',
    order.startsWith('HHB') && !order.startsWith('HHBB') && line.startsWith('pace.breather '),
  );
});
test('⑦-다 낼 것이 없을 때(아스트라 · 아르곤 2차)', () => {
  // ⑦-다 낼 것이 없을 때(아스트라 · 아르곤 2차): 후보 여섯을 다 틀리는 20문항 게임 — 다시를 다 쓴 단위는 더 내지 않고, 낼 것이 없으면 그렇게 답한다
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now);
  const six = Array.from({ length: 6 }, (_, i) => word(`six${i}`, i));
  let last = null;
  const done = run(
    learner,
    six,
    20,
    clock,
    () => false,
    row => {
      last = row;
    },
  );
  note(
    `⑦-다 후보 여섯을 다 틀리는 20문항 판: ${done}문항(여섯 단위 × 세 번) 뒤 낼 것 없음(none ${last.none}) — 네 번째로는 내지 않는다. 제품은 판을 끝내고 놓친 말을 답 없이 다시 보여 준다`,
  );
  claim(
    '⑦-다 여섯 단위를 세 번씩 놓치면 18문항 뒤 낼 것 없음으로 끝난다',
    done === 18 && last.none === true,
  );
  // 마지막 새것을 놓친 직후: 다시 낼 차례를 기다리는 동안은 할 것이 없다고 알리지 않는다.
  const one = createLearner();
  startSession(one, T0);
  const lone = [word('lone', 0)];
  const row = choose(lone, one, memory, T0)[0];
  present(one, row);
  play(one, lone[0], false, T0, { target: row.target });
  const waitRow = choose(lone, one, memory, T0 + 20000)[0];
  note(
    `   하나뿐인 문항을 놓친 직후: idle ${waitRow.idle} · none ${waitRow.none} · 차례를 당겨 ${waitRow.item.itemKey}를 다시 낸다(${waitRow.tier}층)`,
  );
  claim(
    '⑦-다 다시가 기다리는 동안은 할 것 없다고 알리지 않고 차례를 당겨 낸다',
    waitRow.idle === false &&
      waitRow.none === false &&
      waitRow.tier === 5 &&
      waitRow.target === 'word:lone',
  );
});
test('⑧ 아는 단위 + 처음 만나는 단위가 섞인 문항(아스트라 · 아르곤)', () => {
  // ⑧ 아는 단위 + 처음 만나는 단위가 섞인 문항(아스트라 · 아르곤): 새것으로 세고 idle로 덮지 않는다. 실패는 그 문항이 겨눈 단위에 적는다
  const learner = createLearner();
  const clock = { now: T0 };
  startSession(learner, clock.now);
  const a = word('A', 0);
  const ab = {
    itemKey: 'A+B',
    familyKey: 'A+B',
    units: ['word:A', 'word:B'],
    skillId: 'ko.reading.vocabulary',
    difficulty: 1,
    responseFormat: 'single-choice',
    order: 1,
  };
  play(learner, a, true, clock.now);
  clock.now += 20000;
  const row = choose([ab], learner, memory, clock.now)[0];
  note(
    `⑧ A를 맞힌 뒤 A+B 문항만 남음(주 단위는 A): ${row.why.code}(${bare(row.why.slots.unit || '')}) · idle ${row.idle} · 새 단위 ${row.fresh}`,
  );
  claim(
    '⑧ 아는 단위와 새 단위가 섞인 문항은 새것으로 세고 겨눈 단위는 새 단위다',
    row.why.code === 'unit.new' && row.target === 'word:B' && row.idle === false && row.fresh === 1,
  );
  present(learner, row);
  const result = play(learner, ab, false, clock.now, { target: row.target });
  note(
    `   그 문항을 틀리면 실패가 적히는 단위: ${result.credited.map(bare).join(', ')}(겨눈 단위) · A의 놓친 횟수 ${learner.memory.get('word:A').lapses} · B는 이제 만난 단위 ${learner.memory.has('word:B')}`,
  );
  claim(
    '⑧ 놓치면 실패가 겨눈 단위 B에만 적힌다',
    result.credited.length === 1 &&
      result.credited[0] === 'word:B' &&
      learner.memory.get('word:A').lapses === 0 &&
      learner.memory.get('word:B').lapses === 1,
  );
  // 새것 한도는 모든 층에 걸린다(아스트라 2차): 한도가 찬 판에서는 돌아온 단위를 묻는 문항이라도 새 단위가 섞여 있으면 내지 않고, 새 단위가 없는 문항으로 낸다.
  const other = createLearner();
  startSession(other, T0);
  const known = word('K', 0);
  const mixed = {
    itemKey: 'K+N',
    familyKey: 'K+N',
    units: ['word:K', 'word:N'],
    skillId: 'ko.reading.vocabulary',
    difficulty: 1,
    responseFormat: 'single-choice',
    order: 1,
  };
  const plain = word('K2', 2, { units: ['word:K'] });
  play(other, known, true, T0);
  startSession(other, T0 + 8 * DAY);
  for (let k = 0; k < PARAMS.newPerSession; k += 1) other.session.introduced.add(`word:filler${k}`); // 이 판의 새것 한도를 다 쓴 상태
  const ranked = choose([mixed, plain], other, memory, T0 + 8 * DAY);
  note(
    `   한도가 찬 판에서 돌아온 K: 맨 앞 ${ranked[0].item.itemKey}(${ranked[0].why.code}) · 새 단위가 섞인 K+N은 내지 않는다(${ranked.find(r => r.item === mixed).tier}층)`,
  );
  claim(
    '⑧ 한도가 찬 판에서는 새 단위가 섞인 문항을 내지 않고 새 단위가 없는 문항으로 낸다',
    ranked[0].item.itemKey === 'K2' &&
      ranked[0].why.code === 'unit.due' &&
      ranked.find(r => r.item === mixed).tier === 9,
  );
});
test('⑨ 같은 자리의 답은 하나로(아르곤)', () => {
  // ⑨ 같은 자리의 답은 하나로(아르곤): 틀린 뒤 몇 분 사이 두 번 맞혀도 간격이 그대로, 힌트를 봐도 난이도 값이 겹쳐 오르지 않는다
  const learner = createLearner();
  startSession(learner, T0);
  const w = word('sit', 0);
  const log = [];
  const snap = label => {
    const s = learner.memory.get('word:sit');
    log.push(
      `${label} 안정도 ${s.stability.toFixed(2)}일 · 난이도 ${s.difficulty.toFixed(2)} · 만난 자리 ${s.sittings} · 놓침 ${s.lapses}`,
    );
  };
  play(learner, w, false, T0);
  snap('틀림:');
  const missed = learner.memory.get('word:sit');
  log.push(
    `  (놓친 뒤 5.2시간: 떠올릴 확률 ${memory.retrievability(missed, T0 + 5.2 * HOUR).toFixed(2)}이지만 같은 자리라 돌아옴 ${memory.isDue(missed, T0 + 5.2 * HOUR)} · 6.5시간 뒤 돌아옴 ${memory.isDue(missed, T0 + 6.5 * HOUR)})`,
  );
  play(learner, w, true, T0 + 60000, { assisted: true });
  snap('1분 뒤 힌트 보고 맞힘:');
  play(learner, w, true, T0 + 120000);
  snap('2분 뒤 혼자 맞힘:');
  play(learner, w, true, T0 + DAY);
  snap('다음 날 혼자 맞힘:');
  note('⑨ 같은 자리의 답\n   ' + log.join('\n   '));
  {
    const first = memory.fold([{ at: T0, grade: 'again' }]);
    const three = memory.fold([
      { at: T0, grade: 'again' },
      { at: T0 + 60000, grade: 'hard' },
      { at: T0 + 120000, grade: 'weak' },
    ]);
    const end = learner.memory.get('word:sit');
    claim(
      '⑨ 틀린 뒤 몇 분 사이에 힌트로 맞히고 또 맞혀도 기억 상태가 그대로다',
      three.stability === first.stability &&
        three.difficulty === first.difficulty &&
        three.sittings === 1 &&
        three.lapses === 1,
    );
    claim(
      '⑨ 놓친 단위는 같은 자리 안에서는 돌아오지 않고 6시간이 지나면 돌아온다',
      !memory.isDue(missed, T0 + 5.2 * HOUR) &&
        memory.retrievability(missed, T0 + 5.2 * HOUR) < 0.905 &&
        memory.isDue(missed, T0 + 6.5 * HOUR),
    );
    claim(
      '⑨ 다음 날 맞히면 새 자리로 적히고 간격이 늘어난다',
      end.sittings === 2 && end.lapses === 1 && end.stability > first.stability,
    );
  }
});
test('⑩ 쉬다 돌아온 사람(아르곤)', () => {
  // ⑩ 쉬다 돌아온 사람(아르곤): 2주 동안 낱말을 배우고 3주를 쉰 뒤의 첫 판 — 살릴 수 있는 것부터, 셋에 하나는 새것
  const learner = createLearner();
  let now = T0;
  const items = Array.from({ length: 120 }, (_, i) => word(`w${String(i).padStart(3, '0')}`, i));
  for (let day = 0; day < 14; day += 1) {
    now = T0 + day * DAY;
    startSession(learner, now);
    run(learner, items, 15, { now }, () => true);
  }
  now = T0 + 35 * DAY;
  startSession(learner, now);
  const first = choose(items, learner, memory, now)[0];
  const met = learner.memory.size;
  const all = [...learner.memory.values()]
    .map(state => memory.retrievability(state, now))
    .sort((a, b) => a - b);
  let order = '';
  const picked = [];
  run(
    learner,
    items,
    12,
    { now },
    () => true,
    row => {
      order += row.tier === 1 ? 'R' : row.tier === 2 ? 'N' : '·';
      if (row.tier === 1) picked.push(row.need);
    },
  ); // 밀린 것이 많을 때 need = 떠올릴 확률
  note(
    `⑩ 2주 동안 낱말 ${met}개를 만나고 3주를 쉰 뒤의 첫 판: 밀린 단위 ${first.backlog}개(떠올릴 확률 ${all[0].toFixed(2)}~${all.at(-1).toFixed(2)}) · 낸 차례 ${order}(R 돌아온 것 · N 새것)`,
  );
  note(
    `   돌아온 것으로 낸 단위의 떠올릴 확률: ${picked.map(p => p.toFixed(2)).join(' ')} — 살릴 수 있는 것부터`,
  );
  claim(
    '⑩ 3주를 쉰 뒤의 첫 판은 살릴 수 있는 것부터, 셋에 하나는 새것이다',
    first.backlog > PARAMS.backlog &&
      order === 'RRRNRRRNRRRN' &&
      picked.every((p, i) => i === 0 || p <= picked[i - 1] + 1e-9) &&
      picked[0] >= all.at(-1) - 1e-9,
  );
});
test('⑪ 받은 차례가 달라도 같은 값(아르곤 · 아스트라)', () => {
  // ⑪ 받은 차례가 달라도 같은 값(아르곤 · 아스트라): 서버는 사건을 시각 순으로 놓고 처음부터 접는다 — 능력 값 · 단위 상태 · 「처음 본」 판정 · 실패 귀속이 받은 차례를 타지 않는다
  const answers = [
    [0, true, 1],
    [1, true, 1],
    [2, false, 2],
    [3, true, 1],
    [4, true, 2],
    [5, false, 2],
    [6, true, 1],
  ];
  const eventOf = k => {
    const [i, ok, d] = answers[k];
    return {
      kind: 'answer',
      id: `a${k}`,
      at: T0 + i * 60000,
      item: mk('ko.listening.detail', d, i, { responseFormat: 'single-choice' }),
      answer: { correct: ok, assessable: true },
    };
  };
  const inOrder = foldServer([0, 1, 2, 3, 4, 5, 6].map(eventOf), memory);
  const late = foldServer([0, 1, 4, 5, 6, 2, 3].map(eventOf), memory);
  const stateOf = l =>
    JSON.stringify(
      [...l.memory].sort().map(([unit, s]) => [unit, s.stability.toFixed(4), s.lapses]),
    );
  note(
    `⑪ 같은 답 일곱을 제 차례로 / 둘을 늦게 받았을 때: θ ${inOrder.ability.get('ko.listening.detail').theta.toFixed(4)} / ${late.ability.get('ko.listening.detail').theta.toFixed(4)} · 단위 상태 같음 ${stateOf(inOrder) === stateOf(late)}`,
  );
  claim(
    '⑪ 답 둘을 늦게 받아도 능력 값과 단위 상태가 같다',
    inOrder.ability.get('ko.listening.detail').theta ===
      late.ability.get('ko.listening.detail').theta && stateOf(inOrder) === stateOf(late),
  );
  // 같은 계열의 첫날 오답과 다음 날 정답(아스트라 2차): 「처음 본」 판정을 시각 순으로 하므로 어느 것이 먼저 도착해도 측정 답은 첫날 오답 하나다.
  const same = mk('ko.listening.detail', 1, 99, { responseFormat: 'single-choice' });
  const twice = order =>
    foldServer(
      order.map(([ok, day]) => ({
        kind: 'answer',
        id: `t${day}`,
        at: T0 + day * DAY,
        item: same,
        answer: { correct: ok, assessable: true },
      })),
      memory,
    ).ability.get('ko.listening.detail');
  const forward = twice([
    [false, 0],
    [true, 1],
  ]);
  const backward = twice([
    [true, 1],
    [false, 0],
  ]);
  note(
    `   같은 계열의 첫날 오답 · 다음 날 정답을 제 차례로 / 거꾸로 받았을 때: θ ${forward.theta.toFixed(4)} / ${backward.theta.toFixed(4)}`,
  );
  claim(
    '⑪ 같은 계열의 답 둘을 거꾸로 받아도 측정 답은 첫날 오답 하나다',
    forward.theta === backward.theta && forward.n === 1 && forward.theta < 0,
  );
  // 아스트라가 짚은 장면: A 맞힘(0일) · B 맞힘(8일) · A+B 틀림(10일), 그리고 A 맞힘(9일)이 늦게 도착. 실패가 적히는 단위가 다른 단위의 상태에 기대면 두 결과가 달라진다.
  const a = word('A', 0);
  const b = word('B', 1);
  const ab = {
    itemKey: 'A+B',
    familyKey: 'A+B',
    units: ['word:A', 'word:B'],
    skillId: 'ko.reading.vocabulary',
    difficulty: 1,
    responseFormat: 'single-choice',
    order: 2,
  };
  const events = [
    [a, true, 0, null],
    [b, true, 8, null],
    [word('A2', 3, { units: ['word:A'] }), true, 9, null],
    [ab, false, 10, 'word:B'],
  ]; // A+B는 B를 겨눠 낸 문항(사건에 적힌 값)
  const replay = order =>
    foldServer(
      order.map(k => {
        const [item, ok, day, target] = events[k];
        return {
          kind: 'answer',
          id: `r${k}`,
          at: T0 + day * DAY,
          item,
          answer: { correct: ok, assessable: true, target },
        };
      }),
      memory,
    );
  const full = replay([0, 1, 2, 3]);
  const delayed = replay([0, 1, 3, 2]);
  note(
    `   여러 단위 문항의 실패 귀속: 제 차례 A 놓침 ${full.memory.get('word:A').lapses} · B 놓침 ${full.memory.get('word:B').lapses} / 늦게 받음 A 놓침 ${delayed.memory.get('word:A').lapses} · B 놓침 ${delayed.memory.get('word:B').lapses} · 단위 상태 같음 ${stateOf(full) === stateOf(delayed)}`,
  );
  claim(
    '⑪ 여러 단위 문항의 실패는 겨눈 단위 B에만 적히고, 늦게 받아도 같다',
    full.memory.get('word:A').lapses === 0 &&
      full.memory.get('word:B').lapses === 1 &&
      stateOf(full) === stateOf(delayed),
  );
});
test('⑫ 하루 한도', () => {
  // ⑫ 하루 한도: 게임을 잇달아 다섯 판(판마다 20문항) 해도 새 단위는 판마다 여섯, 하루 스물에서 멈춘다
  const learner = createLearner();
  let now = T0;
  const perRound = [];
  const items = Array.from({ length: 120 }, (_, i) => word(`d${String(i).padStart(3, '0')}`, i));
  for (let round = 0; round < 5; round += 1) {
    startSession(learner, now);
    const before = learner.memory.size;
    const clock = { now };
    let idleAt = null;
    let n = 0;
    run(
      learner,
      items,
      20,
      clock,
      () => true,
      row => {
        n += 1;
        if (row.idle && idleAt == null) idleAt = n;
      },
    );
    perRound.push(
      `${learner.memory.size - before}${idleAt ? `(${idleAt}번째부터 아는 것으로 채움)` : ''}`,
    );
    now = clock.now + 60000;
  }
  note(
    `⑫ 잇달아 다섯 판(20문항씩, 다 맞힘) — 판마다 새로 만난 낱말: ${perRound.join(' · ')} · 하루 합 ${learner.memory.size}(하루 한도 ${PARAMS.newPerDay})`,
  );
  claim(
    '⑫ 잇달아 다섯 판을 해도 새 낱말은 6 · 6 · 6 · 2 · 0으로 하루 스물에서 멈춘다',
    perRound.map(text => parseInt(text, 10)).join() === '6,6,6,2,0' &&
      learner.memory.size === PARAMS.newPerDay,
  );
});
test('⑬ 요약의 줄에서 이어 접기 = 처음부터 접기(아스트라 · 아르곤 2차)', () => {
  // ⑬ 요약의 줄에서 이어 접기 = 처음부터 접기(아스트라 · 아르곤 2차): 단위 상태를 「마지막 자리 앞의 상태 + 마지막 자리」로 실으면 같은 자리의 뒤늦은 놓침도 맞게 얹힌다
  const rows = [
    { at: T0, grade: 'weak' },
    { at: T0 + 2 * DAY, grade: 'weak' },
    { at: T0 + 5 * DAY, grade: 'weak' },
    { at: T0 + 5 * DAY + 600000, grade: 'again' },
    { at: T0 + 5 * DAY + 900000, grade: 'weak' },
    { at: T0 + 6 * DAY, grade: 'good' },
  ];
  const same = (a, b) =>
    a.stability.toFixed(6) === b.stability.toFixed(6) &&
    a.difficulty.toFixed(6) === b.difficulty.toFixed(6) &&
    a.sittings === b.sittings &&
    a.lapses === b.lapses;
  let ok = true;
  for (let cut = 1; cut < rows.length; cut += 1) {
    const summary = JSON.parse(JSON.stringify(memory.fold(rows.slice(0, cut)))); // 요약으로 내려갔다 온 줄
    const resumed = rows.slice(cut).reduce((state, row) => memory.append(state, row), summary);
    ok = ok && same(resumed, memory.fold(rows));
  }
  const mid = memory.fold(rows.slice(0, 3));
  const after = memory.fold(rows.slice(0, 4));
  note(`⑬ 답 여섯을 어디서 끊어 요약으로 내렸다 이어 접어도 처음부터 접은 것과 같다: ${ok}`);
  note(
    `   5일째 맞힘 뒤 안정도 ${mid.stability.toFixed(2)}일 → 10분 뒤 같은 자리에서 놓치면 ${after.stability.toFixed(2)}일(맞힘을 물리고 앞 상태에서 놓침으로 다시 계산)`,
  );
  claim(
    '⑬ 요약으로 내렸다 어디서 이어 접어도 처음부터 접은 것과 같고, 같은 자리의 뒤늦은 놓침은 맞힘을 물린다',
    ok &&
      after.stability < mid.stability &&
      after.lapses === mid.lapses + 1 &&
      after.sittings === mid.sittings,
  );
});
test('⑭ 본인 말(아르곤 · 아스트라 2차)', () => {
  // ⑭ 본인 말(아르곤 · 아스트라 2차): 「이미 알아요」는 60일 뒤로, 그때 놓치면 처음 놓친 단위처럼. 「다시 배울래요」는 처음으로
  const learner = createLearner();
  startSession(learner, T0);
  const w = word('said', 0);
  const other = word('other', 1);
  play(learner, w, true, T0);
  play(learner, other, true, T0 + 20000);
  say(learner, memory, 'word:said', 'known', T0 + DAY);
  const at = days => {
    const now = T0 + days * DAY;
    startSession(learner, now);
    return choose([w], learner, memory, now)[0];
  };
  note(
    `⑭ 「이미 알아요」 뒤: 30일째 ${at(30).tier <= 2 ? '돌아옴' : '안 나옴'} · 59일째 ${at(59).tier <= 2 ? '돌아옴' : '안 나옴'} · 62일째 ${at(62).why.code}`,
  );
  claim(
    '⑭ 이미 알아요라고 한 낱말은 59일째까지 안 나오고 62일째에 돌아온다',
    at(30).tier > 2 && at(59).tier > 2 && at(62).tier === 1 && at(62).why.code === 'unit.due',
  );
  const check = at(62);
  present(learner, check);
  play(learner, w, false, T0 + 62 * DAY, { target: check.target });
  note(
    `   62일째 확인에서 놓치면: 안정도 ${learner.memory.get('word:said').stability.toFixed(2)}일(처음 놓친 단위와 같음) · 다음 날 ${at(63).why.code}`,
  );
  claim(
    '⑭ 그 확인에서 놓치면 처음 놓친 낱말과 같고 다음 날 온다',
    learner.memory.get('word:said').stability ===
      memory.fold([{ at: T0, grade: 'again' }]).stability && at(63).why.code === 'unit.shaky',
  );
  say(learner, memory, 'word:other', 'relearn', T0 + 63 * DAY);
  startSession(learner, T0 + 63 * DAY);
  note(
    `   「다시 배울래요」 뒤: ${choose([other], learner, memory, T0 + 63 * DAY)[0].why.code}(다시 새것으로)`,
  );
  claim(
    '⑭ 다시 배울래요는 새것으로 돌아온다',
    choose([other], learner, memory, T0 + 63 * DAY)[0].why.code === 'unit.new',
  );
});
test('⑮ 하루 복습 상한(아르곤 2차)', () => {
  // ⑮ 하루 복습 상한(아르곤 2차): 상한에 걸려 미룬 것은 그날 채우는 데에도 쓰지 않고, 「다 만났어요」라고 말하지 않는다(상한을 3으로 줄여 본다)
  const P = { ...PARAMS, reviewsPerDay: 3 };
  const learner = createLearner();
  startSession(learner, T0, P);
  const items = Array.from({ length: 6 }, (_, i) => word(`cap${i}`, i));
  for (const [i, item] of items.entries()) play(learner, item, true, T0 + i * 20000, {}, P);
  const clock = { now: T0 + 8 * DAY };
  startSession(learner, clock.now, P);
  let order = '';
  let last = null;
  const reviewed = new Set();
  const filled = new Set();
  run(
    learner,
    items,
    10,
    clock,
    () => true,
    row => {
      last = row;
      if (row.none) return;
      order += row.tier === 1 ? 'R' : '·';
      (row.tier === 1 ? reviewed : filled).add(row.item.itemKey);
    },
    P,
  );
  const deferred = items.filter(item => !reviewed.has(item.itemKey));
  note(
    `⑮ 돌아온 낱말 여섯 · 하루 복습 상한 3, 10문항 판: ${order}(R 돌아온 것 · · 채우기) — 미룬 낱말 ${deferred.length}개가 채우기로 나온 횟수 ${deferred.filter(item => filled.has(item.itemKey)).length} · 상한에 걸림 ${last.capped}(이유는 「다 만났어요」가 아니라 「오늘은 여기까지」)`,
  );
  claim(
    '⑮ 하루 복습 상한에 걸려 미룬 낱말은 그날 채우기로도 나오지 않고, 이유는 「오늘은 여기까지」다',
    order.startsWith('RRR') &&
      !order.slice(3).includes('R') &&
      deferred.length === 3 &&
      deferred.every(item => !filled.has(item.itemKey)) &&
      last.capped === true &&
      last.why.code === 'day.capped',
  );
});
test('⑯ 3 · 4차 검토와 구조 검토가 짚은 모서리(아르곤 · 아스트라 · Fable)', () => {
  // ⑯ 3 · 4차 검토와 구조 검토가 짚은 모서리(아르곤 · 아스트라 · Fable): 받은 차례와 본인 말, 기다리는 다시, 한도를 두 번 세는 일, 기기가 얹을 수 있는 것, 만남의 뜻
  const lines = [];
  const right = { correct: true, assessable: true };
  const answerAt = (id, item, at, answer = right) => ({ kind: 'answer', id, at, item, answer });
  // 가. 「다시 배울래요」(2일째) 뒤에 그보다 이른 답(1일째)이 늦게 와도 기억이 되살아나지 않는다.
  {
    const w = word('redo', 0);
    const relearn = { kind: 'say', id: 'e2', at: T0 + 2 * DAY, unit: 'word:redo', say: 'relearn' };
    const late = foldServer(
      [answerAt('e1', w, T0), relearn, answerAt('e3', w, T0 + DAY)],
      memory,
    ).memory.get('word:redo');
    lines.push(
      `가. 다시 배울래요(2일째)보다 이른 답(1일째)을 늦게 받음: 기억 있음 ${memory.has(late)} · 비운 시각이 남음 ${late?.latestAt === T0 + 2 * DAY}`,
    );
    claim(
      '⑯가 다시 배울래요보다 이른 답이 늦게 와도 기억이 되살아나지 않는다',
      !memory.has(late) && late?.latestAt === T0 + 2 * DAY,
    );
  }
  // 나. 먼저 온 정답보다 이른 「판정 못 한 답」이 늦게 오면 그 정답은 측정 답이 아니다 — 어느 차례로 받아도 같다.
  {
    const item = mk('ko.listening.detail', 1, 77, { responseFormat: 'single-choice' });
    const blank = answerAt('n1', item, T0 + 1000, { correct: null, assessable: false });
    const solo = answerAt('n2', item, T0 + 2000);
    const n = events => foldServer(events, memory).ability.get('ko.listening.detail')?.n ?? 0;
    lines.push(
      `나. 판정 못 한 답(1초) · 정답(2초)을 제 차례로 / 거꾸로 받았을 때 측정 답 수: ${n([blank, solo])} / ${n([solo, blank])}`,
    );
    claim(
      '⑯나 판정 못 한 답이 먼저인 계열의 정답은 어느 차례로 받아도 측정 답이 아니다',
      n([blank, solo]) === 0 && n([solo, blank]) === 0,
    );
  }
  // 다. 차례를 당겨 낸 「다시」도 겨눈 단위를 지킨다: [아는 a, 새 b] 문항을 b를 겨눠 내고 놓친 뒤, 후보가 그것뿐이면 바로 다시 내고 또 놓쳐도 실패는 b에 적힌다.
  {
    const learner = createLearner();
    startSession(learner, T0);
    const a = word('a', 0);
    const ab = {
      itemKey: 'a+b',
      familyKey: 'a+b',
      units: ['word:a', 'word:b'],
      skillId: 'ko.reading.vocabulary',
      difficulty: 1,
      responseFormat: 'single-choice',
      order: 1,
    };
    play(learner, a, true, T0);
    const first = choose([ab], learner, memory, T0 + 20000)[0];
    present(learner, first);
    play(learner, ab, false, T0 + 20000, { target: first.target });
    const again = choose([ab], learner, memory, T0 + 40000)[0];
    present(learner, again);
    play(learner, ab, false, T0 + 40000, { target: again.target });
    lines.push(
      `다. 당겨 낸 다시: ${again.tier}층 · 겨눈 단위 ${bare(again.target)} · 이유 ${again.why.code} · a의 놓친 자리 ${learner.memory.get('word:a').lapses} · b를 다시 낸 횟수 ${learner.session.retries.get('word:b').tries}`,
    );
    claim(
      '⑯다 당겨 낸 다시도 겨눈 단위 b와 이유를 지키고, 실패가 a에 적히지 않는다',
      again.tier === 5 &&
        again.target === 'word:b' &&
        again.why.code === 'unit.retry' &&
        learner.memory.get('word:a').lapses === 0 &&
        learner.session.retries.get('word:b').tries === 1,
    );
  }
  // 라. 한도 2인 판에서 새 단위 둘이 든 문항을 놓쳐도 한도를 두 번 세지 않는다 — 다시 낼 수 있고, 다 쓰면 판이 끝난다.
  {
    const P = { ...PARAMS, newPerSession: 2 };
    const learner = createLearner();
    const clock = { now: T0 };
    startSession(learner, clock.now, P);
    const pair = {
      itemKey: 'p+q',
      familyKey: 'p+q',
      units: ['word:p', 'word:q'],
      skillId: 'ko.reading.vocabulary',
      difficulty: 1,
      responseFormat: 'single-choice',
      order: 0,
    };
    let order = '';
    let last = null;
    const done = run(
      learner,
      [pair],
      8,
      clock,
      () => false,
      row => {
        last = row;
        if (!row.none) order += row.tier;
      },
      P,
    );
    lines.push(
      `라. 새 단위 둘 문항을 계속 놓침(판 한도 2): 낸 층 ${order} · ${done}문항 뒤 none ${last.none} · 오늘 센 새 단위 ${learner.day.introduced.size}`,
    );
    claim(
      '⑯라 새 단위 둘을 한 번만 세고, 세 번 놓치면 판이 끝난다',
      order === '255' && done === 3 && last.none === true && learner.day.introduced.size === 2,
    );
  }
  // 마. 놓친 단위에 「다시 배울래요」를 눌러도 멈추지 않는다 — 이 판의 다시는 거두고 새것으로 돌아간다.
  {
    const learner = createLearner();
    startSession(learner, T0);
    const u = word('u', 0);
    const others = [word('o1', 1), word('o2', 2)];
    play(learner, u, false, T0);
    play(learner, others[0], true, T0 + 20000);
    play(learner, others[1], true, T0 + 40000);
    say(learner, memory, 'word:u', 'relearn', T0 + 50000);
    const row = choose([u, ...others], learner, memory, T0 + 60000)[0];
    lines.push(`마. 놓친 뒤 다시 배울래요: 맨 앞 ${row.item.itemKey}(${row.why.code})`);
    claim(
      '⑯마 놓친 뒤 다시 배울래요를 누르면 새것으로 돌아온다',
      row.item.itemKey === 'u' && row.why.code === 'unit.new',
    );
  }
  // 바. 「이미 알아요」 뒤 확인 자리에서 맞혔다가 같은 자리에서 놓치면 처음 놓친 단위처럼 시작한다(60일 안정도를 물려받지 않는다).
  {
    const rows = [
      { at: T0, grade: 'weak' },
      { at: T0 + DAY, say: 'known' },
      { at: T0 + 62 * DAY, grade: 'weak' },
      { at: T0 + 62 * DAY + 600000, grade: 'again' },
    ];
    const state = memory.fold(rows);
    const fresh = memory.fold([{ at: T0, grade: 'again' }]);
    lines.push(
      `바. 이미 알아요 → 62일째 맞힘 → 10분 뒤 놓침: 안정도 ${state.stability.toFixed(2)}일(처음 놓친 단위 ${fresh.stability.toFixed(2)}일)`,
    );
    claim(
      '⑯바 이미 알아요 뒤 확인 자리에서 놓치면 처음 놓친 단위와 같다',
      state.stability === fresh.stability && state.difficulty === fresh.difficulty,
    );
  }
  // 사. 기기가 얹을 수 있는 것은 요약의 그 줄보다 뒤인 답뿐이다: 요약에 0 · 3 · 4일째 답이 들어 있는데 내 1일째 답이 밀려 있으면 얹지 않고 기다린다.
  {
    const w = word('late', 0);
    const folded = [
      answerAt('d0', w, T0),
      answerAt('d3', w, T0 + 3 * DAY),
      answerAt('d4', w, T0 + 4 * DAY),
    ];
    const summary = () => structuredClone(foldServer(folded, memory));
    const base = summary().memory.get('word:late');
    const early = overlay(summary(), [answerAt('d1', w, T0 + DAY)], memory);
    const server = foldServer([...folded, answerAt('d1', w, T0 + DAY)], memory).memory.get(
      'word:late',
    );
    const later = overlay(summary(), [answerAt('d5', w, T0 + 5 * DAY)], memory);
    const server5 = foldServer([...folded, answerAt('d5', w, T0 + 5 * DAY)], memory).memory.get(
      'word:late',
    );
    lines.push(
      `사. 요약(0 · 3 · 4일째 답, 안정도 ${base.stability.toFixed(2)}일)에 내 1일째 답이 밀려 있음: 기다림 ${early.waitUnits.has('word:late')} · 보이는 값 ${early.memory.get('word:late').stability.toFixed(2)}일(요약 값) — 서버가 다시 접으면 ${server.stability.toFixed(2)}일. 5일째 답은 얹는다: 기다림 ${later.waitUnits.has('word:late')} · ${later.memory.get('word:late').stability.toFixed(2)}일 = 서버 ${server5.stability.toFixed(2)}일`,
    );
    claim(
      '⑯사 요약 줄보다 이른 내 답은 얹지 않고 요약 값을 둔다',
      early.waitUnits.has('word:late') &&
        early.memory.get('word:late').stability === base.stability &&
        server.stability !== base.stability,
    );
    claim(
      '⑯사 요약 줄보다 뒤인 내 답은 얹고, 서버와 같다',
      !later.waitUnits.has('word:late') &&
        later.memory.get('word:late').stability === server5.stability,
    );
  }
  // 아. 옮겨 온 장부(옛 기기의 접힌 기록)에 든 계열은 새 판에서 맞혀도 「처음 본 정답」이 아니다 — 장부가 답보다 늦게 와도 같다.
  {
    const item = mk('ko.listening.detail', 1, 88, { responseFormat: 'single-choice' });
    const solo = answerAt('a1', item, T0 + 1000);
    const ledger = { kind: 'carry', id: 'c1', at: T0 + 2000, families: [item.familyKey] };
    const n = events => foldServer(events, memory).ability.get('ko.listening.detail')?.n ?? 0;
    lines.push(
      `아. 옮겨 온 장부에 든 계열을 새 판에서 맞힘 — 장부를 먼저 / 답을 먼저 받았을 때 측정 답 수: ${n([ledger, solo])} / ${n([solo, ledger])}(장부가 없으면 ${n([solo])})`,
    );
    claim(
      '⑯아 옮겨 온 장부에 든 계열의 답은 측정 답이 아니다',
      n([ledger, solo]) === 0 && n([solo, ledger]) === 0 && n([solo]) === 1,
    );
    // 옛 판에 다녀온 뒤의 장부(4차): 처음 옮길 때 사건으로 옮긴 답이 옛 판에서 장부로 접혀 다시 와도, 그 답의 자격을 거두지 않는다 — 나중 장부의 만남은 앞 장부를 뜬 때에 선다.
    const first = { kind: 'carry', id: 'c0', at: T0 + 2000, families: [] };
    const later = {
      kind: 'carry',
      id: 'c2',
      at: T0 + 9 * DAY,
      families: [item.familyKey],
      after: first.at,
    };
    const fresh = mk('ko.listening.detail', 1, 90, { responseFormat: 'single-choice' });
    const during = answerAt('a3', fresh, T0 + 5 * DAY);
    const ledger2 = { ...later, families: [item.familyKey, fresh.familyKey] };
    lines.push(
      `   옛 판에 다녀온 뒤의 장부에 그 계열이 들어 있어도 측정 답 수: ${n([first, solo, later])}(그대로) · 다녀온 사이에 처음 만난 계열은 ${n([first, during, { ...ledger2, families: [fresh.familyKey] }])}`,
    );
    claim(
      '⑯아 나중에 옮긴 장부는 이미 사건으로 옮긴 답의 자격을 거두지 않는다',
      n([first, solo, later]) === 1 &&
        n([later, solo, first]) === 1 &&
        n([first, during, { ...ledger2, families: [fresh.familyKey] }]) === 0,
    );
  }
  // 자. 만남의 뜻: 보이기만 하고 답 없이 닫은 문항은 만남이 아니다(사건이 남지 않는다). 도움만 보고 닫았으면 만남이다 — 다음에 혼자 맞혀도 측정 답이 아니다.
  {
    const item = mk('ko.listening.detail', 1, 89, { responseFormat: 'single-choice' });
    const help = { kind: 'help', id: 'h1', at: T0, item };
    const solo = answerAt('h2', item, T0 + DAY);
    const n = events => foldServer(events, memory).ability.get('ko.listening.detail')?.n ?? 0;
    lines.push(
      `자. 보이기만 하고 닫은 문항을 다음 날 혼자 맞힘: 측정 답 ${n([solo])} · 도움만 보고 닫은 문항을 다음 날 혼자 맞힘: 측정 답 ${n([help, solo])}`,
    );
    claim(
      '⑯자 보이기만 한 문항은 만남이 아니고, 도움만 본 문항은 만남이다',
      n([solo]) === 1 && n([help, solo]) === 0,
    );
  }
  // 차. 능력 줄을 얹는 조건(구조 검토): 다른 기기의 5일째 답이 먼저 접힌 계열에 내 3일째 답이 밀려 있으면, 첫 만남이 내 답으로 바뀌므로 기기는 그 능력 줄을 기다린다.
  {
    const item = mk('ko.listening.detail', 1, 91, { responseFormat: 'single-choice' });
    const theirs = answerAt('o5', item, T0 + 5 * DAY, { correct: null, assessable: false });
    const mine = answerAt('m3', item, T0 + 3 * DAY);
    const view = overlay(structuredClone(foldServer([theirs], memory)), [mine], memory);
    const server = foldServer([theirs, mine], memory).ability.get('ko.listening.detail');
    lines.push(
      `차. 다른 기기의 5일째 답이 먼저 접힌 계열에 내 3일째 답이 밀려 있음: 능력 줄 기다림 ${view.waitSkills.has('ko.listening.detail')}(지어낸 값 없음 ${!view.ability.has('ko.listening.detail')}) — 서버가 다시 접으면 측정 답 ${server.n} · θ ${server.theta.toFixed(3)}`,
    );
    claim(
      '⑯차 첫 만남이 내 답으로 바뀌면 기기는 능력 줄을 기다린다',
      view.waitSkills.has('ko.listening.detail') &&
        !view.ability.has('ko.listening.detail') &&
        server.n === 1,
    );
  }
  // 카. 도움만 보고 나간 것도 「이어서 혼자 맞힌 수」를 끊는다(4차): 혼자 둘 맞힌 뒤 같은 능력의 다른 문항에서 도움만 보면 0이 된다. θ와 답 수는 그대로다.
  {
    const items = [0, 1, 2].map(i =>
      mk('ko.listening.detail', 1, 60 + i, { responseFormat: 'single-choice' }),
    );
    const two = [answerAt('k1', items[0], T0), answerAt('k2', items[1], T0 + 60000)];
    const help = { kind: 'help', id: 'k3', at: T0 + 120000, item: items[2] };
    const before = foldServer(two, memory).ability.get('ko.listening.detail');
    const after = foldServer([...two, help], memory).ability.get('ko.listening.detail');
    const device = overlay(structuredClone(foldServer(two, memory)), [help], memory).ability.get(
      'ko.listening.detail',
    );
    lines.push(
      `카. 혼자 둘 맞힌 뒤 도움만 보고 나감: 이어서 혼자 맞힌 수 ${before.streak} → ${after.streak}(기기도 ${device.streak}) · 답 수 ${before.n} → ${after.n}`,
    );
    claim(
      '⑯카 도움만 보고 나간 것도 이어서 혼자 맞힌 수를 끊는다',
      before.streak === 2 &&
        after.streak === 0 &&
        device.streak === 0 &&
        after.n === 2 &&
        after.theta === before.theta,
    );
  }
  // 타. 부모를 찾지 못하는 제외(4차): 이미 접힌 답을 거뒀는데 그 답이 기기에서 사라졌으면 — 제외를 만들 때 적어 둔 줄만 기다리고, 그것도 없으면 아무것도 얹지 않는다.
  {
    const w = word('gone', 0);
    const old = answerAt('g1', w, T0);
    const next = answerAt('g3', w, T0 + 3 * DAY);
    const summary = () => structuredClone(foldServer([old], memory));
    const noted = overlay(
      summary(),
      [
        {
          kind: 'exclude',
          id: 'g2',
          at: T0 + 2 * DAY,
          ref: 'g1',
          touches: { units: ['word:gone'], skills: ['ko.reading.vocabulary'] },
        },
        next,
      ],
      memory,
    );
    const blind = overlay(
      summary(),
      [{ kind: 'exclude', id: 'g2', at: T0 + 2 * DAY, ref: 'g1' }, next],
      memory,
    );
    const server = foldServer(
      [old, { kind: 'exclude', id: 'g2', at: T0 + 2 * DAY, ref: 'g1' }, next],
      memory,
    ).memory.get('word:gone');
    lines.push(
      `타. 이미 접힌 답을 거둔 뒤 같은 단위에 답함(부모 사건은 기기에 없음): 닿는 줄을 적어 둔 제외 → 그 줄만 기다림 ${noted.waitUnits.has('word:gone')} · 적어 두지 않은 제외 → 아무것도 얹지 않음 ${blind.waitAll} — 서버가 다시 접으면 ${server.stability.toFixed(2)}일(요약 값 ${summary().memory.get('word:gone').stability.toFixed(2)}일)`,
    );
    claim(
      '⑯타 부모를 찾지 못하는 제외가 밀려 있으면 그 줄(모르면 전부)을 기다린다',
      noted.waitUnits.has('word:gone') &&
        !noted.waitAll &&
        blind.waitAll &&
        blind.memory.get('word:gone').stability === summary().memory.get('word:gone').stability,
    );
  }
  note('⑯ 3 · 4차 검토와 구조 검토가 짚은 모서리\n   ' + lines.join('\n   '));
});
