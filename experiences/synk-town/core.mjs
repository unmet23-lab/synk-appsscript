/** FT10 game authority for a local, synthetic developer fixture.
 * World/material transactions live here. Trail reads confirmed facts, Vellum
 * selects authored reactions, and Loom supplies presentation only.
 * This is not an account service or a TOPIK assessment.
 */
import Trail from '../../atlas/trail-life.js';
import Vellum from '../../atlas/vellum-life.js';
import Loom from '../../tools/lib/loom-life.js';
import { initialLife, assertLife, advanceLife, commandLife, viewLife, LifeError, liveSourceKey as lifeLiveKey, foldLife } from './life.mjs';
import { initialDay, assertDay, advanceDay, commandDay, viewDay, DayError, liveSourceKey as dayLiveKey, foldDay } from './day.mjs';
import { initialBazaar, assertBazaar, advanceBazaar, commandBazaar, viewBazaar, BazaarError } from './bazaar.mjs';
import { initialSupport, assertSupport, commandSupport, viewSupport, snapshotSupport, SupportError, foldSupport } from './support.mjs';
import { nearbyPlace } from './walk.mjs';
import { FT_SEATS, SIGN_SLOTS as SIGN_SPOTS } from './town/places.mjs';
import { emptyIndex, admit, record, indexLog, isFact, projection, validIndex, foldIndex } from './town/trail-index.mjs';
import { emptyLedger, validLedger } from './town/ledger.mjs';
import { initialPrefs, initialAsks, giveFeedback, removeFeedback, activeFeedback, setLessOften, setApproach, setTodayOther,
  answerFamily, correctObserved, clearPersonal, validPrefs, validAsks, validUses } from './town/prefs.mjs';
import { initialConsents, changeConsent, validConsents } from './town/consent.mjs';
import { eventProblem, FAMILIES } from './town/events.mjs';
import { policyFor, DEFAULT_OPS, PARAMS_BY_VER, ARMS } from './town/params.mjs';
import { forgettable, forget, forgottenBy, pruneForgotten, validForgotten } from './town/memory.mjs';
import { initialVillage, validVillage, closeBands, closeOpen, holdResidents, keepHabitSpots, recordUse, promiseTomorrow, planOf, placeAt, caption, doing, upFor, goalOf } from './town/village.mjs';
import { agreementSpot, RESIDENT_BY_ID } from './town/plan.mjs';

export const SCOPE = Object.freeze({ domain: 'LAB', workspace: 'synk-town', subject: 'preview-local' });
// FT10/FT51 keep their old 2D cafe-screen points; the spots live in town/data/places.json.
export const SEATS = Object.freeze(Object.fromEntries(Object.entries(FT_SEATS)
  .map(([id, seat]) => [id, { x: seat.legacy2d.x, y: seat.legacy2d.y, branch: seat.branch }])));
export const SIGN_SLOTS = Object.freeze(Object.fromEntries(Object.entries(SIGN_SPOTS)
  .map(([id, slot]) => [id, { x: slot.legacy2d.x, y: slot.legacy2d.y }])));
const newSign = () => ({ picture: null, slot: null, target: null, draftPicture: null, draftSlot: null,
  placedId: null, currentUseId: null, goalId: null, delivered: true, returnActivity: 'seat' });
const copy = value => structuredClone(value);
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export class TownError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const ensure = (condition, code, message, status) => { if (!condition) throw new TownError(code, message, status); };
/** The §20 fields (vertical slice design §14-2·§20, W2 plan 5b), added to schema 1: the things ledger,
 * what the player said about suggestions and the mascot's question budget, the uses behind an
 * observation, the evaluation consent, this visit's version and arm, and what residents were asked to
 * forget. Town events (the §20-1 kinds) wait in townEvents until the store moves them to the event
 * branch; townSeq names them across a reset, as the Trail sequence does. */
const TOWN_FIELDS = Object.freeze({ ledger: emptyLedger, prefs: initialPrefs, asks: initialAsks, recentLifeUse: () => [],
  consents: initialConsents, policy: () => null, forgotten: () => [], townSeq: () => 0, townEvents: () => [] });
const townFields = () => Object.fromEntries(Object.entries(TOWN_FIELDS).map(([key, make]) => [key, make()]));
/** The most entries a person's own setting lists keep (less often, not approached first, today's others, responses). */
export const PERSONAL_MAX = 64;
const validPolicy = policy => policy === null || !!policy && Object.keys(policy).length === 3 && typeof policy.visitId === 'string'
  && /^[A-Za-z0-9_.:-]{1,80}$/.test(policy.visitId) && Object.hasOwn(PARAMS_BY_VER, policy.paramsVer) && ARMS.includes(policy.arm);
const townEventsValid = state => Number.isSafeInteger(state.townSeq) && state.townSeq >= 0 && Array.isArray(state.townEvents)
  && state.townEvents.every(event => eventProblem(event) === null && /^E-\d+$/.test(event.id) && Number(event.id.slice(2)) <= state.townSeq);
// Two counters (vertical slice §14-4, W2 plan D4): revision is the command revision — it rises only
// when a command is confirmed, and commands compare against it; writeSeq rises on every save, so a
// screen knows when to read again. settledU is the effective play time the world is settled to.
export function initialState({ scope = SCOPE, lifeEnabled = false } = {}) {
  return { schema: 1, scope: { ...scope }, revision: 0, writeSeq: 0, settledU: 0, worldRevision: 0, visit: 1,
    phase: 'choose', branch: null, inventory: { wood: 0, cloth: 0, canopy: 0 },
    canopyOwned: false, color: null, placement: null, previewSlot: null,
    materialsGranted: false, served: false, delivered: false, currentUseId: null,
    achievements: [], goals: { inside: null, outside: null }, resumePhase: null,
    events: [], trail: emptyIndex(), ...townFields(), commands: [], resting: false, activity: 'seat', sign: newSign(),
    ...(lifeEnabled ? { life: initialLife(), lifeFactIds: {}, lifeSeatRevision: 0, day: initialDay(), bazaar: initialBazaar(), support: initialSupport(), village: initialVillage() } : {}) };
}
// Existing FT10 saves gain only the new optional activity, preserving their log.
export function restoreState(saved, { lifeEnabled = false } = {}) {
  const state = copy(saved);
  if (state?.schema === 1 && !Object.hasOwn(state, 'activity') && !Object.hasOwn(state, 'sign')) {
    state.activity = 'seat'; state.sign = newSign();
  }
  if (lifeEnabled && !Object.hasOwn(state, 'life')) {
    state.life = initialLife(); state.lifeFactIds = {};
  }
  if (state.life && !Object.hasOwn(state, 'lifeSeatRevision')) state.lifeSeatRevision = state.worldRevision;
  if (lifeEnabled && !Object.hasOwn(state, 'day')) state.day = initialDay();
  if (lifeEnabled && !Object.hasOwn(state, 'bazaar')) state.bazaar = initialBazaar();
  if (lifeEnabled && !Object.hasOwn(state, 'support')) state.support = initialSupport();
  // The village (W3): a world with a first day gains it empty, and the old 14-second script leaves.
  if (state?.day && !Object.hasOwn(state, 'village')) state.village = initialVillage();
  if (state?.day && Object.hasOwn(state.day, 'routine')) delete state.day.routine;
  // Saves from before the two counters: every save so far was a write, and nothing is unsettled.
  if (state && !Object.hasOwn(state, 'writeSeq')) state.writeSeq = state.revision;
  if (state && !Object.hasOwn(state, 'settledU')) state.settledU = 0;
  // Saves from before the §20 fields gain them empty.
  if (state?.schema === 1 && state.scope) for (const [key, make] of Object.entries(TOWN_FIELDS)) if (!Object.hasOwn(state, key)) state[key] = make();
  // A log kept in the state (an old save, the linked teacher fixture, the old talk row) is read
  // whole once, here. A world whose log lives in the event branch carries none, and its index is
  // the record: it is trusted once its shape holds (W2 plan D7).
  if (state?.schema === 1 && state.scope && Array.isArray(state.events)) {
    const saved = state.trail, number = value => Number.isSafeInteger(value) && value >= 0;
    if (state.events.length || !saved) {
      const seq = number(saved?.seq) ? saved.seq : 0;
      const archivedBelow = number(saved?.archivedBelow) && saved.archivedBelow < (state.events[0]?.seq ?? Infinity) ? saved.archivedBelow : 0;
      delete state.trail; state.trail = trailOf(state, { seq, archivedBelow });
    } else {
      ensure(validIndex(saved), 'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
      saved.archivedBelow ??= 0; saved.folded ??= {};
    }
  }
  return assertState(state);
}
/** Fold limits (vertical slice §14-5, W2 plan D7·D8): a world folds an array once it passes its
 * limit, back to what its readers can still reach — so a world's size follows its content, not
 * the length of play. The store folds before it saves; the whole lines stay in the event branch. */
export const FOLD_LIMITS = Object.freeze({ facts: 256, deliveries: 64, dayHistory: 32, keepDayHistory: 16,
  dayEmitted: 256, keepDayEmitted: 32, lifeHistory: 32, keepLifeHistory: 16, presentations: 64, keepPresentations: 4 });
const over = (state, limits) => Object.keys(state.trail?.facts || {}).length > limits.facts
  || Object.keys(state.trail?.deliveries || {}).length > limits.deliveries
  || !!state.lifeFactIds && Object.keys(state.lifeFactIds).length > limits.facts
  || !!state.day && (state.day.history.length > limits.dayHistory || state.day.emitted.length > limits.dayEmitted)
  || !!state.life && state.life.history.length > limits.lifeHistory
  || !!state.support && state.support.presentations.length > limits.presentations;
/** The world folded to its limits: the same state when nothing is over one, otherwise a folded
 * copy that reads the same — the same reactions, contacts, scenes and readings, and the same
 * events from every later step (tests/town-fold.test.js holds this against an unfolded world). */
export function foldWorld(state, limits = FOLD_LIMITS) {
  if (!over(state, limits)) return state;
  const world = copy(state);
  if (world.day) foldDay(world.day, limits);
  if (world.life) foldLife(world.life, limits);
  if (world.support) foldSupport(world.support, limits);
  const trail = trailOf(world);
  // Facts the state can still point to or name as a cause: the FT10/FT51 pointers, the last
  // placement, and the module keys that are still live (a bazaar's keys all are — F8).
  const live = new Set([world.goals.inside, world.goals.outside, world.currentUseId, world.sign.placedId,
    world.sign.currentUseId, world.sign.goalId, world.pendingUse?.cause, trail.lastSeatPlaced].filter(Boolean));
  if (world.lifeFactIds) {
    const lifeKey = world.life ? lifeLiveKey(world.life) : () => false, dayKey = world.day ? dayLiveKey(world.day) : () => false;
    // The results the screens still show as memories (the kept history rows) stay knowable, so the
    // player can still ask a resident to forget them (§20-5).
    const shown = new Set([...(world.life?.history || []), ...(world.day?.history || [])].map(row => row.resultId));
    world.lifeFactIds = Object.fromEntries(Object.entries(world.lifeFactIds)
      .filter(([key]) => key.startsWith('BAZAAR:') || lifeKey(key) || dayKey(key) || shown.has(key)));
    for (const id of Object.values(world.lifeFactIds)) live.add(id);
  }
  foldIndex(trail, live, { current: ['FT10', 'FT51'].map(kind => `${kind}:${world.worldRevision}:${world.visit}:delivery`) });
  if (world.forgotten) world.forgotten = pruneForgotten(world.forgotten, trail);
  return assertState(world);
}
export function assertState(state) {
  ensure(state?.schema === 1 && state.scope?.domain === SCOPE.domain && state.scope?.workspace === SCOPE.workspace && /^(preview-local|linked-[a-zA-Z0-9_-]{1,100})$/.test(state.scope?.subject), 'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  ensure(Number.isSafeInteger(state.revision) && state.revision >= 0
    && Number.isSafeInteger(state.worldRevision) && state.worldRevision >= 0
    && Number.isSafeInteger(state.visit) && state.visit > 0
    && ['writeSeq', 'settledU'].every(key => !Object.hasOwn(state, key) || Number.isSafeInteger(state[key]) && state[key] >= 0),
  'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  ensure(['choose', 'outside-preview', 'inside-preview', 'color', 'place', 'ready', 'away', 'sign-intro', 'sign-picture', 'sign-place'].includes(state.phase)
    && [null, 'outside', 'inside'].includes(state.branch)
    && [null, 'green', 'yellow'].includes(state.color)
    && (state.placement === null || Object.hasOwn(SEATS, state.placement))
    && (state.previewSlot === null || Object.hasOwn(SEATS, state.previewSlot)), 'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  ensure(['wood', 'cloth', 'canopy'].every(key => Number.isSafeInteger(state.inventory?.[key]) && state.inventory[key] >= 0)
    && state.inventory.canopy <= 1 && Array.isArray(state.commands) && Array.isArray(state.achievements)
    && ['canopyOwned', 'materialsGranted', 'served', 'delivered', 'resting'].every(key => typeof state[key] === 'boolean'),
  'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  const outside = state.placement && SEATS[state.placement].branch === 'outside';
  ensure((state.canopyOwned ? state.inventory.canopy + Number(!!outside) === 1 : state.inventory.canopy === 0 && !outside)
    && (!state.canopyOwned || state.color !== null) && (!state.served || state.placement !== null), 'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  ensure(Array.isArray(state.events), 'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  const trail = trailOf(state);
  ensure(Number.isSafeInteger(trail.seq) && trail.seq >= (state.events.at(-1)?.seq || 0), 'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  const sign = state.sign;
  ensure(['seat', 'sign'].includes(state.activity) && sign
    && [null, 'chair', 'tea'].includes(sign.picture) && [null, 'chair', 'tea'].includes(sign.draftPicture)
    && (sign.slot === null || Object.hasOwn(SIGN_SLOTS, sign.slot))
    && (sign.draftSlot === null || Object.hasOwn(SIGN_SLOTS, sign.draftSlot))
    && (sign.target === null || sign.target === state.placement)
    && Boolean(sign.picture) === Boolean(sign.slot) && Boolean(sign.slot) === Boolean(sign.placedId)
    && (!sign.target || sign.slot) && typeof sign.delivered === 'boolean'
    && ['seat', 'sign'].includes(sign.returnActivity)
    && [[sign.placedId, ['sign.placed', 'sign.retargeted']], [sign.currentUseId, ['sign.seat.used']], [sign.goalId, ['FT51.completed']]]
      .every(([id, types]) => id === null || isFact(trail, id, types)),
    'invalid-save', '안내판 기록을 확인할 수 없어요.', 503);
  ensure(state.goals && ['inside', 'outside'].every(branch => state.goals[branch] === null
    || isFact(trail, state.goals[branch], [`FT10.${branch}.completed`])),
  'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  ensure(!state.currentUseId || isFact(trail, state.currentUseId, ['tea.served']),
    'invalid-save', '체험 기록을 확인할 수 없어요.', 503);
  if (Object.hasOwn(state, 'life')) {
    ensure(!!state.life, 'invalid-save', '이웃의 생활 기록을 확인할 수 없어요.', 503);
    ensure(state.scope.subject === 'preview-local' && state.lifeFactIds && typeof state.lifeFactIds === 'object'
      && !Array.isArray(state.lifeFactIds) && Object.values(state.lifeFactIds).every(id => isFact(trail, id)),
    'invalid-save', '이웃의 생활 기록을 확인할 수 없어요.', 503);
    try { assertLife(state.life); } catch { throw new TownError('invalid-save', '이웃의 생활 기록을 확인할 수 없어요.', 503); }
    ensure(Number.isSafeInteger(state.lifeSeatRevision) && state.lifeSeatRevision >= 0,
      'invalid-save', '생활 자리 기록을 확인할 수 없어요.', 503);
    ensure(!state.lifeHost || (state.lifeHost.lastForegroundAt === null || Number.isSafeInteger(state.lifeHost.lastForegroundAt) && state.lifeHost.lastForegroundAt >= 0)
      && Number.isSafeInteger(state.lifeHost.fence) && state.lifeHost.fence >= 0,
      'invalid-save', '생활 방문 기록을 확인할 수 없어요.', 503);
  }
  if (Object.hasOwn(state, 'day')) {
    ensure(state.scope.subject === 'preview-local' && !!state.life, 'invalid-save', '생활의 주인을 확인할 수 없어요.', 503);
    try { assertDay(state.day); } catch { throw new TownError('invalid-save', '첫 하루 기록을 확인할 수 없어요.', 503); }
  }
  for (const [key, validate] of [['bazaar', assertBazaar], ['support', assertSupport]]) {
    if (!Object.hasOwn(state, key)) continue;
    ensure(state.scope.subject === 'preview-local' && !!state.day, 'invalid-save', '생활 기록의 주인을 확인해 주세요.', 503);
    try { validate(state[key]); } catch { throw new TownError('invalid-save', '생활 지원 기록을 확인할 수 없어요.', 503); }
  }
  if (Object.hasOwn(state, 'village')) ensure(!!state.day && validVillage(state.village), 'invalid-save', '마을 기록을 확인할 수 없어요.', 503);
  const pending = state.pendingUse;
  if (pending) ensure(['tea', 'sign'].includes(pending.kind) && pending.worldRevision === state.worldRevision
    && pending.placement === state.placement && Number.isSafeInteger(pending.elapsedMs) && pending.elapsedMs >= 0
    && isFact(trail, pending.cause), 'invalid-save', '주민 이용 계획을 확인할 수 없어요.', 503);
  // The §20 fields, each checked when present (restoreState gives every save all of them).
  const has = key => Object.hasOwn(state, key);
  ensure((!has('ledger') || validLedger(state.ledger)) && (!has('prefs') || validPrefs(state.prefs))
    && (!has('asks') || validAsks(state.asks)) && (!has('recentLifeUse') || validUses(state.recentLifeUse))
    && (!has('consents') || validConsents(state.consents)) && (!has('policy') || validPolicy(state.policy))
    && (!has('forgotten') || validForgotten(state.forgotten)) && (!has('townSeq') && !has('townEvents') || townEventsValid(state)),
  'invalid-save', '마을 기록을 확인할 수 없어요.', 503);
  return state;
}

const atDayPlace = (state, place) => state.day?.location === place && (!state.day.walk?.enabled || nearbyPlace(state.day.walk) === place);
export function dayContext(state, host = {}) {
  const c1 = state.life?.episode;
  return { elapsedMs: host.elapsedMs || 0, nowMs: host.nowMs ?? state.lifeHost?.lastForegroundAt ?? 0,
    walkElapsedMs: host.walkElapsedMs || 0,
    canRun: host.canRun !== false && host.surface === 'day',
    placement: state.placement, seatRevision: state.lifeSeatRevision ?? state.worldRevision,
    languageSupport: state.support ? snapshotSupport(state.support).mode : 'plain',
    languageSupportBasis: state.support ? snapshotSupport(state.support) : undefined,
    workshopBusy: bazaarOwns(state) && state.bazaar.episode.kind === 'pictureMenu',
    resumeBlocked: !!state.bazaar?.episode?.open && state.day?.episode?.location === 'cafe',
    ftReady: !!state.placement && !!state.goals[SEATS[state.placement].branch],
    signReady: !!state.sign.target,
    cafeBusy: bazaarOwns(state) || !!state.pendingUse || state.phase !== 'ready' || !(state.activity === 'sign' ? state.sign.delivered : state.delivered)
      || !!c1 && (c1.stage === 'executing' || c1.open && !['result', 'invalid'].includes(c1.stage)) };
}
function bazaarOwns(state) { return !!state.bazaar?.episode?.open && state.day?.location === 'cafe'; }
function bazaarContext(state, host = {}, requestedKind) {
  const episode = state.day?.episode, life = state.life?.episode;
  return { elapsedMs: host.elapsedMs || 0, canRun: host.canRun !== false && host.surface === 'day' && !state.day?.rest && atDayPlace(state, 'cafe'),
    location: state.day?.location || 'home', support: state.day?.support || 'demo',
    languageSupport: state.support ? snapshotSupport(state.support).mode : 'plain',
    languageSupportBasis: state.support ? snapshotSupport(state.support) : undefined,
    cafeBusy: !!state.pendingUse || state.phase !== 'ready' || !state.placement
      || !(state.activity === 'sign' ? state.sign.delivered : state.delivered)
      || (requestedKind || state.bazaar?.episode?.kind) === 'pictureMenu' && state.day?.job?.status === 'preparing'
      || !!episode?.open && episode.location === 'cafe' && episode.stage !== 'invalid'
      || !!life && (life.stage === 'executing' || life.open && life.stage !== 'invalid') };
}
function supportContext(state, host = {}) {
  return { nowMs: Math.max(host.nowMs ?? state.lifeHost?.lastForegroundAt ?? 0,
      state.support?.presentations.at(-1)?.atMs || 0, state.support?.attempts.at(-1)?.atMs || 0),
    kind: state.day?.location === 'workshop' ? 'help' : 'tea' };
}

// Only the local host may supply execution time and a delivery fence. The
// linked teacher fixture deliberately has no capability for this slice yet.
export function livingContext(state, host = {}) {
  const ready = !state.pendingUse && state.phase === 'ready' && !!state.placement
    && (state.activity === 'sign' ? state.sign.delivered : state.delivered);
  const episode = state.day?.episode;
  const dayEpisodeOwns = !!episode && episode.location === state.day.location
    && episode.open && episode.stage !== 'invalid' && episode.kind === 'tea';
  const dayOwns = bazaarOwns(state) || dayEpisodeOwns || host.surface === 'day' && !atDayPlace(state, 'cafe');
  return { surfaceId: state.life?.authority.surfaceId ?? null, fence: state.life?.authority.fence ?? 0,
    ...host, canRun: ready && host.canRun !== false && !dayOwns,
    // The owner who invites is up (the night rule): no contact is issued while it sleeps.
    canContact: ready && !dayOwns && !state.resting && !(host.surface === 'day' && state.day?.rest) && host.canContact === true
      && upFor(state.village, 'cafe-owner', host.nowMs),
    worldRevision: state.lifeSeatRevision ?? state.worldRevision, placement: state.placement };
}
function projectLifeFacts(state, facts) {
  for (const item of facts) {
    if (item.sourceKey && Object.hasOwn(state.lifeFactIds, item.sourceKey)) continue;
    const causes = (item.causes || []).map(key => state.lifeFactIds[key]);
    // A cause the world does not know is an error, never silently dropped (F8).
    ensure(causes.every(Boolean), 'life-cause-missing', '앞서 한 일을 먼저 확인해 주세요.', 503);
    const id = fact(state, item.factType, causes, item.knownBy || ['cafe-owner']);
    if (item.sourceKey) state.lifeFactIds[item.sourceKey] = id;
  }
}
function runLife(state, operation) {
  try { projectLifeFacts(state, operation()); }
  catch (error) {
    if (error instanceof LifeError || error instanceof DayError || error instanceof BazaarError || error instanceof SupportError) throw new TownError(error.code, error.message, error.status);
    throw error;
  }
}
// ── The living village (W3; vertical slice §6-4·§6-5·§14-4) ─────────────────────
const DAY_MEMBERS = Object.freeze({ tea: ['cafe-owner', 'researcher'], coordination: ['workshop-owner', 'researcher'], help: ['workshop-owner'] });
/** The spot a scene holds each member at — two members never share a one-seat spot (review P2-6). */
const HOLD_SPOTS = Object.freeze({ tea: { 'cafe-owner': 'cafe.counter', researcher: 'cafe.front' },
  coordination: { cafe: { 'workshop-owner': 'cafe.front', researcher: 'cafe.front' }, greenhouse: { 'workshop-owner': 'greenhouse.door', researcher: 'greenhouse.board' } },
  help: { 'workshop-owner': 'workshop.bench' } });
const holdSpot = (kind, location, npc) => (HOLD_SPOTS[kind][location] || HOLD_SPOTS[kind])[npc] || RESIDENT_BY_ID[npc].home;
/** The residents scenes hold now: { npc: { by, spot, seat?, toMs? } }, read only from what commands
 * change (§6-4 P1) — FT10's phase and delivery are judged as a whole use, the job by its fixed end. */
function heldNow(state) {
  const held = {}, hold = (npc, by, spot, extra = {}) => { held[npc] ||= { by, spot, ...extra }; };
  const e = state.day?.episode;
  if (e?.open && e.location === state.day.location && e.stage !== 'invalid' && !(e.kind === 'help' && e.choice === 'alone'))
    for (const npc of DAY_MEMBERS[e.kind]) hold(npc, e.id, holdSpot(e.kind, e.location, npc));
  const b = state.bazaar?.episode;
  if (b?.open && state.day?.location === 'cafe') {
    hold('cafe-owner', b.id, 'cafe.counter');
    if (b.kind === 'pictureMenu' && b.stage !== 'role') hold('workshop-owner', b.id, 'cafe.front');
  }
  if (state.life?.episode?.open) hold('cafe-owner', state.life.episode.id, 'cafe.front');
  if (state.placement && state.phase === 'ready' && !(state.activity === 'sign' ? state.sign.delivered : state.delivered))
    hold('cafe-owner', `FT:${state.worldRevision}`, 'cafe.counter', { seat: FT_SEATS[state.placement].spot });
  const job = state.day?.job;
  if (job?.status === 'preparing') hold('workshop-owner', job.id, 'workshop.bench', { toMs: job.readyAt });
  return held;
}
/** The night rule at a command (host.nowMs, §4-2 A): the residents a scene would begin with must be up. A scene already
 * begun goes on (resuming one is not a beginning); without the host's sleeps every scene stays open. */
function sleepersFor(state, command, p, nowMs) {
  const v = state.village;
  if (!v?.sleeps) return [];
  const pictureMenu = (command.type === 'BAZAAR_START' ? p.kind : state.bazaar?.episode?.kind) === 'pictureMenu';
  const needs = command.type === 'DAY_START' ? DAY_MEMBERS[p.kind] || [] : command.type === 'DAY_JOB_START' ? ['workshop-owner']
    : ['BAZAAR_START', 'BAZAAR_RESUME'].includes(command.type) ? ['cafe-owner', ...(pictureMenu ? ['workshop-owner'] : [])]
      : command.type === 'LIFE_OPEN' ? ['cafe-owner'] : [];
  return needs.filter(npc => !upFor(v, npc, nowMs));
}
/** Where a habit may form (§6-5): the player's seat (anyone) and the first day's agreed spot (the workshop owner). */
function habitSpots(state) {
  const agreed = agreementSpot(state.day?.agreement);
  return [...(state.placement && FT_SEATS[state.placement] ? [{ spot: FT_SEATS[state.placement].spot }] : []),
    ...(agreed ? [{ spot: agreed, npc: 'workshop-owner' }] : [])];
}
/** The settlement's close step (town/settle.mjs close): bands that ended by nowMs close and the next
 * opens; habit uses become town events. The host gives the village seed, its offset and visitEnd, and
 * sleeps when it keeps the residents' nights (an account's town; village.mjs upFor). */
export function closeLiving(state, nowMs, { seed = 'synk-town', offsetMin = null, visitEnd = null, sleeps = false } = {}) {
  if (!state.village) return state;
  const candidates = habitSpots(state);
  keepHabitSpots(state.village, candidates);
  for (const use of closeBands(state.village, { nowMs, seed, offsetMin, revision: state.revision, visitEnd, candidates, sleeps }))
    townEvent(state, 'habit.used', { ...use, actors: [use.npc] });
  return state;
}
/** A command's end, after its 0-second chain: holds follow the scenes (a new hold opens now, a released
 * one ends now), and a new first-day agreement is its first use and tomorrow's promise (§6-5). */
function settleVillage(state, host) {
  const v = state.village;
  if (!v?.band || !Number.isSafeInteger(host.nowMs)) return;
  keepHabitSpots(v, habitSpots(state));
  holdResidents(v, heldNow(state), host.nowMs, state.revision + 1);
  const agreement = state.day?.agreement, spot = agreementSpot(agreement);
  if ((agreement?.resultId ?? null) === v.agreement) return;
  v.agreement = agreement?.resultId ?? null;
  if (!spot) return;
  const use = recordUse(v, { npc: 'workshop-owner', spot, archetype: 'quiet-rest' });
  if (use) townEvent(state, 'habit.used', { ...use, actors: ['workshop-owner'] });
  promiseTomorrow(v, { id: `P-${state.revision + 1}`, npc: 'workshop-owner', archetype: 'quiet-rest', spot, nowMs: host.nowMs });
}
/** A visit that ended stops its scenes (§14-3 P1): open episodes close as their close commands would,
 * and holds end at the wall time the visit ended (the lease break's visitEndAt). */
function endVisitScenes(state, endedAt) {
  if (state.day?.episode?.open) state.day.episode.open = false;
  const c1 = state.life?.episode;
  if (c1?.open) { c1.open = false; if (c1.stage === 'result') c1.dismissed = true; }
  if (state.bazaar?.episode?.open) state.bazaar.episode.open = false;
  if (state.village) closeOpen(state.village, endedAt);
}
/** The village as a scene at the time the world last saw a window (old screens draw npcs as given; new
 * ones interpolate scene.village.segments with the server's clock — §14-4). null before a band opens.
 * The segments are the ones not yet over at nowMs, and startSpots is where each resident's remaining
 * plan begins (the spot its last finished segment left it at), so placeAt walks from the right place. */
function villageScene(state) {
  const v = state.village;
  if (!v?.band) return null;
  const nowMs = Math.min(v.band.endMs - 1, Math.max(v.band.startMs, state.lifeHost?.lastForegroundAt ?? v.band.startMs));
  const segments = planOf(v).segments;
  const startSpots = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
  const places = Object.fromEntries(Object.keys(RESIDENT_BY_ID).map(npc => [npc, placeAt(segments, npc, nowMs, startSpots)]));
  const fromSpots = { ...startSpots };
  for (const seg of segments) if (seg.endMs <= nowMs) fromSpots[seg.npc] = seg.spot;
  return { nowMs, places, line: caption(places), startSpots: fromSpots, ...(v.sleeps ? { sleeps: true } : {}),
    goals: Object.fromEntries(Object.entries(places).map(([npc, at]) => [npc, goalOf(at)])),
    // Whether a scene may begin with each resident now (the night rule; always true without sleeps).
    awake: Object.fromEntries(Object.keys(RESIDENT_BY_ID).map(npc => [npc, upFor(v, npc, nowMs)])),
    band: { band: v.band.band, startMs: v.band.startMs, endMs: v.band.endMs },
    segments: segments.filter(seg => seg.endMs > nowMs).map(({ npc, startMs, arriveMs, endMs, archetype, spot }) => ({ npc, startMs, arriveMs, endMs, archetype, spot })) };
}
/** One step of the living modules on a state, in place: the chain one old pulse ran. Settlement
 * (town/settle.mjs) walks unsettled time in steps of this, checking the state once around them. */
export function stepLiving(state, host) {
  ensure(state.life && host?.enabled === true, 'life-unavailable', '이 체험에서는 이웃 생활을 열 수 없어요.', 403);
  // A visit that ended in a long rest takes its version and arm with it; the next visit opens its own.
  if (host.visitEnded && state.policy) state.policy = null;
  if (host.visitEnded) endVisitScenes(state, host.visitEndedAt ?? null);
  advanceUse(state, host);
  runLife(state, () => advanceLife(state.life, livingContext(state, host)));
  if (state.day) runLife(state, () => advanceDay(state.day, dayContext(state, host)));
  if (state.bazaar) runLife(state, () => advanceBazaar(state.bazaar, bazaarContext(state, host)));
  return state;
}
/** The old pulse path, kept for callers that have not moved to the lease (talk until W2b). */
export function advanceLivingState(previous, host) {
  assertState(previous);
  const state = stepLiving(copy(previous), host);
  const changed = canonical(state) !== canonical(previous);
  if (changed) state.revision++;
  assertState(state);
  return { state, changed };
}
/** The world's Trail index; a state made before the index (or by hand) gets one from its whole log. */
function trailOf(state, { seq = 0, archivedBelow = 0 } = {}) {
  if (state.trail) return state.trail;
  ensure(state.events.every(event => canonical(event?.scope) === canonical(state.scope)), 'invalid-save', '다른 사람의 체험 기록을 섞을 수 없어요.', 503);
  try { Trail.summarize(state.events, { scope: state.scope }); }
  catch { throw new TownError('invalid-save', '체험 기록을 확인할 수 없어요.', 503); }
  return indexLog(state.events, { seq, archivedBelow });
}
/** Append to the life log, checked against the index in constant time (Trail.append's rules). */
function append(state, type, fields) {
  if (!state.trail) state.trail = trailOf(state);
  const seq = state.trail.seq + 1;
  const event = Trail.validate(copy({ schema: 1, id: `life:${seq}`, scope: { ...state.scope }, seq, type, ...fields }));
  if (admit(state.trail, event, { currentRevisions: { shelter: state.worldRevision } }) === 'append') {
    state.events.push(event); record(state.trail, event);
  }
  return event.id;
}
function fact(state, factType, causes = [], knownBy = ['cafe-owner', 'guest']) {
  return append(state, 'life.fact', { factType, causes, knownBy, revisions: { shelter: state.worldRevision } });
}
// This small turn-based simulation has authored, validated routes. The server
// commits sitting/serving before a renderer depicts them; no animation callback
// can award a material, create a completed action or advance proficiency.
function useSeat(state, cause) {
  ensure(state.placement && SEATS[state.placement], 'missing-seat', '먼저 자리를 골라요.');
  const arrival = fact(state, 'guest.arrived', [cause]);
  const seated = fact(state, 'seat.used', [arrival]);
  state.currentUseId = fact(state, 'tea.served', [seated]);
  state.served = true; state.delivered = false; state.resting = false;
}
function completeSeat(state, cause) {
  useSeat(state, cause);
  const branch = SEATS[state.placement].branch;
  if (!state.goals[branch]) state.goals[branch] = fact(state, `FT10.${branch}.completed`, [state.currentUseId]);
  const note = branch === 'outside' ? '작은 지붕을 만들었어요.' : '의자를 옮겼어요.';
  if (!state.achievements.includes(note)) state.achievements.push(note);
}
function queueUse(state, kind, cause) {
  state.pendingUse = { kind, cause, placement: state.placement, worldRevision: state.worldRevision, elapsedMs: 0 };
  state.resting = false;
  if (kind === 'tea') { state.served = false; state.delivered = false; state.currentUseId = null; state.activity = 'seat'; }
  else { state.sign.delivered = false; state.sign.currentUseId = null; state.activity = 'sign'; }
}
function executionFor(state) {
  const pending = state.pendingUse;
  if (!pending) return null;
  const id = `use:${pending.kind}:${pending.worldRevision}:${state.visit}`;
  const plan = pending.kind === 'tea' ? planFor(state, { id }) : signPlan(state, { id });
  return { id, kind: pending.kind, plan, elapsedMs: pending.elapsedMs, durationMs: plan.totalMs };
}
function advanceUse(state, host) {
  // Time left after the tea is done goes on to the sign it queues, so the chunk size never
  // changes when the sign finishes (F1).
  let left = host.elapsedMs || 0;
  for (;;) {
    const pending = state.pendingUse;
    if (!pending || host.canRun === false || state.phase !== 'ready') return;
    if (host.surface === 'day' && !atDayPlace(state, 'cafe')) return;
    // A guest comes when the cafe owner is up to serve (the night rule): a use not yet begun waits for the
    // morning; the U step judges at the settlement's one wall time (host.nowMs, §D1).
    if (pending.elapsedMs === 0 && !upFor(state.village, 'cafe-owner', host.nowMs)) return;
    const need = Math.max(0, executionFor(state).durationMs - pending.elapsedMs);
    if (left < need) { pending.elapsedMs += left; return; }
    left -= need;
    state.pendingUse = null;
    if (pending.kind === 'tea') {
      completeSeat(state, pending.cause);
      if (state.sign.slot && state.sign.target === state.placement) queueUse(state, 'sign', state.sign.placedId);
    } else followSign(state);
  }
}
function currentPlacementFact(state) {
  return trailOf(state).lastSeatPlaced ?? undefined;
}
function followSign(state) {
  ensure(state.placement && state.sign.target === state.placement && state.sign.placedId, 'missing-seat', '먼저 자리를 골라요.');
  const read = fact(state, 'sign.read', [state.sign.placedId], ['guest', 'cafe-owner']);
  const followed = fact(state, 'guest.followed-sign', [read, currentPlacementFact(state)]);
  state.sign.currentUseId = fact(state, 'sign.seat.used', [followed]);
  state.sign.delivered = false; state.activity = 'sign'; state.resting = false;
  if (!state.sign.goalId) state.sign.goalId = fact(state, 'FT51.completed', [state.sign.currentUseId]);
  const note = '자리로 가는 그림을 골랐어요.';
  if (!state.achievements.includes(note)) state.achievements.push(note);
}
function signReaction(state, npcId = 'cafe-owner') {
  const sign = state.sign;
  if (!sign.currentUseId || sign.target !== state.placement || !state.placement) return { selected: null };
  const base = { requiredRevisions: { shelter: state.worldRevision }, conditions: { signReady: true }, actionRef: 'FT51.04' };
  const candidates = [
      { ...base, id: `FT51.${state.worldRevision}.${state.visit}.first`, semanticKey: 'FT51:first', sourceIds: [sign.goalId],
        priority: 100, once: true, contentRef: 'FT51.05' },
      { ...base, id: `FT51.${state.worldRevision}.${state.visit}.daily`, semanticKey: 'FT51:daily-use', sourceIds: [sign.currentUseId],
        priority: 10, once: false, contentRef: 'FT51.revisit' },
  ];
  return Vellum.select({ scope: state.scope, trail: trailView(state, npcId, candidates), npcId,
    currentRevisions: { shelter: state.worldRevision }, conditions: { signReady: true }, candidates });
}
function signPlan(state, reaction) {
  const from = { x: 4, y: 84 }, board = SIGN_SLOTS[state.sign.slot], seat = SEATS[state.placement];
  return Loom.createPlan({ id: reaction.id, revision: state.worldRevision, steps: [
    { id: 'guest-walk-sign', actor: 'guest', from, to: board, durationMs: 1000, pose: 'walking', endPose: 'standing' },
    { id: 'guest-read-sign', actor: 'guest', from: board, to: board, durationMs: 700, pose: 'reading', endPose: 'standing' },
    { id: 'guest-follow-sign', actor: 'guest', from: board, to: { x: seat.x, y: seat.y }, durationMs: 1400, pose: 'walking', endPose: 'standing' },
    { id: 'guest-sit', actor: 'guest', from: { x: seat.x, y: seat.y }, to: { x: seat.x, y: seat.y }, durationMs: 350, pose: 'sitting', endPose: 'seated' },
  ] });
}
function planFor(state, reaction) {
  const seat = SEATS[state.placement];
  const guest = { x: 15, y: 80 }, owner = { x: 42, y: 60 };
  const target = { x: seat.x, y: seat.y }, beside = { x: Math.min(90, seat.x + 16), y: seat.y + 2 };
  const cup = { x: seat.x + 8, y: seat.y - 1 };
  return Loom.createPlan({ id: reaction.id, revision: state.worldRevision, steps: [
    { id: 'guest-walk', actor: 'guest', from: guest, to: target, durationMs: 1500, pose: 'walking', endPose: 'standing' },
    { id: 'guest-sit', actor: 'guest', from: target, to: target, durationMs: 350, pose: 'sitting', endPose: 'seated' },
    { id: 'owner-serve', actor: 'owner', from: owner, to: beside, durationMs: 1100, pose: 'carrying', endPose: 'serving' },
    { id: 'tea-place', actor: 'tea', from: beside, to: cup, durationMs: 350, pose: 'carried', endPose: 'placed', initialPose: 'hidden' },
  ] });
}
/** What Vellum reads of the Trail, from the index, for these candidates — without what this resident
 * was asked to forget (§20-5). */
const trailView = (state, npcId, candidates) => projection(trailOf(state), { version: Trail.VERSION, scope: state.scope, npcId,
  sourceIds: candidates.flatMap(candidate => candidate.sourceIds), forgotten: forgottenBy(state.forgotten || [], npcId) });
export function reactionFor(state, npcId = 'cafe-owner') {
  if (state.activity === 'sign') return signReaction(state, npcId);
  if (!state.placement || !state.currentUseId || !state.served) return { selected: null, eligible: [], rejected: [] };
  const branch = SEATS[state.placement].branch;
  const base = { sourceIds: [state.currentUseId], requiredRevisions: { shelter: state.worldRevision },
    conditions: { seatPresent: true, served: true }, actionRef: 'FT10.05' };
  const first = { ...base, sourceIds: [state.goals[branch]], id: `FT10.${state.worldRevision}.${state.visit}.first`, semanticKey: `FT10:${branch}:first`,
    priority: 100, once: true, contentRef: branch === 'outside' ? 'FT10.06A' : 'FT10.06B' };
  const daily = { ...base, id: `FT10.${state.worldRevision}.${state.visit}.daily`, semanticKey: 'FT10:daily-use',
    priority: 10, once: false, contentRef: 'FT10.revisit' };
  return Vellum.select({ scope: state.scope, trail: trailView(state, npcId, [first, daily]), npcId,
    currentRevisions: { shelter: state.worldRevision }, conditions: { seatPresent: !!state.placement, served: state.served }, candidates: [first, daily] });
}
const action = (type, label, payload = {}) => ({ type, label, payload });
export function viewFor(state) {
  const view = { line: '어디가 좋아요?', speaker: '찻집 주인', actions: [], plan: null, reaction: null, planKind: state.activity === 'sign' ? 'sign' : 'tea',
    committedStepIds: [], scopeLabel: '개발 체험 · 가상 기록', notebook: [...state.achievements],
    scene: { placement: state.placement, previewSlot: state.phase === 'place' ? state.previewSlot : null,
      color: state.color || 'green', canopyPlaced: !!state.placement && SEATS[state.placement].branch === 'outside',
      guestSeated: state.served, teaPlaced: state.served, resting: state.resting,
      sign: state.sign.slot ? { picture: state.sign.picture, slot: state.sign.slot, target: state.sign.target, active: !!state.sign.target } : null,
      signPreview: state.phase === 'sign-place' ? { picture: state.sign.draftPicture, slot: state.sign.draftSlot, target: state.placement, active: true } : null },
    engine: { trail: Trail.VERSION, vellum: Vellum.VERSION, loom: Loom.VERSION, learningEffectClaim: false } };
  const village = state.day ? villageScene(state) : null;
  // The night rule (§4-2 A): a guest comes to the seat when the cafe owner is up to serve it.
  const ownerUp = village?.awake['cafe-owner'] !== false;
  const morningGuest = activity => `찻집 주인이 잠든 밤이에요. 손님은 아침에 ${activity === 'sign' ? '안내판을 보고' : '이 자리에'} 와요.`;
  if (state.phase === 'choose') view.actions = [action('CHOOSE', '밖이 좋아요', { branch: 'outside' }), action('CHOOSE', '안이 좋아요', { branch: 'inside' }),
    state.placement ? action('CANCEL', '지금이 좋아요') : action('LEAVE', '나중에요')];
  if (state.phase === 'outside-preview') {
    view.line = state.canopyOwned ? '내 지붕이 있어요' : '작은 지붕을 만들어요'; view.speaker = '공방 주인';
    view.actions = [action('NEXT', state.canopyOwned ? '내 그늘 놓기' : '만들기'), action('CANCEL', '다시 고르기')];
  }
  if (state.phase === 'inside-preview') {
    view.line = '여기로 옮겨요'; view.actions = [action('NEXT', '옮기기'), action('CANCEL', '다시 고르기')];
  }
  if (state.phase === 'color') {
    view.line = '어떤 색이 좋아요?'; view.speaker = '공방 주인';
    view.actions = [action('COLOR', '초록', { color: 'green' }), action('COLOR', '노랑', { color: 'yellow' }),
      ...(state.color ? [action('CRAFT', '만들기')] : []), action('CANCEL', '다시 고르기')];
  }
  if (state.phase === 'place') {
    view.line = '여기 어때요?';
    const slots = state.branch === 'outside' ? ['garden', 'garden-right'] : ['eaves-left', 'eaves-right'];
    view.actions = slots.map((slot, i) => action('PREVIEW_SLOT', i === 0 ? '이쪽' : '저쪽', { slot }));
    view.actions.push(action('PLACE', '여기에 놓기', { slot: state.previewSlot || slots[0] }), action('CANCEL', '다시 고르기'));
  }
  if (state.phase === 'away') { view.line = '또 만나요'; view.actions = [action('VISIT', '다시 왔어요')]; }
  if (state.phase === 'sign-intro') {
    view.line = '자리를 알려 줘요'; view.actions = [action('SIGN_NEXT', '그림 고르기'), action('SIGN_CANCEL', '나중에요')];
  }
  if (state.phase === 'sign-picture') {
    view.line = '어떤 그림이 좋아요?'; view.actions = [action('SIGN_PICTURE', '의자', { picture: 'chair' }),
      action('SIGN_PICTURE', '차', { picture: 'tea' }), action('SIGN_CANCEL', '나중에요')];
  }
  if (state.phase === 'sign-place') {
    view.line = '여기에 놓아요?'; view.actions = [action('SIGN_PREVIEW', '왼쪽', { slot: 'entrance-left' }),
      action('SIGN_PREVIEW', '오른쪽', { slot: 'entrance-right' }), action('SIGN_PLACE', '놓기', { slot: state.sign.draftSlot }),
      action('SIGN_NEXT', '그림 다시 고르기'), action('SIGN_CANCEL', '나중에요')];
  }
  if (state.phase === 'ready') {
    view.line = state.resting ? '함께 쉬어요' : '여기서 쉬어요';
    view.actions = [action('SIT', state.activity === 'sign' ? '자리 보기' : '앉기'), action('REARRANGE', '자리 옮기기'),
      action('SIGN_START', state.sign.slot ? '안내판 바꾸기' : '길 알려 주기'),
      ...(state.sign.slot ? [action('SIGN_REMOVE', '안내판 치우기')] : []),
      ...(view.scene.canopyPlaced ? [action('REMOVE', '지붕 챙기기')] : []), action('LEAVE', '나가기')];
    if (!(state.activity === 'sign' ? state.sign.delivered : state.delivered)) {
      const selected = reactionFor(state).selected;
      if (selected && !ownerUp) view.line = morningGuest(state.activity);
      else if (selected) {
        view.reaction = selected; view.plan = state.activity === 'sign' ? signPlan(state, selected) : planFor(state, selected);
        view.committedStepIds = view.plan.steps.map(step => step.id);
        view.line = state.activity === 'sign' ? (selected.contentRef === 'FT51.05' ? '그림을 보고 왔어요' : '이 그림을 보고 왔어요')
          : selected.contentRef === 'FT10.06A' ? '함께 만든 자리예요'
          : selected.contentRef === 'FT10.06B' ? '옮긴 의자예요' : '이 자리에 앉아요';
        if (state.activity === 'sign') view.presentationLine = '손님이 그림을 봐요';
      }
    }
  }
  if (state.life) {
    const owner = village?.places['cafe-owner'];
    view.life = viewLife(state.life, { ...livingContext(state), ...(village ? { ownerAwake: village.awake['cafe-owner'],
      ownerLine: owner ? `${RESIDENT_BY_ID['cafe-owner'].label}은 ${doing(owner)[1]}.` : '찻집 주인은 지금 자고 있어요.' } : {}) });
    view.notebook.push(...(view.life.memory || []));
  }
  if (state.pendingUse) {
    // A use not yet begun waits for the morning with the owner (advanceUse); one begun goes on.
    const waiting = state.pendingUse.elapsedMs === 0 && !ownerUp;
    view.execution = waiting ? null : executionFor(state);
    view.plan = null; view.reaction = null; view.committedStepIds = [];
    view.line = waiting ? morningGuest(state.pendingUse.kind) : state.pendingUse.kind === 'tea' ? '손님이 자리를 확인하고 있어요.' : '손님이 안내판을 따라가요.';
    view.actions = view.actions.filter(a => ['SIT', 'REARRANGE', 'REMOVE', 'LEAVE'].includes(a.type));
  }
  if (state.day) view.day = viewDay(state.day, { ...dayContext(state, { surface: 'day' }), village });
  if (state.bazaar) view.bazaar = viewBazaar(state.bazaar, { ...bazaarContext(state, { surface: 'day' }),
    ownerAsleep: !ownerUp, workshopAsleep: village?.awake['workshop-owner'] === false });
  if (state.support) view.support = viewSupport(state.support, supportContext(state));
  return view;
}
export function snapshot(state) { assertState(state); return { state: copy(state), view: viewFor(state) }; }

/** Append a town event (§20-1 kinds) to the lines the store moves to the event branch, checked first. */
function townEvent(state, kind, fields) {
  const event = { id: `E-${state.townSeq + 1}`, kind, cmdRev: state.revision + 1, ...fields };
  ensure(eventProblem(event) === null, 'invalid-event', '마을 기록을 남기지 못했어요.', 503);
  state.townSeq++; state.townEvents.push(event);
  return event.id;
}
/** This visit's version and arm, fixed when the first thing in the visit needs them (§20-6); the id is
 * the command revision that opened it, so no two visits share one. */
function openVisit(state, host) {
  state.policy ||= { ...policyFor({ villageSeed: host.villageSeed ?? 'synk-town', visitId: `V-${state.revision + 1}`, ops: host.ops ?? DEFAULT_OPS }) };
  return state.policy;
}
function preference(change) {
  try { return change(); } catch { throw new TownError('invalid-preference', '설정을 다시 골라 주세요.'); }
}
const personalRoom = prefs => ensure(prefs.lessOften.length <= PERSONAL_MAX && prefs.approachOptOut.length <= PERSONAL_MAX
  && prefs.todayOther.items.length <= PERSONAL_MAX, 'preference-full', '설정이 너무 많아요. 수첩에서 정리해 주세요.', 409);
/** The §20 commands: the person's rights over what the town keeps, and the feedback and suggestion menus. */
const TOWN_COMMANDS = new Set(['MEMORY_FORGET', 'FEEDBACK_REMOVE', 'OBSERVED_CORRECT', 'SEEN_CLEAR', 'MEMORY_CLEAR', 'EVAL_CONSENT',
  'FEEDBACK_GIVE', 'PREF_LESS_OFTEN', 'PREF_TODAY_OTHER', 'PREF_APPROACH', 'PREF_FAMILY']);

export function reduceCommand(previous, command, host = {}) {
  assertState(previous);
  ensure(command && typeof command.id === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(command.id)
    && typeof command.type === 'string' && command.payload && typeof command.payload === 'object'
    && !Array.isArray(command.payload) && Number.isSafeInteger(command.expectedRevision), 'invalid-command', '다시 눌러 주세요.');
  const signature = canonical(command);
  const duplicate = previous.commands.find(item => item.id === command.id);
  if (duplicate) {
    ensure(duplicate.signature === signature, 'conflicting-command', '같은 요청의 내용이 달라요.', 409);
    return { state: copy(previous), duplicate: true };
  }
  ensure(command.expectedRevision === previous.revision, 'stale-command', '다른 창에서 자리가 바뀌었어요. 다시 확인해 주세요.', 409);
  let state = copy(previous);
  const p = command.payload;
  if (TOWN_COMMANDS.has(command.type)) for (const [key, make] of Object.entries(TOWN_FIELDS)) if (!Object.hasOwn(state, key)) state[key] = make();
  const ftMutation = ['CHOOSE', 'NEXT', 'COLOR', 'CRAFT', 'PREVIEW_SLOT', 'PLACE', 'CANCEL', 'REARRANGE', 'REMOVE', 'SIT',
    'SIGN_START', 'SIGN_NEXT', 'SIGN_PICTURE', 'SIGN_PREVIEW', 'SIGN_PLACE', 'SIGN_CANCEL', 'SIGN_REMOVE'].includes(command.type);
  if (ftMutation && (host.surface === 'day' || state.day?.walk?.enabled)) ensure(atDayPlace(state, 'cafe'),
    'day-place-conflict', '찻집에서 현재 자리를 확인해 주세요.', 409);
  if (ftMutation) ensure(!bazaarOwns(state), 'bazaar-cafe-busy', '손님 응대를 닫은 뒤 자리를 바꿔 주세요.', 409);
  const dayEpisode = state.day?.episode;
  if (ftMutation && dayEpisode?.open && dayEpisode.location === state.day.location && dayEpisode.kind === 'tea' && dayEpisode.stage !== 'invalid')
    ensure(false, 'day-cafe-busy', '함께 하던 생활을 닫은 뒤 자리를 바꿔 주세요.', 409);
  if (state.pendingUse && ['SIGN_START', 'SIGN_REMOVE'].includes(command.type))
    ensure(false, 'use-in-progress', '손님이 자리를 확인한 뒤 안내판을 바꿔 주세요.', 409);
  const inPhase = (...phases) => ensure(phases.includes(state.phase), 'wrong-phase', '지금 할 수 있는 일을 골라요.');
  switch (command.type) {
    case 'CHOOSE':
      inPhase('choose'); ensure(['inside', 'outside'].includes(p.branch), 'invalid-choice', '안이나 밖을 골라요.');
      state.branch = p.branch; state.phase = `${p.branch}-preview`;
      break;
    case 'NEXT':
      inPhase('outside-preview', 'inside-preview');
      if (state.branch === 'outside' && !state.materialsGranted) {
        state.inventory.wood += 2; state.inventory.cloth += 1; state.materialsGranted = true;
        fact(state, 'materials.granted', [], ['workshop-owner']);
      }
      state.phase = state.branch === 'outside' && !state.canopyOwned ? 'color' : 'place';
      state.previewSlot = state.branch === 'outside' ? 'garden' : 'eaves-left'; break;
    case 'COLOR':
      inPhase('color'); ensure(['green', 'yellow'].includes(p.color), 'invalid-color', '초록이나 노랑을 골라요.');
      state.color = p.color; break;
    case 'CRAFT':
      inPhase('color'); ensure(!state.canopyOwned && state.color && state.inventory.wood >= 2 && state.inventory.cloth >= 1,
        'missing-materials', '재료를 확인해요. 안쪽 자리는 바로 쓸 수 있어요.');
      state.inventory.wood -= 2; state.inventory.cloth -= 1; state.inventory.canopy = 1; state.canopyOwned = true;
      state.phase = 'place'; state.previewSlot = 'garden'; fact(state, 'canopy.crafted', [], ['workshop-owner']); break;
    case 'PREVIEW_SLOT':
      inPhase('place'); ensure(Object.hasOwn(SEATS, p.slot) && SEATS[p.slot].branch === state.branch,
        'blocked-path', '여기는 길이에요. 옆은 어때요?'); state.previewSlot = p.slot; break;
    case 'PLACE': {
      inPhase('place'); ensure(Object.hasOwn(SEATS, p.slot) && SEATS[p.slot].branch === state.branch,
        'blocked-path', '여기는 길이에요. 옆은 어때요?');
      ensure(state.branch !== 'outside' || state.canopyOwned, 'missing-canopy', '먼저 지붕을 만들어요.');
      state.placement = p.slot; state.previewSlot = null; state.worldRevision++;
      state.inventory.canopy = state.canopyOwned && state.branch !== 'outside' ? 1 : 0;
      const placed = fact(state, 'seat.placed'); state.phase = 'ready';
      state.activity = 'seat';
      if (host.surface === 'day') queueUse(state, 'tea', placed); else completeSeat(state, placed);
      if (state.sign.slot) {
        state.sign.target = state.placement;
        state.sign.placedId = fact(state, 'sign.retargeted', [placed, state.sign.placedId], ['cafe-owner']);
        if (host.surface !== 'day') followSign(state);
      }
      break;
    }
    case 'CANCEL':
      inPhase('choose', 'outside-preview', 'inside-preview', 'color', 'place');
      state.phase = state.placement ? 'ready' : 'choose'; state.previewSlot = null;
      state.branch = state.placement ? SEATS[state.placement].branch : null; break;
    case 'REARRANGE':
      inPhase('ready'); state.phase = 'choose'; state.branch = null; state.previewSlot = null; break;
    case 'REMOVE':
      inPhase('ready', 'place'); ensure(state.placement && SEATS[state.placement].branch === 'outside', 'no-canopy', '지붕을 확인해요.');
      state.placement = null; state.previewSlot = null; state.worldRevision++; state.inventory.canopy = 1;
      state.phase = 'choose'; state.branch = null; state.served = false; state.delivered = false; state.currentUseId = null;
      state.activity = 'seat'; state.sign.target = null; state.sign.currentUseId = null; state.sign.delivered = true;
      fact(state, 'canopy.removed'); break;
    case 'VISIT':
      inPhase('away'); state.phase = state.resumePhase || 'choose'; state.resumePhase = null;
      state.visit++; state.resting = false;
      if (state.policy) state.policy = null;
      if (state.placement && state.phase === 'ready') {
        if (state.activity === 'sign') { if (state.sign.delivered) {
          if (host.surface === 'day') queueUse(state, 'sign', state.sign.placedId); else followSign(state);
        } }
        else if (state.delivered) {
          if (host.surface === 'day') queueUse(state, 'tea', currentPlacementFact(state)); else useSeat(state, currentPlacementFact(state));
        }
      }
      break;
    case 'LEAVE':
      ensure(state.phase !== 'away', 'already-away', '다시 왔어요를 눌러 주세요.');
      state.resumePhase = state.phase; state.phase = 'away';
      if (state.policy) state.policy = null; break;
    case 'SIT': inPhase('ready'); state.resting = true; break;
    case 'SIGN_START':
      inPhase('ready'); ensure(state.placement && state.goals[SEATS[state.placement].branch], 'missing-seat', '먼저 자리를 골라요.');
      state.sign.returnActivity = state.activity; state.activity = 'sign'; state.phase = 'sign-intro';
      state.sign.draftPicture = state.sign.picture; state.sign.draftSlot = state.sign.slot || 'entrance-left'; break;
    case 'SIGN_NEXT': inPhase('sign-intro', 'sign-place'); state.phase = 'sign-picture'; break;
    case 'SIGN_PICTURE':
      inPhase('sign-picture'); ensure(['chair', 'tea'].includes(p.picture), 'invalid-picture', '의자나 차를 골라요.');
      state.sign.draftPicture = p.picture; state.phase = 'sign-place'; break;
    case 'SIGN_PREVIEW':
      inPhase('sign-place'); ensure(Object.hasOwn(SIGN_SLOTS, p.slot), 'blocked-path', '길 옆에 놓아요.');
      state.sign.draftSlot = p.slot; break;
    case 'SIGN_PLACE': {
      inPhase('sign-place'); ensure(state.placement && state.sign.draftPicture && Object.hasOwn(SIGN_SLOTS, p.slot),
        'invalid-sign', '그림과 자리를 먼저 골라요.');
      const changed = state.sign.picture !== state.sign.draftPicture || state.sign.slot !== p.slot || state.sign.target !== state.placement;
      state.sign.picture = state.sign.draftPicture; state.sign.slot = p.slot; state.sign.target = state.placement;
      state.sign.draftPicture = null; state.sign.draftSlot = null; state.phase = 'ready';
      if (changed) {
        state.worldRevision++;
        state.sign.placedId = fact(state, 'sign.placed', [currentPlacementFact(state)], ['cafe-owner']);
        if (host.surface === 'day') queueUse(state, 'sign', state.sign.placedId); else followSign(state);
      }
      break;
    }
    case 'SIGN_CANCEL':
      inPhase('sign-intro', 'sign-picture', 'sign-place'); state.phase = 'ready'; state.activity = state.sign.returnActivity;
      state.sign.draftPicture = null; state.sign.draftSlot = null; break;
    case 'SIGN_REMOVE':
      inPhase('ready'); ensure(state.sign.slot, 'missing-sign', '안내판을 확인해요.');
      state.worldRevision++; fact(state, 'sign.removed', [state.sign.placedId], ['cafe-owner']);
      state.sign = { ...newSign(), goalId: state.sign.goalId }; state.activity = 'seat'; break;
    case 'ACK': {
      if (state.day?.walk?.enabled) ensure(atDayPlace(state, 'cafe'), 'day-walk-too-far', '찻집 가까이에서 실제 모습을 확인해 주세요.', 409);
      inPhase('ready'); const view = viewFor(state); const reaction = view.reaction;
      ensure(reaction && p.reactionId === reaction.id && p.semanticKey === reaction.semanticKey
        && p.worldRevision === state.worldRevision && (p.activity || 'seat') === state.activity && ['motion', 'static', 'text'].includes(p.mode),
      'stale-ack', '지금 자리의 반응을 다시 확인해요.', 409);
      ensure(Loom.canAcknowledge(view.plan, { currentRevision: state.worldRevision, visible: p.visible === true,
        assetsReady: p.assetsReady === true, paused: p.paused, hidden: p.hidden, cancelled: p.cancelled,
        currentPlanId: p.reactionId, committedStepIds: view.committedStepIds, appliedStepIds: p.appliedStepIds }),
      'incomplete-ack', '장면이 보인 뒤에 기록해요.');
      const kind = state.activity === 'sign' ? 'FT51' : 'FT10';
      append(state, 'life.delivered', { reactionId: reaction.id, deliveryId: `${kind}:${state.worldRevision}:${state.visit}:delivery`,
        npcId: 'cafe-owner', semanticKey: reaction.semanticKey, sourceIds: reaction.sourceIds,
        revisions: { shelter: state.worldRevision }, contentVersion: `${kind}.v1`, mode: p.mode });
      if (state.activity === 'sign') state.sign.delivered = true; else state.delivered = true; break;
    }
    case 'RESET': {
      const old = state; state = initialState({ scope: old.scope, lifeEnabled: !!old.life }); state.revision = old.revision; state.worldRevision = old.worldRevision + 1;
      // The counters and the settled play time go on: a reset never replays or rewinds time.
      state.writeSeq = old.writeSeq ?? old.revision; state.settledU = old.settledU ?? 0;
      // Event ids go on too, so an id never names two different events (F7).
      state.trail = emptyIndex(trailOf(old).seq);
      // What the person said and chose stays theirs (§20-5): the consent, the settings and responses,
      // the question budget and the uses behind an observation. The world's things, the visit and what
      // was forgotten of the old world's facts start again; town event ids go on.
      for (const key of ['prefs', 'asks', 'recentLifeUse', 'consents']) if (Object.hasOwn(old, key)) state[key] = old[key];
      state.townSeq = old.townSeq ?? 0;
      state.commands = old.commands; break;
    }
    // The person's own rights over what the town keeps (scope rights, §20-5): the notebook and the
    // account screen use this one command path, so each change leaves its receipt, revision and event.
    case 'MEMORY_FORGET': {
      ensure(forgettable(trailOf(state), p.npc, p.eventId), 'memory-unavailable', '그 기억을 찾지 못했어요. 수첩을 다시 열어 주세요.', 409);
      const next = forget(state.forgotten, { npc: p.npc, target: p.eventId });
      if (next.added) { state.forgotten = next.forgotten; townEvent(state, 'memory.forgotten', { npc: p.npc, target: p.eventId }); }
      break;
    }
    case 'FEEDBACK_REMOVE':
      ensure(typeof p.eventId === 'string' && state.prefs.feedback.some(item => item.completionId === p.eventId),
        'feedback-unavailable', '그 응답을 찾지 못했어요. 수첩을 다시 열어 주세요.', 409);
      state.prefs = removeFeedback(state.prefs, p.eventId);
      townEvent(state, 'feedback.removed', { completionId: p.eventId }); break;
    case 'OBSERVED_CORRECT': {
      ensure(FAMILIES.includes(p.family), 'invalid-preference', '설정을 다시 골라 주세요.');
      const next = correctObserved(state.recentLifeUse, state.prefs, p.family);
      state.recentLifeUse = next.uses; state.prefs = next.prefs; break;
    }
    // The seen ledger is the store's own branch; this command is how the store is told to empty it.
    case 'SEEN_CLEAR': break;
    case 'MEMORY_CLEAR': {
      const next = clearPersonal({ prefs: state.prefs, uses: state.recentLifeUse });
      state.prefs = next.prefs; state.recentLifeUse = next.uses; break;
    }
    case 'EVAL_CONSENT': {
      // A linked (academy) world is never asked and cannot turn it on; withdrawing is always taken.
      const academy = host.academy === true || state.scope.subject.startsWith('linked-');
      try { state.consents = changeConsent(state.consents, { state: p.state, ver: p.ver, academy }); }
      catch (error) {
        if (error.code === 'eval-consent-academy') throw new TownError(error.code, '학원 소속 계정에는 이 기록을 쓰지 않아요.', 403);
        if (error.code === 'eval-consent-version') throw new TownError(error.code, '동의 내용이 바뀌었어요. 다시 확인해 주세요.', 409);
        throw new TownError('invalid-consent', '동의 상태를 다시 골라 주세요.');
      }
      townEvent(state, 'consent.changed', { consent: 'evalSignals', ...state.consents.evalSignals }); break;
    }
    // Feedback and the suggestion menus (scope base, §20-3).
    case 'FEEDBACK_GIVE': {
      ensure(Number.isSafeInteger(host.lifeDay) && host.lifeDay >= 0, 'feedback-unavailable', '지금은 응답을 남길 수 없어요.', 403);
      const given = { completionId: p.completionId, value: p.value, canonicalActivityId: p.canonicalActivityId };
      try { state.prefs = giveFeedback(state.prefs, { ...given, lifeDay: host.lifeDay }); }
      catch { throw new TownError('invalid-feedback', '응답을 다시 골라 주세요.'); }
      // Responses past the version's limit are no longer used, so the world keeps only the newest within it.
      state.prefs.feedback = activeFeedback(state.prefs, host.lifeDay).slice(-PERSONAL_MAX);
      townEvent(state, 'feedback.given', given); break;
    }
    case 'PREF_LESS_OFTEN':
      ensure(typeof p.on === 'boolean', 'invalid-preference', '설정을 다시 골라 주세요.');
      state.prefs = preference(() => setLessOften(state.prefs, p.activity, p.on)); personalRoom(state.prefs); break;
    case 'PREF_APPROACH':
      ensure(typeof p.optOut === 'boolean', 'invalid-preference', '설정을 다시 골라 주세요.');
      state.prefs = preference(() => setApproach(state.prefs, p.activity, p.optOut)); personalRoom(state.prefs); break;
    case 'PREF_TODAY_OTHER': {
      const { visitId } = openVisit(state, host);
      state.prefs = preference(() => setTodayOther(state.prefs, visitId, p.activity)); personalRoom(state.prefs); break;
    }
    case 'PREF_FAMILY':
      state.prefs = preference(() => answerFamily(state.prefs, p.family, p.answer)); break;
    default: {
      const asleep = sleepersFor(state, command, p, host.nowMs);
      ensure(!asleep.length, 'resident-asleep', `${asleep.map(npc => RESIDENT_BY_ID[npc].label).join('과 ')}은 지금 자고 있어요. 아침에 다시 만나요.`, 409);
      if (command.type.startsWith('SUPPORT_')) {
        ensure(state.support && host.enabled === true && host.surface === 'day', 'support-unavailable', '첫 하루에서 읽기 도움을 확인해 주세요.', 403);
        runLife(state, () => { commandSupport(state.support, command.type, p, supportContext(state, host)); return []; });
        break;
      }
      if (command.type.startsWith('BAZAAR_')) {
        ensure(state.bazaar && host.enabled === true && host.surface === 'day', 'bazaar-unavailable', '첫 하루에서 손님의 요청을 확인해 주세요.', 403);
        if (state.day?.walk?.enabled && !['BAZAAR_CLOSE', 'BAZAAR_CANCEL'].includes(command.type))
          ensure(atDayPlace(state, 'cafe'), 'day-walk-too-far', '찻집 가까이 걸어가서 손님을 맞아 주세요.', 409);
        if (['BAZAAR_START', 'BAZAAR_RESUME'].includes(command.type)) state.day.rest = false;
        runLife(state, () => commandBazaar(state.bazaar, command.type, p, bazaarContext(state, host, p.kind)));
        break;
      }
      if (command.type.startsWith('DAY_')) {
        ensure(state.day && host.enabled === true && host.surface === 'day',
          'day-unavailable', '첫 하루 화면에서 현재 생활을 확인해 주세요.', 403);
        if (command.type.startsWith('DAY_WALK') || command.type === 'DAY_INTERACT') ensure(host.canRun && host.surfaceId
          && host.ownerSurfaceId === host.surfaceId, 'walk-not-owner', '지금 조작 중인 마을 창에서 걸어 주세요.', 409);
        if (['DAY_START', 'DAY_RESUME', 'DAY_RETRY'].includes(command.type)) ensure(!bazaarOwns(state)
          && !(command.type === 'DAY_RESUME' && state.bazaar?.episode?.open && state.day.episode?.location === 'cafe'),
          'bazaar-cafe-busy', '손님과 하던 생활을 닫은 뒤 이어가 주세요.', 409);
        if (command.type === 'DAY_JOB_START') ensure(!(bazaarOwns(state) && state.bazaar.episode.kind === 'pictureMenu'),
          'day-workshop-busy', '공방 주인이 메뉴판 준비를 마친 뒤 부탁해 주세요.', 409);
        runLife(state, () => commandDay(state.day, command.type, p, dayContext(state, host)));
        break;
      }
      ensure(command.type.startsWith('LIFE_') && state.life && host.enabled === true,
        'unknown-command', '지금 할 수 있는 일을 골라요.');
      if (state.day?.walk?.enabled && !['LIFE_CLOSE', 'LIFE_PREFERENCE'].includes(command.type))
        ensure(atDayPlace(state, 'cafe'), 'day-walk-too-far', '찻집 가까이 걸어가서 이웃과 이야기해 주세요.', 409);
      if (['LIFE_OPEN', 'LIFE_RESUME'].includes(command.type)) state.resting = false;
      runLife(state, () => commandLife(state.life, command.type, p, livingContext(state, host)));
      break;
    }
  }
  if (state.pendingUse && (state.pendingUse.worldRevision !== state.worldRevision || state.pendingUse.placement !== state.placement)) state.pendingUse = null;
  if (state.life && command.type !== 'RESET' && previous.placement !== state.placement) state.lifeSeatRevision++;
  if (state.life && command.type !== 'RESET') runLife(state, () => advanceLife(state.life,
    livingContext(state, { ...host,
      surfaceId: Object.hasOwn(host, 'ownerSurfaceId') ? host.ownerSurfaceId : host.surfaceId ?? state.life.authority.surfaceId,
      elapsedMs: 0, canContact: false, visitEnded: command.type === 'LEAVE' })));
  if (state.day && command.type !== 'RESET') runLife(state, () => advanceDay(state.day,
    dayContext(state, { ...host, elapsedMs: 0 })));
  if (state.bazaar && command.type !== 'RESET') runLife(state, () => advanceBazaar(state.bazaar,
    bazaarContext(state, { ...host, elapsedMs: 0 })));
  if (state.village && command.type !== 'RESET') settleVillage(state, host);
  state.revision++;
  state.commands.push({ id: command.id, signature, revision: state.revision });
  assertState(state);
  return { state, duplicate: false };
}
