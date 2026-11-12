import test from 'node:test';
import assert from 'node:assert/strict';
import { planRestore, applyPlan, MAX_AGE_MS } from '../restore-hidden.mjs';

const P = 'c/0123456789abcdef/r/';
const T = 1_800_000_000_000;
let seq = 0;
const up = (name, ts, size = 10) => ({ action: 'upload', fileName: P + name, fileId: `id${++seq}`, uploadTimestamp: ts, contentLength: size });
const hide = (name, ts) => ({ action: 'hide', fileName: P + name, fileId: `hid${++seq}`, uploadTimestamp: ts, contentLength: 0 });
// B2 lists names ascending and versions newest first.
const listing = (...v) => [...v].sort((a, b) => a.fileName.localeCompare(b.fileName) || b.uploadTimestamp - a.uploadTimestamp);
const plan = (versions, extra = {}) => planRestore(listing(...versions), { at: T, now: T + 3600000, prefix: P, ...extra });

test('forget · prune after T only hid files: hide markers are removed, data untouched', () => {
  const snap = up('snapshots/aa', T - 5000), pack = up('data/ab/abcd', T - 6000, 4096);
  const p = plan([snap, pack, hide('snapshots/aa', T + 1000), hide('data/ab/abcd', T + 2000)]);
  assert.deepEqual(p.counts, { unhide: 2, copy: 0, hide: 0, unchanged: 0 });
  assert.equal(p.items[0].rel, 'data/ab/abcd', 'data before snapshots');
  assert.deepEqual(p.items[1].deleteFileIds.length, 1);
  assert.equal(p.copyBytes, 0);
});

test('overwrite after T is undone by copying the T version on top', () => {
  const good = up('data/cd/cdef', T - 1000, 2048);
  const p = plan([good, up('data/cd/cdef', T + 500, 7)]);
  assert.deepEqual(p.counts, { unhide: 0, copy: 1, hide: 0, unchanged: 0 });
  assert.equal(p.items[0].sourceFileId, good.fileId);
  assert.equal(p.copyBytes, 2048);
});

test('overwrite then hide after T still copies (deleting the marker would expose the bad version)', () => {
  const good = up('index/11', T - 1000);
  const p = plan([good, up('index/11', T + 10), hide('index/11', T + 20)]);
  assert.equal(p.items[0].type, 'copy');
});

test('files created after T are hidden; new snapshots are hidden before their data', () => {
  const p = plan([up('data/ef/ef01', T + 5), up('snapshots/zz', T + 6), up('locks/l1', T + 7)]);
  assert.deepEqual(p.counts, { unhide: 0, copy: 0, hide: 3, unchanged: 0 });
  assert.deepEqual(p.items.map(i => i.rel), ['snapshots/zz', 'locks/l1', 'data/ef/ef01']);
});

test('unchanged and already-gone-before-T files are left alone', () => {
  const keep = up('config', T - 100);
  const gone = up('data/00/0000', T - 900);
  const p = plan([keep, gone, hide('data/00/0000', T - 50)]);
  assert.deepEqual(p.counts, { unhide: 0, copy: 0, hide: 0, unchanged: 2 });
  assert.equal(p.items.length, 0);
});

test('a file hidden before T and re-uploaded after T is hidden again', () => {
  const p = plan([up('keys/k1', T - 900), hide('keys/k1', T - 50), up('keys/k1', T + 50)]);
  assert.equal(p.items[0].type, 'hide');
});

test('version exactly at T counts as before T', () => {
  const p = plan([up('config', T)]);
  assert.deepEqual(p.counts, { unhide: 0, copy: 0, hide: 0, unchanged: 1 });
});

test('unfinished large files and folders are ignored', () => {
  const p = plan([{ action: 'start', fileName: P + 'data/big', fileId: 'x', uploadTimestamp: T + 1 }, { action: 'folder', fileName: P + 'data/', fileId: null, uploadTimestamp: 0 }]);
  assert.equal(p.items.length, 0);
});

test('rejects times outside the 30-day window, the future, and names outside the prefix', () => {
  assert.throws(() => planRestore([], { at: T, now: T + MAX_AGE_MS + 1, prefix: P }), /TOO_OLD/);
  assert.throws(() => planRestore([], { at: T + 10, now: T, prefix: P }), /FUTURE/);
  assert.throws(() => planRestore([{ action: 'upload', fileName: 'c/other/r/config', fileId: 'a', uploadTimestamp: T }], { at: T, now: T + 1, prefix: P }), /OUTSIDE_PREFIX/);
  assert.throws(() => planRestore([], { at: T, now: T + 1, prefix: 'c/x' }), /PREFIX_INVALID/);
});

test('applyPlan calls only the expected B2 operations and journals results', async () => {
  const calls = [];
  const session = {
    deleteFileVersion: async (a) => { calls.push(['delete', a.fileId]); return {}; },
    copyFile: async (a) => { calls.push(['copy', a.sourceFileId]); return { fileId: 'new1' }; },
    hideFile: async (a) => { calls.push(['hide', a.fileName]); return { fileId: 'hm1' }; },
  };
  const good = up('data/aa/1', T - 10), snapNew = up('snapshots/new', T + 10);
  const p = plan([good, up('data/aa/1', T + 5), up('config', T - 20), hide('config', T + 30), snapNew]);
  const journal = await applyPlan(session, { bucketId: 'b', plan: p });
  assert.deepEqual(calls.map(c => c[0]), ['copy', 'delete', 'hide']);
  assert.equal(journal.length, 3);
  assert.equal(journal[0].newFileId, 'new1');
});
