'use strict';
// Thin host adapter. The one persisted source is the Atlas event log, not a second profile.
// A browser key identifies THIS DEVICE's local practice, never an authenticated learner.
const Atlas = require('./engine');
const Core = require('./education');
const Trail = require('./trail');
const Learning = require('./learning');
const Temper = require('./temper');
const KEY = 'synk.atlas.learning.v1';
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const uid = () => `l${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
function createGame({ gameId, map, storage = null, learnerKey = 'device', clock = () => new Date().toISOString(), historyComplete = true } = {}) {
  if (!identifier(gameId) || !identifier(learnerKey) || typeof map?.allNodes !== 'function') throw new TypeError('Atlas: game, local scope and Strata map required');
  const scope = { domain: 'LAB', workspace: 'learning', subject: learnerKey };
  const key = `${KEY}.${learnerKey}`;
  let epoch = null, session, readable = true, writable = !!storage, complete = historyComplete, warning = null;
  const UNCHANGED = Symbol('unchanged-history');
  let lastStoredRaw = Symbol('unread-history');
  let lastTime = 0;
  const active = new Map();
  const monotonicClock = () => { const value = Date.parse(clock()); if (!Number.isFinite(value)) throw new TypeError('Atlas: invalid clock'); lastTime = Math.max(value, lastTime); return new Date(lastTime).toISOString(); };
  const newSession = events => {
    lastTime = Math.max(lastTime, ...events.map(e => Date.parse(e.at)).filter(Number.isFinite));
    return Atlas.createSession({ scope, events, clock: monotonicClock });
  };
  const decode = raw => {
    if (raw == null) return null;
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !identifier(value.epoch) || !Array.isArray(value.events) || value.events.length > 20000
      || Object.keys(value).some(k => !['version', 'epoch', 'events'].includes(k))) throw new Error('Atlas: unreadable history');
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
    catch { readable = false; complete = false; warning = '기록을 읽지 못해 기본 연습으로 진행해요.'; return null; }
  }
  const initial = readStored(); epoch = initial?.epoch || uid(); session = newSession(initial?.events || []);
  function refresh() {
    if (!readable || !storage) return;
    const stored = readStored();
    if (!stored || stored === UNCHANGED) return;
    if (stored.epoch !== epoch) { epoch = stored.epoch; session = newSession(stored.events); active.clear(); return; }
    const combined = session.events(), known = new Map(combined.map(e => [e.id, e]));
    for (const e of stored.events) {
      if (known.has(e.id)) { if (JSON.stringify(known.get(e.id)) !== JSON.stringify(e)) { readable = false; complete = false; throw new Error('Atlas: conflicting stored event'); } }
      else { known.set(e.id, e); combined.push(e); }
    }
    session = newSession(combined);
  }
  function persist() {
    if (!storage || !readable) { complete = false; return; }
    try {
      const events = session.events();
      if (events.length > 20000) throw new Error('Atlas: local history limit');
      const raw = JSON.stringify({ version: 1, epoch, events });
      storage.setItem(key, raw); lastStoredRaw = raw; writable = true;
    } catch { writable = false; complete = false; warning = '기록을 저장하지 못했어요. 이번 연습은 다음 접속에 이어지지 않을 수 있어요.'; }
  }
  // Initialize one shared epoch before a second game/tab opens it.
  if (!initial && readable && storage) persist();
  const practiceSession = { practice: (...args) => session.practice(...args) };
  function view() {
    const events = session.events(), state = session.state();
    return Trail.summarize(events, { scope, asOf: state.asOf });
  }
  function summary() {
    refresh(); const observed = view();
    return { ...Learning.summarizeLearning({ summary: observed, map, complete: complete && readable && writable }),
      storage: { available: readable && writable, scope: 'device', warning }, counts: Temper.measure(observed) };
  }
  function requireActive(pid) {
    refresh(); const item = active.get(pid); if (!item) throw new Error('Atlas: presentation ended or local record reset'); return item;
  }
  return {
    summary,
    recommend(candidates, options = {}) {
      const profile = summary();
      return { ...Learning.recommend({ profile, candidates, presentations: view().presentations, ...options }), storage: profile.storage };
    },
    present(item) {
      refresh();
      const node = map.getNode(item?.skillId);
      if (!node || node.domain !== item.modality || !identifier(item.id) || !identifier(item.itemKey)
        || !identifier(item.familyKey || item.itemKey) || ![1, 2, 3].includes(item.difficulty)
        || !Learning.RESPONSE_FORMATS.includes(item.responseFormat ?? 'unknown')) throw new TypeError('Atlas: invalid measured item');
      const measure = { skillId: item.skillId, modality: item.modality, difficulty: item.difficulty,
        responseFormat: item.responseFormat ?? 'unknown',
        familyKey: item.familyKey || item.itemKey, audioRequired: item.audioRequired ?? item.modality === 'listening', confounded: !!item.confounded };
      // Analytical exclusion cannot erase exposure to an item or its answer.
      const raw = session.events(), presented = new Map(raw.filter(e => e.type === 'practice.presented').map(e => [e.id, e]));
      const seen = raw.some(e => {
        const p = presented.get(e.presentationId);
        return p && (p.itemKey === item.itemKey || p.measure?.familyKey === measure.familyKey)
          && (e.type === 'practice.attempted' || e.type === 'practice.helped' && e.level === 'answer');
      });
      const profile = Learning.summarizeLearning({ summary: view(), map, complete: complete && readable && writable });
      const basis = profile.skills.find(s => s.id === item.skillId).levels[item.difficulty].formats[measure.responseFormat];
      // Snapshot the actual Core state used at delivery so the choice is reviewable.
      const decision = session.plan(gameId, [{ id: item.id, minutes: 3, pace: 'standard',
        learning: { policy: Learning.POLICY.version, skillId: item.skillId, difficulty: item.difficulty, responseFormat: measure.responseFormat,
          state: basis.status, evidence: basis.evidence } }]);
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
      const actual = view().attempts.find(a => a.eventId === attempt.eventId);
      const recorded = { ...attempt, independent: !!actual?.independent && complete && writable, reason: reason || null };
      p.results.push(recorded); return { ...recorded };
    },
    exclude(eventId) { refresh(); const event = session.exclude(eventId); persist(); return event; },
    events() { refresh(); return session.events(); },
    reset() {
      epoch = uid(); session = newSession([]); active.clear(); readable = true; writable = !!storage; complete = historyComplete; warning = null; persist();
      return summary();
    },
  };
}
module.exports = { createGame, summarizeLearning: Learning.summarizeLearning, recommend: Learning.recommend, POLICY: Learning.POLICY, RESPONSE_FORMATS: Learning.RESPONSE_FORMATS, KEY };
