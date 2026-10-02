'use strict';
// WORLD owns authentication. Minigames receive guarded learning methods, never tokens.
// `engine` is this page's own { createGame, createLearningSync } (SynkLearning.engine). The
// account-wide synchroniser must live here: a game frame that navigates away stops its timers.
function createWorldLearningHost({ accountKey, revision, storage, transport, guard, connected = true, onStatus = () => {}, engine = null }) {
  if (!accountKey || !Number.isSafeInteger(revision) || typeof guard !== 'function') throw new TypeError('Verified WORLD account required');
  let sync, primary, closed = false, run = null, gameGeneration = 0;
  const coaches = new Set();
  const check = () => { guard(); if (closed) throw new Error('WORLD account session ended'); };
  const shared = { getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } };
  const ownerKey = eventId => `synk.world.run-owner.v1.${eventId}`;
  const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  // Attribution belongs to the event when it was created, never to whichever run
  // happens to be open when an old outbox batch is retried.
  const attributedTransport = transport && { get: args => transport.get(args), async post(args) {
    check();const groups=[];
    for(const event of args.events){const runId=shared.getItem(ownerKey(event.id))||null;if(runId&&!identifier(runId))throw Object.assign(new Error('Unreadable WORLD run ownership'),{code:'STORAGE_ERROR'});const last=groups.at(-1);if(last?.runId===runId)last.events.push(event);else groups.push({runId,events:[event]});}
    const accepted=[];
    for(const group of groups){check();const result=await transport.post({...args,events:group.events,...(group.runId?{runId:group.runId}:{})});check();if(result?.ok===false)return result;if(result?.revision!==revision||!Array.isArray(result.accepted)||result.accepted.some(id=>!group.events.some(event=>event.id===id)))throw Object.assign(new Error('Invalid WORLD run acknowledgement'),{code:'INVALID_RESPONSE'});accepted.push(...result.accepted);}
    return {ok:true,revision,accepted};
  }};
  function createGame(options, factory, createSync) {
    check();
    // With sharing off the account's store lives on this device only, so it is complete on
    // its own, like a guest device. A connected store is complete once the server says so.
    // Older items fold into a ledger (learning-ledger.js); a synchronised store folds only what the server has sent back.
    const owned = { storage: shared, learnerKey: 'device', storageScope: 'account', accountKey, historyComplete: !connected, fold: connected ? { remote: true } : true };
    if (connected && !sync) {
      const make = engine?.createGame && engine?.createLearningSync ? engine : { createGame: factory, createLearningSync: createSync };
      primary = make.createGame({ gameId: 'world-account', ...owned });
      sync = make.createLearningSync({ adapter: primary, accountKey, revision, storage: shared, transport:attributedTransport,
        onStatus: state => { for (const coach of coaches) coach.syncPort.markComplete(state.complete && state.phase !== 'blocked'); onStatus(state); } });
      void sync.start();
    }
    const generation=gameGeneration,context=run&&{...run};
    if(context&&options.gameId!==context.gameId)throw new Error('WORLD game does not match its run');
    const coach = factory({ ...options, ...owned }); coaches.add(coach);
    if (connected) coach.syncPort.markComplete(sync?.status().complete === true);
    const unsubscribe = coach.syncPort.subscribe(change => {
      if (closed || !sync) return;
      if (change.kind === 'storage-error') sync.invalidate(change.code);
      // Persist run ownership after the API call before any transport sees it.
      else if (change.kind === 'append') queueMicrotask(()=>{if(!closed)void sync.flush();});
    });
    // Use the same public API the games already consume. No account/config UI per game.
    const gameCheck=()=>{check();if(generation!==gameGeneration)throw Object.assign(new Error('WORLD game run ended'),{code:'RUN_ENDED'});};
    const call=(value,args)=>{gameCheck();if(!context)return value(...args);const before=new Set(coach.syncPort.events().map(event=>event.id));try{return value(...args);}finally{try{for(const event of coach.syncPort.events())if(!before.has(event.id)){const key=ownerKey(event.id),prior=shared.getItem(key);if(prior&&prior!==context.id)throw new Error('Conflicting WORLD run ownership');shared.setItem(key,context.id);}}catch(error){sync?.invalidate('STORAGE_ERROR');throw error;}}};
    const guarded = value => (typeof value === 'function' ? (...args) => call(value,args) : value);
    // A live content (coach.live) answers through the same guard on every call, not only when it opens.
    const live = value => (...args) => Object.freeze(Object.fromEntries(Object.entries(call(value,args)).map(([name, part]) => [name, guarded(part)])));
    return Object.freeze(Object.fromEntries(Object.entries(coach).filter(([name]) => name !== 'syncPort').map(([name, value]) => [name,
      name === 'live' ? live(value) : guarded(value)]).concat([
      ['disconnect', () => { unsubscribe(); coaches.delete(coach); }],
    ])));
  }
  return Object.freeze({ createGame, status: () => ({accountKey,revision,...(sync?.status() || { phase: connected ? 'idle' : 'local', queued: 0 }),runId:run?.id||null}), retry: () => { check(); return sync?.retry(); },
    beginRun(value){check();if(!connected||!identifier(value?.id)||!identifier(value?.gameId))throw new TypeError('A connected WORLD run is required');gameGeneration++;run={id:value.id,gameId:value.gameId};return {...run};},
    closeRun(){check();gameGeneration++;run=null;},
    stop() { closed = true;gameGeneration++;run=null; sync?.stop(); coaches.clear(); } });
}
module.exports = { createWorldLearningHost };
