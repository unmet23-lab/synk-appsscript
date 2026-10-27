'use strict';
// 싱크타운 원칙 시험(세로 조각 설계 §15-2, W5) — 「부재」와 「가만히 있음」은 주민에게 같다: 엿새를 비운 마을과 날마다 들어와 집에만
// 머물며 아무것도 하지 않은 마을의 주민 상태·카드·쌍·지식·소식이 바이트까지 같다(플레이어 쪽 기록 — 말한 것·본 것·먼저 말 걸기 — 은
// 뺀다). 그리고 「나와 함께」 한 일은 당사자만 알고, 그 결과는 플레이어의 것이다(G6·§8-3).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { townModule, ROOT } = require('./lib/town.js');

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23(금) 12:00 KST
const server = () => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'server.mjs')).href);

function harness(createStore, seed) {
  let now = NOON, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: seed });
  const pulse = () => { receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; return receipt; };
  const send = (type, payload = {}) => store.execute({ id: `p-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { ...(/^(DAY_|CARD_|GREET)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  return { store, pulse, send, set: ms => { now = ms; }, get now() { return now; } };
}
const residentsSide = v => { const { told, ...rest } = v; return rest; };

test('§15-2 — 엿새를 비운 마을과 날마다 집에만 머문 마을의 주민·카드·쌍·지식·소식이 같다', async () => {
  const { createStore } = await server();
  const away = harness(createStore, 'acct-principle'), home = harness(createStore, 'acct-principle');
  // Both came on the first day (a read settles the world, and the village begins there); then one is away.
  for (const h of [away, home]) { h.pulse(); h.store.read(); }
  for (let d = 1; d <= 6; d++) {
    home.set(NOON + d * DAY);
    // In at noon, a minute at home, a safe boundary from a screen that draws cards — no offer reaches a player at home.
    for (let s = 0; s < 4; s++) { home.set(NOON + d * DAY + s * 15000); const r = home.pulse(); if (s === 3) home.store.boundary({ surfaceId: r.surfaceId, fence: r.fence, caps: ['cards'], seen: [] }); }
  }
  for (const h of [away, home]) { h.set(NOON + 6 * DAY + 2 * HOUR); h.pulse(); }
  const [a, b] = [away, home].map(h => h.store.read().state.village);
  assert.ok(a.happened?.length > 0 && a.news?.length > 0 && Object.keys(a.band.cards || {}).length > 0, '엿새 동안 카드가 서고 풀리고 소식이 났다');
  assert.deepEqual(residentsSide(b), residentsSide(a));
  // W6: 날마다 낮에 온 기록(접속 구간 고리·방문)은 플레이어 쪽이라 마을 밖에 있고, 낮 습관은 구간 계획에 남지 않는다.
  const [ringAway, ringHome] = [away, home].map(h => h.store.read().state.visitBands.ring.filter(Boolean).length);
  assert.ok(ringHome > ringAway, `날마다 온 마을의 고리 ${ringHome} > 비운 마을 ${ringAway}`);
  assert.equal(b.band.visitHabit, undefined, '낮 습관은 계획을 바꾸지 않는다');
});

test('나와 함께 — 연 카드는 주인을 붙잡고, 고르고 확정하면 플레이어의 결과(당사자만 앎)이고, 닫으면 주인은 자기 하루로', async () => {
  const { createStore } = await server(), village = await townModule('village'), cards = await townModule('cards');
  const h = harness(createStore, 'acct-together');
  h.pulse();
  // Find a card that rises with its owner at a place the player can stand at, and be there a little after it rises.
  let found = null;
  for (let step = 0; step < 48 && !found; step++) {
    const v = h.store.read().state.village, out = village.planOf(v);
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, s]) => s));
    for (const e of out.log.filter(x => x.atMs > h.now && cards.CARD_BY_ID[x.card].paths.player.ready && !cards.CARD_BY_ID[x.card].paths.player.activity)) {
      const at = village.placeAt(out.segments, e.npc, e.atMs + 20000, start);
      if (at && !at.walking && ['cafe', 'workshop', 'greenhouse'].includes(at.to)) { found = { ...e, place: at.to }; break; }
    }
    if (!found) { h.set(h.now + HOUR); h.pulse(); }
  }
  assert.ok(found, '플레이어가 설 수 있는 곳에서 카드가 선다');
  h.set(found.atMs + 20000); h.pulse();
  h.send('DAY_MOVE', { location: found.place }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
  h.send('CARD_OPEN', { card: found.card, key: found.key, source: 'direct' });
  let state = h.store.read().state;
  const by = `card:${found.card}:${found.key}`, card = cards.CARD_BY_ID[found.card];
  assert.ok(state.village.reservations.some(r => r.by === by && r.npc === card.owner && r.toMs === null), '주인을 붙잡는다');
  assert.equal(h.store.read().view.day.scene.village.take.card, found.card);
  h.send('CARD_CHOOSE', { choice: card.paths.player.choices[0] });
  h.set(h.now + 2 * MIN); h.pulse();
  h.send('CARD_CONFIRM');
  state = h.store.read().state;
  const event = state.townEvents.find(e => e.kind === 'card.resolved' && e.path === 'player');
  assert.ok(event && event.public === false && event.actors.includes('player') && event.canonicalActivityId === `card.${found.card}`, JSON.stringify(event));
  const knowers = Object.entries(state.village.knowledge.known).filter(([, list]) => list.some(e => e.ref === event.ref)).map(([npc]) => npc).sort();
  assert.deepEqual(knowers, [card.owner, ...(card.paths.player.with || [])].sort(), '당사자만 안다(G6)');
  assert.ok(state.village.reservations.some(r => r.by === by && r.with === true), '결과에 닿은 붙잡힘 — 함께한 일');
  h.send('CARD_CLOSE');
  state = h.store.read().state;
  assert.ok(state.village.reservations.filter(r => r.by === by).every(r => r.toMs !== null), '닫으면 놓인다');
  h.set(h.now + 8 * HOUR); h.pulse();
  state = h.store.read().state;
  assert.ok(!(state.village.news || []).some(n => n.ref === event.ref) && !(state.village.happened || []).some(n => n.ref === event.ref), '소식·일어난 일에 오르지 않는다');
  assert.ok(Object.entries(state.village.knowledge.known).every(([npc, list]) => !list.some(e => e.ref === event.ref) || [card.owner, ...(card.paths.player.with || [])].includes(npc)));
  // Forgetting it (§20-5): that resident no longer knows it in the notebook's list.
  h.send('MEMORY_FORGET', { npc: card.owner, eventId: event.ref });
  assert.ok(!h.store.read().view.day.scene.village.knownMe[card.owner].some(e => e.ref === event.ref));
});
