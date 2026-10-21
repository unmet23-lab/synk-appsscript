import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createAccountClient } from '../src/generated/account-client.cjs';

// This suite mounts the actual WORLD wardrobe view and actual controller.
// Only the DOM, durable storage and HTTP transport are synthetic. The optional
// module path is a frozen bundle of those same sources for before/after evidence.
const actual = process.env.WARDROBE_TEST_VIEW_MODULE
  ? await import(pathToFileURL(process.env.WARDROBE_TEST_VIEW_MODULE).href)
  : { ...(await import('../src/wardrobe-view.mjs')), ...(await import('../src/generated/wardrobe-client.cjs')) };
const { createWardrobeView, starterWardrobe } = actual;
const copy = value => structuredClone(value);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check, description) {
  for (let attempt = 0; attempt < 20; attempt++) { if (check()) return; await tick(); }
  assert.ok(check(), description);
}

class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.parentNode = null;
    this.attributes = new Map(); this.listeners = new Map(); this.dataset = {};
    this.ownText = ''; this.hidden = false; this.disabled = false; this.className = '';
    this.classList = { add: value => { this.className += ` ${value}`; } };
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { for (const child of this.children) child.parentNode = null; this.children = []; this.ownText = String(value); }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.ownText = ''; this.append(...children); }
  remove() { if (this.parentNode) { const parent = this.parentNode; this.parentNode = null; parent.children = parent.children.filter(child => child !== this); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); if (!this.listeners.get(name)?.size) this.listeners.delete(name); }
  click() { if (!this.disabled) this.onclick?.(); }
}
const descendants = root => [root, ...root.children.flatMap(descendants)];
const classes = (el, name) => el.className.split(/\s+/).includes(name);
const accountComplete = /계정에 (?:저장했|옷장을 저장했|저장되어)|다른 기기에서도 이어/;

function fixture(t, { revision = 1, read, seed = null } = {}) {
  const document = new Element('document'); document.hidden = false;
  document.head = new Element('head'); document.body = new Element('body'); document.append(document.head, document.body);
  document.createElement = tag => new Element(tag);
  document.getElementById = id => descendants(document).find(el => el.id === id) || null;
  const globals = { document, window: { matchMedia: () => ({ matches: false }) } };
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  let disk = copy(seed), writes = 0, wardrobe = { ...starterWardrobe(), revision }, view;
  const transport = { failure: null, saveGate: null, calls: [], committed: 0 };
  const storage = { read: async () => read ? read() : copy(disk), write: async value => { writes++; disk = copy(value); } };
  const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => copy(body) });
  const client = createAccountClient({
    url: 'https://wardrobe-synthetic.invalid', anonKey: 'synthetic-public-key', product: 'world',
    getAccessToken: () => 'synthetic-access-token', guard: () => {},
    fetch: async (url, options) => {
      assert.equal(new URL(url).pathname, '/functions/v1/synk-wardrobe');
      const payload = options.body ? JSON.parse(options.body) : null;
      transport.calls.push({ method: options.method, payload });
      if (payload && transport.saveGate) await transport.saveGate.promise;
      if (transport.failure) return response(transport.failure.status, { ok: false, error: { code: transport.failure.code } });
      if (payload) {
        assert.equal(payload.action, 'save');
        if (payload.expected_revision !== wardrobe.revision) return response(409, { ok: false, error: { code: 'REVISION_CONFLICT' } });
        wardrobe = { ...wardrobe, equipped: copy(payload.equipped), looks: copy(payload.looks), photos: copy(payload.photos), revision: wardrobe.revision + 1 };
        transport.committed++;
      }
      return response(200, { ok: true, wardrobe, progress: { completedActivities: 0, learningConnected: false, nextMilestone: null } });
    },
  });
  function mount() {
    view?.stop(); view = createWardrobeView({ owner: 'synthetic-wardrobe-owner', storage, client });
    document.body.replaceChildren(view.element); return view;
  }
  const all = () => descendants(view.element);
  const one = predicate => { const found = all().find(predicate); assert.ok(found, 'Expected an actual rendered wardrobe element'); return found; };
  const sync = () => one(el => classes(el, 'wardrobe-sync'));
  const status = () => {
    const messages = sync().children.filter(el => el.tagName === 'p');
    assert.equal(messages.length, 1, 'One primary wardrobe synchronization message');
    assert.equal(messages[0].getAttribute('aria-live'), 'polite');
    return messages[0].textContent;
  };
  const button = label => one(el => el.tagName === 'button' && el.textContent === label);
  const equip = () => one(el => el.dataset.action === 'equip');
  const choose = id => one(el => el.tagName === 'button' && el.dataset.costumeId === id).click();
  const wear = id => { choose(id); assert.equal(equip().disabled, false); equip().click(); };
  const worn = () => one(el => classes(el, 'wardrobe-worn')).textContent;
  const posts = () => transport.calls.filter(call => call.method === 'POST');
  t.after(() => {
    transport.saveGate?.resolve(); view?.stop();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  return { mount, status, button, equip, choose, wear, worn, all, one, posts, transport,
    get disk() { return copy(disk); }, get writes() { return writes; }, get remote() { return copy(wardrobe); },
    changeRemote(id) { wardrobe = { ...wardrobe, equipped: { costumeId: id, backgroundId: 'paper' }, revision: wardrobe.revision + 1 }; },
  };
}

test('initial delayed storage read announces loading without claiming a saved copy', async t => {
  const read = deferred(), f = fixture(t, { read: () => read.promise });
  t.after(() => read.resolve(null));
  const view = f.mount();
  assert.equal(f.writes, 0); assert.equal(f.transport.calls.length, 0);
  assert.match(f.status(), /불러오|확인하|준비하/);
  assert.doesNotMatch(f.status(), /보관|저장했|저장되어|다른 기기/);
  assert.equal(f.equip().disabled, true);
  read.resolve(null); await view.ready;
  assert.match(f.status(), accountComplete);
});

test('failed initial storage read shows the error once and never contacts the account', async t => {
  const f = fixture(t, { read: async () => { throw new Error('합성 기기 저장소 읽기 실패'); } });
  await f.mount().ready;
  assert.equal(f.writes, 0); assert.equal(f.transport.calls.length, 0);
  assert.equal(f.status(), '합성 기기 저장소 읽기 실패');
  assert.doesNotMatch(f.status(), accountComplete);
  assert.equal(f.equip().disabled, true);
  assert.equal(f.all().filter(el => el.tagName === 'p' && el.textContent === '합성 기기 저장소 읽기 실패').length, 1);
});

test('delayed account save publishes the durable pending outfit and a saving message before success', async t => {
  const f = fixture(t); await f.mount().ready; assert.match(f.status(), accountComplete);
  f.transport.saveGate = deferred(); f.wear('kkamong-scarf');
  await until(() => f.posts().length === 1 && f.disk.pending === true, 'A durable pending draft precedes the HTTP response');
  assert.match(f.worn(), /목도리/, 'Actual onChange delivery updates the worn outfit while the POST is pending');
  assert.match(f.status(), /저장.*(?:중|있|대기)|연결/);
  assert.doesNotMatch(f.status(), accountComplete, 'A previous successful GET cannot announce this pending save as completed');
  assert.equal(f.equip().disabled, true); assert.equal(f.button('옷장 다시 확인').disabled, true);
  assert.equal(f.one(el => classes(el, 'wardrobe-feedback')).textContent, '');
  f.transport.saveGate.resolve();
  await until(() => !f.disk.pending && !f.button('옷장 다시 확인').disabled, 'Account acknowledgment completes the save');
  assert.match(f.status(), accountComplete);
  assert.equal(f.remote.equipped.costumeId, 'kkamong-scarf');
  assert.equal(f.transport.committed, 1);
  assert.equal(f.all().filter(el => el.tagName === 'p' && accountComplete.test(el.textContent)).length, 1, 'The account completion message is not repeated in another live region');
});

test('404 explains unavailable account wardrobe service while retaining the local pending outfit for retry', async t => {
  const f = fixture(t, { revision: 0 });
  f.transport.failure = { status: 404, code: 'NOT_FOUND' }; await f.mount().ready;
  assert.match(f.status(), /아직|준비|제공/); assert.doesNotMatch(f.status(), accountComplete);
  f.wear('kkamong-scarf');
  await until(() => f.disk?.pending === true && !f.button('옷장 다시 확인').disabled, 'The unavailable service leaves an editable local draft');
  assert.match(f.worn(), /목도리/); assert.match(f.status(), /아직|준비|제공/);
  assert.equal(f.transport.committed, 0);
  await f.mount().ready;
  assert.equal(f.disk.pending, true); assert.match(f.worn(), /목도리/);
  f.transport.failure = null; f.button('옷장 다시 확인').click();
  await until(() => f.disk.pending === false && f.transport.committed === 1, 'A later available service saves the restored local draft');
  assert.match(f.status(), accountComplete); assert.equal(f.remote.equipped.costumeId, 'kkamong-scarf');
});

test('503 retains the pending draft across remount and successful reconnect clears only its pending flag', async t => {
  const f = fixture(t); await f.mount().ready;
  f.transport.failure = { status: 503, code: 'SERVICE_UNAVAILABLE' }; f.wear('kkamong-headphones');
  await until(() => f.disk?.pending === true && !f.button('옷장 다시 확인').disabled, 'Failed HTTP save retains the draft');
  assert.match(f.status(), /연결|다시|잠시/); assert.doesNotMatch(f.status(), accountComplete);
  assert.match(f.worn(), /헤드폰/); assert.equal(f.transport.committed, 0);
  await f.mount().ready;
  assert.equal(f.disk.pending, true); assert.match(f.worn(), /헤드폰/);
  f.transport.failure = null; f.button('옷장 다시 확인').click();
  await until(() => f.disk.pending === false && f.transport.committed === 1, 'Reconnect acknowledges the restored draft');
  assert.match(f.status(), accountComplete);
  assert.equal(f.remote.equipped.costumeId, 'kkamong-headphones');
});

test('remote conflict and a failed refresh preserve the local choice until explicit account selection', async t => {
  const f = fixture(t), view = f.mount(); await view.ready;
  f.changeRemote('kkamong-headphones'); f.wear('kkamong-scarf');
  await until(() => f.all().some(el => classes(el, 'wardrobe-conflict')) && !f.button('계정의 차림 불러오기').disabled, 'Revision mismatch renders explicit conflict choices');
  assert.match(f.worn(), /목도리/); assert.equal(f.disk.pending, true);
  assert.doesNotMatch(f.status(), accountComplete);
  assert.equal(f.equip().disabled, true); const attempts = f.posts().length;
  f.transport.failure = { status: 503, code: 'SERVICE_UNAVAILABLE' };
  // Account host visibility/online events use this public view method. During a
  // conflict the ordinary retry button intentionally waits for a user choice.
  await view.refresh();
  assert.ok(f.all().some(el => classes(el, 'wardrobe-conflict')));
  assert.match(f.worn(), /목도리/); assert.equal(f.disk.pending, true);
  assert.equal(f.posts().length, attempts); assert.equal(f.transport.committed, 0);
  f.transport.failure = null; f.button('계정의 차림 불러오기').click();
  await until(() => !f.disk.pending && !f.all().some(el => classes(el, 'wardrobe-conflict')), 'Explicit choice accepts the displayed account copy');
  assert.match(f.worn(), /헤드폰/); assert.match(f.status(), accountComplete);
  assert.equal(f.posts().length, attempts); assert.equal(f.transport.committed, 0);
});
