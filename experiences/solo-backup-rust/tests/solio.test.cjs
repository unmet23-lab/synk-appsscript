'use strict';
// SYNK 솔리오와 엔진 사이의 파일 셋 (STAGE1_DESIGN.md 4.13 · T30의 엔진 쪽): 상태 파일, 요청 파일, 결과 파일, 공간 설정,
// 쉬는 회선, AI 도구 동의. 상태 폴더는 임시 폴더에만 만든다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const solio = require('../engine/src/solio.cjs');

// A folder link: a junction on Windows (what `mklink /J` makes, no admin needed), a directory symlink elsewhere, so the
// CI's Linux run sees the same refusal without a `cmd` it does not have.
const junction = (link, target) => fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');

const temp = t => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-solio-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const NOW = Date.parse('2026-11-17T03:00:00Z');
const name = (at = NOW, tail = 'abcdefgh') => `${at}-${tail}.json`;
const put = (files, n, value) => fs.writeFileSync(path.join(files.requests, n), typeof value === 'string' ? value : JSON.stringify(value));
const result = (files, n) => JSON.parse(fs.readFileSync(path.join(files.results, n), 'utf8'));
const engineState = over => ({ configured: true, mode: 'backup', readOnly: false, automatic: true, recoverySaved: true, credentialRequired: false, intervalMinutes: 60,
  sources: ['C:\\Users\\customer\\Documents\\비밀 계약', 'D:\\작업'], lastBackup: { id: 'a'.repeat(64), at: new Date(NOW - 600000).toISOString(), files: 10, bytes: 123456 },
  lastProbe: { result: 'passed', at: new Date(NOW - 86400000).toISOString(), snapshotId: 'a'.repeat(64) }, nextBackupAt: new Date(NOW + 3000000).toISOString(),
  missingSources: [], job: null, ...over });

test('status: one fixed word, no names, the fields solio reads', () => {
  const s = solio.statusOf({ state: engineState(), version: '0.7.0', startupRegistered: true, now: NOW });
  assert.deepEqual(Object.keys(s), ['v', 'engine', 'state', 'lastBackupAt', 'proof', 'attention', 'job', 'folders', 'bytes', 'writer', 'nextRunAt', 'spaceFree', 'writtenAt']);
  assert.equal(s.spaceFree, 'unavailable', 'no test gate, no 2판');
  assert.equal(solio.statusOf({ state: engineState(), version: '0.8.0', spaceFree: 'on', now: NOW }).spaceFree, 'on');
  assert.equal(solio.statusOf({ state: engineState(), version: '0.8.0', spaceFree: 'yes', now: NOW }).spaceFree, 'unavailable');
  assert.deepEqual(solio.statusOf({ state: engineState(), version: '0.8.0', freeing: true, now: NOW }).job, { stage: 'free', percent: null }, '「비우는 중」');
  assert.equal(s.v, 1); assert.equal(s.state, 'safe'); assert.equal(s.folders, 2); assert.equal(s.bytes, 123456); assert.equal(s.writer, true);
  assert.deepEqual(s.proof, { at: new Date(NOW - 86400000).toISOString(), result: 'passed' });
  const text = JSON.stringify(s);
  for (const secret of ['customer', '계약', 'Documents', 'D:\\', 'aaaa']) assert.ok(!text.includes(secret), secret);
  assert.ok(Buffer.byteLength(text) < solio.STATUS_MAX);
  const words = (over, extra = {}) => solio.statusOf({ state: engineState(over), version: '0.7.0', startupRegistered: true, now: NOW, ...extra });
  assert.equal(solio.statusOf({ state: { configured: false }, version: '0.7.0', now: NOW }).state, 'not-set-up');
  assert.equal(words({ movedTo: { device: 'x', at: 'y' } }).state, 'moved');
  assert.equal(words({ mode: 'restore', automatic: false }).state, 'restore-only');
  assert.equal(words({ mode: 'restore' }).writer, false);
  assert.equal(words({ pausedUntil: new Date(NOW + 3600000).toISOString() }).state, 'paused');
  assert.equal(words({ automatic: false }).state, 'off');
  assert.equal(words({ lastBackup: null }).state, 'starting', 'the first backup is not 「attention」');
  assert.equal(words({ lastBackup: null, job: { kind: 'protect', stage: 'C:\\x 백업 중', percent: 41.27 } }).job.stage, 'backup');
  assert.deepEqual(words({ job: { kind: 'restore', stage: '파일 보고서.docx', percent: 300 } }).job, { stage: 'restore', percent: 100 }, 'a stage word, never the engine text');
  assert.deepEqual(words({ job: { kind: 'brand-new', stage: 'x', percent: null } }).job, { stage: 'other', percent: null });
  const attention = (over, extra) => { const s = words(over, extra); return [s.state, s.attention]; };
  assert.deepEqual(attention({ credentialRequired: true }), ['attention', ['signin']]);
  assert.deepEqual(attention({ recoverySaved: false }), ['attention', ['status']]);
  assert.deepEqual(attention({ health: { status: 'attention' } }), ['attention', ['changes']]);
  assert.deepEqual(attention({ missingSources: ['D:\\작업'] }), ['attention', ['folders']]);
  assert.deepEqual(attention({ lastBackup: { at: new Date(NOW - 10 * 3600000).toISOString() } }), ['attention', ['status']], 'overdue');
  assert.deepEqual(attention({ serverRestore: { since: 'x' } }), ['safe', ['restore']]);
  assert.deepEqual(attention({}, { ledger: { days: { partial: '2026-11-17' } } }), ['safe', ['status']], 'a partial snapshot is told, not alarming');
  assert.deepEqual(attention({}, { ledger: { days: { missing: '2026-11-17' } } }), ['attention', ['folders']]);
  assert.deepEqual(attention({}, { ledger: { days: { odd: '2026-11-20' } } }), ['safe', ['status']], 'a name a backup cannot hold is told, not alarming');
  assert.deepEqual(attention({ leftOutNames: { at: '2026-11-20T01:00:00.000Z', count: 1, names: ['C:\\작업\\메모.'], cut: false } }), ['safe', ['status']]);
  assert.deepEqual(attention({}, { update: { available: '0.7.1' } }), ['safe', ['update']]);
  assert.deepEqual(attention({}, { update: { available: '0.7.0' } }), ['safe', []], 'the version already installed is not an update');
  assert.deepEqual(attention({}, { version: '0.7.2', update: { available: '0.7.1' } }), ['safe', []], 'a version passed by an update is not one');
  assert.deepEqual(attention({}, { update: { available: '0.6.9' } }), ['safe', []], 'a lower version');
  assert.deepEqual(attention({}, { version: '0.7.9', update: { available: '0.7.10' } }), ['safe', ['update']], 'compared as numbers');
  assert.deepEqual(attention({}, { version: 'dev', update: { available: '0.7.1' } }), ['safe', []], 'an unknown own version judges nothing');
  assert.deepEqual(attention({}, { startupRegistered: false }), ['attention', ['status']], 'run tasks missing');
  assert.deepEqual(attention({}, { startupRegistered: null }), ['safe', []], 'unknown is not judged');
  assert.ok(attention({ credentialRequired: true, missingSources: ['x'], health: { status: 'attention' } })[1].every((t, i, all) => solio.TOPICS.indexOf(t) >= (i ? solio.TOPICS.indexOf(all[i - 1]) : 0)), 'fixed order');
  for (const s of [words({}), words({ automatic: false }), solio.statusOf({ state: null, version: 'x', now: NOW })]) assert.ok(solio.STATES.includes(s.state));
});

test('status file: replaced in one step, unchanged content not rewritten, progress at most every 5 seconds', async t => {
  const root = temp(t); let clock = NOW;
  const files = new solio.SolioFiles({ root, now: () => clock });
  const s = over => solio.statusOf({ state: engineState(over), version: '0.7.0', now: clock });
  assert.equal(await files.writeStatus(s()), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'solio', 'status.json'), 'utf8')).state, 'safe');
  clock += 60000;
  assert.equal(await files.writeStatus(s()), false, 'same content');
  assert.equal(await files.writeStatus(s({ job: { kind: 'backup', percent: 1 } })), true);
  clock += 1000;
  assert.equal(await files.writeStatus(s({ job: { kind: 'backup', percent: 2 } })), false, 'within 5 seconds');
  clock += 5000;
  assert.equal(await files.writeStatus(s({ job: { kind: 'backup', percent: 3 } })), true);
  assert.equal(await files.writeStatus(s({ job: { kind: 'backup', percent: 3 } }), { force: true }), true, 'a run end always writes');
  // The other program wrote the file since (a run that stopped with its progress written): the same content is written again.
  clock += 60000;
  const other = new solio.SolioFiles({ root, now: () => clock });
  assert.equal(await other.writeStatus(s({ job: { kind: 'backup', percent: 90 } })), true);
  assert.equal(await files.writeStatus(s({ job: { kind: 'backup', percent: 3 } })), true, 'not ours any more');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'solio', 'status.json'), 'utf8')).job.percent, 3);
  assert.equal(await files.writeStatus(s({ job: { kind: 'backup', percent: 3 } })), false, 'ours again');
  assert.deepEqual(fs.readdirSync(path.join(root, 'solio')).filter(n => n.endsWith('.tmp')), []);
  await assert.rejects(files.writeStatus({ ...s(), pad: 'x'.repeat(70000) }), { code: 'SOLIO_STATUS_SIZE' });
});

test('requests: the contract, word by word', () => {
  const ok = (v, at = NOW, now = NOW) => solio.validate(v, { at, now });
  assert.deepEqual(ok({ v: 1, kind: 'run-now' }), { ok: true, value: { kind: 'run-now', at: NOW } });
  assert.deepEqual(ok({ v: 1, kind: 'setup', mode: 'protect', hint: 'owner@example.com' }).value, { kind: 'setup', mode: 'protect', hint: 'owner@example.com', at: NOW });
  assert.equal(ok({ v: 1, kind: 'setup', mode: 'move', hint: 'not an address' }).value.hint, null, 'a bad hint is dropped');
  assert.equal(ok({ v: 1, kind: 'setup', mode: 'move', hint: `${'a'.repeat(250)}@b.cd` }).value.hint, null, '254 characters at most');
  assert.equal(ok({ v: 1, kind: 'setup', mode: 'protect', hint: 7 }).reason, 'invalid');
  assert.equal(ok({ v: 1, kind: 'setup', mode: 'protect' }, NOW - 31 * 60000).reason, 'expired', '30 minutes');
  assert.equal(ok({ v: 1, kind: 'setup', mode: 'protect' }, NOW - 29 * 60000).ok, true);
  assert.equal(ok({ v: 1, kind: 'run-now' }, NOW + 10 * 60000).reason, 'invalid', 'a request from the future');
  assert.equal(ok({ v: 1, kind: 'run-now' }, NOW - 25 * 3600000).reason, 'expired');
  assert.equal(ok({ v: 2, kind: 'run-now' }).reason, 'version');
  for (const bad of [null, [], 'x', { kind: 'run-now' }, { v: 1, kind: 'run-now', path: 'C:\\' }, { v: 1, kind: 'delete' }, { v: 1, kind: 'setup', mode: 'wipe' },
    { v: 1, kind: 'setup', mode: 'protect', command: 'x' }, { v: 1, kind: 'pick', action: 'restore', report: 'space-1', items: [1] },
    { v: 1, kind: 'pick', action: 'free', report: 'space-12345678', items: [] }, { v: 1, kind: 'pick', action: 'free', report: 'space-12345678', items: [1, 1] },
    { v: 1, kind: 'pick', action: 'free', report: 'space-12345678', items: [0] }, { v: 1, kind: 'pick', action: 'move', report: 'space-12345678', items: [1] },
    { v: 1, kind: 'space-setting', name: 'start-line', drive: 'c', gb: 10 }, { v: 1, kind: 'space-setting', name: 'start-line', drive: 'C', gb: 1.5 },
    { v: 1, kind: 'space-setting', name: 'auto-free', value: 'false' }, { v: 1, kind: 'space-setting', name: 'auto-free', value: false, drive: 'C' },
    { v: 1, kind: 'space-setting', name: 'delete-everything', value: true }]) assert.equal(ok(bad).ok, false, JSON.stringify(bad));
  assert.equal(ok({ v: 1, kind: 'pick', action: 'free', report: 'space-1731800000000-ab12cd34', items: [3, 1] }).value.items.length, 2);
  assert.deepEqual(ok({ v: 1, kind: 'space-setting', name: 'start-line', drive: 'C', gb: 300 }).value, { kind: 'space-setting', name: 'start-line', drive: 'C', gb: 300, at: NOW });
  // Results carry fixed words only.
  assert.deepEqual(solio.resultOf({ result: 'rejected', reason: 'C:\\secret' }, NOW), { v: 1, result: 'rejected', reason: 'error', at: new Date(NOW).toISOString() });
  assert.deepEqual(solio.resultOf({ result: 'whatever' }, NOW).result, 'failed');
  assert.equal(solio.resultOf({ result: 'done', reason: 'busy' }, NOW).reason, undefined);
});

test('requests: claimed by one side only, setup left to the window, leftovers and old results cleared', async t => {
  const root = temp(t); const clock = { now: NOW };
  const a = new solio.SolioFiles({ root, now: () => clock.now }), b = new solio.SolioFiles({ root, now: () => clock.now });
  await a.ready();
  for (let i = 0; i < 12; i++) put(a, name(NOW - i, `run${String(i).padStart(5, '0')}`), { v: 1, kind: 'run-now' });
  put(a, name(NOW, 'setup000'), { v: 1, kind: 'setup', mode: 'protect' });
  put(a, name(NOW, 'unknown0'), { v: 1, kind: 'run-now', extra: 1 });
  put(a, name(NOW, 'broken00'), '{not json');
  put(a, name(NOW, 'toolarge'), JSON.stringify({ v: 1, kind: 'run-now', pad: 'x'.repeat(9000) }));
  put(a, 'notours.json', { v: 1, kind: 'run-now' });
  const handled = [];
  const runSide = side => side.process({ wants: c => !(c.ok && c.value.kind === 'setup'), handle: async v => { handled.push(v.kind); await new Promise(r => setTimeout(r, 5)); return { result: 'done' }; } });
  const [x, y] = await Promise.all([runSide(a), runSide(b)]);
  assert.equal(handled.length, 12, 'each request once, whichever side claimed it');
  assert.equal(x.length + y.length, 15);
  assert.deepEqual([...x, ...y].filter(r => r.kind === 'invalid').map(r => [r.result, r.reason]), [['rejected', 'invalid'], ['rejected', 'invalid'], ['rejected', 'invalid']]);
  assert.ok(fs.existsSync(path.join(a.requests, name(NOW, 'setup000'))), 'setup is the window\'s');
  assert.ok(fs.existsSync(path.join(a.requests, 'notours.json')), 'a name not ours is neither read nor removed');
  assert.deepEqual(fs.readdirSync(a.claimed), []);
  assert.equal(result(a, name(NOW, 'unknown0')).reason, 'invalid');
  // The window takes the setup, even behind many requests that the run side handles; links and folders are not requests.
  for (let i = 0; i < 70; i++) put(a, name(NOW - 100 - i, `later${String(i).padStart(3, '0')}`), { v: 1, kind: 'run-now' });
  fs.mkdirSync(path.join(a.requests, name(1, 'afolder0')));
  junction(path.join(a.requests, name(2, 'ajunctio')), temp(t));
  assert.ok(!(await a.names(a.requests)).some(n => n.includes('afolder0') || n.includes('ajunctio')), 'plain files only');
  const windowWants = c => !c.ok || c.value.kind === 'setup';
  assert.equal(await a.pending(windowWants), true, 'a setup is waiting');
  const w = await a.process({ wants: windowWants, handle: async v => ({ result: v.mode === 'protect' ? 'done' : 'rejected' }) });
  assert.deepEqual(w, [{ kind: 'setup', result: 'done' }]);
  assert.equal(await a.pending(windowWants), false, 'only the run side\'s requests are left: the window does not take the lock');
  fs.rmSync(path.join(a.requests, name(2, 'ajunctio'))); fs.rmdirSync(path.join(a.requests, name(1, 'afolder0')));
  for (let i = 0; i < 70; i++) fs.rmSync(path.join(a.requests, name(NOW - 100 - i, `later${String(i).padStart(3, '0')}`)));
  // A side that died while handling left a claimed request: the next lock holder answers it failed, never again done.
  fs.writeFileSync(path.join(a.claimed, name(NOW, 'crashed0')), JSON.stringify({ v: 1, kind: 'run-now' }));
  fs.writeFileSync(path.join(a.claimed, name(NOW, 'answered')), JSON.stringify({ v: 1, kind: 'run-now' }));
  fs.writeFileSync(path.join(a.results, name(NOW, 'answered')), JSON.stringify({ v: 1, result: 'done', at: 'x' }));
  assert.deepEqual((await a.sweep()).sort(), [name(NOW, 'answered'), name(NOW, 'crashed0')]);
  assert.deepEqual([result(a, name(NOW, 'crashed0')).result, result(a, name(NOW, 'crashed0')).reason], ['failed', 'interrupted']);
  assert.equal(result(a, name(NOW, 'answered')).result, 'done', 'an answer already written is not overwritten');
  // Results older than a day go.
  const old = path.join(a.results, name(NOW - 1, 'oldresul'));
  fs.writeFileSync(old, '{}'); const day = new Date(NOW - 2 * 86400000); fs.utimesSync(old, day, day);
  clock.now = Date.now(); await a.sweep();
  assert.ok(!fs.existsSync(old));
});

test('requests: a cancel mark, seen after claiming and before handling, refuses it; the engine removes it once answered (4.13)', async t => {
  const root = temp(t);
  const a = new solio.SolioFiles({ root, now: () => NOW });
  await a.ready();
  const handled = [], wants = c => !c.ok || c.value.kind === 'setup';
  const handle = async v => { handled.push(v.hint); return { result: 'done' }; };
  // Marked before the engine looks: refused, never handed on; the mark goes with the answer.
  put(a, name(NOW, 'setupcan'), { v: 1, kind: 'setup', mode: 'protect', hint: 'old@example.com' });
  fs.writeFileSync(a.mark(name(NOW, 'setupcan')), '');
  assert.deepEqual(await a.process({ wants, handle }), [{ kind: 'setup', result: 'rejected', reason: 'cancelled' }]);
  assert.deepEqual([handled, result(a, name(NOW, 'setupcan')).reason, fs.existsSync(a.mark(name(NOW, 'setupcan')))], [[], 'cancelled', false]);
  // Marked right after the engine claimed it: still refused — the check after claiming is the one that counts (GA3).
  put(a, name(NOW, 'setuplat'), { v: 1, kind: 'setup', mode: 'protect', hint: 'old@example.com' });
  const fsp = require('node:fs/promises'), link = fsp.link;
  fsp.link = async (from, to, ...rest) => { await link(from, to, ...rest); fs.writeFileSync(a.mark(path.basename(to)), 'x'); };
  try { assert.deepEqual(await a.process({ wants, handle }), [{ kind: 'setup', result: 'rejected', reason: 'cancelled' }]); } finally { fsp.link = link; }
  assert.deepEqual(handled, []);
  // Anything under that name is a mark, a folder too; one that cannot be removed stays for 솔리오, and the answer stands.
  put(a, name(NOW, 'setupdir'), { v: 1, kind: 'setup', mode: 'move' });
  fs.mkdirSync(a.mark(name(NOW, 'setupdir')));
  assert.deepEqual(await a.process({ wants, handle }), [{ kind: 'setup', result: 'rejected', reason: 'cancelled' }]);
  assert.ok(fs.existsSync(a.mark(name(NOW, 'setupdir'))) && !fs.existsSync(path.join(a.claimed, name(NOW, 'setupdir'))));
  fs.rmdirSync(a.mark(name(NOW, 'setupdir')));
  // A mark that cannot be looked at counts as one: refused rather than handed on.
  const lstat = fsp.lstat;
  fsp.lstat = async (p, ...rest) => { if (String(p).endsWith('.cancel')) throw Object.assign(new Error('denied'), { code: 'EACCES' }); return lstat(p, ...rest); };
  try {
    put(a, name(NOW, 'setupacc'), { v: 1, kind: 'setup', mode: 'protect', hint: 'old@example.com' });
    assert.deepEqual(await a.process({ wants, handle }), [{ kind: 'setup', result: 'rejected', reason: 'cancelled' }]);
    assert.deepEqual(handled, []);
  } finally { fsp.lstat = lstat; }
  // A mark is not a request — one with no request beside it is neither read nor removed — and with none, the request is
  // handled as before (GA4).
  fs.writeFileSync(a.mark(name(NOW, 'lonemark')), '');
  assert.deepEqual(await a.names(a.requests), []);
  put(a, name(NOW, 'setupok0'), { v: 1, kind: 'setup', mode: 'protect', hint: 'new@example.com' });
  assert.deepEqual(await a.process({ wants, handle }), [{ kind: 'setup', result: 'done' }]);
  assert.deepEqual(handled, ['new@example.com']);
  assert.ok(fs.existsSync(a.mark(name(NOW, 'lonemark'))), 'a mark with no request is left to 솔리오'); fs.rmSync(a.mark(name(NOW, 'lonemark')));
  // A claimed request left by a side that died: answered failed, and its mark goes too.
  fs.writeFileSync(path.join(a.claimed, name(NOW, 'crashcan')), JSON.stringify({ v: 1, kind: 'setup', mode: 'protect' }));
  fs.writeFileSync(a.mark(name(NOW, 'crashcan')), '');
  await a.sweep();
  assert.deepEqual([result(a, name(NOW, 'crashcan')).reason, fs.existsSync(a.mark(name(NOW, 'crashcan')))], ['interrupted', false]);
  // Died between linking and removing the original: both are there. The sweep removes both and the mark; once 솔리오 has
  // read and removed the answer, nothing is left to claim again without the mark (GA1).
  put(a, name(NOW, 'halfcl00'), { v: 1, kind: 'setup', mode: 'protect', hint: 'old@example.com' });
  fs.linkSync(path.join(a.requests, name(NOW, 'halfcl00')), path.join(a.claimed, name(NOW, 'halfcl00')));
  fs.writeFileSync(a.mark(name(NOW, 'halfcl00')), '');
  await a.sweep();
  assert.equal(result(a, name(NOW, 'halfcl00')).reason, 'interrupted');
  fs.rmSync(path.join(a.results, name(NOW, 'halfcl00')));
  assert.deepEqual([fs.existsSync(path.join(a.requests, name(NOW, 'halfcl00'))), await a.process({ wants, handle }), handled], [false, [], ['new@example.com']]);
  // The original another program holds and will not let go: the answer is still written, and the mark stays, so the original —
  // claimed again once 솔리오 has removed the answer — is refused (r2 GA1).
  put(a, name(NOW, 'heldorig'), { v: 1, kind: 'setup', mode: 'protect', hint: 'old@example.com' });
  fs.linkSync(path.join(a.requests, name(NOW, 'heldorig')), path.join(a.claimed, name(NOW, 'heldorig')));
  fs.writeFileSync(a.mark(name(NOW, 'heldorig')), '');
  const rm = fsp.rm, held = path.join(a.requests, name(NOW, 'heldorig'));
  fsp.rm = async (p, ...rest) => { if (p === held) throw Object.assign(new Error('held'), { code: 'EPERM' }); return rm(p, ...rest); };
  const claimedHeld = path.join(a.claimed, name(NOW, 'heldorig'));
  try {
    assert.deepEqual(await a.sweep(), [name(NOW, 'heldorig')]);
    assert.deepEqual([result(a, name(NOW, 'heldorig')).reason, fs.existsSync(held), fs.existsSync(claimedHeld), fs.existsSync(a.mark(name(NOW, 'heldorig')))], ['interrupted', true, true, true]);
    // 솔리오가 답을 읽고 지운 뒤에도 그 원래 이름은 다시 차지되지 않고(같은 이름의 차지가 남았다), 답도 되풀이해 쓰지 않는다(F1).
    fs.rmSync(path.join(a.results, name(NOW, 'heldorig')));
    assert.deepEqual([await a.process({ wants, handle }), await a.sweep(), handled], [[], [name(NOW, 'heldorig')], ['new@example.com']]);
    assert.ok(!fs.existsSync(path.join(a.results, name(NOW, 'heldorig'))));
  } finally { fsp.rm = rm; }
  // Let go: the next sweep removes the original, the claim and the mark, and writes no second answer.
  await a.sweep();
  assert.deepEqual([fs.existsSync(held), fs.existsSync(claimedHeld), fs.existsSync(a.mark(name(NOW, 'heldorig'))), fs.existsSync(path.join(a.results, name(NOW, 'heldorig'))), handled], [false, false, false, false, ['new@example.com']]);
  // Without the mark too, nothing answered 「실패」 is done later (F1): a held original claimed in a pass is left to the sweep.
  put(a, name(NOW, 'heldnomk'), { v: 1, kind: 'setup', mode: 'protect', hint: 'old@example.com' });
  const held2 = path.join(a.requests, name(NOW, 'heldnomk'));
  put(a, name(NOW + 1, 'afterhld'), { v: 1, kind: 'setup', mode: 'protect', hint: 'next@example.com' });
  fsp.rm = async (p, ...rest) => { if (p === held2) throw Object.assign(new Error('held'), { code: 'EBUSY' }); return rm(p, ...rest); };
  try {
    assert.deepEqual(await a.process({ wants, handle }), [{ kind: 'setup', result: 'done' }], 'the pass goes on to the next request (F2)');
    assert.deepEqual(await a.sweep(), [name(NOW, 'heldnomk')]);
    fs.rmSync(path.join(a.results, name(NOW, 'heldnomk')));
    assert.deepEqual(await a.process({ wants, handle }), []);
  } finally { fsp.rm = rm; }
  await a.sweep();
  assert.deepEqual([await a.process({ wants, handle }), handled], [[], ['new@example.com', 'next@example.com']]);
  fs.rmSync(path.join(a.results, name(NOW + 1, 'afterhld')));
  // 솔리오 removed the original itself just as the sweep went to: gone all the same, and the claim and the mark go (r3 GA1).
  put(a, name(NOW, 'racegone'), { v: 1, kind: 'setup', mode: 'protect' });
  fs.linkSync(path.join(a.requests, name(NOW, 'racegone')), path.join(a.claimed, name(NOW, 'racegone')));
  fs.writeFileSync(a.mark(name(NOW, 'racegone')), '');
  const race = path.join(a.requests, name(NOW, 'racegone'));
  fsp.rm = async (p, ...rest) => { if (p === race) { fs.rmSync(race); throw Object.assign(new Error('gone'), { code: 'ENOENT' }); } return rm(p, ...rest); };
  try { await a.sweep(); } finally { fsp.rm = rm; }
  assert.deepEqual([fs.existsSync(path.join(a.claimed, name(NOW, 'racegone'))), fs.existsSync(a.mark(name(NOW, 'racegone'))), result(a, name(NOW, 'racegone')).reason], [false, false, 'interrupted']);
  // Under the claimed name in requests, something that is not a request — a folder, a link — is left alone, and the sweep goes on (r2 GA2).
  for (const [tag, make] of [['adirectr', p => fs.mkdirSync(p)], ['alinkreq', p => junction(p, temp(t))]]) {
    fs.writeFileSync(path.join(a.claimed, name(NOW, tag)), JSON.stringify({ v: 1, kind: 'setup', mode: 'protect' }));
    make(path.join(a.requests, name(NOW, tag))); fs.writeFileSync(a.mark(name(NOW, tag)), '');
  }
  assert.deepEqual((await a.sweep()).sort(), [name(NOW, 'adirectr'), name(NOW, 'alinkreq')]);
  assert.ok(fs.lstatSync(path.join(a.requests, name(NOW, 'adirectr'))).isDirectory() && fs.lstatSync(path.join(a.requests, name(NOW, 'alinkreq'))).isSymbolicLink());
  assert.deepEqual([result(a, name(NOW, 'adirectr')).reason, result(a, name(NOW, 'alinkreq')).reason], ['interrupted', 'interrupted']);
  assert.ok(!fs.existsSync(a.mark(name(NOW, 'adirectr'))) && !fs.existsSync(a.mark(name(NOW, 'alinkreq'))), 'nothing there can be claimed again, so the marks go');
  fs.rmdirSync(path.join(a.requests, name(NOW, 'adirectr'))); fs.rmSync(path.join(a.requests, name(NOW, 'alinkreq')));
  // A request already answered (the side died before removing it) is not done again, and its mark goes.
  put(a, name(NOW, 'answerdc'), { v: 1, kind: 'setup', mode: 'protect' });
  fs.writeFileSync(path.join(a.results, name(NOW, 'answerdc')), JSON.stringify({ v: 1, result: 'done', at: 'x' }));
  fs.writeFileSync(a.mark(name(NOW, 'answerdc')), '');
  assert.deepEqual(await a.process({ wants, handle }), []);
  assert.deepEqual([fs.existsSync(path.join(a.requests, name(NOW, 'answerdc'))), fs.existsSync(a.mark(name(NOW, 'answerdc')))], [false, false]);
});

test('requests: a folder that is a junction is refused, so nothing is read or removed elsewhere', async t => {
  const root = temp(t), elsewhere = temp(t);
  fs.mkdirSync(path.join(root, 'solio'), { recursive: true });
  fs.writeFileSync(path.join(elsewhere, name()), JSON.stringify({ v: 1, kind: 'run-now' }));
  junction(path.join(root, 'solio', 'requests'), elsewhere);
  const files = new solio.SolioFiles({ root, now: () => NOW });
  await assert.rejects(files.process({ wants: () => true, handle: async () => ({ result: 'done' }) }), { code: 'SOLIO_FOLDER' });
  assert.ok(fs.existsSync(path.join(elsewhere, name())), 'untouched');
});

test('run side: 「지금 백업」 keeps the rests, space settings only narrow, picks follow the report', async t => {
  const root = temp(t);
  const files = new solio.SolioFiles({ root, now: () => Date.now() });
  await files.ready();
  const at = Date.now();
  const engine = (over = {}, outcome = 'complete') => ({ config: { repositoryId: 'r', mode: 'backup', readOnly: false, automatic: true, ...over }, intervalMs: 3600000, now: () => Date.now(), lastAttempt: 0,
    runs: 0, async runOnce(o) { this.runs++; this.forced = o.force; return { outcome, resticStartedAt: Date.now() }; } });
  const go = async (requests, options) => {
    for (const [n, v] of requests) put(files, n, v);
    const r = await solio.runRequests({ files, root, driveSize: async d => d === 'C' ? 1000 * 2 ** 30 : null, ...options });
    return r;
  };
  let e = engine();
  let r = await go([[name(at, 'rest0000'), { v: 1, kind: 'run-now' }]], { engine: e, rest: 'network' });
  assert.deepEqual([r.done, e.runs], [[{ kind: 'run-now', result: 'rested', reason: 'network' }], 0]);
  r = await go([[name(at, 'covered0'), { v: 1, kind: 'run-now' }]], { engine: e, result: { outcome: 'complete', resticStartedAt: at + 5 } });
  assert.deepEqual([r.done[0].result, e.runs], ['done', 0], 'this run already backed up after the request');
  r = await go([[name(at, 'forced00'), { v: 1, kind: 'run-now' }]], { engine: e, result: { outcome: 'not-due' } });
  assert.deepEqual([r.done[0].result, e.runs, e.forced, r.forced.outcome], ['done', 1, true, 'complete'], 'only the interval is skipped');
  e = engine({}, 'failed');
  r = await go([[name(at, 'twice001'), { v: 1, kind: 'run-now' }], [name(at + 4 * 60000, 'twice002'), { v: 1, kind: 'run-now' }]], { engine: e, result: { outcome: 'not-due' } });
  assert.deepEqual([r.done.map(d => d.result), e.runs], [['failed', 'failed'], 1], 'two requests in one pass run one backup, even one named minutes ahead');
  // A caller that gives only the skip: rest defaults to it in the run worker (worker/runner.cjs); here the rest itself is given.
  r = await go([[name(at, 'paused00'), { v: 1, kind: 'run-now' }]], { engine: engine({ pausedUntil: new Date(Date.now() + 3600000).toISOString() }) });
  assert.deepEqual(r.done[0], { kind: 'run-now', result: 'rejected', reason: 'paused' }, 'a pause the person set is kept');
  r = await go([[name(at, 'notset00'), { v: 1, kind: 'run-now' }]], { engine: { config: null } });
  assert.deepEqual(r.done[0], { kind: 'run-now', result: 'rejected', reason: 'not-set-up' });
  r = await go([[name(at, 'readonly'), { v: 1, kind: 'run-now' }]], { engine: engine({ mode: 'restore' }) });
  assert.equal(r.done[0].reason, 'restore-only');
  r = await go([[name(at, 'busy0000'), { v: 1, kind: 'run-now' }]], { engine: engine({}, 'busy') });
  assert.deepEqual([r.done[0].result, r.done[0].reason], ['failed', 'busy']);
  // Space settings: lowering the start line and turning things off happen; the rest waits for the engine window.
  e = engine();
  r = await go([[name(at, 'line0000'), { v: 1, kind: 'space-setting', name: 'start-line', drive: 'C', gb: 100 }]], { engine: e });
  assert.equal(r.done[0].result, 'done');
  assert.deepEqual((await solio.readSpaceSettings(root)).startLines, { C: 100 });
  r = await go([[name(at, 'line0001'), { v: 1, kind: 'space-setting', name: 'start-line', drive: 'C', gb: 120 }]], { engine: e });
  assert.equal(r.done[0].result, 'confirm-in-engine', 'raising the line widens deletion');
  r = await go([[name(at, 'line0002'), { v: 1, kind: 'space-setting', name: 'start-line', drive: 'Q', gb: 1 }]], { engine: e });
  assert.deepEqual([r.done[0].result, r.done[0].reason], ['rejected', 'no-drive']);
  r = await go([[name(at, 'auto0000'), { v: 1, kind: 'space-setting', name: 'auto-free', value: true }], [name(at, 'auto0001'), { v: 1, kind: 'space-setting', name: 'empty-trash', value: false }]], { engine: e });
  assert.deepEqual(r.done.map(x => x.result), ['confirm-in-engine', 'done']);
  assert.equal(solio.defaultStartLine(1000 * 2 ** 30), 150);
  // Picks: without the 2판 test gate (SPACE_DESIGN 12.1) a free is not available on this PC; found files keep no report yet.
  r = await go([[name(at, 'pick0000'), { v: 1, kind: 'pick', action: 'free', report: 'space-1-abcdef12', items: [1] }]], { engine: e });
  assert.deepEqual([r.done[0].result, r.done[0].reason], ['rejected', 'not-available']);
  fs.writeFileSync(path.join(root, 'solio', 'space.json'), JSON.stringify({ v: 1, report: 'space-9-abcdef12', createdAt: new Date().toISOString(), candidates: [] }));
  r = await go([[name(at, 'pick0001'), { v: 1, kind: 'pick', action: 'free', report: 'space-1-abcdef12', items: [1] }], [name(at, 'pick0002'), { v: 1, kind: 'pick', action: 'free', report: 'space-9-abcdef12', items: [1] }],
    [name(at, 'pick0003'), { v: 1, kind: 'pick', action: 'restore', report: 'space-9-abcdef12', items: [1] }]], { engine: e });
  assert.deepEqual(r.done.map(x => x.reason), ['not-available', 'not-available', 'no-report']);
  // Setup is left for the window; an expired one is cleared as rejected.
  put(files, name(at, 'setupnew'), { v: 1, kind: 'setup', mode: 'protect' });
  put(files, name(at - 31 * 60000, 'setupold'), { v: 1, kind: 'setup', mode: 'protect' });
  r = await go([], { engine: e });
  assert.deepEqual(r.done, [{ kind: 'invalid', result: 'rejected', reason: 'expired' }]);
  assert.ok(fs.existsSync(path.join(files.requests, name(at, 'setupnew'))));
});

test('rest networks and AI tool consent are kept strictly', async t => {
  const root = temp(t);
  assert.deepEqual(await solio.readRestNetworks(root), []);
  assert.deepEqual(await solio.writeRestNetworks(root, ['휴대폰 핫스팟', 'Cafe', 'Cafe']), ['휴대폰 핫스팟', 'Cafe']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, solio.REST_FILE), 'utf8')), { v: 1, names: ['휴대폰 핫스팟', 'Cafe'] });
  for (const bad of [null, 'Cafe', [''], ['a\nb'], ['가'.repeat(11)], Array(21).fill('x')]) await assert.rejects(solio.writeRestNetworks(root, bad), { code: 'BAD_INPUT' }, JSON.stringify(bad));
  const off = await solio.readAiTools(root);
  assert.deepEqual(off, { tools: { space_report: false, find_restorable: false }, masks: [], clients: [] });
  const on = await solio.writeAiTools(root, { tools: { find_restorable: true }, masks: [' 건강 ', '계약'] });
  assert.deepEqual([on.tools, on.masks], [{ space_report: false, find_restorable: true }, ['건강', '계약']]);
  assert.deepEqual((await solio.writeAiTools(root, { tools: { space_report: true } })).masks, ['건강', '계약'], 'masks kept when not given');
  for (const bad of [{}, { tools: { delete: true } }, { tools: { space_report: 'yes' } }, { tools: {}, masks: [''] }, { tools: {}, masks: ['a'.repeat(41)] }, { tools: {}, other: 1 }]) {
    await assert.rejects(solio.writeAiTools(root, bad), { code: 'BAD_INPUT' }, JSON.stringify(bad));
  }
  fs.writeFileSync(path.join(root, 'mcp', 'clients.json'), JSON.stringify({ v: 1, clients: [{ name: 'Claude Code\u0007', version: '2.1', exe: 'C:\\x\\claude.exe', firstSeen: NOW, lastSeen: NOW }, { name: '' }] }));
  assert.deepEqual((await solio.readAiTools(root)).clients, [{ name: 'Claude Code', version: '2.1', exe: 'C:\\x\\claude.exe', firstSeen: new Date(NOW).toISOString(), lastSeen: new Date(NOW).toISOString() }]);
});

test('2판 free (SPACE_DESIGN 12.4): gate first, then the writer, the 10-minute life from the listing, the report, the kinds; consent off is a preview', async t => {
  const root = temp(t);
  const files = new solio.SolioFiles({ root, now: () => Date.now() });
  await files.ready();
  const engine = (over = {}) => ({ config: { repositoryId: 'r', mode: 'backup', readOnly: false, automatic: true, sources: ['C:\\Users\\me\\Documents'], ...over }, intervalMs: 3600000, now: () => Date.now(), lastAttempt: 0,
    async runOnce() { return { outcome: 'complete', resticStartedAt: Date.now() }; } });
  const calls = [];
  const host = async (method, args) => { calls.push([method, args[0]]); return method === 'space.free' ? { preview: args[0].preview, freed: 4096, items: 2, kept: 1, busy: 1 } : { freed: 0, items: 0 }; };
  const freeing = [];
  const go = async (requests, options) => { for (const [n, v] of requests) put(files, n, v); return solio.runRequests({ files, root, driveSize: async () => 1000 * 2 ** 30, host, onFree: on => { freeing.push(on); }, ...options }); };
  const at = Date.now();
  const report = { v: 1, report: 'space-7-abcdef12', createdAt: new Date().toISOString(), candidates: [
    { n: 1, grade: 'auto', kind: 'temp' }, { n: 2, grade: 'auto', kind: 'node_modules' }, { n: 3, grade: 'auto', kind: 'pip-cache' }, { n: 4, grade: 'suggest', kind: 'node_modules' }] };
  fs.writeFileSync(path.join(root, 'solio', 'space.json'), JSON.stringify(report));
  const free = (tag, over = {}) => [name(at, tag), { v: 1, kind: 'pick', action: 'free', report: 'space-7-abcdef12', items: [1, 2, 3, 4], ...over }];
  // 1. No gate: not available (no dead end in Solio — D8), and nothing reaches the runner.
  let r = await go([free('nogate00')], { engine: engine() });
  assert.deepEqual([r.done[0].result, r.done[0].reason, calls.length], ['rejected', 'not-available', 0]);
  assert.equal(await solio.spaceFreeOf(root), 'unavailable');
  fs.mkdirSync(path.join(root, 'space'), { recursive: true });
  fs.writeFileSync(path.join(root, 'space', solio.FREE_GATE), '');
  assert.equal(await solio.spaceFreeOf(root), 'off');
  // 2. Not the writer.
  r = await go([free('readonly')], { engine: engine({ readOnly: true }) });
  assert.deepEqual([r.done[0].reason], ['restore-only']);
  calls.length = 0;
  // 3. Consent off: a preview with only the 2판 kinds of the auto grade, and the backup folders handed over; the answer carries the five numbers.
  r = await go([free('preview0')], { engine: engine() });
  const free1 = calls.find(c => c[0] === 'space.free');
  assert.deepEqual(free1[1], { report: 'space-7-abcdef12', items: [1, 2], folders: ['C:\\Users\\me\\Documents'], preview: true });
  assert.ok(calls.some(c => c[0] === 'space.resume'), 'a stopped deletion is picked up first (12.3-6)');
  const result = JSON.parse(fs.readFileSync(path.join(root, 'solio', 'results', name(at, 'preview0')), 'utf8'));
  assert.deepEqual([result.result, result.preview, result.freed, result.items, result.kept, result.busy], ['done', true, 4096, 2, 1, 1]);
  assert.ok(freeing.includes(true) && freeing[freeing.length - 1] === false, 'the status says 「비우는 중」 while it runs');
  // 4. Consent on (engine window only): a real free; a request's own preview stays a preview (N2).
  await solio.setPressFree(root, true);
  assert.equal(await solio.spaceFreeOf(root), 'on');
  calls.length = 0;
  await go([free('realfree')], { engine: engine() });
  assert.equal(calls.find(c => c[0] === 'space.free')[1].preview, false);
  calls.length = 0;
  await go([free('toolprev', { preview: true })], { engine: engine() });
  assert.equal(calls.find(c => c[0] === 'space.free')[1].preview, true);
  // 5. The life is ten minutes from when this pass listed the requests.
  r = await go([[name(at - 11 * 60000, 'stale000'), free('x')[1]]], { engine: engine() });
  assert.deepEqual([r.done[0].result, r.done[0].reason], ['rejected', 'expired']);
  // 6. Only kinds 2판 does not free: not available. An old report: old-report.
  r = await go([free('cacheonl', { items: [3, 4] })], { engine: engine() });
  assert.equal(r.done[0].reason, 'not-available');
  r = await go([free('oldrepor', { report: 'space-6-abcdef12' })], { engine: engine() });
  assert.equal(r.done[0].reason, 'old-report');
  // A free answers, then the folder is read once more: a request written meanwhile is not left until the next hour (12.4 끝).
  calls.length = 0;
  const later = name(at + 1, 'later000');
  let wrote = false;
  const slowHost = async (method, args) => { if (method === 'space.free' && !wrote) { wrote = true; put(files, later, { v: 1, kind: 'space-setting', name: 'empty-trash', value: false }); } return host(method, args); };
  put(files, name(at, 'again000'), free('again000')[1]);
  r = await solio.runRequests({ files, root, engine: engine(), driveSize: async () => 1, host: slowHost });
  assert.deepEqual(r.done.map(d => d.kind), ['pick', 'space-setting']);
  // `auto-free: false` from Solio narrows: it also turns the press consent off. Turning it on stays the engine window's.
  r = await go([[name(at, 'autooff0'), { v: 1, kind: 'space-setting', name: 'auto-free', value: false }]], { engine: engine() });
  assert.equal(r.done[0].result, 'done');
  assert.equal(await solio.spaceFreeOf(root), 'off');
  // Validation: preview only on free and only a boolean.
  assert.equal(solio.validate({ v: 1, kind: 'pick', action: 'restore', report: 'space-7-abcdef12', items: [1], preview: true }, { at, now: at }).ok, false);
  assert.equal(solio.validate({ v: 1, kind: 'pick', action: 'free', report: 'space-7-abcdef12', items: [1], preview: 'yes' }, { at, now: at }).ok, false);
  // A result never carries anything but the five numbers.
  const r2 = solio.resultOf({ result: 'done', preview: false, freed: -1, items: 1.5, kept: 2, busy: 0, path: 'C:\\x' }, NOW);
  assert.deepEqual(r2, { v: 1, result: 'done', preview: false, freed: 0, items: 0, kept: 2, busy: 0, at: new Date(NOW).toISOString() });
});

test('2판 engine window: consent and lines are set only from the window; the summary is the last press', async t => {
  const root = temp(t);
  await assert.rejects(solio.setPressFree(root, true), { code: 'NOT_AVAILABLE' });
  fs.mkdirSync(path.join(root, 'space'), { recursive: true });
  fs.writeFileSync(path.join(root, 'space', solio.FREE_GATE), '');
  const on = await solio.setPressFree(root, true, NOW);
  assert.deepEqual(on.pressFree, { v: 2, kinds: ['temp', 'temp-profile', 'build'], at: new Date(NOW).toISOString() });
  // A wider scope written by anything else is not consent.
  fs.writeFileSync(path.join(root, solio.SPACE_FILE), JSON.stringify({ pressFree: { v: 2, kinds: ['temp', 'temp-profile', 'build', 'cache'], at: new Date(NOW).toISOString() } }));
  assert.equal((await solio.readSpaceSettings(root)).pressFree, null);
  await solio.setStartLine(root, 'C', 400, { driveSize: async () => 953 * 2 ** 30 });
  assert.deepEqual((await solio.readSpaceSettings(root)).startLines, { C: 400 });
  await assert.rejects(solio.setStartLine(root, 'C', 2000, { driveSize: async () => 953 * 2 ** 30 }), { code: 'BAD_INPUT' });
  const ledger = [
    { at: '2026-11-24T01:00:00.000Z', report: 'space-1-aaaaaaaa', preview: true, kind: 'node_modules', stage: 'would', path: 'C:\\old\\node_modules', bytes: 100 },
    { at: '2026-11-25T01:00:00.000Z', report: 'space-2-aaaaaaaa', preview: true, kind: 'node_modules', stage: 'would', path: 'C:\\a\\node_modules', bytes: 300 },
    { at: '2026-11-25T01:00:00.000Z', report: 'space-2-aaaaaaaa', preview: true, kind: 'temp', stage: 'would', n: 4, bytes: 50, list: 'freed/x.txt' },
    { at: '2026-11-25T01:00:00.000Z', stage: 'kept', why: { recent: 3 } }];
  fs.writeFileSync(path.join(root, 'space', 'freed.jsonl'), ledger.map(l => JSON.stringify(l)).join('\n') + '\n');
  const sum = await solio.readFreeSummary(root);
  assert.deepEqual([sum.preview, sum.bytes, sum.count, sum.items.length], [true, 350, 5, 2]);
  // 한 누름은 100개까지 다룬다: 합계는 펼침 목록(50줄)으로 자르기 전의 모든 줄이다(카본 끝판 A1)
  const many = Array.from({ length: 70 }, (_, i) => ({ at: '2026-11-26T01:00:00.000Z', report: 'space-3-aaaaaaaa', preview: false, kind: '__pycache__', stage: 'freed', path: `C:\\p\\${i}\\__pycache__`, bytes: 10 }));
  fs.appendFileSync(path.join(root, 'space', 'freed.jsonl'), many.map(l => JSON.stringify(l)).join('\n') + '\n');
  const big = await solio.readFreeSummary(root);
  assert.deepEqual([big.preview, big.bytes, big.count, big.items.length], [false, 700, 70, 50]);
  // Rust(space_free.rs)가 실제로 쓰는 줄 꼴: 떼어 낼 것 → 지움(빌드 폴더마다), 임시는 누름마다 한 줄. 지운 빌드 폴더가 지난 누름에 나온다(Fable 최종 P1-2)
  const at = '2026-11-27T01:00:00.000Z', report = 'space-4-aaaaaaaa';
  const rust = [
    { at, report, preview: false, kind: 'node_modules', stage: 'staged', path: 'C:\\shop\\node_modules', as: 'C:\\shop\\node_modules.swb-free-0123abcd', id: '1-2', bytes: 1000, files: 9 },
    { at, report, preview: false, kind: 'node_modules', stage: 'freed', path: 'C:\\shop\\node_modules', as: 'C:\\shop\\node_modules.swb-free-0123abcd', bytes: 1000, files: 9, freeBefore: 1, freeAfter: 2, how: 'npm ci' },
    { at, report, preview: false, kind: 'temp', stage: 'freed', n: 3, bytes: 30, list: 'freed/x-temp.txt', how: '저절로 다시 생김' },
    { at, report, preview: false, stage: 'kept', why: { recent: 1 } }];
  fs.appendFileSync(path.join(root, 'space', 'freed.jsonl'), rust.map(l => JSON.stringify(l)).join('\n') + '\n');
  const real = await solio.readFreeSummary(root);
  assert.deepEqual([real.preview, real.bytes, real.count, real.items.map(x => x.kind)], [false, 1030, 4, ['node_modules', 'temp']]);
});

test('contract samples in contract/solio are what the engine writes and accepts', () => {
  const dir = path.join(__dirname, '..', 'contract', 'solio');
  const read = n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
  const status = read('status.sample.json');
  const made = solio.statusOf({ state: engineState(), version: '0.7.0', startupRegistered: true, now: NOW });
  assert.deepEqual(Object.keys(status), Object.keys(made), 'the sample has the fields in the engine\'s order');
  assert.ok(solio.STATES.includes(status.state) && status.attention.every(t => solio.TOPICS.includes(t)));
  for (const file of fs.readdirSync(path.join(dir, 'requests'))) {
    const m = solio.NAME.exec(file); assert.ok(m, file);
    const v = solio.validate(read(path.join('requests', file)), { at: Number(m[1]), now: Number(m[1]) });
    assert.equal(v.ok, true, file);
  }
  for (const file of fs.readdirSync(path.join(dir, 'results'))) {
    const r = read(path.join('results', file));
    assert.ok(solio.NAME.test(file) && solio.RESULTS.includes(r.result) && (r.reason === undefined || solio.REASONS.includes(r.reason)), file);
    assert.deepEqual(solio.resultOf(r, Date.parse(r.at)), r, file);
  }
  const space = read('space.sample.json');
  assert.ok(/^space-[0-9]+-[0-9a-f]{8}$/.test(space.report) && space.candidates.every((c, i) => c.n === i + 1 && ['auto', 'suggest', 'view'].includes(c.grade)));
});
