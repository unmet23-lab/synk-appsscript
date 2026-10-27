import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initialState, restoreState, reduceCommand, snapshot, stepLiving, closeLiving, assertState, foldWorld, FOLD_LIMITS, TownError, askDrawn } from './core.mjs';
import { initialPresence, commandPresence, initialLease, pulseLease, boundaryPresence, pruneLease, settledLease, leaseFull, LEASE_ENTRIES, visitEndAt, VISIT_IDLE_MS } from './presence.mjs';
import { settle } from './town/settle.mjs';
import { contentCatalog, recordSeen, clearSeen, validSeen } from './town/seen.mjs';
import { writeVisit, visitLine, mayWrite, visitSummary, retainVisits } from './town/eval.mjs';
import { branchPaths, atomicWrite, appendLines, readLines, truncateTo, removeFile } from './save.mjs';
import { lifeDayAt, offsetAt, validOffset } from './town/clock.mjs';
import { validateOps, DEFAULT_OPS } from './town/params.mjs';
import { eventProblem } from './town/events.mjs';
import { ITEMS, MOOD_LINES, TOWN_LINES, PAIRS, TEA_LINES } from './town/data.gen.mjs';

/** A screen may open a safe boundary at most once in this long (vertical slice §14-3). */
export const BOUNDARY_GAP_MS = 20000;
/** Receipts the world itself keeps, and the movement receipts the store keeps (talk's limits). */
export const COMMAND_WINDOW = 32, WALK_RECEIPTS = 512;
/** The keys a screen may report as seen (§20-2): what the content data knows — the cards and the
 * gathered items, the mood lines (W4) and the cards', hearsay, pair and news lines with the pairs' steps (W5); scenes and
 * tea frames join with their content (W8~W9). */
export const SEEN_CATALOG = contentCatalog({ items: ITEMS.map(item => item.id), lines: [...MOOD_LINES, ...TOWN_LINES].map(line => line.id),
  pairs: PAIRS.flatMap(pair => [0, 1, 2].map(step => [pair.scene, String(step)])),
  // W8: a tea order's request frame shown to the player (tea:<frame> — W9's first exposure).
  teaFrames: TEA_LINES.filter(line => line.when.part === 'request').map(line => line.id) });
// `|| 0`: a UTC host gives -0, which a save's JSON round trip turns into 0, so a reopened world would differ.
const hostOffset = () => { const offset = -new Date().getTimezoneOffset() || 0; return validOffset(offset) ? offset : 540; };

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
// Observation runs keep their own save: a shifted clock must never leave
// future presence stamps in the everyday developer save.
export function defaultSavePath(observe = null) {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SYNK', 'town-preview', observe?.active ? 'ft10-observe.json' : 'ft10-v1.json');
}
/** The folder of branch files beside that old save, which is its read-only source (W2 plan D9). */
export function defaultSaveDir(observe = null) {
  return defaultSavePath(observe).replace(/\.json$/, '');
}
/** Observation switches for playtests (vertical slice design §15-6). Local
 * preview only; the talk runtime has no such input.
 *   --clock +1d | -3h30m | 2026-10-23T19:00+09:00   shift the town clock or start at a set instant
 *   --card C4[,R2]                                  raise these cards at once (read by the card runtime, W5) */
export function parseObservation(argv, { realNow = Date.now() } = {}) {
  const value = name => {
    const at = argv.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
    if (at < 0) return null;
    const inline = argv[at].slice(name.length + 1);
    const given = argv[at] === name ? argv[at + 1] : inline;
    if (!given || given.startsWith('--')) throw new RangeError(`${name} 뒤에 값을 적어 주세요.`);
    return given;
  };
  const clockArg = value('--clock'), cardArg = value('--card');
  let clock = null;
  if (clockArg !== null) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(clockArg)) {
      const atMs = Date.parse(clockArg);
      if (!Number.isSafeInteger(atMs)) throw new RangeError('--clock 시각을 읽지 못했어요.');
      clock = { atMs, startedAtMs: realNow, label: clockArg };
    } else if (/^[+-](?:\d+[dhms])+$/.test(clockArg)) {
      const unit = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
      const offsetMs = (clockArg[0] === '-' ? -1 : 1)
        * [...clockArg.matchAll(/(\d+)([dhms])/g)].reduce((sum, [, n, u]) => sum + Number(n) * unit[u], 0);
      if (!Number.isSafeInteger(offsetMs)) throw new RangeError('--clock 값이 너무 커요.');
      clock = { offsetMs, label: clockArg };
    } else throw new RangeError('--clock은 +1d·-3h30m 같은 꼴이나 2026-10-23T19:00+09:00 같은 시각이에요.');
  }
  const cards = cardArg === null ? [] : [...new Set(cardArg.split(','))];
  if (cards.some(id => !/^[CWR][1-6]$/.test(id))) throw new RangeError('--card는 C1~C6·W1~W6·R1~R6 가운데에서 골라요.');
  const label = [clock && `시계 ${clock.label}`, cards.length && `카드 ${cards.join('·')}`].filter(Boolean).join(' · ');
  return { active: !!clock || cards.length > 0, clock, cards, label };
}
/** The host clock a store runs on under the observation switches. */
export function observationClock(observe, realNow = () => Date.now()) {
  const clock = observe?.clock;
  if (!clock) return realNow;
  if (clock.offsetMs !== undefined) return () => realNow() + clock.offsetMs;
  return () => clock.atMs + Math.max(0, realNow() - clock.startedAtMs);
}
const count = value => Number.isSafeInteger(value) && value >= 0, stamp = value => value === null || count(value);
/** Whether a saved lease is whole enough to take its play time back (anything else falls back to the
 * world's host stamp). */
/** Whether a settled world differs from the saved one only in what the village recomputes (W3). */
// The close step's own products beside the village (W6): a visit the host knows ended, its band in the ring, the question
// that went with it — the next settlement makes them the same way, so a read that made only these does not write either.
const CLOSE_ONLY = Object.freeze({ village: null, townEvents: null, townSeq: null, townVisit: null, asks: null, visitBands: null });
const villageOnly = (world, saved) => JSON.stringify({ ...world, ...CLOSE_ONLY }) === JSON.stringify({ ...saved, ...CLOSE_ONLY });
/** The windows of a saved lease, each whole (the restart reads their times — visitEndAt). */
const validSurfaces = surfaces => !!surfaces && typeof surfaces === 'object' && !Array.isArray(surfaces) && Object.keys(surfaces).length <= 16
  && Object.values(surfaces).every(item => !!item && typeof item === 'object' && count(item.at) && typeof item.foreground === 'boolean'
    && (item.safe === undefined || typeof item.safe === 'boolean') && ['classic', 'day'].includes(item.surface));
function validLease(lease) {
  return !!lease && count(lease.uMs) && stamp(lease.lastForegroundAt) && !!lease.presence && stamp(lease.presence.at)
    && (lease.presence.visitStartAt === undefined || stamp(lease.presence.visitStartAt))
    && (lease.startAts === undefined || !!lease.startAts && typeof lease.startAts === 'object' && !Array.isArray(lease.startAts)
      && Object.keys(lease.startAts).length <= LEASE_ENTRIES && Object.entries(lease.startAts).every(([u, at]) => /^\d+$/.test(u) && count(at)))
    && stamp(lease.presence.lastActiveAt) && typeof lease.presence.idleClosed === 'boolean' && count(lease.presence.fence)
    && (lease.presence.owner === null || typeof lease.presence.owner === 'string') && validSurfaces(lease.presence.surfaces)
    && Array.isArray(lease.spans) && lease.spans.length <= LEASE_ENTRIES && lease.spans.every(span => count(span?.u)
      && (span.surfaceId === null || typeof span.surfaceId === 'string') && count(span.fence) && ['classic', 'day'].includes(span.surface)
      && typeof span.canRun === 'boolean')
    && Array.isArray(lease.breaks) && lease.breaks.length <= LEASE_ENTRIES && lease.breaks.every(count)
    && (lease.breakAts === undefined || !!lease.breakAts && typeof lease.breakAts === 'object' && !Array.isArray(lease.breakAts)
      && Object.keys(lease.breakAts).length <= LEASE_ENTRIES && Object.entries(lease.breakAts).every(([u, at]) => /^\d+$/.test(u) && count(at)));
}
/** One process owns this developer fixture. Commit to durable storage before
 * publishing its new state. A bad save is blocked, never silently re-created.
 * Four requests (vertical slice §14-3): pulse moves only the lease; boundary settles the world
 * and may issue a contact; read settles and saves what changed; execute settles, applies and
 * saves together. presence is the old pulse — pulse, a boundary when every window is safe, and a
 * read, published together only after the save. peek answers errors without settling.
 * The world keeps no log and only the newest command receipts (W2 plan D7, talk's rule): a commit
 * moves the lines a step appended to the event branch and every receipt to the store's receipts,
 * and folds the world to its limits (fold: false keeps every row — tests compare with it). An
 * older command still answers from its receipt. Answers show the branches as state.events (this
 * epoch's lines), state.commands and state.townEvents (F11).
 * The §20 branches sit beside them (W2 plan 5b): the town events a command left, the seen ledger
 * (answers carry the device's copy as seen) and the evaluation-only lines, kept only under the
 * consent and emptied the moment it is no longer granted. A screen reports what it really showed
 * with a boundary or a command (outside the signed command, so a retry never counts twice). The
 * account's own facts come from the host: academy (an academy-linked account is never asked for
 * evaluation signals), tz (its offset in minutes, for the life day), ops (the operating line of
 * §20-6), villageSeed and sleeps (the residents keep their nights: no scene begins with one asleep —
 * a real account's town and this preview; fixture stores leave it off so their clocks never matter).
 * Where it is kept (W2 plan D9·F21):
 *   dir   the account's folder of branch files (save.mjs). A commit appends its lines and receipts,
 *         then replaces the world — the commit point; a load cuts whatever lies past the world. The
 *         lease is written at every pulse, so play time survives a restart and only the windows do
 *         not. With file beside it, an old one-file save is the folder's read-only source: the folder
 *         is made from it once and the file is never written again (§14-6).
 *   file  the old one-file shape alone (the world with this epoch's lines, every receipt and the
 *         §20 branches inline), kept for the stores its tests open.
 *   save  a function given that one-file shape at every commit (tests). */
export function createStore({ dir, file, save, now = () => Date.now(), lifeEnabled = true, observe = null, fold = FOLD_LIMITS,
  academy = false, tz = hostOffset(), ops = DEFAULT_OPS, villageSeed = 'synk-town', sleeps = false, evalSignals = true } = {}) {
  let state = initialState({ lifeEnabled }), log = [], townLog = [], seen = {}, evalLines = [], loadError = null, savedLease = null;
  const receipts = new Map(), walks = [];
  const paths = dir ? branchPaths(dir) : null, sizes = { events: 0, receipts: 0, receiptLines: 0 };
  // evalSignals: whether this host may ask for and keep the evaluation-only signals (§20-4) — on for this preview and its
  // tests; the account service keeps it off until the privacy notice says so (W6).
  const account = { academy: academy === true, ops: validateOps(ops), villageSeed, evalSignals: evalSignals === true };
  lifeDayAt(tz, 0); // the offset (or offset history) is checked once, here
  const hostOf = at => ({ ...account, lifeDay: lifeDayAt(tz, at) });
  function remember(records) {
    for (const record of records) {
      if (receipts.has(record.id)) continue;
      receipts.set(record.id, record);
      // Movement receipts retire in a rolling window, as talk's do; a retired step's
      // expectedRevision can no longer run against the newer world.
      if (/"type":"DAY_WALK/.test(record.signature) && walks.push(record.id) > WALK_RECEIPTS) receipts.delete(walks.shift());
    }
  }
  /** An old one-file save: the world with this epoch's lines, every receipt and the §20 branches inline. */
  function readOneFile(source) {
    const { seen: savedSeen = {}, evalLines: savedEval = [], townEvents: savedTown = [], ...saved } = JSON.parse(fs.readFileSync(source, 'utf8'));
    if (!validSeen(savedSeen) || !Array.isArray(savedEval) || !Array.isArray(savedTown)) throw new TypeError('branches');
    if (saved?.trail && Array.isArray(saved.events)) {
      // The index is the record; the lines beside it are the branch.
      const world = restoreState({ ...saved, events: [], townEvents: [] }, { lifeEnabled });
      return { world, lines: saved.events.filter(event => event?.seq > world.trail.archivedBelow && event.seq <= world.trail.seq),
        townLines: savedTown, receiptLines: world.commands, seen: savedSeen, evalLines: savedEval };
    }
    const restored = restoreState({ ...saved, townEvents: [] }, { lifeEnabled });
    return { world: { ...restored, events: [] }, lines: restored.events, townLines: savedTown, receiptLines: restored.commands,
      seen: savedSeen, evalLines: savedEval };
  }
  /** The account's folder, cut back to its world: lines and receipts past it never committed (F21). */
  function readBranches() {
    const world = restoreState({ ...JSON.parse(fs.readFileSync(paths.world, 'utf8')), events: [], townEvents: [] }, { lifeEnabled });
    const events = readLines(paths.events, line => {
      if (Number.isSafeInteger(line?.seq)) return line.seq > world.trail.seq ? 'beyond' : 'line';
      if (typeof line?.kind === 'string' && /^E-\d+$/.test(line.id)) return Number(line.id.slice(2)) > world.townSeq ? 'beyond' : 'line';
      throw new TypeError('an event line');
    });
    const written = readLines(paths.receipts, line => {
      if (typeof line?.id !== 'string' || typeof line.signature !== 'string' || !Number.isSafeInteger(line.revision)) throw new TypeError('a receipt');
      return line.revision > world.revision ? 'beyond' : 'line';
    });
    const savedSeen = fs.existsSync(paths.seen) ? JSON.parse(fs.readFileSync(paths.seen, 'utf8')) : {};
    if (!validSeen(savedSeen)) throw new TypeError('seen');
    let lease = null;
    try { lease = fs.existsSync(paths.lease) ? JSON.parse(fs.readFileSync(paths.lease, 'utf8')) : null; } catch { lease = null; }
    truncateTo(paths.events, events.committed); truncateTo(paths.receipts, written.committed);
    sizes.events = events.committed; sizes.receipts = written.committed; sizes.receiptLines = written.lines.length;
    return { world, lines: events.lines.filter(line => Number.isSafeInteger(line.seq) && line.seq > world.trail.archivedBelow),
      townLines: events.lines.filter(line => !Number.isSafeInteger(line.seq)), receiptLines: written.lines,
      seen: savedSeen, evalLines: readLines(paths.eval, () => 'line').lines, lease };
  }
  function adopt(loaded) {
    for (const line of loaded.evalLines) visitLine(line);
    state = loaded.world; log = loaded.lines;
    // Town events past the world's sequence never committed with it.
    townLog = loaded.townLines.filter(event => eventProblem(event) === null && /^E-\d+$/.test(event.id) && Number(event.id.slice(2)) <= state.townSeq);
    // Evaluation lines live only under the consent: a withdrawal whose deletion was cut short finishes here.
    seen = loaded.seen; evalLines = mayWrite(state.consents) ? loaded.evalLines : [];
    if (paths && loaded.evalLines.length && !evalLines.length) removeFile(paths.eval);
    remember(loaded.receiptLines); remember(state.commands); state = { ...state, commands: state.commands.slice(-COMMAND_WINDOW) };
    if (fold) state = foldWorld(state, fold);
    savedLease = loaded.lease ?? null;
  }
  const writeEval = lines => lines.length ? atomicWrite(paths.eval, lines.map(line => `${JSON.stringify(line)}\n`).join('')) : removeFile(paths.eval);
  /** Make the folder from the old one-file save, the world last: a migration cut short leaves no
   * world.json and runs again from the untouched old file. */
  function migrate() {
    for (const key of ['events', 'receipts', 'seen', 'eval', 'lease']) removeFile(paths[key]);
    sizes.events = appendLines(paths.events, 0, [...log, ...townLog]);
    sizes.receipts = appendLines(paths.receipts, 0, [...receipts.values()]); sizes.receiptLines = receipts.size;
    if (Object.keys(seen).length) atomicWrite(paths.seen, JSON.stringify(seen));
    writeEval(evalLines);
    atomicWrite(paths.world, JSON.stringify(state));
  }
  try {
    if (paths && fs.existsSync(paths.world)) adopt(readBranches());
    else if (file && fs.existsSync(file)) { adopt(readOneFile(file)); if (paths) migrate(); }
    else if (paths) for (const key of ['events', 'receipts', 'seen', 'eval', 'lease']) removeFile(paths[key]);
  } catch { loadError = new TownError('invalid-save', '저장 기록을 읽지 못했어요. 원본을 보존하고 확인해 주세요.', 503); }
  const persist = save || (file ? next => atomicWrite(file, JSON.stringify(next)) : null);
  const current = (world = state) => {
    const shown = snapshot(world);
    shown.state.events = log.slice(); shown.state.commands = [...receipts.values()]; shown.state.townEvents = [...townLog, ...(world.townEvents || [])];
    return { ...shown, seen: { ...seen }, capabilities: { life: !!state.life && lifeEnabled, day: !!state.day && lifeEnabled, evalSignals: account.evalSignals } };
  };
  /** The old one-file shape; it carries the seen ledger and the evaluation lines only when they hold something. */
  const oneFile = (world, change) => ({ ...world, events: [...change.kept, ...change.lines], townEvents: [...townLog, ...change.town],
    commands: [...receipts.values(), ...change.fresh], ...(Object.keys(change.seen).length ? { seen: change.seen } : {}),
    ...(change.evalLines.length ? { evalLines: change.evalLines } : {}) });
  const failed = () => new TownError('save-failed', '저장하지 못했어요. 진행은 그대로예요. 다시 시도해 주세요.', 503);
  /** The §20 branches that changed beside a commit or alone. */
  function writeSide(change) {
    if (change.seen !== seen) atomicWrite(paths.seen, JSON.stringify(change.seen));
    if (change.evalLines !== evalLines) writeEval(change.evalLines);
  }
  /** Write a commit; nothing is published unless the write held. The folder takes the lines and the
   * receipts first and the world last; a line or receipt of an attempt that failed is cut by the next. */
  function persistCommit(world, change) {
    try {
      if (paths) {
        const events = appendLines(paths.events, sizes.events, [...change.lines, ...change.town]);
        const written = appendLines(paths.receipts, sizes.receipts, change.fresh);
        writeSide(change);
        atomicWrite(paths.world, JSON.stringify(world));
        sizes.events = events; sizes.receipts = written; sizes.receiptLines += change.fresh.length;
      } else if (persist) persist(oneFile(world, change));
    } catch { throw failed(); }
  }
  /** Retired movement receipts leave the receipt file once it holds far more lines than the store keeps. */
  function compactReceipts() {
    if (!paths || sizes.receiptLines <= 2 * receipts.size + 256) return;
    const text = [...receipts.values()].map(record => `${JSON.stringify(record)}\n`).join('');
    try { atomicWrite(paths.receipts, text); sizes.receipts = Buffer.byteLength(text); sizes.receiptLines = receipts.size; }
    catch { /* The longer file is still whole; the next commit tries again. */ }
  }
  compactReceipts();
  function commit(next, { seen: nextSeen = seen, evalLines: nextEval = evalLines } = {}) {
    let world = { ...next, events: [], townEvents: [], commands: next.commands.slice(-COMMAND_WINDOW), writeSeq: (state.writeSeq ?? 0) + 1 };
    if (fold) world = foldWorld(world, fold);
    // A reset starts a new epoch: the branch's earlier lines are archived, never shown again.
    const kept = world.trail.archivedBelow > state.trail.archivedBelow ? [] : log, lines = next.events, town = next.townEvents || [];
    const fresh = next.commands.filter(record => !receipts.has(record.id));
    persistCommit(world, { kept, lines, town, fresh, seen: nextSeen, evalLines: nextEval });
    state = world; log = kept; log.push(...lines); townLog.push(...town); remember(fresh); seen = nextSeen; evalLines = nextEval;
    compactReceipts();
  }
  /** A branch changed while the world did not (a seen report, an evaluation line). */
  function keep({ seen: nextSeen = seen, evalLines: nextEval = evalLines }) {
    const change = { kept: log, lines: [], town: [], fresh: [], seen: nextSeen, evalLines: nextEval };
    try { if (paths) writeSide(change); else if (persist) persist(oneFile(state, change)); }
    catch { throw failed(); }
    seen = nextSeen; evalLines = nextEval;
  }
  /** A screen's report of what it really showed: the next ledger, or null when nothing was added (lastAdded: what it added). */
  let lastAdded = [];
  function seenReport(keys) {
    lastAdded = [];
    if (keys === undefined) return null;
    if (!Array.isArray(keys) || !keys.every(key => typeof key === 'string')) throw new TownError('invalid-seen', '보인 것 기록을 다시 보내 주세요.');
    const report = recordSeen(seen, keys, { known: SEEN_CATALOG });
    lastAdded = report.added;
    return report.added.length ? report.seen : null;
  }
  /** The evaluation-only line of the visit in progress after a boundary or a command (§20-4, W6): only on a host that
   * keeps them, under the consent, never for an academy-linked account; the line carries its own tallies and lines past
   * the keeping period go with the write. Nothing the town computes reads it (G11).
   * Lines whose write failed wait in memory with what they counted (evalWaiting), so the next request builds on them
   * and nothing a saved request counted is lost (GPT review GA5); a restart drops them. */
  let evalWaiting = null;
  function keepVisitLine(before, command, added) {
    if (!account.evalSignals || account.academy || !mayWrite(state.consents)) { evalWaiting = null; return; }
    // The request is already saved: a line that fails to be made or kept never turns it into an error (Fable F12).
    try {
      const lines = evalWaiting ?? evalLines;
      const fields = visitSummary(lines.find(line => line.id === state.policy?.visitId) ?? null, { before, after: state, command, added, seen });
      if (!fields || state.townVisit?.endedAt !== undefined) return;
      const next = retainVisits(writeVisit(lines, state.consents, fields), fields.lifeDay);
      if (JSON.stringify(next) === JSON.stringify(evalLines)) { evalWaiting = null; return; }
      try { keep({ evalLines: next }); evalWaiting = null; } catch { evalWaiting = next; }
    } catch { /* a line that cannot be made is not written */ }
  }
  /** The lease after a restart. Without a saved lease only the world's host stamp survives for the
   * 30-minute logical-visit boundary. A saved lease keeps the play time a pulse recorded, but no
   * window: nobody holds the town until a window pulses again, which moves the fence, so an old
   * invitation never reaches a new window and offline hours never become play time. */
  function leaseAfterRestart() {
    const settledU = state.settledU ?? 0, host = state.lifeHost;
    if (!validLease(savedLease)) return initialLease({ uMs: settledU, lastForegroundAt: host?.lastForegroundAt ?? null,
      presence: { ...initialPresence(), lastActiveAt: host?.lastForegroundAt ?? null, fence: host?.fence || 0 } });
    // No window survives a restart; the visit still ends when it would have (visitEndAt counts the last
    // window's lease), so the restarted presence keeps that time as its last activity.
    const p = savedLease.presence, endAt = visitEndAt(p);
    return pruneLease({ ...initialLease({ uMs: Math.max(savedLease.uMs, settledU), lastForegroundAt: savedLease.lastForegroundAt,
      presence: { ...initialPresence(), at: p.at, lastActiveAt: endAt === null ? p.lastActiveAt : endAt - VISIT_IDLE_MS, idleClosed: p.idleClosed, fence: Math.max(p.fence, host?.fence || 0),
        // When the visit in progress began (W6) survives a restart as its end does.
        ...(Number.isSafeInteger(p.visitStartAt) ? { visitStartAt: p.visitStartAt } : {}) } }),
    spans: savedLease.spans, breaks: savedLease.breaks, breakAts: savedLease.breakAts || {}, ...(savedLease.startAts ? { startAts: savedLease.startAts } : {}) }, settledU);
  }
  let lease = leaseAfterRestart();
  /** The lease file follows every lease change. It is a restart's aid, never the authority: a write
   * that fails keeps the process going on the lease in memory (a restart then falls back to the world). */
  function keepLease() {
    if (!paths) return;
    try { atomicWrite(paths.lease, JSON.stringify(lease)); } catch { /* the lease in memory goes on */ }
  }
  const living = () => !!state.life && lifeEnabled;
  function requireLife(input) {
    if (loadError) throw loadError;
    if (!living()) throw new TownError('life-unavailable', '이웃 생활을 열 수 없어요.', 403);
    if (typeof input?.foreground !== 'boolean') throw new TownError('invalid-presence', '이 창의 연결 상태를 다시 확인해 주세요.');
  }
  function pulseOf(input, at) {
    try { return pulseLease(lease, input, at, { away: state.phase === 'away', settledU: state.settledU }); }
    catch { throw new TownError('invalid-presence', '이 창의 연결 상태를 다시 확인해 주세요.'); }
  }
  /** The world settled to a lease, with the host stamp a pulse leaves; null when nothing changed. */
  function settledTo(next, { nowMs, canContact = false, touch = false, caps = [] }) {
    if (!living()) return null;
    // The village closes its bands on every settlement (W3): its seed and offset come from the account, and a
    // visit the lease shows ended (visitEndAt reached) ends the holds opened before it — read, not recorded.
    // The close hears whether the walk ended at a safe boundary, for the mascot's question (W6).
    const endAt = visitEndAt(next.presence), close = (world, at, walk = {}) => closeLiving(world, at, { seed: account.villageSeed,
      offsetMin: offsetAt(tz, at), visitEnd: endAt !== null && endAt <= at ? endAt : null, sleeps: sleeps === true,
      ...(walk.canContact ? { ask: { canContact: true, caps: walk.caps, academy: account.academy, evalSignals: account.evalSignals } } : {}) });
    let { state: world, changed } = settle(state, next, { step: stepLiving, check: assertState, close, nowMs, canContact, touch, caps, account });
    const lifeHost = { lastForegroundAt: next.lastForegroundAt, fence: next.presence.fence };
    if (next.presence.at !== null && JSON.stringify(lifeHost) !== JSON.stringify(world.lifeHost ?? null)) {
      world = { ...world, lifeHost }; changed = true;
    }
    return changed ? world : null;
  }
  const hostNow = () => Math.max(now(), lease.presence.at ?? 0);
  return {
    observation: observe,
    /** Sizes for benches and tests: the world as saved, and the branches beside it. */
    stats() { return { worldBytes: Buffer.byteLength(JSON.stringify(state)), lines: log.length, receipts: receipts.size,
      townEvents: townLog.length, seenKeys: Object.keys(seen).length, evalLines: evalLines.length,
      ...(paths ? { eventBytes: sizes.events, receiptBytes: sizes.receipts } : {}) }; },
    /** The one server write of an evaluation-only visit line (§20-4, called from W6): kept only under the
     * consent, overwritten by visit id. Returns how many lines the account has. */
    writeVisit(fields) {
      if (loadError) throw loadError;
      const next = writeVisit(evalLines, state.consents, fields);
      if (next !== evalLines) keep({ evalLines: next });
      return evalLines.length;
    },
    peek() { if (loadError) throw loadError; return current(); },
    read() {
      if (loadError) throw loadError;
      const world = settledTo(lease, { nowMs: hostNow() });
      // A read that only moved the village's bands shows them without writing: the next settlement
      // opens and closes them the same way (W3) — so reading never needs the disk. A visit end the lease
      // recorded is applied once and saved (its break leaves the lease), however little it changed.
      if (world && !lease.breaks.length && villageOnly(world, state)) return current(world);
      if (world) { commit(world); lease = settledLease(lease, state.settledU); keepLease(); }
      return current();
    },
    pulse(input) {
      requireLife(input);
      const at = now(), pulse = pulseOf(input, at);
      lease = pulse.lease;
      // A pulse never drops unsettled play: a lease that would hold more than it keeps settles now.
      if (leaseFull(lease)) { const world = settledTo(lease, { nowMs: at }); if (world) commit(world); lease = settledLease(lease, state.settledU); }
      keepLease();
      return { presence: pulse.receipt, serverNow: at, worldSeq: state.writeSeq };
    },
    boundary(input) {
      if (loadError) throw loadError;
      if (!living()) throw new TownError('life-unavailable', '이웃 생활을 열 수 없어요.', 403);
      const at = hostNow(), holder = boundaryPresence(lease.presence, input, at);
      if (!holder) throw new TownError('stale-surface', '이 창의 연결 상태를 다시 확인해 주세요.', 409);
      // What the screen showed is recorded even when the boundary itself is too soon to settle.
      const report = seenReport(input.seen);
      if (lease.boundaryAt !== null && at - lease.boundaryAt < BOUNDARY_GAP_MS) {
        const added = lastAdded;
        if (report) keep({ seen: report });
        keepVisitLine(state, null, added);
        return { issued: null, throttled: true, worldSeq: state.writeSeq };
      }
      // What the screen can draw (W5: caps ['cards']) decides whether a card's offer may be issued (review F6).
      // W8: 'tea' — a screen that draws the tea board; the life cards (C5·R6) are offered only to it (review F13).
      const caps = Array.isArray(input.caps) ? input.caps.filter(cap => ['cards', 'asks', 'tea'].includes(cap)) : [];
      // Issued is told by id: a card's settled offers may leave in the same settlement (review GA5).
      const before = new Set(state.life.contacts.map(c => c.id)), added = lastAdded, prior = state;
      let world = settledTo(lease, { nowMs: at, canContact: holder.canContact, touch: true, caps });
      // The mascot's question the screen drew (W6): beside the boundary like what it showed — no command revision.
      if (typeof input.asked === 'string' && (world || state).asks?.open?.key === input.asked) {
        const next = structuredClone(world || state);
        if (askDrawn(next, input.asked)) world = assertState(next);
      }
      if (world) { commit(world, report ? { seen: report } : {}); lease = settledLease(lease, state.settledU); }
      else if (report) keep({ seen: report });
      keepVisitLine(prior, null, added);
      lease = { ...lease, boundaryAt: at }; keepLease();
      const issued = state.life.contacts.findLast(c => !before.has(c.id)) ?? null;
      return { issued: issued && { id: issued.id, contactKey: issued.contactKey, ...(issued.card ? { card: issued.card, key: issued.key } : {}) }, worldSeq: state.writeSeq };
    },
    presence(input) {
      requireLife(input);
      const at = now(), pulse = pulseOf(input, at);
      // Clock, delivery owner and world facts publish together after durability.
      const world = settledTo(pulse.lease, { nowMs: at, canContact: pulse.context.canContact, touch: true });
      if (world) commit(world);
      lease = world ? settledLease(pulse.lease, state.settledU) : pulse.lease; keepLease();
      return { ...current(), presence: pulse.receipt, worldSeq: state.writeSeq };
    },
    /** A command, with what the screen showed beside it ({ seen }: keys outside the signed command). */
    execute(command, { seen: shown } = {}) {
      if (loadError) throw loadError;
      const at = hostNow(), presence = lease.presence;
      if (shown !== undefined) seenReport(shown);
      let host = { enabled: lifeEnabled, canContact: false, elapsedMs: 0,
        surfaceId: presence.owner, fence: presence.fence, nowMs: at,
        surface: presence.surfaces[presence.owner]?.surface || 'classic' };
      // When the visit in progress began (W6): a command may open it before any play time was settled.
      const visitStartAt = Number.isSafeInteger(presence.visitStartAt) ? presence.visitStartAt : null;
      // An already committed request can be recovered after a lease expired.
      // The reducer still compares the entire signed request before returning;
      // one older than the world's window is compared with its receipt.
      const receipt = receipts.get(command?.id), recorded = !!receipt;
      const base = recorded && !state.commands.some(item => item.id === command.id) ? { ...state, commands: [receipt] } : state;
      if (!recorded && typeof command?.type === 'string' && /^(LIFE_|DAY_|BAZAAR_|SUPPORT_|CARD_|TEA_|GREET$)/.test(command.type)) {
        host = commandPresence(presence, command.payload, at);
        if (!host) throw new TownError('stale-surface', '이 창의 연결 상태를 다시 확인해 주세요.', 409);
        host.ownerSurfaceId = presence.owner;
        host.visitStartAt = visitStartAt;
      }
      if (!recorded && command?.type === 'DAY_WALK') {
        const walk = lease.walkClock;
        const elapsed = walk && walk.surfaceId === host.surfaceId && walk.fence === host.fence ? host.nowMs - walk.at : 0;
        host.walkElapsedMs = elapsed >= 0 ? Math.min(250, elapsed) : 0;
      }
      // A command settles first and is saved with what the settlement changed (§14-3).
      const settled = (!recorded && settledTo(lease, { nowMs: at })) || base;
      const result = reduceCommand(settled, command, { visitStartAt, ...host, ...hostOf(at) });
      if (!result.duplicate) {
        // Clearing empties the seen ledger (the keys sent with it are not counted); a consent that is no
        // longer granted takes the account's evaluation lines with it at once.
        const clears = ['SEEN_CLEAR', 'MEMORY_CLEAR'].includes(command.type);
        const nextSeen = clears ? clearSeen() : seenReport(shown) || seen, added = clears ? [] : lastAdded;
        const nextEval = command.type === 'EVAL_CONSENT' && result.state.consents.evalSignals.state !== 'granted' ? [] : evalLines;
        commit(result.state, { seen: nextSeen, evalLines: nextEval });
        const before = lease;
        lease = settledLease(lease, state.settledU);
        if (['DAY_WALK_ENABLE', 'DAY_WALK'].includes(command.type)) lease = { ...lease, walkClock: { at: host.nowMs, surfaceId: host.surfaceId, fence: host.fence } };
        if (['DAY_WALK_DISABLE', 'RESET', 'LEAVE'].includes(command.type)) lease = { ...lease, walkClock: null };
        if (command.type === 'RESET') lease = initialLease({ uMs: state.settledU });
        else if (command.type === 'LEAVE') lease = { ...lease, presence: { ...lease.presence, at: Math.max(now(), lease.presence.at ?? 0),
          surfaces: {}, owner: null, fence: lease.presence.fence + 1 } };
        if (JSON.stringify(lease) !== JSON.stringify(before)) keepLease();
        keepVisitLine(settled, command, added);
      }
      return { ...current(), duplicate: result.duplicate };
    },
  };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg' };
function fileFor(route, previewEnabled) {
  if (route === '/' || route === '/index.html') return path.join(root, 'index.html');
  if (route === '/style.css') return path.join(root, 'style.css');
  if (previewEnabled && route === '/assets/felt-coral.webp') return path.join(repo, 'experiences/synk-world-home/assets/felt-coral.webp');
  if (/^\/assets\/(?:[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_-]+\.(webp|png|jpg|svg|woff2|ttf)$/.test(route)) return path.join(root, route.slice(1));
  if (!previewEnabled) return null;
  // Baked district comparison only (?district=); v20 never requests these.
  if (/^\/assets\/district\/[a-z0-9-]+\.(?:glb|json)$/.test(route)) return path.join(root, route.slice(1));
  // SYNK music for staying (W7b): the app files tools/town-music-build.mjs makes, outside git like the baked district.
  if (/^\/assets\/music\/[a-z0-9-]+-[0-9a-f]{8}\.mp3$/.test(route)) return path.join(root, route.slice(1));
  if (/^\/rendering\/basis\/basis_transcoder\.(?:js|wasm)$/.test(route)) return path.join(root, route.slice(1));
  if (['/day.html', '/day-app.mjs', '/day-style.css', '/day-scene.mjs', '/day-character.mjs', '/day-residents.mjs', '/day-environment.mjs', '/day-materials.mjs', '/day-rendering.mjs', '/day-district.mjs', '/day-light.mjs', '/day-mood.mjs', '/day-cards.mjs', '/day-notebook.mjs', '/day-stay.mjs', '/day-stay.css', '/day-sound.mjs', '/day-tea.mjs', '/day-tea.css', '/day-sfx.mjs', '/day-observation.mjs', '/walk.mjs', '/walk-controls.mjs', '/walk-packets.mjs', '/town-layout.mjs'].includes(route)) return path.join(root, route.slice(1));
  // The town runtime layer the browser shares with the host (vertical slice §2-5): modules only, never data sources.
  // W8: and its life activities (town/activities — the tea order's hand state machine runs on the device too).
  if (/^\/town\/(?:activities\/)?[a-z0-9-]+(?:\.gen)?\.mjs$/.test(route)) return path.join(root, route.slice(1));
  if (/^\/rendering\/(?:Pass|RenderPass|EffectComposer|ShaderPass|MaskPass|OutputPass|CopyShader|OutputShader|SSAOPass|SSAOShader|SimplexNoise|GLTFLoader|BufferGeometryUtils|KTX2Loader|WorkerPool|ktx-parse\.module|zstddec\.module|ColorSpaces|meshopt_decoder\.module)\.js$/.test(route)) return path.join(root, route.slice(1));
  if (route === '/avatar-v3.mjs') return path.join(repo, 'experiences/synk-world-home/avatar-v3.mjs');
  if (route === '/avatar-textiles.mjs') return path.join(repo, 'experiences/synk-world-home/avatar-textiles.mjs');
  if (['/avatar-wardrobe.mjs', '/wardrobe-catalog.mjs', '/wardrobe-garments-v8.mjs'].includes(route)) return path.join(repo, 'experiences/synk-world-home', path.basename(route));
  if (['/scene-assets/three.module.js', '/scene-assets/three.core.js'].includes(route)) return path.join(repo, 'experiences/synk-world-home/scene-assets', path.basename(route));
  if (['/day-assets/three.module.js', '/day-assets/three.core.js', '/day-assets/THREE-LICENSE.txt'].includes(route))
    return path.join(repo, 'experiences/synk-world-home/scene-assets', path.basename(route));
  if (['azure-sky-v3.jpg', 'azure-sky-v3-mobile.jpg', 'terrain-normal.jpg', 'cliff-normal.jpg'].some(file => route === `/day-assets/${file}`))
    return path.join(repo, 'experiences/synk-world-home/scene-assets/graphics-v2', path.basename(route));
  if (route === '/day-assets/felt-coral.webp') return path.join(repo, 'experiences/synk-world-home/assets/felt-coral.webp');
  if (['/preview.html', '/app.mjs', '/life-ui.mjs', '/linked-client.mjs', '/understanding.mjs', '/understanding-ui.mjs'].includes(route)) return path.join(root, route.slice(1));
  if (route === '/engine/loom-life.js') return path.join(repo, 'tools/lib/loom-life.js');
  if (route === '/engine/loom-motion.js') return path.join(repo, 'tools/lib/loom-motion.js');
  return null;
}
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
export function createServer({ previewEnabled = false, store = createStore({ dir: defaultSaveDir(), file: defaultSavePath() }) } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // Baked districts (?district=, day-district.mjs) need three's KTX2 transcoder and
    // meshopt decoder: WebAssembly ('wasm-unsafe-eval'), the Basis transcoder's
    // Emscripten glue builds functions from strings ('unsafe-eval'), it runs in a
    // blob: worker, and GLTFLoader hands images to the loaders as blob: URLs
    // (10-18: with the old policy every baked set failed back to v20; QA had
    // opened pages with bypassCSP). Scripts still load from this origin only.
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob:; font-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host)) return json(res, 403, { error: 'local-preview-only' });
    let route;
    try {
      const raw = decodeURIComponent(req.url.split('?')[0]);
      if (raw.includes('..') || raw.includes('\\') || raw.includes('\0')) throw new Error();
      route = new URL(req.url, `http://${req.headers.host}`).pathname;
    } catch { return json(res, 400, { error: 'invalid-path' }); }
    if (route === '/api/entry' && req.method === 'GET') return json(res, 200,
      { allowed: false, reason: 'verified-town-access-unavailable', requires: 'TOPIK1+ verified by trusted account service' });
    if (route.startsWith('/api/preview/')) {
      if (!previewEnabled) return json(res, 403, { error: 'preview-disabled' });
      try {
        if (route === '/api/preview/state' && req.method === 'GET') return json(res, 200, store.read());
        const operation = { '/api/preview/command': 'execute', '/api/preview/presence': 'presence',
          '/api/preview/pulse': 'pulse', '/api/preview/boundary': 'boundary' }[route];
        if (!operation) return json(res, 404, { error: 'not-found' });
        if (req.method !== 'POST') return json(res, 405, { error: 'method-not-allowed' });
        if (req.headers.origin !== `http://${req.headers.host}`) return json(res, 403, { error: 'same-origin-required' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'json-required' });
        let body = '', size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 24576) return json(res, 413, { error: 'body-too-large' });
          body += chunk;
        }
        let command;
        try { command = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid-json' }); }
        // What the screen showed rides beside a command, never inside the signed request.
        if (operation === 'execute' && command && typeof command === 'object' && Object.hasOwn(command, 'seen')) {
          const { seen, ...signed } = command;
          return json(res, 200, store.execute(signed, { seen }));
        }
        return json(res, 200, store[operation](command));
      } catch (error) {
        let current = {};
        // An error answer shows the world as it is; it never settles or saves.
        try { current = (store.peek || store.read).call(store); } catch { /* Preserve corrupt save, fail closed. */ }
        return json(res, error instanceof TownError ? error.status : 503,
          { error: error.code || 'unavailable', message: error instanceof TownError ? error.message : '기록을 확인할 수 없어요.', ...current });
      }
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'method-not-allowed' });
    const file = fileFor(route, previewEnabled);
    if (!file || !fs.existsSync(file)) return json(res, 404, { error: 'not-found' });
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    // The music's <audio> reads in byte ranges (seeking, the next song near the end), as on the public site.
    if (path.extname(file) === '.mp3') {
      const size = fs.statSync(file).size, range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : size - Number(range[2]), end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (!(start >= 0 && start <= end)) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    } else res.writeHead(200, { 'Content-Type': type });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const previewEnabled = process.argv.includes('--preview');
  const port = Number(process.env.SYNK_TOWN_PORT || 4288);
  let observe;
  try { observe = parseObservation(process.argv.slice(2)); }
  catch (error) { console.error(`관찰 스위치: ${error.message}`); process.exit(2); }
  if (observe.active && !previewEnabled) { console.error('관찰 스위치는 --preview와 함께만 써요.'); process.exit(2); }
  const store = createStore({ dir: defaultSaveDir(observe), file: defaultSavePath(observe), now: observationClock(observe), observe, sleeps: true });
  const server = createServer({ previewEnabled, store });
  server.on('error', error => { console.error(`Town server: ${error.code || 'unavailable'}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`SYNK TOWN ${previewEnabled ? 'developer fixture' : 'locked entry'}: http://127.0.0.1:${port}${previewEnabled ? '/day.html' : '/'}`);
    if (observe.active) console.log(`관찰 스위치: ${observe.label} · 저장 ${defaultSaveDir(observe)}`);
  });
}
