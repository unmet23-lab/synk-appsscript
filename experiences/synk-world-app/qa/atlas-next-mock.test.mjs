// 4-4d 시험 형식 연습 새 판(단계4_계획 §21-23의 1) — world-mock-next.mjs. 고르기(측정용 만남 · 세트 · 모름 · 기록이 다 왔는가), 진행(제시 · 전달 ·
// 답 · 영역 닫기 · 시간 · 그만두기 · 판 닫기, PRESENTATION_GONE · DISPOSED), 끝 한 장의 「다음 연습」(그날 낼 것이 있는 짧은 연습)을 본다. 진짜 엔진
// 코치(손님 메모리 저장소)로 영역 도중 새벽 4시를 넘긴 판과 영역 사이 31분 쉼을 돌린다(카본 설계 검토 B1 · 설계 검토 Fable F8). 홈 코치와 시험 형식
// 코치는 앱처럼 같은 저장소 열쇠로 열어 한 호스트를 나눠 쓴다. 변형 시험(qa/position-mutants.mjs)은 깬 사본을 SYNK_MOCK_NEXT_MODULE로 넘긴다.
// 그 밖에는 원본이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { banksOf, homeBanksOf } from '../world-atlas-next.mjs';
import { createPracticeNextSession } from '../world-practice-next.mjs';
import { nextPlay } from '../world-exam-form.mjs';

const M = await import(
  process.env.SYNK_MOCK_NEXT_MODULE
    ? pathToFileURL(process.env.SYNK_MOCK_NEXT_MODULE).href
    : new URL('../world-mock-next.mjs', import.meta.url).href
);
const { selectMockNext, createMockNextSession, todayPractice, MOCK_NEXT_POLICY } = M;

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const mock = worldPosition.mock;
const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 17, 1, 0, 0); // 11-17 10:00 KST

// ── 고르기 ──
const allFresh = pool => pool.map(() => ({ seen: false, met: false }));
const choose = (exposures, extra = {}) =>
  selectMockNext({
    select: mock.selectMock,
    forms: mock.forms,
    exam: 'topik1',
    pool: mock.pool,
    exposures,
    complete: true,
    ...extra,
  });
const picked = plan => plan.sections.flatMap(row => row.items);

test('고르기 — 기록이 다 오지 않았으면 열지 않는다(21-3) · 만남 줄이 풀과 어긋나면 던진다', () => {
  const out = choose(allFresh(mock.pool), { complete: false });
  assert.equal(out.status, 'unavailable');
  assert.equal(out.reason, 'history.incomplete');
  assert.deepEqual(out.sections, []);
  assert.equal(out.grade, null);
  assert.throws(() => choose(allFresh(mock.pool).slice(1)), TypeError);
  assert.throws(() => choose(allFresh(mock.pool), { audioAvailable: 'yes' }), TypeError);
});

test('고르기 — 구성은 지금 판 selectMock 그대로이고, 측정용 만남이 없는 문항(met 거짓)만 고른다. 모르면(null) 처음이 아니다', () => {
  const first = choose(allFresh(mock.pool));
  assert.equal(first.status, 'ready');
  assert.equal(first.reason, null);
  const same = mock.selectMock({ forms: mock.forms, exam: 'topik1', pool: mock.pool, seen: () => false, audioAvailable: true });
  assert.deepEqual(
    picked(first).map(item => item.id),
    picked(same).map(item => item.id),
    '모두 처음이면 지금 판 고르기와 같은 문항',
  );
  const single = picked(first).find(item => !item.setId);
  const unknown = picked(first).filter(item => !item.setId && item !== single)[0];
  const exposures = mock.pool.map(item =>
    item.id === single.id ? { seen: true, met: true } : item.id === unknown.id ? { seen: null, met: null } : { seen: false, met: false },
  );
  const after = picked(choose(exposures)).map(item => item.id);
  assert.ok(!after.includes(single.id), '측정용으로 만난 문항은 고르지 않는다');
  assert.ok(!after.includes(unknown.id), '모르는 문항은 처음 보는 문항이 아니다');
  // 띄우기만 한 문항(seen 참 · met 거짓)은 아직 처음이다 — 측정용 만남으로 가른다.
  const shown = mock.pool.map(item => (item.id === single.id ? { seen: true, met: false } : { seen: false, met: false }));
  assert.ok(picked(choose(shown)).some(item => item.id === single.id));
});

test('고르기 — 세트는 한 문항이라도 만났거나 모르면 통째로 처음이 아니다', () => {
  const first = choose(allFresh(mock.pool));
  const setItem = picked(first).find(item => item.setId);
  assert.ok(setItem, '세트 문항이 든 판');
  const mates = mock.pool.filter(item => item.setId === setItem.setId);
  assert.ok(mates.length > 1);
  for (const value of [true, null]) {
    const exposures = mock.pool.map(item => (item.id === mates[1].id ? { seen: value, met: value } : { seen: false, met: false }));
    assert.ok(
      !picked(choose(exposures)).some(item => item.setId === setItem.setId),
      `세트의 한 문항이 ${value}이면 그 세트를 고르지 않는다`,
    );
  }
});

test('고르기 — 모두 만났으면 열지 않고 까닭은 mock.none이다 · 소리를 끈 날은 읽기만', () => {
  const none = choose(mock.pool.map(() => ({ seen: true, met: true })));
  assert.equal(none.status, 'unavailable');
  assert.equal(none.reason, 'mock.none');
  const quiet = choose(allFresh(mock.pool), { audioAvailable: false });
  assert.deepEqual(
    quiet.sections.map(row => [row.section, row.status]),
    [
      ['listening', 'audio-off'],
      ['reading', 'ready'],
    ],
  );
});

// ── 진행(가짜 코치 — 부른 차례를 본다) ──
const choicesOf = id => [
  { id: `${id}.1`, label: '하나' },
  { id: `${id}.2`, label: '둘' },
];
const fakeItem = (id, modality, extra = {}) => ({
  id,
  itemKey: `test.${id}.v1`,
  skillId: `ko.${modality}.a`,
  modality,
  choices: choicesOf(id),
  correctId: `${id}.1`,
  ...extra,
});
// 듣기 셋(l1 · l2는 한 세트 · 허용 재생 1, l3은 허용 2)과 읽기 둘.
const SECTIONS = () => [
  {
    section: 'listening',
    minutes: 10,
    items: [
      fakeItem('l1', 'listening', { setId: 's1', plays: 1 }),
      fakeItem('l2', 'listening', { setId: 's1', plays: 1 }),
      fakeItem('l3', 'listening', { plays: 2 }),
    ],
  },
  { section: 'reading', minutes: 10, items: [fakeItem('r1', 'reading'), fakeItem('r2', 'reading')] },
];
const fakePlays = { allowedPlays: item => item.plays ?? null, nextPlay };
function fakeCoach({ disposeAfterAnswers = Infinity } = {}) {
  const calls = [];
  let pids = 0;
  let answers = 0;
  const gone = new Set();
  let disposed = false;
  const closed = () => Object.assign(new Error('closed'), { code: 'DISPOSED' });
  const guard = pid => {
    if (disposed) throw closed();
    if (gone.has(pid)) {
      gone.delete(pid);
      throw Object.assign(new Error('gone'), { code: 'PRESENTATION_GONE' });
    }
  };
  return {
    calls,
    gone: pid => gone.add(pid),
    dispose: () => (disposed = true),
    present(item, context = {}) {
      if (disposed) throw closed();
      pids += 1;
      const pid = `p${pids}`;
      calls.push(['present', item.id, pid, ...(context.firstExposure === false ? ['not-first'] : [])]);
      return pid;
    },
    delivery(pid, { audio }) {
      guard(pid);
      calls.push(['delivery', pid, audio]);
      return { id: `d-${pid}` };
    },
    answer(pid, result) {
      guard(pid);
      calls.push(['answer', pid, result.assessable, result.correct, ...(result.reason ? [result.reason] : [])]);
      answers += 1;
      if (answers >= disposeAfterAnswers) disposed = true;
      return {
        eventId: `a-${pid}`,
        verdict: result.assessable ? (result.correct ? 'correct' : 'incorrect') : null,
        evidence: Promise.resolve({ stored: true, independent: result.assessable && result.correct === true, assisted: false }),
      };
    },
    finishSet(options) {
      if (disposed) throw closed();
      calls.push(['finishSet', options.kind, ...(options.record === false ? [false] : [])]);
      return { setId: 'set.world-mock.1', folded: Promise.resolve(true) };
    },
  };
}
const since = (coach, mark) => coach.calls.slice(mark);

test('진행 — 영역 시작이 첫 문항을 내고 처음 여는 문항만 낸다 · 듣기는 끝까지 듣기 전에 답하지 않는다 · 세트 대본 하나를 함께 듣고 허용 재생 수까지만 들린다', async () => {
  const coach = fakeCoach();
  let now = T0;
  const session = createMockNextSession({ coach, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => now });
  assert.equal(session.current.between, true, '시작 전은 영역 사이');
  assert.equal(coach.calls.length, 0, '시작 전에는 아무것도 내지 않는다');
  session.start();
  assert.deepEqual(coach.calls, [['present', 'l1', 'p1']]);
  assert.equal(session.answer('l1.1'), null, '듣기 전');
  assert.equal(session.play(), 'first');
  assert.equal(session.play(), false, '한 번에 소리 하나');
  session.go(1);
  session.go(0);
  session.go(1);
  assert.equal(coach.calls.filter(call => call[0] === 'present').length, 2, '다시 연 문항은 다시 내지 않는다');
  // 첫 재생이 끝나면 열어 둔 세트 문항 모두에 끝까지 들은 전달을 남긴다(대본 하나).
  assert.equal(session.delivery('completed'), true);
  assert.deepEqual(since(coach, 1), [
    ['delivery', 'p1', 'pending'],
    ['present', 'l2', 'p2'],
    ['delivery', 'p1', 'completed'],
    ['delivery', 'p2', 'completed'],
  ]);
  assert.equal(session.play(), false, '세트 대본의 허용 1회를 다 들었다(closed)');
  assert.deepEqual(session.answer('l2.2'), { verdict: 'incorrect' });
  assert.equal(session.answer('l2.1'), null, '첫 답은 바꾸지 않는다');
  session.go(2);
  assert.equal(session.play(), 'first');
  session.delivery('completed');
  assert.equal(session.play(), 'allowed', '허용 2회짜리는 한 번 더');
  session.delivery('completed');
  assert.equal(session.play(), false);
  assert.throws(() => session.answer('nope'), TypeError, '모르는 보기는 받지 않는다');
  assert.deepEqual(session.answer('l3.1'), { verdict: 'correct' });
  assert.equal(session.answer('nope'), null, '답한 문항은 다시 받지 않는다');
  await session.settled();
  const rows = session.results()[0].items;
  assert.deepEqual(
    rows.map(row => [row.itemId, row.opened, row.verdict, row.independent]),
    [
      ['l1', true, null, false],
      ['l2', true, 'incorrect', false],
      ['l3', true, 'correct', true],
    ],
  );
  assert.deepEqual(rows[2].plays, { allowed: 2, completed: 2 });
});

test('진행 — 제시가 사라지면(PRESENTATION_GONE) 그 문항을 다시 내고 끝까지 들은 전달을 이어 남긴 뒤 답한다 · 다시 낸 뒤에도 허용 재생 수 그대로', async () => {
  const coach = fakeCoach();
  const session = createMockNextSession({ coach, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  session.start();
  session.play();
  session.delivery('completed');
  coach.gone('p1');
  const mark = coach.calls.length;
  assert.deepEqual(session.answer('l1.1'), { verdict: 'correct' });
  assert.deepEqual(since(coach, mark), [
    ['present', 'l1', 'p2'],
    ['delivery', 'p2', 'completed'],
    ['answer', 'p2', true, true],
  ]);
  assert.ok(!coach.calls.some(call => call.includes('not-first')), '다시 낸 제시는 처음인지 코치가 정한다(「처음이 아니다」를 넘기지 않는다)');
  assert.equal(session.represented, 1);
  assert.equal(session.play(), false, '다시 낸 뒤에도 그 대본의 셈 그대로 — 더 들을 수 없다');
  await session.settled();
  assert.equal(session.results()[0].items[0].independent, true);
  // 세트의 다른 문항: 열 때 다 들은 대본의 전달을 한 번 남기고, 그 제시가 사라지면 이어 남긴 뒤 답한다.
  session.go(1);
  coach.gone('p3');
  const again = coach.calls.length;
  session.answer('l2.1');
  assert.deepEqual(since(coach, again), [
    ['present', 'l2', 'p4'],
    ['delivery', 'p4', 'completed'],
    ['answer', 'p4', true, true],
  ]);
});

test('진행 — 영역을 닫으면 열어 보고 답하지 않은 문항은 평가할 수 없는 답(들었으면 unanswered · 못 들었으면 audio)이고, 열어 보지 않은 문항은 남기지 않는다', async () => {
  const coach = fakeCoach();
  const session = createMockNextSession({ coach, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  session.start();
  session.play();
  session.delivery('completed');
  session.go(2); // l3 — 듣지 않음
  coach.gone('p1'); // 닫을 때 사라진 제시도 다시 내어 남긴다
  const mark = coach.calls.length;
  session.finishSection();
  assert.deepEqual(since(coach, mark), [
    ['present', 'l1', 'p3'],
    ['delivery', 'p3', 'completed'],
    ['answer', 'p3', false, null, 'unanswered'],
    ['answer', 'p2', false, null, 'audio'],
  ]);
  assert.ok(!coach.calls.some(call => call[1] === 'l2'), '열어 보지 않은 l2는 남기지 않는다');
  assert.equal(session.parts[0].ended, 'submitted');
  assert.equal(session.current.between, true);
  assert.equal(session.current.started, false, '다음 영역은 학생이 시작할 때 시계가 돈다');
});

test('진행 — 시간이 다 되면 그 영역을 닫는다(time) · 닫힌 영역에는 답하지 않는다', () => {
  const coach = fakeCoach();
  let now = T0;
  const session = createMockNextSession({ coach, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => now });
  session.start();
  session.go(2);
  now += 10 * MIN;
  const view = session.current;
  assert.equal(view.between, true);
  assert.equal(view.ended, 'time');
  assert.deepEqual(
    coach.calls.filter(call => call[0] === 'answer').map(call => call.slice(2)),
    [
      [false, null, 'audio'],
      [false, null, 'audio'],
    ],
  );
  assert.equal(session.answer('l1.1'), null);
  session.finishSection();
  session.start();
  assert.equal(session.current.section, 'reading');
});

test('진행 — 영역을 닫는 도중 코치가 닫히면(DISPOSED) 그 뒤로 아무것도 남기지 않고 disposed가 참이며 판을 닫지 않는다', () => {
  const coach = fakeCoach({ disposeAfterAnswers: 1 });
  const session = createMockNextSession({ coach, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  session.start();
  session.go(2);
  session.finishSection();
  assert.equal(coach.calls.filter(call => call[0] === 'answer').length, 1, '닫힌 뒤의 문항은 남기지 않는다');
  assert.equal(session.disposed, true);
  assert.equal(session.current, null);
  assert.equal(session.start(), null);
  assert.equal(session.finish(), null);
  assert.equal(session.stop(), null);
  assert.equal(coach.calls.filter(call => call[0] === 'finishSet').length, 0);
  // 제시 자리에서 닫혀도 같다.
  const early = fakeCoach();
  const other = createMockNextSession({ coach: early, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  early.dispose();
  other.start();
  assert.equal(other.disposed, true);
});

test('진행 — 끝까지 하면 판을 한 번 닫는다(kind mock) · 그만두면 기록 없이 한 번 · 문항을 내기 전이면 닫지 않는다', async () => {
  const coach = fakeCoach();
  const session = createMockNextSession({ coach, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  session.start();
  for (const [index, choice] of [
    [0, 'l1.1'],
    [1, 'l2.1'],
    [2, 'l3.1'],
  ]) {
    session.go(index);
    if (!session.current.heard && session.play()) session.delivery('completed');
    session.answer(choice);
  }
  session.finishSection();
  session.start();
  session.answer('r1.1');
  session.go(1);
  session.answer('r2.2');
  session.finishSection();
  assert.equal(session.finished, true);
  await session.settled();
  assert.ok(session.finish());
  session.finish();
  assert.deepEqual(
    coach.calls.filter(call => call[0] === 'finishSet'),
    [['finishSet', MOCK_NEXT_POLICY.kind]],
    '판은 한 번 닫는다',
  );
  // 그만두기 — 열어 본 문항은 답하지 않음으로 남기고 판을 기록 없이 한 번 닫는다(손님 요약이 그 답으로 다시 접히게).
  const quit = fakeCoach();
  const stopped = createMockNextSession({ coach: quit, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  stopped.start();
  assert.ok(stopped.stop()?.folded);
  stopped.finish({ record: true });
  assert.deepEqual(
    quit.calls.filter(call => call[0] !== 'present'),
    [
      ['answer', 'p1', false, null, 'audio'],
      ['finishSet', 'mock', false],
    ],
  );
  assert.equal(stopped.presented, true, '문항을 낸 판(그만둔 판도 판 기록에 센다 — §21-23의 3)');
  // 문항을 내기 전이면 닫지 않는다.
  const idle = fakeCoach();
  const none = createMockNextSession({ coach: idle, sections: SECTIONS(), exam: 'topik1', plays: fakePlays, clock: () => T0 });
  assert.equal(none.stop(), null);
  assert.equal(none.presented, false);
  assert.equal(idle.calls.length, 0);
});

test('진행 — 잘못 넘긴 영역 · 문항 · 재생 셈은 받지 않는다', () => {
  const coach = fakeCoach();
  assert.throws(() => createMockNextSession({ coach, sections: [], plays: fakePlays }), TypeError);
  assert.throws(() => createMockNextSession({ coach, sections: SECTIONS() }), TypeError);
  assert.throws(
    () => createMockNextSession({ coach, sections: [{ section: 'writing', minutes: 5, items: [fakeItem('w1', 'reading')] }], plays: fakePlays }),
    TypeError,
  );
  assert.throws(
    () => createMockNextSession({ coach, sections: [{ section: 'reading', minutes: 5, items: [fakeItem('l9', 'listening')] }], plays: fakePlays }),
    TypeError,
    '영역과 문항의 영역이 다르다',
  );
  assert.throws(() => createMockNextSession({ coach: {}, sections: SECTIONS(), plays: fakePlays }), TypeError);
});

// ── 진짜 코치 ──
let stores = 0;
// 홈 코치와 시험 형식 코치를 같은 저장소 열쇠로 연다(앱처럼 한 호스트) — 홈은 짧은 연습 풀의 은행, 시험 형식은 시험 형식 풀의 은행을 받는다.
async function coaches(start = T0, params = undefined) {
  stores += 1;
  const clock = { now: start };
  const port = atlas.memoryPort();
  const key = `synk-atlas:mock-next-${process.pid}-${stores}`;
  const open = async (gameId, banks) => {
    const coach = atlas.createCoach({
      gameId,
      mapData: { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS },
      dayOffset: 540,
      ...(params ? { params } : {}),
      host: { guest: true, port, key, now: () => clock.now },
    });
    await coach.ready;
    return coach;
  };
  const home = await open('world-home', homeBanksOf(worldPosition.practice.pool));
  const coach = await open('world-mock', banksOf(mock.pool));
  return { home, coach, port, clock, dispose: () => (coach.dispose(), home.dispose()) };
}
const presentedSets = async port =>
  (await port.read())
    .map(row => row.value?.event)
    .filter(event => event?.type === atlas.EVENT_TYPES.presented)
    .map(event => event.setId);
const independentCells = summary =>
  (summary.skills ?? []).reduce((n, skill) => n + (skill.cells ?? []).reduce((m, cell) => m + (cell.independent ?? 0), 0), 0);
function startMock({ home, coach, clock }, exam) {
  const plan = selectMockNext({
    select: mock.selectMock,
    forms: mock.forms,
    exam,
    pool: mock.pool,
    exposures: home.exposures(mock.pool),
    complete: true,
  });
  assert.equal(plan.status, 'ready');
  const sections = plan.sections.filter(row => row.status === 'ready');
  return createMockNextSession({ coach, sections, exam, plays: { allowedPlays: mock.allowedPlays, nextPlay: mock.nextPlay }, clock: () => clock.now });
}
// 지금 문항에 맞는 답을 낸다(듣기는 처음 한 번 끝까지 들은 뒤).
function answerHere(session) {
  const now = session.current;
  if (!now || now.between || now.answered) return;
  if (now.item.modality === 'listening' && !now.heard && session.play()) session.delivery('completed');
  session.answer(now.item.correctId);
}
function answerSection(session, clock, step = 20_000) {
  session.start();
  for (let index = 0; index < session.current.total; index += 1) {
    session.go(index);
    answerHere(session);
    clock.now += step;
  }
  session.finishSection();
}

test('진짜 코치 — 영역 도중 새벽 4시를 넘겨 기본 판이 새로 열리면 열어 둔 문항을 다시 내고, 다시 낸 혼자 답도 혼자 낸 첫 답으로 칸에 든다(카본 설계 검토 B1)', async () => {
  const pair = await coaches(Date.UTC(2026, 10, 16, 18, 56, 0)); // 11-17 03:56 KST
  const { clock, port, home } = pair;
  try {
    const session = startMock(pair, 'topik2');
    session.start();
    for (const index of [0, 1, 2]) {
      session.go(index);
      const now = session.current;
      if (now.item.modality === 'listening' && !now.heard && session.play()) session.delivery('completed');
      clock.now += MIN;
    }
    const heard = session.current.plays;
    clock.now += 2 * MIN; // 04:01 — 다음 제시가 새 판을 연다
    session.go(3);
    for (const index of [0, 1, 2]) {
      session.go(index);
      answerHere(session);
    }
    assert.equal(session.represented, 3, '열어 둔 셋을 다시 냈다');
    session.go(2);
    assert.deepEqual(session.current.plays, heard);
    assert.equal(session.play(), false, '다시 낸 뒤에도 허용 재생 수를 넘겨 들을 수 없다');
    for (let index = 3; index < session.current.total; index += 1) {
      session.go(index);
      answerHere(session);
    }
    session.finishSection();
    answerSection(session, clock);
    await session.settled();
    const sets = [...new Set(await presentedSets(port))];
    assert.equal(sets.length, 2, '판 번호 둘');
    assert.ok(sets.every(id => id.startsWith('set.world-mock.')), '두 판 모두 시험 형식 경험의 판이다');
    const rows = session.results().flatMap(part => part.items);
    assert.equal(rows.length, 20);
    assert.ok(rows.every(row => row.verdict === 'correct' && row.independent === true), '다시 낸 문항을 포함해 모두 혼자 낸 첫 답');
    await session.finish({ record: false })?.folded;
    assert.equal(independentCells(home.summary()), 20, '접은 요약의 칸에도 스물이 혼자 해냄으로 든다');
  } finally {
    pair.dispose();
  }
});

test('진짜 코치 — 영역 사이에서 31분 쉬고 다음 영역을 시작하면 판 번호가 바뀌어도 두 영역의 혼자 답이 모두 혼자 낸 첫 답이다', async () => {
  const pair = await coaches();
  try {
    const session = startMock(pair, 'topik2');
    answerSection(session, pair.clock);
    pair.clock.now += 31 * MIN;
    answerSection(session, pair.clock);
    await session.settled();
    const sets = [...new Set(await presentedSets(pair.port))];
    assert.equal(sets.length, 2);
    assert.ok(sets.every(id => id.startsWith('set.world-mock.')));
    const rows = session.results().flatMap(part => part.items);
    assert.equal(rows.filter(row => row.independent).length, 20);
    assert.equal(session.represented, 0, '열어 둔 문항이 없던 쉼이라 다시 낸 문항이 없다');
    const set = session.finish();
    assert.ok(set?.setId?.startsWith('set.world-mock.'), '끝까지 한 판은 판 기록과 함께 닫는다');
    await set.folded;
    // 끝난 판의 문항은 다음 고르기가 고르지 않는다(측정용 만남).
    const seenIds = new Set(rows.map(row => row.itemId));
    const again = selectMockNext({
      select: mock.selectMock,
      forms: mock.forms,
      exam: 'topik2',
      pool: mock.pool,
      exposures: pair.home.exposures(mock.pool),
      complete: true,
    });
    assert.ok(!picked(again).some(item => seenIds.has(item.id)));
  } finally {
    pair.dispose();
  }
});

test('진짜 코치 — 그만두면 판을 기록 없이 닫아 손님 요약이 그 답으로 접히고, 열어 보지 않은 문항은 다음 고르기의 처음 보는 문항으로 남는다', async () => {
  const pair = await coaches();
  try {
    const session = startMock(pair, 'topik1');
    session.start();
    answerHere(session);
    session.go(1);
    const opened = session.current.item.id;
    const untouched = session.results()[0].items.at(-1).itemId;
    const closing = session.stop();
    assert.ok(closing?.setId, '판을 닫았다');
    await closing.folded;
    assert.equal(pair.home.summary().storage.unfolded, 0, '그만둔 답이 손님 요약에 접혔다');
    const met = new Map(pair.home.exposures(mock.pool).map((row, i) => [mock.pool[i].id, row.met]));
    assert.equal(met.get(opened), true, '열어 본 문항은 답하지 않음으로 만났다');
    assert.equal(met.get(untouched), false, '열어 보지 않은 문항은 처음 그대로');
  } finally {
    pair.dispose();
  }
});

test('진짜 코치 — 기록이 있는 학습자: 돌아온 단위가 든 시험 형식 제시는 돌아온 것(층 1)으로 적혀 하루 복습 상한에 센다(제품 순서 문항 §3-6 · 설계 검토 Fable F8)', async () => {
  const pair = await coaches(T0, { ...atlas.PARAMS, reviewsPerDay: 2 });
  const { home, coach, clock } = pair;
  const plays = { allowedPlays: mock.allowedPlays, nextPlay: mock.nextPlay };
  try {
    // 첫날 TOPIK I 읽기를 모두 틀린다.
    const plan = selectMockNext({
      select: mock.selectMock,
      forms: mock.forms,
      exam: 'topik1',
      pool: mock.pool,
      exposures: home.exposures(mock.pool),
      complete: true,
      audioAvailable: false,
    });
    const first = createMockNextSession({ coach, sections: plan.sections.filter(row => row.status === 'ready'), exam: 'topik1', plays, clock: () => clock.now });
    first.start();
    for (let index = 0; index < first.current.total; index += 1) {
      first.go(index);
      const item = first.current.item;
      first.answer(item.choices.find(choice => choice.id !== item.correctId).id);
      clock.now += 30_000;
    }
    first.finishSection();
    await first.settled();
    await first.finish({ record: false })?.folded;
    // 이튿날 — 돌아온 단위가 든 처음 보는 읽기 문항을 시험 형식으로 낸다.
    clock.now = T0 + 86_400_000;
    const due = new Set(home.due().map(row => row.unit));
    assert.ok(due.size > 0, '돌아온 단위가 있다');
    const met = home.exposures(mock.pool);
    const hits = mock.pool.filter(
      (item, i) =>
        met[i]?.met === false &&
        item.modality === 'reading' &&
        !item.setId &&
        home.itemUnits(item).some(row => due.has(row.unit)),
    );
    assert.ok(hits.length >= 3, '돌아온 단위가 든 처음 보는 문항');
    const probe = [{ id: 'probe', candidates: hits.slice(2, 6).map(item => ({ itemKey: item.itemKey })), facts: {} }];
    assert.equal(home.plan(probe).capped, false, '아직 상한 전');
    const session = createMockNextSession({ coach, sections: [{ section: 'reading', minutes: 30, items: hits.slice(0, 2) }], exam: 'topik1', plays, clock: () => clock.now });
    session.start();
    assert.equal(home.plan(probe).capped, false, '돌아온 것 하나');
    session.go(1);
    assert.equal(home.plan(probe).capped, true, '시험 형식 제시 둘이 하루 복습 상한(2)을 채웠다');
    session.stop();
  } finally {
    pair.dispose();
  }
});

// ── 끝 한 장의 「다음 연습」 ──
test('다음 연습 — TOPIK II 시험 형식으로 그날 새 단위를 많이 연 날에는 낼 것 없는 짧은 연습을 잇지 않는다 — 이은 연습은 문항을 내고, 뺀 연습은 0문항이다(설계 검토 Fable F8)', async () => {
  const pair = await coaches();
  const pool = worldPosition.practice.pool;
  try {
    const session = startMock(pair, 'topik2');
    answerSection(session, pair.clock);
    answerSection(session, pair.clock);
    await session.settled();
    await session.finish({ record: false })?.folded;
    const met = pair.home.exposures(pool);
    const fresh = new Set(pool.filter((item, i) => met[i]?.seen === false).map(item => item.skillId));
    const routes = todayPractice({ coach: pair.home, pool, audioAvailable: true });
    assert.ok(routes.size > 0, '낼 것이 있는 연습은 잇는다');
    assert.ok(routes.size < fresh.size, '처음 보는 문항이 남아도 그날 낼 것이 없는 연습은 뺀다');
    for (const [id, route] of routes) {
      assert.ok(fresh.has(id));
      assert.deepEqual(route, { route: 'practice', skillId: id });
    }
    // 짧은 연습 새 판을 그대로 돌려 맞댄다 — 뺀 연습 하나는 0문항, 이은 연습 하나는 한 문항 이상(뺀 것을 먼저 — 내면 그날 한도가 움직인다).
    const plays = { allowedPlays: mock.allowedPlays, nextPlay: mock.nextPlay };
    const run = skillId =>
      createPracticeNextSession({ coach: pair.home, pool: pool.filter(item => item.skillId === skillId), setPool: pool, length: 5, plays }).next();
    const dropped = [...fresh].find(id => !routes.has(id));
    assert.equal(run(dropped), null, `${dropped} — 뺀 연습은 낼 문항이 없다`);
    const kept = [...routes.keys()][0];
    assert.ok(run(kept), `${kept} — 이은 연습은 문항을 낸다`);
    // 소리를 끈 날은 듣기 문항을 세지 않는다.
    const quiet = todayPractice({ coach: pair.home, pool, audioAvailable: false });
    const listeningOnly = id => pool.filter(item => item.skillId === id).every(item => item.audioRequired ?? item.modality === 'listening');
    assert.ok(![...quiet.keys()].some(listeningOnly));
  } finally {
    pair.dispose();
  }
});

test('다음 연습 — 코치를 못 받았거나 셈이 던지면 잇지 않는다', () => {
  assert.equal(todayPractice({ coach: null, pool: worldPosition.practice.pool }).size, 0);
  const throwing = { exposures: () => worldPosition.practice.pool.map(() => ({ seen: false, met: false })), plan: () => { throw Error('closed'); } };
  assert.equal(todayPractice({ coach: throwing, pool: worldPosition.practice.pool }).size, 0);
});
