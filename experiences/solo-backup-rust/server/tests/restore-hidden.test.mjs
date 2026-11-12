import test from 'node:test';
import assert from 'node:assert/strict';
import { planRestore, applyPlan, MAX_AGE_MS } from '../restore-hidden.mjs';

const P = 'c/0123456789abcdef/r/';
const T = 1_800_000_000_000;
let seq = 0;
const sha = (s) => s.padEnd(40, '0').slice(0, 40);
const up = (name, ts, size = 10, content = `c${seq + 1}`) => ({ action: 'upload', fileName: P + name, fileId: `id${++seq}`, uploadTimestamp: ts, contentLength: size, contentSha1: sha(content) });
const hide = (name, ts) => ({ action: 'hide', fileName: P + name, fileId: `hid${++seq}`, uploadTimestamp: ts, contentLength: 0 });
// B2 lists names ascending and versions newest first.
const listing = (...v) => [...v].sort((a, b) => a.fileName.localeCompare(b.fileName) || b.uploadTimestamp - a.uploadTimestamp);
const plan = (versions, extra = {}) => planRestore(listing(...versions), { at: T, now: T + 3600000, prefix: P, ...extra });

test('forget · prune after T only hid files: the T versions are copied back (never deleted), data first', () => {
  const snap = up('snapshots/aa', T - 5000), pack = up('data/ab/abcd', T - 6000, 4096);
  const p = plan([snap, pack, hide('snapshots/aa', T + 1000), hide('data/ab/abcd', T + 2000)]);
  assert.deepEqual(p.counts, { copy: 2, hide: 0, unchanged: 0 });
  assert.deepEqual(p.items.map((i) => i.rel), ['data/ab/abcd', 'snapshots/aa']);
  assert.equal(p.items[0].sourceFileId, pack.fileId);
  assert.equal(p.copyBytes, 4096 + 10);
});

test('overwrite after T is undone by copying the T version on top', () => {
  const good = up('data/cd/cdef', T - 1000, 2048);
  const p = plan([good, up('data/cd/cdef', T + 500, 7)]);
  assert.deepEqual(p.counts, { copy: 1, hide: 0, unchanged: 0 });
  assert.equal(p.items[0].sourceFileId, good.fileId);
});

test('overwrite then hide after T also copies', () => {
  const good = up('index/11', T - 1000);
  const p = plan([good, up('index/11', T + 10), hide('index/11', T + 20)]);
  assert.equal(p.items[0].type, 'copy');
  assert.equal(p.items[0].sourceFileId, good.fileId);
});

test('files created after T are hidden; new snapshots are hidden before their data', () => {
  const p = plan([up('data/ef/ef01', T + 5), up('snapshots/zz', T + 6), up('index/ix', T + 7)]);
  assert.deepEqual(p.counts, { copy: 0, hide: 3, unchanged: 0 });
  assert.deepEqual(p.items.map((i) => i.rel), ['snapshots/zz', 'index/ix', 'data/ef/ef01']);
});

test('restic lock files are left alone in both directions', () => {
  const p = plan([up('locks/l1', T + 7), up('locks/l0', T - 9), hide('locks/l0', T + 1)]);
  assert.equal(p.items.length, 0);
  assert.deepEqual(p.counts, { copy: 0, hide: 0, unchanged: 0 });
});

test('unchanged and already-gone-before-T files are left alone', () => {
  const p = plan([up('config', T - 100), up('data/00/0000', T - 900), hide('data/00/0000', T - 50)]);
  assert.deepEqual(p.counts, { copy: 0, hide: 0, unchanged: 2 });
});

test('a file hidden before T and re-uploaded after T is hidden again', () => {
  const p = plan([up('keys/k1', T - 900), hide('keys/k1', T - 50), up('keys/k1', T + 50)]);
  assert.equal(p.items[0].type, 'hide');
});

test('version exactly at T counts as before T; large-file starts and folders are ignored', () => {
  const p = plan([up('config', T), { action: 'start', fileName: P + 'data/big', fileId: 'x', uploadTimestamp: T + 1 }, { action: 'folder', fileName: P + 'data/', fileId: null, uploadTimestamp: 0 }]);
  assert.deepEqual(p.counts, { copy: 0, hide: 0, unchanged: 1 });
});

test('rejects times outside 29 days, the future, and names outside the prefix', () => {
  assert.equal(MAX_AGE_MS, 29 * 86400000);
  assert.throws(() => planRestore([], { at: T, now: T + MAX_AGE_MS + 1, prefix: P }), /TOO_OLD/);
  assert.throws(() => planRestore([], { at: T + 10, now: T, prefix: P }), /FUTURE/);
  assert.throws(() => planRestore([{ action: 'upload', fileName: 'c/other/r/config', fileId: 'a', uploadTimestamp: T }], { at: T, now: T + 1, prefix: P }), /OUTSIDE_PREFIX/);
  assert.throws(() => planRestore([], { at: T, now: T + 1, prefix: 'c/x' }), /PREFIX_INVALID/);
});

test('applyPlan only copies and hides (no delete call), re-plans from a fresh listing, and journals results', async () => {
  const calls = [];
  const session = {
    deleteFileVersion: async () => { throw new Error('must not delete'); },
    copyFile: async (a) => { calls.push(['copy', a.sourceFileId]); return { fileId: 'new' + calls.length }; },
    hideFile: async (a) => { calls.push(['hide', a.fileName]); return { fileId: 'hm' + calls.length }; },
  };
  const good = up('data/aa/1', T - 10), cfg = up('config', T - 20);
  const versions = [good, up('data/aa/1', T + 5), cfg, hide('config', T + 30), up('snapshots/new', T + 10)];
  const p = plan(versions);
  // Between preview and run an earlier, stopped run already copied the config back
  // (same SHA-1 and length as the T version), so the fresh plan skips it.
  const fresh = listing(...versions, { ...cfg, fileId: 'copied-before', uploadTimestamp: T + 40 });
  const { plan: used, journal } = await applyPlan(session, { bucketId: 'b', plan: p, freshVersions: fresh, now: T + 3600000 });
  assert.equal(p.items.length, 3);
  assert.equal(used.items.length, 2);
  assert.deepEqual(calls.map((c) => c[0]), ['copy', 'hide']);
  assert.equal(journal.at(-1).type, 'hide');
});

test('an overwrite with different content is not mistaken for a restored copy', () => {
  const good = up('data/77/77', T - 10, 100, 'real');
  const forged = { ...up('data/77/77', T + 5, 100, 'forged') };
  const p = plan([good, forged]);
  assert.equal(p.items[0].type, 'copy');
  const restored = { ...good, fileId: 'copy1', uploadTimestamp: T + 9 };
  assert.equal(plan([good, forged, restored]).items.length, 0);
});
