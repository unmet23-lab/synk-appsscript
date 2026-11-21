'use strict';
// 솔리오 「사무실」의 세션 모음과 볼 계정 확인(office.cjs, 구현설계.md 3.4 · 4.4 · 11.1 · 12.1 · 14.1의 office-gate).
// viewers.json · userData는 임시 폴더, 기록 살피기 · PC 값 · 타이머는 가짜다. 실제 사용자 폴더는 읽지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOffice, loadOfficeModel, defaultViewersFile, OFFICE_TICKS } = require('../src/office.cjs');

const S = 1e3, M = 60e3;
const T0 = new Date(2026, 10, 20, 9, 0).getTime();
const YUHO = { synk_user_id: 'owner-1234567890', display_name: '유호' };
const SECOND = { synk_user_id: 'second-1234567890', display_name: '둘째 볼 계정' };
const OTHER = { synk_user_id: 'tester-1234567890', display_name: '시험 계정' };
const S1 = '00000001-0000-4000-8000-000000000001', S2 = '00000002-0000-4000-8000-000000000002';
const ROOTS = { claude: ['C:\\Users\\a\\.claude'], codex: ['C:\\Users\\a\\.codex\\sessions'] };
let model;
test.before(async () => { model = await loadOfficeModel(); });

const settle = async (turns = 40) => { for (let i = 0; i < turns; i++) { await new Promise(resolve => setImmediate(resolve)); if (i % 10 === 9) await new Promise(resolve => setTimeout(resolve, 1)); } };
function fakeClock(start) {
  let t = start;
  const timers = new Map();
  const add = (fn, ms, every) => { const id = { id: timers.size + 1 }; timers.set(id, { fn, at: t + ms, every }); return id; };
  return {
    now: () => t,
    setTimeout: (fn, ms) => add(fn, ms, 0), clearTimeout: id => { timers.delete(id); },
    setInterval: (fn, ms) => add(fn, ms, ms), clearInterval: id => { timers.delete(id); },
    intervals: () => [...timers.values()].filter(x => x.every).map(x => x.every).sort((a, b) => a - b),
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [id, x] of timers) if (x.at <= end && (!next || x.at < next[1].at)) next = [id, x];
        if (!next) break;
        const [id, x] = next;
        t = x.at;
        if (x.every) x.at += x.every; else timers.delete(id);
        x.fn();
        await settle();
      }
      t = end;
      await settle();
    },
  };
}
function setup({ viewers = [YUHO.synk_user_id, SECOND.synk_user_id], viewersText = null } = {}) {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'office-gate-'));
  const viewersFile = path.join(top, 'Local', 'synk', 'office', 'viewers.json');
  if (viewersText != null || viewers) {
    fs.mkdirSync(path.dirname(viewersFile), { recursive: true });
    fs.writeFileSync(viewersFile, viewersText ?? JSON.stringify({ synk_user_ids: viewers }));
  }
  const userData = path.join(top, 'userData');
  const work = path.join(top, 'work');
  fs.mkdirSync(path.join(work, 'shop'), { recursive: true });
  const clock = fakeClock(T0);
  const records = { calls: [], result: [], hold: null, async scan(opts) { this.calls.push(opts); if (this.hold) await this.hold; return this.result; } };
  const capacity = { reads: 0, async read() { capacity.reads += 1; return { cores: 8, totalMemGb: 15.7, freeMemGb: 6.2, cpuPercent: capacity.reads }; } };
  const changes = { n: 0 };
  const office = createOffice({
    userData, viewersFile, model, records, capacity, roots: ROOTS, now: clock.now,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    onChange: () => { changes.n += 1; },
  });
  return { top, viewersFile, userData, work, shop: path.join(work, 'shop'), clock, records, capacity, changes, office };
}
const hook = (event, at, extra = {}) => ({ kind: 'hook', event, sessionId: S1, cwd: 'C:\\work\\shop', at, ...extra });

test('a non-viewer, a signed-out window, a bad id, and a missing or broken viewers file are refused by every public method', async () => {
  const cases = [
    { label: 'another account', account: OTHER },
    { label: 'signed out', account: null },
    { label: 'no id', account: {} },
    { label: 'bad id', account: { synk_user_id: '..\\..\\evil' } },
    { label: 'broken viewers.json', account: YUHO, viewersText: '{ broken' },
    { label: 'empty list', account: YUHO, viewersText: '{"synk_user_ids":[]}' },
    { label: 'no viewers.json', account: YUHO, viewers: null },
  ];
  for (const c of cases) {
    const f = setup({ viewers: c.viewers === null ? null : undefined, viewersText: c.viewersText ?? null });
    const { office } = f, account = c.account;
    assert.equal(await office.allowed(account), false, c.label);
    assert.deepEqual(await office.snapshot(account), { ok: true, available: false }, c.label);
    const refused = { ok: false, code: 'NOT_ALLOWED' };
    assert.deepEqual(await office.watch(true, account), refused, c.label);
    assert.deepEqual(await office.ingest(hook('PostToolUse', T0), account), refused, c.label);
    assert.deepEqual(await office.seen(null, account), refused, c.label);
    assert.deepEqual(await office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, account), refused, c.label);
    assert.deepEqual(await office.removeDepartment('dept1234', account), refused, c.label);
    assert.deepEqual(await office.assign(S1, 'dept1234', account), refused, c.label);
    assert.deepEqual(await office.saveSettings({ view: 'top' }, account), refused, c.label);
    assert.deepEqual(await office.saveRoots([f.shop], account), refused, c.label);
    await f.clock.advance(OFFICE_TICKS.tick * 2);
    assert.equal(f.records.calls.length, 0, `${c.label}: no record is read`);
    assert.equal(f.capacity.reads, 0, `${c.label}: the PC is not read`);
    assert.deepEqual(f.clock.intervals(), [], `${c.label}: no timer`);
    assert.equal(fs.existsSync(path.join(f.userData, 'Office')), false, `${c.label}: no office file`);
    assert.equal(f.changes.n, 0, c.label);
  }
});

test('with no viewers file the asking account is noted once in its own viewer-pending file, and hook news never notes', async () => {
  const f = setup({ viewers: null });
  const dir = path.join(path.dirname(f.viewersFile), 'viewer-pending');
  const fileOf = a => path.join(dir, a.synk_user_id + '.json');
  assert.equal(f.office.pendingDir, dir);
  await f.office.snapshot(YUHO);
  assert.deepEqual(JSON.parse(fs.readFileSync(fileOf(YUHO), 'utf8')), { synk_user_id: YUHO.synk_user_id, display_name: '유호', asked_at: new Date(T0).toISOString() }, 'the folder is made and one file written');
  fs.rmSync(fileOf(YUHO));
  await f.office.snapshot(YUHO);
  await f.office.allowed(YUHO);
  await f.office.watch(true, YUHO);
  assert.equal(fs.existsSync(fileOf(YUHO)), false, 'the same account is written once while the app runs');
  await f.office.ingest(hook('PostToolUse', T0), OTHER);
  assert.deepEqual(fs.readdirSync(dir), [], 'hook news does not note anyone');
  await f.office.allowed(OTHER);
  await f.office.snapshot(SECOND);
  assert.deepEqual(fs.readdirSync(dir).sort(), [OTHER.synk_user_id + '.json', SECOND.synk_user_id + '.json'].sort(), 'each account writes only its own file');
  await f.office.allowed(null);
  assert.equal(fs.readdirSync(dir).length, 2, 'a signed-out window is not noted');
});

test('the viewers file is in LOCALAPPDATA on Windows, an env value wins, and without a place nobody is allowed', async () => {
  assert.equal(defaultViewersFile({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32'), path.join('C:\\Users\\a\\AppData\\Local', 'synk', 'office', 'viewers.json'));
  assert.equal(defaultViewersFile({ SYNK_OFFICE_VIEWERS: 'D:\\v.json', LOCALAPPDATA: 'C:\\x' }, 'win32'), 'D:\\v.json');
  assert.equal(defaultViewersFile({}, 'darwin'), null);
  const office = createOffice({ userData: os.tmpdir(), viewersFile: null, model, records: { scan: async () => [] }, capacity: { read: async () => null } });
  assert.equal(await office.allowed(YUHO), false);
  assert.throws(() => createOffice({ viewersFile: null }), TypeError, 'the model is required');
});

test('an allowed account: watch lists everything at start, then every 15 s, and stops; the snapshot has the agreed shape', async () => {
  const f = setup();
  const added = path.join(f.work, 'other-claude');
  fs.mkdirSync(added);
  assert.equal((await f.office.saveRoots([added], YUHO)).ok, true);
  f.records.result = [{ kind: 'record', sessionId: S1, cwd: f.shop, tool: 'claude', changedAt: T0 - 5 * S }];
  assert.deepEqual(await f.office.watch(true, YUHO), { ok: true, watching: true });
  assert.deepEqual(f.records.calls[0], { full: true, roots: { claude: [...ROOTS.claude, added], codex: ROOTS.codex } });
  assert.ok(f.clock.intervals().includes(OFFICE_TICKS.tick));
  await f.clock.advance(15 * S);
  assert.equal(f.records.calls.length, 2);
  assert.equal(f.records.calls[1].full, false);
  const snap = await f.office.snapshot(YUHO);
  assert.deepEqual(Object.keys(snap).sort(), ['assignments', 'available', 'departments', 'hooks', 'ok', 'pc', 'readAt', 'roots', 'settings', 'state'].sort());
  assert.equal(snap.available, true);
  assert.deepEqual(Object.keys(snap.state.sessions), [S1]);
  assert.deepEqual(snap.state.ignored, {});
  assert.deepEqual(snap.hooks, { on: false });
  assert.deepEqual(snap.settings, { view: 'tilted', manualCap: null });
  assert.deepEqual(snap.roots, { claude: [...ROOTS.claude, added], codex: ROOTS.codex, added: [added] });
  assert.deepEqual(snap.pc, { cores: 8, totalMemGb: 15.7, freeMemGb: 6.2, cpuPercent: 1 });
  assert.equal(snap.readAt, f.clock.now());
  assert.ok(!/분째|분 전|일하는 중/.test(JSON.stringify(snap)), 'no clock-dependent words are made here');
  assert.deepEqual(model.officeSessions(snap.state, f.clock.now()).map(v => [v.id, v.status]), [[S1, 'working']]);
  assert.deepEqual(await f.office.watch(false, YUHO), { ok: true, watching: false });
  assert.ok(!f.clock.intervals().includes(OFFICE_TICKS.tick), 'the scan timer is gone');
  await f.clock.advance(60 * S);
  assert.equal(f.records.calls.length, 2, 'no scan while the room is closed');
  f.office.close();
  assert.deepEqual(f.clock.intervals(), []);
});

test('an account change clears the sessions and stops the scan timer; a scan finishing after the change is dropped', async () => {
  const f = setup();
  assert.deepEqual(await f.office.ingest(hook('PostToolUse', T0), YUHO), { ok: true });
  await f.office.watch(true, YUHO);
  assert.deepEqual(f.clock.intervals(), [OFFICE_TICKS.tick, OFFICE_TICKS.prune]);
  assert.deepEqual(f.office.accountChanged(YUHO), { ok: true, cleared: false }, 'the same account keeps its sessions');
  assert.deepEqual(Object.keys((await f.office.snapshot(YUHO)).state.sessions), [S1]);
  assert.deepEqual(f.office.accountChanged(null), { ok: true, cleared: true });
  assert.deepEqual(f.clock.intervals(), [], 'scan and prune timers stopped');
  assert.deepEqual(await f.office.snapshot(YUHO), { ok: false, code: 'AUTH_CHANGED' }, 'after the sign-out a call for the old account is refused');
  assert.deepEqual(f.office.accountChanged(YUHO), { ok: true, cleared: true }, 'signing in again opens a fresh memory');
  assert.deepEqual((await f.office.snapshot(YUHO)).state.sessions, {}, 'signed in again: the sessions start empty');
  // 살피는 사이에 계정이 바뀐다
  await f.office.watch(true, YUHO);
  let release;
  f.records.hold = new Promise(resolve => { release = resolve; });
  f.records.result = [{ kind: 'record', sessionId: S2, cwd: f.shop, tool: 'claude', changedAt: f.clock.now() }];
  await f.clock.advance(15 * S);
  const before = f.records.calls.length;
  assert.deepEqual(f.office.accountChanged(SECOND), { ok: true, cleared: true });
  release();
  await settle();
  assert.equal(f.records.calls.length, before);
  assert.deepEqual((await f.office.snapshot(SECOND)).state.sessions, {}, 'the late result of the old account is not folded in');
  assert.deepEqual(f.clock.intervals(), []);
});

test('hook news is ignored without an allowed account, and only the agreed fields are kept', async () => {
  const f = setup();
  assert.deepEqual(await f.office.ingest(hook('PostToolUse', T0), null), { ok: false, code: 'NOT_ALLOWED' });
  assert.deepEqual(await f.office.ingest(hook('PostToolUse', T0), OTHER), { ok: false, code: 'NOT_ALLOWED' });
  assert.deepEqual((await f.office.snapshot(YUHO)).state.sessions, {});
  assert.equal((await f.office.ingest({ kind: 'reset' }, YUHO)).code, 'VALUE');
  assert.equal((await f.office.ingest({ kind: 'record', sessionId: S1, cwd: 'C:\\x', tool: 'claude', changedAt: T0 }, YUHO)).code, 'VALUE', 'records come only from the scanner');
  assert.equal((await f.office.ingest({ kind: 'hook', event: 'Stop' }, YUHO)).code, 'VALUE', 'a session id is needed');
  const noisy = hook('PostToolUse', T0 + 3600e3, { toolName: 'Bash', toolDetail: 'npm', command: 'rm -rf C:\\secret', tool_input: { command: 'rm -rf C:\\secret' }, tool_response: '비밀 결과', prompt: '손님이 친 글' });
  assert.deepEqual(await f.office.ingest(noisy, YUHO), { ok: true });
  const snap = await f.office.snapshot(YUHO);
  const text = JSON.stringify(snap);
  for (const word of ['rm -rf', 'secret', '비밀', '손님이 친 글']) assert.ok(!text.includes(word), word);
  assert.equal(snap.state.sessions[S1].lastHookAt, T0, 'a time in the future is taken as now');
  assert.deepEqual(snap.state.sessions[S1].lastTool, { name: 'Bash', detail: 'npm' });
});

test('onChange is called once per 250 ms of changes and never when nothing changed', async () => {
  const f = setup();
  await f.office.ingest(hook('SessionStart', T0, { model: 'claude-opus-5-5' }), YUHO);
  await f.office.ingest(hook('PostToolUse', T0, { toolName: 'Read', toolDetail: 'a.ts' }), YUHO);
  await f.office.ingest(hook('PostToolUse', T0, { sessionId: S2 }), YUHO);
  await f.clock.advance(249);
  assert.equal(f.changes.n, 0);
  await f.clock.advance(1);
  assert.equal(f.changes.n, 1, 'three changes, one call');
  await f.office.ingest(hook('PostToolUse', T0, { toolName: 'Read', toolDetail: 'a.ts' }), YUHO);
  await f.office.ingest(hook('Notification', T0, { notificationType: 'unknown_kind' }), YUHO);
  await f.office.ingest(hook('Bogus', T0), YUHO);
  await f.office.ingest(hook('PostToolUse', T0, { sessionId: 'run-0000-0000', cwd: 'C:\\Users\\a\\AppData\\Roaming\\SYNK Desktop\\AiSubscriptions\\run' }), YUHO);
  await f.office.ingest(hook('PostToolUse', T0), OTHER);
  await f.clock.advance(1000);
  assert.equal(f.changes.n, 1, 'the same news, unknown events, the app\'s own run and refused news change nothing');
  f.records.result = [{ kind: 'record', sessionId: '00000003-0000-4000-8000-000000000003', cwd: f.shop, tool: 'codex', changedAt: f.clock.now() }];
  await f.office.watch(true, YUHO);
  await f.clock.advance(300);
  assert.equal(f.changes.n, 2, 'a new record session');
  await f.clock.advance(15 * S);
  await f.clock.advance(15 * S);
  assert.equal(f.changes.n, 2, 'the same record observation every tick changes nothing');
  assert.equal((await f.office.saveSettings({ view: 'top' }, YUHO)).ok, true);
  await f.clock.advance(300);
  assert.equal(f.changes.n, 3, 'a store change');
  const dept = (await f.office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, YUHO)).data.departments[0].id;
  await f.office.assign(S1, dept, YUHO);
  await f.clock.advance(300);
  const n = f.changes.n;
  assert.equal((await f.office.assign(S1, dept, YUHO)).ok, true);
  await f.clock.advance(300);
  assert.equal(f.changes.n, n, 'the same assignment again is silent');
});

test('the PC values are read at most every 30 s', async () => {
  const f = setup();
  assert.equal((await f.office.snapshot(YUHO)).pc.cpuPercent, 1, 'the first snapshot waits for the first reading');
  await f.clock.advance(10 * S);
  assert.equal((await f.office.snapshot(YUHO)).pc.cpuPercent, 1);
  assert.equal(f.capacity.reads, 1);
  await f.clock.advance(21 * S);
  assert.equal((await f.office.snapshot(YUHO)).pc.cpuPercent, 1, 'an old value is given at once while a new one is read');
  await settle();
  assert.equal(f.capacity.reads, 2);
  assert.equal((await f.office.snapshot(YUHO)).pc.cpuPercent, 2);
  assert.equal(f.capacity.reads, 2);
});

test('departments, assignments, settings and seen go to the store for the signed-in account', async () => {
  const f = setup();
  assert.deepEqual(await f.office.saveDepartment({ name: '쇼핑몰', folder: path.join(f.work, 'missing') }, YUHO), { ok: false, code: 'FOLDER' });
  const saved = await f.office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, YUHO);
  assert.equal(saved.ok, true);
  const dept = saved.data.departments[0].id;
  assert.ok(fs.existsSync(path.join(f.userData, 'Office', YUHO.synk_user_id, 'office.json')));
  assert.deepEqual(await f.office.assign(S1, dept, YUHO), { ok: false, code: 'NOT_FOUND' }, 'only a session that is standing now can be sent');
  await f.office.ingest(hook('PostToolUse', T0, { cwd: 'C:\\elsewhere' }), YUHO);
  assert.equal((await f.office.assign(S1, dept, YUHO)).ok, true);
  assert.deepEqual((await f.office.snapshot(YUHO)).assignments, { [S1]: dept });
  assert.deepEqual((await f.office.snapshot(SECOND)).departments, [], 'another viewer has its own file');
  await f.clock.advance(3 * M);
  await f.office.ingest(hook('Stop', f.clock.now()), SECOND);
  await f.office.ingest(hook('PostToolUse', T0, { cwd: 'C:\\elsewhere' }), YUHO); // 계정이 다시 바뀌어 비었다
  await f.clock.advance(3 * M);
  await f.office.ingest(hook('Stop', f.clock.now()), YUHO);
  let snap = await f.office.snapshot(YUHO);
  const ctx = { departments: snap.departments, assignments: snap.assignments };
  assert.deepEqual(model.officeSessions(snap.state, f.clock.now(), ctx).map(v => [v.departmentId, v.status, v.alert]), [[dept, 'done', true]]);
  assert.deepEqual(await f.office.seen(dept, YUHO), { ok: true });
  snap = await f.office.snapshot(YUHO);
  assert.deepEqual(model.officeSessions(snap.state, f.clock.now(), ctx).map(v => v.status), ['resting']);
  assert.equal((await f.office.seen(5, YUHO)).code, 'VALUE');
  assert.deepEqual((await f.office.saveSettings({ view: 'top', manualCap: 4 }, YUHO)).data.manualCap, 4);
  assert.deepEqual((await f.office.snapshot(YUHO)).settings, { view: 'top', manualCap: 4 });
  assert.equal((await f.office.removeDepartment(dept, YUHO)).ok, true);
  assert.deepEqual((await f.office.snapshot(YUHO)).assignments, {});
});

test('sessions quiet for 30 minutes are pruned by the timer, and their department memory is forgotten', async () => {
  const f = setup();
  const dept = (await f.office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, YUHO)).data.departments[0].id;
  await f.office.ingest(hook('PostToolUse', T0, { cwd: 'C:\\elsewhere' }), YUHO);
  await f.office.assign(S1, dept, YUHO);
  assert.ok(f.clock.intervals().includes(OFFICE_TICKS.prune));
  await f.clock.advance(29 * M);
  assert.deepEqual(Object.keys((await f.office.snapshot(YUHO)).state.sessions), [S1]);
  const n = f.changes.n;
  await f.clock.advance(2 * M);
  await settle();
  const snap = await f.office.snapshot(YUHO);
  assert.deepEqual(snap.state.sessions, {});
  assert.deepEqual(snap.assignments, {});
  assert.ok(f.changes.n > n);
  assert.ok(!f.clock.intervals().includes(OFFICE_TICKS.prune), 'the prune timer stops when nobody is left');
});

/* ── 「승인 물음도 보기」의 관문(구현설계.md 11.1 · 14.1의 office-gate, 15절 5단계) ──
   훅 서버는 실제 office-hooks를 임시 폴더로 돌린다. 설정 폴더는 넘겨받은 임시 폴더나 임시 보는 폴더뿐이다 */
const http = require('node:http');
const { createOfficeHooks, OVERRIDE_ENV, PATH_PREFIX } = require('../src/office-hooks.cjs');
function hookSetup({ installed = false, viewers = [YUHO.synk_user_id] } = {}) {
  const f = setup({ viewers });
  const claude = path.join(f.top, 'claude-home'), added = path.join(f.top, 'claude-added');
  fs.mkdirSync(claude); fs.mkdirSync(added);
  let account = null;
  const hooks = createOfficeHooks({
    userData: f.userData, installed, env: installed ? {} : { [OVERRIDE_ENV]: claude }, baseDirs: () => [],
    accepts: () => (account ? office.accepts(account) : false), deliver: (e, a, ticket) => { if (account) void office.ingest(e, account, ticket); }, listenRetries: 0,
  });
  const office = createOffice({ userData: f.userData, viewersFile: f.viewersFile, model, records: f.records, capacity: f.capacity, roots: { claude: [claude], codex: [] }, hooks, now: () => Date.now() });
  return { ...f, claude, added, hooks, office, setAccount: a => { account = a; } };
}
const post = (port, p, body) => new Promise(resolve => {
  const data = Buffer.from(JSON.stringify(body));
  const req = http.request({ host: '127.0.0.1', port, path: p, method: 'POST', headers: { 'content-length': data.length } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', e => resolve(e.code));
  req.end(data);
});
const hookState = f => JSON.parse(fs.readFileSync(path.join(f.userData, 'Office', 'hooks.json'), 'utf8'));
const pause = () => new Promise(r => setTimeout(r, 40));

test('hooks-set is refused for a non-viewer, a signed-out window and a missing viewers file, and no file is touched', async () => {
  for (const [label, account, viewers] of [['another account', OTHER, undefined], ['signed out', null, undefined], ['no viewers.json', YUHO, null]]) {
    const f = hookSetup({ viewers: viewers === null ? null : undefined });
    assert.deepEqual(await f.office.setHooks(true, account), { ok: false, code: 'NOT_ALLOWED' }, label);
    assert.deepEqual(await f.office.setHooks(false, account), { ok: false, code: 'NOT_ALLOWED' }, label);
    assert.deepEqual(fs.readdirSync(f.claude), [], `${label}: no settings.json was made`);
    assert.equal(f.hooks.listening(), false, `${label}: no server`);
    assert.equal(fs.existsSync(path.join(f.userData, 'Office', 'hooks.json')), false, `${label}: no state file`);
  }
});

test('a viewer turns hooks on for the account\'s Claude folders; the snapshot carries the real state without the port or token', async () => {
  const f = hookSetup({ installed: true });
  assert.equal((await f.office.saveRoots([f.added], YUHO)).ok, true);
  let snap = await f.office.snapshot(YUHO);
  assert.deepEqual([snap.hooks.on, snap.hooks.available, snap.hooks.message], [false, true, null]);
  assert.deepEqual(snap.hooks.dirs.map(d => [path.basename(d.dir), d.on, d.folder, d.file]), [['claude-home', false, true, false], ['claude-added', false, true, false]], 'the default folder and the added one are the plan');
  const r = await f.office.setHooks(true, YUHO);
  assert.deepEqual(r, { ok: true, written: 2, created: 2, refused: 0 }, 'the answer has no folder paths');
  snap = await f.office.snapshot(YUHO);
  assert.equal(snap.hooks.on, true);
  assert.deepEqual(snap.hooks.dirs.map(d => d.on), [true, true]);
  const text = JSON.stringify(snap.hooks);
  const st = hookState(f);
  assert.ok(!text.includes(st.token) && !text.includes(String(st.port)), 'the port and the token stay in the main process');
  assert.equal((await f.office.setHooks(false, YUHO)).ok, true);
  assert.equal((await f.office.snapshot(YUHO)).hooks.on, false);
  assert.ok(!fs.readFileSync(path.join(f.claude, 'settings.json'), 'utf8').includes('synk-office'));
});

test('turning off and the unhook run need no viewer: they work while signed out and with a non-viewer, while hooks-set stays refused', async () => {
  const f = hookSetup();
  assert.equal((await f.office.setHooks(true, YUHO)).ok, true);
  assert.ok(fs.readFileSync(path.join(f.claude, 'settings.json'), 'utf8').includes('synk-office'));
  f.office.accountChanged(null);
  assert.deepEqual(await f.office.setHooks(true, OTHER), { ok: false, code: 'NOT_ALLOWED' });
  const off = await f.hooks.disable(); // main의 synk:office-hooks-off가 부르는 것. 계정을 받지 않는다
  assert.equal(off.ok, true);
  assert.ok(!fs.readFileSync(path.join(f.claude, 'settings.json'), 'utf8').includes('synk-office'));
  assert.equal(f.hooks.listening(), false);
  // --office-unhook: 새 실행이 서버 없이 지운다
  f.office.accountChanged(YUHO);
  assert.equal((await f.office.setHooks(true, YUHO)).ok, true);
  await f.hooks.close();
  const unhook = createOfficeHooks({ userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: f.claude }, baseDirs: () => [] });
  assert.equal((await unhook.unhook()).ok, true);
  assert.ok(!fs.readFileSync(path.join(f.claude, 'settings.json'), 'utf8').includes('synk-office'));
});

test('the server stays open across account changes; without a signed-in viewer its news is dropped unread, and the viewer\'s news is folded', async () => {
  const f = hookSetup();
  await f.office.setHooks(true, YUHO);
  const st = hookState(f), p = PATH_PREFIX + st.token;
  const news = { hook_event_name: 'PostToolUse', session_id: S1, cwd: f.shop, tool_name: 'Read', tool_input: { file_path: path.join(f.shop, 'a.ts') }, tool_response: '파일 내용' };
  f.setAccount(null);
  assert.equal(await post(st.port, p, news), 204);
  f.setAccount(OTHER);
  assert.equal(await post(st.port, p, news), 204);
  await pause();
  assert.equal(await f.office.accepts(OTHER), false);
  assert.deepEqual((await f.office.snapshot(YUHO)).state.sessions, {}, 'nothing folded for a non-viewer or a signed-out window');
  assert.ok(!fs.existsSync(path.join(path.dirname(f.viewersFile), 'viewer-pending', OTHER.synk_user_id + '.json')), 'hook news never notes an account');
  f.office.accountChanged(OTHER);
  assert.equal(f.hooks.listening(), true, 'an account change does not close the server');
  f.setAccount(YUHO);
  f.office.accountChanged(YUHO);
  assert.equal(await post(st.port, p, news), 204);
  await pause();
  const snap = await f.office.snapshot(YUHO);
  assert.deepEqual(Object.keys(snap.state.sessions), [S1]);
  assert.deepEqual(snap.state.sessions[S1].lastTool, { name: 'Read', detail: 'a.ts' });
  assert.ok(!JSON.stringify(snap).includes('파일 내용'));
  f.office.accountChanged(null);
  assert.deepEqual(await f.office.snapshot(YUHO), { ok: false, code: 'AUTH_CHANGED' });
  f.office.accountChanged(YUHO);
  assert.deepEqual((await f.office.snapshot(YUHO)).state.sessions, {}, 'signing out still clears the sessions');
  assert.equal(f.hooks.listening(), true);
  await f.hooks.close();
});

test('an office made without the hooks service keeps saying hooks are off and refuses to turn them on', async () => {
  const f = setup();
  assert.deepEqual((await f.office.snapshot(YUHO)).hooks, { on: false });
  assert.deepEqual(await f.office.setHooks(true, YUHO), { ok: false, code: 'NOT_HERE' });
});

/* ── GPT 검수 GA1 · GA3(11-20) ── 기다리는 사이에 계정이 바뀌면 옛 계정으로 기억을 다시 열지 않는다. 보는 폴더 고치기는 차례 안에서 */
/* 볼 계정 파일(viewers.json)을 읽는 것을 붙잡아 두는 fs. release()를 부를 때까지 그 stat이 끝나지 않는다 */
function holdingFs(viewersFile) {
  let hold = null, release = () => {};
  const p = fs.promises;
  return {
    arm() { hold = new Promise(r => { release = r; }); },
    release: () => { const r = release; hold = null; release = () => {}; r(); },
    fsImpl: { promises: { ...p, stat: async (file, ...a) => { if (hold && String(file) === viewersFile) await hold; return p.stat(file, ...a); } } },
  };
}
function holdSetup() {
  const f = setup();
  const h = holdingFs(f.viewersFile);
  const office = createOffice({
    userData: f.userData, viewersFile: f.viewersFile, model, records: f.records, capacity: f.capacity, roots: ROOTS, fsImpl: h.fsImpl, now: f.clock.now,
    setInterval: f.clock.setInterval, clearInterval: f.clock.clearInterval, setTimeout: f.clock.setTimeout, clearTimeout: f.clock.clearTimeout,
  });
  return { ...f, office, h };
}

test('GA1: a snapshot waiting on the viewers file when the user signs out returns AUTH_CHANGED, not the old account\'s departments, and reopens nothing', async () => {
  const f = holdSetup();
  f.office.accountChanged(YUHO);
  assert.equal((await f.office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, YUHO)).ok, true);
  assert.deepEqual(await f.office.ingest(hook('PostToolUse', T0), YUHO), { ok: true });
  const reads = f.capacity.reads;
  f.h.arm();
  const late = f.office.snapshot(YUHO);
  await settle();
  f.office.accountChanged(null); // 로그아웃: 세션 기억을 비운다
  f.h.release();
  const answer = await late;
  assert.deepEqual(answer, { ok: false, code: 'AUTH_CHANGED' }, 'no available:true and no departments for the signed-out account');
  assert.ok(!JSON.stringify(answer).includes('쇼핑몰'));
  assert.equal(f.capacity.reads, reads, 'the PC is not read for it either');
  // 기억을 다시 열지 않았다: 같은 계정으로 다시 로그인하면 세션이 빈 채로 시작한다
  f.office.accountChanged(YUHO);
  const again = await f.office.snapshot(YUHO);
  assert.equal(again.available, true);
  assert.deepEqual(again.state.sessions, {}, 'the late call did not bring the old sessions back');
  assert.deepEqual(again.departments.map(d => d.name), ['쇼핑몰'], 'the departments are the account\'s file, read for the new turn');
});

test('GA1: a watch or an ingest that waited across an account change starts nothing for the old account; allowed and accepts say no', async () => {
  const f = holdSetup();
  f.office.accountChanged(YUHO);
  f.h.arm();
  const watch = f.office.watch(true, YUHO);
  const ingest = f.office.ingest(hook('PostToolUse', T0), YUHO);
  const allowed = f.office.allowed(YUHO);
  const accepts = f.office.accepts(YUHO);
  await settle();
  f.office.accountChanged(SECOND);
  f.h.release();
  assert.deepEqual(await watch, { ok: false, code: 'AUTH_CHANGED' });
  assert.deepEqual(await ingest, { ok: false, code: 'AUTH_CHANGED' });
  assert.equal(await allowed, false);
  assert.equal(await accepts, false);
  assert.deepEqual(f.clock.intervals(), [], 'no scan timer and no prune timer for the old account');
  assert.equal(f.records.calls.length, 0, 'no record was read');
  assert.deepEqual((await f.office.snapshot(SECOND)).state.sessions, {}, 'the old account\'s news did not land in the new account\'s office');
  // 저장이 기다리는 사이에 바뀌어도 옛 계정의 판을 새 계정의 기억으로 남기지 않는다
  f.h.arm();
  const save = f.office.saveSettings({ view: 'top' }, SECOND);
  await settle();
  f.office.accountChanged(YUHO);
  f.h.release();
  assert.deepEqual(await save, { ok: false, code: 'AUTH_CHANGED' });
  assert.equal((await f.office.snapshot(YUHO)).settings.view, 'tilted', 'nothing was written for the account that left');
});

/* GPT 검수 r8 GA1 뒤의 설계 고침(구현설계 11.1 「계정 묶기」): 계정과 로그인 회차를 한 묶음으로 견준다 */
test('login stamp: news and answers bound to an earlier sign-in of the same account are refused; a same-round token renewal keeps them', async () => {
  const f = holdSetup();
  const first = { ...YUHO, sessionGeneration: 1 }, again = { ...YUHO, sessionGeneration: 2 };
  f.office.accountChanged(first);
  // 같은 회차의 토큰 갱신(main이 같은 계정 번호와 같은 회차로 다시 알린다)은 같은 묶음이다
  f.office.accountChanged({ synk_user_id: YUHO.synk_user_id, sessionGeneration: 1 });
  assert.equal((await f.office.ingest(hook('PostToolUse', T0), first)).ok, true);
  assert.equal(await f.office.accepts(first), true);
  // 몸을 받는 사이에 로그아웃했다가 같은 계정으로 다시 로그인했다. 앞 회차에 허락한 소식은 접지 않는다
  f.h.arm();
  const late = f.office.ingest(hook('Stop', T0 + 1000), first);
  await settle();
  f.office.accountChanged(null);
  f.office.accountChanged(again);
  f.h.release();
  assert.deepEqual(await late, { ok: false, code: 'AUTH_CHANGED' });
  assert.equal(await f.office.accepts(first), false, 'the earlier round is no longer allowed');
  assert.equal(await f.office.accepts(again), true);
  assert.deepEqual((await f.office.snapshot(first)), { ok: false, code: 'AUTH_CHANGED' });
  assert.deepEqual((await f.office.snapshot(again)).state.sessions, {}, 'signing out cleared the sessions and the late news did not come back');
});

test('GA3 · GA4: two overlapping folder removals through the office both stick, and missing folders can be removed', async () => {
  const f = setup();
  const a = path.join(f.work, 'claude-a'), b = path.join(f.work, 'claude-b'), c = path.join(f.work, 'claude-c');
  for (const d of [a, b, c]) fs.mkdirSync(d);
  for (const d of [a, b, c]) assert.equal((await f.office.addRoot(d, YUHO)).ok, true);
  fs.rmSync(a, { recursive: true }); fs.rmSync(b, { recursive: true }); // 옮겼거나 외장 드라이브를 뺐다
  const both = await Promise.all([f.office.removeRoot(a, YUHO), f.office.removeRoot(b.toUpperCase(), YUHO)]);
  assert.deepEqual(both.map(r => r.ok), [true, true]);
  assert.deepEqual((await f.office.snapshot(YUHO)).roots.added, [c], 'neither removed folder comes back');
  assert.deepEqual(await f.office.removeRoot(a, YUHO), { ok: false, code: 'NOT_FOUND' });
  assert.deepEqual(await f.office.addRoot(a, YUHO), { ok: false, code: 'FOLDER' }, 'only an added folder must exist');
  assert.deepEqual(await f.office.removeRoot(c, OTHER), { ok: false, code: 'NOT_ALLOWED' });
});

/* 설계 검토의 단일 실행 잠금 설계: 넘긴 소식은 받기 표를 들고 오고, ingest가 접기 바로 앞에서 다시 본다 */
test('an ingest waiting on the viewers file when hooks are turned off is dropped before it folds anything; one with no ticket is refused while a hooks service is attached', async () => {
  const f = setup();
  const h = holdingFs(f.viewersFile);
  const claude = path.join(f.top, 'claude-home');
  fs.mkdirSync(claude);
  const hooks = createOfficeHooks({ userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: claude }, baseDirs: () => [], accepts: () => YUHO, listenRetries: 0, deliver: (e, a, ticket) => { delivered.push(office.ingest(e, a, ticket)); } });
  const delivered = [];
  const reduced = [];
  const spy = { ...model, officeReduce: (st, e, ctx) => { if (e && e.kind === 'hook') reduced.push(e.event); return model.officeReduce(st, e, ctx); } };
  const office = createOffice({ userData: f.userData, viewersFile: f.viewersFile, model: spy, records: f.records, capacity: f.capacity, roots: { claude: [claude], codex: [] }, hooks, fsImpl: h.fsImpl, now: () => Date.now() });
  office.accountChanged(YUHO);
  assert.equal((await hooks.enable([])).ok, true);
  const st = hookState(f), p = PATH_PREFIX + st.token;
  h.arm(); // 다음 볼 계정 파일 읽기가 붙잡힌다: ingest의 gate에서 기다린다
  assert.equal(await post(st.port, p, { hook_event_name: 'PostToolUse', session_id: S1, cwd: f.shop, tool_name: 'Read' }), 204);
  await pause();
  assert.equal(delivered.length, 1, 'the news was handed over while acceptance was open');
  const off = hooks.disable(); // 받기가 이 틱에 닫힌다
  h.release();
  assert.deepEqual(await delivered[0], { ok: false, code: 'CLOSED' });
  assert.deepEqual(reduced, [], 'commit never ran for it');
  assert.equal((await off).ok, true);
  assert.deepEqual((await office.snapshot(YUHO)).state.sessions, {});
  assert.deepEqual(await office.ingest(hook('PostToolUse', Date.now()), YUHO), { ok: false, code: 'CLOSED' }, 'with a hooks service attached, only news carrying a live ticket is folded');
  assert.deepEqual(reduced, []);
  await hooks.close();
});

/* ── GPT 검수 solio-office-be-20261120 묶음 B(GB1~GB11) ── */
/* 한 번만 붙잡는 fs: which(file, method)가 참인 첫 부름 하나를 release까지 기다리게 한다. after가 참이면 일을 마친 뒤(읽은 값을 쥔 채) 기다린다 */
function holdOnce(which, { after = false } = {}) {
  let armed = false, gate = null, release = () => {}, reached = () => {}, reachedP = null;
  const p = fs.promises;
  const wrap = method => async (file, ...a) => {
    if (!(armed && which(String(file), method))) return p[method](file, ...a);
    armed = false;
    if (!after) { reached(); await gate; return p[method](file, ...a); }
    const value = await p[method](file, ...a);
    reached(); await gate;
    return value;
  };
  return {
    arm() { armed = true; gate = new Promise(r => { release = r; }); reachedP = new Promise(r => { reached = r; }); return reachedP; },
    release: () => release(),
    fsImpl: { ...fs, promises: { ...p, stat: wrap('stat'), readFile: wrap('readFile'), writeFile: wrap('writeFile'), lstat: wrap('lstat'), mkdir: wrap('mkdir') } },
  };
}
function officeWith(f, fsImpl, extra = {}) {
  return createOffice({
    userData: f.userData, viewersFile: f.viewersFile, model, records: f.records, capacity: f.capacity, roots: ROOTS, fsImpl, now: f.clock.now,
    setInterval: f.clock.setInterval, clearInterval: f.clock.clearInterval, setTimeout: f.clock.setTimeout, clearTimeout: f.clock.clearTimeout, ...extra,
  });
}
const officeJson = f => path.join(f.userData, 'Office', YUHO.synk_user_id, 'office.json');

test('GB1: a department save waiting on its folder check is not written when the user signs out and back in meanwhile', async () => {
  const f = setup();
  const h = holdOnce((file, method) => method === 'stat' && file === f.shop);
  const office = officeWith(f, h.fsImpl);
  const first = { ...YUHO, sessionGeneration: 1 }, again = { ...YUHO, sessionGeneration: 2 };
  office.accountChanged(first);
  const reached = h.arm();
  const saving = office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, first);
  await reached;
  office.accountChanged(null);
  office.accountChanged(again);
  h.release();
  assert.deepEqual(await saving, { ok: false, code: 'AUTH_CHANGED' });
  assert.equal(fs.existsSync(officeJson(f)), false, 'nothing was written for the earlier sign-in');
  assert.deepEqual((await office.snapshot(again)).departments, []);
  assert.equal((await office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, again)).ok, true, 'the same save in the new sign-in works');
});

test('GB2: turning hooks on is dropped before any settings file is touched when the user signs out while it runs', async () => {
  const f = setup({ viewers: [YUHO.synk_user_id] });
  const claude = path.join(f.top, 'claude-home');
  fs.mkdirSync(claude);
  const h = holdOnce((file, method) => method === 'writeFile' && path.basename(file).startsWith('hooks.json'));
  const hooks = createOfficeHooks({ userData: f.userData, installed: false, env: { [OVERRIDE_ENV]: claude }, baseDirs: () => [], listenRetries: 0, fsImpl: h.fsImpl });
  const office = createOffice({ userData: f.userData, viewersFile: f.viewersFile, model, records: f.records, capacity: f.capacity, roots: { claude: [claude], codex: [] }, hooks, now: () => Date.now() });
  const first = { ...YUHO, sessionGeneration: 1 }, again = { ...YUHO, sessionGeneration: 2 };
  office.accountChanged(first);
  const reached = h.arm();
  const turning = office.setHooks(true, first);
  await reached; // 상태 파일에 고칠 폴더를 적는 중이다(서버는 열렸다)
  office.accountChanged(null);
  office.accountChanged(again);
  h.release();
  assert.equal((await turning).code, 'AUTH_CHANGED');
  assert.deepEqual(fs.readdirSync(claude), [], 'no settings.json was made');
  const st = JSON.parse(fs.readFileSync(path.join(f.userData, 'Office', 'hooks.json'), 'utf8'));
  assert.deepEqual([st.enabled, st.dirs], [false, []], 'the folder written first was taken back');
  assert.equal(hooks.listening(), false, 'the server opened for it was closed');
  assert.equal((await office.setHooks(true, again)).ok, true, 'the new sign-in can turn hooks on');
  assert.ok(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8').includes(PATH_PREFIX));
  await office.setHooks(false, again);
  await hooks.close();
});

test('GB3: a snapshot read that finishes after a folder removal does not put the removed folder back in memory', async () => {
  const f = setup();
  const a = path.join(f.work, 'claude-a'), b = path.join(f.work, 'claude-b');
  for (const d of [a, b]) fs.mkdirSync(d);
  const h = holdOnce((file, method) => method === 'readFile' && path.basename(file) === 'office.json', { after: true });
  const office = officeWith(f, h.fsImpl);
  for (const d of [a, b]) assert.equal((await office.addRoot(d, YUHO)).ok, true);
  const reached = h.arm();
  const reading = office.snapshot(YUHO);
  await reached;
  assert.equal((await office.removeRoot(a, YUHO)).ok, true);
  h.release();
  const snap = await reading;
  assert.deepEqual(snap.roots.added, [b], 'the snapshot answers with the newer list');
  await office.watch(true, YUHO);
  assert.ok(!f.records.calls.at(-1).roots.claude.includes(a), 'the scan (and hooks-set) uses the list without the removed folder');
  await office.watch(false, YUHO);
});

test('GB4: a subscription-room account folder that arrives as the default Claude folder is not watched or hooked', async () => {
  const f = setup();
  const sub = 'C:\\Users\\a\\AppData\\Local\\AiSubscriptions\\accounts\\claude-1\\.claude';
  const office = officeWith(f, fs, { roots: { claude: [sub, 'C:\\Users\\a\\.claude'], codex: [] } });
  assert.deepEqual((await office.snapshot(YUHO)).roots.claude, ['C:\\Users\\a\\.claude']);
});

test('GB6 · GPT 검수 be3 GA9: a pending note that waited while the owner approved an account writes nothing, and a late write can only bring back the asking account\'s own file', async () => {
  const f = setup({ viewers: null });
  const dir = path.join(path.dirname(f.viewersFile), 'viewer-pending');
  const fileOf = a => path.join(dir, a.synk_user_id + '.json');
  // 볼 계정 파일을 다시 보기 전에 승인이 끼면 쓰지 않는다
  const h = holdOnce((file, method) => method === 'mkdir' && file === dir);
  const office = officeWith(f, h.fsImpl);
  const reached = h.arm();
  const asking = office.snapshot(SECOND);
  await reached;
  fs.mkdirSync(path.dirname(f.viewersFile), { recursive: true });
  fs.writeFileSync(f.viewersFile, JSON.stringify({ synk_user_ids: [YUHO.synk_user_id] })); // 승인 도구가 받았다
  h.release();
  assert.deepEqual(await asking, { ok: true, available: false });
  await settle();
  assert.equal(fs.existsSync(fileOf(SECOND)), false, 'nothing is written once a viewer is set');
  // 다시 본 뒤에 승인이 끼면 그 계정의 파일 하나가 생긴다. 승인 도구가 지운 다른 계정의 파일은 되살아나지 않는다
  const g = setup({ viewers: null });
  const gdir = path.join(path.dirname(g.viewersFile), 'viewer-pending');
  fs.mkdirSync(gdir, { recursive: true });
  fs.writeFileSync(path.join(gdir, OTHER.synk_user_id + '.json'), JSON.stringify({ synk_user_id: OTHER.synk_user_id, display_name: '시험 계정', asked_at: new Date(T0).toISOString() }));
  const k = holdOnce((file, method) => method === 'writeFile' && /\.tmp$/.test(file) && file.startsWith(gdir));
  const late = officeWith(g, k.fsImpl);
  const writing = k.arm();
  const asked = late.snapshot(SECOND);
  await writing;
  fs.mkdirSync(path.dirname(g.viewersFile), { recursive: true });
  fs.writeFileSync(g.viewersFile, JSON.stringify({ synk_user_ids: [YUHO.synk_user_id] })); // 승인 도구가 받고
  fs.rmSync(gdir, { recursive: true, force: true }); // 대기 파일을 모두 지웠다
  k.release();
  await asked;
  await settle();
  assert.equal(fs.existsSync(path.join(gdir, OTHER.synk_user_id + '.json')), false, 'another account\'s deleted line does not come back');
});

test('GB7: a viewers file with one entry that is not an account id lets nobody in, as the approval tool says', async () => {
  const f = setup({ viewersText: JSON.stringify({ synk_user_ids: [YUHO.synk_user_id, null] }) });
  assert.equal(await f.office.allowed(YUHO), false);
  assert.deepEqual(await f.office.snapshot(YUHO), { ok: true, available: false });
});

test('GB9: a session that ended forgets its department at once, so resuming it within 30 minutes does not bring the old department back', async () => {
  const f = setup();
  const dept = (await f.office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, YUHO)).data.departments[0].id;
  await f.office.ingest(hook('PostToolUse', T0, { cwd: 'C:\\elsewhere' }), YUHO);
  assert.equal((await f.office.assign(S1, dept, YUHO)).ok, true);
  assert.deepEqual((await f.office.snapshot(YUHO)).assignments, { [S1]: dept });
  await f.clock.advance(5 * S);
  await f.office.ingest(hook('SessionEnd', T0 + 5 * S, { cwd: 'C:\\elsewhere' }), YUHO);
  await settle();
  assert.deepEqual((await f.office.snapshot(YUHO)).assignments, {}, 'the memory is gone when the session ends');
});

test('GB10: a watch(true) that waited on the viewers file while the room was closed starts nothing', async () => {
  const f = setup();
  const h = holdOnce((file, method) => method === 'stat' && file === f.viewersFile);
  const office = officeWith(f, h.fsImpl);
  const reached = h.arm();
  const opening = office.watch(true, YUHO);
  await reached;
  assert.deepEqual(await office.watch(false, YUHO), { ok: true, watching: false }, 'the close finishes first');
  h.release();
  assert.deepEqual(await opening, { ok: true, watching: false });
  assert.equal(f.records.calls.length, 0, 'no records were read for the closed room');
  assert.ok(!f.clock.intervals().includes(OFFICE_TICKS.tick), 'no 15 s timer');
});

test('GB11: closing a department row marks only what had finished when it was closed, not what finished while the call waited', async () => {
  const f = setup();
  const h = holdOnce((file, method) => method === 'stat' && file === f.viewersFile);
  const office = officeWith(f, h.fsImpl);
  await office.ingest(hook('PostToolUse', T0, { cwd: 'C:\\elsewhere' }), YUHO);
  await office.ingest(hook('Stop', T0 + 1 * S, { cwd: 'C:\\elsewhere' }), YUHO);
  await f.clock.advance(2 * S);
  const reached = h.arm();
  const closing = office.seen(null, YUHO); // T0 + 2 s에 닫았다
  await reached;
  await f.clock.advance(3 * M);
  await office.ingest(hook('PostToolUse', T0 + 3 * M, { cwd: 'C:\\elsewhere' }), YUHO);
  await office.ingest(hook('Stop', T0 + 3 * M + S, { cwd: 'C:\\elsewhere' }), YUHO); // 기다리는 사이에 새로 끝냈다
  h.release();
  assert.deepEqual(await closing, { ok: true });
  const s = (await office.snapshot(YUHO)).state.sessions[S1];
  assert.ok(s.seenAt == null || s.seenAt < s.stopAt, 'the seen mark is not later than the finish that came while it waited');
  assert.equal(s.stopAt, T0 + 3 * M + S, 'the later finish still shows');
});

test('0.5.2 공개 검수 C2: a late watch from an account that may not see the office leaves the viewer\'s scan running', async () => {
  const f = setup();
  assert.equal((await f.office.watch(true, YUHO)).ok, true);
  assert.ok(f.clock.intervals().includes(OFFICE_TICKS.tick));
  assert.deepEqual(await f.office.watch(true, OTHER), { ok: false, code: 'NOT_ALLOWED' });
  assert.deepEqual(await f.office.watch(false, null), { ok: false, code: 'NOT_ALLOWED' });
  assert.ok(f.clock.intervals().includes(OFFICE_TICKS.tick), 'the viewer still scans every 15 s');
  // 볼 계정 파일에서 빠지면 살피기가 다음 틱에 스스로 멈춘다
  fs.writeFileSync(f.viewersFile, JSON.stringify({ synk_user_ids: [SECOND.synk_user_id] }));
  await f.clock.advance(OFFICE_TICKS.tick);
  assert.ok(!f.clock.intervals().includes(OFFICE_TICKS.tick), 'a viewer taken off the list stops scanning by itself');
});

test('카본 검수 solio-office-be2 A4: a send-to-department request that arrives after the session ended is refused and writes nothing', async () => {
  const f = setup();
  const dept = (await f.office.saveDepartment({ name: '쇼핑몰', folder: f.shop }, YUHO)).data.departments[0].id;
  await f.office.ingest(hook('PostToolUse', T0, { cwd: 'C:\\elsewhere' }), YUHO);
  await f.clock.advance(5 * S);
  await f.office.ingest(hook('SessionEnd', T0 + 5 * S, { cwd: 'C:\\elsewhere' }), YUHO);
  await settle();
  assert.deepEqual(await f.office.assign(S1, dept, YUHO), { ok: false, code: 'NOT_FOUND' }, 'an earlier screen asked for a session that has ended');
  assert.deepEqual((await f.office.snapshot(YUHO)).assignments, {});
  assert.equal((await f.office.assign(S1, null, YUHO)).ok, true, 'clearing is still allowed');
});
