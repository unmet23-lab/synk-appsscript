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
import { buildPositionNext, examSkills } from '../world-position-next.mjs';
import { worldLearning } from '../world-learning-map.mjs';

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
// 이름 있는 단위로 풀리지 않았다 — 단위가 없거나, 이름 없는 family: 단위이거나, 이름(label)이 비었다(다시 확인 카드의 unitRoutes와 같은 규칙 — GPT 끝 판 GA1).
const fell = units =>
  !units.length || units.some(row => row.kind === 'family' || typeof row.label !== 'string' || !row.label);
// 지도에 단위 태그가 없는 진단 문항(11-16 — topik-items 18 · synk-town 4). 측정은 능력으로 되므로 진단에 남긴다(설계 주인 11-16 물음 6). 태그를
// 채우는 일은 지도 쪽(atlas-1b)이 하고(TOPIK I의 ko.reading.detail 넷 — synk-town 넷을 먼저), 채운 만큼 여기서 지운다. 목록은 줄기만 한다.
const UNTAGGED = Object.freeze([
  'synk-town.reading-check.town-detail-festival.v1',
  'synk-town.reading-check.town-detail-library.v1',
  'synk-town.reading-check.town-detail-lost.v2',
  'synk-town.reading-check.town-detail-market.v1',
  'topik-items.ti-l-e-007.v1',
  'topik-items.ti-r-b-029.v1',
  'topik-items.tii-l-a-016.v1',
  'topik-items.tii-l-a-020.v1',
  'topik-items.tii-l-a-031.v1',
  'topik-items.tii-l-b-007.v1',
  'topik-items.tii-r-a-005.v1',
  'topik-items.tii-r-a-006.v1',
  'topik-items.tii-r-a-019.v1',
  'topik-items.tii-r-a-021.v1',
  'topik-items.tii-r-a-025.v1',
  'topik-items.tii-r-a-028.v1',
  'topik-items.tii-r-a-029.v1',
  'topik-items.tii-r-a-031.v1',
  'topik-items.tii-r-a-032.v1',
  'topik-items.tii-r-a-033.v1',
  'topik-items.tii-r-a-037.v1',
  'topik-items.tii-r-a-038.v1',
]);

test('진단 풀의 문항은 홈 코치가 여는 은행 안에서 지도 전체와 같은 단위로 풀린다 — 뺀 문항(레이싱)과 지도에 태그가 없는 문항은 시험이 목록으로 알고, 태그 없는 목록은 줄기만 한다(설계 주인 11-15 · 11-16 물음 6)', async () => {
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
  // ② 지도에 단위 태그가 없는 문항(UNTAGGED) — 지도 전체로 열어도 family: 단위다. 은행 문제가 아니라 태그의 빈자리다. 목록은 줄기만 한다 —
  //    목록의 문항이 이름 있는 단위로 풀리게 되면 실패해 태그를 채운 만큼 목록을 지우게 하고(조건 2), 목록 밖의 문항이 떨어지면 ③에서 실패한다.
  //    켜기 전에 이 목록이 비어야 한다 — 남으면 켤 때 레이싱처럼 새 길 진단에서 뺀다(설계 주인 11-16 물음 6 조건 3 — 계획 §21-10).
  const untagged = new Set(UNTAGGED);
  assert.equal(untagged.size, UNTAGGED.length, '목록에 겹친 문항이 없다');
  const byKey = new Map(pool.map(item => [item.itemKey, item]));
  assert.deepEqual(UNTAGGED.filter(key => !byKey.has(key) || withheldItem(byKey.get(key))), [], '목록의 문항은 뺀 문항 밖의 진단 문항이다');
  assert.deepEqual(UNTAGGED.filter(key => !fell(full.itemUnits(byKey.get(key)))), [], '태그가 채워진 문항 — 목록에서 지운다');
  // ③ 목록 밖의 문항은 하나도 떨어지지 않고, 목록의 문항까지 모두 홈 은행만 연 코치가 지도 전체와 같은 단위를 낸다(조건 1).
  const fallen = pool
    .filter(item => !withheldItem(item))
    .filter(item => {
      const units = coach.itemUnits(item);
      const whole = full.itemUnits(item);
      return (!untagged.has(item.itemKey) && fell(units)) || JSON.stringify(units) !== JSON.stringify(whole);
    })
    .map(item => item.itemKey);
  assert.deepEqual(fallen, [], '목록 밖에서 이름 없는 단위로 떨어졌거나, 홈 은행만 열어 지도 전체와 단위가 달라진 진단 문항');
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

test('고르기 — 측정용 만남(met)으로 고른다: 띄우기만 한 문항(seen 참 · met 거짓)은 처음 보는 문항이고, 측정용으로 만난 문항은 고르지 않는다(21-5 · GPT 끝 판 GA2)', () => {
  const pool = [item('a1', 'ko.reading.a', 1), item('a2', 'ko.reading.a', 1)];
  const out = selectDiagnosticNext({
    position: positionOf([['ko.reading.a']]),
    items: pool,
    exposures: [
      { seen: true, met: false },
      { seen: false, met: true },
    ],
  });
  assert.deepEqual(out.items.map(row => row.item.id), ['a1']);
});

test('고르기 — 진짜 코치: 진단 문항을 띄우기만 하고 판을 닫으면 다음 진단이 그 문항을 다시 고른다(seen 참 · met 거짓 — 21-5 · GPT 끝 판 GA2)', async () => {
  const { coach, advance } = await homeCoach();
  const skillId = 'ko.reading.vocabulary';
  const pool = worldPosition.items.filter(row => !withheldItem(row) && row.skillId === skillId);
  assert.ok(pool.length > 1, '그 능력의 진단 문항');
  const position = positionOf([[skillId]]);
  const pick = () => selectDiagnosticNext({ position, items: pool, exposures: coach.exposures(pool) });
  const first = pick();
  assert.equal(first.status, 'ready');
  const chosen = first.items[0].item;
  coach.present(chosen);
  advance(60_000);
  await coach.finishSet({ kind: 'diagnostic', record: false }).folded;
  const [exposure] = coach.exposures([chosen]);
  assert.deepEqual([exposure.seen, exposure.met], [true, false], '띄우기만 한 문항 — 화면에는 본 것, 측정에는 처음');
  assert.equal(pick().items[0].item.id, chosen.id, '다음 진단이 그 문항을 다시 고른다');
  coach.dispose();
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

test('고르기 — 세트도 측정용 만남(met)으로 가른다: 세트의 한 문항을 띄우기만 했으면(seen 참 · met 거짓) 그 세트는 아직 처음이다(카본 끝 판)', () => {
  const pool = [
    item('s1', 'ko.reading.a', 1, { setId: 'set-1' }),
    item('s2', 'ko.reading.b', 1, { setId: 'set-1' }),
  ];
  const out = selectDiagnosticNext({
    position: positionOf([['ko.reading.a'], ['ko.reading.b']]),
    items: pool,
    exposures: [
      { seen: true, met: false },
      { seen: false, met: false },
    ],
  });
  assert.deepEqual(out.items.map(row => row.item.id), ['s1'], '띄우기만 한 s1도 처음 보는 문항이고, 한 진단에 같은 세트에서 하나만');
});

test('고르기 — 한 진단에 한 지문에서 한 문항이어도 진단하는 능력 수를 먼저 채운다: 앞 능력이 뒤 능력의 하나뿐인 처음 보는 문항과 같은 지문을 쥐면 다른 문항으로 옮기고, 겹침이 없으면 앞 능력의 차례 그대로다(5-3 전 고침 GF1)', () => {
  const position = positionOf([['ko.reading.a'], ['ko.reading.b']]);
  const only = [
    item('v1', 'ko.reading.a', 1, { setId: 'set-1' }),
    item('v2', 'ko.reading.a', 1),
    item('m1', 'ko.reading.b', 1, { setId: 'set-1' }),
  ];
  const out = selectDiagnosticNext({ position, items: only, exposures: exposuresOf(only, {}) });
  assert.deepEqual(out.items.map(row => [row.skillId, row.item.id]), [['ko.reading.a', 'v2'], ['ko.reading.b', 'm1']]);
  assert.deepEqual(out.missing, []);
  // 뒤 능력에 지문 없는 처음 보는 문항이 있으면 앞 능력은 옮기지 않는다 — 지금 차례(난도 · 형식 · id)의 첫 문항 v1이다.
  const spare = [...only, item('m2', 'ko.reading.b', 1)];
  const kept = selectDiagnosticNext({ position, items: spare, exposures: exposuresOf(spare, {}) });
  assert.deepEqual(kept.items.map(row => [row.skillId, row.item.id]), [['ko.reading.a', 'v1'], ['ko.reading.b', 'm2']]);
  // 두 번 옮겨야 서는 판 — c의 하나뿐인 문항이 a의 지문에 있고, a가 옮겨 갈 지문은 b가 쥐었다. b가 지문 없는 문항으로 옮기고 a가 그 지문을 받는다.
  const chain = [
    item('x1', 'ko.reading.a', 1, { setId: 'set-1' }),
    item('x2', 'ko.reading.a', 1, { setId: 'set-2' }),
    item('y2', 'ko.reading.b', 1, { setId: 'set-2' }),
    item('y3', 'ko.reading.b', 1),
    item('z1', 'ko.reading.c', 1, { setId: 'set-1' }),
  ];
  const moved = selectDiagnosticNext({
    position: positionOf([['ko.reading.a'], ['ko.reading.b'], ['ko.reading.c']]),
    items: chain,
    exposures: exposuresOf(chain, {}),
  });
  assert.deepEqual(moved.items.map(row => [row.skillId, row.item.id]), [
    ['ko.reading.a', 'x2'],
    ['ko.reading.b', 'y3'],
    ['ko.reading.c', 'z1'],
  ]);
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
      if (disposed) throw Object.assign(new Error('closed'), { code: 'DISPOSED' });
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

test('진행 — 틀린 보기를 내면 코치에 맞지 않은 답으로 넘기고, 결과 줄은 틀림이며 혼자 맞힘이 아니다(카본 끝 판)', async () => {
  const coach = fakeCoach();
  const session = createDiagnosticNextSession({ coach, items: [playableItem('r1', 'ko.reading.a')], plays });
  session.next();
  const row = session.answer('r1.2');
  assert.deepEqual([row.choiceId, row.verdict, row.skipped], ['r1.2', 'incorrect', false]);
  assert.deepEqual(coach.calls.find(call => call[0] === 'answer'), ['answer', 'p1', true, false]);
  await session.settled();
  assert.equal(session.results()[0].independent, false);
});

test('진행 — 제시가 듣기 전달 · 다시 듣기 · 건너뛰기 도중에 사라져도 그 문항을 다시 내고 방금 한 일을 새 제시에 한 번만 남긴다(카본 끝 판)', () => {
  // 전달 도중 — 앞 제시에서 끝까지 들은 재생이 없으니 새 제시에는 방금 들은 재생 하나만
  const heard = fakeCoach();
  const listening = createDiagnosticNextSession({ coach: heard, items: [playableItem('l1', 'ko.listening.b')], plays });
  listening.next();
  heard.gone('p1');
  assert.equal(listening.delivery('completed'), true);
  assert.deepEqual(heard.calls.slice(1), [
    ['present', 'l1', null, 'p2'],
    ['delivery', 'p2', 'completed'],
  ]);
  assert.ok(listening.answer('l1.1'), '다시 낸 제시에서 들었으니 답한다');
  // 다시 듣기 도중(허용을 넘긴 도움) — 앞 제시에서 들은 재생을 이어 남기고 도움을 새 제시에 한 번
  const replayed = fakeCoach();
  const again = createDiagnosticNextSession({ coach: replayed, items: [playableItem('l1', 'ko.listening.b')], plays });
  again.next();
  again.delivery('completed');
  replayed.gone('p1');
  assert.equal(again.replay(), 'extra');
  assert.deepEqual(replayed.calls.slice(replayed.calls.findIndex(call => call[3] === 'p2')), [
    ['present', 'l1', null, 'p2'],
    ['delivery', 'p2', 'completed'],
    ['help', 'p2', 'replay'],
  ]);
  assert.equal(replayed.calls.filter(call => call[0] === 'help').length, 1, '도움은 한 번');
  // 건너뛰기 도중 — 다시 낸 제시에 평가할 수 없는 답 하나
  const skipped = fakeCoach();
  const reading = createDiagnosticNextSession({ coach: skipped, items: [playableItem('r1', 'ko.reading.a')], plays });
  reading.next();
  skipped.gone('p1');
  assert.equal(reading.skip().skipped, true);
  assert.deepEqual(skipped.calls.slice(1), [
    ['present', 'r1', null, 'p2'],
    ['answer', 'p2', false, null],
  ]);
});

test('진행 — 다 답한 뒤 판을 닫기 직전에 코치가 닫히면 finish는 던지지 않고 null을 돌려주며 판 기록을 남기지 않는다(카본 끝 판)', async () => {
  const coach = fakeCoach();
  const session = createDiagnosticNextSession({ coach, items: [playableItem('r1', 'ko.reading.a')], plays });
  session.next();
  session.answer('r1.1');
  assert.equal(session.next(), null);
  await session.settled();
  coach.dispose();
  assert.equal(session.finish(), null);
  assert.equal(coach.calls.filter(call => call[0] === 'finishSet').length, 0);
});

test('진행 — 그만두면 보이던 문항은 건너뛴 답으로 남기고 판을 기록 없이 한 번 닫는다. 문항을 내기 전이거나 코치가 닫혔으면 닫지 않는다(Fable 끝 판 F2)', () => {
  const coach = fakeCoach();
  const session = createDiagnosticNextSession({
    coach,
    items: [playableItem('r1', 'ko.reading.a'), playableItem('r2', 'ko.reading.b'), playableItem('r3', 'ko.reading.c')],
    plays,
  });
  session.next();
  session.answer('r1.1');
  session.next();
  const closed = session.stop();
  assert.ok(closed?.folded, '닫은 판의 결과(folded 포함)를 돌려준다');
  assert.deepEqual(
    coach.calls.filter(call => call[0] === 'answer').map(call => call.slice(2)),
    [
      [true, true],
      [false, null],
    ],
    '보이던 r2는 건너뛴 답, 아직 안 보인 r3은 남기지 않는다',
  );
  assert.deepEqual(coach.calls.filter(call => call[0] === 'finishSet'), [['finishSet', 'diagnostic', false]]);
  assert.equal(session.stop(), null, '두 번 그만둬도 다시 닫지 않는다');
  assert.equal(session.finish(), closed, '뒤의 finish는 그만둘 때 닫은 결과를 돌려준다');
  assert.equal(coach.calls.filter(call => call[0] === 'finishSet').length, 1, '판은 한 번 닫는다');
  // 문항을 내기 전에 그만두면 이 진단이 연 판이 없다 — 닫지 않는다.
  const idle = fakeCoach();
  assert.equal(createDiagnosticNextSession({ coach: idle, items: [playableItem('r1', 'ko.reading.a')], plays }).stop(), null);
  assert.deepEqual(idle.calls, []);
  // 코치가 닫혔으면(판을 다시 정함) 던지지 않고 닫지 않는다.
  const gone = fakeCoach();
  const late = createDiagnosticNextSession({ coach: gone, items: [playableItem('r1', 'ko.reading.a')], plays });
  late.next();
  gone.dispose();
  assert.equal(late.stop(), null);
  assert.equal(gone.calls.filter(call => call[0] === 'finishSet').length, 0);
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

test('진짜 코치 — 답하기 전에 제시가 사라져 도움 없이 다시 낸 문항을 맞히면 혼자 낸 첫 답이다(카본 끝 판)', async () => {
  const { coach } = await homeCoach();
  const pool = worldPosition.items.filter(row => !withheldItem(row) && row.modality === 'reading');
  const skills = [{ id: 'ko.reading.detail', domain: 'reading' }];
  const position = buildPositionNext({ skills, summary: coach.summary() });
  const picked = selectDiagnosticNext({ position, items: pool, exposures: coach.exposures(pool) }).items[0].item;
  // 첫 답에서 한 번 PRESENTATION_GONE을 내는 겉 — 기본 판이 낡아 앞 제시가 사라진 장면이다. 다시 낸 제시부터는 진짜 코치 그대로다.
  let gone = true;
  const wrapped = {
    ...coach,
    answer(pid, result) {
      if (gone) {
        gone = false;
        throw Object.assign(new Error('gone'), { code: 'PRESENTATION_GONE' });
      }
      return coach.answer(pid, result);
    },
  };
  const session = createDiagnosticNextSession({ coach: wrapped, items: [picked], plays });
  session.next();
  assert.ok(session.answer(picked.correctId));
  await session.settled();
  assert.equal(session.represented, 1);
  assert.equal(session.results()[0].independent, true, '앞 제시에 답이 없으면 다시 낸 제시의 답이 그 계열의 첫 답이다');
  coach.dispose();
});

test('진짜 코치 — 진단을 그만두면 판을 닫아 손님 요약이 그 답으로 다시 접히고(칸이 따라오는 중에 머물지 않는다), 다음 진단은 새 판으로 연다(Fable 끝 판 F2)', async () => {
  const { coach, advance } = await homeCoach();
  const pool = worldPosition.items.filter(row => !withheldItem(row) && row.modality === 'reading');
  const skills = [...new Set(pool.map(row => row.skillId))].slice(0, 3).map(id => ({ id, domain: 'reading' }));
  const board = () => buildPositionNext({ skills, summary: coach.summary() });
  const pick = () => selectDiagnosticNext({ position: board(), items: pool, exposures: coach.exposures(pool) }).items.map(row => row.item);
  const first = pick();
  assert.equal(first.length, 3, '능력마다 하나');
  const session = createDiagnosticNextSession({ coach, items: first, plays });
  for (const picked of first.slice(0, 2)) {
    session.next();
    session.answer(picked.correctId);
  }
  session.next();
  await session.settled();
  assert.ok(coach.summary().storage.unfolded > 0, '그만두기 전 — 답이 아직 칸에 접히지 않았다');
  assert.ok(board().skills.some(skill => skill.catching), '그만두기 전 — 칸이 따라오는 중');
  const stopped = session.stop();
  assert.ok(stopped?.setId, '그만두면 판을 닫는다');
  await stopped.folded;
  assert.equal(coach.summary().storage.unfolded, 0, '그만둔 답이 손님 요약에 접혔다');
  assert.ok(board().skills.every(skill => !skill.catching), '칸이 그 답으로 섰다');
  // 30분 안에 다시 하는 진단 — 그만둔 판에 묶이지 않고 새 판으로 닫힌다.
  advance(60_000);
  const next = pick();
  assert.ok(next.length > 0, '아직 처음 보는 문항');
  const again = createDiagnosticNextSession({ coach, items: next.slice(0, 1), plays });
  again.next();
  again.answer(next[0].correctId);
  assert.equal(again.next(), null);
  await again.settled();
  const done = again.finish({ record: false });
  assert.ok(done?.setId);
  assert.notEqual(done.setId, stopped.setId, '다음 진단은 그만둔 진단의 판으로 묶이지 않는다');
  coach.dispose();
});

test('진짜 코치 — TOPIK II 중심 내용 일곱 문항 가운데 여섯을 답한 기기에서도 진단이 열두 능력을 모두 고른다: 어휘가 tii-r-a-019 대신 다른 지문의 문항을 받고, 중심 내용이 같은 지문의 tii-r-a-020을 받는다(5-3 전 고침 GF1)', async () => {
  const { coach, advance } = await homeCoach();
  const pool = worldPosition.items;
  const byId = new Map(pool.map(row => [row.id, row]));
  for (const id of ['tii-r-a-007', 'tii-r-a-008', 'tii-r-a-022', 'tii-r-a-043', 'tii-r-a-044', 'tii-u14-002']) {
    const pid = coach.present(byId.get(id));
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    advance(60_000);
  }
  await coach.finishSet({ kind: 'diagnostic' }).folded;
  const skills = examSkills(worldLearning.SKILLS, 'topik2');
  const position = buildPositionNext({ exam: 'topik2', skills, summary: coach.summary() });
  const plan = selectDiagnosticNext({ position, items: pool, exposures: coach.exposures(pool) });
  const pick = Object.fromEntries(plan.items.map(row => [row.skillId, row.item.id]));
  assert.equal(plan.items.length, skills.length, '열두 능력을 모두 진단한다');
  assert.equal(pick['ko2.reading.main'], 'tii-r-a-020', '중심 내용에 남은 하나뿐인 처음 보는 문항');
  assert.notEqual(pick['ko2.reading.vocabulary'], 'tii-r-a-019', '어휘가 그 지문을 먼저 차지하지 않는다');
  const sets = plan.items.map(row => row.item.setId).filter(Boolean);
  assert.equal(new Set(sets).size, sets.length, '한 진단에 한 지문에서 한 문항');
  coach.dispose();
});
