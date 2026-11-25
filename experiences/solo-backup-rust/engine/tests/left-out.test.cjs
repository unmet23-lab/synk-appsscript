'use strict';
// 새로 시작한 백업이 담지 않는 폴더(STAGE1_DESIGN.md 4.17 「다시 만들 수 있는 폴더와 로그인 폴더 빼기」): 안쪽만 빠지고 같은 이름의 보통
// 파일은 본 백업과 채움 판에 담긴다(workbackup-first-range-be-20261125-r4 GA1 · GA2). 목록 권한이 막힌 그런 폴더 하나가 백업을 부분으로
// 만들지 않는다(r3 GA1). 「읽지 못함」이 그 폴더 자체뿐일 때만 완료이고, 다른 것이 하나라도 있으면 부분이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { BackupEngine, REBUILDABLE_EXCLUDES, inSkippedDir, leftOutFolder, skippedPlace, refuseSkipped } = require('../src/engine.cjs');

const secretStore = { encrypt: (text) => Buffer.from('fixture-only:' + text), decrypt: (bytes) => bytes.toString().slice(13) };
const resticPath = process.env.SOLO_BACKUP_RESTIC;
const user = process.env.USERNAME;
const deny = (p, right) => spawnSync('icacls', [p, '/deny', `${user}:(${right})`]).status === 0;
const allow = (p) => spawnSync('icacls', [p, '/remove:d', user]);

/** 가짜 restic: 백업이 exit 3으로 끝날 때 읽지 못한 것(items — 말이 없으면 폴더 목록을 못 열었다는 말로)과 그 밖의 줄(other)을 알린다. 판은 그대로 남는다 */
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-leftout-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), keys = path.join(root, 'keys');
  await Promise.all([source, target, keys].map((p) => fs.mkdir(p)));
  await fs.writeFile(path.join(source, 'work.txt'), 'hello');
  const snapshots = [], lists = [], fills = [], fail = { items: null, cut: false, other: [] };
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath: 'fixture', secretStore, runner: async (args, opts = {}) => {
    if (args[0] === 'cat') return JSON.stringify({ id: 'd'.repeat(64) });
    if (args[0] === 'ls' && !args.includes('--recursive')) { await opts.consumeStdout(require('node:stream').Readable.from([Buffer.from('')])); return ''; }
    if (args[0] === 'diff') { await opts.consumeStdout(require('node:stream').Readable.from([Buffer.from('')])); return ''; }
    if (args[0] === 'backup') {
      const tags = args[args.indexOf('--tag') + 1].split(',');
      if (args.includes('--stdin') && args.includes('workbackup-unreadable.json')) lists.push(JSON.parse(opts.stdinText));
      if (args.includes('--files-from-raw')) fills.push((await fs.readFile(args[args.indexOf('--files-from-raw') + 1], 'utf8')).split('\0').filter(Boolean));
      snapshots.push({ id: crypto.randomBytes(32).toString('hex'), time: new Date().toISOString(), hostname: engine.config.vaultId, paths: args.includes('--') ? args.slice(args.indexOf('--') + 1) : ['/workbackup-unreadable.json'], tags, summary: { total_files_processed: 1, total_bytes_processed: 5 } });
      if (fail.items && args.includes('--')) { for (const x of fail.items) { const [item, message] = Array.isArray(x) ? x : [x, `openfile for readdirnames failed: open \\\\?\\${x}: Access is denied.`]; opts.onErrorItem?.(item, 'archival', message); } if (fail.cut) opts.onErrorItem?.(null, 'archival'); for (const [kind, text] of fail.other) opts.onErrorOther?.(kind, text); throw Object.assign(new Error('fixture partial'), { exitCode: 3 }); }
      return '';
    }
    if (args[0] === 'snapshots') { const tags = args[args.indexOf('--tag') + 1].split(','); return JSON.stringify(snapshots.filter((s) => tags.every((t) => s.tags.includes(t)))); }
    if (args[0] === 'tag') { const s = snapshots.find((x) => x.id === args.at(-1)); for (let i = 1; i < args.length - 1; i++) { if (args[i] === '--add') s.tags.push(args[++i]); else if (args[i] === '--remove') { const t = args[++i]; s.tags = s.tags.filter((x) => x !== t); } } }
    return '';
  } });
  await engine.open();
  await engine.setup({ sources: [source], parent: target });
  await engine.saveRecoveryKit(path.join(keys, 'kit.json'));
  engine.config.skipRebuildable = true;
  return { root, source, engine, fail, lists, fills, snapshots };
}

test('담지 않는 폴더의 이름: 안쪽은 빠지고, 같은 이름의 보통 파일은 빠지지 않는다(r4 GA1 · GA2)', async (t) => {
  assert.deepEqual(REBUILDABLE_EXCLUDES, ['--exclude-caches', ...['node_modules', '.ssh', '.gnupg', '.aws', '.azure'].flatMap((n) => ['--iexclude', `${n}/*`])]);
  assert.deepEqual(['D:\\w\\.aws', 'D:\\w\\fixtures\\node_modules', 'D:\\w\\.ssh\\id', 'D:\\w\\NODE_MODULES\\a.js', 'D:\\w\\my.ssh\\a'].map(inSkippedDir), [false, false, true, true, false]);
  assert.deepEqual(['D:\\w\\.aws', 'D:\\w\\x\\.ssh\\y', 'D:\\w\\node_modules', 'D:\\w'].map(skippedPlace), [true, true, true, false]);
  assert.throws(() => refuseSkipped(['D:\\w', 'D:\\w\\.ssh']), { code: 'SOURCES_SKIPPED' });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-leftout-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'a', '.ssh'), { recursive: true }); await fs.writeFile(path.join(root, '.aws'), 'plain');
  // 연결 폴더는 담지 않는 폴더 자체로 보지 않는다 — restic은 연결만 담고 가리키는 곳은 담지 않는다
  await fs.symlink(path.join(root, 'a', '.ssh'), path.join(root, 'a', '.azure'), 'junction');
  assert.deepEqual(await Promise.all([['a', '.ssh'], ['.aws'], ['a'], ['gone', '.ssh'], ['a', '.azure']].map((p) => leftOutFolder(path.join(root, ...p)))), [true, false, false, false, false]);
});

test('읽지 못한 것이 담지 않는 폴더 자체뿐이면 완료, 같은 이름의 파일이나 다른 것이 있으면 부분이다(r3 GA1)', async (t) => {
  const { source, engine, fail, lists } = await fixture(t);
  const ssh = path.join(source, 'proj', '.ssh'), nm = path.join(source, 'proj', 'node_modules'), aws = path.join(source, 'proj', '.aws'), other = path.join(source, 'locked.txt');
  await fs.mkdir(ssh, { recursive: true }); await fs.mkdir(nm); await fs.writeFile(aws, 'plain'); await fs.writeFile(other, 'x');
  fail.items = [ssh, nm, ssh];
  await engine.backupNow();
  assert.deepEqual([engine.config.lastPartial, !!engine.config.lastBackup, lists.length, engine.lastRun], [null, true, 0, 'complete']);
  // 같은 이름의 파일을 못 읽은 것은 빠뜨린 것이다 — 부분으로 남고 목록에는 그 파일만 든다
  const locked = (p) => [p, `open \\\\?\\${p}: Access is denied.`];
  fail.items = [ssh, locked(aws)];
  await engine.backupNow();
  assert.equal(engine.lastRun, 'partial');
  assert.deepEqual(lists.at(-1), { v: 1, unreadable: [aws], cut: false });
  // 다른 프로그램이 쥔 파일과 함께면 그 파일만 목록에 든다
  fail.items = [ssh, locked(other)];
  await engine.backupNow();
  assert.deepEqual(lists.at(-1), { v: 1, unreadable: [other], cut: false });
  // 담지 않는 폴더라도 목록을 못 연 것이 아닌 오류면(restic이 파일로 봤다가 다시 열 때 폴더로 바뀐 것 따위) 빠뜨린 것이다(0.7.5 GPT GA2)
  fail.items = [nm, [ssh, 'file type changed'], ssh];
  await engine.backupNow();
  assert.deepEqual([engine.lastRun, lists.at(-1)], ['partial', { v: 1, unreadable: [ssh, ssh], cut: false }]);
  // 다 세지 못한 목록은 완료로 치지 않는다
  fail.items = [ssh]; fail.cut = true;
  await engine.backupNow();
  assert.deepEqual([engine.lastRun, lists.at(-1)], ['partial', { v: 1, unreadable: [ssh], cut: true }]);
  // 경로를 말하지 않은 오류나 restic이 찾지 못한 지킬 폴더가 함께 있으면 무엇을 못 읽었는지 모른다 — 완료로 치지 않는다(Fable 설계 검토 · 0.7.5 GPT GA1)
  fail.cut = false;
  for (const line of [['error', '{"message_type":"error"}'], ['text', 'E:\\gone does not exist, skipping']]) {
    fail.other = [line];
    await engine.backupNow();
    assert.deepEqual([engine.lastRun, lists.at(-1)], ['partial', { v: 1, unreadable: [ssh], cut: true }]);
    assert.match(engine.config.warning, /^이번 백업에서 읽지 못한 것이 무엇인지 다 확인하지 못했습니다/);
  }
  // 경로 없는 오류는 다른 것이 적혀 있어도 「다 세지 못함」이다(GA5). 캐시 표식 파일을 못 읽었다는 말은 빠뜨린 것이 아니다
  fail.other = [['error', '{}']]; fail.items = [ssh, locked(other)];
  await engine.backupNow();
  assert.deepEqual(lists.at(-1), { v: 1, unreadable: [other], cut: true });
  // 글 줄과 다른 읽지 못한 것이 함께면 그것만 적는다 — 찾지 못한 지킬 폴더는 판의 폴더 목록에서 빠져 앞 판이 남는다
  fail.other = [['text', 'E:\\gone does not exist, skipping']];
  await engine.backupNow();
  assert.deepEqual([lists.at(-1), /^다른 프로그램이 쓰는 중인 파일 1개를/.test(engine.config.warning)], [{ v: 1, unreadable: [other], cut: false }, true]);
  fail.other = [['text', 'could not read signature from exclusion tagfile "D:\\w\\CACHEDIR.TAG": unexpected EOF']]; fail.items = [ssh];
  await engine.backupNow();
  assert.equal(engine.lastRun, 'complete');
  // 다섯 이름의 연결 폴더를 못 읽은 것도 부분이다
  fail.other = [];
  const linkDir = path.join(source, 'proj', '.azure'); await fs.symlink(ssh, linkDir, 'junction');
  fail.items = [ssh, [linkDir, 'openfile for readdirnames failed: x']];
  await engine.backupNow();
  assert.deepEqual([engine.lastRun, lists.at(-1).unreadable], ['partial', [linkDir]]);
  // 이 표시가 없는 설정(이 판 전에 시작한 백업)은 전과 같다 — 경로 없는 오류도 목록을 바꾸지 않는다
  fail.items = [ssh, nm, locked(aws)]; fail.other = [['error', '{}'], ['text', 'x']]; engine.config.skipRebuildable = false;
  await engine.backupNow();
  assert.deepEqual([engine.lastRun, lists.at(-1)], ['partial', { v: 1, unreadable: [ssh, nm, aws], cut: false }]);
});

test('채움 판은 부분 판 목록의 담지 않는 폴더를 묻지 않고, 같은 이름의 보통 파일만 묻는다(fillNow)', { skip: process.platform !== 'win32' && '채움의 연결 뿌리는 드라이브 글자로 맞춘다 — GitHub Windows에서 돈다(tools/conditional-qa)' }, async (t) => {
  const { root, source, engine, fail, lists, fills } = await fixture(t);
  const ssh = path.join(source, 'proj', '.ssh'), nm = path.join(source, 'proj', 'node_modules'), aws = path.join(source, 'proj', '.aws'), id = path.join(ssh, 'id');
  await fs.mkdir(ssh, { recursive: true }); await fs.mkdir(nm); await fs.writeFile(aws, 'plain'); await fs.writeFile(id, 'key');
  // 앞 판(이름째 무늬)이나 표시 없는 설정이 남긴 부분 판 목록
  fail.items = [ssh, nm, aws, id]; engine.config.skipRebuildable = false;
  await engine.backupNow();
  assert.deepEqual(lists.at(-1).unreadable, [ssh, nm, aws, id]);
  const link = path.join(root, 'link'), through = (p) => path.join(link, p.slice(3));
  for (const p of [ssh, nm]) await fs.mkdir(through(p), { recursive: true });
  for (const p of [aws, id]) await fs.writeFile(through(p), 'plain');
  const links = [{ volume: source.slice(0, 2).toUpperCase(), root: link }];
  fail.items = null; engine.config.skipRebuildable = true;
  const r = await engine.fillNow({ links });
  assert.deepEqual([r.outcome, r.asked, fills.at(-1)], ['fill', 1, [through(aws)]]);
});

/** 다른 프로그램처럼 나눠 쓰지 않게 쥔다(파일 · 폴더). 접근 권한이 아니라 공유로 막히므로 관리자 권한의 restic도 열지 못한다 */
async function hold(holds, p) {
  const script = `$s='[DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateFileW(string n,uint a,uint s,IntPtr p,uint d,uint f,IntPtr t);';`
    + `$k=Add-Type -MemberDefinition $s -Name K -Namespace H -PassThru;$h=$k::CreateFileW('${p.replaceAll("'", "''")}',1,0,[IntPtr]::Zero,3,0x02000000,[IntPtr]::Zero);`
    + `if($h -eq [IntPtr](-1)){'fail'}else{'held'};[Console]::In.ReadLine()|Out-Null`;
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const release = async () => { if (!child.stdin.writableEnded) child.stdin.end('\n'); if (child.exitCode === null) await new Promise((y) => child.once('exit', y)); };
  holds.push(release);
  const told = await new Promise((y) => { let s = ''; child.stdout.on('data', (b) => { s += b; if (/held|fail/.test(s)) y(s.trim()); }); child.once('exit', () => y('exit')); });
  assert.equal(told, 'held', p);
  return release;
}

test('고정 판 restic: 같은 이름의 보통 파일은 본 백업과 채움 목록에 담기고, 목록이 막힌 .ssh는 백업을 부분으로 만들지 않는다', { skip: (!resticPath || process.platform !== 'win32') && 'SOLO_BACKUP_RESTIC is not set or this is not Windows', timeout: 300000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-leftout-real-')), denied = [], holds = [];
  // 쥔 것을 놓고, 막은 것을 푼 뒤에 지운다 — 단언이 실패해도 같은 차례로
  t.after(async () => { for (const release of holds) await release(); for (const p of denied) allow(p); await fs.rm(root, { recursive: true, force: true }); });
  const source = path.join(root, '작업 자료'), target = path.join(root, '백업'), keys = path.join(root, '키');
  await Promise.all([source, target, keys].map((p) => fs.mkdir(p)));
  const ssh = path.join(source, 'proj', '.ssh'), aws = path.join(source, 'proj', '.aws');
  await fs.mkdir(ssh, { recursive: true }); await fs.writeFile(path.join(ssh, 'id'), 'key');
  await fs.mkdir(path.join(source, 'proj', 'node_modules', 'pkg'), { recursive: true }); await fs.writeFile(path.join(source, 'proj', 'node_modules', 'pkg', 'a.js'), 'x');
  await fs.mkdir(path.join(source, 'fixtures')); await fs.writeFile(path.join(source, 'fixtures', 'node_modules'), 'a plain file');
  await fs.writeFile(aws, 'a plain file'); await fs.writeFile(path.join(source, 'work.txt'), 'work');
  const engine = new BackupEngine({ stateDir: path.join(root, 'state'), resticPath, secretStore });
  await engine.open();
  await engine.setup({ sources: [source], parent: target });
  await engine.saveRecoveryKit(path.join(keys, 'kit.json'));
  engine.config.skipRebuildable = true;
  // 백업이 끝난 코드 — 코드 3을 지나지 않으면 이 시험은 아무것도 보지 못한다(Fable 설계 검토 · 0.7.5 GPT GB1)
  const codes = [], run = engine.run.bind(engine);
  engine.run = async (args, opts) => { try { return await run(args, opts); } catch (e) { if (args[0] === 'backup') codes.push(e.exitCode); throw e; } };
  const backup = async () => { codes.length = 0; await engine.backupNow(); return [codes.join(), engine.lastRun]; };
  const nodes = async (id, args = []) => { const out = []; await engine.run(['ls', '--json', id, ...args], { consumeStdout: async (s) => { let text = ''; for await (const b of s) text += b; for (const l of text.trim().split('\n').filter(Boolean)) { const n = JSON.parse(l); if (n.path) out.push(n.path); } } }); return out; };
  const list = async () => { const [p] = await engine.snapshots(['partial']), [m] = await engine.snapshots([p.tags.find((x) => x.startsWith('run:')), 'meta']); return JSON.parse(await engine.run(['dump', m.id, '/workbackup-unreadable.json'])); };
  // 다른 프로그램이 쥔 .ssh 폴더: 관리자 권한에서도 restic이 목록을 열지 못해 코드 3이다 — 완료로 끝나고 보통 파일은 담긴다
  let release = await hold(holds, ssh);
  assert.deepEqual(await backup(), ['3', 'complete']);
  await release();
  assert.deepEqual([engine.config.lastPartial, engine.config.lastBackup.files > 0], [null, true]);
  const files = (await nodes(engine.config.lastBackup.id)).filter((p) => /작업 자료\//.test(p)).map((p) => p.replace(/^.*작업 자료\//, ''));
  for (const p of ['proj/.aws', 'fixtures/node_modules', 'work.txt']) assert.ok(files.includes(p), `${p} is in the backup`);
  for (const p of ['proj/.ssh/id', 'proj/node_modules/pkg', 'proj/node_modules/pkg/a.js']) assert.ok(!files.includes(p), `${p} is left out`);
  // 목록 권한이 막힌 .ssh(r3 GA1). 관리자 권한의 restic은 권한을 넘어 읽을 수 있어 코드는 보통 권한에서만 본다
  const admin = /S-1-16-12288/.test(spawnSync('whoami', ['/groups'], { encoding: 'utf8' }).stdout);
  assert.ok(deny(ssh, 'RD')); denied.push(ssh);
  await assert.rejects(fs.readdir(ssh), '목록이 실제로 막혔다');
  const blocked = await backup();
  assert.equal(blocked[1], 'complete');
  if (admin) t.diagnostic(`관리자 권한: 목록 권한이 막힌 .ssh에서 restic 코드 ${blocked[0] || 0}`); else assert.equal(blocked[0], '3');
  // 첫 판에 없던 같은 이름의 보통 파일을 못 읽으면 빠뜨린 것이다 — 부분 판이고 목록에는 그 파일만 든다(0.7.5 GPT GB2)
  const azure = path.join(source, 'proj', '.azure'); await fs.writeFile(azure, 'a plain file');
  release = await hold(holds, azure);
  assert.deepEqual(await backup(), ['3', 'partial']);
  assert.deepEqual([(await list()).unreadable, (await list()).cut], [[azure], false]);
  await release();
  // restic이 찾지 못한 지킬 폴더(백업을 시작한 뒤 뽑은 드라이브)가 있으면 막힌 .ssh 말고 읽지 못한 것이 없어도 완료로 치지 않는다(0.7.5 GPT GA1)
  allow(ssh); denied.splice(denied.indexOf(ssh), 1);
  release = await hold(holds, ssh);
  const sourcesNow = engine.sourcesNow.bind(engine), gone = path.join(root, '뽑은 드라이브');
  engine.sourcesNow = async () => { const r = await sourcesNow(); return { ...r, present: [...r.present, gone] }; };
  assert.deepEqual(await backup(), ['3', 'partial']);
  assert.equal((await list()).cut, true);
  engine.sourcesNow = sourcesNow;
  await release();
  // 채움 판은 목록의 파일을 빼기 규칙 없이 담는다 — 엔진이 거른 뒤의 보통 파일이 담긴다
  const fill = path.join(root, 'fill.list'), plain = [aws, path.join(source, 'fixtures', 'node_modules')];
  await fs.writeFile(fill, plain.map((p) => p + '\0').join(''));
  for (const p of plain) assert.equal(inSkippedDir(p) || await leftOutFolder(p), false, `${p} is asked for in a fill`);
  await engine.run(['backup', ...REBUILDABLE_EXCLUDES, '--files-from-raw', fill, '--host', 'fill-probe', '--tag', 'fill-probe']);
  const filled = JSON.parse(await engine.run(['snapshots', '--json', '--tag', 'fill-probe']))[0];
  const held = (await nodes(filled.id)).map((p) => path.posix.basename(p));
  assert.ok(held.includes('.aws') && held.includes('node_modules'));
});
