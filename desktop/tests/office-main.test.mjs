// 솔리오 「사무실」을 본체와 preload에 이은 자리(구현설계.md 11.1 · 13절, 15절 6단계). main.cjs의 줄을 떼어 가짜 값으로 돌린다.
// 실제 사용자 폴더, viewers.json, 폴더 고르기 창은 쓰지 않는다. 훅 서버(5단계)는 아직 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

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

const CHANNELS = ['snapshot', 'watch', 'department-save', 'department-remove', 'session-assign', 'settings-save', 'roots-add', 'roots-remove', 'seen'].map(c => `synk:office-${c}`);
const YUHO = { synk_user_id: 'owner-1234567890', display_name: '유호' };
const OTHER = { synk_user_id: 'tester-1234567890', display_name: '시험 계정' };
const S1 = '00000001-0000-4000-8000-000000000001';
const SESSION_DIR = path.join(os.tmpdir(), 'office-main-session');
const DEPT_DIR = path.join(os.tmpdir(), 'office-main-dept');
const CHOSEN = path.join(os.tmpdir(), 'office-main-chosen');
const ADDED = path.join(os.tmpdir(), 'Office-Main-Added');

test('every synk:office-* channel is in handlers, on one line, and goes through officeCall behind the sender check', () => {
  assert.match(main, /^const \{createOffice,loadOfficeModel\}=require\('\.\/office\.cjs'\);$/m);
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const end = lines.findIndex((l, i) => i > start && l === '  };');
  assert.ok(start > 0 && end > start, 'the handlers object is found');
  const block = lines.slice(start + 1, end);
  const found = block.map(l => l.match(/^ {4}'(synk:office-[a-z-]+)':/)?.[1]).filter(Boolean);
  assert.deepEqual(found, CHANNELS, 'exactly the agreed channels, in the handlers object');
  for (const channel of CHANNELS) {
    const line = block.find(l => l.startsWith(`    '${channel}':`));
    assert.match(line, /^ {4}'synk:office-[a-z-]+':(\(\)|[A-Za-z]+|\([A-Za-z,]+\))=>officeCall\(.*\),$/, `${channel} goes through officeCall on one line`);
  }
  assert.equal([...main.matchAll(/'synk:office-[a-z-]+'/g)].length, CHANNELS.length + 1, 'no other office channel, besides office-changed that main sends');
  assert.match(main, /onChange:\(\)=>sendDesktop\('synk:office-changed'\)/);
  assert.match(main, /for\(const \[channel,handler\]of Object\.entries\(handlers\)\)\{ipcMain\.removeHandler\(channel\);ipcMain\.handle\(channel,async\(event,\.\.\.args\)=>\{assertSender\(event,window,entry,runtime\.clientId\);/);
});

function gate({ runtime = { clientId: 'platform' }, smoke = false, status, load } = {}) {
  const ctx = {
    runtime, smoke, status, created: [], sent: [], paths: [],
    accountStatus: () => ctx.status,
    app: { getPath: name => { ctx.paths.push(name); return 'C:\\synthetic\\userData'; } },
    sendDesktop: (...a) => { ctx.sent.push(a); },
    loadOfficeModel: () => (load ? load(ctx) : Promise.resolve(MODEL)),
    createOffice: options => { ctx.created.push(options); return SERVICE; },
  };
  vm.runInNewContext([source('let officeService=null,officeLoading=null;'), source('function office(){'), source('async function officeCall(work){')].join('\n'), ctx);
  return ctx;
}
const MODEL = { officeReduce() {} };
const SERVICE = { id: 'service' };
const work = (service, account) => ({ ok: true, same: service === SERVICE, account: account.synk_user_id });
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

test('the handlers pass only the agreed values, and the snapshot says hooks are off and not available yet', async () => {
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const handlerLines = lines.slice(start).filter(l => /^ {4}'synk:office-/.test(l));
  const calls = [];
  const service = new Proxy({}, { get: (_t, name) => (...a) => { calls.push([name, ...a.slice(0, -1).map(plain), a.at(-1).synk_user_id]); return name === 'snapshot' ? { ok: true, available: true, hooks: { on: false } } : { ok: true }; } });
  const ctx = {
    officeCall: run => run(service, YUHO),
    officeSaveDepartment: (s, account, input) => { calls.push(['officeSaveDepartment', plain(input), account.synk_user_id]); return { ok: true }; },
    officeAddRoot: (s, account) => { calls.push(['officeAddRoot', account.synk_user_id]); return { ok: true }; },
    officeRemoveRoot: (s, account, dir) => { calls.push(['officeRemoveRoot', dir, account.synk_user_id]); return { ok: true }; },
  };
  const h = vm.runInNewContext(`({\n${handlerLines.join('\n')}\n})`, ctx);
  const snap = await h['synk:office-snapshot']();
  assert.deepEqual(plain(snap.hooks), { on: false, available: false });
  await h['synk:office-watch']('yes');
  await h['synk:office-watch'](true);
  await h['synk:office-department-save']({ name: '법무', folder: 'choose' });
  await h['synk:office-department-remove']('dept-1');
  await h['synk:office-session-assign'](S1, undefined);
  await h['synk:office-settings-save']({ view: 'top' });
  await h['synk:office-roots-add']('C:\\ignored');
  await h['synk:office-roots-remove'](ADDED);
  await h['synk:office-seen'](null);
  const id = YUHO.synk_user_id;
  assert.deepEqual(calls, [
    ['snapshot', id], ['watch', false, id], ['watch', true, id],
    ['officeSaveDepartment', { name: '법무', folder: 'choose' }, id], ['removeDepartment', 'dept-1', id], ['assign', S1, null, id],
    ['saveSettings', { view: 'top' }, id], ['officeAddRoot', id], ['officeRemoveRoot', ADDED, id], ['seen', null, id],
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
  assert.deepEqual(c.calls.at(-1), ['saveDepartment', { id: 'dept-1', name: '법무팀', folder: DEPT_DIR }, id], 'a rename keeps the stored folder');
  c = helpers();
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { id: 'dept-9', name: '법무팀' })).code, 'NOT_FOUND');
  c = helpers({ snap: { ok: true, available: false } });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { id: 'dept-1', name: '법무팀' })).code, 'NOT_ALLOWED');
  for (const input of [null, 'C:\\x', { name: '새 부서' }, { name: '새 부서', folder: CHOSEN }, { name: '새 부서', folder: null }, { id: 7, name: 'x', folder: 'choose' }]) {
    c = helpers();
    assert.equal((await c.officeSaveDepartment(c.service, YUHO, input)).code, 'VALUE', JSON.stringify(input));
    assert.ok(!c.calls.some(x => x[0] === 'saveDepartment' || x[0] === 'dialog'));
  }
});

test('roots: adding opens the chooser and appends; removing takes only an added folder, ignoring case', async () => {
  const id = YUHO.synk_user_id;
  let c = helpers();
  await c.officeAddRoot(c.service, YUHO);
  assert.deepEqual(c.calls, [['allowed', id], DIALOG, ['snapshot', id], ['saveRoots', [ADDED, CHOSEN], id]]);
  c = helpers({ dialogResult: { canceled: true, filePaths: [] } });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'CANCELLED');
  c = helpers({ allowed: false });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'NOT_ALLOWED');
  assert.ok(!c.calls.some(x => x[0] === 'dialog'));

  c = helpers();
  await c.officeRemoveRoot(c.service, YUHO, ADDED.toUpperCase());
  assert.deepEqual(c.calls, [['snapshot', id], ['saveRoots', [], id]]);
  for (const dir of [CHOSEN, path.join(os.homedir(), '.claude'), '', 5]) {
    c = helpers();
    assert.equal((await c.officeRemoveRoot(c.service, YUHO, dir)).code, typeof dir === 'string' ? 'NOT_FOUND' : 'VALUE', String(dir));
    assert.ok(!c.calls.some(x => x[0] === 'saveRoots'));
  }
  c = helpers({ snap: { ok: true, available: false } });
  assert.equal((await c.officeRemoveRoot(c.service, YUHO, ADDED)).code, 'NOT_ALLOWED');
});

test('an account change or sign-out reaches the office, a same-account renewal does not clear it, and quitting closes it', () => {
  const changed = [];
  const ctx = {
    careNotifications: null, pulseApp: null, syncCompanyEntry() {}, scheduleHiddenAuthRetry() {}, syncTrayApps: async () => {},
    window: null, trustedEntry: () => false, entry: '', runtime: { clientId: 'platform' },
    renewing: null, renewingAccount: () => ctx.renewing,
    officeService: null,
  };
  vm.runInNewContext([source('const officeAccountOf='), source('function publishAuthState(state){')].join('\n'), ctx);
  ctx.publishAuthState(signedIn(YUHO));
  assert.deepEqual(changed, [], 'nothing to tell before the office exists');
  ctx.officeService = { accountChanged: a => changed.push(a === null ? null : plain(a)) };
  ctx.publishAuthState(signedIn(YUHO));
  ctx.publishAuthState(signedIn(OTHER));
  ctx.renewing = OTHER.synk_user_id;
  ctx.publishAuthState({ signedIn: false, status: 'restoring', account: null });
  ctx.renewing = null;
  ctx.publishAuthState({ signedIn: false, status: 'signed-out', account: null });
  ctx.publishAuthState({ signedIn: true, account: null });
  assert.deepEqual(changed, [YUHO, OTHER, { synk_user_id: OTHER.synk_user_id }, null, null]);

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
  assert.deepEqual(Object.keys(office), ['snapshot', 'watch', 'saveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'addRoot', 'removeRoot', 'seen', 'onChanged']);
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
