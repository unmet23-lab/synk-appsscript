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

const settle = async (turns = 40) => { for (let i = 0; i < turns; i++) await new Promise(resolve => setImmediate(resolve)); };
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

test('with no viewers file the asking account is noted once in viewer-pending.json, and hook news never notes', async () => {
  const f = setup({ viewers: null });
  const pending = path.join(path.dirname(f.viewersFile), 'viewer-pending.json');
  assert.equal(f.office.pendingFile, pending);
  await f.office.snapshot(YUHO);
  assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), { asked: [{ synk_user_id: YUHO.synk_user_id, display_name: '유호', asked_at: new Date(T0).toISOString() }] }, 'the folder is made and one line written');
  fs.rmSync(pending);
  await f.office.snapshot(YUHO);
  await f.office.allowed(YUHO);
  await f.office.watch(true, YUHO);
  assert.equal(fs.existsSync(pending), false, 'the same account is written once while the app runs');
  await f.office.ingest(hook('PostToolUse', T0), OTHER);
  assert.equal(fs.existsSync(pending), false, 'hook news does not note anyone');
  await f.office.allowed(OTHER);
  await f.office.snapshot(SECOND);
  assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')).asked.map(x => x.synk_user_id), [OTHER.synk_user_id, SECOND.synk_user_id], 'other accounts add their own line');
  await f.office.allowed(null);
  assert.equal(JSON.parse(fs.readFileSync(pending, 'utf8')).asked.length, 2, 'a signed-out window is not noted');
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
  assert.deepEqual((await f.office.snapshot(YUHO)).state.sessions, {});
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
