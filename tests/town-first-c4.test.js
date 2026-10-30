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
  // 그 뒤 여드레 동안 주인 곁에 머물러도 C4는 다시 서지 않는다(둘째 회부터 지금 규칙 — 플레이어와 푼 뒤에는 안 섬).
  h.send('CARD_CLOSE');
  for (let d = 1; d <= 8; d++) {
    h.set(NOON + (1 + d) * DAY); h.pulse(); h.play(10); goToOwner(h, village);
    assert.deepEqual(firstRises(village, h.store.read().state.village), [], `${d}일 뒤`);
  }
  assert.equal(h.store.read().state.village.playerStays, undefined, '첫 C4를 마친 마을은 머묾을 적지 않는다');
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

test('첫 C4는 주민 누구의 하루도 바꾸지 않는다 — 주인 곁에 머문 마을과 아무도 안 온 마을은 C4 기록·머묾 줄 말고 같다(G4)', async () => {
  // 명령이 없는 두 마을(명령 판 planCmdRev가 같다 — 명령은 다음 구간의 난수를 바꾸므로, 같은 명령 흐름끼리 견준다): 하나는 첫날 낮에
  // 플레이어가 30분 찻집 주인 곁에 머물렀다(core가 쓰는 머묾 한 줄 그대로). 사흘 뒤 두 마을의 주민 상태·다른 카드·쌍·지식·소식이 같다.
  const village = await townModule('village');
  const live = stay => {
    const v = village.initialVillage(), close = nowMs => village.closeBands(v, { nowMs, seed: 'first-c4-g4', offsetMin: 540, revision: 1 });
    close(NOON);
    if (stay) {
      const at = village.placeAt(village.planOf(v).segments, 'cafe-owner', NOON + MIN, startSpots(v));
      assert.ok(at && at.to !== 'home');
      village.noteStay(v, at.to, NOON + MIN); village.closeStay(v, NOON + 31 * MIN);
    }
    for (let t = NOON + HOUR; t <= NOON + 3 * DAY; t += HOUR) close(t);
    return v;
  };
  const [a, b] = [live(true), live(false)];
  assert.equal(a.band.cards.C4?.status, 'triggered', '머문 마을 — 첫 C4가 기다린다'); assert.equal(a.band.cards.C4.first, true);
  assert.equal(b.band.cards.C4, undefined, '아무도 안 온 마을 — C4 없음');
  const without = v => JSON.parse(JSON.stringify({ ...v, playerStays: undefined, band: { ...v.band, cards: { ...v.band.cards, C4: undefined } } }));
  assert.deepEqual(without(a), without(b), '주민 상태·다른 카드·쌍·지식·소식·흔적이 바이트까지 같다');
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
    if (path === 'player') { assert.equal(rise, undefined, '플레이어와 푼 세계에는 다시 안 선다'); continue; }
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
