'use strict';
// 싱크타운 살아 있는 마을(세로 조각 설계 §6-6·§14-4, W3 통합) — 주민은 골목으로 걷고, 장면은 계획기 조각으로 그린다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);

test('경유 길: 장소 사이 길의 문·골목 구간은 모두 걷기 영역 안이고, 찻집→온실은 뒷벽을 지나지 않는다', async () => {
  const plan = await townModule('plan');
  const { isWalkable } = await townFile('walk.mjs');
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
    for (let i = 0; i <= n; i++) if (!isWalkable({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n })) return false;
    return true;
  };
  const { SPOT_BY_ID } = await townModule('places');
  const residentSpots = Object.values(SPOT_BY_ID).filter(s => s.kind !== 'gather' && s.owner !== 'player').map(s => s.id);
  for (const from of residentSpots) for (const to of residentSpots) {
    const route = plan.routeBetween(from, to);
    assert.ok(route.length >= 2, `${from}→${to}`);
    // 첫 구간(자리→문)과 끝 구간(문→자리)은 장소 안이다. 그 사이 골목 구간만 걷기 영역으로 잰다.
    for (let i = 1; i + 2 < route.length; i++) assert.ok(clear(route[i], route[i + 1]), `${from}→${to} ${JSON.stringify(route[i])}→${JSON.stringify(route[i + 1])}`);
  }
  const cafeToGreenhouse = plan.routeBetween('cafe.prep', 'greenhouse.board');
  assert.ok(cafeToGreenhouse.length > 2 && cafeToGreenhouse.every(p => !(Math.abs(p.x) < 2 && p.z < -1.5 && p.z > -2.5)), JSON.stringify(cafeToGreenhouse));
  assert.ok(plan.travelMs('cafe.prep', 'greenhouse.board') > plan.travelMs('cafe.prep', 'cafe.garden'));
});
