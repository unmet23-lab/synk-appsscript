'use strict';
// 싱크타운 머무는 모드(세로 조각 W7b, 마을 설계 §4-4) — 앉을 자리는 길가 벤치 둘과 집 둥근 창 아래 벤치이고, 그 자리는 걷기
// 충돌 상자 그대로다(부딪히는 벤치가 앉는 벤치). 주민 계획의 자리와 겹치지 않고, 어둡게 하는 막은 낮에 짙고 밤에 옅다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, TOWN, townModule } = require('./lib/town.js');

const walk = () => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/walk.mjs')).href);
const generated = () => import(pathToFileURL(path.join(TOWN, 'data.gen.mjs')).href);

test('앉을 자리 셋은 걷기 충돌 상자에서 자리를 읽는다 — 이름이 다 있고, 한가운데는 걸어 들어갈 수 없다', async () => {
  const { SEATS } = await townModule('stay'), { STAY } = await generated(), { WALK_SOLIDS, isWalkable } = await walk();
  assert.equal(SEATS.length, STAY.seats.length, '표의 자리가 모두 상자를 찾았다');
  assert.deepEqual(SEATS.map(s => s.id), ['street-bench-left', 'street-bench-right', 'home-window-bench']);
  for (const row of STAY.seats) assert.ok(WALK_SOLIDS.some(s => s.id === row.solid), `${row.solid}가 walk.mjs에 있다`);
  for (const seat of SEATS) {
    assert.equal(isWalkable({ x: seat.x, z: seat.z }), false, `${seat.id} 한가운데는 벤치다`);
    assert.ok(seat.reach > 0 && seat.seatTop > 0, `${seat.id} 범위·높이`);
  }
  const home = SEATS.find(s => s.id === 'home-window-bench');
  assert.ok(Math.abs(home.x + 5.18) < 1e-9 && Math.abs(home.z + .7) < 1e-9, '집 둥근 창 아래 벤치 (−5.18, −.70)');
  assert.equal(home.sheltered, true); assert.equal(SEATS.find(s => s.id === 'street-bench-left').sheltered, false);
});

test('벤치 앞에 서면 그 벤치에 앉을 수 있고, 골목 한가운데·찻집 앞에서는 앉을 자리가 없다', async () => {
  const { seatNear, SEATS } = await townModule('stay'), { isWalkable } = await walk();
  const front = seat => ({ x: seat.x, z: seat.z + seat.halfZ + .2 });
  for (const seat of SEATS) {
    const point = front(seat);
    assert.ok(isWalkable(point), `${seat.id} 앞은 걸을 수 있다`);
    assert.equal(seatNear(point)?.id, seat.id, `${seat.id} 앞에서 그 자리`);
  }
  assert.equal(seatNear({ x: 0, z: 2.5 }), null, '찻집 앞');
  assert.equal(seatNear({ x: 0, z: -4 }), null, '온실 앞');
  assert.equal(seatNear(null), null);
});

test('머무는 자리는 주민 계획의 자리와 겹치지 않는다 — 주민이 쓰려는 자리를 플레이어가 차지하지 않는다', async () => {
  const { SEATS } = await townModule('stay'), { SPOTS } = await generated();
  for (const seat of SEATS) for (const spot of SPOTS.filter(s => s.owner !== 'player')) {
    const inside = Math.abs(spot.at.x - seat.x) <= seat.halfX && Math.abs(spot.at.z - seat.z) <= seat.halfZ;
    assert.equal(inside, false, `${seat.id}가 주민 자리 ${spot.id}를 덮는다`);
  }
});

test('머무는 화면의 글에는 시간·기다림·재촉·숫자가 없다(G2·G3·G9) — 금지 말 검사기와 같은 잣대', async () => {
  const fs = require('node:fs');
  const { scanText } = await import(pathToFileURL(path.join(ROOT, 'tools/town-lines-check.mjs')).href);
  const { STAY } = await generated();
  const source = fs.readFileSync(path.join(ROOT, 'experiences/synk-town/day-stay.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const texts = [...(source.match(/'[^'\n]*[가-힣][^'\n]*'|`[^`\n]*[가-힣][^`\n]*`/g) || []), ...STAY.seats.map(seat => seat.label)];
  assert.ok(texts.length >= 10, `화면 글 ${texts.length}개를 모았다`);
  for (const text of texts) {
    assert.deepEqual(scanText(text), [], `금지 말: ${text}`);
    assert.doesNotMatch(text, /\d|분|시간|오늘\s?하루|연속|집중/, `머문 시간·숫자를 보이지 않는다: ${text}`);
  }
});

test('어둡게 하는 막은 낮에 짙고 밤에 옅다 — 깊은 밤에도 장면이 남는다', async () => {
  const { dimAlpha } = await townModule('stay'), { lightAt } = await townModule('light');
  const at = time => dimAlpha(lightAt({ villageSeed: 'synk-town', tz: 540, ms: Date.parse(`2026-10-25T${time}:00+09:00`) }));
  const noon = at('12:30'), night = at('01:30');
  assert.ok(noon > night, `한낮 ${noon} > 깊은 밤 ${night}`);
  assert.ok(night > 0 && noon < .6, '막은 장면을 지우지 않는다');
  assert.equal(dimAlpha(null), noon, '시계가 없으면 승인된 한낮과 같다');
});

test('조용한 그리기 — 프레임·앱 고리·빛 갱신이 걷는 동안보다 느리고, 맥박은 임대보다 짧다(걷기 시계·U가 끊기지 않게)', async () => {
  const { QUIET } = await townModule('stay');
  const { PRESENCE_LEASE_MS } = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/presence.mjs')).href);
  assert.ok(QUIET.fps < 60 && QUIET.appHz < 60 && QUIET.idleHz < QUIET.appHz && QUIET.pixelRatio <= 1);
  assert.ok(QUIET.pulseMs > 1000 && QUIET.pulseMs < PRESENCE_LEASE_MS, `맥박 ${QUIET.pulseMs} < 임대 ${PRESENCE_LEASE_MS}`);
  assert.ok(QUIET.lightMs >= 1000 && QUIET.cardMs >= 1000);
});

test('앉은 창이 맥박을 2초마다 쳐도 임대는 끊기지 않는다 — owner·fence·걷기 시계·방문이 그대로이고 U는 다 쌓인다', async () => {
  const { QUIET } = await townModule('stay');
  const { initialLease, pulseLease } = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/presence.mjs')).href);
  const flags = { surfaceId: 'seated-window', surface: 'day', foreground: true, safe: false };
  let at = 1_000_000, lease = pulseLease(initialLease(), flags, at).lease;
  lease = { ...lease, walkClock: { at, surfaceId: 'seated-window', fence: lease.presence.fence } };
  const fence = lease.presence.fence, u0 = lease.uMs, hours = 3, beats = hours * 3600000 / QUIET.pulseMs;
  for (let i = 0; i < beats; i++) { at += QUIET.pulseMs; const next = pulseLease(lease, flags, at); lease = next.lease; assert.equal(next.visitEnded, false); }
  assert.equal(lease.presence.owner, 'seated-window'); assert.equal(lease.presence.fence, fence);
  assert.ok(lease.walkClock, '걷기 시계가 남아 일어나 걷는 첫 걸음이 되돌려지지 않는다');
  assert.equal(lease.uMs - u0, beats * QUIET.pulseMs, '머문 시간 내내 U가 쌓인다');
});
