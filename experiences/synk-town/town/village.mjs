/** The living village (vertical slice design §6-4·§6-5·§14-4, W3 integration): the band in progress,
 * the residents scenes hold, accepted promises and habits. A band's segments follow only from its
 * start state, its planCmdRev (the last command revision before it began), the reservations and
 * promises that touch it and the village seed — so when or how often a world is settled never changes
 * them (§15-3). Bands close inside settlement (town/settle.mjs close), after the old modules' steps.
 * Plain module: the caller gives the clock, the command revision and what the scenes hold.
 */
import { planBand, routeBetween, awakeWindow, RESIDENT_IDS, RESIDENT_BY_ID, ARCHETYPE_BY_ID, travelMs } from './plan.mjs';
import { bandAt, clockAt, lifeDayStartAt, recordOffset, validOffset, BAND_IDS, DAY } from './clock.mjs';
import { PLACE_BY_ID, SPOT_BY_ID } from './places.mjs';
import { paramsFor } from './params.mjs';
import { wake } from './state.mjs';
import { START_OBJECTS, CARD_BY_ID, validCards, validWear, validTraces, pairKeyOf } from './cards.mjs';
import { learnBand, morningNews, validKnowledge } from './knowledge.mjs';
// The generated data is read as a namespace: a browser still holding an older data.gen.mjs (the ten-minute cache)
// keeps its module links and only lacks the W5 tables, as the mood lines did in W4.
import * as DATA from './data.gen.mjs';
const PAIRS = DATA.PAIRS ?? [];

/** An absence longer than this starts again this far back (§10-1; W6 replaces the plain cut). */
export const ABSENCE_LIMIT_MS = 7 * DAY;
/** The most promises or habit spots a village keeps. */
export const VILLAGE_MAX = 32;
/** The most reservations: a band (six hours) keeps the closed holds its plan is made from, and every open one. */
export const RESERVATIONS_MAX = 128;
const USES_KEPT = 4;

export const initialVillage = () => ({ seed: null, tz: [], band: null, reservations: [], promises: [], habits: {}, agreement: null });

const integer = n => Number.isSafeInteger(n) && n >= 0, time = Number.isSafeInteger;
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const npcId = value => RESIDENT_IDS.includes(value);
const spotId = value => typeof value === 'string' && Object.hasOwn(SPOT_BY_ID, value);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
// The mood tags a resident's table names (§7-3) — moodsToday holds only those, at most a day's worth.
const MOOD_TAGS = Object.freeze(Object.fromEntries(RESIDENT_IDS.map(npc => [npc, new Set(RESIDENT_BY_ID[npc].moods.map(m => m.tag))])));
const CHORES_EVERY = Math.max(1, ...Object.values(ARCHETYPE_BY_ID).map(a => a.choresEvery || 1));
/** A resident's band-start summary. The W4 state fields may be absent (an old world reads the waking values). */
function validResidents(residents) {
  const s = paramsFor().state, within = (n, max) => n === undefined || integer(n) && n <= max;
  return plain(residents) && Object.entries(residents).every(([npc, r]) => npcId(npc) && plain(r)
    && Array.isArray(r.recent) && r.recent.every(a => Object.hasOwn(ARCHETYPE_BY_ID, a) || a === 'pause')
    && Array.isArray(r.placesToday) && r.placesToday.every(p => typeof p === 'string')
    && (r.lastSpot === null || spotId(r.lastSpot)) && typeof r.firstOfDay === 'boolean'
    && within(r.energy, s.energyMax) && within(r.chores, s.choresMax) && within(r.social, s.socialMax) && within(r.choresTick, CHORES_EVERY - 1)
    && (r.moodsToday === undefined || Array.isArray(r.moodsToday) && r.moodsToday.length <= s.moodLinesPerDay
      && r.moodsToday.every(tag => MOOD_TAGS[npc].has(tag)) && new Set(r.moodsToday).size === r.moodsToday.length)
    // W5: the drawings shown today (R3), the day after a night of R4 (allNighter), a night of R4 not yet slept off (lateNight).
    && within(r.showsToday, 999) && [r.allNighter, r.lateNight].every(flag => flag === undefined || flag === true));
}
const TAKE_STATUS = Object.freeze(['with', 'paused', 'resolved', 'ended']);
/** The cards the player took (§8-3 나와 함께): its rise, when it was opened, how it stands, and once done its result. */
const validTakes = takes => takes === undefined || Array.isArray(takes) && takes.length <= paramsFor().cards.takesKept
  && takes.every(t => plain(t) && Object.hasOwn(CARD_BY_ID, t.card) && id(t.key) && integer(t.at) && TAKE_STATUS.includes(t.status)
    && (t.choice === undefined || t.choice === null || id(t.choice)) && (t.status !== 'resolved' || integer(t.resolvedAt) && t.resolvedAt >= t.at && id(t.ref))
    && (t.endAt === undefined || integer(t.endAt) && t.endAt >= t.at) && (t.eventId === undefined || /^E-\d+$/.test(t.eventId))
    && (t.open === undefined || typeof t.open === 'boolean') && (t.contactId === undefined || id(t.contactId)));
/** The pairs' long state (§9-1): their scenes by family, agreements, the small difference's step, when they last met. */
function validPairs(pairs) {
  const max = paramsFor().pairs.frictionMax;
  return plain(pairs) && Object.entries(pairs).every(([key, s]) => PAIRS.some(p => p.key === key) && plain(s) && plain(s.families)
    && Object.entries(s.families).every(([fam, f]) => id(fam) && plain(f) && integer(f.count) && f.count > 0 && integer(f.lastDay))
    && plain(s.agreements) && Object.entries(s.agreements).every(([card, value]) => Object.hasOwn(CARD_BY_ID, card) && id(value))
    && plain(s.friction) && id(s.friction.topic) && integer(s.friction.step) && s.friction.step <= max
    && (s.lastMet === null || plain(s.lastMet) && integer(s.lastMet.lifeDay) && BAND_IDS.includes(s.lastMet.band)));
}
const validMarks = m => plain(m) && ['newToolDay', 'scenesDay', 'scenes'].every(k => m[k] === undefined || integer(m[k])) && Object.keys(m).every(k => ['newToolDay', 'scenesDay', 'scenes'].includes(k));
export function validVillage(v) {
  if (!plain(v) || !(v.agreement === null || v.agreement === undefined || id(v.agreement)) || !(v.seed === null || typeof v.seed === 'string' && v.seed.length > 0 && v.seed.length <= 120)
    || !(v.sleeps === undefined || v.sleeps === true)) return false;
  if (!Array.isArray(v.tz) || v.tz.length > 4 || v.tz.some((z, i) => !plain(z) || !Number.isSafeInteger(z.fromMs) || !validOffset(z.offsetMin)
    || i > 0 && z.fromMs <= v.tz[i - 1].fromMs)) return false;
  const b = v.band;
  if (b !== null && !(plain(b) && time(b.lifeDay) && BAND_IDS.includes(b.band) && time(b.startMs) && time(b.endMs) && b.endMs > b.startMs
    && time(b.dayStartMs) && b.dayStartMs <= b.startMs && integer(b.planCmdRev) && validResidents(b.residents)
    && plain(b.objects) && Object.values(b.objects).every(o => plain(o) && spotId(o.spot))
    // W5 (§8·§9-1): the cards, the objects' wear and traces, the pairs and the day's marks — each absent in an old world.
    && (b.cards === undefined || validCards(b.cards)) && (b.wear === undefined || validWear(b.wear)) && (b.traces === undefined || validTraces(b.traces))
    && (b.pairs === undefined || validPairs(b.pairs)) && (b.marks === undefined || validMarks(b.marks)))) return false;
  if (!validTakes(v.takes) || !validKnowledge(v)) return false;
  if (!Array.isArray(v.reservations) || v.reservations.length > RESERVATIONS_MAX || !v.reservations.every(r => plain(r) && id(r.id) && npcId(r.npc)
    && integer(r.fromMs) && (r.toMs === null || integer(r.toMs) && r.toMs >= r.fromMs) && id(r.by) && spotId(r.spot)
    && (r.seat === undefined || spotId(r.seat))
    // W4 (§7-2): the scene reached its result with the player; help lightens the cafe owner's chores.
    && (r.with === undefined || r.with === true) && (r.help === undefined || r.with === true && integer(r.help) && r.help <= paramsFor().state.choresMax))) return false;
  if (new Set(v.reservations.map(r => r.id)).size !== v.reservations.length) return false;
  if (!Array.isArray(v.promises) || v.promises.length > VILLAGE_MAX || !v.promises.every(p => plain(p) && id(p.id) && npcId(p.npc)
    && Object.hasOwn(ARCHETYPE_BY_ID, p.archetype) && spotId(p.spot) && time(p.lifeDay) && BAND_IDS.includes(p.band))) return false;
  return plain(v.habits) && Object.entries(v.habits).every(([npc, list]) => npcId(npc) && Array.isArray(list) && list.length <= VILLAGE_MAX
    && list.every(h => plain(h) && spotId(h.spot) && Object.hasOwn(ARCHETYPE_BY_ID, h.archetype) && Array.isArray(h.uses)
      && h.uses.length <= USES_KEPT && h.uses.every(id) && new Set(h.uses).size === h.uses.length && typeof h.formed === 'boolean'));
}

/** The planner input for a band of the village, from what the world holds now. */
export function bandInput(v, b = v.band, visitEnd = null) {
  const clock = clockAt({ villageSeed: v.seed, hostNowMs: b.startMs, tz: v.tz });
  // A visit that ended ends the holds opened before it — read here, recorded only by the visit-end step.
  const toOf = r => (r.toMs === null && visitEnd !== null && r.fromMs <= visitEnd ? visitEnd : r.toMs);
  const touching = v.reservations.map(r => ({ ...r, toMs: toOf(r) })).filter(r => r.fromMs < b.endMs && (r.toMs === null || r.toMs > b.startMs));
  // A take opened before the visit ended ends with it, the same way (§8-3, review F8): read here, recorded by the visit-end step.
  const takes = (v.takes || []).filter(t => t.status === 'resolved' ? t.resolvedAt >= b.startMs && t.resolvedAt < b.endMs : (t.endAt ?? Infinity) > b.startMs)
    .map(t => (t.endAt === undefined && t.status !== 'resolved' && visitEnd !== null && t.at <= visitEnd ? { ...t, endAt: visitEnd } : t))
    .map(({ card, key, at, status, endAt, resolvedAt, choice }) => ({ card, key, at, status, ...(endAt !== undefined ? { endAt } : {}),
      ...(resolvedAt !== undefined ? { resolvedAt } : {}), ...(choice ? { choice } : {}) }));
  return { villageSeed: v.seed, lifeDay: b.lifeDay, band: b.band, startMs: b.startMs, endMs: b.endMs, dayStartMs: b.dayStartMs,
    planCmdRev: b.planCmdRev, weatherTomorrow: clock.weatherTomorrow, season: clock.season, visitHabit: null,
    residents: b.residents, objects: b.objects,
    // W5: the village the band starts from (absent in an old world: every card idle, nothing worn) and the player's takes.
    cards: b.cards || {}, wear: b.wear || {}, traces: b.traces || {}, pairs: b.pairs || {}, marks: b.marks || {}, takes,
    reservations: touching.map(r => ({ id: r.id, npc: r.npc, fromMs: r.fromMs, toMs: r.toMs, spot: r.spot, ...(r.by?.startsWith('card:') ? { by: r.by } : {}),
      ...(r.with ? { with: true, ...(r.help ? { help: r.help } : {}) } : {}) })),
    promises: v.promises.filter(p => p.lifeDay === b.lifeDay && p.band === b.band).map(p => ({ id: p.id, npc: p.npc, archetype: p.archetype, spot: p.spot })),
    habits: Object.fromEntries(Object.entries(v.habits).map(([npc, list]) => [npc, list.filter(h => h.formed).map(h => ({ spot: h.spot, archetype: h.archetype }))])),
    // A guest at the player's seat holds it while the use is reserved (§6-4 occupied).
    occupied: touching.filter(r => r.seat).map(r => ({ spot: r.seat, fromMs: r.fromMs, toMs: r.toMs ?? b.endMs })) };
}

// A pure planner's memo: views and settlements ask about the same band many times.
const planMemo = new Map();
/** The open band's plan (or another band's), the same however often it is asked. */
export function planOf(v, b = v.band, visitEnd = null) {
  const input = bandInput(v, b, visitEnd), key = JSON.stringify(input);
  if (!planMemo.has(key)) { if (planMemo.size >= 16) planMemo.delete(planMemo.keys().next().value); planMemo.set(key, planBand(input)); }
  return planMemo.get(key);
}

/** A new life day (§6-2·§7-1): places visited and moods shown today empty, the next choice is the first of the day,
 * and every resident wakes — energy back up, social toward its resting value, the workshop's new orders. The
 * simulation (tools/town-sim.mjs) turns its days with the same function. */
export function nextLifeDay(residents, { seed, lifeDay, atMs }) {
  return Object.fromEntries(Object.entries(residents || {}).map(([npc, r]) => {
    const { state } = wake(RESIDENT_BY_ID[npc], r, { seed, lifeDay, atMs });
    // A night of R4 is slept off on the next day only (§7-1 밤샘): it starts tired and the day is that night's.
    const { showsToday, allNighter, lateNight, ...rest } = r;
    return [npc, { ...rest, placesToday: [], firstOfDay: true, ...state, moodsToday: [], ...(lateNight ? { allNighter: true } : {}) }];
  }));
}

function openBand(v, atMs, planCmdRev, carried) {
  const w = bandAt(v.tz, atMs), sameDay = carried?.lifeDay === w.lifeDay;
  const residents = sameDay ? { ...carried.residents } : nextLifeDay(carried?.residents, { seed: v.seed, lifeDay: w.lifeDay, atMs: w.startMs });
  v.band = { lifeDay: w.lifeDay, band: w.band, startMs: w.startMs, endMs: w.endMs, dayStartMs: lifeDayStartAt(v.tz, w.startMs),
    planCmdRev, residents, objects: structuredClone(carried?.objects || START_OBJECTS),
    ...(carried?.village ? structuredClone(carried.village) : {}) };
  // A new life day opens with the last day's news (§9-3).
  if (carried && !sameDay) morningNews(v, carried.lifeDay);
}

/** The visit-end step (a recorded lease break): holds still open stop at the wall time the visit ended
 * (§14-3 P1). A break from before W3 has no wall time: its holds end where they began (deterministic). */
export function closeOpen(v, atMs) {
  for (const r of v.reservations) if (r.toMs === null && (atMs === null || r.fromMs <= atMs)) r.toMs = atMs === null ? r.fromMs : atMs;
}

/** A habit candidate { spot, npc? } holds for a resident: the agreed spot is the workshop owner's, the
 * player's seat anyone's — a resident resting at its own bench is not a trace of the player (§6-5). */
const candidateFor = (candidates, npc, spot) => candidates.some(c => c.spot === spot && (!c.npc || c.npc === npc));
/** A habit use (§6-5): a resident finished resting at a candidate spot in a band it had not used it in. */
function countUses(v, b, out, candidates) {
  const used = [];
  for (const s of out.segments) {
    if (s.archetype === 'reserved' || ARCHETYPE_BY_ID[s.archetype]?.kind !== 'rest' || s.arriveMs >= s.endMs || !candidateFor(candidates, s.npc, s.spot)) continue;
    const list = v.habits[s.npc] ||= [];
    let habit = list.find(h => h.spot === s.spot);
    if (!habit) { if (list.length >= VILLAGE_MAX) continue; habit = { spot: s.spot, archetype: s.archetype, uses: [], formed: false }; list.push(habit); }
    const key = `${b.lifeDay}:${b.band}`;
    if (habit.uses.includes(key)) continue;
    habit.uses = [...habit.uses, key].slice(-USES_KEPT);
    if (habit.uses.length >= 2) habit.formed = true;
    used.push({ npc: s.npc, spot: s.spot, archetype: s.archetype, lifeDay: b.lifeDay, band: b.band });
  }
  return used;
}

/** Record a use that happened in a scene the player saw (the first-day agreement's own rest, §6-5). */
export function recordUse(v, { npc, spot, archetype }) {
  if (!v.band || !spotId(spot)) return null;
  const list = v.habits[npc] ||= [];
  let habit = list.find(h => h.spot === spot);
  if (!habit) { if (list.length >= VILLAGE_MAX) return null; habit = { spot, archetype, uses: [], formed: false }; list.push(habit); }
  const key = `${v.band.lifeDay}:${v.band.band}`;
  if (habit.uses.includes(key)) return null;
  habit.uses = [...habit.uses, key].slice(-USES_KEPT);
  if (habit.uses.length >= 2) habit.formed = true;
  return { npc, spot, archetype, lifeDay: v.band.lifeDay, band: v.band.band };
}

/** Habit spots that no longer exist leave at once (§6-5); their uses stay in the event branch. */
export function keepHabitSpots(v, candidates) {
  for (const npc of Object.keys(v.habits)) {
    v.habits[npc] = v.habits[npc].filter(h => candidateFor(candidates, npc, h.spot));
    if (!v.habits[npc].length) delete v.habits[npc];
  }
}

/** Where a resident is at ms by place (§9-3 목격): the place it has arrived at, or the one it is leaving while it walks; null asleep. */
export function placeOfAt(segments, npc, ms, startSpots = {}) {
  const mine = segments.filter(s => s.npc === npc), i = mine.findIndex(s => s.startMs <= ms && ms < s.endMs);
  if (i < 0) return null;
  const s = mine[i], from = mine[i - 1]?.spot ?? startSpots[npc] ?? s.spot;
  return SPOT_BY_ID[ms < s.arriveMs ? from : s.spot].place;
}

/** Close every band that ended by nowMs and open the next one (§14-4 settle). visitEnds are the wall
 * time the current visit ended at when it has (visitEndAt reached, read only). Returns the habit uses the
 * closed bands made, with .resolved the cards the residents solved (W5), for the caller to record as town events. */
export function closeBands(v, { nowMs, seed, offsetMin, revision, visitEnd = null, candidates = [], sleeps = false }) {
  if (!integer(nowMs) || !integer(revision)) throw new TypeError('closeBands needs the clock and the command revision');
  if (v.seed === null) v.seed = seed;
  if (sleeps === true) v.sleeps = true; else delete v.sleeps;
  if (validOffset(offsetMin)) v.tz = v.tz.length ? recordOffset(v.tz, nowMs, offsetMin) : [{ fromMs: 0, offsetMin }];
  else if (!v.tz.length) v.tz = [{ fromMs: 0, offsetMin: 540 }];
  if (!v.band) openBand(v, nowMs, revision, null);
  const uses = [], resolved = [];
  while (v.band.endMs <= nowMs) {
    const b = v.band, out = planOf(v, b, visitEnd);
    uses.push(...countUses(v, b, out, candidates));
    // What the band's cards did reaches the village (§9-3): seen by whoever was there, passed on at the pair scenes.
    const startSpots = Object.fromEntries(Object.entries(b.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
    learnBand(v, { lifeDay: b.lifeDay, resolved: out.resolved, scenes: out.scenes }, (npc, ms) => placeOfAt(out.segments, npc, ms, startSpots));
    resolved.push(...out.resolved.filter(line => line.public).map(line => ({ ...line, lifeDay: b.lifeDay, band: b.band })));
    // A take that ended with the visit or was done leaves once its band has closed (the card has moved on).
    // A result still on screen stays until the player closes it.
    if (v.takes) v.takes = v.takes.filter(t => t.open || !(t.status === 'resolved' ? t.resolvedAt < b.endMs : t.endAt !== undefined && t.endAt <= b.endMs));
    // Promises kept in the band are done; one the rain put off moves to the next band (§4-5).
    const deferred = new Set(out.deferredPromises.map(p => p.id)), kept = new Set(out.segments.filter(s => s.promise).map(s => s.promise));
    const nextAt = nowMs - b.endMs > ABSENCE_LIMIT_MS ? nowMs - ABSENCE_LIMIT_MS : b.endMs;
    const next = bandAt(v.tz, nextAt);
    v.promises = v.promises.filter(p => !kept.has(p.id) && p.lifeDay >= next.lifeDay - 7)
      .map(p => (deferred.has(p.id) && p.lifeDay === b.lifeDay && p.band === b.band ? { ...p, lifeDay: next.lifeDay, band: next.band } : p));
    v.reservations = v.reservations.filter(r => r.toMs === null || r.toMs > b.endMs);
    openBand(v, nextAt, revision, { lifeDay: b.lifeDay, residents: out.residents, objects: out.objects,
      village: { cards: out.cards, wear: out.wear, traces: out.traces, pairs: out.pairs, marks: out.marks } });
  }
  // Not an own enumerable field: callers that compare the uses keep comparing only them.
  return Object.defineProperty(uses, 'resolved', { value: resolved });
}

/** Whether a resident is up at ms (its waking hours on that life day, §4-2). */
export function awakeAt(v, npc, ms) {
  if (!v.tz.length) return true;
  const w = bandAt(v.tz, ms), { wakeMs, sleepMs } = awakeWindow(npc, w.lifeDay, lifeDayStartAt(v.tz, ms));
  return wakeMs <= ms && ms < sleepMs;
}
/** Whether a scene may begin with a resident at ms (the night rule, §4-2 · 10-23 「밤 첫 방문 A」): a
 * village whose host keeps the residents' nights (sleeps) starts no scene with one asleep — it waits for
 * the morning. A village without it (a fixture store: its clock sits near 0, often UTC midnight) keeps
 * every scene open, so its tests never turn on the hour. A scene already begun finishes past bedtime. */
export function upFor(v, npc, ms) {
  return !v?.sleeps || !Number.isSafeInteger(ms) || awakeAt(v, npc, ms);
}

/** An accepted promise for the next life day's day band (§6-5 다음 날로 잇기). */
export function promiseTomorrow(v, { id: promiseId, npc, archetype, spot, nowMs }) {
  if (!v.tz.length || v.promises.some(p => p.id === promiseId)) return;
  v.promises = [...v.promises.filter(p => !(p.npc === npc && p.spot === spot)), { id: promiseId, npc, archetype, spot, lifeDay: bandAt(v.tz, nowMs).lifeDay + 1, band: 'day' }].slice(-VILLAGE_MAX);
}

/** Match the open reservations to the residents the scenes hold now (a command's end, §6-4):
 * held is { npc: { by, spot, seat?, toMs? } }. A new hold opens at nowMs, a released one ends there. */
export function holdResidents(v, held, nowMs, revision) {
  for (const r of v.reservations) {
    const now = held[r.npc];
    if (r.toMs === null && (!now || now.by !== r.by)) r.toMs = Math.max(r.fromMs, nowMs);
  }
  for (const [npc, hold] of Object.entries(held)) {
    if (v.reservations.some(r => r.npc === npc && r.by === hold.by && (r.toMs === null || r.toMs > nowMs))) continue;
    const r = { id: `R-${revision}-${npc}`, npc, fromMs: nowMs, toMs: hold.toMs ?? null, by: hold.by, spot: hold.spot, ...(hold.seat ? { seat: hold.seat } : {}) };
    if (v.reservations.some(x => x.id === r.id)) continue;
    v.reservations.push(r);
  }
  // Past the bound closed holds leave — first those over before this band began, then the oldest in it (a band's
  // plan keeps its history up to the bound; more holds than that in six hours give up the earliest). Never an open one.
  const over = r => r.toMs !== null && v.band && r.toMs <= v.band.startMs;
  for (const leaves of [over, r => r.toMs !== null]) {
    for (let i = 0; v.reservations.length > RESERVATIONS_MAX && i < v.reservations.length;) {
      if (leaves(v.reservations[i])) v.reservations.splice(i, 1); else i++;
    }
  }
}

/** Where a resident is at ms in a planned band (§14-4 — the screen runs the same function with the
 * server's clock): x, z on its walk, pose and the archetype. startSpots are where residents began the
 * band. Asleep, or outside the band → null. */
export function placeAt(segments, npc, ms, startSpots = {}) {
  const mine = segments.filter(s => s.npc === npc);
  const i = mine.findIndex(s => s.startMs <= ms && ms < s.endMs);
  if (i < 0) return null;
  const s = mine[i], from = mine[i - 1]?.spot ?? startSpots[npc] ?? s.spot;
  const walking = ms < s.arriveMs && from !== s.spot;
  const point = walking ? along(routeBetween(from, s.spot), (ms - s.startMs) / Math.max(1, s.arriveMs - s.startMs)) : SPOT_BY_ID[s.spot].at;
  return { npc, x: point.x, z: point.z, pose: walking ? 'walking' : ARCHETYPE_BY_ID[s.archetype]?.pose || 'standing',
    archetype: s.archetype, spot: s.spot, walking, to: SPOT_BY_ID[s.spot].place };
}
function along(points, t) {
  const legs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.z - points[i].z)), total = legs.reduce((a, b) => a + b, 0);
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < legs.length; i++) {
    if (left <= legs[i] || i === legs.length - 1) { const k = legs[i] ? Math.min(1, left / legs[i]) : 1; return { x: points[i].x + (points[i + 1].x - points[i].x) * k, z: points[i].z + (points[i + 1].z - points[i].z) * k }; }
    left -= legs[i];
  }
  return points.at(-1);
}

// What each archetype looks like in one line: [joined, final] (the caption joins residents, §6-6).
const DOING = Object.freeze({
  'prep-cups': ['잔을 데우고', '잔을 데워요'], brew: ['차를 우리고', '차를 우려요'], serve: ['손님을 맞고', '손님을 맞아요'],
  wipe: ['자리를 닦고', '자리를 닦아요'], 'bring-in': ['비품을 들이고', '비품을 들여요'], 'pick-leaves': ['잎을 따고', '잎을 따요'],
  'eaves-tea': ['처마 밑에서 차를 마시고', '처마 밑에서 차를 마셔요'], 'deliver-tea': ['공방에 차를 가져다주고', '공방에 차를 가져다줘요'],
  'night-tea': ['밤 찻집을 지키고', '밤 찻집을 지켜요'], 'menu-note': ['차림표를 손보고', '차림표를 손봐요'],
  'tool-care': ['도구를 손질하고', '도구를 손질해요'], craft: ['주문받은 물건을 만들고', '주문받은 물건을 만들어요'],
  'fix-round': ['이웃 물건을 살펴보고', '이웃 물건을 살펴봐요'], 'quiet-rest': ['조용한 자리에서 쉬고', '조용한 자리에서 쉬어요'],
  'breeze-lunch': ['바람 통하는 곳에서 점심을 먹고', '바람 통하는 곳에서 점심을 먹어요'], 'night-carve': ['밤에 조용히 나무를 깎고', '밤에 조용히 나무를 깎아요'],
  water: ['물을 주고', '물을 줘요'], observe: ['잎을 관찰하고', '잎을 관찰해요'], 'board-fold': ['관찰판을 정리하고', '관찰판을 정리해요'],
  'show-drawing': ['그림을 펼쳐 보이고', '그림을 펼쳐 보여요'], notes: ['관찰 기록을 쓰고', '관찰 기록을 써요'],
  'star-watch': ['별과 밤꽃을 보고', '별과 밤꽃을 봐요'], doze: ['꾸벅 졸고', '꾸벅 졸아요'], stroll: ['골목을 산책하고', '골목을 산책해요'],
  chat: ['이웃과 이야기하고', '이웃과 이야기해요'], pause: ['잠깐 숨을 고르고', '잠깐 숨을 골라요'], reserved: ['함께하는 일을 하고', '함께하는 일을 해요'],
});
const toward = place => { const word = PLACE_BY_ID[place]?.labels.text || '골목', code = word.charCodeAt(word.length - 1) - 0xac00, last = code >= 0 && code < 11172 ? code % 28 : 0;
  return `${word}${last === 0 || last === 8 ? '로' : '으로'}`; };
/** A resident's goal in a few words, from placeAt (null = asleep) — the text alternative's line. */
export function goalOf(at) {
  return at ? (at.walking ? '다음 자리로 걸어가기' : ARCHETYPE_BY_ID[at.archetype]?.label || '함께하는 일') : '잠자기';
}
/** One resident's line in two forms, from placeAt (null = asleep). */
export function doing(at) {
  if (!at) return ['자고', '자요'];
  if (at.walking) return [`${toward(at.to)} 가고`, `${toward(at.to)} 가요`];
  return DOING[at.archetype] || DOING.pause;
}
/** The background caption: every resident on one line ("찻집 주인은 차를 우리고, 연구원은 잎을 관찰해요."). */
export function caption(places) {
  const parts = RESIDENT_IDS.map(npc => [npc, places[npc]]).filter(([, at]) => at);
  if (!parts.length) return '모두 잠든 밤이에요. 골목이 조용해요.';
  return `${parts.map(([npc, at], i) => `${RESIDENT_BY_ID[npc].label}은 ${doing(at)[i === parts.length - 1 ? 1 : 0]}`).join(', ')}.`;
}
export { travelMs };
