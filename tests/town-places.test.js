'use strict';
// 싱크타운 장소와 자리 한 목록(세로 조각 설계 §5) — 원천 places.json, 생성물 data.gen.mjs, 그것을 읽는 곳들.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule, toolModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);

test('생성물이 원천과 같다(낡았으면 node tools/town-data-build.mjs)', async () => {
  const { build, TARGET } = await toolModule('town-data-build');
  assert.equal(fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n'), build());
});

test('한 목록으로 옮겨도 장소·자리 좌표는 그대로다', async () => {
  const { WALK_SPAWNS } = await townFile('walk.mjs');
  assert.deepEqual(JSON.parse(JSON.stringify(WALK_SPAWNS)), { home: { x: -6, z: 1.7 }, cafe: { x: 0, z: 2.5 }, workshop: { x: 6, z: 1.7 }, greenhouse: { x: 0, z: -4 } });
  const { DAY_LOCATIONS } = await townFile('day.mjs');
  assert.deepEqual(JSON.parse(JSON.stringify(DAY_LOCATIONS)), { home: { x: -6, z: 0, label: '집' }, cafe: { x: 0, z: 0, label: '찻집' }, workshop: { x: 6, z: 0, label: '공방' }, greenhouse: { x: 0, z: -6, label: '온실' } });
  const { SEATS, SIGN_SLOTS } = await townFile('core.mjs');
  assert.deepEqual(JSON.parse(JSON.stringify(SEATS)), {
    garden: { x: 65, y: 64, branch: 'outside' }, 'garden-right': { x: 78, y: 68, branch: 'outside' },
    'eaves-left': { x: 25, y: 54, branch: 'inside' }, 'eaves-right': { x: 39, y: 54, branch: 'inside' } });
  assert.deepEqual(JSON.parse(JSON.stringify(SIGN_SLOTS)), { 'entrance-left': { x: 15, y: 72 }, 'entrance-right': { x: 42, y: 82 } });
  const { FT_SEATS, HOME_SLOTS, PLAYER_PLACES, PLACE_BY_ID } = await townModule('places');
  assert.deepEqual(Object.fromEntries(Object.entries(FT_SEATS).map(([id, seat]) => [id, seat.at])),
    { garden: { x: -0.7, z: 2 }, 'garden-right': { x: 1.2, z: 2 }, 'eaves-left': { x: -1.2, z: 0.4 }, 'eaves-right': { x: 0.8, z: 0.4 } });
  assert.deepEqual(HOME_SLOTS, { window: { x: -6.7, z: -0.2 }, table: { x: -5.5, z: -0.2 } });
  assert.deepEqual(PLAYER_PLACES, ['home', 'cafe', 'workshop', 'greenhouse']);
  assert.deepEqual(PLAYER_PLACES.map(id => PLACE_BY_ID[id].labels.scene), ['우리 집', '찻집', '공방', '온실']);
  assert.deepEqual(PLAYER_PLACES.map(id => PLACE_BY_ID[id].labels.map), ['나의 집', '찻집', '공방', '온실']);
});

test('장소 목록을 따로 적어 둔 곳이 남지 않았다', () => {
  // 구현 대조 §2-3의 일곱 곳 + 옛 2D 자리 — 장소 넷의 좌표·이름은 places.json에서만 온다.
  for (const name of ['walk.mjs', 'day.mjs', 'day-scene.mjs', 'day-environment.mjs', 'day-district.mjs', 'day-app.mjs', 'core.mjs', 'life.mjs', 'app.mjs']) {
    const code = fs.readFileSync(path.join(ROOT, 'experiences/synk-town', name), 'utf8');
    assert.match(code, /from '\.\/town\/places\.mjs'/, `${name}는 places.mjs를 읽는다`);
    assert.doesNotMatch(code, /greenhouse:\s*\[0,\s*-6\]|greenhouse:\s*\{\s*x:\s*0,\s*z:\s*-[46]|\['home',\s*'cafe',\s*'workshop',\s*'greenhouse'\]|x:\s*65,\s*y:\s*64|x:\s*15,\s*y:\s*72/, `${name}에 옛 목록이 남았다`);
  }
});

test('자리 묶음과 비 올 때 대안', async () => {
  const { spotsOf, SPOTS, SPOT_BY_ID } = await townModule('places');
  assert.deepEqual(spotsOf('cafe.seats').map(s => s.id), ['cafe.garden', 'cafe.garden-right', 'cafe.eaves-left', 'cafe.eaves-right']);
  assert.deepEqual(spotsOf('workshop.rest').map(s => s.id), ['workshop.rest']);
  assert.throws(() => spotsOf('nowhere.seat'), RangeError);
  for (const spot of SPOTS.filter(s => s.place === 'cafe' && s.kind === 'sit' && !s.sheltered)) {
    assert.ok(SPOTS.some(alt => alt.sheltered && (alt.rainAltFor || []).includes(spot.id)), `${spot.id}에 비 피할 대안 자리가 있다`);
  }
  for (const spot of SPOTS) {
    assert.ok(spot.at.x >= -13.6 && spot.at.x <= 13.6 && spot.at.z >= -12.2 && spot.at.z <= 8.7, `${spot.id}는 마을 안`);
  }
  assert.equal(SPOT_BY_ID['cafe.eaves-left'].sheltered, true);
});

test('원천 검사는 어긋난 자리를 막는다', async () => {
  const { validatePlaces } = await toolModule('town-data-build');
  const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/synk-town/town/data/places.json'), 'utf8'));
  assert.doesNotThrow(() => validatePlaces(structuredClone(source)));
  const broken = edit => { const copy = structuredClone(source); edit(copy); return () => validatePlaces(copy); };
  assert.throws(broken(d => d.spots.push({ ...d.spots[0] })), /자리 ID/);
  assert.throws(broken(d => { d.spots[0].place = 'cafe'; }), /장소/);
  assert.throws(broken(d => { delete d.spots.find(s => s.ftSeat).legacy2d; }), /FT 자리/);
  assert.throws(broken(d => { d.spots.find(s => s.ftSeat === 'eaves-left').sheltered = false; }), /FT 자리|대안 자리/);
  assert.throws(broken(d => { d.spots.find(s => s.id === 'cafe.eaves-left').rainAltFor = ['cafe.nowhere']; }), /rainAltFor/);
  assert.throws(broken(d => { d.groups['cafe.seats'].push('cafe.nowhere'); }), /묶음/);
  assert.throws(broken(d => { d.places[0].spawn = null; }), /spawn/);
});
