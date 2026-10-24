'use strict';
// 싱크타운 주민 자기 상태와 마음 한 줄(세로 조각 설계 §7, W4) — 상태 셋의 규칙, 플레이어 탓이 생길 수 없는 원인
// 사슬(G4), 마음 한 줄은 고른 것과 기본 것이 날씨·상태로 갈렸을 때만 붙고 주민·이유·생활일마다 한 번(§6-4·§7-3).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23(금) 12:00 KST, 낮 구간
const OCT1 = 1790812800000; // 2026-10-01T00:00Z — 시뮬레이션과 같은 시작

/** 계획기만으로 마을 하루하루를 잇는다(결산이 하는 일과 같은 함수 — 생활일이 바뀌면 nextLifeDay). */
async function villageDays({ seed, days, startMs = OCT1, tz = 540, reservationsFor = () => [], habits = {} }) {
  const clock = await townModule('clock'), plan = await townModule('plan'), village = await townModule('village');
  const local = startMs + tz * MIN, first = (Math.floor((local - 5 * HOUR) / DAY) + 1) * DAY + 5 * HOUR - tz * MIN;
  let residents = {}, objects = { 'cafe-tray': { spot: 'cafe.prep' }, 'observation-board': { spot: 'greenhouse.board' } };
  const bands = [];
  for (let day = 0; day < days; day++) {
    const dayStartMs = first + day * DAY, lifeDay = clock.lifeDayAt(tz, dayStartMs);
    residents = village.nextLifeDay(residents, { seed, lifeDay, atMs: dayStartMs });
    for (const w of clock.bandsBetween(tz, dayStartMs, dayStartMs + DAY)) {
      const c = clock.clockAt({ villageSeed: seed, hostNowMs: w.startMs, tz });
      const input = { villageSeed: seed, lifeDay, band: w.band, startMs: w.startMs, endMs: w.endMs, dayStartMs, planCmdRev: 0,
        weatherTomorrow: c.weatherTomorrow, season: c.season, residents, objects, reservations: reservationsFor(w), habits };
      const out = plan.planBand(input);
      bands.push({ input, out, lifeDay, band: w.band });
      residents = out.residents; objects = out.objects;
    }
  }
  return bands;
}

test('상태 규칙(§7-1): 기상은 기운 max(지금, 80)·어울림은 60과의 가운데, 할 일은 이어 가고 원형 변화는 위아래 상한 안', async () => {
  const s = await townModule('state'), plan = await townModule('plan');
  const cafe = plan.RESIDENT_BY_ID['cafe-owner'], workshop = plan.RESIDENT_BY_ID['workshop-owner'];
  assert.deepEqual(s.wake(cafe, { energy: 30, social: 20, chores: 3, choresTick: 0 }, { atMs: 0 }).state, { energy: 80, social: 40, chores: 3, choresTick: 0 });
  assert.deepEqual(s.wake(cafe, { energy: 95, social: 100, chores: 0, choresTick: 1 }, { atMs: 0 }).state, { energy: 95, social: 80, chores: 0, choresTick: 1 });
  assert.deepEqual(s.stateOf(workshop, { recent: [] }), { energy: 80, chores: 0, social: 60, choresTick: 0 }, '옛 세계의 빈 칸은 기상 값');
  const A = id => plan.ARCHETYPE_BY_ID[id];
  const st = s.running(workshop, { energy: 3, chores: 2, social: 99, choresTick: 0 }), log = [];
  s.finishSegment(st, A('craft'), { atMs: 1 }, log);
  assert.deepEqual([st.energy, st.chores, st.choresTick], [0, 2, 1], '기운은 0 아래로 안 가고, 주문 작업은 두 번째에 할 일 −1');
  s.finishSegment(st, A('craft'), { atMs: 2 }, log);
  assert.deepEqual([st.chores, st.choresTick], [1, 0]);
  s.finishSegment(st, A('fix-round'), { atMs: 3 }, log);
  assert.equal(st.social, 100, '어울림은 100에서 멈춘다');
  const guests = s.running(cafe, { energy: 80, chores: 5, social: 0, choresTick: 0 }), glog = [];
  for (let i = 0; i < 8; i++) s.finishSegment(guests, A('serve'), { atMs: i }, glog);
  assert.equal(guests.social, 10, '손님 맞기의 어울림은 구간당 +10까지');
  assert.equal(guests.chores, 0);
  assert.ok(glog.every(e => e.cause === 'routine'));
});

test('할 일(§7-1): 찻집 손님은 구간마다 1~2번 몰려오고, 공방 주문은 낮 구간 시작에 · 맞을 손님·할 주문이 없으면 그 일은 못 한다', async () => {
  const s = await townModule('state'), plan = await townModule('plan'), { paramsFor } = await townModule('params');
  const P = paramsFor().state, cafe = plan.RESIDENT_BY_ID['cafe-owner'], workshop = plan.RESIDENT_BY_ID['workshop-owner'];
  const window = { fromMs: NOON, toMs: NOON + 5 * HOUR, bandStartMs: NOON - HOUR, bandEndMs: NOON + 5 * HOUR };
  for (let lifeDay = 20740; lifeDay < 20754; lifeDay++) {
    for (const band of ['morning', 'day', 'evening', 'night']) {
      const events = s.bandEvents(cafe, { seed: 'v1', lifeDay, band, window }), total = events.reduce((n, e) => n + e.count, 0);
      const range = P.cafeGuests[(await townModule('clock')).dayKindOf(lifeDay) === 'weekend' ? 'weekend' : 'weekday'];
      assert.ok(total >= Math.floor(range[0] * P.cafeGuests.bandShare[band] / 1000) && total <= Math.floor(range[1] * P.cafeGuests.bandShare[band] / 1000), `${lifeDay} ${band} ${total}`);
      assert.ok(events.length <= P.cafeGuests.rushes[1] && events.every(e => e.type === 'guests' && e.atMs >= window.fromMs && e.atMs < window.toMs));
      assert.deepEqual(s.bandEvents(cafe, { seed: 'v1', lifeDay, band, window }), events, '같은 마을·같은 날·같은 구간이면 같다');
      const orders = s.bandEvents(workshop, { seed: 'v1', lifeDay, band, window });
      if (band !== 'day') assert.deepEqual(orders, [], '주문은 낮 구간에만');
      else assert.ok(orders.every(e => e.type === 'orders' && e.atMs === window.fromMs && e.count > 0));
    }
  }
  const bigDays = Array.from({ length: 70 }, (_, i) => 20741 + i).filter(d => s.bigOrderOn('v1', d));
  assert.equal(bigDays.length, 10, '큰 주문은 주에 한 번');
  assert.equal(s.available(plan.ARCHETYPE_BY_ID.serve, { chores: 0 }), false);
  assert.equal(s.available(plan.ARCHETYPE_BY_ID.serve, { chores: 1 }), true);
  assert.equal(s.available(plan.ARCHETYPE_BY_ID.craft, { chores: 0 }), false);
  assert.equal(s.available(plan.ARCHETYPE_BY_ID['tool-care'], { chores: 0 }), true);
});

test('G4: 플레이어 원인의 변화는 좋은 쪽뿐 · 결과 없이 닫힌 붙잡힘엔 플레이어 원인이 없다 · 붙잡힌 동안 온 손님은 기다리지 않는다', async () => {
  const s = await townModule('state');
  let together = 0, absorbedChecked = 0;
  for (const seed of ['g4-a', 'g4-b', 'g4-c']) {
    // 낮과 저녁마다 찻집 주인·연구원을 한 시간 붙잡는다 — 마을 씨앗에 따라 결과에 닿은(with) 것과 아닌 것.
    const bands = await villageDays({ seed, days: 10, habits: { 'workshop-owner': [{ spot: 'cafe.eaves-left', archetype: 'quiet-rest' }, { spot: 'workshop.bench', archetype: 'tool-care' }] },
      reservationsFor: w => (w.band === 'day' || w.band === 'evening' ? ['cafe-owner', 'researcher'].map((npc, i) => ({ id: `R-${w.startMs}-${npc}`, npc,
        fromMs: w.startMs + HOUR * (1 + i), toMs: w.startMs + HOUR * (2 + i), spot: npc === 'cafe-owner' ? 'cafe.counter' : 'cafe.front',
        ...((w.startMs / HOUR) % 3 === 0 ? {} : { with: true, ...(npc === 'cafe-owner' ? { help: 2 } : {}) }) })) : []) });
    for (const { input, out } of bands) {
      for (const e of out.stateLog) {
        if (s.PLAYER_CAUSES.includes(e.cause)) assert.ok(!s.worse(e.stat, e.delta), `플레이어 원인 나쁜 쪽: ${JSON.stringify(e)}`);
        if (e.cause === 'together') together++;
      }
      const withless = input.reservations.filter(r => !r.with).map(r => r.npc);
      for (const npc of withless) if (!input.reservations.some(r => r.npc === npc && r.with))
        assert.ok(!out.stateLog.some(e => e.npc === npc && ['together', 'help'].includes(e.cause)), '결과 없는 붙잡힘은 아무것도 바꾸지 않는다');
      for (const hold of out.segments.filter(x => x.archetype === 'reserved' && x.npc === 'cafe-owner')) {
        assert.ok(!out.stateLog.some(e => e.cause === 'guest' && e.npc === 'cafe-owner' && e.atMs >= hold.startMs && e.atMs < hold.endMs), '붙잡힌 동안 손님은 기다리지 않는다');
        absorbedChecked++;
      }
      for (const npc of new Set(out.segments.filter(x => x.archetype === 'reserved').map(x => x.npc)))
        assert.ok(!out.stateLog.some(e => e.npc === npc && e.cause === 'alone'), '붙잡힌 구간은 혼자 보낸 구간이 아니다');
      assert.equal(out.stateLog.filter(e => e.cause === 'together').length, new Set(out.stateLog.filter(e => e.cause === 'together').map(e => e.npc)).size, '함께한 일의 어울림은 구간당 한 번');
    }
  }
  assert.ok(together > 0 && absorbedChecked > 0, '시험이 실제로 그 길을 지났다');
  const st = s.running({ id: 'workshop-owner' }, { energy: 50, chores: 0, social: 50, choresTick: 0 }), log = [];
  s.finishSegment(st, (await townModule('plan')).ARCHETYPE_BY_ID['tool-care'], { atMs: 0, playerMade: true }, log);
  assert.equal(st.energy, 50, '플레이어가 만든 습관 자리의 일은 기운을 깎지 않는다');
});

test('G4: 함께한 일은 그 주민에게만 — 다른 주민의 계획은 그대로이고, 구간 끝 정각에 끝난 붙잡힘도 그 구간이 센다(검수 GA1·GA2)', async () => {
  const plan = await townModule('plan');
  let compared = 0;
  for (const { input, out } of await villageDays({ seed: 'with-only-mine', days: 3 })) {
    if (input.band !== 'day') continue;
    // 찻집 주인을 구간 끝 정각까지 붙잡는다 — 결과 없는 붙잡힘과 결과에 닿은 붙잡힘(도움 2).
    // 효과가 상한에 막히지 않게(어울림 100·할 일 0이면 +15·−2가 변화 0이라 기록도 없다) 낮은 어울림·남은 손님으로 시작한다.
    const residents = { ...input.residents, 'cafe-owner': { ...input.residents['cafe-owner'], social: 20, chores: 5 } };
    const others = r => r.segments.filter(x => x.npc !== 'cafe-owner');
    // 구간 가운데에서 끝난 붙잡힘(GA2): 그 뒤로도 결정이 이어져, 함께한 일이 첫 계획에 새면 다른 주민 조각이 바뀐다.
    for (const hold of [{ id: 'R-mid', npc: 'cafe-owner', fromMs: input.startMs + HOUR, toMs: input.startMs + 2 * HOUR, spot: 'cafe.counter' },
      { id: 'R-end', npc: 'cafe-owner', fromMs: input.endMs - 2 * HOUR, toMs: input.endMs, spot: 'cafe.counter' }]) {
      const plain = plan.planBand({ ...input, residents, reservations: [hold] }), done = plan.planBand({ ...input, residents, reservations: [{ ...hold, with: true, help: 2 }] });
      assert.deepEqual(others(done), others(plain), `다른 주민의 하루는 함께한 일과 상관없다(${hold.id})`);
      const gains = done.stateLog.filter(e => e.npc === 'cafe-owner' && ['together', 'help'].includes(e.cause));
      assert.ok(gains.some(e => e.cause === 'together' && e.atMs === hold.toMs), `붙잡힘이 끝난 때에 센다 — 구간 끝 정각도(${hold.id})`);
      assert.ok(!plain.stateLog.some(e => ['together', 'help'].includes(e.cause)));
      if (hold.id === 'R-mid') assert.notDeepEqual(done.segments.filter(x => x.npc === 'cafe-owner'), plain.segments.filter(x => x.npc === 'cafe-owner').map(x => x), '그 주민의 남은 하루는 함께한 일을 안다');
    }
    void out; compared++;
  }
  assert.ok(compared >= 3);
  // 검수 GA2 재현 조건 그대로: 이 마을에서 함께한 일이 첫 계획에 새면 연구원의 그림 펼치기 자리가 바뀐다.
  const v = await townModule('village'), village = v.initialVillage(), open = Date.UTC(2026, 9, 23, 3, 0);
  v.closeBands(village, { nowMs: open, seed: 'check-7', offsetMin: 540, revision: 0 });
  const input = v.bandInput(village), hold = { id: 'R-1', npc: 'cafe-owner', fromMs: open, toMs: open + HOUR, spot: 'cafe.counter' };
  const plain = plan.planBand({ ...input, reservations: [hold] }), done = plan.planBand({ ...input, reservations: [{ ...hold, with: true, help: 2 }] });
  assert.deepEqual(done.segments.filter(x => x.npc !== 'cafe-owner'), plain.segments.filter(x => x.npc !== 'cafe-owner'), 'check-7: 다른 주민은 그대로');
  assert.notDeepEqual(done.segments.filter(x => x.npc === 'cafe-owner'), plain.segments.filter(x => x.npc === 'cafe-owner'), 'check-7: 찻집 주인의 남은 하루만 달라진다');
});

test('G4: 장면이 결과에 닿은 붙잡힘만 「함께한 일」 — 결과가 난 걸음에서 표시하고, 그 붙잡힘이 끝난 구간이 한 번 센다', async () => {
  const { createStore } = await townFile('server.mjs'), village = await townModule('village');
  let now = NOON, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-1' });
  const pulse = (ms = 0) => { now += ms; receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; };
  const send = (type, payload = {}) => store.execute({ id: `state-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { ...(/^DAY_/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  const tick = ms => { for (let left = ms; left > 0; left -= 1000) pulse(Math.min(1000, left)); };
  pulse();
  send('DAY_MOVE', { location: 'greenhouse' }); if (store.read().state.day.home.exitTarget) send('DAY_EXIT');
  // 결과 없이 닫은 장면: 붙잡았다 놓았을 뿐 — 함께한 일이 아니다.
  send('DAY_START', { kind: 'coordination' }); send('DAY_CLOSE');
  assert.ok(store.read().state.village.reservations.every(r => !r.with), '결과 없이 닫힘');
  send('DAY_RESUME'); send('DAY_ROLE', { role: 'planner' }); send('DAY_CHOICE', { choice: 'silent' });
  tick(2000); send('DAY_CONTINUE'); send('DAY_CONFIRM'); tick(4000);
  // 결과는 걸음(U)에서 난다: 명령 없이 읽기만 해도 열린 붙잡힘에 표시가 있다(검토 P1-1).
  let v = store.read().state.village;
  const marked = v.reservations.filter(r => r.with);
  assert.deepEqual(marked.map(r => r.npc).sort(), ['researcher', 'workshop-owner'], JSON.stringify(v.reservations));
  assert.ok(marked.every(r => r.toMs === null && r.help === undefined), '찻집 일이 아니라 도움 몫은 없다');
  send('DAY_CLOSE');
  v = store.read().state.village;
  const plan = village.planOf(v);
  const gains = plan.stateLog.filter(e => e.cause === 'together');
  assert.deepEqual(gains.map(e => e.npc).sort(), ['researcher', 'workshop-owner']);
  assert.ok(gains.every(e => e.delta > 0 && e.atMs === v.reservations.find(r => r.npc === e.npc && r.with).toMs), '붙잡힘이 끝난 때에 한 번');
});

test('마음 귀속(§6-4·§7-3): 갈릴 때만 · 기본 것이 작아진 경우 · 우선순위대로 행동과 맞는 첫 이유 · 이웃 이유는 줄이 없다', async () => {
  const plan = await townModule('plan'), R = plan.RESIDENT_BY_ID;
  const pick = (archetype, spot, ...factors) => ({ item: { archetype, spot }, factors: factors.map(([kind, key, dir]) => ({ kind, key, dir })) });
  const why = (npc, chosen, base, band = 'day') => plan.moodReason(R[npc], chosen, base, band);
  // 같으면 배수가 붙었어도 마음이 아니다(지금까지는 이유가 늘 실렸다).
  assert.equal(why('workshop-owner', pick('tool-care', 'workshop.bench', ['weather', 'cold-hands', 'down']), pick('tool-care', 'workshop.bench', ['weather', 'cold-hands', 'down']), 'morning'), null);
  // 기본 것(쉼)이 바빠서 작아져 손님 맞기를 골랐다.
  assert.equal(why('cafe-owner', pick('serve', 'cafe.seats'), pick('eaves-tea', 'cafe.eaves', ['work', 'busy', 'down'])), 'busy');
  // 지쳐서 처마에 앉았다 — 고른 것이 커졌다.
  assert.equal(why('cafe-owner', pick('eaves-tea', 'cafe.eaves', ['body', 'tired', 'up']), pick('brew', 'cafe.counter', ['body', 'tired', 'down'])), 'rest-poor');
  // 지친 채 처마가 아닌 다른 일을 골랐으면 「좀 앉을게요」는 행동과 어긋난다 — 줄 없음.
  assert.equal(why('cafe-owner', pick('wipe', 'cafe.seats', ['body', 'tired', 'down']), pick('brew', 'cafe.counter', ['body', 'tired', 'down'])), null);
  // 비 오는 아침에 지친 공방 주인: 쉼을 골랐으면 날씨(손이 차서)는 행동과 안 맞아 몸(힘들어서)이 이유(검토 P2-1).
  assert.equal(why('workshop-owner', pick('quiet-rest', 'workshop.rest', ['body', 'tired', 'up']), pick('tool-care', 'workshop.bench', ['weather', 'cold-hands', 'down'], ['body', 'tired', 'down']), 'morning'), 'low-energy');
  // 걷기로 바꿨으면 날씨가 먼저다.
  assert.equal(why('workshop-owner', pick('stroll', 'lane.mid'), pick('tool-care', 'workshop.bench', ['weather', 'cold-hands', 'down'], ['body', 'tired', 'down']), 'morning'), 'cold-hands');
  // 바쁨 — 점심 무렵(낮)만.
  assert.equal(why('workshop-owner', pick('craft', 'workshop.bench'), pick('breeze-lunch', 'workshop.door', ['work', 'busy', 'down']), 'day'), 'busy-orders');
  assert.equal(why('workshop-owner', pick('craft', 'workshop.bench'), pick('quiet-rest', 'workshop.rest', ['work', 'busy', 'down']), 'evening'), null);
  // 남의 점수가 바뀌어 u 자리가 밀린 것은 마음이 아니다.
  assert.equal(why('cafe-owner', pick('wipe', 'cafe.seats'), pick('brew', 'cafe.counter')), null);
  // 외로움(이웃)은 줄이 없다 — 행동만.
  assert.equal(why('cafe-owner', pick('deliver-tea', 'workshop.door', ['neighbour', 'lonely', 'up']), pick('prep-cups', 'cafe.prep')), null);
  // 비가 자리를 처마로 옮겼다(같은 원형) — 찻집 주인은 손목, 연구원은 그 이유의 줄이 없다.
  assert.equal(why('cafe-owner', pick('wipe', 'cafe.eaves', ['weather', 'rain', 'moved']), pick('wipe', 'cafe.outside')), 'rain-wrist');
  assert.equal(why('researcher', pick('observe', 'cafe.eaves', ['weather', 'rain', 'moved']), pick('observe', 'cafe.front')), null);
  // 지친 연구원: 기록 쓰기면 줄, 졸기는 밤샘 이유(W5)라 아직 없음.
  assert.equal(why('researcher', pick('notes', 'greenhouse.bench', ['body', 'tired', 'up']), pick('water', 'greenhouse.bed', ['body', 'tired', 'down'])), 'low-energy');
  assert.equal(why('researcher', pick('doze', 'greenhouse.bench', ['body', 'doze', 'added']), pick('water', 'greenhouse.bed', ['body', 'tired', 'down'])), null);
  // 더한 후보는 기본 쪽에 없으니 고른 것이 그것이면 갈렸다.
  assert.equal(why('cafe-owner', pick('eaves-tea', 'cafe.eaves', ['weather', 'first-aroma', 'added']), pick('prep-cups', 'cafe.prep'), 'morning'), 'first-aroma');
  assert.equal(why('cafe-owner', pick('eaves-tea', 'cafe.eaves', ['weather', 'first-aroma', 'added']), null, 'morning'), 'first-aroma', '기본 쪽에 할 것이 없을 때');
});

test('마음 한 줄: 원고가 있는 이유만 · 주민·이유·생활일마다 한 번 · 하루 넷 · 자는 동안·붙잡힘·약속엔 없다 · 구간을 넘어 이어 셈', async () => {
  const { MOOD_LINES } = await townModule('data.gen'), plan = await townModule('plan');
  const lines = new Set(MOOD_LINES.map(l => l.id)), { paramsFor } = await townModule('params');
  let moods = 0;
  for (const seed of ['mood-a', 'mood-b', 'mood-c', 'mood-d']) {
    const bands = await villageDays({ seed, days: 30 });
    const shown = new Map();
    for (const { input, out, lifeDay } of bands) {
      for (const seg of out.segments) {
        if (!seg.reason) { assert.equal(seg.mood, undefined); continue; }
        assert.ok(plan.RESIDENT_BY_ID[seg.npc].moods.some(m => m.tag === seg.reason), `주민 마음 표의 이유: ${seg.npc} ${seg.reason}`);
        assert.ok(!['reserved', 'pause'].includes(seg.archetype) && seg.cause !== 'promise');
        if (!seg.mood) continue;
        moods++;
        assert.equal(seg.mood, `${seg.npc}.mood.${seg.reason}.1`);
        assert.ok(lines.has(seg.mood), seg.mood);
        const key = `${seg.npc}|${lifeDay}`, today = shown.get(key) || [];
        assert.ok(!today.includes(seg.reason), `하루 한 번: ${key} ${seg.reason}`);
        shown.set(key, [...today, seg.reason]);
        const { wakeMs, sleepMs } = plan.awakeWindow(seg.npc, input.lifeDay, input.dayStartMs);
        assert.ok(seg.startMs >= wakeMs && seg.startMs < sleepMs, '깨어 있을 때만');
      }
      for (const [npc, r] of Object.entries(out.residents)) assert.ok(r.moodsToday.length <= paramsFor().state.moodLinesPerDay, `${npc} 하루 넷`);
    }
    for (const list of shown.values()) assert.ok(list.length <= paramsFor().state.moodLinesPerDay);
  }
  assert.ok(moods > 50, `줄이 실제로 뜬다: ${moods}`);
});

test('마음 한 줄: 붙잡힘 뒤 다시 짜도 그 생활일에 같은 이유는 한 번 · 합친 조각은 이유가 같을 때만', async () => {
  const plan = await townModule('plan');
  let replans = 0;
  for (const seed of ['again-a', 'again-b', 'again-c', 'again-d', 'again-e']) {
    for (const { input, out } of await villageDays({ seed, days: 6 })) {
      const first = out.segments.find(x => x.mood && x.npc === 'cafe-owner');
      if (first) {
        // 줄이 뜬 조각이 시작된 뒤 붙잡았다가 놓으면 그 주민만 다시 짠다 — 같은 이유의 줄이 또 뜨지 않는다.
        const hold = { id: 'R-again', npc: 'cafe-owner', fromMs: first.startMs + MIN, toMs: first.startMs + 20 * MIN, spot: 'cafe.counter' };
        const again = plan.planBand({ ...input, reservations: [hold] });
        const mine = again.segments.filter(x => x.npc === 'cafe-owner');
        assert.ok(mine.some(x => x.startMs === first.startMs && x.mood === first.mood), '붙잡히기 전 조각의 줄은 그대로');
        assert.equal(mine.filter(x => x.reason === first.reason && x.mood).length, 1, `같은 이유는 한 번: ${first.reason}`);
        assert.ok(again.residents['cafe-owner'].moodsToday.includes(first.reason));
        replans++;
      }
      for (const npc of plan.RESIDENT_IDS) {
        const mine = out.segments.filter(x => x.npc === npc);
        for (let i = 1; i < mine.length; i++) {
          const a = mine[i - 1], b = mine[i];
          if (a.endMs === b.startMs && a.archetype === b.archetype && a.spot === b.spot && a.cause === b.cause && !!a.habit === !!b.habit)
            assert.notEqual(a.reason ?? null, b.reason ?? null, '같은 이유로 잇는 일은 한 조각');
        }
        for (const x of mine.filter(y => y.pieceStarts)) assert.ok(x.pieceStarts.every((t, i) => t >= x.startMs && t < x.endMs && (i === 0 || t > x.pieceStarts[i - 1])));
      }
    }
  }
  assert.ok(replans > 3, `다시 짜기를 실제로 봤다: ${replans}`);
});

test('상태는 계획기와 닫기가 같은 걸음으로 정한다 — 구간 시작 + 변화 기록 = 다음 구간 시작, 같은 입력이면 같은 계획', async () => {
  const plan = await townModule('plan');
  const bands = await villageDays({ seed: 'replay-a', days: 4, reservationsFor: w => (w.band === 'day' ? [{ id: 'R-day', npc: 'workshop-owner', fromMs: w.startMs + HOUR, toMs: w.startMs + 2 * HOUR, spot: 'workshop.bench', with: true }] : []) });
  for (const { input, out } of bands) {
    for (const npc of plan.RESIDENT_IDS) {
      const start = input.residents[npc] || {}, end = out.residents[npc];
      for (const stat of ['energy', 'chores', 'social']) {
        const delta = out.stateLog.filter(e => e.npc === npc && e.stat === stat).reduce((n, e) => n + e.delta, 0);
        assert.equal((start[stat] ?? { energy: 80, chores: 0, social: 60 }[stat]) + delta, end[stat], `${npc} ${stat}`);
      }
    }
    assert.deepEqual(plan.planBand(input), out);
  }
});

test('옛 세계: 상태 칸이 없는 마을도 그대로 받고(마이그레이션 없음), 다음 구간부터 칸이 채워진다', async () => {
  const v = await townModule('village');
  const village = v.initialVillage();
  v.closeBands(village, { nowMs: NOON, seed: 'acct-old', offsetMin: 540, revision: 1 });
  v.closeBands(village, { nowMs: NOON + 6 * HOUR, seed: 'acct-old', offsetMin: 540, revision: 1 });
  for (const r of Object.values(village.band.residents)) { delete r.energy; delete r.chores; delete r.social; delete r.choresTick; delete r.moodsToday; }
  assert.equal(v.validVillage(village), true, '옛 꼴 그대로');
  v.closeBands(village, { nowMs: NOON + 12 * HOUR, seed: 'acct-old', offsetMin: 540, revision: 1 });
  assert.equal(v.validVillage(village), true);
  for (const r of Object.values(village.band.residents)) assert.ok(['energy', 'chores', 'social', 'choresTick', 'moodsToday'].every(k => k in r), JSON.stringify(r));
  const bad = structuredClone(village);
  Object.values(bad.band.residents)[0].moodsToday = ['tea-received'];
  assert.equal(v.validVillage(bad), false, '그 주민 마음 표에 없는 이유');
  const over = structuredClone(village);
  over.band.residents['cafe-owner'].chores = 9;
  assert.equal(v.validVillage(over), false, '할 일 상한');
  const withless = structuredClone(village);
  withless.reservations = [{ id: 'R-1', npc: 'cafe-owner', fromMs: NOON, toMs: null, by: 'x', spot: 'cafe.counter', help: 2 }];
  assert.equal(v.validVillage(withless), false, 'help는 함께한 일에만');
});

test('뷰(G2): 조각에는 마음 줄의 원고 ID만 실리고 상태 숫자는 없다 · 그날 기분은 상태에서 온다', async () => {
  const { createStore } = await townFile('server.mjs'), s = await townModule('state'), plan = await townModule('plan');
  let now = NOON;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-view' });
  store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true });
  const scene = store.read().view.day.scene.village;
  const text = JSON.stringify(scene);
  for (const word of ['"energy"', '"chores"', '"social"', '"choresTick"', '"moodsToday"', '"reason"']) assert.ok(!text.includes(word), word);
  for (const seg of scene.segments) assert.deepEqual(Object.keys(seg).filter(k => !['npc', 'startMs', 'arriveMs', 'endMs', 'archetype', 'spot', 'mood'].includes(k)), []);
  const cafe = plan.RESIDENT_BY_ID['cafe-owner'];
  assert.equal(s.dayMoodOf(cafe, { energy: 80, chores: 4 }), 'busy');
  assert.equal(s.dayMoodOf(cafe, { energy: 20, chores: 0 }), 'sleepy');
  assert.equal(s.dayMoodOf(cafe, { energy: 80, chores: 0 }, ['first-aroma']), 'glad');
  assert.equal(s.dayMoodOf(cafe, { energy: 80, chores: 0 }, ['rain-wrist']), null);
});
