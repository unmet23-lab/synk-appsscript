'use strict';
// 「새 PC로 옮겨 오기」 end to end with a real restic repository (STAGE1_DESIGN.md 4.6, T16 on this PC): synthetic data in a
// fake old profile → the engine's backup → a move into a fake new profile → every file compared by SHA-256 with its source.
// Also: nothing replaced, 「(복구본)」, 「이미 있음」, 따로 둔 것, links and odd names skipped, a junction on the new PC not
// followed, an interrupted move resumed without copies, and 「OneDrive에 없거나 다른 것만」. Needs the pinned restic in
// SOLO_BACKUP_RESTIC; SWB_MOVE_HOST (move-host/WorkBackupMoveHost.exe) runs it through the real Rust host.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path').win32;
const crypto = require('node:crypto');
const { BackupEngine } = require('../engine/src/engine.cjs');
const { Move, Ledger } = require('../engine/src/move-restore.cjs');
const { moveHost } = require('./move-host.cjs');

const restic = process.env.SOLO_BACKUP_RESTIC;
const key = crypto.randomBytes(32);
const secretStore = {
  encrypt(value) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, c.update(value), c.final(), c.getAuthTag()]); },
  decrypt(value) { const d = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); d.setAuthTag(value.subarray(-16)); return Buffer.concat([d.update(value.subarray(12, -16)), d.final()]).toString(); }
};
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const long = p => '\\\\?\\' + p;
function write(p, bytes) { fs.mkdirSync(long(path.dirname(p)), { recursive: true }); fs.writeFileSync(long(p), bytes); return p; }
function walk(root, out = []) {
  for (const e of fs.readdirSync(long(root), { withFileTypes: true })) {
    const p = path.join(root, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const shaOf = p => digest(fs.readFileSync(long(p)));
function snapshot(profile, extra = {}) {
  const k = name => ({ path: path.join(profile, name), oneDrive: false, synced: false });
  return { schema: 1, computer: 'TEST', known: { profile: { path: profile }, documents: k('Documents'), desktop: k('Desktop'), pictures: k('Pictures'), music: k('Music'), videos: k('Videos'), downloads: k('Downloads'),
    roaming: k('AppData\\Roaming'), local: k('AppData\\Local'), ...extra.known }, oneDrive: extra.oneDrive || [], syncRoots: [], drives: [{ letter: 'C', label: '', fileSystem: 'NTFS' }] };
}

test('move: synthetic old PC → backup → new PC, every file by SHA-256, nothing replaced, resumable', { skip: !restic, timeout: process.env.SOLO_BACKUP_SLOW_TEST === '1' ? 3600000 : 1800000 }, async t => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-move-')));
  t.after(() => fs.rmSync(long(root), { recursive: true, force: true }));
  const oldProfile = path.join(root, 'old', 'Users', '김옛사람'), newProfile = path.join(root, 'new', 'Users', '이새사람');
  const docs = path.join(oldProfile, 'Documents'), desk = path.join(oldProfile, 'Desktop'), dot = path.join(oldProfile, '.claude'), projects = path.join(root, 'old', 'Projects');
  const source = {};
  const put = (p, bytes) => { source[p] = digest(write(p, bytes) && bytes); };
  put(path.join(docs, '한글 문서.txt'), Buffer.from('업무 자료 첫 판'));
  put(path.join(docs, 'empty.txt'), Buffer.alloc(0));
  put(path.join(docs, 'binary.dat'), crypto.randomBytes(300 * 1024));
  put(path.join(docs, 'desktop.ini'), Buffer.from('[.ShellClassInfo]'));
  put(path.join(docs, '링크 자리', 'x.txt'), Buffer.from('on the new PC this folder is a junction'));
  put(path.join(docs, 'PowerShell', 'Microsoft.PowerShell_profile.ps1'), Buffer.from('Write-Host "auto-run"'));
  let deep = docs; for (let i = 0; i < 9; i++) deep = path.join(deep, `깊은 폴더 이름 ${i} abcdefghijklmnop`);
  put(path.join(deep, '끝.txt'), Buffer.from('past 260 characters'));
  assert.ok(path.join(deep, '끝.txt').length > 260);
  put(path.join(desk, '바탕 메모.txt'), Buffer.from('desk'));
  put(path.join(dot, 'settings.json'), Buffer.from('{"hooks":{}}'));
  put(path.join(projects, 'src', 'code.js'), Buffer.from('console.log(1)'));
  fs.mkdirSync(path.join(docs, '빈 폴더'));
  // Skipped by the move: a junction (restic records a link). Names Windows cannot hold are in move-plan.test.cjs.
  fs.mkdirSync(path.join(oldProfile, 'Music')); fs.symlinkSync(path.join(oldProfile, 'Music'), path.join(docs, 'My Music'), 'junction');

  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: restic, secretStore });
  await engine.open();
  fs.mkdirSync(path.join(root, 'repo'));
  await engine.setup({ sources: [docs, desk, dot, projects], parent: path.join(root, 'repo') });
  fs.mkdirSync(path.join(root, 'keys'));
  await engine.saveRecoveryKit(path.join(root, 'keys', 'kit.json'));
  await engine.backupNow();
  assert.equal(engine.config.health.status, 'ok');
  const from = engine.config.vaultId;

  // The new PC: its own profile, two files already there, and a junction where the backup has a plain folder.
  const newDocs = path.join(newProfile, 'Documents');
  fs.mkdirSync(newDocs, { recursive: true }); fs.mkdirSync(path.join(newProfile, 'Desktop'));
  write(path.join(newDocs, '한글 문서.txt'), Buffer.from('새 PC에서 이미 고친 다른 내용'));
  fs.copyFileSync(long(path.join(docs, 'binary.dat')), long(path.join(newDocs, 'binary.dat')));
  const elsewhere = path.join(root, 'elsewhere'); fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, path.join(newDocs, '링크 자리'), 'junction');
  const old = snapshot(oldProfile), now = snapshot(newProfile);
  const host = moveHost({ snapshot: now }); t.after(() => host.close());
  const ledgerDir = path.join(root, 'state', 'migration');
  t.diagnostic(`host: ${host.real ? 'Rust (SWB_MOVE_HOST)' : 'stand-in'}`);

  const where = original => {
    const r = p => p.slice(oldProfile.length + 1);
    if (original.startsWith(path.join(docs, 'PowerShell'))) return path.join(newProfile, '옮겨 온 자료', '따로 둔 것', '문서', original.slice(docs.length + 1));
    if (original.startsWith(dot)) return path.join(newProfile, '옮겨 온 자료', '따로 둔 것', r(original));
    // The old system drive is whatever drive the temporary folder is on (C: here, D: on the Windows CI runner).
    if (original.startsWith(projects)) return path.join(newProfile, '옮겨 온 자료', `${projects[0].toUpperCase()} 드라이브`, original.slice(3));
    return path.join(newProfile, r(original));
  };

  await t.test('preview: each folder goes back in place by default, the dot folder to 따로 둔 것', async () => {
    const view = await new Move({ engine, host, from, old, now, moveId: '0000aaaa', ledgerDir }).preview();
    assert.deepEqual(view.folders.map(f => [path.basename(f.original), f.mode]).sort(), [['.claude', 'original'], ['Desktop', 'original'], ['Documents', 'original'], ['Projects', 'original']]);
    assert.ok(view.files >= 10 && view.volumes.length === 1 && view.volumes[0].enough === true);
  });

  let interrupted;
  await t.test('an interrupted move resumes, removes its own leftover, and makes no copies', async () => {
    // restic dies on the second folder's stream.
    let dumps = 0;
    const dying = Object.create(engine);
    dying.run = (args, options) => (args[0] === 'dump' && ++dumps === 2) ? Promise.reject(new Error('restic killed')) : engine.run(args, options);
    interrupted = new Move({ engine: dying, host, from, old, now, moveId: '1111bbbb', ledgerDir });
    await assert.rejects(interrupted.run(), /restic killed/);
    const lines = await Ledger.read(path.join(ledgerDir, '1111bbbb.jsonl'));
    assert.ok(lines.some(l => l.t === 'head') && lines.some(l => l.t === 'done') && !lines.some(l => l.t === 'end'));
    // A temporary file a crash left in a folder the ledger names.
    const dir = lines.find(l => l.t === 'dir').path;
    fs.writeFileSync(long(path.join(dir, '~synk-1111bbbb-999.part')), 'half');
    const again = new Move({ engine, host, from, old, now, moveId: '1111bbbb', ledgerDir });
    const result = await again.run();
    assert.equal(result.removedTemp, 1);
    assert.ok(!fs.existsSync(long(path.join(dir, '~synk-1111bbbb-999.part'))));
    // Both runs together, from the ledger.
    const all = (await Ledger.read(path.join(ledgerDir, '1111bbbb.jsonl'))).filter(l => l.t === 'f');
    interrupted = { counts: {}, items: all.map(l => ({ result: l.r, name: l.n, c: l.c })), complete: result.complete };
    for (const l of all) interrupted.counts[l.r] = (interrupted.counts[l.r] || 0) + 1;
  });

  await t.test('every backed-up file is on the new PC with its SHA-256, in place or in 따로 둔 것', async () => {
    for (const [original, hash] of Object.entries(source)) {
      if (original === path.join(docs, '한글 문서.txt')) continue; // checked below: it went beside
      if (original.startsWith(path.join(docs, '링크 자리'))) continue; // checked below: skipped
      const target = where(original);
      assert.ok(fs.existsSync(long(target)), `missing: ${target}`);
      assert.equal(shaOf(target), hash, target);
    }
    assert.ok(fs.existsSync(long(path.join(newDocs, '빈 폴더'))), `empty folders come back: ${JSON.stringify(interrupted.counts)}`);
  });

  await t.test('nothing on the new PC was replaced; other content went beside as (복구본), the same one counted', async () => {
    assert.equal(fs.readFileSync(path.join(newDocs, '한글 문서.txt'), 'utf8'), '새 PC에서 이미 고친 다른 내용');
    assert.equal(shaOf(path.join(newDocs, '한글 문서 (복구본).txt')), source[path.join(docs, '한글 문서.txt')]);
    assert.ok(interrupted.counts.same >= 1 && interrupted.counts.copy === 1, JSON.stringify(interrupted.counts));
  });

  await t.test('links and a junction on the new PC are skipped, and nothing lands where the junction points', async () => {
    const reasons = interrupted.items.filter(i => i.result === 'skip').map(i => `${path.basename(i.name)}:${i.c}`);
    assert.ok(reasons.includes('My Music:link'), reasons.join(' '));
    assert.ok(reasons.some(r => r.startsWith('x.txt:MOVE_SKIP_LINK')), reasons.join(' '));
    assert.deepEqual(fs.readdirSync(elsewhere), []);
    assert.ok(!interrupted.complete, 'skips keep the old device backups (no automatic cleanup)');
  });

  await t.test('no temporary file is left anywhere; desktop.ini is hidden again (Rust host)', async () => {
    assert.deepEqual(walk(newProfile).filter(p => /~synk-/.test(p)), []);
    if (!host.real) return;
    const attrib = require('node:child_process').execFileSync('cmd', ['/c', 'attrib', path.join(newDocs, 'desktop.ini')], { encoding: 'utf8' });
    assert.match(attrib.slice(0, 12), /H/);
  });

  await t.test('moving again changes nothing: every file is 「이미 있음」 or, put aside, still 「따로 둠」; no new copy', async () => {
    const before = walk(newProfile).length;
    const again = await new Move({ engine, host, from, old, now, moveId: '2222cccc', ledgerDir }).run();
    assert.equal(walk(newProfile).length, before);
    // A file put aside is not in its place, also when its copy aside is already there (카본 끝판 D6): the move stays
    // not complete, so the old device's backup is kept.
    assert.ok(!again.counts.copy && !again.counts.placed && again.counts.same >= 7 && again.counts.side === 2, JSON.stringify(again.counts));
    assert.equal(again.complete, false);
  });

  await t.test('a finished move started again takes over what is in place and fetches only what changed since (화면 세션 E11)', async () => {
    const before = walk(newProfile).length;
    const fetched = []; const counting = Object.create(engine);
    counting.run = (args, options) => { if (args[0] === 'dump') fetched.push(args.slice(1, 3).join(' ')); return engine.run(args, options); };
    // One file the last run found in place was touched since: it comes through the stream again and is 「이미 있음」.
    const memo = where(path.join(desk, '바탕 메모.txt')), later = new Date(Date.now() + 3600000);
    fs.utimesSync(long(memo), later, later);
    const again = await new Move({ engine: counting, host, from, old, now, moveId: '6666aaaa', ledgerDir, carryFrom: '2222cccc' }).run();
    assert.equal(walk(newProfile).length, before);
    const lines = await Ledger.read(path.join(ledgerDir, '6666aaaa.jsonl'));
    assert.equal(lines.find(l => l.t === 'head').carryFrom, '2222cccc');
    const files = lines.filter(l => l.t === 'f');
    assert.equal(again.counts.carried, files.filter(l => l.carried).length);
    assert.ok(again.counts.carried >= 7, JSON.stringify(again.counts));
    assert.deepEqual(files.filter(l => l.n === '바탕 메모.txt').map(l => [l.r, !!l.carried]), [['same', false]]);
    // The copy beside (「(복구본)」) is not where the file goes: it is fetched and found the same again.
    assert.deepEqual(files.filter(l => l.n === '한글 문서.txt').map(l => [l.r, !!l.carried]), [['same', false]]);
    // Nothing new placed; what was put aside is still put aside, so the move is still not complete.
    assert.ok(!again.counts.copy && !again.counts.placed && again.counts.side === 2 && again.complete === false, JSON.stringify(again.counts));
    // Only Desktop (its one file touched) came whole. Documents fetched what was left; .claude and Projects nothing.
    const whole = name => fetched.some(f => f.endsWith('/' + name + ' /'));
    assert.deepEqual(['Documents', 'Desktop', '.claude', 'Projects'].map(whole), [false, true, false, false], fetched.join(' | '));
    assert.ok(!fetched.some(f => /\.claude|Projects/.test(f)), fetched.join(' | '));
  });

  await t.test('the move kit goes into the backup and comes back checked (4.6 「옮겨 오기 꾸러미」)', async () => {
    const kits = require('../engine/src/move-kit.cjs');
    write(path.join(oldProfile, '.gitconfig'), Buffer.from('[user]\n\tname = 김\n'));
    const kitHost = moveHost({ snapshot: old });
    const text = await kits.buildKit({ host: (m, a) => m === 'reinstall.installed' ? Promise.resolve(['Git.Git']) : kitHost(m, a) });
    await kitHost.close();
    await kits.storeKit(engine, text);
    const loaded = await kits.loadKit(engine, from);
    assert.equal(loaded.kit.snapshot.known.profile.path, oldProfile);
    assert.deepEqual(loaded.kit.programs.winget, [{ id: 'Git.Git' }]);
    assert.ok(loaded.kit.apps.some(a => a.app === 'git'));
    // The kit is not one of the backups a move restores from.
    const view = await new Move({ engine, host, from, old, now, moveId: '4444eeee', ledgerDir }).preview();
    assert.equal(view.folders.length, 4);
  });

  await t.test('same OneDrive account: only what OneDrive lacks or holds differently goes to the new folder outside it', async () => {
    const odOld = path.join(oldProfile, 'OneDrive'), odNew = path.join(root, 'new2', 'Users', '박', 'OneDrive');
    const p2 = path.join(root, 'new2', 'Users', '박');
    const oldOd = snapshot(oldProfile, { known: { documents: { path: docs, oneDrive: true, synced: true } }, oneDrive: [{ kind: 'Personal', path: path.dirname(docs), emailSha256: 'a'.repeat(64) }] });
    const nowOd = snapshot(p2, { known: { documents: { path: path.join(odNew, 'Documents'), oneDrive: true, synced: true } }, oneDrive: [{ kind: 'Personal', path: odNew, emailSha256: 'a'.repeat(64) }] });
    // OneDrive already brought one file down with the same content, and one with other content.
    write(path.join(odNew, 'Documents', 'empty.txt'), Buffer.alloc(0));
    write(path.join(odNew, 'Documents', '한글 문서.txt'), Buffer.from('OneDrive의 다른 판'));
    const host2 = moveHost({ snapshot: nowOd }); t.after(() => host2.close());
    const move = new Move({ engine, host: host2, from, old: oldOd, now: nowOd, moveId: '3333dddd', ledgerDir });
    const view = await move.preview();
    assert.equal(view.folders.find(f => f.original === docs).mode, 'oneDriveGaps');
    const result = await move.run();
    const outside = path.join(p2, '옮겨 온 자료', '문서');
    assert.ok(!fs.existsSync(path.join(outside, 'empty.txt')), 'OneDrive has it: not fetched again');
    assert.equal(shaOf(path.join(outside, '한글 문서.txt')), source[path.join(docs, '한글 문서.txt')], 'OneDrive holds another version: the backup copy outside OneDrive');
    assert.equal(fs.readFileSync(path.join(odNew, 'Documents', '한글 문서.txt'), 'utf8'), 'OneDrive의 다른 판', 'nothing written inside OneDrive');
    assert.ok(result.counts.onedrive >= 1, JSON.stringify(result.counts));
    assert.deepEqual(walk(odNew).map(p => path.basename(p)).sort(), ['empty.txt', '한글 문서.txt']);
  });
});
