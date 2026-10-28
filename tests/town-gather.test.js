'use strict';
// 싱크타운 채집 고리(세로 조각 설계 §20-8, W8b, 시험 §20-10 town-gather · town-ledger): 같은 마을·날·날씨면 같은 몫 · 지난 몫은
// 쌓이지 않음 · 채집이 주민을 나쁘게 하지 않음 · 희귀 확률 없음 · 계절 재료는 조건이 아님 · 바로 따기 · C3 「나와 함께」(deliver),
// 원장(같은 명령 = 같은 지급 · 999 · 기기 잔액 무시 · 드리기는 옮김 · 도감은 첫 지급), 오늘의 차 · 손님이 찾음 · 함께 따기.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const load = file => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', file)).href);
const TZ = 540, MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const kst = (month, day, h, m = 0) => Date.UTC(2026, month - 1, day, h - 9, m);
const MORNING = kst(10, 23, 9, 30);   // 2026-10-23 09:30 KST — morning band, autumn
const BED = { x: -0.9, z: -6.6 }, POTS = { x: -1.67, z: -1.47 }, WALL = { x: 4, z: -1.3 };

/** A world at a time, the player walking, commands sent straight to the reducer (the store settled it at that time). */
async function world({ at = MORNING, seed = 'acct-gather' } = {}) {
  const [{ createStore }, core, walk] = await Promise.all([load('server.mjs'), load('core.mjs'), load('walk.mjs')]);
  const store = createStore({ now: () => at, tz: TZ, villageSeed: seed, sleeps: true, lifeEnabled: true });
  store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true });
  let state = store.read().state, n = 0, now = at;
  const host = t => ({ enabled: true, surface: 'day', nowMs: t, villageSeed: seed, canRun: true, surfaceId: 'day-a', ownerSurfaceId: 'day-a', elapsedMs: 0 });
  return {
    core, get state() { return state; }, set state(value) { state = value; }, get now() { return now; },
    /** Stands on the walkable ground nearest a point (a spot itself may sit in a bed). */
    standAt(point) {
      let best = null;
      for (let dx = -1.2; dx <= 1.2; dx += .05) for (let dz = -1.2; dz <= 1.2; dz += .05) {
        const p = { x: point.x + dx, z: point.z + dz }, d = Math.hypot(dx, dz);
        if (walk.isWalkable(p) && (!best || d < best.d)) best = { ...p, d };
      }
      state.day.walk = { enabled: true, x: best.x, z: best.z, headingX: 0, headingZ: -1 };
      return best.d;
    },
    send(type, payload = {}, id = `c-${++n}`) { state = core.reduceCommand(state, { id, type, payload, expectedRevision: state.revision }, host(now)).state; return state; },
    /** The same command sent again — its id, body and expected revision as before (a retried request). */
    resend(command) { return core.reduceCommand(state, command, host(now)); },
    /** The clock moves on as the store settles it: the living step, the village's bands closed, the window seen then. */
    advance(ms) {
      now += ms;
      core.stepLiving(state, host(now));
      state = core.closeLiving(state, now, { seed, offsetMin: TZ, sleeps: true });
      state.lifeHost = { ...(state.lifeHost || {}), lastForegroundAt: now };
    },
    view: () => core.viewFor(state).gather,
    events: kind => state.townEvents.filter(e => e.kind === kind),
    owner: () => core.viewFor(state).gather.owner,
  };
}
const spotOf = (view, id) => view.spots.find(s => s.id === id);

test('같은 마을 · 같은 생활일 · 같은 날씨면 같은 몫과 같은 가지 — 해시(마을 씨앗, gather, 생활일, 자리)와 시계(§20-8, 결정성 §2-4)', async () => {
  const [a, b, c] = await Promise.all([world(), world(), world({ seed: 'acct-other' })]);
  assert.deepEqual(a.view().spots, b.view().spots, '두 기기가 같은 몫·같은 가지');
  assert.notDeepEqual(a.view().spots.map(s => s.board), c.view().spots.map(s => s.board), '다른 마을은 다른 가지');
  const g = await load('town/activities/gather.mjs');
  const bed = spotOf(a.view(), 'greenhouse.bed-edge');
  assert.deepEqual(g.boardOf(bed), g.boardOf(structuredClone(bed)), '가지는 몇 번을 그려도 같다');
  const leaves = g.boardOf(bed);
  assert.ok(leaves.length >= bed.branch - 1 && leaves.length <= bed.branch, '잎 서넛');
  assert.equal(leaves.filter(l => l.item).length, bed.items.filter(i => i.grows).reduce((n, i) => n + i.left, 0), '어린잎 수 = 남은 몫(숫자 없이 잎으로)');
  assert.ok(!JSON.stringify(a.view()).includes('acct-gather'), '마을 씨앗(talk의 계정 ID)은 화면에 가지 않는다');
});

test('나는 때는 시계로만 — 구간 · 지금 날씨 · 그날 날씨 꼴 · 계절 · 비 그친 뒤, 희귀 확률 없음(§20-8, 경제:479)', async () => {
  const g = await load('town/activities/gather.mjs');
  const at = (band, extra = {}) => ({ band, season: 'autumn', weatherNow: 'clear', weatherDay: 'clear-day', afterRain: false, ...extra });
  assert.deepEqual(['morning', 'day', 'evening', 'night'].map(b => g.grows('leaf-young', at(b))), [true, true, false, false]);
  assert.deepEqual(['morning', 'day', 'evening', 'night'].map(b => g.grows('mint', at(b))), [false, true, true, false]);
  assert.equal(g.grows('mint', at('day', { weatherNow: 'rain' })), false, '박하는 맑을 때');
  assert.equal(g.grows('leaf-dew', at('morning')), false);
  assert.equal(g.grows('leaf-dew', at('morning', { weatherDay: 'am-rain-clearing' })), true, '아침 비가 그친 날의 맑은 아침');
  assert.equal(g.grows('leaf-dew', at('morning', { weatherDay: 'am-rain-clearing', weatherNow: 'rain' })), false);
  assert.deepEqual(['spring', 'summer', 'autumn', 'winter'].map(season => g.grows('chrysanthemum', at('night', { season }))), [false, false, true, false]);
  assert.equal(g.grows('petal-rain', at('day')), false);
  assert.equal(g.grows('petal-rain', at('day', { afterRain: true })), true);
  // No chance anywhere: the table names clock rules only, and the rule reads nothing but the clock.
  const { GATHER_GROWS } = await import(pathToFileURL(path.join(ROOT, 'tools', 'town-data-build.mjs')).href);
  for (const row of Object.values(g.GATHER.items)) assert.ok(Object.keys(row.grows).every(k => GATHER_GROWS.includes(k)), JSON.stringify(row.grows));
  const code = fs.readFileSync(path.join(ROOT, 'experiences/synk-town/town/activities/gather.mjs'), 'utf8');
  const growsCode = code.slice(code.indexOf('export function grows'), code.indexOf('const dayOf'));
  assert.doesNotMatch(growsCode, /rng|random|hash|seed/i, '나는 때는 씨앗을 읽지 않는다');
});

test('비 그친 뒤 꽃잎 — 그친 때부터 그다음 구간이 끝날 때까지, 그 사이 맑을 때만(§20-8)', async () => {
  const clock = await load('town/clock.mjs');
  // A village and a Korean date whose rain stops at 10:00 (am-rain-clearing): petals from 10:00 to the day band's end (17:00).
  let seed = null, date = null;
  for (let i = 0; i < 400 && !seed; i++) for (let d = 1; d <= 30 && !seed; d++) {
    const s = `acct-petal-${i}`, day = Math.floor(kst(11, d, 12) / DAY);
    if (clock.weatherDayOf(s, day) === 'am-rain-clearing' && clock.weatherDayOf(s, day - 1) !== 'rain-day') { seed = s; date = d; }
  }
  assert.ok(seed, '비가 아침에 그치는 날이 있는 마을');
  const at = async (h, m) => { const w = await world({ at: kst(11, date, h, m), seed }); return spotOf(w.view(), 'lane.wall').items[0]; };
  assert.equal((await at(9, 30)).grows, false, '비 오는 동안은 없다');
  assert.equal((await at(10, 30)).grows, true, '그친 뒤 아침 구간의 남은 때');
  assert.equal((await at(16, 30)).grows, true, '그다음 구간(낮)까지');
  assert.equal((await at(17, 30)).grows, false, '그 뒤엔 없다 — 놓쳤다는 알림도 없다(G9)');
  const dew = spotOf((await world({ at: kst(11, date, 10, 30), seed })).view(), 'greenhouse.bed-edge').items.find(i => i.item === 'leaf-dew');
  assert.equal(dew.grows, true, '이슬 맺힌 잎도 그 아침에');
});

test('따기 — 원장에 하나 지급(원인 = 딴 사건), 그날 몫까지, 멀면 · 지금 안 나면 · 다른 자리 재료면 거절, 기기가 보낸 잔액 칸은 읽지 않는다', async () => {
  const w = await world();
  assert.throws(() => w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' }), { code: 'gather-too-far' }, '걷기 위치가 자리 곁이 아니다');
  assert.ok(w.standAt(BED) < 0.6, '화단 안 기준점 곁에 설 수 있다');
  assert.throws(() => w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'mint' }), { code: 'gather-spot' });
  assert.throws(() => w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-dew' }), { code: 'gather-not-now' });
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young', qty: 999, balance: 999 });
  const [picked] = w.events('gather.picked'), [granted] = w.events('item.granted');
  assert.deepEqual([picked.alongside, granted.cause, granted.qty, granted.itemId], [false, picked.id, 1, 'leaf-young'], '기기의 수·잔액 칸은 읽지 않는다');
  assert.equal(w.state.ledger.discoveries['leaf-young'], granted.grantId, '도감은 첫 지급 사건');
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  assert.throws(() => w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' }), { code: 'gather-done' }, '하루 몫 셋');
  assert.equal(w.state.ledger.discoveries['leaf-young'], granted.grantId, '두 번째 지급은 도감을 바꾸지 않는다');
  assert.deepEqual(w.view().basket, [{ item: 'leaf-young', qty: 3 }]);
  assert.equal(spotOf(w.view(), 'greenhouse.bed-edge').items[0].left, 0, '남은 몫은 0 — 화면은 어린잎 없는 가지');
  assert.equal(new Set(w.events('item.granted').map(e => e.grantId)).size, 3, '지급 ID는 원인마다 다르다');
});

test('같은 명령 ID는 같은 지급 · 999를 넘는 지급은 아무것도 바꾸지 않는다(§20-7 ①, 경제:130)', async () => {
  const w = await world();
  w.standAt(BED);
  const command = { id: 'same-id', type: 'GATHER_PICK', payload: { spot: 'greenhouse.bed-edge', item: 'leaf-young' }, expectedRevision: w.state.revision };
  w.state = w.resend(command).state;
  const before = JSON.stringify(w.state);
  const again = w.resend(command);
  assert.equal(again.duplicate, true);
  assert.equal(JSON.stringify(again.state), before, '다시 보낸 같은 명령은 새 지급이 없다');
  w.state.ledger.inventory[0].qty = 999;
  const full = JSON.stringify(w.state);
  assert.throws(() => w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' }), { code: 'gather-full' });
  assert.equal(JSON.stringify(w.state), full, '가득 찬 바구니는 확정 전에 알리고 아무것도 바꾸지 않는다');
});

test('몫은 생활일마다 새로 — 지난 몫은 쌓이지 않고 가진 재료는 줄지 않는다(7일 비운 뒤도 그날 몫뿐, G3)', async () => {
  const w = await world();
  w.standAt(BED);
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  w.advance(7 * DAY);
  const g = await load('town/activities/gather.mjs'), quota = w.core.paramsFor ? null : null;
  const bed = spotOf(w.view(), 'greenhouse.bed-edge');
  assert.equal(bed.items.find(i => i.item === 'leaf-young').left, 3, '이레 뒤에도 그날 몫 셋 — 밀린 몫 없음');
  assert.deepEqual(w.view().basket, [{ item: 'leaf-young', qty: 1 }], '가진 재료는 그대로');
  assert.equal(g.leftOf({ lifeDay: 1, picked: { 'leaf-young': 2 } }, 'leaf-young', { quota: { 'leaf-young': 3 } }), 1);
  assert.ok(quota === null);
});

test('드리기 — 그 재료 전부를 잎 통으로 옮김(복제 아님), 마모는 드린 만큼 줄고, 오늘의 차 = 마지막 드린 것, 꽃잎은 차를 안 바꾼다(§20-8)', async () => {
  const w = await world();
  w.standAt(BED);
  for (let i = 0; i < 3; i++) w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  assert.throws(() => w.send('GATHER_GIVE', { item: 'leaf-young' }), { code: 'gather-too-far' }, '주인 가까이에서');
  const owner = w.owner();
  w.standAt({ x: owner.x, z: owner.z + .4 });
  w.send('GATHER_GIVE', { item: 'leaf-young', qty: 1 });
  const [moved] = w.events('item.transferred'), [given] = w.events('gather.given');
  assert.deepEqual([moved.qty, moved.from, moved.to], [3, 'gather', 'leaf-jar'], '가진 셋을 다 옮긴다(기기가 보낸 수는 읽지 않음)');
  assert.deepEqual(w.view().basket, [], '옮김이지 복제가 아니다');
  assert.deepEqual([given.public, given.participantRole, given.help, given.canonicalActivityId, given.storyFamily],
    [false, ['deliver'], { by: 'player', to: ['cafe-owner'] }, 'gather', 'gather'], '그날의 함께한 일 — 공개 아님(G6)');
  assert.deepEqual(w.state.village.gives.map(g => [g.object, g.relief, g.npc]), [['leaf-jar', 12, 'cafe-owner']], '어린 찻잎 하나에 4');
  assert.deepEqual(w.view().today, { tea: 'green', petal: false, item: 'leaf-young', gift: given.id });
  assert.equal(w.view().reply.line, 'cafe-owner.gather.gift.1');
  assert.ok(w.state.village.knowledge.known['cafe-owner'].some(e => e.ref.endsWith('.gather') && e.how === 'private'), '찻집 주인만 안다 — 잊어 주세요 대상');
  assert.throws(() => w.send('GATHER_GIVE', { item: 'leaf-young' }), { code: 'gather-none' });
  // A second gift the same day: no second thing done together, no line — the tea of the day is the last given; petals float on it.
  w.state.ledger = { ...w.state.ledger, inventory: [{ itemId: 'chrysanthemum', source: 'gather', qty: 1, costBasis: 0, saleAllowed: false }, { itemId: 'petal-rain', source: 'gather', qty: 2, costBasis: 0, saleAllowed: false }] };
  w.send('GATHER_GIVE', { item: 'chrysanthemum' });
  assert.equal(w.events('gather.given').length, 1, '생활일에 하나');
  assert.deepEqual([w.view().today.tea, w.view().reply.line], ['chrysanthemum', null]);
  w.send('GATHER_GIVE', { item: 'petal-rain' });
  assert.deepEqual([w.view().today.tea, w.view().today.petal], ['chrysanthemum', true], '꽃잎은 오늘의 차에 띄운다');
  assert.equal(w.state.village.gives.length, 2, '꽃잎은 통을 채우지 않는다(마모 그대로)');
});

test('잎 통 마모는 시각 순 입력으로 — 드린 때 앞의 조각은 그대로, 그 뒤의 마모만 준다(§20-8 · 결정성)', async () => {
  const [w, quiet] = await Promise.all([world(), world()]);
  const village = await load('town/village.mjs'), cards = await load('town/cards.mjs');
  const before = village.planOf(w.state.village).segments.filter(s => s.startMs < w.now);
  w.standAt(BED);
  for (let i = 0; i < 3; i++) w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  const owner = w.owner();
  w.standAt({ x: owner.x, z: owner.z + .4 });
  w.send('GATHER_GIVE', { item: 'leaf-young' });
  const v = w.state.village, out = village.planOf(v);
  assert.deepEqual(out.segments.filter(s => s.startMs < w.now), before, '드리기 앞의 조각은 하나도 바뀌지 않는다');
  const wearAt = (state, ms) => { const o = village.planOf(state.village); return cards.villageAt(village.bandInput(state.village), o.segments, o.log, ms).wear['leaf-jar']; };
  const end = v.band.endMs - 1;
  assert.equal(wearAt(w.state, w.now - 1), wearAt(quiet.state, w.now - 1), '드린 때 앞의 마모는 같다');
  assert.equal(wearAt(w.state, w.now), Math.max(0, wearAt(quiet.state, w.now) - 12), '드린 때에 드린 만큼(어린 찻잎 셋 × 4) 준다, 0 아래로는 안 감');
  assert.ok(wearAt(w.state, end) <= wearAt(quiet.state, end), '그 뒤로도 적거나 같다');
  w.advance(v.band.endMs - w.now + MIN);
  quiet.advance(v.band.endMs - quiet.now + MIN);
  assert.ok((w.state.village.band.wear['leaf-jar'] ?? 0) <= Math.max(0, (quiet.state.village.band.wear['leaf-jar'] ?? 0) - 12), '다음 구간이 줄어든 마모에서 시작한다');
  assert.equal(w.state.village.gives.length, 0, '닫힌 구간의 드리기는 지운다');
});

test('채집이 주민을 나쁘게 하지 않는다 — 따기만 한 마을은 주민 쪽이 그대로, 주인의 잎 따기 자리와 겹치지 않는다(G4, §15-2)', async () => {
  const [w, quiet] = await Promise.all([world(), world()]);
  w.standAt(BED);
  for (let i = 0; i < 3; i++) w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  // Within the band (a band opened later is seeded with the command count then — any command, the notebook's too — W3).
  w.advance(HOUR); quiet.advance(HOUR);
  const residentsSide = v => { const { told, ...rest } = v; return rest; };
  assert.deepEqual(residentsSide(w.state.village), residentsSide(quiet.state.village), '따기는 마을에 아무것도 남기지 않는다(원장은 플레이어 쪽)');
  const village = await load('town/village.mjs');
  assert.deepEqual(village.planOf(w.state.village).segments, village.planOf(quiet.state.village).segments, '주민의 하루가 같다');
  const spots = new Set(village.planOf(w.state.village).segments.map(s => s.spot));
  for (const spot of ['greenhouse.bed-edge', 'cafe.pots', 'lane.wall']) assert.ok(!spots.has(spot), `${spot}는 플레이어 자리 — 주민 계획 밖`);
});

test('계절·날씨에만 나는 재료는 무엇의 조건도 아니다 — 카드 · 쌍 · 일과 · 원형에 재료 id 0(첫구간:91)', async () => {
  const data = path.join(ROOT, 'experiences/synk-town/town/data');
  const items = JSON.parse(fs.readFileSync(path.join(data, 'items.json'), 'utf8')).items.map(i => i.id);
  for (const file of ['cards.json', 'pairs.json', 'routines.json', 'archetypes.json', 'residents.json']) {
    const text = fs.readFileSync(path.join(data, file), 'utf8');
    for (const id of items) assert.ok(!text.includes(`"${id}"`), `${file}가 ${id}를 조건으로 쓴다`);
  }
});

test('C3 「잎 통이 비어 가요」가 플레이어를 기다릴 때 드리면 「나와 함께」로 풀린다 — deliver, 흔적은 드린 차, 붙잡기 없음(§8-4 · §20-8)', async () => {
  const w = await world(), cards = await load('town/cards.mjs'), village = await load('town/village.mjs');
  const v = w.state.village, b = v.band, key = cards.cardKey(b.lifeDay, b.band, b.startMs, b.startMs + MIN);
  // C3 rose at the band's start and the player set it aside (paused — it waits for the player, its owner does not solve it).
  v.band.cards = { ...(v.band.cards || {}), C3: { status: 'triggered', key, at: b.startMs + MIN, day: b.lifeDay } };
  v.takes = [{ card: 'C3', key, at: b.startMs + 2 * MIN, status: 'paused', open: false, choice: null }];
  w.standAt(BED);
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  const owner = w.owner();
  w.standAt({ x: owner.x, z: owner.z + .4 });
  w.send('GATHER_GIVE', { item: 'leaf-young' });
  const [resolved] = w.events('card.resolved');
  assert.deepEqual([resolved.card, resolved.path, resolved.public, resolved.participantRole], ['C3', 'player', false, ['deliver']]);
  assert.equal(w.events('gather.given').length, 0, '같은 일을 두 사건으로 세지 않는다');
  assert.equal(w.state.activities.gather.day.given, resolved.id, '그날의 드리기 = 카드 결과');
  assert.equal(w.view().reply.line, 'cafe-owner.gather.c3.1');
  const take = w.state.village.takes.find(t => t.card === 'C3');
  assert.deepEqual([take.status, take.open, take.choice], ['resolved', false, 'give'], '차 이름은 gather.today가 정본(검토 F2)');
  w.advance(MIN);
  assert.ok(!w.state.village.reservations.some(r => r.by?.startsWith('card:C3') && r.toMs === null), '드리기는 주인을 붙잡지 않는다');
  const out = village.planOf(w.state.village), now = cards.villageAt(village.bandInput(w.state.village), out.segments, out.log, w.now);
  assert.deepEqual([now.cards.C3.status, now.wear['leaf-jar'], now.traces['leaf-jar'].tea], ['cooldown', 0, { value: 'give', path: 'player' }]);
  assert.ok(!out.segments.some(s => s.card === 'C3' && s.cardRole === 'owner' && s.startMs >= take.resolvedAt), '주인이 따러 가지 않는다');
});

test('주인이 자면 드리기는 거절하고 아무것도 바뀌지 않는다 — 가진 재료는 그대로(G3)', async () => {
  const w = await world({ at: kst(10, 24, 2, 30) });
  w.state.ledger = { inventory: [{ itemId: 'mint', source: 'gather', qty: 2, costBasis: 0, saleAllowed: false }], discoveries: {}, grants: [] };
  const owner = w.owner();
  w.standAt(owner && owner.x !== null ? { x: owner.x, z: owner.z } : POTS);
  const before = JSON.stringify(w.state);
  assert.throws(() => w.send('GATHER_GIVE', { item: 'mint' }), { code: 'gather-owner-asleep' });
  assert.equal(JSON.stringify(w.state), before);
});

test('함께 따기 — 찻집 주인이 온실에서 잎을 따는 동안 곁에서 따면 그날 함께한 일 하나(help.by 찻집 주인), 붙잡기 · 목격 없음(§20-8, G6)', async () => {
  const village = await load('town/village.mjs');
  let w = null, found = null;
  for (let i = 0; i < 12 && !found; i++) {
    w = await world({ at: kst(10, 23, 5, 40), seed: `acct-with-${i}` });
    const seg = village.planOf(w.state.village).segments.find(s => s.npc === 'cafe-owner' && s.archetype === 'pick-leaves' && s.arriveMs + MIN < s.endMs);
    if (seg) found = seg;
  }
  assert.ok(found, '아침에 잎을 따는 찻집 주인');
  w.advance(found.arriveMs + MIN - w.now);
  assert.equal(w.view().alongside, true, '화면은 주인의 한마디를 띄울 수 있다');
  w.standAt(BED);
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  const together = w.events('gather.together');
  assert.equal(together.length, 1, '생활일에 하나');
  assert.deepEqual([together[0].public, together[0].help, together[0].participantRole, together[0].place], [false, { by: 'cafe-owner', to: ['player'] }, ['make'], 'greenhouse']);
  assert.equal(w.events('gather.picked')[0].alongside, true);
  assert.equal(w.view().alongside, false, '그날 한 번');
  assert.ok(!w.state.village.reservations.some(r => r.toMs === null && r.npc === 'cafe-owner'), '주민 예약 없음');
  w.advance(6 * HOUR);
  const spread = Object.values(w.state.village.knowledge?.known || {}).flat().filter(e => String(e.ref).endsWith('.gather') && e.how !== 'private');
  assert.deepEqual(spread, [], '같은 자리 다른 주민도 목격으로 알지 않는다');
});

test('손님이 오늘의 차를 시키면 주인이 드린 날 한 번 「찾았어요」, 그 차를 낸 잔에는 그 차의 한마디(§20-8)', async () => {
  const w = await world({ at: kst(10, 23, 13, 0) });
  w.state.ledger = { inventory: [{ itemId: 'mint', source: 'gather', qty: 2, costBasis: 0, saleAllowed: false }], discoveries: {}, grants: [] };
  w.state.day.location = 'cafe';
  const owner = w.owner();
  w.standAt({ x: owner.x, z: owner.z + .4 });
  w.send('GATHER_GIVE', { item: 'mint' });
  w.standAt({ x: 0, z: 2.5 });
  let foundOrders = 0, served = false;
  for (let i = 0; i < 16; i++) {
    w.send('TEA_OPEN');
    const order = w.state.activities['tea-order'].open, asks = order.guests.find(g => g.request.tea === 'today');
    if (order.found) foundOrders++;
    if (asks && !served) {
      assert.equal(order.found || foundOrders > 0, true);
      w.send('TEA_SERVE', { order: order.id, guest: asks.slot, cup: { vessel: asks.request.temp ?? 'warm', tea: 'today', honey: asks.request.sweet ?? 0 }, mode: 'make' });
      assert.equal(w.state.activities['tea-order'].open.guests.find(g => g.slot === asks.slot).react.line, 'guest.tea.react-today-mint.1');
      served = true;
    }
    w.send('TEA_CLOSE', { order: order.id });
  }
  assert.ok(served, '오늘의 차를 시킨 손님');
  assert.equal(foundOrders, 1, '드린 날 한 번');
});

test('옛 세계는 채집 칸 · 원장이 처음 값 — 마이그레이션 없음', async () => {
  const [g, core] = await Promise.all([load('town/activities/gather.mjs'), load('core.mjs')]);
  assert.deepEqual(g.restore(undefined), g.initial());
  assert.deepEqual(g.restore({ day: { lifeDay: 'x' } }), g.initial(), '깨진 칸은 처음 값');
  const w = await world();
  // A world saved before W8b (only the tea order's slot, no gathered things) is read as the store reads it.
  const { gather, ...older } = w.state.activities;
  const { ledger, ...saved } = structuredClone(w.state);
  w.state = core.restoreState({ ...saved, activities: older }, { lifeEnabled: true });
  assert.deepEqual([w.state.activities.gather, w.state.ledger], [g.initial(), { inventory: [], discoveries: {}, grants: [] }]);
  w.standAt(BED);
  w.send('GATHER_PICK', { spot: 'greenhouse.bed-edge', item: 'leaf-young' });
  assert.equal(w.state.activities.gather.day.picked['leaf-young'], 1);
  assert.ok(core.viewFor(w.state).gather);
});

test('함께 따기는 찻집 주인 곁에서만 — 온실에 있어도 멀면 아니다, 꽃잎만 드린 날은 「찾았어요」가 없다(검수 GA1 · GA2)', async () => {
  const g = await load('town/activities/gather.mjs');
  const picking = (x, z) => ({ up: true, x, z, place: 'greenhouse', spot: 'greenhouse.bed', archetype: 'pick-leaves', walking: false });
  const ctx = owner => ({ id: 'T-1', nowMs: MORNING, villageSeed: 'acct-gather', lifeDay: 20749, band: 'morning',
    clock: { band: 'morning', season: 'autumn', weatherNow: 'clear', weatherDay: 'clear-day', afterRain: false },
    walk: { x: -0.45, z: -6.6 }, resident: () => owner, takeable: () => false, holding: () => 0, room: () => 999 });
  const pick = { type: 'GATHER_PICK', payload: { spot: 'greenhouse.bed-edge', item: 'leaf-young' } };
  assert.ok(g.apply(g.initial(), pick, ctx(picking(-0.05, -6.9))).together, '곁(약 0.5m)에서 따는 주인');
  const far = g.apply(g.initial(), pick, ctx(picking(1.6, -4.4)));
  assert.equal(far.together, undefined, '온실 반대편의 주인은 곁이 아니다');
  assert.equal(far.events[0].alongside, false);
  // Petals alone float on the owner's own tea — no tea of the player's leaves for a guest to ask after.
  const w = await world({ at: kst(10, 23, 13, 0) });
  w.state.ledger = { inventory: [{ itemId: 'petal-rain', source: 'gather', qty: 2, costBasis: 0, saleAllowed: false }], discoveries: {}, grants: [] };
  w.state.day.location = 'cafe';
  const owner = w.owner();
  w.standAt({ x: owner.x, z: owner.z + .4 });
  w.send('GATHER_GIVE', { item: 'petal-rain' });
  assert.deepEqual([w.view().today.tea, w.view().today.petal], [null, true]);
  w.standAt({ x: 0, z: 2.5 });
  let found = 0, asked = 0;
  for (let i = 0; i < 10; i++) {
    w.send('TEA_OPEN');
    const order = w.state.activities['tea-order'].open;
    if (order.guests.some(x => x.request.tea === 'today')) asked++;
    if (order.found) found++;
    w.send('TEA_CLOSE', { order: order.id });
  }
  assert.ok(asked > 0, '오늘의 차를 시킨 손님이 있었다');
  assert.equal(found, 0);
});
