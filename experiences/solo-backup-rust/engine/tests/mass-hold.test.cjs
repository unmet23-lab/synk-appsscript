'use strict';
// 대량 삭제 · 변경 멈춤 (STAGE1_DESIGN.md 4.4) with a fake restic: every backup a clean-up would forget is compared with the
// newest complete one first, the thresholds over the folders both hold, what is not counted (a file still on the disk),
// the hold that keeps every backup until the person answers, and what ends it. The real `restic diff` is in engine.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { BackupEngine, APP, VERIFIED } = require('../src/engine.cjs');
const { protection } = require('../src/protection.cjs');

const HOUR = 3600000, DAY = 24 * HOUR;
const id = c => c.repeat(64);
// A backup folder as restic names it in a backup (`/C/…`).
const treeOf = original => '/' + original.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/').replace(/\/+$/, '');
const many = (n, folder, modifier, prefix = 'f') => Array.from({ length: n }, (_, i) => [`${treeOf(folder)}/${prefix}${i}.txt`, modifier]);
const fileNodes = n => Array.from({ length: n }, (_, i) => ({ message_type: 'node', path: `/n${i}`, type: 'file', size: 10 }));
// The drive the test folders are on, as a fill's link root names it: D: on the GitHub Windows runner.
const DRIVE = os.tmpdir().slice(0, 2).toUpperCase();
// The engine tells backups and the disk apart by Windows paths (drive letters, `path.win32`, junctions): off Windows
// these tests mean nothing, so they skip there and run on the GitHub Windows host (tools/conditional-qa S157 ~ S207).
const windowsPaths = process.platform !== 'win32' && 'Windows 경로 규칙을 보는 시험 — GitHub Windows에서 돈다(tools/conditional-qa)';
// A test that walks many cases, each with its own fixture, takes a minute or more on a busy PC: past the two or three
// minutes a test is given by default (tools/관련시험.js, tools/conditional-qa), it is given ten.
const LONG = 10 * 60 * 1000;

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mass-hold-'));
  for (const dir of ['repo', 'output', 'docs']) await fs.mkdir(path.join(root, dir));
  // `docs` is a real folder, so a file the diff calls gone can be found still on the disk; `pics` is a drive not here.
  const vaultId = crypto.randomUUID(), docs = path.join(root, 'docs'), pics = 'Q:\\pictures';
  let now = Date.parse('2026-11-20T12:00:00Z');
  const fake = { snapshots: [], diffs: [], diff: null, ls: {}, dumps: {}, calls: [], missing: new Set(), fileAt: new Set() };
  fake.snap = (c, hoursAgo, { tags = [VERIFIED], paths = [docs, pics], files = 1000, bytes = 10 * 1024 ** 3 } = {}) => {
    const s = { id: id(c), time: new Date(now - hoursAgo * HOUR).toISOString(), hostname: vaultId, paths, tags: [APP, 'vault:' + vaultId, ...tags], summary: { total_files_processed: files, total_bytes_processed: bytes } };
    fake.snapshots.push(s); fake.snapshots.sort((a, b) => Date.parse(b.time) - Date.parse(a.time)); return s;
  };
  const runner = async (args, opts) => {
    fake.calls.push(args);
    if (args[0] === 'cat' && args[1] === 'config') return JSON.stringify({ id: id('b') });
    if (args[0] === 'list') return '';
    if (args[0] === 'snapshots') return JSON.stringify(fake.snapshots);
    if (args[0] === 'forget') { for (const gone of args.slice(1)) fake.snapshots.splice(fake.snapshots.findIndex(s => s.id === gone), 1); return ''; }
    if (args[0] === 'prune') return '';
    if (args[0] === 'diff') {
      const [a, b] = [args[2], args[3]]; fake.diffs.push([a, b]);
      // `fake.diff` is the answer, or a function of the pair compared that gives it.
      const spec = typeof fake.diff === 'function' ? fake.diff(a, b) : fake.diff;
      if (spec instanceof Error) throw spec;
      const { lines = [], bytes = 0, stats = true, files, others = 0 } = spec || {};
      // A part (`id:/tree`): only the lines under it, as paths inside it.
      const part = a.includes(':') ? a.slice(65) : null;
      const shown = part ? lines.filter(([p]) => p.toLowerCase().startsWith(part.toLowerCase() + '/')).map(([p, m]) => [p.slice(part.length), m]) : lines;
      // restic counts each `-` that is no folder as a file removed, unless told otherwise; `others` counts what is neither (a link).
      const removedFiles = files ?? shown.filter(([p, m]) => m === '-' && !p.endsWith('/')).length;
      const rows = [...shown.map(([p, modifier]) => ({ message_type: 'change', path: p, modifier })),
        ...(stats ? [{ message_type: 'statistics', changed_files: 0, added: { files: 0, bytes: 0 }, removed: { files: removedFiles, dirs: 0, others, bytes: part ? 0 : bytes } }] : [])];
      await opts.consumeStdout(Readable.from([Buffer.from(rows.map(r => JSON.stringify(r)).join('\n'))])); return '';
    }
    if (args[0] === 'ls') {
      if (fake.warns && opts.stderrFails) throw new Error('백업을 비교하는 중 오류가 있었습니다.');
      // Without --recursive, for a backup by id: which of the paths (backup folders) it holds, as restic answers — a folder
      // it names among its paths, unless `fake.missing` (`id:path`) says its tree lacks it.
      if (!args.includes('--recursive') && /^[a-f0-9]{64}$/.test(args[2])) {
        const snap = fake.snapshots.find(x => x.id === args[2]);
        // A fill's folder through its link root is one the test listed something under (`fake.ls`), a file when `fake.fileAt` says so.
        const listed = P => Object.keys(fake.ls).includes(`${args[2]}:${P}`);
        const nodes = args.slice(3).filter(P => snap && ((snap.paths || []).some(p => treeOf(p) === P) || listed(P)) && !fake.missing.has(`${args[2]}:${P}`)).map(P => ({ message_type: 'node', path: P, type: fake.fileAt.has(`${args[2]}:${P}`) ? 'file' : 'dir' }));
        await opts.consumeStdout(Readable.from([Buffer.from([{ message_type: 'snapshot', id: args[2] }, ...nodes].map(x => JSON.stringify(x)).join('\n'))])); return '';
      }
      // `ls <selector>` lists `fake.ls[selector]`. `ls <id> <path…>` is restic's path filter: what is under each path, a
      // path the backup lacks giving nothing — from the keys `id:path`, whose nodes have paths inside that path.
      const [at, ...paths] = args.slice(3);
      if (fake.lsFail?.(paths.length ? `${at}:${paths[0]}` : at)) throw new Error('tree could not be loaded');
      const nodes = !paths.length ? fake.ls[at] || [] : paths.flatMap(P => Object.entries(fake.ls).flatMap(([k, ns]) => {
        if (!k.startsWith(at + ':')) return [];
        const K = k.slice(at.length + 1);
        return P === K || P.startsWith(K + '/') ? ns.map(n => ({ ...n, path: K + n.path })).filter(n => n.path === P || n.path.startsWith(P + '/')) : [];
      }));
      await opts.consumeStdout(Readable.from([Buffer.from([{ message_type: 'snapshot', id: at.slice(0, 64) }, ...nodes].map(x => JSON.stringify(x)).join('\n'))])); return '';
    }
    if (args[0] === 'dump') { await opts.consumeStdout(Readable.from([fake.dumps[args[1]] || Buffer.alloc(1024)])); return ''; }
    if (args[0] === 'backup') throw new Error('no backup in this fixture');
    throw new Error('Unexpected command ' + args[0]);
  };
  const make = () => new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'unused', runner, now: () => now, secretStore: { encrypt: x => Buffer.from(x), decrypt: x => x.toString() } });
  const engine = make();
  await engine.open();
  engine.config = { schema: 1, mode: 'backup', vaultId, repositoryId: id('b'), repository: path.join(root, 'repo'), sources: [docs, pics], automatic: true, health: { status: 'ok' }, recoverySaved: true };
  engine.secret = 'a'.repeat(43);
  // So the app can open these settings again (secretStore keeps the text as it is).
  await fs.writeFile(path.join(root, 'state', 'credential.bin'), engine.secret);
  // This device's newest complete backup is `latest` (retain checks it against lastBackup).
  const latest = s => { engine.config.lastBackup = { id: s.id, at: s.time, files: s.summary.total_files_processed, bytes: s.summary.total_bytes_processed }; };
  const forgot = () => fake.calls.filter(a => a[0] === 'forget').flatMap(a => a.slice(1));
  return { root, engine, fake, docs, pics, latest, forgot, make, advance: ms => { now += ms; }, now: () => now };
}

test('every backup a clean-up would forget is compared with the newest complete one first, oldest first, a few a run (Fable 2)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  const old = fake.snap('1', 50), mid = fake.snap('2', 30), last = fake.snap('3', 0);
  f.latest(last);
  fake.diff = { lines: many(199, docs, '-') };
  await engine.retain();
  assert.deepEqual(fake.diffs, [[old.id, last.id], [mid.id, last.id]], 'below the thresholds both are compared, then go');
  assert.deepEqual(f.forgot().sort(), [old.id, mid.id].sort());
  assert.equal(engine.config.massHold ?? null, null);
  // Seven going: the six oldest are compared this run and go; the newest waits for the next run, and is compared then.
  const g = await fixture();
  const going = '456789a'.split('').map((c, i) => g.fake.snap(c, 30 + i)); const now = g.fake.snap('f', 0); g.latest(now);
  await g.engine.retain();
  assert.equal(g.fake.diffs.length, 6);
  assert.deepEqual(g.forgot().sort(), going.slice(1).map(s => s.id).sort());
  await g.engine.retain();
  assert.deepEqual(g.fake.diffs.at(-1), [going[0].id, now.id]);
  // The one waiting is a partial backup with its list and a fill (and the fill's list): they wait with it (r2 GA1).
  const h = await fixture();
  const run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  const ready = '456789'.split('').map((c, i) => h.fake.snap(c, 30 + i));
  const partial = h.fake.snap('a', 29, { tags: ['partial', 'run:' + run] }), list = h.fake.snap('b', 29, { tags: ['meta', 'run:' + run] });
  const fill = h.fake.snap('c', 28.5, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), fillList = h.fake.snap('d', 28.5, { tags: ['meta', 'run:' + fillRun] });
  h.latest(h.fake.snap('f', 0));
  await h.engine.retain();
  assert.deepEqual(h.forgot().sort(), ready.map(s => s.id).sort(), 'the six compared go; the partial one and what it carries wait');
  for (const s of [partial, list, fill, fillList]) assert.ok(h.fake.snapshots.some(x => x.id === s.id));
});

test('a partial backup newer than the complete one is the one compared with: a file updated in one going and gone since is gone (r2 GA7)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  const run = crypto.randomUUID();
  const complete = fake.snap('1', 50, { files: 600 }), middle = fake.snap('2', 30, { files: 600, tags: ['partial'] }), newest = fake.snap('3', 1, { files: 350, tags: ['partial', 'run:' + run] });
  const list = fake.snap('4', 1, { tags: ['meta', 'run:' + run] }); fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [], cut: false }));
  f.latest(complete);
  fake.diff = { lines: many(250, docs, '-') };
  await engine.retain();
  assert.deepEqual(fake.diffs, [[middle.id, newest.id]]);
  const h = engine.config.massHold;
  assert.deepEqual([h.kind, h.removed, h.beforeId, h.afterId, h.at], ['removed', 250, middle.id, newest.id, newest.time]);
  // Without its list it is not known what it read: the complete one is compared with (Fable 후속).
  const g = await fixture();
  const c2 = g.fake.snap('1', 50, { files: 600 }), m2 = g.fake.snap('2', 30, { files: 600, tags: ['partial'] }); g.fake.snap('3', 1, { files: 350, tags: ['partial'] });
  g.latest(c2);
  await g.engine.retain();
  assert.deepEqual(g.fake.diffs, [[m2.id, c2.id]]);
});

test('past a threshold the clean-up holds every backup; files gone, files changed and bytes gone each count (4.4 처음 문턱)', { skip: windowsPaths }, async () => {
  for (const kind of ['removed', 'changed', 'bytes']) {
    const f = await fixture(), { engine, fake, docs, pics } = f;
    const before = fake.snap('1', 30), last = fake.snap('2', 0);
    f.latest(last);
    const lines = kind === 'removed' ? many(300, docs, '-') : kind === 'changed' ? many(500, docs, 'M') : many(10, docs, '-');
    fake.diff = { lines: [...lines, [`${treeOf(docs)}/보고서/`, '-'], [`${treeOf(pics)}/p.jpg`, 'M'], ['/elsewhere/x', '-']], bytes: kind === 'bytes' ? 3 * 1024 ** 3 + 1 : 0 };
    fake.ls[`${last.id}:${treeOf(docs)}`] = fileNodes(2);
    // The bytes are the sizes the backup before had for the files gone: ten of 400 MiB, 3.9 GiB of 10.
    if (kind === 'bytes') fake.ls[`${before.id}:${treeOf(docs)}`] = Array.from({ length: 10 }, (_, i) => ({ message_type: 'node', path: `/f${i}.txt`, type: 'file', size: 400 * 1024 ** 2 }));
    await engine.retain();
    assert.deepEqual(f.forgot(), [], kind);
    const h = engine.config.massHold;
    assert.equal(h.kind, kind);
    assert.deepEqual([h.beforeId, h.afterId, h.before, h.totalNow, h.path, h.left], [before.id, last.id, 1000, 1000, docs, 2], kind);
    const n = kind === 'changed' ? 500 : kind === 'removed' ? 300 : 10;
    assert.deepEqual(h.folders, [{ path: docs, removed: kind === 'changed' ? 0 : n, changed: kind === 'changed' ? n : 0 }, { path: pics, removed: 0, changed: 1 }], 'a folder line is told by its files; a path outside the backup is not counted');
    assert.deepEqual(h.list[0], { folder: docs, name: 'f0.txt', kind: kind === 'changed' ? 'changed' : 'removed' });
    // While it waits, nothing is compared or forgotten, however old.
    f.advance(5 * DAY); const more = fake.snap('3', 0); f.latest(more);
    const compared = fake.diffs.length;
    await engine.retain();
    assert.deepEqual([fake.diffs.length, f.forgot()], [compared, []], kind);
    // The window shows it, and protection asks for the person (topic 「changes」 for 솔리오).
    assert.deepEqual(engine.getState().massHold, h);
    assert.equal(protection({ ...engine.getState(), configured: true, recoverySaved: true }, { now: f.now(), startupRegistered: true }).reason, 'mass');
  }
});

test('shares count against the files the backup before had: 299 of 1000 gone, or half less one changed, is no hold', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  fake.snap('1', 30, { files: 1000 }); const last = fake.snap('2', 0, { files: 800 }); f.latest(last);
  fake.diff = { lines: many(299, docs, '-') };
  await engine.retain();
  assert.equal(engine.config.massHold ?? null, null, '299 of 1000 is under 30 %');
  const g = await fixture();
  g.fake.snap('1', 30, { files: 2000 }); const changed = g.fake.snap('2', 0, { files: 2000 }); g.latest(changed);
  g.fake.diff = { lines: many(999, g.docs, 'M'), bytes: 1024 ** 3 };
  await g.engine.retain();
  assert.equal(g.engine.config.massHold ?? null, null, 'changed under half; bytes told only with a file gone');
});

test('copies of one content gone count the sizes they had, though restic removes no bytes for them (GPT GA4 · r2 GA5)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3;
  const copies = n => Array.from({ length: n }, (_, i) => ({ message_type: 'node', path: `/f${i}.txt`, type: 'file', size: 2 * GiB }));
  // Ten copies of one 2 GiB file, six gone and 12 GiB of new files since: restic removes no blob (four copies hold it) and
  // the backups are as big as before, but the files gone had 12 GiB of 20.
  const f = await fixture(), { engine, fake, docs } = f;
  const before = fake.snap('1', 30, { bytes: 20 * GiB }), last = fake.snap('2', 0, { bytes: 20 * GiB }); f.latest(last);
  fake.diff = { lines: [...many(6, docs, '-'), ...many(6, docs, '+', 'new')], bytes: 0 };
  fake.ls[`${before.id}:${treeOf(docs)}`] = copies(10);
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removedBytes], ['bytes', 12 * GiB]);
  assert.deepEqual(f.forgot(), []);
  // Six still on the disk (taken out of the backup, or ones restic could not read) are not counted, so not summed: one 2 GiB
  // file gone of 20 is under 30 %.
  const g = await fixture();
  const b2 = g.fake.snap('1', 30, { bytes: 20 * GiB }), l2 = g.fake.snap('2', 0, { bytes: 6 * GiB }); g.latest(l2);
  for (let i = 0; i < 6; i++) await fs.writeFile(path.join(g.docs, `f${i}.txt`), '');
  g.fake.diff = { lines: [...many(6, g.docs, '-'), [`${treeOf(g.docs)}/f9.txt`, '-']], bytes: 0 };
  g.fake.ls[`${b2.id}:${treeOf(g.docs)}`] = copies(10);
  await g.engine.retain();
  assert.equal(g.engine.config.massHold ?? null, null);
  // A backup under 1 GiB in all cannot reach the byte threshold: it is not listed.
  const h = await fixture();
  const b3 = h.fake.snap('1', 30, { bytes: 900 * 1024 ** 2 }), l3 = h.fake.snap('2', 0, { bytes: 800 * 1024 ** 2 }); h.latest(l3);
  h.fake.diff = { lines: many(6, h.docs, '-') };
  await h.engine.retain();
  assert.equal(h.engine.config.massHold ?? null, null);
  assert.ok(!h.fake.calls.some(a => a[0] === 'ls' && a.at(-1) === `${b3.id}:${treeOf(h.docs)}`));
});

test('what is neither file nor folder is no file gone: the backup before tells which, and the lines are read again without them (r2 GA3 · r3 GA1 · GA3 · GA4)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3;
  const node = (p, type = 'file', size = 1) => ({ message_type: 'node', path: p, type, size });
  // 200 links gone: no hold.
  const f = await fixture(), { engine, fake, docs } = f;
  const before = fake.snap('1', 30, { files: 400 }), last = fake.snap('2', 0, { files: 400 }); f.latest(last);
  fake.ls[`${before.id}:${treeOf(docs)}`] = Array.from({ length: 200 }, (_, i) => node(`/link${i}.txt`, 'symlink', 0));
  fake.diff = { lines: many(200, docs, '-', 'link'), files: 0, others: 200 };
  await engine.retain();
  assert.deepEqual([engine.config.massHold ?? null, f.forgot()], [null, [before.id]]);
  // 200 links gone and 200 files turned online-only (still on the disk): no hold (r3 GA3).
  const g = await fixture();
  const b2 = g.fake.snap('1', 30, { files: 400 }), l2 = g.fake.snap('2', 0, { files: 200 }); g.latest(l2);
  for (let i = 0; i < 200; i++) await fs.writeFile(path.join(g.docs, `f${i}.txt`), '');
  g.fake.ls[`${b2.id}:${treeOf(g.docs)}`] = Array.from({ length: 200 }, (_, i) => node(`/link${i}.txt`, 'symlink', 0));
  g.fake.diff = { lines: [...many(200, g.docs, '-', 'link'), ...many(200, g.docs, '-')], files: 200, others: 200 };
  await g.engine.retain();
  assert.deepEqual([g.engine.config.massHold ?? null, g.forgot()], [null, [b2.id]]);
  // Two links and 198 one-byte files gone first, a 4 GiB file gone last, of 10 GiB: the big file is counted (r3 GA1).
  const h = await fixture();
  const b3 = h.fake.snap('1', 30, { files: 600 }), l3 = h.fake.snap('2', 0, { files: 400 }); h.latest(l3);
  h.fake.ls[`${b3.id}:${treeOf(h.docs)}`] = [node('/link0.txt', 'symlink', 0), node('/link1.txt', 'symlink', 0), ...Array.from({ length: 198 }, (_, i) => node(`/f${i}.txt`)), node('/big.iso', 'file', 4 * GiB)];
  h.fake.diff = { lines: [...many(2, h.docs, '-', 'link'), ...many(198, h.docs, '-'), [`${treeOf(h.docs)}/big.iso`, '-']], files: 199, others: 2 };
  await h.engine.retain();
  const held = h.engine.config.massHold;
  assert.deepEqual([held?.kind, held?.removed, held?.removedBytes], ['bytes', 199, 4 * GiB + 198]);
  // 199 files and a link gone, then a file still on the disk: 199 is under 200, no hold (r3 GA4).
  const k = await fixture();
  const b4 = k.fake.snap('1', 30, { files: 600, bytes: 100 * 1024 ** 2 }), l4 = k.fake.snap('2', 0, { files: 401 }); k.latest(l4);
  await fs.writeFile(path.join(k.docs, 'held.txt'), '');
  k.fake.ls[`${b4.id}:${treeOf(k.docs)}`] = [node('/link0.txt', 'symlink', 0), ...Array.from({ length: 199 }, (_, i) => node(`/f${i}.txt`)), node('/held.txt')];
  k.fake.diff = { lines: [...many(199, k.docs, '-'), ...many(1, k.docs, '-', 'link'), [`${treeOf(k.docs)}/held.txt`, '-']], files: 200, others: 1 };
  await k.engine.retain();
  assert.deepEqual([k.engine.config.massHold ?? null, k.forgot()], [null, [b4.id]]);
});

test('the newest backup going is compared with the newest that stays, and once confirmed goes without (r3 GA2)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  // No backup for a day: the complete one stays, the newer partial one goes — 250 files only it held are gone from the disk.
  const complete = fake.snap('1', 50, { files: 600 }), partial = fake.snap('2', 25, { files: 600, tags: ['partial'] });
  f.latest(complete);
  fake.diff = { lines: many(250, docs, '-') };
  await engine.retain();
  assert.deepEqual([fake.diffs, f.forgot()], [[[partial.id, complete.id]], []]);
  const h = engine.config.massHold;
  assert.deepEqual([h.kind, h.beforeId, h.afterId, h.at], ['removed', partial.id, complete.id, complete.time]);
  // 「확인을 마침」: the partial one the hold kept goes without being compared again.
  await engine.massConfirm();
  const covered = { folders: [docs, f.pics].map(p => ({ path: p, from: partial.time, to: complete.time })) };
  assert.deepEqual(engine.config.massCheck, covered);
  const again = f.make(); await again.open();
  assert.deepEqual(again.config.massCheck, covered);
  await engine.retain();
  assert.deepEqual([fake.diffs.length, f.forgot()], [1, [partial.id]]);
});

test('a file the diff calls gone but still on the disk is not gone: a OneDrive placeholder, a file a program held (GPT GA9 · GA7)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  fake.snap('1', 30, { files: 500 }); const last = fake.snap('2', 0, { files: 500, tags: [VERIFIED, 'partial'] }); f.latest(last);
  for (let i = 0; i < 300; i++) await fs.writeFile(path.join(docs, `f${i}.txt`), '');
  fake.diff = { lines: many(300, docs, '-') };
  await engine.retain();
  assert.equal(engine.config.massHold ?? null, null, 'all 300 are still there');
  // Gone from the disk too: a hold, though the newest backup is a partial one.
  for (let i = 0; i < 300; i++) await fs.rm(path.join(docs, `f${i}.txt`));
  f.advance(HOUR); fake.snap('3', 26, { files: 500 });
  await engine.retain();
  assert.equal(engine.config.massHold?.removed, 300);
  // 4 GiB of 10 gone from the backup but on the disk — restic tells their bytes removed — and one small file gone besides:
  // no hold, the bytes are those of the file gone (r2 GA9).
  const g = await fixture();
  const b = g.fake.snap('1', 30, { files: 500 }), l = g.fake.snap('2', 0, { files: 495 }); g.latest(l);
  for (let i = 0; i < 4; i++) await fs.writeFile(path.join(g.docs, `f${i}.txt`), '');
  g.fake.diff = { lines: many(5, g.docs, '-'), bytes: 4 * 1024 ** 3 };
  g.fake.ls[`${b.id}:${treeOf(g.docs)}`] = [...Array.from({ length: 4 }, (_, i) => ({ message_type: 'node', path: `/f${i}.txt`, type: 'file', size: 1024 ** 3 })), { message_type: 'node', path: '/f4.txt', type: 'file', size: 10 }];
  await g.engine.retain();
  assert.deepEqual([g.engine.config.massHold ?? null, g.forgot()], [null, [b.id]]);
});

test('each folder is compared with the newest backup that stays and has it: an unplugged drive with the one kept for it, a folder none has not at all (GPT GA2 · Fable 1)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  // The newest has docs only (pics not found); the newest with pics stays for it (retain). The one before goes: docs is
  // compared with the newest, pics with the one kept for it, where nothing changed.
  const before = fake.snap('1', 40), withPics = fake.snap('4', 30), last = fake.snap('2', 0, { paths: [docs], files: 600 }); f.latest(last);
  fake.diff = (a, b) => ({ lines: b.startsWith(withPics.id) ? [] : many(300, docs, '-') });
  await engine.retain();
  assert.ok(!f.forgot().includes(withPics.id), 'kept for the folder not found');
  assert.deepEqual(fake.diffs, [[before.id, last.id], [before.id, withPics.id]], 'whole backups, each with the folders it is compared for');
  let h = engine.config.massHold;
  assert.deepEqual([h.removed, h.before, h.folders], [300, 1000, [{ path: docs, removed: 300, changed: 0 }]]);
  // Half of pics gone after the backup before, the drive unplugged since: seen against the one kept for it (Fable 1).
  const g = await fixture();
  const b2 = g.fake.snap('1', 40), kept = g.fake.snap('4', 30), l2 = g.fake.snap('2', 0, { paths: [g.docs] }); g.latest(l2);
  g.fake.diff = (a, b) => ({ lines: b.startsWith(kept.id) ? many(300, g.pics, '-', 'p') : [] });
  await g.engine.retain();
  h = g.engine.config.massHold;
  assert.deepEqual([h?.kind, h?.removed, h?.path, h?.beforeId], ['removed', 300, g.pics, b2.id]);
  // A folder no backup that stays has (not chosen any more) is neither gone nor new, nor in the share.
  const k = await fixture();
  k.engine.config.sources = [k.docs];
  const b3 = k.fake.snap('1', 30), l3 = k.fake.snap('2', 0, { paths: [k.docs], files: 300 }); k.latest(l3);
  k.fake.ls[`${b3.id}:${treeOf(k.pics)}`] = fileNodes(400);
  k.fake.diff = { lines: many(300, k.docs, '-') };
  await k.engine.retain();
  assert.deepEqual(k.fake.diffs, [[b3.id, l3.id]]);
  h = k.engine.config.massHold;
  assert.deepEqual([h.removed, h.before, h.folders], [300, 600, [{ path: k.docs, removed: 300, changed: 0 }]]);
});

test('a partial backup\'s fill is compared too: a file only it held, gone from the disk, counts (Fable 3)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link';
  const setup = async () => {
    const x = await fixture(), run = crypto.randomUUID(), fillRun = crypto.randomUUID();
    const partial = x.fake.snap('1', 30, { tags: ['partial', 'run:' + run] }); x.fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
    const fill = x.fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), fillList = x.fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
    x.latest(x.fake.snap('5', 0));
    // The fill read, through a link root on C:, the Outlook file the partial one could not.
    x.fake.dumps[fillList.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(x.docs, 'outlook.pst')], failed: [], cut: false }));
    const inFill = treeOf(root + x.docs.slice(2));
    x.fake.ls[`${fill.id}:${inFill}`] = [{ message_type: 'node', path: '/outlook.pst', type: 'file', size: 5 * GiB }];
    x.fake.diff = { lines: [[`${inFill}/outlook.pst`, '-']] };
    return { ...x, partial, fill, inFill };
  };
  const f = await setup();
  await f.engine.retain();
  assert.ok(f.fake.calls.some(a => a[0] === 'ls' && a[3] === f.fill.id), 'the fill is listed');
  const h = f.engine.config.massHold;
  // A hold is told of the exact count: the tree's 1000 and the one file only the fill held (r9 GA2).
  assert.deepEqual([h?.kind, h?.removed, h?.removedBytes, h?.before, h?.beforeId, h?.folders], ['bytes', 1, 5 * GiB, 1001, f.partial.id, [{ path: f.docs, removed: 1, changed: 0 }]]);
  assert.deepEqual(f.forgot(), []);
  // Still on the disk: not gone.
  const g = await setup();
  await fs.writeFile(path.join(g.docs, 'outlook.pst'), '');
  await g.engine.retain();
  assert.equal(g.engine.config.massHold ?? null, null);
  // A folder of that name there now holds no such file: gone (r5 GA3) — nor a junction to a folder (r6 GA6).
  const k = await setup();
  await fs.mkdir(path.join(k.docs, 'outlook.pst'));
  await k.engine.retain();
  assert.equal(k.engine.config.massHold?.removedBytes, 5 * GiB);
  const j = await setup();
  await fs.symlink(path.join(j.root, 'output'), path.join(j.docs, 'outlook.pst'), 'junction');
  await j.engine.retain();
  assert.equal(j.engine.config.massHold?.removedBytes, 5 * GiB);
});

test('「확인을 마침」 covers each folder only between the backups it was compared in: another folder of a backup in that time is still compared (r4 GA1)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  // B had pics only; pics is kept in K (the newest has no pics). Y had both; P, a partial one, docs only.
  const B = fake.snap('1', 55, { paths: [pics] }), Y = fake.snap('2', 45), K = fake.snap('3', 32), P = fake.snap('4', 27, { files: 600, paths: [docs], tags: ['partial'] }), N = fake.snap('5', 0, { paths: [docs] });
  f.latest(N);
  fake.diff = (a, b) => ({ lines: b === K.id && a === B.id ? many(300, pics, '-', 'p') : a === P.id ? many(250, docs, '-') : [] });
  await engine.retain();
  assert.deepEqual([fake.diffs, engine.config.massHold?.beforeId, engine.config.massHold?.compared], [[[B.id, K.id]], B.id, [{ path: pics, at: K.time }]]);
  await engine.massConfirm();
  assert.deepEqual(engine.config.massCheck, { folders: [{ path: pics, from: B.time, to: K.time }] });
  // Y's pics is covered, its docs not: docs alone is compared. P's docs is compared, and 250 only it held are gone.
  await engine.retain();
  assert.deepEqual(fake.diffs.slice(1), [[Y.id, N.id], [P.id, N.id]]);
  assert.deepEqual([engine.config.massHold?.beforeId, engine.config.massHold?.removed], [P.id, 250]);
});

test('「확인을 마침」 covers a folder as it was spelled: one spelled otherwise may be another folder, and is compared (설계 검토 기록10)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  // The person confirmed DOCS between these times; B holds docs, which a parent that tells case apart may hold as well.
  const B = fake.snap('1', 30, { paths: [docs] }), N = fake.snap('2', 0, { paths: [docs] });
  f.latest(N);
  engine.config.massCheck = { folders: [{ path: docs.toUpperCase(), from: new Date(Date.parse(B.time) - HOUR).toISOString(), to: N.time }] };
  fake.diff = { lines: many(300, docs, '-') };
  await engine.retain();
  assert.deepEqual(fake.diffs, [[B.id, N.id]]);
  assert.deepEqual([engine.config.massHold?.beforeId, engine.config.massHold?.removed], [B.id, 300]);
});

test('a partial backup that could not read a folder is not the one compared with for it: the one before that read it is (r4 GA2)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  const run = crypto.randomUUID();
  const B = fake.snap('1', 40), K = fake.snap('2', 30), P = fake.snap('3', 10, { tags: ['partial', 'run:' + run] }), list = fake.snap('4', 10, { tags: ['meta', 'run:' + run] }), N = fake.snap('5', 0, { paths: [docs] });
  f.latest(N);
  // P holds nothing of pics: its tree lacks it — whatever its list says, even cut short with only the drive's root in it
  // (r5 GA6 · r6 GA4 · GA7). Asked of restic.
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: ['/Q'], cut: true }));
  fake.missing.add(`${P.id}:${treeOf(pics)}`);
  fake.diff = (a, b) => ({ lines: b === K.id ? many(300, pics, '-', 'p') : [] });
  fake.ls[`${K.id}:${treeOf(pics)}`] = fileNodes(700);
  await engine.retain();
  assert.equal(engine.config.massHold?.left, 700, 'what pics has now, in the one compared with (r5 GA5)');
  assert.deepEqual(fake.diffs, [[B.id, N.id], [B.id, K.id]]);
  assert.deepEqual([engine.config.massHold?.beforeId, engine.config.massHold?.path, engine.config.massHold?.compared], [B.id, pics, [{ path: docs, at: N.time }, { path: pics, at: K.time }]]);
  assert.ok(!fake.diffs.some(([, b]) => b === P.id));
});

test('a file the fill of the backup compared with holds is not gone, though it is gone from the disk (r4 GA3)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link';
  const f = await fixture(), { engine, fake, docs } = f;
  const fillOf = (c, hours, run, fillRun) => {
    const fill = fake.snap(c, hours, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + fillRun] });
    fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'outlook.pst')], failed: [], cut: false }));
    fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = [{ message_type: 'node', path: '/outlook.pst', type: 'file', size: 5 * GiB }];
    return fill;
  };
  // The Outlook file is always open: neither partial backup holds it, both fills do. It is gone from the disk now. The
  // newest backup is the vault's complete place yet a partial one, its list cut: no other has the folder, so it is the one
  // compared with all the same — and what its fill holds is not gone.
  const old = crypto.randomUUID(), now = crypto.randomUUID();
  const B = fake.snap('2', 30, { tags: ['partial', 'run:' + old] }); fillOf('4', 29, old, crypto.randomUUID());
  const N = fake.snap('6', 2, { tags: [VERIFIED, 'partial', 'run:' + now] }), list = fake.snap('7', 2, { tags: ['meta', 'run:' + now] }); fillOf('8', 1.5, now, crypto.randomUUID());
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [], cut: true }));
  f.latest(N);
  fake.diff = { lines: [] };
  await engine.retain();
  assert.deepEqual(fake.diffs.find(([a]) => a === B.id), [B.id, N.id]);
  assert.equal(engine.config.massHold ?? null, null);
  // B complete held it in its own tree; N could not read it (its list cut, so nothing tells where) and its fill holds it.
  // The diff says gone, the disk has it no more: N's fill keeps it, so it is not counted.
  const g = await fixture(), later = crypto.randomUUID();
  const gFill = (c, hours, run) => { const fillRun = crypto.randomUUID(), fill = g.fake.snap(c, hours, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = g.fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + fillRun] });
    g.fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(g.docs, 'outlook.pst')], failed: [], cut: false }));
    g.fake.ls[`${fill.id}:${treeOf(root + g.docs.slice(2))}`] = [{ message_type: 'node', path: '/outlook.pst', type: 'file', size: 5 * GiB }]; };
  const B2 = g.fake.snap('2', 30);
  g.fake.ls[`${B2.id}:${treeOf(g.docs)}`] = [{ message_type: 'node', path: '/outlook.pst', type: 'file', size: 5 * GiB }];
  const N2 = g.fake.snap('6', 2, { tags: [VERIFIED, 'partial', 'run:' + later] }), list2 = g.fake.snap('7', 2, { tags: ['meta', 'run:' + later] }); gFill('8', 1.5, later);
  g.fake.dumps[list2.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [], cut: true }));
  g.latest(N2);
  g.fake.diff = { lines: [[`${treeOf(g.docs)}/outlook.pst`, '-']] };
  await g.engine.retain();
  assert.deepEqual(g.fake.diffs.find(([a]) => a === B2.id), [B2.id, N2.id]);
  assert.deepEqual([g.engine.config.massHold ?? null, g.forgot()], [null, [B2.id]]);
});

test('where the partial backup compared with could not read, a file is gone only when no other backup that stays holds it (Fable 후속 · r5 GA1)', { skip: windowsPaths }, async () => {
  const setup = async kHas => {
    const x = await fixture(), { fake, docs, pics } = x;
    // The drive came out while P was read: it names pics\\sub among what it could not read, and the drive is still out.
    const run = crypto.randomUUID();
    const B = fake.snap('1', 40), K = fake.snap('2', 20), P = fake.snap('3', 10, { tags: ['partial', 'run:' + run] }), list = fake.snap('4', 10, { tags: ['meta', 'run:' + run] }), N = fake.snap('5', 0, { paths: [docs] });
    x.latest(N);
    fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.win32.join(pics, 'sub')], cut: false }));
    fake.diff = (a, b) => ({ lines: b === P.id ? [...many(600, pics, '-', 'sub/f'), [`${treeOf(pics)}/top.txt`, '-']] : [] });
    // K, kept by retain for pics\\sub, holds them — or they were gone before it was made.
    if (kHas) fake.ls[`${K.id}:${treeOf(pics)}`] = Array.from({ length: 600 }, (_, i) => ({ message_type: 'node', path: `/sub/f${i}.txt`, type: 'file', size: 10 }));
    return { ...x, B, K, P, N };
  };
  const f = await setup(true);
  await f.engine.retain();
  assert.deepEqual(f.fake.diffs, [[f.B.id, f.N.id], [f.B.id, f.P.id]]);
  assert.deepEqual([f.engine.config.massHold ?? null, f.forgot()], [null, [f.B.id]]);
  // 601 to ask of K: its list of pics is read once, not six calls of a hundred paths (Fable 후속 2).
  assert.equal(f.fake.calls.filter(a => a[0] === 'ls' && a[3] === f.K.id).length, 1);
  const g = await setup(false);
  await g.engine.retain();
  assert.deepEqual([g.engine.config.massHold?.kind, g.engine.config.massHold?.removed, g.engine.config.massHold?.beforeId], ['removed', 601, g.B.id]);
});

test('a folder still chosen that no backup that stays could read: what the backup going holds there is its last copy (r5 GA2)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  // pics has no complete backup: its first partial one A and newest P could not read it at all; only B, between, did.
  const lists = {};
  const partial = (c, hours, unreadable) => { const run = crypto.randomUUID(), s = fake.snap(c, hours, { files: 600, tags: ['partial', 'run:' + run] }), meta = fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + run] }); fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, unreadable, cut: false })); return s; };
  const A = partial('1', 50, [pics]), B = partial('3', 30, []), P = partial('5', 10, [pics]);
  for (const x of [A, P]) fake.missing.add(`${x.id}:${treeOf(pics)}`);
  const N = fake.snap('7', 0, { paths: [docs] }); f.latest(N);
  fake.ls[`${B.id}:${treeOf(pics)}`] = Array.from({ length: 300 }, (_, i) => ({ message_type: 'node', path: `/p${i}.jpg`, type: 'file', size: 10 }));
  fake.diff = { lines: [] };
  await engine.retain();
  assert.ok([A, P].every(x => fake.snapshots.some(y => y.id === x.id)), 'retain keeps both for pics');
  const h = engine.config.massHold;
  assert.deepEqual([h?.kind, h?.removed, h?.beforeId, h?.path], ['removed', 300, B.id, pics]);
  assert.deepEqual(fake.diffs, [[B.id, N.id]], 'docs compared as ever; pics against the disk');
  // 「확인을 마침」 covers B for pics — compared with nothing, the range is B alone — so the next clean-up lets it go
  // (Fable 후속 2: not the same hold again and again).
  await engine.massConfirm();
  await engine.retain();
  assert.deepEqual([engine.config.massHold ?? null, f.forgot().includes(B.id), fake.diffs.length], [null, true, 1]);
  // No longer chosen: left out, as before.
  const g = await fixture();
  g.engine.config.sources = [g.docs];
  const b2 = g.fake.snap('1', 30, { paths: [g.docs, g.pics] }); g.latest(g.fake.snap('2', 0, { paths: [g.docs] }));
  g.fake.ls[`${b2.id}:${treeOf(g.pics)}`] = Array.from({ length: 300 }, (_, i) => ({ message_type: 'node', path: `/p${i}.jpg`, type: 'file', size: 10 }));
  g.fake.diff = { lines: [] };
  await g.engine.retain();
  assert.equal(g.engine.config.massHold ?? null, null);
});

test('a folder whose name the two backups spell in other cases is compared inside each: 300 changed are seen (r5 GA4)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  const upper = docs.toUpperCase();
  const B = fake.snap('1', 30, { files: 600 }), N = fake.snap('2', 0, { files: 600, paths: [upper, pics] }); f.latest(N);
  // The files are still there, changed. Compared whole, restic pairs the two roots by their exact names: each file is gone
  // under one and new under the other — and still on this disk, which tells names apart by no case.
  for (let i = 0; i < 300; i++) await fs.writeFile(path.join(docs, `f${i}.txt`), 'new');
  fake.diff = (a, b) => ({ lines: a.includes(':') ? many(300, docs, 'M') : [...many(300, docs, '-'), ...many(300, upper, '+')] });
  await engine.retain();
  // docs is counted as another folder — no backup that stays, its files on the disk: none gone — and as the same one,
  // compared inside each (r13 · 설계 검토 기록11); pics with the backups whole.
  assert.deepEqual(fake.diffs, [[B.id, N.id], [`${B.id}:${treeOf(docs)}`, `${N.id}:${treeOf(upper)}`]]);
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.changed], ['changed', 300]);
});

test('what a backup holds of a folder is asked of restic, not guessed from its list: a scan that failed while the files were saved is no hold left out (r6 GA1)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  const partial = (c, hours, unreadable) => { const run = crypto.randomUUID(), x = fake.snap(c, hours, { files: 600, tags: ['partial', 'run:' + run] }), meta = fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + run] }); fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, unreadable, cut: false })); return x; };
  // B's list names pics, yet B saved its 300 photos; P read pics after they were gone from it and from the disk.
  const A = partial('1', 50, [pics]), B = partial('3', 30, [pics]), P = partial('5', 10, []);
  fake.missing.add(`${A.id}:${treeOf(pics)}`);
  f.latest(fake.snap('7', 0, { paths: [docs] }));
  fake.diff = (a, b) => ({ lines: b === P.id ? many(300, pics, '-', 'p') : [] });
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.beforeId], ['removed', 300, B.id]);
});

test('a fill is seen on every way: with no backup that stays holding the folder, and in the other backups asked (r6 GA2 · GA3 · GA5)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link';
  const node = (p, size = 10) => ({ message_type: 'node', path: p, type: 'file', size });
  // pics with no backup that stays holding it (A and P lack its tree); the 5 GiB file is only in B's fill and gone.
  const f = await fixture(), { engine, fake, docs, pics } = f;
  const listed = (c, hours, unreadable) => { const run = crypto.randomUUID(), x = fake.snap(c, hours, { files: 600, tags: ['partial', 'run:' + run] }), meta = fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + run] }); fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, unreadable, cut: false })); return { x, run }; };
  const fillOf = (c, hours, run, folder, file, size) => {
    const fillRun = crypto.randomUUID(), fill = fake.snap(c, hours, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + fillRun] });
    fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: folder.slice(0, 2).toUpperCase() }], asked: [path.win32.join(folder, file)], failed: [], cut: false }));
    fake.ls[`${fill.id}:${treeOf(root + folder.slice(2))}`] = [node('/' + file, size)];
    return fill;
  };
  const A = listed('1', 50, [pics]).x, b = listed('3', 30, [path.win32.join(pics, 'big.iso')]), P = listed('5', 10, [pics]).x;
  fillOf('7', 29, b.run, pics, 'big.iso', 5 * GiB);
  for (const x of [A, P]) fake.missing.add(`${x.id}:${treeOf(pics)}`);
  f.latest(fake.snap('9', 0, { paths: [docs] }));
  fake.diff = { lines: [] };
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removedBytes, engine.config.massHold?.beforeId], ['bytes', 5 * GiB, b.x.id]);
  // docs: P' and K could not read archive.pst; K's fill holds it. B (a partial one that read it) goes, the file gone from
  // the disk: still in K's fill, so not gone (r6 GA3).
  const g = await fixture();
  const gl = (c, hours, unreadable, paths) => { const run = crypto.randomUUID(), x = g.fake.snap(c, hours, { tags: ['partial', 'run:' + run], ...(paths ? { paths } : {}) }), meta = g.fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + run] }); g.fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, unreadable, cut: false })); return { x, run }; };
  const archive = path.win32.join(g.docs, 'archive.pst');
  g.fake.snap('1', 60);
  const B = gl('3', 40, []).x, K = gl('5', 20, [archive]), P2 = gl('7', 10, [archive]);
  const kFill = g.fake.snap('a', 19, { tags: ['fill', 'fills:' + K.run, 'run:' + crypto.randomUUID()] });
  const kMeta = g.fake.snap('b', 19, { tags: ['meta', kFill.tags.find(t => t.startsWith('run:'))] });
  g.fake.dumps[kMeta.id] = Buffer.from(JSON.stringify({ v: 1, fills: K.run, roots: [{ from: root, to: DRIVE }], asked: [archive], failed: [], cut: false }));
  g.fake.ls[`${kFill.id}:${treeOf(root + g.docs.slice(2))}`] = [node('/archive.pst', 5 * GiB)];
  g.fake.ls[`${B.id}:${treeOf(g.docs)}`] = [node('/archive.pst', 5 * GiB)];
  g.latest(g.fake.snap('d', 0, { paths: [g.pics] }));
  g.fake.diff = (a, b2) => ({ lines: b2 === P2.x.id ? [[`${treeOf(g.docs)}/archive.pst`, '-']] : [] });
  await g.engine.retain();
  assert.ok(g.fake.diffs.some(([a, b2]) => a === B.id && b2 === P2.x.id), 'docs compared with P');
  assert.equal(g.engine.config.massHold ?? null, null);
});

test('a file a partial backup and its fill both hold is one file in the shares (r7 GA1)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  // B, a partial one, held 600 files of docs; 200 others it had are gone from the disk and from N.
  const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: 600, paths: [docs] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'k0.txt')], cut: false }));
  // Its fill read again 200 files its tree holds too, still on the disk: not 200 more of the share.
  const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'k0.txt')], failed: [], cut: false }));
  const nodes = Array.from({ length: 200 }, (_, n) => ({ message_type: 'node', path: `/k${n}.txt`, type: 'file', size: 10 }));
  fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = nodes;
  fake.ls[`${B.id}:${treeOf(docs)}`] = nodes;
  for (let n = 0; n < 200; n++) await fs.writeFile(path.join(docs, `k${n}.txt`), 'k');
  f.latest(fake.snap('5', 0, { paths: [docs] }));
  fake.diff = { lines: many(200, docs, '-', 'g') };
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.before], ['removed', 200, 600]);
  // The same 200 with their names in capitals in the fill (Windows tells no case apart): still 600 (r8 GA3).
  const g = await fixture(), gRun = crypto.randomUUID(), gFillRun = crypto.randomUUID();
  const gB = g.fake.snap('1', 30, { tags: ['partial', 'run:' + gRun], files: 600, paths: [g.docs] }), gList = g.fake.snap('2', 30, { tags: ['meta', 'run:' + gRun] });
  g.fake.dumps[gList.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(g.docs, 'k0.txt')], cut: false }));
  const gFill = g.fake.snap('3', 29, { tags: ['fill', 'fills:' + gRun, 'run:' + gFillRun] }), gMeta = g.fake.snap('4', 29, { tags: ['meta', 'run:' + gFillRun] });
  g.fake.dumps[gMeta.id] = Buffer.from(JSON.stringify({ v: 1, fills: gRun, roots: [{ from: root, to: DRIVE }], asked: [path.join(g.docs, 'k0.txt')], failed: [], cut: false }));
  g.fake.ls[`${gFill.id}:${treeOf(root + g.docs.slice(2))}`] = Array.from({ length: 200 }, (_, n) => ({ message_type: 'node', path: `/K${n}.TXT`, type: 'file', size: 10 }));
  g.fake.ls[`${gB.id}:${treeOf(g.docs)}`] = nodes;
  for (let n = 0; n < 200; n++) await fs.writeFile(path.join(g.docs, `k${n}.txt`), 'k');
  g.latest(g.fake.snap('5', 0, { paths: [g.docs] }));
  g.fake.diff = { lines: many(200, g.docs, '-', 'g') };
  await g.engine.retain();
  assert.deepEqual([g.engine.config.massHold?.kind, g.engine.config.massHold?.removed, g.engine.config.massHold?.before], ['removed', 200, 600]);
});

test('a file both the tree and the fill of the backup going hold, gone, counts once with the larger size (r8 GA1)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, f = await fixture(), { engine, fake, docs } = f;
  const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  // B's tree holds archive.pst at 1 KiB; its fill read it again at 5 GiB. It is gone from the disk and from N.
  const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'archive.pst')], cut: false }));
  const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'archive.pst')], failed: [], cut: false }));
  fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = [{ message_type: 'node', path: '/archive.pst', type: 'file', size: 5 * GiB }];
  fake.ls[`${B.id}:${treeOf(docs)}`] = [{ message_type: 'node', path: '/archive.pst', type: 'file', size: 1024 }];
  f.latest(fake.snap('5', 0));
  fake.diff = { lines: [[`${treeOf(docs)}/archive.pst`, '-']] };
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.removedBytes], ['bytes', 1, 5 * GiB]);
});

test('a file gone from the disk is not gone while the fill of a backup that stays holds it, though that backup has no tree of the folder (r7 GA2)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link';
  const f = await fixture(), { engine, fake, docs } = f;
  const big = { message_type: 'node', path: '/archive.pst', type: 'file', size: 5 * GiB };
  // B, complete, held archive.pst. P, the newest — the vault's complete place, a partial one — has no tree of docs, its
  // list cut short; its fill read docs whole, archive.pst with it. No backup that stays has docs in its tree.
  const B = fake.snap('1', 30); fake.ls[`${B.id}:${treeOf(docs)}`] = [big];
  const run = crypto.randomUUID(), P = fake.snap('3', 2, { tags: [VERIFIED, 'partial', 'run:' + run] }), list = fake.snap('4', 2, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [], cut: true }));
  fake.missing.add(`${P.id}:${treeOf(docs)}`);
  const fillRun = crypto.randomUUID(), fill = fake.snap('5', 1.5, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('6', 1.5, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'archive.pst')], failed: [], cut: false }));
  fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = [big];
  f.latest(P);
  fake.diff = { lines: [] };
  await engine.retain();
  assert.deepEqual([engine.config.massHold ?? null, f.forgot()], [null, [B.id]]);
});

test('where the backup compared with could not read, the fill of another that stays is asked though its tree lacks the folder (r7 GA5)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link';
  const g = await fixture();
  const gl = (c, hours, unreadable) => { const run = crypto.randomUUID(), x = g.fake.snap(c, hours, { tags: ['partial', 'run:' + run] }), meta = g.fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + run] }); g.fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, unreadable, cut: false })); return { x, run }; };
  const archive = path.win32.join(g.docs, 'archive.pst');
  g.fake.snap('1', 60);
  // P and K could not read archive.pst; K has no tree of docs at all, and its fill holds archive.pst. B read it; it is
  // gone from the disk: still in K's fill, so not gone.
  const B = gl('3', 40, []).x, K = gl('5', 20, [archive]), P = gl('7', 10, [archive]);
  g.fake.missing.add(`${K.x.id}:${treeOf(g.docs)}`);
  const kFill = g.fake.snap('a', 19, { tags: ['fill', 'fills:' + K.run, 'run:' + crypto.randomUUID()] });
  const kMeta = g.fake.snap('b', 19, { tags: ['meta', kFill.tags.find(t => t.startsWith('run:'))] });
  g.fake.dumps[kMeta.id] = Buffer.from(JSON.stringify({ v: 1, fills: K.run, roots: [{ from: root, to: DRIVE }], asked: [archive], failed: [], cut: false }));
  g.fake.ls[`${kFill.id}:${treeOf(root + g.docs.slice(2))}`] = [{ message_type: 'node', path: '/archive.pst', type: 'file', size: 5 * GiB }];
  g.fake.ls[`${B.id}:${treeOf(g.docs)}`] = [{ message_type: 'node', path: '/archive.pst', type: 'file', size: 5 * GiB }];
  g.latest(g.fake.snap('d', 0, { paths: [g.pics] }));
  g.fake.diff = (a, b) => ({ lines: b === P.x.id ? [[`${treeOf(g.docs)}/archive.pst`, '-']] : [] });
  await g.engine.retain();
  assert.ok(g.fake.diffs.some(([a, b]) => a === B.id && b === P.x.id), 'docs compared with P');
  assert.equal(g.engine.config.massHold ?? null, null);
});

test('a list that names the drive or the folder itself could not read any of it: what is not there is asked of the others that stay (r7 GA3)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, pics } = f;
  // P, the newest, saved part of pics while its list names the drive (/Q) among what it could not read. K holds the 300
  // photos P lacks; they are gone from the disk.
  const B = fake.snap('1', 30), K = fake.snap('2', 20);
  fake.ls[`${K.id}:${treeOf(pics)}`] = Array.from({ length: 300 }, (_, n) => ({ message_type: 'node', path: `/p${n}.txt`, type: 'file', size: 10 }));
  const run = crypto.randomUUID(), P = fake.snap('3', 10, { tags: [VERIFIED, 'partial', 'run:' + run] }), list = fake.snap('4', 10, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: ['/Q'], cut: false }));
  f.latest(P);
  fake.diff = (a, b) => ({ lines: b === P.id ? many(300, pics, '-', 'p') : [] });
  await engine.retain();
  assert.deepEqual([engine.config.massHold ?? null, f.forgot()], [null, [B.id]]);
});

test('a fill asked to read a whole folder holds it whole: what only it held is counted (r7 GA4 · GA6)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link';
  const f = await fixture(), { engine, fake, docs, pics } = f;
  const listed = (c, hours, unreadable) => { const run = crypto.randomUUID(), x = fake.snap(c, hours, { files: 600, tags: ['partial', 'run:' + run] }), meta = fake.snap(String.fromCharCode(c.charCodeAt(0) + 1), hours, { tags: ['meta', 'run:' + run] }); fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, unreadable, cut: false })); return { x, run }; };
  // None of them could read pics; B's fill read it whole, a 5 GiB file in it, gone from the disk now.
  const A = listed('1', 50, [pics]).x, b = listed('3', 30, [pics]), P = listed('5', 10, [pics]).x;
  const fillRun = crypto.randomUUID(), fill = fake.snap('7', 29, { tags: ['fill', 'fills:' + b.run, 'run:' + fillRun] }), meta = fake.snap('8', 29, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: b.run, roots: [{ from: root, to: 'Q:' }], asked: [pics], failed: [], cut: false }));
  fake.ls[`${fill.id}:${treeOf(root + pics.slice(2))}`] = [{ message_type: 'node', path: '/big.iso', type: 'file', size: 5 * GiB }];
  for (const x of [A, b.x, P]) fake.missing.add(`${x.id}:${treeOf(pics)}`);
  f.latest(fake.snap('9', 0, { paths: [docs] }));
  fake.diff = { lines: [] };
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removedBytes, engine.config.massHold?.beforeId], ['bytes', 5 * GiB, b.x.id]);
});

test('one rule wherever a file is in doubt: where the backup going had it, what it is compared with and where a copy is (Fable 후속 4)', { skip: windowsPaths, timeout: LONG }, async () => {
  const GiB = 1024 ** 3, root = 'C:\\swb-fill-link', X = 'archive.pst';
  const limit = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: GiB, list: 500, compare: 6, ask: 300 };
  // Where B, going, had X: in its tree; or — what it could not read — in its fill, asked for X or for the folder whole,
  // its tree holding the folder or not.
  const sources = ['tree', 'tree+fill', 'tree+whole', 'none+fill', 'none+whole'];
  // What docs is compared with: none that stays has it in its tree; a complete one; a partial one whose list is known
  // (X not in it), not known (cut), or names the folder or its drive.
  const holders = ['none', 'complete', 'known', 'cut', 'folder', 'drive'];
  // Where a copy of X is: nowhere; in K's tree; in K's fill, K having no tree of docs; on the disk.
  const copies = ['none', 'stay', 'stayFill', 'disk'];
  const wrong = [];
  for (const source of sources) for (const holder of holders) for (const copy of copies) {
    if (holder === 'none' && copy === 'stay') continue; // one that stays with docs in its tree is the one compared with
    const f = await fixture(), { engine, fake, docs, pics } = f;
    const node = { message_type: 'node', path: '/' + X, type: 'file', size: 5 * GiB };
    const meta = (c, hours, run, body) => { const m = fake.snap(c, hours, { tags: ['meta', 'run:' + run] }); fake.dumps[m.id] = Buffer.from(JSON.stringify(body)); };
    const fillOf = (c, hours, run, asked) => {
      const fillRun = crypto.randomUUID(), fill = fake.snap(c, hours, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] });
      meta(String.fromCharCode(c.charCodeAt(0) + 1), hours, fillRun, { v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [asked], failed: [], cut: false });
      fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = [node];
    };
    const [tree, fillKind] = source.split('+');
    const bRun = crypto.randomUUID(), B = fake.snap('1', 30, fillKind ? { tags: ['partial', 'run:' + bRun] } : {});
    if (fillKind) {
      const asked = fillKind === 'whole' ? docs : path.join(docs, X);
      meta('2', 30, bRun, { v: 1, unreadable: [asked], cut: false });
      fillOf('3', 29, bRun, asked);
    } else fake.ls[`${B.id}:${treeOf(docs)}`] = [node];
    if (tree === 'none') fake.missing.add(`${B.id}:${treeOf(docs)}`);
    const stays = [];
    if (copy === 'stay' || copy === 'stayFill') {
      // K is left out of being compared with: a partial one with its list cut when that is what docs is compared with.
      const kRun = crypto.randomUUID(), partial = copy === 'stayFill' || holder === 'cut';
      const K = fake.snap('5', 20, partial ? { tags: ['partial', 'run:' + kRun] } : {});
      if (copy === 'stay') { fake.ls[`${K.id}:${treeOf(docs)}`] = [node]; if (partial) meta('6', 20, kRun, { v: 1, unreadable: [], cut: true }); }
      else { meta('6', 20, kRun, { v: 1, unreadable: [docs], cut: false }); fake.missing.add(`${K.id}:${treeOf(docs)}`); fillOf('7', 19, kRun, path.join(docs, X)); }
      stays.push(K);
    }
    if (copy === 'disk') await fs.writeFile(path.join(docs, X), 'x');
    const hRun = crypto.randomUUID();
    const H = holder === 'none' ? fake.snap('9', 2, { paths: [pics] }) : holder === 'complete' ? fake.snap('9', 2) : fake.snap('9', 2, { tags: [VERIFIED, 'partial', 'run:' + hRun] });
    if (!['none', 'complete'].includes(holder)) meta('a', 2, hRun, { v: 1, unreadable: holder === 'folder' ? [docs] : holder === 'drive' ? ['/' + docs[0].toUpperCase()] : [], cut: holder === 'cut' });
    stays.unshift(H);
    fake.diff = (a, b) => ({ lines: source === 'tree' && b === H.id && holder !== 'none' ? [[`${treeOf(docs)}/${X}`, '-']] : [] });
    const r = await engine.massCompare(B, H, limit, { all: fake.snapshots, stays, chosen: () => true, cache: new Map() });
    // Gone when not on the disk and — unless it is a usual line of the diff with the one compared with, which is what this
    // hold is for — in no backup that stays nor its fill.
    const usual = source === 'tree' && ['complete', 'known', 'cut'].includes(holder);
    const gone = copy !== 'disk' && (usual || copy === 'none');
    const got = [r.removed, r.bytes], want = gone ? [1, 5 * GiB] : [0, 0];
    if (got[0] !== want[0] || got[1] !== want[1]) wrong.push(`${source} · ${holder} · ${copy}: ${got} (${want})`);
  }
  assert.deepEqual(wrong, []);
});

test('a fill that read a whole folder read all of it: the clean-up keeps no older backup for what the partial one could not read there (r7 GA4 · Fable 후속 4)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  // B, complete, read docs\a.txt. P, the newest, could not; its fill read docs whole.
  const B = fake.snap('1', 30);
  const P = fake.snap('3', 2, { tags: [VERIFIED, 'partial', 'run:' + run] }), list = fake.snap('4', 2, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'a.txt')], cut: false }));
  const fill = fake.snap('5', 1.5, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] });
  const meta = fake.snap('6', 1.5, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [docs], failed: [], cut: false }));
  const inFill = `${fill.id}:${treeOf(root + docs.slice(2))}`;
  fake.ls[inFill] = [{ message_type: 'node', path: '/a.txt', type: 'file', size: 10 }];
  f.latest(P);
  fake.diff = { lines: [] };
  await engine.retain();
  assert.deepEqual(f.forgot(), [B.id]);
  // docs was a file when the fill read it: it read no folder, so it says nothing of a.txt and B stays for it — and a
  // restore never lists that file as a folder (r8 GA2).
  assert.ok(await engine.fillFor(fake.snapshots, P, docs), 'a folder there');
  // restic warns and ends with 0: the restore's listing is not failed for it (Fable 후속 5).
  fake.warns = true; engine.fillFolders.clear();
  assert.ok(await engine.fillFor(fake.snapshots, P, docs), 'a warning is no failure here');
  fake.warns = false;
  fake.fileAt.add(inFill);
  engine.fillFolders.clear(); // as an engine that has not asked yet
  assert.equal(await engine.fillFor(fake.snapshots, P, docs), null);
  // Its list cut short, it holds nothing to use: no listing is asked for it — one that fails stops no restore (r9 GA3).
  fake.fileAt.delete(inFill); engine.fillFolders.clear(); engine.fillCache = new Map([[meta.id, { v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [docs], failed: [], cut: true }]]);
  const before = fake.calls.length;
  assert.equal(await engine.fillFor(fake.snapshots, P, docs), null);
  assert.deepEqual(fake.calls.slice(before).filter(a => a[0] === 'ls'), []);
});

test('a file the tree and the fill of the backup going both hold counts once wherever the tree side counted it: a folder none that stays has (Fable 후속 5)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, pics } = f;
  const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  const limit = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: 1024 ** 3, list: 500, compare: 6, ask: 300 };
  const node = name => ({ message_type: 'node', path: '/' + name, type: 'file', size: 10 });
  // B, a partial one, held 600 files of docs, and no backup that stays has docs. 100 are gone from the disk; its fill
  // read those 100 again.
  const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: 600 }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'g0.txt')], cut: false }));
  const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'g0.txt')], failed: [], cut: false }));
  fake.ls[`${B.id}:${treeOf(docs)}`] = [...Array.from({ length: 500 }, (_, n) => node(`k${n}.txt`)), ...Array.from({ length: 100 }, (_, n) => node(`g${n}.txt`))];
  fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = Array.from({ length: 100 }, (_, n) => node(`g${n}.txt`));
  for (let n = 0; n < 500; n++) await fs.writeFile(path.join(docs, `k${n}.txt`), 'k');
  const H = fake.snap('9', 2, { paths: [pics] });
  fake.diff = { lines: [] };
  const r = await engine.massCompare(B, H, limit, { all: fake.snapshots, stays: [H], chosen: () => true, cache: new Map() });
  assert.deepEqual([r.removed, r.before, r.kind], [100, 600, null]);
});

test('the share of a backup whose tree and fill both hold a folder is told both ways; only when they tell apart is its tree listed, once (Fable 후속 5)', { skip: windowsPaths, timeout: LONG }, async () => {
  const limit = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: 1024 ** 3, list: 500, compare: 6, ask: 300 };
  const setup = async (kept, tree = 100) => {
    const f = await fixture(), { fake, docs } = f;
    const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
    const node = name => ({ message_type: 'node', path: '/' + name, type: 'file', size: 10 });
    // B's tree holds 100 files of docs, its fill 900 others; those the disk still has are 'kept' of them.
    const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: tree, paths: [docs] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
    fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'f0.txt')], cut: false }));
    const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
    fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'f0.txt')], failed: [], cut: false }));
    fake.ls[`${B.id}:${treeOf(docs)}`] = Array.from({ length: tree }, (_, n) => node(`k${n}.txt`));
    fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = Array.from({ length: 900 }, (_, n) => node(`f${n}.txt`));
    for (let n = 0; n < kept; n++) await fs.writeFile(path.join(docs, `f${n}.txt`), 'f');
    const H = fake.snap('9', 2, { paths: [docs] });
    fake.diff = { lines: [] };
    const r = await f.engine.massCompare(B, H, limit, { all: fake.snapshots, stays: [H], chosen: () => true, cache: new Map() });
    const listed = fake.calls.filter(a => a[0] === 'ls' && a.includes('--recursive') && a.includes(B.id) && a.includes(treeOf(docs))).length;
    return { r, listed };
  };
  // 250 gone: 250 of 100 without the fill's files, 250 of 1000 with them — apart; B's list shows the 900 are not its
  // tree's, so the share is 25%: no hold.
  const apart = await setup(650);
  assert.deepEqual([apart.r.removed, apart.r.before, apart.r.kind, apart.listed], [250, 1000, null, 1]);
  // 10 gone: no hold either way — B's tree is not listed.
  const same = await setup(890);
  assert.deepEqual([same.r.removed, same.r.kind, same.listed], [10, null, 0]);
  // A tree that holds the folder and none of its files: the share without the fill is of nothing; with it, and exact, of
  // 900 — 250 gone is 28%: no hold (Fable 후속 5 확인).
  const none = await setup(650, 0);
  assert.deepEqual([none.r.removed, none.r.before, none.r.kind, none.listed], [250, 900, null, 1]);
  // All 900 of the fill gone, the tree's 100 there: a hold either way, told of the 1000 B had — not the tree's 100 (r9 GA2).
  const all = await setup(0);
  assert.deepEqual([all.r.removed, all.r.before, all.r.kind, all.listed], [900, 1000, 'removed', 1]);
});

test('how many files are counted with the disk, and whether their sizes are read, go by the most the share can be of (r9 GA1)', { skip: windowsPaths }, async () => {
  const MiB = 1024 ** 2, GiB = 1024 ** 3, f = await fixture(), { engine, fake, docs } = f;
  const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  const limit = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: GiB, list: 500, compare: 6, ask: 300 };
  const node = (name, size) => ({ message_type: 'node', path: '/' + name, type: 'file', size });
  // B's tree held 600 files of docs (6 GiB), 230 of them 25 MiB each and gone; its fill read 400 others, still on the disk.
  const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: 600, bytes: 6 * GiB, paths: [docs] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'f0.txt')], cut: false }));
  const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'f0.txt')], failed: [], cut: false }));
  fake.ls[`${B.id}:${treeOf(docs)}`] = [...Array.from({ length: 230 }, (_, n) => node(`g${n}.txt`, 25 * MiB)), ...Array.from({ length: 370 }, (_, n) => node(`k${n}.txt`, 10))];
  fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = Array.from({ length: 400 }, (_, n) => node(`f${n}.txt`, 10));
  for (let n = 0; n < 400; n++) await fs.writeFile(path.join(docs, `f${n}.txt`), 'f');
  const H = fake.snap('9', 2, { paths: [docs] });
  fake.diff = { lines: many(230, docs, '-', 'g') };
  // 230 of 1000 files is no hold; their 5.6 GiB of some 6 GiB is.
  const r = await engine.massCompare(B, H, limit, { all: fake.snapshots, stays: [H], chosen: () => true, cache: new Map() });
  assert.deepEqual([r.kind, r.removed, r.bytes, r.before], ['bytes', 230, 230 * 25 * MiB, 1000]);
});

test('a copy the fill has larger than the tree copy is of the share with all its size (r9 GA4)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, f = await fixture(), { engine, fake, docs } = f;
  const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID();
  const limit = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: GiB, list: 500, compare: 6, ask: 300 };
  // B's tree, 15 GiB in all, held archive.pst at 1 KiB; its fill read it again at 5 GiB. It is gone: 5 of some 20 GiB, 25%.
  const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: 1000, bytes: 15 * GiB, paths: [docs] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
  fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(docs, 'archive.pst')], cut: false }));
  const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
  fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: [path.join(docs, 'archive.pst')], failed: [], cut: false }));
  fake.ls[`${B.id}:${treeOf(docs)}`] = [{ message_type: 'node', path: '/archive.pst', type: 'file', size: 1024 }];
  fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = [{ message_type: 'node', path: '/archive.pst', type: 'file', size: 5 * GiB }];
  const H = fake.snap('9', 2, { paths: [docs] });
  fake.diff = { lines: [[`${treeOf(docs)}/archive.pst`, '-']] };
  const r = await engine.massCompare(B, H, limit, { all: fake.snapshots, stays: [H], chosen: () => true, cache: new Map() });
  assert.deepEqual([r.kind, r.removed, r.bytes], [null, 1, 5 * GiB]);
});

test('a name is matched as spelled first: a folder that tells case apart may hold two files whose names differ only in it (r10 GA1 · r11 GA1)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3, KiB = 1024;
  const limit = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: GiB, list: 500, compare: 6, ask: 300 };
  // B's tree (its size in all) and its fill, each name → size; the names gone from N and the disk.
  const setup = async (tree, filled, gone, all) => {
    const f = await fixture(), { engine, fake, docs } = f;
    const root = 'C:\\swb-fill-link', run = crypto.randomUUID(), fillRun = crypto.randomUUID(), names = Object.keys(filled);
    const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: 1000, bytes: all * GiB, paths: [docs] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
    fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: names.map(n => path.join(docs, n)), cut: false }));
    const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
    fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: root, to: DRIVE }], asked: names.map(n => path.join(docs, n)), failed: [], cut: false }));
    const nodes = sizes => Object.entries(sizes).map(([name, size]) => ({ message_type: 'node', path: '/' + name, type: 'file', size }));
    fake.ls[`${B.id}:${treeOf(docs)}`] = nodes(tree);
    fake.ls[`${fill.id}:${treeOf(root + docs.slice(2))}`] = nodes(filled);
    const H = fake.snap('9', 2, { paths: [docs] });
    fake.diff = { lines: gone.map(n => [`${treeOf(docs)}/${n}`, '-']) };
    const r = await engine.massCompare(B, H, limit, { all: fake.snapshots, stays: [H], chosen: () => true, cache: new Map() });
    return [r.kind, r.removed, r.bytes];
  };
  // Archive.pst at 4.5 GiB and archive.pst at 1 KiB; the fill's Archive.pst at 5 GiB is the first, gone: 5 of 15.5 GiB,
  // 32% — a hold. Matched by case alone, the 1 KiB one could stand for it, and the share be of some 20 GiB.
  assert.deepEqual(await setup({ 'Archive.pst': 4.5 * GiB, 'archive.pst': KiB }, { 'Archive.pst': 5 * GiB }, ['Archive.pst'], 15), ['bytes', 1, 5 * GiB]);
  // small.pst at 1 KiB and SMALL.pst at 9 GiB; the fill's small.pst, as spelled the first, is gone: 5 of some 20 GiB, 25%
  // — no hold. Not the 9 GiB one's size, which would leave the share of 15 GiB.
  assert.deepEqual(await setup({ 'small.pst': KiB, 'SMALL.pst': 9 * GiB }, { 'small.pst': 5 * GiB }, ['small.pst'], 15), [null, 1, 5 * GiB]);
  // Archive.pst 8 GiB and archive.pst 4 GiB in the tree, Archive.pst 8 GiB and ARCHIVE.pst 4 GiB — another file — in
  // the fill, all gone: 16 GiB. ARCHIVE.pst is no copy of archive.pst to leave out (r11 GA1).
  assert.deepEqual(await setup({ 'Archive.pst': 8 * GiB, 'archive.pst': 4 * GiB }, { 'Archive.pst': 8 * GiB, 'ARCHIVE.pst': 4 * GiB }, ['Archive.pst', 'archive.pst'], 45), ['bytes', 3, 16 * GiB]);
  // A fill file spelled otherwise counts as a file of its own — though it may be the tree's, renamed: toward a hold.
  assert.deepEqual(await setup({ 'Archive.pst': 4.5 * GiB, 'archive.pst': KiB }, { 'ARCHIVE.PST': 5 * GiB }, ['Archive.pst'], 15), ['bytes', 2, 9.5 * GiB]);
  // For the share, a fill file spelled otherwise stands for the larger of the tree's files it may be: ARCHIVE.pst (5 GiB),
  // gone, of Archive.pst 8 GiB and archive.pst 1 GiB — 5 of 14 GiB, 36%, a hold (the 1 GiB one would make it 18 GiB, 28%).
  assert.deepEqual(await setup({ 'Archive.pst': 8 * GiB, 'archive.pst': GiB }, { 'ARCHIVE.pst': 5 * GiB }, [], 14), ['bytes', 1, 5 * GiB]);
});

test('a folder a backup that stays spells in other cases is told both ways, and a hold either way holds: the disk now cannot tell which it was (r12 GA1 · r13 GA2)', { skip: windowsPaths }, async () => {
  const GiB = 1024 ** 3;
  const nodes = sizes => Object.entries(sizes).map(([name, size]) => ({ message_type: 'node', path: '/' + name, type: 'file', size }));
  // B, a partial one, saved Reports (15 GiB, Archive.pst 4 GiB of it) and its fill ARCHIVE.pst (5 GiB); both are gone.
  // H, the one that stays, saved reports and holds an ARCHIVE.pst of 2 GiB: another folder beside it, the same one spelled
  // anew, or — now — a junction to it (r13 GA2). The disk is not asked which. Taken for another folder, no file of H is a
  // copy: 9 GiB are gone when other.dat is on the disk, all 20 GiB when nothing is there.
  const setup = async there => {
    const f = await fixture(), { engine, fake } = f, root = path.dirname(f.docs);
    engine.massLimits = { files: 200, removedShare: 0.3, changedShare: 0.5, bytes: GiB };
    const mine = path.join(root, 'Reports'), theirs = path.join(root, 'reports'), link = 'C:\\swb-fill-link';
    if (there) { await fs.mkdir(theirs); await fs.writeFile(path.join(theirs, 'other.dat'), 'kept'); }
    const run = crypto.randomUUID(), fillRun = crypto.randomUUID();
    const B = fake.snap('1', 30, { tags: ['partial', 'run:' + run], files: 1000, bytes: 15 * GiB, paths: [mine] }), list = fake.snap('2', 30, { tags: ['meta', 'run:' + run] });
    fake.dumps[list.id] = Buffer.from(JSON.stringify({ v: 1, unreadable: [path.join(mine, 'ARCHIVE.pst')], cut: false }));
    const fill = fake.snap('3', 29, { tags: ['fill', 'fills:' + run, 'run:' + fillRun] }), meta = fake.snap('4', 29, { tags: ['meta', 'run:' + fillRun] });
    fake.dumps[meta.id] = Buffer.from(JSON.stringify({ v: 1, fills: run, roots: [{ from: link, to: DRIVE }], asked: [path.join(mine, 'ARCHIVE.pst')], failed: [], cut: false }));
    fake.ls[`${B.id}:${treeOf(mine)}`] = nodes({ 'Archive.pst': 4 * GiB, 'other.dat': 11 * GiB });
    fake.ls[`${fill.id}:${treeOf(link + mine.slice(2))}`] = nodes({ 'ARCHIVE.pst': 5 * GiB });
    const H = fake.snap('9', 2, { paths: [theirs] });
    fake.ls[`${H.id}:${treeOf(theirs)}`] = nodes({ 'ARCHIVE.pst': 2 * GiB, 'other.dat': 11 * GiB });
    fake.diff = { lines: [[`${treeOf(mine)}/Archive.pst`, '-']] };
    const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true);
    // One way compared Reports with nothing: 「확인을 마침」 covers B alone.
    assert.deepEqual(engine.config.massHold?.compared, [{ path: mine, at: B.time, reach: [B.time, H.time] }]);
    return [going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.removedBytes];
  };
  assert.deepEqual(await setup(true), [false, 'bytes', 2, 9 * GiB]);
  assert.deepEqual(await setup(false), [false, 'bytes', 3, 20 * GiB]);
});

test('a folder spelled anew on a drive not plugged in is still compared with the newest backup that has it: told as the same folder too (r13 GA1)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const mine = 'Q:\\Reports', theirs = 'Q:\\reports';
  // B and P saved Reports; it was renamed reports, taken out and chosen again, and H saved it; now its drive is out.
  // From B to P 20 files changed, from B to H 600. P is spelled as B: compared with it alone, B would go.
  const B = fake.snap('1', 30, { paths: [mine] }), P = fake.snap('2', 14, { paths: [mine] }), H = fake.snap('3', 9, { paths: [theirs] });
  fake.diff = (a, b) => ({ lines: b === P.id ? many(20, mine, 'M') : b.startsWith(H.id) ? many(600, mine, 'M') : [] });
  const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true);
  // Counted both ways, the folder was compared with P and with H: 「확인을 마침」 covers it to P, as far as both ways saw
  // it — were Reports another folder than reports, P would be its last copy (설계 검토 기록11).
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.changed, engine.config.massHold?.compared], [false, 'changed', 600, [{ path: mine, at: P.time, reach: [P.time, H.time] }]]);
  // Past P to H, the folder is counted and out of the share (설계 검토 기록11) — kept as each run reads the settings anew.
  const again = f.make(); await again.open();
  assert.deepEqual(again.config.massHold?.compared, [{ path: mine, at: P.time, reach: [P.time, H.time] }]);
  await again.massConfirm();
  const third = f.make(); await third.open();
  assert.deepEqual(third.config.massCheck, { folders: [{ path: mine, from: B.time, to: P.time, reach: [P.time, H.time] }] });
  assert.deepEqual(fake.diffs, [[B.id, P.id], [`${B.id}:${treeOf(mine)}`, `${H.id}:${treeOf(theirs)}`]]);
});

test('taken for another folder, a folder spelled otherwise hides nothing: files of the same names there are no copies (r13)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const mine = 'Q:\\Reports', theirs = 'Q:\\reports';
  // B saved Reports, 300 files; H saved reports, files of the same names and contents; Reports is not on this PC now.
  const B = fake.snap('1', 30, { paths: [mine] }), H = fake.snap('2', 2, { paths: [theirs] });
  fake.ls[`${B.id}:${treeOf(mine)}`] = fileNodes(300);
  fake.diff = { lines: [] };
  const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true);
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed], [false, 'removed', 300]);
});

test('the folders of one backup need not be one way: each is counted every way, and of each count the most is taken (설계 검토 기록11)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const X = 'Q:\\Docs', x = 'Q:\\docs', Y = 'Q:\\Pics', y = 'Q:\\pics';
  // B (1000 files) saved Docs and Pics. Docs was spelled anew: P, a day old, still has Docs; H has docs, without 150 of
  // B's Docs files. Pics is another folder than H's pics, whose 150 files of the same names stand for nothing. As another
  // folder each, 0 and 150 are gone; as the same each, 150 and 0. Docs as the same and Pics as another: 300, 30%.
  const B = fake.snap('1', 30, { paths: [X, Y] }), P = fake.snap('2', 24, { paths: [X] }), H = fake.snap('3', 2, { paths: [x, y] });
  fake.ls[`${B.id}:${treeOf(Y)}`] = fileNodes(150);
  fake.ls[`${B.id}:${treeOf(X)}`] = Array.from({ length: 150 }, (_, i) => ({ message_type: 'node', path: `/f${i}.txt`, type: 'file', size: 20 }));
  fake.diff = (a, b) => ({ lines: a === `${B.id}:${treeOf(X)}` ? many(150, X, '-') : [] });
  const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true);
  // The sizes too: 150 of 20 bytes in Docs, as the same folder; 150 of 10 in Pics, as another.
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.removedBytes], [false, 'removed', 300, 4500]);
});

test('a folder spelled more ways than two is counted as the same as each of them (설계 검토 기록11)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const X = 'Q:\\Docs', one = 'Q:\\docs', two = 'Q:\\DOCS';
  // B saved Docs, and P, a day old, too. H1, the newest, saved docs — another folder beside it, whose files stand for
  // nothing; H2, older, saved DOCS — this folder spelled anew, without 300 of B's files.
  const B = fake.snap('1', 30, { paths: [X] }), P = fake.snap('2', 24, { paths: [X] }), H2 = fake.snap('3', 10, { paths: [two] }), H1 = fake.snap('4', 2, { paths: [one] });
  fake.diff = (a, b) => ({ lines: b.startsWith(H2.id) ? many(300, X, '-') : [] });
  const going = await engine.massCheck(fake.snapshots, H1, [B.id], () => true);
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed], [false, 'removed', 300]);
  // Three ways, one range: from P, the earliest compared with, to H1, the latest (r14 GA2).
  assert.deepEqual(engine.config.massHold?.compared, [{ path: X, at: P.time, reach: [P.time, H1.time] }]);
});

test('a file found only through a folder that is a junction now is not on the disk: it belongs to another folder (설계 검토 기록11)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f, root = path.dirname(f.docs);
  // B saved old, 300 files. The person took old out and made it a junction to new, which holds files of the same names.
  const old = path.join(root, 'old'), now = path.join(root, 'new');
  await fs.mkdir(now);
  for (let i = 0; i < 300; i++) await fs.writeFile(path.join(now, `n${i}`), 'x');
  await fs.symlink(now, old, 'junction');
  const B = fake.snap('1', 30, { paths: [old] }), H = fake.snap('2', 2, { paths: [f.docs] });
  fake.ls[`${B.id}:${treeOf(old)}`] = fileNodes(300);
  fake.diff = { lines: [] };
  const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true);
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed], [false, 'removed', 300]);
});

test('a folder counted two ways is counted at its most toward the file threshold too: the sizes are read (설계 검토 기록11)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f, MiB = 1024 ** 2;
  const X = 'Q:\\Docs', x = 'Q:\\docs';
  // B (1000 files, 10 GiB) saved Docs; P, older, spelled as it, and H, the newest, spelled docs, both lack the same 160 of
  // 25 MiB. Each way counts 160, short of the 300 for files; added up they would be 320, and the 4 GiB, 39%, unread.
  const B = fake.snap('1', 30, { paths: [X] }), P = fake.snap('2', 24, { paths: [X] }), H = fake.snap('3', 2, { paths: [x] });
  fake.ls[`${B.id}:${treeOf(X)}`] = Array.from({ length: 160 }, (_, i) => ({ message_type: 'node', path: `/f${i}.txt`, type: 'file', size: 25 * MiB }));
  fake.diff = (a, b) => ({ lines: b === P.id || b.startsWith(H.id) ? many(160, X, '-') : [] });
  const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true);
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.removedBytes], [false, 'bytes', 160, 4000 * MiB]);
});

test('a folder no longer chosen that none that stays holds as spelled is left out, however another spelling is held: it thins no share (설계 검토 기록11)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const Old = 'Q:\\Old', old = 'Q:\\old', work = 'Q:\\Work';
  // B (1000 files) saved Old (500 of them) and Work. Old was taken out over 30 days ago, as was old, another folder K
  // still holds. Of Work 250 are gone: 50% of the 500 B had there and in nothing else — not 25% of 1000.
  const B = fake.snap('1', 30, { paths: [Old, work] }), K = fake.snap('2', 20, { paths: [old] }), H = fake.snap('3', 2, { paths: [work] });
  fake.ls[`${B.id}:${treeOf(Old)}`] = fileNodes(500);
  fake.diff = (a, b) => ({ lines: b === H.id ? many(250, work, '-') : [] });
  const going = await engine.massCheck(fake.snapshots, H, [B.id], () => true, folder => folder === work);
  assert.deepEqual([going.includes(B.id), engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.before], [false, 'removed', 250, 500]);
});

test('a folder past what 「확인을 마침」 covered, though within what some way of it saw, is counted and out of the share (설계 검토 기록11)', { skip: windowsPaths }, async () => {
  // D (1000 files) saved R (600 of them) and Z, of which 250 are gone: 62% of the 400 left once R is out of the share,
  // not 25% of 1000. A confirmed hold covered R to a backup before D, and some way of it saw R past D — after the backup
  // it kept, or before it.
  const setup = async range => {
    const f = await fixture(), { engine, fake } = f;
    const R = 'Q:\\R', Z = 'Q:\\Z', at = h => new Date(f.now() - h * HOUR).toISOString();
    const D = fake.snap('1', 30, { paths: [R, Z] }), H = fake.snap('2', 2, { paths: [R, Z] });
    engine.config.massCheck = { folders: [{ path: R, ...range(at) }] };
    fake.ls[`${D.id}:${treeOf(R)}`] = fileNodes(600);
    fake.diff = { lines: many(250, Z, '-') };
    const going = await engine.massCheck(fake.snapshots, H, [D.id], () => true);
    return [going.includes(D.id), engine.config.massHold?.kind, engine.config.massHold?.removed, engine.config.massHold?.before];
  };
  assert.deepEqual(await setup(at => ({ from: at(40), to: at(35), reach: [at(35), at(10)] })), [false, 'removed', 250, 400]);
  assert.deepEqual(await setup(at => ({ from: at(20), to: at(20), reach: [at(40), at(10)] })), [false, 'removed', 250, 400]);
  // Read anew, a range keeps its earliest and its latest time however many it was written with (r14 GA2).
  const f = await fixture(), at = h => new Date(f.now() - h * HOUR).toISOString();
  f.engine.config.massCheck = { folders: [{ path: 'Q:\\R', from: at(20), to: at(20), reach: [at(25), at(45), at(5), at(15)] }] };
  await f.engine.save();
  const again = f.make(); await again.open();
  assert.deepEqual(again.config.massCheck.folders[0].reach, [at(45), at(5)]);
});

test('a large file gone from a folder out of the share is no less gone: the sizes are read with it (r14 GA1)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f, GiB = 1024 ** 3, MiB = 1024 ** 2;
  const R = 'Q:\\R', Z = 'Q:\\Z', at = h => new Date(f.now() - h * HOUR).toISOString();
  // D saved R (one file of 2 GiB) and Z (1 MiB). Past what a confirmed hold covered, R is out of the share: 1 MiB is left
  // in it, under the 1 GiB threshold. R's 2 GiB file is gone all the same — from the disk and every backup that stays.
  const D = fake.snap('1', 30, { paths: [R, Z], files: 10, bytes: 2 * GiB + MiB }), J = fake.snap('2', 2, { paths: [R, Z] });
  engine.config.massCheck = { folders: [{ path: R, from: at(40), to: at(35), reach: [at(35), at(10)] }] };
  fake.ls[`${D.id}:${treeOf(R)}`] = [{ message_type: 'node', path: '/big.bin', type: 'file', size: 2 * GiB }];
  fake.diff = { lines: [[`${treeOf(R)}/big.bin`, '-']] };
  const going = await engine.massCheck(fake.snapshots, J, [D.id], () => true);
  assert.deepEqual([going.includes(D.id), engine.config.massHold?.kind, engine.config.massHold?.removedBytes], [false, 'bytes', 2 * GiB]);
});

test('the list a hold shows names each path once, so a folder counted two ways leaves room for the others (r14 GA3)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const X = 'Q:\\Docs', x = 'Q:\\docs', Z = 'Q:\\Work';
  engine.massLimits = { list: 400 };
  // B saved Docs and Work. P, older, is spelled as Docs, and H, the newest, as docs; both lack the same 300 Docs files,
  // and H lacks 50 of Work. Counted two ways, Docs names its 300 once: Work's 50 are shown as well.
  const B = fake.snap('1', 30, { paths: [X, Z] }), P = fake.snap('2', 24, { paths: [X] }), H = fake.snap('3', 2, { paths: [x, Z] });
  fake.diff = (a, b) => ({ lines: b === P.id || b.startsWith(H.id + ':') ? many(300, X, '-') : b === H.id ? many(50, Z, '-', 'w') : [] });
  await engine.massCheck(fake.snapshots, H, [B.id], () => true);
  const list = engine.config.massHold?.list || [];
  assert.deepEqual([list.filter(i => i.folder === X).length, list.filter(i => i.folder === Z).length], [300, 50]);
});

test('a path whose type changed counts the files the backup before had there, every one; a list it cannot read forgets nothing (GPT GA8 · r2 GA6 · GA8)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  const before = fake.snap('1', 30, { files: 500 }), last = fake.snap('2', 0, { files: 251 }); f.latest(last);
  // Fifty folders of one file and one of 250 became files: 300 of 500 gone.
  const node = p => ({ message_type: 'node', path: p, type: 'file', size: 10 });
  fake.ls[`${before.id}:${treeOf(docs)}`] = [...Array.from({ length: 50 }, (_, i) => node(`/폴더${i}/a.txt`)), ...Array.from({ length: 250 }, (_, i) => node(`/사진/n${i}`)), ...Array.from({ length: 200 }, (_, i) => node(`/남음/n${i}`))];
  fake.diff = { lines: [...Array.from({ length: 50 }, (_, i) => [`${treeOf(docs)}/폴더${i}`, 'T']), [`${treeOf(docs)}/사진`, 'T']] };
  await engine.retain();
  assert.deepEqual([engine.config.massHold?.kind, engine.config.massHold?.removed], ['removed', 300]);
  // The backup before cannot be listed: the comparison fails and nothing goes.
  const g = await fixture();
  const b2 = g.fake.snap('1', 30, { files: 500 }), l2 = g.fake.snap('2', 0); g.latest(l2);
  g.fake.diff = { lines: [[`${treeOf(g.docs)}/사진`, 'T']] };
  g.fake.lsFail = at => at === `${b2.id}:${treeOf(g.docs)}`;
  await assert.rejects(g.engine.retain());
  assert.deepEqual([g.forgot(), g.engine.config.massHold ?? null], [[], null]);
});

test('a usual clean-up asks restic which folders a backup holds of the one going and the one compared with only, not of every backup that stays (Fable 후속 3)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  const going = fake.snap('1', 30);
  for (const [c, hours] of [['2', 20], ['3', 16], ['4', 12], ['5', 8], ['6', 4]]) fake.snap(c, hours);
  const last = fake.snap('7', 0); f.latest(last);
  fake.diff = { lines: [] };
  await engine.retain();
  const asked = fake.calls.filter(a => a[0] === 'ls' && !a.includes('--recursive')).map(a => a[2]);
  assert.deepEqual([...new Set(asked)].sort(), [going.id, last.id].sort());
  assert.deepEqual(f.forgot(), [going.id]);
});

test('a comparison that fails, or tells no counts, forgets nothing; the clean-up waits for the next run', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake } = f;
  fake.snap('1', 30); const last = fake.snap('2', 0); f.latest(last);
  fake.diff = new Error('repository is locked');
  await assert.rejects(engine.retain());
  assert.deepEqual([f.forgot(), engine.config.massHold ?? null], [[], null]);
  fake.diff = { stats: false };
  await assert.rejects(engine.retain(), /바뀐 파일 수/);
  assert.deepEqual(f.forgot(), []);
  // restic says the backup going holds none of its folders, yet it saved files: that answer is not trusted (Fable 후속 3).
  const g = await fixture(), going = g.fake.snap('1', 30); g.latest(g.fake.snap('2', 0));
  for (const p of [g.docs, g.pics]) g.fake.missing.add(`${going.id}:${treeOf(p)}`);
  g.fake.diff = { lines: [] };
  await assert.rejects(g.engine.retain(), /폴더를 확인하지/);
  assert.deepEqual([g.forgot(), g.fake.diffs], [[], []]);
});

test('「확인을 마침」 lets the backups between the two compared go without a comparison; a rollback that ended leaves a hold to the person (GPT GA1 · Fable 2)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  // An older backup kept for another reason (a move reading it) is not a candidate this time.
  const pinned = fake.snap('9', 50); engine.config.movePin = { snapshotId: pinned.id, until: new Date(f.now() + HOUR).toISOString() };
  const before = fake.snap('1', 30), last = fake.snap('2', 0); f.latest(last);
  fake.diff = { lines: many(600, docs, '-') };
  await engine.retain();
  const hold = engine.config.massHold;
  // It is still there after the app restarts, and after a rollback ended (or failed).
  const again = f.make(); await again.open();
  assert.deepEqual(again.config.massHold, hold);
  engine.config.serverRestore = { since: new Date(f.now()).toISOString(), jobId: 'job1' };
  await engine.releaseServerRestore({ ended: true });
  assert.deepEqual(engine.config.massHold, hold);
  await engine.massConfirm();
  assert.deepEqual([engine.config.massHold, engine.config.massCheck], [null, { folders: [docs, f.pics].map(p => ({ path: p, from: hold.beforeAt, to: hold.at })) }]);
  // The backup the hold compared goes without a comparison. The older one, free now, and the one it was compared with are
  // compared when they go: what is before or after them the person has not seen.
  fake.diff = { lines: [] }; const compared = fake.diffs.length;
  f.advance(DAY + HOUR); const next = fake.snap('3', 0); f.latest(next);
  await engine.retain();
  assert.deepEqual(fake.diffs.slice(compared), [[pinned.id, next.id], [last.id, next.id]]);
  assert.ok([pinned, before, last].every(x => f.forgot().includes(x.id)));
  // Confirming with no hold changes nothing.
  assert.equal((await engine.massConfirm()).massHold, null);
});

test('a hold the settings cannot vouch for is dropped as a whole; its name list is kept within bounds', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, root, docs } = f;
  fake.snap('1', 30); const last = fake.snap('2', 0); f.latest(last);
  fake.diff = { lines: many(700, docs, '-') };
  await engine.retain();
  assert.equal(engine.config.massHold.list.length, 500, 'the names a hold keeps for the screen');
  const file = path.join(root, 'state', 'settings.json'), saved = JSON.parse(await fs.readFile(file, 'utf8'));
  await fs.writeFile(file, JSON.stringify({ ...saved, massHold: { ...saved.massHold, beforeId: 'not-a-backup' } }));
  const reopened = f.make(); await reopened.open();
  assert.equal(reopened.config.massHold, null);
});

test('every run result says while a hold waits, a skipped one too (GPT GA10)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  fake.snap('1', 30); const last = fake.snap('2', 0); f.latest(last);
  fake.diff = { lines: many(600, docs, '-') };
  await engine.retain();
  engine.config.automatic = false;
  assert.deepEqual(await engine.runOnce(), { outcome: 'skipped', reason: 'off', mass: 1 });
  await engine.massConfirm();
  assert.deepEqual(await engine.runOnce(), { outcome: 'skipped', reason: 'off' });
});

test('「지워지기 전으로 되살리기」 restores the folders that changed from the backup the hold keeps — or a part of one (GPT GA11)', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs, root } = f;
  const out = path.join(root, 'output');
  await assert.rejects(engine.restoreMassBefore({ parent: out }), e => e.code === 'NOT_FOUND');
  const before = fake.snap('1', 30), last = fake.snap('2', 0); f.latest(last);
  fake.diff = { lines: many(600, docs, '-') };
  await engine.retain();
  const tar = async (...entries) => { const pack = require('tar-stream').pack(); for (const [name, body] of entries) pack.entry({ name, size: body.length }, body); pack.finalize(); const parts = []; for await (const c of pack) parts.push(c); return Buffer.concat(parts); };
  const label = `01-${path.basename(docs)}`;
  fake.dumps[`${before.id}:${treeOf(docs)}`] = await tar(['a.txt', Buffer.from('abc')]);
  fake.ls[`${before.id}:${treeOf(docs)}`] = [{ message_type: 'node', path: '/a.txt', type: 'file', size: 3 }];
  await engine.restoreMassBefore({ parent: out });
  const done = engine.config.lastRestore;
  assert.deepEqual(done.mass, { beforeId: before.id, beforeAt: before.time, folder: null, sub: '' }, 'every folder that changed (화면 세션 E31)');
  assert.equal(await fs.readFile(path.join(done.path, label, 'a.txt'), 'utf8'), 'abc');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(done.path, '복구경로.json'), 'utf8')), [{ original: docs, restoredFolder: label, backupAt: before.time }], 'only the folder that changed');
  // A part of it, when the whole is past the list limit.
  fake.dumps[`${before.id}:${treeOf(docs)}/안쪽`] = await tar(['b.txt', Buffer.from('bb')]);
  fake.ls[`${before.id}:${treeOf(docs)}/안쪽`] = [{ message_type: 'node', path: '/b.txt', type: 'file', size: 2 }];
  await engine.restoreMassBefore({ parent: out, folder: docs, sub: '안쪽' });
  assert.equal(await fs.readFile(path.join(engine.config.lastRestore.path, label, '안쪽', 'b.txt'), 'utf8'), 'bb');
  assert.deepEqual(engine.config.lastRestore.mass, { beforeId: before.id, beforeAt: before.time, folder: docs, sub: '안쪽' }, 'that part (E31)');
  // A failure says what it was taking: the screen tells one folder's failure from the whole's (E31).
  await assert.rejects(engine.restoreMassBefore({ parent: docs, folder: docs, sub: '안쪽' }), e => e.code === 'OUTPUT_UNSAFE');
  assert.deepEqual([engine.config.lastRestoreError.code, engine.config.lastRestoreError.mass], ['OUTPUT_UNSAFE', { folder: docs, sub: '안쪽' }]);
  await assert.rejects(engine.restoreMassBefore({ parent: docs }), e => e.code === 'OUTPUT_UNSAFE');
  assert.deepEqual(engine.config.lastRestoreError.mass, { folder: null, sub: '' });
  await engine.restoreMassBefore({ parent: out });
  assert.equal(engine.config.lastRestoreError, null, 'cleared by the next one that works');
  assert.ok(engine.config.massHold, 'the hold stays until the person says they are done');
  // The backup a hold keeps may be a partial one (r2 GA2).
  const g = await fixture();
  const part = g.fake.snap('1', 30, { tags: ['partial'] }); g.latest(g.fake.snap('2', 0));
  g.fake.diff = { lines: many(600, g.docs, '-') };
  await g.engine.retain();
  assert.equal(g.engine.config.massHold.beforeId, part.id);
  g.fake.dumps[`${part.id}:${treeOf(g.docs)}`] = await tar(['a.txt', Buffer.from('abc')]);
  g.fake.ls[`${part.id}:${treeOf(g.docs)}`] = [{ message_type: 'node', path: '/a.txt', type: 'file', size: 3 }];
  await g.engine.restoreMassBefore({ parent: path.join(g.root, 'output') });
  assert.equal(await fs.readFile(path.join(g.engine.config.lastRestore.path, `01-${path.basename(g.docs)}`, 'a.txt'), 'utf8'), 'abc');
});

test('a backup whose folders cannot be told apart is compared whole, so one odd backup does not stop every clean-up after it', { skip: windowsPaths }, async () => {
  const f = await fixture(), { engine, fake, docs } = f;
  const odd = fake.snap('1', 30, { paths: [] }), last = fake.snap('2', 0); f.latest(last);
  fake.diff = { lines: [] };
  await engine.retain();
  assert.deepEqual([fake.diffs, f.forgot()], [[[odd.id, last.id]], [odd.id]]);
  const g = await fixture();
  g.fake.snap('1', 30, { paths: [] }); const now = g.fake.snap('2', 0); g.latest(now);
  g.fake.diff = { lines: many(600, g.docs, '-') };
  await g.engine.retain();
  assert.deepEqual([g.engine.config.massHold?.removed, g.engine.config.massHold?.path], [600, null]);
  // Its names, which no folder holds, are still there when the app opens the settings again (r2 GA4).
  const again = g.make(); await again.open();
  assert.deepEqual(again.config.massHold.list.slice(0, 1), [{ folder: null, name: `${treeOf(g.docs)}/f0.txt`, kind: 'removed' }]);
  assert.equal(again.config.massHold.list.length, 500);
});
