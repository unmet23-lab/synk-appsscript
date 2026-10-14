import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createAccountNotebook } from '../../synk-account/src/account-notebook.mjs';
import { createFormDrafts } from '../form-drafts.mjs';
import { createImportOperations } from '../operations.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const commitSource = source.slice(source.indexOf('async function commit('), source.indexOf('function stopRecording('));
const accountSource = source.slice(source.indexOf('notebook=createAccountNotebook('), source.indexOf('void notebook.start();'));
const clickSource = source.slice(source.indexOf("document.addEventListener('click',async event=>"), source.indexOf("document.addEventListener('change',async event=>"));
class Element {
  constructor() { this.children = []; this.dataset = {}; this.hidden = false; this.selectors = new Map(); this.listeners = new Map(); this.classList = { add() {} }; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  closest() { return this; }
  querySelector(selector) { if (!this.selectors.has(selector)) this.selectors.set(selector, new Element()); return this.selectors.get(selector); }
}
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function fixture(t) {
  const originals = ['document', 'addEventListener', 'removeEventListener', 'confirm'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, { document: { createElement: () => new Element() }, addEventListener() {}, removeEventListener() {}, confirm: () => true });
  const gate = deferred(), elements = new Map(), local = new Map(), sent = []; let auth, disk = { pages: ['guest before save'] }, notebook;
  const c = {
    album: structuredClone(disk), persistent: true, guestPersistent: true, accountVersion: 0,
    draft: null, draftDirty: false, imported: null, mediaBusy: 0, renderedHash: '', renders: 0,
    formDrafts: createFormDrafts(), validateAlbum: structuredClone,
    storage: { async save(value) { await gate.promise; disk = structuredClone(value); } },
    $: selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); },
    accountMedia: { clear() {} }, FAMILY_MANIFEST_FORMAT: 'synthetic', stopRecording() {}, mediaOperations: { reset() {} }, importOperations: createImportOperations(),
    paintAccount() {},
    confirmDiscard: () => true, history: { replaceState() {} }, location: { hash: '' },
    hasUnsaved: () => c.draftDirty || c.formDrafts.has(c.renderedHash),
    render() { c.renders++; c.draft = null; c.draftDirty = false; },
    createAccountNotebook: options => {
      notebook = createAccountNotebook({ ...options,
        storage: { get length() { return local.size; }, key: index => [...local.keys()][index] ?? null, getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
        accountFactory: options => { auth = options.onStatus; return { start: async () => auth({ status: 'signed-out', signedIn: false }), dispose() {} }; },
        syncFactory: options => ({ localRecords: () => ({ count: 0 }), close: () => options.onStatus({ status: 'closed', pending: false }), open: async () => { options.onState({ pages: ['account B'] }); options.onStatus({ status: 'synced', pending: false }); }, change: value => sent.push(structuredClone(value)) }),
      }); return notebook;
    },
  };
  vm.createContext(c); vm.runInContext(commitSource + accountSource, c); await notebook.start();
  t.after(() => { notebook.dispose(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { c, gate, sent, disk: () => disk,
    login: async () => { auth({ status: 'signed-in', signedIn: true, configured: true, accountId: 'synthetic-b', sessionGeneration: 1 }); await settle(); },
    logout: async () => { auth({ status: 'signed-out', signedIn: false, configured: true, accountId: null, sessionGeneration: 2 }); await settle(); },
    importGuest: async () => { const target = new Element(); target.dataset.notebook = 'import'; await elements.get('#account-panel').listeners.get('click')({ target }); await settle(); },
  };
}

test('guest save completed while signed in is restored on logout instead of the older login snapshot', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['latest guest save'] }).catch(error => error.code);
  await f.login(); const renders = f.c.renders; f.gate.resolve(); assert.equal(await pending, 'ACCOUNT_CHANGED');
  assert.deepEqual(f.c.album.pages, ['account B']); assert.equal(f.c.renders, renders);
  await f.logout(); assert.deepEqual(f.c.album, f.disk()); assert.deepEqual(f.c.album.pages, ['latest guest save']);
});

test('guest save completed after a login/logout roundtrip restores the acknowledged local album', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['latest guest save'] }).catch(error => error.code);
  await f.login(); await f.logout(); const renders = f.c.renders;
  f.gate.resolve(); assert.equal(await pending, 'ACCOUNT_CHANGED');
  assert.deepEqual(f.c.album, f.disk()); assert.deepEqual(f.c.album.pages, ['latest guest save']); assert.equal(f.c.renders, renders + 1);
});

test('restoring a late guest save preserves newly written form input and later navigation guards', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['latest guest save'] }).catch(error => error.code);
  await f.login(); await f.logout();
  f.c.draft = { title: '지금 새로 쓰는 이야기' }; f.c.draftDirty = true;
  f.c.formDrafts.capture('', 'question-form', { answer: '지금 쓰는 답' }); const renders = f.c.renders;
  f.gate.resolve(); await pending;
  assert.deepEqual(f.c.album, f.disk()); assert.equal(f.c.draft.title, '지금 새로 쓰는 이야기');
  assert.equal(f.c.draftDirty, true); assert.equal(f.c.formDrafts.has(''), true); assert.equal(f.c.renders, renders);
});

test('a failed guest save never replaces the existing device album on logout', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['failed guest save'] }).catch(error => error.code);
  await f.login(); f.gate.reject(new Error('synthetic device quota')); assert.equal(await pending, 'ACCOUNT_CHANGED');
  await f.logout(); assert.deepEqual(f.c.album, f.disk()); assert.deepEqual(f.c.album.pages, ['guest before save']);
});

test('the recovered guest snapshot is consumed once and cannot replace a newer device save on the next logout', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['first late guest save'] }).catch(error => error.code);
  await f.login(); f.gate.resolve(); await pending; await f.logout();
  await f.c.commit({ pages: ['newer guest save'] }); await f.login(); await f.logout();
  assert.deepEqual(f.c.album, f.disk()); assert.deepEqual(f.c.album.pages, ['newer guest save']);
});

test('late import save updates only the guest snapshot and cannot restore old undo or completion notices over an account', async t => {
  const f = await fixture(t), notices = []; let click;
  Object.assign(f.c, {
    busy: false, importSaving: false, renderVersion: 1,
    imported: { album: { pages: ['imported guest album'] }, operation: f.c.importOperations.begin('') },
    document: { addEventListener: (_name, callback) => { click = callback; } },
    setImportSaving: value => { f.c.importSaving = value; }, message: text => notices.push(text),
  });
  vm.runInContext(clickSource, f.c);
  const pending = click({ target: { closest: selector => selector === 'button' ? { id: 'confirm-import', dataset: {} } : null } });
  await f.login(); f.gate.resolve(); await pending;
  assert.deepEqual(f.c.album.pages, ['account B']); assert.equal(f.c.undo, null); assert.deepEqual(notices, []);
  assert.equal(f.c.busy, false); assert.equal(f.c.importSaving, false);
  await f.logout(); assert.deepEqual(f.c.album.pages, ['imported guest album']);
});

test('explicit device-to-account import uses the acknowledged late guest save without requiring logout first', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['latest guest save'] }).catch(error => error.code);
  await f.login(); f.gate.resolve(); await pending;
  assert.deepEqual(f.sent, []); assert.deepEqual(f.c.album.pages, ['account B']);
  await f.importGuest();
  assert.deepEqual(f.c.album.pages, ['latest guest save']); assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0], f.disk());
});

test('failed guest save makes no account write and cannot replace the last device snapshot in an explicit import', async t => {
  const f = await fixture(t), pending = f.c.commit({ pages: ['failed guest save'] }).catch(error => error.code);
  await f.login(); f.gate.reject(new Error('synthetic device quota')); await pending;
  assert.deepEqual(f.sent, []); assert.deepEqual(f.c.album.pages, ['account B']);
  await f.importGuest();
  assert.equal(f.sent.length, 1); assert.deepEqual(f.sent[0], f.disk());
  assert.deepEqual(f.c.album.pages, ['guest before save']);
});
