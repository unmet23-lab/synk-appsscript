'use strict';
// 싱크타운 W11 인수(세로 조각 설계 §15-2~4) — 앞 단계 시험에 없던 원칙·결정성·저장 확인(노트 W11 §1-2의 빈 곳).
// §15-2: 대사 고르기 함수는 부재 값(마지막 방문·방문 수·비운 날 수)을 읽지 않고(접근 추적), 7일 비운 사람이 8일째 받는 줄에도 금지
// 말이 없으며 플레이어가 만든 것은 그대로다. 같은 씨앗의 밤 습관 마을과 없는 마을은 낮이 같고 밤은 첫 습관 조각부터만 다르다.
// §15-3: 같은 흐름에 경계 신호를 0·1·여러 번 끼워도 마을이 같고, 두 기기(A가 명령, B가 읽기)의 예측이 서버가 그때 보이는 자리와
// 같으며, 시간대가 바뀌어도 결산한 사건이 다시 생기지 않고 생활일 번호가 줄지 않는다. §15-4: 30생활일 뒤 세계 크기 64KB 안.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { townModule, toolModule, ROOT } = require('./lib/town.js');

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23(금) 12:00 KST
const screen = name => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', `${name}.mjs`)).href);
const LABELS = { 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원' };

function harness(createStore, seed, options = {}) {
  let now = options.start ?? NOON, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: options.tz ?? 540, villageSeed: seed });
  const surface = options.surface ?? 'day-a';
  const h = {
    store, get now() { return now; }, set(ms) { now = ms; },
    pulse(ms = 0) { now += ms; receipt = store.pulse({ surfaceId: surface, surface: 'day', foreground: true, safe: true }).presence; return receipt; },
    boundary(extra = {}) { return store.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence, caps: ['cards', 'asks', 'tea'], ...extra }); },
    send(type, payload = {}) {
      return store.execute({ id: `acc-${++sequence}`, type, expectedRevision: store.read().state.revision,
        payload: { ...(/^(DAY_|CARD_|GREET$)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
    },
    go(location) { h.send('DAY_MOVE', { location }); if (store.read().state.day.home.exitTarget) h.send('DAY_EXIT'); },
  };
  return h;
}
const residentsSide = v => { const { told, ...rest } = v; return rest; };

// §15-2 ③ 접근 추적: 부재를 말하는 값의 이름. 입력에 일부러 심어 두고, 함수가 이 이름을 한 번이라도 읽으면 걸린다.
const ABSENCE = ['since', 'lastVisit', 'lastVisitAt', 'lastPlay', 'lastEnd', 'visits', 'visitCount', 'visit', 'awayDays', 'daysAway',
  'absentDays', 'awayMs', 'gapMs', 'townVisit', 'visitBands', 'settledU', 'breaks', 'returnMs'];
const planted = () => ({ since: NOON - 7 * DAY, lastVisit: NOON - 7 * DAY, visits: 9, visit: 9, awayDays: 7, gapMs: 7 * DAY,
  townVisit: { startAt: NOON, since: NOON - 7 * DAY }, visitBands: { ring: [] }, settledU: 1 });
function tracked(value, reads) {
  if (!value || typeof value !== 'object') return value;
  return new Proxy(value, { get(target, key, receiver) {
    if (typeof key === 'string') reads.add(key);
    return tracked(Reflect.get(target, key, receiver), reads);
  } });
}

test('§15-2 ③ 대사 고르기 여섯(장면 · 인사 · 일과 · 마음 줄 · 전해 듣기 고르기 · 그 말)은 부재 값을 읽지 않는다 — 접근 추적', async () => {
  const [{ createStore }, cardsUi, moodUi, knowledge, village, cards] = await Promise.all([screen('server'), screen('day-cards'), screen('day-mood'),
    townModule('knowledge'), townModule('village'), townModule('cards')]);
  // A village that lived a few days, so the residents know public things and the plan has cards, pairs and mood lines.
  const h = harness(createStore, 'acct-accept-trace');
  h.pulse(); h.store.read();
  h.set(NOON + 3 * DAY + 2 * HOUR); h.pulse();
  const v = h.store.read().state.village, out = village.planOf(v), season = 'autumn';
  const waiting = cards.cardsAt(village.bandInput(v), out.segments, out.log, h.now);
  const steps = Object.fromEntries(Object.entries(v.band.pairs || {}).map(([key, p]) => [key, p.friction?.step ?? 0]));
  const reads = new Set(), seg = s => ({ ...s, ...planted() }), segments = () => tracked(out.segments.map(seg), reads);
  const said = [];
  for (const npc of Object.keys(LABELS)) for (let t = v.band.startMs; t < v.band.endMs; t += 20 * MIN) {
    said.push(cardsUi.sceneLine(segments(), npc, t, tracked({ steps, waiting, season, ...planted() }, reads)));
    said.push(cardsUi.routineLine(npc, tracked({ segments: out.segments.map(seg), t, band: v.band.band, lifeDay: v.band.lifeDay, ...planted() }, reads)));
    said.push(moodUi.moodAt(segments(), npc, t, tracked({ seen: {}, knownMe: {}, ...planted() }, reads)));
    for (const archetype of ['serve', 'craft', 'notes', 'doze', 'brew'])
      said.push(cardsUi.greetLine(npc, tracked({ band: v.band.band, weather: 'clear', minute: 13 * 60, archetype, ...planted() }, reads)));
  }
  for (const s of out.segments.filter(x => x.mood)) said.push(moodUi.moodVariant(tracked(seg(s), reads), tracked({ seen: {}, knownMe: [], ...planted() }, reads)));
  for (const npc of Object.keys(LABELS)) {
    const entry = knowledge.hearsayFor(tracked({ ...v, ...planted() }, reads), npc);
    said.push(entry && cardsUi.hearsayText(npc, tracked({ ...entry, ...planted() }, reads)));
  }
  assert.ok(said.filter(Boolean).length > 20, `줄을 실제로 골랐다 ${said.filter(Boolean).length}`);
  const touched = ABSENCE.filter(key => reads.has(key));
  assert.deepEqual(touched, [], `부재 값을 읽었다: ${touched.join(', ')}`);
  assert.ok(reads.has('startMs') && reads.has('npc'), '추적이 실제로 걸렸다(조각의 칸을 읽음)');
});

test('§15-2 ③ 8일째 — 7일 비운 사람과 매일 온 사람: 주민 쪽이 같고, 비운 사람이 받는 줄에 금지 말이 없으며, 플레이어가 놓은 방석은 그대로다', async () => {
  const [{ createStore }, { FORBIDDEN }, { TOWN_LINES }] = await Promise.all([screen('server'), toolModule('town-lines-check'), townModule('data.gen')]);
  const away = harness(createStore, 'acct-accept-day8'), daily = harness(createStore, 'acct-accept-day8');
  // The first day both place the cushion at the window (the player's own thing — 마을:117 「한번 쌓인 것은 줄어들지 않는다」).
  for (const h of [away, daily]) { h.pulse(); h.store.read(); h.send('DAY_HOME_PREVIEW', { slot: 'window' }); h.send('DAY_HOME_CONFIRM'); }
  // Seven days away and back on the eighth day (the first day counted): within §10-1's seven-day cut, so both lived the same
  // days; the daily player came in at noon each day in between — a minute at home and a safe boundary from a screen that draws
  // everything (nothing reaches a player at home).
  for (let d = 1; d <= 6; d++) for (let s = 0; s < 4; s++) { daily.set(NOON + d * DAY + s * 15000); daily.pulse(); if (s === 3) daily.boundary({ seen: [] }); }
  for (const h of [away, daily]) { h.set(NOON + 7 * DAY + 2 * HOUR); h.pulse(); for (let s = 0; s < 5; s++) h.pulse(1000); }
  const [a, b] = [away, daily].map(h => h.store.read());
  assert.deepEqual(residentsSide(b.state.village), residentsSide(a.state.village), '주민 상태·카드·쌍·지식·소식이 같다');
  for (const { state } of [a, b]) assert.equal(state.day.home.slot, 'window', '플레이어가 놓은 방석은 그대로');
  // Every line the returning player gets on the eighth day — what changed meanwhile, the news, the hearsay greetings — is
  // free of the forbidden words (period · reproach · comparison, G3) at every level.
  const lines = [...(a.view.day.scene.village.meanwhile?.lines || []).map(l => ({ id: l.id, npc: l.npc, npc2: l.npc2 })),
    ...(a.view.day.scene.village.news || []).map(n => ({ id: n.id ?? n.line, npc: n.npc })),
    ...Object.entries(a.view.day.scene.village.hearsay || {}).map(([npc, e]) => ({ id: e?.line ?? e?.id, npc }))].filter(l => typeof l.id === 'string');
  assert.ok(lines.length > 0, '돌아온 사람이 받는 줄이 있다');
  for (const line of lines) {
    const entry = TOWN_LINES.find(e => e.id === line.id);
    if (!entry) continue;
    for (const text of Object.values(entry.levels)) {
      const filled = text.replaceAll('{npc2}', LABELS[line.npc2] || '').replaceAll('{npc}', LABELS[line.npc] || '');
      assert.ok(FORBIDDEN.every(group => group.patterns.every(re => !re.test(filled))), `${line.id}: ${filled}`);
    }
  }
});

test('§15-2 습관 나란히 — 같은 씨앗의 밤 습관 마을과 없는 마을: 낮은 바이트까지 같고, 밤은 첫 습관 조각부터만 다르며 카드는 같고 나쁜 쪽 변화가 0', async () => {
  const village = await townModule('village'), { initialVisitBands, writeBand } = await townModule('visits'), { bandAt } = await townModule('clock');
  const today = bandAt([{ fromMs: 0, offsetMin: 540 }], NOON).lifeDay;
  let vb = initialVisitBands();
  for (const d of [3, 2, 1]) vb = writeBand(vb, today - d, 'night');
  const key = s => `${s.npc}|${s.archetype}|${s.spot}|${s.startMs}|${s.endMs}`;
  let habitPieces = 0, otherAfter = 0;
  for (const seed of ['acct-w6-a', 'acct-w6-b', 'acct-w6-c', 'acct-w6-d', 'acct-acc-1', 'acct-acc-2']) {
    const withHabit = village.initialVillage(), without = village.initialVillage();
    village.closeBands(withHabit, { nowMs: NOON, seed, offsetMin: 540, revision: 0, visitBands: vb });
    village.closeBands(without, { nowMs: NOON, seed, offsetMin: 540, revision: 0 });
    assert.deepEqual(village.planOf(withHabit), village.planOf(without), `${seed}: 낮 구간은 습관과 상관없이 같다`);
    for (const v of [withHabit, without]) village.closeBands(v, { nowMs: NOON + 10 * HOUR, seed, offsetMin: 540, revision: 0, ...(v === withHabit ? { visitBands: vb } : {}) });
    const A = village.planOf(withHabit), B = village.planOf(without);
    assert.equal(withHabit.band.visitHabit, 'night'); assert.equal(without.band.visitHabit, undefined);
    const first = Math.min(...A.segments.filter(s => s.visitHabit).map(s => s.startMs));
    assert.ok(Number.isFinite(first), `${seed}: 습관 조각이 선다`);
    const inA = new Set(A.segments.map(key)), inB = new Set(B.segments.map(key));
    const onlyA = A.segments.filter(s => !inB.has(key(s))), onlyB = B.segments.filter(s => !inA.has(key(s)));
    assert.ok([...onlyA, ...onlyB].every(s => s.startMs >= first), `${seed}: 첫 습관 조각 앞은 같다`);
    assert.deepEqual({ log: A.log, cards: A.cards, resolved: A.resolved }, { log: B.log, cards: B.cards, resolved: B.resolved }, `${seed}: 카드가 같다`);
    assert.ok(onlyA.every(s => s.visitHabit || !s.card && !s.with), `${seed}: 습관 몫 말고 다른 것은 일과 조각뿐(카드·쌍 장면 아님)`);
    assert.deepEqual(A.stateLog.filter(x => x.cause === 'player-routine' && (x.stat === 'chores' ? x.delta > 0 : x.delta < 0)), [], `${seed}: 나쁜 쪽 0`);
    habitPieces += onlyA.filter(s => s.visitHabit).length; otherAfter += onlyA.filter(s => !s.visitHabit).length;
  }
  // The design names the night pieces and their pair scenes; a neighbour's routine piece after them may move too (a spot or a
  // partner free at another time) — counted here, the report keeps the number (W11).
  assert.ok(habitPieces > 0 && otherAfter <= habitPieces / 4, `습관 조각 ${habitPieces} · 그 뒤 달라진 다른 일과 조각 ${otherAfter}`);
});

test('§15-3 읽는 때와 횟수 — 같은 흐름에 경계 신호를 0번·1번·여러 번 끼워도 마을(주민·카드·쌍·지식·소식)이 같다', async () => {
  const { createStore } = await screen('server');
  const flows = [[], [17], Array.from({ length: 40 }, (_, i) => 3 + i * 3)]; // minutes into the visit
  const worlds = flows.map(at => {
    const h = harness(createStore, 'acct-accept-bound');
    h.pulse(); h.store.read();
    const marks = new Set(at);
    for (let m = 1; m <= 150; m++) {
      for (let s = 0; s < 3; s++) h.pulse(20000);
      if (m === 5) h.go('cafe'); if (m === 60) h.go('workshop'); if (m === 100) h.go('greenhouse');
      if (marks.has(m)) h.boundary({ seen: [] });
    }
    h.set(NOON + 6 * HOUR); h.pulse();
    return h.store.read().state;
  });
  const v = worlds.map(w => residentsSide(w.village));
  assert.deepEqual(v[1], v[0], '경계 신호 한 번'); assert.deepEqual(v[2], v[0], '경계 신호 여러 번');
  assert.deepEqual(worlds.map(w => w.revision), worlds.map(() => worlds[0].revision), '명령 수가 같다(경계 신호는 명령이 아니다)');
});

test('§15-3 두 기기 — A가 무작위 명령을 보내는 동안 B가 읽은 조각으로 5분 뒤 주민 자리를 예측하면, 그때 서버가 보이는 자리와 같다', async () => {
  const [{ createStore }, village, { createRng }, { PLAYER_PLACES }] = await Promise.all([screen('server'), townModule('village'), townModule('rng'), townModule('places')]);
  let now = NOON, seq = 0;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-accept-two' });
  const pulse = surfaceId => store.pulse({ surfaceId, surface: 'day', foreground: surfaceId === 'day-a', safe: true }).presence;
  let a = pulse('day-a'); pulse('day-b'); store.read();
  const rng = createRng('acct-accept-two', 'commands'), places = PLAYER_PLACES;
  let checked = 0;
  for (let round = 0; round < 24; round++) {
    // B reads what the screen gets and predicts each resident five minutes on (the band's plan is the band's).
    const view = store.read().view.day.scene.village, at = now + 5 * MIN;
    const sameBand = at < view.band.endMs;
    const predicted = sameBand ? Object.fromEntries(Object.keys(LABELS).map(npc => [npc, village.placeAt(view.segments, npc, at, view.startSpots)])) : null;
    // Meanwhile A sends what a player does on the day screen: moves between places, every one a command.
    for (let k = 0; k < 3; k++) {
      now += 60000; a = pulse('day-a'); pulse('day-b');
      const to = places[rng.between(0, places.length - 1)];
      const state = store.read().state;
      if (state.day.location !== to) store.execute({ id: `two-${++seq}`, type: 'DAY_MOVE', expectedRevision: state.revision, payload: { surfaceId: a.surfaceId, fence: a.fence, location: to } });
      if (store.read().state.day.home.exitTarget) store.execute({ id: `two-${++seq}`, type: 'DAY_EXIT', expectedRevision: store.read().state.revision, payload: { surfaceId: a.surfaceId, fence: a.fence } });
    }
    now = at; a = pulse('day-a'); pulse('day-b');
    if (predicted) {
      const later = store.read().view.day.scene.village;
      for (const npc of Object.keys(LABELS)) {
        const server = village.placeAt(later.segments, npc, at, later.startSpots);
        assert.deepEqual(server && { to: server.to, spot: server.spot, walking: server.walking }, predicted[npc] && { to: predicted[npc].to, spot: predicted[npc].spot, walking: predicted[npc].walking }, `${round}회 ${npc}`);
        checked++;
      }
    }
    now += 25 * MIN;
  }
  assert.ok(checked >= 30, `견준 자리 ${checked}`);
});

test('§15-3 시간대 바뀜(저장소 층) — 서울에서 뉴욕으로 옮겨도 결산한 사건이 다시 생기지 않고 생활일 번호가 줄지 않는다', async () => {
  const { createStore } = await screen('server');
  const moved = NOON + 2 * DAY + 4 * HOUR;
  const h = harness(createStore, 'acct-accept-tz', { tz: [{ fromMs: 0, offsetMin: 540 }, { fromMs: moved, offsetMin: -300 }] });
  let lastDay = -Infinity, reads = 0;
  for (let t = NOON; t <= NOON + 5 * DAY; t += 3 * HOUR) {
    h.set(t); h.pulse();
    const { state } = h.store.read();
    assert.ok(state.village.band.lifeDay >= lastDay, `${new Date(t).toISOString()}: 생활일 ${state.village.band.lifeDay} < ${lastDay}`);
    lastDay = state.village.band.lifeDay; reads++;
  }
  const { state } = h.store.read();
  const refs = state.townEvents.filter(e => e.kind === 'card.resolved').map(e => e.ref);
  assert.ok(refs.length > 0, '카드가 풀렸다');
  assert.equal(new Set(refs).size, refs.length, '풀린 카드 사건이 두 번 생기지 않는다');
  const happened = (state.village.happened || []).map(e => e.ref);
  assert.equal(new Set(happened).size, happened.length, '마을에 일어난 일이 두 번 적히지 않는다');
  assert.ok(reads > 30);
});

test('§15-4 세계 크기 — 날마다 들러 골목을 다닌 30생활일 뒤 세계가 64KB 안', async () => {
  const { createStore } = await screen('server');
  const h = harness(createStore, 'acct-accept-size');
  for (let d = 0; d < 30; d++) {
    h.set(NOON + d * DAY + (d % 3) * 3 * HOUR); h.pulse(); h.store.read();
    h.go(['cafe', 'workshop', 'greenhouse'][d % 3]);
    for (let s = 0; s < 6; s++) h.pulse(10000);
    h.boundary({ seen: [] });
    h.go('home');
  }
  h.set(NOON + 30 * DAY); h.pulse(); h.store.read();
  const { worldBytes } = h.store.stats();
  assert.ok(worldBytes <= 65536, `${worldBytes}B`);
  // The value goes to the W11 report (§15-4 표) — printed for the run that writes it.
  console.log(JSON.stringify({ worldBytesAfter30LifeDays: worldBytes }));
});
