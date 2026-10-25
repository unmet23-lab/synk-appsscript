'use strict';
// 싱크타운 작은 필요 카드(세로 조각 설계 §8, W5, 시험 §15-5 town-cards) — 계기 종류, 상한·쿨다운, 마모의 주인(G4), 상태 기계와
// 길 고르기의 결정성, 규칙 H(예약·take와 섞일 때 결과는 최종 조각에서), 반사실(붙잡혀도 남의 하루는 그대로), 옛 세계.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

const MIN = 60000, HOUR = 60 * MIN, TZ = 540, LIFE = 20748;
/** 2026-10-22(목) 생활일의 시작 — 내 시각(한국) 05:00. */
const DAY0 = Date.UTC(2026, 9, 22, 5, 0) - TZ * MIN;
const BANDS = { morning: [0, 6], day: [6, 12], evening: [12, 16], night: [16, 24] };
const input = (id, extra = {}) => ({ villageSeed: 'cards-test', lifeDay: LIFE, band: id, startMs: DAY0 + BANDS[id][0] * HOUR, endMs: DAY0 + BANDS[id][1] * HOUR,
  dayStartMs: DAY0, planCmdRev: 0, weatherTomorrow: 'clear', season: 'autumn', weatherAt: () => 'clear', ...extra });
const resident = extra => ({ recent: [], placesToday: [], lastSpot: null, firstOfDay: false, energy: 80, chores: 0, social: 60, choresTick: 0, ...extra });
const others = (segments, npc) => segments.filter(s => s.npc !== npc);

test('계기 — 마모·비·비 그침·비 갠 뒤·상태·차례·밤·계절·새 도구·손님 몰림, C4는 잠겨 있다', async () => {
  const { CARD_BY_ID: C, triggerHolds, villageStart } = await townModule('cards');
  const vs = villageStart(input('day', { wear: { 'cafe-tray': 18 } }));
  const at = extra => ({ t: DAY0 + 7 * HOUR, state: { energy: 80, chores: 0, social: 60 }, showsToday: 0, allNighter: false, raining: () => false,
    rainedBetween: () => false, afterRain: false, season: 'autumn', rushAt: () => false, dayStartMs: DAY0, yesterdayStartMs: DAY0 - 24 * HOUR, seed: 'x', ...extra });
  assert.ok(triggerHolds(C.C1, vs, at()), '쟁반 18');
  vs.wear['cafe-tray'] = 17; assert.ok(!triggerHolds(C.C1, vs, at()));
  vs.objects['cafe-tray'] = { spot: 'cafe.garden' };
  assert.ok(triggerHolds(C.C2, vs, at({ raining: () => true })) && !triggerHolds(C.C2, vs, at()), '비 오는데 쟁반이 바깥');
  vs.objects['cafe-tray'] = { spot: 'cafe.prep' }; assert.ok(!triggerHolds(C.C2, vs, at({ raining: () => true })), '안에 있으면 아니다');
  assert.ok(triggerHolds(C.W3, vs, at({ rainedBetween: () => true })) && !triggerHolds(C.W3, vs, at({ rainedBetween: () => true, raining: () => true })), '비 그친 뒤');
  vs.objects['observation-board'] = { spot: 'cafe.garden' };
  assert.ok(triggerHolds(C.R1, vs, at({ afterRain: true })) && !triggerHolds(C.R1, vs, at()), '비 갠 뒤 첫 맑은 구간, 판이 바깥');
  assert.ok(triggerHolds(C.R2, vs, at({ raining: () => true })), '비 오는데 판이 바깥');
  assert.ok(triggerHolds(C.C6, vs, at({ state: { energy: 20 } })) && !triggerHolds(C.C6, vs, at({ state: { energy: 30 } })));
  assert.ok(triggerHolds(C.C5, vs, at({ state: { chores: 4 } })) && !triggerHolds(C.C5, vs, at({ state: { chores: 3 } })));
  assert.ok(triggerHolds(C.W6, vs, at({ state: { energy: 40 } })) && !triggerHolds(C.W6, vs, at({ state: { energy: 40 }, raining: () => true })), '맑은 낮만');
  assert.ok(!triggerHolds(C.R6, vs, at({ state: { energy: 20 } })) && triggerHolds(C.R6, vs, at({ state: { energy: 20 }, allNighter: true })), '밤샘 다음 날만');
  assert.ok(triggerHolds(C.R3, vs, at({ showsToday: 4 })) && !triggerHolds(C.R3, vs, at({ showsToday: 3 })), '하루 네 번째 그림');
  assert.ok(triggerHolds(C.R4, vs, at()) && !triggerHolds(C.R4, vs, at({ raining: () => true })), '맑은 밤');
  assert.ok(triggerHolds(C.R5, vs, at({ rainedBetween: () => true })) && !triggerHolds(C.R5, vs, at()), '가을은 비 온 다음 날');
  vs.marks.newToolDay = LIFE - 1; assert.ok(triggerHolds(C.W5, vs, at()), '새 도구 다음 날');
  vs.marks.newToolDay = LIFE; assert.ok(!triggerHolds(C.W5, vs, at()), '바꾼 날은 아니다');
  assert.ok(triggerHolds(C.W2, vs, at({ rushAt: () => true })) && !triggerHolds(C.W2, vs, at()));
  assert.ok(!triggerHolds(C.C4, vs, at()) && C.C4.locked === 'W9', 'C4는 W9 대화 장면과 함께 선다');
});

test('카드는 주인의 결정에 생기고 다음 결정에 풀린다 — 열쇠·참조·쉼·흔적·마모, 같은 입력이면 같은 결과', async () => {
  const { planBand } = await townModule('plan');
  const { villageAt } = await townModule('cards');
  const run = input('morning', { wear: { 'cafe-tray': 18 } }), out = planBand(run);
  const rise = out.log.find(e => e.card === 'C1');
  assert.ok(rise && rise.npc === 'cafe-owner' && rise.key === `${LIFE}.morning.${(rise.atMs - run.startMs) / MIN}`);
  const solving = out.segments.find(s => s.card === 'C1' && s.cardRole === 'owner');
  assert.ok(solving.startMs > rise.atMs && solving.startMs - rise.atMs <= 10 * MIN, '길어도 10분 안의 다음 결정');
  const line = out.resolved.find(r => r.card === 'C1');
  assert.equal(line.ref, `${LIFE}.morning.C1`);
  assert.equal(line.atMs, solving.endMs, '확정은 해결 조각 끝');
  assert.equal(line.public, true);
  assert.deepEqual([out.cards.C1.status, out.cards.C1.until], ['cooldown', LIFE + 4]);
  assert.equal(out.traces['cafe-tray'].shim.value, line.path === 'pair' ? 'wood' : 'paper');
  assert.equal(villageAt(run, out.segments, out.log, solving.startMs).wear['cafe-tray'], line.path === 'pair' ? 0 : 9, '혼자는 문턱 절반에서 다시, 둘이는 처음부터');
  assert.deepEqual(planBand(run), out);
  // A card resting does not rise again until its rest ends (§8-3).
  const later = planBand(input('day', { wear: { 'cafe-tray': 30 }, cards: out.cards }));
  assert.ok(!later.log.some(e => e.card === 'C1'), '쉬는 동안은 다시 생기지 않는다');
  const after = planBand({ ...input('day', { wear: { 'cafe-tray': 30 }, cards: out.cards }), lifeDay: LIFE + 4, startMs: DAY0 + 4 * 24 * HOUR + 6 * HOUR,
    endMs: DAY0 + 4 * 24 * HOUR + 12 * HOUR, dayStartMs: DAY0 + 4 * 24 * HOUR });
  assert.ok(after.log.some(e => e.card === 'C1'), '쉼이 끝나면 문턱을 넘은 채 기다리던 카드가 선다');
});

test('상한 — 주민당 생활일 둘, 마을 넷(계기 때 센다), 앞 구간에 생긴 것도 센다', async () => {
  const { planBand } = await townModule('plan');
  const worn = { 'cafe-tray': 18, 'leaf-jar': 30, 'workshop-support': 20, tools: 0 };
  const residents = { 'cafe-owner': resident({ energy: 20, chores: 4 }), 'workshop-owner': resident({ energy: 40, chores: 4 }),
    researcher: resident({ energy: 20, showsToday: 4, allNighter: true }) };
  const out = planBand(input('day', { wear: worn, residents }));
  const by = npc => out.log.filter(e => e.npc === npc).length;
  assert.ok(['cafe-owner', 'workshop-owner', 'researcher'].every(npc => by(npc) <= 2), JSON.stringify(out.log));
  assert.equal(out.log.length, 4, '마을 상한까지 선다');
  const rose = { C1: { status: 'cooldown', until: LIFE + 4, day: LIFE }, C3: { status: 'cooldown', until: LIFE + 3, day: LIFE } };
  const capped = planBand(input('day', { wear: worn, residents, cards: rose }));
  assert.equal(capped.log.filter(e => e.npc === 'cafe-owner').length, 0, '오늘 이미 둘 — 찻집 주인은 더 생기지 않는다');
  assert.ok(capped.log.length <= 2, '마을 넷 가운데 둘은 이미 섰다');
});

test('마모의 주인(G4) — 주민 자기 일과만 닳게 하고, 플레이어가 만든 일과·장면·카드 해결은 닳게 하지 않는다 · 닳은 도구는 새것이 되고 다음 날 아침 W5', async () => {
  const { villageStart, applySegment } = await townModule('cards');
  const { planBand } = await townModule('plan');
  const vs = villageStart(input('morning')), seg = extra => ({ npc: 'cafe-owner', startMs: DAY0, arriveMs: DAY0, endMs: DAY0 + 5 * MIN, archetype: 'prep-cups', spot: 'cafe.prep', cause: 'routine', ...extra });
  const wearAfter = extra => { const before = vs.wear['cafe-tray']; applySegment(vs, seg(extra), { segments: [] }); return vs.wear['cafe-tray'] - before; };
  assert.equal(wearAfter({}), 1, '자기 일과');
  assert.equal(wearAfter({ habit: true }), 0, '플레이어 자리 습관');
  assert.equal(wearAfter({ cause: 'promise' }), 0, '플레이어와 한 약속');
  assert.equal(wearAfter({ archetype: 'reserved' }), 0, '장면이 붙잡은 시간');
  assert.equal(wearAfter({ card: 'C1', key: 'k', cardRole: 'owner' }), 0, '카드 해결은 닳게 하지 않는다');
  vs.wear.tools = 29;
  applySegment(vs, { ...seg({}), npc: 'workshop-owner', archetype: 'tool-care', spot: 'workshop.bench' }, { segments: [] });
  assert.deepEqual([vs.wear.tools, vs.marks.newToolDay], [0, LIFE], '문턱에서 새 도구');
  const next = planBand({ ...input('morning'), lifeDay: LIFE + 1, startMs: DAY0 + 24 * HOUR, endMs: DAY0 + 30 * HOUR, dayStartMs: DAY0 + 24 * HOUR, marks: { newToolDay: LIFE } });
  assert.ok(next.log.some(e => e.card === 'W5'), '다음 날 아침 「새 도구가 손에 안 익어요」');
});

/** C1이 이른 아침에 서는 마을 — 길(혼자·둘이)이 정해진 씨앗을 찾는다. */
async function c1Band(path) {
  const { planBand } = await townModule('plan');
  for (let i = 1; i < 80; i++) {
    const run = input('morning', { villageSeed: `rule-h-${i}`, wear: { 'cafe-tray': 18 } }), out = planBand(run);
    const line = out.resolved.find(r => r.card === 'C1'), rise = out.log.find(e => e.card === 'C1');
    const solving = out.segments.find(s => s.card === 'C1' && s.cardRole === 'owner'), partner = out.segments.find(s => s.card === 'C1' && s.cardRole === 'partner');
    // The town is small (a walk takes seconds): the holds below fall a second after a start, or a minute into a stay.
    if (line?.path === path && solving.startMs - rise.atMs >= 2 * MIN && (!partner || partner.arriveMs > partner.startMs + 1000 && partner.endMs > partner.arriveMs + 2 * MIN)) return { run, out, line, rise, solving, partner };
  }
  throw new Error(`no ${path} band`);
}

test('규칙 H — 결과는 최종 조각에서: (a) 혼자 풀 차례에 붙잡히면 놓인 뒤 혼자 (b) 둘이 풀 차례에 붙잡히면 온 짝이 혼자 푼 둘이 (c) 짝이 오기 전에 붙잡히면 혼자 (d) 온 뒤면 둘이', async () => {
  const { planBand } = await townModule('plan');
  const hold = (npc, fromMs, toMs) => ({ id: `R-${npc}`, npc, fromMs, toMs, spot: npc === 'cafe-owner' ? 'cafe.counter' : 'workshop.bench' });
  // (a) self in the first pass, the owner held between the rise and the solving: still waiting, then solved alone after.
  const a = await c1Band('self');
  const ha = planBand({ ...a.run, reservations: [hold('cafe-owner', a.rise.atMs + MIN, a.solving.startMs + 20 * MIN)] });
  const la = ha.resolved.find(r => r.card === 'C1');
  assert.ok(la && la.path === 'self' && la.atMs > a.solving.startMs + 20 * MIN, '(a) 놓인 뒤 혼자');
  // (b) pair in the first pass, the owner held after the rise: the neighbour who came solves it for two, with no talk.
  const b = await c1Band('pair');
  const hb = planBand({ ...b.run, reservations: [hold('cafe-owner', b.rise.atMs + MIN, b.solving.startMs + 30 * MIN)] });
  const lb = hb.resolved.find(r => r.card === 'C1');
  assert.deepEqual([lb.path, lb.actors, lb.solo], ['pair', ['workshop-owner'], true], '(b) 짝 혼자 한 둘이');
  assert.equal(hb.pairs['cafe-owner|workshop-owner']?.friction?.step ?? 0, 0, '(b) 대화가 없었으니 의견 차이는 그대로');
  assert.ok(!hb.scenes.some(s => s.card === 'C1'), '(b) 쌍 장면이 아니다');
  // (c) the neighbour held before it arrives: the owner's segment alone — solved alone.
  const hc = planBand({ ...b.run, reservations: [hold('workshop-owner', b.partner.startMs + 500, b.partner.startMs + 40 * MIN)] });
  assert.equal(hc.resolved.find(r => r.card === 'C1').path, 'self', '(c) 짝이 오기 전');
  // (d) held after it arrived: solved by the two.
  const hd = planBand({ ...b.run, reservations: [hold('workshop-owner', b.partner.arriveMs + MIN, b.partner.arriveMs + 40 * MIN)] });
  assert.equal(hd.resolved.find(r => r.card === 'C1').path, 'pair', '(d) 온 뒤');
  // A hold from before the rise: that rise never was (review F2) — any rise after it is a new one.
  const hf = planBand({ ...b.run, reservations: [hold('cafe-owner', b.rise.atMs, b.rise.atMs + 30 * MIN)] });
  assert.ok(!hf.log.some(e => e.card === 'C1' && e.key === b.rise.key), '붙잡힌 뒤의 계기는 없다');
  // A re-plan solves only alone and starts no pair scene (rule H).
  assert.ok(ha.segments.filter(s => s.npc === 'cafe-owner' && s.startMs >= a.solving.startMs + 20 * MIN).every(s => !s.with), '다시 짜기에는 쌍 장면이 없다');
});

test('반사실(F13 ①) — 한 주민을 붙잡아도 남의 조각·상태·그 주민이 들지 않은 카드 결과는 바이트까지 같다', async () => {
  const { planBand } = await townModule('plan'), { CARD_BY_ID } = await townModule('cards');
  for (const seed of ['cf-1', 'cf-2', 'cf-3']) {
    const run = input('day', { villageSeed: seed, wear: { 'cafe-tray': 17, 'leaf-jar': 29, 'workshop-support': 19, tools: 28 } });
    const plain = planBand(run), held = planBand({ ...run, reservations: [{ id: 'R-1', npc: 'cafe-owner', fromMs: run.startMs + HOUR, toMs: run.startMs + 2 * HOUR, spot: 'cafe.counter' }] });
    assert.deepEqual(others(held.segments, 'cafe-owner'), others(plain.segments, 'cafe-owner'), seed);
    for (const npc of ['workshop-owner', 'researcher']) assert.deepEqual(held.residents[npc], plain.residents[npc], `${seed} ${npc}`);
    const free = out => out.resolved.filter(r => CARD_BY_ID[r.card].owner !== 'cafe-owner' && !r.actors.includes('cafe-owner'));
    assert.deepEqual(free(held), free(plain), `${seed}: 찻집 주인이 들지 않은 카드`);
  }
});

test('take — 멈춘 카드는 주인이 풀지 않고, 방문과 함께 끝난 take 뒤에는 주인이 혼자 풀고, 함께 마친 카드는 플레이어의 것', async () => {
  const { planBand } = await townModule('plan');
  const b = await c1Band('pair'), at = b.rise.atMs + MIN, key = b.rise.key;
  const paused = planBand({ ...b.run, takes: [{ card: 'C1', key, at, status: 'paused' }] });
  assert.ok(!paused.segments.some(s => s.card === 'C1' && s.cardRole === 'owner'), '멈춘 동안 주인은 풀지 않는다');
  assert.ok(!paused.resolved.some(r => r.card === 'C1'), '불려 온 짝은 결과 없는 방문');
  assert.equal(paused.cards.C1.status, 'triggered');
  const ended = planBand({ ...b.run, takes: [{ card: 'C1', key, at, status: 'ended', endAt: at + 20 * MIN }] });
  const le = ended.resolved.find(r => r.card === 'C1');
  assert.ok(le && le.path === 'self' && le.atMs > at + 20 * MIN, 'take가 끝난 뒤 주인이 혼자');
  const done = planBand({ ...b.run, takes: [{ card: 'C1', key, at, status: 'resolved', resolvedAt: at + 3 * MIN, choice: 'inside' }] });
  assert.deepEqual(done.resolved.filter(r => r.card === 'C1').map(r => [r.path, r.public]), [['player', false]], '플레이어와 함께 — 당사자만 안다');
  assert.deepEqual(done.traces['cafe-tray'].shim, { value: 'inside', path: 'player' }, '고른 것이 흔적에 남는다');
  assert.equal(done.cards.C1.last.path, 'player');
});

test('옛 세계 — 카드·마모·흔적·쌍이 없는 마을은 그대로 받고, 모든 카드가 쉬는 데서 시작한다', async () => {
  const village = await townModule('village');
  const v = village.initialVillage();
  village.closeBands(v, { nowMs: DAY0 + 7 * HOUR, seed: 'old-world', offsetMin: TZ, revision: 1 });
  const old = structuredClone(v);
  for (const key of ['cards', 'wear', 'traces', 'pairs', 'marks']) delete old.band[key];
  for (const key of ['takes', 'knowledge', 'happened', 'news', 'told']) delete old[key];
  assert.ok(village.validVillage(old));
  village.closeBands(old, { nowMs: DAY0 + 30 * HOUR, seed: 'old-world', offsetMin: TZ, revision: 1 });
  assert.ok(village.validVillage(old) && old.band.cards && old.band.wear, '다음 구간을 열 때 칸이 채워진다');
  const broken = structuredClone(old); broken.band.cards = { C1: { status: 'bogus' } };
  assert.equal(village.validVillage(broken), false);
});

test('검수 반영(GA1·GA2·GA4) — 잊은 카드 참조는 접어도 남고, 주인이 떠난 뒤 온 짝은 둘이가 아니며, 지금 읽기는 그때까지의 조각 나눔만 센다', async () => {
  const { CARD_MEMORY, pruneForgotten } = await townModule('memory');
  const { villageAfter, villageAt } = await townModule('cards');
  assert.ok(CARD_MEMORY.test(`${LIFE}.day.C1`) && !CARD_MEMORY.test('life:12'));
  assert.deepEqual(pruneForgotten([{ npc: 'cafe-owner', target: `${LIFE}.day.C1` }], { facts: {} }), [{ npc: 'cafe-owner', target: `${LIFE}.day.C1` }]);
  const run = input('morning', { cards: { C1: { status: 'triggered', key: 'k1', at: DAY0, day: LIFE } } }), t = DAY0 + HOUR;
  const owner = { npc: 'cafe-owner', startMs: t, arriveMs: t, endMs: t + 5 * MIN, archetype: 'prep-cups', spot: 'cafe.prep', cause: 'card', card: 'C1', key: 'k1', cardRole: 'owner' };
  const late = { npc: 'workshop-owner', startMs: t + 4 * MIN, arriveMs: t + 6 * MIN, endMs: t + 10 * MIN, archetype: 'fix-round', spot: 'cafe.counter', cause: 'card', card: 'C1', key: 'k1', cardRole: 'partner', with: 'cafe-owner' };
  assert.equal(villageAfter(run, [owner, late], []).resolved[0].path, 'self', '짝이 주인이 떠난 뒤에 왔다');
  assert.equal(villageAfter(run, [owner, { ...late, arriveMs: t + 2 * MIN }], []).resolved[0].path, 'pair');
  const work = { npc: 'cafe-owner', startMs: t, arriveMs: t, endMs: t + 30 * MIN, archetype: 'prep-cups', spot: 'cafe.prep', cause: 'routine', pieceStarts: [t, t + 10 * MIN, t + 20 * MIN] };
  assert.equal(villageAt(input('morning'), [work], [], t + 15 * MIN).wear['cafe-tray'], 2, '지난 두 조각만');
});
