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
const { createMemorySync } = require('./memory-sync');
const Ledger = require('./learning-ledger');
const { createPages, THRESHOLD } = require('./learning-pages');
const { createFlowPort, createLive } = require('./game-flow');
const KEY = 'synk.atlas.learning.v1';
// A finished practice set (finishSet) takes a response in Core's four values for a day (a synchronised store folds a
// set only after a day idle). Core reads a response for 30 days (engine.js RECENT); its set folds a day after that,
// so a list of 30 days never removes a response being folded.
const SET_KINDS = ['short', 'diagnostic', 'mock'], RESPONSES = ['helpful', 'not_fit', 'too_much', 'want_more'], SET_OPEN_MS = 86400000, RESPONSE_MS = 30 * 86400000;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const uid = () => `l${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
// A synchronous Storage read followed by setItem is not an atomic transaction
// across browser tabs. One browser context owns writes for a history at a time;
// games in that context share the lease and its provisional initial epoch.
const historyLeases = new Map();
const LEASE_WARNING = '다른 탭에서 이 기록을 사용 중이에요. 그 탭을 닫으면 이곳에서 저장할 수 있어요.';
function browserHistoryLease(name) {
  if (typeof globalThis.document !== 'object') return null;
  if (globalThis.location?.protocol === 'synk-desktop:' && typeof globalThis.synkDesktop === 'object') return null;
  const manager = globalThis.navigator?.locks;
  // Packaged desktop renderers are protected by the existing single-instance
  // app owner. Other browser documents without Web Locks remain read-only.
  if (historyLeases.has(name)) return historyLeases.get(name);
  const entry = { epoch: null, active: false, supported: !!manager, listeners: new Set() };
  let pending = false, wanted = true, release = null, controller = null, retired = false;
  const announce = active => { entry.active = active; for (const listener of entry.listeners) { try { listener(active); } catch { /* One host cannot release another game's lease. */ } } };
  entry.start = () => {
    if (retired) return;
    wanted = true;
    if (pending || !manager) return;
    pending = true; controller = new AbortController(); const signal = controller.signal;
    Promise.resolve().then(() => retired || signal.aborted ? undefined : manager.request('synk.atlas.history.' + name, { mode: 'exclusive', signal }, () => new Promise(done => {
      release = done; announce(true);
    }))).catch(() => { if (!signal.aborted) { wanted = false; announce(false); } }).finally(() => {
      pending = false; release = null; if (wanted) entry.start();
    });
  };
  const pause = () => { wanted = false; announce(false); controller?.abort(); release?.(); };
  globalThis.addEventListener?.('pagehide', pause);
  globalThis.addEventListener?.('pageshow', entry.start);
  entry.detach = listener => {
    entry.listeners.delete(listener);
    if (entry.listeners.size) return;
    retired = true; pause();
    globalThis.removeEventListener?.('pagehide', pause);
    globalThis.removeEventListener?.('pageshow', entry.start);
    if (historyLeases.get(name) === entry) historyLeases.delete(name);
  };
  historyLeases.set(name, entry); return entry;
}
// Both readings use Trail: an exclusion withdraws a result without replacing its
// original anchor. Retain the full decision bundles until the observation window ends.
function readFollowups(events, { scope, asOf, prior = null, complete = true, retain = false }) {
  const options = { scope, asOf, prior };
  const report = Temper.followups({ events, summary: Trail.summarize(events, options),
    original: Trail.summarize(events.filter(e => e.type !== 'record.excluded'), options), prior, complete, asOf });
  // Once selected originals were lost to the storage bound, later raw successes
  // cannot become replacement anchors. Only a complete raw history can recover it.
  if (prior?.followupsLost) {
    report.items = []; report.retainDecisionIds = []; report.evidenceComplete = false;
    Object.assign(report.coverage, { limited: true, reason: 'retention-capacity', retentionEnabled: retain,
      retentionLimited: true, unretainedAnchors: prior.followupsLost.anchors, lostAt: new Date(prior.followupsLost.at).toISOString() });
    return report;
  }
  // Older consumers may have folded the original source without a retention
  // contract. The remaining raw log cannot establish which anchor was first.
  if (prior?.folded && prior.followupsPreserved !== true) {
    report.items = []; report.retainDecisionIds = []; report.evidenceComplete = false;
    Object.assign(report.coverage, { limited: true, reason: 'older-source-unavailable', retentionEnabled: retain });
    return report;
  }
  const retention = retain ? Ledger.retention(events, report.retainDecisionIds) : null;
  report.coverage.retentionEnabled = retain;
  if (retention) {
    Object.assign(report.coverage, { retentionLimited: retention.limited, retainedEvents: retention.limited ? 0 : retention.events,
      retainedBytes: retention.limited ? 0 : retention.bytes });
    report.retainDecisionIds = retention.decisions;
    if (retention.limited) {
      report.coverage.limited = true; report.coverage.reason = 'retention-capacity';
      report.coverage.unretainedAnchors = report.items.length / Temper.FOLLOWUP.windows.length;
      for (const item of report.items) { item.status = 'unavailable'; item.reason = 'retention-capacity'; item.outcome = null; }
    }
  }
  return report;
}
// Earlier entries keep new ones in time order, but another device's clock running ahead
// must not pin this one: a time beyond this device's own clock (plus a margin) is not adopted.
const AHEAD_MS = 5 * 60000;
/* `fold`: the store keeps its recent entries in full and folds older, finished items into a
 * ledger (learning-ledger.js), so a long history stays small and quick to write. On by default
 * for a device store; a host turns it on for an account store. `{ max, keep, ageMs }` tunes
 * it: once more than `max` entries are kept, fold items idle for `ageMs` (10 minutes) down to
 * `keep`, in batches. An item still unanswered in this tab never folds.
 * `{ remote: true }` is for a synchronised store: only entries the server holds and has sent
 * back (syncPort.settle) fold, items stay for a day, and unanswered ones for 30 days.
 * openHistory is the one owner of what is saved: the epoch, the kept log (an Atlas session), the
 * ledger, the settled/dropped marks and whether the history was read, written and complete. Only
 * its refresh (join another tab's write), compact, persist, reset, flush and the synchroniser's port
 * change them; the game reads `state()`, a frozen snapshot, appends through its session and persists.
 * `held(now)` names the entries the game still holds open: they never fold. `release(gone)` tells the
 * game, as it happens, what it may no longer hold: everything (gone = null) at a new epoch, or the
 * entries `gone(id)` names that a merge or a fold took out of the kept log. */
function openHistory({ storage, key, scope, storageScope, accountKey, historyComplete, fold, followups, clock, held, release }) {
  const lease = storage ? browserHistoryLease(JSON.stringify([key, storageScope, accountKey])) : null;
  let leased = !lease, waitingWrite = false, closed = false, closing = false, closedFlush = false, detachLease = () => {};
  const FINAL_FLUSH = Symbol('final-history-flush');
  const leaseWarning = lease && !lease.supported ? '이 환경에서는 기록을 안전하게 저장할 수 없어 기본 연습으로 진행해요.' : LEASE_WARNING;
  const pages = storageScope === 'account' && storage ? createPages(storage, key, ['events', 'settled', 'dropped']) : null;
  let paged = false, epoch = null, session, readable = true, writable = !!storage, complete = historyComplete, warning = null, ledger = null;
  const folding = fold === false || (fold == null && storageScope !== 'device') ? null
    : { max: 600, keep: 400, ageMs: fold?.remote ? 86400000 : 600000, remote: false, ...(fold && typeof fold === 'object' ? fold : {}) };
  // Entries of a synchronised store that the server has sent back (only these may fold).
  const settled = new Set();
  let settledVersion = 0;
  // Ids such a store folded away and its synchroniser has not yet taken (syncPort.dropped,
  // forget): they are on the server, so the synchroniser must not take them for lost entries.
  const dropped = new Set();
  let droppedVersion = 0;
  const UNCHANGED = Symbol('unchanged-history');
  let lastStoredRaw = Symbol('unread-history'), lastTime = 0, lastSavedState = null;
  const listeners = new Set();
  const notify = (kind, code) => { for (const listener of listeners) { try { listener({ kind, ...(code ? { code } : {}) }); } catch { /* Host notifications cannot corrupt learning events. */ } } };
  const monotonicClock = () => { const value = Date.parse(clock()); if (!Number.isFinite(value)) throw new TypeError('Atlas: invalid clock'); lastTime = Math.max(value, lastTime); return new Date(lastTime).toISOString(); };
  const newSession = events => {
    const own = Date.parse(clock());
    for (const e of events) { const at = Date.parse(e.at); if (Number.isFinite(at) && (!Number.isFinite(own) || at <= own + AHEAD_MS) && at > lastTime) lastTime = at; }
    return Atlas.createSession({ scope, events, clock: monotonicClock });
  };
  // The session's frozen entries themselves (no copy). Older sessions only offer copies.
  const log = (of = session) => of.snapshot ? of.snapshot() : of.events();
  const savedState = () => [log(), ledger, epoch, settledVersion, droppedVersion, lastStoredRaw];
  const rememberSaved = () => { lastSavedState = savedState(); };
  const unchangedPaged = () => lastSavedState && savedState().every((value, index) => value === lastSavedState[index]);
  const decode = raw => {
    if (raw == null) return null;
    const value = pages ? pages.decode(raw) : JSON.parse(raw);
    paged = pages?.active() || false;
    if (!value || value.version !== 1 || !identifier(value.epoch) || !Array.isArray(value.events) || storageScope !== 'account' && value.events.length > 20000
      || Object.keys(value).some(k => !['version', 'epoch', 'events', 'owner', 'ledger', 'settled', 'dropped'].includes(k))) throw new Error('Atlas: unreadable history');
    if (value.ledger != null) Ledger.validate(value.ledger);
    for (const ids of [value.settled, value.dropped]) if (ids != null && (!Array.isArray(ids) || storageScope !== 'account' && ids.length > 20000 || !ids.every(identifier))) throw new Error('Atlas: unreadable history');
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
      const stored = decode(raw); lastStoredRaw = pages?.decodedRaw() ?? raw; return stored;
    }
    catch { readable = false; complete = false; warning = '기록을 읽지 못해 기본 연습으로 진행해요.'; notify('storage-error', 'STORAGE_ERROR'); return null; }
  }
  const initial = readStored(); let provisional = !!lease && !initial;
  epoch = initial?.epoch || lease?.epoch || (lease ? 'initial.' + uid() : uid());
  if (lease && !lease.epoch) lease.epoch = epoch;
  ledger = initial?.ledger || null; session = newSession(initial?.events || []);
  // Keep the settled marks of entries in `known` (the kept log) only.
  const settle = (ids, known) => {
    const before = settled.size;
    for (const id of ids) if (known.has(id)) settled.add(id);
    for (const id of settled) if (!known.has(id)) settled.delete(id);
    if (settled.size !== before) settledVersion += 1;
  };
  if (initial?.settled) settle(initial.settled, new Set(initial.events.map(e => e.id)));
  for (const id of initial?.dropped || []) dropped.add(id);
  if (initial) rememberSaved();
  // The stored list is the current one unless this side folded more and has not written yet.
  const takeDropped = (ids, keepMine) => {
    const next = new Set(keepMine ? [...dropped, ...ids] : ids);
    if (next.size !== dropped.size || [...next].some(id => !dropped.has(id))) { dropped.clear(); for (const id of next) dropped.add(id); droppedVersion += 1; }
  };
  function refresh(access = null) {
    if (closed || closing && access !== FINAL_FLUSH) return;
    if (!readable || !storage) return;
    const stored = readStored();
    if (!stored || stored === UNCHANGED) return;
    // An initial owner joins waiting practice; an explicit reset still ends it.
    if (provisional && stored.epoch.startsWith('initial.')) { epoch = stored.epoch; provisional = false; }
    if (stored.epoch !== epoch) {
      epoch = stored.epoch; provisional = false; ledger = stored.ledger || null; session = newSession(stored.events); release(null);
      settled.clear(); settledVersion += 1; settle(stored.settled || [], new Set(stored.events.map(e => e.id)));
      takeDropped(stored.dropped || [], false); return;
    }
    // The later fold wins. Entries it folded are dropped from the other side; each side keeps
    // its own entries (a synchronised log may keep a late entry from before the cutoff).
    const theirs = stored.ledger || null, order = Ledger.compare(ledger, theirs), mine = log();
    const storedIds = new Set(stored.events.map(e => e.id)), mineIds = new Set(mine.map(e => e.id));
    // Items fold whole: an entry whose item a side still keeps (its parent, or a parent kept here) was not folded there.
    const kept = new Set(), keeps = (e, ids) => ids.has(e.id) || ids.has(Ledger.reference(e)) || kept.has(Ledger.reference(e));
    const combined = mine.filter(e => (order >= 0 || keeps(e, storedIds) || !Ledger.folded(theirs, e)) && kept.add(e.id)), known = new Map(combined.map(e => [e.id, e]));
    for (const e of stored.events) {
      if (order > 0 && !keeps(e, mineIds) && Ledger.folded(ledger, e)) continue;
      if (known.has(e.id)) { if (!sameEvent(known.get(e.id), e)) {
        readable = false; complete = false; warning = '기록 내용이 서로 달라 연결을 중단했어요. 기존 기록은 보존해요.';
        notify('storage-error', 'STORAGE_ERROR');
        throw Object.assign(new Error('Atlas: conflicting stored event'), { code: 'STORAGE_ERROR' });
      } }
      else { known.set(e.id, e); combined.push(e); kept.add(e.id); }
    }
    ledger = Ledger.reconcile(ledger, theirs) || (order < 0 ? theirs : ledger);
    // A response whose set the other side folded leaves here with any exclusion of it (it stays there and on the server).
    const types = new Map([...mine, ...stored.events].map(e => [e.id, e.type]));
    for (const e of combined) if (e.type === 'feedback.given' && !known.has(e.completionId) || e.type === 'record.excluded' && !known.has(e.targetId) && types.get(e.targetId) === 'feedback.given') known.delete(e.id);
    settle([...settled, ...(stored.settled || [])], known);
    takeDropped(stored.dropped || [], order > 0);
    // Whatever this side drops in the merge (folded by the other side, or orphaned) is accounted for: a sync never takes
    // it for lost, and lets go of one it still queued (learning-sync collect) instead of blocking.
    const gone = [...mine, ...combined].filter(e => !known.has(e.id));
    if (folding?.remote && gone.length) { for (const e of gone) dropped.add(e.id); droppedVersion += 1; }
    session = newSession(combined.filter(e => known.has(e.id)));
    release(id => !known.has(id));
  }
  // Byte-identical to JSON.stringify({ version, epoch, events, owner }). Log entries are
  // frozen, so each is serialised once, and since the log only grows within one session
  // object the joined text is extended rather than rebuilt on every write.
  const serialised = new WeakMap();
  const entryJson = e => { let json = serialised.get(e); if (json === undefined) { json = JSON.stringify(e); if (Object.isFrozen(e)) serialised.set(e, json); } return json; };
  let body = null, ledgerJson = null, settledJson = null, droppedJson = null, retryFold = null;
  const snapshot = events => {
    if (!(body && body.session === session && body.count <= events.length && (body.count === 0 || events[body.count - 1] === body.last))) body = { session, count: 0, last: null, text: '' };
    for (; body.count < events.length; body.count += 1) body.text += (body.count ? ',' : '') + entryJson(events[body.count]);
    body.last = body.count ? events[body.count - 1] : null;
    if (ledgerJson?.ledger !== ledger) ledgerJson = { ledger, text: ledger ? `,"ledger":${JSON.stringify(ledger)}` : '' };
    if (settledJson?.version !== settledVersion) settledJson = { version: settledVersion, text: settled.size ? `,"settled":${JSON.stringify([...settled])}` : '' };
    if (droppedJson?.version !== droppedVersion) droppedJson = { version: droppedVersion, text: dropped.size ? `,"dropped":${JSON.stringify([...dropped])}` : '' };
    return `{"version":1,"epoch":${JSON.stringify(epoch)},"events":[${body.text}]${ledgerJson.text}${settledJson.text}${droppedJson.text}`
      + `${storageScope === 'account' ? `,"owner":${JSON.stringify(accountKey)}` : ''}}`;
  };
  // Fold older, finished items once the kept log grows past the limit (see `fold`).
  function compact() {
    // A large server restore keeps its complete causal log in durable pages. In
    // particular, later pages may contain feedback/exclusions for early parents.
    if (!folding || paged) return;
    const events = log(), now = Date.parse(monotonicClock());
    if (events.length <= folding.max) return;
    // Nothing could fold a moment ago: try again after a minute or once more entries settle.
    if (retryFold && retryFold.settled === settledVersion && now < retryFold.at) return;
    // An item idle for `ageMs` is finished; a late call on it ends like a reset presentation.
    // What the game holds open stays. A synchronised store also keeps every item the server has
    // not sent back yet, and unanswered items for 30 days: their answer may still come from another device.
    const open = held(now);
    const retained = followups ? readFollowups(events, { scope, asOf: new Date(now).toISOString(), prior: ledger, retain: true }) : null;
    if (retained) open.push(...retained.retainDecisionIds);
    if (folding.remote) for (const e of events) if (!settled.has(e.id)) open.push(e.id);
    const planned = Ledger.plan(events, { keep: folding.keep, olderThan: now - folding.ageMs, open,
      unfinishedBefore: folding.remote ? now - 30 * 86400000 : now - folding.ageMs, respondedBefore: now - RESPONSE_MS - SET_OPEN_MS });
    // Fold in batches: rewriting the summary for one item at a time costs more than it saves.
    const batch = Math.max(1, Math.floor((folding.max - folding.keep) / 2));
    if (!planned || planned.folded.length < batch && events.length < 2 * folding.max) { retryFold = { settled: settledVersion, at: now + 60000 }; return; }
    retryFold = null;
    const preserved = followups && (!ledger?.folded || ledger.followupsPreserved === true);
    ledger = Ledger.fold(ledger, planned.folded, { scope, log: events, local: !folding.remote });
    ledger.followupsPreserved = preserved;
    if (retained?.coverage.retentionLimited && !ledger.followupsLost) {
      ledger.followupsLost = { anchors: retained.coverage.unretainedAnchors, at: now };
    }
    session = newSession(planned.kept);
    for (const e of planned.folded) settled.delete(e.id);
    settledVersion += 1; release(id => planned.folded.some(e => e.id === id));
    if (folding.remote) { for (const e of planned.folded) dropped.add(e.id); droppedVersion += 1; }
  }
  function persist(kind = 'append', { quiet = false, access = null } = {}) {
    if (closed || closing && access !== FINAL_FLUSH) return false;
    waitingWrite = true;
    if (!leased) { writable = false; warning = leaseWarning; notify('storage-wait', 'STORAGE_BUSY'); return false; }
    if (!storage || !readable) { complete = false; notify('storage-error', 'STORAGE_ERROR'); return false; }
    try {
      if (pages && log().length > THRESHOLD) paged = true;
      compact();
      const events = log();
      if (!pages && events.length > 20000) throw Object.assign(new Error('Atlas: local history limit'), { code: 'HISTORY_CAPACITY' });
      let raw;
      if (paged) raw = pages.write({ version: 1, epoch, events, owner: accountKey,
        ...(ledger ? { ledger } : {}), ...(settled.size ? { settled: [...settled] } : {}), ...(dropped.size ? { dropped: [...dropped] } : {}) },
      typeof lastStoredRaw === 'string' ? lastStoredRaw : null);
      else { raw = snapshot(events); storage.setItem(key, raw); }
      lastStoredRaw = raw; rememberSaved(); provisional = false; writable = true; waitingWrite = false; if (!quiet) notify(kind); return true;
    } catch (error) { writable = false; complete = false; warning = '기록을 저장하지 못했어요. 이번 연습은 다음 접속에 이어지지 않을 수 있어요.'; notify('storage-error', error.code === 'HISTORY_CAPACITY' ? 'HISTORY_CAPACITY' : 'STORAGE_ERROR'); return false; }
  }
  // Initialize one shared epoch before a second game/tab opens it.
  if (!initial && readable && storage) persist();
  const requireDurable = () => { if (closed || closing) throw Object.assign(new Error('Atlas: game closed'), { code: 'GAME_CLOSED' }); refresh(); if (!leased) throw Object.assign(new Error('Atlas: another browser context owns this history'), { code: 'STORAGE_BUSY' }); if (!readable || !writable) throw Object.assign(new Error('Atlas: local history is not durable'), { code: 'STORAGE_ERROR' }); };
  const port = Object.freeze({
    scope: storageScope, accountKey,
    canPersist: () => !closed && !closing && leased,
    // The kept entries. A synchronised store's folded entries are on the server; whether this
    // history can be sent at all is partial().
    events() { requireDurable(); return session.events(); },
    // The kept entries' ids, without copying the entries: a WORLD host compares them around a
    // game call to find what the call added (account/world-learning-host.js).
    ids() { requireDurable(); return log().map(e => e.id); },
    // True when this store folded entries no server has received (it was not synchronised then):
    // its history can never be sent whole, so a synchroniser must not send it.
    partial() { refresh(); return !!ledger?.local; },
    // The sync calls this after a complete pull with every entry id the server has sent:
    // those entries may fold here. Saved quietly (it is not a new learning entry).
    settle(ids) {
      if (closed || closing) return false;
      if (!folding?.remote || !Array.isArray(ids)) return false;
      refresh(); if (!readable) return false;
      const version = settledVersion;
      settle([...settled, ...ids], new Set(log().map(e => e.id)));
      return settledVersion === version || persist('settle', { quiet: true });
    },
    // Ids this store folded away since the synchroniser last took them (always on the server).
    dropped() { refresh(); return [...dropped]; },
    // The synchroniser has taken these (saved in its own outbox first).
    forget(ids) {
      if (closed || closing) return false;
      refresh(); if (!readable || !Array.isArray(ids)) return false;
      const version = droppedVersion;
      for (const id of ids) if (dropped.delete(id)) droppedVersion = version + 1;
      return droppedVersion === version || persist('forget', { quiet: true });
    },
    subscribe(listener) { if (closed || closing) throw Object.assign(new Error('Atlas: game closed'), { code: 'GAME_CLOSED' });if (typeof listener !== 'function') throw new TypeError('Atlas: listener required');listeners.add(listener);return () => listeners.delete(listener); },
    markComplete(value) { if (closed || closing) return false;complete = value === true; },
    importEvents(incoming) {
      if (closed || closing) throw Object.assign(new Error('Atlas: game closed'), { code: 'GAME_CLOSED' });
      refresh();
      if (!readable) throw Object.assign(new Error('Atlas: local history is unreadable'), { code: 'STORAGE_ERROR' });
      if (ledger?.local) throw Object.assign(new Error('Atlas: a folded history is kept on this device only'), { code: 'HISTORY_FOLDED' });
      if (!Array.isArray(incoming)) throw new TypeError('Atlas: imported events must be an array');
      const combined = log().slice(), previousLength = combined.length, known = new Map(combined.map(event => [event.id, event])), late = [], gone = [], skipped = [];
      for (const event of incoming) {
        if (known.has(event?.id)) {
          if (!sameEvent(known.get(event.id), event)) throw Object.assign(new Error('Atlas: conflicting imported event'), { code: 'EVENT_CONFLICT' });
        // Another device's entry for an item this store already folded stays on the server.
        } else if (ledger && Ledger.stray(event, known)) {
          // Folded parents are no longer available for link checks. The incoming event still
          // has to be well formed and belong to this log before it can adjust folded evidence.
          Atlas.validate(event);
          if (['domain', 'workspace', 'subject'].some(field => event.scope[field] !== scope[field])) throw new Error('Atlas: scope mismatch');
          skipped.push(event.id); if (event.type === 'record.excluded') gone.push(event.targetId); continue;
        }
        else { known.set(event?.id, event); combined.push(event); if (Ledger.folded(ledger, event)) late.push(event); }
      }
      // Identical durable history needs neither replay nor another disk write.
      // A previous storage failure must still retry persistence below.
      if (combined.length === previousLength && !skipped.length && writable && (paged || snapshot(combined) === lastStoredRaw)) return { added: 0, skipped };
      // Construct before replacing: wrong scope, parent links, schema or IDs
      // reject the entire incoming batch without changing the local log.
      const imported = newSession(combined); session = imported;
      if (late.length || skipped.length) ledger = Ledger.demote(ledger, { late, excluded: gone, strays: skipped.length }, id => known.get(id));
      if (!persist('import')) throw Object.assign(new Error('Atlas: imported history could not be saved'), { code: 'STORAGE_ERROR' });
      return { added: combined.length - previousLength, skipped };
    },
  });
  if (lease) {
    const changed = active => {
      leased = active;
      if (closing) {
        if (active) { try { writable = true; closedFlush = flushHistory(FINAL_FLUSH); } catch { closedFlush = false; } finally { retireHistory(); } }
        return;
      }
      if (!active) { writable = false; warning = leaseWarning; notify('storage-wait', 'STORAGE_BUSY'); return; }
      writable = true; if (warning === leaseWarning) warning = null;
      try { refresh(); if (!waitingWrite || persist('storage-ready', { quiet: true })) notify('storage-ready'); }
      catch { readable = false; complete = false; writable = false; notify('storage-error', 'STORAGE_ERROR'); }
    };
    lease.listeners.add(changed); detachLease = () => lease.detach(changed); changed(lease.active); lease.start();
  }
  function flushHistory(access = null) { if (closed || closing && access !== FINAL_FLUSH) return closedFlush; refresh(access); return !!storage && readable && (writable && (paged ? unchangedPaged() : snapshot(log()) === lastStoredRaw) || persist('flush', { quiet: true, access })); }
  function retireHistory() { closed = true; closing = false; leased = false; readable = false; writable = false; complete = false; detachLease(); }
  return Object.freeze({ port, refresh, clock: monotonicClock,
    close() {
      if (closed || closing) return closedFlush;
      closing = true; listeners.clear(); release(null);
      try { closedFlush = flushHistory(FINAL_FLUSH); } catch { retireHistory(); return false; }
      // A disposed game's already-created practice still owns its final write.
      // Keep only the existing lease waiter until it merges and drains; all
      // public ports are closed immediately, and no game callback can revive it.
      const pending = paged ? !unchangedPaged() : snapshot(log()) !== lastStoredRaw;
      if (!closedFlush && pending && storage && readable && lease?.supported && !leased) return false;
      retireHistory(); return closedFlush;
    },
    // What is saved now. `session` is the log the game appends to (only this owner replaces it);
    // `available`: it can be read and written; `durable`: also complete, so only then is an answer independent.
    state() { const of = session; return Object.freeze({ epoch, session: of, get log() { return log(of); }, ledger, available: readable && writable, durable: complete && readable && writable, warning }); },
    persist: () => persist(),
    // Before a tab closes or hides: another tab may have written an older history over this
    // one's entries in the meantime (tabs see each other's writes late), so join and write again.
    flush: flushHistory,
    reset() {
      if (!leased) throw Object.assign(new Error('Atlas: another browser context owns this history'), { code: 'STORAGE_BUSY' });
      // Commit the empty root before changing memory or releasing open work.
      // A failed write leaves the original epoch, events and work usable.
      const nextEpoch = uid(), nextSession = newSession([]);
      const raw = JSON.stringify({ version: 1, epoch: nextEpoch, events: [], ...(storageScope === 'account' ? { owner: accountKey } : {}) });
      try { if (storage) storage.setItem(key, raw); }
      catch { writable = false; warning = '기록을 저장하지 못해 초기화하지 않았어요.'; notify('storage-error', 'STORAGE_ERROR'); throw Object.assign(new Error('Atlas: reset could not be saved'), { code: 'STORAGE_ERROR' }); }
      epoch = nextEpoch; provisional = false; session = nextSession; ledger = null; settled.clear(); settledVersion += 1; takeDropped([], false);
      readable = true; writable = !!storage; complete = historyComplete; warning = null; waitingWrite = false; lastStoredRaw = storage ? raw : null;
      body = ledgerJson = settledJson = droppedJson = retryFold = null; paged = false;
      release(null); if (storage) notify('append');
    },
  });
}
function createGame({ gameId, map, storage = null, learnerKey = 'device', clock = () => new Date().toISOString(), historyComplete = true,
  storageScope = 'device', accountKey = null, fold = null, followups = false, memoryOwner = null } = {}) {
  if (!identifier(gameId) || !identifier(learnerKey) || typeof map?.allNodes !== 'function') throw new TypeError('Atlas: game, local scope and Strata map required');
  if (typeof followups !== 'boolean') throw new TypeError('Atlas: follow-up retention must be explicit');
  if (!['device', 'account'].includes(storageScope) || storageScope === 'account' && (!identifier(accountKey) || learnerKey !== 'device')) throw new TypeError('Atlas: account identity and isolated host storage required');
  // An authenticated host may keep personal memory apart from a class's evidence log. The
  // owner stays inside the host; a frame receives neither its storage nor this private port.
  if (memoryOwner != null && (storageScope !== 'account' || memoryOwner.scope !== 'account' || !identifier(memoryOwner.accountKey)
    || !memoryOwner.flow || ['today', 'setToday', 'presentation', 'setPresentation', 'epoch', 'memories', 'save', 'decline', 'state', 'merge', 'subscribe'].some(name => typeof memoryOwner.flow[name] !== 'function'))) throw new TypeError('Atlas: a verified personal memory owner is required');
  const scope = { domain: 'LAB', workspace: 'learning', subject: learnerKey };
  const key = `${KEY}.${learnerKey}`;
  // Core's moment-level challenge keeps one small memory per content beside this log (game-flow.js).
  let flowPort = null, disposed = false;
  const active = new Map(), sets = new Map(); // sets: finished here in the last day (decision → time), still open to a response
  // Held open here, so never folded: an item not answered in this tab, a set still taking a response.
  // An epoch change (a reset here or in another tab) ends all of them, a fold or a merge what it took.
  const history = openHistory({ storage, key, scope, storageScope, accountKey, historyComplete, fold, followups, clock,
    held: now => { const open = [...active].filter(([, item]) => !item.results.length).map(([pid]) => pid); for (const [id, at] of sets) if (now - at < SET_OPEN_MS) open.push(id); else sets.delete(id); return open; },
    release: gone => { if (!gone) { active.clear(); sets.clear(); } else for (const pid of active.keys()) if (gone(pid)) active.delete(pid); } });
  const monotonicClock = history.clock;
  const current = () => { history.refresh(); return history.state(); };
  const practiceSession = { practice: (...args) => history.state().session.practice(...args) };
  // Derived views are rebuilt only when the log changes; the frozen snapshot is the log
  // itself, so the same array means nothing was added. Policy windows (7/30 days) move
  // with time, so a view is not reused for long even when nothing was added.
  const VIEW_MS = 60000;
  let cached = null, met = null;
  function view(saved) {
    const events = saved.log, asOf = monotonicClock(), now = Date.parse(asOf);
    if (cached?.events === events && now - cached.now < VIEW_MS) return cached.summary;
    cached = { events, now, summary: Trail.summarize(events, { scope, asOf, prior: saved.ledger }), profiles: new Map(), counts: null };
    return cached.summary;
  }
  function profileOf(observed, { durable, ledger }) {
    const flag = String(durable);
    if (cached?.summary === observed && cached.profiles.has(flag)) return cached.profiles.get(flag);
    const profile = { ...Learning.summarizeLearning({ summary: observed, map, complete: durable, prior: ledger }),
      concepts: Learning.summarizeConcepts({ summary: observed, map, complete: durable, prior: ledger }) };
    if (cached?.summary === observed) cached.profiles.set(flag, profile);
    return profile;
  }
  // Trail's provenance, kept current entry by entry. The log only grows within one
  // session object, so new entries are folded in; a replaced session is read again.
  // Rows are grouped by skill, difficulty and response format, as summarizeLearning() does.
  function provenance(saved) {
    const events = saved.log;
    if (!met || met.session !== saved.session) met = { session: saved.session, done: 0, index: Trail.createIndex({ scope, prior: saved.ledger }), buckets: new Map() };
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
  function basisOf(measure, saved) {
    const known = provenance(saved);
    if (!known.index.exact) return profileOf(view(saved), saved).skills.find(s => s.id === measure.skillId).levels[measure.difficulty].formats[measure.responseFormat];
    const key = `${measure.skillId}|${measure.difficulty}|${measure.responseFormat}`, cell = Ledger.cellOf(saved.ledger, key);
    const rows = (known.buckets.get(key) || []).filter(row => !row.omitted);
    return Learning.formatEvidence(rows, { now: Date.parse(monotonicClock()), complete: saved.durable,
      difficulty: measure.difficulty, responseFormat: measure.responseFormat, base: cell ? Ledger.rows(cell) : null });
  }
  function report(saved) {
    const observed = view(saved), { ledger } = saved;
    const measured = () => {
      const counts=Temper.combine(ledger?.counts || null, Temper.measure(observed));
      // Withdrawn folded evidence is removed from policy cells. Its historical
      // local totals require the server's whole log for exact measurement.
      return ledger?.adjusted&&counts?{...counts,status:counts.status==='measured'?'approximate':counts.status,approximate:true}:counts;
    };
    if (cached?.summary === observed && !cached.counts) cached.counts = measured();
    // `folded`/`adjusted`: entries kept only as a summary, and other devices' late entries that
    // summary took in approximately (learning-ledger.js).
    return { ...profileOf(observed, saved), storage: { available: saved.available, scope: storageScope, warning: saved.warning,
      ...(ledger ? { folded: ledger.folded, adjusted: ledger.adjusted || 0 } : {}) },
      counts: cached?.summary === observed ? cached.counts : measured() };
  }
  function requireActive(pid) {
    const saved = current(), item = active.get(pid); if (!item) throw new Error('Atlas: presentation ended or local record reset'); return [item, saved];
  }
  const api = {
    mapVersion: map.map_ver,
    syncPort: history.port,
    summary: () => report(current()),
    followups() {
      const saved = current();
      return readFollowups(saved.log, { scope, asOf: monotonicClock(), prior: saved.ledger, complete: saved.durable, retain: followups });
    },
    recommend(candidates, options = {}) {
      const saved = current(), profile = report(saved);
      return { ...Learning.recommend({ profile, candidates, presentations: view(saved).presentations, prior: saved.ledger, ...options }), storage: profile.storage };
    },
    recommendActivities(candidates, options = {}) {
      const saved = current(), profile = report(saved);
      return { ...Learning.recommendActivities({ ...options, profile, candidates, presentations: view(saved).presentations, prior: saved.ledger }), storage: profile.storage };
    },
    // Display exposure is stricter than independent-attempt qualification: an item
    // shown without an answer is still not a never-shown item. Both include folded history.
    exposure(item) {
      if (!identifier(item?.itemKey) || !identifier(item.familyKey || item.itemKey)) throw new TypeError('Atlas: invalid exposure item');
      const saved = current(), family = item.familyKey || item.itemKey;
      const shown = saved.log.some(e => e.type === 'practice.presented' && (e.itemKey === item.itemKey || (e.measure?.familyKey || e.itemKey) === family))
        || (saved.ledger?.presented || []).some(([_task, priorItem, priorFamily]) => priorItem === item.itemKey || priorFamily === family);
      return { seen: shown || provenance(saved).index.met(item.itemKey, family) ? true : saved.durable ? false : null };
    },
    // A consumer supplies the two attempts it deliberately joined in this round.
    // This reads recent full events only: no durable lineage, profile update or causal claim.
    recheck(sourceAttemptId, targetAttemptId) {
      if (![sourceAttemptId, targetAttemptId].every(identifier)) throw new TypeError('Atlas: invalid recheck attempt IDs');
      const result = { sourceAttemptId, targetAttemptId, correctionObserved: false, correctionEventIds: [], learningEffectClaim: false };
      const unavailable = reason => ({ ...result, status: 'unavailable', line: '새 문항 확인 결과를 판단할 기록이 충분하지 않아요.', reason });
      let saved;
      try { saved = current(); } catch { return unavailable('incomplete-history'); }
      if (!saved.durable || saved.ledger?.adjusted) return unavailable('incomplete-history');
      const events = saved.log, positions = new Map(events.map((event, index) => [event.id, index]));
      const byId = new Map(events.map(event => [event.id, event]));
      const sourceEvent = byId.get(sourceAttemptId), targetEvent = byId.get(targetAttemptId);
      if (sourceEvent?.type !== 'practice.attempted' || targetEvent?.type !== 'practice.attempted') return unavailable('missing-attempt');
      if (sourceEvent.attemptNo !== 1 || targetEvent.attemptNo !== 1) return unavailable('not-first-attempt');
      const sourcePresentation = byId.get(sourceEvent.presentationId), targetPresentation = byId.get(targetEvent.presentationId);
      const sourceDecision = byId.get(sourcePresentation?.decisionId), targetDecision = byId.get(targetPresentation?.decisionId);
      if (sourcePresentation?.type !== 'practice.presented' || targetPresentation?.type !== 'practice.presented'
        || sourceDecision?.type !== 'decision.made' || targetDecision?.type !== 'decision.made') return unavailable('missing-parent');
      const sourceCompletion = events.find(event => event.type === 'experience.completed' && event.decisionId === sourceDecision.id);
      const targetCompletion = events.find(event => event.type === 'experience.completed' && event.decisionId === targetDecision.id);
      if (!sourceCompletion || !targetCompletion) return unavailable('missing-completion');
      const now = Date.parse(monotonicClock());
      const visible = event => Date.parse(event.at) <= now && Date.parse(event.recordedAt) <= now;
      const before = (a, b) => positions.get(a.id) < positions.get(b.id)
        && Date.parse(a.at) <= Date.parse(b.at) && Date.parse(a.recordedAt) <= Date.parse(b.recordedAt);
      const required = [sourceDecision, sourcePresentation, sourceEvent, sourceCompletion, targetDecision, targetPresentation, targetEvent, targetCompletion];
      if (!required.every(visible) || !before(sourcePresentation, sourceEvent) || !before(sourceEvent, targetPresentation)
        || !before(targetPresentation, targetEvent) || !before(sourceEvent, sourceCompletion) || !before(targetEvent, targetCompletion)) return unavailable('invalid-order');
      const relevant = new Set(required.map(event => event.id));
      for (const event of events) if (['practice.helped', 'practice.delivery'].includes(event.type)
        && (event.presentationId === sourcePresentation.id && before(event, sourceEvent)
          || event.presentationId === targetPresentation.id && before(event, targetEvent))) relevant.add(event.id);
      if (events.some(event => event.type === 'record.excluded' && relevant.has(event.targetId))) return unavailable('excluded-evidence');
      if (sourceDecision.experienceId !== targetDecision.experienceId) return unavailable('different-game');
      const a = sourcePresentation.measure, b = targetPresentation.measure;
      if (!a || !b || !Learning.RESPONSE_FORMATS.includes(a.responseFormat) || a.responseFormat === 'unknown'
        || ['skillId', 'difficulty', 'responseFormat', 'modality', 'audioRequired'].some(key => a[key] !== b[key])
        || sourcePresentation.taskVersion !== targetPresentation.taskVersion) return unavailable('different-measurement');
      if (sourcePresentation.itemKey === targetPresentation.itemKey || a.familyKey === b.familyKey) return unavailable('same-family');
      // Trail's exposure is based on attempts/reveals. "New" here additionally forbids
      // a previous presentation, including one with no answer and folded presentations.
      const priorPresentation = events.some(event => event.type === 'practice.presented' && event.id !== targetPresentation.id
        && (positions.get(event.id) < positions.get(targetPresentation.id) || Date.parse(event.at) < Date.parse(targetPresentation.at))
        && (event.itemKey === targetPresentation.itemKey || (event.measure?.familyKey || event.itemKey) === b.familyKey));
      if (priorPresentation || (saved.ledger?.presented || []).some(([_task, item, family]) => item === targetPresentation.itemKey || family === b.familyKey)) return unavailable('previously-presented');
      const observed = view(saved), source = observed.attempts.find(row => row.eventId === sourceAttemptId), target = observed.attempts.find(row => row.eventId === targetAttemptId);
      if (!source || !target || source.exclusionReason || target.exclusionReason
        || !['correct', 'incorrect'].includes(source.verdict) || !['correct', 'incorrect'].includes(target.verdict)) return unavailable('unassessable');
      if (source.verdict === 'correct' && source.assisted !== true) return unavailable('source-not-recheck');
      if (targetPresentation.firstExposure !== true || target.exposure !== 'new' || ![true, false].includes(target.assisted)
        || target.assisted === false && !target.independent) return unavailable('unknown-provenance');
      const corrections = observed.help.filter(help => help.presentationId === sourcePresentation.id && help.level === 'answer'
        && before(sourceEvent, byId.get(help.eventId)) && before(byId.get(help.eventId), targetPresentation));
      const status = `${target.assisted ? 'assisted' : 'independent'}-${target.verdict}`;
      const lines = { 'independent-correct': '다른 새 문항은 도움 없이 맞혔어요.', 'independent-incorrect': '다른 새 문항은 도움 없이 풀었지만 틀렸어요.',
        'assisted-correct': '다른 새 문항은 도움을 보고 맞혔어요.', 'assisted-incorrect': '다른 새 문항은 도움을 보고 풀었지만 틀렸어요.' };
      return { ...result, status, line: lines[status], correctionObserved: corrections.length > 0, correctionEventIds: corrections.map(help => help.eventId),
        source: { verdict: source.verdict, assisted: source.assisted, independent: source.independent },
        target: { verdict: target.verdict, assisted: target.assisted, independent: target.independent } };
    },
    present(item, context = {}) {
      const saved = current();
      if (!context || typeof context !== 'object' || Object.keys(context).some(k => k !== 'flow') || (context.flow != null && (typeof context.flow !== 'object' || Array.isArray(context.flow)))) throw new TypeError('Atlas: invalid presentation context');
      const node = map.getNode(item?.skillId);
      if (!node || node.domain !== item.modality || !identifier(item.id) || !identifier(item.itemKey)
        || !identifier(item.familyKey || item.itemKey) || ![1, 2, 3].includes(item.difficulty)
        || !Learning.RESPONSE_FORMATS.includes(item.responseFormat ?? 'unknown')) throw new TypeError('Atlas: invalid measured item');
      const measure = { skillId: item.skillId, modality: item.modality, difficulty: item.difficulty,
        responseFormat: item.responseFormat ?? 'unknown',
        familyKey: item.familyKey || item.itemKey, audioRequired: item.audioRequired ?? item.modality === 'listening', confounded: !!item.confounded };
      // Analytical exclusion cannot erase exposure to an item or its answer.
      const seen = provenance(saved).index.met(item.itemKey, measure.familyKey);
      const basis = basisOf(measure, saved);
      // Snapshot the actual Core state used at delivery so the choice is reviewable.
      const decision = saved.session.plan(gameId, [{ id: item.id, minutes: 3, pace: 'standard',
        learning: { policy: Learning.POLICY.version, skillId: item.skillId, difficulty: item.difficulty, responseFormat: measure.responseFormat,
          state: basis.status, evidence: basis.evidence }, ...(context.flow ? { flow: JSON.parse(JSON.stringify(context.flow)) } : {}) }]);
      // Content the item uses (words, grammar) comes after its ability; never another ability.
      const content = item.conceptIds ?? [];
      if (!Array.isArray(content) || content.length > 31 || new Set(content).size !== content.length
        || content.some(id => !identifier(id) || !Learning.CONTENT.includes(map.getNode(id)?.kind))) throw new TypeError('Atlas: invalid measured item');
      const task = { id: item.id, version: map.map_ver, itemKey: item.itemKey, concepts: [item.skillId, ...content], tags: [], measure };
      const practice = Core.createPractice({ session: practiceSession, decision, map, task,
        assess: result => ({ verdict: result.assessable === false ? 'unassessed' : result.correct == null ? 'skipped' : result.correct ? 'correct' : 'incorrect', errorTags: [] }),
        firstExposure: seen ? false : saved.durable ? true : null });
      active.set(practice.presentation.id, { practice, measure, decision, audio: 'pending', results: [] }); history.persist();
      return practice.presentation.id;
    },
    help(pid, kind) {
      const [p] = requireActive(pid);
      if (!['text', 'hint', 'answer', 'replay', 'explanation'].includes(kind)) throw new TypeError('Atlas: invalid help kind');
      const result = p.practice.delivered({ id: kind, level: ['answer', 'explanation'].includes(kind) ? kind : 'cue', contentRef: `${gameId}.${kind}` }); history.persist(); return result;
    },
    delivery(pid, { audio }) {
      const [p, saved] = requireActive(pid); p.audio = audio;
      const result = saved.session.practice('delivery', { presentationId: pid, audio }); history.persist(); return result;
    },
    answer(pid, result) {
      const [p, saved] = requireActive(pid);
      if (!result || ![true, false, null].includes(result.correct) || typeof result.assessable !== 'boolean') throw new TypeError('Atlas: answer must identify assessability');
      const choice = Object.hasOwn(result, 'choice') ? Trail.choiceRecord(result.choice) : null;
      const attemptNo = result.attemptNo ?? 1;
      if (!Number.isInteger(attemptNo) || attemptNo < 1 || attemptNo > p.results.length + 1) throw new TypeError('Atlas: attempts must be consecutive');
      if (p.results[attemptNo - 1]) { const earlier = p.results[attemptNo - 1]; return { ...earlier, ...(earlier.choice ? { choice: { ...earlier.choice } } : {}) }; }
      const reason = p.measure.confounded ? (result.reason || 'visual') : p.measure.audioRequired && p.audio !== 'completed' ? 'audio'
        : !saved.available ? 'storage' : result.reason;
      const assessable = result.assessable && !p.measure.confounded && (!p.measure.audioRequired || p.audio === 'completed') && saved.available;
      const attempt = p.practice.submit({ ...result, assessable }, { reason: reason || null, ...(choice ? { choice } : {}) });
      saved.session.complete(p.decision); history.persist();
      // Independence is read after the write: an answer the store could not keep never counts.
      // The row summarize() would give this answer, read from the index when it is exact.
      const after = history.state(), known = provenance(after), row = known.index.attempt(attempt.eventId);
      const actual = known.index.exact ? (row && !row.omitted ? row : undefined) : view(after).attempts.find(a => a.eventId === attempt.eventId);
      const recorded = { ...attempt, independent: !!actual?.independent && after.durable, reason: reason || null,
        assisted: actual?.assisted ?? null, exposure: actual?.exposure ?? null };
      p.results.push(recorded); return { ...recorded, ...(recorded.choice ? { choice: { ...recorded.choice } } : {}) };
    },
    exclude(eventId) { const event = current().session.exclude(eventId); history.persist(); return event; },
    // A practice set ended (short practice, quick check, exam-form practice): a `<gameId>.set` decision and completion, so a
    // response is about the set, not its last item. One 5-minute candidate, so a short-time setting never blocks it.
    // Both entries are written together, once.
    finishSet({ kind } = {}) {
      const { session } = current(); if (!SET_KINDS.includes(kind)) throw new TypeError('Atlas: invalid practice set');
      const decision = session.plan(`${gameId}.set`, [{ id: kind, minutes: 5, pace: 'standard' }]);
      if (decision.status !== 'ready') throw new Error('Atlas: practice set could not be recorded');
      const completion = session.complete(decision); sets.set(decision.id, Date.parse(completion.at)); history.persist();
      return { decisionId: decision.id, completionId: completion.id };
    },
    // A response to a finished set. It names the set's decision too, so a store folding by the older reference() keeps the
    // set with it. The same value again adds nothing; another value replaces it.
    feedback(set, value) {
      const saved = current(); if (!RESPONSES.includes(value) || !identifier(set?.completionId) || !identifier(set?.decisionId)) throw new TypeError('Atlas: invalid set response');
      const done = saved.log.find(e => e.id === set.completionId);
      if (done?.type !== 'experience.completed' || done.experienceId !== `${gameId}.set` || done.decisionId !== set.decisionId
        || Date.parse(monotonicClock()) - Date.parse(done.at) > SET_OPEN_MS) throw Object.assign(new Error('Atlas: this practice set no longer takes a response'), { code: 'SET_UNAVAILABLE' });
      if (saved.session.state().feedback.find(f => f.completionId === done.id)?.value === value) return null;
      const event = saved.session.feedback(done.id, value, done.decisionId); history.persist(); return event;
    },
    // Responses to this game's sets that Core still reads (30 days, not excluded), oldest first.
    setFeedback() {
      return current().session.state().feedback.filter(f => f.experienceId === `${gameId}.set`)
        .map(f => ({ id: f.id, completionId: f.completionId, decisionId: f.decisionId ?? null, value: f.value, kind: f.variant, at: f.at }));
    },
    events() { return current().session.events(); },
    flush: () => history.flush(),
    reset() {
      if (storageScope === 'account') throw Object.assign(new Error('Atlas: account deletion requires the host consent/reset API; local reset cannot delete server records'), { code: 'ACCOUNT_RESET_REQUIRED' });
      history.reset(); flowPort.clear();
      return api.summary();
    },
  };
  // The flow memory follows the log's epoch, so a reset in another tab is not undone from here.
  flowPort = memoryOwner?.flow || createFlowPort({ storage, key, clock: monotonicClock, canPersist: history.port.canPersist, epoch: () => { try { history.refresh(); } catch { /* the log reports its own error */ } return history.state().epoch; } });
  api.today = flowPort.today;
  api.setToday = flowPort.setToday;
  api.presentation = flowPort.presentation;
  api.setPresentation = flowPort.setPresentation;
  // What memory-sync.js exchanges for an account: the chosen presentation, content memories and
  // declined offers. Today's condition stays on the device.
  api.memoryPort = Object.freeze({ scope: memoryOwner?.scope || storageScope, accountKey: memoryOwner?.accountKey || accountKey,
    state: flowPort.state, merge: flowPort.merge, subscribe: flowPort.subscribe, flow: flowPort,
    pending: flowPort.pending, prepare: flowPort.prepare, acknowledge: flowPort.acknowledge, epoch: flowPort.epoch });
  api.live = createLive({ coach: api, port: flowPort, clock: monotonicClock });
  api.dispose = () => { if (disposed) return; disposed = true; history.close(); cached = null; met = null; };
  for (const [name, method] of Object.entries(api)) if (typeof method === 'function' && !['dispose', 'flush'].includes(name)) {
    api[name] = (...args) => { if (disposed) throw Object.assign(new Error('Atlas: game closed'), { code: 'GAME_CLOSED' }); return method(...args); };
  }
  return api;
}
module.exports = { createGame, createLearningSync, createMemorySync, summarizeLearning: Learning.summarizeLearning, recommend: Learning.recommend,
  recommendActivities: Learning.recommendActivities, POLICY: Learning.POLICY, ACTIVITY_POLICY: Learning.ACTIVITY_POLICY, RESPONSE_FORMATS: Learning.RESPONSE_FORMATS, KEY };
