'use strict';
// 「지금 상태」 restore (STAGE1_DESIGN.md 4.2): each folder from its own newest backup (restoreBases), and what that
// one could not read from the earlier backups, file by file (gatherEarlier). Both decide from listings alone; the
// real-restic run is in engine.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const { gatherEarlier, restoreBases, lockedVolumes } = require('../src/engine.cjs');

/** A listing as readManifest gives it: lower-cased keys, `name` as recorded. */
const listing = (entries, left = []) => ({ nodes: new Map(entries.map(([name, type, size = 0]) => [name.toLowerCase(), { name, type, size }])), skipped: { count: left.length, list: left.map(([name, kind]) => ({ name, kind })), cut: false } });
const earlier = (selector, entries, blind = [], cut = false) => ({ selector, at: `${selector}-time`, had: listing(entries), blind: new Set(blind.map(p => p.toLowerCase())), cut });
const names = extra => extra.map(e => `${e.name}@${e.selector}`).sort();

test('a file it could not read comes from the newest earlier backup that has it', async () => {
  const r = await gatherEarlier(['mail.pst'], listing([['report.txt', 'file', 3]]), [earlier('P1', [['mail.pst', 'file', 9]]), earlier('C', [['mail.pst', 'file', 7]])]);
  assert.deepEqual(r.extra, [{ selector: 'P1', name: 'mail.pst', size: 9, backupAt: 'P1-time' }]);
  assert.deepEqual([r.notFound, r.folders], [[], []]);
});

test('what an earlier backup left out where it is looked for is said, not taken for 「in no backup」 (GPT workbackup-fill GA2)', async () => {
  const P1 = { ...earlier('P1', []), had: listing([['sub', 'dir'], ['sub/a.txt', 'file', 1]], [['sub/link', 'link'], ['other/far', 'link'], ['shortcut', 'link']]) };
  const r = await gatherEarlier(['sub', 'shortcut'], listing([]), [P1]);
  assert.deepEqual(names(r.extra), ['sub/a.txt@P1']);
  assert.deepEqual(r.skipped, [{ name: 'sub/link', kind: 'link' }, { name: 'shortcut', kind: 'link' }], 'only where it was looked for');
  assert.deepEqual(r.notFound, [], 'a link is left out, not in no backup');
  // A name a newer earlier backup gives back as a file is restored, not left out, though an older one holds a link there.
  const P0 = { ...earlier('P0', []), had: listing([['sub', 'dir'], ['sub/x', 'file', 1]]), blind: new Set(['sub/y']) };
  const C = { ...earlier('C', []), had: listing([['sub', 'dir'], ['sub/y', 'file', 2]], [['sub/x', 'link']]) };
  const both = await gatherEarlier(['sub'], listing([]), [P0, C]);
  assert.deepEqual(names(both.extra), ['sub/x@P0', 'sub/y@C']);
  assert.deepEqual(both.skipped, [], 'sub/x came back from P0');
  // One the newest backup itself has is its own, not counted again.
  const mine = await gatherEarlier(['sub'], listing([['sub/link', 'file', 1]]), [P1]);
  assert.deepEqual(mine.skipped, []);
});

test('an earlier partial one that could not read it either passes it on to an older one', async () => {
  const r = await gatherEarlier(['mail.pst'], listing([]), [earlier('P1', [['other.txt', 'file', 1]], ['mail.pst']), earlier('C', [['mail.pst', 'file', 7]])]);
  assert.deepEqual(names(r.extra), ['mail.pst@C']);
});

test('an earlier backup that could read where it would be and lacks it ends the search: in no backup', async () => {
  // Made after C and never read: C's older copy of the same name is not brought back.
  const r = await gatherEarlier(['new.pst'], listing([]), [earlier('P1', [['a.txt', 'file', 1]]), earlier('C', [['new.pst', 'file', 5]])]);
  assert.deepEqual([r.extra, r.notFound], [[], ['new.pst']]);
  assert.deepEqual((await gatherEarlier(['never.pst'], listing([]), [earlier('C', [['a.txt', 'file', 1]])])).notFound, ['never.pst']);
});

// GPT workbackup-nowstate GA2: the newest backup could not read a folder; an earlier partial one lacks some of its files.
test('a folder it could not read is gathered file by file — what one earlier backup lacked comes from an older one', async () => {
  const C = earlier('C', [['project', 'dir'], ['project/a.txt', 'file', 1], ['project/b.txt', 'file', 2], ['project/gone.txt', 'file', 3]]);
  const P1 = earlier('P1', [['project', 'dir'], ['project/b.txt', 'file', 20]], ['project/a.txt']);
  const r = await gatherEarlier(['project'], listing([]), [P1, C]);
  assert.deepEqual(names(r.extra), ['project/a.txt@C', 'project/b.txt@P1'], 'gone.txt was read away by P1: deleted before it');
  assert.deepEqual([r.folders, r.notFound], [['project'], []]);
});

test('a cut list says nothing about what is missing, so the search goes on', async () => {
  const r = await gatherEarlier(['new.pst'], listing([]), [earlier('P1', [['a.txt', 'file', 1]], [], true), earlier('C', [['new.pst', 'file', 5]])]);
  assert.deepEqual(names(r.extra), ['new.pst@C']);
});

test('what the newest backup holds is never replaced, and each file is taken once', async () => {
  const base = listing([['project', 'dir'], ['project/kept.txt', 'file', 4]]);
  const r = await gatherEarlier(['project', 'project/a.txt', 'PROJECT/A.TXT'], base, [earlier('C', [['project', 'dir'], ['project/kept.txt', 'file', 1], ['project/a.txt', 'file', 2]])]);
  assert.deepEqual(names(r.extra), ['project/a.txt@C']);
  assert.deepEqual((await gatherEarlier(['kept.txt'], listing([['kept.txt', 'file', 4]]), [earlier('C', [['kept.txt', 'file', 1]])])).extra, []);
});

// 끝판 카본 nowstate A4 ①: an old folder of the same name, deleted before an earlier backup that could read there.
test('a name an earlier backup could read and did not have is not an older folder brought back', async () => {
  const r = await gatherEarlier(['foo'], listing([]), [earlier('P1', [['a.txt', 'file', 1]]), earlier('C', [['foo', 'dir'], ['foo/x.txt', 'file', 2]])]);
  assert.deepEqual([r.extra, r.folders, r.notFound], [[], [], ['foo']]);
});

// 끝판 카본 nowstate A4 ②: a folder became a file — no path under a file is taken.
test('a path under a file is left out: the file wins, the restore can write it', async () => {
  const P1 = earlier('P1', [['a', 'dir'], ['a/b', 'file', 5]], [], true);
  const C = earlier('C', [['a', 'dir'], ['a/b', 'dir'], ['a/b/old.txt', 'file', 3]]);
  assert.deepEqual(names((await gatherEarlier(['a'], listing([]), [P1, C])).extra), ['a/b@P1']);
  const base = listing([['a', 'dir'], ['a/b', 'file', 5]]);
  assert.deepEqual((await gatherEarlier(['a/b/old.txt'], base, [C])).extra, [], 'under a file the newest backup holds');
});

// 끝판 카본 nowstate A1: listings are read only as far as needed.
test('an earlier listing is read only when needed, and a folder stops at the first backup that read all of it', async () => {
  let loaded = 0;
  const lazy = (selector, entries, blind = []) => ({ selector, at: selector, blind: new Set(blind), cut: false, load: async () => { loaded++; return listing(entries); } });
  await gatherEarlier([], listing([]), [lazy('C', [['a.txt', 'file', 1]])]);
  assert.equal(loaded, 0, 'nothing wanted: nothing listed');
  const r = await gatherEarlier(['project'], listing([]), [lazy('P1', [['project', 'dir'], ['project/a.txt', 'file', 1]]), lazy('C', [['project', 'dir'], ['project/old.txt', 'file', 1]])]);
  assert.equal(loaded, 1, 'P1 read all of project: C is not listed');
  assert.deepEqual(names(r.extra), ['project/a.txt@P1']);
});

// restoreBases — the backup each folder comes from.
const snap = (id, time, paths, tags = []) => ({ id, time: new Date(Date.UTC(2026, 10, 14, time)).toISOString(), paths, tags });
const lists = map => async s => map[s.id] ?? { v: 1, unreadable: [], cut: false };
const bases = sets => sets.map(s => `${s.original}<-${s.snapshot.id}${s.cut ? ' cut' : ''}`);

test('each folder from its newest backup: a newer partial one over the complete one', async () => {
  const C = snap('C', 1, ['D:\\A', 'D:\\B'], ['complete-structure-checked']);
  const P = snap('P', 3, ['D:\\A', 'D:\\B'], ['partial']);
  assert.deepEqual(bases(await restoreBases(C, [C], [P], lists({}))), ['D:\\A<-P', 'D:\\B<-P']);
  // A cut list leaves the complete one; a list that says the folder itself could not be read, too (끝판 A3).
  assert.deepEqual(bases(await restoreBases(C, [C], [P], lists({ P: { v: 1, unreadable: [], cut: true } }))), ['D:\\A<-C', 'D:\\B<-C']);
  assert.deepEqual(bases(await restoreBases(C, [C], [P], lists({ P: { v: 1, unreadable: ['D:\\B'], cut: false } }))), ['D:\\A<-P', 'D:\\B<-C']);
});

// 끝판 카본 nowstate A2 ① · GPT GA1: a folder only a partial backup holds, after a newer backup without it.
test('a folder no complete backup holds comes from the newest partial one that does, whatever came after', async () => {
  const C1 = snap('C1', 1, ['D:\\A'], ['complete-structure-checked']);
  const P1 = snap('P1', 2, ['D:\\A', 'E:\\B'], ['partial']);
  const C2 = snap('C2', 3, ['D:\\A'], ['complete-structure-checked']);
  const P2 = snap('P2', 4, ['D:\\A'], ['partial']);
  assert.deepEqual(bases(await restoreBases(C2, [C2, C1], [P2, P1], lists({}))), ['D:\\A<-P2', 'E:\\B<-P1']);
  // Its list is cut: still the only one, and told as such.
  assert.deepEqual(bases(await restoreBases(C2, [C2, C1], [P2, P1], lists({ P1: { v: 1, unreadable: [], cut: true } }))), ['D:\\A<-P2', 'E:\\B<-P1 cut']);
});

// 끝판 카본 nowstate A2 ②: a folder with newer content in a partial backup, then taken away.
test('a folder taken away comes from its newest backup — a partial one newer than its complete one', async () => {
  const C1 = snap('C1', 1, ['D:\\A', 'E:\\B'], ['complete-structure-checked']);
  const P1 = snap('P1', 2, ['D:\\A', 'E:\\B'], ['partial']);
  const C2 = snap('C2', 3, ['D:\\A'], ['complete-structure-checked']);
  assert.deepEqual(bases(await restoreBases(C2, [C2, C1], [P1], lists({}))), ['D:\\A<-C2', 'E:\\B<-P1']);
});

test('a fill is asked only for the drives a file another program holds is on (4.2 step 8 · 9)', async t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-locked-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const free = path.join(root, 'free.txt'); fs.writeFileSync(free, 'readable again');
  // Free again, gone, a folder, not a drive path: none needs a shadow copy (the next backup takes what is free again).
  assert.deepEqual(await lockedVolumes([free, path.join(root, 'gone.txt'), root, 'relative\\x', null, 7]), []);
  if (process.platform !== 'win32') return;
  // Held without sharing (Windows sharing violation 32 — EBUSY in Node): its drive is asked for, once.
  const held = path.join(root, 'held.pst'); fs.writeFileSync(held, 'held');
  const { spawn } = require('node:child_process');
  const holder = spawn('powershell.exe', ['-NoProfile', '-Command', "$f=[IO.File]::Open('" + held + "','Open','ReadWrite','None'); 'held'; [Console]::In.ReadLine() | Out-Null; $f.Close()"], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  await new Promise(ok => holder.stdout.once('data', ok));
  try { assert.deepEqual(await lockedVolumes([free, held, held]), [held.slice(0, 2).toUpperCase()]); }
  finally { holder.stdin.end('\n'); await new Promise(ok => holder.once('exit', ok)); }
  assert.deepEqual(await lockedVolumes([held]), [], 'closed again: no copy needed');
});
