'use strict';
/* The folded part of a long practice log (Trail provenance + Core evidence cells).
 * A device keeps its recent entries in full and folds older, finished items into this
 * summary, so a long history stays small and quick to open. It keeps only what later
 * readings need from those entries:
 *   - whether an item or family was attempted, revealed or helped (Trail's "before");
 *   - the newest independent answers and recent helped answers of each
 *     ability/difficulty/format cell and of each word or grammar point (Core's policy);
 *   - what was presented (task, item, family), for recommendation history;
 *   - Temper's counts.
 * It is built from Trail's own reading of the folded entries, so a reading with the
 * ledger gives what a reading of the whole log would. It holds no response text and no
 * identity. Parent IDs retain only the provenance needed to withdraw folded evidence.
 *
 * `local` marks a ledger holding entries no server has received (folded on a store that was
 * not synchronised); such a history can never be sent to a server, even if sharing is turned
 * on later. A synchronised log folds only entries the server already holds and has sent back,
 * so the server keeps everything. Another device's entries can still arrive late, from before
 * the cutoff: they are read with the ledger as earlier history (never as first exposures),
 * folded first answers after them on the same family stop counting (`demote`), and an entry
 * whose item was folded here stays on the server only (`stray`): an exclusion of a folded
 * answer still removes it from the evidence. `adjusted` counts such entries. Temper's counts
 * cannot be corrected for them here (a late reveal can turn any later repeat into a helped
 * one), so they are approximate once `adjusted` is above zero; measurement reads the
 * server's whole log.
 */
const Trail = require('./trail');
const Temper = require('./temper');
const VERSION = 'learning-ledger-1';
const BITS = Trail.BITS;
// The policy reads at most the newest 12 independent answers of a cell; helped answers
// older than 30 days never count again.
const KEEP = 12, HELP_MS = 30 * 86400000;
// A response (feedback.given) folds with its set once Core no longer reads it (plan() respondedBefore).
const FOLDABLE = Object.freeze(['decision.made', 'experience.completed', 'record.excluded', 'feedback.given',
  'practice.presented', 'practice.helped', 'practice.attempted', 'practice.delivery']);
const MAX_ENTRIES = 200000;

const own = (table, key) => Object.prototype.hasOwnProperty.call(table, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// `presented` holds one [task, item, family, count] row per distinct item shown, so
// recommendation history counts folded presentations exactly as it would the log's.
function empty() {
  return { version: VERSION, cutoff: null, folded: 0, keys: {}, presented: [], cells: {}, content: {}, counts: null };
}
// A stored ledger is checked before use; anything else makes the history unreadable.
function validate(ledger) {
  const cellOk = cell => plain(cell) && Array.isArray(cell.ind) && cell.ind.length <= KEEP
    && cell.ind.every(r => Array.isArray(r) && (r.length === 4 || r.length === 5 && typeof r[4] === 'string')
      && typeof r[0] === 'string' && Number.isFinite(r[1]) && ['correct', 'incorrect'].includes(r[2]) && typeof r[3] === 'string')
    && Array.isArray(cell.helped) && cell.helped.length <= MAX_ENTRIES
    && cell.helped.every(h => Number.isFinite(h) || Array.isArray(h) && h.length === 2 && typeof h[0] === 'string' && Number.isFinite(h[1]))
    && Number.isInteger(cell.unassessed) && cell.unassessed >= 0;
  if (!plain(ledger) || ledger.version !== VERSION || !Number.isInteger(ledger.folded) || ledger.folded < 0
    || !(ledger.cutoff === null || Number.isFinite(ledger.cutoff))
    || !plain(ledger.keys) || Object.keys(ledger.keys).length > MAX_ENTRIES || Object.values(ledger.keys).some(v => !Number.isInteger(v) || v < 1 || v > 7)
    || !Array.isArray(ledger.presented) || ledger.presented.length > MAX_ENTRIES
    || ledger.presented.some(r => !Array.isArray(r) || r.length !== 4 || r.slice(0, 3).some(v => typeof v !== 'string') || !Number.isInteger(r[3]) || r[3] < 1)
    || !plain(ledger.cells) || !Object.values(ledger.cells).every(cellOk)
    || !plain(ledger.content) || !Object.values(ledger.content).every(cellOk)
    || !(ledger.counts === null || plain(ledger.counts))
    || !(ledger.adjusted === undefined || Number.isInteger(ledger.adjusted) && ledger.adjusted >= 0)
    || !(ledger.parents === undefined || plain(ledger.parents) && Object.keys(ledger.parents).length <= MAX_ENTRIES
      && Object.values(ledger.parents).every(p => Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every((id, i) => i === 2 && id === null || typeof id === 'string' && id.length > 0)))
    || !(ledger.withdrawn === undefined || Array.isArray(ledger.withdrawn) && ledger.withdrawn.length <= MAX_ENTRIES && ledger.withdrawn.every(id => typeof id === 'string' && id.length > 0))
    || !(ledger.followupsLost === undefined || plain(ledger.followupsLost)
      && Number.isInteger(ledger.followupsLost.anchors) && ledger.followupsLost.anchors > 0 && ledger.followupsLost.anchors <= 24
      && Number.isFinite(ledger.followupsLost.at))
    || !(ledger.followupsPreserved === undefined || typeof ledger.followupsPreserved === 'boolean')
    || !(ledger.local === undefined || ledger.local === true)) throw new TypeError('Ledger: unreadable');
  return ledger;
}
// Whether `kinds` ('attempt', 'answer', 'help') happened on this trace key in folded entries.
const before = (ledger, traceKey, kinds) => {
  const bits = ledger && own(ledger.keys, traceKey) ? ledger.keys[traceKey] : 0;
  return kinds.some(kind => bits & BITS[kind]);
};
// Rows the policy reads, rebuilt from a cell (see Learning.formatEvidence). An independent
// row is [event id, time, verdict, family] plus the item when it is not the family; a helped
// answer is [event id, time] (a bare time in a ledger written before ids were kept).
const helpedAt = h => (Array.isArray(h) ? h[1] : h);
function rows(cell) {
  if (!cell) return { rows: [], unassessed: 0 };
  const iso = ms => new Date(ms).toISOString();
  return { unassessed: cell.unassessed, rows: [
    ...cell.ind.map(([eventId, at, verdict, familyKey]) => ({ eventId, at: iso(at), verdict, independent: true, assisted: false, exclusionReason: null, measure: { familyKey } })),
    ...cell.helped.map(h => ({ eventId: Array.isArray(h) ? h[0] : null, at: iso(helpedAt(h)), verdict: 'correct', independent: false, assisted: true, exclusionReason: null, measure: { familyKey: null } })),
  ] };
}
const cellOf = (ledger, key) => (ledger && own(ledger.cells, key) ? ledger.cells[key] : null);
const contentOf = (ledger, key) => (ledger && own(ledger.content, key) ? ledger.content[key] : null);
function trimParents(ledger) {
  if (!ledger.parents) return ledger;
  const ids = new Set();
  for (const table of [ledger.cells, ledger.content]) for (const cell of Object.values(table)) {
    for (const row of cell.ind) ids.add(row[0]); for (const row of cell.helped) if (Array.isArray(row)) ids.add(row[0]);
  }
  ledger.parents = Object.fromEntries(Object.entries(ledger.parents).filter(([id]) => ids.has(id)));
  return ledger;
}

/* Fold finished entries into the ledger. `events` are whole items (decision, presentation,
 * help, delivery, answers, completion, exclusions of them) in log order; `log` is the whole
 * log they are taken from, so whatever came before them there still counts when their
 * answers are read. */
function fold(previous, events, { scope, log = events, local = false }) {
  // A new object each time (callers compare identity); tables are copied, not deep-cloned,
  // and a cell is copied only when this fold changes it.
  const base = previous || empty();
  const ledger = { ...base, keys: { ...base.keys }, cells: { ...base.cells }, content: { ...base.content }, parents: Object.assign(Object.create(null), base.parents) };
  if (!events.length) return ledger;
  const time = e => Math.max(Date.parse(e.at), Date.parse(e.recordedAt));
  const latest = log.reduce((max, e) => Math.max(max, time(e)), -Infinity);
  const decisions = events.filter(e => e.type === 'decision.made').map(e => e.id);
  const summary = Trail.summarize(log, { scope, asOf: new Date(latest).toISOString(), prior: previous, decisions });
  // Retain the actual audio dependency, not a later playback on the same presentation.
  const deliveries = new Map(), proof = new Map(), seen = new Set();
  for (const e of log) {
    if (seen.has(e.id) || e.scope.domain !== scope.domain || e.scope.workspace !== scope.workspace || e.scope.subject !== scope.subject) continue;
    seen.add(e.id);
    if (e.type === 'practice.delivery') deliveries.set(e.presentationId, e.id);
    if (e.type === 'practice.attempted') proof.set(e.id, deliveries.get(e.presentationId));
  }
  const presented = new Map(events.filter(e => e.type === 'practice.presented').map(e => [e.id, e]));
  for (const e of events) {
    if (e.type !== 'practice.helped' && e.type !== 'practice.attempted') continue;
    const p = presented.get(e.presentationId);
    if (!p) continue;
    const bit = e.type === 'practice.attempted' ? BITS.attempt : e.level === 'answer' ? BITS.answer : BITS.help;
    for (const k of Trail.traceKeys(p)) ledger.keys[k] = (own(ledger.keys, k) ? ledger.keys[k] : 0) | bit;
  }
  const shown = new Map(ledger.presented.map(([task, item, family, n]) => [JSON.stringify([task, item, family]), n]));
  for (const p of summary.presentations) {
    const key = JSON.stringify([p.taskId, p.itemKey, p.measure?.familyKey || p.itemKey]);
    shown.set(key, (shown.get(key) || 0) + 1);
  }
  ledger.presented = [...shown].map(([key, n]) => [...JSON.parse(key), n]).sort((a, b) => (a.join('\u0000') < b.join('\u0000') ? -1 : 1));
  const touched = new Set();
  const add = (table, key, a) => {
    const cell = own(table, key) ? (touched.has(table[key]) ? table[key] : { ind: [...table[key].ind], helped: [...table[key].helped], unassessed: table[key].unassessed })
      : { ind: [], helped: [], unassessed: 0 };
    table[key] = cell; touched.add(cell);
    const at = Date.parse(a.at);
    if (a.independent) cell.ind.push([a.eventId, at, a.verdict, a.measure.familyKey, ...(a.itemKey !== a.measure.familyKey ? [a.itemKey] : [])]);
    if (!a.exclusionReason && a.assisted === true && a.verdict === 'correct') cell.helped.push([a.eventId, at]);
    if (a.independent || !a.exclusionReason && a.assisted === true && a.verdict === 'correct') ledger.parents[a.eventId] = [a.presentationId, a.decisionId, a.measure.audioRequired ? proof.get(a.eventId) : null];
    if (a.verdict === 'unassessed' || a.verdict === 'skipped') cell.unassessed += 1;
  };
  for (const a of summary.attempts) {
    if (!a.measure) continue;
    const format = a.measure.responseFormat || 'unknown';
    add(ledger.cells, `${a.measure.skillId}|${a.measure.difficulty}|${format}`, a);
    for (const id of a.conceptIds) if (id !== a.measure.skillId) add(ledger.content, `${id}|${format}`, a);
  }
  // Old helped answers expire in every cell; a cell this fold did not touch is replaced, not edited.
  for (const table of [ledger.cells, ledger.content]) for (const [key, cell] of Object.entries(table)) {
    const helped = cell.helped.filter(h => helpedAt(h) > latest - HELP_MS);
    if (!touched.has(cell) && helped.length === cell.helped.length) continue;
    table[key] = { ind: [...cell.ind].sort((x, y) => x[1] - y[1]).slice(-KEEP), helped: helped.sort((x, y) => helpedAt(x) - helpedAt(y)), unassessed: cell.unassessed };
  }
  ledger.counts = ledger.counts ? Temper.combine(ledger.counts, Temper.measure(summary)) : Temper.measure(summary);
  ledger.cutoff = Math.max(ledger.cutoff ?? -Infinity, events.reduce((max, e) => Math.max(max, time(e)), -Infinity));
  ledger.folded += events.length;
  // Once it holds an entry no server received, it always does (the copy above keeps a mark).
  if (local) ledger.local = true;
  return trimParents(ledger);
}

/* Choose whole, finished items to fold, oldest first, so that at most `keep` entries stay.
 * An item is foldable when all its entries are older than `olderThan`, it is not open here
 * (`open` lists entry ids), and it was completed or its last entry is older than
 * `unfinishedBefore`; one with a response only once its latest response is older than `respondedBefore`
 * (never without it). An older item that stays is read before the folded ones, as in the whole log;
 * the cutoff is the latest folded entry. */
function plan(events, { keep, olderThan, unfinishedBefore = olderThan, respondedBefore = -Infinity, open = [] }) {
  if (events.length <= keep) return null;
  const groupOf = new Map(), groups = new Map();
  const join = (id, event) => {
    if (!groups.has(id)) groups.set(id, { id, events: [], max: -Infinity, open: false, done: false, responded: -Infinity });
    const g = groups.get(id);
    g.events.push(event); g.max = Math.max(g.max, Date.parse(event.at), Date.parse(event.recordedAt)); groupOf.set(event.id, id);
    if (event.type === 'experience.completed') g.done = true;
    if (event.type === 'feedback.given') g.responded = Math.max(g.responded, Date.parse(event.at));
  };
  const pinned = new Set();
  for (const e of events) {
    if (e.type === 'decision.made') { join(e.id, e); continue; }
    const parent = groupOf.get(reference(e));
    // Any other kind of entry keeps the item it refers to; an entry outside every item stays.
    if (!FOLDABLE.includes(e.type)) { if (parent != null) pinned.add(parent); continue; }
    if (parent != null) join(parent, e);
  }
  for (const id of pinned) groups.get(id).open = true;
  for (const id of open) { const g = groups.get(groupOf.get(id)); if (g) g.open = true; }
  const order = [...groups.values()].sort((a, b) => a.max - b.max);
  let remaining = events.length, cutoff = -Infinity;
  const folded = new Set();
  for (const g of order) {
    if (remaining <= keep || g.max >= olderThan) break;
    if (g.open || !g.done && g.max >= unfinishedBefore || g.responded > -Infinity && g.responded >= respondedBefore) continue;
    for (const e of g.events) folded.add(e.id);
    remaining -= g.events.length; cutoff = g.max;
  }
  if (!folded.size) return null;
  return { cutoff, folded: events.filter(e => folded.has(e.id)), kept: events.filter(e => !folded.has(e.id)) };
}
// Entries a newer ledger already holds: practice entries at or before its cutoff.
const folded = (ledger, event) => !!ledger && ledger.cutoff !== null && FOLDABLE.includes(event.type)
  && Date.parse(event.at) <= ledger.cutoff;
// The decision, presentation, entry or completion an entry belongs to (none for a decision). A
// response names its set's decision as well; an older one without it belongs to its completion.
const reference = e => (e?.type === 'decision.made' ? undefined : e?.decisionId ?? e?.presentationId ?? e?.targetId ?? e?.completionId);
// A retained old answer must not read a later folded encounter as earlier exposure.
// Keep the item/family closure with it, including every help/delivery/exclusion in
// those decisions. If it no longer fits, refuse the whole retention request; never
// pick favourable answers to meet a storage limit.
function retention(events, decisions, { maxEvents = 2400, maxBytes = 1024 * 1024 } = {}) {
  const groups = new Map(), parent = new Map();
  for (const e of events) {
    const group = e.type === 'decision.made' ? e.id : parent.get(reference(e));
    if (!group) continue;
    parent.set(e.id, group);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(e);
  }
  const selected = new Set(decisions.filter(id => groups.has(id)));
  const position = new Map(events.map((e, index) => [e.id, index]));
  const first = Math.min(...[...selected].map(id => Math.min(...groups.get(id).map(e => position.get(e.id)))));
  const presentations = events.filter(e => e.type === 'practice.presented'), keys = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of presentations) {
      const group = parent.get(p.id), traces = Trail.traceKeys(p);
      if (!selected.has(group) && traces.some(key => keys.has(key))
        && groups.get(group).some(e => position.get(e.id) >= first)) { selected.add(group); changed = true; }
      if (selected.has(group)) for (const key of traces) if (!keys.has(key)) { keys.add(key); changed = true; }
    }
  }
  const kept = events.filter(e => selected.has(parent.get(e.id))), bytes = new TextEncoder().encode(JSON.stringify(kept)).length;
  const limited = kept.length > maxEvents || bytes > maxBytes;
  return { decisions: limited ? [] : [...selected], events: kept.length, bytes, limited, maxEvents, maxBytes };
}
// A synchronised entry whose decision, presentation or target was folded here.
const stray = (event, known) => { const ref = reference(event); return typeof ref === 'string' && !known.has(ref); };
// Which of two ledgers folded later: 1 (a), -1 (b) or 0 (the same fold).
function compare(a, b) {
  const fa = a?.folded || 0, fb = b?.folded || 0;
  if (fa !== fb) return fa > fb ? 1 : -1;
  const ca = a?.cutoff ?? -Infinity, cb = b?.cutoff ?? -Infinity;
  return ca === cb ? 0 : ca > cb ? 1 : -1;
}
// Transfer explicit withdrawals, never infer them from missing rows: equal fold counts
// and cutoffs do not identify a shared base. Unrelated valid evidence must survive.
function reconcile(a, b) {
  if (!a || !b || !Math.max(a.adjusted || 0, b.adjusted || 0, a.withdrawn?.length || 0, b.withdrawn?.length || 0)) return null;
  if (a === b || JSON.stringify(a) === JSON.stringify(b)) return a;
  const order = (x, y) => { const delta = helpedAt(x) - helpedAt(y), u = JSON.stringify(x), v = JSON.stringify(y); return delta || (u === v ? 0 : u < v ? -1 : 1); };
  const withdrawn = [...new Set([...(a.withdrawn || []), ...(b.withdrawn || [])])].sort();
  const next = { ...demote(compare(a, b) < 0 ? b : a, { excluded: withdrawn, linkedOnly: true }, () => null) };
  for (const name of ['cells', 'content']) next[name] = Object.fromEntries(Object.entries(next[name]).sort(([x], [y]) => x.localeCompare(y)).map(([key, cell]) => [key, { ...cell, ind: [...cell.ind].sort(order), helped: [...cell.helped].sort(order) }]));
  next.adjusted = Math.max(a.adjusted || 0, b.adjusted || 0, next.withdrawn?.length || 0);
  if (a.local || b.local) next.local = true;
  if (a.followupsPreserved !== undefined || b.followupsPreserved !== undefined) next.followupsPreserved = a.followupsPreserved === true && b.followupsPreserved === true;
  if (a.followupsLost || b.followupsLost) next.followupsLost = { anchors: Math.max(a.followupsLost?.anchors || 0, b.followupsLost?.anchors || 0), at: Math.min(a.followupsLost?.at ?? Infinity, b.followupsLost?.at ?? Infinity) };
  trimParents(next);
  return JSON.stringify(next) === JSON.stringify(a) ? a : next;
}
/* Late entries (from before the cutoff) that met an item or family: folded first answers on
 * that family after them are first answers no longer. `excluded` lists folded answers another
 * device has excluded since; `strays` counts entries of folded items kept on the server only.
 * `find` returns a log entry by id. */
function demote(ledger, { late = [], excluded = [], strays = 0, linkedOnly = false }, find) {
  const marks = [], gone = new Set(excluded);
  for (const e of late) {
    if (e.type !== 'practice.attempted' && e.type !== 'practice.helped') continue;
    const p = find(e.presentationId);
    if (p) marks.push({ keys: new Set(Trail.traceKeys(p)), at: Date.parse(e.at) });
  }
  if (!ledger || !late.length && !gone.size && !strays) return ledger;
  const parents = ledger.parents || {}, direct = new Set(), retired = new Set(ledger.withdrawn || []);
  for (const table of [ledger.cells, ledger.content]) for (const cell of Object.values(table)) {
    for (const row of cell.ind) direct.add(row[0]); for (const row of cell.helped) if (Array.isArray(row)) direct.add(row[0]);
  }
  for (const p of Object.values(parents)) for (const id of p) if (id !== null) direct.add(id);
  const parentGone = [...gone].some(id => !direct.has(id));
  const withdrawn = id => gone.has(id) || own(parents, id) && parents[id].some(p => p !== null && gone.has(p)) || !linkedOnly && parentGone && (!own(parents, id) || parents[id].length === 2);
  const after = ([eventId, at, , familyKey, itemKey = familyKey]) => withdrawn(eventId)
    || marks.some(m => (m.keys.has(`item:${itemKey}`) || m.keys.has(`family:${familyKey}`)) && at > m.at);
  const excludedHelp = h => Array.isArray(h) ? withdrawn(h[0]) : gone.size > 0;
  const next = { ...ledger, cells: { ...ledger.cells }, content: { ...ledger.content }, adjusted: (ledger.adjusted || 0) + late.length + Math.max(strays, gone.size) };
  for (const table of [next.cells, next.content]) for (const [key, cell] of Object.entries(table)) {
    if (cell.ind.some(after) || cell.helped.some(excludedHelp)) table[key] = { ...cell, ind: cell.ind.filter(row => { if (!after(row)) return true; retired.add(row[0]); return false; }), helped: cell.helped.filter(h => { if (!excludedHelp(h)) return true; if (Array.isArray(h)) retired.add(h[0]); return false; }) };
  }
  for (const id of gone) if (typeof id === 'string' && id.length) retired.add(id);
  if (retired.size > MAX_ENTRIES) throw new Error('Ledger: withdrawal capacity');
  if (retired.size) next.withdrawn = [...retired].sort();
  return trimParents(next);
}

module.exports = { VERSION, BITS, FOLDABLE, empty, validate, before, rows, cellOf, contentOf, fold, plan, folded, stray, compare, reconcile, demote, reference, retention };
