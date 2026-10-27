'use strict';
// 싱크타운 W6(세로 조각 설계 §10·§15-2·§15-3·§20-3·§20-4) — 부재 따라잡기와 습관, 묻기, 평가 신호 방문 요약.
// 7일을 넘는 부재는 그 앞을 계획하지 않고 주민을 생활일 시작 기본값에서 시작한다. 「그동안 달라진 것」은 지난 방문 뒤 닫힌 구간의
// 주민 일만 한 줄씩. 접속 구간 고리는 생활일마다 첫 방문 구간 하나이고, 앞 생활일만 세어 밤·아침의 자리를 더 채우며 그 조각은
// 기운을 나쁘게 바꾸지 않는다(G4). 방문의 시작은 맥박이 본 시각이라 결산을 언제 하든 같은 방문·판·회차다(§15-3).
// 마스코트는 생활일에 한 번, 취향 확인 다음 동의 순으로 묻고, 평가 신호 줄은 동의한 방문만 서버가 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { townModule, toolModule, ROOT } = require('./lib/town.js');

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOON = Date.UTC(2026, 9, 23, 3, 0, 0); // 2026-10-23(금) 12:00 KST
const TZ = [{ fromMs: 0, offsetMin: 540 }];
const coreModule = () => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'core.mjs')).href);
const server = () => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'server.mjs')).href);

function harness(createStore, store = {}) {
  let now = NOON, sequence = 0, receipt;
  const s = createStore({ now: () => now, tz: 540, villageSeed: 'acct-w6', ...store });
  const h = {
    store: s, get now() { return now; }, set(ms) { now = ms; },
    pulse(ms = 0) { now += ms; receipt = s.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; return receipt; },
    play(seconds) { for (let i = 0; i < seconds; i++) h.pulse(1000); },
    boundary(extra = {}) { return s.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence, ...extra }); },
    send(type, payload = {}) {
      return s.execute({ id: `w6-${++sequence}`, type, expectedRevision: s.read().state.revision,
        payload: { ...(/^(DAY_|LIFE_|CARD_|GREET$)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
    },
    read: () => s.read(),
  };
  return h;
}

test('접속 구간 고리 — 생활일마다 첫 방문 하나, 앞 생활일 세 번·60%부터, 밤·아침만, 끄면 비우고 켜면 빈 고리에서', async () => {
  const { initialVisitBands, writeBand, habitOf, setVisitBands, clearVisitBands, validVisitBands } = await townModule('visits');
  let vb = initialVisitBands();
  for (const [day, band] of [[100, 'night'], [100, 'day'], [101, 'night'], [103, 'night']]) vb = writeBand(vb, day, band);
  const at = d => vb.ring[d % vb.ring.length];
  assert.equal(at(100), 'night', '그날 첫 방문 구간만 남는다');
  assert.equal(at(102), null, '오지 않은 생활일은 빈칸');
  assert.equal(habitOf(vb, 103), null, '그날 칸은 그날 계획에 세지 않는다 — 앞 생활일 밤 둘');
  assert.equal(habitOf(vb, 104), 'night', '앞 생활일 밤 셋 · 100%');
  for (const day of [104, 105, 106]) vb = writeBand(vb, day, 'day');
  assert.equal(habitOf(vb, 107), null, '밤 셋 / 여섯은 60%가 안 된다');
  let days = initialVisitBands();
  for (let d = 0; d < 5; d++) days = writeBand(days, 200 + d, 'day');
  assert.equal(habitOf(days, 205), null, '낮 습관은 일과를 바꾸지 않으니 습관으로 두지 않는다');
  assert.equal(habitOf(writeBand(vb, 140, 'night'), 141), null, '30생활일 넘게 떨어지면 판정 창 밖');
  // 오늘을 쓰는 것이 오늘 계획에 쓰는 앞 30생활일을 지우지 않는다(GPT A2): 100·128·129 밤 → 130의 판정은 쓰기 전후가 같다.
  let edge = initialVisitBands();
  for (const d of [100, 128, 129]) edge = writeBand(edge, d, 'night');
  assert.equal(habitOf(edge, 130), 'night');
  assert.equal(habitOf(writeBand(edge, 130, 'day'), 130), 'night', '오늘 칸을 써도 오늘 판정은 그대로');
  assert.equal(habitOf(writeBand(edge, 135, 'day'), 129), habitOf(edge, 129), '따라잡는 앞 생활일의 판정도 그대로');
  const off = setVisitBands(vb, false);
  assert.deepEqual(off.ring.filter(Boolean), [], '끄면 그 자리에서 비운다');
  assert.equal(writeBand(off, 150, 'night'), off, '끈 동안 쌓지 않는다');
  assert.equal(habitOf(off, 108), null);
  assert.equal(setVisitBands(off, true).off, false);
  assert.equal(clearVisitBands(off).off, true, '맞춤 기록 비우기는 끈 설정을 남긴다');
  for (const x of [vb, off, clearVisitBands(vb)]) assert.ok(validVisitBands(x));
  assert.equal(validVisitBands({ ...vb, ring: vb.ring.slice(1) }), false, '고리 크기는 고정');
  assert.equal(/\d{10,}/.test(JSON.stringify(vb)), false, '시각 원문이 없다(G7)');
});

test('7일 결산 — 7일을 넘는 부재는 now − 7일이 든 구간부터 계획하고(그 앞 0), 주민은 생활일 시작 기본값에서 시작한다(R9)', async () => {
  const village = await townModule('village'), { paramsFor } = await townModule('params');
  const p = paramsFor();
  assert.deepEqual([p.state.wakeEnergy, p.absence.chores, p.state.socialRest], [80, 1, 60], '설계 §10-1의 기본값');
  for (const r of Object.values(village.absenceResidents())) {
    assert.deepEqual(r, { recent: [], placesToday: [], lastSpot: null, firstOfDay: true, energy: 80, chores: 1, social: 60, choresTick: 0 });
  }
  const v = village.initialVillage();
  village.closeBands(v, { nowMs: NOON, seed: 'acct-w6', offsetMin: 540, revision: 0 });
  const firstEnd = v.band.endMs, now = firstEnd + 9 * DAY;
  village.closeBands(v, { nowMs: now, seed: 'acct-w6', offsetMin: 540, revision: 0 });
  assert.ok(village.validVillage(v));
  const skipped = c => c.bandEnd > firstEnd && c.bandEnd <= now - 7 * DAY;
  assert.ok((v.changes || []).every(c => !skipped(c)) && (v.happened || []).every(e => e.atMs <= firstEnd || e.atMs > now - 7 * DAY - 6 * HOUR),
    '첫 구간 다음부터 now − 7일 앞까지는 계획도 결과도 없다');
  assert.ok((v.happened || []).some(e => e.atMs > now - 7 * DAY - 6 * HOUR), '자른 뒤 7일은 그대로 산다');
});

test('그동안 달라진 것 — 지난 방문 뒤 닫힌 구간의 주민 일만, 흔적 > 습관 > 쌍, 주민 한 명당 한 줄, 흔적은 주민의 것이 지금 보일 때만', async () => {
  const { meanwhileLines, bandChanges, lineId, FRAMES } = await townModule('meanwhile');
  const { CHANGE_FRAMES } = await toolModule('town-data-build');
  assert.deepEqual([...FRAMES], [...CHANGE_FRAMES], '틀 목록은 생성 도구와 같다');
  const visit = { startAt: 10_000, since: 1_000 };
  const ch = (kind, frame, actors, at, extra = {}) => ({ kind, frame, actors, at, bandEnd: 9_000, ...extra });
  const tray = ch('trace', 'tray', ['cafe-owner', 'workshop-owner'], 4_000, { card: 'C1', ref: '1.day.C1', object: 'cafe-tray', field: 'shim' });
  const board = ch('trace', 'board', ['researcher'], 3_000, { card: 'R4', ref: '1.night.R4', object: 'observation-board', field: 'night' });
  const changes = [
    ch('pair', 'pair', ['cafe-owner', 'workshop-owner'], 5_000, { pair: 'cafe-owner|workshop-owner' }),
    ch('habit', 'habit', ['workshop-owner'], 6_000, { spot: 'cafe.garden' }), tray, board,
    { ...board, at: 500, ref: '0.night.R4' },
    ch('habit', 'habit', ['researcher'], 9_500, { spot: 'cafe.garden', bandEnd: 12_000 }),
  ];
  const standing = { 'cafe-tray': { shim: { value: 'cork', path: 'pair' } }, 'observation-board': { night: { value: 'bloom', path: 'self' } } };
  const lines = meanwhileLines(changes, visit, standing);
  assert.deepEqual(lines.map(l => l.id), [lineId('tray'), lineId('board')], '흔적 먼저, 이미 한 줄을 얻은 주민의 습관·쌍은 빠짐');
  assert.equal(lines[0].npc, 'workshop-owner', '받침은 맞춰 준 주민(둘이 길의 짝)의 줄');
  assert.deepEqual(meanwhileLines(changes, { ...visit, since: null }, standing), [], '첫 방문에는 없다');
  const byPlayer = { ...standing, 'cafe-tray': { shim: { value: 'cork', path: 'player' } } };
  assert.deepEqual(meanwhileLines(changes, visit, byPlayer).map(l => l.id), [lineId('board'), lineId('habit')], '내가 바꾼 흔적은 주민의 일로 말하지 않는다');
  assert.deepEqual(meanwhileLines(changes, visit, {}).map(l => l.id), [lineId('habit')], '흔적이 사라지면 그 줄도 없고, 습관을 얻은 공방 주인의 쌍 줄은 빠진다');
  assert.ok(meanwhileLines(changes, visit, standing).length <= 3);
  const cardOf = id => ({ C1: { trace: { object: 'cafe-tray', field: 'shim' } } })[id];
  assert.deepEqual(bandChanges({ bandEndMs: 9_000, resolved: [{ ref: '1.day.C1', card: 'C1', path: 'player', public: false, actors: ['cafe-owner', 'player'], atMs: 4_000 }], cardOf }), [],
    '플레이어가 든 일은 남기지 않는다(G6)');
});

test('방문은 맥박이 본 시각으로 — 매초 결산하든 한 번 하든 같은 방문·고리·판·회차, 돌아온 방문에는 그동안 달라진 것(금지 말 없음)', async () => {
  const { createStore } = await server();
  const { FORBIDDEN } = await toolModule('town-lines-check');
  const { TOWN_LINES } = await townModule('data.gen');
  const often = harness(createStore), once = harness(createStore);
  for (const h of [often, once]) h.pulse();
  for (let s = 0; s < 30; s++) { often.pulse(1000); often.read(); once.pulse(1000); }
  const a = often.read().state, b = once.read().state;
  for (const key of ['townVisit', 'visitBands', 'policy']) assert.deepEqual(a[key], b[key], key);
  assert.equal(a.townVisit.startAt, NOON, '방문을 연 맥박의 시각');
  assert.equal(a.townVisit.since, null, '첫 방문');
  assert.match(a.policy.visitId, /^V-[0-9a-z]+$/, '방문 id에 시각 원문이 없다');
  assert.deepEqual(often.read().view.day.scene.village.meanwhile.lines, [], '첫 방문에는 판이 없다');
  // Two days away, then back: the visit before ended 30 minutes after its last play.
  const back = NOON + 2 * DAY + 3 * HOUR;
  for (const h of [often, once]) { h.set(back); h.pulse(); h.play(5); }
  const { state, view } = often.read();
  assert.equal(state.townVisit.startAt, back);
  assert.equal(state.townVisit.since, NOON + 30 * 1000 + 3000, '지난 방문의 마지막 놀이(창의 임대 3초까지)');
  assert.deepEqual(state.townVisit, once.read().state.townVisit);
  const mw = view.day.scene.village.meanwhile;
  assert.equal(mw.visit, back);
  const labels = { 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원' };
  for (const line of mw.lines) {
    const entry = TOWN_LINES.find(e => e.id === line.id);
    assert.ok(entry, line.id);
    for (const text of Object.values(entry.levels)) {
      const filled = text.replace('{npc2}', labels[line.npc2] || '').replace('{npc}', labels[line.npc]);
      assert.ok(FORBIDDEN.every(group => group.patterns.every(re => !re.test(filled))), filled);
    }
  }
  assert.equal(state.visitBands.ring.filter(Boolean).length, 2, '두 생활일의 첫 방문');
  assert.equal(state.village.band.visitHabit, undefined, '낮 방문은 습관 칸을 남기지 않는다');
});

test('밤 습관 — 앞 생활일 밤 셋이면 그 밤에 공방 밤 깎기·연구원 늦은 관찰이 서고, 그 조각은 기운·할 일·어울림을 나쁘게 바꾸지 않는다(G4)', async () => {
  const village = await townModule('village'), { initialVisitBands, writeBand } = await townModule('visits');
  const { bandAt } = await townModule('clock'), { awakeWindow } = await townModule('plan');
  const today = bandAt(TZ, NOON).lifeDay;
  let vb = initialVisitBands();
  for (const d of [3, 2, 1]) vb = writeBand(vb, today - d, 'night');
  let carved = 0, late = 0;
  for (const seed of ['acct-w6-a', 'acct-w6-b', 'acct-w6-c', 'acct-w6-d']) {
    const v = village.initialVillage();
    village.closeBands(v, { nowMs: NOON, seed, offsetMin: 540, revision: 0, visitBands: vb });
    assert.equal(v.band.visitHabit, 'night', '습관은 구간을 열 때 정해진다');
    village.closeBands(v, { nowMs: NOON + 10 * HOUR, seed, offsetMin: 540, revision: 0, visitBands: vb });
    assert.equal(v.band.band, 'night');
    const out = village.planOf(v), usual = npc => awakeWindow(npc, v.band.lifeDay, v.band.dayStartMs);
    carved += out.segments.filter(s => s.npc === 'workshop-owner' && s.archetype === 'night-carve' && s.visitHabit).length;
    late += out.segments.filter(s => s.npc === 'researcher' && s.startMs >= usual('researcher').sleepMs && s.visitHabit).length;
    const worse = out.stateLog.filter(x => x.cause === 'player-routine' && (x.stat === 'chores' ? x.delta > 0 : x.delta < 0));
    assert.deepEqual(worse, [], '플레이어가 만든 일과는 나쁜 쪽으로 바꾸지 않는다');
    assert.ok(out.segments.filter(s => s.startMs >= usual(s.npc).sleepMs || s.startMs < usual(s.npc).wakeMs).every(s => s.visitHabit), '늘어난 시간의 조각은 모두 습관 몫');
  }
  assert.ok(carved > 0 && late > 0, `밤 깎기 ${carved} · 늦은 관찰 ${late}`);
});

test('마스코트 묻기 — 생활일에 한 번, 취향 확인 다음 동의, 그린 뒤에 센다 · 첫 생활일·처음 45초·장면 중·기본 회차의 취향·학원·스위치 끔에는 묻지 않는다', async () => {
  const { createStore } = await server(), core = await coreModule();
  const h = harness(createStore);
  h.pulse(); h.send('DAY_MOVE', { location: 'cafe' }); if (h.read().state.day.home.exitTarget) h.send('DAY_EXIT');
  h.send('CHOOSE', { branch: 'inside' }); h.send('NEXT'); h.send('PLACE', { slot: 'eaves-left' });
  h.play(3); h.read();
  const base = structuredClone(h.store.peek().state), lifeDay = base.village.band.lifeDay;
  assert.equal(base.phase, 'ready');
  const uses = ['C1', 'C2', 'C3', 'C6'].map(card => ({ useId: `20000.day.${card}`, canonicalActivityId: `card.${card}`, storyFamily: 'cafe-life', direct: true }));
  const ready = (edit = s => s) => {
    const s = structuredClone(base);
    // A guest using the new seat is a scene of its own (no question then); here it is over.
    s.recentLifeUse = uses; s.townVisit = { ...s.townVisit, firstDay: lifeDay - 1 }; s.life.uMs = s.life.visitStartU + 60000; s.pendingUse = null;
    return edit(s);
  };
  const ask = { canContact: true, caps: ['asks'], evalSignals: true };
  const close = (s, ctx = ask) => core.closeLiving(s, h.now, { seed: 'acct-w6', offsetMin: 540, ask: ctx });
  const taste = close(ready());
  assert.deepEqual(taste.asks.open, { kind: 'taste', key: 'taste:cafe-life', family: 'cafe-life', lifeDay, delivered: false });
  assert.equal(close(ready(s => { s.townVisit.firstDay = lifeDay; return s; })).asks.open, undefined, '첫 생활일');
  assert.equal(close(ready(s => { s.life.uMs = s.life.visitStartU + 30000; return s; })).asks.open, undefined, '방문 처음 45초');
  assert.equal(close(ready(), { ...ask, caps: ['cards'] }).asks.open, undefined, '그리지 못하는 화면');
  assert.equal(close(ready(s => { s.day.rest = true; return s; })).asks.open, undefined, '쉬는 중');
  assert.equal(close(ready(s => { s.phase = 'place'; return s; })).asks.open, undefined, '자리를 놓는 중');
  assert.equal(close(ready(s => { s.phase = 'choose'; s.placement = null; return s; })).asks.open?.kind, 'taste', '자리를 놓지 않은 플레이어에게도 묻는다(Fable F2)');
  assert.equal(close(ready(s => { s.policy = { ...s.policy, arm: 'baseline' }; return s; })).asks.open, undefined, '기본 회차에는 취향 확인이 없다');
  // Drawn (the screen says so beside a boundary — no command), it counts: the day's one question and 「요즘 자주 한 생활」.
  const run = (s, type, payload) => core.reduceCommand(s, { id: `ask-${type}-${Math.random()}`, type, payload, expectedRevision: s.revision }, { enabled: true, nowMs: h.now, evalSignals: true }).state;
  const drawn = structuredClone(taste);
  assert.equal(core.askDrawn(drawn, 'taste:other'), false, '모르는 물음은 아무것도 바꾸지 않는다');
  assert.equal(core.askDrawn(drawn, 'taste:cafe-life'), true);
  assert.equal(drawn.revision, taste.revision, '그린 보고는 명령 판을 올리지 않는다');
  assert.equal(drawn.asks.lastLifeDay, lifeDay); assert.equal(drawn.prefs.observed, 'cafe-life');
  assert.equal(close(run(drawn, 'ASK_CLOSE', { key: 'taste:cafe-life' })).asks.open, undefined, '그날 묻기는 한 번');
  const no = run(drawn, 'PREF_FAMILY', { family: 'cafe-life', answer: 'no' });
  assert.equal(no.asks.open, undefined); assert.deepEqual(no.prefs.denied, ['cafe-life']);
  // An answer before the drawn report counts the question, and the answer has the last word (W8 r3 GA2) — either order, one result.
  for (const answer of ['no', 'yes']) {
    const early = run(structuredClone(taste), 'PREF_FAMILY', { family: 'cafe-life', answer }), late = run(structuredClone(drawn), 'PREF_FAMILY', { family: 'cafe-life', answer });
    assert.equal(early.asks.open, undefined); assert.equal(early.asks.lastLifeDay, lifeDay, '먼저 온 답도 그날 묻기로 센다');
    assert.deepEqual([early.prefs.observed, early.prefs.denied, early.prefs.preferredFamily], [late.prefs.observed, late.prefs.denied, late.prefs.preferredFamily], `「${answer}」는 그린 보고 앞뒤가 같다`);
    assert.equal(early.prefs.observed, null);
  }
  // An open tea order (W8) is something the player is in: no question during it (r3 GA1).
  const teaOrder = await import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'town', 'activities', 'tea-order.mjs')).href);
  const opened = teaOrder.apply(teaOrder.initial(), { type: 'TEA_OPEN', payload: {} },
    { id: 'T-1', nowMs: h.now, villageSeed: 'acct-w6', lifeDay, band: base.village.band.band, level: 'L2', raining: false, playerSeat: null, busy: () => false }).slot;
  const ordering = ready(s => { s.activities = { ...s.activities, 'tea-order': opened }; return s; });
  assert.ok(ordering.activities['tea-order'].open, '찻집 주문이 열렸다');
  assert.equal(close(ordering).asks.open, undefined, '찻집 주문 중에는 묻지 않는다');
  const later = structuredClone(no); later.asks.lastLifeDay = lifeDay - 30;
  assert.equal(close(later).asks.open, undefined, '「아니요」 뒤에는 시간이 지나도 다시 묻지 않는다');
  // Consent: after something done with a resident, never to an academy account or where the host keeps it off, once.
  const done = s => { s.recentLifeUse = []; s.townVisit.done = true; return s; };
  assert.deepEqual(close(ready(done)).asks.open, { kind: 'consent', key: 'consent', lifeDay, delivered: false });
  assert.equal(close(ready(s => { s.recentLifeUse = []; return s; })).asks.open, undefined, '함께한 일을 마치기 전');
  assert.equal(close(ready(done), { ...ask, academy: true }).asks.open, undefined, '학원 소속');
  assert.equal(close(ready(done), { ...ask, evalSignals: false }).asks.open, undefined, '스위치가 꺼진 호스트');
  // Closed without the drawn report (a person closed what they saw): it counts as drawn, so it is not asked again (Fable F3).
  const skipped = run(core.assertState(close(ready(done))), 'ASK_CLOSE', { key: 'consent' });
  assert.equal(skipped.asks.asked.consent, lifeDay, '닫은 물음도 본 것으로 센다');
  skipped.asks.lastLifeDay = lifeDay - 30;
  assert.equal(close(skipped).asks.open, undefined, '건너뛴 동의는 다시 먼저 묻지 않는다');
  assert.equal(close(ready(done)).asks.open.kind, 'consent');
  assert.equal(firstOf(close(ready(s => { s.townVisit.done = true; return s; }))), 'taste', '같은 날 둘이면 취향 확인이 먼저');
  function firstOf(s) { return s.asks.open?.kind; }
});

test('평가 신호 — 스위치가 꺼진 호스트는 동의도 쓰기도 없고, 켠 호스트는 동의한 방문 줄만(칸은 동의 항목뿐·시각 원문 없음), 철회하면 줄이 0', async () => {
  const { createStore } = await server(), { CONSENT_VER, VISIT_FIELDS } = await townModule('eval');
  const off = harness(createStore, { evalSignals: false });
  off.pulse(); off.play(3);
  assert.throws(() => off.send('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER }), e => e.code === 'eval-unavailable' && e.status === 403);
  off.send('EVAL_CONSENT', { state: 'withdrawn', ver: CONSENT_VER });
  assert.equal(off.store.stats().evalLines, 0);
  assert.equal(off.read().capabilities.evalSignals, false);
  const on = harness(createStore);
  on.pulse(); on.play(3);
  on.send('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER });
  on.play(25); on.boundary();
  const { state } = on.read();
  assert.equal(on.store.stats().evalLines, 1, '동의한 방문의 줄 하나');
  const saved = on.store.peek().state;
  assert.equal(saved.policy.visitId, state.policy.visitId);
  on.send('PREF_TODAY_OTHER', { activity: 'card.C1' });
  assert.equal(on.store.stats().evalLines, 1, '같은 방문은 덮어쓴다');
  on.send('EVAL_CONSENT', { state: 'withdrawn', ver: CONSENT_VER });
  assert.equal(on.store.stats().evalLines, 0, '그만 쓰면 그 자리에서 지운다');
  on.play(25); on.boundary();
  assert.equal(on.store.stats().evalLines, 0, '철회 뒤 쓰기 0');
  assert.ok(VISIT_FIELDS.includes('lengthBucket'));
  const academy = harness(createStore, { academy: true });
  academy.pulse();
  assert.throws(() => academy.send('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER }), e => e.code === 'eval-consent-academy');
});
