'use strict';
// Thin host adapter. The one persisted source is the Atlas event log, not a second profile.
// A browser key identifies THIS DEVICE's local practice, never an authenticated learner.
// Atlas below is the compatibility session API for Core decisions, not a ninth engine.
// Core below is Core's educational adapter; Learning is Core's practice recommendation.
const Atlas = require('./engine');
const Core = require('./education');
const Trail = require('./trail');
const Learning = require('./learning');
const Temper = require('./temper');
const { createLearningSync, sameEvent } = require('./learning-sync');
const { createFlowPort, createLive } = require('./game-flow');
const KEY = 'synk.atlas.learning.v1';
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const uid = () => `l${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
function createGame({ gameId, map, storage = null, learnerKey = 'device', clock = () => new Date().toISOString(), historyComplete = true,
  storageScope = 'device', accountKey = null } = {}) {
  if (!identifier(gameId) || !identifier(learnerKey) || typeof map?.allNodes !== 'function') throw new TypeError('Atlas: game, local scope and Strata map required');
  if (!['device', 'account'].includes(storageScope) || storageScope === 'account' && (!identifier(accountKey) || learnerKey !== 'device')) throw new TypeError('Atlas: account identity and isolated host storage required');
  const scope = { domain: 'LAB', workspace: 'learning', subject: learnerKey };
  const key = `${KEY}.${learnerKey}`;
  // Core's moment-level challenge keeps one small memory per content beside this log (game-flow.js).
  let flowPort = null;
  let epoch = null, session, readable = true, writable = !!storage, complete = historyComplete, warning = null;
  const UNCHANGED = Symbol('unchanged-history');
  let lastStoredRaw = Symbol('unread-history');
  let lastTime = 0;
  const active = new Map();
  const listeners = new Set();
  const notify = (kind, code) => { for (const listener of listeners) { try { listener({ kind, ...(code ? { code } : {}) }); } catch { /* Host notifications cannot corrupt learning events. */ } } };
  const monotonicClock = () => { const value = Date.parse(clock()); if (!Number.isFinite(value)) throw new TypeError('Atlas: invalid clock'); lastTime = Math.max(value, lastTime); return new Date(lastTime).toISOString(); };
  const newSession = events => {
    lastTime = Math.max(lastTime, ...events.map(e => Date.parse(e.at)).filter(Number.isFinite));
    return Atlas.createSession({ scope, events, clock: monotonicClock });
  };
  // The session's frozen entries themselves (no copy). Older sessions only offer copies.
  const log = () => session.snapshot ? session.snapshot() : session.events();
  const decode = raw => {
    if (raw == null) return null;
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !identifier(value.epoch) || !Array.isArray(value.events) || value.events.length > 20000
      || Object.keys(value).some(k => !['version', 'epoch', 'events', 'owner'].includes(k))) throw new Error('Atlas: unreadable history');
    // An account store must have been created for this account. Merely passing
    // account options over the guest device key never adopts its old events.
    if (storageScope === 'account' ? value.owner !== accountKey : value.owner != null) throw new Error('Atlas: local history belongs to a different storage scope');
    // Validate ownership, event links and duplicate IDs before accepting stored data.
    newSession(value.events);
    return value;
  };
  function readStored() {
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      if (raw === lastStoredRaw) return UNCHANGED;
      const stored = decode(raw); lastStoredRaw = raw; return stored;
    }
    catch { readable = false; complete = false; warning = '기록을 읽지 못해 기본 연습으로 진행해요.'; notify('storage-error', 'STORAGE_ERROR'); return null; }
  }
  const initial = readStored(); epoch = initial?.epoch || uid(); session = newSession(initial?.events || []);
  function refresh() {
    if (!readable || !storage) return;
    const stored = readStored();
    if (!stored || stored === UNCHANGED) return;
    if (stored.epoch !== epoch) { epoch = stored.epoch; session = newSession(stored.events); active.clear(); return; }
    const combined = session.events(), known = new Map(combined.map(e => [e.id, e]));
    for (const e of stored.events) {
      if (known.has(e.id)) { if (!sameEvent(known.get(e.id), e)) {
        readable = false; complete = false; warning = '기록 내용이 서로 달라 연결을 중단했어요. 기존 기록은 보존해요.';
        notify('storage-error', 'STORAGE_ERROR');
        throw Object.assign(new Error('Atlas: conflicting stored event'), { code: 'STORAGE_ERROR' });
      } }
      else { known.set(e.id, e); combined.push(e); }
    }
    session = newSession(combined);
  }
  // Byte-identical to JSON.stringify({ version, epoch, events, owner }). Log entries are
  // frozen, so each is serialised once, and since the log only grows within one session
  // object the joined text is extended rather than rebuilt on every write.
  const serialised = new WeakMap();
  const entryJson = e => { let json = serialised.get(e); if (json === undefined) { json = JSON.stringify(e); if (Object.isFrozen(e)) serialised.set(e, json); } return json; };
  let body = null;
  const snapshot = events => {
    if (!(body && body.session === session && body.count <= events.length && (body.count === 0 || events[body.count - 1] === body.last))) body = { session, count: 0, last: null, text: '' };
    for (; body.count < events.length; body.count += 1) body.text += (body.count ? ',' : '') + entryJson(events[body.count]);
    body.last = body.count ? events[body.count - 1] : null;
    return `{"version":1,"epoch":${JSON.stringify(epoch)},"events":[${body.text}]`
      + `${storageScope === 'account' ? `,"owner":${JSON.stringify(accountKey)}` : ''}}`;
  };
  function persist(kind = 'append') {
    if (!storage || !readable) { complete = false; notify('storage-error', 'STORAGE_ERROR'); return false; }
    try {
      const events = log();
      if (events.length > 20000) throw Object.assign(new Error('Atlas: local history limit'), { code: 'HISTORY_CAPACITY' });
      const raw = snapshot(events);
      storage.setItem(key, raw); lastStoredRaw = raw; writable = true; notify(kind); return true;
    } catch (error) { writable = false; complete = false; warning = '기록을 저장하지 못했어요. 이번 연습은 다음 접속에 이어지지 않을 수 있어요.'; notify('storage-error', error.code === 'HISTORY_CAPACITY' ? 'HISTORY_CAPACITY' : 'STORAGE_ERROR'); return false; }
  }
  // Initialize one shared epoch before a second game/tab opens it.
  if (!initial && readable && storage) persist();
  const practiceSession = { practice: (...args) => session.practice(...args) };
  // Derived views are rebuilt only when the log changes; the frozen snapshot is the log
  // itself, so the same array means nothing was added. Policy windows (7/30 days) move
  // with time, so a view is not reused for long even when nothing was added.
  const VIEW_MS = 60000;
  let cached = null, met = null;
  function view() {
    const events = log(), asOf = monotonicClock(), now = Date.parse(asOf);
    if (cached?.events === events && now - cached.now < VIEW_MS) return cached.summary;
    cached = { events, now, summary: Trail.summarize(events, { scope, asOf }), profiles: new Map(), counts: null };
    return cached.summary;
  }
  function profileOf(observed) {
    const ok = complete && readable && writable, flag = String(ok);
    if (cached?.summary === observed && cached.profiles.has(flag)) return cached.profiles.get(flag);
    const profile = Learning.summarizeLearning({ summary: observed, map, complete: ok });
    if (cached?.summary === observed) cached.profiles.set(flag, profile);
    return profile;
  }
  // Trail's provenance, kept current entry by entry. The log only grows within one
  // session object, so new entries are folded in; a replaced session is read again.
  // Rows are grouped by skill, difficulty and response format, as summarizeLearning() does.
  function provenance() {
    const events = log();
    if (!met || met.session !== session) met = { session, done: 0, index: Trail.createIndex({ scope }), buckets: new Map() };
    for (; met.done < events.length; met.done += 1) {
      const row = met.index.add(events[met.done]);
      if (!row?.measure) continue;
      const bucket = `${row.measure.skillId}|${row.measure.difficulty}|${row.measure.responseFormat}`;
      if (!met.buckets.has(bucket)) met.buckets.set(bucket, []);
      met.buckets.get(bucket).push(row);
    }
    return met;
  }
  // The learning state of one skill/difficulty/format: identical to the same cell of
  // summarizeLearning(), read from the index unless the log arrived out of time order.
  function basisOf(measure) {
    const known = provenance();
    if (!known.index.exact) return profileOf(view()).skills.find(s => s.id === measure.skillId).levels[measure.difficulty].formats[measure.responseFormat];
    const rows = (known.buckets.get(`${measure.skillId}|${measure.difficulty}|${measure.responseFormat}`) || []).filter(row => !row.omitted);
    return Learning.formatEvidence(rows, { now: Date.parse(monotonicClock()), complete: complete && readable && writable,
      difficulty: measure.difficulty, responseFormat: measure.responseFormat });
  }
  function summary() {
    refresh(); const observed = view();
    if (cached?.summary === observed && !cached.counts) cached.counts = Temper.measure(observed);
    return { ...profileOf(observed), storage: { available: readable && writable, scope: storageScope, warning },
      counts: cached?.summary === observed ? cached.counts : Temper.measure(observed) };
  }
  function requireActive(pid) {
    refresh(); const item = active.get(pid); if (!item) throw new Error('Atlas: presentation ended or local record reset'); return item;
  }
  const api = {
    syncPort: Object.freeze({
      scope: storageScope, accountKey,
      events() { refresh(); if (!readable || !writable) throw Object.assign(new Error('Atlas: local history is not durable'), { code: 'STORAGE_ERROR' }); return session.events(); },
      subscribe(listener) { if (typeof listener !== 'function') throw new TypeError('Atlas: listener required');listeners.add(listener);return () => listeners.delete(listener); },
      markComplete(value) { complete = value === true; },
      importEvents(incoming) {
        refresh();
        if (!readable) throw Object.assign(new Error('Atlas: local history is unreadable'), { code: 'STORAGE_ERROR' });
        if (!Array.isArray(incoming)) throw new TypeError('Atlas: imported events must be an array');
        const combined = session.events(), previousLength = combined.length, known = new Map(combined.map(event => [event.id, event]));
        for (const event of incoming) {
          if (known.has(event?.id)) {
            if (!sameEvent(known.get(event.id), event)) throw Object.assign(new Error('Atlas: conflicting imported event'), { code: 'EVENT_CONFLICT' });
          } else { known.set(event?.id, event);combined.push(event); }
        }
        // Identical durable history needs neither replay nor another disk write.
        // A previous storage failure must still retry persistence below.
        if (combined.length === previousLength && writable && snapshot(combined) === lastStoredRaw) return { added: 0 };
        // Construct before replacing: wrong scope, parent links, schema or IDs
        // reject the entire incoming batch without changing the local log.
        const imported = newSession(combined); session = imported;
        if (!persist('import')) throw Object.assign(new Error('Atlas: imported history could not be saved'), { code: 'STORAGE_ERROR' });
        return { added: combined.length - previousLength };
      },
    }),
    summary,
    recommend(candidates, options = {}) {
      const profile = summary();
      return { ...Learning.recommend({ profile, candidates, presentations: view().presentations, ...options }), storage: profile.storage };
    },
    present(item, context = {}) {
      refresh();
      if (!context || typeof context !== 'object' || Object.keys(context).some(k => k !== 'flow') || (context.flow != null && (typeof context.flow !== 'object' || Array.isArray(context.flow)))) throw new TypeError('Atlas: invalid presentation context');
      const node = map.getNode(item?.skillId);
      if (!node || node.domain !== item.modality || !identifier(item.id) || !identifier(item.itemKey)
        || !identifier(item.familyKey || item.itemKey) || ![1, 2, 3].includes(item.difficulty)
        || !Learning.RESPONSE_FORMATS.includes(item.responseFormat ?? 'unknown')) throw new TypeError('Atlas: invalid measured item');
      const measure = { skillId: item.skillId, modality: item.modality, difficulty: item.difficulty,
        responseFormat: item.responseFormat ?? 'unknown',
        familyKey: item.familyKey || item.itemKey, audioRequired: item.audioRequired ?? item.modality === 'listening', confounded: !!item.confounded };
      // Analytical exclusion cannot erase exposure to an item or its answer.
      const seen = provenance().index.met(item.itemKey, measure.familyKey);
      const basis = basisOf(measure);
      // Snapshot the actual Core state used at delivery so the choice is reviewable.
      const decision = session.plan(gameId, [{ id: item.id, minutes: 3, pace: 'standard',
        learning: { policy: Learning.POLICY.version, skillId: item.skillId, difficulty: item.difficulty, responseFormat: measure.responseFormat,
          state: basis.status, evidence: basis.evidence }, ...(context.flow ? { flow: JSON.parse(JSON.stringify(context.flow)) } : {}) }]);
      const task = { id: item.id, version: map.map_ver, itemKey: item.itemKey, concepts: [item.skillId], tags: [], measure };
      const practice = Core.createPractice({ session: practiceSession, decision, map, task,
        assess: result => ({ verdict: result.assessable === false ? 'unassessed' : result.correct == null ? 'skipped' : result.correct ? 'correct' : 'incorrect', errorTags: [] }),
        firstExposure: seen ? false : complete && readable && writable ? true : null });
      active.set(practice.presentation.id, { practice, measure, decision, audio: 'pending', results: [] }); persist();
      return practice.presentation.id;
    },
    help(pid, kind) {
      const p = requireActive(pid);
      if (!['text', 'hint', 'answer', 'replay'].includes(kind)) throw new TypeError('Atlas: invalid help kind');
      const result = p.practice.delivered({ id: kind, level: kind === 'answer' ? 'answer' : 'cue', contentRef: `${gameId}.${kind}` }); persist(); return result;
    },
    delivery(pid, { audio }) {
      const p = requireActive(pid); p.audio = audio;
      const result = session.practice('delivery', { presentationId: pid, audio }); persist(); return result;
    },
    answer(pid, result) {
      const p = requireActive(pid);
      if (!result || ![true, false, null].includes(result.correct) || typeof result.assessable !== 'boolean') throw new TypeError('Atlas: answer must identify assessability');
      const attemptNo = result.attemptNo ?? 1;
      if (!Number.isInteger(attemptNo) || attemptNo < 1 || attemptNo > p.results.length + 1) throw new TypeError('Atlas: attempts must be consecutive');
      if (p.results[attemptNo - 1]) return { ...p.results[attemptNo - 1] };
      const reason = p.measure.confounded ? (result.reason || 'visual') : p.measure.audioRequired && p.audio !== 'completed' ? 'audio'
        : !readable || !writable ? 'storage' : result.reason;
      const assessable = result.assessable && !p.measure.confounded && (!p.measure.audioRequired || p.audio === 'completed') && readable && writable;
      const attempt = p.practice.submit({ ...result, assessable }, { reason: reason || null });
      session.complete(p.decision); persist();
      // The row summarize() would give this answer, read from the index when it is exact.
      const known = provenance(), row = known.index.attempt(attempt.eventId);
      const actual = known.index.exact ? (row && !row.omitted ? row : undefined) : view().attempts.find(a => a.eventId === attempt.eventId);
      const recorded = { ...attempt, independent: !!actual?.independent && complete && writable, reason: reason || null,
        assisted: actual?.assisted ?? null, exposure: actual?.exposure ?? null };
      p.results.push(recorded); return { ...recorded };
    },
    exclude(eventId) { refresh(); const event = session.exclude(eventId); persist(); return event; },
    events() { refresh(); return session.events(); },
    reset() {
      if (storageScope === 'account') throw Object.assign(new Error('Atlas: account deletion requires the host consent/reset API; local reset cannot delete server records'), { code: 'ACCOUNT_RESET_REQUIRED' });
      epoch = uid(); session = newSession([]); active.clear(); readable = true; writable = !!storage; complete = historyComplete; warning = null; persist();
      flowPort.clear();
      return summary();
    },
  };
  // The flow memory follows the log's epoch, so a reset in another tab is not undone from here.
  flowPort = createFlowPort({ storage, key, clock: monotonicClock, epoch: () => { try { refresh(); } catch { /* the log reports its own error */ } return epoch; } });
  api.today = flowPort.today;
  api.setToday = flowPort.setToday;
  api.live = createLive({ coach: api, port: flowPort, clock: monotonicClock });
  return api;
}
module.exports = { createGame, createLearningSync, summarizeLearning: Learning.summarizeLearning, recommend: Learning.recommend, POLICY: Learning.POLICY, RESPONSE_FORMATS: Learning.RESPONSE_FORMATS, KEY };
