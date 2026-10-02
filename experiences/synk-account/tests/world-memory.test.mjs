import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAccountView } from '../src/account-view.mjs';

// The WORLD page hands the account client's memory transport to the host and follows the page:
// going to the background sends the changed memory, coming back reads what other devices chose.
// The real view and engine run against a minimal DOM and synthetic servers.
const require = createRequire(import.meta.url);
const { engine } = require('../../../atlas/game-browser.js');
class Node {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.textContent = '';this.hidden = false;this.disabled = false;this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener() {}
  closest() { return this; }
}
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
const copy = value => JSON.parse(JSON.stringify(value));

test('the WORLD page sends changed memory when it goes to the background and reads it again when it comes back', async t => {
  const ids = new Map(), listeners = new Map(), stored = new Map(), rows = new Map(), memoryCalls = [];
  const document = { body: new Node('body'), visibilityState: 'visible', createElement: tag => new Node(tag),
    getElementById: id => { if (!ids.has(id)) ids.set(id, new Node());return ids.get(id); }, querySelector: () => new Node(), querySelectorAll: () => [],
    addEventListener(type, listener) { listeners.set(type, listener); }, removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); } };
  const show = state => { document.visibilityState = state;listeners.get('visibilitychange')?.(); };
  const originals = ['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: { SynkLearning: { engine } }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key) }, configurable: true, writable: true });
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
  assert.deepEqual(memoryCalls, ['get', 'post', 'get']);
  view.stop();
  assert.equal(listeners.has('visibilitychange'), false);assert.equal(window.SYNKLearningHost, undefined);
});
