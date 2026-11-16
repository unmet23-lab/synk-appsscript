// 30일째 문장의 서버 읽기(단계 4 계획 §21-22) — lookbackOfStore(첫 걸음: 앞 창 안의 놓침 줄로 단위 찾기, 둘째 걸음: 그 단위의 줄을 처음부터
// 읽어 세기)가 모든 단위를 처음부터 센 것과 같다. 세는 법은 손님 코치와 같은 unitLookback 하나다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { createMemoryAccount, T0 } from '../support/trail-world.mjs';

const { lookbackOfStore, unitLookback } = await subject('record/lookback.mjs');
const { lookbackWindows, MONTH_FLOOR } = await subject('memory/lookback.mjs');
const { createEvent, eventId } = await subject('record/events.mjs');
const { foldAccount, foldEdition } = await subject('record/server.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-12-15T09:00:00.000Z');
const windows = lookbackWindows(NOW, { dayStartHour: PARAMS.dayStartHour, offset: 0 });

// 저장소 포트의 두 걸음만 흉내 낸다(talk SQL과 같은 뜻 — 앞 창은 [from, to), at이 없는 줄은 들지 않는다).
const storeOf = rows => ({
  async missedUnits(from, to) {
    return [
      ...new Set(
        rows
          .filter(r => r.kind === 'unit' && r.grade === 'again' && r.at >= from && r.at < to)
          .map(r => r.unit),
      ),
    ];
  },
  async unitRowsOf(units) {
    return new Map(
      units.map(unit => [
        unit,
        rows.filter(r => (r.kind === 'unit' || r.kind === 'say') && r.unit === unit),
      ]),
    );
  },
});
// 모든 단위를 처음부터 센 것(기준).
function everyUnit(rows) {
  const units = [...new Set(rows.map(r => r.unit))].sort();
  return units
    .map(unit =>
      unitLookback(
        unit,
        rows.filter(r => r.unit === unit),
        windows,
        PARAMS,
      ),
    )
    .filter(Boolean);
}
let keys = 0;
const answer = (unit, at, grade) => ({
  kind: 'unit',
  unit,
  at,
  key: `k${String((keys += 1)).padStart(6, '0')}`,
  grade,
  responseFormat: 'single-choice',
});
const say = (unit, at, word) => ({
  kind: 'say',
  unit,
  at,
  key: `k${String((keys += 1)).padStart(6, '0')}`,
  say: word,
});

test('첫 걸음은 놓친 자리 하한(하나 이상)과 깨끗함에 기댄다 — 하한이 1 아래로 내려가지 않는지 지킨다(설계 검토 Fable P3)', () => {
  assert.ok(MONTH_FLOOR.misses >= 1, '하한을 내리면 record/lookback.mjs의 첫 걸음도 고친다');
});

test('앞 창 끝에 걸친 놓친 자리(첫 답은 창 안, 놓침은 창 뒤)는 그 놓침이 뒤 창에 들어 깨끗함을 깬다 — 조건을 넘는 단위의 놓침 줄은 모두 앞 창 안이다', async () => {
  const { from, to } = windows.monthAgo;
  const recent = [3, 2, 1].map(d => NOW - d * DAY);
  const rows = [
    // 단위 a: 앞 창 안에서 놓친 자리 둘 — 넘는다
    answer('a', from + DAY, 'again'),
    answer('a', from + 3 * DAY, 'again'),
    ...recent.map(at => answer('a', at, 'good')),
    // 단위 b: 앞 창 안의 놓친 자리 하나 + 끝에 걸친 자리(첫 답 to−1시간, 놓침 to+1시간) — 놓친 자리는 둘이지만 그 놓침이 뒤 창이다
    answer('b', from + DAY, 'again'),
    answer('b', to - HOUR, 'good'),
    answer('b', to + HOUR, 'again'),
    ...recent.map(at => answer('b', at, 'good')),
  ];
  const month = await lookbackOfStore(storeOf(rows), windows, PARAMS);
  assert.deepEqual(month, everyUnit(rows));
  assert.deepEqual(
    month.map(row => [row.unit, row.misses]),
    [['a', 2]],
    '끝에 걸친 자리의 놓침은 뒤 창이라 단위 b는 깨끗하지 않다',
  );
  const b = unitLookback(
    'b',
    rows.filter(row => row.unit === 'b'),
    windows,
    PARAMS,
  );
  assert.equal(b, null);
});

test('둘째 걸음은 단위의 줄을 처음부터 읽는다 — 창 직전에 열린 자리에 이어진 놓침을 새 자리로 세지 않는다(검토 S1)', async () => {
  const { from } = windows.monthAgo;
  const recent = [3, 2, 1].map(d => NOW - d * DAY);
  const rows = [
    answer('c', from - HOUR, 'good'), // 창 직전에 열린 자리
    answer('c', from + HOUR, 'again'), // 같은 자리의 놓침(6시간 안) — 창 안의 새 자리가 아니다
    answer('c', from + 3 * DAY, 'again'), // 창 안의 놓친 자리 하나
    ...recent.map(at => answer('c', at, 'good')),
  ];
  const month = await lookbackOfStore(storeOf(rows), windows, PARAMS);
  assert.deepEqual(month, [], '창 안에 첫 답이 든 놓친 자리는 하나뿐 — 조건을 넘지 않는다');
  assert.deepEqual(month, everyUnit(rows));
});

function lcg(seed) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}
const gradeOf = roll => (roll < 0.4 ? 'again' : roll < 0.5 ? 'hard' : 'good');
// 임의의 줄 하나 — before 앞(45일 안)의 시각에 둔다.
function randomRow(random, unit, before = NOW) {
  const start = NOW - 45 * DAY;
  const at = start + Math.floor(random() * (before - start));
  const roll = random();
  if (roll < 0.06) return say(unit, at, random() < 0.5 ? 'known' : 'relearn');
  return answer(unit, at, gradeOf(roll));
}
// 조건에 닿기 쉬운 단위 — 앞 창 놓침 둘과 뒤 창 맞힘 셋
const passing = unit => [
  answer(unit, windows.monthAgo.from + DAY, 'again'),
  answer(unit, windows.monthAgo.from + 3 * DAY, 'again'),
  ...[5, 3, 1].map(d => answer(unit, NOW - d * DAY, 'good')),
];
// 늘 뒤 창까지 잡음 줄을 두면 뒤 창에 놓침이 거의 늘 들어, 씨앗 60개 가운데 55개가 조건을 넘는 단위 0개였다. 그래서 첫 걸음이 단위를
// 빠뜨리는지와 낸 것의 차례를 거의 보지 못했다(4-4c 끝 판 카본 C2). 이제 절반의 단위는 잡음을 뒤 창 앞에만 두고, 단위 차례도 씨앗마다
// 섞는다(저장소가 단위 이름 차례가 아닌 차례로 돌려줘도 낸 것이 단위 이름 차례인지).
function randomRows(seed) {
  const random = lcg(seed);
  const rows = [];
  const units = ['u0', 'u1', 'u2', 'u3', 'u4', 'u5'];
  for (let i = units.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }
  for (const unit of units) {
    const before = random() < 0.5 ? windows.since.from : NOW;
    const count = 4 + Math.floor(random() * 30);
    for (let i = 0; i < count; i += 1) rows.push(randomRow(random, unit, before));
    if (random() < 0.5) rows.push(...passing(unit));
  }
  return rows;
}

test('lookbackOfStore = 모든 단위를 처음부터 센 것 — 임의의 줄(놓침 · 힌트 · 맞힘 · 본인 말, 45일)', async () => {
  for (const seed of seedRange({ count: 60 })) {
    const rows = randomRows(seed);
    const month = await lookbackOfStore(storeOf(rows), windows, PARAMS);
    assert.deepEqual(month, everyUnit(rows), `씨앗 ${seed}`);
  }
});

// 위 임의 시험은 씨앗 60개 가운데 55개에서 조건을 넘는 단위가 0개, 5개에서 1개라 낸 것의 차례를 견줄 일이 없었다 — lookbackOfStore의
// 정렬을 빼도 지나갔다(4-4c 끝 판 카본 C2 · 변형으로 확인). 그래서 차례는 여기서 따로 본다.
test('낸 것은 단위 이름 차례다 — 저장소가 다른 차례(talk는 시각 색인 차례)로 단위를 돌려줘도(4-4c 끝 판 카본 C2)', async () => {
  const rows = [...passing('w2'), ...passing('w0'), ...passing('w1')];
  const store = storeOf(rows);
  assert.deepEqual(
    await store.missedUnits(windows.monthAgo.from, windows.monthAgo.to),
    ['w2', 'w0', 'w1'],
    '저장소는 쌓인 차례로 돌려준다',
  );
  const month = await lookbackOfStore(store, windows, PARAMS);
  assert.deepEqual(
    month.map(entry => entry.unit),
    ['w0', 'w1', 'w2'],
  );
  assert.deepEqual(month, everyUnit(rows));
});

test('메모리 저장소(리허설 서버 · talk와 같은 포트)에서도 같다 — 접은 근거 줄로 센다', async () => {
  const server = createMemoryAccount();
  const memory = createMemory(PARAMS);
  const edition = foldEdition(PARAMS, undefined);
  let n = 0;
  const make = (type, fields, atMs) => {
    n += 1;
    return createEvent(type, fields, { id: eventId(atMs, n, 'lookback'), atMs, revision: 1 });
  };
  const presented = unit => ({
    setId: 'set1',
    itemKey: `it-${unit}`,
    familyKey: `fam-${unit}`,
    skillId: 'ko.listening.detail',
    difficulty: 1,
    responseFormat: 'single-choice',
    modality: 'listening',
    audioRequired: false,
    confounded: false,
    units: [unit],
    firstExposure: false,
    editions: { ...PARAMS.editions, index: 'index-0' },
    expected: { floor: 0.25, memory: 1, skill: 0.6 },
    arm: 'adaptive',
    reason: { code: 'unit.review', slots: {}, evidence: {}, target: unit, tier: 1, introduced: [] },
  });
  const events = [];
  const pair = (unit, atMs, verdict) => {
    const shown = make('practice.presented', presented(unit), atMs);
    events.push(
      shown,
      make(
        'practice.attempted',
        { presentationId: shown.id, attemptNo: 1, verdict, errorTags: [] },
        atMs + 1000,
      ),
    );
  };
  const { from } = windows.monthAgo;
  pair('w0', from + DAY, 'incorrect');
  pair('w0', from + 3 * DAY, 'incorrect');
  for (const d of [5, 3, 1]) pair('w0', NOW - d * DAY, 'correct');
  pair('w1', from + DAY, 'incorrect');
  for (const d of [5, 3, 1]) pair('w1', NOW - d * DAY, 'correct');
  server.append(events, NOW);
  for (let guard = 0; guard < 100; guard += 1)
    if ((await foldAccount(server.account, { memory, params: PARAMS, nowMs: NOW })).done) break;
  const store = server.account.store(edition);
  const month = await lookbackOfStore(store, windows, PARAMS);
  const all = (await store.unitRowsOf(['w0', 'w1'])).values();
  assert.deepEqual(month, everyUnit([...all].flat()));
  assert.deepEqual(
    month.map(row => row.unit),
    ['w0'],
    '놓친 자리 둘인 단위만',
  );
});
