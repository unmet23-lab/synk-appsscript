// 사건 2판의 꼴(events.mjs)과 어댑터(adapt.mjs)의 장면 — 계획 §2 · §3 · §11.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const R = await subject('record/events.mjs');
const A = await subject('record/adapt.mjs');
const { foldServer } = await subject('fold/server.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const T = Date.parse('2026-11-01T00:00:00.000Z');
let n = 0;
const make = (type, fields, minutes) => {
  n += 1;
  const atMs = T + minutes * 60_000;
  return R.createEvent(type, fields, {
    id: R.eventId(atMs, n % 10000, 'testtest'),
    atMs,
    revision: 1,
  });
};
const presentedFields = (overrides = {}) => ({
  setId: 's1',
  itemKey: 'i1',
  familyKey: 'f1',
  skillId: 'ko.listening.detail',
  difficulty: 1,
  responseFormat: 'single-choice',
  modality: 'listening',
  audioRequired: false,
  confounded: false,
  units: ['u1', 'u2'],
  firstExposure: true,
  editions: {
    params: 'params-1',
    memory: 'memory-1',
    ability: 'ability-1',
    select: 'select-1',
    index: 'index-0',
  },
  expected: { floor: 0.25, memory: 1, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u2', tier: 2, introduced: ['u2'] },
  ...overrides,
});
const entry = event => ({ event, key: event.id, atMs: Date.parse(event.at) });
const fold = events => A.foldEventsOfAll(events.map(entry));

test('2판 꼴 — 공통 칸(schema 2 · revision), 남는 칸 · 답 글 · 응답 시간은 받지 않는다', () => {
  const p = make('practice.presented', presentedFields(), 0);
  assert.equal(p.schema, 2);
  assert.equal(p.revision, 1);
  assert.match(p.id, /^a\.\d{13}\.\d{4}\.testtest$/);
  assert.throws(() => R.checkEvent({ ...p, answerText: '책' }), /칸/);
  assert.throws(() => R.checkEvent({ ...p, responseMs: 900 }), /칸/);
  assert.throws(() => R.checkEvent({ ...p, scope: { domain: 'LAB' } }), /칸/);
  assert.throws(() => R.checkEvent({ ...p, revision: -1 }), /revision/);
  assert.throws(() => R.checkEvent({ ...p, units: ['u1', 'u1'] }), /값/);
  assert.throws(
    () => R.checkEvent({ ...p, reason: { ...p.reason, slots: { note: 'x'.repeat(3000) } } }),
    /값/,
  );
  const a = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 1, verdict: 'unknown', errorTags: [] },
    1,
  );
  assert.equal(a.verdict, 'unknown', '「모르겠어요」');
  assert.doesNotThrow(() => make('unit.stated', { unit: 'u1', say: 'relearn' }, 2));
  assert.throws(() => make('unit.stated', { unit: '__proto__', say: 'known' }, 3), /값/);
});

test('부모 · 차례 — 답은 같은 2판 제시를, 답 번호는 이어서, 제외는 있는 사건을(옛 꼴도) 가리킨다', () => {
  const p = make('practice.presented', presentedFields(), 0);
  const a1 = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
    1,
  );
  const legacy = { schema: 1, id: 'old1', type: 'practice.attempted' };
  const find = id => (id === 'old1' ? legacy : null);
  assert.doesNotThrow(() =>
    R.checkLinks([p, a1, make('record.excluded', { targetId: 'old1' }, 2)], { find }),
  );
  assert.throws(() => R.checkLinks([a1], { find }), /부모/);
  const legacyParent = { schema: 1, id: p.id, type: 'practice.presented', at: p.at };
  assert.throws(
    () => R.checkLinks([a1], { find: () => legacyParent }),
    /부모/,
    '2판 답의 부모는 2판 제시',
  );
  const skip = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 3, verdict: 'correct', errorTags: [] },
    3,
  );
  assert.throws(() => R.checkLinks([p, skip], { find }), /차례/);
  assert.doesNotThrow(() =>
    R.checkLinks([skip], { find: id => (id === p.id ? p : null), attemptCount: () => 2 }),
  );
});

test('답 뒤에 본 도움도 「이어서 혼자 맞힌 수」를 끊는다(혼자 맞힘 → 해설 → 혼자 맞힘 = 1)', () => {
  const p1 = make('practice.presented', presentedFields({ itemKey: 'a', familyKey: 'fa' }), 0);
  const p2 = make('practice.presented', presentedFields({ itemKey: 'b', familyKey: 'fb' }), 10);
  const events = [
    p1,
    make(
      'practice.attempted',
      { presentationId: p1.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
      1,
    ),
    make(
      'practice.helped',
      { presentationId: p1.id, helpId: 'h', level: 'explanation', contentRef: 'c' },
      2,
    ),
    p2,
    make(
      'practice.attempted',
      { presentationId: p2.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
      11,
    ),
  ];
  const folded = fold(events);
  assert.deepEqual(
    [...folded].sort((a, b) => a.at - b.at).map(e => e.kind),
    ['answer', 'help', 'answer'],
  );
  const summary = foldServer(folded, createMemory(PARAMS), PARAMS);
  assert.equal(summary.ability.get('ko.listening.detail').streak, 1);
});

test('답 앞의 도움은 그 답을 도움받은 답으로, 답 보기 · 해설은 놓침으로 — 겨눈 단위에 실패를 적는다', () => {
  const p = make('practice.presented', presentedFields(), 0);
  const events = [
    p,
    make(
      'practice.helped',
      { presentationId: p.id, helpId: 'h', level: 'cue', contentRef: 'c' },
      1,
    ),
    make(
      'practice.attempted',
      { presentationId: p.id, attemptNo: 1, verdict: 'incorrect', errorTags: [] },
      2,
    ),
    make(
      'practice.helped',
      { presentationId: p.id, helpId: 'h2', level: 'answer', contentRef: 'c' },
      3,
    ),
    make(
      'practice.attempted',
      { presentationId: p.id, attemptNo: 2, verdict: 'correct', errorTags: [] },
      4,
    ),
  ];
  const [help, first, second] = fold(events);
  assert.equal(help.kind, 'help');
  assert.equal(help.at, T + 60_000, '만남의 시각 = 첫 도움');
  assert.deepEqual(first.answer, {
    correct: false,
    unknown: false,
    assisted: true,
    answerShown: false,
    assessable: true,
    target: 'u2',
  });
  assert.equal(second.answer.answerShown, true);
  const q = make('practice.presented', presentedFields(), 10);
  const explained = fold([
    q,
    make(
      'practice.helped',
      { presentationId: q.id, helpId: 'e', level: 'explanation', contentRef: 'c' },
      11,
    ),
    make(
      'practice.attempted',
      { presentationId: q.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
      12,
    ),
  ]).find(e => e.kind === 'answer');
  assert.equal(explained.answer.answerShown, true, '해설을 본 뒤 맞힘은 놓침(설계 §3-2)');
});

test('소리가 필요한 문항 — 전달이 확인된 뒤의 답만 판정, 거둔 전달은 증거가 아니다', () => {
  const p = make('practice.presented', presentedFields({ audioRequired: true }), 0);
  const delivered = make('practice.delivery', { presentationId: p.id, audio: 'completed' }, 1);
  const attempt = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
    2,
  );
  assert.equal(fold([p, delivered, attempt])[0].answer.assessable, true);
  const pulled = make('record.excluded', { targetId: delivered.id }, 3);
  assert.equal(fold([p, delivered, attempt, pulled])[0].answer.assessable, false);
  const early = make('practice.presented', presentedFields({ audioRequired: true }), 10);
  const answeredFirst = make(
    'practice.attempted',
    { presentationId: early.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
    11,
  );
  const lateAudio = make('practice.delivery', { presentationId: early.id, audio: 'completed' }, 12);
  assert.equal(
    fold([early, answeredFirst, lateAudio])[0].answer.assessable,
    false,
    '답 뒤에 끝난 소리는 그 답을 되살리지 않는다',
  );
});

test('제외 — 제시를 거두면 그 답 전부, 거둔 답도 만남으로 남는다 · 거둔 장부는 없던 것', () => {
  const p = make('practice.presented', presentedFields(), 0);
  const a = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
    1,
  );
  const x = make('record.excluded', { targetId: p.id }, 2);
  const folded = fold([p, a, x]);
  assert.deepEqual(
    folded.map(e => [e.kind, e.ref ?? null]),
    [
      ['answer', null],
      ['exclude', a.id],
    ],
  );
  const summary = foldServer(folded, createMemory(PARAMS), PARAMS);
  assert.equal(summary.memory.size, 0, '근거는 아니다');
  assert.equal(summary.met.get('f1'), T + 60_000, '만남은 남는다');
  const c = make('record.carried', { families: { f1: 1 }, items: {}, after: null }, 3);
  assert.equal(fold([c, make('record.excluded', { targetId: c.id }, 4)]).length, 0);
});

test('옛 꼴 — measure로 읽고, firstExposure가 true가 아닌 제시의 답만 측정에서 뺀다(그 제시의 첫 만남 앞의 장부 만남)', () => {
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const at = m => new Date(T + m * 60_000).toISOString();
  const measure = {
    skillId: 'ko.reading.detail',
    modality: 'reading',
    difficulty: 2,
    familyKey: 'f9',
    audioRequired: false,
    confounded: false,
  };
  const p = {
    schema: 1,
    id: 'p',
    scope,
    at: at(0),
    recordedAt: at(0),
    type: 'practice.presented',
    decisionId: 'd',
    taskId: 't',
    taskVersion: 'v',
    itemKey: 'old',
    conceptIds: ['ko.reading.detail'],
    firstExposure: false,
    measure,
  };
  const a = {
    schema: 1,
    id: 'a',
    scope,
    at: at(1),
    recordedAt: at(1),
    type: 'practice.attempted',
    presentationId: 'p',
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  };
  const entries = [p, a].map((event, i) => ({
    event,
    key: A.serverKey(i + 1, event),
    atMs: Date.parse(event.at),
  }));
  const [prior, answer] = A.foldEventsOfAll(entries);
  assert.equal(prior.kind, 'carry');
  assert.equal(prior.after, T + 60_000, '그 제시의 첫 만남과 같은 시각');
  assert.ok(prior.id < answer.id, '같은 시각에서 먼저 선다');
  assert.ok(A.isPrior(prior));
  assert.equal(answer.item.responseFormat, 'unknown', '꼴이 없으면 unknown');
  assert.equal(A.serverKey(7, a), `s.${String(T + 60_000).padStart(13, '0')}.000000000000007`);
});

test('문항 색인이 먼저다 — 색인의 단위 · 계열, 없으면 사건에 적힌 단위, 색인에도 measure에도 없는 옛 제시는 접지 않는다', () => {
  const p = make('practice.presented', presentedFields(), 0);
  const index = {
    edition: 'tags-2',
    lookup: key =>
      key === 'i1'
        ? {
            familyKey: 'f1',
            skillId: 'ko.listening.detail',
            difficulty: 1,
            responseFormat: 'single-choice',
            units: ['w9'],
          }
        : null,
  };
  assert.deepEqual(A.itemOf(p, index).units, ['w9']);
  assert.deepEqual(A.itemOf(p).units, ['u1', 'u2']);
  assert.equal(A.itemOf({ schema: 1, itemKey: 'x', firstExposure: true }), null);
});

test('2판 — firstExposure false(제품만 아는 앞선 노출)는 그 제시의 첫 만남 앞의 장부 만남이라 측정에 안 들고, null · true는 읽지 않는다', () => {
  const memory = createMemory(PARAMS);
  const skillOf = firstExposure => {
    const p = make(
      'practice.presented',
      presentedFields({ itemKey: 'x', familyKey: 'fx', firstExposure }),
      0,
    );
    const a = make(
      'practice.attempted',
      { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
      1,
    );
    const folded = fold([p, a]);
    return {
      folded,
      a,
      skill: foldServer(folded, memory, PARAMS).ability.get('ko.listening.detail'),
    };
  };
  const seen = skillOf(false);
  const [prior, answer] = seen.folded;
  assert.equal(prior.kind, 'carry');
  assert.deepEqual(prior.families, ['fx']);
  assert.equal(prior.after, Date.parse(seen.a.at), '그 제시의 첫 만남(첫 답)과 같은 시각');
  assert.equal(prior.at, prior.after);
  assert.ok(
    prior.id < answer.id && prior.id.endsWith('~'),
    '같은 시각에서 그 첫 만남 바로 앞에 선다',
  );
  assert.equal(seen.skill?.n ?? 0, 0, '이미 본 지문의 답은 측정이 아니다');
  for (const firstExposure of [true, null]) {
    const fresh = skillOf(firstExposure);
    assert.deepEqual(
      fresh.folded.map(e => e.kind),
      ['answer'],
      `${firstExposure}: 장부 만남 없음`,
    );
    assert.equal(fresh.skill.n, 1, `${firstExposure}: 첫 만남의 혼자 맞힌 답은 측정`);
  }
});

test('2판 arm — 제품이 순서를 정한 제시는 host(시험 형식 · 진단 · 레슨 안 문항)', () => {
  const p = make(
    'practice.presented',
    presentedFields({
      arm: 'host',
      reason: {
        code: 'host.order',
        slots: {},
        evidence: {},
        target: null,
        tier: 2,
        introduced: [],
      },
    }),
    0,
  );
  assert.doesNotThrow(() => R.checkEvent(p));
  assert.throws(() => R.checkEvent({ ...p, arm: 'manual' }));
});

test('장부 만남은 그 제시의 첫 만남 바로 앞에 선다 — 서버가 같은 시각으로 누른 묶음에서 다른 제시에 먼저 낸 답의 첫 만남을 빼앗지 않는다(아르곤 끝 판 B1)', () => {
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const at = m => new Date(T + m * 60_000).toISOString();
  const measure = {
    skillId: 'ko.reading.detail',
    modality: 'reading',
    difficulty: 1,
    familyKey: 'fz',
    audioRequired: false,
    confounded: false,
  };
  const shown = (id, n, firstExposure) => ({
    schema: 1,
    id,
    scope,
    at: at(n),
    recordedAt: at(n),
    type: 'practice.presented',
    decisionId: `d${id}`,
    taskId: 't',
    taskVersion: 'v',
    itemKey: `i${id}`,
    conceptIds: ['ko.reading.detail'],
    firstExposure,
    measure,
  });
  const answered = (id, n, presentationId) => ({
    schema: 1,
    id,
    scope,
    at: at(n),
    recordedAt: at(n),
    type: 'practice.attempted',
    presentationId,
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  });
  // P1(앞선 노출 있음)과 P2(처음)가 같은 계열 — P2에 먼저 답했고(A2), 그 뒤 P1에 답했다(A1). 서버가 둘을 같은 받은 시각으로 눌렀다.
  const events = [
    shown('p1', 0, false),
    shown('p2', 1, true),
    answered('a2', 2, 'p2'),
    answered('a1', 3, 'p1'),
  ];
  const pressed = T + 10 * 60_000;
  const entries = events.map((event, i) => ({
    event,
    key: A.serverKey(i + 1, event),
    atMs: pressed,
  }));
  const folded = A.foldEventsOfAll(entries);
  const summary = foldServer(folded, createMemory(PARAMS), PARAMS);
  assert.equal(summary.ability.get('ko.reading.detail').n, 1, 'P2의 혼자 맞힌 첫 답은 측정이다');
  const order = [...folded].sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1)).map(e => e.kind);
  assert.deepEqual(order, ['answer', 'carry', 'answer'], '장부 만남은 A2 뒤 · A1 바로 앞');
});

test('묶음 나누기 — 부모가 없거나 답 차례가 어긋난 사건은 그것과 자손만 빼고 나머지를 받는다(Fable 끝 판 P1)', () => {
  const p = make('practice.presented', presentedFields(), 0);
  const ghost = 'a.1793491200000.0000.ghost000';
  const orphan = make(
    'practice.attempted',
    { presentationId: ghost, attemptNo: 1, verdict: 'correct', errorTags: [] },
    1,
  );
  const pulled = make('record.excluded', { targetId: orphan.id }, 2);
  const skipped = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 2, verdict: 'correct', errorTags: [] },
    3,
  );
  const first = make(
    'practice.attempted',
    { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] },
    4,
  );
  const { ok, rejected } = R.partitionLinks([p, orphan, pulled, skipped, first], {
    find: () => null,
  });
  assert.deepEqual(
    ok.map(e => e.id),
    [p.id, first.id],
    '건너뛴 차례 뒤에도 맞는 차례의 답은 받는다',
  );
  assert.deepEqual(rejected.sort(), [orphan.id, pulled.id, skipped.id].sort());
  assert.throws(() => R.checkLinks([p, orphan], { find: () => null }), /부모/);
  assert.throws(() => R.partitionLinks([p, p], { find: () => null }), /같은 번호/);
});

test('응답(feedback.given)의 부모는 마침이다 — 결정을 함께 실으면 그 마침의 결정과 같아야 한다(아르곤 끝 판 C1)', () => {
  const decided = make('decision.made', { experienceId: 'world-practice', variant: 'v1' }, 0);
  const completed = make(
    'experience.completed',
    { decisionId: decided.id, experienceId: 'world-practice', variant: 'v1' },
    1,
  );
  const ok = make(
    'feedback.given',
    { completionId: completed.id, decisionId: decided.id, value: 'helpful' },
    2,
  );
  assert.doesNotThrow(() => R.checkLinks([decided, completed, ok], { find: () => null }));
  const wrongDecision = make(
    'feedback.given',
    { completionId: completed.id, decisionId: 'a.1793491200000.0000.other000', value: 'helpful' },
    3,
  );
  assert.throws(
    () => R.checkLinks([decided, completed, wrongDecision], { find: () => null }),
    /부모/,
  );
  const ghost = make(
    'feedback.given',
    { completionId: 'a.1793491200000.0000.ghost000', decisionId: completed.id, value: 'helpful' },
    4,
  );
  assert.throws(
    () => R.checkLinks([decided, completed, ghost], { find: () => null }),
    /부모/,
    '결정 칸에 마침 번호를 넣어도 유령 마침은 못 지난다',
  );
});
