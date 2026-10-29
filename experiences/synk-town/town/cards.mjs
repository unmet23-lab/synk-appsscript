/** Small need cards (vertical slice design §8, W5): what rises from the real world — a resident object's wear, rain, a
 * season, the owner's own state or turn — and how it is solved: alone, by two neighbours, or with the player. A card is
 * the planner's decision (plan.mjs): it rises at its owner's decision time and is solved at the owner's next one, the
 * same whether the player is there or not (§15-2). Everything the residents share moves through one village state in
 * time order (§2-1 시각 순 마을 상태): card states, the objects' wear and traces, where the objects are, the pairs and
 * the day's marks. The planner walks it while placing segments; a band's close walks it again over the final segments
 * with the same functions (villageAfter), so the two agree — and a solving is read from the final segments (rule H): an
 * owner whose solving segment a hold took away has not solved it, a neighbour who came alone solved it for two, a
 * neighbour who never arrived left it to the owner, and a card the player took is the player's. Plain module; every
 * 〔초기값〕 comes from the parameter version's cards section by name.
 */
import { ARCHETYPES, RAIN_ALT } from './data.gen.mjs';
// The generated data is read as a namespace: a browser still holding an older data.gen.mjs (the ten-minute cache)
// keeps its module links and only lacks the W5 tables, as the mood lines did in W4.
import * as DATA from './data.gen.mjs';
import { SPOT_BY_ID, SPOT_GROUPS } from './places.mjs';
import { paramsFor } from './params.mjs';
import { createRng, pickByWeight } from './rng.mjs';
import { PER_MILLE, perMille, playerMade } from './state.mjs';
import { MINUTE } from './clock.mjs';

const CARDS = DATA.CARDS ?? [], PAIRS = DATA.PAIRS ?? [];
export const CARD_BY_ID = Object.freeze(Object.fromEntries(CARDS.map(card => [card.id, card])));
const ARCHETYPE_BY_ID = Object.freeze(Object.fromEntries(ARCHETYPES.map(a => [a.id, a])));
export const CARD_IDS = Object.freeze(CARDS.map(card => card.id));
/** The resident objects whose wear a card counts (§8-2) and the uses at which each card rises. */
export const WEAR_OBJECTS = Object.freeze(['cafe-tray', 'leaf-jar', 'tools', 'workshop-support']);
const WEAR_CARD = Object.freeze(Object.fromEntries(CARDS.filter(c => ['wear', 'after'].includes(c.trigger.kind)).map(c => [c.trigger.object, c])));
export const PATHS = Object.freeze(['self', 'pair', 'player']);
const RESIDENTS = Object.freeze(['cafe-owner', 'workshop-owner', 'researcher']);
/** The order a decision looks at its cards: a passing moment first (rain, a crowd, the night, the season's leaves), the
 * owner's own state next, wear last — a worn thing waits past its threshold (§8-3), a moment does not come back. */
const MOMENT_FIRST = Object.freeze(['rain-start', 'rain-stop', 'after-rain', 'night-clear', 'season-leaf', 'rush', 'count', 'state', 'after', 'wear', 'first-visit']);
/** Each resident's cards that can rise in this slice (a locked card waits for its bundle), in that order. */
export const CARDS_OF = Object.freeze(Object.fromEntries(RESIDENTS.map(npc => [npc, Object.freeze(CARDS.filter(c => c.owner === npc && !c.locked)
  .sort((a, b) => MOMENT_FIRST.indexOf(a.trigger.kind) - MOMENT_FIRST.indexOf(b.trigger.kind)))])));
/** The wear cards: object → its threshold and card (§8-2). */
export const WEAR_THRESHOLDS = Object.freeze(Object.fromEntries(CARDS.filter(c => c.trigger.kind === 'wear')
  .map(c => [c.trigger.object, Object.freeze({ threshold: c.trigger.threshold, card: c.id })])));
const order = npc => RESIDENTS.indexOf(npc);
const C = params => (params ?? paramsFor()).cards;
const P = vs => vs.params ?? paramsFor();
const spotList = name => SPOT_GROUPS[name] || [name];
const placeOfSpot = name => SPOT_BY_ID[spotList(name)[0]].place;
export const START_OBJECTS = Object.freeze({ 'cafe-tray': { spot: 'cafe.prep' }, 'observation-board': { spot: 'greenhouse.board' } });

/** A trigger's key: its life day, band and minute in the band — the same however often the band is planned (§2-1). */
export const cardKey = (lifeDay, band, startMs, atMs) => `${lifeDay}.${band}.${Math.floor((atMs - startMs) / MINUTE)}`;
/** A result's reference: the band it was solved in and the card (§2-6, F16) — not the event's number, which other
 * player-side events push along. */
export const cardRef = (lifeDay, band, card) => `${lifeDay}.${band}.${card}`;
export const CARD_REF = /^\d+\.(?:morning|day|evening|night)\.[CWR][1-6]$/;

/** A card's state as the band reads it (§8-3): a cooldown whose day has come is idle again. Stored states are
 * { status: triggered, key, at, day } · { status: cooldown, until, day } · idle, each keeping times and last. */
export function cardStatus(record, lifeDay) {
  if (!record || record.status === 'idle') return 'idle';
  if (record.status === 'cooldown' && lifeDay >= record.until) return 'idle';
  return record.status;
}
const PAIR_OF = Object.freeze(Object.fromEntries(RESIDENTS.map(a => [a, Object.freeze(Object.fromEntries(PAIRS.filter(p => p.members.includes(a))
  .map(p => [p.members.find(m => m !== a), p])))])));
const pairOf = (a, b) => PAIR_OF[a]?.[b] ?? null;
export const pairKeyOf = (a, b) => pairOf(a, b)?.key ?? null;

// The village's own plain records (spots, traces, pairs): a JSON copy is the cheapest whole copy.
const copy = value => JSON.parse(JSON.stringify(value));
/** The band's shared state as it starts (old worlds: no cards, no wear, no traces — every card idle). */
export function villageStart(input, params = input.params) {
  const cards = {};
  for (const [id, record] of Object.entries(input.cards || {})) if (CARD_BY_ID[id]) cards[id] = { ...record };
  return { lifeDay: input.lifeDay, band: input.band, startMs: input.startMs,
    cards, wear: Object.fromEntries(WEAR_OBJECTS.map(obj => [obj, input.wear?.[obj] ?? 0])),
    traces: copy(input.traces || {}), objects: copy(input.objects || START_OBJECTS), pairs: copy(input.pairs || {}),
    marks: { ...(input.marks || {}), ...(input.marks?.scenesDay === input.lifeDay ? {} : { scenesDay: input.lifeDay, scenes: 0 }) },
    chats: new Set(), resolved: [], scenes: [], params: params ?? paramsFor() };
}
const record = (vs, id) => (vs.cards[id] ||= { status: 'idle' });
export const statusOf = (vs, id) => cardStatus(vs.cards[id], vs.lifeDay);
/** Cards that rose today (the caps count them where they rose, §8-3) — of a village state or a band's stored cards. */
export const roseToday = (vs, owner = null) => CARD_IDS.filter(id => vs.cards[id]?.day === vs.lifeDay && (!owner || CARD_BY_ID[id].owner === owner)).length;

// ── what rises (§8-2) ─────────────────────────────────────────────────────────

/** Whether a card's trigger holds for its owner deciding at t. at = { t, band, state, showsToday, allNighter, firstOfDay,
 * raining(ms), rainedBetween(a, b), afterRain, season, rushAt(t), dayStartMs, seed }. */
export function triggerHolds(card, vs, at, params) {
  const p = C(params), t = card.trigger, outside = obj => { const spot = vs.objects[obj]?.spot; return !!spot && !SPOT_BY_ID[spot].sheltered; };
  switch (t.kind) {
    case 'wear': return vs.wear[t.object] >= t.threshold;
    case 'rain-start': return at.raining(at.t) && outside(t.object);
    case 'rain-stop': return !at.raining(at.t) && at.rainedBetween(at.t - p.rainStopWindowMinutes * MINUTE, at.t);
    case 'after-rain': return at.afterRain && !at.raining(at.t) && outside(t.object);
    case 'state': {
      const value = at.state[t.stat];
      return (t.below === undefined || value < t.below) && (t.atLeast === undefined || value >= t.atLeast)
        && (!t.clear || !at.raining(at.t)) && (!t.allNighter || at.allNighter === true);
    }
    case 'count': return (at.showsToday ?? 0) >= t.min;
    case 'night-clear': return !at.raining(at.t);
    case 'season-leaf': return at.season === 'autumn' ? at.rainedBetween(at.yesterdayStartMs, at.dayStartMs)
      : createRng(at.seed, 'season-leaf', vs.lifeDay).below(PER_MILLE) < p.seasonLeafShare;
    case 'after': return Number.isSafeInteger(vs.marks.newToolDay) && vs.marks.newToolDay < vs.lifeDay;
    case 'rush': return at.rushAt(at.t);
    case 'first-visit': return !vs.cards[card.id]?.last || vs.cards[card.id].last.path === 'self';
    default: return false;
  }
}

/** Raise a card (its owner's decision at atMs). */
export function applyTrigger(vs, entry) {
  const r = record(vs, entry.card);
  Object.assign(r, { status: 'triggered', key: entry.key, at: entry.atMs, day: vs.lifeDay });
  delete r.until;
  if (CARD_BY_ID[entry.card].trigger.kind === 'after') delete vs.marks.newToolDay;
}

// ── how it is solved (§8-3) ───────────────────────────────────────────────────

/** Two or alone, seeded by the card and its key only (§2-1 결정성): the pair's share, twice as likely when the neighbour
 * is lonely. */
export function pairChosen(card, key, { villageSeed, partnerLonely }, params) {
  const p = C(params), pair = partnerLonely ? perMille(p.pairShare, p.lonelyPairMultiplier) : p.pairShare;
  return pickByWeight(createRng(villageSeed, 'card', card.id, key).next(), [pair, p.selfShare]) === 0;
}
/** How long a neighbour helps: its archetype's length, drawn from the card's own stream. */
export function partnerMinutes(card, key, archetype, villageSeed) {
  const rng = createRng(villageSeed, 'card', card.id, key, 'partner');
  return rng.between(archetype.length[0], archetype.length[1]);
}
/** Where the owner solves it on a path. */
export const solvingSpot = (card, path) => (path === 'pair' ? card.paths.pair.spot ?? card.spot : card.spot);

/** A take covers a card at ms (§8-3 withPlayer·paused): from its opening, until it ended with the visit — or for good
 * once it was solved with the player. While it covers, no resident solves that rise of the card. */
export function takeCovers(take, card, key, ms) {
  return !!take && take.card === card && take.key === key && take.at <= ms && (take.status === 'resolved' || take.endAt == null || ms < take.endAt);
}
const covered = (takes, card, key, ms) => (takes || []).some(take => takeCovers(take, card, key, ms));

/** The card's result: its owner's status falls to cooldown, the object's wear starts again (half after a stop-gap,
 * none after a firm fix), the trace takes the path's result, a pair's scene and agreement are kept. Returns the result
 * line for the band's record. */
function resolve(vs, card, { key, path, actors, place, atMs, startMs, choice = null, solo = false }) {
  const r = record(vs, card.id);
  vs.cards[card.id] = { status: 'cooldown', until: vs.lifeDay + card.cooldownLifeDays, day: r.day ?? vs.lifeDay,
    times: (r.times || 0) + 1, last: { path, day: vs.lifeDay } };
  if (card.trigger.kind === 'wear') vs.wear[card.trigger.object] = path === 'self' ? card.trigger.threshold >> 1 : 0;
  if (card.trace) {
    const value = path === 'player' ? choice ?? card.paths.player.result : card.paths[path].result;
    vs.traces[card.trace.object] = { ...(vs.traces[card.trace.object] || {}), [card.trace.field]: { value, path } };
  }
  if (path === 'pair' && !solo) scene(vs, actors[0], actors[1], { family: card.paths.pair.scene ?? 'chat', card, atMs, startMs });
  const line = { ref: cardRef(vs.lifeDay, vs.band, card.id), card: card.id, key, path, actors: [...actors], place, atMs,
    public: path !== 'player', ...(solo ? { solo: true } : {}) };
  vs.resolved.push(line);
  return line;
}

/** A pair scene (§9-1): a card solved by the two of them or a chat. The pair keeps its families, when it last met, an
 * agreement from a card, and its small difference goes one step on when the card is one of its own. */
export function scene(vs, a, b, { family, card = null, atMs, startMs }) {
  const pair = pairOf(a, b);
  if (!pair) return;
  const { frictionMax } = P(vs).pairs;
  const s = (vs.pairs[pair.key] ||= { families: {}, agreements: {}, friction: { topic: pair.topic, step: 0 }, lastMet: null });
  s.families[family] = { count: (s.families[family]?.count || 0) + 1, lastDay: vs.lifeDay };
  s.lastMet = { lifeDay: vs.lifeDay, band: vs.band };
  if (card) {
    s.agreements[card.id] = card.paths.pair.result;
    if (pair.frictionCards.includes(card.id)) s.friction = { topic: pair.topic, step: Math.min(frictionMax, s.friction.step + 1) };
  }
  vs.marks.scenes = (vs.marks.scenes || 0) + 1;
  vs.scenes.push({ pair: pair.key, family, members: [a, b], card: card?.id ?? null, startMs, atMs });
}
/** Whether a pair scene of this family may happen today (§9-1): the village's scenes and the family's rest. */
export function sceneFree(vs, a, b, family) {
  const { scenesPerDay, familyCooldownLifeDays } = P(vs).pairs, pair = pairOf(a, b);
  if (!pair || (vs.marks.scenes || 0) >= scenesPerDay) return false;
  const last = vs.pairs[pair.key]?.families?.[family]?.lastDay;
  return last === undefined || vs.lifeDay - last >= familyCooldownLifeDays;
}
export const frictionStep = (vs, a, b) => vs.pairs[pairOf(a, b)?.key]?.friction?.step ?? 0;

// ── one segment's part in the shared state ────────────────────────────────────

const ARCH = new Map();
/** What a placed segment does to the village (§8-2 마모 · §6-1 moves), once a piece: a resident's own routine wears its
 * object — never a scene's hold, a promise or a habit the player made (G4: the same playerMade the state takes, the
 * visits' habit too — W11), never a card's own solving — and the worn tool is replaced at its threshold (W5 rises the
 * next morning). An owner's solving segment solves its card with the outcome the segments give; a neighbour's with no
 * owner segment solved it alone if the card still waited for it. */
export function applySegment(vs, seg, { archetypes = ARCHETYPE_BY_ID, segments, takes = [], first = true }) {
  if (seg.archetype === 'reserved') return;
  const archetype = archetypes[seg.archetype] ?? null;
  if (seg.cardRole === 'owner') { solveByOwner(vs, seg, segments); moveObject(vs, CARD_BY_ID[seg.card].moves ?? archetype?.moves, seg.spot); return; }
  if (seg.cardRole === 'partner') { solveByPartner(vs, seg, segments, takes); return; }
  if (first && seg.with && !seg.joined && seg.archetype === 'chat') chatScene(vs, seg, segments);
  if (!archetype) return;
  if (archetype.wear && !playerMade(seg)) {
    vs.wear[archetype.wear] += 1;
    const tool = WEAR_CARD[archetype.wear];
    if (tool?.trigger.kind === 'after' && vs.wear[archetype.wear] >= tool.trigger.threshold) { vs.wear[archetype.wear] = 0; vs.marks.newToolDay = vs.lifeDay; }
  }
  moveObject(vs, archetype.moves, seg.spot);
}
function moveObject(vs, move, spot) {
  if (!move) return;
  const current = vs.objects[move.object]?.spot;
  // Only the spot changes: whatever else the object carries stays (review F3).
  if (!move.onlyFromOutside || (current && !SPOT_BY_ID[current].sheltered)) vs.objects[move.object] = { ...vs.objects[move.object], spot: move.to === 'spot' ? spot : move.to };
}
const partnerOf = (segments, seg) => segments.find(x => x.cardRole === 'partner' && x.card === seg.card && x.key === seg.key && x.startMs >= seg.startMs);
const arrived = seg => !!seg && seg.arriveMs < seg.endMs;
function solveByOwner(vs, seg, segments) {
  const card = CARD_BY_ID[seg.card];
  if (statusOf(vs, card.id) !== 'triggered' || vs.cards[card.id].key !== seg.key) return;
  // Two only when the neighbour got there while the owner was still at it (review GA2): an owner taken away first solved it alone.
  const partner = partnerOf(segments, seg), two = arrived(partner) && partner.arriveMs < seg.endMs;
  resolve(vs, card, { key: seg.key, path: two ? 'pair' : 'self', actors: two ? [seg.npc, partner.npc] : [seg.npc],
    place: SPOT_BY_ID[seg.spot].place, atMs: seg.endMs, startMs: seg.startMs });
}
function solveByPartner(vs, seg, segments, takes) {
  const card = CARD_BY_ID[seg.card];
  if (segments.some(x => x.cardRole === 'owner' && x.card === seg.card && x.key === seg.key)) return;
  // The owner was taken away after the card rose: the neighbour who came still solves it — for two, though the two of
  // them never talked, so no step of their difference (review F2). A card the player holds is the player's.
  if (statusOf(vs, card.id) !== 'triggered' || vs.cards[card.id].key !== seg.key || !arrived(seg) || covered(takes, card.id, seg.key, seg.startMs)) return;
  resolve(vs, card, { key: seg.key, path: 'pair', actors: [seg.npc], place: SPOT_BY_ID[seg.spot].place, atMs: seg.endMs, startMs: seg.startMs, solo: true });
}
function chatScene(vs, seg, segments) {
  const other = segments.find(x => x.npc === seg.with && x.joined && x.with === seg.npc && x.startMs >= seg.startMs && x.startMs < seg.endMs);
  if (!arrived(other) || other.arriveMs >= seg.endMs) return;
  scene(vs, seg.npc, seg.with, { family: 'chat', atMs: Math.min(seg.endMs, other.endMs), startMs: seg.startMs });
}
/** A card solved with the player (CARD_CONFIRM): the owner and those the take held are its actors; only they know it. */
export function applyTake(vs, take) {
  const card = CARD_BY_ID[take.card];
  if (!card || take.status !== 'resolved' || statusOf(vs, card.id) === 'cooldown') return;
  resolve(vs, card, { key: take.key, path: 'player', actors: [card.owner, ...(card.paths.player.with || []), 'player'],
    place: placeOfSpot(card.spot), atMs: take.resolvedAt, startMs: take.resolvedAt, choice: take.choice });
}

/** The band's gifts as time-ordered items (W8b): after the segments and takes of the same instant, so a gift never reaches
 * back before the moment it was given. */
export const givesItems = input => (input.gives || []).filter(give => give.atMs >= input.startMs && give.atMs < input.endMs)
  .map(give => ({ ms: give.atMs, npc: give.npc, rank: 1.6, give }));
/** The band's shared state read from its final segments (§2-1 — the close and the view use this, the planner the same
 * steps while placing): triggers, segments by piece and the player's results, in time order (a decision's trigger
 * before the segment it placed, residents in their order). */
export function villageAfter(input, segments, log, { archetypes = ARCHETYPE_BY_ID, params } = {}) {
  const vs = villageStart(input, params), takes = input.takes || [];
  const items = [
    ...log.map(entry => ({ ms: entry.atMs, npc: entry.npc, rank: 0, trigger: entry })),
    ...segments.flatMap(seg => {
      const starts = seg.cardRole ? [seg.startMs] : seg.pieceStarts ?? [seg.startMs];
      return starts.map((ms, i) => ({ ms, npc: seg.npc, rank: 1, seg, first: i === 0 }));
    }),
    ...takes.filter(take => take.status === 'resolved' && take.resolvedAt >= input.startMs && take.resolvedAt < input.endMs)
      .map(take => ({ ms: take.resolvedAt, npc: CARD_BY_ID[take.card]?.owner ?? 'cafe-owner', rank: 1.5, take })),
    ...givesItems(input),
  ].sort((a, b) => a.ms - b.ms || order(a.npc) - order(b.npc) || a.rank - b.rank);
  for (const item of items) {
    if (item.trigger) applyTrigger(vs, item.trigger);
    else if (item.take) applyTake(vs, item.take);
    else if (item.give) applyGive(vs, item.give);
    else applySegment(vs, item.seg, { archetypes, segments, takes, first: item.first });
  }
  return vs;
}
/** What the village keeps of a band's shared state (village.band): idle cards and empty marks leave. */
export function keptVillage(vs) {
  const cards = Object.fromEntries(Object.entries(vs.cards).filter(([, r]) => r.status !== 'idle' || r.times || r.last)
    .map(([id, r]) => [id, cardStatus(r, vs.lifeDay) === 'idle' && r.status === 'cooldown' ? { status: 'idle', ...(r.times ? { times: r.times } : {}), ...(r.last ? { last: r.last } : {}) } : r]));
  return { cards, wear: { ...vs.wear }, traces: vs.traces, objects: vs.objects, pairs: vs.pairs, marks: vs.marks };
}

// ── the player's part (§8-3 나와 함께) ────────────────────────────────────────

/** The card states at ms for the view and the commands: which rose and wait (triggered — the owner solves it at its
 * next decision), which the owner is solving now (resolving), which a take holds. Read from the band's final segments. */
/** The village as it stands at ms in a planned band — its cards, wear, traces and objects (the view's reading). */
export const villageAt = (input, segments, log, ms, options = {}) => villageAfter({ ...input, endMs: Math.min(input.endMs, ms + 1) },
  // Only what has happened by ms: a merged segment's later pieces are decisions still to come (review GA4).
  segments.filter(s => s.startMs <= ms).map(s => (s.pieceStarts?.some(at => at > ms) ? { ...s, pieceStarts: s.pieceStarts.filter(at => at <= ms) } : s)),
  log.filter(e => e.atMs <= ms), options);
export function cardsAt(input, segments, log, ms, { archetypes, params } = {}) {
  const vs = villageAt(input, segments, log, ms, { archetypes, params });
  const solving = new Map(segments.filter(s => s.cardRole === 'owner' && s.startMs <= ms && ms < s.endMs).map(s => [s.card, s]));
  return CARD_IDS.map(id => {
    const status = statusOf(vs, id), take = (input.takes || []).find(t => t.card === id && t.key === vs.cards[id]?.key && takeCovers(t, id, t.key, ms));
    return { card: id, owner: CARD_BY_ID[id].owner, status: solving.has(id) ? 'resolving' : take?.status === 'paused' ? 'paused' : take ? 'with' : status,
      ...(vs.cards[id]?.key ? { key: vs.cards[id].key } : {}) };
  }).filter(c => c.status !== 'idle' && c.status !== 'cooldown');
}

/** Whether the player may take this card now (CARD_OPEN): it waits for its owner (triggered), a take paused it, or its
 * take is open already (opening again is the same); its path is ready (W5: every card but C4·C5·R6). */
export function mayTake(card, state, { ready = card?.paths.player.ready === true } = {}) {
  return !!card && !card.locked && ready && ['triggered', 'paused', 'with'].includes(state);
}
/** A choice the take may make (CARD_CHOOSE): one of the path's; the player's own seat only when there is one. */
export function choiceOk(card, choice, { placement = null } = {}) {
  return card.paths.player.choices.includes(choice) && (choice !== 'my-seat' || !!placement);
}
/** The relation fields of a card done with the player (§20-1 매핑): choosing, or watching for the sitting, the practice
 * and the night flowers — and a choice named watch is watching. */
/** The player's leaves given to the jar's owner (W8b §20-8): the jar is worn that much less from that moment, never below none. */
export function applyGive(vs, give) {
  if (WEAR_OBJECTS.includes(give.object)) vs.wear[give.object] = Math.max(0, (vs.wear[give.object] ?? 0) - give.relief);
}
/** The relationship fields of a card done with the player — a gift that settled it (W8b: leaves into the jar) delivered. */
export function playerRelation(card, choice) {
  const role = choice === 'watch' ? 'watch' : choice === 'give' ? 'deliver' : card.paths.player.role;
  return { participantRole: [role], help: { by: 'player', to: [card.owner, ...(card.paths.player.with || [])] },
    deliveredSegmentIds: [], canonicalActivityId: `card.${card.id}`, storyFamily: card.family };
}
/** Whether stored card states are whole (village.band.cards). */
export function validCards(cards) {
  const day = n => Number.isSafeInteger(n) && n >= 0, word = v => typeof v === 'string' && /^[0-9a-z.-]{1,48}$/.test(v);
  return !!cards && typeof cards === 'object' && !Array.isArray(cards) && Object.entries(cards).every(([id, r]) => Object.hasOwn(CARD_BY_ID, id)
    && !!r && ['idle', 'triggered', 'cooldown'].includes(r.status)
    && (r.status !== 'triggered' || word(r.key) && Number.isSafeInteger(r.at) && day(r.day))
    && (r.status !== 'cooldown' || day(r.until) && (r.day === undefined || day(r.day)))
    && (r.times === undefined || day(r.times)) && (r.last === undefined || PATHS.includes(r.last.path) && day(r.last.day)));
}
export const validWear = wear => !!wear && typeof wear === 'object' && Object.entries(wear).every(([obj, n]) => WEAR_OBJECTS.includes(obj) && Number.isSafeInteger(n) && n >= 0 && n <= 999);
export function validTraces(traces) {
  return !!traces && typeof traces === 'object' && Object.values(traces).every(fields => !!fields && typeof fields === 'object'
    && Object.values(fields).every(t => !!t && typeof t.value === 'string' && t.value.length <= 48 && PATHS.includes(t.path)));
}
export const cardPlace = card => placeOfSpot(card.spot);
const SHELTER = Object.freeze({ ...Object.fromEntries(Object.values(SPOT_BY_ID).flatMap(s => (s.rainAltFor || []).map(from => [from, s.id]))), ...RAIN_ALT });
/** Where a card with the player holds its owner (§8-3): a sheltered spot of the card's own (or the path's), else its rain shelter. */
export function holdSpotOf(card) {
  const list = spotList(card.paths.player.spot ?? card.spot), dry = list.find(id => SPOT_BY_ID[id].sheltered);
  return dry ?? spotList(SHELTER[list[0]] ?? list[0])[0];
}
export { placeOfSpot };
