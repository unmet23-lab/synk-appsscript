/** Residents' own state (vertical slice design §7-1·§7-2, W4): energy, chores and social. Never shown as
 * numbers (G2) and never read by learning, relationships or rewards (R3, NPC:285). A band's plan carries
 * them provisionally — each segment changes them as the planner places it — and closing the band keeps what
 * the same steps give over its final segments (§14-4): the planner and replay() run the same functions in
 * the same order (the band's events up to a decision time, then that segment), so the two never disagree.
 * Old worlds without them read the waking values (no migration). Every 〔초기값〕 is read by name from the
 * parameter version's state section (§20-6). G4: the player's part only moves them the good way — a scene
 * that reached its result together, help at the cafe, a routine the player made — and absence, silence, a
 * decline or a pass never moves them. Every change carries its cause so a test can see none of the
 * player's is bad (§15-2).
 */
import { createRng } from './rng.mjs';
import { weekdayOf, dayKindOf, MINUTE } from './clock.mjs';
import { paramsFor } from './params.mjs';
import { ARCHETYPES } from './data.gen.mjs';

// Here rather than in params.mjs: a name new to an already published module would stop the town's module links
// for a browser still holding the older module (the ten-minute cache). Numbers the state section also holds are
// never written here (tests/town-params.test.js), so per-mille is 1e3.
/** Multipliers and shares are per-mille integers (§2-4): ×1.5 is 1500. */
export const PER_MILLE = 1e3;
export const perMille = (n, share) => Math.floor(n * share / PER_MILLE);

export const STATS = Object.freeze(['energy', 'chores', 'social']);
/** Causes behind which the player stands (G4); their changes are good-side only. */
export const PLAYER_CAUSES = Object.freeze(['together', 'help', 'player-routine']);
const DAYS_IN_WEEK = 7;
const WORK_KINDS = new Set(['work', 'carry']);
const EVENT_ORDER = ['guests', 'orders', 'together'];
const ARCHETYPE = Object.freeze(Object.fromEntries(ARCHETYPES.map(a => [a.id, a])));
const S = params => (params ?? paramsFor()).state;
const bound = (stat, value, s) => Math.max(0, Math.min(s[`${stat}Max`], value));
/** The worse direction of each stat: more chores is worse, less energy or social is worse. */
export const worse = (stat, delta) => (stat === 'chores' ? delta > 0 : delta < 0);

/** The orders that reach the workshop on a life day (§7-1): a seeded 0~2, and the week's big order on one seeded
 * weekday. They come in as the day band starts — the owner tends the tools in the morning and works orders by
 * day (§3-3 하루), and a big order lands at lunch (review P1-2). */
export const ordersOn = (seed, lifeDay, params) => createRng(seed, 'orders', lifeDay).between(S(params).dailyOrders[0], S(params).dailyOrders[1]);
export const bigOrderOn = (seed, lifeDay) => createRng(seed, 'big-order', lifeDay - weekdayOf(lifeDay)).below(DAYS_IN_WEEK) === weekdayOf(lifeDay);

/** A resident's state as a band begins, the waking values standing in for what an old world lacks. */
export function stateOf(resident, prior = {}, params) {
  const s = S(params);
  return { energy: prior.energy ?? s.wakeEnergy, chores: prior.chores ?? 0, social: prior.social ?? s.socialRest, choresTick: prior.choresTick ?? 0 };
}

/** Waking on a new life day (§7-1 하루 시작): energy back to at least the waking value and social halfway to its
 * resting value — a time effect for everyone (§7-2). Chores carry over. After a night up with its own card (R4's
 * flowers past bedtime — prior.lateNight, W5) the resident wakes at the all-nighter's energy instead; nothing the
 * player does can make that night (G4). Returns the state and its log. */
export function wake(resident, prior, { atMs }, params) {
  const s = S(params), before = stateOf(resident, prior, params), log = [];
  const next = { ...before, energy: prior.lateNight ? s.allNighterEnergy : Math.max(before.energy, s.wakeEnergy), social: (before.social + s.socialRest) >> 1 };
  for (const stat of STATS) if (next[stat] !== before[stat]) log.push({ npc: resident.id, atMs, stat, delta: next[stat] - before[stat], cause: 'wake' });
  return { state: next, log };
}

/** What happens to a resident's state inside a band besides its own segments, sorted by time (§7-1·§7-2):
 * background guests reaching the cafe in one or two rushes (a seeded count for the day kind times the band's
 * share — the day band has the most), the day's orders as the day band starts, and the end of a hold whose
 * scene reached its result with the player (once a band). window is the resident's waking part of the band;
 * holds are the reservations touching the band with their effective toMs. */
export function bandEvents(resident, { seed, lifeDay, band, window, holds = [] }, params) {
  const s = S(params), out = [];
  if (window && window.toMs > window.fromMs) {
    if (resident.chores === 'guests') {
      const rng = createRng(seed, 'guests', lifeDay, band), range = s.cafeGuests[dayKindOf(lifeDay) === 'weekend' ? 'weekend' : 'weekday'];
      const count = perMille(rng.between(range[0], range[1]), s.cafeGuests.bandShare[band]);
      const rushes = Math.min(count, rng.between(s.cafeGuests.rushes[0], s.cafeGuests.rushes[1]));
      const minutes = Math.max(1, Math.floor((window.toMs - window.fromMs) / MINUTE));
      const times = Array.from({ length: rushes }, () => window.fromMs + rng.below(minutes) * MINUTE).sort((a, b) => a - b);
      times.forEach((atMs, i) => out.push({ atMs, type: 'guests', count: Math.floor(count / rushes) + (i < count % rushes ? 1 : 0) }));
    }
    if (resident.chores === 'orders' && band === 'day') {
      const count = ordersOn(seed, lifeDay, params) + (bigOrderOn(seed, lifeDay) ? s.bigOrder : 0);
      if (count) out.push({ atMs: window.fromMs, type: 'orders', count });
    }
  }
  // A hold ending exactly as the band ends is this band's: the next band no longer touches it (review GA1).
  for (const h of holds) if (h.npc === resident.id && h.with && Number.isSafeInteger(h.toMs) && window && h.toMs > window.bandStartMs && h.toMs <= window.bandEndMs)
    out.push({ atMs: h.toMs, type: 'together', help: h.help || 0, by: h.id });
  return out.sort((a, b) => a.atMs - b.atMs || EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || (a.by < b.by ? -1 : a.by > b.by ? 1 : 0));
}

/** A band's running state: the stats and what this band has seen so far. */
export const running = (resident, start) => ({ npc: resident.id, ...start, guestSocial: 0, gained: false, held: false, together: false, next: 0 });
/** The persisted part of a running state. */
export const keptState = st => ({ energy: st.energy, chores: st.chores, social: st.social, choresTick: st.choresTick });

function change(st, stat, delta, cause, atMs, log, s) {
  if (!delta) return;
  const next = bound(stat, st[stat] + delta, s);
  if (next === st[stat]) return;
  log.push({ npc: st.npc, atMs, stat, delta: next - st[stat], cause });
  st[stat] = next;
}

/** Apply the band's events up to and including atMs. A rush that arrives while a scene holds the cafe owner
 * leaves no one waiting — the scene attends to the cafe, so a hold never leaves the owner busier (G4). */
export function advance(st, events, atMs, { heldAt = () => false } = {}, log = [], params) {
  const s = S(params);
  for (; st.next < events.length && events[st.next].atMs <= atMs; st.next++) {
    const e = events[st.next];
    if (e.type === 'guests' && !heldAt(e.atMs)) change(st, 'chores', e.count, 'guest', e.atMs, log, s);
    else if (e.type === 'orders') change(st, 'chores', e.count, 'orders', e.atMs, log, s);
    else if (e.type === 'together') {
      if (!st.together) { st.together = true; st.gained = true; change(st, 'social', s.togetherSocial, 'together', e.atMs, log, s); }
      if (e.help) change(st, 'chores', -e.help, 'help', e.atMs, log, s);
    }
  }
  return st;
}

/** One placed segment's change (§7-1): the archetype's energy, social and chores — chores every choresEvery-th
 * time — kept to the good side when the player made the routine (a habit spot, an accepted promise; G4 · §7-2).
 * A segment a scene holds changes nothing. A segment cut by a hold counts whole (review P2-2): it changed
 * the state when it was placed, before anyone held the resident. Guests' social stops at the band's cap. */
export function finishSegment(st, archetype, { atMs, playerMade = false, reserved = false }, log = [], params) {
  const s = S(params);
  if (reserved) { st.held = true; return st; }
  if (!archetype) return st;
  const cause = playerMade ? 'player-routine' : 'routine';
  const keep = (stat, delta) => (playerMade && worse(stat, delta) ? 0 : delta);
  change(st, 'energy', keep('energy', archetype.energy), cause, atMs, log, s);
  let chores = archetype.chores;
  if (archetype.choresEvery) {
    st.choresTick += 1;
    if (st.choresTick >= archetype.choresEvery) st.choresTick = 0; else chores = 0;
  }
  change(st, 'chores', keep('chores', chores), cause, atMs, log, s);
  let social = keep('social', archetype.social);
  if (archetype.needs === 'guests' && social > 0) { social = Math.max(0, Math.min(social, s.guestSocialMax - st.guestSocial)); st.guestSocial += social; }
  if (social > 0) st.gained = true;
  change(st, 'social', social, cause, atMs, log, s);
  return st;
}

/** A band's end (§7-1): a band spent awake with no social at all costs social — never one a scene held. */
export function endBand(st, { atMs, awake }, log = [], params) {
  const s = S(params);
  if (awake && !st.gained && !st.held) change(st, 'social', -s.aloneSocial, 'alone', atMs, log, s);
  return st;
}

/** Whether a segment is a routine the player made (G4): a formed habit spot, an accepted promise, or what the time the
 * player usually comes added to the day (W6, §10-3). */
export const playerMade = segment => segment.habit === true || segment.cause === 'promise' || segment.visitHabit === true;

/** A resident's state over its segments of one band, in time order, with the band's events — the same steps the
 * planner took while placing them (a merged segment once a piece, at that piece's decision time). untilMs: events
 * up to it; end: also the band's end rule. Returns the running state (keptState for what persists) and the change log. */
export function replay(resident, start, segments, events, { untilMs, end = null } = {}, params) {
  const st = running(resident, start), log = [];
  const holds = segments.filter(x => x.archetype === 'reserved');
  const heldAt = ms => holds.some(h => h.startMs <= ms && ms < h.endMs);
  for (const seg of segments) {
    if (seg.archetype === 'reserved') { advance(st, events, seg.startMs, { heldAt }, log, params); finishSegment(st, null, { reserved: true }, log, params); continue; }
    const archetype = ARCHETYPE[seg.archetype] ?? null;
    for (const at of seg.pieceStarts ?? [seg.startMs]) {
      advance(st, events, at, { heldAt }, log, params);
      finishSegment(st, archetype, { atMs: at, playerMade: playerMade(seg) }, log, params);
    }
  }
  advance(st, events, untilMs, { heldAt }, log, params);
  if (end) endBand(st, { atMs: end.atMs, awake: segments.length > 0 }, log, params);
  return { state: st, log };
}

/** The chosen-side state multipliers on one candidate (§6-4 상태 배수, §7-1): tired raises rest and lowers
 * work, busy lowers rest and talk (the pair scene's stand-in until W5), lonely raises neighbour visits.
 * Each is { kind, key, perMille } — kind is body (energy), work (chores) or neighbour (social). */
export function stateFactors(resident, st, archetype, params) {
  const s = S(params), out = [];
  if (st.energy < resident.restThreshold) {
    if (archetype.kind === 'rest') out.push({ kind: 'body', key: 'tired', perMille: s.tiredRestMultiplier });
    else if (WORK_KINDS.has(archetype.kind)) out.push({ kind: 'body', key: 'tired', perMille: s.tiredWorkMultiplier });
  }
  if (st.chores >= s.busyChores && (archetype.kind === 'rest' || archetype.kind === 'talk'))
    out.push({ kind: 'work', key: 'busy', perMille: archetype.kind === 'rest' ? s.busyRestMultiplier : s.busyPairMultiplier });
  if (st.social < s.lonelySocial && (archetype.visit || archetype.kind === 'talk')) out.push({ kind: 'neighbour', key: 'lonely', perMille: s.lonelyMultiplier });
  return out;
}

/** The candidates a state adds on the chosen side (§6-4): a doze below the rest threshold. */
export function stateCandidates(resident, st, params) {
  const s = S(params);
  return st.energy < resident.restThreshold && resident.dozeSpot
    ? [{ archetype: 'doze', spot: resident.dozeSpot, weight: s.dozeWeight, factor: { kind: 'body', key: 'doze' } }] : [];
}

/** Whether a candidate can be done at all (the base side's availability, §6-4): serving needs a waiting guest,
 * order work an order — with none, there is nothing to serve or make. */
export const available = (archetype, st) => !archetype?.needs || st.chores > 0;

/** The day's mood for dialogue (§7-1 끝 — 대화:229, W9): a busy day, a sleepy afternoon, a glad day — from the
 * state and the reasons that showed today, never from the date alone. null on an ordinary day. */
export const GLAD_REASONS = Object.freeze(['first-aroma', 'pair-glad', 'with-player-glad']);
export function dayMoodOf(resident, st, moodsToday = [], params) {
  const s = S(params);
  if (st.chores >= s.busyChores) return 'busy';
  if (st.energy < resident.restThreshold) return 'sleepy';
  if (moodsToday.some(reason => GLAD_REASONS.includes(reason))) return 'glad';
  return null;
}
