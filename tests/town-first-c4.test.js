'use strict';
// 싱크타운 첫 C4(세로 조각 설계 §8-3 `triggered` 예외 · §8-4 C4 · §12 · §15-1 「C4 첫 회」 · §15-2·§15-3, 10-30 첫 C4 고침) — 첫 C4는
// 플레이어가 그 마을에서 처음 찻집 주인과 같은 장소에 머무는 그 순간 서고, 플레이어 몫이라 주인이 혼자·둘이로 풀지 않고 기다린다(제안을
// 지나쳐도, 방문이 끝나도). 주인에게 먼저 말을 걸면(장소 판 「같이 해요」 = CARD_OPEN direct) 언제든 열린다. 섬은 명령 흐름만으로 정해져
// 읽기·경계 신호를 언제 몇 번 끼워도 같고, 주민 누구의 하루도 바꾸지 않는다(G4). 플레이어 없이 첫 C4가 풀린 옛 세계는 다음 머묾에 첫 회를
// 다시 받는다(이행).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { townModule, ROOT } = require('./lib/town.js');

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23(금) 12:00 KST
const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', name)).href);

function harness(createStore, seed, { start = NOON, file = null } = {}) {
  let now = start, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: seed, lifeEnabled: true, ...(file ? { file } : {}) });
  const pulse = () => { receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; return receipt; };
  const send = (type, payload = {}) => store.execute({ id: `c4-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { ...(/^(DAY_|CARD_|GREET)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  const play = (seconds, step = 5) => { for (let s = 0; s < seconds; s += step) { now += step * 1000; pulse(); } };
  const boundary = (caps = ['cards']) => store.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence, caps, seen: [] });
  return { store, pulse, send, play, boundary, set: ms => { now = ms; }, get now() { return now; } };
}
const startSpots = v => Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
/** Where the cafe owner is now (the plan the commands read). */
function ownerNow(h, village) {
  const v = h.store.read().state.village;
  return village.placeAt(village.planOf(v).segments, 'cafe-owner', h.now, startSpots(v));
}
/** Walk the clock a minute at a time (pulsing) until the cafe owner stands somewhere the player can go — then go there. */
function goToOwner(h, village, { place = null } = {}) {
  for (let n = 0; n < 600; n++) {
    const at = ownerNow(h, village);
    if (at && !at.walking && at.to !== 'home' && (!place || at.to === place)) {
      h.send('DAY_MOVE', { location: at.to });
      if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
      return at.to;
    }
    h.set(h.now + MIN); h.pulse();
  }
  throw new Error('찻집 주인이 설 곳을 찾지 못했다');
}
const firstRises = (village, v) => village.planOf(v).log.filter(e => e.card === 'C4');
const viewCard = h => h.store.read().view.day.scene.village.cards.find(c => c.card === 'C4') ?? null;
/** The new tea's talk to its end: the first choice of each turn, confirmed (CARD_CHOOSE · CARD_CONFIRM, §12). */
function finishTalk(h) {
  for (let turn = 0; turn < 6; turn++) {
    const take = h.store.read().state.village.takes.find(t => t.card === 'C4' && t.open);
    if (!take || take.status === 'resolved') return;
    const view = h.store.read().view.day.scene.village.take;
    h.send('CARD_CHOOSE', { choice: view.newTea.choices[0].id });
    h.send('CARD_CONFIRM');
  }
}

test('첫 C4 — 주인 곁에 처음 머문 그 순간 서고, 주인은 풀지 않으며, 제안을 지나쳐도 방문이 끝나도 기다리다 먼저 말을 걸면 열린다', async () => {
  const [{ createStore }, village, { notebookModel }] = await Promise.all([townFile('server.mjs'), townModule('village'), townFile('day-notebook.mjs')]);
  const h = harness(createStore, 'acct-first-c4');
  h.pulse(); h.play(10);
  // 집에서는 서지 않는다 — 주민은 플레이어 집에 오지 않고, 집은 기록하지도 않는다.
  let v = h.store.read().state.village;
  assert.equal(v.playerStays, undefined, '집은 기록하지 않는다');
  assert.deepEqual(firstRises(village, v), [], '집에만 있으면 C4가 없다(구간 첫 결정에 서던 옛 규칙이 아니다)');
  const place = goToOwner(h, village), metAt = h.now;
  v = h.store.read().state.village;
  assert.deepEqual(v.playerStays, [{ place, fromMs: metAt }]);
  const [rise] = firstRises(village, v);
  assert.ok(rise?.first && rise.atMs === metAt && rise.npc === 'cafe-owner', `머문 그 순간 선다 ${JSON.stringify(rise)}`);
  assert.equal(viewCard(h)?.status, 'triggered', '화면의 카드 — 기다림');
  // 방문 놀이 45초가 지난 경계 신호에서 주인이 먼저 건넨다(예산 안 — 맥박 하나가 놀이 시간을 임대 3초만큼 더한다). 지나치면(20초)
  // 원장에서 지나침이 되고, 카드는 그대로 기다린다.
  h.play(60, 3);
  const offered = h.boundary();
  assert.equal(offered.issued?.card, 'C4', JSON.stringify(offered.issued));
  h.play(30, 3);
  assert.ok(h.store.read().state.life.contacts.some(c => c.card === 'C4' && c.status !== 'issued'), '제안은 지나갔다');
  assert.equal(viewCard(h)?.status, 'triggered', '지나쳐도 기다린다');
  // 세 시간을 보내도 주인은 혼자·둘이로 풀지 않는다(풀기 조각이 없다).
  for (let k = 0; k < 18; k++) { h.set(h.now + 10 * MIN); h.pulse(); }
  v = h.store.read().state.village;
  assert.ok(!village.planOf(v).segments.some(s => s.card === 'C4'), 'C4 풀기 조각 없음');
  assert.equal(viewCard(h)?.status, 'triggered');
  // 방문이 끝나고(40분 비움) 다음 날 돌아와도 기다린다 — 수첩 「할 수 있는 생활」에 있다.
  h.set(h.now + 40 * MIN); h.pulse(); h.store.read();
  h.set(NOON + DAY); h.pulse(); h.play(10);
  const snapshot = h.store.read();
  assert.equal(snapshot.state.village.band.cards.C4?.status, 'triggered', '이튿날 구간 시작에도 기다림');
  assert.equal(snapshot.state.village.band.cards.C4?.first, true);
  assert.ok(notebookModel(snapshot).can.some(c => c.card === 'C4' && !c.paused), '수첩 「할 수 있는 생활」');
  // 먼저 말을 건다 — 찻집에 있는 주인 곁으로 가서(차림표 앞, §12-1) CARD_OPEN direct(예산을 쓰지 않음), 대화를 끝까지.
  goToOwner(h, village, { place: 'cafe' });
  const key = viewCard(h).key;
  h.send('CARD_OPEN', { card: 'C4', key, source: 'direct' });
  finishTalk(h);
  const state = h.store.read().state, take = state.village.takes.find(t => t.card === 'C4' && t.key === key);
  assert.equal(take?.status, 'resolved', '대화 끝 — 플레이어와 풀림');
  assert.ok(state.townEvents.some(e => e.kind === 'dialogue.closed' && e.outcome !== 'stopped'), 'dialogue.closed');
  // 그 뒤 여드레 동안 주인 곁에 머물러도 첫 회는 다시 서지 않고(플레이어와 한 C4 — played), 쉼 7생활일 동안은 아예 안 선다.
  // 둘째 회부터는 일반 규칙(§8-4) — 쉼이 끝난 뒤 주인 자기 결정에 선다(상한에 들고 주인이 푼다).
  h.send('CARD_CLOSE');
  for (let d = 1; d <= 8; d++) {
    h.set(NOON + (1 + d) * DAY); h.pulse(); h.play(10); goToOwner(h, village);
    const rises = firstRises(village, h.store.read().state.village);
    assert.ok(!rises.some(e => e.first), `${d}일 뒤 — 첫 회 아님`);
    if (d < 7) assert.deepEqual(rises, [], `${d}일 뒤 — 쉼 동안은 안 선다`);
  }
  assert.equal(h.store.read().state.village.playerStays, undefined, '첫 C4를 마친 마을은 머묾을 적지 않는다');
  assert.equal(h.store.read().state.village.band.cards.C4?.played, true, '플레이어와 한 C4');
});

test('첫 C4 — 같은 명령 흐름이면 읽기·경계 신호를 0·1·여러 번 끼워도 섬과 마을이 같다(§15-3)', async () => {
  const [{ createStore }, village] = await Promise.all([townFile('server.mjs'), townModule('village')]);
  const run = reads => {
    const h = harness(createStore, 'acct-first-c4-reads');
    h.pulse();
    for (let s = 0; s < 6; s++) { h.set(h.now + 5000); h.pulse(); if (reads > 1) h.store.read(); }
    if (reads) h.boundary();
    // The same commands at the same instants: home → the workshop → the cafe, then home again.
    h.set(NOON + 20 * MIN); h.pulse(); if (reads > 1) { h.store.read(); h.boundary(); }
    h.send('DAY_MOVE', { location: 'workshop' }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
    h.set(NOON + 25 * MIN); h.pulse(); if (reads) h.store.read();
    h.send('DAY_MOVE', { location: 'cafe' });
    for (let s = 0; s < 12; s++) { h.set(h.now + 10000); h.pulse(); if (reads > 1) { h.store.read(); h.boundary(); } }
    h.send('DAY_MOVE', { location: 'home' });
    h.set(NOON + 6 * HOUR); h.pulse();
    const v = h.store.read().state.village;
    return { rise: firstRises(village, v)[0] ?? null, stays: v.playerStays ?? null, cards: v.band.cards, residents: v.band.residents, pairs: v.band.pairs, news: v.news };
  };
  const [none, once, many] = [run(0), run(1), run(3)];
  assert.ok(none.rise || none.cards.C4?.first, '찻집에 머물러 첫 C4가 섰다');
  assert.deepEqual(once, none); assert.deepEqual(many, none);
});

test('첫 C4 섬은 주민 누구의 하루도 바꾸지 않고, 그 뒤 갈림은 주인의 하루 한 번 서성임에서만 온다 — 원인 기록에 플레이어 탓 나쁜 쪽 0(G4)', async () => {
  // 명령이 없는 두 마을(명령 판 planCmdRev가 같다 — 명령은 다음 구간의 난수를 바꾸므로, 같은 명령 흐름끼리 견준다): 하나는 첫날 낮에
  // 플레이어가 30분 찻집 주인 곁에 머물렀다(core가 쓰는 머묾 한 줄 그대로). 섬 구간이 닫힐 때까지 두 마을은 C4 · 머묾 말고 바이트 같다.
  // 그 뒤 머문 마을의 주인은 첫 C4가 기다리는 동안 생활일마다 한 번까지 차림표 앞에서 서성인다(§8-4 ③) — 서성임을 막은 같은 마을은
  // 사흘 뒤에도 안 온 마을과 바이트 같으니 갈림은 서성임에서만 오고, 서성임은 플레이어 몫 일과라 원인 기록에 나쁜 쪽 변화가 없다.
  const village = await townModule('village'), { playerMade, PLAYER_CAUSES, worse } = await townModule('state');
  const live = (stay, { until = NOON + 3 * DAY, linger = true } = {}) => {
    const v = village.initialVillage(), close = nowMs => village.closeBands(v, { nowMs, seed: 'first-c4-g4', offsetMin: 540, revision: 1 });
    const seen = { lingers: [], log: [] };
    close(NOON);
    if (stay) {
      const at = village.placeAt(village.planOf(v).segments, 'cafe-owner', NOON + MIN, startSpots(v));
      assert.ok(at && at.to !== 'home');
      village.noteStay(v, at.to, NOON + MIN); village.closeStay(v, NOON + 31 * MIN);
    }
    for (let t = NOON + HOUR; t <= until; t += HOUR) {
      // One band ends inside an hour at most: its plan is the one closing it. Kept from lingering, its record says it already did.
      if (!linger && v.band.cards?.C4?.first) v.band.cards.C4.lingered = v.band.lifeDay;
      if (v.band.endMs <= t) { const out = village.planOf(v); seen.lingers.push(...out.segments.filter(s => s.linger).map(s => ({ ...s, lifeDay: v.band.lifeDay, band: v.band.band }))); seen.log.push(...out.stateLog); }
      close(t);
    }
    return Object.assign(v, { seen });
  };
  const without = v => JSON.parse(JSON.stringify({ ...v, seen: undefined, playerStays: undefined, band: { ...v.band, cards: { ...v.band.cards, C4: undefined } } }));
  const [rose, none] = [live(true, { until: NOON + 6 * HOUR }), live(false, { until: NOON + 6 * HOUR })];
  assert.equal(rose.band.cards.C4?.first, true, '머문 마을 — 섬 구간이 닫혀 첫 C4가 기다린다');
  assert.deepEqual(without(rose), without(none), '섬 구간까지는 주민 상태·다른 카드·쌍·지식·소식·흔적이 바이트까지 같다');
  const [a, kept, b] = [live(true), live(true, { linger: false }), live(false)];
  assert.equal(a.band.cards.C4?.status, 'triggered', '머문 마을 — 첫 C4가 기다린다'); assert.equal(a.band.cards.C4.first, true);
  assert.equal(b.band.cards.C4, undefined, '아무도 안 온 마을 — C4 없음');
  assert.deepEqual(without(kept), without(b), '서성임을 막으면 사흘 뒤에도 바이트까지 같다 — 갈림은 서성임에서만');
  assert.ok(a.seen.lingers.length >= 1, '머문 마을의 주인은 서성였다');
  const days = new Map();
  for (const s of a.seen.lingers) {
    days.set(s.lifeDay, (days.get(s.lifeDay) || 0) + 1);
    assert.ok(s.npc === 'cafe-owner' && s.archetype === 'menu-note' && s.spot === 'cafe.counter' && s.cause === 'card' && playerMade(s), JSON.stringify(s));
    assert.ok(['day', 'evening', 'night'].includes(s.band), `C4의 구간에만 — ${s.band}`);
  }
  assert.ok([...days.values()].every(n => n === 1), `생활일마다 한 번까지 ${JSON.stringify([...days])}`);
  assert.deepEqual(a.seen.log.filter(e => PLAYER_CAUSES.includes(e.cause) && worse(e.stat, e.delta)), [], '플레이어 탓 나쁜 쪽 변화 0');
});

test('서성임 — 서성인 조각에 마음 줄 new-menu, 기록에 그 생활일이 남아 다음 구간엔 다시 안 서성이고, 플레이어와 풀면 그친다', async () => {
  const { planBand } = await townModule('plan'), { RESIDENT_BY_ID } = await townModule('plan');
  const TZ = 540, LIFE = 20748, DAY0 = Date.UTC(2026, 9, 22, 5, 0) - TZ * MIN;
  const input = (band, from, to, cards) => ({ villageSeed: 'first-c4-linger', lifeDay: LIFE, band, startMs: DAY0 + from * HOUR, endMs: DAY0 + to * HOUR,
    dayStartMs: DAY0, planCmdRev: 0, weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', cards });
  const waiting = { C4: { status: 'triggered', key: `${LIFE}.morning.200`, at: DAY0 + 3 * HOUR, day: LIFE, first: true } };
  assert.ok(RESIDENT_BY_ID['cafe-owner'].moods.some(m => m.factor === 'C4' && m.tag === 'new-menu'), '마음 표에 new-menu(§7-3)');
  // The morning is not one of C4's bands: no lingering there.
  assert.ok(!planBand(input('morning', 0, 6, waiting)).segments.some(s => s.linger), '아침 구간에는 없다');
  // Across many seeds, a day band that starts with the first waiting lingers once at most, and when it did the record keeps the day.
  let lingered = 0;
  for (let n = 0; n < 24; n++) {
    const out = planBand({ ...input('day', 6, 12, waiting), villageSeed: `first-c4-linger-${n}` }), mine = out.segments.filter(s => s.linger);
    assert.ok(mine.length <= 1, `${n}: 한 번까지`);
    if (!mine.length) { assert.equal(out.cards.C4.lingered, undefined); continue; }
    lingered++;
    const [s] = mine;
    if (s.reason) assert.equal(s.reason, 'new-menu', '이유는 new-menu');
    if (s.mood) assert.equal(s.mood, 'cafe-owner.mood.new-menu.1');
    assert.equal(out.cards.C4.lingered, LIFE, '기록에 그 생활일');
    assert.equal(out.cards.C4.first, true); assert.equal(out.cards.C4.status, 'triggered');
    // The evening of that life day starts from that record: no lingering again.
    assert.ok(!planBand({ ...input('evening', 12, 16, out.cards), villageSeed: `first-c4-linger-${n}` }).segments.some(x => x.linger), `${n}: 그날 다시 안 서성인다`);
  }
  assert.ok(lingered >= 6, `서성인 낮 구간이 있다(${lingered}/24)`);
  // A hold on her early in the band (a scene with the player) re-plans her after it: the final segments still linger once at most
  // and the record says so exactly when they do (the planner's own state and the close agree — Fable F15 ①).
  for (let n = 0; n < 12; n++) {
    const hold = { id: 'R-1-cafe-owner', npc: 'cafe-owner', fromMs: DAY0 + 6 * HOUR + 20 * MIN, toMs: DAY0 + 6 * HOUR + 50 * MIN, spot: 'cafe.counter', by: 'tea:qa' };
    const out = planBand({ ...input('day', 6, 12, waiting), villageSeed: `first-c4-linger-hold-${n}`, reservations: [hold] });
    const mine = out.segments.filter(s => s.linger);
    assert.ok(mine.length <= 1 && (out.cards.C4.lingered === LIFE) === (mine.length === 1), `${n}: 붙잡힘 뒤에도 한 번 · 기록과 조각이 맞다`);
  }
  // While the player's take of it is paused (「하던 생활」, the visit over), the first still waits: she lingers as on any day (F15 ②).
  const paused = { card: 'C4', key: waiting.C4.key, at: DAY0 + 4 * HOUR, status: 'paused', endAt: DAY0 + 4 * HOUR + 30 * MIN };
  let lingeredPaused = 0;
  for (let n = 0; n < 12; n++) lingeredPaused += planBand({ ...input('day', 6, 12, waiting), villageSeed: `first-c4-linger-${n}`, takes: [paused] }).segments.some(s => s.linger) ? 1 : 0;
  assert.ok(lingeredPaused >= 2, `하던 생활로 둔 동안에도 서성인다(${lingeredPaused}/12)`);
  // Done with the player (cooldown, played): no lingering.
  assert.ok(!planBand(input('day', 6, 12, { C4: { status: 'cooldown', until: LIFE + 7, day: LIFE, times: 1, last: { path: 'player', day: LIFE }, first: true, played: true } })).segments.some(s => s.linger), '풀린 뒤에는 없다');
});

test('둘째 회 — 플레이어와 한 C4는 쉼 7생활일 뒤 일반 규칙으로 주인 결정에 서고(상한에 듦 · 첫 회 표시 없음), 혼자 풀면 흔적·공개 사건 없이 보류된다', async () => {
  const { planBand } = await townModule('plan'), { roseToday, firstOwed } = await townModule('cards');
  const TZ = 540, LIFE = 20748, DAY0 = Date.UTC(2026, 9, 22, 5, 0) - TZ * MIN;
  const input = (cards, extra = {}) => ({ villageSeed: 'first-c4-again', lifeDay: LIFE, band: 'day', startMs: DAY0 + 6 * HOUR, endMs: DAY0 + 12 * HOUR,
    dayStartMs: DAY0, planCmdRev: 0, weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', cards,
    traces: { 'leaf-jar': { menu: { value: 'sweet-1', path: 'player' } } }, ...extra });
  // The record a v40 world kept when the player did the first a week ago (cooldown ending today, the first's mark, no played).
  const v40 = { status: 'cooldown', until: LIFE, day: LIFE - 7, times: 1, last: { path: 'player', day: LIFE - 7 }, first: true };
  let solvedAlone = 0, rose = 0;
  for (let n = 0; n < 16; n++) {
    const out = planBand({ ...input({ C4: { ...v40 } }), villageSeed: `first-c4-again-${n}` });
    const rise = out.log.find(e => e.card === 'C4');
    if (!rise) continue;
    rose++;
    assert.ok(!rise.first, `${n}: 일반 규칙의 섬 — 첫 회 표시 없음`);
    assert.ok(roseToday({ cards: out.cards, lifeDay: LIFE }, 'cafe-owner') >= 1, `${n}: 상한에 든다(그날 선 카드로 셈)`);
    const line = out.resolved.find(r => r.card === 'C4');
    assert.ok(line && ['self', 'pair'].includes(line.path), `${n}: 주인이 푼다 ${JSON.stringify(line)}`);
    assert.equal(out.cards.C4.played, true, `${n}: 플레이어와 한 C4 — 혼자 뒤에도 첫 회가 빚이 아니다`);
    assert.equal(firstOwed(out.cards.C4), false);
    assert.equal(out.cards.C4.first, undefined, `${n}: 첫 회 표시가 남지 않는다`);
    if (line.path === 'self') {
      solvedAlone++;
      assert.deepEqual(out.traces['leaf-jar'].menu, { value: 'sweet-1', path: 'player' }, `${n}: 혼자 「아직이에요」는 차림표의 새 차를 덮지 않는다`);
      assert.equal(line.public, false, `${n}: 혼자는 공개 사건이 아니다(§8-4 보류)`);
    }
  }
  assert.ok(rose >= 8 && solvedAlone >= 1, `둘째 회가 선다 ${rose}/16 · 혼자 ${solvedAlone}`);
  // A v40 world past the first's rest (idle, its last path the player's, no mark): the general rule, and once solved alone it is
  // played — the player's stays are never written again and no first rises at the next stay (Fable F15 ⑥).
  const { firstPending } = await townModule('cards');
  for (let n = 0; n < 16; n++) {
    const out = planBand({ ...input({ C4: { status: 'idle', times: 1, last: { path: 'player', day: LIFE - 9 } } }, { playerStays: [{ place: 'cafe', fromMs: DAY0 + 7 * HOUR }] }), villageSeed: `first-c4-again-idle-${n}` });
    assert.ok(!out.log.some(e => e.first), `${n}: 머물러도 첫 회는 안 선다`);
    const line = out.resolved.find(r => r.card === 'C4');
    if (line) { assert.equal(out.cards.C4.played, true); assert.equal(firstPending(out.cards.C4), false, `${n}: 다음 구간도 머묾을 안 적는다`); }
  }
  // A general rise still waiting as a band closes (its record: triggered, no first, played): the next band's first decision
  // solves it — her own, in the caps (Fable F15 ⑤).
  const carried = { status: 'triggered', key: `${LIFE}.morning.350`, at: DAY0 + 6 * HOUR - 10 * MIN, day: LIFE, times: 1, last: { path: 'player', day: LIFE - 9 }, played: true };
  const next = planBand(input({ C4: carried }));
  assert.ok(next.resolved.some(r => r.card === 'C4' && ['self', 'pair'].includes(r.path)) && next.cards.C4.first === undefined, '구간을 넘긴 둘째 회 — 다음 결정에 주인이 푼다');
  // Starting busy (chores 3) or tired (energy 39): the state moves through the band (guests, her own segments), and every rise
  // finds the bounds met at its own decision — her state then is the band's start plus each change before it, the guests' and
  // orders' at that instant too, but not the segment placed at it (backend review GA1).
  const still = { recent: [], placesToday: [], lastSpot: 'cafe.counter', firstOfDay: false, choresTick: 0, social: 60 };
  let checked = 0;
  for (const state of [{ energy: 80, chores: 3 }, { energy: 39, chores: 0 }]) for (let n = 0; n < 12; n++) {
    const out = planBand({ ...input({ C4: { status: 'idle', times: 1, last: { path: 'player', day: LIFE - 9 }, played: true } }, { residents: { 'cafe-owner': { ...still, ...state } } }), villageSeed: `first-c4-bounds-${n}` });
    for (const rise of out.log.filter(e => e.card === 'C4')) {
      const at = { ...state };
      for (const e of out.stateLog) if (e.npc === 'cafe-owner' && (e.atMs < rise.atMs || e.atMs === rise.atMs && !['routine', 'player-routine'].includes(e.cause))) at[e.stat] = (at[e.stat] ?? 0) + e.delta;
      assert.ok(at.chores <= 2 && at.energy >= 40, `${n} ${JSON.stringify(state)}: 선 결정에서 할 일 ${at.chores} · 기운 ${at.energy}`);
      checked++;
    }
    assert.ok(!out.log.some(e => e.card === 'C4' && e.atMs === DAY0 + 6 * HOUR), '구간 첫 결정(시작 상태 그대로)에는 안 선다');
  }
  assert.ok(checked >= 1, `상태가 풀린 뒤 선 경우를 하나 이상 견줬다(${checked})`);
});

test('이행 — 플레이어 없이 첫 C4가 혼자(쉬는 중)·둘이로 풀린 세계는 다음 머묾에 첫 회를 다시 받고, 플레이어와 푼 세계는 받지 않는다', async () => {
  const { planBand } = await townModule('plan'), { CARD_BY_ID } = await townModule('cards');
  const TZ = 540, LIFE = 20748, DAY0 = Date.UTC(2026, 9, 22, 5, 0) - TZ * MIN;
  const input = extra => ({ villageSeed: 'first-c4-migrate', lifeDay: LIFE, band: 'day', startMs: DAY0 + 6 * HOUR, endMs: DAY0 + 12 * HOUR,
    dayStartMs: DAY0, planCmdRev: 0, weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', ...extra });
  const stay = { place: 'cafe', fromMs: DAY0 + 7 * HOUR };
  const C4 = { self: { status: 'cooldown', until: LIFE + 5, day: LIFE - 2, times: 1, last: { path: 'self', day: LIFE - 2 } },
    pair: { status: 'idle', times: 1, last: { path: 'pair', day: LIFE - 9 } }, player: { status: 'idle', times: 1, last: { path: 'player', day: LIFE - 9 } } };
  for (const [path, record] of Object.entries(C4)) {
    const out = planBand(input({ cards: { C4: record }, playerStays: [stay] }));
    const rise = out.log.find(e => e.card === 'C4');
    if (path === 'player') { assert.ok(!rise?.first && out.cards.C4?.first !== true, '플레이어와 푼 세계에는 첫 회가 다시 안 선다(둘째 회는 일반 규칙)'); continue; }
    assert.ok(rise?.first && rise.atMs >= stay.fromMs, `${path}로 풀렸던 세계 — 다음 머묾에 첫 회`);
    assert.equal(out.cards.C4.status, 'triggered'); assert.equal(out.cards.C4.first, true);
    assert.equal(out.cards.C4.times, 1, '지난 횟수는 그대로');
    assert.ok(!out.segments.some(s => s.card === 'C4'), '주인이 풀지 않는다');
  }
  // 머묾이 없으면(옛 규칙의 구간 첫 결정) 서지 않는다 — 쉬는 중이 끝난 세계도.
  assert.equal(planBand(input({ cards: { C4: { status: 'idle', times: 1, last: { path: 'self', day: LIFE - 9 } } } })).log.find(e => e.card === 'C4'), undefined);
  assert.equal(CARD_BY_ID.C4.trigger.kind, 'first-visit');
});

test('Fable F1 — 방문이 구간 경계 30분 안에 끝나고 주인이 다음 구간에 왔어도, 다음 방문 전에 읽기가 있든 없든 같은 첫 C4', async () => {
  // 마지막 명령은 경계 10분 전 찻집(머묾 한 줄), 방문은 경계 20분 뒤에 끝난다(마지막 활동 + 30분 꼬리). 다음 방문은 두 시간 뒤 집에서.
  // A: 방문이 끝난 5분 뒤 읽기 하나가 경계를 닫는다 → 다음 방문의 결산은 방문 끝 단계 · 방문 시작 · 구간 닫기.
  // B: 읽기 없이 다음 방문의 결산 한 번이 방문 끝 단계 · 방문 시작(아직 경계 앞 구간이 열린 채) · 구간 닫기를 잇는다.
  const village = await townModule('village');
  const ownerAt = (v, ms) => village.placeAt(village.planOf(v).segments, 'cafe-owner', ms, startSpots(v));
  const life = (seed, B, place, read) => {
    const v = village.initialVillage(), close = (nowMs, extra = {}) => village.closeBands(v, { nowMs, seed, offsetMin: 540, revision: 1, ...extra });
    close(B - 3 * HOUR); close(B - 10 * MIN);
    village.noteStay(v, place, B - 10 * MIN);
    const end = B + 20 * MIN, next = B + 2 * HOUR;
    if (read) close(end + 5 * MIN, { visitEnd: end });
    village.closeStay(v, end);
    village.noteStay(v, 'home', next, { held: true });
    close(next);
    return v;
  };
  let tails = 0;
  for (let n = 0; n < 12; n++) for (const hour of [11, 17, 21]) {
    const B = NOON + DAY - 12 * HOUR + hour * HOUR, seed = `first-c4-tail-${n}`; // 다음 날 그 시각(한국)
    // The place she is at ten minutes past the boundary, where she was not in the ten minutes before it (the tail's case).
    const probe = village.initialVillage(), at = ms => { village.closeBands(probe, { nowMs: ms, seed, offsetMin: 540, revision: 1 }); return ownerAt(probe, ms); };
    at(B - 3 * HOUR); const before = [B - 10 * MIN, B - 5 * MIN, B - MIN].map(ms => at(ms)?.to), after = at(B + 10 * MIN);
    const place = after && !after.walking && after.to !== 'home' ? after.to : 'cafe';
    const [a, b] = [life(seed, B, place, true), life(seed, B, place, false)];
    assert.deepEqual(b, a, `${seed} ${hour}시 경계 — 읽기 있든 없든 같은 마을`);
    const rise = village.planOf(a).log.find(e => e.first) ?? null;
    if (!before.includes(place) && rise && rise.atMs >= B && rise.atMs < B + 20 * MIN) tails++;
  }
  assert.ok(tails > 0, '경계 앞엔 없던 주인이 경계 뒤 꼬리에 와 선 첫 C4를 적어도 한 번 지났다');
});

test('Fable F4 — 주인 곁에 간 같은 순간 열어도(시계를 안 돌림) 섬 시각·열쇠가 붙잡힘에 밀리지 않는다', async () => {
  const [{ createStore }, village] = await Promise.all([townFile('server.mjs'), townModule('village')]);
  const h = harness(createStore, 'acct-first-c4-instant');
  h.pulse(); h.play(10);
  goToOwner(h, village);
  const before = firstRises(village, h.store.read().state.village)[0];
  assert.ok(before?.first && before.atMs === h.now);
  h.send('CARD_OPEN', { card: 'C4', key: before.key, source: 'direct' });
  const after = firstRises(village, h.store.read().state.village)[0];
  assert.deepEqual(after, before, '붙잡힘 뒤에도 같은 섬');
  assert.equal(viewCard(h)?.status, 'with', '연 카드가 화면에 그대로');
});

test('Fable F5·F6 — 첫 C4는 찻집에서만 건네고 열리며, 한 방문에 한 번만 건넨다(지나친 뒤 15분이 지나도 같은 방문에는 다시 안 옴)', async () => {
  const [{ createStore }, village] = await Promise.all([townFile('server.mjs'), townModule('village')]);
  const h = harness(createStore, 'acct-first-c4-where');
  h.pulse(); h.play(10);
  // 주인이 찻집 밖(공방·온실)에 머무는 때 그 곁으로 — 섬은 거기서도 서지만 제안·열기는 찻집에서만.
  let away = null;
  for (let n = 0; n < 600 && !away; n++) {
    const at = ownerNow(h, village);
    if (at && !at.walking && ['workshop', 'greenhouse'].includes(at.to)) away = at.to; else { h.set(h.now + MIN); h.pulse(); }
  }
  assert.ok(away, '주인이 찻집 밖에 머무는 때');
  h.send('DAY_MOVE', { location: away }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
  const rise = firstRises(village, h.store.read().state.village)[0];
  assert.ok(rise?.first && rise.atMs === h.now, `${away}에서도 첫 C4가 선다`);
  h.play(60, 3);
  assert.notEqual(h.boundary().issued?.card, 'C4', '찻집 밖에서는 건네지 않는다');
  assert.throws(() => h.send('CARD_OPEN', { card: 'C4', key: rise.key, source: 'direct' }), e => e.code === 'card-too-far', '찻집 밖에서는 열리지 않는다');
  // 찻집에서 — 건넨다, 지나친다, 같은 방문에는 15분이 지나도 다시 안 건넨다.
  let offered = null;
  for (let n = 0; n < 600 && !offered; n++) {
    const at = ownerNow(h, village);
    if (at && !at.walking && at.to === 'cafe') {
      if (h.store.read().state.day.location !== 'cafe') h.send('DAY_MOVE', { location: 'cafe' });
      const b = h.boundary(); if (b.issued?.card === 'C4') offered = b.issued;
    }
    h.play(20, 4);
  }
  assert.ok(offered, '찻집에서는 건넨다');
  let again = 0;
  for (let n = 0; n < 75; n++) { h.play(20, 4); if (h.boundary().issued?.card === 'C4') again++; }
  assert.equal(again, 0, '같은 방문에는 다시 안 건넨다(25분)');
  // 다음 방문(방문이 끝난 뒤) — 다시 한 번 건넬 수 있다.
  h.set(h.now + 40 * MIN); h.pulse(); h.store.read();
  h.set(NOON + 2 * DAY); h.pulse(); h.play(10);
  let next = null;
  for (let n = 0; n < 600 && !next; n++) {
    const at = ownerNow(h, village);
    if (at && !at.walking && at.to === 'cafe') {
      if (h.store.read().state.day.location !== 'cafe') { h.send('DAY_MOVE', { location: 'cafe' }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT'); }
      const b = h.boundary(); if (b.issued?.card === 'C4') next = b.issued;
    }
    h.play(20, 4);
  }
  assert.ok(next && next.key === offered.key, '다음 방문에는 같은 첫 C4를 다시 건넨다');
});

test('첫 C4를 이번 방문에 건넸거나 거절했어도 같은 찻집의 다음 카드 제안은 막히지 않는다 — 며칠씩 기다리는 C4만 되풀이해 고르지 않는다', async () => {
  const [{ createStore }, village] = await Promise.all([townFile('server.mjs'), townModule('village')]);
  const run = answer => {
    const h = harness(createStore, 'acct-first-c4-next');
    h.pulse(); h.play(10);
    // 주인이 찻집에 선 채로 C5(C4 뒤 카드)가 서는 때를 계획에서 찾는다 — 그 곁에 가면 첫 C4도 함께 선다.
    let found = null;
    for (let n = 0; n < 24 * 6 && !found; n++) {
      const v = h.store.read().state.village, out = village.planOf(v), start = startSpots(v);
      const e = out.log.find(x => x.atMs > h.now + MIN && x.card === 'C5');
      if (e) {
        const at = village.placeAt(out.segments, e.npc, e.atMs + 20000, start), still = village.placeAt(out.segments, e.npc, e.atMs + 5 * MIN, start);
        if (at && !at.walking && at.to === 'cafe' && still && !still.walking && still.to === 'cafe' && !out.log.some(x => x !== e && Math.abs(x.atMs - e.atMs) < 15 * MIN)) found = e;
      }
      if (!found) { h.set(h.now + HOUR); h.pulse(); h.store.read(); }
    }
    assert.ok(found, '엿새 안에 찻집에서 C5가 선다');
    h.set(Math.max(h.now + 1000, found.atMs - 50000)); h.pulse();
    h.send('DAY_MOVE', { location: 'cafe' }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
    while (h.now < found.atMs + 25000) h.play(5, 1);
    const first = h.boundary(['cards', 'tea']);
    assert.equal(first.issued?.card, 'C4', '먼저 첫 C4를 건넨다');
    if (answer) h.send(answer, { contactId: first.issued.id });
    h.play(183, 3);
    const next = h.boundary(['cards', 'tea']);
    assert.deepEqual({ card: next.issued?.card, key: next.issued?.key }, { card: 'C5', key: found.key }, '제안 사이가 지나면 다음 카드를 건넨다');
    assert.equal(h.store.read().state.village.band.cards.C4?.status ?? h.store.read().view.day.scene.village.cards.find(c => c.card === 'C4')?.status, 'triggered', '첫 C4는 그대로 기다린다');
  };
  run(null); run('CARD_DECLINE');
});

test('GPT GA1 — 한 구간에 장소를 열여섯 번 넘게 바꿔도(주인을 아직 못 만남) 그 뒤 주인 곁에 머물면 첫 C4가 선다', async () => {
  const village = await townModule('village');
  const v = village.initialVillage(), close = ms => village.closeBands(v, { nowMs: ms, seed: 'first-c4-cap', offsetMin: 540, revision: 1 });
  close(NOON);
  const out = village.planOf(v), mine = out.segments.filter(s => s.npc === 'cafe-owner' && s.startMs < NOON + 40 * MIN && s.endMs > NOON);
  const hers = new Set(mine.map(s => s.spot.split('.')[0]));
  const away = ['workshop', 'greenhouse', 'lane'].filter(p => !hers.has(p));
  assert.ok(away.length >= 2, `주인이 안 가는 두 곳 ${[...hers]}`);
  for (let k = 0; k < 20; k++) village.noteStay(v, away[k % 2], NOON + k * MIN);
  assert.ok(v.playerStays.length <= village.STAYS_MAX, `${v.playerStays.length}줄`);
  // Then where she is, arrived, at a later minute of the band.
  const t = NOON + 25 * MIN, at = village.placeAt(village.planOf(v).segments, 'cafe-owner', t, startSpots(v));
  assert.ok(at && !at.walking && at.to !== 'home', '그때 주인이 머무는 곳');
  village.noteStay(v, at.to, t);
  const rise = village.planOf(v).log.find(e => e.first);
  assert.ok(rise && rise.atMs === t, `열여섯 번 넘게 바꾼 뒤에도 선다 ${JSON.stringify(rise)}`);
});

test('GPT GA2 — 이 규칙 전에 저장된, 표시 없이 기다리던 C4도 주인이 풀지 않고 플레이어를 기다린다', async () => {
  const { planBand } = await townModule('plan');
  const TZ = 540, LIFE = 20748, DAY0 = Date.UTC(2026, 9, 22, 5, 0) - TZ * MIN, startMs = DAY0 + 6 * HOUR;
  const out = planBand({ villageSeed: 'first-c4-old-wait', lifeDay: LIFE, band: 'day', startMs, endMs: DAY0 + 12 * HOUR, dayStartMs: DAY0, planCmdRev: 0,
    weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', cards: { C4: { status: 'triggered', key: `${LIFE}.day.0`, at: startMs, day: LIFE } } });
  assert.ok(!out.segments.some(s => s.card === 'C4'), '풀기 조각 없음');
  assert.equal(out.cards.C4.status, 'triggered'); assert.equal(out.cards.C4.key, `${LIFE}.day.0`);
  assert.ok(!out.log.some(e => e.card === 'C4'), '새로 서지도 않는다(이미 기다림)');
});

test('GPT GA2 다시 — 표시 없이 기다리던 옛 C4는 다음 구간을 열 때 첫 회 표시를 받아(상한 밖) 플레이어를 기다린다', async () => {
  const village = await townModule('village');
  const v = village.initialVillage(), close = ms => village.closeBands(v, { nowMs: ms, seed: 'first-c4-old-mark', offsetMin: 540, revision: 1 });
  close(NOON);
  v.band.cards = { ...(v.band.cards || {}), C4: { status: 'triggered', key: `${v.band.lifeDay}.${v.band.band}.0`, at: v.band.startMs, day: v.band.lifeDay } };
  assert.ok(!village.planOf(v).segments.some(s => s.card === 'C4'), '그 구간에도 주인이 풀지 않는다');
  close(v.band.endMs + MIN);
  assert.deepEqual({ status: v.band.cards.C4.status, first: v.band.cards.C4.first }, { status: 'triggered', first: true }, '다음 구간 — 첫 회로 이행');
});
