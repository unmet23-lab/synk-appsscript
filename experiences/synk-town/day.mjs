/** First-day fixture: authored H00, GOAL/PAIR, LS01 interaction slices and RETURN01.
 * Core commits these mutations and their Trail fact descriptors atomically.
 * The host supplies foreground elapsed time and wall time; browsers never advance jobs.
 * There is no new approach budget, economy, friendship score or language assessment.
 */
import { WALK_SPAWNS, WALK_SPEED, isWalkable, nearbyPlace, movePoint, walkSegments } from './walk.mjs';
export class DayError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const ensure = (ok, code, message, status) => { if (!ok) throw new DayError(code, message, status); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const ids = ['cafe-owner', 'workshop-owner', 'researcher'];
const places = ['home', 'cafe', 'workshop', 'greenhouse'];
const roles = ['planner', 'observer', 'delegated'];
const modes = ['demo', 'cooperate', 'plan'];
const kinds = ['tea', 'coordination', 'help'];
const stages = ['role', 'choice', 'demonstration', 'awaitContinue', 'preview', 'rehearsal', 'awaitConfirm', 'executing', 'awaitTea', 'awaitFinish', 'explaining', 'result', 'invalid'];
const choices = { tea: ['sequence', 'separate'], coordination: ['rest', 'separate', 'silent', 'delegate'], help: ['hold', 'prepare', 'alone'] };
export const DAY_LOCATIONS = Object.freeze({ home: { x: -6, z: 0, label: '집' }, cafe: { x: 0, z: 0, label: '찻집' }, workshop: { x: 6, z: 0, label: '공방' }, greenhouse: { x: 0, z: -6, label: '온실' } });
const seats = ['garden', 'garden-right', 'eaves-left', 'eaves-right'];
const enumValue = (value, values) => values.includes(value);
const key = value => typeof value === 'string' && /^DAY:[a-zA-Z0-9_.:-]{1,130}$/.test(value);
const action = (type, label, payload = {}, primary = false) => ({ type, label, payload, primary });
const members = kind => kind === 'tea' ? ['cafe-owner', 'researcher'] : kind === 'coordination' ? ['workshop-owner', 'researcher'] : ['workshop-owner'];
const labelPlace = place => DAY_LOCATIONS[place].label;
const validLanguageBasis = (value, mode) => value === undefined || value && value.mode === mode
  && ['default', 'explicit', 'accepted-proposal'].includes(value.source) && integer(value.revision)
  && (value.source === 'accepted-proposal' ? value.basis && typeof value.basis === 'object' : value.basis === null);

export function initialDay() {
  return { schema: 1, location: 'home', visit: 1, hasGoneOut: false, atHomeAfterOuting: false,
    home: { slot: 'window', previewSlot: null, exitTarget: null, revision: 0 }, support: 'demo', sequence: 0, uMs: 0,
    hostNowMs: 0, environment: { placement: null, seatRevision: 0, ftReady: false },
    routine: newRoutine(1), emitted: [], episode: null, history: [], roleEvidence: [],
    agreement: null, job: null, rest: false };
}
function newRoutine(visit) { return { elapsedMs: 0, visit, cafeMs: 0, workshopMs: 0, researcherMs: 0, pairMs: 0, returnMs: 0, habitResultId: null, habitMs: 0 }; }

function assertTarget(t) {
  return t && enumValue(t.kind, ['base', 'seat']) && integer(t.seatRevision)
    && (t.placement === null || seats.includes(t.placement)) && (t.kind !== 'seat' || seats.includes(t.placement));
}
export function assertDay(day) {
  const bad = () => new DayError('invalid-day-save', '첫 하루의 생활 기록을 확인할 수 없어요.', 503);
  if (!day || day.schema !== 1 || !places.includes(day.location) || !integer(day.visit) || day.visit < 1
    || !['hasGoneOut', 'atHomeAfterOuting', 'rest'].every(k => typeof day[k] === 'boolean')
    || !day.home || !['window', 'table'].includes(day.home.slot) || ![null, 'window', 'table'].includes(day.home.previewSlot)
    || ![null, 'cafe', 'workshop', 'greenhouse'].includes(day.home.exitTarget)
    || !integer(day.home.revision) || !modes.includes(day.support) || !integer(day.sequence) || !integer(day.uMs) || !integer(day.hostNowMs)
    || !day.environment || !(day.environment.placement === null || seats.includes(day.environment.placement))
    || !integer(day.environment.seatRevision) || typeof day.environment.ftReady !== 'boolean'
    || !day.routine || !integer(day.routine.elapsedMs) || day.routine.elapsedMs > 14000 || day.routine.visit !== day.visit
    || !['cafeMs', 'workshopMs', 'researcherMs', 'pairMs', 'returnMs', 'habitMs'].every(k => integer(day.routine[k]))
    || day.routine.cafeMs > 3000 || day.routine.workshopMs > 8000 || day.routine.researcherMs > 3000 || day.routine.pairMs > 4000 || day.routine.returnMs > 2000 || day.routine.habitMs > 4000
    || !(day.routine.habitResultId === null || key(day.routine.habitResultId))
    || !Array.isArray(day.emitted) || !day.emitted.every(key) || new Set(day.emitted).size !== day.emitted.length
    || !Array.isArray(day.history) || !Array.isArray(day.roleEvidence)) throw bad();
  if (day.walk !== undefined && (!day.walk || typeof day.walk.enabled !== 'boolean' || !isWalkable(day.walk)
    || !Number.isFinite(day.walk.headingX) || !Number.isFinite(day.walk.headingZ)
    || Math.abs(day.walk.headingX) > 1 || Math.abs(day.walk.headingZ) > 1)) throw bad();
  const resultIds = new Set();
  for (const h of day.history) {
    if (!key(h.resultId) || resultIds.has(h.resultId) || !kinds.includes(h.kind) || !roles.includes(h.role)
      || !choices[h.kind].includes(h.choice) || !modes.includes(h.support) || !assertTarget(h.target) || !places.includes(h.location)
      || !integer(h.visit) || h.visit > day.visit || !integer(h.completedU) || h.completedU > day.uMs
      || !Array.isArray(h.knownBy) || h.knownBy.join(',') !== members(h.kind).join(',')
      || !(h.observedU === null || integer(h.observedU) && h.observedU >= h.completedU && h.observedU <= day.uMs)
      || typeof h.contribution !== 'boolean' || h.direction !== undefined && !['near', 'clear'].includes(h.direction)) throw bad();
    resultIds.add(h.resultId);
  }
  for (const evidence of day.roleEvidence) {
    if (!evidence || !resultIds.has(evidence.resultId) || !roles.includes(evidence.role) || !kinds.includes(evidence.kind)) throw bad();
    const h = day.history.find(row => row.resultId === evidence.resultId);
    if (h.role !== evidence.role || h.kind !== evidence.kind || h.role === 'observer') throw bad();
  }
  if (new Set(day.roleEvidence.map(e => e.resultId)).size !== day.roleEvidence.length) throw bad();
  const e = day.episode;
  if (e && (!key(e.id) || !kinds.includes(e.kind) || !stages.includes(e.stage) || !places.includes(e.location)
    || ![null, ...roles].includes(e.role) || ![null, ...choices[e.kind]].includes(e.choice) || !modes.includes(e.support)
    || !integer(e.elapsedMs) || e.elapsedMs > 4000 || !integer(e.part) || e.part > 1
    || !assertTarget(e.target) || typeof e.open !== 'boolean' || typeof e.explanationDone !== 'boolean' || !['near', 'clear'].includes(e.direction)
    || e.languageSupport !== undefined && !['plain', 'stepwise'].includes(e.languageSupport)
    || !validLanguageBasis(e.languageSupportBasis, e.languageSupport)
    || e.guideStep !== undefined && ![null, 0, 1].includes(e.guideStep)
    || !(e.resultId === null || resultIds.has(e.resultId))
    || ['result', 'explaining'].includes(e.stage) && !e.resultId || e.resultId !== null && !['result', 'explaining'].includes(e.stage)
    || !['role', 'invalid'].includes(e.stage) && !e.role
    || !['role', 'choice', 'invalid'].includes(e.stage) && !e.choice)) throw bad();
  if (day.agreement && (!resultIds.has(day.agreement.resultId) || !assertTarget(day.agreement.target)
    || !places.includes(day.agreement.location) || !choices.coordination.includes(day.agreement.choice) || !['planner', 'delegated'].includes(day.agreement.role))) throw bad();
  const j = day.job;
  if (j && (!key(j.id) || !['preparing', 'ready', 'collected'].includes(j.status) || !integer(j.startedAt)
    || !integer(j.readyAt) || j.readyAt !== j.startedAt + 30000 || j.startedAt > day.hostNowMs
    || !(j.collectedAt === null || integer(j.collectedAt) && j.collectedAt >= j.readyAt && j.collectedAt <= day.hostNowMs)
    || (j.status === 'collected') !== (j.collectedAt !== null))) throw bad();
  return day;
}

function contextFor(ctx) {
  ensure(ctx && integer(ctx.nowMs) && integer(ctx.elapsedMs ?? 0) && typeof ctx.canRun === 'boolean'
    && integer(ctx.seatRevision) && (ctx.placement === null || seats.includes(ctx.placement)) && typeof ctx.ftReady === 'boolean',
  'invalid-day-context', '현재 마을 상태를 다시 확인해 주세요.', 503);
  return ctx;
}
function emit(day, facts, factType, sourceKey, knownBy, causes = []) {
  if (day.emitted.includes(sourceKey)) return;
  day.emitted.push(sourceKey); facts.push({ factType, sourceKey, knownBy: [...knownBy], causes: [...causes] });
}
function source(day, suffix) { return `DAY:${++day.sequence}:${suffix}`; }
function targetFor(ctx, preferSeat = true) {
  return { kind: preferSeat && ctx.ftReady && ctx.placement ? 'seat' : 'base', placement: preferSeat && ctx.ftReady ? ctx.placement : null, seatRevision: ctx.seatRevision };
}
function targetValid(target, ctx) {
  return target.kind === 'base' || ctx.ftReady && ctx.placement === target.placement && ctx.seatRevision === target.seatRevision;
}
function reconcile(day, ctx, facts) {
  day.hostNowMs = Math.max(day.hostNowMs, ctx.nowMs);
  day.environment = { placement: ctx.placement, seatRevision: ctx.seatRevision, ftReady: ctx.ftReady };
  if (day.agreement && !targetValid(day.agreement.target, ctx)) day.agreement = null;
  if (day.episode && !['result', 'invalid'].includes(day.episode.stage) && !targetValid(day.episode.target, ctx)) {
    day.episode.stage = day.episode.resultId ? 'result' : 'invalid';
    day.episode.guideStep = null;
  }
  const j = day.job;
  if (j?.status === 'preparing' && day.hostNowMs >= j.readyAt) {
    j.status = 'ready';
    emit(day, facts, 'day.support.prepared', `${j.id}:prepared`, ['workshop-owner'], [`${j.id}:accepted`]);
  }
}
function complete(day, e, facts) {
  e.stage = 'result'; e.resultId = `${e.id}:result`;
  const h = { resultId: e.resultId, kind: e.kind, role: e.role, choice: e.choice, support: e.support,
    target: { ...e.target }, location: e.location, completedU: day.uMs, observedU: null, visit: day.visit,
    knownBy: members(e.kind), contribution: e.kind === 'help' && e.choice !== 'alone',
    ...(e.kind === 'help' ? { direction: e.direction } : {}) };
  day.history.push(h);
  if (e.role !== 'observer') day.roleEvidence.push({ resultId: h.resultId, kind: e.kind, role: e.role });
  if (e.kind === 'coordination' && e.role !== 'observer') {
    day.agreement = { resultId: h.resultId, target: { ...h.target }, location: h.location, choice: e.choice, role: e.role };
  }
  emit(day, facts, `day.${e.kind}.${e.role}.executed`, h.resultId, h.knownBy,
    day.emitted.includes(`${e.id}:acted`) ? [`${e.id}:acted`] : []);
}
function advanceEpisode(day, elapsedMs, facts) {
  const e = day.episode;
  if (day.walk?.enabled && nearbyPlace(day.walk) !== e?.location) return;
  if (!e?.open || e.location !== day.location || !['demonstration', 'rehearsal', 'executing', 'explaining'].includes(e.stage)) return;
  e.elapsedMs = Math.min(4000, e.elapsedMs + elapsedMs);
  if (e.stage === 'explaining') {
    if (e.elapsedMs >= 4000) {
      emit(day, facts, 'day.coordination.picture.explained', `${e.id}:explanation`, members(e.kind), [e.resultId]);
      e.explanationDone = true; e.stage = 'result';
    }
    return;
  }
  if (e.stage === 'demonstration' && e.elapsedMs >= 2000) { e.stage = 'awaitContinue'; e.elapsedMs = 0; return; }
  if (e.stage === 'rehearsal' && e.elapsedMs >= 3000) { e.stage = 'awaitConfirm'; e.elapsedMs = 0; return; }
  if (e.stage !== 'executing' || e.elapsedMs < 4000) return;
  if (e.kind !== 'help') emit(day, facts, `day.${e.kind}.needs.exchanged`, `${e.id}:needs`, members(e.kind));
  if (e.kind === 'tea' && e.choice === 'sequence' && e.role === 'planner' && e.part === 0) {
    emit(day, facts, 'day.tea.picture.used', `${e.id}:picture`, members(e.kind));
    e.stage = 'awaitTea'; e.elapsedMs = 0; return;
  }
  emit(day, facts, `day.${e.kind}.action.used`, `${e.id}:acted`, members(e.kind),
    day.emitted.includes(`${e.id}:picture`) ? [`${e.id}:picture`] : []);
  if (e.kind === 'help') { e.stage = 'awaitFinish'; e.elapsedMs = 0; return; }
  complete(day, e, facts);
}
function advanceRoutine(day, elapsedMs, facts, ctx) {
  const r = day.routine;
  if (r.habitResultId !== (day.agreement?.resultId ?? null)) { r.habitResultId = day.agreement?.resultId ?? null; r.habitMs = 0; }
  r.elapsedMs = Math.min(14000, r.elapsedMs + elapsedMs);
  const prefix = `DAY:routine:${day.visit}`;
  const reserved = reservedMembers(day);
  if (ctx.cafeBusy) reserved.add('cafe-owner');
  if (ctx.workshopBusy) reserved.add('workshop-owner');
  if (day.job?.status === 'preparing') reserved.add('workshop-owner');
  const beforeC = r.cafeMs, beforeW = r.workshopMs, beforePair = r.pairMs;
  if (!reserved.has('cafe-owner')) r.cafeMs = Math.min(3000, r.cafeMs + elapsedMs);
  // Wait at the workshop doorway while the cafe body is reserved by another scene.
  if (!reserved.has('workshop-owner')) r.workshopMs = Math.max(r.workshopMs, Math.min(reserved.has('cafe-owner') ? 3000 : 8000, r.workshopMs + elapsedMs));
  if (!reserved.has('researcher')) r.researcherMs = Math.min(3000, r.researcherMs + elapsedMs);
  if (r.cafeMs >= 3000) emit(day, facts, 'day.cafe.own-tray.tidied', `${prefix}:cafe-tidied`, ['cafe-owner']);
  if (r.workshopMs >= 3000) emit(day, facts, 'day.workshop.own-tools.stored', `${prefix}:tools-stored`, ['workshop-owner']);
  if (r.researcherMs >= 3000) emit(day, facts, 'day.researcher.own-board.prepared', `${prefix}:board-prepared`, ['researcher']);
  const pairAvailable = !reserved.has('cafe-owner') && !reserved.has('workshop-owner')
    ? Math.max(0, Math.min(elapsedMs, beforeC + elapsedMs - 3000, beforeW + elapsedMs - 8000)) : 0;
  r.pairMs = Math.min(4000, r.pairMs + pairAvailable);
  if (r.pairMs >= 1000) emit(day, facts, 'day.pair.CW.needs.exchanged', `${prefix}:pair-needs`, ['cafe-owner', 'workshop-owner'], [`${prefix}:cafe-tidied`, `${prefix}:tools-stored`]);
  if (r.pairMs >= 4000) emit(day, facts, 'day.pair.CW.support.checked', `${prefix}:pair-help`, ['cafe-owner', 'workshop-owner'], [`${prefix}:pair-needs`]);
  if (!reserved.has('workshop-owner') && r.pairMs >= 4000) r.returnMs = Math.min(2000, r.returnMs + Math.max(0, beforePair + pairAvailable - 4000));
  if (r.returnMs >= 2000 && !day.agreement) {
    emit(day, facts, 'day.workshop.basic-seat.rested', `${prefix}:workshop-rested`, ['workshop-owner']);
  }
  if (r.pairMs >= 4000 && day.agreement && !reserved.has('workshop-owner') && !reserved.has('researcher')) {
    r.habitMs = Math.min(4000, r.habitMs + Math.max(0, beforePair + pairAvailable - 4000));
    if (r.habitMs >= 4000) emit(day, facts, 'day.coordination.agreed-use.revisited', `${prefix}:habit:${day.agreement.resultId}`, ['workshop-owner', 'researcher'], [day.agreement.resultId]);
  }
}
export function advanceDay(day, context) {
  assertDay(day); const ctx = contextFor(context), facts = [];
  reconcile(day, ctx, facts);
  if (ctx.canRun && !day.rest) {
    day.uMs += ctx.elapsedMs || 0;
    ensure(integer(day.uMs), 'invalid-day-time', '생활 시간을 다시 확인해 주세요.', 503);
    advanceEpisode(day, ctx.elapsedMs || 0, facts);
    advanceRoutine(day, ctx.elapsedMs || 0, facts, ctx);
  }
  assertDay(day); return facts;
}
function requireEpisode(day, allowed) {
  const e = day.episode;
  ensure(e?.open && allowed.includes(e.stage), 'day-stage-conflict', '현재 단계에서 다시 골라 주세요.', 409);
  ensure(day.location === e.location, 'day-place-conflict', '이 생활을 하던 곳으로 돌아가 주세요.', 409);
  ensure(e.guideStep == null, 'day-guide-pending', '물건을 함께 확인한 뒤 직접 골라 주세요.', 409);
  return e;
}
function beginChoice(e) {
  e.elapsedMs = 0;
  e.stage = e.support === 'demo' ? 'demonstration' : e.support === 'plan' ? 'rehearsal' : 'preview';
}
function memoryLine(day, npc) {
  const h = [...day.history].reverse().find(row => row.knownBy.includes(npc) && row.kind !== 'help');
  if (!h) return '오늘은 제가 한쪽을 맡을까요?';
  if (h.role === 'observer') return h.observedU !== null ? '지난번에 여기서 함께 봤지요. 오늘은 제가 한쪽을 맡을까요?' : '지금 준비한 모습을 보여 드릴게요. 오늘은 제가 한쪽을 맡을까요?';
  if (h.role === 'delegated') return '맡기신 자리는 이렇게 준비했어요. 오늘은 제가 한쪽을 맡을까요?';
  return '지난번에 자리를 같이 정했지요. 오늘은 제가 한쪽을 맡을까요?';
}
function moveTo(day, location, facts) {
  const from = day.location;
  day.location = location; day.rest = false; day.home.previewSlot = null; day.home.exitTarget = null;
  if (day.walk && !day.walk.enabled) Object.assign(day.walk, WALK_SPAWNS[location]);
  if (from === 'home' && location !== 'home') {
    if (day.atHomeAfterOuting) { day.visit++; day.routine = newRoutine(day.visit); day.atHomeAfterOuting = false; }
    day.hasGoneOut = true;
  }
  if (location === 'home' && day.hasGoneOut) day.atHomeAfterOuting = true;
  emit(day, facts, location === 'home' ? 'day.home.returned' : 'day.place.entered', source(day, `move:${location}`), []);
}
export function commandDay(day, type, payload = {}, context) {
  assertDay(day); const ctx = contextFor(context), facts = [];
  ensure(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid-day-command', '생활 선택을 다시 확인해 주세요.');
  reconcile(day, ctx, facts);
  if (day.walk?.enabled && !['DAY_WALK', 'DAY_WALK_ENABLE', 'DAY_WALK_DISABLE', 'DAY_INTERACT', 'DAY_MOVE', 'DAY_EXIT',
    'DAY_SUPPORT', 'DAY_CLOSE', 'DAY_HOME_CANCEL', 'DAY_HOME_STAY', 'DAY_WAKE'].includes(type)) {
    const required = ['DAY_RESUME', 'DAY_RETRY'].includes(type) ? day.episode?.location : day.location;
    ensure(required && nearbyPlace(day.walk) === required, 'day-walk-too-far', '그 장소 가까이 걸어가서 이어 주세요.', 409);
  }
  switch (type) {
    case 'DAY_WALK_ENABLE':
      day.walk = day.walk ? { ...day.walk, enabled: true } : { enabled: true, ...WALK_SPAWNS[day.location], headingX: 0, headingZ: -1 };
      day.home.exitTarget = null; break;
    case 'DAY_WALK_DISABLE':
      if (day.walk) day.walk.enabled = false; break;
    case 'DAY_WALK': {
      ensure(day.walk?.enabled, 'day-walk-disabled', '먼저 직접 걷기를 열어 주세요.', 409);
      let segments;
      try { segments = walkSegments(payload); } catch { throw new DayError('invalid-day-walk', '걷는 방향과 시간을 다시 확인해 주세요.'); }
      let left = Math.max(0, Math.min(250, ctx.walkElapsedMs || 0));
      for (const s of segments) {
        const ms = Math.min(left, s.durationMs); left -= ms;
        const next = movePoint(day.walk, s, ms / 1000); Object.assign(day.walk, next);
        if (ms && (s.x || s.z)) { const norm = Math.max(1, Math.hypot(s.x, s.z)); day.walk.headingX = s.x / norm; day.walk.headingZ = s.z / norm; }
      }
      day.rest = false; break;
    }
    case 'DAY_INTERACT':
      ensure(day.walk?.enabled && places.includes(payload.location) && nearbyPlace(day.walk) === payload.location,
        'day-walk-too-far', '그 장소 가까이 걸어가서 이용해 주세요.', 409);
      if (day.location !== payload.location) moveTo(day, payload.location, facts);
      day.rest = false; break;
    case 'DAY_MOVE': {
      ensure(!day.walk?.enabled, 'day-walk-no-teleport', '직접 걷는 동안에는 그 장소까지 걸어가 주세요.', 409);
      ensure(places.includes(payload.location), 'invalid-day-location', '갈 곳을 다시 골라 주세요.');
      if (payload.location === day.location) break;
      if (day.location === 'home') { day.home.exitTarget = payload.location; day.home.previewSlot = null; day.rest = false; }
      else moveTo(day, payload.location, facts);
      break;
    }
    case 'DAY_EXIT':
      ensure(!day.walk?.enabled, 'day-walk-no-teleport', '문 앞에서 직접 걸어 나가 주세요.', 409);
      ensure(day.location === 'home' && day.home.exitTarget, 'day-door-required', '먼저 문 앞에서 갈 곳을 골라 주세요.', 409);
      moveTo(day, day.home.exitTarget, facts); break;
    case 'DAY_HOME_STAY': day.home.exitTarget = null; break;
    case 'DAY_HOME_PREVIEW':
      ensure(day.location === 'home' && ['window', 'table'].includes(payload.slot), 'invalid-home-slot', '집에서 방석 자리를 골라 주세요.');
      day.home.previewSlot = payload.slot; day.home.exitTarget = null; day.rest = false; break;
    case 'DAY_HOME_CONFIRM':
      ensure(day.location === 'home' && day.home.previewSlot !== null, 'no-home-preview', '먼저 방석 자리를 미리 봐 주세요.', 409);
      day.home.slot = day.home.previewSlot; day.home.previewSlot = null; day.home.revision++;
      emit(day, facts, 'day.home.cushion.placed', `DAY:home:${day.home.revision}:placed`, []); break;
    case 'DAY_HOME_CANCEL': day.home.previewSlot = null; break;
    case 'DAY_REST': day.rest = true; break;
    case 'DAY_WAKE': day.rest = false; break;
    case 'DAY_SUPPORT':
      ensure(modes.includes(payload.mode), 'invalid-day-support', '도움 방식을 다시 골라 주세요.');
      day.support = payload.mode;
      // The chosen mode belongs to the next choice, never silently rewrites an accepted scene.
      break;
    case 'DAY_START': {
      ensure(kinds.includes(payload.kind), 'invalid-day-kind', '생활을 다시 골라 주세요.');
      ensure(!day.episode || ['result', 'invalid'].includes(day.episode.stage), 'day-episode-busy', '남아 있는 생활을 먼저 이어서 마쳐 주세요.', 409);
      const kind = payload.kind;
      if (kind !== 'tea') ensure(day.job?.status !== 'preparing', 'day-workshop-busy', '공방 주인이 부탁한 받침을 준비하고 있어요. 준비가 끝나면 함께할 수 있어요.', 409);
      ensure(kind === 'help' ? day.location === 'workshop' : ['cafe', 'greenhouse'].includes(day.location), 'day-place-conflict', '생활을 할 곳으로 이동해 주세요.', 409);
      if (kind === 'tea') {
        ensure(day.location === 'cafe' && ctx.ftReady && ctx.placement, 'day-seat-required', '찻집에서 실제로 쓸 자리를 먼저 준비해 주세요.', 409);
        ensure(!ctx.cafeBusy, 'day-cafe-busy', '찻집 주인이 하던 일을 마치면 함께 놓을 수 있어요.', 409);
      }
      const id = source(day, kind);
      day.episode = { id, kind, stage: kind === 'help' ? 'choice' : 'role', role: kind === 'help' ? 'planner' : null,
        choice: null, support: day.support, target: targetFor(ctx, day.location === 'cafe'), location: day.location,
        elapsedMs: 0, part: 0, open: true, resultId: null, direction: 'clear', explanationDone: false,
        languageSupport: ctx.languageSupport === 'stepwise' ? 'stepwise' : 'plain',
        languageSupportBasis: ctx.languageSupportBasis ? structuredClone(ctx.languageSupportBasis) : undefined,
        guideStep: ctx.languageSupport === 'stepwise' ? 0 : null };
      day.rest = false; break;
    }
    case 'DAY_GUIDE_NEXT': {
      const e = day.episode;
      ensure(e?.open && e.location === day.location && e.guideStep != null,
        'day-guide-unavailable', '현재 함께 확인할 물건이 없어요.', 409);
      e.guideStep = e.guideStep === 0 ? 1 : null; break;
    }
    case 'DAY_ROLE': {
      const e = requireEpisode(day, ['role']);
      ensure(roles.includes(payload.role), 'invalid-day-role', '함께할 방식을 골라 주세요.');
      e.role = payload.role;
      if (e.role === 'planner') e.stage = 'choice';
      else { e.choice = e.kind === 'tea' ? 'sequence' : 'delegate'; e.stage = 'executing'; e.elapsedMs = 0; }
      emit(day, facts, `day.${e.kind}.role.accepted`, `${e.id}:accepted`, members(e.kind));
      break;
    }
    case 'DAY_CHOICE': {
      const e = requireEpisode(day, ['choice', 'preview', 'awaitConfirm']);
      ensure(choices[e.kind].includes(payload.choice), 'invalid-day-choice', '현재 생활의 선택을 다시 확인해 주세요.');
      if (payload.choice === 'separate') ensure(ctx.slotsAvailable !== false, 'day-slots-unavailable', '지금 두 자리를 함께 쓸 수 없어요. 다른 방식을 골라 주세요.', 409);
      e.choice = payload.choice;
      e.role = payload.choice === 'delegate' ? 'delegated' : 'planner';
      beginChoice(e); break;
    }
    case 'DAY_CONTINUE': {
      const e = requireEpisode(day, ['awaitContinue']); e.stage = 'preview'; e.elapsedMs = 0; break;
    }
    case 'DAY_CONFIRM': {
      const e = requireEpisode(day, ['preview', 'awaitConfirm']);
      ensure(targetValid(e.target, ctx), 'day-seat-changed', '자리가 바뀌었어요. 다시 확인해 주세요.', 409);
      if (e.choice === 'separate') ensure(ctx.slotsAvailable !== false, 'day-slots-unavailable', '지금 두 자리를 함께 쓸 수 없어요.', 409);
      e.stage = 'executing'; e.elapsedMs = 0; break;
    }
    case 'DAY_TEA_NEXT': {
      const e = requireEpisode(day, ['awaitTea']); e.part = 1; e.stage = 'executing'; e.elapsedMs = 0; break;
    }
    case 'DAY_PICTURE_NEXT': {
      const e = requireEpisode(day, ['result']);
      ensure(e.kind === 'coordination' && e.choice === 'rest' && !e.explanationDone, 'day-explanation-unavailable', '현재 새로 열 설명이 없어요.', 409);
      ensure(targetValid(e.target, ctx), 'day-seat-changed', '자리가 바뀌었어요. 지금 쓸 자리에서 새 생활을 열어 주세요.', 409);
      e.stage = 'explaining'; e.elapsedMs = 0; break;
    }
    case 'DAY_HELP_DIRECTION': {
      const e = requireEpisode(day, ['awaitFinish']);
      ensure(e.kind === 'help' && ['near', 'clear'].includes(payload.direction), 'invalid-help-direction', '받침 방향을 다시 골라 주세요.');
      e.direction = payload.direction; break;
    }
    case 'DAY_HELP_FINISH': {
      const e = requireEpisode(day, ['awaitFinish']);
      ensure(e.kind === 'help', 'invalid-help-finish', '현재 도움을 확인해 주세요.', 409);
      complete(day, e, facts); break;
    }
    case 'DAY_OBSERVED': {
      const e = requireEpisode(day, ['result']);
      ensure(payload.resultId === e.resultId && payload.visible === true && ctx.canRun, 'day-observation-conflict', '현재 보이는 생활 결과를 확인해 주세요.', 409);
      const h = day.history.find(row => row.resultId === e.resultId);
      if (h.observedU === null) {
        h.observedU = day.uMs;
        emit(day, facts, 'day.result.observed', `${h.resultId}:observed`, h.knownBy, [h.resultId]);
      }
      break;
    }
    case 'DAY_CLOSE':
      ensure(day.episode, 'no-day-episode', '현재 열린 생활이 없어요.', 409);
      day.episode.open = false; break;
    case 'DAY_RESUME':
      ensure(day.episode, 'no-day-episode', '이어 할 생활이 없어요.', 409);
      if (day.walk?.enabled) { if (day.location !== day.episode.location) moveTo(day, day.episode.location, facts); day.episode.open = true; }
      else if (day.location === 'home' && day.episode.location !== 'home') day.home.exitTarget = day.episode.location;
      else { if (day.location !== day.episode.location) moveTo(day, day.episode.location, facts); day.episode.open = true; }
      day.rest = false; break;
    case 'DAY_RETRY': {
      const e = requireEpisode(day, ['invalid']);
      if (e.kind === 'tea') ensure(ctx.ftReady && ctx.placement, 'day-seat-required', '실제로 쓸 찻집 자리를 먼저 준비해 주세요.', 409);
      // Preserve completed facts; a replacement is a new attempt, never a revision of history.
      day.episode = { ...e, id: source(day, e.kind), target: targetFor(ctx, e.location === 'cafe'), stage: e.kind === 'help' ? 'choice' : 'role',
        role: e.kind === 'help' ? 'planner' : null, choice: null, elapsedMs: 0, part: 0, resultId: null, explanationDone: false,
        languageSupport: ctx.languageSupport === 'stepwise' ? 'stepwise' : 'plain',
        languageSupportBasis: ctx.languageSupportBasis ? structuredClone(ctx.languageSupportBasis) : undefined,
        guideStep: ctx.languageSupport === 'stepwise' ? 0 : null };
      break;
    }
    case 'DAY_JOB_START': {
      ensure(day.location === 'workshop', 'day-place-conflict', '공방에서 준비를 부탁해 주세요.', 409);
      ensure(day.job === null, 'day-job-exists', '이미 부탁한 받침 하나가 있어요.', 409);
      ensure(!reservedMembers(day).has('workshop-owner'), 'day-workshop-busy', '공방 주인이 함께 하던 일을 마친 뒤 부탁해 주세요.', 409);
      const id = source(day, 'support-job');
      day.job = { id, status: 'preparing', startedAt: day.hostNowMs, readyAt: day.hostNowMs + 30000, collectedAt: null };
      emit(day, facts, 'day.support.preparation.accepted', `${id}:accepted`, ['workshop-owner']); break;
    }
    case 'DAY_JOB_COLLECT': {
      ensure(day.location === 'workshop' && day.job?.status === 'ready', 'day-job-not-ready', '공방에서 준비된 받침을 확인해 주세요.', 409);
      day.job.status = 'collected'; day.job.collectedAt = day.hostNowMs;
      emit(day, facts, 'day.support.received-for-use', `${day.job.id}:received`, ['workshop-owner'], [`${day.job.id}:prepared`]); break;
    }
    default: throw new DayError('unknown-day-command', '알 수 없는 생활 선택이에요.');
  }
  assertDay(day); return facts;
}

function reservedMembers(day) {
  const e = day.episode;
  return new Set(e?.open && e.location === day.location && e.stage !== 'invalid' ? members(e.kind) : []);
}
const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
function actor(id, x, z, pose, goal) { return { id, x, z, pose, goal }; }
function seatPoint(target) {
  const points = { garden: { x: -.7, z: 2 }, 'garden-right': { x: 1.2, z: 2 }, 'eaves-left': { x: -1.2, z: .4 }, 'eaves-right': { x: .8, z: .4 } };
  return target?.kind === 'seat' ? points[target.placement] : { x: .4, z: 1.8 };
}
function sceneFor(day, ctx) {
  const r = day.routine, t = r.workshopMs, pairDone = day.emitted.includes(`DAY:routine:${day.visit}:pair-help`);
  const cafe = actor('cafe-owner', -.6, -.3, r.cafeMs < 3000 ? 'working' : r.pairMs > 0 && !pairDone ? 'talking' : 'resting', r.cafeMs < 3000 ? '자기 쟁반 정리' : '찻집의 통로 살피기');
  let workshop;
  if (t < 3000) workshop = actor('workshop-owner', 6, .2, 'working', '자기 도구 보관');
  else if (t < 8000) workshop = actor('workshop-owner', mix(6, .6, (t - 3000) / 5000), .2, 'walking', '찻집 받침을 보러 가기');
  else if (!pairDone) workshop = actor('workshop-owner', .6, .2, 'talking', '찻집 주인과 받침 확인');
  else if (r.returnMs < 2000) workshop = actor('workshop-owner', mix(.6, 5.4, r.returnMs / 2000), .6, 'walking', '공방 기본 자리로 돌아가기');
  else workshop = actor('workshop-owner', 5.4, .6, 'resting', '자기 자리에서 쉬기');
  if (day.job?.status === 'preparing') workshop = actor('workshop-owner', 6, .2, 'working', '부탁받은 받침 하나 준비');
  const researcher = actor('researcher', .3, -6, r.researcherMs < 3000 ? 'working' : 'showing', '자기 관찰판 준비');
  const npcs = [cafe, workshop, researcher];
  const props = [
    { id: 'home-cushion', kind: 'cushion', x: day.home.slot === 'window' ? -6.7 : -5.5, z: -.2 },
    { id: 'cafe-tray', kind: 'tray', x: -.7, z: -.65 },
    { id: 'researcher-board', kind: 'board', x: -.3, z: -6.4 },
    { id: 'workshop-support', kind: 'support', x: 6.6, z: .3 },
  ];
  const lastHelp = [...day.history].reverse().find(h => h.kind === 'help');
  if (lastHelp?.direction) Object.assign(props.find(p => p.id === 'workshop-support'), { x: 6.3, z: .8, orientation: lastHelp.direction });
  if (day.home.previewSlot) props.push({ id: 'home-cushion-preview', kind: 'cushion', x: day.home.previewSlot === 'window' ? -6.7 : -5.5, z: -.2, preview: true });
  if (day.environment.ftReady && day.environment.placement) {
    const pos = seatPoint({ kind: 'seat', placement: day.environment.placement });
    props.push({ id: 'ft-seat', kind: 'chair', ...pos });
  }
  const a = day.agreement, reserved = reservedMembers(day);
  if (a && pairDone && !reserved.has('workshop-owner') && !reserved.has('researcher')) {
    const place = a.location === 'cafe' ? seatPoint(a.target) : DAY_LOCATIONS[a.location];
    workshop.x = mix(.6, place.x - .8, r.habitMs / 4000); workshop.z = mix(.2, place.z + .2, r.habitMs / 4000);
    workshop.pose = r.habitMs < 4000 ? 'walking' : 'resting'; workshop.goal = '지난 합의가 유효한 자리에서 조용히 쉬기';
    if (['separate', 'silent'].includes(a.choice)) {
      researcher.x = mix(.3, place.x + 1.8, r.habitMs / 4000); researcher.z = mix(-6, place.z - .3, r.habitMs / 4000);
      researcher.pose = r.habitMs < 4000 ? 'walking' : 'showing'; researcher.goal = a.choice === 'silent' ? '말 없이 큰 그림만 펼치기' : '합의한 별도 그림 자리 이용';
      if (r.habitMs >= 4000) Object.assign(props.find(p => p.id === 'researcher-board'), { x: place.x + 1.2, z: place.z - .3 });
    } else { researcher.pose = 'resting'; researcher.goal = a.choice === 'rest' ? '설명을 먼저 열 때까지 기다리기' : '자기 온실에서 그림 보여 주기'; }
  }
  const e = day.episode;
  if (e?.open && e.location === day.location && e.stage !== 'invalid') {
    const base = e.location === 'cafe' ? seatPoint(e.target) : DAY_LOCATIONS[e.location];
    const progress = ['executing', 'rehearsal'].includes(e.stage) ? e.elapsedMs / 2000 : 1;
    for (const id of members(e.kind)) {
      if (e.kind === 'help' && e.choice === 'alone') continue;
      const n = npcs.find(row => row.id === id), index = members(e.kind).indexOf(id);
      const targetX = base.x + (index ? 1 : -.8), targetZ = base.z + .3;
      n.x = mix(n.x, targetX, progress); n.z = mix(n.z, targetZ, progress);
      n.pose = ['executing', 'rehearsal'].includes(e.stage) && e.elapsedMs < 2000 ? 'walking' : e.kind === 'help' ? 'holding' : id === 'researcher' ? 'showing' : 'resting';
      if (e.stage === 'demonstration') n.pose = 'showing';
      if (['awaitContinue', 'preview', 'awaitConfirm'].includes(e.stage)) n.pose = 'standing';
      n.goal = e.stage === 'demonstration' ? '선택한 물건을 시범으로 비교' : e.stage === 'rehearsal' ? '고른 계획을 리허설' : e.stage === 'awaitContinue' || e.stage === 'awaitConfirm' ? '사용자의 다음 선택 기다리기' : e.kind === 'help' ? '받침을 잡고 방향 선택 기다리기' : '함께 정한 생활';
    }
    if (e.choice) {
      const preview = ['demonstration', 'awaitContinue', 'preview', 'rehearsal', 'awaitConfirm'].includes(e.stage);
      if (e.kind === 'tea') {
        const defaultTeaStage = e.role !== 'planner' && (e.elapsedMs >= 2000 || e.stage === 'result');
        const showBoard = e.choice === 'separate' || e.part === 0 && !defaultTeaStage && e.stage !== 'result';
        const showTea = e.choice === 'separate' || e.part === 1 || defaultTeaStage || e.stage === 'result';
        if (showBoard) Object.assign(props.find(p => p.id === 'researcher-board'), { x: base.x + (e.choice === 'separate' ? 1.2 : 0), z: base.z, preview });
        if (showTea) Object.assign(props.find(p => p.id === 'cafe-tray'), { x: base.x - (e.choice === 'separate' ? .9 : 0), z: base.z, preview });
      } else if (e.kind === 'coordination') {
        const r = npcs.find(n => n.id === 'researcher');
        if (e.choice === 'delegate') { r.x = .3; r.z = -6; r.goal = '온실에서 자기 그림 보여 주기'; }
        else if (e.choice === 'rest' && !e.explanationDone && e.stage !== 'explaining') r.pose = 'resting';
        else Object.assign(props.find(p => p.id === 'researcher-board'), { x: base.x + (e.choice === 'separate' ? 1.8 : .4), z: base.z - .3, preview });
      } else if (e.choice !== 'alone') Object.assign(props.find(p => p.id === 'workshop-support'), { x: base.x + .3, z: base.z + .8, preview, orientation: e.direction });
    }
  }
  const here = DAY_LOCATIONS[day.location];
  if (e?.open && e.location === day.location && e.guideStep != null) {
    const shown = e.kind === 'help' ? 'workshop-support' : e.guideStep === 0 ? 'researcher-board' : e.kind === 'tea' ? 'cafe-tray' : 'guide-rest-seat';
    if (shown === 'guide-rest-seat') props.push({ id: shown, kind: 'chair', x: here.x + .8, z: here.z + 1, preview: true });
    for (const n of npcs) if (members(e.kind).includes(n.id)) { n.pose = 'showing'; n.goal = e.guideStep === 0 ? '첫 물건을 보여 주고 기다리기' : '다음 물건을 보여 주고 기다리기'; }
    const prop = props.find(p => p.id === shown);
    if (prop) Object.assign(prop, { x: here.x + (e.guideStep ? .8 : -.8), z: here.z + 1, preview: true });
  }
  const cafeReserved = reservedMembers(day).has('cafe-owner') || r.returnMs < 2000;
  const backgroundLine = day.job?.status === 'preparing' ? '공방 주인은 부탁받은 받침을 준비하고, 다른 주민은 자기 일을 해요.'
    : r.pairMs >= 1000 && r.pairMs < 4000 ? '찻집 주인: “이 받침이 조금 흔들려요.” 공방 주인: “제 도구로 잠깐 확인할게요.”'
      : r.pairMs >= 4000 ? '공방 주인이 찻집의 받침을 확인했어요. 연구원은 온실에서 자기 그림을 준비해요.'
        : '찻집은 쟁반을 정리하고, 공방은 도구를 보관하고, 연구원은 그림 한 장을 준비해요.';
  return { location: day.location, player: day.walk?.enabled ? { x: day.walk.x, z: day.walk.z, headingX: day.walk.headingX, headingZ: day.walk.headingZ }
    : { x: here.x, z: day.location === 'home' && day.home.exitTarget ? 1.2 : here.z + 2.5 },
    npcs: ctx.cafeBusy && day.location === 'cafe' ? npcs.filter(n => n.id !== 'cafe-owner') : npcs, props,
    cafeReserved, summary: backgroundLine, phase: e?.open ? e.stage : day.rest ? 'resting' : 'walking' };
}
function historySummary(h) {
  const role = h.role === 'planner' ? '함께 정함' : h.role === 'delegated' ? '분담을 맡김' : h.observedU === null ? '주민의 결과 준비됨 · 아직 관람 전' : '실제로 관람함';
  const outcome = { sequence: '그림 뒤 차', separate: '두 자리로 나눔', rest: '먼저 조용히 쉼', silent: '말 없는 그림', delegate: '각자의 공간 사용', hold: '받침 고정 도움', prepare: '쉬는 자리 준비', alone: '혼자 자리 마침' }[h.choice];
  return `${role} · ${outcome}${h.kind === 'help' && h.direction ? h.direction === 'near' ? ' · 내 쪽 가까이' : ' · 통로를 넓게' : ''}`;
}
function episodeView(day, e) {
  let line = '', actions = [], speaker = e.kind === 'help' ? '공방 주인' : '연구원';
  if (day.location !== e.location) return { line: `${labelPlace(e.location)}에서 하던 생활은 그대로 남아 있어요.`, speaker: '생활 수첩', actions: [action('DAY_RESUME', '하던 곳으로 돌아가기')] };
  if (e.guideStep != null) {
    const lines = e.kind === 'help' ? ['이 받침을 놓을 거예요. 제가 한쪽을 잡을 수 있어요.', '내 쪽으로 놓거나 길을 비울 수 있어요. 마지막 방향은 직접 골라요.']
      : e.kind === 'tea' ? ['이건 그림이에요. 먼저 보거나 차와 따로 놓을 수 있어요.', '이건 차예요. 그림 다음에 놓거나, 그림 옆에 놓을 수 있어요.']
        : ['연구원은 이 그림을 보여 주고 싶어요.', '공방 주인은 쉬고 싶어요. 쉬는 순서나 두 자리를 직접 정해요.'];
    return { line: lines[e.guideStep], speaker, actions: [action('DAY_GUIDE_NEXT', e.guideStep === 0 ? '다음도 보여 주세요' : '이제 직접 고를게요', {}, true), action('DAY_CLOSE', '나중에 이어 할게요')] };
  }
  if (e.stage === 'role') {
    line = e.kind === 'tea' ? '차 옆에 그림 한 장을 두고 싶어요. 잔과 그림이 가리지 않게 어떻게 놓을까요?' : '저는 그림을 보여 주고 싶고, 공방 주인은 조용히 쉬고 싶대요. 함께 정해 볼까요?';
    actions = [action('DAY_ROLE', '함께 정할게요', { role: 'planner' }, true), action('DAY_ROLE', '보기만 할게요', { role: 'observer' }), action('DAY_ROLE', '둘이 정해 주세요', { role: 'delegated' })];
  } else if (e.stage === 'choice') {
    line = e.kind === 'help' ? memoryLine(day, 'workshop-owner') : '내가 고른 방식에 맞춰 움직일게요.';
    actions = e.kind === 'tea' ? [action('DAY_CHOICE', '그림 먼저 봐요', { choice: 'sequence' }), action('DAY_CHOICE', '따로 놓아요', { choice: 'separate' })]
      : e.kind === 'coordination' ? [action('DAY_CHOICE', '쉬고 나서 봐요', { choice: 'rest' }), action('DAY_CHOICE', '자리를 나눠요', { choice: 'separate' }), action('DAY_CHOICE', '말 없이 그림만', { choice: 'silent' }), action('DAY_CHOICE', '둘이 정해 주세요', { choice: 'delegate' })]
        : [action('DAY_CHOICE', '받침을 잡아 주세요', { choice: 'hold' }), action('DAY_CHOICE', '쉬는 자리 준비 부탁해요', { choice: 'prepare' }), action('DAY_CHOICE', '이번에는 혼자 할게요', { choice: 'alone' })];
  } else if (e.stage === 'demonstration') line = '제가 먼저 두 물건의 자리를 보여 드릴게요. 아직 놓지는 않을게요.';
  else if (e.stage === 'awaitContinue') { line = '이렇게 할 수 있어요. 준비되면 이어가요.'; actions = [action('DAY_CONTINUE', '이어서 정할게요', {}, true)]; }
  else if (e.stage === 'rehearsal') line = '고른 계획대로 동선만 맞춰 볼게요. 마지막 결정은 기다릴게요.';
  else if (['preview', 'awaitConfirm'].includes(e.stage)) {
    line = e.support === 'cooperate' ? '저는 제 담당만 할게요. 이대로 시작할까요?' : '이 모습으로 할까요? 마지막 결정은 아직 남아 있어요.';
    actions = [action('DAY_CONFIRM', '이대로 시작해요', {}, true), ...choices[e.kind].filter(c => c !== e.choice).map(choice => action('DAY_CHOICE', `다른 방식: ${{ sequence: '그림 먼저', separate: '자리 나누기', rest: '먼저 쉬기', silent: '말 없는 그림', delegate: '맡기기', hold: '받침 고정', prepare: '휴식 준비', alone: '혼자 하기' }[choice]}`, { choice }))];
  } else if (e.stage === 'executing') line = e.kind === 'help' ? e.choice === 'alone' ? '자리를 살펴보는 동안 저는 제 자리에서 쉴게요.' : '제가 이쪽을 잡을게요. 방향은 직접 골라 주세요.' : e.kind === 'tea' && e.part === 1 ? '이번엔 차 자리예요.' : '각자 맡은 일을 하고 있어요.';
  else if (e.stage === 'explaining') line = '이제 그림을 펼칠게요. 공방 주인은 그림이 보이는 쪽으로 자리를 옮겨요.';
  else if (e.stage === 'awaitTea') { line = '잎의 이쪽은 밝아요. 그림은 계속 볼 수 있어요. 차로 바꿀 때 알려 주세요.'; actions = [action('DAY_TEA_NEXT', '이제 차 놓아요', {}, true)]; }
  else if (e.stage === 'awaitFinish') {
    line = e.choice === 'alone' ? '쉬기 좋은 방향을 직접 골라 마쳐 주세요.' : '이제 놓아도 괜찮아요. 방향은 직접 정해 주세요.';
    actions = [action('DAY_HELP_DIRECTION', '자리 쪽으로', { direction: 'near' }), action('DAY_HELP_DIRECTION', '통로를 비워', { direction: 'clear' }), action('DAY_HELP_FINISH', '이대로 둘게요', {}, true)];
  } else if (e.stage === 'invalid') { line = '사용하던 자리가 바뀌었어요. 끝낸 일은 남겨 두고 지금 자리를 다시 볼게요.'; actions = [action('DAY_RETRY', '현재 자리로 다시 정하기')]; }
  else if (e.stage === 'result') {
    const h = day.history.find(row => row.resultId === e.resultId);
    line = h.role === 'planner' ? `${historySummary(h)}. 고른 방식대로 준비했어요.` : h.role === 'delegated' ? '맡기신 생활은 이렇게 준비했어요. 각자 쓸 자리를 나눴어요.' : h.observedU === null ? '주민들이 준비한 결과예요. 지금 볼 수 있어요.' : '함께 본 장면이 수첩에 남았어요.';
    if (h.observedU === null) actions.push(action('DAY_OBSERVED', '지금 모습 봤어요', { resultId: h.resultId }));
    if (e.kind === 'coordination' && e.choice === 'rest' && !e.explanationDone) actions.push(action('DAY_PICTURE_NEXT', '이제 그림 보기'));
    actions.push(action('DAY_CLOSE', '여기서 마칠게요', {}, true));
  }
  if (e.stage !== 'result') actions.push(action('DAY_CLOSE', '나중에 이어 할게요'));
  return { line, actions, speaker };
}
export function viewDay(day, context) {
  assertDay(day); const ctx = contextFor(context);
  const loc = day.location, actions = [], e = day.episode;
  let line = loc === 'home' ? day.atHomeAfterOuting ? '다녀왔어요. 바꾼 방석과 오늘의 생활은 그대로 남아 있어요.' : '여기서 쉬어 볼까요? 방석은 창가나 탁자 곁에 둘 수 있어요.'
    : loc === 'cafe' ? day.visit > 1 && day.history.length ? '다시 왔어요. 지난 선택은 수첩에 있고, 오늘 쓸 방식은 다시 고를 수 있어요.' : day.routine.cafeMs < 3000 ? '주인은 자기 쟁반을 정리하고 있어요. 준비한 자리에서 차와 그림을 만나 보세요.' : '주인의 쟁반이 정리됐어요. 준비한 자리에서 차와 그림을 만나 보세요.'
      : loc === 'workshop' ? memoryLine(day, 'workshop-owner') : day.routine.researcherMs < 3000 ? '연구원이 관찰판에 놓을 그림을 준비하고 있어요.' : '연구원이 자기 관찰판을 접어 큰 그림 한 장을 준비했어요.';
  let speaker = loc === 'workshop' ? '공방 주인' : loc === 'greenhouse' ? '연구원' : loc === 'home' ? '우리 집' : '찻집';
  if (loc === 'home' && day.home.exitTarget) {
    line = `문 앞에 왔어요. ${labelPlace(day.home.exitTarget)} 쪽으로 나갈까요?`;
    actions.push(action('DAY_EXIT', '밖으로 나가기', {}, true), action('DAY_HOME_STAY', '집에 더 있을게요'));
  } else if (e?.open && e.location === loc) {
    const current = episodeView(day, e); line = current.line; speaker = current.speaker; actions.push(...current.actions);
  } else {
    if (loc === 'home') {
      actions.push(action('DAY_HOME_PREVIEW', '창가에 미리 놓기', { slot: 'window' }), action('DAY_HOME_PREVIEW', '탁자 곁에 미리 놓기', { slot: 'table' }));
      if (day.home.previewSlot) actions.push(action('DAY_HOME_CONFIRM', '여기에 놓기', {}, true), action('DAY_HOME_CANCEL', '취소하기'));
    }
    const canStart = !e || ['result', 'invalid'].includes(e.stage);
    if (loc === 'cafe' && canStart) {
      if (ctx.ftReady && ctx.placement && !ctx.cafeBusy) actions.push(action('DAY_START', '차와 그림 함께 놓기', { kind: 'tea' }, true));
      if (day.job?.status !== 'preparing') actions.push(action('DAY_START', '쉬는 자리와 그림 조율하기', { kind: 'coordination' }));
    }
    if (loc === 'greenhouse' && canStart && day.job?.status !== 'preparing') actions.push(action('DAY_START', '그림과 조용한 쉼 조율하기', { kind: 'coordination' }));
    if (loc === 'workshop') {
      if (canStart && day.job?.status !== 'preparing') actions.push(action('DAY_START', '한쪽을 맡아 달라고 부탁하기', { kind: 'help' }, true));
      if (!day.job) actions.push(action('DAY_JOB_START', '받침 하나 준비 부탁하기 · 30초'));
      if (day.job?.status === 'ready') actions.push(action('DAY_JOB_COLLECT', '준비된 받침 확인하고 사용하기'));
    }
    if (e && (!e.open || e.location !== loc) && e.stage !== 'result' && !ctx.resumeBlocked) actions.push(action('DAY_RESUME', `${labelPlace(e.location)} 생활 이어 하기`));
    actions.push(action(day.rest ? 'DAY_WAKE' : 'DAY_REST', day.rest ? '다시 둘러볼게요' : '여기서 쉬기'));
  }
  if (day.walk?.enabled && nearbyPlace(day.walk) !== loc) { line = '마을을 걸으며 가까운 장소를 살펴보세요.'; actions.length = 0; }
  return { title: '싱크타운 · 첫 하루', line, speaker, location: loc, visit: day.visit, support: day.support,
    walk: day.walk ? { ...day.walk, nearby: nearbyPlace(day.walk), speed: WALK_SPEED } : null,
    supportNotice: '시제품에서는 도움 방식을 직접 고릅니다. 언어 능력이나 TOPIK 수준을 평가하지 않습니다.',
    locations: places.map(id => ({ id, label: labelPlace(id), active: id === loc })),
    supportOptions: [{ id: 'demo', label: '시범부터 볼게요' }, { id: 'cooperate', label: '내 역할을 맡을게요' }, { id: 'plan', label: '함께 기획할게요' }].map(o => ({ ...o, active: o.id === day.support })),
    actions, home: { ...day.home }, episode: e ? { id: e.id, kind: e.kind, stage: e.stage, role: e.role, choice: e.choice, location: e.location, open: e.open, direction: e.direction, resultId: e.resultId } : null,
    job: day.job ? { status: day.job.status, remainingMs: Math.max(0, day.job.readyAt - day.hostNowMs), label: day.job.status === 'preparing' ? '공방 주인의 받침 하나 준비 중' : day.job.status === 'ready' ? '받침 준비 완료 · 공방에서 확인' : '공방 비품으로 사용 확인 · 선물이나 판매 재고 아님' } : { status: 'none', remainingMs: 0, label: '부탁한 준비 없음' },
    history: day.history.map(h => ({ resultId: h.resultId, kind: h.kind, role: h.role, choice: h.choice, summary: historySummary(h), observed: h.observedU !== null })),
    roleEvidence: day.roleEvidence.map(r => ({ ...r })), scene: sceneFor(day, ctx),
    observation: e?.open && e.stage === 'result' && e.location === loc ? { resultId: e.resultId, line, allowed: ctx.canRun && day.history.find(h => h.resultId === e.resultId)?.observedU === null } : null,
    limits: ['첫 하루의 생활 장면 시제품', '전체 LS01 완료나 열 가지 콘텐츠 구현을 뜻하지 않음', '계정 권한·공유 마을·언어 평가에 연결되지 않음'] };
}
