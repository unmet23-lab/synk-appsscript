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
 * identity. A folded entry can no longer be excluded.
 *
 * A synchronised log folds only entries the server already holds and has sent back, so
 * the server keeps everything. Another device's entries can still arrive late, from before
 * the cutoff: they are read with the ledger as earlier history (never as first exposures),
 * folded first answers after them on the same family stop counting (`demote`), and an entry
 * whose item was folded here stays on the server only (`stray`): an exclusion of a folded
 * answer still removes it from the evidence. Temper's counts are not corrected for such
 * late entries.
 */
const Trail = require('./trail');
const Temper = require('./temper');
const VERSION = 'learning-ledger-1';
const BITS = Trail.BITS;
// The policy reads at most the newest 12 independent answers of a cell; helped answers
// older than 30 days never count again.
const KEEP = 12, HELP_MS = 30 * 86400000;
const FOLDABLE = Object.freeze(['decision.made', 'experience.completed', 'record.excluded',
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
    && Array.isArray(cell.helped) && cell.helped.length <= MAX_ENTRIES && cell.helped.every(Number.isFinite)
    && Number.isInteger(cell.unassessed) && cell.unassessed >= 0;
  if (!plain(ledger) || ledger.version !== VERSION || !Number.isInteger(ledger.folded) || ledger.folded < 0
    || !(ledger.cutoff === null || Number.isFinite(ledger.cutoff))
    || !plain(ledger.keys) || Object.keys(ledger.keys).length > MAX_ENTRIES || Object.values(ledger.keys).some(v => !Number.isInteger(v) || v < 1 || v > 7)
    || !Array.isArray(ledger.presented) || ledger.presented.length > MAX_ENTRIES
    || ledger.presented.some(r => !Array.isArray(r) || r.length !== 4 || r.slice(0, 3).some(v => typeof v !== 'string') || !Number.isInteger(r[3]) || r[3] < 1)
    || !plain(ledger.cells) || !Object.values(ledger.cells).every(cellOk)
    || !plain(ledger.content) || !Object.values(ledger.content).every(cellOk)
    || !(ledger.counts === null || plain(ledger.counts))) throw new TypeError('Ledger: unreadable');
  return ledger;
}
// Whether `kinds` ('attempt', 'answer', 'help') happened on this trace key in folded entries.
const before = (ledger, traceKey, kinds) => {
  const bits = ledger && own(ledger.keys, traceKey) ? ledger.keys[traceKey] : 0;
  return kinds.some(kind => bits & BITS[kind]);
};
// Rows the policy reads, rebuilt from a cell (see Learning.formatEvidence). An independent
// row is [event id, time, verdict, family] plus the item when it is not the family.
function rows(cell) {
  if (!cell) return { rows: [], unassessed: 0 };
  const iso = ms => new Date(ms).toISOString();
  return { unassessed: cell.unassessed, rows: [
    ...cell.ind.map(([eventId, at, verdict, familyKey]) => ({ eventId, at: iso(at), verdict, independent: true, assisted: false, exclusionReason: null, measure: { familyKey } })),
    ...cell.helped.map(at => ({ eventId: null, at: iso(at), verdict: 'correct', independent: false, assisted: true, exclusionReason: null, measure: { familyKey: null } })),
  ] };
}
const cellOf = (ledger, key) => (ledger && own(ledger.cells, key) ? ledger.cells[key] : null);
const contentOf = (ledger, key) => (ledger && own(ledger.content, key) ? ledger.content[key] : null);

/* Fold finished entries into the ledger. `events` are whole items (decision, presentation,
 * help, delivery, answers, completion, exclusions of them) in log order; `log` is the whole
 * log they are taken from, so whatever came before them there still counts when their
 * answers are read. */
function fold(previous, events, { scope, log = events }) {
  // A new object each time (callers compare identity); tables are copied, not deep-cloned,
  // and a cell is copied only when this fold changes it.
  const base = previous || empty();
  const ledger = { ...base, keys: { ...base.keys }, cells: { ...base.cells }, content: { ...base.content } };
  if (!events.length) return ledger;
  const time = e => Math.max(Date.parse(e.at), Date.parse(e.recordedAt));
  const latest = log.reduce((max, e) => Math.max(max, time(e)), -Infinity);
  const decisions = events.filter(e => e.type === 'decision.made').map(e => e.id);
  const summary = Trail.summarize(log, { scope, asOf: new Date(latest).toISOString(), prior: previous, decisions });
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
    if (!a.exclusionReason && a.assisted === true && a.verdict === 'correct') cell.helped.push(at);
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
    const helped = cell.helped.filter(at => at > latest - HELP_MS);
    if (!touched.has(cell) && helped.length === cell.helped.length) continue;
    table[key] = { ind: [...cell.ind].sort((x, y) => x[1] - y[1]).slice(-KEEP), helped: helped.sort((x, y) => x - y), unassessed: cell.unassessed };
  }
  ledger.counts = ledger.counts ? Temper.combine(ledger.counts, Temper.measure(summary)) : Temper.measure(summary);
  ledger.cutoff = Math.max(ledger.cutoff ?? -Infinity, events.reduce((max, e) => Math.max(max, time(e)), -Infinity));
  ledger.folded += events.length;
  return ledger;
}

/* Choose whole, finished items to fold, oldest first, so that at most `keep` entries stay.
 * An item is foldable when all its entries are older than `olderThan`, it is not open here
 * (`open` lists entry ids), and it was completed or its last entry is older than
 * `unfinishedBefore`. An older item that stays is read before the folded ones, as in the
 * whole log; the cutoff is the latest folded entry. */
function plan(events, { keep, olderThan, unfinishedBefore = olderThan, open = [] }) {
  if (events.length <= keep) return null;
  const groupOf = new Map(), groups = new Map();
  const join = (id, event) => {
    if (!groups.has(id)) groups.set(id, { id, events: [], max: -Infinity, open: false, done: false });
    const g = groups.get(id);
    g.events.push(event); g.max = Math.max(g.max, Date.parse(event.at), Date.parse(event.recordedAt)); groupOf.set(event.id, id);
    if (event.type === 'experience.completed') g.done = true;
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
    if (g.open || !g.done && g.max >= unfinishedBefore) continue;
    for (const e of g.events) folded.add(e.id);
    remaining -= g.events.length; cutoff = g.max;
  }
  if (!folded.size) return null;
  return { cutoff, folded: events.filter(e => folded.has(e.id)), kept: events.filter(e => !folded.has(e.id)) };
}
// Entries a newer ledger already holds: practice entries at or before its cutoff.
const folded = (ledger, event) => !!ledger && ledger.cutoff !== null && FOLDABLE.includes(event.type)
  && Date.parse(event.at) <= ledger.cutoff;
// The decision, presentation or entry an entry belongs to (none for a decision).
const reference = e => (e?.type === 'decision.made' ? undefined : e?.decisionId ?? e?.presentationId ?? e?.targetId);
// A synchronised entry whose decision, presentation or target was folded here.
const stray = (event, known) => { const ref = reference(event); return typeof ref === 'string' && !known.has(ref); };
// Which of two ledgers folded later: 1 (a), -1 (b) or 0 (the same fold).
function compare(a, b) {
  const fa = a?.folded || 0, fb = b?.folded || 0;
  if (fa !== fb) return fa > fb ? 1 : -1;
  const ca = a?.cutoff ?? -Infinity, cb = b?.cutoff ?? -Infinity;
  return ca === cb ? 0 : ca > cb ? 1 : -1;
}
/* Late entries (from before the cutoff) that met an item or family: folded first answers on
 * that family after them are first answers no longer. `find` returns a log entry by id;
 * `excluded` lists folded answers another device has excluded since. */
function demote(ledger, late, find, excluded = []) {
  const marks = [], gone = new Set(excluded);
  for (const e of late) {
    if (e.type !== 'practice.attempted' && e.type !== 'practice.helped') continue;
    const p = find(e.presentationId);
    if (p) marks.push({ keys: new Set(Trail.traceKeys(p)), at: Date.parse(e.at) });
  }
  if (!ledger || !marks.length && !gone.size) return ledger;
  const after = ([eventId, at, , familyKey, itemKey = familyKey]) => gone.has(eventId)
    || marks.some(m => (m.keys.has(`item:${itemKey}`) || m.keys.has(`family:${familyKey}`)) && at > m.at);
  const next = { ...ledger, cells: { ...ledger.cells }, content: { ...ledger.content } };
  for (const table of [next.cells, next.content]) for (const [key, cell] of Object.entries(table)) {
    if (cell.ind.some(after)) table[key] = { ...cell, ind: cell.ind.filter(row => !after(row)) };
  }
  return next;
}

module.exports = { VERSION, BITS, FOLDABLE, empty, validate, before, rows, cellOf, contentOf, fold, plan, folded, stray, compare, demote };
