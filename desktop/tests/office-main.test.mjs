// 솔리오 「사무실」을 본체와 preload에 이은 자리(구현설계.md 11.1 · 13절, 15절 6단계). main.cjs의 줄을 떼어 가짜 값으로 돌린다.
// 실제 사용자 폴더, viewers.json, 폴더 고르기 창, Claude Code 설정 파일은 쓰지 않는다. 첫 조각에는 훅이 없다(11-21).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

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

const CHANNELS = ['snapshot', 'task-submit', 'mail-connect', 'mail-disconnect', 'mail-open', 'mail-more', 'task-action', 'feature-snapshot', 'feature-action', 'watch', 'department-save', 'department-remove', 'session-assign', 'settings-save', 'roots-add', 'roots-remove', 'seen'].map(c => `synk:office-${c}`);
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
  const literals = [...main.matchAll(/'synk:office-[a-z-]+'/g)].map(m => m[0].slice(1, -1));
  assert.deepEqual([...new Set(literals.filter(c => !CHANNELS.includes(c)))], ['synk:office-changed'], 'no other office channel, besides office-changed that main sends for the office');
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
  };
  vm.runInNewContext([source('const officeOff='), source('let officeService=null,officeLoading=null;'), source('const officeAccountOf='), source('const officeLoginOf='), source('function office(){'), source('async function officeCall(work){')].join('\n'), ctx);
  return ctx;
}
const MODEL = { officeReduce() {} };
const SERVICE = { id: 'service' };
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
  assert.equal(Object.hasOwn(ctx.created[0], 'hooks'), false, 'the office is made without a hooks service (11-21)');
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

test('the handlers pass only the agreed values; the snapshot is the office answer as it is', async () => {
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const handlerLines = lines.slice(start).filter(l => /^ {4}'synk:office-/.test(l));
  const calls = [];
  const service = new Proxy({}, { get: (_t, name) => (...a) => { calls.push([name, ...a.slice(0, -1).map(plain), a.at(-1).synk_user_id]); return name === 'snapshot' ? { ok: true, available: true } : { ok: true }; } });
  const ctx = {
    officeCall: run => run(service, YUHO),
    officeTasks:()=>null,
    officeSaveDepartment: (s, account, input) => { calls.push(['officeSaveDepartment', plain(input), account.synk_user_id]); return { ok: true }; },
    officeAddRoot: (s, account) => { calls.push(['officeAddRoot', account.synk_user_id]); return { ok: true }; },
    officeRemoveRoot: (s, account, dir) => { calls.push(['officeRemoveRoot', dir, account.synk_user_id]); return { ok: true }; },
  };
  const h = vm.runInNewContext(source('async function officeWithTasks(')+'\n'+`({\n${handlerLines.join('\n')}\n})`, ctx);
  const snap = await h['synk:office-snapshot']();
  assert.deepEqual(plain(snap), { ok: true, available: true });
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
  const refused = await vm.runInNewContext(`({\n${handlerLines[0]}\n})`, { officeWithTasks(){throw Error('not allowed');}, officeCall: async () => ({ ok: true, available: false }) })['synk:office-snapshot']();
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
    path, status, calls, service, renewing: null,
    accountStatus: () => ctx.status, renewingAccount: () => ctx.renewing,
    window: alive ? { isDestroyed: () => false } : null,
    dialog: { showOpenDialog: async (...a) => { calls.push(['dialog', a[0] === ctx.window, plain(a[1])]); onDialog?.(ctx); return dialogResult; } },
  };
  vm.runInNewContext([source('const officeAccountOf='), source('async function officeChooseFolder('), source('async function officeSaveDepartment('), source('async function officeAddRoot('), source('async function officeRemoveRoot(')].join('\n'), ctx);
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

/* GPT 검수(solio-office-be-20261120) GA9: 고르는 사이에 같은 계정이 토큰을 갱신해도(잠깐 restoring, 회차는 그대로) 같은 묶음이다(officeCall과 같은 셈) */
test('GA9: a same-account token renewal while the folder chooser is open keeps the chosen folder; a real sign-in change still drops it', async () => {
  const id = YUHO.synk_user_id;
  const renewing = ctx => { ctx.status = { signedIn: false, status: 'restoring', sessionGeneration: 1, account: null }; ctx.renewing = YUHO.synk_user_id; };
  let c = helpers({ onDialog: renewing });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).ok, true, 'adding a watched folder');
  assert.deepEqual(c.calls.at(-1), ['addRoot', CHOSEN, id]);
  c = helpers({ onDialog: renewing });
  assert.equal((await c.officeSaveDepartment(c.service, YUHO, { name: '법무부', folder: 'choose' })).ok, true, 'choosing a department folder');
  assert.deepEqual(c.calls.at(-1), ['saveDepartment', { name: '법무부', folder: CHOSEN }, id]);
  c = helpers({ onDialog: ctx => { ctx.status = { signedIn: false, status: 'restoring', sessionGeneration: 1, account: null }; ctx.renewing = OTHER.synk_user_id; } });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'AUTH_CHANGED', 'a renewal for another account is a change');
  c = helpers({ onDialog: ctx => { ctx.status = { signedIn: false, status: 'restoring', sessionGeneration: 2, account: null }; ctx.renewing = YUHO.synk_user_id; } });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'AUTH_CHANGED', 'a new round is a change');
  c = helpers({ onDialog: ctx => { ctx.status = { signedIn: false, status: 'signed-out', sessionGeneration: 1, account: null }; } });
  assert.equal((await c.officeAddRoot(c.service, YUHO)).code, 'AUTH_CHANGED', 'signed out');
  assert.ok(!c.calls.some(x => x[0] === 'addRoot'));
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
  let identityRefreshes = 0;
  const ctx = {
    careNotifications: null, pulseApp: null, workspaceApp: null, followWorkspaceNow() {}, syncCompanyEntry() {}, scheduleHiddenAuthRetry() {}, syncTrayApps: async () => {},
    window: null, trustedEntry: () => false, entry: '', runtime: { clientId: 'platform' },
    renewing: null, renewingAccount: () => ctx.renewing,
    estimateWindow: null, officeService: null, officeEmployeeTasks:null, chatgptConnection: null, solioBackupService: null, solioBackupSweep: () => {},
  };
  vm.runInNewContext([source('const officeAccountOf='), source('const officeLoginOf='), source('function publishAuthState(state){')].join('\n'), ctx);
  ctx.publishAuthState(signedIn(YUHO));
  assert.deepEqual(changed, [], 'nothing to tell before the office exists');
  ctx.officeService = { accountChanged: a => changed.push(a === null ? null : plain(a)) };
  ctx.chatgptConnection = { accountChanged: () => { identityRefreshes++; } };
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
  assert.equal(identityRefreshes, changed.length, 'each published account transition reaches the identity connection');

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
  assert.deepEqual(Object.keys(office), ['snapshot','connectMail','disconnectMail','openMailResult','moreMail','submitTask', 'taskAction', 'featureSnapshot', 'featureAction', 'watch', 'saveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'addRoot', 'removeRoot', 'seen', 'onChanged']);
  const last = () => calls.at(-1);
  const refused = async (p, why) => { const before = calls.length; assert.deepEqual(plain(await p), { ok: false, code: 'VALUE' }, why); assert.equal(calls.length, before, `${why}: nothing crosses`); };

  await office.snapshot('ignored');
  assert.deepEqual(last(), ['synk:office-snapshot']);
  await office.connectMail('gmail');assert.deepEqual(last(),['synk:office-mail-connect','gmail']);
  await office.disconnectMail('outlook');assert.deepEqual(last(),['synk:office-mail-disconnect','outlook']);
  await office.openMailResult(S1,S1);assert.deepEqual(last(),['synk:office-mail-open',S1,S1]);
  await office.moreMail(S1,'gmail',0);assert.deepEqual(last(),['synk:office-mail-more',S1,'gmail',0]);
  for(const args of [['invalid','gmail',0],[S1,'other',0],[S1,'gmail',-1],[S1,'gmail','1'],[S1,'gmail',NaN],[S1,'gmail',Number.MAX_SAFE_INTEGER+1]]){
    await refused(office.moreMail(...args),'invalid continuation');
  }
  await refused(office.connectMail('other'),'unknown mail provider');
  await refused(office.openMailResult(S1,'https://example.test'),'external URL from renderer');
  const assignment={id:S1,provider:'claude',departmentId:null,prompt:'첫 줄\n둘째 줄',previousId:null};
  await office.submitTask({...assignment,cwd:'arbitrary',account:OTHER.synk_user_id,approvalPolicy:'anything'});
  assert.deepEqual(last(),['synk:office-task-submit',assignment]);
  await office.submitTask({...assignment,provider:'codex',mailSearch:false});
  assert.equal(last()[1].mailSearch,false,'explicit ordinary mode crosses the bridge');
  await office.submitTask({...assignment,provider:'codex'});assert.equal('mailSearch' in last()[1],false);
  for(const change of [{provider:'gemini'},{id:'bad'},{departmentId:'../data'},{prompt:' '},{previousId:'bad'}])await refused(office.submitTask({...assignment,...change}),'invalid assignment');
  await office.taskAction(S1,'terminal');
  assert.deepEqual(last(),['synk:office-task-action',S1,'terminal']);
  await office.taskAction(S1,'saveAnswer','직접 고른 답');
  assert.deepEqual(last(),['synk:office-task-action',S1,'saveAnswer','직접 고른 답']);
  await office.taskAction(S1,'reviewMail');assert.deepEqual(last(),['synk:office-task-action',S1,'reviewMail']);
  await refused(office.taskAction(S1,'reviewMail',{extra:true}),'reopening a filter takes only an existing card id');
  const filter={terms:['견적'],from:'',after:'',before:'',folder:'inbox',provider:'gmail',attachment:''};
  await office.taskAction(S1,'confirmMail',{reviewId:S1,filter});
  assert.deepEqual(plain(last()),['synk:office-task-action',S1,'confirmMail',{reviewId:S1,filter}]);
  for(const choices of [{allowUnboundedPeriod:true},{allowUnboundedPeriod:false},{omitUnmet:true},{allowUnboundedPeriod:true,omitUnmet:true}]){
    await office.taskAction(S1,'confirmMail',{reviewId:S1,filter,...choices});
    assert.deepEqual(plain(last()),['synk:office-task-action',S1,'confirmMail',{reviewId:S1,filter,...choices}]);
  }
  for(const roleDecisions of [{from:'apply'},{folder:'exclude'},{from:'edit',folder:'apply'}]){
    const args={reviewId:S1,filter,roleDecisions,omitUnmet:true};
    await office.taskAction(S1,'confirmMail',args);
    assert.deepEqual(plain(last()),['synk:office-task-action',S1,'confirmMail',args]);
  }
  for(const roleDecisions of [{},{from:true},{folder:'inbox'},{terms:'edit'},{from:'exclude',other:'apply'},[],null]){
    await refused(office.taskAction(S1,'confirmMail',{reviewId:S1,filter,roleDecisions}),'only explicit sender and folder operations cross the bridge');
  }
  await refused(office.taskAction(S1,'confirmMail',{reviewId:S1,filter,allowUnboundedPeriod:'true'}),'an explicit period choice is a boolean');
  await refused(office.taskAction(S1,'confirmMail',{reviewId:S1,filter,omitUnmet:1}),'an omission choice is a boolean');
  await refused(office.taskAction(S1,'confirmMail',{reviewId:S1,filter,unknown:true}),'only known confirmation choices cross the bridge');
  await refused(office.taskAction(S1,'confirmMail',{reviewId:S1,filter:{...filter,other:true}}),'strict filter keys');
  await refused(office.taskAction(S1,'confirmMail',{reviewId:'invalid',filter}),'confirmation nonce must be a UUID');
  await refused(office.taskAction(S1,'confirmMail',{reviewId:S1,filter:{...filter,terms:Array(7).fill('one')}}),'six search terms at most');
  await refused(office.taskAction(S1,'saveAnswer','   '),'empty manual text');
  await refused(office.taskAction(S1,'saveAnswer','a'.repeat(524289)),'oversized manual text');
  await refused(office.taskAction(S1,'approve'),'there is no tool-approval action');
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

/* ── 첫 조각에는 훅이 없다(11-21 유호님 「훅 빼고 내기」, 구현설계.md 0절 · 3.4 · 12.3) ── */
test('main and preload have no hooks: no hooks module, no hooks channel or bridge, no server start', () => {
  assert.doesNotMatch(main, /office-hooks|createOfficeHooks|officeHooks|runOfficeUnhook|officeUnhookAsked|synk:office-hooks/);
  // 훅 소식의 입구(office.cjs ingest)는 첫 조각에서 부르는 곳이 없다. 넷째 검수의 GA8 · GA11(늦은 SessionEnd)을 둘째 조각으로 미룬 근거다.
  // 둘째 조각에서 이을 때는 그 둘을 먼저 고치고 이 줄을 바꾼다(구현설계 8절)
  assert.doesNotMatch(main, /\.ingest\(/, 'nothing in main feeds hook news to the office');
  // 일 맡기기 실행(office-task-*.cjs)도 사무실 서비스를 통째로 받으므로 본체의 모든 .cjs를 본다(설계 검토 solio-office-model-20261122 고칠 것 2)
  const srcDir = new URL('../src/', import.meta.url);
  for (const name of fs.readdirSync(srcDir).filter(n => n.endsWith('.cjs') && n !== 'office.cjs')) {
    const text = fs.readFileSync(new URL(name, srcDir), 'utf8');
    assert.doesNotMatch(text, /\.ingest\(|officeReduce/, name + ' does not feed hook news into the office state');
  }
  assert.doesNotMatch(preloadSource, /ingest/);
  assert.doesNotMatch(preloadSource, /office-hooks|hooksSet|hooksOff|hooksStatus/);
  assert.equal(fs.existsSync(new URL('../src/office-hooks.cjs', import.meta.url)), false);
});

/* 9ae0365423부터 이 저장소에서 구운 설치기(공개하지 않았다)는 앱을 --office-unhook으로 돌렸다. 이 판은 지울 것이 없어 바로 끝난다 */
function startLines({ argv, clientId = 'platform', smoke = false }) {
  const ctx = {
    runtime: { clientId }, smoke, process: { argv }, exits: [], locks: 0, quits: 0,
    app: { exit: code => ctx.exits.push(code), requestSingleInstanceLock: () => { ctx.locks += 1; return true; }, quit: () => { ctx.quits += 1; } },
  };
  vm.runInNewContext([source('const officeUnhook='), source('if(officeUnhook)app.exit(0);'), 'const yielded=false;', source('if(officeUnhook||yielded)'), source('else if(!app.requestSingleInstanceLock())app.quit();')].join('\n'), ctx);
  return ctx;
}
test('an --office-unhook run ends at once with 0: no lock, no update hand-off, no window and no services; other runs start as before', () => {
  const at = name => lines.findIndex(l => l.startsWith(name));
  assert.equal(lines[at('const officeUnhook=')], "const officeUnhook=runtime.clientId==='platform'&&!smoke&&process.argv.includes('--office-unhook');");
  assert.equal(lines[at('if(officeUnhook)')], 'if(officeUnhook)app.exit(0);');
  assert.match(lines[at('const yielded=')], /^const yielded=!officeUnhook&&/, 'the update hand-off does not run for it');
  assert.match(lines[at('if(officeUnhook||yielded)')], /^if\(officeUnhook\|\|yielded\)\{\/\*.*\*\/\}$/, 'no lock, no window, no services');
  const old = startLines({ argv: ['SYNK Platform.exe', '--office-unhook'] });
  assert.deepEqual([old.exits, old.locks, old.quits], [[0], 0, 0]);
  for (const [label, options] of [['a normal start', { argv: ['SYNK Platform.exe'] }], ['WORLD with the flag', { argv: ['SYNK World.exe', '--office-unhook'], clientId: 'world' }], ['a smoke run', { argv: ['x', '--office-unhook'], smoke: true }]]) {
    const c = startLines(options);
    assert.deepEqual([c.exits, c.locks], [[], 1], label);
  }
});
test('the running app opens no window for an --office-unhook second instance and shows it for a normal one', () => {
  const app = new EventEmitter();
  const ctx = { app, runtime: { clientId: 'platform' }, appLocationReady: true, windows: 0, requestPlatformWindow: () => { ctx.windows += 1; }, window: null, pendingTeachingView: false, sendTeachingView() {}, connectionRecovery: null };
  vm.runInNewContext(source("  app.on('second-instance',"), ctx);
  app.emit('second-instance', {}, ['C:\\Program Files\\SYNK Platform\\SYNK Platform.exe', '--office-unhook'], 'C:\\', { officeUnhook: '0'.repeat(32) });
  assert.equal(ctx.windows, 0);
  app.emit('second-instance', {}, ['SYNK Platform.exe'], 'C:\\', {});
  assert.equal(ctx.windows, 1);
});

/* ── 사무실을 켜는 자리(officeShipped). 0.5.2는 꺼 둔 채 냈고(11-20), 11-21에 켠다 ── */
/* 사무실과 채널 줄을 한 자리에 이어 돌린다. packaged · shipped만 바꾼다 */
function wired({ packaged, shipped }) {
  const ctx = {
    officeTasks:()=>null,
    packaged, officeShipped: shipped, smoke: false, runtime: { clientId: 'platform', mode: 'release' }, status: signedIn(YUHO),
    paths: [], loads: 0, offices: [], calls: [],
    accountStatus: () => ctx.status, renewingAccount: () => null,
    app: { getPath: name => { ctx.paths.push(name); return 'C:\\synthetic\\' + name; } },
    sendDesktop() {},
    loadOfficeModel: async () => { ctx.loads += 1; return MODEL; },
    createOffice: options => {
      ctx.offices.push(options);
      const did = name => () => { ctx.calls.push(name); return name === 'snapshot' ? { ok: true, available: true } : { ok: true }; };
      return { accountChanged() {}, ...Object.fromEntries(['snapshot', 'watch', 'removeDepartment', 'assign', 'saveSettings', 'seen'].map(name => [name, did(name)])) };
    },
    officeSaveDepartment: () => { ctx.calls.push('officeSaveDepartment'); return { ok: true }; },
    officeAddRoot: () => { ctx.calls.push('officeAddRoot'); return { ok: true }; },
    officeRemoveRoot: () => { ctx.calls.push('officeRemoveRoot'); return { ok: true }; },
  };
  const start = lines.findIndex(l => l.trim() === 'const handlers={');
  const handlerLines = lines.slice(start).filter(l => /^ {4}'synk:office-/.test(l));
  vm.runInNewContext([
    source('const officeOff='), source('let officeService=null,officeLoading=null;'), source('const officeAccountOf='), source('const officeLoginOf='), source('function office(){'),
    source('async function officeWithTasks('),source('async function officeCall(work){'), `globalThis.handlers=({\n${handlerLines.join('\n')}\n});`,
  ].join('\n'), ctx);
  return ctx;
}
const ARGS = {
  'synk:office-watch': [true], 'synk:office-department-save': [{ name: '법무부', folder: 'choose' }], 'synk:office-department-remove': ['dept-1'],
  'synk:office-session-assign': [S1, null], 'synk:office-settings-save': [{ view: 'top' }], 'synk:office-roots-remove': [ADDED], 'synk:office-seen': [null],
};
const ask = (ctx, channel) => Promise.resolve(ctx.handlers[channel](...(ARGS[channel] || []))).then(plain);

test('the office ships on (officeShipped), and a packaged build with the switch off answers NOT_AVAILABLE everywhere and makes nothing', async () => {
  assert.match(main, /^const officeShipped=true;$/m, '11-21: the first piece ships without hooks (turning it off is this one line)');
  assert.match(main, /^const officeOff=\(\)=>packaged&&!officeShipped;$/m);
  const off = wired({ packaged: true, shipped: false });
  for (const channel of CHANNELS) assert.deepEqual(await ask(off, channel), { ok: false, code: 'NOT_AVAILABLE' }, channel);
  off.status = { signedIn: false, account: null };
  assert.deepEqual(plain(await off.officeCall(work)), { ok: false, code: 'NOT_AVAILABLE' }, 'answered before the sign-in check');
  assert.deepEqual([off.loads, off.offices.length, off.paths.length, off.calls], [0, 0, 0, []], 'no model, no office (so no viewers.json read), no userData path');
  // 화면 쪽: 이 답이면 사무실 오브제와 방이 서지 않는다(office-room.mjs의 장면은 ok:false나 available이 참이 아니면 보이지 않는다)
  const { createOfficeRoom } = await import('../renderer/office-room.mjs');
  const room = createOfficeRoom({ api: null, snapshot: () => null, reread() {}, changed() {} });
  assert.equal(room.scene({ ok: false, code: 'NOT_AVAILABLE' }, Date.now(), null).visible, false);
  for (const [label, options] of [['source run', { packaged: false, shipped: false }], ['packaged, office shipped', { packaged: true, shipped: true }]]) {
    const on = wired(options);
    for (const channel of CHANNELS) assert.equal((await ask(on, channel)).ok, !/^synk:office-(task|mail|feature)-/.test(channel), `${label}: ${channel}`);
    assert.deepEqual([on.loads, on.offices.length], [1, 1], `${label}: one office`);
    assert.deepEqual(on.calls, ['snapshot', 'watch', 'officeSaveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'officeAddRoot', 'officeRemoveRoot', 'seen'], label);
  }
});

test('preload: the feature bridge passes only the feature name, department, an agreed action and its typed fields (no paths)', async () => {
  const { office, calls } = bridge();
  const last = () => calls.at(-1);
  const refused = async (p, why) => { const before = calls.length; assert.deepEqual(plain(await p), { ok: false, code: 'VALUE' }, why); assert.equal(calls.length, before, `${why}: nothing crosses`); };
  await office.featureSnapshot('bizplan', 'plan01');
  assert.deepEqual(last(), ['synk:office-feature-snapshot', 'bizplan', 'plan01']);
  await office.featureAction('bizplan', 'plan01', 'choose', { key: 'n2', kind: 'edit', text: '고친 문장' });
  assert.deepEqual(last(), ['synk:office-feature-action', 'bizplan', 'plan01', 'choose', { key: 'n2', kind: 'edit', text: '고친 문장' }]);
  await office.featureAction('bizplan', 'plan01', 'pick-plan');
  assert.deepEqual(last(), ['synk:office-feature-action', 'bizplan', 'plan01', 'pick-plan', {}]);
  await office.featureAction('bizplan', 'plan01', 'handoff', { key: 'n1', departmentId: 'dev001', provider: 'claude', extra: '급하지 않아요' });
  assert.deepEqual(last()[4], { key: 'n1', departmentId: 'dev001', provider: 'claude', extra: '급하지 않아요' });
  await refused(office.featureAction('bizplan', 'plan01', 'pick-plan', { path: 'C:\Users\a\plan.docx' }), 'a path field');
  await refused(office.featureAction('bizplan', 'plan01', 'delete-all', {}), 'an unknown action');
  await refused(office.featureAction('Biz Plan', 'plan01', 'save', {}), 'a bad feature name');
  await refused(office.featureAction('bizplan', '../x', 'save', {}), 'a bad department');
  await refused(office.featureAction('bizplan', 'plan01', 'choose', { key: 'n1', kind: 'edit', text: 'a\u0001b' }), 'a control character');
  await refused(office.featureAction('bizplan', 'plan01', 'draft', { item: '성장 전략', answers: [0, 9] }), 'an answer out of range');
  await refused(office.featureAction('bizplan', 'plan01', 'criteria', { mode: 'pasted', text: 'x'.repeat(4001) }), 'criteria too long');
  await refused(office.featureSnapshot('bizplan', 'x'), 'a short department id');
});
