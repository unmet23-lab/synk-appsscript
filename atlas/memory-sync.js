'use strict';
// Keeps one account's Core memory the same on every device: the presentation the person chose,
// each content's moment memory and declined less-help offers (game-flow.js, coach.memoryPort).
// Today's condition stays on the device. Every entry carries its own time and the newer one wins,
// here and on the server, so nothing needs an outbox: a device that was offline compares times
// with the server when it next starts and sends what is newer. Authenticated hosts provide the
// transport (GET/POST synk-learning?view=memory); this module never reads identities or the log.
const ID = /^[a-zA-Z0-9_.:-]{1,120}$/;
const BATCH = 100, ROUNDS = 50, MAX_BYTES = 4096;
const KINDS = Object.freeze(['presentation', 'flow', 'declined']);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const failure = (code, message) => Object.assign(new Error(message), { code });
const errorCode = error => error?.code || error?.error?.code || error?.body?.error?.code || 'NETWORK_ERROR';
// Codes that need the person or the host (sign-in, consent, a newer app), never a silent retry.
const FATAL = new Set(['REVISION_CONFLICT', 'LEARNING_DISABLED', 'FEATURE_DISABLED', 'MEMORY_UNAVAILABLE', 'MEMORY_CAPACITY', 'INVALID_MEMORY',
  'INVALID_RESPONSE', 'UNAUTHORIZED', 'AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED', 'MEMORY_SESSION_ENDED', 'PRODUCT_FORBIDDEN', 'ACCOUNT_UNAVAILABLE']);
const keyOf = entry => `${entry.kind}\u0000${entry.key}`;

// game-flow.js state() as the server's entries, and back.
function entriesOf(state) {
  const out = [];
  if (object(state?.presentation)) out.push({ kind: 'presentation', key: 'chosen', value: state.presentation.value ?? null, at: state.presentation.at });
  for (const [key, memory] of Object.entries(object(state?.flow) ? state.flow : {})) out.push({ kind: 'flow', key, value: memory, at: memory?.at });
  for (const [key, at] of Object.entries(object(state?.declined) ? state.declined : {})) out.push({ kind: 'declined', key, value: null, at });
  return out;
}
function stateOf(entries) {
  const state = { presentation: null, flow: {}, declined: {} };
  for (const entry of entries) {
    if (entry.kind === 'presentation') state.presentation = { value: entry.value, at: entry.at };
    else if (entry.kind === 'flow') state.flow[entry.key] = entry.value;
    else state.declined[entry.key] = entry.at;
  }
  return state;
}
// The server checks the same shape; an entry that would be refused is never sent.
function sendable(entry) {
  if (!KINDS.includes(entry.kind) || !ID.test(entry.key || '') || !instant(entry.at)) return false;
  if (entry.kind === 'presentation') return entry.key === 'chosen' && (entry.value === null || object(entry.value));
  if (entry.kind === 'declined') return entry.value === null;
  return object(entry.value) && entry.value.content === entry.key && Date.parse(entry.value.at) === Date.parse(entry.at)
    && JSON.stringify(entry.value).length <= MAX_BYTES;
}
const received = entry => object(entry) && KINDS.includes(entry.kind) && ID.test(entry.key || '') && instant(entry.at)
  && (entry.kind === 'flow' ? object(entry.value) : entry.kind === 'declined' ? entry.value === null : entry.value === null || object(entry.value));

function createMemorySync({ adapter, accountKey, revision, transport, onStatus = () => {}, delayMs = 3000, timeoutMs = 15000,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) } = {}) {
  const port = adapter?.memoryPort;
  if (!ID.test(accountKey || '') || !Number.isSafeInteger(revision) || revision < 1 || !port || port.scope !== 'account' || port.accountKey !== accountKey
    || typeof port.state !== 'function' || typeof port.merge !== 'function' || typeof port.subscribe !== 'function'
    || typeof transport?.get !== 'function' || typeof transport?.post !== 'function') throw new TypeError('Atlas memory sync: an authenticated account adapter and transport are required');
  if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('Atlas memory sync: invalid timing');
  // The newest time the server is known to hold per entry, and entries it would refuse.
  const remote = new Map(), refused = new Map();
  let phase = 'idle', code = null, stopped = false, timer = null, running = null, again = false, pulled = false, generation = 0;
  const controllers = new Set();
  const newer = (at, than) => than == null || Date.parse(at) > Date.parse(than);
  // Local entries the server does not have yet (or has an older value of).
  const pending = () => entriesOf(port.state()).filter(entry => instant(entry.at) && newer(entry.at, remote.get(keyOf(entry))) && refused.get(keyOf(entry)) !== entry.at);
  const status = () => {
    let queued = 0;
    try { queued = pending().length; } catch { /* storage unreadable: nothing to count */ }
    return { phase, code, accountKey, revision, queued };
  };
  const publish = () => { try { onStatus(status()); } catch { /* observers cannot change the memory */ } };
  const active = token => !stopped && token === generation;
  const call = async (method, body, token) => {
    if (!active(token)) throw failure('STOPPED', 'Atlas memory sync: stopped');
    const controller = new AbortController(); controllers.add(controller);
    let deadline;
    try {
      const response = await Promise.race([
        Promise.resolve().then(() => transport[method]({ ...body, signal: controller.signal })),
        new Promise((_, reject) => {
          deadline = setTimeout(() => { reject(failure('NETWORK_ERROR', 'Atlas memory sync: request timed out')); controller.abort(); }, timeoutMs);
          controller.signal.addEventListener('abort', () => reject(failure('STOPPED', 'Atlas memory sync: request cancelled')), { once: true });
        }),
      ]);
      if (!active(token)) throw failure('STOPPED', 'Atlas memory sync: stale request');
      if (response?.ok === false) throw failure(response.error?.code || 'INVALID_RESPONSE', response.error?.message || 'Atlas memory sync: rejected');
      if (!response || response.revision !== revision) throw failure('REVISION_CONFLICT', 'Atlas memory sync: server revision changed');
      if (!Array.isArray(response.entries) || !response.entries.every(received)) throw failure('INVALID_RESPONSE', 'Atlas memory sync: invalid entries');
      return response;
    } finally { clearTimeout(deadline); controllers.delete(controller); }
  };
  // What the server holds now replaces older local values; its times are remembered.
  const accept = entries => {
    port.merge(stateOf(entries));
    for (const entry of entries) if (newer(entry.at, remote.get(keyOf(entry)))) remote.set(keyOf(entry), entry.at);
  };
  async function cycle(token) {
    if (!pulled) { accept((await call('get', { revision }, token)).entries); pulled = true; }
    for (let round = 0; round < ROUNDS; round++) {
      const all = pending();
      for (const entry of all) if (!sendable(entry)) refused.set(keyOf(entry), entry.at);
      const batch = all.filter(sendable).slice(0, BATCH);
      if (!batch.length) return;
      const response = await call('post', { revision, entries: batch }, token);
      if (!active(token)) return;
      accept(response.entries);
      // The server kept the newer of the two; either way it has seen these times.
      for (const entry of batch) if (newer(entry.at, remote.get(keyOf(entry)))) remote.set(keyOf(entry), entry.at);
    }
    throw failure('NETWORK_ERROR', 'Atlas memory sync: too many rounds; the rest waits for the next sync');
  }
  function run({ pull = false } = {}) {
    if (stopped || phase === 'blocked') return Promise.resolve(status());
    if (pull) pulled = false;
    if (running) { again = true; return running; }
    const token = generation; phase = 'syncing'; code = null; publish();
    running = (async () => {
      try {
        do { again = false; await cycle(token); } while (again && active(token));
        if (active(token)) { phase = 'synced'; publish(); }
      } catch (error) {
        if (active(token)) { code = errorCode(error); phase = FATAL.has(code) ? 'blocked' : 'offline'; publish(); }
      } finally { running = null; }
      return status();
    })();
    return running;
  }
  const schedule = () => {
    if (stopped || phase === 'blocked' || timer != null) return;
    timer = setTimer(() => { timer = null; void run(); }, delayMs);
  };
  const unsubscribe = port.subscribe(change => { if (!stopped && change?.kind !== 'import') schedule(); });
  return Object.freeze({
    // Reads the server first, then sends what is newer here.
    start: () => run({ pull: true }),
    // Sends local changes now (before the app goes to the background or a page closes).
    flush() { if (timer != null) { clearTimer(timer); timer = null; } return run(); },
    // Back in front: read the server again (another device may have changed something).
    retry: () => run({ pull: true }),
    status,
    stop() {
      if (!stopped) {
        stopped = true; generation++; if (timer != null) clearTimer(timer); timer = null; unsubscribe();
        for (const controller of controllers) controller.abort();
        phase = 'stopped'; publish();
      }
      return status();
    },
  });
}
module.exports = { createMemorySync, entriesOf, stateOf, MAX_BYTES };
