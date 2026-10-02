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
const FATAL = new Set(['REVISION_CONFLICT', 'LEARNING_DISABLED', 'FEATURE_DISABLED', 'HISTORY_CAPACITY', 'EVENT_CONFLICT', 'INVALID_EVENTS', 'INVALID_RESPONSE', 'STORAGE_ERROR', 'UNAUTHORIZED', 'AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED', 'MEMORY_SESSION_ENDED']);

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
  let state = { version: 1, accountKey, revision, cursor: 0, complete: false, acknowledged: [], pending: [] };
  let phase = 'idle', code = null, message = null, stopped = false, started = false, generation = 0, running = null, timer = null, flushRequested = false;
  const controllers = new Set();
  const status = () => ({ phase, code, message, revision, cursor: state.cursor, queued: state.pending.length,
    complete: state.complete && phase !== 'blocked' && phase !== 'stopped', accountKey, durable: !['STORAGE_ERROR', 'HISTORY_CAPACITY'].includes(code) });
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
      const stored = JSON.parse(raw);
      if (!stored || stored.version !== 1 || stored.accountKey !== accountKey || !Number.isSafeInteger(stored.cursor) || stored.cursor < 0
        || typeof stored.complete !== 'boolean' || !Array.isArray(stored.acknowledged) || !stored.acknowledged.every(id)
        || !Array.isArray(stored.pending) || stored.pending.some(e => !id(e?.id))
        || stored.pending.length + stored.acknowledged.length > 40000) throw failure('STORAGE_ERROR', 'Atlas sync: unreadable outbox; preserved without replacement');
      if (stored.revision !== revision) throw failure('REVISION_CONFLICT', 'Atlas sync: a new consent revision requires a fresh account store');
      state = stored;
    }
    port.markComplete(state.complete);
  } catch (error) { block(error?.code ? error : failure('STORAGE_ERROR', 'Atlas sync: unreadable outbox; preserved without replacement')); }
  const collect = () => {
    const known = new Map(state.pending.map(event => [event.id, event])), acknowledged = new Set(state.acknowledged);
    const local = port.events(), localById = new Map(local.map(event => [event.id, event]));
    if (state.pending.some(event => !localById.has(event.id) || !sameEvent(localById.get(event.id), event))) throw failure('STORAGE_ERROR', 'Atlas sync: queued history does not match its account log');
    for (const event of local) {
      if (known.has(event.id) && !sameEvent(known.get(event.id), event)) throw failure('EVENT_CONFLICT', 'Atlas sync: conflicting queued event');
      if (!known.has(event.id) && !acknowledged.has(event.id)) { known.set(event.id, event); state.pending.push(clone(event)); }
    }
    save();
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
      try { port.importEvents(response.events); }
      catch (error) { throw failure(error?.code || 'INVALID_EVENTS', error.message); }
      const remote = new Set(state.acknowledged);
      for (const event of response.events) remote.add(event.id);
      state.acknowledged = [...remote]; state.pending = state.pending.filter(event => !remote.has(event.id)); state.cursor = response.cursor;
      if (!response.hasMore) state.complete = true;
      save(); port.markComplete(state.complete); publish();
      if (!response.hasMore) return;
    }
    throw failure('INVALID_RESPONSE', 'Atlas sync: page limit exceeded');
  };
  const flushQueue = async token => {
    let emptyAcks = 0;
    for (let batch = 0; batch < maxPages; batch++) {
      collect(); if (!state.pending.length) return;
      const events = state.pending.slice(0, batchSize).map(clone), sent = new Set(events.map(event => event.id));
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
      state.acknowledged = [...acknowledged]; state.pending = state.pending.filter(event => !accepted.has(event.id)); save(); publish();
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
