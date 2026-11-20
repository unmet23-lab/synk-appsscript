// 솔리오 「사무실」을 본체와 preload에 이은 자리(구현설계.md 11.1 · 13절, 15절 6단계). main.cjs의 줄을 떼어 가짜 값으로 돌린다.
// 실제 사용자 폴더, viewers.json, 폴더 고르기 창, Claude Code 설정 파일은 쓰지 않는다. 훅 서버(5단계)는 가짜를 넘긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const main = fs.readFileSync(new URL('../src/main.cjs', import.meta.url), 'utf8');
const preloadSource = fs.readFileSync(new URL('../src/preload.cjs', import.meta.url), 'utf8');
const lines = main.split(/\r?\n/);
const plain = v => JSON.parse(JSON.stringify(v));
/** 그 말로 시작하는 줄 하나. 끝이 「{」면 맨 앞의 「}」 줄까지 */
function source(start) {
  const i = lines.findIndex(l => l.startsWith(start));
  assert.ok(i >= 0, `${start} is in main.cjs`);
  if (!lines[i].endsWith('{')) return lines[i];
  const end = lines.indexOf('}', i);
  assert.ok(end > i, `${start} has a closing line`);
  return lines.slice(i, end + 1).join('\n');
}

const CHANNELS = ['snapshot', 'watch', 'department-save', 'department-remove', 'session-assign', 'settings-save', 'roots-add', 'roots-remove', 'seen', 'hooks-set', 'hooks-off', 'hooks-status'].map(c => `synk:office-${c}`);
/* 끄기와 켜졌는지 묻기만 officeCall(볼 계정 확인)을 거치지 않는다(구현설계.md 11.1, 13절) */
const NO_GATE = { 'synk:office-hooks-off': '()=>officeHooksOff()', 'synk:office-hooks-status': '()=>officeHooksStatus()' };
const YUHO = { synk_user_id: 'owner-1234567890', display_name: '유호' };
const OTHER = { synk_user_id: 'tester-1234567890', display_name: '시험 계정' };
const S1 = '00000001-0000-4000-8000-000000000001';
const SESSION_DIR = path.join(os.tmpdir(), 'office-main-session');
const DEPT_DIR = path.join(os.tmpdir(), 'office-main-dept');
const CHOSEN = path.join(os.tmpdir(), 'office-main-chosen');
const ADDED = path.join(os.tmpdir(), 'Office-Main-Added');

test('every synk:office-* channel is in handlers, on one line, and goes through officeCall behind the sender check (off and status: the sender check only)', () => {
  assert.match(main, /^const \{createOffice,loadOfficeModel\}=require\('\.\/office\.cjs'\);$/m);
  assert.match(main, /^const \{createOfficeHooks\}=require\('\.\/office-hooks\.cjs'\);$/m);
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const end = lines.findIndex((l, i) => i > start && l === '  };');
  assert.ok(start > 0 && end > start, 'the handlers object is found');
  const block = lines.slice(start + 1, end);
  const found = block.map(l => l.match(/^ {4}'(synk:office-[a-z-]+)':/)?.[1]).filter(Boolean);
  assert.deepEqual(found, CHANNELS, 'exactly the agreed channels, in the handlers object');
  for (const channel of CHANNELS) {
    const line = block.find(l => l.startsWith(`    '${channel}':`));
    if (Object.hasOwn(NO_GATE, channel)) { assert.equal(line, `    '${channel}':${NO_GATE[channel]},`, `${channel} is the one fixed call`); continue; }
    assert.match(line, /^ {4}'synk:office-[a-z-]+':(\(\)|[A-Za-z]+|\([A-Za-z,]+\))=>officeCall\(.*\),$/, `${channel} goes through officeCall on one line`);
  }
  const literals = [...main.matchAll(/'synk:office-[a-z-]+'/g)].map(m => m[0].slice(1, -1));
  assert.deepEqual(literals.filter(c => !CHANNELS.includes(c)), ['synk:office-changed', 'synk:office-changed'], 'no other office channel, besides office-changed that main sends for the office and for the hooks server');
  assert.equal(literals.filter(c => CHANNELS.includes(c)).length, CHANNELS.length);
  assert.match(main, /onChange:\(\)=>sendDesktop\('synk:office-changed'\)/);
  assert.match(main, /for\(const \[channel,handler\]of Object\.entries\(handlers\)\)\{ipcMain\.removeHandler\(channel\);ipcMain\.handle\(channel,async\(event,\.\.\.args\)=>\{assertSender\(event,window,entry,runtime\.clientId\);/);
});

function gate({ runtime = { clientId: 'platform' }, smoke = false, status, load, packaged = false, shipped = false } = {}) {
  const ctx = {
    runtime, smoke, status, packaged, officeShipped: shipped, created: [], sent: [], paths: [], told: [], renewing: null,
    accountStatus: () => ctx.status, renewingAccount: () => ctx.renewing,
    app: { getPath: name => { ctx.paths.push(name); return 'C:\\synthetic\\userData'; } },
    sendDesktop: (...a) => { ctx.sent.push(a); },
    loadOfficeModel: () => (load ? load(ctx) : Promise.resolve(MODEL)),
    createOffice: options => { ctx.created.push(options); return { ...SERVICE, accountChanged: a => ctx.told.push(a === null ? null : a.synk_user_id) }; },
    officeHooksService: () => HOOKS,
  };
  vm.runInNewContext([source('const officeOff='), source('let officeService=null,officeLoading=null;'), source('const officeAccountOf='), source('const officeLoginOf='), source('function office(){'), source('async function officeCall(work){')].join('\n'), ctx);
  return ctx;
}
const MODEL = { officeReduce() {} };
const SERVICE = { id: 'service' };
const HOOKS = { id: 'hooks' };
const work = (service, account) => ({ ok: true, same: service.id === SERVICE.id, account: account.synk_user_id });
const signedIn = account => ({ signedIn: true, sessionGeneration: 1, account });

test('officeCall: platform client only, signed in with an account, one office made lazily with userData and the model', async () => {
  assert.equal((await gate({ runtime: { clientId: 'world' }, status: signedIn(YUHO) }).officeCall(work)).code, 'LAUNCHER_ONLY');
  assert.equal((await gate({ smoke: true, status: signedIn(YUHO) }).officeCall(work)).code, 'LAUNCHER_ONLY');
  const out = gate({ status: { signedIn: false, account: null } });
  assert.equal((await out.officeCall(work)).code, 'SIGN_IN_REQUIRED');
  out.status = { signedIn: true, account: null };
  assert.equal((await out.officeCall(work)).code, 'SIGN_IN_REQUIRED');
  assert.equal(out.created.length, 0, 'nothing is made before a signed-in platform call');

  const ctx = gate({ status: signedIn(YUHO) });
  assert.deepEqual(plain(await ctx.officeCall(work)), { ok: true, same: true, account: YUHO.synk_user_id });
  assert.deepEqual(plain(await ctx.officeCall(work)), { ok: true, same: true, account: YUHO.synk_user_id });
  assert.equal(ctx.created.length, 1, 'made once');
  assert.equal(ctx.created[0].userData, 'C:\\synthetic\\userData');
  assert.deepEqual(ctx.paths, ['userData']);
  assert.equal(ctx.created[0].model, MODEL);
  assert.equal(ctx.created[0].hooks, HOOKS, 'the office gets the hooks service so the snapshot carries the real hooks state');
  assert.deepEqual(ctx.told, [YUHO.synk_user_id], 'the office learns the current account when it is made (GA1)');
  ctx.created[0].onChange();
  assert.deepEqual(plain(ctx.sent), [['synk:office-changed']], 'office changes reach the window as a payload-free office-changed');
});

test('officeCall: an account change while the model loads is refused, and a failed load is tried again next time', async () => {
  const swapped = gate({ status: signedIn(YUHO), load: ctx => { ctx.status = signedIn(OTHER); return Promise.resolve(MODEL); } });
  assert.equal((await swapped.officeCall(work)).code, 'AUTH_CHANGED');
  let tries = 0;
  const flaky = gate({ status: signedIn(YUHO), load: () => (++tries === 1 ? Promise.reject(new Error('import failed')) : Promise.resolve(MODEL)) });
  await assert.rejects(flaky.officeCall(work), /import failed/);
  assert.equal((await flaky.officeCall(work)).ok, true);
  assert.equal(tries, 2);
  assert.equal(flaky.created.length, 1);
});

test('GA1: a sign-out or a new sign-in while the office works drops its answer; a same-account token renewal keeps it', async () => {
  const slow = ctx => async (service, account) => { await new Promise(r => setTimeout(r, 0)); ctx.during?.(ctx); return { ok: true, available: true, departments: [{ id: 'd1', name: '법무부', folder: 'C:\\옛 계정\\계약' }], account: account.synk_user_id }; };
  const run = async during => { const ctx = gate({ status: signedIn(YUHO) }); ctx.during = during; return plain(await ctx.officeCall(slow(ctx))); };
  assert.deepEqual(await run(ctx => { ctx.status = { signedIn: false, status: 'signed-out', sessionGeneration: 2, account: null }; }), { ok: false, code: 'AUTH_CHANGED' }, 'signed out while reading: the old account\'s departments do not come back');
  assert.deepEqual(await run(ctx => { ctx.status = signedIn(OTHER); }), { ok: false, code: 'AUTH_CHANGED' }, 'another account');
  assert.deepEqual(await run(ctx => { ctx.status = { ...signedIn(YUHO), sessionGeneration: 2 }; }), { ok: false, code: 'AUTH_CHANGED' }, 'the same person signed in again is a new turn');
  const renewed = await run(ctx => { ctx.status = { signedIn: false, status: 'restoring', sessionGeneration: 1, account: null }; ctx.renewing = YUHO.synk_user_id; });
  assert.equal(renewed.ok, true, 'a token renewal of the same account in the same turn keeps the answer');
  assert.equal(renewed.account, YUHO.synk_user_id);
  assert.deepEqual(await run(ctx => { ctx.status = { signedIn: false, status: 'restoring', sessionGeneration: 1, account: null }; ctx.renewing = OTHER.synk_user_id; }), { ok: false, code: 'AUTH_CHANGED' });
  assert.equal((await run(() => {})).ok, true);
});

test('the handlers pass only the agreed values; the snapshot is the office answer as it is, with its hooks state', async () => {
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const handlerLines = lines.slice(start).filter(l => /^ {4}'synk:office-/.test(l));
  const calls = [];
  const HOOK_STATE = { on: true, available: true, dirs: [{ dir: 'C:\\synthetic\\.claude', on: true, folder: true, file: true, code: null }], message: null };
  const service = new Proxy({}, { get: (_t, name) => (...a) => { calls.push([name, ...a.slice(0, -1).map(plain), a.at(-1).synk_user_id]); return name === 'snapshot' ? { ok: true, available: true, hooks: HOOK_STATE } : { ok: true }; } });
  const ctx = {
    officeCall: run => run(service, YUHO),
    officeHooksOff: () => { calls.push(['officeHooksOff']); return { ok: true }; },
    officeHooksStatus: () => { calls.push(['officeHooksStatus']); return { ok: true, on: true }; },
    officeSaveDepartment: (s, account, input) => { calls.push(['officeSaveDepartment', plain(input), account.synk_user_id]); return { ok: true }; },
    officeAddRoot: (s, account) => { calls.push(['officeAddRoot', account.synk_user_id]); return { ok: true }; },
    officeRemoveRoot: (s, account, dir) => { calls.push(['officeRemoveRoot', dir, account.synk_user_id]); return { ok: true }; },
  };
  const h = vm.runInNewContext(`({\n${handlerLines.join('\n')}\n})`, ctx);
  const snap = await h['synk:office-snapshot']();
  assert.deepEqual(plain(snap.hooks), HOOK_STATE, 'no forced off: the hooks state comes from the office');
  await h['synk:office-watch']('yes');
  await h['synk:office-watch'](true);
  await h['synk:office-department-save']({ name: '법무', folder: 'choose' });
  await h['synk:office-department-remove']('dept-1');
  await h['synk:office-session-assign'](S1, undefined);
  await h['synk:office-settings-save']({ view: 'top' });
  await h['synk:office-roots-add']('C:\\ignored');
  await h['synk:office-roots-remove'](ADDED);
  await h['synk:office-seen'](null);
  await h['synk:office-hooks-set'](true);
  await h['synk:office-hooks-set']('yes');
  await h['synk:office-hooks-off']('C:\\ignored');
  await h['synk:office-hooks-status']('C:\\ignored');
  const id = YUHO.synk_user_id;
  assert.deepEqual(calls, [
    ['snapshot', id], ['watch', false, id], ['watch', true, id],
    ['officeSaveDepartment', { name: '법무', folder: 'choose' }, id], ['removeDepartment', 'dept-1', id], ['assign', S1, null, id],
    ['saveSettings', { view: 'top' }, id], ['officeAddRoot', id], ['officeRemoveRoot', ADDED, id], ['seen', null, id],
    ['setHooks', true, id], ['setHooks', false, id], ['officeHooksOff'], ['officeHooksStatus'],
  ]);
  const refused = await vm.runInNewContext(`({\n${handlerLines[0]}\n})`, { officeCall: async () => ({ ok: true, available: false }) })['synk:office-snapshot']();
  assert.deepEqual(plain(refused), { ok: true, available: false }, 'the gate answer comes back as it is');
});

const SNAP = () => ({
  ok: true, available: true,
  state: { sessions: { [S1]: { id: S1, cwd: SESSION_DIR }, relative00: { cwd: 'work\\here' } }, ignored: {} },
  departments: [{ id: 'dept-1', name: '법무부', folder: DEPT_DIR }],
  roots: { claude: [], codex: [], added: [ADDED] },
});
function helpers({ status = signedIn(YUHO), dialogResult = { canceled: false, filePaths: [CHOSEN] }, alive = true, allowed = true, snap = SNAP(), onDialog } = {}) {
  const calls = [];
  const service = {
    allowed: async a => { calls.push(['allowed', a.synk_user_id]); return allowed; },
    snapshot: async a => { calls.push(['snapshot', a.synk_user_id]); return snap; },
    saveDepartment: async (input, a) => { calls.push(['saveDepartment', plain(input), a.synk_user_id]); return { ok: true }; },
    saveRoots: async (dirs, a) => { calls.push(['saveRoots', plain(dirs), a.synk_user_id]); return { ok: true }; },
    addRoot: async (dir, a) => { calls.push(['addRoot', dir, a.synk_user_id]); return { ok: true }; },
    removeRoot: async (dir, a) => { calls.push(['removeRoot', dir, a.synk_user_id]); return { ok: true }; },
  };
  const ctx = {
    path, status, calls, service,
    accountStatus: () => ctx.status,
    window: alive ? { isDestroyed: () => false } : null,
    dialog: { showOpenDialog: async (...a) => { calls.push(['dialog', a[0] === ctx.window, plain(a[1])]); onDialog?.(ctx); return dialogResult; } },
  };
  vm.runInNewContext([source('async function officeChooseFolder('), source('async function officeSaveDepartment('), source('async function officeAddRoot('), source('async function officeRemoveRoot(')].join('\n'), ctx);
  return ctx;
}
const DIALOG = ['dialog', true, { properties: ['openDirectory'] }];

test('saveDepartment: the folder comes from the chooser, a standing session or the stored department, never from the screen', async () => {
  // 폴더만 바꿀 때는 이름을 싣지 않는다. 이름은 office-store가 차례 안에서 저장된 것으로 채운다(GA3)
  let only = helpers();
  await only.officeSaveDepartment(only.service, YUHO, { id: 'dept-1', folder: 'choose' });
  assert.deepEqual(only.calls.at(-1), ['saveDepartment', { id: 'dept-1', folder: CHOSEN }, YUHO.synk_user_id]);
  const id = YUHO.synk_user_id;
  let c = helpers();
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).ok, true);
  assert.deepEqual(c.calls, [['allowed', id], DIALOG, ['saveDepartment', { name: '법무부', folder: CHOSEN }, id]]);
  c = helpers();
  await c.officeSaveDepartment(c.service, YUHO, { id: 'dept-1', name: '법무팀', folder: 'choose' });
  assert.deepEqual(c.calls.at(-1), ['saveDepartment', { id: 'dept-1', name: '법무팀', folder: CHOSEN }, id], 'a department can move to a chosen folder');

  c = helpers({ dialogResult: { canceled: true, filePaths: [] } });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).code, 'CANCELLED');
  assert.ok(!c.calls.some(x => x[0] === 'saveDepartment'));
  c = helpers({ allowed: false });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).code, 'NOT_ALLOWED');
  assert.ok(!c.calls.some(x => x[0] === 'dialog'), 'no folder chooser for an account that may not see the office');
  c = helpers({ alive: false });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).code, 'CANCELLED');
  c = helpers({ onDialog: ctx => { ctx.status = signedIn(OTHER); } });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).code, 'AUTH_CHANGED', 'a sign-in change while choosing drops the folder');
  c = helpers({ onDialog: ctx => { ctx.status = { ...signedIn(YUHO), sessionGeneration: 2 }; } });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).code, 'AUTH_CHANGED', 'signing in again counts as a change');
  assert.ok(!c.calls.some(x => x[0] === 'saveDepartment'));

  c = helpers();
  await c.officeSaveDepartment(c.service, YUHO, { name: '개발부', folder: { fromSession: S1 } });
  assert.deepEqual(c.calls, [['snapshot', id], ['saveDepartment', { name: '개발부', folder: SESSION_DIR }, id]]);
  for (const fromSession of ['00000009-0000-4000-8000-000000000009', 'relative00', '__proto__']) {
    c = helpers();
    assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '개발부', folder: { fromSession } })).code, 'NOT_FOUND', fromSession);
  }
  c = helpers();
  await c.officeSaveDepartment(c.service, YUHO, { id: 'dept-1', name: '법무팀' });
  assert.deepEqual(c.calls, [['saveDepartment', { id: 'dept-1', name: '법무팀' }, id]], 'a rename does not read the board or carry a folder: the store keeps the stored one inside its queue (GA3)');
  for (const input of [null, 'C:\\x', { name: '새 부서' }, { name: '새 부서', folder: CHOSEN }, { name: '새 부서', folder: null }, { id: 7, name: 'x', folder: 'choose' }, { id: 'dept-1' }, { id: 'dept-1', name: 5 }]) {
    c = helpers();
    assert.equal((await c.officeSaveDepartment(c.service, YUHO, input)).code, 'VALUE', JSON.stringify(input));
    assert.ok(!c.calls.some(x => x[0] === 'saveDepartment' || x[0] === 'dialog'));
  }
});

test('roots: adding opens the chooser and hands over the one chosen folder; removing hands over the one folder (the store reads and writes the list in its queue, GA3)', async () => {
  const id = YUHO.synk_user_id;
  let c = helpers();
  await c.officeAddRoot(c.service, YUHO);
  assert.deepEqual(c.calls, [['allowed', id], DIALOG, ['addRoot', CHOSEN, id]], 'no snapshot is read and no whole list is written');
  c = helpers({ dialogResult: { canceled: true, filePaths: [] } });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'CANCELLED');
  c = helpers({ allowed: false });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'NOT_ALLOWED');
  assert.ok(!c.calls.some(x => x[0] === 'dialog'));

  c = helpers();
  await c.officeRemoveRoot(c.service, YUHO, ADDED.toUpperCase());
  assert.deepEqual(c.calls, [['removeRoot', ADDED.toUpperCase(), id]], 'the store matches it ignoring case and says NOT_FOUND for a folder that is not added');
  for (const dir of [5, null, {}]) {
    c = helpers();
    assert.equal((await c.officeRemoveRoot(c.service, YUHO, dir)).code, 'VALUE', String(dir));
    assert.deepEqual(c.calls, []);
  }
});

test('an account change or sign-out reaches the office, a same-account renewal does not clear it, and quitting closes it', () => {
  const changed = [];
  const ctx = {
    careNotifications: null, pulseApp: null, syncCompanyEntry() {}, scheduleHiddenAuthRetry() {}, syncTrayApps: async () => {},
    window: null, trustedEntry: () => false, entry: '', runtime: { clientId: 'platform' },
    renewing: null, renewingAccount: () => ctx.renewing,
    officeService: null, solioBackupService: null, solioBackupSweep: () => {},
  };
  vm.runInNewContext([source('const officeAccountOf='), source('const officeLoginOf='), source('function publishAuthState(state){')].join('\n'), ctx);
  ctx.publishAuthState(signedIn(YUHO));
  assert.deepEqual(changed, [], 'nothing to tell before the office exists');
  ctx.officeService = { accountChanged: a => changed.push(a === null ? null : plain(a)) };
  ctx.publishAuthState(signedIn(YUHO));
  ctx.publishAuthState(signedIn(OTHER));
  ctx.renewing = OTHER.synk_user_id;
  ctx.publishAuthState({ signedIn: false, status: 'restoring', sessionGeneration: 1, account: null });
  ctx.renewing = null;
  ctx.publishAuthState({ signedIn: false, status: 'signed-out', account: null });
  ctx.publishAuthState({ signedIn: true, account: null });
  // 다시 로그인하면 같은 계정이어도 회차가 바뀌어 다른 묶음이다(구현설계 11.1 「계정 묶기」)
  ctx.publishAuthState({ signedIn: true, sessionGeneration: 2, account: YUHO });
  // 계정에 로그인 회차를 실어 알린다. 같은 계정의 토큰 갱신은 회차가 그대로다
  assert.deepEqual(changed, [{ ...YUHO, sessionGeneration: 1 }, { ...OTHER, sessionGeneration: 1 }, { synk_user_id: OTHER.synk_user_id, sessionGeneration: 1 }, null, null, { ...YUHO, sessionGeneration: 2 }]);

  const quit = [];
  const closed = [];
  const app = { on: (event, fn) => quit.push([event, fn]) };
  vm.runInNewContext(source("app.on('before-quit',()=>officeService?.close());"), { app, officeService: { close: () => closed.push(true) } });
  assert.equal(quit.length, 1);
  assert.equal(quit[0][0], 'before-quit');
  quit[0][1]();
  assert.deepEqual(closed, [true]);
  vm.runInNewContext(source("app.on('before-quit',()=>officeService?.close());"), { app, officeService: null });
  quit[1][1](); // 만들지 않았으면 할 일이 없다
});

function bridge() {
  let api;
  const calls = [], listeners = [];
  const ipcRenderer = {
    invoke: async (...a) => { calls.push(plain(a)); return { ok: true }; },
    on: (channel, fn) => listeners.push([channel, fn]),
    removeListener: (channel, fn) => { const i = listeners.findIndex(x => x[0] === channel && x[1] === fn); if (i >= 0) listeners.splice(i, 1); },
    send() {},
  };
  vm.runInNewContext(preloadSource, { require: () => ({ contextBridge: { exposeInMainWorld: (_n, v) => { api = v; } }, ipcRenderer }), process: { argv: [] } });
  return { office: api.office, calls, listeners };
}

test('preload exposes exactly the office bridge, frozen, and rebuilds every argument', async () => {
  const { office, calls, listeners } = bridge();
  assert.ok(Object.isFrozen(office));
  assert.deepEqual(Object.keys(office), ['snapshot', 'watch', 'saveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'addRoot', 'removeRoot', 'seen', 'hooksSet', 'hooksOff', 'hooksStatus', 'onChanged']);
  const last = () => calls.at(-1);
  const refused = async (p, why) => { const before = calls.length; assert.deepEqual(plain(await p), { ok: false, code: 'VALUE' }, why); assert.equal(calls.length, before, `${why}: nothing crosses`); };

  await office.snapshot('ignored');
  assert.deepEqual(last(), ['synk:office-snapshot']);
  await office.watch('yes'); assert.deepEqual(last(), ['synk:office-watch', false]);
  await office.watch(true); assert.deepEqual(last(), ['synk:office-watch', true]);

  await office.saveDepartment({ name: '법무부', folder: 'choose', path: 'C:\\Users\\a', role: 'x' });
  assert.deepEqual(last(), ['synk:office-department-save', { name: '법무부', folder: 'choose' }]);
  await office.saveDepartment({ id: 'dept-1', name: '개발부', folder: { fromSession: S1, path: 'C:\\Users\\a' } });
  assert.deepEqual(last(), ['synk:office-department-save', { id: 'dept-1', name: '개발부', folder: { fromSession: S1 } }]);
  await office.saveDepartment({ id: 'dept-1', name: '법무팀' });
  assert.deepEqual(last(), ['synk:office-department-save', { id: 'dept-1', name: '법무팀' }]);
  await office.saveDepartment({ id: null, name: '새 부서', folder: 'choose' });
  assert.deepEqual(last(), ['synk:office-department-save', { name: '새 부서', folder: 'choose' }]);
  await refused(office.saveDepartment({ name: '법무부', folder: 'C:\\Users\\a\\work' }), 'a path string as the folder');
  await refused(office.saveDepartment({ name: '법무부', folder: { path: 'C:\\Users\\a' } }), 'a folder object without a session');
  await refused(office.saveDepartment({ name: '법무부', folder: { fromSession: 'C:\\Users\\a' } }), 'a path as the session');
  await office.saveDepartment({ id: 'dept-1', folder: 'choose', name: undefined });
  assert.deepEqual(last(), ['synk:office-department-save', { id: 'dept-1', folder: 'choose' }], 'a folder change carries no name (GA3)');
  await refused(office.saveDepartment({ id: 'dept-1' }), 'nothing to change');
  await refused(office.saveDepartment({ name: '법무부' }), 'no folder and no department');
  await refused(office.saveDepartment({ id: '../x', name: '법무부', folder: 'choose' }), 'a bad department id');
  await refused(office.saveDepartment({ folder: 'choose' }), 'no name');
  await refused(office.saveDepartment('C:\\Users\\a'), 'not an object');

  await office.removeDepartment('dept-1'); assert.deepEqual(last(), ['synk:office-department-remove', 'dept-1']);
  await refused(office.removeDepartment({ id: 'dept-1' }), 'remove takes an id');
  await office.assign(S1, 'dept-1'); assert.deepEqual(last(), ['synk:office-session-assign', S1, 'dept-1']);
  await office.assign(S1, null); assert.deepEqual(last(), ['synk:office-session-assign', S1, null]);
  await refused(office.assign(S1), 'assign needs a department or null');
  await refused(office.assign('C:\\Users\\a', null), 'a path as the session');

  await office.saveSettings({ view: 'top', manualCap: 3, roots: ['C:\\x'] }); assert.deepEqual(last(), ['synk:office-settings-save', { view: 'top', manualCap: 3 }]);
  await office.saveSettings({ manualCap: null }); assert.deepEqual(last(), ['synk:office-settings-save', { manualCap: null }]);
  await refused(office.saveSettings({ view: 'side' }), 'an unknown view');
  await refused(office.saveSettings({ manualCap: 2.5 }), 'a fractional cap');
  await refused(office.saveSettings({}), 'nothing to save');

  await office.addRoot('C:\\Users\\a\\.claude-work'); assert.deepEqual(last(), ['synk:office-roots-add'], 'adding a root carries no path');
  await office.removeRoot(ADDED); assert.deepEqual(last(), ['synk:office-roots-remove', ADDED]);
  await refused(office.removeRoot(5), 'remove takes a folder string');
  await refused(office.removeRoot(''), 'an empty folder');

  await office.seen(null); assert.deepEqual(last(), ['synk:office-seen', null]);
  await office.seen('dept-1'); assert.deepEqual(last(), ['synk:office-seen', 'dept-1']);
  await refused(office.seen(), 'seen needs a department or null');

  await office.hooksSet(true); assert.deepEqual(last(), ['synk:office-hooks-set', true]);
  await office.hooksSet('yes'); assert.deepEqual(last(), ['synk:office-hooks-set', false], 'only a real true turns hooks on');
  await office.hooksSet({ dirs: ['C:\\Users\\a\\.claude'] }); assert.deepEqual(last(), ['synk:office-hooks-set', false], 'no folder crosses');
  await office.hooksOff('C:\\Users\\a\\.claude'); assert.deepEqual(last(), ['synk:office-hooks-off']);
  await office.hooksStatus('x'); assert.deepEqual(last(), ['synk:office-hooks-status']);

  const paths = /[A-Za-z]:\\|\\\\|^\//;
  for (const [channel, ...args] of calls) {
    if (channel === 'synk:office-roots-remove') continue;
    assert.ok(!paths.test(JSON.stringify(args)) && !JSON.stringify(args).includes('C:'), `${channel} carries no path`);
  }

  const heard = [];
  const off = office.onChanged(value => heard.push(value));
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0][0], 'synk:office-changed');
  listeners[0][1]({}, undefined);
  assert.deepEqual(heard, [undefined]);
  off();
  assert.equal(listeners.length, 0);
  assert.throws(() => office.onChanged('nope'), /callback/);
});

/* ── 훅 서버를 이은 자리(구현설계.md 11.1 · 12.3, 15절 5단계) ── */
/* shipped: 사무실을 켜고 낸 판(officeShipped). 아래 훅 시험들은 켜고 낸 판의 동작을 본다. 꺼 둔 판은 맨 아래 PC 0.5.2 시험이 본다 */
function hooksMain({ packaged = true, mode = 'release', clientId = 'platform', smoke = false, status = signedIn(YUHO), argv = [], shipped = true } = {}) {
  const ctx = {
    packaged, officeShipped: shipped, smoke, runtime: { clientId, mode }, status, made: [], sent: [], exits: [], ingested: [],
    process: { argv },
    accountStatus: () => ctx.status, renewingAccount: () => null,
    app: { getPath: name => 'C:\\synthetic\\' + name, exit: code => ctx.exits.push(code) },
    sendDesktop: (...a) => ctx.sent.push(a),
    office: async () => ({ accepts: async a => a.synk_user_id === YUHO.synk_user_id, ingest: async (e, a) => { ctx.ingested.push([e.event, a.synk_user_id]); return { ok: true }; } }),
    createOfficeHooks: options => { ctx.made.push(options); return { disable: async () => ({ ok: true, written: 0, refused: 0, dirs: ['C:\\x'] }), unhook: async () => { ctx.made.at(-1).unhooked = true; return { ok: true }; }, status: async () => ({ on: true, available: true, dirs: [{ dir: 'C:\\x' }] }) }; },
  };
  vm.runInNewContext([source('const officeOff='), source('const officeAccountOf='), source('const officeLoginOf='), 'let officeHooks=null;', source('const officeHooksRelease='), source('const officeHooksInstalled='), source('function officeHooksService(){'), source('async function officeHooksOff(){'), source('async function officeHooksStatus(){')].join('\n'), ctx);
  return ctx;
}

test('the hooks service edits real settings only in the installed release build, takes news only for a signed-in viewer, and tells the window about changes', async () => {
  const installed = hooksMain();
  installed.officeHooksService();
  installed.officeHooksService();
  assert.equal(installed.made.length, 1, 'made once');
  assert.equal(installed.made[0].userData, 'C:\\synthetic\\userData');
  assert.equal(installed.made[0].installed, true);
  for (const [label, options] of [['preview build', { mode: 'development' }], ['source run', { packaged: false, mode: 'development' }], ['smoke', { smoke: true }]]) {
    const c = hooksMain(options);
    c.officeHooksService();
    assert.equal(c.made[0].installed, false, `${label} takes the folders only from the override`);
  }
  const o = installed.made[0];
  // accepts는 받기를 허락한 볼 계정을 돌려주고, deliver는 그 계정으로만 접는다(GPT 검수 r8 GA1)
  const allowed = await o.accepts();
  assert.equal(allowed?.synk_user_id, YUHO.synk_user_id);
  installed.status = signedIn(OTHER);
  assert.equal(await o.accepts(), false, 'another account is not a viewer');
  installed.status = { signedIn: false, account: null };
  assert.equal(await o.accepts(), false, 'signed out');
  o.deliver({ kind: 'hook', event: 'Stop' }, false);
  // 몸을 받는 사이에 다른 계정으로 바뀌어도 허락한 계정으로 넘긴다. 지금 계정이 아니면 사무실의 ingest가 버린다
  installed.status = signedIn(OTHER);
  o.deliver({ kind: 'hook', event: 'PostToolUse' }, allowed);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(installed.ingested, [['PostToolUse', YUHO.synk_user_id]], 'news is folded for the account that allowed it, never the account signed in later');
  o.onChange();
  assert.deepEqual(plain(installed.sent), [['synk:office-changed']]);
});

test('turning off and asking whether hooks are on need no viewer or sign-in, only the platform client; the answers carry no folder', async () => {
  const out = hooksMain({ status: { signedIn: false, account: null } });
  assert.deepEqual(plain(await out.officeHooksOff()), { ok: true });
  assert.deepEqual(plain(await out.officeHooksStatus()), { ok: true, on: true });
  for (const options of [{ clientId: 'world' }, { smoke: true }]) {
    const c = hooksMain(options);
    assert.equal((await c.officeHooksOff()).code, 'LAUNCHER_ONLY');
    assert.equal((await c.officeHooksStatus()).code, 'LAUNCHER_ONLY');
    assert.equal(c.made.length, 0);
  }
});

test('--office-unhook is handled before the single-instance lock: it removes Solio\'s lines without a window and exits', async () => {
  const at = name => lines.findIndex(l => l.startsWith(name));
  const unhookAt = at('const officeUnhook='), lockAt = lines.findIndex(l => l.includes('app.requestSingleInstanceLock()'));
  assert.ok(unhookAt > 0 && unhookAt < lockAt, 'before the lock');
  assert.match(lines[at('const yielded=')], /^const yielded=!officeUnhook&&/, 'the update hand-off does not run while unhooking');
  assert.match(lines[at('if(officeUnhook||yielded)')], /^if\(officeUnhook\|\|yielded\)\{\/\*.*\*\/\}$/, 'no lock, no window, no services');
  const run = async (argv, options = {}) => {
    const ctx = hooksMain({ argv, ...options });
    vm.runInNewContext([source('const officeUnhook='), source('if(officeUnhook)void ')].join('\n'), ctx);
    for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
    return ctx;
  };
  const yes = await run(['SYNK Platform.exe', '--office-unhook']);
  assert.equal(yes.made.length, 1);
  assert.deepEqual([yes.made[0].userData, yes.made[0].installed, yes.made[0].unhooked], ['C:\\synthetic\\userData', true, true]);
  assert.equal(yes.made[0].accepts, undefined, 'no server is wired for the unhook run');
  assert.deepEqual(yes.exits, [0]);
  const no = await run(['SYNK Platform.exe']);
  assert.deepEqual([no.made.length, no.exits.length], [0, 0], 'a normal start does not unhook');
  // 사무실을 꺼 둔 판(PC 0.5.2)도 지우는 길은 설치본으로 그대로 돈다. 넘겨받은 폴더(SYNK_OFFICE_HOOK_DIRS)를 지우지 않는다(GPT 검수 GA1)
  const shelved = await run(['SYNK Platform.exe', '--office-unhook'], { shipped: false });
  assert.deepEqual([shelved.made.length, shelved.made[0].installed, shelved.made[0].unhooked, shelved.exits], [1, true, true, [0]]);
  // 꺼 둔 판은 기본 설정 폴더를 보지 않는다(r2 GA1). 켜고 낸 판은 전과 같이 본다
  assert.deepEqual(plain(shelved.made[0].baseDirs()), [], 'the shelved build cleans only the folders in its state file');
  assert.equal(yes.made[0].baseDirs, undefined, 'the shipped build keeps the default folder');
});

/* r2 GA1: 실제 지우기 코드를 이 줄의 옵션 그대로 돌린다. 꺼 둔 판은 적어 두지 않은 폴더(CLAUDE_CONFIG_DIR · SYNK_OFFICE_HOOK_DIRS)의 솔리오 줄을 남긴다 */
test('r2 GA1: --office-unhook in the shelved build leaves Solio lines in folders it never recorded; the shipped build still cleans the default folder', async () => {
  const { createOfficeHooks } = createRequire(import.meta.url)('../src/office-hooks.cjs');
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'office-main-unhook-'));
  const saved = { cfg: process.env.CLAUDE_CONFIG_DIR, over: process.env.SYNK_OFFICE_HOOK_DIRS };
  try {
    const line = { type: 'http', url: 'http://127.0.0.1:40001/synk-office/' + 'z'.repeat(43), timeout: 2 };
    const settings = JSON.stringify({ env: { K: 'v' }, hooks: { Stop: [{ hooks: [line] }] } }, null, 2);
    const run = async (shipped, name) => {
      const cfg = path.join(top, name, 'profile'), over = path.join(top, name, 'override'), userData = path.join(top, name, 'userData');
      for (const dir of [cfg, over, userData]) { fs.mkdirSync(dir, { recursive: true }); }
      for (const dir of [cfg, over]) fs.writeFileSync(path.join(dir, 'settings.json'), settings);
      process.env.CLAUDE_CONFIG_DIR = cfg; process.env.SYNK_OFFICE_HOOK_DIRS = over;
      const ctx = hooksMain({ argv: ['SYNK Platform.exe', '--office-unhook'], shipped });
      ctx.app.getPath = () => userData;
      ctx.createOfficeHooks = options => createOfficeHooks(options);
      vm.runInNewContext([source('const officeUnhook='), source('if(officeUnhook)void ')].join('\n'), ctx);
      for (let i = 0; i < 200 && !ctx.exits.length; i++) await new Promise(r => setTimeout(r, 5));
      assert.deepEqual(ctx.exits, [0], name);
      return { profile: fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'), override: fs.readFileSync(path.join(over, 'settings.json'), 'utf8') };
    };
    const shelved = await run(false, 'shelved');
    assert.equal(shelved.profile, settings, 'CLAUDE_CONFIG_DIR is left as it was');
    assert.equal(shelved.override, settings, 'SYNK_OFFICE_HOOK_DIRS is left as it was');
    const shipped = await run(true, 'shipped');
    assert.deepEqual(JSON.parse(shipped.profile), { env: { K: 'v' } }, 'the shipped build still removes its lines from the default folder');
    assert.equal(shipped.override, settings, 'the installed build never cleans a handed-over folder');
  } finally {
    for (const [key, value] of [['CLAUDE_CONFIG_DIR', saved.cfg], ['SYNK_OFFICE_HOOK_DIRS', saved.over]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    fs.rmSync(top, { recursive: true, force: true });
  }
});

const START_LINE = '    if(!smoke&&!officeOff())void officeHooksService().start().catch(()=>{});';
test('the server starts with the platform main (not in smoke runs, not while the office is off) and closes when quitting', () => {
  assert.ok(lines.some(l => l === START_LINE), 'started in initializeMain');
  const startAt = lines.findIndex(l => l === START_LINE);
  const initAt = lines.findIndex(l => l.startsWith('function initializeMain(){'));
  assert.ok(startAt > initAt && lines.slice(initAt, startAt).some(l => l.startsWith("  if(runtime.clientId==='platform'){")), 'inside the platform branch of initializeMain');
  const quit = [], closed = [];
  vm.runInNewContext(source("app.on('before-quit',()=>void officeHooks?.close());"), { app: { on: (e, fn) => quit.push([e, fn]) }, officeHooks: { close: () => { closed.push(true); return Promise.resolve(); } } });
  assert.equal(quit[0][0], 'before-quit');
  quit[0][1]();
  assert.deepEqual(closed, [true]);
});

/* ── PC 0.5.2: 포장된 판은 사무실을 꺼 둔 채 낸다(officeShipped, 11-20) ── */
/* 사무실 · 훅 · 채널 · 앱을 켤 때의 서버 열기 줄을 한 자리에 이어 돌린다. packaged · shipped만 바꾼다 */
function wired({ packaged, shipped = false } = {}) {
  const ctx = {
    packaged, officeShipped: shipped, smoke: false, runtime: { clientId: 'platform', mode: 'release' }, status: signedIn(YUHO),
    paths: [], loads: 0, offices: [], hooks: [], calls: [],
    accountStatus: () => ctx.status, renewingAccount: () => null,
    app: { getPath: name => { ctx.paths.push(name); return 'C:\\synthetic\\' + name; } },
    sendDesktop() {},
    loadOfficeModel: async () => { ctx.loads += 1; return MODEL; },
    createOffice: options => {
      ctx.offices.push(options);
      const did = name => () => { ctx.calls.push(name); return name === 'snapshot' ? { ok: true, available: true } : { ok: true }; };
      return { accountChanged() {}, ...Object.fromEntries(['snapshot', 'watch', 'removeDepartment', 'assign', 'saveSettings', 'seen', 'setHooks'].map(name => [name, did(name)])) };
    },
    createOfficeHooks: options => {
      ctx.hooks.push(options);
      return { start: async () => { ctx.calls.push('start'); return { ok: true }; }, disable: async () => { ctx.calls.push('disable'); return { ok: true }; }, status: async () => { ctx.calls.push('status'); return { on: true }; } };
    },
    officeSaveDepartment: () => { ctx.calls.push('officeSaveDepartment'); return { ok: true }; },
    officeAddRoot: () => { ctx.calls.push('officeAddRoot'); return { ok: true }; },
    officeRemoveRoot: () => { ctx.calls.push('officeRemoveRoot'); return { ok: true }; },
  };
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const handlerLines = lines.slice(start).filter(l => /^ {4}'synk:office-/.test(l));
  vm.runInNewContext([
    source('const officeOff='), source('let officeService=null,officeLoading=null;'), source('const officeAccountOf='), source('const officeLoginOf='), source('function office(){'),
    'let officeHooks=null;', source('const officeHooksRelease='), source('const officeHooksInstalled='), source('function officeHooksService(){'), source('async function officeHooksOff(){'), source('async function officeHooksStatus(){'),
    source('async function officeCall(work){'), `globalThis.handlers=({\n${handlerLines.join('\n')}\n});`, `globalThis.launch=()=>{${START_LINE.trim()}};`, 'globalThis.installed=()=>officeHooksInstalled();',
  ].join('\n'), ctx);
  return ctx;
}
const ARGS = {
  'synk:office-watch': [true], 'synk:office-department-save': [{ name: '법무부', folder: 'choose' }], 'synk:office-department-remove': ['dept-1'],
  'synk:office-session-assign': [S1, null], 'synk:office-settings-save': [{ view: 'top' }], 'synk:office-roots-remove': [ADDED], 'synk:office-seen': [null], 'synk:office-hooks-set': [true],
};
const ask = (ctx, channel) => Promise.resolve(ctx.handlers[channel](...(ARGS[channel] || []))).then(plain);
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); };

test('PC 0.5.2: the packaged build keeps the office off — every office channel answers NOT_AVAILABLE, hooks off/status answer off, and nothing is made, read or started', async () => {
  assert.match(main, /^const officeShipped=false;$/m, '0.5.2 ships with the office off until its review is done (turning it on is this one line, then this test)');
  assert.match(main, /^const officeOff=\(\)=>packaged&&!officeShipped;$/m);
  const off = wired({ packaged: true });
  for (const channel of CHANNELS) {
    const want = channel === 'synk:office-hooks-off' ? { ok: true } : channel === 'synk:office-hooks-status' ? { ok: true, on: false } : { ok: false, code: 'NOT_AVAILABLE' };
    assert.deepEqual(await ask(off, channel), want, channel);
  }
  off.status = { signedIn: false, account: null };
  assert.deepEqual(plain(await off.officeCall(work)), { ok: false, code: 'NOT_AVAILABLE' }, 'answered before the sign-in check');
  assert.equal(off.installed(), false, 'the real Claude Code settings are never the target');
  off.launch();
  await settle();
  assert.deepEqual([off.loads, off.offices.length, off.hooks.length, off.paths.length, off.calls], [0, 0, 0, 0, []], 'no model, no office (so no viewers.json read), no hooks service, no userData path, no server start');
  // 화면 쪽: 이 답이면 사무실 오브제와 방이 서지 않는다(office-room.mjs의 장면은 ok:false나 available이 참이 아니면 보이지 않는다)
  const { createOfficeRoom, officeHooksAsideRow } = await import('../renderer/office-room.mjs');
  const room = createOfficeRoom({ api: null, snapshot: () => null, reread() {}, changed() {} });
  assert.equal(room.scene({ ok: false, code: 'NOT_AVAILABLE' }, Date.now(), null).visible, false);
  assert.equal(officeHooksAsideRow({ ok: true, on: false }), null, 'no turn-off row in the settings room');
});

test('PC 0.5.2: the switch touches only the packaged build — a source run and a packaged build with the office shipped still reach the office, the hooks and the server', async () => {
  for (const [label, options, installed] of [['source run', { packaged: false }, false], ['packaged, office shipped', { packaged: true, shipped: true }, true]]) {
    const on = wired(options);
    for (const channel of CHANNELS) assert.equal((await ask(on, channel)).ok, true, `${label}: ${channel}`);
    assert.deepEqual(await ask(on, 'synk:office-snapshot'), { ok: true, available: true }, label);
    assert.deepEqual(await ask(on, 'synk:office-hooks-status'), { ok: true, on: true }, label);
    assert.deepEqual([on.loads, on.offices.length, on.hooks.length], [1, 1, 1], `${label}: one office and one hooks service`);
    assert.equal(on.hooks[0].installed, installed, `${label}: real settings only in the installed release build`);
    assert.equal(on.installed(), installed);
    on.launch();
    await settle();
    assert.deepEqual(on.calls, ['snapshot', 'watch', 'officeSaveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'officeAddRoot', 'officeRemoveRoot', 'seen', 'setHooks', 'disable', 'status', 'snapshot', 'status', 'start'], label);
  }
});
