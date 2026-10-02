'use strict';
// WORLD owns authentication. Minigames receive guarded learning methods, never tokens.
// `engine` is this page's own { createGame, createLearningSync, createMemorySync } (SynkLearning.engine). The
// account-wide synchroniser must live here: a game frame that navigates away stops its timers.
// A run (beginRun: a WORLD game started for an assignment or practice) owns the entries its game
// creates. The owner is written to the account store as each entry is made and is sent with it
// (`runId`), so an old entry retried later never joins whichever run happens to be open.
// With `memoryTransport` the account's Core memory (the chosen help style and display, each
// content's moment memory; atlas/memory-sync.js) follows the person to other devices too.
const OWNER = 'synk.world.run-owner.v1', OWNERS = 'synk.world.run-owners.v1';
// An owner record goes once its entry has left the account log (folded after the server sent it
// back) and the record is a day old; a new entry missing for a moment (another tab's older write)
// keeps it.
const OWNER_GRACE_MS = 86400000;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const failure = (message, code) => Object.assign(new Error(message), { code });
function createWorldLearningHost({ accountKey, revision, storage, transport, memoryTransport = null, guard, connected = true, onStatus = () => {}, engine = null, clock = Date.now }) {
  if (!accountKey || !Number.isSafeInteger(revision) || typeof guard !== 'function') throw new TypeError('Verified WORLD account required');
  let sync, primary, memory, closed = false, run = null, generation = 0;
  const coaches = new Set(), memoryListeners = new Set();
  const check = () => { guard(); if (closed) throw new Error('WORLD account session ended'); };
  const shared = { getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } };
  const ownerKey = eventId => `${OWNER}.${eventId}`;
  // The list of owner records only serves to remove them later. Each record is its own key, so two
  // tabs writing the list at once can at worst leave a record behind, never lose one.
  function owners(ids, now) {
    const raw = shared.getItem(OWNERS);
    try {
      const rows = raw == null ? null : JSON.parse(raw);
      if (Array.isArray(rows) && rows.every(row => Array.isArray(row) && row.length === 2 && identifier(row[0]) && Number.isSafeInteger(row[1]))) return rows;
    } catch { /* rebuilt below */ }
    // None yet or unreadable: list the records of the entries still in the log.
    return ids.filter(id => shared.getItem(ownerKey(id)) != null).map(id => [id, now]);
  }
  // Record the run of the entries a call added (`ids` is the log after it), then drop the records
  // no longer needed.
  function own(ids, before, context) {
    const added = ids.filter(id => !before.has(id));
    if (!added.length) return;
    for (const id of added) {
      const key = ownerKey(id), prior = shared.getItem(key);
      if (prior != null && prior !== context.id) throw new Error('Conflicting WORLD run ownership');
      shared.setItem(key, context.id);
    }
    const now = clock(), kept = new Set(ids), rows = [];
    for (const [id, at] of owners(ids, now)) {
      if (kept.has(id) || now - at < OWNER_GRACE_MS) rows.push([id, at]);
      else shared.removeItem(ownerKey(id));
    }
    const listed = new Set(rows.map(([id]) => id));
    for (const id of added) if (!listed.has(id)) rows.push([id, now]);
    shared.setItem(OWNERS, JSON.stringify(rows));
  }
  // The memory sync reads and merges through the account adapter, and hears every game's changes:
  // a game's port tells only its own listeners.
  const memoryAdapter = () => ({ memoryPort: Object.freeze({ scope: 'account', accountKey,
    state: () => primary.memoryPort.state(), merge: value => primary.memoryPort.merge(value),
    subscribe(listener) {
      const stop = primary.memoryPort.subscribe(listener); memoryListeners.add(listener);
      return () => { stop(); memoryListeners.delete(listener); };
    } }) });
  // Entries go up with the run they were made in: one request per run, in log order.
  const upload = transport && { get: args => transport.get(args), async post(args) {
    check();
    const groups = [];
    for (const event of args.events) {
      const runId = shared.getItem(ownerKey(event.id)) ?? null;
      if (runId !== null && !identifier(runId)) throw failure('Unreadable WORLD run ownership', 'STORAGE_ERROR');
      if (groups.length && groups.at(-1).runId === runId) groups.at(-1).events.push(event);
      else groups.push({ runId, events: [event] });
    }
    const accepted = [];
    for (const group of groups) {
      const result = await transport.post({ ...args, events: group.events, ...(group.runId ? { runId: group.runId } : {}) });
      check();
      // A refusal or another revision goes back as it came, for learning-sync to judge.
      if (result?.ok === false || result?.revision !== revision) return result;
      const sent = new Set(group.events.map(event => event.id));
      if (!Array.isArray(result.accepted) || result.accepted.some(id => !sent.has(id))) throw failure('Invalid WORLD run acknowledgement', 'INVALID_RESPONSE');
      accepted.push(...result.accepted);
    }
    return { ok: true, revision, accepted };
  } };
  function createGame(options, factory, createSync) {
    check();
    // With sharing off the account's store lives on this device only, so it is complete on
    // its own, like a guest device. A connected store is complete once the server says so.
    // Older items fold into a ledger (learning-ledger.js); a synchronised store folds only what the server has sent back.
    const owned = { storage: shared, learnerKey: 'device', storageScope: 'account', accountKey, historyComplete: !connected, fold: connected ? { remote: true } : true };
    if (connected && !sync) {
      const make = engine?.createGame && engine?.createLearningSync ? engine : { createGame: factory, createLearningSync: createSync };
      primary = make.createGame({ gameId: 'world-account', ...owned });
      sync = make.createLearningSync({ adapter: primary, accountKey, revision, storage: shared, transport: upload,
        onStatus: state => { for (const coach of coaches) coach.syncPort.markComplete(state.complete && state.phase !== 'blocked'); onStatus(state); } });
      void sync.start();
      // The page's own engine carries the memory sync; without it (or a transport) memory stays here.
      if (memoryTransport && typeof engine?.createMemorySync === 'function' && primary.memoryPort) {
        memory = engine.createMemorySync({ adapter: memoryAdapter(), accountKey, revision, transport: memoryTransport });
        void memory.start();
      }
    }
    // A game opened during a run belongs to it, and only the run's own game may open.
    const opened = generation, context = run && { ...run };
    if (context && options?.gameId !== context.gameId) throw new Error('WORLD game does not match its run');
    const coach = factory({ ...options, ...owned }); coaches.add(coach);
    if (connected) coach.syncPort.markComplete(sync?.status().complete === true);
    const unsubscribe = coach.syncPort.subscribe(change => {
      if (closed || !sync) return;
      if (change.kind === 'storage-error') sync.invalidate(change.code);
      // Upload once the call that appended has recorded the run of its entries (see `call`).
      else if (change.kind === 'append') queueMicrotask(() => { if (!closed) void sync.flush(); });
    });
    // What the game changes in the memory (a chosen help style, a content's moment memory) is sent
    // by the memory sync after a short wait.
    const unsubscribeMemory = typeof coach.memoryPort?.subscribe === 'function'
      ? coach.memoryPort.subscribe(change => { if (!closed) for (const listener of memoryListeners) listener(change); }) : () => {};
    // The log's ids, uncopied; an engine from before syncPort.ids() is read through copies (slower).
    const logIds = () => (typeof coach.syncPort.ids === 'function' ? coach.syncPort.ids() : coach.syncPort.events().map(event => event.id));
    // During a run, what a call added is owned by the run before anything can upload it. A failed
    // record stops uploads: an entry never goes up without its run.
    const record = before => {
      try { own(logIds(), before, context); }
      catch (error) { sync?.invalidate('STORAGE_ERROR'); throw error; }
    };
    // Once its run closes or another begins, a game stops; it may still write its entries once
    // more as its page closes (flush), which adds none.
    const call = (method, args, closing = false) => {
      check();
      if (opened !== generation && !closing) throw failure('WORLD game run ended', 'RUN_ENDED');
      if (!context) return method(...args);
      const before = new Set(logIds());
      try { return method(...args); }
      finally { record(before); }
    };
    // Use the same public API the games already consume. No account/config UI per game.
    const guarded = (value, closing) => (typeof value === 'function' ? (...args) => call(value, args, closing) : value);
    // A live content (coach.live) answers through the same guard on every call, not only when it opens.
    const live = value => (...args) => Object.freeze(Object.fromEntries(Object.entries(call(value, args)).map(([name, part]) => [name, guarded(part)])));
    // The ports belong to the host's synchronisers, not to games.
    return Object.freeze(Object.fromEntries(Object.entries(coach).filter(([name]) => name !== 'syncPort' && name !== 'memoryPort').map(([name, value]) => [name,
      name === 'live' ? live(value) : guarded(value, name === 'flush')]).concat([
      ['disconnect', () => { unsubscribe(); unsubscribeMemory(); coaches.delete(coach); }],
    ])));
  }
  // The status names the account partition and the open run, also on a device-only account.
  return Object.freeze({ createGame,
    status: () => ({ accountKey, revision, ...(sync?.status() || { phase: connected ? 'idle' : 'local', queued: 0 }), runId: run?.id || null, memory: memory ? memory.status() : null }),
    // Back in front: retry the sync and read what other devices chose.
    retry: () => { check(); void memory?.retry(); return sync?.retry(); },
    // Going to the background or closing: send the changed memory now.
    flush: () => { check(); return memory?.flush(); },
    // One run at a time, on a connected account. Opening or closing one ends the games of the last.
    beginRun(value) {
      check();
      if (!connected || !identifier(value?.id) || !identifier(value?.gameId)) throw new TypeError('A connected WORLD run is required');
      generation += 1; run = { id: value.id, gameId: value.gameId };
      return { ...run };
    },
    closeRun() { check(); generation += 1; run = null; },
    stop() { closed = true; generation += 1; run = null; sync?.stop(); memory?.stop(); coaches.clear(); memoryListeners.clear(); } });
}
module.exports = { createWorldLearningHost };
