'use strict';
// 싱크타운 「본 것」 장부(세로 조각 설계 §20-2, 시험 §20-10 town-seen) — 키와 횟수만, 날짜 칸 없음, 아는 키만, 요청당 상한.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

async function setup() {
  const seen = await townModule('seen');
  const { paramsFor } = await townModule('params');
  const { ITEMS } = await townModule('data.gen');
  const known = seen.contentCatalog({ items: ITEMS.map(item => item.id), lines: ['GREET-1', 'GREET-2'], pairs: [['PAIR01', '1'], ['PAIR01', '2']] });
  return { ...seen, known, params: paramsFor() };
}

test('아는 키만 더하고, 모르는 키·꼴이 틀린 키는 버린다 · 날짜 칸이 없다', async () => {
  const { recordSeen, known, validSeen } = await setup();
  const { seen, added } = recordSeen({}, ['card:C1:player', 'gather:mint', 'card:C9:player', 'line:NOPE', 'when:2026-10-22', 'card:C1:player'], { known });
  assert.deepEqual(added, ['card:C1:player', 'gather:mint']);
  assert.deepEqual(seen, { 'card:C1:player': 1, 'gather:mint': 1 }, '같은 요청에서 같은 키는 한 번');
  assert.ok(validSeen(seen));
  assert.equal(validSeen({ ...seen, lastSeenAt: 1792663200000 }), false, '날짜·시각 칸은 장부에 없다');
});

test('요청당 상한까지만, 횟수는 상한에서 멈춘다', async () => {
  const { recordSeen, contentCatalog, params } = await setup();
  const lines = Array.from({ length: params.seen.perRequest + 10 }, (_, i) => `L${i}`);
  const known = contentCatalog({ lines });
  const { added } = recordSeen({}, lines.map(line => `line:${line}`), { known });
  assert.equal(added.length, params.seen.perRequest);
  let seen = {};
  for (let i = 0; i < params.seen.countMax + 5; i++) seen = recordSeen(seen, ['line:L0'], { known }).seen;
  assert.equal(seen['line:L0'], params.seen.countMax);
});

test('「익숙한 생활」은 본 것의 횟수로 — 카드·쌍 장면은 길·단계를 더한 합이 문턱을 넘을 때', async () => {
  const { recordSeen, familiar, known, params } = await setup();
  let seen = {};
  // 마을에서 C1이 열 번 일어나도(times) 플레이어가 겪지 않았으면 익숙하지 않다.
  assert.equal(familiar(seen, { card: 'C1' }), false);
  for (const path of ['self', 'pair', 'player', 'self']) seen = recordSeen(seen, [`card:C1:${path}`], { known }).seen;
  assert.equal(familiar(seen, { card: 'C1' }), 4 > params.seen.familiarAfter);
  let pair = {};
  for (const step of ['1', '1', '2', '2']) pair = recordSeen(pair, [`pair:PAIR01:${step}`], { known }).seen;
  assert.equal(familiar(pair, { pair: 'PAIR01' }), 4 > params.seen.familiarAfter, 'PAIR01을 단계마다 두 번씩');
});

test('「새 이야기」·덜 본 변형 고르기·비우기', async () => {
  const { recordSeen, isNewStory, leastSeen, clearSeen, known } = await setup();
  const { seen } = recordSeen({}, ['line:GREET-1'], { known });
  assert.equal(isNewStory(seen, 'line:GREET-1'), false);
  assert.equal(isNewStory(seen, 'line:GREET-2'), true);
  assert.equal(leastSeen(['line:GREET-1', 'line:GREET-2'], seen), 'line:GREET-2', '덜 본 쪽을 먼저(기기 사본으로)');
  assert.equal(leastSeen(['line:GREET-2', 'line:GREET-1'], {}), 'line:GREET-2', '같으면 앞의 것');
  assert.equal(isNewStory(clearSeen(), 'line:GREET-1'), true, '비우면 모두 다시 새 이야기');
});
