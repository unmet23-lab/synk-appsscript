#!/usr/bin/env node
/** 싱크타운 결정적 시뮬레이션 — 찻집 골목의 하루 세로 조각 설계 §15-1.
 *
 *   node tools/town-sim.mjs --check              씨앗 100 × 30생활일을 돌려 기준을 본다(실패가 있으면 종료 1, CI)
 *   node tools/town-sim.mjs --report             같은 실행의 보고서를 experiences/synk-town/qa/town-sim/에 쓴다
 *   node tools/town-sim.mjs --hash               결과 해시만 낸다(시간대를 바꿔 돌려 견주는 데 쓴다, §15-3)
 *   --seeds N · --days N                         규모를 바꾼다(시험은 씨앗 12)
 *
 * 마을 씨앗 × 시간대 넷(UTC+9·+8·+7·−5) × 플레이어 모습 여섯을 돈다. 런타임은 묶음마다 자란다 — 지금(W11)은 결산과 같은 길로
 * 구간을 닫아 두 주민·장소·반복·비, 기운·마음 한 줄, 카드·전해 듣기·쌍·카드 발생, 방문당 눈에 띄는 변화, 「본 것」 장부·「덜 추천」,
 * 가상 학습자 셋의 수준 사다리(tools/town-sim-ladder.mjs)를 잰다(계절을 타는 이유와 날씨·계절 카드는 같은 씨앗의 겨울 판에서도 잰다).
 * 기준 없이 잴 것만 정한 지표는 「측정」, 아직 잴 수 없는 지표는 「대기」로 남긴다.
 * 시뮬레이션은 시각을 숫자(epoch ms)로만 다룬다. 기기 시간대·로캘을 읽지 않는다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRng } from '../experiences/synk-town/town/rng.mjs';
import { PER_MILLE } from '../experiences/synk-town/town/state.mjs';
import { CARD_IDS as SEEN_CARD_IDS, contentCatalog, recordSeen } from '../experiences/synk-town/town/seen.mjs';
import { runLearners, LEARNERS } from './town-sim-ladder.mjs';
import * as clock from '../experiences/synk-town/town/clock.mjs';
import * as plan from '../experiences/synk-town/town/plan.mjs';
import * as village from '../experiences/synk-town/town/village.mjs';
import * as cards from '../experiences/synk-town/town/cards.mjs';
import * as knowledge from '../experiences/synk-town/town/knowledge.mjs';
import { paramsFor } from '../experiences/synk-town/town/params.mjs';
import { SPOT_BY_ID, SPOT_GROUPS } from '../experiences/synk-town/town/places.mjs';
import { ROUTINES, CARDS, TOWN_LINES, MOOD_LINES } from '../experiences/synk-town/town/data.gen.mjs';
import { initialVisitBands, writeBand } from '../experiences/synk-town/town/visits.mjs';
import { meanwhileLines } from '../experiences/synk-town/town/meanwhile.mjs';
import { GATHER, ITEM_BY_ID as GATHERED, grows } from '../experiences/synk-town/town/activities/gather.mjs';
import { FORBIDDEN, ROLE_LABELS } from './town-lines-check.mjs';
const cardsById = cards.CARD_BY_ID;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPORT_DIR = path.join(ROOT, 'experiences/synk-town/qa/town-sim');

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
/** 2026-10-01T00:00Z. 시작을 고정해 같은 입력이면 같은 결과다. */
export const SIM_START_MS = 1790812800000;
export const TIMEZONES = Object.freeze([540, 480, 420, -300]);
// W8b: the sixth — comes daily, picks what grows and gives it to the cafe owner (§20-8; takes no card).
export const PROFILES = Object.freeze(['absent', 'daily-random', 'night-only', 'away-7', 'daily-all', 'daily-gather']);
/** 내 시각 기준 구간(§4-2). 생활일은 05:00에 시작한다. 값은 생활일 시작부터의 분. */
export const BANDS = Object.freeze([
  { id: 'morning', from: 0, to: 6 * 60 },
  { id: 'day', from: 6 * 60, to: 12 * 60 },
  { id: 'evening', from: 12 * 60, to: 16 * 60 },
  { id: 'night', from: 16 * 60, to: 24 * 60 },
]);
const VISIT_MINUTES = 30;

export const villageSeeds = count => Array.from({ length: count }, (_, i) => `sim-v${String(i + 1).padStart(3, '0')}`);

/** 첫 생활일이 시작하는 순간(내 시각 05:00). */
export function firstLifeDayStart(tzOffsetMin, startMs = SIM_START_MS) {
  const local = startMs + tzOffsetMin * MINUTE;
  const lifeDay = Math.floor((local - 5 * HOUR) / DAY);
  return (lifeDay + 1) * DAY + 5 * HOUR - tzOffsetMin * MINUTE;
}

function visitIn(rng, dayStartMs, band) {
  const span = band.to - band.from - VISIT_MINUTES;
  const from = dayStartMs + (band.from + rng.between(0, span)) * MINUTE;
  return { fromMs: from, toMs: from + VISIT_MINUTES * MINUTE, band: band.id };
}

/** 플레이어 모습별 방문 일정(§15-1). 같은 씨앗·시간대·모습이면 같은 일정이다. */
export function visitPlan(profile, { villageSeed, tzOffsetMin, days, startMs = SIM_START_MS }) {
  if (!PROFILES.includes(profile)) throw new RangeError(`모르는 플레이어 모습: ${profile}`);
  const rng = createRng('town-sim', 'visits', villageSeed, tzOffsetMin, profile);
  const first = firstLifeDayStart(tzOffsetMin, startMs), visits = [];
  for (let day = 0; day < days; day++) {
    const dayStart = first + day * DAY;
    if (profile === 'absent') continue;
    if (profile === 'away-7' && day >= 10 && day < 17) continue;
    // 밤에만 오는 사람은 21:00~00:30 사이에 들어온다(주민이 깨어 있는 밤).
    const band = profile === 'night-only' ? { id: 'night', from: 16 * 60, to: 19 * 60 + 30 } : rng.pick(BANDS);
    visits.push({ lifeDayIndex: day, ...visitIn(rng, dayStart, band), acceptAll: profile === 'daily-all' });
  }
  return visits;
}

/** 런타임이 아직 없을 때의 빈 마을. 묶음이 붙을 때마다 이 자리를 실제 런타임으로 바꾼다. */
export const NULL_RUNTIME = Object.freeze({
  name: 'none',
  createVillage: ({ villageSeed, tzOffsetMin }) => ({ villageSeed, tzOffsetMin, events: [] }),
  visit: () => ({ changes: [] }),
  finish: village => ({ events: village.events.length }),
});

const percent = (n, d) => (d ? Math.round(n / d * 1000) / 10 : 0);
const ROUTINE_SPAN_MIN = 120;

/** 주민의 30생활일(W3~W5): 결산과 같은 길(village.mjs closeBands)로 구간을 하나씩 닫으며 지표에 쓸 것만 줄여 남긴다 — 카드·쌍·전해
 * 듣기가 구간을 넘어 이어진다(W5 검토 F13). 「나와 함께」는 매일 와서 다 받는 모습(accept)만 한다: 방문 안에서 카드가 생기면 1분 뒤 열고
 * 2분 뒤 첫 고르기로 확정하고 1분 뒤 닫는다 — core의 CARD_OPEN·CONFIRM·CLOSE가 마을에 남기는 것(take·주인을 붙잡는 예약·함께한 일
 * 표시·당사자의 앎)과 같다. 명령이 없는 모습은 마을이 같으므로(§15-2) 한 번만 센다.
 * W11: watchSets(모습 → 방문)의 방문마다 그 방문이 본 변화(§15-1 눈에 띄는 변화)와 「본 것」 장부에 더해질 열쇠(§20-10)를 같은 삶에서
 * 센다 — 마을을 바꾸지 않는 모습은 마을이 같으므로 한 삶을 여러 모습이 본다. */
function lifeOfVillage({ villageSeed, tzOffsetMin, startMs, days, visits = [], accept = visits.length > 0, habits = false, watch = false, gather = false, watchSets = null }) {
  const result = { meetableShortMinutes: 0, placeDays: 0, placeShortDays: 0, repeats: 0, orderPairs: 0, sameOrder: 0, rainOutside: 0, segments: 0,
    // W4: 주민마다 깨어 있는 분·기운 문턱 아래 분·문턱 아래로 간 날, 줄이 뜬 이유(주민:이유 → 횟수), 하루 가장 많은 줄, 상한 전 이유가 넷을 넘은 날.
    awakeMinutes: {}, belowMinutes: {}, belowDays: {}, moods: {}, moodsMaxPerDay: 0, reasonsOverCap: 0, residentDays: 0,
    // W5: 카드마다 생긴 수·푼 길, 상한·쿨다운을 넘은 것, 플레이어 없이 「나와 함께」로 끝난 것, 퍼진 플레이어 사건, 하루 들은 것이 넘은 것, 쌍 장면이 넘은 날·내려간 단계.
    rose: {}, solved: {}, playerBy: {}, capOver: 0, cooldownOver: 0, playerPaths: 0, playerSpread: 0, heardOver: 0, scenesOverDays: 0, stepDown: 0, scenes: 0,
    // W6: 돌아온 방문(앞 방문 뒤 닫힌 구간이 있는)·그중 줄이 선 것·가장 많은 줄·금지 말이 든 줄, 습관 구간·습관 조각·플레이어 일과의 나쁜 쪽 변화.
    returns: 0, returnsWithLines: 0, linesMax: 0, linesBad: 0, habitBands: 0, habitSegments: 0, habitWorse: 0, habits,
    // W8b: the leaf jar's wear at each band's end, and (gathering) what grew at the visits, what was picked and given.
    jarWear: 0, jarBands: 0, gather, growing: 0, picked: 0, relief: 0, gatherOver: 0,
    // W11: per watched profile the visits, those with a change, the changes and each kind, and what its seen ledger gained; the
    // same mood line twice a life day; wear the player's segments raised (§15-1 마모 주인); the life days each rest signal stood
    // (§15-1 기운); the night-habit nights and their minutes with no one up before 02:00; the first C4 rise and solving; how
    // often a card set to less often is still offered (§20-10); the visits a learner walks into (tools/town-sim-ladder.mjs).
    visible: {}, seen: {}, moodTwice: 0, wearByPlayer: 0, wearByPlayerPieces: 0, restDays: {}, habitNights: 0, habitNightShort: 0,
    // First C4 follow-up (10-30): the life days its first waited and those its owner lingered by the menu board (at most once, §8-4
    // ③), each lingering's minute from the life day's start, and the general rule's rises after the first was done (§8-4 둘째 회).
    c4: { rose: null, solved: null, waitDays: 0, lingerDays: 0, lingerOver: 0, lingerAt: [], again: 0, againPaths: {} }, less: { rises: 0, offered: 0 }, sceneVisits: [],
    // The first life day each invariant broke — the seed to replay (§15-1 「실패면 재현 씨앗·생활일」).
    first: {} };
  const flag = (key, day) => { if (!Object.hasOwn(result.first, key)) result.first[key] = day; };
  const P = paramsFor(), v = village.initialVillage();
  // W11: each watched profile keeps its last visit (news since then is new to it) and its own seen ledger.
  const sets = Object.entries(watchSets || {}).map(([profile, list]) => ({ profile, list, last: null, seen: {},
    lastEnd: null, tally: (result.visible[profile] = { visits: 0, one: 0, changes: 0, strictOne: 0, strictChanges: 0, kinds: {}, bands: {} }),
    gained: (result.seen[profile] = { visits: 0, added: 0, left: 0 }) }));
  const newsAt = [], newsRefs = new Set(), pickedAt = new Map();
  let rev = 1, ring = initialVisitBands(), lastEnd = null;
  const close = nowMs => village.closeBands(v, { nowMs, seed: villageSeed, offsetMin: tzOffsetMin, revision: rev, ...(habits ? { visitBands: ring } : {}) });
  const takers = accept ? visits : [];
  // §8-4 첫 C4: where the player stays with the cafe owner, written by the functions core.mjs uses (village.mjs noteStay ·
  // closeStay) — the profile that takes every card goes to her a minute into each visit, the gathering one when it brings her
  // its leaves; every other profile stays home (§15-2 ②), so its village is absence's and its first C4 never rises.
  const stayWith = (atMs, toMs, day) => {
    if (!cards.firstPending(v.band.cards?.[cards.FIRST_STAY]) || atMs >= v.band.endMs) return;
    const startSpots = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
    const at = village.placeAt(village.planOf(v).segments, 'cafe-owner', atMs, startSpots);
    if (!at || at.to === 'home') return;
    village.noteStay(v, at.to, atMs); village.closeStay(v, toMs);
    result.c4.stay ||= { atMs, toMs, day };
  };
  // W8b gathering: picked of each item on a life day, held in the basket, what grew at a visit (once an item a day).
  const picked = {}, held = {}, grew = new Set(), G = P.gather;
  const gatherAt = visit => {
    const at = visit.fromMs + 2 * MINUTE, facts = { ...clock.clockAt({ villageSeed, hostNowMs: at, tz: tzOffsetMin }), afterRain: clock.afterRainAt(villageSeed, tzOffsetMin, at) };
    const day = v.band.lifeDay, mine = [];
    for (const item of GATHERED.keys()) {
      if (!grows(item, facts)) continue;
      const key = `${day}|${item}`;
      if (!grew.has(key)) { grew.add(key); result.growing += G.quota[item]; }
      const left = G.quota[item] - (picked[key] || 0);
      if (left > 0) { picked[key] = (picked[key] || 0) + left; held[item] = (held[item] || 0) + left; result.picked += left; mine.push(item); }
      if ((held[item] || 0) > GATHERED.get(item).stackMax) { result.gatherOver++; flag('gatherOver', visit.lifeDayIndex); }
    }
    pickedAt.set(visit.fromMs, mine);
    // Given to the cafe owner when she is up (§20-8): the jar is worn that much less from then — a time-ordered input.
    const give = visit.fromMs + 10 * MINUTE, relief = Object.entries(held).reduce((n, [item, qty]) => n + (G.tinRelief[item] || 0) * qty, 0);
    // As the command does (backend review GB1): she is up and has arrived where she is going (the player walks to her).
    const startSpots = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
    const owner = give < v.band.endMs ? village.placeAt(village.planOf(v).segments, GATHER.owner, give, startSpots) : null;
    if (relief > 0 && village.upFor(v, GATHER.owner, give) && owner && !owner.walking) {
      // Brought to her, the player stays beside her the rest of the visit (§8-4 첫 C4 — this profile never takes it: it waits).
      stayWith(give, visit.toMs, visit.lifeDayIndex);
      v.gives = [...(v.gives || []), { atMs: give, object: GATHER.tin, relief: Math.min(999, relief), npc: GATHER.owner }];
      result.relief += relief;
      for (const item of Object.keys(held)) delete held[item];
    }
  };
  close(startMs);
  const lastOrder = new Map(), linesPerDay = P.state.moodLinesPerDay, endAll = startMs + days * clock.DAY, lastSolved = {};
  for (let day = 0; day < days; day++) {
    const dayStartMs = startMs + day * clock.DAY, daySegments = [], dayBelow = new Set(), dayMoods = {}, dayReasons = {}, roseToday = {}, dayRest = new Set();
    let scenesToday = 0, nightHabit = false, waitedToday = false, lingeredToday = 0;
    while (v.band.startMs < dayStartMs + clock.DAY && v.band.startMs < endAll) {
      const b = v.band;
      // W6: a visit that begins in this band writes the ring (its life day's first) and, watched, reads what changed meanwhile
      // — the lines core's view gives (the bands closed since the last visit's end, the traces standing now).
      for (const visit of visits.filter(x => x.fromMs >= b.startMs && x.fromMs < b.endMs)) {
        if (habits) ring = writeBand(ring, b.lifeDay, b.band);
        if (watch && lastEnd !== null && (v.changes || []).some(c => c.bandEnd > lastEnd && c.bandEnd <= visit.fromMs)) {
          const out = village.planOf(v), now = cards.villageAt(village.bandInput(v), out.segments, out.log, visit.fromMs);
          const lines = meanwhileLines(v.changes, { startAt: visit.fromMs, since: lastEnd }, now.traces);
          result.returns++; if (lines.length) result.returnsWithLines++;
          result.linesMax = Math.max(result.linesMax, lines.length);
          for (const line of lines) {
            const entry = TOWN_LINES.find(e => e.id === line.id);
            const texts = entry ? Object.values(entry.levels).map(t => t.replace('{npc2}', ROLE_LABELS[line.npc2] || '').replace('{npc}', ROLE_LABELS[line.npc] || '')) : [''];
            if (!entry || texts.some(t => FORBIDDEN.some(group => group.patterns.some(re => re.test(t))))) { result.linesBad++; flag('linesBad', day); }
          }
        }
        lastEnd = visit.toMs;
      }
      // A visit that takes every card it meets (the accept profile): open, choose, confirm, close — at the village's own fields.
      for (const visit of takers.filter(x => x.fromMs < b.endMs && x.toMs > b.startMs)) {
        if (visit.fromMs >= b.startMs) stayWith(visit.fromMs + MINUTE, visit.toMs, visit.lifeDayIndex);
        let t = Math.max(visit.fromMs, b.startMs), tookC4 = false;
        const until = Math.min(visit.toMs, b.endMs), passed = new Set();
        for (;;) {
          const out = village.planOf(v);
          // W11 (조율 10-30): every card the visit finds waiting — one that rose before it came too, as core.mjs cardOfferFor
          // offers whatever is triggered at the player's place — opened a minute after the later of its rise and now.
          const rise = out.log.find(e => Math.max(e.atMs, t) + 4 * MINUTE < until && cardsById[e.card].paths.player.ready
            && !passed.has(`${e.card}|${e.key}`) && !(v.takes || []).some(k => k.card === e.card && k.key === e.key));
          if (!rise) break;
          const open = Math.max(rise.atMs, t) + MINUTE, card = cardsById[rise.card], by = `card:${card.id}:${rise.key}`;
          if (cards.cardsAt(village.bandInput(v), out.segments, out.log, open).find(c => c.card === card.id)?.status !== 'triggered') { passed.add(`${rise.card}|${rise.key}`); continue; }
          // §20-10 「덜 추천」: had the player set this card to less often, its offer stands on a seeded share of its rises — the
          // same draw as core.mjs cardOfferFor (createRng(v.seed, 'offer', card, key) below lessOftenMultiplier ‰).
          result.less.rises++;
          if (createRng(villageSeed, 'offer', card.id, rise.key).below(PER_MILLE) < P.prefs.lessOftenMultiplier) result.less.offered++;
          if (card.id === 'C4') tookC4 = true;
          const take = { card: card.id, key: rise.key, at: open, status: 'with', open: true, choice: null };
          v.takes = [...(v.takes || []), take].slice(-P.cards.takesKept);
          const spot = name => SPOT_GROUPS[name]?.[0] ?? name;
          village.holdResidents(v, { [card.owner]: { by, spot: cards.holdSpotOf(card) }, ...Object.fromEntries((card.paths.player.with || []).map(npc => [npc, { by, spot: spot(card.paths.pair.partnerSpot) }])) }, open, ++rev);
          const done = open + 2 * MINUTE, place = cards.placeOfSpot(card.spot), actors = [card.owner, ...(card.paths.player.with || []), 'player'];
          Object.assign(take, { status: 'resolved', resolvedAt: done, ref: cards.cardRef(b.lifeDay, b.band, card.id), choice: card.paths.player.choices[0] ?? null });   // a card whose 「나와 함께」 is a life activity (W8: C5 · R6) has no choice
          for (const r of v.reservations) if (r.by === by && r.toMs === null) r.with = true;
          knowledge.learnPrivate(v, { ref: take.ref, card: card.id, path: 'player', actors, place });
          take.open = false;
          village.holdResidents(v, {}, done + MINUTE, ++rev);
          t = done + MINUTE;
        }
        // What a virtual learner walks into at this visit (§15-1 가상 학습자): a tea order while the cafe owner is up, C4's talk if taken.
        if (visit.fromMs >= b.startMs) result.sceneVisits.push([visit.fromMs, visit.lifeDayIndex, village.upFor(v, 'cafe-owner', visit.fromMs + 5 * MINUTE) ? 1 : 0, tookC4 ? 1 : 0]);
      }
      if (gather) for (const visit of visits.filter(x => x.fromMs >= b.startMs && x.fromMs < b.endMs)) gatherAt(visit);
      const out = village.planOf(v), before = residentsOf(v);
      daySegments.push(...out.segments);
      // §8-4 ③: a band of C4's that starts with its first waiting is a day it waited; its owner's lingering segments that day.
      const c4At = b.cards?.[cards.FIRST_STAY];
      if (c4At?.status === 'triggered' && c4At.first === true && cardsById[cards.FIRST_STAY].bands.includes(b.band)) waitedToday = true;
      for (const s of out.segments) if (s.linger) { lingeredToday++; result.c4.lingerAt.push(Math.round((s.startMs - b.dayStartMs) / clock.MINUTE)); }
      if (v.band.visitHabit) result.habitBands++;
      result.habitSegments += out.segments.filter(x => x.visitHabit).length;
      const worse = out.stateLog.filter(x => x.cause === 'player-routine' && (x.stat === 'chores' ? x.delta > 0 : x.delta < 0)).length;
      result.habitWorse += worse;
      if (worse) flag('habitWorse', day);
      if (b.band === 'night' && b.visitHabit) nightHabit = true;
      if (sets.length) watchBand(b, out, day);
      // 기운은 구간 시작 값에 변화 기록을 시각 차례로 더해, 결정 시각마다(조각을 놓기 전) 문턱 아래였던 시간을 센다.
      for (const npc of plan.RESIDENT_IDS) {
        const log = out.stateLog.filter(e => e.npc === npc && e.stat === 'energy'), threshold = plan.RESIDENT_BY_ID[npc].restThreshold;
        let energy = before[npc]?.energy ?? P.state.wakeEnergy, i = 0;
        for (const s of out.segments.filter(x => x.npc === npc)) {
          // A merged segment is decided once a piece: each piece counts from its own decision time (review GA3).
          const pieces = s.pieceStarts ?? [s.startMs];
          pieces.forEach((at, k) => {
            const minutes = ((pieces[k + 1] ?? s.endMs) - at) / clock.MINUTE;
            while (i < log.length && log[i].atMs < at) energy += log[i++].delta;
            result.awakeMinutes[npc] = (result.awakeMinutes[npc] || 0) + minutes;
            if (energy < threshold) { result.belowMinutes[npc] = (result.belowMinutes[npc] || 0) + minutes; dayBelow.add(npc); }
          });
          if (s.reason) (dayReasons[npc] ||= new Set()).add(s.reason);
          if (s.mood) { (dayMoods[npc] ||= []).push(s.reason); result.moods[`${npc}:${s.reason}`] = (result.moods[`${npc}:${s.reason}`] || 0) + 1; }
          if (s.mood && REST_SIGNALS.includes(s.reason)) dayRest.add(s.reason);
        }
        const order = out.segments.filter(s => s.npc === npc).map(s => s.archetype).join(',');
        const key = `${npc}|${b.band}`;
        if (lastOrder.has(key) && order) { result.orderPairs++; if (lastOrder.get(key) === order) { result.sameOrder++; flag('sameOrder', day); } }
        lastOrder.set(key, order);
      }
      // W5: what rose and how it was solved; the caps and the rests (§15-1 카드).
      for (const e of out.log) {
        result.rose[e.card] = (result.rose[e.card] || 0) + 1;
        // C4's first is the player's, outside the caps and its rest (§8-4) — the caps count the residents' own rises.
        if (!e.first) (roseToday[e.npc] ||= []).push(e.card);
        if (!e.first && lastSolved[e.card] !== undefined && b.lifeDay < lastSolved[e.card] + cardsById[e.card].cooldownLifeDays) { result.cooldownOver++; flag('cooldownOver', day); }
        if (REST_SIGNALS.includes(e.card)) dayRest.add(e.card);
        if (e.card === 'C4' && !result.c4.rose) result.c4.rose = { atMs: e.atMs, day };
        else if (e.card === 'C4' && !e.first) result.c4.again++;
      }
      for (const line of out.resolved) {
        result.solved[`${line.card}:${line.path}`] = (result.solved[`${line.card}:${line.path}`] || 0) + 1;
        lastSolved[line.card] = b.lifeDay;
        if (line.path === 'player') { result.playerPaths++; for (const npc of line.actors) result.playerBy[npc] = (result.playerBy[npc] || 0) + 1; if (!accept) flag('playerPath', day); }
        if (line.card === 'C4' && !result.c4.solved) result.c4.solved = { path: line.path, atMs: line.atMs, day };
        else if (line.card === 'C4') result.c4.againPaths[line.path] = (result.c4.againPaths[line.path] || 0) + 1;
      }
      scenesToday += out.scenes.length; result.scenes += out.scenes.length;
      const steps = Object.fromEntries(Object.entries(b.pairs || {}).map(([key, s]) => [key, s.friction.step]));
      const wearFrom = { ...(b.wear || {}) };
      close(b.endMs);
      result.jarWear += v.band.wear?.['leaf-jar'] ?? 0; result.jarBands++;
      for (const [key, step] of Object.entries(steps)) if ((v.band.pairs?.[key]?.friction.step ?? 0) < step) { result.stepDown++; flag('stepDown', day); }
      // W11 (§15-1 마모 주인): wear rises only by a resident's own routine — a band's rise past its own wearing pieces (never a
      // card's, a habit's, a promise's or the player's routine, counted here apart from cards.mjs applySegment) is the player's.
      const own = {};
      for (const s of out.segments) {
        const object = plan.ARCHETYPE_BY_ID[s.archetype]?.wear;
        if (object && !s.cardRole && !s.habit && !s.visitHabit && s.cause !== 'promise' && s.cause !== 'player-routine') own[object] = (own[object] || 0) + (s.pieceStarts?.length ?? 1);
      }
      for (const object of cards.WEAR_OBJECTS) {
        const over = (v.band.wear?.[object] ?? 0) - (wearFrom[object] ?? 0) - (own[object] || 0);
        if (over > 0) { result.wearByPlayer += over; flag('wearByPlayer', day); }
      }
      // A band's own falls (a card's reset, the new tool, a gift's relief) can hide a rise in that net count (review GA1), so
      // each wearing piece the player made also goes through cards.mjs applySegment alone, from nothing: it must wear nothing.
      for (const s of out.segments) {
        const object = plan.ARCHETYPE_BY_ID[s.archetype]?.wear;
        if (!object || s.cardRole || !(s.habit || s.visitHabit || s.cause === 'promise')) continue;
        for (let n = 0; n < (s.pieceStarts?.length ?? 1); n++) {
          const probe = { wear: { [object]: 0 }, objects: {}, marks: {}, lifeDay: b.lifeDay };
          cards.applySegment(probe, s, { segments: out.segments, first: n === 0 });
          if (probe.wear[object] !== 0) { result.wearByPlayerPieces++; flag('wearByPlayer', day); }
        }
      }
      // Nothing the player took part in spreads (G6), and no one hears more than a few things a day (§9-3).
      const spreadBefore = result.playerSpread;
      for (const list of Object.values(v.knowledge?.known || {})) result.playerSpread += list.filter(e => e.path === 'player' && e.how !== 'private').length;
      result.playerSpread += (v.news || []).filter(n => n.path === 'player').length;
      if (result.playerSpread > spreadBefore) flag('playerSpread', day);
      if (Object.values(v.knowledge?.heard || {}).some(n => n > P.knowledge.heardPerDay)) { result.heardOver++; flag('heardOver', day); }
      // The village's news a later visit finds new (§15-1 새 마을 소식): told at the morning the next band opens.
      for (const n of v.news || []) if (!newsRefs.has(n.ref)) { newsRefs.add(n.ref); newsAt.push(v.band.startMs); }
    }
    if (scenesToday > P.pairs.scenesPerDay) { result.scenesOverDays++; flag('scenesOverDays', day); }
    const all = Object.values(roseToday).flat();
    if (all.length > P.cards.perVillage || Object.values(roseToday).some(list => list.length > P.cards.perResident)) { result.capOver++; flag('capOver', day); }
    result.segments += daySegments.length;
    for (const npc of plan.RESIDENT_IDS) {
      result.residentDays++;
      if (dayBelow.has(npc)) result.belowDays[npc] = (result.belowDays[npc] || 0) + 1;
      result.moodsMaxPerDay = Math.max(result.moodsMaxPerDay, (dayMoods[npc] || []).length);
      if ((dayReasons[npc]?.size || 0) > linesPerDay) { result.reasonsOverCap++; flag('reasonsOverCap', day); }
      // The same mood line twice in a life day (§15-1 같은 행동 반복).
      const twice = (dayMoods[npc] || []).length - new Set(dayMoods[npc] || []).size;
      if (twice) { result.moodTwice += twice; flag('moodTwice', day); }
    }
    for (const signal of dayRest) result.restDays[signal] = (result.restDays[signal] || 0) + 1;
    if (waitedToday) { result.c4.waitDays++; if (lingeredToday) result.c4.lingerDays++; }
    if (lingeredToday > 1) { result.c4.lingerOver++; flag('lingerOver', day); }
    // 만날 수 있는 시각 05:30~23:30(§4-2): 분마다 깨어 있는 주민 수.
    const awake = new Uint8Array(24 * 60);
    for (const npc of plan.RESIDENT_IDS) {
      const mine = new Uint8Array(24 * 60);
      for (const s of daySegments) if (s.npc === npc) {
        for (let m = Math.max(0, Math.ceil((s.startMs - dayStartMs) / clock.MINUTE)); m < Math.min(24 * 60, Math.ceil((s.endMs - dayStartMs) / clock.MINUTE)); m++) mine[m] = 1;
      }
      for (let m = 0; m < 24 * 60; m++) awake[m] += mine[m];
    }
    for (let minute = 30; minute < 18 * 60 + 30; minute++) if (awake[minute] < 2) { result.meetableShortMinutes++; flag('meetable', day); }
    // A village whose night habit stands keeps someone up until 02:00 (§15-1 만날 수 있는 주민 수 — 23:30~02:00).
    if (nightHabit) {
      result.habitNights++;
      for (let minute = 18 * 60 + 30; minute < 21 * 60; minute++) if (awake[minute] < 1) { result.habitNightShort++; flag('habitNight', day); }
    }
    for (const npc of plan.RESIDENT_IDS) {
      const mine = daySegments.filter(s => s.npc === npc);
      result.placeDays++;
      if (new Set(mine.map(s => SPOT_BY_ID[s.spot].place)).size < 3) { result.placeShortDays++; flag('places', day); }
      for (let i = 1; i < mine.length; i++) {
        const kind = plan.ARCHETYPE_BY_ID[mine[i].archetype]?.kind;
        // The same work at the same spot across a band edge, moved under cover by rain, or a neighbour's call (a card's
        // pair, a chat — the neighbour's decision, not its own) is not a repeat.
        if (kind !== 'rest' && !mine[i].moved && !mine[i].cardRole && !mine[i].joined && mine[i].archetype === mine[i - 1].archetype
          && mine[i].startMs === mine[i - 1].endMs && mine[i].spot !== mine[i - 1].spot) { result.repeats++; flag('repeats', day); }
      }
      for (const s of mine) if (!SPOT_BY_ID[s.spot].sheltered && s.arriveMs < s.endMs && clock.rainBetween(villageSeed, s.arriveMs, s.endMs)) { result.rainOutside++; flag('rainOutside', day); }
    }
  }
  for (const set of sets) set.gained.left = SEEN_CATALOG.size - Object.keys(set.seen).length;
  // §8-4: whether C4's first still waits for the player at the end (a village that never takes it).
  result.c4.waiting = v.band.cards?.[cards.FIRST_STAY]?.status === 'triggered' && v.band.cards[cards.FIRST_STAY].first === true;
  return result;

  /** W11 (§15-1 30분 방문당 눈에 띄는 변화): what each watched visit in this band saw change on the screen — a card rising or
   * solved (its trace, the day's tea, a new tea), a pair scene, a mood line (a change of what a resident does), a habit spot
   * in use, a resident moving a thing (the screen shows the resident at it; the scene's props stand where they always do), a
   * cup given to the cafe owner; and, new to it since its last visit, the village's news (at most the note's lines) and the
   * lines of the 「그동안 달라진 것」 board (§10-2 — at most three, the traces, habits and pairs core's view gives a returning
   * visit: the scene draws no object's spot or trace, so what changed while it was away shows only there — 조율 판단 10-30)
   * — and what of it the seen ledger keeps (§20-10: card paths, mood lines, gathered items). The alley is one place on the
   * screen (the wide camera keeps the four destinations in sight). strict counts only what happened inside the visit and
   * the news (the report shows both). */
  function watchBand(b, out, day) {
    const events = [];
    for (const e of out.log) events.push({ at: e.atMs, kind: 'rise' });
    for (const line of out.resolved) events.push({ at: line.atMs, kind: 'solve', key: `card:${line.card}:${line.path}` });
    for (const s of out.scenes) events.push({ at: s.atMs, kind: 'scene' });
    const spots = Object.fromEntries(Object.entries(b.objects || {}).map(([object, o]) => [object, o?.spot ?? null]));
    for (const s of [...out.segments].sort((x, y) => x.startMs - y.startMs)) {
      if (s.mood) events.push({ at: s.startMs, kind: 'mood', key: `line:${s.mood}` });
      if (s.visitHabit) events.push({ at: s.startMs, end: s.endMs, kind: 'habit' });
      if (s.archetype === 'reserved' || s.cardRole === 'partner') continue;
      const move = (s.cardRole === 'owner' ? cardsById[s.card].moves : null) ?? plan.ARCHETYPE_BY_ID[s.archetype]?.moves;
      if (!move) continue;
      const current = spots[move.object], to = move.to === 'spot' ? s.spot : move.to;
      if (to !== current && (!move.onlyFromOutside || current && !SPOT_BY_ID[current].sheltered)) {
        spots[move.object] = to; events.push({ at: s.arriveMs ?? s.startMs, kind: 'object' });
      }
    }
    for (const g of v.gives || []) if (g.atMs >= b.startMs && g.atMs < b.endMs) events.push({ at: g.atMs, kind: 'tea' });
    for (const set of sets) for (const visit of set.list) {
      if (visit.fromMs < b.startMs || visit.fromMs >= b.endMs) continue;
      const seen = events.filter(e => e.end !== undefined ? e.at < visit.toMs && e.end > visit.fromMs : e.at >= visit.fromMs && e.at < visit.toMs);
      const news = Math.min(P.knowledge.noteShows ?? Infinity, newsAt.filter(at => at <= visit.fromMs && (set.last === null || at > set.last)).length);
      // What changed while it was away, as the board shows a returning visit (core.mjs view: meanwhileLines at the visit's start).
      const since = set.lastEnd === null ? 0 : meanwhileLines(v.changes, { startAt: visit.fromMs, since: set.lastEnd },
        cards.villageAt(village.bandInput(v), out.segments, out.log, visit.fromMs).traces).length;
      const strict = seen.length + news, count = strict + since, t = set.tally, band = (t.bands[visit.band] ||= { visits: 0, one: 0, changes: 0, strictOne: 0 });
      t.visits++; t.changes += count; t.strictChanges += strict; band.visits++; band.changes += count;
      if (count) { t.one++; band.one++; } else flag(`visible:${set.profile}`, day);
      if (strict) { t.strictOne++; band.strictOne++; }
      for (const e of seen) t.kinds[e.kind] = (t.kinds[e.kind] || 0) + 1;
      if (news) t.kinds.news = (t.kinds.news || 0) + news;
      if (since) t.kinds.meanwhile = (t.kinds.meanwhile || 0) + since;
      set.last = visit.fromMs; set.lastEnd = visit.toMs;
      const keys = [...seen.filter(e => e.key).map(e => e.key), ...(pickedAt.get(visit.fromMs) || []).map(item => `gather:${item}`)];
      const { seen: next, added } = recordSeen(set.seen, keys, { known: key => SEEN_CATALOG.has(key) });
      set.seen = next; set.gained.visits++; set.gained.added += added.length;
    }
  }
}
const residentsOf = v => v.band.residents;

/** 일과표 칸마다 활동 수(데이터 검사, §6-2). 깨어 있는 시간이 두 시간보다 짧은 칸(공방 주인의 밤 마무리 30분 같은)은 뺀다. */
function routineVariety() {
  const short = [];
  for (const cell of ROUTINES) {
    const resident = plan.RESIDENT_BY_ID[cell.npc], band = clock.BANDS.find(b => b.id === cell.band);
    const wake = cell.dayKind === 'off' && resident.wake.off !== undefined ? resident.wake.off : resident.wake.default;
    const awake = Math.min(band.to, resident.sleep) - Math.max(band.from, wake);
    const kinds = new Set(cell.pool.map(item => item.archetype));
    if (awake >= ROUTINE_SPAN_MIN && kinds.size < 3) short.push(`${cell.npc}|${cell.dayKind}|${cell.band}`);
  }
  return short;
}

/** 이유마다 「살아 있는」 마을 몫의 기준(§15-1 죽은 이유 0, 검토 P3-3): 마을(씨앗·시간대)마다 30일에 한 번 이상 뜬 비율. */
export const MOOD_ALIVE_SHARE = 0.75;
/** 카드마다 「살아 있는」 마을 몫(§15-1 카드 발생, W5 §2-10): 30일에 한 번 이상 생긴 마을의 비율. 비가 시작·그치는 순간에 서는 카드는
 * 그 계절의 날씨가 주는 만큼만 선다(가을 한 달에 마을마다 깨어 있는 동안 비가 시작되는 때는 서너 번) — 그 계절 판에서 절반 이상을 본다. */
export const CARD_ALIVE_SHARE = 0.9, RAIN_CARD_ALIVE_SHARE = 0.5;
/** 「나와 함께」 뒤의 이유는 그 주민과 함께한 마을에서 잰다 — 원래 하려던 일과 같으면 줄이 없으니(§7-3 귀속) 절반 이상을 본다. */
export const WITH_PLAYER_ALIVE_SHARE = 0.5;
/** 계절을 타는 날씨 이유(§7-3 cold-hands: 쌀쌀한 아침 = 비 오는 아침·겨울 아침)는 겨울 판(1월 1일 시작)에서도 잰다. */
export const WINTER_START_MS = 1798761600000; // 2027-01-01T00:00Z
/** 비가 가장 잦은 여름 판(7월 1일 시작) — 날씨 순간 카드를 그 계절로도 잰다. */
export const SUMMER_START_MS = 1814400000000; // 2027-07-01T00:00Z
/** 마음 표의 이유(주민:이유) — W4가 켠 것과 W5의 카드·이웃 일·밤샘 이유. */
export const MOOD_REASONS = Object.freeze(plan.RESIDENT_IDS.flatMap(npc => [...new Set(plan.RESIDENT_BY_ID[npc].moods.map(m => `${npc}:${m.tag}`))]));
/** 날씨·계절 카드(비 시작·비 그침·비 갠 뒤·계절의 잎)는 겨울 판에서도 잰다(§2-10 「날씨·계절 카드는 계절을 따로」). */
const SEASONAL = new Set(CARDS.filter(c => ['rain-start', 'rain-stop', 'after-rain', 'season-leaf'].includes(c.trigger.kind)).map(c => c.id));
const RAIN_MOMENT = new Set(CARDS.filter(c => ['rain-start', 'rain-stop', 'after-rain'].includes(c.trigger.kind)).map(c => c.id));
/** 「나와 함께」로만 나오는 이유는 매일 와서 다 받는 모습에서 잰다. */
const WITH_PLAYER = new Set(['with-player-glad']);
/** The mood reasons C4's first brings while it waits for the player (§8-4 ③ — the cafe owner lingering by the menu board). */
const FIRST_WAIT = new Set(['new-menu']);
/** 밤 습관을 고리와 함께 사는 밤에만 마을(첫 시간대의 앞 씨앗 넷 — CI 시간 몫). */
const HABIT_SEEDS = new Set(villageSeeds(4));
/** §15-1 기운: 한 달에 한 번도 안 생기거나 매일 생기면 값을 다시 맞추는 쉼 신호 — 카드 둘과 마음 한 줄의 이유 둘. */
export const REST_SIGNALS = Object.freeze(['C6', 'R6', 'rest-poor', 'sleepy-night']);
/** 마을을 바꾸지 않는 방문 모습 — 한 마을 삶을 함께 보고, 방문마다 본 변화를 센다(W11). */
const WATCHED = Object.freeze(['daily-random', 'night-only', 'away-7']);
/** 「본 것」 장부에서 시뮬레이션이 셀 수 있는 열쇠(§20-10): 카드의 길 셋, 마음 한 줄, 채집 물건 — 내용 목록(seen.mjs contentCatalog)을
 * 거친 것만. 쌍 장면·대화 결과·찻잔 판은 화면이 보고하는 열쇠라 여기서 세지 않는다. */
const SEEN_CATALOG = (() => {
  const items = [...GATHERED.keys()], lines = MOOD_LINES.map(line => line.id), known = contentCatalog({ cards: SEEN_CARD_IDS, items, lines });
  return new Set([...SEEN_CARD_IDS.flatMap(card => ['self', 'pair', 'player'].map(path => `card:${card}:${path}`)),
    ...lines.map(id => `line:${id}`), ...items.map(item => `gather:${item}`)].filter(known));
})();

export const TOWN_RUNTIME = Object.freeze({
  name: 'town-w5',
  cache: new Map(),
  life(args, accept = false, { habits = false, gather = false } = {}) {
    // Watching what changed meanwhile only reads the village, so the shared life of the first zone carries the away profile's
    // visits as its watch points (W6) at no extra life.
    const watch = !accept && !habits && !gather && Array.isArray(args.watchVisits);
    // W11: a life of its own counts its own visits' changes; the shared life counts every profile that leaves it as it is.
    const watchSets = accept || habits || gather ? { [args.profile]: args.visits } : args.watchSets ?? null;
    const key = `${args.villageSeed}|${args.tzOffsetMin}|${args.startMs}|${args.days}|${accept}|${habits}|${watch}|${gather}|${!!watchSets}`;
    if (!this.cache.has(key)) this.cache.set(key, lifeOfVillage({ ...args, visits: watch ? args.watchVisits : accept || habits || gather ? args.visits : [], accept, habits, watch, gather, watchSets }));
    return this.cache.get(key);
  },
  createVillage(args) { return { args, visits: [] }; },
  visit(village, visit) { village.visits.push(visit); return { changes: [] }; },
  // A profile that never takes a card leaves the village as absence does (§15-2): one life for all of them — but a night
  // habit fills spots (§10-3), so a few night-only villages of the first time zone live with their ring (W6), and the
  // seven-day-away profile of the first zone is watched for what changed meanwhile (the CI budget keeps both to those).
  finish(village) {
    const { profile, firstZone, villageSeed } = village.args, args = { ...village.args, visits: village.visits };
    if (profile === 'daily-all') return this.life(args, true);
    if (profile === 'daily-gather') return this.life(args, false, { gather: true });
    if (profile === 'night-only' && firstZone && HABIT_SEEDS.has(villageSeed)) return this.life(args, false, { habits: true });
    return this.life(args);
  },
  measure(id, run) {
    // A village that lived with its ring (W6 night habit) is a life of its own in every invariant (GPT GB2).
    // A gathering village (W8b) is a life of its own too; the dead-card and player-path measures stay on profiles one to five.
    const lives = [...new Map(run.villages.map(v => [`${v.villageSeed}|${v.tzOffsetMin}|${v.profile === 'daily-all'}|${v.result.habits === true}|${v.result.gather === true}`, v.result])).values()];
    const plain = [...new Map(run.villages.filter(v => v.profile !== 'daily-all' && v.profile !== 'daily-gather').map(v => [`${v.villageSeed}|${v.tzOffsetMin}|${v.result.habits === true}`, v.result])).values()];
    const accept = [...new Map(run.villages.filter(v => v.profile === 'daily-all').map(v => [`${v.villageSeed}|${v.tzOffsetMin}`, v.result])).values()];
    const sum = (key, list = lives) => list.reduce((n, life) => n + life[key], 0);
    const per = (key, npc) => lives.reduce((n, life) => n + (life[key][npc] || 0), 0);
    // W11: the first village (its seed, zone, profile and life day) where an invariant broke — the replay a failure names.
    const repro = (...keys) => {
      for (const v of run.villages) for (const key of keys) if (v.result.first && Object.hasOwn(v.result.first, key)) return `${v.villageSeed} · ${zoneName(v.tzOffsetMin)} · ${v.profile} · ${v.result.first[key] + 1}생활일`;
      return null;
    };
    const habitLives = run.villages.filter(x => x.result.habits === true).map(x => x.result);
    const season = startOf => [...new Set(run.villages.map(v => v.villageSeed))].map(villageSeed => this.life({ villageSeed, tzOffsetMin: run.timezones[0],
      startMs: firstLifeDayStart(run.timezones[0], startOf), days: run.days }));
    const winter = () => season(WINTER_START_MS);
    if (id === 'energy') {
      const rows = plan.RESIDENT_IDS.map(npc => ({ npc, share: per('belowMinutes', npc) / Math.max(1, per('awakeMinutes', npc)), week: per('belowDays', npc) / (lives.length * run.days) * 7 }));
      // W11: the rest signals stand some days and not every day (§15-1 — the month-without measure is card-coverage's and
      // mood-lines' alive share; here the share of villages where one never stood, and those where it stood every day).
      const signals = REST_SIGNALS.map(signal => ({ signal, never: lives.filter(life => !life.restDays[signal]).length / Math.max(1, lives.length),
        daily: lives.filter(life => (life.restDays[signal] || 0) >= run.days).length, days: lives.reduce((n, life) => n + (life.restDays[signal] || 0), 0) / Math.max(1, lives.length) }));
      const ok = rows.every(r => r.share <= 0.15) && signals.every(s => s.daily === 0);
      return { status: ok ? 'pass' : 'fail', value: `${rows.map(r => `${plan.RESIDENT_BY_ID[r.npc].label} ${percent(r.share * 1000, 1000)}%·주 ${r.week.toFixed(1)}일`).join(' · ')}`
        + ` · 쉼 신호(마을 30일 평균 생긴 날 · 한 번도 없는 마을 · 매일인 마을) ${signals.map(s => `${s.signal} ${s.days.toFixed(1)}일·${Math.round(s.never * 100)}%·${s.daily}`).join(' · ')}`,
        detail: signals.filter(s => s.daily).map(s => `${s.signal} 매일인 마을 ${s.daily}`).join(', ') };
    }
    if (id === 'mood-lines') {
      // 겨울 판: 같은 씨앗을 첫 시간대에서 1월부터 — 계절을 타는 이유는 두 판 가운데 하나에서 뜨면 산 것으로 본다.
      const cold = winter();
      const alive = MOOD_REASONS.map(key => {
        const among = list => list.filter(life => life.moods[key]).length / Math.max(1, list.length);
        // A reason only a card done with the player brings is counted where that resident did one (§7-3 with-player-glad).
        const [npc, tag] = key.split(':');
        // A reason only C4's waiting first brings is counted where it waited (§8-4 ③ new-menu — the gathering profile stays and never takes it).
        // With no life where it waited (a small run), the reason is not measured.
        if (FIRST_WAIT.has(tag)) { const waited = lives.filter(life => life.c4.waitDays > 0); return waited.length ? { key, share: among(waited), bar: MOOD_ALIVE_SHARE } : null; }
        return { key, share: WITH_PLAYER.has(tag) ? among(accept.filter(life => life.playerBy[npc])) : Math.max(among(plain), among(cold)), bar: WITH_PLAYER.has(tag) ? WITH_PLAYER_ALIVE_SHARE : MOOD_ALIVE_SHARE };
      });
      const measured = alive.filter(Boolean), dead = measured.filter(a => a.share < a.bar), maxPerDay = Math.max(...lives.map(l => l.moodsMaxPerDay), ...cold.map(l => l.moodsMaxPerDay));
      const overCap = sum('reasonsOverCap') / Math.max(1, sum('residentDays'));
      const ok = !dead.length && maxPerDay <= paramsFor().state.moodLinesPerDay && overCap <= 0.01;
      return { status: ok ? 'pass' : 'fail', value: `가장 드문 이유 ${measured.sort((a, b) => a.share - b.share).slice(0, 2).map(a => `${a.key} ${Math.round(a.share * 100)}%`).join('·')} · 하루 최대 ${maxPerDay}줄 · 상한 전 넷 넘은 날 ${percent(overCap * 1000, 1000)}%`,
        detail: dead.map(a => `${a.key} ${Math.round(a.share * 100)}%`).join(', ') };
    }
    if (id === 'cards') {
      const ok = sum('capOver') === 0 && sum('cooldownOver') === 0 && sum('playerPaths', plain) === 0 && sum('playerPaths', accept) > 0;
      return { status: ok ? 'pass' : 'fail', value: `상한 넘김 ${sum('capOver')} · 쿨다운 넘김 ${sum('cooldownOver')} · 플레이어 없이 나와 함께 ${sum('playerPaths', plain)} · 다 받는 모습의 나와 함께 ${sum('playerPaths', accept)}`,
        repro: ok ? null : repro('capOver', 'cooldownOver', 'playerPath') };
    }
    // W11 (§15-1 카드 「플레이어 행동으로 오른 마모 0」): in every life a thing wears by its resident's own routine and nothing else.
    if (id === 'wear-owner') {
      const by = list => list.reduce((n, life) => n + life.wearByPlayer, 0), pieces = list => list.reduce((n, life) => n + life.wearByPlayerPieces, 0);
      return { status: by(lives) === 0 && pieces(lives) === 0 ? 'pass' : 'fail',
        value: `플레이어 몫 마모 ${by(lives)}(밤 습관 마을 ${by(habitLives)} · 다 받는 마을 ${by(accept)}) · 플레이어가 만든 조각을 하나씩 엔진에 넣어 오른 마모 ${pieces(lives)}`, repro: repro('wearByPlayer') };
    }
    if (id === 'hearsay') return { status: sum('playerSpread') === 0 && sum('heardOver') === 0 ? 'pass' : 'fail', value: `퍼진 플레이어 사건 ${sum('playerSpread')} · 하루 들은 것 넘김 ${sum('heardOver')}`, repro: repro('playerSpread', 'heardOver') };
    if (id === 'pairs') {
      const ok = sum('scenesOverDays') === 0 && sum('stepDown') === 0 && sum('scenes') > 0;
      return { status: ok ? 'pass' : 'fail', value: `쌍 장면 넘은 날 ${sum('scenesOverDays')} · 내려간 단계 ${sum('stepDown')} · 마을 하루 쌍 장면 ${(sum('scenes') / Math.max(1, lives.length * run.days)).toFixed(1)}`, repro: repro('scenesOverDays', 'stepDown') };
    }
    if (id === 'card-coverage') {
      // C4's first rise is the player's (§8-4): it is counted where the player comes daily and takes what rises; c4-first sees its rule.
      const cold = winter(), warm = season(SUMMER_START_MS), live = cards.CARD_IDS.filter(card => !cardsById[card].locked).map(card => {
        const among = list => list.filter(life => life.rose[card]).length / Math.max(1, list.length);
        if (card === 'C4') return { card, share: among(accept), bar: CARD_ALIVE_SHARE };
        return { card, share: SEASONAL.has(card) ? Math.max(among(plain), among(cold), among(warm)) : among(plain), bar: RAIN_MOMENT.has(card) ? RAIN_CARD_ALIVE_SHARE : CARD_ALIVE_SHARE };
      });
      const dead = live.filter(c => c.share < c.bar);
      return { status: dead.length ? 'fail' : 'pass', value: `가장 드문 카드 ${live.sort((a, b) => a.share - b.share).slice(0, 3).map(c => `${c.card} ${Math.round(c.share * 100)}%`).join('·')} · C4(매일 와서 다 받는 마을) ${Math.round(live.find(c => c.card === 'C4').share * 100)}%`,
        detail: dead.map(c => `${c.card} ${Math.round(c.share * 100)}%`).join(', ') };
    }
    // W11 → 첫 C4 고침(§15-1 카드 발생 · §8-4): C4's first rises at the player's first stay with the cafe owner and is the
    // player's — never solved by her alone or the two of them; a village that never takes it still has it waiting at the end;
    // a village where the player only stays home never has it (§15-2 ②).
    if (id === 'c4-first') {
      const staying = lives.filter(life => life.c4.stay), gathering = staying.filter(life => life.gather);
      const atStay = staying.filter(life => life.c4.rose && life.c4.rose.atMs >= life.c4.stay.atMs && life.c4.rose.atMs < life.c4.stay.toMs).length;
      // The visit it rose in is the first visit where the cafe owner was up for the player to go to (the profile that takes every card).
      const takers = run.villages.filter(x => x.profile === 'daily-all' && x.result.c4.stay), firstVisit = takers.filter(x => x.result.c4.stay.day === x.visits[0].lifeDayIndex).length;
      const homeRose = plain.filter(life => life.c4.rose).length, waits = gathering.filter(life => life.c4.waiting).length;
      const without = lives.filter(life => life.c4.solved && life.c4.solved.path !== 'player'), byPath = path => without.filter(life => life.c4.solved.path === path).length;
      // §8-4 ③: while the first waits its owner lingers by the menu board at most once a life day (when in it, the clock time);
      // §8-4 둘째 회: once done with the player the general rule raises C4 again — hers, solved alone, by two or with the player.
      const waitDays = lives.reduce((n, life) => n + life.c4.waitDays, 0), lingerDays = lives.reduce((n, life) => n + life.c4.lingerDays, 0);
      const lingerOver = lives.reduce((n, life) => n + life.c4.lingerOver, 0), at = lives.flatMap(life => life.c4.lingerAt).sort((a, b) => a - b);
      const clockOf = m => `${String(Math.floor((m + 300) / 60) % 24).padStart(2, '0')}:${String((m + 300) % 60).padStart(2, '0')}`, q = k => (at.length ? clockOf(at[Math.floor((at.length - 1) * k)]) : '-');
      const played = accept.filter(life => life.c4.solved?.path === 'player'), again = played.filter(life => life.c4.again > 0).length;
      const againBy = path => played.reduce((n, life) => n + (life.c4.againPaths[path] || 0), 0);
      const ok = staying.length > 0 && atStay === staying.length && without.length === 0 && homeRose === 0 && waits === gathering.length
        && lingerOver === 0 && (!played.length || again > 0);
      const first = run.villages.find(x => x.result.c4.solved && x.result.c4.solved.path !== 'player')
        ?? run.villages.find(x => x.result.c4.stay && !(x.result.c4.rose?.atMs >= x.result.c4.stay.atMs && x.result.c4.rose.atMs < x.result.c4.stay.toMs));
      return { status: ok ? 'pass' : 'fail', value: `주인과 처음 머문 때 선 C4 ${atStay}/${staying.length}(그 방문이 첫 방문인 마을 ${percent(firstVisit, takers.length)}% — 나머지는 첫 방문 때 주인이 잠) · 집에만 머문 삶에 선 C4 ${homeRose} · 받지 않은 마을에서 끝까지 기다림 ${waits}/${gathering.length} · 첫 C4가 플레이어 없이 풀린 삶 ${without.length}/${lives.length}(혼자 ${byPath('self')} · 둘이 ${byPath('pair')})`
        + ` · 서성임: 기다린 날 ${waitDays}일 가운데 ${lingerDays}일(${percent(lingerDays, waitDays)}%) · 하루 두 번 넘게 ${lingerOver} · 시각 ${q(0.25)}·${q(0.5)}·${q(0.75)}(사분위)`
        + ` · 둘째 회: 첫 회를 마친 다 받는 마을 ${played.length}개 가운데 다시 선 마을 ${again}개(${percent(again, played.length)}%) — 혼자 ${againBy('self')} · 둘이 ${againBy('pair')} · 나와 함께 ${againBy('player')}`,
        repro: first ? `${first.villageSeed} · ${zoneName(first.tzOffsetMin)} · ${first.profile} · ${(first.result.c4.solved ?? first.result.c4.stay).day + 1}생활일` : repro('lingerOver') };
    }
    if (id === 'meetable-residents') {
      // W11: a village whose night habit stands keeps someone up until 02:00 (the first zone's night-only villages that live with it).
      const ok = sum('meetableShortMinutes') === 0 && (!habitLives.length || habitLives.every(life => life.habitNights > 0) && sum('habitNightShort', habitLives) === 0);
      return { status: ok ? 'pass' : 'fail', value: `둘 미만인 분 ${sum('meetableShortMinutes')} · 밤 습관 밤 ${sum('habitNights', habitLives)}개에서 23:30~02:00 아무도 없는 분 ${sum('habitNightShort', habitLives)}`, repro: repro('meetable', 'habitNight') };
    }
    if (id === 'places-per-day') return { status: sum('placeShortDays') === 0 ? 'pass' : 'fail', value: `셋 미만 ${sum('placeShortDays')}/${sum('placeDays')}(${percent(sum('placeShortDays'), sum('placeDays'))}%)`, repro: repro('places') };
    if (id === 'routine-variety') { const short = routineVariety(); return { status: short.length ? 'fail' : 'pass', value: short.length ? short.join(' · ') : '모든 칸 셋 이상', detail: short.join(', ') }; }
    if (id === 'repetition') {
      // W11: and the same mood line never twice in a resident's life day.
      const ok = sum('repeats') === 0 && sum('sameOrder') <= sum('orderPairs') * 0.1 && sum('moodTwice') === 0;
      return { status: ok ? 'pass' : 'fail', value: `바로 이은 반복 ${sum('repeats')} · 이틀 같은 순서 ${percent(sum('sameOrder'), sum('orderPairs'))}% · 하루 두 번 선 마음 줄 ${sum('moodTwice')}`, repro: ok ? null : repro('repeats', 'moodTwice', 'sameOrder') };
    }
    if (id === 'rain-outside') return { status: sum('rainOutside') === 0 ? 'pass' : 'fail', value: `비 맞은 바깥 조각 ${sum('rainOutside')}`, repro: repro('rainOutside') };
    // W11 (§15-1): every visiting profile's 30-minute visits — at least one change in 95% of them, two on average.
    if (id === 'visible-change') {
      const rows = PROFILES.filter(p => p !== 'absent' && run.profiles.includes(p)).map(profile => {
        const tallies = run.villages.filter(x => x.profile === profile).map(x => x.result.visible?.[profile]).filter(Boolean);
        const n = key => tallies.reduce((total, t) => total + t[key], 0), kinds = {};
        for (const t of tallies) for (const [kind, k] of Object.entries(t.kinds)) kinds[kind] = (kinds[kind] || 0) + k;
        const bands = {};
        for (const t of tallies) for (const [band, x] of Object.entries(t.bands)) for (const [key, k] of Object.entries(x)) (bands[band] ||= {})[key] = (bands[band][key] || 0) + k;
        return { profile, visits: n('visits'), one: n('one'), changes: n('changes'), strictOne: n('strictOne'), strictChanges: n('strictChanges'), kinds, bands };
      }).filter(r => r.visits);
      const total = key => rows.reduce((n, r) => n + r[key], 0), visits = total('visits'), one = total('one'), changes = total('changes');
      // By the visit's band (조율 10-30: the report shows the strict count and the bands beside the reading that passes).
      const bandRow = band => { const x = key => rows.reduce((n, r) => n + (r.bands[band]?.[key] || 0), 0); return x('visits') ? `${BAND_WORD[band]} ${percent(x('one'), x('visits'))}%·엄격 ${percent(x('strictOne'), x('visits'))}%` : null; };
      const ok = visits > 0 && one / visits >= 0.95 && changes / visits >= 2;
      return { status: ok ? 'pass' : 'fail', value: `하나 이상인 방문 ${percent(one, visits)}% · 평균 ${(changes / Math.max(1, visits)).toFixed(1)}`
        + `(방문 안에서 생긴 것과 새 소식만 세면 ${percent(total('strictOne'), visits)}% · ${(total('strictChanges') / Math.max(1, visits)).toFixed(1)}) · 구간별 ${clock.BAND_IDS.map(bandRow).filter(Boolean).join(' · ')}`
        + ` · ${rows.map(r => `${r.profile} ${percent(r.one, r.visits)}%·${(r.changes / r.visits).toFixed(1)}`).join(' · ')}`,
        detail: rows.map(r => `${r.profile}: ${Object.entries(r.kinds).sort((a, b) => b[1] - a[1]).map(([kind, k]) => `${kind} ${(k / r.visits).toFixed(2)}`).join(' ')}`).join(' / '),
        repro: ok ? null : repro(...rows.map(r => `visible:${r.profile}`)) };
    }
    // W11 (§20-10, 잴 것만): what the seen ledger gains a visit and what is still new on the thirtieth day.
    if (id === 'seen-new') {
      const rows = PROFILES.filter(p => p !== 'absent' && run.profiles.includes(p)).map(profile => {
        const ledgers = run.villages.filter(x => x.profile === profile).map(x => x.result.seen?.[profile]).filter(Boolean);
        const n = key => ledgers.reduce((total, s) => total + s[key], 0);
        return { profile, visits: n('visits'), added: n('added'), left: n('left') / Math.max(1, ledgers.length) };
      }).filter(r => r.visits);
      return { status: 'measure', value: `열쇠 ${SEEN_CATALOG.size}개 중 · ${rows.map(r => `${r.profile} 방문당 처음 ${(r.added / r.visits).toFixed(2)}·30일째 남은 새 것 ${r.left.toFixed(0)}`).join(' · ')}` };
    }
    // W11 (§20-10, 잴 것만): the share of a less-often card's rises still offered, against the version's lessOftenMultiplier ‰.
    if (id === 'less-often') {
      const rises = accept.reduce((n, life) => n + life.less.rises, 0), offered = accept.reduce((n, life) => n + life.less.offered, 0);
      return { status: 'measure', value: `제안 ${offered}/${rises}(${percent(offered, rises)}%) · 판 값 ${paramsFor().prefs.lessOftenMultiplier / 10}% · 직접 열기·수첩 목록은 그대로(tests/town-prefs.test.js)` };
    }
    // W11 (§15-1 끝 · 다리 §9, 잴 것 넷만 정함): the three virtual learners on the daily visits of the first zone.
    if (id === 'learners') {
      const rows = runLearners(run.villages.filter(x => x.profile === 'daily-all').map(x => ({ villageSeed: x.villageSeed, visits: x.result.sceneVisits })));
      return { status: 'measure', value: rows.map(r => `${r.label}: 닿음 ${r.reachedShare}%(중앙 ${r.reachedMedian ?? '—'}·p90 ${r.reachedP90 ?? '—'}장면) · r+1 넘는 판 ${r.aboveShare}% · 제안 거절 ${r.declineShare}%(${r.offers}번) · 판 없어 내림 ${r.fallbacks}`).join(' / '), learners: rows };
    }
    // W6: 7일 비우고 돌아오는 모습(첫 시간대)의 돌아온 방문 — 줄은 셋까지, 금지 말 0, 줄이 선 방문이 있다(F20: 닫힌 구간이 있는 복귀만 셈).
    if (id === 'changes-summary') {
      const watched = run.villages.filter(x => x.profile === 'away-7' && x.tzOffsetMin === run.timezones[0]).map(x => x.result);
      const n = key => watched.reduce((total, life) => total + life[key], 0), max = Math.max(0, ...watched.map(life => life.linesMax));
      const ok = n('returns') > 0 && n('returnsWithLines') > 0 && max <= paramsFor().meanwhile.lines && n('linesBad') === 0;
      return { status: ok ? 'pass' : 'fail', value: `돌아온 방문 ${n('returns')} · 줄 선 방문 ${percent(n('returnsWithLines'), n('returns'))}% · 가장 많은 줄 ${max} · 금지 말 ${n('linesBad')}` };
    }
    // W6: 밤에만 오는 마을(첫 시간대 앞 씨앗 넷)에 밤 습관이 서고 그 조각이 있으며, 플레이어가 만든 일과의 나쁜 쪽 변화가 0.
    if (id === 'visit-habit') {
      const nights = run.villages.filter(x => x.profile === 'night-only' && x.tzOffsetMin === run.timezones[0] && HABIT_SEEDS.has(x.villageSeed)).map(x => x.result);
      const n = key => nights.reduce((total, life) => total + life[key], 0), formed = nights.filter(life => life.habitBands > 0).length;
      const ok = nights.length > 0 && formed === nights.length && n('habitSegments') > 0 && n('habitWorse') === 0;
      return { status: ok ? 'pass' : 'fail', value: `습관이 선 마을 ${formed}/${nights.length} · 습관 구간 ${n('habitBands')} · 습관 조각 ${n('habitSegments')} · 나쁜 쪽 ${n('habitWorse')}` };
    }
    // W8b: the gathering villages pick what grows and give it — the jar wears less and C3 rises no more often than in the
    // same seeds' villages that never gather (§20-8; the dead-card measure stays on the others), nothing over a line's limit.
    if (id === 'gather') {
      if (!run.profiles.includes('daily-gather')) return { status: 'pending', value: '채집 모습 없이 돈 판' };
      const pairs = run.villages.filter(x => x.profile === 'daily-gather')
        .map(x => ({ g: x.result, p: run.villages.find(y => y.profile === 'daily-random' && y.villageSeed === x.villageSeed && y.tzOffsetMin === x.tzOffsetMin)?.result })).filter(r => r.p);
      const g = pairs.map(r => r.g), p = pairs.map(r => r.p), n = (list, key) => list.reduce((total, life) => total + life[key], 0);
      const c3 = list => list.reduce((total, life) => total + (life.rose.C3 || 0), 0), wear = list => n(list, 'jarWear') / Math.max(1, n(list, 'jarBands'));
      // The jar must be seen to wear less where it wears at all (backend review GB2); C3 may only come as often or less.
      const ok = pairs.length > 0 && n(g, 'picked') > 0 && n(g, 'relief') > 0 && c3(g) <= c3(p) && (wear(p) > 0 ? wear(g) < wear(p) : wear(g) === 0)
        && n(g, 'gatherOver') === 0 && n(g, 'playerSpread') === 0;
      return { status: ok ? 'pass' : 'fail', value: `채집 마을 ${pairs.length} · 몫 쓴 비율 ${percent(n(g, 'picked'), n(g, 'growing'))}% · 잎 통 마모(구간 끝 평균) ${wear(g).toFixed(1)}(안 하는 마을 ${wear(p).toFixed(1)}) · C3 ${c3(g)}(안 하는 마을 ${c3(p)})` };
    }
    return undefined;
  },
});

/** 지표(§15-1·§20-10). 런타임이 runtime.measure(id, run) → { status: 'pass' | 'fail' | 'measure', value?, detail?, repro? }로 잰다.
 * 「측정」은 설계가 잴 것만 정하고 기준 숫자를 두지 않은 지표, 런타임이 아직 재지 못하는 지표는 「대기」다. bar는 보고서의 기준 칸이다. */
export const METRICS = Object.freeze([
  ['meetable-residents', '만날 수 있는 주민 수', '05:30~23:30의 모든 분에 둘 이상 · 밤 습관 마을은 02:00까지 하나 이상'],
  ['places-per-day', '주민별 하루 장소 수', '셋 이상(100%)'],
  ['routine-variety', '일과표 칸의 활동 수', '셋 이상(데이터 검사)'],
  ['visible-change', '30분 방문당 눈에 띄는 변화', '하나 이상인 방문 95% 이상 · 평균 둘 이상'],
  ['repetition', '같은 행동 반복', '바로 이은 같은 원형 0 · 이틀 같은 순서 10% 이하 · 같은 마음 줄 하루 두 번 0'],
  ['cards', '카드', '상한(주민 2·마을 4)·쿨다운 위반 0 · 플레이어 없이 「나와 함께」로 끝난 것 0'],
  ['wear-owner', '카드 — 마모 주인', '플레이어 행동으로 오른 마모 0(습관·약속·붙잡힘·카드 해결은 마모시키지 않는다)'],
  ['hearsay', '전해 듣기', '플레이어가 든 사건이 퍼진 것 0 · 들은 것 주민당 생활일 2건 이하'],
  ['pairs', '쌍', '쌍 장면 생활일 셋 이하 · 의견 차이 단계가 내려간 것 0'],
  ['changes-summary', '그동안 달라진 것', '1~3줄 · 금지 말 0'],
  ['visit-habit', '밤 습관(§10-3)', '밤에만 오면 습관이 서고 그 조각이 나쁜 쪽 변화를 만들지 않는다(G4)'],
  ['rain-outside', '비', '비 오는 동안 바깥 자리에 앉은 주민 0'],
  ['energy', '기운', '문턱 아래 시간 15% 이하 · C6·R6·rest-poor·sleepy-night가 매일 생긴 마을 0'],
  ['mood-lines', '마음 한 줄', '이유 태그마다 30일에 한 번 이상(마을 75%) · 하루 넷 이하'],
  ['card-coverage', '카드 발생', '18장마다 30일에 한 번 이상(마을 90%, 비 순간 카드는 그 계절 50%)'],
  ['c4-first', '첫 C4(§8-4)', 'C4 첫 회는 플레이어가 찻집 주인과 처음 머문 때 선다(첫 방문에 주인이 깨어 있으면 첫 방문) · 첫 C4가 플레이어 없이 혼자·둘이로 풀린 것 0 · 받지 않으면 기다린다 · 그동안 주인의 차림표 앞 서성임은 하루 한 번까지 · 플레이어와 마친 뒤에는 일반 규칙으로 다시 선다'],
  ['gather', '채집·드리기(여섯째 모습, §20-8)', '잎 통 마모가 줄고 C3가 더 잦지 않다 · 한도 넘김 0'],
  ['seen-new', '「본 것」 장부(§20-10)', '잴 것만 — 방문당 처음 보는 것 수 · 30일째 남은 새 것'],
  ['less-often', '「덜 추천」(§20-10)', '잴 것만 — 덜 추천한 카드의 제안 비율'],
  ['learners', '가상 학습자 셋(다리 §9)', '잴 것만 — r±0.5에 닿기까지 장면 수 · r+1 넘는 판 비율 · 제안 거절 비율 · 판 없어 내림'],
].map(([id, label, bar]) => Object.freeze({ id, label, bar })));
const BAND_WORD = Object.freeze({ morning: '아침', day: '낮', evening: '저녁', night: '밤' });
const zoneName = offset => `UTC${offset >= 0 ? '+' : '−'}${Math.abs(offset) / 60}`;
/** 알려진 실패(W11) — 잰 지표가 기준을 못 넘었고 고칠 길이 트랙에 있는 것. 보고서에는 실패로 쓰고, --check는 이것만 실패면 통과로
 * 끝낸다(기준은 그대로). 고쳐져 통과하면 --check가 「목록이 낡았다」로 실패하니 그때 이 줄을 지운다. */
export const KNOWN_FAILURES = Object.freeze({});
/** What a run's check says: the failures outside the known list, and the known ones that now pass (the list is stale). */
export function checkOutcome(result, known = KNOWN_FAILURES) {
  const failed = result.metrics.filter(m => m.status === 'fail').map(m => m.id);
  return { unknown: failed.filter(id => !Object.hasOwn(known, id)), stale: Object.keys(known).filter(id => result.metrics.some(m => m.id === id && m.status === 'pass')) };
}

export function canonicalJson(value) {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : item);
}
export const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');

export function runSimulation({ seeds = 100, days = 30, timezones = TIMEZONES, profiles = PROFILES, runtime = TOWN_RUNTIME, startMs = SIM_START_MS, only = null } = {}) {
  if (!Number.isSafeInteger(seeds) || seeds < 1 || !Number.isSafeInteger(days) || days < 1) throw new RangeError('seeds·days는 1 이상의 정수예요.');
  const villages = [];
  for (const villageSeed of villageSeeds(seeds)) for (const tzOffsetMin of timezones) {
    // W11: the profiles that leave the village as it is share its life, which counts what each of their visits saw change.
    const watchSets = Object.fromEntries(profiles.filter(p => WATCHED.includes(p)).map(p => [p, visitPlan(p, { villageSeed, tzOffsetMin, days, startMs })]));
    for (const profile of profiles) {
      // The profile that takes every card is measured in the first time zone: what it shows (cards with the player, their
      // gladness, what stays private) does not turn on the zone, and every other profile already runs in all four (W5).
      if (profile === 'daily-all' && tzOffsetMin !== timezones[0]) continue;
      // The gathering profile lives apart in the first zone's first seeds only, as the night habit does (the CI budget, W8b).
      if (profile === 'daily-gather' && !(tzOffsetMin === timezones[0] && HABIT_SEEDS.has(villageSeed))) continue;
      const visits = visitPlan(profile, { villageSeed, tzOffsetMin, days, startMs });
      const firstZone = tzOffsetMin === timezones[0];
      const village = runtime.createVillage({ villageSeed, tzOffsetMin, profile, startMs: firstLifeDayStart(tzOffsetMin, startMs), days, firstZone, watchSets,
        // W6: the first zone's shared life is watched at the seven-day-away profile's visits (what changed meanwhile).
        ...(firstZone && profiles.includes('away-7') ? { watchVisits: visitPlan('away-7', { villageSeed, tzOffsetMin, days, startMs }) } : {}) });
      const observed = visits.map(visit => ({ ...visit, ...runtime.visit(village, visit) }));
      villages.push({ villageSeed, tzOffsetMin, profile, visits: observed, result: runtime.finish(village) });
    }
  }
  const run = { runtime: runtime.name, seeds, days, timezones: [...timezones], profiles: [...profiles], villages };
  // only: the metrics a run measures (the rest wait) — a small run for one measure skips the season lives the others read.
  const metrics = METRICS.map(metric => ({ id: metric.id, label: metric.label, bar: metric.bar, ...((!only || only.includes(metric.id)) && runtime.measure?.(metric.id, run) || { status: 'pending' }) }));
  const hash = sha256(canonicalJson({ villages, metrics }));
  return { ...run, metrics, hash };
}

export function summarize(result) {
  const count = status => result.metrics.filter(m => m.status === status).length;
  return { runtime: result.runtime, villages: result.villages.length, visits: result.villages.reduce((n, v) => n + v.visits.length, 0),
    pass: count('pass'), fail: count('fail'), measure: count('measure'), pending: count('pending'), hash: result.hash };
}

export const STATUS_WORD = Object.freeze({ pass: '통과', fail: '실패', measure: '측정', pending: '대기' });
const cell = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
/** The §15-1 table of a run, as markdown rows (the W11 report puts it beside §15-2~4, tools/town-acceptance.mjs). */
export function metricRows(result) {
  return ['| 지표 | 기준 | 판정 | 값 | 재현(씨앗 · 시간대 · 모습 · 생활일) |', '|---|---|---|---|---|',
    ...result.metrics.map(m => `| ${cell(m.label)} | ${cell(m.bar)} | ${STATUS_WORD[m.status]}${m.status === 'fail' && KNOWN_FAILURES[m.id] ? '(알려진 — 트랙 후속)' : ''} | ${cell(m.value)}${m.detail ? ` — ${cell(m.detail)}` : ''} | ${m.status === 'fail' ? cell([m.repro, KNOWN_FAILURES[m.id]].filter(Boolean).join(' — ')) : ''} |`)];
}
/** The W11 acceptance report (qa/TOWN-SIM.md) holds the run's table between these marks; --report rewrites only that block. */
export const REPORT_FILE = path.join(ROOT, 'experiences/synk-town/qa/TOWN-SIM.md');
const MARKS = ['<!-- town-sim:start -->', '<!-- town-sim:end -->'];

function report(result) {
  const s = summarize(result);
  return [`# 싱크타운 시뮬레이션 보고서`, '', `런타임 ${s.runtime} · 마을 씨앗 ${result.seeds} × 시간대 ${result.timezones.length} × 플레이어 모습 ${result.profiles.length} = ${s.villages}개 마을 · ${result.days}생활일 · 방문 ${s.visits}번`,
    `결과 해시 \`${s.hash}\` · 통과 ${s.pass} · 실패 ${s.fail} · 측정 ${s.measure} · 대기 ${s.pending}`, '', ...metricRows(result), ''].join('\n');
}

function option(name, fallback) {
  const at = process.argv.indexOf(name);
  if (at < 0) return fallback;
  const value = Number(process.argv[at + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} 뒤에는 1 이상의 정수를 적어요.`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const started = performance.now();
  const result = runSimulation({ seeds: option('--seeds', 100), days: option('--days', 30) });
  if (process.argv.includes('--hash')) {
    // tzName shows which time zone this process really ran in (the result must not depend on it).
    console.log(JSON.stringify({ hash: result.hash, tzName: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  } else {
    const s = summarize(result), ms = Math.round(performance.now() - started);
    console.log(`싱크타운 시뮬레이션: 마을 ${s.villages}개 · 방문 ${s.visits}번 · 통과 ${s.pass} · 실패 ${s.fail} · 측정 ${s.measure} · 대기 ${s.pending} · ${ms}ms · ${s.hash.slice(0, 12)}`);
    for (const m of result.metrics.filter(m => m.status === 'fail')) console.log(`- 실패${KNOWN_FAILURES[m.id] ? '(알려진)' : ''}: ${m.label} — ${m.value}${m.detail ? ` — ${m.detail}` : ''}${m.repro ? ` (재현 ${m.repro})` : ''}`);
    if (process.argv.includes('--report')) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), report(result));
      fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), `${JSON.stringify({ summary: s, ms, metrics: result.metrics }, null, 2)}\n`);
      if (fs.existsSync(REPORT_FILE)) {
        const text = fs.readFileSync(REPORT_FILE, 'utf8'), at = text.indexOf(MARKS[0]), end = text.indexOf(MARKS[1]);
        if (at >= 0 && end > at) fs.writeFileSync(REPORT_FILE, `${text.slice(0, at + MARKS[0].length)}\n${report(result).split('\n').slice(2).join('\n')}${text.slice(end)}`);
      }
      console.log(`보고서: ${path.relative(ROOT, REPORT_DIR)}`);
    }
    // The check passes with only the known failures (each named above); a known one that now passes means its line is stale.
    const { unknown, stale } = checkOutcome(result);
    for (const id of stale) console.log(`- 알려진 실패 목록이 낡았어요: ${id}가 이제 통과해요 — tools/town-sim.mjs KNOWN_FAILURES에서 지워 주세요.`);
    if (unknown.length || stale.length) process.exitCode = 1;
  }
}
