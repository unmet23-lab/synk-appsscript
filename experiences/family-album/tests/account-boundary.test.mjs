import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMediaOperations } from '../operations.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const commitSource = source.slice(source.indexOf('async function commit('), source.indexOf('function storageView('));
// The signal redesign paints the record switch through paintRecord(), declared right before startRecording.
const recordingSource = source.slice(source.indexOf('function paintRecord('), source.indexOf("document.addEventListener('submit'"));
const accountSource = source.slice(source.indexOf('notebook=createAccountNotebook('), source.indexOf('void notebook.start();'));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function recordButton() {
  const label = { textContent: '' }, classes = new Set();
  return { textContent: '', innerHTML: '', label, classes, attributes: {},
    classList: { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    querySelector: selector => selector === 'span' ? label : null };
}
function fixture() {
  const elements = new Map(['#main', '#account-panel', '#record-status', '#audio-preview'].map(id => [id, { textContent: '', innerHTML: '' }]));
  elements.set('#record-button', recordButton());
  const recorders = [], notices = [], timers = new Set();
  const context = {
    album: { pages: ['guest'] }, persistent: true, guestPersistent: true, accountVersion: 0,
    recordingVersion: 0, recordCancelled: false, recorder: null, recordStream: null, recordTimer: null,
    draft: { id: 'a', audio: null }, draftDirty: false, mediaBusy: 0, native: false,
    mediaOperations: createMediaOperations(), importOperations: { invalidate() {} },
    validateAlbum: value => structuredClone(value), storage: { async save() {} },
    accountMedia: { clear() {} }, FAMILY_MANIFEST_FORMAT: 'synthetic', paintAccount() {},
    formDrafts: { clearAll() {} }, history: { replaceState() {} }, location: {}, render() {},
    $: id => elements.get(id), confirmDiscard: () => true,
    createAccountNotebook: options => ({ options, active: false, updateGuestState() {} }),
    navigator: { mediaDevices: { async getUserMedia() { return stream(); } } },
    MediaRecorder: class {
      static isTypeSupported() { return true; }
      constructor(value) { this.stream = value; this.state = 'inactive'; recorders.push(this); }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; } // The browser queues onstop separately.
    },
    File: class { constructor(chunks, name, options) { this.chunks = chunks; this.name = name; this.type = options.type; } },
    readMedia: async file => ({ name: file.name, type: file.type, data: 'synthetic-audio' }),
    mediaPreview: () => 'preview', message: (...args) => notices.push(args), LIMITS: { audio: 8 * 1024 * 1024 },
    setInterval: callback => { const timer = { callback }; timers.add(timer); return timer; },
    clearInterval: timer => timers.delete(timer),
  };
  vm.createContext(context); vm.runInContext(commitSource + recordingSource + accountSource, context);
  return { context, elements, recorders, notices, timers };
}
function stream() { const track = { stopped: 0, stop() { this.stopped++; } }; return { track, getTracks: () => [track] }; }

test('late guest device save cannot replace the signed-in album', async () => {
  const { context: c } = fixture(), save = deferred(); c.storage.save = () => save.promise;
  const pending = c.commit({ pages: ['guest update'] });
  c.notebook.active = true; c.notebook.options.onMode(true, { wasActive: false });
  c.notebook.options.applyState({ pages: ['account B'] });
  save.resolve(); await pending.catch(error => assert.equal(error.code, 'ACCOUNT_CHANGED'));
  assert.deepEqual(c.album.pages, ['account B']);
});

test('pending microphone permission belongs to the original account and draft', async () => {
  const { context: c, recorders } = fixture(), permission = deferred(), oldStream = stream();
  c.navigator.mediaDevices.getUserMedia = () => permission.promise;
  const pending = c.startRecording();
  c.notebook.options.onMode(true, { wasActive: false }); c.draft = { id: 'b', audio: null };
  permission.resolve(oldStream); await pending;
  assert.equal(recorders.length, 0); assert.equal(oldStream.track.stopped, 1); assert.equal(c.draft.audio, null);
});

test('late previous stop cannot stop the new recording or attach previous account audio', async () => {
  const { context: c, recorders, timers } = fixture();
  await c.startRecording(); const first = recorders[0];
  first.ondataavailable({ data: { size: 4 } }); c.stopRecording();
  c.notebook.options.onMode(true, { wasActive: false }); c.draft = { id: 'b', audio: null };
  await c.startRecording(); const second = recorders[1], activeTimer = c.recordTimer;
  await first.onstop();
  assert.equal(c.draft.audio, null); assert.equal(second.stream.track.stopped, 0);
  assert.equal(c.recordStream, second.stream); assert.equal(timers.has(activeTimer), true);
  const button = c.$('#record-button');
  assert.equal(button.label.textContent, '녹음 마치기'); assert.equal(button.attributes['aria-pressed'], 'true');
});

test('active recording is stopped immediately when account ownership changes', async () => {
  const { context: c, recorders } = fixture(); await c.startRecording();
  const first = recorders[0]; c.notebook.options.onMode(true, { wasActive: false });
  assert.equal(first.state, 'inactive'); assert.equal(first.stream.track.stopped, 1);
  await first.onstop(); assert.equal(c.draft.audio, null);
});

test('a normal recording still attaches to its original story and releases its microphone', async () => {
  const { context: c, recorders } = fixture(); await c.startRecording();
  const first = recorders[0]; first.ondataavailable({ data: { size: 4 } }); c.stopRecording(); await first.onstop();
  assert.equal(c.draft.audio.data, 'synthetic-audio'); assert.equal(c.draftDirty, true);
  assert.ok(first.stream.track.stopped > 0); assert.equal(c.mediaBusy, 0);
  const button = c.$('#record-button');
  assert.equal(button.label.textContent, '다시 녹음하기'); assert.equal(button.attributes['aria-pressed'], 'false');
});

test('failed device save after ownership changes is stale, while a current failure is still reported', async () => {
  const { context: c } = fixture(), save = deferred(); c.storage.save = () => save.promise;
  const pending = c.commit({ pages: ['guest update'] });
  c.notebook.options.onMode(true, { wasActive: false }); c.notebook.options.applyState({ pages: ['account B'] });
  save.reject(new Error('old quota failure')); await assert.rejects(pending, { code: 'ACCOUNT_CHANGED' });
  assert.deepEqual(c.album.pages, ['account B']);
  c.notebook.options.onMode(false); c.storage.save = async () => { throw new Error('current quota failure'); };
  await assert.rejects(c.commit({ pages: ['another update'] }), /current quota failure/);
  assert.deepEqual(c.album.pages, ['account B']);
});

test('late microphone permission rejection does not produce a new-account failure', async () => {
  const { context: c, notices } = fixture(), permission = deferred();
  c.navigator.mediaDevices.getUserMedia = () => permission.promise;
  const pending = c.startRecording(); c.notebook.options.onMode(true, { wasActive: false });
  permission.reject(new Error('old permission rejection')); await pending;
  assert.equal(notices.length, 0);
});

test('late recorder error and data events cannot cancel the next account recording', async () => {
  const { context: c, recorders, notices } = fixture(); await c.startRecording();
  const first = recorders[0]; c.notebook.options.onMode(true, { wasActive: false }); c.draft = { id: 'b', audio: null };
  await c.startRecording(); const second = recorders[1];
  first.onerror(); first.ondataavailable({ data: { size: 100 * 1024 * 1024 } });
  assert.equal(second.state, 'recording'); assert.equal(second.stream.track.stopped, 0); assert.equal(notices.length, 0);
});

for (const reject of [false, true]) test(`late media file ${reject ? 'failure' : 'completion'} cannot alter the next account draft or notice`, async () => {
  const { context: c, notices } = fixture(), read = deferred(); let change;
  c.document = { addEventListener: (_name, callback) => { change = callback; } };
  const start = source.indexOf("document.addEventListener('change',async event=>"), end = source.indexOf("$('#import-dialog').addEventListener", start);
  vm.runInContext(source.slice(start, end), c);
  c.readMedia = () => read.promise;
  const pending = change({ target: { id: 'photo-file', files: [{}], value: 'selected' } });
  c.notebook.options.onMode(true, { wasActive: false }); c.draft = { id: 'b', photo: null };
  if (reject) read.reject(new Error('old media decode error')); else read.resolve({ data: 'old photo' });
  await pending;
  assert.equal(c.draft.photo, null); assert.equal(notices.length, 0); assert.equal(c.mediaBusy, 0);
});
