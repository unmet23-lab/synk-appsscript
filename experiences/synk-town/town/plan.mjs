/** Band planner (vertical slice design §6-4): who does what, where, during one band.
 * Pure and deterministic. Residents are planned together in time order (a min-heap on
 * decision time, ties in resident order) so a spot is never double-booked; each resident
 * draws from its own random stream. A decision event (a reservation, rain starting on
 * someone outside) re-plans only the resident it touches, from that instant, around
 * everyone else's fixed segments — so my time with the cafe owner never changes what the
 * researcher does. Weights and multipliers are per-mille integers (§2-4). Each choice
 * picks twice with the same u — from the base scores (weight, availability, habit,
 * personality, repetition) and from the chosen scores (those times weather, state and
 * card) — so a change of mind can be told from a routine choice (§7-3, attribution in W4).
 * The planner only describes the band; results (wear, habit uses, state) are applied when
 * the band closes (§14-4). Its 〔초기값〕 come by name from a parameter version (§20-6):
 * input.params, or the first version.
 */
import { ARCHETYPES, RESIDENTS, ROUTINES, RAIN_ALT } from './data.gen.mjs';
import { SPOT_BY_ID, SPOT_GROUPS, FT_SEATS } from './places.mjs';
import { createRng, pickByWeight } from './rng.mjs';
import { dayKindOf, weatherAt as clockWeatherAt, weatherChangesBetween, MINUTE } from './clock.mjs';
import { paramsFor } from './params.mjs';

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

/** The routine pool for a resident at a band, with the visit-habit pool when it applies. */
export function routineCell(npc, lifeDay, band, { visitHabit = null } = {}) {
  const cell = ROUTINE_BY_KEY[`${npc}|${dayKindFor(npc, lifeDay)}|${band}`];
  return visitHabit && cell.habitPool?.[visitHabit] ? cell.habitPool[visitHabit] : cell.pool;
}

/** The spot a first-day agreement points at (§6-5): an FT seat, or the place's own resting spot. */
export function agreementSpot(agreement) {
  if (!agreement || agreement.choice === 'delegate') return null;
  if (agreement.target?.kind === 'seat' && FT_SEATS[agreement.target.placement]) return FT_SEATS[agreement.target.placement].spot;
  return agreement.location === 'greenhouse' ? 'greenhouse.bench' : agreement.location === 'cafe' ? 'cafe.eaves-left' : null;
}

const spotList = name => SPOT_GROUPS[name] || [name];
const placeOf = spotId => SPOT_BY_ID[spotId].place;
const distance = (a, b) => (a && b ? Math.hypot(SPOT_BY_ID[a].at.x - SPOT_BY_ID[b].at.x, SPOT_BY_ID[a].at.z - SPOT_BY_ID[b].at.z) : 0);
/** Walking time between spots; residents walk slower than the player (planner.residentSpeed, m/s). */
export const travelMs = (from, to, planner = paramsFor().planner) => Math.ceil(distance(from, to) / planner.residentSpeed) * 1000;
const sheltered = name => spotList(name).every(id => SPOT_BY_ID[id].sheltered);

/** Spots of a name a resident may take at t: capacity minus what others hold then (travel included). */
function freeSpots(name, t, held, npc) {
  return spotList(name).filter(id => {
    let busy = 0;
    for (const s of held) if (s.npc !== npc && s.spot === id && s.startMs <= t && t < s.endMs) busy++;
    return busy < SPOT_BY_ID[id].capacity;
  });
}
const neighbourAt = (npc, place, t, held) => held.some(s => s.npc !== npc && s.npc !== 'guest' && s.archetype !== 'reserved'
  && s.startMs <= t && t < s.endMs && SPOT_BY_ID[s.spot].place === place);

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
 *   weatherTomorrow, season, visitHabit, residents: { npc: { recent, placesToday, lastSpot, firstOfDay } },
 *   reservations: [{ id, npc, fromMs, toMs|null, spot? }], promises: [{ id, npc, archetype, spot }],
 *   habits: { npc: [{ spot, archetype }] }, objects: { id: { spot } },
 *   occupied: [{ spot, fromMs, toMs }] — spots held by something that is not a resident (an FT10 guest),
 *   params? — a parameter version from paramsFor (§20-6), the first version when absent } */
export function planBand(input) {
  const { villageSeed, lifeDay, band, startMs, endMs, dayStartMs, planCmdRev } = input;
  if (!Number.isSafeInteger(planCmdRev)) throw new TypeError('planBand needs planCmdRev');
  const P = (input.params ?? paramsFor()).planner;
  const weatherAt = input.weatherAt || (ms => clockWeatherAt(villageSeed, ms));
  // Rain starting inside the band is a decision point for whoever is outside then (§6-4).
  const rainStarts = input.weatherAt ? scanRainStarts(weatherAt, startMs, endMs)
    : weatherChangesBetween(villageSeed, startMs, endMs).filter(c => c.to === 'rain').map(c => c.atMs);
  const fixed = (input.occupied || []).map(o => ({ npc: 'guest', spot: o.spot, startMs: o.fromMs, endMs: o.toMs, archetype: 'guest' }));
  const ctx = { input, weatherAt, rainStarts, P };
  const reservations = [...(input.reservations || [])].sort((a, b) => a.fromMs - b.fromMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Pass one: the band as it would go with no one held.
  const starts = Object.fromEntries(RESIDENT_IDS.map(npc => [npc, startOf(npc, input)]));
  let segments = planRange(RESIDENT_IDS, starts, fixed, ctx, npc => createRng(villageSeed, 'plan', lifeDay, band, npc, planCmdRev));
  const deferred = segments.deferred;
  // Each reservation re-plans only its resident, after the hold, around everyone else.
  for (const hold of reservations) {
    const npc = hold.npc, s = starts[npc];
    if (!s || hold.fromMs >= s.end) continue;
    const from = Math.max(hold.fromMs, s.t), to = hold.toMs === null || hold.toMs === undefined ? s.end : Math.min(hold.toMs, s.end);
    if (to <= s.t) continue;
    const before = segments.filter(x => x.npc === npc && x.startMs < from).map(x => (x.endMs > from ? { ...x, endMs: from, arriveMs: Math.min(x.arriveMs, from) } : x));
    const others = segments.filter(x => x.npc !== npc);
    const prior = summarize(before, input.residents?.[npc], P);
    const holding = { npc, startMs: from, arriveMs: from, endMs: to, archetype: 'reserved', spot: hold.spot ?? prior.lastSpot ?? RESIDENT_BY_ID[npc].home, cause: 'reservation', reservation: hold.id, base: null };
    const after = to < s.end ? planRange([npc], { [npc]: { ...s, t: to, prior: { ...prior, lastSpot: holding.spot } } }, [...fixed, ...others, ...before, holding], ctx,
      () => createRng(villageSeed, 'replan', lifeDay, band, npc, planCmdRev, Math.floor((to - startMs) / MINUTE), hold.id)) : [];
    segments = [...others, ...before, holding, ...after];
  }
  segments.sort((a, b) => a.startMs - b.startMs || order(a.npc) - order(b.npc));
  const residents = Object.fromEntries(RESIDENT_IDS.map(npc => [npc, summarize(segments.filter(x => x.npc === npc), input.residents?.[npc], P)]));
  return { segments, residents, objects: objectsAfter(input.objects, segments), deferredPromises: deferred };
}

function startOf(npc, input) {
  const { wakeMs, sleepMs } = awakeWindow(npc, input.lifeDay, input.dayStartMs, { visitHabit: input.visitHabit });
  const t = Math.max(input.startMs, wakeMs), end = Math.min(input.endMs, sleepMs);
  return t < end ? { t, end, prior: input.residents?.[npc] || {} } : null;
}

/** What a resident carries into the next band: the last few archetypes, places today, last spot. */
function summarize(mine, prior = {}, P) {
  let recent = [...(prior.recent || [])], places = [...(prior.placesToday || [])], lastSpot = prior.lastSpot ?? null, firstOfDay = prior.firstOfDay !== false;
  for (const s of mine) {
    if (s.archetype !== 'reserved') recent = [...recent, s.archetype].slice(-P.recentWindow);
    if (!places.includes(placeOf(s.spot))) places.push(placeOf(s.spot));
    lastSpot = s.spot; firstOfDay = false;
  }
  return { recent, placesToday: places, lastSpot, firstOfDay };
}

function objectsAfter(objects = {}, segments) {
  const out = structuredClone(objects);
  for (const s of segments) {
    const move = ARCHETYPE_BY_ID[s.archetype]?.moves;
    if (!move) continue;
    const current = out[move.object]?.spot;
    if (!move.onlyFromOutside || (current && !SPOT_BY_ID[current].sheltered)) out[move.object] = { spot: move.to === 'spot' ? s.spot : move.to };
  }
  return out;
}

function scanRainStarts(weatherAt, startMs, endMs) {
  const out = [];
  for (let t = startMs; t < endMs;) {
    const next = Math.min(endMs, t + 15 * MINUTE);
    if (next < endMs && weatherAt(t) === 'clear' && weatherAt(next) === 'rain') {
      let lo = t + 1, hi = next;
      while (lo < hi) { const mid = lo + Math.floor((hi - lo) / 2); if (weatherAt(mid) === 'rain') hi = mid; else lo = mid + 1; }
      out.push(lo);
    }
    t = next;
  }
  return out;
}

/** Plan the given residents from their start times, in time order, around fixed segments. */
function planRange(npcs, starts, fixed, ctx, rngFor) {
  const { input } = ctx;
  const people = {};
  for (const npc of npcs) {
    const s = starts[npc];
    if (!s) continue;
    const prior = s.prior || {};
    people[npc] = { t: s.t, end: s.end, rng: rngFor(npc), recent: [...(prior.recent || [])], placesToday: [...(prior.placesToday || [])],
      lastSpot: prior.lastSpot ?? null, firstOfDay: prior.firstOfDay !== false, promises: (input.promises || []).filter(p => p.npc === npc) };
  }
  const objects = structuredClone(input.objects || {});
  const made = [], deferred = [];
  let live = [...fixed];

  // Put one chosen item on the timeline at the resident's next decision time.
  const P = ctx.P;
  const pause = { ...PAUSE, length: P.pauseMinutes };
  const place = (npc, picked, raining) => {
    const p = people[npc], t = p.t;
    const archetype = ARCHETYPE_BY_ID[picked.chosen.archetype] || pause;
    const options = picked.chosen.spots || spotList(picked.chosen.spot);
    const free = freeSpots(picked.chosen.spot, t, live, npc).filter(id => options.includes(id));
    // Blocked: stay put a few minutes where one already is (§6-4 막힘 — the stand-still alternative, NPC:397).
    const stay = p.lastSpot && !(raining && !SPOT_BY_ID[p.lastSpot].sheltered) ? p.lastSpot : RESIDENT_BY_ID[npc].home;
    const spot = picked.chosen.cause === 'blocked' ? stay : free.length ? free[p.rng.below(free.length)] : RESIDENT_BY_ID[npc].home;
    const lengthMs = p.rng.between(archetype.length[0], archetype.length[1]) * MINUTE;
    let end = Math.min(t + travelMs(p.lastSpot, spot, P) + lengthMs, p.end);
    // Someone outside when rain begins stops there and decides again (§6-4).
    const rainCut = !SPOT_BY_ID[spot].sheltered ? ctx.rainStarts.find(w => w > t && w < end) : undefined;
    if (rainCut !== undefined) end = rainCut;
    if (end <= t) end = Math.min(t + MINUTE, p.end);
    const arriveMs = Math.min(t + travelMs(p.lastSpot, spot, P), end);
    const cause = picked.chosen.cause || 'routine';
    const previous = made.findLast(x => x.npc === npc);
    if (previous && previous.endMs === t && previous.archetype === archetype.id && previous.spot === spot && previous.cause === cause) {
      // Going on with the same thing in the same place is one longer segment, not a restart.
      previous.endMs = end;
    } else {
      const segment = { npc, startMs: t, arriveMs, endMs: end, archetype: archetype.id, spot, cause,
        ...(picked.chosen.reason ? { reason: picked.chosen.reason } : {}), ...(picked.chosen.promise ? { promise: picked.chosen.promise } : {}),
        ...(p.rainMoved === archetype.id ? { moved: 'rain' } : {}),
        base: picked.base ? { archetype: picked.base.archetype, spot: picked.base.spot } : null };
      made.push(segment); live.push(segment);
    }
    p.recent = [...p.recent, archetype.id].slice(-P.recentWindow);
    if (!p.placesToday.includes(placeOf(spot))) p.placesToday.push(placeOf(spot));
    p.lastSpot = spot; p.firstOfDay = false; p.t = end; p.rainMoved = null;
    if (archetype.moves) {
      const current = objects[archetype.moves.object]?.spot;
      if (!archetype.moves.onlyFromOutside || (current && !SPOT_BY_ID[current].sheltered)) objects[archetype.moves.object] = { spot: archetype.moves.to === 'spot' ? spot : archetype.moves.to };
    }
    // Work cut by rain may go on under cover once: that is the same activity moved, not a repeat.
    if (rainCut !== undefined) {
      p.rainMoved = archetype.id;
      p.rng = createRng(input.villageSeed, 'replan', input.lifeDay, input.band, npc, input.planCmdRev, Math.floor((rainCut - input.startMs) / MINUTE), `rain:${rainCut}`);
    }
  };

  // Fixed items first (§6-4): accepted promises take their spots before any routine choice; in rain
  // they move under cover, and with no shelter they wait for a clear band (§4-5).
  for (const npc of Object.keys(people).sort((a, b) => order(a) - order(b))) {
    const p = people[npc];
    while (p.promises.length && p.t < p.end) {
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
    live = live.filter(x => x.endMs >= t);
    const raining = ctx.weatherAt(t) === 'rain';
    place(npc, scoreAndPick(npc, p, t, raining, input, live, objects, P), raining);
  }
  made.deferred = deferred;
  return made;
}

function scoreAndPick(npc, p, t, raining, input, live, objects, P) {
  const resident = RESIDENT_BY_ID[npc], band = input.band;
  const pool = routineCell(npc, input.lifeDay, band, { visitHabit: input.visitHabit }).map(item => ({ ...item }));
  for (const habit of input.habits?.[npc] || []) pool.push({ archetype: habit.archetype, spot: habit.spot, weight: P.habitWeight, habit: true });
  // Three places a day (§6-2): the evening pulls toward a place not yet visited, harder in its last hour.
  const unvisited = band === 'evening' && p.placesToday.length < P.placesPerDay
    ? (p.end - t <= P.lastHourMinutes * MINUTE ? P.eveningPullLastHour : P.eveningPull) : 0;
  const base = pool.map(item => {
    const archetype = ARCHETYPE_BY_ID[item.archetype];
    // Talk needs a neighbour awake at that place right now; full pair scenes arrive with W5.
    if (archetype.kind === 'talk' && !neighbourAt(npc, placeOf(spotList(item.spot)[0]), t, live)) return { item, score: 0 };
    let score = freeSpots(item.spot, t, live, npc).length ? item.weight : 0;
    if (item.habit) score = mul(score, P.habitMultiplier);
    if (Object.hasOwn(resident.multipliers, archetype.id)) score = mul(score, resident.multipliers[archetype.id]);
    const last = p.recent.at(-1);
    const repeatable = archetype.kind === 'rest' || p.rainMoved === archetype.id;
    if (!repeatable && last === archetype.id) score = 0;
    else if (!repeatable && p.recent.includes(archetype.id)) score = mul(score, P.repeatMultiplier);
    if (unvisited && spotList(item.spot).every(id => !p.placesToday.includes(placeOf(id)))) score = mul(score, unvisited);
    return { item, score };
  });
  const chosen = base.map(({ item, score }) => {
    let next = raining ? rainyChoice(item) : { ...item };
    let s = next.weather === 0 ? 0 : score;
    // The sheltered alternative must itself have room (§6-2 rainAlt).
    if (next.spots) s = next.spots.some(id => freeSpots(item.spot, t, live, npc).includes(id)) ? s : 0;
    else if (next.spot !== item.spot && !freeSpots(next.spot, t, live, npc).length) s = 0;
    // Cold hands on a wet or winter morning slow the workshop owner's work (§7-3 cold-hands).
    if (npc === 'workshop-owner' && band === 'morning' && (raining || input.season === 'winter') && ARCHETYPE_BY_ID[item.archetype].kind === 'work') { s = mul(s, P.coldHandsMultiplier); next = { ...next, cause: 'weather', reason: 'cold-hands' }; }
    // A clear tomorrow: the researcher tidies the board for it (§7-3 tomorrow-clear).
    if (npc === 'researcher' && band === 'evening' && input.weatherTomorrow === 'clear' && item.archetype === 'board-fold') { s = mul(s, P.tomorrowClearMultiplier); next = { ...next, cause: 'weather', reason: 'tomorrow-clear' }; }
    return { item: next, score: s };
  });
  // Candidates the weather adds on the chosen side only (§6-4 더한 후보).
  if (npc === 'cafe-owner' && band === 'morning' && p.firstOfDay && !raining) {
    chosen.push({ item: { archetype: 'eaves-tea', spot: 'cafe.eaves', cause: 'weather', reason: 'first-aroma' }, score: freeSpots('cafe.eaves', t, live, npc).length ? P.firstAromaWeight : 0 });
  }
  const tray = objects['cafe-tray']?.spot;
  if (npc === 'cafe-owner' && band === 'evening' && input.weatherTomorrow === 'rain' && tray && !SPOT_BY_ID[tray].sheltered) {
    chosen.push({ item: { archetype: 'bring-in', spot: 'cafe.eaves', cause: 'weather', reason: 'tomorrow-rain' }, score: freeSpots('cafe.eaves', t, live, npc).length ? P.bringInWeight : 0 });
  }
  const u = p.rng.next();
  const pickedChosen = pickByWeight(u, chosen.map(c => c.score));
  const pickedBase = pickByWeight(u, base.map(c => c.score));
  if (pickedChosen < 0) return { chosen: { archetype: 'pause', spot: resident.home, cause: 'blocked' }, base: null };
  return { chosen: chosen[pickedChosen].item, base: pickedBase < 0 ? null : base[pickedBase].item };
}
