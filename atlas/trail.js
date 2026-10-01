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
  const TYPES = ['practice.presented', 'practice.helped', 'practice.attempted'];
  const BASE = ['schema', 'id', 'scope', 'at', 'recordedAt', 'type'];
  const FIELDS = {
    'practice.presented': ['decisionId', 'taskId', 'taskVersion', 'itemKey', 'conceptIds', 'firstExposure'],
    'practice.helped': ['presentationId', 'helpId', 'level', 'contentRef'],
    'practice.attempted': ['presentationId', 'attemptNo', 'verdict', 'errorTags'],
  };
  const VERDICTS = ['correct', 'incorrect', 'unassessed', 'skipped'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  const time = value => { const n = Date.parse(value); if (typeof value !== 'string' || !Number.isFinite(n)) throw new TypeError('Trail: invalid time'); return n; };
  const key = scope => {
    if (!scope || typeof scope !== 'object' || Object.keys(scope).some(k => !['domain', 'workspace', 'subject'].includes(k))
      || !['LAB', 'SHIFT', 'PATH'].includes(scope.domain) || !id(scope.workspace) || !id(scope.subject)) throw new TypeError('Trail: invalid practice scope');
    return `${scope.domain}/${scope.workspace}/${scope.subject}`;
  };
  const uniqueList = (values, valid, max) => Array.isArray(values) && values.length <= max && values.every(valid) && new Set(values).size === values.length;
  const tag = v => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 120 && !/[\r\n]/.test(v);
  function validate(event) {
    if (!event || !TYPES.includes(event.type) || event.schema !== 1 || !id(event.id)) throw new TypeError('Trail: invalid practice event');
    const fields = [...BASE, ...FIELDS[event.type]];
    if (Object.keys(event).some(k => !fields.includes(k)) || fields.some(k => !Object.hasOwn(event, k))) throw new TypeError('Trail: unexpected or missing practice field');
    key(event.scope);
    if (time(event.recordedAt) < time(event.at)) throw new TypeError('Trail: recorded before occurrence');
    if (event.type === TYPES[0]) {
      if (![event.decisionId, event.taskId, event.taskVersion, event.itemKey].every(id)
        || !uniqueList(event.conceptIds, id, 32) || ![true, false, null].includes(event.firstExposure)) throw new TypeError('Trail: invalid presentation');
    } else if (event.type === TYPES[1]) {
      if (![event.presentationId, event.helpId, event.contentRef].every(id) || !['cue', 'explanation', 'answer'].includes(event.level)) throw new TypeError('Trail: invalid help');
    } else if (!id(event.presentationId) || !Number.isInteger(event.attemptNo) || event.attemptNo < 1
      || !VERDICTS.includes(event.verdict) || !uniqueList(event.errorTags, tag, 24)) throw new TypeError('Trail: invalid attempt');
    return event;
  }
  function checkLink(events, event) {
    validate(event);
    const prior = events.find(e => e.id === event.id);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(event)) throw new Error('Trail: conflicting event id');
      return event;
    }
    const presented = event.type === TYPES[0];
    const parent = events.find(e => e.id === (presented ? event.decisionId : event.presentationId));
    if (!parent || parent.type !== (presented ? 'decision.made' : TYPES[0]) || key(parent.scope) !== key(event.scope)
      || time(parent.at) > time(event.at) || time(parent.recordedAt) > time(event.recordedAt)) throw new Error('Trail: practice requires a prior parent in the same scope');
    if (event.type === TYPES[2]) {
      const attempts = events.filter(e => e.type === TYPES[2] && e.presentationId === event.presentationId);
      if (event.attemptNo !== attempts.length + 1 || attempts.some(e => time(e.at) > time(event.at))) throw new Error('Trail: attempt sequence must be consecutive');
    }
    return event;
  }
  // `decisions` limits what is reported (for example one round); evidence from the whole
  // log still decides what came before. `met` always covers the whole log.
  function summarize(events, { scope, asOf, recordedAsOf = asOf, decisions = null } = {}) {
    const scopeId = key(scope), cutoff = time(asOf), recordedCutoff = time(recordedAsOf);
    if (!Array.isArray(events)) throw new TypeError('Trail: log must be an array');
    if (decisions !== null && (!Array.isArray(decisions) || !decisions.every(id))) throw new TypeError('Trail: invalid decision filter');
    const reported = decisionId => decisions === null || decisions.includes(decisionId);
    const all = [], seen = new Map();
    for (const event of events) {
      if (!event || !event.scope || `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}` !== scopeId) continue;
      if (seen.has(event.id)) {
        if (JSON.stringify(seen.get(event.id)) !== JSON.stringify(event)) throw new Error('Trail: conflicting event id');
        continue;
      }
      if (TYPES.includes(event.type)) checkLink(all, event);
      seen.set(event.id, event); all.push(event);
    }
    // The log is in the order things happened in the app; a device clock can step back.
    // Help, a reveal or an attempt earlier in either order counts as prior evidence.
    const visible = all.filter(e => time(e.at) <= cutoff && time(e.recordedAt) <= recordedCutoff);
    const excluded = new Set(visible.filter(e => e.type === 'record.excluded').map(e => e.targetId));
    // The comparison arm is recorded on the decision; practice only points to it.
    const arms = new Map(visible.filter(e => e.type === 'decision.made').map(e => [e.id, e.arm ?? null]));
    const provenance = new Map(), traces = new Map();
    visible.forEach((event, index) => {
      if (event.type === TYPES[0]) provenance.set(event.id, event);
      const p = provenance.get(event.presentationId);
      // A visible child without its recorded parent is not usable evidence.
      if ((event.type !== TYPES[1] && event.type !== TYPES[2]) || !p) return;
      if (!traces.has(p.itemKey)) traces.set(p.itemKey, []);
      traces.get(p.itemKey).push({ index, at: time(event.at), kind: event.type === TYPES[2] ? 'attempt' : event.level === 'answer' ? 'answer' : 'help' });
    });
    const presentations = [], help = [], attempts = [], met = new Map();
    // The first time each item was attempted or its answer shown, excluded or not:
    // exclusion removes analytical evidence, never the fact that the item was met.
    const meet = (p, at, verdict) => { if (!met.has(p.itemKey)) met.set(p.itemKey, { itemKey: p.itemKey, conceptIds: [...p.conceptIds], at, verdict }); };
    let excludedAttempts = 0;
    visible.forEach((event, index) => {
      if (event.type === TYPES[0]) {
        if (reported(event.decisionId) && !excluded.has(event.id) && !excluded.has(event.decisionId)) presentations.push({
          eventId: event.id, at: event.at, recordedAt: event.recordedAt,
          decisionId: event.decisionId, taskId: event.taskId, taskVersion: event.taskVersion,
          itemKey: event.itemKey, conceptIds: [...event.conceptIds], firstExposure: event.firstExposure,
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
      const at = time(event.at);
      const before = traces.get(p.itemKey).filter(t => t.index !== index && (t.index < index || t.at < at));
      const assisted = before.some(t => t.kind !== 'attempt') ? true : p.firstExposure === true ? false : null;
      const exposure = before.some(t => t.kind !== 'help') || p.firstExposure === false ? 'repeat' : p.firstExposure === true ? 'new' : 'unknown';
      // A first attempt made after the answer was shown was met at the reveal, not here.
      meet(p, event.at, omitted ? null : event.verdict);
      if (!reported(p.decisionId)) return;
      if (omitted) { excludedAttempts += 1; return; }
      attempts.push({
        eventId: event.id, at: event.at, recordedAt: event.recordedAt,
        presentationId: p.id, decisionId: p.decisionId, arm: arms.get(p.decisionId) ?? null,
        taskId: p.taskId, taskVersion: p.taskVersion, itemKey: p.itemKey, conceptIds: [...p.conceptIds],
        attemptNo: event.attemptNo, verdict: event.verdict, errorTags: [...event.errorTags], assisted, exposure,
        independent: assisted === false && exposure === 'new' && ['correct', 'incorrect'].includes(event.verdict),
      });
    });
    return { version: VERSION, scope: copy(scope), asOf, recordedAsOf, decisions: decisions === null ? null : [...decisions],
      presentations, help, attempts, excludedAttempts, met: [...met.values()], persistence: 'provided-log-only', learningEffectClaim: false };
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
  return Object.freeze({ VERSION, TYPES, validate, checkLink, summarize, openHistory, remember, growth });
});
