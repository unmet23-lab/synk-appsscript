'use strict';
// 싱크타운 찻집 주문(세로 조각 설계 §11 · §22, W8, 시험 §15-5 town-tea): 정답 여럿 · 고쳐 내기 · 소모 없음 · 단골,
// 손 상태 기계 · 간단히 만들기, 함께한 일(낸 손님 수만큼) · 생활일에 사건 하나 · 결과 자리, 카드 C5(주문) · R6(한 잔 판).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const load = file => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', file)).href);
const tea = () => load('town/activities/tea-order.mjs');
const TZ = 540, MIN = 60000;
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0);   // 2026-10-23 12:00 KST — the day band, every resident up
const CTX = { villageSeed: 'acct-tea', lifeDay: 20749, band: 'day', level: 'L2', raining: false, playerSeat: null, busy: () => false };
const cupFor = request => ({ vessel: request.temp ?? 'warm', tea: request.tea ?? 'barley', honey: request.sweet ?? 1 });
const other = (t, axis, value) => t.VALUES[axis].find(v => v !== value);

/** A world whose player stands at the cafe at noon, with commands sent straight to the reducer. */
async function cafe({ now = NOON } = {}) {
  const [{ createStore }, core] = await Promise.all([load('server.mjs'), load('core.mjs')]);
  const store = createStore({ now: () => now, tz: TZ, villageSeed: 'acct-tea', sleeps: true, lifeEnabled: true });
  store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true });
  let state = store.read().state, n = 0;
  state.day.location = 'cafe';
  const host = (at = now) => ({ enabled: true, surface: 'day', nowMs: at, villageSeed: 'acct-tea', canRun: true, surfaceId: 'day-a', ownerSurfaceId: 'day-a', elapsedMs: 0 });
  const w = {
    core, get state() { return state; }, set state(value) { state = value; },
    send(type, payload = {}, at = now) { state = core.reduceCommand(state, { id: `c-${++n}`, type, payload, expectedRevision: state.revision }, host(at)).state; return state; },
    order: () => state.activities['tea-order'].open,
    events: kind => state.townEvents.filter(e => e.kind === kind),
  };
  return w;
}

test('요청한 축만 본다 — 말 안 한 축은 무엇이든 정답이고, 다르면 첫 다른 축 하나만 부드럽게(§11-2·§11-3)', async () => {
  const t = await tea(), req = { tea: 'yuzu', temp: 'warm' };
  for (const honey of t.VALUES.sweet) assert.deepEqual(t.judge(req, { vessel: 'warm', tea: 'yuzu', honey }), [], '꿀은 말하지 않았다');
  assert.deepEqual(t.judge(req, { vessel: 'cold', tea: 'barley', honey: 1 }), ['tea', 'temp']);
  const g = { request: req, regular: false, note: null };
  assert.deepEqual(t.reactFor(g, { vessel: 'cold', tea: 'barley', honey: 1 }, ['tea', 'temp']), { line: 'guest.tea.react-tea.1', values: { tea: 'yuzu' }, axis: 'tea' });
  assert.equal(t.reactFor(g, { vessel: 'cold', tea: 'yuzu', honey: 1 }, ['temp']).line, 'guest.tea.react-warmer.1');
  // 맞을 때도 말 안 한 축에 따라 한마디가 다르다(§2-16 ⑨).
  assert.equal(t.reactFor(g, { vessel: 'warm', tea: 'yuzu', honey: 0 }, []).line, 'guest.tea.react-match-honey0.1');
  assert.equal(t.reactFor({ request: { sweet: 2 }, regular: false }, { vessel: 'cold', tea: 'today', honey: 2 }, []).line, 'guest.tea.react-match-cold.1');
  assert.equal(t.reactFor({ request: { tea: 'barley', temp: 'cold', sweet: 0 }, regular: false }, { vessel: 'cold', tea: 'barley', honey: 1 }, ['sweet']).line, 'guest.tea.react-less-sweet.1');
  assert.equal(t.reactFor({ request: { tea: 'barley', temp: 'cold', sweet: 2 }, regular: false }, { vessel: 'cold', tea: 'barley', honey: 0 }, ['sweet']).line, 'guest.tea.react-more-sweet.1');
  // 요청 글의 빈칸은 표의 값으로만 채운다(G5) — 「같은 걸로」는 L1에서 빌린 차를 풀어 말한다.
  assert.equal(t.lineWords('guest.tea.req-same-temp.1', 'L1', { tea: 'yuzu', temp: 'cold' }), '차가운 유자차 주세요.');
  assert.equal(t.lineWords('guest.tea.req-same-temp.1', 'L2', { tea: 'yuzu', temp: 'cold' }), '저도 같은 차로 하는데, 차갑게 주세요.');
  assert.equal(t.fillLine('{sweet.honey} 부탁해요.', { sweet: 0 }), '꿀 없이 부탁해요.');
});

test('같은 시드면 같은 주문 — B는 A와 한 축 이상 다르고, 단골은 첫 주문의 A로 와서 넷에 하나 「늘 마시던 걸로요」(§11-2·§11-5)', async () => {
  const t = await tea();
  let slot = t.initial();
  assert.deepEqual(t.orderGuests(slot, CTX), t.orderGuests(slot, CTX), '두 기기가 같은 주문을 연다');
  const regulars = [];
  for (let i = 0; i < 13; i++) {
    const opened = t.apply(slot, { type: 'TEA_OPEN', payload: {} }, { ...CTX, id: `T-${i}`, nowMs: NOON + i * MIN });
    assert.ok(!opened.error, JSON.stringify(opened.error));
    const [a, b] = opened.slot.open.guests;
    assert.ok(t.AXES.some(axis => a.request[axis] !== b.request[axis]), `주문 ${i}: 두 손님의 요청이 같다`);
    regulars.push(a.regular);
    if (i === 4) {
      assert.equal(a.frame, t.USUAL, 'L2 이상은 「늘 마시던 걸로요」');
      assert.deepEqual(a.request, slot.regular.pref.request, '처음 받은 요청 그대로');
      assert.equal(a.note, slot.regular.pref.frame, '쪽지를 열면 처음 요청');
      const l1 = t.orderGuests(slot, { ...CTX, level: 'L1' }).guests[0];
      assert.equal(l1.frame, slot.regular.pref.frame, 'L1이면 처음 요청을 다시 말한다');
    }
    const closed = t.apply(opened.slot, { type: 'TEA_CLOSE', payload: {} }, { ...CTX, nowMs: NOON + i * MIN + 1 });
    slot = closed.slot;
  }
  assert.deepEqual(regulars.map((r, i) => r ? i : -1).filter(i => i >= 0), [0, 4, 8, 12]);
});

test('고쳐 내기 — 다르면 잔이 돌아오고 아무것도 쓰지 않으며, 두 번 다르면 주인이 한 번 묻고, 주인은 어느 때나 맡는다(§11-3, 검토 F3)', async () => {
  const t = await tea(), ctx = { ...CTX, id: 'T-1', nowMs: NOON };
  let { slot } = t.apply(t.initial(), { type: 'TEA_OPEN', payload: {} }, ctx);
  const [a, b] = slot.open.guests, id = slot.open.id;
  const wrong = { ...cupFor(a.request), ...(a.request.tea ? { tea: other(t, 'tea', a.request.tea) } : a.request.temp ? { vessel: other(t, 'temp', a.request.temp) } : { honey: other(t, 'sweet', a.request.sweet) }) };
  const serve = (s, guest, cup, extra = {}) => t.apply(s, { type: 'TEA_SERVE', payload: { order: id, guest, cup, mode: 'make', ...extra } }, { ...ctx, location: 'cafe', nowMs: NOON + MIN });
  let out = serve(slot, 'a', wrong);
  assert.deepEqual([out.events.length, out.slot.open.guests[0].done, out.slot.open.guests[0].tries, out.slot.open.guests[0].owner], [0, null, 1, null]);
  out = serve(out.slot, 'a', wrong);
  assert.equal(out.slot.open.guests[0].owner, 'asked', '두 번 다르면 「제가 해 볼까요?」 한 번');
  assert.equal(t.apply(out.slot, { type: 'TEA_OWNER', payload: { order: id, guest: 'b', choice: 'self' } }, ctx).error?.[0], 'tea-owner', '묻지 않은 손님은 사양할 것이 없다');
  const declined = t.apply(out.slot, { type: 'TEA_OWNER', payload: { order: id, guest: 'a', choice: 'self' } }, ctx).slot;
  assert.equal(declined.open.guests[0].owner, 'declined');
  out = serve(declined, 'a', cupFor(a.request), { asks: { a: { repeat: 1, reopen: 2 } } });
  const g = out.slot.open.guests[0];
  assert.equal(g.done.by, 'player'); assert.deepEqual([g.asks.repeat, g.asks.reopen, g.tries], [1, 2, 2]);
  assert.equal(out.events[0].kind, 'tea.request'); assert.equal(out.events[0].result, 'made');
  // 주인이 맡아요(어느 때나) — 묻지 않았어도 된다.
  const owned = t.apply(out.slot, { type: 'TEA_OWNER', payload: { order: id, guest: 'b', choice: 'owner' } }, ctx);
  assert.equal(owned.slot.open.guests[1].done.by, 'owner');
  assert.deepEqual(owned.completed, { id, card: null, served: 1 }, '두 손님이 다 끝나 결과가 났다 — 플레이어가 낸 손님 하나');
  assert.deepEqual(t.results(owned.slot), [[`tea:${id}`, 1]], '함께한 일 = 낸 손님 하나만큼');
  assert.equal(serve(slot, 'a', { vessel: 'warm', tea: 'matcha', honey: 1 }).error?.[0], 'tea-cup', '표에 없는 잔');
  assert.equal(t.apply(slot, { type: 'TEA_SERVE', payload: { order: id, guest: 'a', cup: cupFor(a.request), mode: 'make' } }, { ...ctx, location: 'workshop' }).error?.[0], 'tea-too-far');
  assert.ok(b, '손님 둘');
});

test('자리 — 단골은 플레이어 자리로, 지나가는 손님은 찻집 자리(비 오면 처마), 주민 조각·앉은 손님과 겹치면 다음, 없으면 들고 간다', async () => {
  const t = await tea(), base = { nowMs: NOON, raining: false, playerSeat: 'cafe.garden-right', busy: () => false };
  assert.equal(t.seatFor(t.initial(), { ...base, regular: true }), 'cafe.garden-right');
  assert.equal(t.seatFor(t.initial(), { ...base, regular: false }), 'cafe.garden');
  assert.equal(t.seatFor(t.initial(), { ...base, raining: true }), 'cafe.eaves-left', '비 오면 처마');
  assert.equal(t.seatFor(t.initial(), { ...base, busy: spot => spot === 'cafe.garden' }), 'cafe.eaves-left');
  const full = { ...t.initial(), seated: ['cafe.garden', 'cafe.eaves-left', 'cafe.eaves-right'].map(spot => ({ who: 'companion', spot, fromMs: NOON, toMs: NOON + 20 * MIN })) };
  assert.equal(t.seatFor(full, base), null, '자리가 다 차면 들고 간다');
  assert.equal(t.seatFor(full, { ...base, nowMs: NOON + 21 * MIN }), 'cafe.garden', '머문 손님은 떠난다');
});

test('손 상태 기계 — 순서 자유 · 꿀 0→1→2→0 · 다 됐어요는 잔과 차가 있어야 · 쟁반이 차면 꺼짐 · 돌아온 잔 · 몸통(§11-4, 검토 F9·F10·F11)', async () => {
  const t = await tea(), order = { id: 'T-9', kind: 'order', guests: [{ slot: 'a', done: null, request: { tea: 'yuzu' } }, { slot: 'b', done: null, request: { temp: 'cold' } }] };
  let st = t.start(order), out;
  const go = action => { out = t.input(st, action); st = out.state; return out.cues; };
  assert.equal(st.phase, 'listen'); go({ type: 'fold', slot: 'a' }); go({ type: 'fold', slot: 'b' }); assert.equal(st.phase, 'make');
  assert.deepEqual(go({ type: 'done' }), [{ type: 'need', missing: ['vessel', 'tea'] }]);
  go({ type: 'pour', tea: 'yuzu' }); go({ type: 'honey' }); go({ type: 'honey' });
  assert.deepEqual(go({ type: 'honey' }), [{ type: 'spoon', honey: 0 }], '꿀은 돌림');
  assert.deepEqual(go({ type: 'done' }), [{ type: 'need', missing: ['vessel'] }], '잔 없이는 안 켜진다(따르기는 됐다)');
  go({ type: 'cup', vessel: 'warm' }); go({ type: 'done' });
  assert.deepEqual(st.tray[0], { vessel: 'warm', tea: 'yuzu', honey: 0 });
  go({ type: 'cup', vessel: 'cold' }); go({ type: 'pour', tea: 'barley' }); go({ type: 'done' });
  go({ type: 'cup', vessel: 'warm' }); go({ type: 'pour', tea: 'today' });
  assert.deepEqual(go({ type: 'done' }), [{ type: 'tray-full' }], '쟁반 둘이 차면');
  go({ type: 'reopen', slot: 'a' }); go({ type: 'ask', slot: 'a', kind: 'meaning' });
  go({ type: 'pick', index: 0 });
  const body = t.finish(st, order, 'a');
  assert.deepEqual(body, { order: 'T-9', guest: 'a', cup: { vessel: 'warm', tea: 'yuzu', honey: 0 }, mode: 'make', asks: { a: { repeat: 0, slower: 0, meaning: 1, reopen: 1 }, b: { repeat: 0, slower: 0, meaning: 0, reopen: 0 } } });
  // 판에 만들던 잔이 있으면 돌아온 잔은 제 쟁반 자리로, 판이 비면 판으로(고쳐 낼 수 있게).
  go({ type: 'returned' }); assert.deepEqual([st.hand, st.tray[0]?.tea, st.board.tea], [null, 'yuzu', 'today']);
  go({ type: 'empty' }); go({ type: 'pick', index: 0 }); go({ type: 'place' });
  assert.deepEqual([st.board, st.tray[0]], [{ vessel: 'warm', tea: 'yuzu', honey: 0 }, null], '든 잔을 판에 놓아 고친다');
  go({ type: 'sent' }); assert.equal(st.asks.a.meaning, 0, '받아들여진 명령 뒤에만 증분을 비운다');
  const oneCup = t.start({ id: 'T-r', kind: 'one-cup', guests: [{ slot: 'r', done: null, request: {} }] });
  assert.deepEqual([oneCup.phase, oneCup.tray.length], ['make', 1], '한 잔 판은 듣기 없이 한 칸');
});

test('간단히 만들기 — 요청과 맞는 잔 하나와 요청한 축 하나씩만 다른 잔, 같은 시드면 같은 차례(§11-4)', async () => {
  const t = await tea(), order = { id: 'T-5' };
  for (const request of [{ tea: 'yuzu', temp: 'warm' }, { sweet: 0 }, { tea: 'today', temp: 'cold', sweet: 2 }, {}]) {
    const g = { slot: 'a', request }, cups = t.previewCups(order, g);
    assert.deepEqual(t.previewCups(order, g), cups);
    assert.ok(cups.length >= 2 && cups.length <= 3, '두세 잔');
    assert.equal(cups.filter(cup => !t.judge(request, cup).length).length, Object.keys(request).length ? 1 : cups.length, '맞는 잔은 하나(요청이 없으면 모두)');
    for (const cup of cups) assert.ok(t.judge(request, cup).length <= 1, '함정 없음 — 다른 잔도 한 축만 다르다');
  }
});

test('찻집에서 — 주문을 열면 주인이 카운터에 붙잡히고, 낸 만큼 할 일이 줄며 어울림은 구간에 한 번, 함께한 일 사건은 생활일에 하나(§11-6, 검토 F1)', async () => {
  const w = await cafe(), ledger = JSON.stringify(w.state.ledger), wear = JSON.stringify(w.state.village.band.wear ?? {});
  w.send('TEA_OPEN');
  const order = w.order(), [a, b] = order.guests;
  const hold = w.state.village.reservations.find(r => r.by === `tea:${order.id}` && r.toMs === null);
  assert.deepEqual([hold?.npc, hold?.spot], ['cafe-owner', 'cafe.counter'], '주인이 카운터로 돌아온다(예약)');
  assert.equal(w.core.viewFor(w.state).tea.open.guests.length, 2);
  const wrong = { ...cupFor(a.request), honey: (cupFor(a.request).honey + 1) % 3, ...(a.request.tea ? { tea: other(await tea(), 'tea', a.request.tea) } : {}) };
  w.send('TEA_SERVE', { order: order.id, guest: 'a', cup: wrong, mode: 'make' });
  if (!w.order().guests[0].done) assert.equal(w.order().guests[0].tries, 1);
  if (!w.order().guests[0].done) w.send('TEA_SERVE', { order: order.id, guest: 'a', cup: cupFor(a.request), mode: 'make' });
  w.send('TEA_SERVE', { order: order.id, guest: 'b', cup: cupFor(b.request), mode: 'preview' });
  assert.equal(JSON.stringify(w.state.ledger), ledger, '재료 소모 없음');
  assert.equal(JSON.stringify(w.state.village.band.wear ?? {}), wear, '플레이어가 쓴 잔은 마모를 올리지 않는다');
  const marked = w.state.village.reservations.find(r => r.by === `tea:${order.id}`);
  assert.deepEqual([marked.with, marked.help], [true, 2], '열린 hold에 둘 다 낸 만큼');
  const together = w.events('tea.together');
  assert.equal(together.length, 1);
  assert.deepEqual([together[0].public, together[0].actors, together[0].participantRole, together[0].canonicalActivityId, together[0].storyFamily],
    [false, ['cafe-owner', 'player'], ['make', 'deliver'], 'tea-order', 'cafe-life']);
  assert.deepEqual(w.events('tea.request').map(e => [e.guest, e.by, e.result, e.mode]), [['a', 'player', 'made', 'make'], ['b', 'player', 'made', 'preview']]);
  const known = (w.state.village.knowledge?.known?.['cafe-owner'] || []).filter(e => e.activity === 'tea-order');
  assert.equal(known.length, 1, '찻집 주인만 안다');
  assert.ok(!(w.state.village.knowledge?.known?.researcher || []).some(e => e.activity), '다른 주민에게 퍼지지 않는다(G6)');
  // 다음 손님 — 앞 주문이 닫히며 hold가 끝나고(함께한 일이 그 구간에 셈), 같은 생활일엔 사건을 새로 쓰지 않는다.
  w.send('TEA_OPEN');
  assert.ok(marked.toMs !== null || w.state.village.reservations.find(r => r.by === `tea:${order.id}`).toMs !== null, '앞 주문의 hold가 닫혔다');
  const second = w.order();
  for (const g of second.guests) w.send('TEA_SERVE', { order: second.id, guest: g.slot, cup: cupFor(g.request), mode: 'make' });
  w.send('TEA_CLOSE', { order: second.id });
  assert.equal(w.events('tea.together').length, 1, '같은 생활일에 여러 번 해도 사건은 하나');
  assert.equal(w.order(), null);
  // 「잊어 주세요」 — 찻집 주인이 아는 그날의 찻집 일.
  const ref = known[0].ref;
  w.send('MEMORY_FORGET', { npc: 'cafe-owner', eventId: ref });
  assert.ok(!w.core.viewFor(w.state).day.scene.village.knownMe['cafe-owner'].some(e => e.ref === ref), '잊은 것은 수첩에서 빠진다');
});

test('찻집 밖·밤 · 범위 — 찻집 가까이가 아니면 열리지 않고, 주인이 자면 열리지 않으며, 닫기는 base(§20-7 ③)', async () => {
  const w = await cafe();
  w.state.day.location = 'workshop';
  assert.throws(() => w.send('TEA_OPEN'), { code: 'day-walk-too-far' });
  const night = await cafe({ now: Date.UTC(2026, 9, 23, 16, 0, 0) });   // 01:00 KST
  assert.throws(() => night.send('TEA_OPEN'), { code: 'resident-asleep' });
  const { commandScope } = await load('town/scope.mjs');
  assert.deepEqual(['TEA_OPEN', 'TEA_SERVE', 'TEA_OWNER', 'TEA_CLOSE'].map(commandScope), ['first-chapter', 'first-chapter', 'first-chapter', 'base']);
  w.state.day.location = 'cafe';
  w.send('TEA_OPEN');
  assert.throws(() => w.send('TEA_OPEN'), { code: 'tea-open' }, '하던 주문을 먼저');
  assert.throws(() => w.send('BAZAAR_START', { kind: 'reader' }), error => /busy/.test(error.code), '찻집의 다른 장면은 기다린다');
});

test('방문이 끝나면 주문은 「그만할래요」처럼 닫히고, 낸 만큼의 함께한 일은 hold가 닫히기 전에 선다(검토 F1·F14)', async () => {
  const w = await cafe();
  w.send('TEA_OPEN');
  const order = w.order(), a = order.guests[0];
  w.send('TEA_SERVE', { order: order.id, guest: 'a', cup: cupFor(a.request), mode: 'make' });
  w.core.stepLiving(w.state, { enabled: true, surface: 'day', nowMs: NOON + 5 * MIN, villageSeed: 'acct-tea', visitEnded: true, visitEndedAt: NOON + 5 * MIN, elapsedMs: 0 });
  const hold = w.state.village.reservations.find(r => r.by === `tea:${order.id}`);
  assert.deepEqual([hold.with, hold.help, hold.toMs !== null], [true, 1, true]);
  assert.equal(w.order(), null);
  const stopped = w.events('tea.request').find(e => e.guest === 'b');
  assert.deepEqual([stopped.by, stopped.result], ['owner', 'stopped']);
  assert.equal(stopped.arm, undefined, '방문 밖 사건은 판만(§20-6)');
  assert.equal(w.events('tea.together').length, 1, '낸 손님이 있으니 그날의 함께한 일');
});

/** The store as a screen drives it (presence on the live commands), on a village where C5 and R6 rise within two days. */
function harness(createStore, seed) {
  let now = NOON, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: TZ, villageSeed: seed });
  const pulse = () => { receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; return receipt; };
  const send = (type, payload = {}) => store.execute({ id: `t-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { ...(/^(DAY_|CARD_|TEA_|GREET)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  return { store, pulse, send, set: ms => { now = ms; }, get now() { return now; } };
}
/** Walks the clock an hour at a time until the card rises with its owner standing somewhere, and goes there just after. */
async function toRise(h, cardId, hours = 40) {
  const village = await load('town/village.mjs');
  for (let step = 0; step < hours; step++) {
    const v = h.store.read().state.village, out = village.planOf(v);
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, s]) => s));
    const e = out.log.find(x => x.atMs > h.now && x.card === cardId);
    const at = e && village.placeAt(out.segments, e.npc, e.atMs + 20000, start);
    if (at && !at.walking) {
      h.set(e.atMs + 20000); h.pulse();
      h.send('DAY_MOVE', { location: at.to }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
      return { ...e, place: at.to };
    }
    h.set(h.now + 60 * MIN); h.pulse();
  }
  return null;
}
const teaEvents = (h, kind) => h.store.read().state.townEvents.filter(e => e.kind === kind);

test('카드 C5 — 주인이 몰린 손님을 맞을 때 연 주문은 C5에 묶이고(한 길·한 사건), 한 손님이라도 내면 카드가 풀린다(공개 아님)(§8-4, 검토 F5·F16)', async () => {
  const { createStore } = await load('server.mjs'), h = harness(createStore, 'acct-together');
  h.pulse();
  const rise = await toRise(h, 'C5');
  assert.ok(rise, 'C5가 선다');
  assert.equal(rise.place, 'cafe');
  h.send('TEA_OPEN');
  let state = h.store.read().state, order = state.activities['tea-order'].open;
  assert.deepEqual(order.card, { id: 'C5', key: rise.key });
  assert.deepEqual(state.village.takes.filter(t => t.card === 'C5').map(t => [t.status, t.open]), [['with', true]]);
  const holds = state.village.reservations.filter(r => r.npc === 'cafe-owner' && r.toMs === null).map(r => r.by);
  assert.deepEqual(holds, [`card:C5:${rise.key}`], '카드의 hold가 주인을 잡는다(with-player-glad가 선다)');
  h.send('TEA_SERVE', { order: order.id, guest: 'a', cup: cupFor(order.guests[0].request), mode: 'make' });
  h.send('TEA_OWNER', { order: order.id, guest: 'b', choice: 'owner' });
  state = h.store.read().state;
  assert.deepEqual(teaEvents(h, 'card.resolved').filter(e => e.card === 'C5').map(e => [e.path, e.public, e.participantRole[0]]), [['player', false, 'make']]);
  assert.equal(teaEvents(h, 'tea.together').length, 0, '카드 사건이 그 일의 사건이다');
  const hold = state.village.reservations.find(r => r.by === `card:C5:${rise.key}`);
  assert.deepEqual([hold.with, hold.help], [true, 1], '낸 손님 하나만큼');
  h.send('TEA_OPEN');
  state = h.store.read().state;
  assert.equal(state.village.takes.find(t => t.card === 'C5').open, false, '다음 손님이 열리면 풀린 카드 take는 닫힌다');
  assert.equal(state.activities['tea-order'].open.card, null, '다음 손님은 그냥 주문');
});

test('카드 R6 — 한 잔 판: 연구원 곁에서 「같이 해요」, 찻집에서 만들어 들고 가 그 곁에서 내면(어떤 잔이든) 카드가 풀린다(§8-4 R6, 검토 F15)', async () => {
  const { createStore } = await load('server.mjs'), h = harness(createStore, 'acct-together');
  h.pulse();
  const rise = await toRise(h, 'R6', 48);
  assert.ok(rise, 'R6가 선다');
  h.send('CARD_OPEN', { card: 'R6', key: rise.key, source: 'direct' });
  let order = h.store.read().state.activities['tea-order'].open;
  h.send('CARD_OPEN', { card: 'R6', key: rise.key, source: 'direct' });
  assert.equal(h.store.read().state.activities['tea-order'].open.id, order.id, '다시 열어도 같은 판을 잇는다(검토 GA3)');
  assert.deepEqual([order.kind, order.card, order.guests.map(g => [g.slot, g.who, g.request])], ['one-cup', { id: 'R6', key: rise.key }, [['r', 'researcher', {}]]]);
  h.send('DAY_MOVE', { location: 'cafe' });
  assert.throws(() => h.send('TEA_SERVE', { order: order.id, guest: 'r', cup: { vessel: 'warm', tea: 'barley', honey: 2 }, mode: 'make' }), { code: 'day-walk-too-far' }, '찻집에서는 못 낸다');
  assert.throws(() => h.send('TEA_OWNER', { order: order.id, guest: 'r', choice: 'owner' }), { code: 'day-walk-too-far' });
  h.send('DAY_MOVE', { location: rise.place });
  h.send('TEA_SERVE', { order: order.id, guest: 'r', cup: { vessel: 'warm', tea: 'barley', honey: 2 }, mode: 'make' });
  const state = h.store.read().state;
  assert.equal(state.village.takes.find(t => t.card === 'R6').status, 'resolved');
  assert.deepEqual(teaEvents(h, 'card.resolved').filter(e => e.card === 'R6').map(e => [e.path, e.public, e.participantRole[0]]), [['player', false, 'deliver']]);
  assert.equal(teaEvents(h, 'tea.request').length, 0, '한 잔 판은 읽기 과제가 아니다');
  order = state.activities['tea-order'].open;
  assert.equal(order.done, undefined); assert.ok(order.completed !== null, '결과가 났다');
});

test('caps — 찻집 판을 그리는 화면(caps tea)에만 생활 카드 제안이 가고, 옛 화면(cards만)에는 가지 않는다(검토 F13)', async () => {
  const [{ offerReaches }, { CARD_BY_ID }] = await Promise.all([load('core.mjs'), load('town/cards.mjs')]);
  for (const id of ['C5', 'R6']) assert.deepEqual([offerReaches(CARD_BY_ID[id], ['cards']), offerReaches(CARD_BY_ID[id], ['cards', 'tea']), offerReaches(CARD_BY_ID[id], undefined)], [false, true, false]);
  assert.equal(offerReaches(CARD_BY_ID.C1, ['cards']), true, '고르기 카드는 그대로');
});

test('찻집을 떠났다 돌아와도 같은 주문의 일 덜기는 한 번만, 되묻기는 상한에서 멈추고 거절하지 않는다(검토 GA1·GA2)', async () => {
  const w = await cafe(), t = await tea();
  w.send('TEA_OPEN');
  const order = w.order();
  w.send('TEA_SERVE', { order: order.id, guest: 'a', cup: cupFor(order.guests[0].request), mode: 'make', asks: { a: { repeat: 500 } } });
  const { asksMax } = (await load('town/params.mjs')).paramsFor().tea;
  assert.equal(w.order().guests[0].asks.repeat, asksMax, '상한에서 멈춘다');
  w.send('DAY_MOVE', { location: 'workshop' });
  w.send('DAY_MOVE', { location: 'cafe' });
  const holds = () => w.state.village.reservations.filter(r => r.by === `tea:${order.id}`);
  assert.equal(holds().length, 2, '돌아오면 같은 주문의 hold가 새로 선다');
  w.send('TEA_CLOSE', { order: order.id });
  assert.equal(holds().reduce((sum, r) => sum + (r.help ?? 0), 0), 1, '낸 손님 하나 — 할 일도 한 번만 줄어든다');
  let st = t.start(order);
  for (let i = 0; i < 30; i++) st = t.input(st, { type: 'ask', slot: 'a', kind: 'repeat' }).state;
  assert.equal(st.asks.a.repeat, asksMax, '기기도 상한에서 멈춘다');
});
