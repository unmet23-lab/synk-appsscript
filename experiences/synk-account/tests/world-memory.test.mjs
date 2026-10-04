import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAccountView } from '../src/account-view.mjs';
import { WORLD_GAMES } from '../src/atlas-words.mjs';

// The WORLD page hands the account client's memory transport to the host and follows the page:
// going to the background sends the changed memory, coming back reads what other devices chose.
// The real view and engine run against a minimal DOM and synthetic servers.
const require = createRequire(import.meta.url);
const { engine } = require('../../../atlas/game-browser.js');
class Node {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.textContent = '';this.hidden = false;this.disabled = false;this.dataset={};this.attributes={};this.classList = { add() {}, remove() {} }; }
  setAttribute(key,value) { this.attributes[key]=String(value); }
  getAttribute(key) { return this.attributes[key]??null; }
  removeAttribute(key) { delete this.attributes[key];delete this[key]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener() {}
  closest() { return this; }
}
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
const copy = value => JSON.parse(JSON.stringify(value));

test('the WORLD page sends changed memory when it goes to the background and reads it again when it comes back', async t => {
  const ids = new Map(), listeners = new Map(), windowListeners=new Map(), stored = new Map(), rows = new Map(), memoryCalls = [];
  const document = { body: new Node('body'), visibilityState: 'visible', createElement: tag => new Node(tag),
    getElementById: id => { if (!ids.has(id)) ids.set(id, new Node());return ids.get(id); }, querySelector: () => new Node(), querySelectorAll: () => [],
    addEventListener(type, listener) { listeners.set(type, listener); }, removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); } };
  const show = state => { document.visibilityState = state;listeners.get('visibilitychange')?.(); };
  const originals = ['document', 'window', 'localStorage', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: { SynkLearning: { engine },addEventListener(type,fn){windowListeners.set(type,fn);},removeEventListener(type,fn){if(windowListeners.get(type)===fn)windowListeners.delete(type);} }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key) }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'location', { value:{href:'http://127.0.0.1/synk-account/client.html'},configurable:true,writable:true });
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  const key = entry => `${entry.kind}|${entry.key}`;
  const client = {
    load: async () => ({ ok: true, account: { synk_user_id: 'synthetic-memory-account', status: 'active', profile: {} }, learning: { enabled: true, revision: 1 }, capabilities: { learningSync: true }, sessions: [] }),
    learning: { get: async () => ({ ok: true, revision: 1, cursor: 0, hasMore: false, events: [] }), post: async ({ events }) => ({ ok: true, revision: 1, accepted: events.map(e => e.id) }) },
    // synk-learning ?view=memory: per entry, the newer time wins.
    memory: { get: async ({ revision }) => { memoryCalls.push('get');return { ok: true, revision, entries: [...rows.values()].map(copy) }; },
      post: async ({ revision, entries }) => { memoryCalls.push('post');for (const entry of entries) { const old = rows.get(key(entry));if (!old || Date.parse(entry.at) > Date.parse(old.at)) rows.set(key(entry), copy(entry)); }
        return { ok: true, revision, entries: entries.map(entry => copy(rows.get(key(entry)))) }; } },
  };
  const view = createAccountView({ client, product: 'world', guard() {}, notice() {}, logout: async () => {} });
  await view.load();
  const host = window.SYNKLearningHost;
  assert.ok(host && listeners.has('visibilitychange'));
  const buttons=node=>[...(node.tagName==='button'?[node]:[]),...node.children.flatMap(buttons)];
  const help=buttons(ids.get('world-games')).find(button=>button.dataset.help==='independent');
  assert.ok(help,'the actual WORLD view provides a personal help choice');
  // As a game frame does (atlas/game-browser.js): its own factory, the page's host.
  const game = host.createGame({ gameId: 'racing' }, engine.createGame, engine.createLearningSync);await settle();
  assert.equal(host.status().memory.phase, 'synced');
  game.setPresentation({ support: 'choose', textSize: 'large' });await settle();
  assert.equal(rows.has('presentation|chosen'), false, 'the memory sync waits a moment before sending');
  show('hidden');await settle();
  assert.deepEqual(rows.get('presentation|chosen')?.value, { support: 'choose', textSize: 'large' });
  // Another device chooses later; this page reads it when it comes back.
  rows.set('presentation|chosen', { kind: 'presentation', key: 'chosen', value: { support: 'independent' }, at: new Date(Date.now() + 60000).toISOString() });
  show('visible');await settle();
  assert.deepEqual(game.presentation(), { support: 'independent' });
  assert.equal(help.getAttribute('aria-pressed'),'true','the existing control updates after a remote memory import');
  assert.deepEqual(memoryCalls, ['get', 'post', 'get']);
  rows.set('presentation|chosen', { kind:'presentation',key:'chosen',value:{support:'step'},at:new Date(Date.now()+120000).toISOString() });
  const restoreConnection=windowListeners.get('online');assert.equal(typeof restoreConnection,'function');restoreConnection();await settle();
  assert.deepEqual(game.presentation(),{support:'step'},'network restoration imports account memory without changing tabs');
  let releaseMemory;client.memory.get=({revision})=>new Promise(resolve=>{releaseMemory=()=>resolve({ok:true,revision,entries:[...rows.values()].map(copy)});});
  const play=buttons(ids.get('world-games')).find(button=>button.textContent===WORLD_GAMES[0].label),frame=ids.get('world-games').children.find(node=>node.tagName==='iframe');
  show('visible');await settle();play.onclick();await settle();
  assert.equal(frame.src,undefined,'personal practice waits for a delayed foreground memory read');
  releaseMemory();await settle();assert.match(frame.src,/\/korean-racing\//);
  view.closeGame();show('visible');await settle();play.onclick();await settle();assert.equal(frame.src,undefined);
  view.stop();
  releaseMemory();await settle();assert.equal(frame.src,undefined,'logging out during memory loading cannot open the old game later');
  assert.equal(listeners.has('visibilitychange'), false);assert.equal(windowListeners.has('online'),false);assert.equal(window.SYNKLearningHost, undefined);
  const callsAfterStop=memoryCalls.length;restoreConnection();await settle();assert.equal(memoryCalls.length,callsAfterStop,'a late connection event cannot revive a stopped account');
});
