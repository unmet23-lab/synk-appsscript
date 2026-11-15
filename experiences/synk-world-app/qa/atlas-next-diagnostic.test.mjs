// 4-4a 짧은 진단 새 판(단계4_계획 §21-2 · 21-5 · 21-11) — world-diagnostic-next.mjs. 진단 풀의 단위 풀림(설계 주인 11-15 — 진단 풀의 모든
// 문항이 홈 코치가 여는 은행 안에서 이름 있는 단위로 풀린다, 뺀 레이싱 문항은 시험이 목록으로 안다), 고르기(측정용 만남 · 세트 · 모름 · 소리 ·
// 처음 볼 난도), 진행(제시 · 전달 · 도움 · 답의 차례, 건너뛴 문항, DISPOSED · PRESENTATION_GONE — 카본 A7, evidence 뒤 결과)을 본다.
// 변형 시험(qa/position-mutants.mjs)은 깬 사본을 SYNK_DIAGNOSTIC_NEXT_MODULE로 넘긴다. 그 밖에는 원본이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { homeBanksOf } from '../world-atlas-next.mjs';
import { allowedPlays, nextPlay } from '../world-exam-form.mjs';
import { buildPositionNext } from '../world-position-next.mjs';

const D = await import(
  process.env.SYNK_DIAGNOSTIC_NEXT_MODULE
    ? pathToFileURL(process.env.SYNK_DIAGNOSTIC_NEXT_MODULE).href
    : new URL('../world-diagnostic-next.mjs', import.meta.url).href
);
const { selectDiagnosticNext, createDiagnosticNextSession, withheldItem, bankOfItem, DIAGNOSTIC_NEXT_POLICY } = D;

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const T0 = Date.UTC(2026, 10, 16, 1, 0, 0);
const plays = { allowedPlays, nextPlay };

let stores = 0;
// 홈 코치를 앱처럼 연다 — 짧은 연습 풀 전체의 홈 은행(homeBanksOf)만 조각으로 받고, 낱말 이름도 싣는다(world-atlas-next.mjs words: true).
async function homeCoach() {
  stores += 1;
  let now = T0;
  const banks = homeBanksOf(worldPosition.practice.pool);
  const coach = atlas.createCoach({
    gameId: 'world-home',
    mapData: { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS },
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:diagnostic-next-${process.pid}-${stores}`, now: () => now },
  });
  await coach.ready;
  return { coach, banks, advance: ms => (now += ms) };
}

// 지도 전체 색인으로 연 코치 — 「은행을 덜 열어서」 떨어진 것과 「지도에 단위 태그가 없어서」 떨어진 것을 가른다.
async function fullCoach() {
  stores += 1;
  const coach = atlas.createCoach({
    gameId: 'world-home',
    mapData: { index: INDEX, units: UNITS, words: WORDS },
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:diagnostic-full-${process.pid}-${stores}`, now: () => T0 },
  });
  await coach.ready;
  return coach;
}
const fell = units => !units.length || units.some(row => row.kind === 'family');

test('진단 풀의 문항은 홈 코치가 여는 은행 안에서 지도 전체와 같은 단위로 풀린다 — 뺀 문항(레이싱)과 지도에 태그가 없는 문항은 시험이 목록으로 안다(설계 주인 11-15)', async () => {
  const { coach, banks } = await homeCoach();
  const full = await fullCoach();
  const pool = worldPosition.items;
  assert.ok(pool.length > 400, '진단 풀');
  assert.deepEqual([...DIAGNOSTIC_NEXT_POLICY.withheld], ['korean-racing'], '진단용 조각이 서면 이 목록을 비운다');
  // ① 뺀 문항 — 홈 은행 밖(레이싱). 조각이 서기 전에는 실제로 이름 없는 family: 단위로 떨어진다(빼는 까닭).
  const withheld = pool.filter(item => withheldItem(item));
  assert.equal(withheld.length, 13, '레이싱 듣기 13문항(진단 풀이 바뀌면 이 수를 맞춘다)');
  assert.ok(withheld.every(item => bankOfItem(item) === 'korean-racing'));
  assert.ok(withheld.every(item => !banks.includes(bankOfItem(item))), '뺀 문항의 은행은 홈 은행 밖');
  assert.ok(withheld.every(item => fell(coach.itemUnits(item))));
  assert.ok(withheld.every(item => !fell(full.itemUnits(item))), '지도 전체에서는 이름 있는 단위로 풀린다 — 조각이 채울 것');
  // ② 지도에 단위 태그가 없는 문항 — 지도 전체로 열어도 family: 단위다. 은행 문제가 아니라 태그의 빈자리라 지도 쪽(atlas-1b)에 넘긴다. 측정은
  //    능력으로 되므로(칸에 든다) 진단에서 빼지 않는다. 태그가 생기면 이 수가 줄어 시험이 알린다.
  const untagged = pool.filter(item => !withheldItem(item) && fell(full.itemUnits(item)));
  assert.equal(untagged.length, 22, '지도에 태그가 없는 진단 문항(태그가 생기면 이 수를 맞춘다)');
  // ③ 그 밖의 문항은 하나도 떨어지지 않는다 — 홈 은행만 연 코치가 지도 전체와 같은 단위를 낸다.
  const fallen = pool
    .filter(item => !withheldItem(item) && !untagged.includes(item))
    .filter(item => {
      const units = coach.itemUnits(item);
      const whole = full.itemUnits(item);
      return fell(units) || JSON.stringify(units) !== JSON.stringify(whole);
    })
    .map(item => item.itemKey);
  assert.deepEqual(fallen, [], '홈 은행만 열어 이름을 잃거나 단위가 달라진 진단 문항');
  coach.dispose();
  full.dispose();
});

// ── 고르기 ──
const item = (id, skillId, difficulty, extra = {}) => ({
  id,
  itemKey: `topik-items.${id}`,
  familyKey: `topik-items.${id}`,
  skillId,
  modality: skillId.split('.')[1],
  difficulty,
  responseFormat: 'single-choice',
  ...extra,
});
const level = (difficulty, cell) => ({ difficulty, cell });
const positionOf = (skills, { complete = true } = {}) => ({
  exam: 'topik1',
  complete,
  skills: skills.map(([id, cells = []]) => ({
    id,
    levels: [1, 2, 3].map(d => level(d, cells[d - 1] ?? 'notyet')),
  })),
});
// met에 적은 문항만 그 값(true · null)이고 나머지는 만난 적 없음(false)이다 — null은 「모름」이라 false로 바꾸지 않는다.
const exposuresOf = (items, met) =>
  items.map(row => {
    const value = Object.hasOwn(met, row.id) ? met[row.id] : false;
    return { seen: value, met: value };
  });

test('고르기 — 기록이 다 오지 않았으면 열지 않는다(21-3)', () => {
  const pool = [item('a1', 'ko.reading.a', 1)];
  const out = selectDiagnosticNext({
    position: positionOf([['ko.reading.a']], { complete: false }),
    items: pool,
    exposures: exposuresOf(pool, {}),
  });
  assert.equal(out.status, 'unavailable');
  assert.equal(out.reason, 'history.incomplete');
});

test('고르기 — 측정용 만남이 없는 문항만, 모르면(null) 고르지 않는다, 처음 볼 난도는 혼자 해냄이 아닌 가장 쉬운 난도', () => {
  const pool = [
    item('a1', 'ko.reading.a', 1),
    item('a2', 'ko.reading.a', 2),
    item('a3', 'ko.reading.a', 3),
    item('b1', 'ko.reading.b', 1),
    item('c1', 'ko.reading.c', 1),
  ];
  const out = selectDiagnosticNext({
    position: positionOf([['ko.reading.a', ['independent']], ['ko.reading.b'], ['ko.reading.c']]),
    items: pool,
    exposures: exposuresOf(pool, { b1: true, c1: null }),
  });
  assert.deepEqual(
    out.items.map(row => [row.skillId, row.target, row.item.id]),
    [['ko.reading.a', 2, 'a2']],
  );
  assert.deepEqual(out.missing, [
    { skillId: 'ko.reading.b', reason: 'all-seen' },
    { skillId: 'ko.reading.c', reason: 'unknown' },
  ]);
});

test('고르기 — 세트는 다른 문항을 만났거나 모르면 처음이 아니고, 한 진단에 같은 세트에서 둘을 내지 않는다', () => {
  const pool = [
    item('s1', 'ko.reading.a', 1, { setId: 'set-1' }),
    item('s2', 'ko.reading.b', 1, { setId: 'set-1' }),
    item('t1', 'ko.reading.a', 1, { setId: 'set-2' }),
    item('t2', 'ko.reading.b', 1, { setId: 'set-2' }),
    item('u1', 'ko.reading.c', 1, { setId: 'set-3' }),
    item('u2', 'ko.reading.c', 2, { setId: 'set-3' }),
  ];
  const out = selectDiagnosticNext({
    position: positionOf([['ko.reading.a'], ['ko.reading.b'], ['ko.reading.c']]),
    items: pool,
    exposures: exposuresOf(pool, { t2: true, u2: null }),
  });
  assert.deepEqual(out.items.map(row => row.item.id), ['s1'], 'set-2 · set-3은 처음이 아니고 set-1은 한 번만');
  assert.deepEqual(
    out.missing.map(row => [row.skillId, row.reason]),
    [
      ['ko.reading.b', 'all-seen'],
      ['ko.reading.c', 'unknown'],
    ],
  );
});

test('고르기 — 소리를 끈 날은 듣기 문항을 빼고, 레이싱 문항은 뺀 것으로 적는다(21-2)', () => {
  const pool = [
    item('l1', 'ko.listening.d', 1),
    { ...item('w1', 'ko.listening.word', 1), itemKey: 'korean-racing:w0001:v1', familyKey: 'korean-racing:w0001' },
  ];
  const position = positionOf([['ko.listening.d'], ['ko.listening.word']]);
  const quiet = selectDiagnosticNext({ position, items: pool, exposures: exposuresOf(pool, {}), audioAvailable: false });
  assert.deepEqual(quiet.missing, [
    { skillId: 'ko.listening.d', reason: 'audio' },
    { skillId: 'ko.listening.word', reason: 'withheld' },
  ]);
  const loud = selectDiagnosticNext({ position, items: pool, exposures: exposuresOf(pool, {}) });
  assert.deepEqual(loud.items.map(row => row.item.id), ['l1']);
});

// ── 진행 ──
const choices = id => [
  { id: `${id}.1`, label: '하나' },
  { id: `${id}.2`, label: '둘' },
];
const playableItem = (id, skillId, extra = {}) => ({
  ...item(id, skillId, 1, extra),
  choices: choices(id),
  correctId: `${id}.1`,
});
function fakeCoach() {
  const calls = [];
  let pids = 0;
  const gone = new Set();
  let disposed = false;
  const guard = pid => {
    if (disposed) throw Object.assign(new Error('closed'), { code: 'DISPOSED' });
    if (gone.has(pid)) {
      gone.delete(pid);
      throw Object.assign(new Error('gone'), { code: 'PRESENTATION_GONE' });
    }
  };
  const helped = new Map();
  return {
    calls,
    gone: pid => gone.add(pid),
    dispose: () => (disposed = true),
    present(item, context = {}) {
      if (disposed) throw Object.assign(new Error('closed'), { code: 'DISPOSED' });
      pids += 1;
      const pid = `p${pids}`;
      calls.push(['present', item.id, context.firstExposure ?? null, pid]);
      return pid;
    },
    delivery(pid, { audio }) {
      guard(pid);
      calls.push(['delivery', pid, audio]);
      return { id: `d-${pid}` };
    },
    help(pid, kind) {
      guard(pid);
      calls.push(['help', pid, kind]);
      helped.set(pid, true);
      return { id: `h-${pid}` };
    },
    answer(pid, result) {
      guard(pid);
      calls.push(['answer', pid, result.assessable, result.correct]);
      const independent = result.assessable && result.correct === true && !helped.get(pid);
      return {
        eventId: `a-${pid}`,
        verdict: result.assessable ? (result.correct ? 'correct' : 'incorrect') : null,
        evidence: Promise.resolve({ stored: true, independent, assisted: helped.get(pid) === true }),
      };
    },
    finishSet(options) {
      calls.push(['finishSet', options.kind, ...(options.record === false ? [false] : [])]);
      return { folded: Promise.resolve(true) };
    },
  };
}

test('진행 — 제시 → 끝까지 들음 → 첫 답의 차례, 듣기 전에는 답을 받지 않는다, 건너뛰면 평가할 수 없는 답', async () => {
  const coach = fakeCoach();
  const session = createDiagnosticNextSession({
    coach,
    items: [playableItem('r1', 'ko.reading.a'), playableItem('l1', 'ko.listening.b')],
    plays,
  });
  session.next();
  assert.ok(session.answer('r1.1'), '읽기는 바로 답한다');
  session.next();
  assert.equal(session.answer('l1.1'), null, '듣기 전');
  assert.equal(session.delivery('completed'), true);
  assert.equal(session.replay(), 'extra', '게임 원고 듣기의 다시 듣기는 도움');
  session.skip();
  assert.equal(session.next(), null, '끝');
  await session.settled();
  const rows = session.results();
  assert.equal(rows[0].independent, true);
  assert.equal(rows[1].skipped, true);
  assert.deepEqual(
    coach.calls.filter(call => call[0] === 'answer').map(call => call.slice(2)),
    [
      [true, true],
      [false, null],
    ],
  );
  assert.ok(session.finish());
  session.finish();
  assert.equal(coach.calls.filter(call => call[0] === 'finishSet').length, 1, '판은 한 번 닫는다');
  assert.deepEqual(coach.calls.find(call => call[0] === 'finishSet'), ['finishSet', 'diagnostic']);
  // 학습자 응답이 꺼졌거나 손님이면 판 기록 없이 닫기만 한다(지금 판의 finishSet과 같은 규칙).
  const quiet = fakeCoach();
  const closing = createDiagnosticNextSession({ coach: quiet, items: [playableItem('r9', 'ko.reading.a')], plays });
  closing.next();
  closing.answer('r9.1');
  assert.ok(closing.finish({ record: false }));
  assert.deepEqual(quiet.calls.find(call => call[0] === 'finishSet'), ['finishSet', 'diagnostic', false]);
});

test('진행 — 제시가 사라지면 그 문항을 다시 내고 끝까지 들은 재생과 넘긴 다시 듣기(도움)를 이어 남긴 뒤 답한다(카본 A7)', async () => {
  const coach = fakeCoach();
  const session = createDiagnosticNextSession({ coach, items: [playableItem('l1', 'ko.listening.b')], plays });
  const first = session.next();
  assert.ok(first);
  session.delivery('completed');
  session.replay(); // extra — 도움
  session.delivery('completed');
  coach.gone('p1');
  const row = session.answer('l1.1');
  assert.ok(row);
  const after = coach.calls.slice(coach.calls.findIndex(call => call[0] === 'present' && call[3] === 'p2'));
  assert.deepEqual(after, [
    ['present', 'l1', false, 'p2'],
    ['delivery', 'p2', 'completed'],
    ['delivery', 'p2', 'completed'],
    ['help', 'p2', 'replay'],
    ['answer', 'p2', true, true],
  ]);
  await session.settled();
  assert.equal(session.results()[0].independent, false, '도움을 받은 문항은 다시 낸 뒤에도 혼자 맞힘이 아니다');
  assert.equal(session.represented, 1);
});

test('진행 — 코치가 닫히면(DISPOSED) 그 뒤로 아무것도 남기지 않고 disposed가 참이다', () => {
  const coach = fakeCoach();
  const session = createDiagnosticNextSession({
    coach,
    items: [playableItem('r1', 'ko.reading.a'), playableItem('r2', 'ko.reading.b')],
    plays,
  });
  session.next();
  coach.dispose();
  assert.equal(session.answer('r1.1'), null);
  assert.equal(session.disposed, true);
  assert.equal(session.next(), null);
  assert.equal(session.finish(), null);
  assert.equal(coach.calls.filter(call => call[0] === 'answer').length, 0);
});

// ── 진짜 코치 장면 ──
test('진짜 코치 — 묶음 만남으로 고른 처음 보는 문항을 제품 순서로 내고, 답한 뒤에는 같은 문항을 다시 고르지 않는다', async () => {
  const { coach } = await homeCoach();
  const pool = worldPosition.items.filter(row => !withheldItem(row));
  const skills = [{ id: 'ko.reading.detail', domain: 'reading' }];
  const position = buildPositionNext({ skills, summary: coach.summary() });
  const first = selectDiagnosticNext({ position, items: pool, exposures: coach.exposures(pool) });
  assert.equal(first.status, 'ready');
  const picked = first.items[0].item;
  const playable = pool.find(row => row.id === picked.id);
  const session = createDiagnosticNextSession({ coach, items: [playable], plays });
  session.next();
  if (session.current.item.modality === 'listening') session.delivery('completed');
  session.answer(playable.correctId);
  await session.settled();
  assert.equal(session.results()[0].independent, true, '처음 보는 문항의 혼자 낸 첫 답');
  assert.equal(await session.finish().folded, true);
  const again = selectDiagnosticNext({
    position: buildPositionNext({ skills, summary: coach.summary() }),
    items: pool,
    exposures: coach.exposures(pool),
  });
  assert.notEqual(again.items[0]?.item.familyKey, picked.familyKey, '만난 계열은 다시 고르지 않는다');
  coach.dispose();
});
