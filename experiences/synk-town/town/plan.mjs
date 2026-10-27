/** Band planner (vertical slice design §6-4): who does what, where, during one band.
 * Pure and deterministic. Residents are planned together in time order (a min-heap on
 * decision time, ties in resident order) so a spot is never double-booked; each resident
 * draws from its own random stream. A decision event (a reservation, rain starting on
 * someone outside) re-plans only the resident it touches, from that instant, around
 * everyone else's fixed segments — so my time with the cafe owner never changes what the
 * researcher does. Weights and multipliers are per-mille integers (§2-4). Each choice
 * picks twice with the same u — from the base scores (weight, availability, habit,
 * personality, repetition) and from the chosen scores (those times weather, state and
 * card) — so a change of mind can be told from a routine choice (§7-3): a segment carries a
 * reason only when the two differ and the difference came from those multipliers, and its
 * mood line shows once a resident, reason and life day (W4). Residents' own state (energy,
 * chores, social — town/state.mjs) changes provisionally as segments are placed; the band's
 * close keeps what the same steps give over the final segments (§14-4). W5: small need cards
 * rise at their owner's decision times and are solved at the next (town/cards.mjs) — alone,
 * or with a neighbour who stops what it does and walks over; two residents at one place may
 * talk (a pair scene); everything they share (cards, wear, traces, objects, pairs) moves in
 * time order, and the band's results are read from its final segments by the same steps.
 * The first pass knows no reservation and no card the player took; a re-plan after one is
 * the held resident's alone, solves only alone and starts no pair scene (§2-1 rule H). Its
 * 〔초기값〕 come by name from a parameter version (§20-6): input.params, or the first version.
 */
import { ARCHETYPES, RESIDENTS, ROUTINES, RAIN_ALT } from './data.gen.mjs';
// The generated data is read as a namespace: a browser still holding an older data.gen.mjs (the ten-minute cache)
// keeps its module links and only lacks the W5 tables, as the mood lines did in W4.
import * as DATA from './data.gen.mjs';
import { PLACES, SPOT_BY_ID, SPOT_GROUPS, FT_SEATS } from './places.mjs';
import { createRng, pickByWeight } from './rng.mjs';
import { dayKindOf, weatherAt as clockWeatherAt, weatherChangesBetween, rainBetween, BANDS, MINUTE, DAY } from './clock.mjs';
import { paramsFor } from './params.mjs';
import { PER_MILLE, perMille, stateOf, running, keptState, bandEvents, advance, finishSegment, replay, stateFactors, stateCandidates, available, playerMade } from './state.mjs';
import { CARD_BY_ID, CARDS_OF, WEAR_THRESHOLDS, cardKey, statusOf, roseToday, villageStart, villageAfter, keptVillage, applySegment, applyTrigger, applyTake,
  triggerHolds, pairChosen, partnerMinutes, solvingSpot, takeCovers, sceneFree, frictionStep, pairKeyOf } from './cards.mjs';

const CHAT_SPOTS = DATA.CHAT_SPOTS ?? {};
export const ARCHETYPE_BY_ID = Object.freeze(Object.fromEntries(ARCHETYPES.map(a => [a.id, a])));
export const RESIDENT_BY_ID = Object.freeze(Object.fromEntries(RESIDENTS.map(r => [r.id, r])));
export const RESIDENT_IDS = Object.freeze(RESIDENTS.map(r => r.id));
const ROUTINE_BY_KEY = Object.freeze(Object.fromEntries(ROUTINES.map(r => [`${r.npc}|${r.dayKind}|${r.band}`, r])));

/** Stand-in when nothing in the pool can be done: a short pause at home (§6-4 막힘, NPC:397). */
const PAUSE = Object.freeze({ id: 'pause', kind: 'rest', pose: 'standing', energy: 0, chores: 0, social: 0 });
const mul = (score, perMille) => Math.floor(score * perMille / 1000);
const order = npc => RESIDENT_IDS.indexOf(npc);

export function dayKindFor(npc, lifeDay) {
  return dayKindOf(lifeDay, RESIDENT_BY_ID[npc].offWeekday);
}

/** Absolute wake and sleep for a life day that starts (my 05:00) at dayStartMs. */
export function awakeWindow(npc, lifeDay, dayStartMs, { visitHabit = null } = {}) {
  const r = RESIDENT_BY_ID[npc];
  const kind = dayKindFor(npc, lifeDay);
  const wake = r.habitWake?.[visitHabit] ?? (kind === 'off' && r.wake.off !== undefined ? r.wake.off : r.wake.default);
  const sleep = r.habitSleep?.[visitHabit] ?? r.sleep;
  return { wakeMs: dayStartMs + wake * MINUTE, sleepMs: dayStartMs + sleep * MINUTE };
}

/** The routine pool for a resident at a band, with the visit-habit pool when it applies — its items say so, for the
 * segments they make are a routine the player's visits made (G4, W6). */
export function routineCell(npc, lifeDay, band, { visitHabit = null } = {}) {
  const cell = ROUTINE_BY_KEY[`${npc}|${dayKindFor(npc, lifeDay)}|${band}`];
  return visitHabit && cell.habitPool?.[visitHabit] ? cell.habitPool[visitHabit].map(item => ({ ...item, visitHabit: true })) : cell.pool;
}

/** The spot a first-day agreement points at (§6-5): an FT seat, or the place's own resting spot. */
export function agreementSpot(agreement) {
  if (!agreement || agreement.choice === 'delegate') return null;
  if (agreement.target?.kind === 'seat' && FT_SEATS[agreement.target.placement]) return FT_SEATS[agreement.target.placement].spot;
  return agreement.location === 'greenhouse' ? 'greenhouse.bench' : agreement.location === 'cafe' ? 'cafe.eaves-left' : null;
}

const spotList = name => SPOT_GROUPS[name] || [name];
const placeOf = spotId => SPOT_BY_ID[spotId].place;
// Residents keep to the street between places (W3 P3): a straight line from the cafe to the
// greenhouse would cross the cafe's back wall. Doors are the places' spawns (the lane's is lane.mid);
// the alleys beside the cafe lead behind it. Every edge is checked against walk.mjs in tests.
const PLACE = id => PLACES.find(p => p.id === id), between = (a, b) => (a + b) * 0.5;
const ALLEY_EAST = between(PLACE('cafe').center.x, PLACE('workshop').center.x), ALLEY_WEST = between(PLACE('home').center.x, PLACE('cafe').center.x);
const BEHIND = between(PLACE('cafe').center.z, PLACE('greenhouse').center.z);
const DOORS = Object.freeze({ ...Object.fromEntries(PLACES.filter(p => p.spawn).map(p => [p.id, p.spawn])),
  lane: SPOT_BY_ID['lane.mid'].at, 'east-alley': { x: ALLEY_EAST, z: BEHIND },
  'west-alley': { x: ALLEY_WEST, z: PLACE('home').spawn.z }, 'west-alley-back': { x: ALLEY_WEST, z: BEHIND } });
export const STREET_EDGES = Object.freeze([['home', 'cafe'], ['cafe', 'lane'], ['cafe', 'workshop'], ['lane', 'workshop'],
  ['lane', 'east-alley'], ['east-alley', 'greenhouse'], ['home', 'west-alley'], ['west-alley', 'west-alley-back'], ['west-alley-back', 'greenhouse']]);
const STREET = (() => {
  const nodes = Object.keys(DOORS), gap = (a, b) => Math.hypot(DOORS[a].x - DOORS[b].x, DOORS[a].z - DOORS[b].z);
  const out = {};
  for (const start of nodes) {
    const dist = { [start]: 0 }, via = {}, open = new Set(nodes);
    while (open.size) {
      const here = [...open].filter(n => n in dist).sort((a, b) => dist[a] - dist[b] || (a < b ? -1 : 1))[0];
      if (!here) break;
      open.delete(here);
      for (const [a, b] of STREET_EDGES) {
        const next = a === here ? b : b === here ? a : null;
        if (next && open.has(next) && !(dist[next] <= dist[here] + gap(here, next))) { dist[next] = dist[here] + gap(here, next); via[next] = here; }
      }
    }
    out[start] = Object.fromEntries(nodes.map(end => { const path = [end]; while (path[0] !== start && via[path[0]]) path.unshift(via[path[0]]); return [end, path.map(n => DOORS[n])]; }));
  }
  return out;
})();
/** The points a resident walks from one spot to another: straight inside a place, by the doors between places. */
export function routeBetween(from, to) {
  if (!from || !to) return [];
  const a = SPOT_BY_ID[from], b = SPOT_BY_ID[to];
  return a.place === b.place ? [a.at, b.at] : [a.at, ...STREET[a.place][b.place], b.at];
}
const routeLength = points => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0);
/** Walking time between spots along routeBetween; residents walk slower than the player (planner.residentSpeed, m/s). */
export const travelMs = (from, to, planner = paramsFor().planner) => Math.ceil(routeLength(routeBetween(from, to)) / planner.residentSpeed) * 1000;
const sheltered = name => spotList(name).every(id => SPOT_BY_ID[id].sheltered);

/** Spots of a name a resident may take at t: capacity minus what others hold then (travel included). */
const freeSpots = (name, t, held, npc) => freeSpotsAt(name, t, held, npc);
function freeSpotsAt(name, t, held, npc) {
  return spotList(name).filter(id => {
    let busy = 0;
    for (const s of held) if (s.npc !== npc && s.spot === id && s.startMs <= t && t < s.endMs) busy++;
    return busy < SPOT_BY_ID[id].capacity;
  });
}

/** Weather on the chosen side (§6-4): rain swaps an outside spot for its shelter or drops it. */
// A single outside spot may name its shelter in places.json (rainAltFor), a routine spot or group in routines.json.
const SPOT_RAIN_ALT = Object.freeze(Object.fromEntries(Object.values(SPOT_BY_ID).flatMap(s => (s.rainAltFor || []).map(from => [from, s.id]))));
function rainyChoice(item) {
  if (sheltered(item.spot)) return { ...item };
  const alt = RAIN_ALT[item.spot] ?? SPOT_RAIN_ALT[item.spot];
  if (alt) return { ...item, spot: alt, cause: 'weather' };
  const covered = spotList(item.spot).filter(id => SPOT_BY_ID[id].sheltered);
  return covered.length ? { ...item, spots: covered, cause: 'weather' } : { ...item, weather: 0 };
}

/** Plan one band for all three residents.
 * input: { villageSeed, lifeDay, band, startMs, endMs, dayStartMs, planCmdRev, weatherAt?(ms),
 *   weatherTomorrow, season, visitHabit, residents: { npc: { recent, placesToday, lastSpot, firstOfDay,
 *     energy?, chores?, social?, choresTick?, moodsToday?, showsToday?, allNighter? } } — the state fields are absent in old worlds,
 *   reservations: [{ id, npc, fromMs, toMs|null, spot?, with?, help?, by? }], promises: [{ id, npc, archetype, spot }],
 *   habits: { npc: [{ spot, archetype }] }, objects: { id: { spot } },
 *   occupied: [{ spot, fromMs, toMs }] — spots held by something that is not a resident (an FT10 guest),
 *   cards?, wear?, traces?, pairs?, marks? — the village the band starts from (W5; absent in old worlds),
 *   takes?: [{ card, key, at, status, endAt?, resolvedAt?, choice? }] — the cards the player took (never read by the first pass),
 *   params? — a parameter version from paramsFor (§20-6), the first version when absent }
 * → { segments, residents (what the next band starts from), objects, cards, wear, traces, pairs, marks,
 *   resolved (the cards solved in the band), scenes (its pair scenes), log (the cards that rose), deferredPromises, stateLog } —
 *   stateLog: every state change with its cause (G4; not saved). */
export function planBand(input) {
  const { villageSeed, lifeDay, band, startMs, endMs, dayStartMs, planCmdRev } = input;
  if (!Number.isSafeInteger(planCmdRev)) throw new TypeError('planBand needs planCmdRev');
  const params = input.params ?? paramsFor(), P = params.planner, C = params.cards;
  const clockAt = input.weatherAt || (ms => clockWeatherAt(villageSeed, ms));
  const changes = input.weatherAt ? scanWeather(clockAt, startMs, endMs) : weatherChangesBetween(villageSeed, startMs, endMs);
  // Inside the band the weather is its start and its turns (a few at most): read them instead of the clock each time.
  const first = clockAt(startMs);
  const weatherAt = ms => {
    if (ms < startMs || ms >= endMs) return clockAt(ms);
    let w = first;
    for (const c of changes) { if (c.atMs > ms) break; w = c.to; }
    return w;
  };
  // Rain starting inside the band is a decision point for whoever is outside then (§6-4).
  const rainStarts = changes.filter(c => c.to === 'rain').map(c => c.atMs);
  const rainedBetween = input.weatherAt ? (a, b) => sampledRain(weatherAt, a, b) : (a, b) => b > a && rainBetween(villageSeed, a, b);
  const fixed = (input.occupied || []).map(o => ({ npc: 'guest', spot: o.spot, startMs: o.fromMs, endMs: o.toMs, archetype: 'guest' }));
  const reservations = [...(input.reservations || [])].sort((a, b) => a.fromMs - b.fromMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const starts = Object.fromEntries(RESIDENT_IDS.map(npc => [npc, startOf(npc, input, params)]));
  // What reaches each resident's state in the band besides its own segments (guests, the big order, a scene done together).
  const events = Object.fromEntries(RESIDENT_IDS.map(npc => [npc, bandEvents(RESIDENT_BY_ID[npc], { seed: villageSeed, lifeDay, band,
    window: starts[npc] && { fromMs: starts[npc].t, toMs: starts[npc].end, bandStartMs: startMs, bandEndMs: endMs }, holds: reservations }, params)]));
  // What the cards read of the world (§8-2): a band that starts clear after a rainy one, the weather's turns that are an
  // owner's decision point (rain over its object, rain ending at its door), a crowd at the cafe a little while ago.
  const at = BANDS.findIndex(b => b.id === band), previous = BANDS[(at + BANDS.length - 1) % BANDS.length];
  const afterRain = weatherAt(startMs) !== 'rain' && rainedBetween(startMs - (previous.to - previous.from) * MINUTE, startMs);
  const instants = Object.fromEntries(RESIDENT_IDS.map(npc => [npc, (CARDS_OF[npc] || []).flatMap(card => {
    const to = card.trigger.kind === 'rain-start' ? 'rain' : card.trigger.kind === 'rain-stop' ? 'clear' : null;
    return to ? changes.filter(c => c.to === to).map(c => ({ atMs: c.atMs, card: card.id })) : [];
  }).sort((a, b) => a.atMs - b.atMs)]));
  const rushes = (events['cafe-owner'] || []).filter(e => e.type === 'guests' && e.count >= C.rushGuests).map(e => e.atMs);
  const rushAt = t => rushes.some(ms => ms <= t && t - ms < C.rushWindowMinutes * MINUTE);
  const ctx = { input, weatherAt, rainStarts, P, params, events, rainedBetween, afterRain, instants, rushAt };

  // Pass one: the band as it would go with no one held — so without what a hold's end brings (a scene done together):
  // that reaches only its own resident's re-plan and the close, never the others (review GA2). Nor does it know a card the
  // player took (review F1): a take holds its owner, and the owner alone is planned again around it.
  const unheld = Object.fromEntries(Object.entries(events).map(([npc, list]) => [npc, list.filter(e => e.type !== 'together')]));
  let segments = planRange(RESIDENT_IDS, starts, fixed, { ...ctx, events: unheld }, npc => createRng(villageSeed, 'plan', lifeDay, band, npc, planCmdRev));
  const deferred = segments.deferred;
  let log = segments.log;
  // Each reservation re-plans only its resident, after the hold, around everyone else.
  for (const hold of reservations) {
    const npc = hold.npc, s = starts[npc];
    if (!s || hold.fromMs >= s.end) continue;
    const from = Math.max(hold.fromMs, s.t), to = hold.toMs === null || hold.toMs === undefined ? s.end : Math.min(hold.toMs, s.end);
    if (to <= from) continue; // a hold of no length (opened and closed at one instant) leaves the band as it was
    const before = segments.filter(x => x.npc === npc && x.startMs < from).map(x => cutAt(x, from));
    const others = segments.filter(x => x.npc !== npc);
    const lastSpot = before.at(-1)?.spot ?? s.prior.lastSpot ?? null;
    // A scene calls its residents to its own spot; one who was elsewhere walks over first (§11-3, G9).
    const spot = hold.spot ?? lastSpot ?? RESIDENT_BY_ID[npc].home;
    const holding = { npc, startMs: from, arriveMs: Math.min(from + travelMs(lastSpot ?? RESIDENT_BY_ID[npc].home, spot, P), to), endMs: to,
      archetype: 'reserved', spot, cause: 'reservation', reservation: hold.id, base: null };
    // The rest of the band starts from the state the hold left: guests it attended to, its end done together (§7-2).
    const prior = summarize(npc, [...before, holding], s.prior, ctx, to);
    const fixedLog = log.filter(e => e.npc !== npc || e.atMs < from);
    // A card done with the player leaves those it held glad of it at their next choice (§7-3 with-player-glad).
    const glad = hold.with && typeof hold.by === 'string' && hold.by.startsWith('card:') ? { key: 'with-player-glad', card: hold.by.split(':')[1] } : null;
    const after = to < s.end ? planRange([npc], { [npc]: { ...s, t: to, prior } }, [...fixed, ...others, ...before, holding], ctx,
      () => createRng(villageSeed, 'replan', lifeDay, band, npc, planCmdRev, Math.floor((to - startMs) / MINUTE), hold.id),
      // A promise already begun before the hold is not made up afterwards (§6-4; review P1-4).
      (input.promises || []).filter(p => !before.some(x => x.promise === p.id)), { replan: true, log: fixedLog, glad }) : Object.assign([], { log: [] });
    segments = [...others, ...before, holding, ...after];
    log = [...fixedLog, ...after.log];
  }
  // A card the player took is never its owner's to solve while the take holds it (§8-3): a solving the first pass placed
  // there is planned again from that instant, the owner's alone; a neighbour it called comes to no result (rule H).
  for (const take of input.takes || []) {
    const npc = CARD_BY_ID[take.card]?.owner, s = npc && starts[npc];
    const bad = s && segments.find(x => x.npc === npc && x.cardRole === 'owner' && x.card === take.card && x.key === take.key && takeCovers(take, take.card, take.key, x.startMs));
    if (!bad) continue;
    const from = bad.startMs;
    const before = segments.filter(x => x.npc === npc && x.startMs < from).map(x => cutAt(x, from));
    const others = segments.filter(x => x.npc !== npc);
    const fixedLog = log.filter(e => e.npc !== npc || e.atMs < from);
    const prior = summarize(npc, before, s.prior, ctx, from);
    const after = planRange([npc], { [npc]: { ...s, t: from, prior } }, [...fixed, ...others, ...before], ctx,
      () => createRng(villageSeed, 'replan', lifeDay, band, npc, planCmdRev, Math.floor((from - startMs) / MINUTE), `take:${take.card}:${take.key}`),
      (input.promises || []).filter(p => !before.some(x => x.promise === p.id)), { replan: true, log: fixedLog });
    segments = [...others, ...before, ...after];
    log = [...fixedLog, ...after.log];
  }
  segments.sort((a, b) => a.startMs - b.startMs || order(a.npc) - order(b.npc));
  log.sort((a, b) => a.atMs - b.atMs || order(a.npc) - order(b.npc));
  // What the band leaves is read from its final segments (§2-1), by the steps the planner took while placing them.
  const village = villageAfter(input, segments, log, { archetypes: ARCHETYPE_BY_ID, params });
  confirmMoods(segments, village);
  const stateLog = [];
  const residents = Object.fromEntries(RESIDENT_IDS.map(npc => {
    const out = summarize(npc, segments.filter(x => x.npc === npc), starts[npc]?.prior ?? priorOf(npc, input, params), ctx, endMs, { final: true });
    stateLog.push(...out.log);
    return [npc, persisted(out, lateNight(npc, segments, input))];
  }));
  stateLog.sort((a, b) => a.atMs - b.atMs || order(a.npc) - order(b.npc));
  return { segments, residents, ...keptVillage(village), resolved: village.resolved, scenes: village.scenes, log, deferredPromises: deferred, stateLog };
}

/** A segment cut where a hold begins: it ends there, and pieces merged after that point never happened. */
function cutAt(x, from) {
  if (x.endMs <= from) return x;
  const cut = { ...x, endMs: from, arriveMs: Math.min(x.arriveMs, from) };
  if (x.pieceStarts) cut.pieceStarts = x.pieceStarts.filter(t => t < from);
  return cut;
}

/** A mood that leans on someone else's doing keeps its line only when the final segments still hold that doing (review F7):
 * pair-glad on its card solved by the two, tea-received on the tea that really came. The behaviour stays either way. */
function confirmMoods(segments, village) {
  for (const seg of segments) {
    const b = seg.basis;
    if (!b || !seg.mood) continue;
    const kept = b.kind === 'card' ? village.resolved.some(r => r.card === b.card && r.key === b.key && r.path === 'pair' && !r.solo)
      : b.kind === 'segment' ? segments.some(x => x.npc === b.npc && x.startMs === b.startMs && x.archetype === b.archetype && x.arriveMs < x.endMs && x.arriveMs <= seg.startMs)
        : true;
    if (!kept) delete seg.mood;
  }
}

/** What a resident brings into the band (§7-1): the old fields, its state (waking values for an old world) and today's moods. */
function priorOf(npc, input, params) {
  const r = input.residents?.[npc] || {}, resident = RESIDENT_BY_ID[npc];
  const start = stateOf(resident, r, params);
  return { recent: r.recent || [], placesToday: r.placesToday || [], lastSpot: r.lastSpot ?? null, firstOfDay: r.firstOfDay !== false,
    moodsToday: r.moodsToday || [], showsToday: r.showsToday ?? 0, allNighter: r.allNighter === true, start, state: running(resident, start) };
}

/** Whether ms is outside a resident's usual waking hours that life day — the part a visit habit stretched (W6). */
function outsideUsual(npc, ms, input) {
  const { wakeMs, sleepMs } = awakeWindow(npc, input.lifeDay, input.dayStartMs);
  return ms < wakeMs || ms >= sleepMs;
}

function startOf(npc, input, params) {
  const { wakeMs, sleepMs } = awakeWindow(npc, input.lifeDay, input.dayStartMs, { visitHabit: input.visitHabit });
  const t = Math.max(input.startMs, wakeMs), end = Math.min(input.endMs, sleepMs);
  return t < end ? { t, end, prior: priorOf(npc, input, params) } : null;
}

/** What a resident carries on: the last few archetypes, places today, last spot, the reasons whose line showed
 * today, the drawings it showed today, and its state replayed over these segments from the band's start (until
 * untilMs; final adds the band's end rule) — the same steps the planner took while placing them, so a re-plan after a
 * hold and the band's close agree with it. */
function summarize(npc, mine, prior, ctx, untilMs, { final = false } = {}) {
  const P = ctx.P;
  let recent = [...prior.recent], places = [...prior.placesToday], lastSpot = prior.lastSpot, firstOfDay = prior.firstOfDay, shows = prior.showsToday;
  const moodsToday = [...prior.moodsToday];
  for (const s of mine) {
    if (s.archetype !== 'reserved') recent = [...recent, s.archetype].slice(-P.recentWindow);
    if (!places.includes(placeOf(s.spot))) places.push(placeOf(s.spot));
    if (s.mood && !moodsToday.includes(s.reason)) moodsToday.push(s.reason);
    if (s.archetype === 'show-drawing' && !s.cardRole) shows += s.pieceStarts?.length ?? 1;
    lastSpot = s.spot; firstOfDay = false;
  }
  const { state, log } = replay(RESIDENT_BY_ID[npc], prior.start, mine, ctx.events[npc], { untilMs, end: final ? { atMs: untilMs } : null }, ctx.params);
  return { recent, placesToday: places, lastSpot, firstOfDay, moodsToday, showsToday: shows, allNighter: prior.allNighter, start: prior.start, state, log };
}

/** A resident up past its bedtime solving its own card (R4's night flowers) wakes tired the next day (§7-1 밤샘). */
function lateNight(npc, segments, input) {
  const { sleepMs } = awakeWindow(npc, input.lifeDay, input.dayStartMs, { visitHabit: input.visitHabit });
  return segments.some(x => x.npc === npc && x.cardRole === 'owner' && CARD_BY_ID[x.card].until !== undefined && x.endMs > sleepMs);
}

/** The band summary a village keeps (village.band.residents). */
const persisted = (s, late) => ({ recent: s.recent, placesToday: s.placesToday, lastSpot: s.lastSpot, firstOfDay: s.firstOfDay, ...keptState(s.state), moodsToday: s.moodsToday,
  ...(s.showsToday ? { showsToday: s.showsToday } : {}), ...(s.allNighter ? { allNighter: true } : {}), ...(late ? { lateNight: true } : {}) });

/** Where the weather turns inside [startMs, endMs) for a weather function (tests and the simulation give one). */
function scanWeather(weatherAt, startMs, endMs) {
  const out = [];
  for (let t = startMs; t < endMs;) {
    const next = Math.min(endMs, t + 15 * MINUTE), from = weatherAt(t);
    if (next < endMs && from !== weatherAt(next)) {
      let lo = t + 1, hi = next;
      while (lo < hi) { const mid = lo + ((hi - lo) >> 1); if (weatherAt(mid) !== from) hi = mid; else lo = mid + 1; }
      out.push({ atMs: lo, to: weatherAt(lo) });
    }
    t = next;
  }
  return out;
}
/** Whether it rained anywhere in [a, b) for a weather function, read every few minutes. */
function sampledRain(weatherAt, a, b) {
  for (let t = a; t < b; t += 6 * MINUTE) if (weatherAt(t) === 'rain') return true;
  return b > a && weatherAt(b - 1) === 'rain';
}

const busy = seg => !!seg.cardRole || !!seg.with || seg.cause === 'promise' || seg.archetype === 'reserved';

/** Plan the given residents from their start times, in time order, around fixed segments. range: { replan, log (the
 * rises already fixed), glad (with-player-glad after a card's hold) } — a re-plan solves cards only alone, starts no pair
 * scene and knows the player's takes. */
function planRange(npcs, starts, fixed, ctx, rngFor, promises = ctx.input.promises || [], range = {}) {
  const { input, params } = ctx, C = params.cards, replan = range.replan === true;
  const takes = replan ? input.takes || [] : [];
  const people = {};
  for (const npc of npcs) {
    const s = starts[npc];
    if (!s) continue;
    const prior = s.prior;
    people[npc] = { t: s.t, start: s.t, end: s.end, rng: rngFor(npc), recent: [...prior.recent], placesToday: [...prior.placesToday],
      lastSpot: prior.lastSpot, firstOfDay: prior.firstOfDay, promises: promises.filter(p => p.npc === npc),
      // Its state goes on from where the range begins: the band's events reach it as decision times pass (§7-1).
      state: { ...prior.state }, moodsToday: [...prior.moodsToday], showsToday: prior.showsToday, allNighter: prior.allNighter,
      glad: range.glad ?? null, prevT: -Infinity };
  }
  const made = [], deferred = [], log = [];
  let live = [...fixed];
  // The village the band shares, in time order (§2-1): the first pass moves it as it places segments; a re-plan starts it at
  // the band's start and takes in the fixed segments, rises and the player's results as its decisions pass their times.
  const vs = villageStart(input, params);
  const all = fixed.filter(x => x.npc !== 'guest');
  const step = { archetypes: ARCHETYPE_BY_ID, segments: all, takes };
  const fixedItems = [...(range.log || []).map(e => ({ ms: e.atMs, npc: e.npc, rank: 0, trigger: e })),
    ...all.flatMap(seg => (seg.cardRole ? [seg.startMs] : seg.pieceStarts ?? [seg.startMs]).map((ms, i) => ({ ms, npc: seg.npc, rank: 1, seg, first: i === 0 }))),
    ...takes.filter(take => take.status === 'resolved' && take.resolvedAt >= input.startMs && take.resolvedAt < input.endMs)
      .map(take => ({ ms: take.resolvedAt, npc: CARD_BY_ID[take.card].owner, rank: 1.5, take }))]
    .sort((a, b) => a.ms - b.ms || order(a.npc) - order(b.npc) || a.rank - b.rank);
  let fi = 0;
  const catchUp = (t, npc) => {
    for (; fi < fixedItems.length && (fixedItems[fi].ms < t || fixedItems[fi].ms === t && order(fixedItems[fi].npc) < order(npc)); fi++) {
      const item = fixedItems[fi];
      if (item.trigger) applyTrigger(vs, item.trigger);
      else if (item.take) applyTake(vs, item.take);
      else applySegment(vs, item.seg, { ...step, first: item.first });
    }
  };
  // The caps count where cards rose (§8-3); a re-plan counts every rise already fixed, whenever it is — never more than the caps.
  const rose = { cards: input.cards || {}, lifeDay: input.lifeDay }, roseAll = roseToday(rose), roseOf = Object.fromEntries(RESIDENT_IDS.map(npc => [npc, roseToday(rose, npc)]));
  const capOk = npc => {
    const band = [...(range.log || []), ...log];
    return roseOf[npc] + band.filter(e => e.npc === npc).length < C.perResident && roseAll + band.length < C.perVillage;
  };
  // Indexes the decisions read often: which rises a neighbour already came for, and the tea that was brought.
  const partners = new Map();
  const came = x => partners.set(`${x.card}|${x.key}`, [...(partners.get(`${x.card}|${x.key}`) || []), x.startMs]);
  for (const x of all) if (x.cardRole === 'partner') came(x);
  const teas = all.filter(x => x.archetype === 'deliver-tea');

  // Put one chosen item on the timeline at the resident's next decision time. opts: { cutAt (a card rose: decide again
  // soon), until (a solving past bedtime), endAt, minutes, apply: false (the caller applies it once a neighbour joined) }.
  const P = ctx.P, linesPerDay = params.state.moodLinesPerDay;
  const pause = { ...PAUSE, length: P.pauseMinutes };
  const place = (npc, picked, raining, opts = {}) => {
    const p = people[npc], t = p.t, c = picked.chosen;
    advance(p.state, ctx.events[npc], t, {}, [], params);
    const archetype = ARCHETYPE_BY_ID[c.archetype] || pause;
    const options = c.spots || spotList(c.spot);
    const free = freeSpots(c.spot, t, live, npc).filter(id => options.includes(id));
    // Blocked: stay put a few minutes where one already is (§6-4 막힘 — the stand-still alternative, NPC:397).
    const stay = p.lastSpot && !(raining && !SPOT_BY_ID[p.lastSpot].sheltered) ? p.lastSpot : RESIDENT_BY_ID[npc].home;
    const spot = c.cause === 'blocked' ? stay : free.length ? free[p.rng.below(free.length)] : RESIDENT_BY_ID[npc].home;
    const lengthMs = (opts.minutes ?? p.rng.between(archetype.length[0], archetype.length[1])) * MINUTE;
    const walk = travelMs(p.lastSpot, spot, P);
    let end = opts.endAt !== undefined ? Math.min(opts.endAt, p.end) : Math.min(t + walk + lengthMs, p.end);
    // R4's flowers open late: its solving runs on past bedtime, within the band (§8-4, review F15).
    if (opts.until !== undefined) end = Math.min(input.endMs, Math.max(t + walk + lengthMs, input.dayStartMs + opts.until * MINUTE));
    if (opts.cutAt !== undefined) end = Math.min(end, opts.cutAt);
    // Someone outside when rain begins stops there and decides again (§6-4).
    const rainCut = !SPOT_BY_ID[spot].sheltered ? ctx.rainStarts.find(w => w > t && w < end) : undefined;
    if (rainCut !== undefined) end = rainCut;
    // The weather turning over a card's object is its owner's decision point (§2-1): rain on it, rain ending at its door.
    const cardCut = rainCut === undefined && !c.card ? (ctx.instants[npc] || []).find(w => w.atMs > t && w.atMs < end && statusOf(vs, w.card) === 'idle') : undefined;
    if (cardCut) end = cardCut.atMs;
    if (end <= t) end = Math.min(t + MINUTE, p.end);
    const arriveMs = Math.min(t + walk, end);
    const cause = c.cause || 'routine', reason = picked.reason ?? null, habit = c.habit === true;
    // What the time the player usually comes added (§10-3, W6): a pick from the habit pool, or the hours it stretched the
    // resident's day by — a routine the player's visits made, so it never changes the state for the worse (G4).
    const fromVisits = c.visitHabit === true || !!input.visitHabit && outsideUsual(npc, t, input);
    const extra = { ...(c.card ? { card: c.card, key: c.key, cardRole: c.cardRole } : {}), ...(c.with ? { with: c.with } : {}), ...(c.joined ? { joined: true } : {}) };
    const previous = made.findLast(x => x.npc === npc);
    let segment;
    if (!c.card && !c.with && previous && !previous.cardRole && !previous.with && previous.endMs === t && previous.archetype === archetype.id
      && previous.spot === spot && previous.cause === cause && (previous.reason ?? null) === reason && (previous.habit === true) === habit
      && (previous.visitHabit === true) === fromVisits) {
      // Going on with the same thing in the same place, for the same reason, is one longer segment, not a restart;
      // each piece still changes the state (review P3-1), at its own decision time.
      previous.endMs = end;
      (previous.pieceStarts ||= [previous.startMs]).push(t);
      segment = previous;
      applySegment(vs, previous, { ...step, first: false });
    } else {
      // The mood line shows once a resident, reason and life day, and at most moodLinesPerDay lines a day (§7-3).
      const mood = reason && !p.moodsToday.includes(reason) && p.moodsToday.length < linesPerDay ? `${npc}.mood.${reason}.1` : null;
      if (mood) p.moodsToday.push(reason);
      segment = { npc, startMs: t, arriveMs, endMs: end, archetype: archetype.id, spot, cause,
        ...(reason ? { reason } : {}), ...(mood ? { mood } : {}), ...(habit ? { habit: true } : {}), ...(fromVisits ? { visitHabit: true } : {}),
        ...(c.promise ? { promise: c.promise } : {}), ...(p.rainMoved === archetype.id ? { moved: 'rain' } : {}), ...extra,
        ...(picked.basis && reason ? { basis: picked.basis } : {}),
        base: picked.base ? { archetype: picked.base.archetype, spot: picked.base.spot } : null };
      made.push(segment); live.push(segment); all.push(segment);
      if (segment.cardRole === 'partner') came(segment);
      if (segment.archetype === 'deliver-tea') teas.push(segment);
      if (opts.apply !== false) applySegment(vs, segment, { ...step, first: true });
    }
    finishSegment(p.state, ARCHETYPE_BY_ID[archetype.id] ?? null, { atMs: t, playerMade: playerMade({ habit, cause, visitHabit: fromVisits }) }, [], params);
    p.recent = [...p.recent, archetype.id].slice(-P.recentWindow);
    if (!p.placesToday.includes(placeOf(spot))) p.placesToday.push(placeOf(spot));
    if (archetype.id === 'show-drawing' && !c.card) p.showsToday += 1;
    p.lastSpot = spot; p.firstOfDay = false; p.t = end; p.rainMoved = null; p.last = segment;
    // Work cut by rain may go on under cover once: that is the same activity moved, not a repeat.
    if (rainCut !== undefined) {
      p.rainMoved = archetype.id;
      p.rng = createRng(input.villageSeed, 'replan', input.lifeDay, input.band, npc, input.planCmdRev, Math.floor((rainCut - input.startMs) / MINUTE), `rain:${rainCut}`);
    }
    if (cardCut) p.rng = createRng(input.villageSeed, 'replan', input.lifeDay, input.band, npc, input.planCmdRev, Math.floor((cardCut.atMs - input.startMs) / MINUTE), `card:${cardCut.atMs}`);
    return segment;
  };

  /** Where a neighbour is at t and when it may be joined (only in the first pass — a re-plan moves no one else): it is up,
   * not in a card's, a pair's, a promise's or a scene's segment, and stops where it has got to (review F9). */
  const presentAt = (npc, t) => {
    const q = people[npc];
    // Up at t (its last segment may run to its bedtime — still joinable until then, review GB1).
    if (!q || q.start > t || t >= q.end) return null;
    const cur = q.t > t && q.last && q.last.startMs <= t && t < q.last.endMs ? q.last : null;
    if ((q.t > t && !cur) || (cur && busy(cur))) return null;
    const at = cur ? Math.max(t, cur.arriveMs) : t;
    if (at >= q.end || (cur && at <= cur.startMs)) return null;
    return { at, spot: cur ? cur.spot : q.lastSpot ?? RESIDENT_BY_ID[npc].home, cur, end: q.end };
  };
  /** The neighbour stops there and walks over to help or talk; its own day goes on from what it does here. */
  const join = (npc, t, chosen, opts) => {
    const where = presentAt(npc, t), q = people[npc];
    if (!where || ctx.weatherAt(where.at) === 'rain' && rainyChoice(chosen).weather === 0) return null;
    // A talk that ends before the neighbour could stop is no talk to join (review GB2).
    if (opts.endAt !== undefined && opts.endAt <= where.at + MINUTE) return null;
    if (where.cur) { where.cur.endMs = where.at; if (where.cur.pieceStarts) where.cur.pieceStarts = where.cur.pieceStarts.filter(ms => ms < where.at); }
    q.t = where.at;
    q.rng = createRng(input.villageSeed, 'replan', input.lifeDay, input.band, npc, input.planCmdRev, Math.floor((where.at - input.startMs) / MINUTE), opts.why);
    const raining = ctx.weatherAt(where.at) === 'rain';
    const item = raining ? { ...rainyChoice(chosen), cause: chosen.cause } : chosen;
    return place(npc, { chosen: item, base: null, reason: null }, raining, opts);
  };

  /** Whether the pair path is open for a card (§8-3): the neighbour is up and free, not too tired, the pair's scene may
   * happen today, and it gets there before its day ends. */
  const pairOpen = (card, owner, t) => {
    const pair = card.paths.pair, q = people[pair.partner], where = q && presentAt(pair.partner, t);
    if (!where || q.state.energy < C.partnerEnergyMin || !sceneFree(vs, owner, pair.partner, pair.scene ?? 'chat')) return false;
    if (ctx.weatherAt(where.at) === 'rain' && rainyChoice({ archetype: pair.partnerArchetype, spot: pair.partnerSpot }).weather === 0) return false;
    if (where.at + travelMs(where.spot, spotList(pair.partnerSpot)[0], P) >= q.end) return false;
    return freeSpots(pair.partnerSpot, where.at, live, pair.partner).length > 0;
  };
  /** The card a resident's decision solves (§8-3 해결): the oldest that rose and waits for it, in a band it may be solved
   * in — never one the player holds or a neighbour already came for. */
  const waiting = (npc, t) => {
    let best = null;
    for (const card of CARDS_OF[npc] || []) {
      const r = vs.cards[card.id];
      if (r?.status !== 'triggered' || !card.bands.includes(input.band) || takes.some(take => takeCovers(take, card.id, r.key, t))) continue;
      // A neighbour who already came for it solves it — unless the player held that rise then (a visit with no result).
      if ((partners.get(`${card.id}|${r.key}`) || []).some(ms => !takes.some(take => takeCovers(take, card.id, r.key, ms)))) continue;
      if (!best || r.at < vs.cards[best.id].at) best = card;
    }
    return best;
  };
  const solve = (npc, card, picked, raining) => {
    const p = people[npc], t = p.t, key = vs.cards[card.id].key;
    const path = !replan && pairOpen(card, npc, t) && pairChosen(card, key, { villageSeed: input.villageSeed,
      partnerLonely: people[card.paths.pair.partner].state.social < params.state.lonelySocial }, params) ? 'pair' : 'self';
    let item = { archetype: card.archetype, spot: solvingSpot(card, path) };
    if (raining) { item = rainyChoice(item); if (item.weather === 0) return false; }
    // Already at it where the card wants it: the solving goes on at that very spot (the same work, not a restart).
    const going = made.findLast(x => x.npc === npc);
    if (going?.endMs === t && going.archetype === item.archetype && (item.spots || spotList(item.spot)).includes(going.spot)) item = { archetype: item.archetype, spot: going.spot };
    if (!freeSpots(item.spot, t, live, npc).some(id => (item.spots || spotList(item.spot)).includes(id))) return false;
    const reason = cardMood(npc, card, item, picked.base, input.band);
    const seg = place(npc, { chosen: { ...item, cause: 'card', card: card.id, key, cardRole: 'owner' }, base: picked.base, reason }, raining, { until: card.until, apply: false });
    if (path === 'pair') {
      const pair = card.paths.pair, archetype = ARCHETYPE_BY_ID[pair.partnerArchetype];
      join(pair.partner, t, { archetype: archetype.id, spot: pair.partnerSpot, cause: 'card', card: card.id, key, cardRole: 'partner', with: npc },
        { minutes: partnerMinutes(card, key, archetype, input.villageSeed), why: `pair:${card.id}:${key}` });
    }
    applySegment(vs, seg, { ...step, first: true });
    // Solved by the two of them, the owner is glad of it at its next choice (§7-3 pair-glad), if the final segments agree.
    const done = vs.resolved.at(-1);
    if (pair2(done, card, key) && card.paths.pair.glad) p.glad = { key: 'pair-glad', archetype: card.paths.pair.glad, basis: { kind: 'card', card: card.id, key } };
    return true;
  };
  /** A card that rises at this decision (§8-2) — one at a time, under the caps, with time left to solve it before bed. */
  const rise = (npc, t) => {
    const p = people[npc];
    if (!capOk(npc) || p.end - t <= C.waitMinutes * MINUTE) return null;
    const at = { t, state: p.state, showsToday: p.showsToday, allNighter: p.allNighter, raining: ms => ctx.weatherAt(ms) === 'rain',
      rainedBetween: ctx.rainedBetween, afterRain: ctx.afterRain, season: input.season, rushAt: ctx.rushAt,
      dayStartMs: input.dayStartMs, yesterdayStartMs: input.dayStartMs - DAY, seed: input.villageSeed };
    for (const card of CARDS_OF[npc] || []) {
      if (!card.bands.includes(input.band) || statusOf(vs, card.id) !== 'idle' || !triggerHolds(card, vs, at, params)) continue;
      const entry = { card: card.id, key: cardKey(input.lifeDay, input.band, input.startMs, t), npc, atMs: t };
      log.push(entry); applyTrigger(vs, entry);
      return card;
    }
    return null;
  };

  // Fixed items first (§6-4): accepted promises take their spots before any routine choice; in rain
  // they move under cover, and with no shelter they wait for a clear band (§4-5).
  for (const npc of Object.keys(people).sort((a, b) => order(a) - order(b))) {
    const p = people[npc];
    while (p.promises.length && p.t < p.end) {
      catchUp(p.t, npc);
      const promise = p.promises.shift(), raining = ctx.weatherAt(p.t) === 'rain';
      const item = raining ? rainyChoice({ archetype: promise.archetype, spot: promise.spot }) : { archetype: promise.archetype, spot: promise.spot };
      if (item.weather === 0) { deferred.push(promise); continue; }
      place(npc, { chosen: { ...item, cause: 'promise', promise: promise.id }, base: { archetype: promise.archetype, spot: promise.spot } }, raining);
    }
  }
  for (;;) {
    const npc = Object.keys(people).filter(id => people[id].t < people[id].end).sort((a, b) => people[a].t - people[b].t || order(a) - order(b))[0];
    if (!npc) break;
    const p = people[npc], t = p.t;
    catchUp(t, npc);
    live = live.filter(x => x.endMs >= t);
    const raining = ctx.weatherAt(t) === 'rain';
    advance(p.state, ctx.events[npc], t, {}, [], params);
    const picked = scoreAndPick(npc, p, t, raining, input, live, vs, ctx, { replan, presentAt, teas });
    // A pair's gladness lasts the band until it changes a choice (the work just done is not repeated at once, and doing it
    // anyway is not a change of mind); every other gladness is the next choice's.
    if (p.glad && (p.glad.key !== 'pair-glad' || picked.reason === 'pair-glad')) p.glad = null;
    const card = waiting(npc, t);
    if (!(card && solve(npc, card, picked, raining))) {
      const risen = rise(npc, t);
      const seg = place(npc, picked, raining, { ...(risen ? { cutAt: t + C.waitMinutes * MINUTE } : {}), apply: !picked.chosen.with });
      // Two at one place talk (§9-1): the other stops there and joins, and they end together.
      if (picked.chosen.with && seg.with) {
        join(seg.with, t, { archetype: seg.archetype, spot: seg.spot, cause: 'pair', with: npc, joined: true }, { endAt: seg.endMs, why: `chat:${t}` });
        vs.chats.add(pairKeyOf(npc, seg.with));
        applySegment(vs, seg, { ...step, first: true });
      }
    }
    p.prevT = t;
  }
  made.deferred = deferred;
  made.log = log;
  return made;
}
const pair2 = (done, card, key) => !!done && done.card === card.id && done.key === key && done.path === 'pair' && !done.solo;

/** The order reasons are taken in (§7-3): weather, the body (energy), work (chores), neighbours (social), cards. */
const KIND_ORDER = Object.freeze(['weather', 'body', 'work', 'neighbour', 'card']);
const fits = (m, chosen, base, band) => (!m.chosenKinds || m.chosenKinds.includes(ARCHETYPE_BY_ID[chosen.archetype]?.kind))
  && (!m.chosenArchetypes || m.chosenArchetypes.includes(chosen.archetype))
  && (!m.baseArchetypes || (!!base && m.baseArchetypes.includes(base.archetype))) && (!m.bands || m.bands.includes(band));
/** Why a mind changed, with the factor it came from (see moodReason). */
function moodOf(resident, chosen, base, band) {
  if (base && chosen.item.archetype === base.item.archetype && chosen.item.spot === base.item.spot && !chosen.item.spots) return null;
  const reasons = [...chosen.factors.filter(f => f.dir !== 'down'), ...(base ? base.factors.filter(f => f.dir === 'down') : [])]
    .map((f, i) => ({ ...f, i })).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.i - b.i);
  for (const f of reasons) for (const m of resident.moods) if (m.factor === f.key && fits(m, chosen.item, base?.item, band)) return { tag: m.tag, key: f.key };
  return null;
}
/** Why a mind changed (§7-3 · §6-4 마음): only when the chosen and the base differ (archetype or spot, rain's narrowed spots
 * included) and the difference came from weather, state or a card — the chosen raised, moved or added by one, or the base
 * lowered by one. Reasons go in priority order; the first whose tag in the resident's mood table fits the behaviour wins
 * (review P2-1). Habit, personality and repetition are in the base already, so they never make a mood. null: no line.
 * chosen and base are { item: { archetype, spot, spots? }, factors: [{ kind, key, dir }] } (base null when nothing could be done). */
export function moodReason(resident, chosen, base, band) {
  return moodOf(resident, chosen, base, band)?.tag ?? null;
}
/** A card's solving changes the owner's mind when it is not what the owner would have done anyway (§2-7): its line is the
 * card's own tag in the owner's mood table, when the behaviour fits it. */
function cardMood(npc, card, item, base, band) {
  if (base && base.archetype === item.archetype && base.spot === item.spot && !item.spots) return null;
  const m = RESIDENT_BY_ID[npc].moods.find(entry => entry.factor === card.id);
  return m && fits(m, item, base, band) ? m.tag : null;
}

function scoreAndPick(npc, p, t, raining, input, live, vs, ctx, { replan, presentAt, teas }) {
  const rooms = new Map(), freeSpots = (name, at, held, who) => (rooms.has(name) ? rooms.get(name) : (rooms.set(name, freeSpotsAt(name, at, held, who)), rooms.get(name)));
  const params = ctx.params, resident = RESIDENT_BY_ID[npc], band = input.band, P = params.planner, C = params.cards, PP = params.pairs;
  const pool = routineCell(npc, input.lifeDay, band, { visitHabit: input.visitHabit }).map(item => ({ ...item }));
  for (const habit of input.habits?.[npc] || []) pool.push({ archetype: habit.archetype, spot: habit.spot, weight: P.habitWeight, habit: true });
  // Two at one place may talk (§9-1): the first pass offers each pair a chat once a band and a few pair scenes a day, warmer
  // while their small difference is still being worked out. A talk is a pair scene now — never alone (W5).
  const here = p.lastSpot ? placeOf(p.lastSpot) : null;
  const mateAt = place => (replan ? null : RESIDENT_IDS.filter(other => other !== npc).find(other => {
    const where = presentAt(other, t), key = pairKeyOf(npc, other), spot = CHAT_SPOTS[place];
    if (!where || !spot || placeOf(where.spot) !== place || !key || vs.chats.has(key) || !sceneFree(vs, npc, other, 'chat')) return false;
    // The neighbour gets there while the talk still goes on — before either one's bedtime cuts it (review GB2).
    const talkEnd = Math.min(p.end, where.end, t + travelMs(p.lastSpot, spot, P) + ARCHETYPE_BY_ID.chat.length[0] * MINUTE);
    return where.at + travelMs(where.spot, spot, P) + MINUTE <= talkEnd;
  }) ?? null);
  if (here && CHAT_SPOTS[here]) {
    const mate = mateAt(here);
    if (mate) pool.push({ archetype: 'chat', spot: CHAT_SPOTS[here], cause: 'pair', with: mate,
      weight: perMille(PP.sceneWeight, frictionStep(vs, npc, mate) < PP.frictionMax ? PP.frictionBoost : PER_MILLE) });
  }
  // Three places a day (§6-2): the evening pulls toward a place not yet visited, harder in its last hour.
  const unvisited = band === 'evening' && p.placesToday.length < P.placesPerDay
    ? (p.end - t <= P.lastHourMinutes * MINUTE ? P.eveningPullLastHour : P.eveningPull) : 0;
  const base = pool.map(item => {
    const archetype = ARCHETYPE_BY_ID[item.archetype];
    // Talk needs a neighbour at that place who joins (a pair scene, §9-1).
    if (archetype.kind === 'talk' && !item.with) {
      const mate = mateAt(placeOf(spotList(item.spot)[0]));
      if (!mate) return { item, score: 0 };
      item.with = mate; item.cause = 'pair'; item.spot = CHAT_SPOTS[placeOf(spotList(item.spot)[0])];
    }
    // Serving needs a waiting guest and order work an order (§7-1) — availability, so the base side too.
    let score = freeSpots(item.spot, t, live, npc).length && available(archetype, p.state) ? item.weight : 0;
    if (item.habit) score = mul(score, P.habitMultiplier);
    if (Object.hasOwn(resident.multipliers, archetype.id)) score = mul(score, resident.multipliers[archetype.id]);
    // A resident who likes it quiet rests less at the cafe while it is crowded (§3-3 personality, W5).
    if (resident.crowdedRest !== undefined && archetype.kind === 'rest' && spotList(item.spot).every(id => placeOf(id) === 'cafe') && ctx.rushAt(t)) score = mul(score, resident.crowdedRest);
    const last = p.recent.at(-1);
    const repeatable = archetype.kind === 'rest' || p.rainMoved === archetype.id;
    if (!repeatable && last === archetype.id) score = 0;
    else if (!repeatable && p.recent.includes(archetype.id)) score = mul(score, P.repeatMultiplier);
    if (unvisited && spotList(item.spot).every(id => !p.placesToday.includes(placeOf(id)))) score = mul(score, unvisited);
    return { item, score };
  });
  // What a neighbour's doing and the cards' forerunners bring (§7-3, W5): the tea that just came, the wobble a careful eye
  // sees coming, the glad day after a find, the gladness of a pair solving.
  const tea = here ? teas.find(x => x.npc !== npc && placeOf(x.spot) === here && x.arriveMs < x.endMs && x.arriveMs <= t && x.arriveMs > p.prevT) : null;
  const wobble = resident.moods.some(m => m.factor === 'wobble-spotted') ? wobblePlaces(vs, C) : new Set();
  const excited = resident.moods.some(m => m.factor === 'excited-find') && (CARDS_OF[npc] || []).some(card => card.excites && vs.cards[card.id]?.last?.day === input.lifeDay - 1);
  // The chosen side (§6-4 고른 점수): the base score times weather and state, each factor kept for attribution.
  const chosenSide = (item, score, factors = []) => {
    const archetype = ARCHETYPE_BY_ID[item.archetype];
    let next = raining ? rainyChoice(item) : { ...item };
    let s = next.weather === 0 ? 0 : score;
    if (raining && next.weather === 0) factors.push({ kind: 'weather', key: 'rain', dir: 'down' });
    else if (raining && (next.spot !== item.spot || next.spots)) factors.push({ kind: 'weather', key: 'rain', dir: 'moved' });
    // The sheltered alternative must itself have room (§6-2 rainAlt).
    if (next.spots) s = next.spots.some(id => freeSpots(item.spot, t, live, npc).includes(id)) ? s : 0;
    else if (next.spot !== item.spot && !freeSpots(next.spot, t, live, npc).length) s = 0;
    // Cold hands on a wet or winter morning slow the workshop owner's work (§7-3 cold-hands).
    if (npc === 'workshop-owner' && band === 'morning' && (raining || input.season === 'winter') && archetype.kind === 'work') { s = mul(s, P.coldHandsMultiplier); factors.push({ kind: 'weather', key: 'cold-hands', dir: 'down' }); }
    // A clear tomorrow: the researcher tidies the board for it (§7-3 tomorrow-clear).
    if (npc === 'researcher' && band === 'evening' && input.weatherTomorrow === 'clear' && item.archetype === 'board-fold') { s = mul(s, P.tomorrowClearMultiplier); factors.push({ kind: 'weather', key: 'tomorrow-clear', dir: 'up' }); }
    // The resident's own state (§7-1): tired, busy, lonely.
    for (const f of stateFactors(resident, p.state, archetype, params)) { s = mul(s, f.perMille); factors.push({ kind: f.kind, key: f.key, dir: f.perMille > PER_MILLE ? 'up' : 'down' }); }
    if (p.glad?.key === 'pair-glad' && item.archetype === p.glad.archetype) { s = mul(s, C.pairGladMultiplier); factors.push({ kind: 'neighbour', key: 'pair-glad', dir: 'up' }); }
    if (tea && archetype.kind === 'rest') { s = mul(s, C.teaReceivedMultiplier); factors.push({ kind: 'neighbour', key: 'tea-received', dir: 'up' }); }
    if (wobble.size && item.archetype === 'fix-round' && wobble.has(placeOf(spotList(item.spot)[0]))) { s = mul(s, C.wobbleMultiplier); factors.push({ kind: 'card', key: 'wobble-spotted', dir: 'up' }); }
    if (excited && ['observe', 'show-drawing'].includes(item.archetype)) { s = mul(s, C.excitedMultiplier); factors.push({ kind: 'card', key: 'excited-find', dir: 'up' }); }
    return { item: next, score: s, factors };
  };
  const chosen = base.map(({ item, score }) => chosenSide(item, score));
  // Candidates weather and state add on the chosen side only (§6-4 더한 후보), with the resident's own multipliers.
  const add = (item, weight, factor) => {
    let score = freeSpots(item.spot, t, live, npc).length ? weight : 0;
    if (Object.hasOwn(resident.multipliers, item.archetype)) score = mul(score, resident.multipliers[item.archetype]);
    chosen.push(chosenSide(item, score, [{ ...factor, dir: 'added' }]));
  };
  if (npc === 'cafe-owner' && band === 'morning' && p.firstOfDay && !raining)
    add({ archetype: 'eaves-tea', spot: 'cafe.eaves', cause: 'weather' }, P.firstAromaWeight, { kind: 'weather', key: 'first-aroma' });
  const tray = vs.objects['cafe-tray']?.spot;
  if (npc === 'cafe-owner' && band === 'evening' && input.weatherTomorrow === 'rain' && tray && !SPOT_BY_ID[tray].sheltered)
    add({ archetype: 'bring-in', spot: 'cafe.eaves', cause: 'weather' }, P.bringInWeight, { kind: 'weather', key: 'tomorrow-rain' });
  // The day after a night with R4's flowers, a tired researcher's doze is that night's (§7-3 sleepy-night).
  for (const c of stateCandidates(resident, p.state, params)) add({ archetype: c.archetype, spot: c.spot, cause: 'state' }, c.weight,
    c.factor.key === 'doze' && p.allNighter ? { ...c.factor, key: 'sleepy-night' } : c.factor);
  // A card done with the player: at the next choice the resident is glad to use what they made (§7-3 with-player-glad).
  if (p.glad?.key === 'with-player-glad' && CARD_BY_ID[p.glad.card])
    add({ archetype: CARD_BY_ID[p.glad.card].archetype, spot: CARD_BY_ID[p.glad.card].spot, cause: 'card' }, C.withPlayerGladWeight, { kind: 'neighbour', key: 'with-player-glad' });
  const u = p.rng.next();
  // Glad of a card done with the player, the resident's next segment uses what they made (§7-3 「다음 조각에서」) when there is room.
  const gladAt = p.glad?.key === 'with-player-glad' && chosen.at(-1)?.score > 0 ? chosen.length - 1 : -1;
  const pickedChosen = gladAt >= 0 ? gladAt : pickByWeight(u, chosen.map(c => c.score));
  const pickedBase = pickByWeight(u, base.map(c => c.score));
  if (pickedChosen < 0) return { chosen: { archetype: 'pause', spot: resident.home, cause: 'blocked' }, base: null, reason: null };
  // The base's own factors are the ones its chosen-side twin met (same index).
  const theBase = pickedBase < 0 ? null : { item: base[pickedBase].item, factors: chosen[pickedBase].factors };
  const why = moodOf(resident, chosen[pickedChosen], theBase, band);
  const basis = why?.key === 'pair-glad' ? p.glad.basis : why?.key === 'tea-received' ? { kind: 'segment', npc: tea.npc, startMs: tea.startMs, archetype: tea.archetype }
    : why?.key === 'with-player-glad' ? { kind: 'take', card: p.glad.card } : null;
  return { chosen: chosen[pickedChosen].item, base: theBase?.item ?? null, reason: why?.tag ?? null, ...(basis ? { basis } : {}) };
}
/** The places where a resident object wears toward its card (§3-3 wobble-spotted): past wobbleShare of its threshold
 * while the card still waits to rise — the tray where it stands, the drawing support where the board is. */
function wobblePlaces(vs, C) {
  const out = new Set();
  for (const [object, { threshold, card }] of Object.entries(WEAR_THRESHOLDS)) {
    if (vs.wear[object] * PER_MILLE < threshold * C.wobbleShare || statusOf(vs, card) !== 'idle') continue;
    const at = object === 'cafe-tray' ? vs.objects['cafe-tray']?.spot : object === 'workshop-support' ? vs.objects['observation-board']?.spot : null;
    if (at) out.add(placeOf(at));
  }
  return out;
}
