'use strict';
// 솔리오 「원클릭」(11-23)의 본체 쪽(src/solio-oneclick.cjs, src/solio-backup.cjs의 oneClick · snapshot)과 판의 글(renderer/solio-backup-model.mjs) 시험.
// 설계: docs/디자인/솔리오_원클릭_20261123/PC앱_옮기기.md(Fable 설계 검토 반영). 엔진 쪽 요청 처리기(engine/src/solio.cjs SolioFiles)로
// 우리가 쓴 run-now 요청을 실제로 가져가 답하게 해 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const B = require('../src/solio-backup.cjs');
const O = require('../src/solio-oneclick.cjs');

const ROOT = path.join(__dirname, '..', '..');
const ENGINE = path.join(ROOT, 'experiences', 'solo-backup-rust');
const engineSolio = require(path.join(ENGINE, 'engine', 'src', 'solio.cjs'));
const ME = { synk_user_id: 'test-owner-0001' };
const OTHER = { synk_user_id: 'someone-else-0002' };
const MINE = [crypto.createHash('sha256').update(B.PREVIEW_SALT + ME.synk_user_id).digest('hex'), crypto.createHash('sha256').update(B.PREVIEW_SALT + OTHER.synk_user_id).digest('hex')];
const MARK = 'C:\\Users\\sentinel\\비밀 고객 폴더';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'solio-oneclick-'));
const SAFE = { v: 1, engine: '0.7.0', state: 'safe', lastBackupAt: new Date(Date.now() - 3600e3).toISOString(), proof: { at: new Date(Date.now() - 3 * 86400e3).toISOString(), result: 'passed' }, attention: [], job: null, folders: 4, bytes: 53687091200, writer: true, nextRunAt: new Date(Date.now() + 1800e3).toISOString(), writtenAt: new Date().toISOString() };
function appdata({ status = SAFE, space } = {}) {
  const dir = temp(), solio = path.join(dir, 'SynkWorkBackup', 'solio');
  fs.mkdirSync(path.join(solio, 'requests'), { recursive: true });
  fs.mkdirSync(path.join(solio, 'results'), { recursive: true });
  if (status) fs.writeFileSync(path.join(solio, 'status.json'), JSON.stringify(status));
  if (space !== undefined) fs.writeFileSync(path.join(solio, 'space.json'), typeof space === 'string' ? space : JSON.stringify(space));
  return { env: { APPDATA: dir }, paths: B.statusPaths({ APPDATA: dir }), root: path.join(dir, 'SynkWorkBackup') };
}
/* 엔진 설치 확인과 요청 작업 깨우기의 가짜. 깨우기는 부른 횟수만 센다 */
function fakeRun(log = []) {
  const exe = temp();
  fs.writeFileSync(path.join(exe, 'WorkBackupRun.exe'), 'x');
  return async (script, opts) => {
    if (script === O.WAKE_SCRIPT) { log.push(opts.env); return log.answer ?? 'started'; }
    return JSON.stringify({ loc: exe, ver: '0.7.0' });
  };
}
function service(a, extra = {}) {
  const log = extra.log || [];
  return { log, s: B.createSolioBackup({ platform: 'win32', env: a.env, run: fakeRun(log), previewAccounts: MINE, request: async () => { throw Object.assign(new Error('no net'), { code: 'ENOTFOUND' }); }, ...extra }) };
}
const requests = a => fs.readdirSync(a.paths.requests).filter(n => n.endsWith('.json'));
const marks = a => fs.readdirSync(a.paths.requests).filter(n => n.endsWith('.cancel'));
const tick = () => new Promise(r => setImmediate(r));

test('run-now is the engine contract exactly: the engine validates it, and no half-written file is left', () => {
  const a = appdata(), now = Date.now();
  const name = O.writeRunNow({ paths: a.paths, now, owner: 'abcd1234' });
  assert.match(name, engineSolio.NAME);
  const body = JSON.parse(fs.readFileSync(path.join(a.paths.requests, name), 'utf8'));
  assert.deepEqual(body, { v: 1, kind: 'run-now' });
  assert.deepEqual(engineSolio.validate(body, { at: now, now }), { ok: true, value: { kind: 'run-now', at: now } });
  assert.deepEqual(fs.readdirSync(a.paths.requests).filter(n => n.endsWith('.tmp')), []);
  assert.throws(() => O.writeRunNow({ paths: a.paths, now, owner: 'NOT A TAG' }), /INVALID/);
});

test('the result and reason words are the engine\'s own lists', () => {
  assert.deepEqual([...O.RESULTS].sort(), [...engineSolio.RESULTS].sort());
  assert.deepEqual([...O.REASONS].sort(), [...engineSolio.REASONS].sort());
});

test('the wake script finds the task the engine names and starts only its own run-request action; Korean words go by environment only', async () => {
  const src = fs.readFileSync(path.join(ENGINE, 'src-tauri', 'src', 'schedule.rs'), 'utf8');
  assert.equal(O.TASK_FOLDER, JSON.parse(src.match(/pub const FOLDER: &str = ("[^"]+");/)[1].replace(/\\\\/g, '\\\\')), 'same folder as schedule.rs FOLDER');
  assert.match(src, /format!\("요청 - \{\} · \{\}"/, 'the request task name the engine makes');
  assert.equal(O.TASK_PREFIX, '요청 - ');
  assert.equal(O.TASK_JOIN, ' · ');
  assert.doesNotMatch(O.WAKE_SCRIPT, /[^\x00-\x7F]/, 'no non-ASCII text on the command line');
  assert.match(O.WAKE_SCRIPT, /--run request/);
  assert.match(O.WAKE_SCRIPT, /WorkBackupRun\.exe/);
  const seen = [];
  const run = answer => async (script, opts) => { seen.push(opts.env); return answer; };
  assert.equal(await O.wakeRequestTask({ run: run('started') }), 'started');
  assert.equal(await O.wakeRequestTask({ run: run('no-task') }), 'no-task');
  assert.equal(await O.wakeRequestTask({ run: run(null) }), 'failed');
  assert.equal(await O.wakeRequestTask({ run: run('anything else') }), 'failed');
  assert.deepEqual(seen[0], { SWB_TASK_FOLDER: O.TASK_FOLDER, SWB_TASK_PREFIX: O.TASK_PREFIX, SWB_TASK_JOIN: O.TASK_JOIN });
});

test('the SID tag the wake script computes is the engine\'s sid_tag (first 6 hex of SHA-256)', () => {
  // schedule.rs: format!("{:x}", Sha256::digest(sid.as_bytes()))[..6]
  const sid = 'S-1-5-21-1111111111-2222222222-3333333333-1001';
  const tag = crypto.createHash('sha256').update(Buffer.from(sid, 'utf8')).digest('hex').slice(0, 6);
  assert.match(O.WAKE_SCRIPT, /SHA256\]::Create\(\)\.ComputeHash\(\[Text\.Encoding\]::UTF8\.GetBytes\(\$sid\)\)/);
  assert.match(O.WAKE_SCRIPT, /ToString\('x2'\).*Substring\(0,6\)/);
  assert.equal(tag.length, 6);
});

test('a press writes one run-now, wakes the task, and the engine\'s own processor answers it; the room then reads and deletes the result', async () => {
  const a = appdata(), { s, log } = service(a);
  assert.deepEqual(await s.oneClick(ME), { ok: true });
  await tick();
  assert.equal(log.length, 1, 'woke once');
  const [name] = requests(a);
  let snap = await s.snapshot(ME);
  assert.equal(snap.oneclick.stage, 'sent');
  assert.equal(snap.oneclick.woke, 'started');
  // 엔진의 요청 처리기가 가져가 「했음」으로 답한다
  const files = new engineSolio.SolioFiles({ root: a.root });
  const done = await files.process({ wants: v => v.ok && v.value.kind === 'run-now', handle: async () => ({ result: 'done' }) });
  assert.deepEqual(done, [{ kind: 'run-now', result: 'done' }]);
  snap = await s.snapshot(ME);
  assert.equal(snap.oneclick.result, 'done');
  assert.equal(snap.oneclick.stage, 'answered');
  assert.ok(!fs.existsSync(path.join(a.paths.solio, 'results', name)), 'the result is read and deleted');
  assert.deepEqual(marks(a), [], 'no cancel mark was ever made');
});

test('Fable 7: the setup-request sweep never withdraws or marks a run-now, through several snapshots and a sign-in notice', async () => {
  const a = appdata(), { s } = service(a);
  await s.oneClick(ME);
  for (let i = 0; i < 3; i++) { await s.snapshot(ME); s.accountChanged(); await tick(); }
  assert.equal(requests(a).length, 1, 'the request stays');
  assert.deepEqual(marks(a), [], 'not marked');
  assert.ok(!fs.readdirSync(a.paths.requests).some(n => n.startsWith('.owner-')), 'no owner file is held for run-now');
});

test('Fable 1: a press while the request waits re-wakes without writing again; while the engine works it is BUSY; after an answer a new press writes anew', async () => {
  const a = appdata(), { s, log } = service(a);
  await s.oneClick(ME); await tick();
  assert.deepEqual(await s.oneClick(ME), { ok: true, again: true });
  await tick();
  assert.equal(requests(a).length, 1, 'still one request');
  assert.equal(log.length, 2, 'woken again');
  // 엔진이 가져가면(claimed) 다시 누를 것이 없다
  const [name] = requests(a);
  fs.mkdirSync(path.join(a.paths.requests, 'claimed'), { recursive: true });
  fs.renameSync(path.join(a.paths.requests, name), path.join(a.paths.requests, 'claimed', name));
  assert.deepEqual(await s.oneClick(ME), { ok: false, code: 'BUSY' });
  // 답을 받은 뒤에는 새 요청을 쓴다
  fs.rmSync(path.join(a.paths.requests, 'claimed', name));
  fs.writeFileSync(path.join(a.paths.solio, 'results', name), JSON.stringify({ v: 1, result: 'rested', reason: 'battery', at: new Date().toISOString() }));
  const snap = await s.snapshot(ME);
  assert.deepEqual([snap.oneclick.result, snap.oneclick.reason], ['rested', 'battery']);
  assert.deepEqual(await s.oneClick(ME), { ok: true });
  assert.equal(requests(a).length, 1, 'a new request');
  assert.notEqual(requests(a)[0], name);
});

test('Fable 2: requests are followed in the engine\'s own order, and 「gone」 needs two reads in a row', async () => {
  const a = appdata(), { s } = service(a);
  await s.oneClick(ME);
  const [name] = requests(a);
  // 엔진이 가져가 답을 쓰고 차지를 지운 사이(세 곳 모두 없음처럼 보이는 때)라도 답을 읽는다
  fs.rmSync(path.join(a.paths.requests, name));
  fs.writeFileSync(path.join(a.paths.solio, 'results', name), JSON.stringify({ v: 1, result: 'done', at: new Date().toISOString() }));
  assert.equal((await s.snapshot(ME)).oneclick.result, 'done');
  // 답 없이 사라진 요청은 한 번 못 봐서는 「가져감」이고, 두 번째에 「사라짐」이다
  const b = appdata(), t = service(b).s;
  await t.oneClick(ME);
  fs.rmSync(path.join(b.paths.requests, requests(b)[0]));
  assert.equal((await t.snapshot(ME)).oneclick.stage, 'claimed');
  assert.equal((await t.snapshot(ME)).oneclick.stage, 'gone');
  assert.deepEqual(await t.oneClick(ME), { ok: true }, 'gone lets the person press again');
});

test('Fable 1: a request still unanswered after 24 hours 5 minutes is folded as expired', async () => {
  let clock = Date.now();
  const a = appdata(), { s } = service(a, { now: () => clock });
  await s.oneClick(ME);
  clock += 24 * 3600e3 + 5 * 60e3;
  const snap = await s.snapshot(ME);
  assert.equal(snap.oneclick.stage, 'expired');
  assert.deepEqual(await s.oneClick(ME), { ok: true });
});

test('only a protected PC can press: paused, off, moved, restore-only, not a writer, no engine and other accounts are refused', async () => {
  for (const status of [{ ...SAFE, state: 'paused' }, { ...SAFE, state: 'off' }, { ...SAFE, state: 'moved' }, { ...SAFE, state: 'restore-only' }, { ...SAFE, writer: false }, { ...SAFE, state: 'not-set-up' }]) {
    const a = appdata({ status }), { s } = service(a);
    assert.deepEqual(await s.oneClick(ME), { ok: false, code: 'NOT_NEEDED' }, status.state);
    assert.equal(requests(a).length, 0);
  }
  const a = appdata();
  const none = B.createSolioBackup({ platform: 'win32', env: a.env, run: async () => '{}', previewAccounts: MINE });
  assert.deepEqual(await none.oneClick(ME), { ok: false, code: 'NO_ENGINE' });
  const unknown = B.createSolioBackup({ platform: 'win32', env: a.env, run: async () => null, previewAccounts: MINE });
  assert.deepEqual(await unknown.oneClick(ME), { ok: false, code: 'ENGINE_UNKNOWN' });
  const { s } = service(a, { previewAccounts: [] });
  assert.deepEqual(await s.oneClick(ME), { ok: false, code: 'NOT_AVAILABLE' });
  assert.equal(requests(a).length, 0);
});

test('a press is seen only by the account that pressed it', async () => {
  const a = appdata(), { s } = service(a);
  await s.oneClick(ME);
  assert.ok((await s.snapshot(ME)).oneclick);
  assert.equal((await s.snapshot(OTHER)).oneclick, null);
});

test('a requests folder that is a junction gets no request', { skip: process.platform !== 'win32' }, async () => {
  const a = appdata(), elsewhere = temp();
  fs.rmSync(a.paths.requests, { recursive: true });
  fs.symlinkSync(elsewhere, a.paths.requests, 'junction');
  const { s } = service(a);
  assert.deepEqual(await s.oneClick(ME), { ok: false, code: 'REQUEST_FAILED' });
  assert.deepEqual(fs.readdirSync(elsewhere), []);
});

test('a result that is not a plain file is left alone; a broken one is deleted and read as unknown', async () => {
  const a = appdata(), name = `${Date.now()}-abcd1234ffffffffffffffff.json`;
  fs.mkdirSync(path.join(a.paths.solio, 'results', name));
  assert.equal(await O.takeResult({ paths: a.paths, name }), null);
  assert.ok(fs.statSync(path.join(a.paths.solio, 'results', name)).isDirectory());
  const other = `${Date.now()}-abcd1234eeeeeeeeeeeeeeee.json`;
  fs.writeFileSync(path.join(a.paths.solio, 'results', other), '{not json');
  assert.deepEqual(await O.takeResult({ paths: a.paths, name: other }), { result: 'unknown', reason: null, at: null });
  assert.ok(!fs.existsSync(path.join(a.paths.solio, 'results', other)));
  const odd = `${Date.now()}-abcd1234dddddddddddddddd.json`;
  fs.writeFileSync(path.join(a.paths.solio, 'results', odd), JSON.stringify({ v: 1, result: 'exploded', reason: MARK }));
  assert.deepEqual(await O.takeResult({ paths: a.paths, name: odd }), { result: 'unknown', reason: null, at: null });
});

/* 공간 보고서의 모든 칸에 표식을 넣은 판 */
function markedSpace() {
  const m = MARK;
  return {
    v: 1, report: m, createdAt: new Date().toISOString(), lap: { startedAt: m, finishedAt: new Date(Date.now() - 86400e3).toISOString(), days: 3 }, scanning: null, lastAccess: m,
    drives: [{ drive: 'C', size: 1022880641024, free: 126916279910, growthPerDay: 2254857830, startLineGb: 100, startLine: m, daysToStartLine: 9 }, { drive: m, size: 1, free: 1 }, { drive: 'D', size: 2048407130112, free: 1296023822336, growthPerDay: null, startLineGb: 150, daysToStartLine: null }],
    grewSince: m, grew: [{ path: m, name: m, grew: 1, bytes: 2 }],
    candidates: [
      { n: 1, grade: 'auto', kind: 'temp', bytes: 12992733184, reason: 'old-temp', name: m, path: m },
      { n: 2, grade: 'suggest', kind: 'worktree', bytes: 7516192768, reason: 'worktree-clean', name: m, path: m },
      { n: 3, grade: 'view', kind: 'worktree', bytes: 9, reason: 'ai-app-copy', name: m, path: m },
      { n: 4, grade: m, kind: 'temp', bytes: 5, reason: 'x', name: m, path: m },
      { n: 5, grade: 'view', kind: m, bytes: 7, reason: m, name: m, path: m },
      { n: 6, grade: 'auto', kind: 'node_modules', bytes: 3, reason: m, name: m, path: m },
    ],
  };
}

test('Fable 6: the space report gives sums only — no field of it, path or not, reaches answers or the console', async () => {
  const said = [], keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(keep)) console[k] = (...args) => said.push(args.map(String).join(' '));
  let answers = [];
  try {
    for (const space of [markedSpace(), `{"v":1,"candidates":[{"path":"${MARK.replace(/\\/g, '\\\\')}"`]) {
      const a = appdata({ space }), { s } = service(a);
      answers.push(await s.snapshot(ME), await s.oneClick(ME), await s.snapshot(ME));
    }
  } finally { Object.assign(console, keep); }
  const text = JSON.stringify([answers, said]);
  assert.ok(!text.includes('sentinel') && !text.includes('비밀 고객'), text.slice(0, 400));
  const space = answers[0].space;
  assert.deepEqual(space.drives, [{ letter: 'C', size: 1022880641024, free: 126916279910, growthPerDay: 2254857830, startLineGb: 100, daysToStartLine: 9 },
    { letter: 'D', size: 2048407130112, free: 1296023822336, growthPerDay: null, startLineGb: 150, daysToStartLine: null }], 'every drive, the bad drive letter dropped');
  assert.deepEqual(space.groups.map(g => `${g.grade}|${g.group}|${g.count}`), ['auto|temp|1', 'auto|build|1', 'suggest|worktree|1', 'view|ai-app-copy|1', 'view|other|1']);
  assert.ok(space.groups.every(g => O.GROUPS.includes(g.group) && O.GRADES.includes(g.grade)));
  assert.deepEqual(answers[3].space, { missing: false, invalid: true }, 'a broken report is one word');
  // 경로를 읽는 곳은 solio-oneclick.cjs 하나다. 서비스와 화면 글은 보고서 칸 이름을 다루지 않는다
  for (const file of ['src/solio-backup.cjs', 'renderer/solio-backup-model.mjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(src, /space\.json|candidates|\.path\b/, file);
  }
});

test('a space report over 1MB, behind a junction, or unchanged is not parsed again', async () => {
  const a = appdata({ space: { ...markedSpace(), pad: 'x'.repeat(1024 * 1024) } });
  assert.deepEqual(await O.readSpace({ paths: a.paths }), { format: 'invalid' });
  const b = appdata({ space: markedSpace() }), cache = { key: null, read: null };
  const first = await O.readSpace({ paths: b.paths, cache });
  let opened = 0;
  const io = { ...fs.promises, open: (...args) => { opened++; return fs.promises.open(...args); } };
  const again = await O.readSpace({ paths: b.paths, fsImpl: io, cache });
  assert.equal(opened, 0, 'same size and time: not opened again');
  assert.deepEqual(again, first);
  if (process.platform === 'win32') {
    // 파일 링크는 관리자 권한이 들어 폴더 연결점(정션)으로 잰다: solio 폴더가 다른 곳을 가리키면 읽지 않는다
    const c = appdata(), real = temp();
    fs.writeFileSync(path.join(real, 'space.json'), JSON.stringify(markedSpace()));
    fs.rmSync(c.paths.solio, { recursive: true });
    fs.symlinkSync(real, c.paths.solio, 'junction');
    assert.deepEqual(await O.readSpace({ paths: c.paths }), { format: 'invalid' });
  }
});

test('the first scan still running is told apart from 「nothing to free」', () => {
  const s = O.summarizeSpace({ v: 1, createdAt: new Date().toISOString(), lap: null, scanning: { startedAt: new Date().toISOString(), days: 1 }, drives: [], candidates: [] });
  assert.equal(s.lapFinishedAt, null);
  assert.equal(s.scanningDays, 1);
  assert.deepEqual(s.drives, []);
});

test('all drives (PC 진단 설계 5.1): small recovery partitions and mirrored letters are not shown; below the line first, then the nearest day, then the letter', () => {
  const G = 1024 ** 3;
  const d = (drive, sizeGb, freeGb, line, days) => ({ drive, size: Math.round(sizeGb * G), free: Math.round(freeGb * G), growthPerDay: null, startLineGb: line, daysToStartLine: days });
  const s = O.summarizeSpace({ v: 1, createdAt: new Date().toISOString(), lap: null, candidates: [], drives: [
    d('C', 953, 97, 143, 30), d('D', 1907, 299, 150, null), d('E', 20, 1, 3, 0), d('G', 953, 97, 143, 30), d('F', 476, 40, 71, 0), d('H', 238, 60, 35, 12)] });
  assert.deepEqual(s.drives.map(x => x.letter), ['F', 'C', 'H', 'D'], 'F and C are below their lines (F reaches it sooner), then H by days, then D; E is a 20GB recovery partition; G mirrors C (Google Drive)');
  assert.deepEqual(s.hiddenDrives, [{ letter: 'E', why: 'small' }, { letter: 'G', why: 'same' }], 'what is left out is named, not dropped silently (Fable 최종 P2-4)');
  // 32GB 아래 드라이브만 있는 PC는 그 드라이브를 그대로 보인다(Fable 최종 P2-2)
  const tiny = O.summarizeSpace({ v: 1, createdAt: new Date().toISOString(), lap: null, candidates: [], drives: [d('C', 29, 3, 5, 2)] });
  assert.deepEqual([tiny.drives.map(x => x.letter), tiny.hiddenDrives], [['C'], []]);
});

test('the snapshot carries the PC app update words only, and a press asks the updater to check without waiting', async () => {
  let checks = 0;
  const appUpdate = { snapshot: () => ({ state: 'available', currentVersion: '0.5.8', latestVersion: '0.5.9', releaseId: MARK }), checkForUpdate: async () => { checks++; throw new Error('busy'); } };
  const a = appdata(), { s } = service(a, { appUpdate });
  assert.deepEqual((await s.snapshot(ME)).app, { state: 'available', current: '0.5.8', latest: '0.5.9' });
  assert.deepEqual(await s.oneClick(ME), { ok: true });
  await tick();
  assert.equal(checks, 1);
  const paused = appdata({ status: { ...SAFE, state: 'paused' } });
  const snap = await service(paused, { appUpdate }).s.snapshot(ME);
  assert.equal(snap.app, null, 'no board, no update words');
  assert.equal(snap.space, null);
});

/* ── 판의 글(renderer/solio-backup-model.mjs) ── */
const NOW = Date.parse('2026-11-23T08:00:00Z');
const GBy = 1024 ** 3;
const SPACE = { createdAt: '2026-11-23T00:20:00Z', lapFinishedAt: '2026-11-22T00:19:00Z', scanningDays: null, drive: { letter: 'C', size: 953 * GBy, free: Math.round(118.2 * GBy), growthPerDay: Math.round(2.1 * GBy), startLineGb: 100, daysToStartLine: 9 }, otherDrives: 0,
  groups: [{ grade: 'auto', group: 'temp', bytes: 12 * GBy, count: 1 }, { grade: 'suggest', group: 'worktree', bytes: 7 * GBy, count: 2 }, { grade: 'view', group: 'ai-app-copy', bytes: 300 * GBy, count: 30 }] };
const STATUS = { engine: '0.7.0', state: 'safe', lastBackupAt: '2026-11-23T07:50:00Z', proof: { at: '2026-11-20T03:00:00Z', result: 'passed' }, attention: [], job: null, folders: 4, bytes: 50 * GBy, writer: true, nextRunAt: '2026-11-23T08:50:00Z', writtenAt: '2026-11-23T07:50:00Z' };
const SNAP = (patch = {}) => ({ ok: true, available: true, view: 'status', engine: { installed: true, version: '0.7.0' }, feed: { state: 'available', version: '0.7.0' }, install: { phase: 'idle' }, status: STATUS, oneclick: null, space: SPACE, app: { state: 'current', current: '0.5.8', latest: '0.5.8' }, ...patch });
const PRESS = (agoMs, patch = {}) => ({ at: new Date(NOW - agoMs).toISOString(), wokeAt: new Date(NOW - agoMs).toISOString(), woke: 'started', stage: 'sent', result: null, reason: null, answeredAt: null, ...patch });

test('every engine answer pair has its own words, an unknown pair gets the fallback, and no words claim a deletion', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const said = new Set();
  const pairs = [['done', null], ['rested', 'battery'], ['rested', 'saver'], ['rested', 'metered'], ['rested', 'network'], ['rejected', 'paused'], ['rejected', 'moved'], ['rejected', 'restore-only'], ['rejected', 'not-set-up'], ['rejected', 'expired'], ['rejected', 'cancelled'], ['rejected', 'busy'], ['rejected', 'invalid'], ['rejected', 'version'], ['failed', 'busy'], ['failed', 'clock'], ['failed', 'interrupted'], ['failed', 'network'], ['failed', 'error'], ['confirm-in-engine', null], ['unknown', null]];
  for (const [result, reason] of pairs) {
    const v = solioBackupView(SNAP({ oneclick: PRESS(300000, { stage: 'answered', result, reason, answeredAt: new Date(NOW - 60000).toISOString() }) }), NOW);
    assert.ok(v.say && !/undefined|null/.test(v.say + v.then), `${result}|${reason}`);
    assert.equal((v.say.match(/[.!?]\s/g) || []).length, 0, `${result}|${reason}: one sentence on top`);
    said.add(v.say);
    if (result !== 'done') assert.equal(v.acts[0].label, '엔진 창 열기', `${result}|${reason} leads with the engine window`);
    assert.doesNotMatch(JSON.stringify(v), /비웠|지웠|비우는 중|지우는 중/, 'nothing says it freed space');
  }
  assert.ok(said.size >= 18, 'answers are told apart');
  const busy = solioBackupView(SNAP({ oneclick: PRESS(300000, { stage: 'answered', result: 'rejected', reason: 'busy' }), status: { ...STATUS, attention: ['signin'] } }), NOW);
  assert.doesNotMatch(busy.say, /바쁨|바빠/, 'rejected busy is not 「busy」');
  assert.equal(busy.acts[0].arg, 'signin', 'an attention word picks the engine screen');
});

test('Fable 1: after a minute without the engine taking it, the room says it waits, slows its polling and lets the person press again', async () => {
  const { solioBackupView, ONECLICK_PATIENCE } = await import('../renderer/solio-backup-model.mjs');
  const fresh = solioBackupView(SNAP({ oneclick: PRESS(5000) }), NOW);
  assert.ok(fresh.busy && fresh.board.main.disabled && fresh.board.at === 'backup');
  const late = solioBackupView(SNAP({ oneclick: PRESS(ONECLICK_PATIENCE + 1000) }), NOW);
  assert.ok(!late.busy && !late.board.main.disabled && late.board.at === null);
  assert.match(late.say, /부탁해 두었습니다/);
  assert.match(late.then, /다음 매시 백업/);
  for (const woke of ['no-task', 'failed']) {
    const v = solioBackupView(SNAP({ oneclick: PRESS(3000, { woke }) }), NOW);
    assert.ok(!v.busy, woke);
    assert.match(v.board.steps[0].mid, /다음 매시 백업 때 합니다/);
  }
  const gone = solioBackupView(SNAP({ oneclick: PRESS(300000, { stage: 'gone' }) }), NOW);
  assert.match(gone.say, /확인하지 못했습니다/);
  assert.ok(!gone.board.main.disabled);
  const expired = solioBackupView(SNAP({ oneclick: PRESS(25 * 3600e3, { stage: 'expired' }) }), NOW);
  assert.match(expired.say, /하루가 지나도록/);
});

test('Fable 5: lines 02 and 03 are read values; the helper sits only where the engine works, and the button never says 「점검」', async () => {
  const { solioBackupView, ONECLICK_LABEL } = await import('../renderer/solio-backup-model.mjs');
  const idle = solioBackupView(SNAP(), NOW);
  assert.equal(ONECLICK_LABEL, '백업하고 상태 보기');
  assert.doesNotMatch(ONECLICK_LABEL, /점검|비우기/);
  assert.equal(idle.board.at, null);
  assert.match(idle.board.steps[1].mid, /정해진 때 스스로/);
  assert.equal(idle.board.steps[1].val, '11월 20일 통과');
  assert.match(idle.board.steps[2].mid, /12\.0GB를 찾았습니다/);
  assert.deepEqual(idle.board.groups.map(g => g.k), ['auto', 'suggest', 'view']);
  assert.match(idle.board.groups[0].mid, /엔진 다음 판부터/);
  assert.match(idle.board.groups[1].mid, /엔진 다음 판/);
  const proof = solioBackupView(SNAP({ status: { ...STATUS, job: { stage: 'proof', percent: 40 } } }), NOW);
  assert.equal(proof.board.at, 'proof');
  assert.equal(proof.board.main.label, '되살리기 확인 중');
  assert.ok(proof.board.main.disabled);
  const running = solioBackupView(SNAP({ status: { ...STATUS, job: { stage: 'backup', percent: 57 } } }), NOW);
  assert.equal(running.board.at, 'backup');
  assert.equal(running.board.steps[0].p, 0.57);
});

test('the drive card and line 03 tell apart: no report, an unreadable report, the first scan, below the line, and a shrinking drive', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const none = solioBackupView(SNAP({ space: { missing: true, invalid: false } }), NOW);
  assert.match(none.board.drive.empty, /아직 공간을 재지 않았습니다/);
  assert.match(none.board.steps[2].mid, /아직 공간을 재지 않았습니다/);
  const bad = solioBackupView(SNAP({ space: { missing: false, invalid: true } }), NOW);
  assert.match(bad.board.drive.empty, /읽지 못했습니다/);
  const scanning = solioBackupView(SNAP({ space: { ...SPACE, lapFinishedAt: null, scanningDays: 1, groups: [] } }), NOW);
  assert.match(scanning.board.steps[2].mid, /처음 훑는 중입니다\(2일째\)/);
  const nothing = solioBackupView(SNAP({ space: { ...SPACE, groups: [] } }), NOW);
  assert.match(nothing.board.steps[2].mid, /찾지 못했습니다/);
  const below = solioBackupView(SNAP({ space: { ...SPACE, drive: { ...SPACE.drive, free: 80 * GBy, daysToStartLine: 0 } } }), NOW);
  assert.ok(below.board.drive.below);
  assert.match(below.board.drive.pred, /정한 선\(100GB\)보다 적습니다/);
  const shrinking = solioBackupView(SNAP({ space: { ...SPACE, drive: { ...SPACE.drive, growthPerDay: -GBy, daysToStartLine: null } } }), NOW);
  assert.match(shrinking.board.drive.pace, /비었습니다/);
  assert.match(shrinking.board.drive.pred, /내려가지 않습니다/);
  const unknownGroup = solioBackupView(SNAP({ space: { ...SPACE, groups: [{ grade: 'view', group: 'not-a-group', bytes: 1, count: 1 }] } }), NOW);
  assert.deepEqual(unknownGroup.board.groups, [], 'only group words from the table are shown');
});

test('a finished 원클릭 folds into one line and says the next thing; an update found shows on line 04', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const done = solioBackupView(SNAP({ oneclick: PRESS(300000, { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() }), status: { ...STATUS, lastBackupAt: new Date(NOW - 60000).toISOString() } }), NOW);
  assert.equal(done.say, '백업을 마쳤습니다.');
  assert.match(done.then, /다음 백업은/);
  assert.equal(done.board.sum.nm, '백업을 마쳤습니다');
  assert.match(done.board.sum.mid, /통과/);
  assert.equal(done.board.steps[0].val, '1분 전');
  const news = solioBackupView(SNAP({ app: { state: 'available', current: '0.5.8', latest: '0.5.9' }, feed: { state: 'available', version: '0.7.1' } }), NOW);
  assert.equal(news.board.steps[3].state, 'news');
  assert.match(news.board.steps[3].mid, /PC 앱 새 판 0\.5\.9/);
  assert.match(news.board.steps[3].mid, /엔진 새 판 0\.7\.1/);
  const paused = solioBackupView(SNAP({ status: { ...STATUS, state: 'paused' } }), NOW);
  assert.equal(paused.board, undefined, 'paused has no board');
  const off = solioBackupView(SNAP({ status: { ...STATUS, state: 'off' } }), NOW);
  assert.equal(off.board, undefined, 'off has no board');
});

test('카본 A1 · A2 · A3 · A4 · A5 · A6 · A8: result words reach the folded line, one engine button, news said in place, live work first, no past 「next」, MB below 1GB, right particles', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const doneAt = { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() };
  // A1: 통과가 아닌 되살리기 확인은 접힌 한 줄에도 결과 낱말이 있다
  const skipped = solioBackupView(SNAP({ oneclick: PRESS(300000, doneAt), status: { ...STATUS, proof: { at: '2026-11-20T03:00:00Z', result: 'skipped' } } }), NOW);
  assert.match(skipped.board.sum.mid, /건너뜀/);
  const failed = solioBackupView(SNAP({ oneclick: PRESS(300000, doneAt), status: { ...STATUS, proof: { at: '2026-11-20T03:00:00Z', result: 'failed' } } }), NOW);
  assert.match(failed.board.sum.mid, /실패/);
  assert.match(failed.then, /실패했습니다/);
  // A2: 주의 주제가 있어도 「엔진 창 열기」는 하나다
  const rested = solioBackupView(SNAP({ oneclick: PRESS(300000, { stage: 'answered', result: 'rested', reason: 'battery' }), status: { ...STATUS, attention: ['folders'] } }), NOW);
  assert.equal(rested.acts.filter(a => a.label === '엔진 창 열기').length, 1, JSON.stringify(rested.acts));
  assert.equal(rested.acts[0].arg, 'folders');
  // A3: 끝난 뒤 새 판이 있으면 접힌 04 줄을 가리키지 않고 그 자리에서 말한다
  const news = solioBackupView(SNAP({ oneclick: PRESS(300000, doneAt), app: { state: 'available', current: '0.5.8', latest: '0.5.9' } }), NOW);
  assert.ok(news.board.sum);
  assert.doesNotMatch(news.then, /04 줄/);
  assert.match(news.then, /PC 앱 새 판 0\.5\.9가 있습니다/);
  // A4: 지난 누름의 답이 있어도 엔진이 지금 하는 일이 맨 위다
  const live = solioBackupView(SNAP({ oneclick: PRESS(300000, { stage: 'answered', result: 'failed', reason: 'busy' }), status: { ...STATUS, job: { stage: 'restore', percent: 10 } } }), NOW);
  assert.match(live.say, /파일을 되살리는 중입니다/);
  // A5: 지난 예정 시각은 「다음」이라고 쓰지 않는다
  const past = solioBackupView(SNAP({ oneclick: PRESS(300000, doneAt), status: { ...STATUS, nextRunAt: new Date(NOW - 3 * 3600e3).toISOString() } }), NOW);
  assert.doesNotMatch(past.then, /다음 백업은/);
  assert.equal(past.scope, '로그인해 있는 동안 매시간 저절로 백업합니다.');
  const future = solioBackupView(SNAP(), NOW);
  assert.match(future.scope, /다음은 오늘 오후/);
  // A6: 1GB보다 작은 크기는 MB로 쓴다
  const small = solioBackupView(SNAP({ space: { ...SPACE, drive: { ...SPACE.drive, growthPerDay: 20 * 1024 ** 2 }, groups: [{ grade: 'auto', group: 'temp', bytes: 30 * 1024 ** 2, count: 1 }] } }), NOW);
  assert.match(small.board.drive.pace, /하루에 20\.0MB씩/);
  assert.match(small.board.steps[2].mid, /30\.0MB를 찾았습니다/);
  assert.doesNotMatch(JSON.stringify(small.board), /0\.0GB/);
  // A8: 판 번호 뒤 조사
  for (const [v, want] of [['0.5.9', '0.5.9가'], ['0.6.0', '0.6.0이'], ['0.5.2', '0.5.2가'], ['0.7.1', '0.7.1이'], ['0.7.3', '0.7.3이'], ['0.5.4', '0.5.4가']]) {
    const w = solioBackupView(SNAP({ app: { state: 'available', current: '0.5.8', latest: v } }), NOW);
    assert.match(w.board.steps[3].mid, new RegExp(`새 판 ${want.replace(/\./g, '\\.')} 있습니다`), v);
  }
  const ready = solioBackupView(SNAP({ app: { state: 'ready', current: '0.5.8', latest: '0.5.9' } }), NOW);
  assert.match(ready.board.steps[3].mid, /0\.5\.9를 받아 두었습니다/);
});

test('Fable F1 · F2 · F4: an old answer leaves the top after 30 minutes, the done line names what needs a look, unknown speed is said as unknown, 「매시간」 only when safe', async () => {
  const { solioBackupView, ONECLICK_FRESH } = await import('../renderer/solio-backup-model.mjs');
  const answered = (ago, patch) => PRESS(ago + 60000, { stage: 'answered', answeredAt: new Date(NOW - ago).toISOString(), ...patch });
  // F1: 30분이 지난 「했음」은 지금의 확인할 일을 덮지 않는다
  const stale = solioBackupView(SNAP({ oneclick: answered(ONECLICK_FRESH + 60000, { result: 'done' }), status: { ...STATUS, state: 'attention', attention: ['signin'] } }), NOW);
  assert.match(stale.say, /확인할 일이 있습니다: Google 로그인/);
  assert.equal(stale.note, '확인 필요');
  assert.equal(stale.board.sum, null, 'no folded line from an old press');
  assert.equal(stale.board.steps[0].state, '');
  const staleRest = solioBackupView(SNAP({ oneclick: answered(6 * 3600e3, { result: 'rested', reason: 'battery' }) }), NOW);
  assert.doesNotMatch(staleRest.say + staleRest.board.steps[0].mid, /배터리/);
  const staleGone = solioBackupView(SNAP({ oneclick: answered(ONECLICK_FRESH + 1000, { stage: 'gone', result: null }) }), NOW);
  assert.doesNotMatch(staleGone.say, /확인하지 못했습니다/);
  // F1: 방금 끝났어도 주의 낱말 · 소식 없음 · 되살리기 실패를 둘째 줄이 말한다
  const fresh = (patch) => solioBackupView(SNAP({ oneclick: answered(60000, { result: 'done' }), ...patch }), NOW);
  const changes = fresh({ status: { ...STATUS, attention: ['changes'] } });
  assert.equal(changes.say, '백업을 마쳤습니다.');
  assert.match(changes.then, /확인할 일이 있습니다: 많이 바뀐 파일/);
  assert.equal(changes.note, '확인 필요');
  assert.equal(changes.acts[0].arg, 'changes');
  const quiet = fresh({ view: 'checking', status: { ...STATUS, nextRunAt: new Date(NOW - 3 * 3600e3).toISOString() } });
  assert.match(quiet.then, /2시간 넘게 없습니다/);
  // F2: 속도를 모르면 「내려가지 않습니다」라고 하지 않는다
  const unknown = solioBackupView(SNAP({ space: { ...SPACE, drive: { ...SPACE.drive, growthPerDay: null, daysToStartLine: null } } }), NOW);
  assert.match(unknown.board.drive.pred, /며칠 더 재어야/);
  assert.equal(unknown.board.drive.pace, '');
  // F4: 「매시간 저절로」는 정상일 때만
  assert.match(solioBackupView(SNAP(), NOW).scope, /매시간 저절로/);
  for (const patch of [{ view: 'checking' }, { status: { ...STATUS, state: 'attention', attention: ['signin'] } }, { status: { ...STATUS, state: 'starting' } }]) {
    assert.equal(solioBackupView(SNAP(patch), NOW).scope, '', JSON.stringify(patch));
  }
});

test('Fable F1: the main process stamps when it gave up on a request, so the room can let it go', async () => {
  const a = appdata(), { s } = service(a);
  await s.oneClick(ME);
  fs.rmSync(path.join(a.paths.requests, requests(a)[0]));
  await s.snapshot(ME);
  const snap = await s.snapshot(ME);
  assert.equal(snap.oneclick.stage, 'gone');
  assert.ok(Number.isFinite(Date.parse(snap.oneclick.answeredAt)), 'gone carries the time it was decided');
});

/* ── 공간 비우기 2판(SPACE_DESIGN.md 12.4 · 12.5) ── */
const REPORT2 = (over = {}) => ({ v: 1, report: 'space-1795400000000-abcd1234', createdAt: new Date().toISOString(), lap: { finishedAt: new Date().toISOString(), days: 1 }, drives: [],
  candidates: [
    { n: 1, grade: 'auto', kind: 'temp', bytes: 2e9, reason: 'old-temp', name: 'x', path: MARK },
    { n: 2, grade: 'auto', kind: 'node_modules', bytes: 1e9, reason: 'rebuildable', name: 'x', path: MARK + '\\node_modules' },
    { n: 3, grade: 'auto', kind: 'pip-cache', bytes: 5e8, reason: 'cache-official', name: 'x', path: MARK },
    { n: 4, grade: 'suggest', kind: 'node_modules', bytes: 9e8, reason: 'recent', name: 'x', path: MARK }], ...over });

test('2판: on a PC the engine opened (spaceFree off · on) a press writes run-now then pick free with only the 2판 auto numbers; the engine accepts it', async () => {
  const a = appdata({ status: { ...SAFE, spaceFree: 'off' }, space: REPORT2() }), { s } = service(a);
  assert.deepEqual(await s.oneClick(ME), { ok: true });
  const names = requests(a).sort();
  assert.equal(names.length, 2);
  const bodies = names.map(n => JSON.parse(fs.readFileSync(path.join(a.paths.requests, n), 'utf8')));
  assert.deepEqual(bodies[0], { v: 1, kind: 'run-now' }, 'the backup runs first: the pick is named after it');
  assert.deepEqual(bodies[1], { v: 1, kind: 'pick', action: 'free', report: 'space-1795400000000-abcd1234', items: [1, 2] });
  const at = Number(engineSolio.NAME.exec(names[1])[1]);
  assert.equal(engineSolio.validate(bodies[1], { at, now: at }).ok, true, 'the engine accepts the pick as written');
  assert.ok(!JSON.stringify(bodies).includes('sentinel'), 'no path goes into a request');
  // 엔진이 run-now에 이어 pick을 「미리 보기」로 답하면 수 다섯이 판까지 온다
  const files = new engineSolio.SolioFiles({ root: a.root });
  await files.process({ wants: v => v.ok, handle: async v => (v.kind === 'run-now' ? { result: 'done' } : { result: 'done', preview: true, freed: 3e9, items: 6, kept: 2, busy: 1 }) });
  // 방이 겹쳐 읽어도(두 창 · 빠른 다시 읽기) 먼저 가져간 쪽의 답을 뒤의 읽기가 덮지 않는다(카본 끝판 A3)
  const [snap] = await Promise.all([s.snapshot(ME), s.snapshot(ME), s.snapshot(ME)]);
  assert.equal((await s.snapshot(ME)).oneclick.free.result, 'done');
  assert.equal(snap.oneclick.result, 'done');
  assert.deepEqual([snap.oneclick.free.result, snap.oneclick.free.numbers], ['done', { preview: true, freed: 3e9, items: 6, kept: 2, busy: 1 }]);
  assert.ok(!JSON.stringify(snap).includes('sentinel') && !JSON.stringify(snap).includes('abcd1234'), 'no path and no report id reach the room');
});

test('2판: while the free request is still open after the backup answered, a press writes nothing new; two presses at once write one pair (카본 K1 · K2)', async () => {
  const a = appdata({ status: { ...SAFE, spaceFree: 'off' }, space: REPORT2() }), { s } = service(a);
  // 두 누름이 겹쳐도 요청은 한 쌍(run-now · pick)만 쓴다
  const both = await Promise.all([s.oneClick(ME), s.oneClick(ME)]);
  assert.deepEqual(both.map(r => r.ok ? 'ok' : r.code).sort(), ['BUSY', 'ok']);
  const names = requests(a).sort();
  assert.equal(names.length, 2, 'one run-now and one pick');
  // 엔진이 run-now에만 답했다. pick은 아직 기다린다
  fs.rmSync(path.join(a.paths.requests, names[0]));
  fs.writeFileSync(path.join(a.paths.solio, 'results', names[0]), JSON.stringify({ v: 1, result: 'done', at: new Date().toISOString() }));
  const snap = await s.snapshot(ME);
  assert.deepEqual([snap.oneclick.result, snap.oneclick.free.stage], ['done', 'sent']);
  assert.deepEqual(await s.oneClick(ME), { ok: true, again: true }, 'the open pick is woken again, not replaced');
  assert.deepEqual(requests(a), [names[1]], 'no new request is written');
  // 엔진이 pick을 가져가 비우는 중이면 누를 것이 없다
  fs.mkdirSync(path.join(a.paths.requests, 'claimed'), { recursive: true });
  fs.renameSync(path.join(a.paths.requests, names[1]), path.join(a.paths.requests, 'claimed', names[1]));
  assert.deepEqual(await s.oneClick(ME), { ok: false, code: 'BUSY' });
  assert.equal(requests(a).length, 0);
});

test('2판: no pick on an engine that did not open it, with no fresh report, or with no 2판 numbers — the backup press still goes', async () => {
  for (const [status, space, why] of [
    [SAFE, REPORT2(), 'engine 0.7.0 has no spaceFree'],
    [{ ...SAFE, spaceFree: 'unavailable' }, REPORT2(), 'not the test PC'],
    [{ ...SAFE, spaceFree: 'on' }, REPORT2({ createdAt: new Date(Date.now() - 25 * 3600e3).toISOString() }), 'a report over a day old'],
    [{ ...SAFE, spaceFree: 'on' }, REPORT2({ candidates: [{ n: 3, grade: 'auto', kind: 'pip-cache', bytes: 1, reason: 'x', name: 'x', path: 'x' }] }), 'only kinds 2판 does not free'],
    [{ ...SAFE, spaceFree: 'on' }, undefined, 'no report yet']]) {
    const a = appdata({ status, space }), { s } = service(a);
    assert.deepEqual(await s.oneClick(ME), { ok: true }, why);
    assert.deepEqual(requests(a).map(n => JSON.parse(fs.readFileSync(path.join(a.paths.requests, n), 'utf8')).kind), ['run-now'], why);
  }
});

test('2판 room: the label follows consent, line 03 says the preview, the freeing, what was freed and kept; Solio never turns it on itself', async () => {
  const { solioBackupView, ONECLICK_LABEL, ONECLICK_FREE_LABEL } = await import('../renderer/solio-backup-model.mjs');
  const st = sf => ({ ...STATUS, spaceFree: sf });
  assert.equal(solioBackupView(SNAP({ status: st('off') }), NOW).board.main.label, ONECLICK_LABEL);
  assert.equal(solioBackupView(SNAP({ status: st('on') }), NOW).board.main.label, ONECLICK_FREE_LABEL);
  assert.equal(solioBackupView(SNAP({ status: st('unavailable') }), NOW).board.main.label, ONECLICK_LABEL);
  // 누르기 전: 보고서의 크기는 「많게는」
  assert.match(solioBackupView(SNAP({ status: st('on') }), NOW).board.steps[2].mid, /^많게는 .+를 비울 수 있습니다$/);
  assert.match(solioBackupView(SNAP(), NOW).board.steps[2].mid, /다시 만들 수 있는 것 .+를 찾았습니다/, '0.7.0 keeps its words');
  const answered = { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() };
  const free = patch => ({ stage: 'sent', result: null, reason: null, answeredAt: null, ...patch });
  // 백업은 끝났고 비우기가 도는 중: 03 줄에 도우미 구가 앉고 단추는 막힌다
  let v = solioBackupView(SNAP({ status: { ...st('on'), job: { stage: 'free', percent: null } }, oneclick: PRESS(120000, { ...answered, free: free({ stage: 'claimed' }) }) }), NOW);
  assert.deepEqual([v.board.steps[2].state, v.board.at, v.board.main.disabled], ['now', 'space', true]);
  assert.match(v.board.steps[2].mid, /비우는 중입니다/);
  // 미리 보기 답: 켜면 비울 양과 엔진 창에서 켜기(주제 space). 지웠다고 말하지 않는다
  v = solioBackupView(SNAP({ status: st('off'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, numbers: { preview: true, freed: 3 * GBy, items: 6, kept: 2, busy: 1 } }) }) }), NOW);
  assert.match(v.board.steps[2].mid, /켜면 지금 3\.0GB를 비울 수 있습니다/);
  assert.equal(v.say, '백업을 마쳤습니다.');
  assert.match(v.then, /엔진 창에서 「누를 때 비우기」를 켜면/);
  assert.deepEqual([v.acts[0].act, v.acts[0].arg], ['backup-open', 'space']);
  assert.doesNotMatch(JSON.stringify(v), /비웠습니다/);
  // 실제로 비운 답
  v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, numbers: { preview: false, freed: 4.5 * GBy, items: 3, kept: 1, busy: 1 } }) }) }), NOW);
  assert.equal(v.say, '백업하고 4.5GB를 비웠습니다.');
  assert.match(v.board.steps[2].mid, /4\.5GB를 비웠습니다 · 1개는 쓰는 중이라 남겼습니다/);
  assert.equal(v.board.sum.nm, '백업하고 4.5GB를 비웠습니다');
  // 비우지 않고 끝난 답은 까닭을 말하고, 모르는 까닭은 엔진 창으로
  v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, result: 'rejected', reason: 'old-report' }) }) }), NOW);
  assert.match(v.board.steps[2].mid, /다시 잰 뒤에 비웁니다/);
  v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, result: 'failed', reason: 'error' }) }) }), NOW);
  assert.equal(v.board.steps[2].state, 'fail');
  // 「다시 만들 수 있는 것」 묶음의 설명도 켜고 끈 것을 따른다
  assert.equal(solioBackupView(SNAP({ status: st('off') }), NOW).board.groups.find(g => g.k === 'auto').mid, '엔진 창에서 켜면 원클릭이 임시 파일 · 빌드 폴더를 비웁니다');
  assert.equal(solioBackupView(SNAP({ status: st('on') }), NOW).board.groups.find(g => g.k === 'auto').mid, '임시 파일 · 빌드 폴더는 원클릭을 누를 때 비웁니다');
});

test('2판 room (카본 A1 · A2 · A3 · A4): before consent a refused pick speaks of counting; only 2판 kinds are summed; the top line stays on the press; a lost free answer unlocks the button', async () => {
  const { solioBackupView, FREE_PATIENCE, ONECLICK_FREE_LABEL, ONECLICK_LABEL } = await import('../renderer/solio-backup-model.mjs');
  const st = sf => ({ ...STATUS, spaceFree: sf });
  const answered = { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() };
  const free = patch => ({ stage: 'sent', result: null, reason: null, answeredAt: null, ...patch });
  // A1: 켜지 않은 PC의 거절 답은 「비웁니다」라고 말하지 않는다
  for (const reason of ['old-report', 'no-report', 'expired', 'not-available']) {
    const v = solioBackupView(SNAP({ status: st('off'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, result: 'rejected', reason }) }) }), NOW);
    assert.doesNotMatch(v.board.steps[2].mid, /비웁니다|비우지 않았습니다/, reason);
  }
  assert.match(solioBackupView(SNAP({ status: st('off'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, result: 'failed', reason: 'error' }) }) }), NOW).board.steps[2].mid, /세지 못했습니다/);
  assert.match(solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, { ...answered, free: free({ ...answered, result: 'rejected', reason: 'old-report' }) }) }), NOW).board.steps[2].mid, /비우지 않았습니다/);
  // A2: 「많게는」은 2판 종류(임시 · 자동화 프로필 · 빌드)만 더하고, 캐시는 「아직 비우지 않습니다」로 따로 보인다
  const mixed = { ...SPACE, groups: [{ grade: 'auto', group: 'temp', bytes: 2 * GBy, count: 1 }, { grade: 'auto', group: 'build', bytes: 3 * GBy, count: 4 }, { grade: 'auto', group: 'cache', bytes: 20 * GBy, count: 2 }] };
  let v = solioBackupView(SNAP({ status: st('on'), space: mixed }), NOW);
  assert.equal(v.board.steps[2].mid, '많게는 5.0GB를 비울 수 있습니다');
  const autoItems = v.board.groups.find(g => g.k === 'auto').items;
  assert.deepEqual(autoItems.map(x => [x.nm, x.how]), [['Windows 임시 파일', ''], ['Node 패키지 · 빌드 폴더', ''], ['다시 받을 수 있는 패키지', '원클릭이 아직 비우지 않습니다']]);
  v = solioBackupView(SNAP({ status: st('on'), space: { ...mixed, groups: [mixed.groups[2]] } }), NOW);
  assert.match(v.board.steps[2].mid, /^다시 만들 수 있는 것 20\.0GB를 찾았습니다$/, 'only caches: no 「많게는」 promise');
  assert.equal(solioBackupView(SNAP({ status: st('unavailable'), space: mixed }), NOW).board.groups.find(g => g.k === 'auto').items[2].how, '', '0.7.0 keeps its words');
  // A3: 백업은 끝났고 비우기 답을 기다리는 동안 맨 위 문장은 그 누름을 말한다. 켜지 않은 PC의 free 일은 「세는 중」
  v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, { ...answered, free: free({ stage: 'claimed' }) }) }), NOW);
  assert.deepEqual([v.say, v.board.main.label, v.board.main.disabled], ['백업을 마쳤습니다.', '비우는 중', true]);
  assert.match(v.then, /이어서 다시 만들 수 있는 것을 비우는 중입니다/);
  assert.doesNotMatch(v.board.steps[2].mid, /백업 뒤에/);
  v = solioBackupView(SNAP({ status: { ...st('off'), job: { stage: 'free', percent: null } }, oneclick: PRESS(120000, { ...answered, free: free({ stage: 'claimed' }) }) }), NOW);
  assert.equal(v.board.main.label, '세는 중');
  assert.match(v.say, /켜면 비울 것을 세는 중입니다/);
  // A4: 백업 답 뒤 FREE_PATIENCE가 지나도 비우기 답이 없으면 단추를 풀고 기다리는 중으로 둔다
  const old = { ...answered, answeredAt: new Date(NOW - FREE_PATIENCE - 1000).toISOString() };
  v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(FREE_PATIENCE + 60000, { ...old, free: free({ stage: 'claimed' }) }) }), NOW);
  assert.deepEqual([v.board.main.label, v.board.main.disabled, v.board.steps[2].state], [ONECLICK_FREE_LABEL, false, 'wait']);
  assert.match(v.board.steps[2].mid, /기다리는 중입니다/);
  assert.equal(v.board.busy, false, 'no fast polling for a lost answer');
  v = solioBackupView(SNAP({ status: st('off'), oneclick: PRESS(FREE_PATIENCE + 60000, { ...old, free: free({ stage: 'claimed' }) }) }), NOW);
  assert.deepEqual([v.board.main.label, v.board.main.disabled], [ONECLICK_LABEL, false]);
});

test('all drives on the board (PC 진단 설계 5.1): the tightest is the big card, the rest are one-line bars, from four the third on fold; the below-line sentence names the drives', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const drive = (letter, sizeGb, freeGb, line, days) => ({ letter, size: Math.round(sizeGb * GBy), free: Math.round(freeGb * GBy), growthPerDay: null, startLineGb: line, daysToStartLine: days });
  const C = drive('C', 953, 118.2, 100, 9), D = drive('D', 1907, 299, 150, null), E = drive('E', 476, 300, 71, null), F = drive('F', 238, 20, 35, 0);
  const board = drives => solioBackupView(SNAP({ space: { ...SPACE, drive: undefined, drives } }), NOW).board.drive;
  let b = board([C]);
  assert.deepEqual([b.label, b.rows, b.folded, b.foldLabel], ['C: 드라이브 953GB', [], [], ''], 'one drive keeps its card');
  b = board([C, D]);
  assert.deepEqual(b.rows.map(r => [r.label, r.size, r.free, r.below]), [['D:', '1.9TB', '299.0GB 남음', false]]);
  assert.ok(Number.isFinite(b.rows[0].linePct) && b.rows[0].freePct > 0 && /D: 드라이브 1\.9TB/.test(b.rows[0].aria));
  assert.doesNotMatch(JSON.stringify(b), /다른 드라이브/, 'the old 「다른 드라이브 n개」 line is gone');
  b = board([C, D, E]);
  assert.deepEqual([b.rows.length, b.folded.length, b.foldLabel], [2, 0, '']);
  b = board([F, C, D, E]);
  assert.deepEqual([b.label, b.below, b.rows.map(r => r.label), b.folded.map(r => r.label), b.foldLabel], ['F: 드라이브 238GB', true, ['C:'], ['D:', 'E:'], '드라이브 2개 더']);
  // 선 아래 드라이브는 접지 않는다(Fable 최종 P2-3)
  const G2 = drive('G', 476, 20, 71, 0), H2 = drive('H', 476, 30, 71, 0);
  b = board([F, G2, H2, C, D]);
  assert.deepEqual([b.rows.map(r => r.label), b.folded.map(r => r.label), b.foldLabel], [['G:', 'H:'], ['C:', 'D:'], '드라이브 2개 더']);
  // 뺀 드라이브는 한 줄로 알린다(Fable 최종 P2-4)
  const hiddenCard = solioBackupView(SNAP({ space: { ...SPACE, drive: undefined, drives: [C, D], hiddenDrives: [{ letter: 'E', why: 'small' }, { letter: 'G', why: 'same' }] } }), NOW).board.drive;
  assert.equal(hiddenCard.hidden, 'G: 드라이브는 다른 드라이브와 크기 · 남은 공간이 같아 같은 디스크로 보고 뺐습니다. E: 드라이브는 32GB보다 작아(복구 파티션 따위) 뺐습니다.');
  assert.equal(board([C, D]).hidden, '');
  // 큰 칸의 「선 아래」는 남은 공간과 정한 선으로 본다. 정한 선이 없으면 그렇다고 쓴다
  assert.match(board([drive('C', 953, 80, 100, null)]).pred, /정한 선\(100GB\)보다 적습니다/);
  assert.equal(board([drive('C', 953, 80, null, null)]).pred, '정한 선을 아직 받지 못했습니다.');
  assert.equal(board([drive('C', 953, 101, 100, 0)]).pred, '이대로면 오늘 안에 정한 선 아래로 내려갑니다.', 'above the line but reaching it today (카본 A3)');
  // 접힌 뒤 문장이 선 아래 드라이브의 글자를 말한다
  const answered = { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() };
  const v = solioBackupView(SNAP({ space: { ...SPACE, drive: undefined, drives: [F, drive('H', 476, 30, 71, 0), C] }, oneclick: PRESS(120000, answered) }), NOW);
  assert.match(v.then, /^다만 F: · H:의 남은 공간이 정한 선보다 적습니다/);
});

test('2판 room (Fable 다시 검수 r2 P2): a lost free answer on a PC that turned it on is said on the top line too, with the engine window to look', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const answered = { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() };
  const v = solioBackupView(SNAP({ status: { ...STATUS, spaceFree: 'on' }, oneclick: PRESS(120000, { ...answered, free: { stage: 'gone', result: null, reason: null, answeredAt: new Date(NOW - 1000).toISOString() } }) }), NOW);
  assert.equal(v.then, '다만 비우기 결과를 확인하지 못했습니다. 엔진 창의 공간 비우기에서 봐 주세요.');
  assert.deepEqual([v.note, v.acts[0].label, v.acts[0].arg], ['확인 필요', '엔진 창에서 보기', 'space']);
  // 소식 없음을 말하는 동안에는 비우기 쪽 단추를 내지 않는다(카본 A1)
  const late = solioBackupView(SNAP({ view: 'checking', status: { ...STATUS, spaceFree: 'on' }, oneclick: PRESS(120000, { ...answered, free: { stage: 'gone', result: null, reason: null, answeredAt: new Date(NOW - 1000).toISOString() } }) }), NOW);
  assert.match(late.then, /소식이 2시간 넘게 없습니다/);
  assert.ok(!late.acts.some(a => a.label === '엔진 창에서 보기'), JSON.stringify(late.acts.map(a => a.label)));
});

test('2판 room (Fable 최종 P1-1 · P2-1 · P2-2): a lead that opens the engine drops only 「엔진 창 열기」; a count answered after turning on says it is on; a lost free answer is said', async () => {
  const { solioBackupView } = await import('../renderer/solio-backup-model.mjs');
  const st = sf => ({ ...STATUS, spaceFree: sf });
  const labels = v => v.acts.map(a => a.label);
  const answered = { stage: 'answered', result: 'done', answeredAt: new Date(NOW - 60000).toISOString() };
  const free = patch => ({ stage: 'sent', result: null, reason: null, answeredAt: null, ...patch });
  // P1-1: 쉰 답 · 확인할 일 · 미리 보기에서 「파일 되살리기」와 「새 PC로 옮겨 오기」는 남고, 엔진 창을 여는 단추는 하나다
  const rested = solioBackupView(SNAP({ oneclick: PRESS(120000, { stage: 'answered', result: 'rested', reason: 'battery', answeredAt: new Date(NOW - 60000).toISOString() }) }), NOW);
  assert.deepEqual(labels(rested), ['엔진 창 열기', '파일 되살리기', '새 PC로 옮겨 오기']);
  const attention = solioBackupView(SNAP({ status: { ...STATUS, attention: ['folders'] }, oneclick: PRESS(120000, answered) }), NOW);
  assert.ok(labels(attention).includes('파일 되살리기') && labels(attention).includes('새 PC로 옮겨 오기') && !labels(attention).includes('엔진 창 열기'), JSON.stringify(labels(attention)));
  const counted = { ...answered, free: free({ ...answered, numbers: { preview: true, freed: 3 * GBy, items: 6, kept: 2, busy: 1 } }) };
  let v = solioBackupView(SNAP({ status: st('off'), oneclick: PRESS(120000, counted) }), NOW);
  assert.deepEqual(labels(v), ['엔진 창에서 켜기', '파일 되살리기', '새 PC로 옮겨 오기']);
  // P2-1: 셈 뒤에 엔진 창에서 켰으면 「켜면」이 아니라 켠 것을 말하고 「엔진 창에서 켜기」를 내지 않는다
  v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, counted) }), NOW);
  assert.match(v.board.steps[2].mid, /^켰습니다\. 다음 누름부터 3\.0GB쯤 비웁니다$/);
  assert.match(v.then, /「누를 때 비우기」를 켰습니다/);
  assert.ok(!labels(v).includes('엔진 창에서 켜기') && !/켜면/.test(JSON.stringify(v)), JSON.stringify(labels(v)));
  // P2-2: 비우기 요청의 답을 잃었으면 03 줄이 그렇다고 쓴다
  for (const stage of ['gone', 'expired']) {
    v = solioBackupView(SNAP({ status: st('on'), oneclick: PRESS(120000, { ...answered, free: free({ stage, answeredAt: new Date(NOW - 1000).toISOString() }) }) }), NOW);
    assert.deepEqual([v.board.steps[2].mid, v.board.steps[2].state], ['비우기 결과를 확인하지 못했습니다. 엔진 창의 공간 비우기에서 봐 주세요', 'wait'], stage);
  }
  v = solioBackupView(SNAP({ status: st('off'), oneclick: PRESS(120000, { ...answered, free: free({ stage: 'gone', answeredAt: new Date(NOW - 1000).toISOString() }) }) }), NOW);
  assert.match(v.board.steps[2].mid, /^셈 결과를 확인하지 못했습니다/);
});
