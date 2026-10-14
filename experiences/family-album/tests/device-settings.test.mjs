import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const accountSource = source.slice(source.indexOf('notebook=createAccountNotebook('), source.indexOf('void notebook.start();'));
// The device storage switch is a role="switch" button (#persist). Its click is routed by the main click
// handler to togglePersist(), which sits between the click and change handlers.
const start = source.indexOf("document.addEventListener('click',async event=>"), end = source.indexOf("document.addEventListener('change',async event=>", start);
const clickSource = source.slice(start, end);
const storageStart = source.indexOf('function storageSummary(');
const storageSource = storageStart < 0 ? '' : source.slice(storageStart, source.indexOf('function storageView(', storageStart));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function switchElement(on) {
  const attributes = { 'aria-checked': String(on) };
  return { id: 'persist', dataset: {}, disabled: false, setAttribute: (key, value) => { attributes[key] = String(value); }, getAttribute: key => attributes[key] ?? null };
}
function fixture(initial) {
  const notices = [], calls = [], gate = deferred(), elements = new Map(), listeners = new Map(); let disk = initial;
  const c = {
    album: { pages: ['guest'] }, persistent: initial, guestPersistent: initial, busy: false, accountVersion: 0, renderVersion: 0,
    document: { addEventListener: (name, callback) => { listeners.set(name, callback); } },
    $: selector => elements.get(selector), message: text => notices.push(text),
    storage: {
      async save(value) { calls.push(structuredClone(value)); await gate.promise; disk = true; },
      async remove() { calls.push('remove'); await gate.promise; disk = false; },
    },
    createAccountNotebook: options => ({ options, active: false }), paintAccount() {},
    stopRecording() {}, mediaOperations: { reset() {} }, importOperations: { invalidate() {} }, accountMedia: { clear() {} },
    FAMILY_MANIFEST_FORMAT: 'synthetic', confirmDiscard: () => true, validateAlbum: value => structuredClone(value),
    formDrafts: { clearAll() {} }, history: { replaceState() {} }, location: {},
    renders: 0, render() {
      c.renderVersion++; c.renders++;
      elements.set('#persist', switchElement(c.persistent));
      elements.set('.storage > div > p', { textContent: c.persistent ? '보관 중' : '탭에서만' });
    },
  };
  vm.createContext(c); vm.runInContext(storageSource + accountSource + clickSource, c); c.render();
  function mode(active) {
    const wasActive = c.notebook.active; c.notebook.active = active; c.notebook.options.onMode(active, { wasActive });
    c.notebook.options.applyState({ pages: [active ? 'account B' : 'guest'] });
  }
  // Pressing the rendered switch asks for the opposite of what it currently shows.
  function toggle(value) {
    const button = elements.get('#persist');
    assert.equal(button.getAttribute('aria-checked'), String(!value));
    return listeners.get('click')({ target: { closest: selector => selector === 'button' ? button : null } });
  }
  return { c, elements, notices, calls, gate, mode, disk: () => disk, toggle, shown: () => elements.get('#persist').getAttribute('aria-checked') };
}

for (const next of [false, true]) test(`device storage ${next ? 'enable' : 'disable'} finishing after login belongs only to the guest setting`, async () => {
  const f = fixture(!next), pending = f.toggle(next); f.mode(true);
  f.gate.resolve(); await pending;
  assert.equal(f.disk(), next); assert.equal(f.c.persistent, false); assert.equal(f.c.guestPersistent, next);
  assert.deepEqual(f.c.album.pages, ['account B']); assert.deepEqual(f.notices, []);
  f.mode(false); assert.equal(f.c.persistent, next); assert.equal(f.shown(), String(next));
});

for (const next of [false, true]) test(`device storage ${next ? 'enable' : 'disable'} after a login/logout roundtrip updates the current setting without replacing the screen`, async () => {
  const f = fixture(!next), pending = f.toggle(next); f.mode(true); f.mode(false);
  const renders = f.c.renders; f.c.album.pages.push('new guest input');
  f.gate.resolve(); await pending;
  assert.equal(f.disk(), next); assert.equal(f.c.persistent, next); assert.equal(f.c.guestPersistent, next);
  assert.equal(f.shown(), String(next)); assert.equal(f.c.renders, renders);
  assert.deepEqual(f.c.album.pages, ['guest', 'new guest input']); assert.deepEqual(f.notices, []);
});

test('a failed old device operation leaves the latest account and saved guest setting unchanged', async () => {
  const f = fixture(true), pending = f.toggle(false); f.mode(true);
  f.gate.reject(new Error('old device delete failure')); await pending;
  assert.equal(f.disk(), true); assert.equal(f.c.guestPersistent, true); assert.equal(f.c.persistent, false);
  assert.deepEqual(f.notices, []); assert.deepEqual(f.c.album.pages, ['account B']);
});

for (const next of [false, true]) test(`normal device storage ${next ? 'enable' : 'disable'} still saves the setting and reports its result`, async () => {
  const f = fixture(!next), pending = f.toggle(next); f.gate.resolve(); await pending;
  assert.equal(f.disk(), next); assert.equal(f.c.persistent, next); assert.equal(f.shown(), String(next));
  assert.equal(f.notices.length, 1); assert.equal(f.c.busy, false);
});
