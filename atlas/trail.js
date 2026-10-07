/* SYNK Trail: read practice provenance from the existing Atlas session log.
 * Pure and local: no second profile, persistence, model call or raw learner text.
 * Exclusion removes analytical evidence, never the fact that an answer was seen.
 *
 * `firstExposure` on a presentation answers "has this learner met this item
 * before?" from the history the game keeps:
 *   true  - the history is complete and has no earlier attempt or reveal of this item;
 *   false - the history shows the item was attempted or revealed before;
 *   null  - the game cannot tell (history unreadable or known to be partial).
 * Only a first exposure without help can become independent evidence.
 *
 * A game round:
 *   history = openHistory(stored, pending)        at the start (see openHistory)
 *   history.firstExposure(itemKey)                for each item presented
 *   practice.met()  -> append to `pending`        right after an answer or a reveal, so an
 *                                                 app killed mid-round still knows what was seen
 *   summary = summarize(log, { ...state, decisions: [decision.id] })   at the end
 *   growth(summary, history)                      facts worth telling the learner
 *   stored = remember(history, summary)           save it and clear `pending`; null means
 *                                                 the stored value could not be read: keep it
 * The history holds one small record per item met: no response text, help text or identity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTrail = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'trail-practice-2';
  const TYPES = ['practice.presented', 'practice.helped', 'practice.attempted', 'practice.delivery'];
  const BASE = ['schema', 'id', 'scope', 'at', 'recordedAt', 'type'];
  const FIELDS = {
    'practice.presented': ['decisionId', 'taskId', 'taskVersion', 'itemKey', 'conceptIds', 'firstExposure'],
    'practice.helped': ['presentationId', 'helpId', 'level', 'contentRef'],
    'practice.attempted': ['presentationId', 'attemptNo', 'verdict', 'errorTags'],
    'practice.delivery': ['presentationId', 'audio'],
  };
  const OPTIONAL = { 'practice.presented': ['measure'], 'practice.attempted': ['reason', 'choice'] };
  const VERDICTS = ['correct', 'incorrect', 'unassessed', 'skipped'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  // Authored option IDs only: no answer text, identity, diagnosis or change to the verdict.
  function choiceRecord(value) {
    const optionId = entry => typeof entry === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(entry)
      && !['constructor', 'prototype', '__proto__'].includes(entry);
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'selectedId') || !Object.hasOwn(value, 'correctId')
      || !optionId(value.selectedId) || !optionId(value.correctId)) throw new TypeError('Trail: invalid choice IDs');
    return { selectedId: value.selectedId, correctId: value.correctId };
  }
  const time = value => { const n = Date.parse(value); if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Trail: invalid time'); return n; };
  const key = scope => {
    if (!scope || typeof scope !== 'object' || Object.keys(scope).some(k => !['domain', 'workspace', 'subject'].includes(k))
      || !['LAB', 'SHIFT', 'PATH'].includes(scope.domain) || !id(scope.workspace) || !id(scope.subject)) throw new TypeError('Trail: invalid practice scope');
    return `${scope.domain}/${scope.workspace}/${scope.subject}`;
  };
  // Entries a session log has admitted: checked once and deep-frozen, so reading the log
  // again neither re-validates them nor parses their times. Anything else is checked in full.
  const vouched = new WeakMap();
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const k of Object.keys(value)) freeze(value[k]); }
    return value;
  };
  const scopeOf = e => vouched.get(e)?.scope ?? key(e.scope);
  const atOf = e => vouched.get(e)?.at ?? time(e.at);
  const recordedOf = e => vouched.get(e)?.recordedAt ?? time(e.recordedAt);
  const uniqueList = (values, valid, max) => Array.isArray(values) && values.length <= max && values.every(valid) && new Set(values).size === values.length;
  const tag = v => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 120 && !/[\r\n]/.test(v);
  function validate(event) {
    if (!event || !TYPES.includes(event.type) || event.schema !== 1 || !id(event.id)) throw new TypeError('Trail: invalid practice event');
    const fields = [...BASE, ...FIELDS[event.type]];
    if (Object.keys(event).some(k => !fields.includes(k) && !(OPTIONAL[event.type] || []).includes(k)) || fields.some(k => !Object.hasOwn(event, k))) throw new TypeError('Trail: unexpected or missing practice field');
    key(event.scope);
    if (time(event.recordedAt) < time(event.at)) throw new TypeError('Trail: recorded before occurrence');
    if (event.type === TYPES[0]) {
      if (![event.decisionId, event.taskId, event.taskVersion, event.itemKey].every(id)
        || !uniqueList(event.conceptIds, id, 32) || ![true, false, null].includes(event.firstExposure)) throw new TypeError('Trail: invalid presentation');
      if (event.measure != null) {
        const m = event.measure, keys = ['skillId', 'modality', 'difficulty', 'familyKey', 'audioRequired', 'confounded'];
        if (Object.keys(m).some(k => !keys.includes(k) && k !== 'responseFormat') || keys.some(k => !Object.hasOwn(m, k))
          || !id(m.skillId) || !event.conceptIds.includes(m.skillId) || !id(m.familyKey)
          || typeof m.modality !== 'string' || !/^[a-z][a-z0-9_-]{0,40}$/.test(m.modality) || ![1, 2, 3].includes(m.difficulty)
          || (Object.hasOwn(m, 'responseFormat') && !['binary-choice', 'single-choice', 'cup-compose', 'action', 'unknown'].includes(m.responseFormat))
          || typeof m.audioRequired !== 'boolean' || typeof m.confounded !== 'boolean') throw new TypeError('Trail: invalid measurement contract');
      }
    } else if (event.type === TYPES[1]) {
      if (![event.presentationId, event.helpId, event.contentRef].every(id) || !['cue', 'explanation', 'answer'].includes(event.level)) throw new TypeError('Trail: invalid help');
    } else if (event.type === TYPES[3]) {
      if (!id(event.presentationId) || !['pending', 'completed', 'failed'].includes(event.audio)) throw new TypeError('Trail: invalid audio delivery');
    } else if (!id(event.presentationId) || !Number.isInteger(event.attemptNo) || event.attemptNo < 1
      || !VERDICTS.includes(event.verdict) || !uniqueList(event.errorTags, tag, 24)
      || (event.reason != null && !['motor', 'audio', 'unanswered', 'demo', 'visual', 'storage'].includes(event.reason))) throw new TypeError('Trail: invalid attempt');
    if (event.type === TYPES[2] && Object.hasOwn(event, 'choice')) choiceRecord(event.choice);
    return event;
  }
  function linked(event, prior, parent, attempts) {
    if (!vouched.has(event)) validate(event);
    if (prior) {
      if (canonical(prior) !== canonical(event)) throw new Error('Trail: conflicting event id');
      return event;
    }
    const presented = event.type === TYPES[0];
    if (!parent || parent.type !== (presented ? 'decision.made' : TYPES[0]) || scopeOf(parent) !== scopeOf(event)
      || atOf(parent) > atOf(event) || recordedOf(parent) > recordedOf(event)) throw new Error('Trail: practice requires a prior parent in the same scope');
    if (event.type === TYPES[2]) {
      if (event.attemptNo !== attempts.count + 1 || attempts.latest > atOf(event)) throw new Error('Trail: attempt sequence must be consecutive');
    }
    return event;
  }
  // A session that keeps its own index links one new event without scanning the log.
  const link = (event, parent, attempts) => linked(event, null, parent, attempts);
  // The session vouches for an entry it has admitted and will never change: practice
  // events are validated here, other events only need their scope and times.
  function vouch(event) {
    if (TYPES.includes(event?.type)) validate(event);
    else if (!event?.scope || ![event.scope.domain, event.scope.workspace, event.scope.subject].every(v => typeof v === 'string')) throw new TypeError('Trail: invalid log entry');
    freeze(event);
    vouched.set(event, { scope: `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`, at: time(event.at), recordedAt: time(event.recordedAt) });
    return event;
  }
  function checkLink(events, event) {
    const attempts = { count: 0, latest: -Infinity };
    for (const earlier of events) if (earlier.type === TYPES[2] && earlier.presentationId === event.presentationId) {
      attempts.count += 1; attempts.latest = Math.max(attempts.latest, time(earlier.at));
    }
    return linked(event, events.find(e => e.id === event.id),
      events.find(e => e.id === (event.type === TYPES[0] ? event.decisionId : event.presentationId)), attempts);
  }
  // An attempt's provenance from what came before it. `prior(kinds)` says whether help,
  // a reveal or an attempt on the same item or family came earlier. Shared by summarize()
  // and createIndex() so the batch reading and the incremental one cannot drift apart.
  function judge(event, p, prior, audio) {
    const assisted = prior(['help', 'answer']) ? true : p.firstExposure === true ? false : null;
    const exposure = prior(['attempt', 'answer']) || p.firstExposure === false ? 'repeat' : p.firstExposure === true ? 'new' : 'unknown';
    // Delivery is an actual observation, never inferred from play() being called.
    // Later audio completion cannot rehabilitate an answer made before delivery.
    const usableDelivery = !p.measure || (!p.measure.confounded && (!p.measure.audioRequired || audio === 'completed'));
    const exclusionReason = event.reason || (p.measure?.confounded ? 'visual' : !usableDelivery ? 'audio' : null);
    return { assisted, exposure, usableDelivery, exclusionReason,
      independent: !exclusionReason && usableDelivery && assisted === false && exposure === 'new' && ['correct', 'incorrect'].includes(event.verdict) };
  }
  const attemptRow = (event, p, arm, audio, j) => ({
    eventId: event.id, at: event.at, recordedAt: event.recordedAt,
    presentationId: p.id, decisionId: p.decisionId, arm,
    taskId: p.taskId, taskVersion: p.taskVersion, itemKey: p.itemKey, conceptIds: [...p.conceptIds],
    attemptNo: event.attemptNo, verdict: event.verdict, errorTags: [...event.errorTags], assisted: j.assisted, exposure: j.exposure,
    ...(Object.hasOwn(event, 'choice') ? { choice: choiceRecord(event.choice) } : {}),
    ...(p.measure ? { measure: { ...p.measure, responseFormat: p.measure.responseFormat || 'unknown' }, audio, exclusionReason: j.exclusionReason }
      : j.exclusionReason ? { exclusionReason: j.exclusionReason } : {}),
    independent: j.independent,
  });
  const traceKeys = p => [`item:${p.itemKey}`, ...(p.measure ? [`family:${p.measure.familyKey}`] : [])];
  // A folded ledger (learning-ledger.js) keeps, per trace key, which kinds happened in entries
  // folded away: they all came before anything still in the log.
  const BITS = Object.freeze({ attempt: 1, answer: 2, help: 4 });
  const foldedBefore = (prior, traceKey, kind) => !!prior && Object.prototype.hasOwnProperty.call(prior.keys, traceKey)
    && (prior.keys[traceKey] & BITS[kind]) !== 0;
  // `decisions` limits what is reported (for example one round); evidence from the whole
  // log still decides what came before. `met` always covers the whole log.
  function summarize(events, { scope, asOf, recordedAsOf = asOf, decisions = null, prior = null } = {}) {
    const scopeId = key(scope), cutoff = time(asOf), recordedCutoff = time(recordedAsOf);
    if (!Array.isArray(events)) throw new TypeError('Trail: log must be an array');
    if (decisions !== null && (!Array.isArray(decisions) || !decisions.every(id))) throw new TypeError('Trail: invalid decision filter');
    const reported = decisionId => decisions === null || decisions.includes(decisionId);
    const all = [], seen = new Map(), attemptOrder = new Map();
    for (const event of events) {
      if (!event || !event.scope || (vouched.get(event)?.scope ?? `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`) !== scopeId) continue;
      if (seen.has(event.id)) {
        if (canonical(seen.get(event.id)) !== canonical(event)) throw new Error('Trail: conflicting event id');
        continue;
      }
      if (TYPES.includes(event.type)) linked(event, null,
        seen.get(event.type === TYPES[0] ? event.decisionId : event.presentationId),
        attemptOrder.get(event.presentationId) || { count: 0, latest: -Infinity });
      if (event.type === TYPES[2]) {
        const earlier = attemptOrder.get(event.presentationId) || { count: 0, latest: -Infinity };
        attemptOrder.set(event.presentationId, { count: earlier.count + 1, latest: Math.max(earlier.latest, atOf(event)) });
      }
      seen.set(event.id, event); all.push(event);
    }
    // The log is in the order things happened in the app; a device clock can step back.
    // Help, a reveal or an attempt earlier in either order counts as prior evidence.
    const visible = all.filter(e => atOf(e) <= cutoff && recordedOf(e) <= recordedCutoff);
    const excluded = new Set(visible.filter(e => e.type === 'record.excluded').map(e => e.targetId));
    // The comparison arm is recorded on the decision; practice only points to it.
    const arms = new Map(visible.filter(e => e.type === 'decision.made').map(e => [e.id, e.arm ?? null]));
    const provenance = new Map(), traces = new Map();
    // A family can be open in two games before either one is answered. Check
    // actual help/attempt order across its variants, not only the snapshot at
    // presentation time. Keep the item key as well for legacy presentations.
    visible.forEach((event, index) => {
      if (event.type === TYPES[0]) provenance.set(event.id, event);
      const p = provenance.get(event.presentationId);
      // A visible child without its recorded parent is not usable evidence.
      if ((event.type !== TYPES[1] && event.type !== TYPES[2]) || !p) return;
      for (const traceKey of traceKeys(p)) {
        if (!traces.has(traceKey)) traces.set(traceKey, new Map());
        const trace = traces.get(traceKey), kind = event.type === TYPES[2] ? 'attempt' : event.level === 'answer' ? 'answer' : 'help';
        const earlier = trace.get(kind);
        trace.set(kind, { index: Math.min(earlier?.index ?? Infinity, index), at: Math.min(earlier?.at ?? Infinity, atOf(event)) });
      }
    });
    const presentations = [], help = [], attempts = [], met = new Map(), audioByPresentation = new Map();
    // The first time each item was attempted or its answer shown, excluded or not:
    // exclusion removes analytical evidence, never the fact that the item was met.
    const meet = (p, at, verdict) => { if (!met.has(p.itemKey)) met.set(p.itemKey, { itemKey: p.itemKey, conceptIds: [...p.conceptIds], at, verdict }); };
    let excludedAttempts = 0;
    visible.forEach((event, index) => {
      // A withdrawn delivery is no longer proof that the required audio arrived.
      // Keep it as unknown instead of reviving an earlier completion report.
      if (event.type === TYPES[3]) { audioByPresentation.set(event.presentationId, excluded.has(event.id) ? 'pending' : event.audio); return; }
      if (event.type === TYPES[0]) {
        if (reported(event.decisionId) && !excluded.has(event.id) && !excluded.has(event.decisionId)) presentations.push({
          eventId: event.id, at: event.at, recordedAt: event.recordedAt,
          decisionId: event.decisionId, taskId: event.taskId, taskVersion: event.taskVersion,
          itemKey: event.itemKey, conceptIds: [...event.conceptIds], firstExposure: event.firstExposure,
          ...(event.measure ? { measure: { ...event.measure, responseFormat: event.measure.responseFormat || 'unknown' } } : {}),
        });
        return;
      }
      const p = provenance.get(event.presentationId);
      if ((event.type !== TYPES[1] && event.type !== TYPES[2]) || !p) return;
      const omitted = excluded.has(event.id) || excluded.has(p.id) || excluded.has(p.decisionId);
      const shown = reported(p.decisionId) && !omitted;
      if (event.type === TYPES[1]) {
        if (event.level === 'answer') meet(p, event.at, null);
        if (shown) help.push({ eventId: event.id, at: event.at, recordedAt: event.recordedAt,
          presentationId: p.id, helpId: event.helpId, level: event.level, contentRef: event.contentRef });
        return;
      }
      const at = atOf(event);
      const earlier = kinds => traceKeys(p).some(traceKey => kinds.some(kind => {
        if (foldedBefore(prior, traceKey, kind)) return true;
        const first = traces.get(traceKey)?.get(kind);
        return first && (first.index < index || first.at < at);
      }));
      const audio = audioByPresentation.get(p.id) || 'pending', j = judge(event, p, earlier, audio);
      // A first attempt made after the answer was shown was met at the reveal, not here.
      meet(p, event.at, omitted || j.exclusionReason ? null : event.verdict);
      if (!reported(p.decisionId)) return;
      if (omitted) { excludedAttempts += 1; return; }
      attempts.push(attemptRow(event, p, arms.get(p.decisionId) ?? null, audio, j));
    });
    return { version: VERSION, scope: copy(scope), asOf, recordedAsOf, decisions: decisions === null ? null : [...decisions],
      presentations, help, attempts, excludedAttempts, met: [...met.values()], persistence: 'provided-log-only', learningEffectClaim: false };
  }
  /* The same provenance as summarize(), kept current one entry at a time, for a session
   * that appends in time order (a monotonic clock). add() takes each new log entry and,
   * for an attempt, returns the row summarize() would give it (with `omitted` when an
   * exclusion covers it). If an entry ever arrives out of time order, earlier answers
   * could change, so `exact` turns false for good and callers read the whole log again.
   * met(itemKey, familyKey): was this item or family attempted or revealed already? */
  function createIndex({ scope, prior = null }) {
    const scopeId = key(scope);
    const presentations = new Map(), audio = new Map(), deliveries = new Map(), audioCover = new Map(), arms = new Map(), excluded = new Set();
    const helped = new Set(), seen = new Set(), rows = new Map(), covering = new Map();
    // Folded entries came before everything here: seed what they did.
    for (const [k, bits] of Object.entries(prior?.keys || {})) {
      if (bits & BITS.attempt) { seen.add(`attempt|${k}`); seen.add(k); }
      if (bits & BITS.answer) { helped.add(`answer|${k}`); seen.add(k); }
      if (bits & BITS.help) helped.add(`help|${k}`);
    }
    let lastAt = -Infinity, exact = true;
    const cover = (target, row) => { if (!covering.has(target)) covering.set(target, []); covering.get(target).push(row); };
    function add(event) {
      if (!event || !event.scope || (vouched.get(event)?.scope ?? `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`) !== scopeId) return null;
      // An entry recorded later than the next one's time means the log is not in time order.
      const at = atOf(event);
      if (at < lastAt) exact = false;
      lastAt = Math.max(lastAt, at, recordedOf(event));
      if (event.type === 'decision.made') { arms.set(event.id, event.arm ?? null); return null; }
      if (event.type === 'record.excluded') {
        excluded.add(event.targetId);
        for (const row of covering.get(event.targetId) || []) row.omitted = true;
        const current = audio.get(deliveries.get(event.targetId));
        if (current?.id === event.targetId) current.value = 'pending';
        // Update only attempts whose original delivery proof was withdrawn.
        // A later completed playback never rehabilitates an earlier answer.
        for (const row of audioCover.get(event.targetId) || []) {
          row.audio = 'pending';
          if (row.measure.audioRequired) { row.independent = false; row.exclusionReason ||= 'audio'; }
        }
        return null;
      }
      if (event.type === TYPES[0]) { presentations.set(event.id, event); return null; }
      if (event.type === TYPES[3]) {
        deliveries.set(event.id, event.presentationId);
        audio.set(event.presentationId, { id: event.id, value: excluded.has(event.id) ? 'pending' : event.audio });
        return null;
      }
      if (event.type !== TYPES[1] && event.type !== TYPES[2]) return null;
      // A visible child without its recorded parent is not usable evidence.
      const p = presentations.get(event.presentationId);
      if (!p) return null;
      const keys = traceKeys(p);
      if (event.type === TYPES[1]) {
        for (const k of keys) { helped.add(`help|${k}`); if (event.level === 'answer') { helped.add(`answer|${k}`); seen.add(k); } }
        return null;
      }
      const prior = kinds => keys.some(k => kinds.some(kind => kind === 'attempt' ? seen.has(`attempt|${k}`) : helped.has(`${kind}|${k}`)));
      const proof = audio.get(p.id), delivered = proof?.value || 'pending';
      const row = attemptRow(event, p, arms.get(p.decisionId) ?? null, delivered, judge(event, p, prior, delivered));
      if (proof && row.measure) {
        if (!audioCover.has(proof.id)) audioCover.set(proof.id, []);
        audioCover.get(proof.id).push(row);
      }
      row.omitted = excluded.has(event.id) || excluded.has(p.id) || excluded.has(p.decisionId);
      for (const k of keys) { seen.add(`attempt|${k}`); seen.add(k); }
      for (const target of [event.id, p.id, p.decisionId]) cover(target, row);
      rows.set(event.id, row);
      return row;
    }
    return {
      add,
      get exact() { return exact; },
      attempt: eventId => rows.get(eventId) || null,
      met: (itemKey, familyKey) => seen.has(`item:${itemKey}`) || (familyKey != null && seen.has(`family:${familyKey}`)),
    };
  }
  // Exactly these four fields: a history must never carry response text or identity.
  const RECORD = ['itemKey', 'conceptIds', 'at', 'verdict'];
  const record = r => !!r && typeof r === 'object' && Object.keys(r).length === RECORD.length && RECORD.every(k => Object.hasOwn(r, k))
    && id(r.itemKey) && uniqueList(r.conceptIds, id, 32)
    && typeof r.at === 'string' && Number.isFinite(Date.parse(r.at)) && (r.verdict === null || VERDICTS.includes(r.verdict));
  const frozen = r => Object.freeze({ ...copy(r), conceptIds: Object.freeze([...r.conceptIds]) });
  /* Open the stored history once per round. `stored` is what the host knows:
   *   { records: [], partial: false }  a new learner with no earlier play anywhere
   *   { records: [], partial: true }   an existing learner whose earlier play is not here
   *   the value `remember` returned last time, otherwise.
   * `pending` holds records the host appended during a round that never reached
   * `remember` (the app was closed); they count as met. A pending list that cannot be
   * read makes the history partial. A stored value that cannot be read (a failed read,
   * broken or newer data) opens as unreadable: no item is a first exposure, and
   * `remember` returns null so the stored value is never replaced. */
  function openHistory(stored, pending = []) {
    const readable = !!stored && typeof stored === 'object' && Array.isArray(stored.records) && typeof stored.partial === 'boolean'
      && stored.records.every(record) && new Set(stored.records.map(r => r.itemKey)).size === stored.records.length;
    const pendingOk = Array.isArray(pending) && pending.every(record);
    const records = [], index = new Set();
    if (readable) for (const r of [...stored.records, ...(pendingOk ? pending : [])]) if (!index.has(r.itemKey)) { index.add(r.itemKey); records.push(frozen(r)); }
    const partial = readable ? stored.partial || !pendingOk : true;
    return Object.freeze({ readable, partial, records: Object.freeze(records),
      firstExposure: itemKey => !readable || !id(itemKey) ? null : index.has(itemKey) ? false : partial ? null : true });
  }
  // Only a history that went through openHistory is used: raw stored values are never trusted.
  const opened = history => !!history && typeof history.firstExposure === 'function' && typeof history.readable === 'boolean'
    && Array.isArray(history.records) && typeof history.partial === 'boolean' && history.records.every(record);
  // What to store after the round: earlier records unchanged, items first met now added.
  function remember(history, summary) {
    if (!opened(history)) throw new TypeError('Trail: open the history first');
    if (!summary || summary.version !== VERSION || !Array.isArray(summary.met)) throw new TypeError('Trail: use a practice summary');
    if (!history.readable) return null;
    const known = new Set(history.records.map(r => r.itemKey));
    const added = summary.met.filter(r => record(r) && !known.has(r.itemKey));
    return { records: [...history.records, ...added].map(copy), partial: history.partial };
  }
  /* Qualification for the legacy learning policy, not a universal product success score.
   * The summary must come from summarize(), which checks help, delivery, exclusions and
   * first exposure. The host still owns identity and source authorization. Snapshot the
   * proof fields once so later mutation of the caller's summary cannot change this view.
   * Core supplies the time window and owns scoring/choice; Trail only returns source IDs. */
  function createPracticeOutcomeIndex(summary) {
    if (!summary || summary.version !== VERSION || !Array.isArray(summary.attempts)) throw new TypeError('Trail: use a practice summary');
    const owner = key(summary.scope), cutoff = time(summary.asOf), recordedCutoff = time(summary.recordedAsOf ?? summary.asOf);
    const attempts = new Map();
    for (const item of summary.attempts) {
      if (!id(item.eventId) || !id(item.presentationId) || !id(item.decisionId) || !Array.isArray(item.conceptIds)
        || item.conceptIds.some(value => !id(value)) || attempts.has(item.eventId)) throw new TypeError('Trail: invalid practice outcome evidence');
      const at = time(item.at), recordedAt = time(item.recordedAt);
      if (recordedAt < at || at > cutoff || recordedAt > recordedCutoff) throw new TypeError('Trail: practice evidence outside summary');
      attempts.set(item.eventId, { eventId: item.eventId, presentationId: item.presentationId, decisionId: item.decisionId,
        conceptIds: [...item.conceptIds], at, recordedAt, qualified: item.independent === true && item.assisted === false
          && item.exposure === 'new' && item.verdict === 'correct' && !item.exclusionReason });
    }
    return Object.freeze({ find(outcome, { targetLine, since, maxAgeMs } = {}) {
      if (!outcome || outcome.type !== 'outcome.observed' || !id(outcome.id) || key(outcome.scope) !== owner
        || typeof targetLine !== 'string' || !/^(need|due|trait):[a-zA-Z0-9_.:-]{1,120}$/.test(targetLine)
        || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError('Trail: invalid practice outcome query');
      const start = time(since), at = time(outcome.at), recordedAt = time(outcome.recordedAt);
      if (at > cutoff || recordedAt > recordedCutoff || recordedAt < at || at < start || cutoff - at > maxAgeMs
        || outcome.measure !== 'independent' || outcome.assisted !== false || outcome.targetLine !== targetLine) return null;
      const attempt = attempts.get(outcome.attemptId);
      // A curriculum need names its Strata concept, including the legacy skill/node prefixes.
      const concept = targetLine.replace(/^(need|due):/, '').replace(/^(skill|node)\./, '');
      if (!attempt?.qualified || attempt.decisionId !== outcome.decisionId || !attempt.conceptIds.includes(concept)
        || attempt.at < start || attempt.at > at || attempt.recordedAt > recordedAt || cutoff - attempt.at > maxAgeMs) return null;
      return { evidence: [outcome.id, attempt.eventId, attempt.presentationId] };
    } });
  }
  /* "It was wrong before; today a new item was right on its own."
   * `history` is the one opened at the start of this round. A fact needs a wrong first
   * attempt on the same primary concept (the first conceptId) and a later independent
   * correct attempt on an item the history does not hold yet. One fact per concept.
   * Nothing else is inferred: no mastery, cause or trend. */
  function growth(summary, history) {
    if (!summary || summary.version !== VERSION || !Array.isArray(summary.attempts)) throw new TypeError('Trail: use a practice summary');
    if (!opened(history)) throw new TypeError('Trail: open the history first');
    const earlier = history.records, known = new Set(earlier.map(r => r.itemKey));
    const facts = [], told = new Set();
    for (const now of summary.attempts) {
      const concept = now.conceptIds[0];
      if (!now.independent || now.verdict !== 'correct' || !concept || told.has(concept) || known.has(now.itemKey)) continue;
      const before = earlier.filter(p => p.verdict === 'incorrect' && p.itemKey !== now.itemKey
        && p.conceptIds[0] === concept && Date.parse(p.at) < time(now.at))
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
      if (!before) continue;
      told.add(concept);
      facts.push({ conceptId: concept, before: { itemKey: before.itemKey, at: before.at },
        now: { attemptId: now.eventId, itemKey: now.itemKey, at: now.at } });
    }
    return facts;
  }
  return Object.freeze({ VERSION, TYPES, BITS, traceKeys, choiceRecord, validate, checkLink, link, vouch, summarize, createIndex, createPracticeOutcomeIndex, openHistory, remember, growth });
});
