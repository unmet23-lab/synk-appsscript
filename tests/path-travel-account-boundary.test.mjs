import test from 'node:test';
import assert from 'node:assert/strict';
import { createTravelAccount, createTravelAccountNotebook, emptyTravelAccountDocument, travelDeviceState } from '../experiences/path-travel/planner-account.mjs';
import { validatePersonalState } from '../experiences/synk-account/src/personal-data.mjs';

const at = '2026-10-08T00:00:00.000Z';
const copy = structuredClone;
const documentState = () => emptyTravelAccountDocument({ now: at });
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function invalidDocuments() {
  const loneSurrogate = documentState(); loneSurrogate.query.origin.name = '숙소\uD800';
  const nonJson = documentState(); nonJson.query.origin.name = undefined;
  return [
    ['lone surrogate', loneSurrogate, 'PERSONAL_DATA_INVALID'],
    ['wrong version', { ...documentState(), version: 9 }, 'PERSONAL_DATA_INVALID'],
    ['non JSON value', nonJson, 'PERSONAL_DATA_INVALID'],
    ['oversize', { ...documentState(), padding: Array(40).fill('x'.repeat(16000)) }, 'PERSONAL_DATA_TOO_LARGE'],
  ];
}
function nativeFixture(initial) {
  let state = copy(initial), revision = 0;
  const calls = [];
  const envelope = () => ({ ok: true, scope: 'synk-personal', resource: 'path-travel', accountId: 'fixture-owner', revision, updatedAt: at, state: copy(state) });
  return { calls, bridge: {
    getEnvironment: async () => ({ clientId: 'path-travel' }),
    authStatus: async () => ({ configured: true, signedIn: true, sessionGeneration: 1, account: { synk_user_id: 'fixture-owner' } }),
    onAuthChanged: () => () => {},
    accountRequest: async (operation, values) => {
      calls.push({ operation, values: copy(values) });
      if (operation === 'personalSave') {
        assert.equal(values.expected_revision, revision, 'CAS revision is retained');
        state = copy(values.state); revision++;
      }
      return envelope();
    },
  } };
}

test('travel direct account rejects invalid values with the server JSON boundary code before invoking native save', async t => {
  const fixture = nativeFixture(documentState());
  const client = await createTravelAccount({ bridge: fixture.bridge, validateState: value => value });
  t.after(() => client.dispose());
  assert.equal((await client.start()).signedIn, true);
  for (const [name, state, code] of invalidDocuments()) {
    assert.throws(() => validatePersonalState('path-travel', state), { code }, name);
    const before = fixture.calls.length;
    await assert.rejects(client.request('personalSave', { expected_revision: 0, state }), { code }, name);
    assert.equal(fixture.calls.length, before, `${name} must not reach native transport`);
    assert.equal(client.status().signedIn, true, 'invalid draft does not sign the owner out');
  }
  const valid = documentState(); valid.query.origin.name = '숙소 🌏'; valid.query.budget = 71000;
  const result = await client.request('personalSave', { expected_revision: 0, state: valid });
  assert.equal(result.revision, 1);
  assert.deepEqual(result.state, validatePersonalState('path-travel', valid));
});

class Element {
  constructor() { this.children = []; this.dataset = {}; this.hidden = false; this.disabled = false; this.textContent = ''; this.selectors = new Map(); this.listeners = new Map(); this.classList = { add() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  closest() { return this; }
  querySelector(selector) {
    const action = /^\[data-notebook="(.+)"\]$/.exec(selector)?.[1];
    if (action) {
      const find = node => node.children.find(child => child.dataset.notebook === action) || node.children.map(find).find(Boolean);
      const node = find(this); if (node) return node;
    }
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element());
    return this.selectors.get(selector);
  }
}
function notebookEnvironment(t) {
  for (const [key, value] of Object.entries({ document: { createElement: () => new Element() }, addEventListener() {}, removeEventListener() {} })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else delete globalThis[key]; });
  }
}
function storage() {
  const rows = new Map();
  return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key), key: index => [...rows.keys()][index] ?? null, get length() { return rows.size; } };
}

test('travel default notebook refuses malformed remote data before applying it to the editor', async t => {
  notebookEnvironment(t);
  for (const [name, state, code] of invalidDocuments()) {
    const fixture = nativeFixture(state), applied = [], guest = travelDeviceState(documentState());
    const notebook = await createTravelAccountNotebook({ mount: new Element(), content: new Element(), storage: storage(), bridge: fixture.bridge,
      getState: () => guest, applyState: value => applied.push(copy(value)) });
    try {
      const auth = await notebook.start(); await settle();
      assert.equal(auth.signedIn, false, name);
      assert.equal(auth.error.code, code, name);
      assert.equal(notebook.active, false, name);
      assert.equal(notebook.canEdit, false, name);
      assert.deepEqual(applied, [], name);
      assert.equal(fixture.calls.filter(call => call.operation === 'personalSave').length, 0, name);
    } finally { notebook.dispose(); }
  }
});

test('travel default account and notebook retain valid Unicode, consent separation, revisions and save acknowledgements', async t => {
  let notebook;
  t.after(() => notebook?.dispose());
  notebookEnvironment(t);
  const initial = documentState(); initial.query.origin.name = '서울 숙소 🌏';
  const fixture = nativeFixture(initial), applied = [];
  let visible = travelDeviceState(documentState(), { consent: true });
  notebook = await createTravelAccountNotebook({ mount: new Element(), content: new Element(), storage: storage(), bridge: fixture.bridge,
    getState: () => visible, applyState: value => { visible = copy(value); applied.push(copy(value)); } });
  const auth = await notebook.start(); await settle();
  assert.equal(auth.signedIn, true);
  assert.equal(notebook.canEdit, true);
  assert.deepEqual(visible, travelDeviceState(initial));
  assert.equal(visible.consent, false);
  const applications = applied.length;
  const changed = copy(visible); changed.query.budget = 72000;
  assert.equal(await notebook.change(changed), true);
  await notebook.retry(); await settle();
  const saves = fixture.calls.filter(call => call.operation === 'personalSave');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].values.expected_revision, 0);
  assert.equal(saves[0].values.state.query.budget, 72000);
  assert.equal(Object.hasOwn(saves[0].values.state, 'consent'), false);
  assert.equal(notebook.pending, false);
  assert.equal(applied.length, applications, 'save acknowledgement does not overwrite the editor');
  const next = copy(changed); next.query.budget = 84000;
  assert.equal(await notebook.change(next), true);
  await notebook.retry(); await settle();
  const nextSaves = fixture.calls.filter(call => call.operation === 'personalSave');
  assert.equal(nextSaves.length, 2);
  assert.equal(nextSaves[1].values.expected_revision, 1, 'the first acknowledgement advances the next CAS revision');
  assert.equal(nextSaves[1].values.state.query.budget, 84000);
  assert.equal(Object.hasOwn(nextSaves[1].values.state, 'consent'), false);
  assert.equal(notebook.pending, false);
  assert.equal(applied.length, applications, 'the second acknowledgement also preserves the editor');
});
