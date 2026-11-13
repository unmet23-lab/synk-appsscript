'use strict';
// 「지금 상태」 restore (STAGE1_DESIGN.md 4.2): what a partial backup could not read comes from the earlier backups,
// file by file. gatherEarlier decides from listings alone; the real-restic run is in engine.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const { gatherEarlier } = require('../src/engine.cjs');

/** A listing as readManifest gives it: lower-cased keys, `name` as recorded. */
const listing = entries => ({ nodes: new Map(entries.map(([name, type, size = 0]) => [name.toLowerCase(), { name, type, size }])) });
const earlier = (selector, entries, blind = [], cut = false) => ({ selector, at: `${selector}-time`, had: listing(entries), blind: new Set(blind.map(p => p.toLowerCase())), cut });
const names = extra => extra.map(e => `${e.name}@${e.selector}`).sort();

test('a file it could not read comes from the newest earlier backup that has it', () => {
  const r = gatherEarlier(['mail.pst'], listing([['report.txt', 'file', 3]]), [earlier('P1', [['mail.pst', 'file', 9]]), earlier('C', [['mail.pst', 'file', 7]])]);
  assert.deepEqual(r.extra, [{ selector: 'P1', name: 'mail.pst', size: 9, backupAt: 'P1-time' }]);
  assert.deepEqual([r.notFound, r.folders], [[], []]);
});

test('an earlier partial one that could not read it either passes it on to an older one', () => {
  const r = gatherEarlier(['mail.pst'], listing([]), [earlier('P1', [['other.txt', 'file', 1]], ['mail.pst']), earlier('C', [['mail.pst', 'file', 7]])]);
  assert.deepEqual(names(r.extra), ['mail.pst@C']);
});

test('an earlier backup that could read where it would be and lacks it ends the search: in no backup', () => {
  // Made after C and never read: C's older copy of the same name is not brought back.
  const r = gatherEarlier(['new.pst'], listing([]), [earlier('P1', [['a.txt', 'file', 1]]), earlier('C', [['new.pst', 'file', 5]])]);
  assert.deepEqual([r.extra, r.notFound], [[], ['new.pst']]);
  assert.deepEqual(gatherEarlier(['never.pst'], listing([]), [earlier('C', [['a.txt', 'file', 1]])]).notFound, ['never.pst']);
});

// GPT workbackup-nowstate GA2: the newest backup could not read a folder; an earlier partial one lacks some of its files.
test('a folder it could not read is gathered file by file — what one earlier backup lacked comes from an older one', () => {
  const C = earlier('C', [['project', 'dir'], ['project/a.txt', 'file', 1], ['project/b.txt', 'file', 2], ['project/gone.txt', 'file', 3]]);
  const P1 = earlier('P1', [['project', 'dir'], ['project/b.txt', 'file', 20]], ['project/a.txt']);
  const r = gatherEarlier(['project'], listing([]), [P1, C]);
  assert.deepEqual(names(r.extra), ['project/a.txt@C', 'project/b.txt@P1'], 'gone.txt was read away by P1: deleted before it');
  assert.deepEqual([r.folders, r.notFound], [['project'], []]);
});

test('a cut list says nothing about what is missing, so the search goes on', () => {
  const r = gatherEarlier(['new.pst'], listing([]), [earlier('P1', [['a.txt', 'file', 1]], [], true), earlier('C', [['new.pst', 'file', 5]])]);
  assert.deepEqual(names(r.extra), ['new.pst@C']);
});

test('what the newest backup holds is never replaced, and each file is taken once', () => {
  const base = listing([['project', 'dir'], ['project/kept.txt', 'file', 4]]);
  const r = gatherEarlier(['project', 'project/a.txt', 'PROJECT/A.TXT'], base, [earlier('C', [['project', 'dir'], ['project/kept.txt', 'file', 1], ['project/a.txt', 'file', 2]])]);
  assert.deepEqual(names(r.extra), ['project/a.txt@C']);
  assert.deepEqual(gatherEarlier(['kept.txt'], listing([['kept.txt', 'file', 4]]), [earlier('C', [['kept.txt', 'file', 1]])]).extra, []);
});
