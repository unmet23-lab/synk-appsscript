'use strict';
// 싱크타운 매개변수 판·회차·브레이크(세로 조각 설계 §20-6, 시험 §20-10 town-params)와 W2 첫 커밋의 places 칸(§20-8·§20-9).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, TOWN, townModule, toolModule } = require('./lib/town.js');

const HOUR = 3600000;
const leaves = value => (Array.isArray(value) ? value.flatMap(leaves) : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : [value]);
const codeOf = file => fs.readFileSync(path.join(TOWN, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const numbersIn = code => new Set((code.match(/(?<![\w.$])\d+(?:\.\d+)?(?![\w.])/g) || []).map(Number));

// 판에서만 읽어야 하는 이름 묶음 — 모듈이 늘면 여기에 그 모듈과 묶음을 더한다(brake는 되돌림 작업이 붙을 때).
const READS = { 'plan.mjs': ['planner', 'cards', 'pairs'], 'state.mjs': ['state'], 'seen.mjs': ['seen'], 'prefs.mjs': ['prefs', 'observe', 'asks'], 'eval.mjs': ['eval'],
  // W5: the cards and pairs, what residents know of each other.
  'cards.mjs': ['cards', 'pairs'], 'knowledge.mjs': ['knowledge'],
  // W8: the tea order — the first life activity. W8b: gathering — the second.
  'activities/tea-order.mjs': ['tea'], 'activities/gather.mjs': ['gather'] };

test('〔초기값〕은 판에서만 읽는다 — 그 값을 코드에 숫자로 쓴 곳이 없다', async () => {
  const { paramsFor, FIRST_PARAMS_VER } = await townModule('params');
  assert.equal(FIRST_PARAMS_VER, 'town-params-1');
  for (const [file, sections] of Object.entries(READS)) {
    const numbers = numbersIn(codeOf(file));
    for (const section of sections) {
      const values = leaves(paramsFor()[section]).filter(v => v > 1);
      assert.ok(values.length, `${section}에 값이 있다`);
      for (const value of values) assert.ok(!numbers.has(value), `${file}에 ${section}의 값 ${value}을 숫자로 썼다`);
    }
  }
});

test('계획기는 넘겨받은 판으로 돈다 — 판을 바꾸면 결과가 바뀌고, 같은 판이면 같다', async () => {
  const { planBand } = await townModule('plan');
  const { paramsFor } = await townModule('params');
  // 2026-10-22(목) 생활일, 한국 05:00 시작 — town-plan 시험과 같은 날.
  const lifeDay = 20748, dayStart = Date.UTC(2026, 9, 22, 5, 0) - 540 * 60000;
  const input = extra => ({ villageSeed: 'params-probe', lifeDay, band: 'day', startMs: dayStart + 6 * HOUR, endMs: dayStart + 12 * HOUR,
    dayStartMs: dayStart, planCmdRev: 0, weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', ...extra });
  const plain = planBand(input());
  assert.deepEqual(planBand(input({ params: paramsFor('town-params-1') })), plain);
  const slower = structuredClone(paramsFor());
  slower.planner.residentSpeed = 0.6;
  assert.notDeepEqual(planBand(input({ params: slower })).segments, plain.segments);
});

test('판 검사는 이름이 어긋난 판·정수가 아닌 값·겹친 판 이름을 막는다', async () => {
  const { validateParams } = await toolModule('town-data-build');
  const source = JSON.parse(fs.readFileSync(path.join(TOWN, 'data/params.json'), 'utf8'));
  assert.doesNotThrow(() => validateParams(structuredClone(source)));
  const broken = edit => { const copy = structuredClone(source); edit(copy); return () => validateParams(copy); };
  const second = copy => { const next = structuredClone(copy.versions[0]); next.paramsVer = 'town-params-2'; copy.versions.push(next); return next; };
  assert.doesNotThrow(broken(d => { second(d).planner.habitWeight = 250; }));
  assert.throws(broken(d => { delete second(d).planner.habitWeight; }), /이름이 첫 판과 달라요/);
  assert.throws(broken(d => { second(d).paramsVer = 'town-params-1'; }), /판 이름/);
  assert.throws(broken(d => { d.versions[0].planner.repeatMultiplier = 0.5; }), /repeatMultiplier/);
  assert.throws(broken(d => { d.versions[0].seen.countMax = -1; }), /countMax/);
});

test('회차: 기본 회차 몫 0이면 늘 adapted, stop이면 모두 첫 판의 baseline, 같은 방문은 같은 회차', async () => {
  const { armFor, policyFor, validateOps, eventMarks, adaptedOn, DEFAULT_OPS, FIRST_PARAMS_VER } = await townModule('params');
  const visits = Array.from({ length: 200 }, (_, i) => `V-20748-${i}`);
  assert.ok(visits.every(v => armFor('seed-a', v) === 'adapted'));
  assert.ok(visits.every(v => armFor('seed-a', v, { ...DEFAULT_OPS, stop: true }) === 'baseline'));
  assert.ok(visits.every(v => armFor('seed-a', v, { ...DEFAULT_OPS, baselineShare: 1000 }) === 'baseline'));
  const half = visits.map(v => armFor('seed-a', v, { ...DEFAULT_OPS, baselineShare: 500 }));
  assert.ok(half.includes('adapted') && half.includes('baseline'));
  assert.deepEqual(visits.map(v => armFor('seed-a', v, { ...DEFAULT_OPS, baselineShare: 500 })), half, '같은 방문 id면 같은 회차');
  const stopped = policyFor({ villageSeed: 'seed-a', visitId: 'V-1', ops: { ...DEFAULT_OPS, stop: true } });
  assert.deepEqual({ ...stopped }, { visitId: 'V-1', paramsVer: FIRST_PARAMS_VER, arm: 'baseline' });
  assert.equal(adaptedOn(stopped), false);
  assert.equal(adaptedOn(policyFor({ villageSeed: 'seed-a', visitId: 'V-1' })), true);
  assert.throws(() => validateOps({ ...DEFAULT_OPS, active: 'town-params-99' }), RangeError);
  assert.throws(() => validateOps({ ...DEFAULT_OPS, baselineShare: 1001 }), RangeError);
  assert.throws(() => validateOps({ ...DEFAULT_OPS, extra: 1 }), TypeError);
  const policy = policyFor({ villageSeed: 'seed-a', visitId: 'V-2' });
  assert.deepEqual(eventMarks(policy, { inVisit: true }), { paramsVer: 'town-params-1', arm: 'adapted' });
  assert.deepEqual(eventMarks(policy, { inVisit: false }), { paramsVer: 'town-params-1' }, '방문 밖 결산 사건에는 판만');
});

test('장소마다 지역(area)이 있고, 채집 자리 셋은 주민 일과에 들지 않는 플레이어 자리다', async () => {
  const { PLACES, SPOT_BY_ID, spotsOf } = await townModule('places');
  const { ROUTINES } = await townModule('data.gen');
  assert.ok(PLACES.every(place => place.area === 'cafe-alley'));
  const gather = ['greenhouse.bed-edge', 'cafe.pots', 'lane.wall'];
  for (const id of gather) assert.deepEqual([SPOT_BY_ID[id].kind, SPOT_BY_ID[id].owner, SPOT_BY_ID[id].measured], ['gather', 'player', false], id);
  assert.equal(SPOT_BY_ID['greenhouse.bed-edge'].sheltered, true);
  const planned = new Set(ROUTINES.flatMap(cell => [...cell.pool, ...Object.values(cell.habitPool || {}).flat()]).flatMap(item => spotsOf(item.spot).map(s => s.id)));
  for (const id of gather) assert.ok(!planned.has(id), `${id}가 주민 일과에 있다`);
  const { validatePlaces } = await toolModule('town-data-build');
  const source = JSON.parse(fs.readFileSync(path.join(TOWN, 'data/places.json'), 'utf8'));
  const broken = edit => { const copy = structuredClone(source); edit(copy); return () => validatePlaces(copy); };
  assert.throws(broken(d => { delete d.places[0].area; }), /area/);
  assert.throws(broken(d => { d.spots.find(s => s.kind === 'gather').owner = 'cafe-owner'; }), /채집 자리/);
});

test('판 파일은 저장소 안 한 곳이고 생성물에 실린다', async () => {
  const { PARAMS } = await townModule('data.gen');
  assert.deepEqual(PARAMS.map(v => v.paramsVer), ['town-params-1']);
  assert.ok(Object.isFrozen(PARAMS[0].planner));
  assert.ok(fs.existsSync(path.join(ROOT, 'experiences/synk-town/town/data/params.json')));
});
