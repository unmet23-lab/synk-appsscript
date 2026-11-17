// 예상 급수의 근거 셈의 잎(record/first.mjs — 단계 4 계획 §21-23의 2, 설계 주인 11-17 답 1 · 2). 만남 줄(meet · carry)에서 계열의 첫
// 만남을 접기 차례로 고르고, 그 첫 만남이 혼자 낸 채점된 답이고 그 게임의 판이고 창 안일 때만 센다. 줄과 판 번호를 손으로 지어 규칙마다
// 본다. 진짜 코치와 메모리 서버로 맞대는 시험은 test/coach/first-answers.test.mjs다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { firstAnswersOf, firstAnswersOfStore, soloLead } = await subject('record/first.mjs');
const { setIdOf } = await subject('coach/set-id.mjs');

const meet = (
  family,
  at,
  key,
  { grade = 'good', unaided = true, skill = 'ko.listening.detail' } = {},
) => ({
  kind: 'meet',
  family,
  item: `it-${family}`,
  skill,
  at,
  key,
  grade,
  unaided,
  difficulty: 1,
  responseFormat: 'single-choice',
  unknownOption: false,
  bits: 1,
});
const carry = (family, at, key) => ({ kind: 'carry', family, at, key });
const SET = setIdOf('world-mock', 1, 'abcdef', 1);
const OTHER = setIdOf('world-diagnostic', 1, 'abcdef', 1);

test('첫 만남은 접기 차례(시각 → 사건 번호)로 고른다 — 장부 만남은 어떤 만남보다 먼저이고, 줄이 든 차례는 상관없다', () => {
  assert.equal(
    soloLead([meet('f', 10, 'b'), meet('f', 10, 'a', { grade: null })]),
    null,
    '같은 시각이면 번호가 작은 쪽(지운 답)이 첫 만남',
  );
  assert.equal(soloLead([meet('f', 20, 'b'), meet('f', 10, 'a')]).key, 'a');
  assert.equal(
    soloLead([meet('f', 5, 'a'), carry('f', null, 'c')]),
    null,
    '처음 옮긴 장부 만남(at null)이 먼저',
  );
  assert.equal(
    soloLead([meet('f', 5, 'a'), carry('f', 9, 'c')]).key,
    'a',
    '장부를 뜬 때보다 이른 답은 첫 만남',
  );
  assert.equal(
    soloLead([carry('f', 3, 'c'), meet('f', 5, 'a')]),
    null,
    '장부를 뜬 뒤의 답은 첫 만남이 아니다',
  );
  assert.equal(
    soloLead([meet('f', 5, 'h', { unaided: false, grade: null }), meet('f', 6, 'a')]),
    null,
    '도움이 먼저',
  );
  assert.equal(
    soloLead([meet('f', 5, 'a', { grade: null }), meet('f', 6, 'b')]),
    null,
    '채점이 빈 답이 먼저(지운 답 · 거둔 제시 · 판정 못 한 답)',
  );
  assert.equal(
    soloLead([meet('f', 5, 'a', { unaided: false, grade: 'good' })]),
    null,
    '도움을 받은 답',
  );
  assert.equal(
    soloLead([meet('f', 5, 'a', { grade: 'again' })]).key,
    'a',
    '틀린 답도 혼자 낸 채점된 답',
  );
  assert.equal(
    soloLead([{ kind: 'unit', unit: 'u', at: 1, key: 'x', grade: 'good' }]),
    null,
    '단위 줄은 만남이 아니다',
  );
  assert.equal(soloLead([]), null);
  assert.equal(soloLead(undefined), null);
});

test('셈 — 그 게임의 판 · 창 안의 lead만 능력마다 센다(창은 lead를 고른 뒤에 건다), 능력 id 차례의 보통 객체', () => {
  const families = [
    [meet('a', 100, 'k1', { skill: 'ko2.reading.detail' })],
    [meet('b', 100, 'k2')],
    [meet('c', 100, 'k3')], // 다른 게임의 판
    [meet('d', 100, 'k4')], // 판 번호가 없다(옛 꼴 제시)
    [meet('e', 100, 'k5')], // 꼴이 틀린 판 번호
    [meet('g', 40, 'k6'), meet('g', 100, 'k7')], // 첫 만남이 창 앞 — 창 안의 뒤 답은 근거가 아니다
    [meet('h', 60, 'k8')], // 창 시작과 같은 시각 — 든다
    [meet('i', 59, 'k9')], // 창 시작 1밀리초 앞
  ];
  const sets = {
    k1: SET,
    k2: SET,
    k3: OTHER,
    k5: 'set.world-mock.x.y.z',
    k6: SET,
    k7: SET,
    k8: SET,
    k9: SET,
  };
  const out = firstAnswersOf(families, key => sets[key] ?? null, { game: 'world-mock', since: 60 });
  assert.deepEqual(out, { 'ko.listening.detail': 2, 'ko2.reading.detail': 1 });
  assert.deepEqual(Object.keys(out), ['ko.listening.detail', 'ko2.reading.detail'], '능력 id 차례');
  assert.deepEqual(
    firstAnswersOf(families, key => sets[key] ?? null, { game: 'world-diagnostic', since: 0 }),
    { 'ko.listening.detail': 1 },
  );
  assert.deepEqual(
    firstAnswersOf([], () => SET, { game: 'world-mock', since: 0 }),
    {},
  );
});

test('서버 셈 — 답 사건에서 제시 사건으로 가 판 번호를 읽는다(사건 번호 묶음 둘), 찾지 못한 답 · 답 사건에 실린 판 번호는 근거가 아니다', async () => {
  const calls = [];
  const records = new Map(
    [
      { id: 'ans1', presentationId: 'p1' },
      { id: 'p1', type: 'practice.presented', setId: SET },
      { id: 'ans2', presentationId: 'p2' },
      { id: 'p2', type: 'practice.presented', setId: OTHER },
      { id: 'ans3', setId: SET }, // 제시가 없는 사건 — 그 사건의 판 번호를 읽지 않는다
      { id: 'ans4', presentationId: 'p4' }, // 제시를 찾지 못함(바닥 아래)
    ].map(event => [event.id, { seq: 1, receivedMs: 1, event }]),
  );
  const store = {
    meetRows: async () =>
      new Map([
        ['a', [meet('a', 100, 'ans1')]],
        ['b', [meet('b', 100, 'ans2')]],
        ['c', [meet('c', 100, 'ans3', { skill: 'ko.reading.main' })]], // 능력이 달라 답 사건의 판 번호를 읽으면 셈이 갈린다
        ['d', [meet('d', 100, 'a.1763000000000.s000000000000001')]], // 옛 꼴 답 — 접기 번호가 사건 번호가 아니다
        ['e', [meet('e', 10, 'ans1')]], // 창 앞 — 찾지 않는다
        ['f', [meet('f', 100, 'ans4')]],
        ['g', [meet('g', 100, 'h1', { unaided: false, grade: null })]], // 도움 — 찾지 않는다
      ]),
    eventsByIds: async ids => {
      calls.push([...ids].sort());
      return new Map(ids.filter(id => records.has(id)).map(id => [id, records.get(id)]));
    },
  };
  assert.deepEqual(await firstAnswersOfStore(store, { game: 'world-mock', since: 50 }), {
    'ko.listening.detail': 1,
  });
  assert.deepEqual(calls, [
    ['a.1763000000000.s000000000000001', 'ans1', 'ans2', 'ans3', 'ans4'],
    ['p1', 'p2', 'p4'],
  ]);
  calls.length = 0;
  assert.deepEqual(
    await firstAnswersOfStore(
      { ...store, meetRows: async () => new Map() },
      { game: 'world-mock', since: 0 },
    ),
    {},
  );
  assert.deepEqual(calls, [], '근거가 될 lead가 없으면 사건을 찾지 않는다');
});
