'use strict';
// WORLD owns authentication. Minigames receive guarded learning methods, never tokens.
// `engine` is this page's own { createGame, createLearningSync } (SynkLearning.engine). The
// account-wide synchroniser must live here: a game frame that navigates away stops its timers.
function createWorldLearningHost({ accountKey, revision, storage, transport, guard, connected = true, onStatus = () => {}, engine = null }) {
  if (!accountKey || !Number.isSafeInteger(revision) || typeof guard !== 'function') throw new TypeError('Verified WORLD account required');
  let sync, primary, closed = false;
  const coaches = new Set();
  const check = () => { guard(); if (closed) throw new Error('WORLD account session ended'); };
  const shared = { getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } };
  function createGame(options, factory, createSync) {
    check();
    // With sharing off the account's store lives on this device only, so it is complete on
    // its own, like a guest device. A connected store is complete once the server says so.
    const owned = { storage: shared, learnerKey: 'device', storageScope: 'account', accountKey, historyComplete: !connected };
    if (connected && !sync) {
      const make = engine?.createGame && engine?.createLearningSync ? engine : { createGame: factory, createLearningSync: createSync };
      primary = make.createGame({ gameId: 'world-account', ...owned });
      sync = make.createLearningSync({ adapter: primary, accountKey, revision, storage: shared, transport,
        onStatus: state => { for (const coach of coaches) coach.syncPort.markComplete(state.complete && state.phase !== 'blocked'); onStatus(state); } });
      void sync.start();
    }
    const coach = factory({ ...options, ...owned }); coaches.add(coach);
    if (connected) coach.syncPort.markComplete(sync?.status().complete === true);
    const unsubscribe = coach.syncPort.subscribe(change => {
      if (closed || !sync) return;
      if (change.kind === 'storage-error') sync.invalidate(change.code);
      else if (change.kind === 'append') void sync.flush();
    });
    // Use the same public API the games already consume. No account/config UI per game.
    const guarded = value => (typeof value === 'function' ? (...args) => { check(); return value(...args); } : value);
    // A live content (coach.live) answers through the same guard on every call, not only when it opens.
    const live = value => (...args) => { check(); return Object.freeze(Object.fromEntries(Object.entries(value(...args)).map(([name, part]) => [name, guarded(part)]))); };
    return Object.freeze(Object.fromEntries(Object.entries(coach).filter(([name]) => name !== 'syncPort').map(([name, value]) => [name,
      name === 'live' ? live(value) : guarded(value)]).concat([
      ['disconnect', () => { unsubscribe(); coaches.delete(coach); }],
    ])));
  }
  return Object.freeze({ createGame, status: () => sync?.status() || { phase: connected ? 'idle' : 'local', queued: 0 }, retry: () => { check(); return sync?.retry(); },
    stop() { closed = true; sync?.stop(); coaches.clear(); } });
}
module.exports = { createWorldLearningHost };
