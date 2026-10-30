/** FT10 game authority for a local, synthetic developer fixture.
 * World/material transactions live here. Trail reads confirmed facts, Vellum
 * selects authored reactions, and Loom supplies presentation only.
 * This is not an account service or a TOPIK assessment.
 */
import Trail from '../../atlas/trail-life.js';
import Vellum from '../../atlas/vellum-life.js';
import Loom from '../../tools/lib/loom-life.js';
import { initialLife, assertLife, advanceLife, commandLife, viewLife, LifeError, liveSourceKey as lifeLiveKey, foldLife, cardContactFor } from './life.mjs';
import { initialDay, assertDay, advanceDay, commandDay, viewDay, DayError, liveSourceKey as dayLiveKey, foldDay } from './day.mjs';
import { initialBazaar, assertBazaar, advanceBazaar, commandBazaar, viewBazaar, BazaarError } from './bazaar.mjs';
import { initialSupport, assertSupport, commandSupport, viewSupport, snapshotSupport, SupportError, foldSupport } from './support.mjs';
import { nearbyPlace } from './walk.mjs';
import { FT_SEATS, SIGN_SLOTS as SIGN_SPOTS } from './town/places.mjs';
import { emptyIndex, admit, record, indexLog, isFact, projection, validIndex, foldIndex } from './town/trail-index.mjs';
import { emptyLedger, validLedger, grant, transfer, held, ITEM_BY_ID, LedgerError } from './town/ledger.mjs';
import { initialPrefs, initialAsks, giveFeedback, removeFeedback, activeFeedback, setLessOften, setApproach, setTodayOther, todayOther,
  answerFamily, correctObserved, clearPersonal, validPrefs, validAsks, validUses, recordUse as recordLifeUse,
  observedFamily, mayAsk, recordAsk, firstAsk } from './town/prefs.mjs';
import { initialConsents, changeConsent, validConsents } from './town/consent.mjs';
import { eventProblem, FAMILIES, relation } from './town/events.mjs';
import { policyFor, DEFAULT_OPS, PARAMS_BY_VER, ARMS, paramsFor, eventMarks, adaptedOn } from './town/params.mjs';
import { forgettable, forget, forgottenBy, pruneForgotten, validForgotten, ACTIVITY_MEMORY } from './town/memory.mjs';
import { initialVillage, validVillage, GIVES_MAX, closeBands, closeOpen, holdResidents, keepHabitSpots, recordUse, promiseTomorrow, planOf, placeAt, caption, doing, upFor, goalOf, bandInput,
  noteStay, closeStay } from './town/village.mjs';
import { agreementSpot, RESIDENT_BY_ID, RESIDENT_IDS } from './town/plan.mjs';
import { CARD_BY_ID, CARD_REF, cardsAt, villageAt, mayTake, choiceOk, playerRelation, cardRef, placeOfSpot, holdSpotOf, talkPlaceOf } from './town/cards.mjs';
import { learnPrivate, hearsayFor, tell, privateOf, noteOf } from './town/knowledge.mjs';
import { createRng, hashString, seedKey } from './town/rng.mjs';
import { PER_MILLE } from './town/state.mjs';
import { SPOT_GROUPS } from './town/places.mjs';
import { VISIT_IDLE_MS } from './presence.mjs';
import { bandAt, BAND_IDS, clockAt, afterRainAt } from './town/clock.mjs';
import { initialVisitBands, writeBand, setVisitBands, clearVisitBands, validVisitBands } from './town/visits.mjs';
import { meanwhileLines } from './town/meanwhile.mjs';
import { ACTIVITIES, ACTIVITY_BY_ID, activityOfCommand, initialActivities, restoreActivities, validActivities } from './town/activities/index.mjs';
import { initialLadder, validLadder, closeScene, chooseLevel, pickSceneLevel, markOffer, answerOffer, followPlacement, LEVELS, CHANNELS } from './town/language-ladder.mjs';
import { weatherAt } from './town/clock.mjs';
import { startNewTea, newTeaView, helpNewTea, chooseNewTea } from './new-tea.mjs';
import { closeDialogue } from './dialogue.mjs';

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
  consents: initialConsents, policy: () => null, forgotten: () => [], townSeq: () => 0, townEvents: () => [],
  // W6: the visit (its start, the last one's end, its band) and the time the player usually comes (§10-3) — the player's side.
  townVisit: () => null, visitBands: () => initialVisitBands(), activities: initialActivities, languageLadder: () => null });
const townFields = () => Object.fromEntries(Object.entries(TOWN_FIELDS).map(([key, make]) => [key, make()]));
/** The most entries a person's own setting lists keep (less often, not approached first, today's others, responses). */
export const PERSONAL_MAX = 64;
const validPolicy = policy => policy === null || !!policy && Object.keys(policy).length === 3 && typeof policy.visitId === 'string'
  && /^[A-Za-z0-9_.:-]{1,80}$/.test(policy.visitId) && Object.hasOwn(PARAMS_BY_VER, policy.paramsVer) && ARMS.includes(policy.arm);
/** The visit in progress or the last one (W6): when it began, the last play of the one before (null: none or unknown),
 * its life day and band once the village's clock places it, the world's first visited life day, whether the player
 * finished something with a resident in it, and when it ended. */
const VISIT_KEYS = Object.freeze(['startAt', 'since', 'endedAt', 'lifeDay', 'band', 'firstDay', 'done']);
const validVisit = visit => visit === null || !!visit && typeof visit === 'object' && !Array.isArray(visit) && Number.isSafeInteger(visit.startAt)
  && (visit.since === null || Number.isSafeInteger(visit.since) && visit.since <= visit.startAt)
  && (visit.endedAt === undefined || visit.endedAt === null || Number.isSafeInteger(visit.endedAt))
  && (visit.lifeDay === undefined && visit.band === undefined || Number.isSafeInteger(visit.lifeDay) && BAND_IDS.includes(visit.band))
  && (visit.firstDay === undefined || Number.isSafeInteger(visit.firstDay)) && (visit.done === undefined || visit.done === true)
  && Object.keys(visit).every(key => VISIT_KEYS.includes(key));
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
  // An activity the world never met (W8: the tea order) reads at its start value — added fields, no migration.
  if (state?.activities) state.activities = restoreActivities(state.activities);
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
    && (!has('forgotten') || validForgotten(state.forgotten)) && (!has('townSeq') && !has('townEvents') || townEventsValid(state))
    && (!has('townVisit') || validVisit(state.townVisit)) && (!has('visitBands') || validVisitBands(state.visitBands))
    && (!has('activities') || validActivities(state.activities)) && (!state.languageLadder || validLadder(state.languageLadder)),
  'invalid-save', '마을 기록을 확인할 수 없어요.', 503);
  return state;
}

// Walking, the player is where it walks (W6 — W5 follow-up: a place counted only after the player spoke there once).
const atDayPlace = (state, place) => (state.day?.walk?.enabled ? nearbyPlace(state.day.walk) === place : state.day?.location === place);
// The same place by name, for what an activity reads (W8 headless: walking up to the cafe without talking there first left
// day.location at the last place spoken at, so the order opened and every cup served was refused as too far).
const dayPlace = state => (state.day?.walk?.enabled ? nearbyPlace(state.day.walk) ?? null : state.day?.location ?? null);
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
    cafeBusy: bazaarOwns(state) || teaOwns(state) || !!state.pendingUse || state.phase !== 'ready' || !(state.activity === 'sign' ? state.sign.delivered : state.delivered)
      || !!c1 && (c1.stage === 'executing' || c1.open && !['result', 'invalid'].includes(c1.stage)) };
}
function bazaarOwns(state) { return !!state.bazaar?.episode?.open && state.day?.location === 'cafe'; }
/** An open tea order (or one-cup board) while the player is at the cafe: the cafe's other scenes wait for it (W8, review F6). */
function teaOwns(state) { return !!state.activities?.['tea-order']?.open && dayPlace(state) === 'cafe'; }
const slotOf = (state, a) => state.activities?.[a.id] ?? a.initial();
function bazaarContext(state, host = {}, requestedKind) {
  const episode = state.day?.episode, life = state.life?.episode;
  return { elapsedMs: host.elapsedMs || 0, canRun: host.canRun !== false && host.surface === 'day' && !state.day?.rest && atDayPlace(state, 'cafe'),
    location: state.day?.location || 'home', support: state.day?.support || 'demo',
    languageSupport: state.support ? snapshotSupport(state.support).mode : 'plain',
    languageSupportBasis: state.support ? snapshotSupport(state.support) : undefined,
    cafeBusy: teaOwns(state) || !!state.pendingUse || state.phase !== 'ready' || !state.placement
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
  const dayOwns = bazaarOwns(state) || teaOwns(state) || dayEpisodeOwns || host.surface === 'day' && !atDayPlace(state, 'cafe');
  return { surfaceId: state.life?.authority.surfaceId ?? null, fence: state.life?.authority.fence ?? 0,
    ...host, canRun: ready && host.canRun !== false && !dayOwns,
    // The owner who invites is up (the night rule): no contact is issued while it sleeps.
    canContact: ready && !dayOwns && !state.resting && !(host.surface === 'day' && state.day?.rest) && host.canContact === true && !state.asks?.open
      && upFor(state.village, 'cafe-owner', host.nowMs),
    worldRevision: state.lifeSeatRevision ?? state.worldRevision, placement: state.placement,
    // A card's offer goes only to a screen that draws cards (review F6: an old one would show it as the seat's invitation).
    cardOffer: host.canContact === true && Array.isArray(host.caps) && host.caps.includes('cards') ? cardOfferFor(state, host) : null };
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
  // A life activity holds whom it says (W8: the tea order, the cafe owner at the counter while the player is at the cafe).
  for (const a of ACTIVITIES) for (const h of a.held(slotOf(state, a), { location: dayPlace(state) })) hold(h.npc, h.by, h.spot);
  // A card the player has open holds its owner at its spot, and C1's neighbour beside it (§8-3 나와 함께).
  for (const take of state.village?.takes || []) if (take.open) {
    const card = CARD_BY_ID[take.card], by = `card:${take.card}:${take.key}`;
    hold(card.owner, by, holdSpotOf(card));
    for (const npc of card.paths.player.with || []) hold(npc, by, firstSpot(card.paths.pair.partnerSpot));
  }
  return held;
}
const firstSpot = name => SPOT_GROUPS[name]?.[0] ?? name;
/** The night rule at a command (host.nowMs, §4-2 A): the residents a scene would begin with must be up. A scene already
 * begun goes on (resuming one is not a beginning) — a retry after its seat moved begins it again; without the host's
 * sleeps every scene stays open. */
function sleepersFor(state, command, p, nowMs) {
  const v = state.village;
  if (!v?.sleeps) return [];
  const needs = command.type === 'DAY_START' ? DAY_MEMBERS[p.kind] || [] : command.type === 'DAY_RETRY' ? DAY_MEMBERS[state.day?.episode?.kind] || []
    : command.type === 'DAY_JOB_START' ? ['workshop-owner']
    : command.type === 'BAZAAR_START' ? ['cafe-owner', ...(p.kind === 'pictureMenu' ? ['workshop-owner'] : [])]
      : command.type === 'LIFE_OPEN' || command.type === 'TEA_OPEN' ? ['cafe-owner'] : [];
  return needs.filter(npc => !upFor(v, npc, nowMs));
}
/** Where a habit may form (§6-5): the player's seat (anyone) and the first day's agreed spot (the workshop owner). */
function habitSpots(state) {
  const agreed = agreementSpot(state.day?.agreement);
  return [...(state.placement && FT_SEATS[state.placement] ? [{ spot: FT_SEATS[state.placement].spot }] : []),
    ...(agreed ? [{ spot: agreed, npc: 'workshop-owner' }] : [])];
}
/** A scene that reached its result with the player (§7-2 함께한 일): its residents' open holds say so — at the step
 * the result came in and at a command's end, never later (review P1-1: a mark on a hold that already ended could
 * reach a band that settlement had closed). The cafe owner's hold also says how much the help lightened her chores
 * (stall service, the tray; not when the player only watched). The band its hold ends in counts it (village.mjs). */
function markTogether(state) {
  const v = state.village;
  if (!v?.reservations.length) return;
  const help = paramsFor().state.helpChores, done = new Map();
  const scene = (e, helpKind) => { if (e?.resultId) done.set(e.id, helpKind && e.role !== 'observer' ? help[helpKind] : 0); };
  scene(state.day?.episode, null);
  scene(state.bazaar?.episode, 'bazaar');
  scene(state.life?.episode, 'life');
  for (const take of v.takes || []) if (take.status === 'resolved') done.set(`card:${take.card}:${take.key}`, 0);
  // A life activity says what the player finished in it so far (W8: one chore lighter for each guest the player
  // served — on its card's hold when a card opened it). A mark grows while its hold is open (review F1).
  for (const a of ACTIVITIES) for (const [by, help] of a.results(slotOf(state, a))) done.set(by, Math.max(done.get(by) ?? 0, help));
  // A scene held again after the player stepped away and back has a second hold with the same `by`: what an earlier,
  // ended one already lightened is not given twice (review GA1).
  const credited = new Map();
  for (const r of v.reservations) if (r.toMs !== null && r.npc === 'cafe-owner' && done.has(r.by)) credited.set(r.by, (credited.get(r.by) ?? 0) + (r.help ?? 0));
  for (const r of v.reservations) {
    if (r.toMs !== null || !done.has(r.by)) continue;
    r.with = true;
    // The visit finished something with a resident (W6 — the consent question waits for such a visit, §20-4).
    if (state.townVisit && state.townVisit.endedAt === undefined) state.townVisit.done = true;
    const due = done.get(r.by) - (credited.get(r.by) ?? 0);
    if (r.npc === 'cafe-owner' && due > (r.help ?? 0)) r.help = due;
  }
}
/** The settlement's close step (town/settle.mjs close): bands that ended by nowMs close and the next
 * opens; habit uses become town events. The host gives the village seed, its offset and visitEnd, and
 * sleeps when it keeps the residents' nights (an account's town; village.mjs upFor). */
export function closeLiving(state, nowMs, { seed = 'synk-town', offsetMin = null, visitEnd = null, sleeps = false, ask = null } = {}) {
  if (!state.village) return state;
  const candidates = habitSpots(state);
  keepHabitSpots(state.village, candidates);
  // A visit the host knows has ended (visitEndAt reached — the wall time a visit-end step would write) ends here too, so a
  // read before the next pulse never shows the last visit's lines as new (Fable F1); its band is placed before the bands
  // close, so the ring a new life day plans with never turns on when the world was settled (F5).
  if (state.townVisit && state.townVisit.endedAt === undefined && Number.isSafeInteger(visitEnd)) { placeVisit(state); endVisit(state, visitEnd); }
  placeVisit(state);
  const closed = closeBands(state.village, { nowMs, seed, offsetMin, revision: state.revision, visitEnd, candidates, sleeps, visitBands: state.visitBands ?? null });
  for (const use of closed) townEvent(state, 'habit.used', { ...use, actors: [use.npc] });
  // A card the residents solved is a public event (§9-2): settled outside any visit, so it names the version only (§20-6).
  for (const line of closed.resolved) townEvent(state, 'card.resolved', { ref: line.ref, card: line.card, path: line.path, public: true,
    actors: line.actors, place: line.place, lifeDay: line.lifeDay, band: line.band, atMs: line.atMs, ...eventMarks(state.policy, { inVisit: false }) });
  placeVisit(state);
  // The settlement's last step was a safe boundary (ask: { canContact, caps, academy, evalSignals }): the mascot may ask.
  if (ask) offerAsk(state, ask);
  return state;
}
/** The visit's band (W6, §10-3): once the village's clock stands, the band the visit began in is its own, the first
 * visited life day is kept, and the ring of the time the player usually comes takes it (the first visit of the day). */
function placeVisit(state) {
  const visit = state.townVisit, v = state.village;
  if (!visit || visit.lifeDay !== undefined || !v?.tz.length) return;
  const w = bandAt(v.tz, visit.startAt);
  state.townVisit = { ...visit, lifeDay: w.lifeDay, band: w.band, firstDay: visit.firstDay ?? w.lifeDay };
  if (state.visitBands) state.visitBands = writeBand(state.visitBands, w.lifeDay, w.band);
}
/** The seat and sign steps that are an input in progress (choose, ready and away are not — a player who never placed a
 * seat is asked as anyone, Fable F2). */
const PLACING = Object.freeze(['outside-preview', 'inside-preview', 'color', 'place', 'sign-intro', 'sign-picture', 'sign-place']);
/** Whether the player is in something now — a scene, a card, an invitation, a rest, placing a seat (§20-3 묻지 않는 때). */
function sceneOpen(state) {
  return !!(state.resting || state.day?.rest || state.day?.episode?.open || state.bazaar?.episode?.open || state.life?.episode?.open
    || state.pendingUse || PLACING.includes(state.phase) || (state.village?.takes || []).some(t => t.open)
    // A life activity going on (W8 — the tea order or its one-cup board) is something the player is in too (r3 GA1).
    || Object.values(state.activities || {}).some(slot => slot?.open)
    || (state.life?.contacts || []).some(c => ['issued', 'delivered', 'detail'].includes(c.status)));
}
/** A visit ends (its step, or the host's known end): its end is kept for the next visit's window, its question goes. */
function endVisit(state, endedAt) {
  state.townVisit = { ...state.townVisit, endedAt: endedAt ?? null };
  if (state.asks?.open) { const { open, ...rest } = state.asks; state.asks = rest; }
}
/** The screen drew the mascot's question (W6, Fable F9 — reported beside a boundary like what it showed, never a command,
 * so it moves no command revision): it counts against the day's one question and the same question's rest, and a taste
 * question shows its family as 「요즘 자주 한 생활」. Unknown or stale keys change nothing. */
export function askDrawn(state, key) {
  const open = state.asks?.open;
  if (!open || open.key !== key || open.delivered) return false;
  state.asks = { ...recordAsk(state.asks, { lifeDay: open.lifeDay, key: open.key }), open: { ...open, delivered: true } };
  if (open.kind === 'taste') state.prefs = { ...state.prefs, observed: open.family };
  return true;
}
/** The mascot's one question (§20-3·§20-4, W6): at a safe boundary of a screen that draws it, never inside something,
 * in a visit's first seconds or on the world's first visited life day; one a life day, the order widening > taste >
 * consent (widening is asked as a scene ends — offerWiden, W9). Taste: the family the player keeps opening themself (the adapted arm only, never one
 * answered no). Consent: on hosts that turned the evaluation signals on, never to an academy-linked account, never again
 * once shown, and only in a visit that finished something with a resident. The question waits as asks.open until the
 * screen says it drew it (ASK_ACK — then it counts) or the visit ends. */
function offerAsk(state, ctx) {
  const asks = state.asks, visit = state.townVisit, doors = askDoors(state);
  if (ctx.canContact !== true || !Array.isArray(ctx.caps) || !ctx.caps.includes('asks') || !asks || asks.open || !doors) return;
  const { lifeDay, secondsIntoVisit } = doors;
  const found = {};
  const family = observedFamily(state.recentLifeUse || [], state.prefs, { policy: state.policy });
  if (family && mayAsk(asks, { lifeDay, key: `taste:${family}`, secondsIntoVisit })) found.taste = { key: `taste:${family}`, family };
  const academy = ctx.academy === true || state.scope.subject.startsWith('linked-');
  if (ctx.evalSignals === true && !academy && state.consents?.evalSignals.state === 'unasked' && asks.asked.consent === undefined
    && visit.done === true && mayAsk(asks, { lifeDay, key: 'consent', secondsIntoVisit })) found.consent = { key: 'consent' };
  const kind = firstAsk(Object.keys(found));
  if (kind) state.asks = { ...asks, open: { kind, ...found[kind], lifeDay, delivered: false } };
}
/** The doors every mascot question passes (§20-3): a visit going on whose band stands, past the world's first visited life
 * day, nothing open now. Its life day (the village band's) and the seconds into the visit, or null. */
function askDoors(state) {
  const v = state.village, visit = state.townVisit, life = state.life;
  if (!life || !visit || visit.endedAt !== undefined || visit.lifeDay === undefined || !v?.band || sceneOpen(state)) return null;
  return v.band.lifeDay === visit.firstDay ? null : { lifeDay: v.band.lifeDay, secondsIntoVisit: Math.floor((life.uMs - life.visitStartU) / 1000) };
}
/** A conversation or the tea order going on: its L stays the one it began with (bridge §3-3). */
const languageScene = state => !!state.activities?.['tea-order']?.open || !!state.village?.takes?.some(t => t.card === 'C4' && t.open && t.status === 'with');
/** The widening offer (bridge §3-3, design §13-1·§20-3, W9) is the first of the mascot's questions: asked as a scene ends by
 * the screen that drew it (its LANGUAGE_OFFER says it draws the question), in the adapted arm only, through the doors every
 * question passes and inside the day's one question. The ended scene's response format picks the main evidence (a
 * conversation single-choice, the tea order cup-compose — an older screen names none). The key names the seat and the
 * level offered, so the next step up never rests behind one accepted (Fable W9 design review 2). It stands as asks.open
 * until drawn, answered or closed, and a question not yet drawn steps aside for it (ASK_ORDER). Whether it stands. */
function offerWiden(state, host, { channel, format = 'cup-compose', condition }) {
  const asks = state.asks, doors = askDoors(state);
  if (!doors || !adaptedOn(openVisit(state, host)) || asks.open?.delivered || asks.open?.kind === 'widen') return false;
  const choice = pickSceneLevel({ channel, ladder: state.languageLadder, summary: host.learningSummary, settings: host.learningSettings,
    today: { condition }, scene: { versions: LEVELS, responseFormat: format }, now: host.nowMs || 0, day: doors.lifeDay });
  const key = choice.offer ? `widen:${channel}:${choice.offer.to}` : null;
  if (!key || !mayAsk(asks, { lifeDay: doors.lifeDay, key, secondsIntoVisit: doors.secondsIntoVisit })) return false;
  const evidence = (state.languageLadder[channel].evidence || 0) + (host.learningSummary?.evidenceRevision || 0);
  state.languageLadder = markOffer(state.languageLadder, channel, host.nowMs || 0, evidence, doors.lifeDay);
  state.asks = { ...asks, open: { kind: 'widen', key, lifeDay: doors.lifeDay, delivered: false } };
  return true;
}
/** Whether a widening question could still stand today (W9): the screen asks the host only then, since the host reads the
 * whole learning record for it. The level and the evidence stay the host's to judge. */
function widenReady(state) {
  const doors = askDoors(state), asks = state.asks;
  return !!doors && !!asks && adaptedOn(state.policy) && !asks.open?.delivered && asks.open?.kind !== 'widen' && asks.lastLifeDay !== doors.lifeDay
    && doors.secondsIntoVisit >= paramsFor(state.policy?.paramsVer).asks.quietAfterVisitSeconds;
}
/** The host's placement reaches the ladder at a command (followPlacement, W9): an open scene keeps its L — the change waits
 * for the next command — and a widening question standing for a seat that moved goes with its offer. */
function placeLanguage(state, host) {
  if (!host.languagePlacement || languageScene(state)) return;
  const before = state.languageLadder, after = followPlacement(before, host.languagePlacement, host.nowMs || 0);
  if (after === before) return;
  state.languageLadder = after;
  const open = state.asks?.open;
  if (open?.kind === 'widen' && CHANNELS.some(c => after[c].stable !== before[c].stable && open.key.startsWith(`widen:${c}:`))) {
    const { open: _gone, ...rest } = state.asks; state.asks = rest;
  }
}
/** The visit (W6, §10-2·§10-3·§20-6): a step held by a window after the last visit ended opens the next one. It began when
 * the lease's presence says (only a pulse saw it; an old lease: this settlement), and what a returning player sees changed
 * comes from after the last one's last play. Its version and arm open with it from the account the host names, so a
 * visit with no command still has them. Its band is placed when the village closes its bands (placeVisit). A visit that
 * ends drops its open question. */
function trackVisit(state, host) {
  if (!Object.hasOwn(state, 'townVisit')) return;
  const visit = state.townVisit;
  if (host.visitEnded) {
    if (visit && visit.endedAt === undefined) { placeVisit(state); endVisit(state, host.visitEndedAt ?? null); }
    return;
  }
  if (!host.surfaceId || visit && visit.endedAt === undefined) return;
  const since = Number.isSafeInteger(visit?.endedAt) ? visit.endedAt - VISIT_IDLE_MS : null;
  const begun = Number.isSafeInteger(host.visitStartAt) ? host.visitStartAt : host.nowMs;
  // The old pulse path gives no clock: no visit is recorded there.
  if (!Number.isSafeInteger(begun)) return;
  state.townVisit = { startAt: Math.max(begun, since ?? begun), since, ...(visit?.firstDay !== undefined ? { firstDay: visit.firstDay } : {}) };
  // Back where the player left, the stay with the cafe owner may begin at the visit's start (§8-4).
  trackPlace(state, state.townVisit.startAt, { visitStart: true });
  // The id comes from when the visit began (visitIdOf) — a command revision would differ between a world settled every
  // second and one settled at a command.
  if (typeof host.villageSeed === 'string' && host.villageSeed) state.policy ||= { ...policyFor({ villageSeed: host.villageSeed,
    visitId: visitIdOf(state, host.villageSeed), ops: host.ops ?? DEFAULT_OPS }) };
}
/** Where the player stays while C4's first is owed (§8-4, town/village.mjs noteStay): the place of the open visit, written at a
 * command's end (the store has closed the bands up to it) and at the visit's start (its own instant — the bands it missed may
 * not have closed yet, so it may hold more), closed at its end — never by a read or a boundary, so the first stay is the same
 * however often the world is read (§15-3). */
function trackPlace(state, atMs, { visitStart = false } = {}) {
  if (!state.village) return;
  const visit = state.townVisit;
  noteStay(state.village, visit && visit.endedAt === undefined ? dayPlace(state) : null, atMs, { held: visitStart });
}
/** A command's end, after its 0-second chain: holds follow the scenes (a new hold opens now, a released
 * one ends now), and a new first-day agreement is its first use and tomorrow's promise (§6-5). */
function settleVillage(state, host) {
  const v = state.village;
  if (!v?.band || !Number.isSafeInteger(host.nowMs)) return;
  keepHabitSpots(v, habitSpots(state));
  markTogether(state);
  holdResidents(v, heldNow(state), host.nowMs, state.revision + 1);
  trackPlace(state, host.nowMs);
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
function endVisitScenes(state, endedAt, host = {}) {
  // A life activity closes first (the tea order as 「그만할래요」), and what the player finished marks its holds
  // before they end at the visit's end (review F1). Its events are outside the visit (review F14).
  const at = endedAt ?? host.nowMs ?? state.lifeHost?.lastForegroundAt ?? 0;
  for (const a of ACTIVITIES) if (state.activities?.[a.id]?.open && state.village?.band) {
    const out = a.endVisit(state.activities[a.id], activityCtx(state, a, { ...host, nowMs: at }));
    state.activities[a.id] = out.slot;
    afterActivity(state, a, out, { ...host, nowMs: at }, { inVisit: false });
  }
  if (state.village?.reservations) markTogether(state);
  if (state.day?.episode?.open) state.day.episode.open = false;
  const c1 = state.life?.episode;
  if (c1?.open) { c1.open = false; if (c1.stage === 'result') c1.dismissed = true; }
  if (state.bazaar?.episode?.open) state.bazaar.episode.open = false;
  for (const take of state.village?.takes || []) {
    take.open = false;
    if (['with', 'paused'].includes(take.status)) { take.status = 'ended'; take.endAt = Math.max(take.at, endedAt ?? take.at); }
  }
  if (state.village) closeOpen(state.village, endedAt);
  // The player's stay ends with the visit, at the instant the holds do (§8-4 first C4).
  if (state.village) closeStay(state.village, endedAt);
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
    segments: segments.filter(seg => seg.endMs > nowMs).map(segmentView),
    ...cardsView(state, nowMs) };
}
/** A plan segment as the screens get it. A segment whose mind changed carries its mood line's ID (§7-3) — the screen
 * shows it near that resident; never the state (G2) nor why (reason, basis). W5: a card's solving names its card and
 * part, a pair scene the neighbour it is with (old screens ignore both). W10: a mind glad of a card done with the player
 * names that card (gladCard) — its mood line is the card's own. */
export const segmentView = ({ npc, startMs, arriveMs, endMs, archetype, spot, mood, card, cardRole, with: other, basis }) => ({ npc, startMs, arriveMs, endMs, archetype, spot,
  ...(mood ? { mood } : {}), ...(mood && basis?.kind === 'take' ? { gladCard: basis.card } : {}), ...(card ? { card, cardRole } : {}), ...(other ? { with: other } : {}) });
/** The cards, traces, news and hearsay at nowMs for the screens that draw them (W5b): which cards wait and how the player
 * may join them, the take in hand, what the village shows, the news note (no dates, G3), what each resident would tell
 * the player and what it knows of things done with the player (without what it was asked to forget). */
function cardsView(state, nowMs) {
  const v = state.village, out = planOf(v), now = villageAt(bandInput(v), out.segments, out.log, nowMs);
  const take = (v.takes || []).find(t => t.open) ?? null;
  return { cards: cardsAt(bandInput(v), out.segments, out.log, nowMs).map(c => ({ ...c, ready: !CARD_BY_ID[c.card].locked && CARD_BY_ID[c.card].paths.player.ready })),
    take: take && { card: take.card, key: take.key, status: take.status, choice: take.choice ?? null, level: take.level || sceneLevel(state),
      choices: CARD_BY_ID[take.card].paths.player.choices.filter(choice => choiceOk(CARD_BY_ID[take.card], choice, { placement: state.placement })),
      ...(take.ref ? { ref: take.ref } : {}), ...(take.eventId ? { eventId: take.eventId } : {}),
      ...(take.newTea ? { newTea: newTeaView(take.newTea) } : {}) },
    traces: now.traces, news: noteOf(v),
    hearsay: Object.fromEntries(RESIDENT_IDS.map(npc => [npc, hearsayFor(v, npc)]).filter(([, line]) => line)),
    knownMe: Object.fromEntries(RESIDENT_IDS.map(npc => [npc, privateOf(v, npc, state.forgotten || []).map(({ ref, card, activity, path }) => ({ ref, ...(activity ? { activity } : { card }), path }))])),
    // What changed while the player was away (W6, §10-2): the same lines for the whole visit, none on a first visit.
    ...(state.townVisit && state.townVisit.endedAt === undefined ? { meanwhile: { visit: state.townVisit.startAt, lines: meanwhileLines(v.changes, state.townVisit, now.traces) } } : {}) };
}
/** The cards and where the residents are at ms (the commands' reading of the band — the same plan the view draws). */
function cardNow(state, ms) {
  const v = state.village, out = planOf(v), at = Math.min(v.band.endMs - 1, Math.max(v.band.startMs, ms));
  const startSpots = Object.fromEntries(Object.entries(v.band.residents).map(([npc, r]) => [npc, r.lastSpot]).filter(([, spot]) => spot));
  return { cards: cardsAt(bandInput(v), out.segments, out.log, at),
    places: Object.fromEntries(RESIDENT_IDS.map(npc => [npc, placeAt(out.segments, npc, at, startSpots)])) };
}
/** Whether a card's offer may go to a screen with these capabilities: a card whose 「나와 함께」 is a life activity only to
 * a screen that draws that board (W8: caps 'tea' — an older screen would show an offer it cannot open, review F13). */
export const offerReaches = (card, caps) => !card.paths.player.activity || Array.isArray(caps) && caps.includes(ACTIVITY_BY_ID[card.paths.player.activity].cap);
/** The card a resident may offer the player now (§8-3 나와 함께): it waits for its owner, who is up, free and at the player's
 * place; its path is ready; the player did not turn it down this visit, set it aside today or ask not to be approached;
 * a card set to "less often" comes up a seeded share of its rises (§20-3). The life module spends the budget. */
function cardOfferFor(state, host) {
  const v = state.village;
  if (!v?.band || !state.day || state.resting || state.day.rest || !Number.isSafeInteger(host.nowMs) || (v.takes || []).some(t => t.open) || state.asks?.open) return null;
  if (state.day.episode?.open || state.bazaar?.episode?.open || state.life?.episode?.open || ACTIVITIES.some(a => state.activities?.[a.id]?.open)) return null;
  const now = cardNow(state, host.nowMs), held = heldNow(state), prefs = state.prefs, visitId = state.policy?.visitId;
  for (const c of now.cards) {
    const card = CARD_BY_ID[c.card], activity = `card.${card.id}`, at = now.places[card.owner];
    const crew = [card.owner, ...(card.paths.player.with || [])];
    if (c.status !== 'triggered' || card.locked || !card.paths.player.ready || !at || crew.some(npc => held[npc] || !upFor(v, npc, host.nowMs))) continue;
    // A card whose 「나와 함께」 is a life activity goes only to a screen that draws that board (W8: caps 'tea', review F13).
    if (!offerReaches(card, host.caps)) continue;
    // C4's talk is at the menu board (§12-1): its owner offers it at the cafe only.
    if (talkPlaceOf(card) && at.to !== talkPlaceOf(card)) continue;
    if (!atDayPlace(state, at.to) || prefs?.approachOptOut.includes(activity) || (prefs && visitId && todayOther(prefs, visitId, activity))) continue;
    if (prefs?.lessOften.includes(activity) && createRng(v.seed, 'offer', card.id, c.key).below(PER_MILLE) >= paramsFor().prefs.lessOftenMultiplier) continue;
    return { card: card.id, key: c.key };
  }
  return null;
}
const openTake = state => (state.village?.takes || []).find(t => t.open) ?? null;
/** One step of the living modules on a state, in place: the chain one old pulse ran. Settlement
 * (town/settle.mjs) walks unsettled time in steps of this, checking the state once around them. */
export function stepLiving(state, host) {
  ensure(state.life && host?.enabled === true, 'life-unavailable', '이 체험에서는 이웃 생활을 열 수 없어요.', 403);
  // A visit that ended in a long rest takes its version and arm with it; the next visit opens its own.
  if (host.visitEnded && state.policy) state.policy = null;
  if (host.visitEnded) endVisitScenes(state, host.visitEndedAt ?? null, host);
  advanceUse(state, host);
  runLife(state, () => advanceLife(state.life, livingContext(state, host)));
  trackVisit(state, host);
  if (state.day) runLife(state, () => advanceDay(state.day, dayContext(state, host)));
  if (state.bazaar) runLife(state, () => advanceBazaar(state.bazaar, bazaarContext(state, host)));
  markTogether(state);
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
  view.language = { version: 1, ladder: copy(state.languageLadder || initialLadder({ reading: 'L2', listening: 'L2' })), askReady: widenReady(state) };
  // The mascot's question waiting to be drawn or answered (W6, §20-3·§20-4) — old screens ignore it.
  if (state.asks?.open) view.ask = { key: state.asks.open.key, kind: state.asks.open.kind, ...(state.asks.open.family ? { family: state.asks.open.family } : {}) };
  // The tea order the screen draws (W8): its guests, what they asked (ids and values — the words are the screen's), who sits.
  if (state.activities?.['tea-order']) view.tea = ACTIVITY_BY_ID['tea-order'].view(state.activities['tea-order'], { nowMs: state.lifeHost?.lastForegroundAt ?? 0 });
  // The gathering loop (W8b): what grows where now and what is left (as leaves), the basket and the field book from the
  // ledger, the tea of the day, the cafe owner now — old screens ignore it.
  if (state.day && state.village?.band && ACTIVITY_BY_ID.gather) view.gather = gatherView(state);
  return view;
}
function gatherView(state) {
  const a = ACTIVITY_BY_ID.gather, v = state.village, ledger = state.ledger || emptyLedger();
  const nowMs = Math.min(v.band.endMs - 1, Math.max(v.band.startMs, state.lifeHost?.lastForegroundAt ?? v.band.startMs));
  const basket = [...new Set(ledger.inventory.map(line => line.itemId))].map(itemId => ({ item: itemId, qty: held(ledger, itemId) }));
  return a.view(slotOf(state, a), { ...activityCtx(state, a, { nowMs }), basket, book: Object.keys(ledger.discoveries) });
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
  state.policy ||= { ...policyFor({ villageSeed: host.villageSeed ?? 'synk-town', visitId: visitIdOf(state, host.villageSeed ?? 'synk-town'), ops: host.ops ?? DEFAULT_OPS }) };
  return state.policy;
}
/** A visit's id (W6, Fable F15): from when it began, hashed — never the clock itself — so it is the same however late the
 * world is settled (§15-3); a world from before W6 (no visit record) keeps the command revision's form. */
const visitIdOf = (state, villageSeed) => (Number.isSafeInteger(state.townVisit?.startAt) && state.townVisit.endedAt === undefined
  ? `V-${hashString(seedKey(villageSeed, 'visit', state.townVisit.startAt)).toString(36)}` : `V-${state.revision + 1}`);
function preference(change) {
  try { return change(); } catch { throw new TownError('invalid-preference', '설정을 다시 골라 주세요.'); }
}
const personalRoom = prefs => ensure(prefs.lessOften.length <= PERSONAL_MAX && prefs.approachOptOut.length <= PERSONAL_MAX
  && prefs.todayOther.items.length <= PERSONAL_MAX, 'preference-full', '설정이 너무 많아요. 수첩에서 정리해 주세요.', 409);
/** The §20 commands: the person's rights over what the town keeps, and the feedback and suggestion menus. */
const TOWN_COMMANDS = new Set(['MEMORY_FORGET', 'FEEDBACK_REMOVE', 'OBSERVED_CORRECT', 'SEEN_CLEAR', 'MEMORY_CLEAR', 'EVAL_CONSENT',
  'FEEDBACK_GIVE', 'PREF_LESS_OFTEN', 'PREF_TODAY_OTHER', 'PREF_APPROACH', 'PREF_FAMILY', 'CARD_CONFIRM',
  // W6: the mascot's question closed, the time the player usually comes turned on or off. W9: the widening offer is one of
  // the mascot's questions (an older world gains the question budget with it — Fable W9 design review 3).
  'ASK_CLOSE', 'PREF_VISIT_BANDS', 'LANGUAGE_OFFER', 'LANGUAGE_ANSWER']);
/* ── life activities (§20-7 ②, W8) ── the runtime's half: an activity's context, its commands, what it returns. */
/** The level a scene's lines show at: the reading seat's stable level — W9's ladder plugs in here (now L2, the same as
 * the one-line texts, day-mood.mjs lineLevel). */
const sceneLevel = state => state.languageLadder?.reading?.stable || 'L2';
/** What an activity may read of the world at a command: only values the server gives (§2-3). The functions read only when
 * called (W8b: who does what now, which card waits for the player, what the ledger holds). */
function activityCtx(state, a, host, extra = {}) {
  const v = state.village, b = v.band, seed = v.seed ?? host.villageSeed ?? 'synk-town', nowMs = host.nowMs;
  const segments = planOf(v).segments, paramsVer = state.policy?.paramsVer, ledger = state.ledger || emptyLedger();
  let now = null;
  const nowAt = () => (now ||= cardNow(state, nowMs));
  return { id: `T-${state.revision + 1}`, nowMs, villageSeed: seed, lifeDay: b.lifeDay, band: b.band, level: sceneLevel(state),
    paramsVer, params: paramsFor(paramsVer), location: dayPlace(state), raining: weatherAt(seed, nowMs) === 'rain',
    playerSeat: state.placement ? FT_SEATS[state.placement]?.spot ?? null : null,
    busy: (spot, fromMs, toMs) => segments.some(seg => seg.spot === spot && seg.arriveMs < toMs && seg.endMs > fromMs),
    // W8b: the clock's facts now, where the walking player stands, a resident now, a card waiting for the player, the
    // ledger's holdings (a device never states them), and what the activities tell each other (the tea of the day).
    clock: clockFacts(v, seed, nowMs), walk: state.day?.walk?.enabled ? { x: state.day.walk.x, z: state.day.walk.z } : null,
    resident: npc => residentNow(v, npc, nowAt().places[npc], nowMs),
    takeable: card => nowAt().cards.some(c => c.card === card && CARD_BY_ID[card] && mayTake(CARD_BY_ID[card], c.status)),
    holding: itemId => held(ledger, itemId), room: itemId => roomFor(ledger, itemId),
    facts: activityFacts(state, b.lifeDay), learning: host.learning,
    newTea: v.newTea && (b.startMs > v.newTea.bandStartMs || v.newTea.serveNext) ? v.newTea : null, ...extra };
}
/** The clock's facts a life activity reads (W8b — what grows): the band in my time, the season and the weather now and of
 * the Korean date, and whether it is the span after a rain stops (from that moment until the band after the one it stopped
 * in is over — §20-8 「비가 그친 뒤 처음 맞는 구간」). */
function clockFacts(v, seed, nowMs) {
  const c = clockAt({ villageSeed: seed, hostNowMs: nowMs, tz: v.tz });
  return { band: c.band, season: c.season, weatherNow: c.weatherNow, weatherDay: c.weatherDay, afterRain: afterRainAt(seed, v.tz, nowMs) };
}
/** A resident now (placeAt): awake, where, doing which archetype, walking or arrived. */
function residentNow(v, npc, at, nowMs) {
  return { up: !!at && upFor(v, npc, nowMs), x: at?.x ?? null, z: at?.z ?? null, place: at?.to ?? null, spot: at?.spot ?? null,
    archetype: at?.archetype ?? null, walking: !!at?.walking };
}
const roomFor = (ledger, itemId) => (ITEM_BY_ID[itemId]?.stackMax ?? 0) - (ledger.inventory.find(line => line.itemId === itemId && line.source === 'gather')?.qty ?? 0);
/** What each activity tells the others for a life day (W8b: the gathering loop's tea of the day — the tea order reads it). */
const activityFacts = (state, lifeDay) => Object.fromEntries(ACTIVITIES.filter(x => x.facts).map(x => [x.id, x.facts(slotOf(state, x), lifeDay)]));
/** The ledger moves with the command that moved it (§20-7 ①): a grant's cause is the event that caused it (its id hashes the
 * account — the village seed, the host's account id — the cause and the item, so a cause never pays twice); a gift moves
 * every line of the item, one event a source. A grant past a line's limit changes nothing (the command fails whole). */
function ledgerOps(state, ops, ids, marks) {
  for (const op of ops) {
    try {
      if (op.grant) {
        const { itemId, qty, cause } = op.grant;
        const out = grant(state.ledger ||= emptyLedger(), { accountId: state.village.seed ?? 'synk-town', causeId: ids[cause], itemId, qty });
        state.ledger = out.ledger;
        for (const { id, kind, ...fields } of out.events) townEvent(state, kind, { ...fields, ...marks });
      } else if (op.transfer) {
        const { itemId, to } = op.transfer;
        for (const line of (state.ledger ||= emptyLedger()).inventory.filter(row => row.itemId === itemId)) {
          const out = transfer(state.ledger, { eventId: `E-${state.townSeq + 1}`, itemId, qty: line.qty, to, source: line.source });
          state.ledger = out.ledger;
          for (const { id, kind, ...fields } of out.events) townEvent(state, kind, { ...fields, ...marks });
        }
      }
    } catch (error) {
      if (!(error instanceof LedgerError)) throw error;
      throw new TownError(error.code === 'stack-full' ? 'gather-full' : 'ledger-refused', error.code === 'stack-full' ? '바구니가 가득 찼어요.' : '바구니를 다시 확인해 주세요.', 409);
    }
  }
}
/** A card done with the player (§8-3 나와 함께): an event only those in it know (§9-2, G6), with the fields a relationship
 * is computed from (§20-1) — by CARD_CONFIRM's choice, or by the life activity the card opened (W8: C5 · R6). */
function resolveTake(state, host, take, card, choice, { inVisit = true } = {}) {
  const v = state.village, b = v.band, actors = [card.owner, ...(card.paths.player.with || [])], place = placeOfSpot(card.spot);
  Object.assign(take, { status: 'resolved', resolvedAt: host.nowMs, ref: cardRef(b.lifeDay, b.band, card.id) });
  take.eventId = townEvent(state, 'card.resolved', { ref: take.ref, card: card.id, path: 'player', public: false, actors: [...actors, 'player'], place,
    lifeDay: b.lifeDay, band: b.band, atMs: host.nowMs, ...eventMarks(inVisit ? openVisit(state, host) : state.policy, { inVisit }), ...relation(playerRelation(card, choice)) });
  learnPrivate(v, { ref: take.ref, card: card.id, path: 'player', actors: [...actors, 'player'], place });
  state.recentLifeUse = recordLifeUse(state.recentLifeUse || [], { useId: take.ref, canonicalActivityId: `card.${card.id}`, storyFamily: card.family, direct: !take.contactId });
  const c = take.contactId && state.life.contacts.find(row => row.id === take.contactId);
  if (c?.status === 'detail') c.status = 'accepted';
}
/** The player joins a card (§8-3): opening it again goes on where it paused; a take the visit ended is a new one. */
function openTakeFor(state, card, key, host, contactId = null) {
  const v = state.village, take = (v.takes || []).find(t => t.card === card.id && t.key === key && ['with', 'paused'].includes(t.status));
  if (take) Object.assign(take, { status: 'with', open: true });
  else v.takes = [...(v.takes || []), { card: card.id, key, at: host.nowMs, status: 'with', open: true, choice: null, ...(contactId ? { contactId } : {}) }]
    .slice(-paramsFor().cards.takesKept);
  const current = v.takes.find(t => t.card === card.id && t.key === key && t.open);
  current.level ||= sceneLevel(state);
  if (card.id === 'C4') {
    current.newTea ||= startNewTea(current.level);
    current.newTea.dialogue.stopped = false;
  }
}
/** C4's conversation closed by the player (CARD_CONFIRM · CARD_CLOSE — always a command in a visit): the ladder reads its
 * habit summary, and the scene's close names the visit's version and arm (§20-6 「장면 닫힘」, Fable W9 design review 6). */
function closeNewTea(state, take, host, stopped = false) {
  take.newTea.dialogue.stopped = stopped;
  const scene = closeDialogue(take.newTea.dialogue);
  if (state.languageLadder) state.languageLadder = closeScene({ ladder: state.languageLadder, channel: scene.channel, level: scene.level, outcome: scene.outcome, now: host.nowMs });
  townEvent(state, 'dialogue.closed', { ...scene, atMs: host.nowMs, ...eventMarks(openVisit(state, host), { inVisit: true }) });
}
/** What an activity returned, written as the world's: its events (the id, command revision and the visit's marks are the
 * runtime's), the result it reached — the card that opened it resolves, or the day's one thing done together — and the
 * take of a card's order that closed (review F5). */
function afterActivity(state, a, out, host, { inVisit }) {
  if (out.learning?.length) host.learningFacts?.push(...out.learning);
  const marks = eventMarks(inVisit ? openVisit(state, host) : state.policy, { inVisit }), v = state.village;
  if (out.scene && state.languageLadder) {
    state.languageLadder = closeScene({ ladder: state.languageLadder, channel: out.scene.channel, level: out.scene.level, outcome: out.scene.outcome, now: host.nowMs });
    townEvent(state, 'dialogue.closed', { ...out.scene, atMs: host.nowMs, ...marks });
  }
  const ids = out.events.map(({ kind, ...fields }) => townEvent(state, kind, { ...fields, ...marks }));
  // W8b (§20-7 ①·②): what an activity asks of the world besides its own slot — the ledger, a thing worn less from now (a
  // time-ordered input of the band, like a take), a card it settles with the player, the life day's one thing done with a
  // resident, and a use of the activity (its habit).
  if (out.ledger?.length) ledgerOps(state, out.ledger, ids, marks);
  if (out.gives?.length) v.gives = [...(v.gives || []), ...out.gives.map(g => ({ atMs: host.nowMs, object: g.object, relief: Math.min(999, g.relief), npc: g.npc }))].slice(-GIVES_MAX);
  if (out.resolve) settleWith(state, a, out.resolve, host, { inVisit });
  if (out.together) togetherWith(state, a, out.together, host, marks);
  if (out.use) state.recentLifeUse = recordLifeUse(state.recentLifeUse || [], { useId: `${v.band.lifeDay}.${a.id}`, canonicalActivityId: a.canonicalActivityId, storyFamily: a.storyFamily, direct: true });
  if (out.completed?.card) {
    const take = (v.takes || []).find(t => t.card === out.completed.card.id && t.key === out.completed.card.key && ['with', 'paused'].includes(t.status));
    if (take && out.completed.served > 0) resolveTake(state, host, take, CARD_BY_ID[take.card], null, { inVisit });
  } else if (out.completed?.served > 0 && a.together) {
    const slot = state.activities[a.id], b = v.band;
    if (!(slot.day?.lifeDay === b.lifeDay && slot.day.together)) {
      // The day's one thing done with the cafe owner (§11-6): only she knows it (G6), the notebook shows it, she can forget it.
      const actors = [...a.reserves, 'player'], place = placeOfSpot(a.places[0]), ref = `${b.lifeDay}.${a.id}`;
      const id = townEvent(state, a.together.kind, { order: out.completed.id, public: false, actors, place, lifeDay: b.lifeDay, band: b.band, atMs: host.nowMs, ...marks,
        ...relation({ participantRole: a.together.roles, help: { by: 'player', to: [...a.reserves] }, deliveredSegmentIds: [], canonicalActivityId: a.canonicalActivityId, storyFamily: a.storyFamily }) });
      slot.day = { ...(slot.day?.lifeDay === b.lifeDay ? slot.day : { lifeDay: b.lifeDay, requests: 0 }), together: id };
      learnPrivate(v, { ref, activity: a.id, path: 'player', actors, place });
      state.recentLifeUse = recordLifeUse(state.recentLifeUse || [], { useId: ref, canonicalActivityId: a.canonicalActivityId, storyFamily: a.storyFamily, direct: true });
    }
  }
  if (out.closed?.card) {
    const take = (v.takes || []).find(t => t.card === out.closed.card.id && t.key === out.closed.card.key && t.open);
    if (take) { take.open = false; if (take.status === 'with') take.status = 'paused'; }
  }
}
/** A card an activity settles with the player while it waits for the player (W8b: leaves into the jar settle C3 —
 * deliver): the take opens, takes the activity's choice (the card's trace — the tea the leaves make), resolves and closes in
 * the one command, so no resident is held for it; the plan knows it as a resolved take (takeCovers). Its event is the life
 * day's thing done together for the activity. */
function settleWith(state, a, r, host, { inVisit }) {
  const card = CARD_BY_ID[r.card], waiting = card && cardNow(state, host.nowMs).cards.find(c => c.card === card.id && mayTake(card, c.status));
  if (!waiting) return;
  openTakeFor(state, card, waiting.key, host);
  const take = state.village.takes.find(t => t.card === card.id && t.key === waiting.key && t.open);
  take.choice = r.choice;
  resolveTake(state, host, take, card, 'give', { inVisit });
  take.open = false;
  const slot = state.activities[a.id];
  if (!slot.day?.[r.day]) slot.day = { ...slot.day, [r.day]: take.eventId };
}
/** The life day's one thing done with a resident by an activity that holds no one (W8b: a gift, picking beside her): its
 * event (only those in it know — G6), the resident's knowing it privately (「잊어 주세요」), its id in the activity's day. */
function togetherWith(state, a, t, host, marks) {
  const v = state.village, b = v.band, slot = state.activities[a.id];
  if (slot.day?.[t.day]) return;
  const id = townEvent(state, t.kind, { public: false, actors: [...t.actors], place: t.place, lifeDay: b.lifeDay, band: b.band, atMs: host.nowMs, ...marks,
    ...relation({ participantRole: t.roles, help: t.help, deliveredSegmentIds: [], canonicalActivityId: a.canonicalActivityId, storyFamily: a.storyFamily }) });
  slot.day = { ...slot.day, [t.day]: id };
  learnPrivate(v, { ref: `${b.lifeDay}.${a.id}`, activity: a.id, path: 'player', actors: [...t.actors], place: t.place });
}
/** Runs an activity's confirm rule and writes what it returns. */
function runActivity(state, a, type, payload, host, extra = {}) {
  state.activities ||= initialActivities();
  const out = a.apply(slotOf(state, a), { type, payload }, activityCtx(state, a, host, extra));
  if (out.error) ensure(false, ...out.error);
  state.activities[a.id] = out.slot;
  afterActivity(state, a, out, host, { inVisit: true });
}
/** A card whose 「나와 함께」 is a life activity opens it bound to the take (W8: C5 the order, R6 the one-cup board); opening
 * the card again goes on with the board it already has (review GA3). */
function openActivityFor(state, card, key, host) {
  const a = ACTIVITY_BY_ID[card.paths.player.activity], s = slotOf(state, a).open;
  if (s?.card?.id === card.id && s.card.key === key) return;
  runActivity(state, a, a.opens, {}, host, { card: { id: card.id, key, cup: card.paths.player.cup, owner: card.owner } });
}
/** A card's take closing closes the activity it opened (its guests are served by the owner). */
function closeActivityFor(state, take, host) {
  const a = ACTIVITY_BY_ID[CARD_BY_ID[take.card].paths.player.activity], s = slotOf(state, a).open;
  if (s?.card?.id === take.card && s.card.key === take.key) runActivity(state, a, a.closes, {}, host);
}
/** A life activity's own command (W8): the runtime's checks — the place, who must be up and free, what else the cafe is
 * doing — then the activity's confirm rule. Closing is always open (base); serving happens where the guest is (review F15). */
function commandActivity(state, a, type, p, host) {
  const v = state.village;
  ensure(state.day && v?.band && host.enabled === true && host.surface === 'day' && Number.isSafeInteger(host.nowMs), 'activity-unavailable', '지금은 이 생활을 열 수 없어요.', 403);
  state.activities ||= initialActivities();
  const s = slotOf(state, a).open;
  let extra = {};
  if (type === a.opens) {
    ensure(p.card === undefined && p.key === undefined, 'invalid-command', '다시 눌러 주세요.');
    ensure(atDayPlace(state, 'cafe'), 'day-walk-too-far', '찻집 가까이 가서 주문을 받아 주세요.', 409);
    const e = state.day.episode;
    ensure(!bazaarOwns(state) && !state.pendingUse && !(e?.open && e.location === 'cafe' && e.stage !== 'invalid') && !state.life?.episode?.open,
      'tea-cafe-busy', '찻집에서 하던 생활을 먼저 마쳐 주세요.', 409);
    // The order before, done and opened by a card, lets its take go as the next opens (review F5).
    if (s?.card && s.completed !== null) for (const t of v.takes || []) if (t.card === s.card.id && t.key === s.card.key) t.open = false;
    ensure(!(v.takes || []).some(t => t.open), 'card-busy', '하던 생활을 먼저 닫아 주세요.', 409);
    const held = heldNow(state)['cafe-owner'];
    ensure(!held || held.by.startsWith('tea:'), 'card-owner-busy', '찻집 주인이 하던 장면을 마친 뒤 함께할 수 있어요.', 409);
    // A rush the cafe owner is in (C5) is this order — one path, one event (review F16).
    const rush = cardNow(state, host.nowMs).cards.find(c => CARD_BY_ID[c.card].paths.player.activity === a.id && CARD_BY_ID[c.card].paths.player.cup === 'order'
      && mayTake(CARD_BY_ID[c.card], c.status));
    if (rush) {
      const card = CARD_BY_ID[rush.card];
      openTakeFor(state, card, rush.key, host);
      extra = { card: { id: card.id, key: rush.key, cup: card.paths.player.cup, owner: card.owner } };
    }
    state.day.rest = false; state.resting = false;
  } else if (type !== a.closes) {
    const place = s?.kind === 'one-cup' ? placeOfSpot(holdSpotOf(CARD_BY_ID[s.card.id])) : 'cafe';
    ensure(!s || atDayPlace(state, place), 'day-walk-too-far', place === 'cafe' ? '찻집 가까이 가서 내 주세요.' : '잔을 들고 가까이 가서 드려 주세요.', 409);
    extra = { ownerPlace: place };
  }
  runActivity(state, a, type, p, host, extra);
}

/** The small need cards with the player (§8-3 나와 함께, W5) and the greeting that tells the player what a resident knows (§9-4). */
const CARD_COMMANDS = new Set(['CARD_OPEN', 'CARD_CHOOSE', 'CARD_CONFIRM', 'CARD_HELP', 'CARD_CLOSE', 'CARD_DECLINE', 'CARD_DEFER', 'GREET']);
function commandCard(state, type, p, host) {
  const v = state.village;
  ensure(state.day && state.life && v?.band && host.enabled === true && Number.isSafeInteger(host.nowMs), 'card-unavailable', '지금은 이 생활을 열 수 없어요.', 403);
  const label = npc => RESIDENT_BY_ID[npc].label;
  switch (type) {
    case 'CARD_OPEN': {
      const card = CARD_BY_ID[p.card];
      ensure(card && typeof p.key === 'string' && ['direct', 'contact'].includes(p.source), 'invalid-card', '생활을 다시 골라 주세요.');
      const now = cardNow(state, host.nowMs), status = now.cards.find(c => c.card === card.id && c.key === p.key)?.status;
      ensure(mayTake(card, status), 'card-not-waiting', '그 일은 지금 함께할 수 없어요. 주인이 하는 일을 지켜봐 주세요.', 409);
      ensure(upFor(v, card.owner, host.nowMs), 'resident-asleep', `${label(card.owner)}은 지금 자고 있어요. 아침에 다시 만나요.`, 409);
      ensure(!(v.takes || []).some(t => t.open && !(t.card === card.id && t.key === p.key)), 'card-busy', '하던 생활을 먼저 닫아 주세요.', 409);
      const by = `card:${card.id}:${p.key}`, heldAll = heldNow(state);
      // Everyone the path takes is up and free (the owner, and C1's neighbour beside it — review GA3).
      for (const npc of [card.owner, ...(card.paths.player.with || [])]) {
        ensure(upFor(v, npc, host.nowMs), 'resident-asleep', `${label(npc)}은 지금 자고 있어요. 아침에 다시 만나요.`, 409);
        ensure(!heldAll[npc] || heldAll[npc].by === by, 'card-owner-busy', `${label(npc)}이 하던 장면을 마친 뒤 함께할 수 있어요.`, 409);
      }
      ensure(now.places[card.owner] && atDayPlace(state, now.places[card.owner].to), 'card-too-far', `${label(card.owner)} 가까이 가서 말을 걸어 주세요.`, 409);
      // C4's talk is at the menu board (§12-1): the cafe owner is talked to about it at the cafe (Fable F6).
      ensure(!talkPlaceOf(card) || now.places[card.owner].to === talkPlaceOf(card), 'card-too-far', `${label(card.owner)}에게는 찻집에서 말을 걸어 주세요.`, 409);
      let contactId = null;
      if (p.source === 'contact') {
        const c = cardContactFor(state.life, p.contactId, host);
        ensure(c.card === card.id && c.key === p.key, 'stale-life-contact', '이 제안은 현재 화면에서 다시 확인해 주세요.', 409);
        c.status = 'detail'; contactId = c.id;
      } else for (const c of state.life.contacts) if (c.contactKey === by && ['issued', 'delivered', 'detail'].includes(c.status)) c.status = 'cancelled';
      openTakeFor(state, card, p.key, host, contactId);
      // A card whose 「나와 함께」 is a life activity opens it bound to the take (W8: C5 the order, R6 the one-cup board).
      if (card.paths.player.activity) openActivityFor(state, card, p.key, host);
      state.day.rest = false; state.resting = false;
      break;
    }
    case 'CARD_CHOOSE': {
      const take = openTake(state), card = take && CARD_BY_ID[take.card];
      ensure(take?.status === 'with', 'card-not-open', '함께하던 생활을 다시 열어 주세요.', 409);
      ensure(card.id === 'C4' ? take.newTea && newTeaView(take.newTea).choices.some(c => c.id === p.choice)
        : choiceOk(card, p.choice, { placement: state.placement }), 'invalid-card-choice', '고를 수 있는 것 가운데 골라 주세요.');
      take.choice = p.choice; break;
    }
    case 'CARD_HELP': {
      const take = openTake(state);
      ensure(take?.card === 'C4' && take.status === 'with' && take.newTea, 'card-not-open', '함께하던 생활을 다시 열어 주세요.', 409);
      ensure(['repeat', 'slower', 'meaning'].includes(p.kind), 'invalid-card-help', '도움을 다시 골라 주세요.');
      take.newTea = helpNewTea(take.newTea, p.kind); break;
    }
    case 'CARD_CONFIRM': {
      const take = openTake(state), card = take && CARD_BY_ID[take.card];
      ensure(take?.status === 'with' && take.choice, 'card-choice-first', '먼저 하나 골라 주세요.', 409);
      if (card.id === 'C4') {
        take.newTea = chooseNewTea(take.newTea, take.choice); take.choice = null;
        if (!take.newTea.done) break;
        take.choice = `sweet-${take.newTea.honey}`;
        resolveTake(state, host, take, card, take.choice);
        v.newTea = { sweet: take.newTea.honey, bandStartMs: v.band.startMs, serveNext: take.newTea.final === 'serve', ref: take.ref };
        closeNewTea(state, take, host); break;
      }
      resolveTake(state, host, take, card, take.choice);
      break;
    }
    case 'CARD_CLOSE': {
      // Closed before it was done: that card alone waits as "하던 생활" for the player (§8-3 paused); a life activity the
      // card opened closes with it, the owner serving who is left (W8).
      const take = openTake(state);
      if (take && CARD_BY_ID[take.card].paths.player.activity) closeActivityFor(state, take, host);
      if (take?.card === 'C4' && take.status === 'with' && take.newTea) closeNewTea(state, take, host, true);
      if (take) { take.open = false; if (take.status === 'with') take.status = 'paused'; }
      break;
    }
    case 'CARD_DECLINE': case 'CARD_DEFER': {
      const c = cardContactFor(state.life, p.contactId, host);
      c.status = type === 'CARD_DECLINE' ? 'declined' : 'deferred';
      if (type === 'CARD_DECLINE') state.life.declinedCards = [...new Set([...(state.life.declinedCards || []), c.card])];
      // Turned down or put off, the card is its owner's again at its next decision (§15-2): an opened take from it ends.
      for (const take of v.takes || []) if (take.card === c.card && take.key === c.key && ['with', 'paused'].includes(take.status))
        Object.assign(take, { status: 'ended', open: false, endAt: Math.max(take.at, host.nowMs) });
      break;
    }
    case 'GREET': {
      // A greeting tells the player one thing the resident knows (§9-4) — once: it never spends the first-word budget.
      ensure(Object.hasOwn(RESIDENT_BY_ID, p.npc) && typeof p.ref === 'string', 'invalid-greet', '인사할 이웃을 다시 골라 주세요.');
      ensure(hearsayFor(v, p.npc)?.ref === p.ref, 'stale-greet', '이웃의 이야기가 바뀌었어요. 다시 말을 걸어 주세요.', 409);
      tell(v, p.npc, p.ref); break;
    }
  }
}

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
  const learning = [];
  host = { ...host, learningFacts: learning };
  if (!state.languageLadder) state.languageLadder = initialLadder(host.languagePlacement || { reading: 'L2', listening: 'L2' }, host.nowMs || 0);
  else placeLanguage(state, host);
  const p = command.payload;
  if (TOWN_COMMANDS.has(command.type)) for (const [key, make] of Object.entries(TOWN_FIELDS)) if (!Object.hasOwn(state, key)) state[key] = make();
  // A command from a window that holds the town is play: it opens the visit when no settlement step has yet (W6 — the
  // first command can come before any play time), from the same start the lease saw, so it is the same visit either way.
  if (typeof host.surfaceId === 'string' && host.surfaceId && Object.hasOwn(state, 'townVisit')) { trackVisit(state, host); placeVisit(state); }
  const ftMutation = ['CHOOSE', 'NEXT', 'COLOR', 'CRAFT', 'PREVIEW_SLOT', 'PLACE', 'CANCEL', 'REARRANGE', 'REMOVE', 'SIT',
    'SIGN_START', 'SIGN_NEXT', 'SIGN_PICTURE', 'SIGN_PREVIEW', 'SIGN_PLACE', 'SIGN_CANCEL', 'SIGN_REMOVE'].includes(command.type);
  if (ftMutation && (host.surface === 'day' || state.day?.walk?.enabled)) ensure(atDayPlace(state, 'cafe'),
    'day-place-conflict', '찻집에서 현재 자리를 확인해 주세요.', 409);
  if (ftMutation) ensure(!bazaarOwns(state), 'bazaar-cafe-busy', '손님 응대를 닫은 뒤 자리를 바꿔 주세요.', 409);
  if (ftMutation) ensure(!teaOwns(state), 'tea-cafe-busy', '주문을 닫은 뒤 자리를 바꿔 주세요.', 409);
  const dayEpisode = state.day?.episode;
  if (ftMutation && dayEpisode?.open && dayEpisode.location === state.day.location && dayEpisode.kind === 'tea' && dayEpisode.stage !== 'invalid')
    ensure(false, 'day-cafe-busy', '함께 하던 생활을 닫은 뒤 자리를 바꿔 주세요.', 409);
  if (state.pendingUse && ['SIGN_START', 'SIGN_REMOVE'].includes(command.type))
    ensure(false, 'use-in-progress', '손님이 자리를 확인한 뒤 안내판을 바꿔 주세요.', 409);
  const inPhase = (...phases) => ensure(phases.includes(state.phase), 'wrong-phase', '지금 할 수 있는 일을 골라요.');
  switch (command.type) {
    case 'LANGUAGE_SET':
      ensure(['reading', 'listening'].includes(p.channel) && ['easier', 'broader', 'always-easy', 'auto'].includes(p.choice), 'language-choice', '말의 속도를 다시 골라 주세요.', 400);
      state.languageLadder = chooseLevel(state.languageLadder, p.channel, p.choice, host.nowMs || 0);
      break;
    case 'LANGUAGE_OFFER':
      // At a scene's end (offerWiden): the format names the ended scene's response format (single-choice · cup-compose).
      ensure(!languageScene(state) && CHANNELS.includes(p.channel), 'language-busy', '장면을 마친 뒤 골라 주세요.');
      ensure(p.format === undefined || ['single-choice', 'cup-compose'].includes(p.format), 'language-choice', '말의 속도를 다시 골라 주세요.');
      ensure(offerWiden(state, host, p), 'language-no-offer', '지금 말로 이어 가요.');
      break;
    case 'LANGUAGE_ANSWER': {
      ensure(!languageScene(state) && CHANNELS.includes(p.channel) && ['accepted', 'declined'].includes(p.choice), 'language-choice', '장면을 마친 뒤 골라 주세요.');
      // The answer closes the widening question standing for that seat (W9): an answer before the drawn report still counts it,
      // like the taste answer. One the visit already dropped, or another window answered, is the town's to read again (409 —
      // Fable W9 design review 4).
      const open = state.asks.open;
      ensure(open?.kind === 'widen' && open.key.startsWith(`widen:${p.channel}:`), 'language-no-offer', '지금 말로 이어 가요.', 409);
      askDrawn(state, open.key);
      try { state.languageLadder = answerOffer(state.languageLadder, p.channel, p.choice, host.nowMs || 0); }
      catch { ensure(false, 'language-no-offer', '지금 말로 이어 가요.', 409); }
      const { open: _answered, ...rest } = state.asks; state.asks = rest;
      break;
    }
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
      for (const key of ['prefs', 'asks', 'recentLifeUse', 'consents', 'visitBands', 'townVisit']) if (Object.hasOwn(old, key)) state[key] = old[key];
      state.townSeq = old.townSeq ?? 0;
      state.commands = old.commands; break;
    }
    // The person's own rights over what the town keeps (scope rights, §20-5): the notebook and the
    // account screen use this one command path, so each change leaves its receipt, revision and event.
    case 'MEMORY_FORGET': {
      // A thing done together is a Trail fact or, from W5, a card done with the player that the resident knows (review F11).
      // W8: and the day a life activity was done with the player (<life day>.<activity> — 「찻집 일을 같이 했다」).
      const card = typeof p.eventId === 'string' && (CARD_REF.test(p.eventId) || ACTIVITY_MEMORY.test(p.eventId)) && !!state.village && privateOf(state.village, p.npc).some(e => e.ref === p.eventId);
      ensure(card || forgettable(trailOf(state), p.npc, p.eventId), 'memory-unavailable', '그 기억을 찾지 못했어요. 수첩을 다시 열어 주세요.', 409);
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
      state.recentLifeUse = next.uses; state.prefs = next.prefs;
      // A taste question waiting on that family goes with the uses behind it (GPT A4).
      if (state.asks.open?.kind === 'taste' && state.asks.open.family === p.family) { const { open, ...rest } = state.asks; state.asks = rest; }
      break;
    }
    // The seen ledger is the store's own branch; this command is how the store is told to empty it.
    case 'SEEN_CLEAR': break;
    case 'MEMORY_CLEAR': {
      const next = clearPersonal({ prefs: state.prefs, uses: state.recentLifeUse });
      state.prefs = next.prefs; state.recentLifeUse = next.uses;
      // The ring of the time the player usually comes empties too; turning it off stays the player's (§20-5, W6). A taste
      // question waiting on the observation goes with it (GPT A4).
      state.visitBands = clearVisitBands(state.visitBands);
      if (state.asks.open?.kind === 'taste') { const { open, ...rest } = state.asks; state.asks = rest; }
      break;
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
      // Until the host turns the evaluation signals on (the privacy notice first — W6), nobody can turn them on.
      ensure(p.state !== 'granted' || host.evalSignals === true, 'eval-unavailable', '아직 쓸 수 없어요.', 403);
      townEvent(state, 'consent.changed', { consent: 'evalSignals', ...state.consents.evalSignals });
      if (state.asks.open?.kind === 'consent') { askDrawn(state, state.asks.open.key); const { open, ...rest } = state.asks; state.asks = rest; }
      break;
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
    case 'PREF_FAMILY': {
      // The answer to the mascot's taste question closes it (§20-3, W6).
      // An answer before the drawn report still counts the question (GPT A3) — counted first, so the answer has the last word
      // (W8 r3 GA2: counting it after the answer wrote 「요즘 자주 한 생활」 back over the 「아니요」 or 「네」).
      const asked = state.asks.open?.kind === 'taste' && state.asks.open.family === p.family;
      if (asked) askDrawn(state, state.asks.open.key);
      state.prefs = preference(() => answerFamily(state.prefs, p.family, p.answer));
      if (asked) { const { open, ...rest } = state.asks; state.asks = rest; }
      break;
    }
    // The mascot's question closed unanswered (§20-3·§20-4, W6): a person closed what they saw, so it counts as drawn if the
    // boundary had not said so yet (Fable F3), then it goes. A question already gone changes nothing.
    case 'ASK_CLOSE':
      if (state.asks.open?.key === p.key) { askDrawn(state, p.key); const { open, ...rest } = state.asks; state.asks = rest; }
      break;
    case 'PREF_VISIT_BANDS':
      ensure(typeof p.on === 'boolean', 'invalid-preference', '설정을 다시 골라 주세요.');
      state.visitBands = setVisitBands(state.visitBands, p.on); break;
    default: {
      if (CARD_COMMANDS.has(command.type)) { commandCard(state, command.type, p, host); break; }
      const asleep = sleepersFor(state, command, p, host.nowMs);
      ensure(!asleep.length, 'resident-asleep', `${asleep.map(npc => RESIDENT_BY_ID[npc].label).join('과 ')}은 지금 자고 있어요. 아침에 다시 만나요.`, 409);
      const activity = activityOfCommand(command.type);
      if (activity) { commandActivity(state, activity, command.type, p, host); break; }
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
        if (['DAY_START', 'DAY_RESUME', 'DAY_RETRY'].includes(command.type)) ensure(!bazaarOwns(state) && !teaOwns(state)
          && !(command.type === 'DAY_RESUME' && state.bazaar?.episode?.open && state.day.episode?.location === 'cafe'),
          'bazaar-cafe-busy', '손님과 하던 생활을 닫은 뒤 이어가 주세요.', 409);
        if (command.type === 'DAY_JOB_START') ensure(!(bazaarOwns(state) && state.bazaar.episode.kind === 'pictureMenu'),
          'day-workshop-busy', '공방 주인이 메뉴판 준비를 마친 뒤 부탁해 주세요.', 409);
        runLife(state, () => commandDay(state.day, command.type, p, dayContext(state, host)));
        break;
      }
      ensure(command.type.startsWith('LIFE_') && state.life && host.enabled === true,
        'unknown-command', '지금 할 수 있는 일을 골라요.');
      // A card's offer is answered where its owner stands (W5b): its delivery receipt is not the cafe's own.
      const cardReceipt = command.type === 'LIFE_ACK' && typeof p.contactId === 'string' && state.life.contacts.some(c => c.id === p.contactId && c.card !== undefined);
      if (state.day?.walk?.enabled && !['LIFE_CLOSE', 'LIFE_PREFERENCE'].includes(command.type) && !cardReceipt)
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
  return { state, duplicate: false, learning };
}
