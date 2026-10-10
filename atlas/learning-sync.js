'use strict';
// Authenticated hosts provide the account-isolated stores and transport. This
// module never discovers identities, adopts guest history, or uploads snapshots.
const SYNC_KEY = 'synk.atlas.learning-sync.v1';
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, function (_key, entry) {
  return entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry;
});
const sameEvent = (a, b) => canonical(a) === canonical(b);
const failure = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const errorCode = error => error?.code || error?.error?.code || error?.body?.error?.code || 'NETWORK_ERROR';
const FATAL = new Set(['REVISION_CONFLICT', 'LEARNING_DISABLED', 'FEATURE_DISABLED', 'HISTORY_CAPACITY', 'HISTORY_FOLDED', 'EVENT_CONFLICT', 'INVALID_EVENTS', 'INVALID_RESPONSE', 'STORAGE_ERROR', 'UNAUTHORIZED', 'AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED', 'MEMORY_SESSION_ENDED']);

function createLearningSync({ adapter, accountKey, revision, storage, transport, onStatus = () => {},
  batchSize = 100, maxAttempts = 3, maxPages = 200, timeoutMs = 15000,
  backoffMs = [500, 1500, 5000], sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), auto = true } = {}) {
  const port = adapter?.syncPort;
  if (!id(accountKey) || !Number.isSafeInteger(revision) || revision < 1 || !port
    || port.scope !== 'account' || port.accountKey !== accountKey || !storage?.getItem || !storage?.setItem
    || typeof transport?.get !== 'function' || typeof transport?.post !== 'function') throw new TypeError('Atlas sync: an authenticated account adapter, isolated durable store and transport are required');
  if (![batchSize, maxAttempts, maxPages, timeoutMs].every(n => Number.isInteger(n) && n > 0)
    || batchSize > 500 || maxAttempts > 10 || !Array.isArray(backoffMs) || !backoffMs.length
    || backoffMs.some(ms => !Number.isFinite(ms) || ms < 0)) throw new TypeError('Atlas sync: invalid retry bounds');
  const key = `${SYNC_KEY}.${accountKey}`;
  // Outbox v2 keeps ids only: the account log holds every queued entry (v1 kept a second copy).
  // `missing` names acknowledged entries the log has lost; they are fetched from the server again.
  let state = { version: 2, accountKey, revision, cursor: 0, complete: false, acknowledged: [], pending: [], missing: [] };
  let phase = 'idle', code = null, message = null, stopped = false, started = false, generation = 0, running = null, timer = null, flushRequested = false;
  const controllers = new Set();
  const whole = () => state.complete && !state.missing.length;
  const status = () => ({ phase, code, message, revision, cursor: state.cursor, queued: state.pending.length,
    complete: whole() && phase !== 'blocked' && phase !== 'stopped', accountKey, durable: !['STORAGE_ERROR', 'HISTORY_CAPACITY'].includes(code) });
  const publish = () => { try { onStatus(status()); } catch { /* UI observers cannot change the log. */ } };
  const block = error => {
    generation++; clearTimeout(timer); timer = null;
    for (const controller of controllers) controller.abort();
    phase = 'blocked'; code = errorCode(error); message = error?.message || code; port.markComplete(false); publish();
  };
  const save = () => {
    try { storage.setItem(key, JSON.stringify(state)); }
    catch { throw failure('STORAGE_ERROR', 'Atlas sync: the durable outbox could not be saved'); }
  };
  try {
    const raw = storage.getItem(key);
    if (raw != null) {
      const stored = JSON.parse(raw), v1 = stored?.version === 1;
      if (!stored || ![1, 2].includes(stored.version) || stored.accountKey !== accountKey || !Number.isSafeInteger(stored.cursor) || stored.cursor < 0
        || typeof stored.complete !== 'boolean' || !Array.isArray(stored.acknowledged) || !stored.acknowledged.every(id)
        || !Array.isArray(stored.pending) || !stored.pending.every(v1 ? e => id(e?.id) : id)
        || !(stored.missing === undefined || Array.isArray(stored.missing) && stored.missing.every(id))
        || stored.pending.length + stored.acknowledged.length + (stored.missing?.length || 0) > 40000) throw failure('STORAGE_ERROR', 'Atlas sync: unreadable outbox; preserved without replacement');
      if (stored.revision !== revision) throw failure('REVISION_CONFLICT', 'Atlas sync: a new consent revision requires a fresh account store');
      state = { ...stored, version: 2, pending: v1 ? stored.pending.map(e => e.id) : stored.pending, missing: stored.missing || [] };
    }
    port.markComplete(whole());
  } catch (error) { block(error?.code ? error : failure('STORAGE_ERROR', 'Atlas sync: unreadable outbox; preserved without replacement')); }
  const collect = () => {
    // A log that summarised entries while it was not synchronised cannot be sent whole; sending
    // the rest would leave the server's history quietly incomplete.
    if (typeof port.partial === 'function' && port.partial()) throw failure('HISTORY_FOLDED', 'Atlas sync: this log summarised entries no server received; it cannot be sent');
    const local = port.events(), localIds = new Set(local.map(event => event.id));
    if (state.pending.some(eventId => !localIds.has(eventId))) throw failure('STORAGE_ERROR', 'Atlas sync: queued history does not match its account log');
    // Entries the log folded away are on the server: they are no longer expected locally.
    const folded = new Set(typeof port.dropped === 'function' ? port.dropped() : []);
    // Any other acknowledged entry the log no longer has was lost here (an older history
    // written over a newer one): fetch it from the server again.
    const lost = state.acknowledged.filter(eventId => !localIds.has(eventId) && !folded.has(eventId));
    if (lost.length) { state.missing = [...new Set([...state.missing, ...lost])]; port.markComplete(false); }
    state.acknowledged = state.acknowledged.filter(eventId => localIds.has(eventId));
    state.missing = state.missing.filter(eventId => !localIds.has(eventId));
    const queued = new Set(state.pending), acknowledged = new Set(state.acknowledged);
    for (const event of local) if (!queued.has(event.id) && !acknowledged.has(event.id)) { queued.add(event.id); state.pending.push(event.id); }
    save();
    // Only once the outbox no longer expects them may the log forget it folded them.
    if (folded.size && typeof port.forget === 'function') port.forget([...folded]);
  };
  const schedule = () => {
    if (!auto || !started || stopped || phase === 'blocked' || phase === 'offline' || timer) return;
    timer = setTimeout(() => { timer = null; void run(); }, 0);
  };
  const unsubscribe = port.subscribe(change => {
    if (stopped || phase === 'blocked' || change.kind === 'import') return;
    if (change.kind === 'storage-error') { block(failure(change.code || 'STORAGE_ERROR', 'Atlas sync: local learning could not be saved')); return; }
    try { collect(); publish(); schedule(); } catch (error) { block(error); }
  });
  if (phase !== 'blocked') { try { collect(); } catch (error) { block(error); } }
  const active = token => !stopped && token === generation;
  const request = async (method, body, token) => {
    let last;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!active(token)) throw failure('STOPPED', 'Atlas sync: stopped');
      const controller = new AbortController(); controllers.add(controller);
      let deadline;
      try {
        const response = await Promise.race([
          Promise.resolve().then(() => transport[method]({ ...body, signal: controller.signal })),
          new Promise((_, reject) => {
            deadline = setTimeout(() => { reject(failure('NETWORK_ERROR', 'Atlas sync: request timed out')); controller.abort(); }, timeoutMs);
            controller.signal.addEventListener('abort', () => reject(failure('STOPPED', 'Atlas sync: request cancelled')), { once: true });
          }),
        ]);
        if (!active(token)) throw failure('STOPPED', 'Atlas sync: stale request');
        if (response?.ok === false) throw failure(response.error?.code || 'INVALID_RESPONSE', response.error?.message || 'Atlas sync: rejected', { revision: response.revision });
        if (!response || response.revision !== revision) throw failure('REVISION_CONFLICT', 'Atlas sync: server revision changed', { revision: response?.revision });
        return response;
      } catch (error) {
        last = error;
        if (!active(token) || FATAL.has(errorCode(error))) throw error;
      } finally { clearTimeout(deadline); controllers.delete(controller); }
      if (attempt + 1 < maxAttempts) await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
    }
    throw last;
  };
  const pullPages = async token => {
    for (let page = 0; page < maxPages; page++) {
      const before = state.cursor, response = await request('get', { after: before, revision }, token);
      if (!Array.isArray(response.events) || !Number.isSafeInteger(response.cursor) || response.cursor < before
        || typeof response.hasMore !== 'boolean' || response.hasMore && response.cursor <= before
        || response.events.length && response.cursor <= before) throw failure('INVALID_RESPONSE', 'Atlas sync: invalid or stalled server cursor');
      if (!active(token)) return;
      let result;
      try { result = port.importEvents(response.events); }
      catch (error) { throw failure(error?.code || 'INVALID_EVENTS', error.message); }
      // An entry of an item the log already folded stays on the server only.
      const skipped = new Set(result?.skipped || []), remote = new Set(state.acknowledged);
      for (const event of response.events) if (!skipped.has(event.id)) remote.add(event.id);
      state.acknowledged = [...remote]; state.pending = state.pending.filter(eventId => !remote.has(eventId)); state.cursor = response.cursor;
      if (!response.hasMore) state.complete = true;
      save(); port.markComplete(whole()); publish();
      // Everything the server held when this pull began has come back by now, so the log may
      // fold those entries (game-learning.js `fold.remote`); an older adapter has no settle().
      if (!response.hasMore) { if (typeof port.settle === 'function') port.settle(state.acknowledged); return; }
    }
    throw failure('INVALID_RESPONSE', 'Atlas sync: page limit exceeded');
  };
  // Lost entries come back from the server: read it from the start, take only those ids.
  const recover = async token => {
    let after = 0;
    for (let page = 0; page < maxPages && state.missing.length; page++) {
      const response = await request('get', { after, revision }, token);
      if (!Array.isArray(response.events) || !Number.isSafeInteger(response.cursor) || response.cursor < after
        || typeof response.hasMore !== 'boolean' || response.hasMore && response.cursor <= after) throw failure('INVALID_RESPONSE', 'Atlas sync: invalid or stalled server cursor');
      if (!active(token)) return;
      const wanted = new Set(state.missing), found = response.events.filter(event => wanted.has(event.id));
      if (found.length) {
        let result;
        try { result = port.importEvents(found); }
        catch (error) { throw failure(error?.code || 'INVALID_EVENTS', error.message); }
        const skipped = new Set(result?.skipped || []), back = new Set(found.map(event => event.id));
        state.acknowledged = [...new Set([...state.acknowledged, ...[...back].filter(eventId => !skipped.has(eventId))])];
        state.missing = state.missing.filter(eventId => !back.has(eventId));
      }
      after = response.cursor;
      // The whole server log has been read: what is still missing is not there (stop asking).
      if (!response.hasMore || after >= state.cursor) { state.missing = []; }
      save(); port.markComplete(whole()); publish();
    }
  };
  const flushQueue = async token => {
    let emptyAcks = 0;
    for (let batch = 0; batch < maxPages; batch++) {
      collect(); if (!state.pending.length) return;
      const local = new Map(port.events().map(event => [event.id, event]));
      const events = state.pending.slice(0, batchSize).map(eventId => clone(local.get(eventId))), sent = new Set(events.map(event => event.id));
      const response = await request('post', { revision, events }, token);
      if (!Array.isArray(response.accepted) || new Set(response.accepted).size !== response.accepted.length
        || response.accepted.some(eventId => !sent.has(eventId))) throw failure('INVALID_RESPONSE', 'Atlas sync: acknowledgement contains an unsent event');
      if (!active(token)) return;
      if (!response.accepted.length) {
        if (++emptyAcks >= maxAttempts) throw failure('NETWORK_ERROR', 'Atlas sync: no acknowledged progress');
        await sleep(backoffMs[Math.min(emptyAcks - 1, backoffMs.length - 1)]);continue;
      }
      emptyAcks = 0;
      const accepted = new Set(response.accepted), acknowledged = new Set(state.acknowledged);
      for (const eventId of accepted) acknowledged.add(eventId);
      state.acknowledged = [...acknowledged]; state.pending = state.pending.filter(eventId => !accepted.has(eventId)); save(); publish();
    }
    throw failure('NETWORK_ERROR', 'Atlas sync: batch limit reached; remaining events stay queued');
  };
  function run(pullOnly = false) {
    if (stopped || phase === 'blocked') return Promise.resolve(status());
    if (running) { if (!pullOnly) flushRequested = true; return running; }
    flushRequested = !pullOnly;
    const token = generation;phase = 'syncing';code = null;message = null;publish();
    running = (async () => {
      try {
        await pullPages(token);
        if (active(token) && state.missing.length) await recover(token);
        if (active(token) && flushRequested) await flushQueue(token);
        if (active(token)) { phase = 'synced';code = null;message = null;publish(); }
      } catch (error) {
        if (active(token)) {
          if (FATAL.has(errorCode(error))) block(error);
          else { phase = 'offline';code = errorCode(error);message = error?.message || code;publish(); }
        }
      } finally { running = null; }
      return status();
    })();
    return running;
  }
  return Object.freeze({
    start() { started = true;return run(); },
    pull: () => run(true), flush: () => run(), retry: () => run(), status,
    invalidate(code = 'STORAGE_ERROR') { if (!stopped) block(failure(code === 'HISTORY_CAPACITY' ? code : 'STORAGE_ERROR', 'Atlas sync: local learning could not be saved')); return status(); },
    stop() {
      if (!stopped) { stopped = true;generation++;clearTimeout(timer);timer = null;unsubscribe();for (const controller of controllers) controller.abort();phase = 'stopped';publish(); }
      return status();
    },
  });
}
module.exports = { createLearningSync, sameEvent, SYNC_KEY };
