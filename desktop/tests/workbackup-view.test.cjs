'use strict';
// 백업 방 안 엔진 화면 자리의 시험: 화면 파일 내주기(src/workbackup-ui.cjs), 자리 · 보낸 쪽 검사 · 수명(src/workbackup-view.cjs), preload의 통로 넷.
// 가짜 설치 폴더는 임시 폴더이고, 호스트 · 뷰 · 세션은 대역이다. 실제 엔진과 레지스트리는 쓰지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const U = require('../src/workbackup-ui.cjs');
const V = require('../src/workbackup-view.cjs');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wb-ui-'));
/* 엔진 stage-resources.cjs와 같은 꼴의 자원 목록: files의 키는 resources\ 아래 상대 이름이다 */
function install({ version = '0.8.0', files = null, extra = {} } = {}) {
  const loc = temp(), res = path.join(loc, 'resources'), ui = path.join(res, 'ui');
  fs.mkdirSync(path.join(ui, 'fonts'), { recursive: true });
  const put = (name, text) => { const file = path.join(res, ...name.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return { size: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) }; };
  const listed = files || {
    'ui/index.html': put('ui/index.html', '<!doctype html><title>업무 백업</title><script src="bridge.js"></script>'),
    'ui/app.js': put('ui/app.js', 'export const x = 1;'),
    'ui/style.css': put('ui/style.css', 'body{}'),
    'ui/fonts/SUIT-Variable.woff2': put('ui/fonts/SUIT-Variable.woff2', 'font'),
    'ui/notes.md': put('ui/notes.md', '# not served'),
    'node.exe': put('node.exe', 'MZ'),
  };
  fs.writeFileSync(path.join(res, 'manifest.json'), JSON.stringify({ version: 1, appVersion: version, resticVersion: '0.19.1', files: listed, ...extra }));
  return { loc, res, ui };
}

test('names: only workbackup-ui://app/ and plain parts; ui/ keys only', () => {
  assert.equal(U.requestName('workbackup-ui://app/'), 'index.html');
  assert.equal(U.requestName('workbackup-ui://app/index.html'), 'index.html');
  assert.equal(U.requestName('workbackup-ui://app/fonts/SUIT-Variable.woff2?x=1#y'), 'fonts/SUIT-Variable.woff2');
  // 주소의 ..는 주소 읽기가 먼저 걷어 화면 폴더 안의 이름이 된다(목록에 없으니 404). 밖으로 나가는 이름은 만들어지지 않는다
  assert.equal(U.requestName('workbackup-ui://app/../manifest.json'), 'manifest.json');
  assert.equal(U.requestName('workbackup-ui://app/%2e%2e/manifest.json'), 'manifest.json');
  for (const bad of ['workbackup-ui://other/index.html', 'https://app/index.html', 'workbackup-ui://app/a%2fb.js', 'workbackup-ui://app/a%5cb.js', 'workbackup-ui://app/a\\b.js', 'workbackup-ui://app//x.js', 'workbackup-ui://user@app/x.js', 'workbackup-ui://app:1/x.js', 'nonsense']) assert.equal(U.requestName(bad), null, bad);
  assert.equal(U.uiName('ui/fonts/a.woff2'), 'fonts/a.woff2');
  for (const bad of ['node.exe', 'ui/../x', 'ui/a\\b', 'ui/', 'ui/./a.js', 'ui//a.js']) assert.equal(U.uiName(bad), null, bad);
});

test('serving: listed names with matching size and SHA-256 only, with the right type; nothing outside the list', async () => {
  const { loc, ui } = install();
  const s = U.createWorkbackupUi();
  assert.equal((await s.respond('workbackup-ui://app/index.html')).status, 503, 'nothing before load');
  assert.equal(await s.load(loc, '0.8.0'), 'ok');
  const index = await s.respond('workbackup-ui://app/');
  assert.deepEqual([index.status, index.mime], [200, 'text/html; charset=utf-8']);
  assert.match(index.body.toString('utf8'), /업무 백업/);
  assert.equal((await s.respond('workbackup-ui://app/app.js')).mime, 'text/javascript; charset=utf-8');
  assert.equal((await s.respond('workbackup-ui://app/style.css')).mime, 'text/css; charset=utf-8');
  assert.equal((await s.respond('workbackup-ui://app/fonts/SUIT-Variable.woff2')).mime, 'font/woff2');
  assert.equal((await s.respond('workbackup-ui://app/notes.md')).status, 404, 'an extension without a type is not served');
  assert.equal((await s.respond('workbackup-ui://app/manifest.json')).status, 404);
  assert.equal((await s.respond('workbackup-ui://app/../node.exe')).status, 404);
  fs.writeFileSync(path.join(ui, 'stray.js'), 'not listed');
  assert.equal((await s.respond('workbackup-ui://app/stray.js')).status, 404, 'a file on disk but not in the list');
  // 크기가 같은데 바이트가 다르면 내주지 않는다
  fs.writeFileSync(path.join(ui, 'app.js'), 'export const y = 2;');
  assert.equal((await s.respond('workbackup-ui://app/app.js')).status, 404, 'hash differs');
  fs.writeFileSync(path.join(ui, 'style.css'), 'body{}x');
  assert.equal((await s.respond('workbackup-ui://app/style.css')).status, 404, 'size differs');
  const handled = await s.handle({ url: 'workbackup-ui://app/index.html' });
  assert.deepEqual([handled.status, handled.headers.get('content-type'), handled.headers.get('x-content-type-options')], [200, 'text/html; charset=utf-8', 'nosniff']);
  assert.equal((await s.handle({ url: 'workbackup-ui://app/app.js' })).status, 404);
});

test('the list is read again on every load: another version, a broken list or a fresh .installing mark is refused', async () => {
  const { loc } = install({ version: '0.8.1' });
  const s = U.createWorkbackupUi();
  assert.equal(await s.load(loc, '0.8.0'), 'version', 'hello.version and the list must agree');
  assert.equal((await s.respond('workbackup-ui://app/index.html')).status, 503);
  assert.equal(await s.load(loc, '0.8.1'), 'ok');
  fs.writeFileSync(path.join(loc, U.INSTALLING), '');
  assert.equal((await s.respond('workbackup-ui://app/index.html')).status, 503, 'an install going on: nothing is served');
  assert.equal(await s.load(loc, '0.8.1'), 'installing');
  const old = new Date(Date.now() - U.INSTALLING_FOR - 60000);
  fs.utimesSync(path.join(loc, U.INSTALLING), old, old);
  assert.equal(await s.load(loc, '0.8.1'), 'ok', 'a mark older than 30 minutes is left from an interrupted install');
  const empty = temp();
  assert.equal(await s.load(empty, '0.8.0'), 'missing');
  const bad = install({ files: { 'ui/../x.js': { size: 1, sha256: 'a'.repeat(64) }, 'ui/index.html': { size: 1, sha256: 'a'.repeat(64) } } });
  assert.equal(await s.load(bad.loc, '0.8.0'), 'invalid', 'a key that climbs out is a broken list');
  const noIndex = install({ files: { 'ui/app.js': { size: 1, sha256: 'a'.repeat(64) } } });
  assert.equal(await s.load(noIndex.loc, '0.8.0'), 'invalid');
  assert.equal(await s.load('relative', '0.8.0'), 'invalid');
});

test('a file reached through a junction is not served', { skip: process.platform !== 'win32' }, async () => {
  const { loc, ui } = install();
  const s = U.createWorkbackupUi();
  assert.equal(await s.load(loc, '0.8.0'), 'ok');
  assert.equal((await s.respond('workbackup-ui://app/fonts/SUIT-Variable.woff2')).status, 200, 'served from the screen folder itself');
  // 밖의 폴더에 목록과 크기 · 해시가 같은 파일을 두고 정션으로 잇는다: 실제 경로 검사만이 막는다(GPT workbackup-solio-one-be-20261127 GB7)
  const outside = temp();
  fs.writeFileSync(path.join(outside, 'SUIT-Variable.woff2'), 'font');
  fs.rmSync(path.join(ui, 'fonts'), { recursive: true });
  fs.symlinkSync(outside, path.join(ui, 'fonts'), 'junction');
  assert.equal(await s.load(loc, '0.8.0'), 'ok');
  assert.equal((await s.respond('workbackup-ui://app/fonts/SUIT-Variable.woff2')).status, 404);
});

test('placement: exactly {shown, top}; sender check: that view, its main frame, workbackup-ui://app/ only', () => {
  assert.deepEqual(V.doorPlacement({ shown: true, top: 100 }), { shown: true, top: 100 });
  for (const bad of [null, [], { shown: true }, { shown: 'yes', top: 1 }, { shown: true, top: 161 }, { shown: true, top: -1 }, { shown: true, top: NaN }, { shown: true, top: 1, x: 1 }, Object.create({ shown: true, top: 1 })]) assert.equal(V.doorPlacement(bad), null, JSON.stringify(bad));
  const frame = { url: 'workbackup-ui://app/index.html', detached: false };
  const contents = { mainFrame: frame, isDestroyed: () => false };
  assert.equal(V.fromView({ sender: contents, senderFrame: frame }, contents), true);
  assert.equal(V.fromView({ sender: { mainFrame: frame }, senderFrame: frame }, contents), false, 'another webContents');
  assert.equal(V.fromView({ sender: contents, senderFrame: { url: frame.url } }, contents), false, 'a subframe');
  const away = { mainFrame: { url: 'https://example.com/' }, isDestroyed: () => false };
  assert.equal(V.fromView({ sender: away, senderFrame: away.mainFrame }, away), false, 'another address');
  assert.equal(V.fromView({ sender: contents, senderFrame: frame }, null), false, 'no view');
  assert.equal(V.requestAllowed('workbackup-ui://app/app.js'), true);
  for (const bad of ['https://synk.im/', 'workbackup-ui://other/x', 'data:,', 'file:///C:/x']) assert.equal(V.requestAllowed(bad), false, bad);
  assert.deepEqual(V.VIEW_TOPICS, ['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update', 'move', 'settings', 'start']);
});

/* 문(door)의 대역들: 호스트 · 화면 파일 · 뷰 자리 · 세션 · ipcMain */
function rig({ ui = 'ok' } = {}) {
  const log = [], handlers = new Map();
  let hostChange = null, phase = 'idle', version = null;
  const fakeHost = {
    start: exe => { log.push(['start', exe]); phase = 'starting'; hostChange({ phase, version: null, code: null }); },
    call: (m, a) => { log.push(['call', m, a]); return Promise.resolve({ ok: true, value: m }); },
    bye: () => { log.push(['bye']); phase = 'idle'; hostChange({ phase, version: null, code: null }); },
    visible: on => log.push(['visible', on]),
    setWindow: t => log.push(['window', t]),
    state: () => ({ phase, version, code: null }),
  };
  const ready = (v = '0.8.0') => { phase = 'ready'; version = v; hostChange({ phase, version, code: null }); };
  const listeners = {};
  const mainFrame = { url: 'workbackup-ui://app/index.html' };
  const contents = {
    mainFrame, sent: [], destroyed: false, handlers: {},
    setWindowOpenHandler: fn => { contents.openHandler = fn; },
    on: (name, fn) => { (contents.handlers[name] ||= []).push(fn); },
    getURL: () => mainFrame.url, send: (channel, value) => contents.sent.push([channel, value]), isDestroyed: () => contents.destroyed,
    emit: (name, ...args) => { for (const fn of contents.handlers[name] || []) fn(...args); },
  };
  let surfaceAlive = false;
  const surface = { webContents: contents, loadURL: url => { log.push(['load', url]); setTimeout(() => contents.emit('did-finish-load'), 0); return Promise.resolve(); }, isDestroyed: () => !surfaceAlive, destroy: () => { surfaceAlive = false; log.push(['destroy']); }, once: (name, fn) => { listeners[name] = fn; } };
  const viewHost = { createSurface: options => { log.push(['surface', options.webPreferences]); surfaceAlive = true; return surface; }, place: p => log.push(['place', p.visible, p.top]), focusView: () => log.push(['focus']) };
  const fakeUi = { load: async (loc, v) => { log.push(['ui', loc, v]); return ui; }, unload: () => log.push(['unload']), handle: () => null };
  const ses = { protocol: { handle: (scheme) => log.push(['protocol', scheme]) }, webRequest: { onBeforeRequest: fn => { ses.filter = fn; } }, setPermissionRequestHandler: fn => { ses.perm = fn; }, setPermissionCheckHandler: fn => { ses.check = fn; }, on: (n, fn) => { ses.download = fn; } };
  const session = { fromPartition: name => { log.push(['partition', name]); return ses; } };
  const ipcMain = { removeHandler: () => {}, handle: (channel, fn) => handlers.set(channel, fn) };
  const win = { isDestroyed: () => false, getNativeWindowHandle: () => { const b = Buffer.alloc(8); b.writeBigUInt64LE(4242n); return b; } };
  const changes = [];
  const door = V.createWorkbackupDoor({ session, ipcMain, getWindow: () => win, preload: 'P', viewHost, ui: fakeUi, createHost: options => { hostChange = options.onChange; fakeHost.options = options; return fakeHost; }, onChange: s => changes.push(s) });
  return { door, log, handlers, ready, contents, ses, changes, fakeHost, surface };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const LOC = 'C:\\Program Files\\SYNK 업무 백업';

test('door: open starts the host, a ready hello reloads the list and loads the screen, the topic follows; only then is the view shown', async () => {
  const r = rig();
  assert.deepEqual(r.door.open({ account: 'acct-1', location: LOC, topic: 'restore' }), { ok: true, view: true });
  assert.deepEqual(r.log.find(x => x[0] === 'start'), ['start', path.win32.join(LOC, 'WorkBackup.exe')]);
  assert.equal(r.door.state().ready, false);
  r.door.place({ shown: true, top: 104 });
  r.ready('0.8.0');
  await tick(); await tick();
  assert.ok(r.log.some(x => x[0] === 'ui' && x[1] === LOC && x[2] === '0.8.0'), 'the list is read with hello.version');
  assert.deepEqual(r.log.find(x => x[0] === 'window'), ['window', '4242'], 'the Solio window handle goes after hello');
  const prefs = r.log.find(x => x[0] === 'surface')[1];
  assert.deepEqual([prefs.partition, prefs.sandbox, prefs.contextIsolation, prefs.nodeIntegration, prefs.webviewTag, prefs.preload], ['persist:workbackup-ui', true, true, false, false, 'P']);
  assert.deepEqual(r.log.filter(x => x[0] === 'protocol'), [['protocol', 'workbackup-ui']], 'the handler sits on this session only');
  assert.deepEqual(r.log.find(x => x[0] === 'load'), ['load', 'workbackup-ui://app/index.html']);
  await tick();
  assert.deepEqual(r.contents.sent, [['workbackup:open', 'restore']]);
  assert.equal(r.door.state().ready, true);
  assert.deepEqual(r.log.filter(x => x[0] === 'place').at(-1), ['place', true, 104]);
  assert.ok(r.log.some(x => x[0] === 'focus'), 'the screen gets the keyboard once it shows');
  // 새 창 거절 · 쪽 옮기기 막기 · 바깥 요청 막기 · 권한 거절
  assert.deepEqual(r.contents.openHandler({ url: 'https://example.com/' }), { action: 'deny' });
  let prevented = false; r.contents.emit('will-navigate', { preventDefault: () => { prevented = true; } }, 'https://example.com/');
  assert.equal(prevented, true);
  const asked = []; r.ses.filter({ url: 'https://example.com/x' }, a => asked.push(a)); r.ses.filter({ url: 'workbackup-ui://app/app.js' }, a => asked.push(a));
  assert.deepEqual(asked, [{ cancel: true }, { cancel: false }]);
  let granted = null; r.ses.perm(null, 'media', v => { granted = v; });
  assert.equal(granted, false);
  // 같은 방에서 다른 화면을 열면 낱말만 넘긴다(호스트를 다시 띄우지 않는다)
  r.door.open({ account: 'acct-1', location: LOC, topic: 'settings' });
  assert.equal(r.log.filter(x => x[0] === 'start').length, 1);
  assert.deepEqual(r.contents.sent.at(-1), ['workbackup:open', 'settings']);
  assert.equal(r.door.state().topic, 'settings');
});

test('door: closed and opened again on the one-click board ({shown:true, top:0}), the view waits for the path height (Fable workbackup-solio-one-ui-20261127 F2)', async () => {
  const r = rig();
  r.door.open({ account: 'acct-1', location: LOC, topic: 'restore' });
  r.door.place({ shown: true, top: 112 });
  r.ready('0.8.0');
  await tick(); await tick(); await tick();
  assert.deepEqual(r.log.filter(x => x[0] === 'place').at(-1), ['place', true, 112]);
  r.door.close();
  r.door.place({ shown: true, top: 0 });
  const before = r.log.length;
  r.door.open({ account: 'acct-1', location: LOC, topic: 'move' });
  await tick();
  const placed = r.log.slice(before).filter(x => x[0] === 'place');
  assert.ok(placed.length > 0 && placed.every(x => x[1] === false), JSON.stringify(placed));
  assert.ok(!r.log.slice(before).some(x => x[0] === 'focus'), 'no focus into a view that is not shown');
  r.door.place({ shown: true, top: 112 });
  await tick();
  assert.deepEqual(r.log.filter(x => x[0] === 'place').at(-1), ['place', true, 112]);
  assert.ok(r.log.slice(before).some(x => x[0] === 'focus'), 'the focus goes in once it shows');
});

test('door: a host that turns newer or fails to say hello keeps the room screen open, so its line shows (Fable workbackup-solio-one-ui-20261127 F3)', () => {
  for (const [phase, code] of [['newer', null], ['failed', 'HELLO_TIMEOUT']]) {
    const r = rig();
    r.door.open({ account: 'acct-1', location: LOC, topic: 'restore' });
    r.fakeHost.state = () => ({ phase, version: null, code });
    r.fakeHost.options.onChange({ phase, version: null, code });
    assert.deepEqual([r.door.state().open, r.door.state().host, r.door.state().code], [true, phase, code]);
  }
});

test('door: a wrong list version keeps the view hidden; 「다시 열기」 reads the list again', async () => {
  const r = rig({ ui: 'version' });
  r.door.open({ account: 'acct-1', location: LOC, topic: 'start' });
  r.door.place({ shown: true, top: 100 });
  r.ready('0.8.0');
  await tick();
  assert.deepEqual([r.door.state().ui, r.door.state().ready], ['version', false]);
  assert.ok(!r.log.some(x => x[0] === 'load'));
  assert.ok(r.log.filter(x => x[0] === 'place').every(x => x[1] === false));
  const reads = r.log.filter(x => x[0] === 'ui').length;
  r.door.open({ account: 'acct-1', location: LOC, topic: 'start' });
  await tick();
  assert.equal(r.log.filter(x => x[0] === 'ui').length, reads + 1);
});

test('door: only the view\'s own frame reaches the host; close hides the view and goes back to the board', async () => {
  const r = rig();
  r.door.open({ account: 'acct-1', location: LOC, topic: 'move' });
  r.door.place({ shown: true, top: 100 });
  r.ready(); await tick(); await tick();
  const call = r.handlers.get('workbackup:call'), close = r.handlers.get('workbackup:close');
  const good = { sender: r.contents, senderFrame: r.contents.mainFrame };
  assert.deepEqual(await call(good, 'getState', []), { ok: true, value: 'getState' });
  assert.equal((await call({ sender: { mainFrame: {} }, senderFrame: {} }, 'getState', [])).code, 'INVALID_SENDER');
  assert.equal((await call({ sender: r.contents, senderFrame: { url: 'workbackup-ui://app/x' } }, 'getState', [])).code, 'INVALID_SENDER', 'a subframe');
  r.contents.mainFrame.url = 'https://evil.example/';
  assert.equal((await call(good, 'getState', [])).code, 'INVALID_SENDER', 'the page moved off the scheme');
  r.contents.mainFrame.url = 'workbackup-ui://app/index.html';
  assert.equal(r.log.filter(x => x[0] === 'call').length, 1);
  assert.deepEqual(await close(good), { ok: true });
  assert.deepEqual([r.door.state().open, r.door.state().ready], [false, false]);
  assert.deepEqual(r.log.filter(x => x[0] === 'place').at(-1), ['place', false, 100]);
  assert.ok(!r.log.some(x => x[0] === 'bye'), 'going back to the board keeps the host for the idle wait');
  // 원클릭 판에 머무는 동안(자리는 shown) 호스트에는 보이지 않는다고 알린다: 5분 시계가 돈다(카본 A4)
  assert.deepEqual(r.log.filter(x => x[0] === 'visible').at(-1), ['visible', false]);
  r.door.place({ shown: true, top: 0 });
  assert.deepEqual(r.log.filter(x => x[0] === 'visible').at(-1), ['visible', false], 'the board still showing is not the screen showing');
  assert.equal(r.fakeHost.options.shown(), false);
  r.door.open({ account: 'acct-1', location: LOC, topic: 'restore' });
  assert.deepEqual(r.log.filter(x => x[0] === 'visible').at(-1), ['visible', true], 'opening again stops the clock');
});

test('door: another account or a sign-out closes the view and says bye; the host going idle closes the view too', async () => {
  const r = rig();
  r.door.open({ account: 'acct-1', location: LOC, topic: 'restore' });
  r.ready(); await tick(); await tick();
  r.door.accountChanged('acct-1');
  assert.ok(!r.log.some(x => x[0] === 'bye'), 'the same account (a token renewal) keeps it');
  r.door.accountChanged(null);
  assert.ok(r.log.some(x => x[0] === 'bye'));
  assert.ok(r.log.some(x => x[0] === 'destroy'));
  assert.deepEqual([r.door.state().open, r.door.state().host], [false, 'idle']);
  const q = rig();
  q.door.open({ account: 'acct-1', location: LOC, topic: 'restore' });
  q.ready(); await tick(); await tick();
  q.door.open({ account: 'acct-2', location: LOC, topic: 'restore' });
  assert.ok(q.log.some(x => x[0] === 'bye'), 'a different account first ends the earlier host');
  assert.deepEqual(q.door.open({ account: 'acct-2', location: 'relative', topic: 'restore' }), { ok: false, code: 'INVALID' });
  assert.deepEqual(q.door.open({ account: 'acct-2', location: LOC, topic: 'format-c' }), { ok: false, code: 'INVALID' });
});

test('preload: exactly synkBackupHost with call · onState · onOpen · close, no method list; a topic sent early waits for onOpen', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbackup-view-preload.cjs'), 'utf8');
  const exposed = [];
  const on = {};
  const invoked = [];
  const electron = { contextBridge: { exposeInMainWorld: (name, api) => exposed.push([name, api]) }, ipcRenderer: { on: (ch, fn) => { on[ch] = fn; }, invoke: (...a) => { invoked.push(a); return Promise.resolve({ ok: true }); } } };
  new Function('require', 'setTimeout', src)(name => { if (name !== 'electron') throw Error('a sandboxed preload loads electron only'); return electron; }, fn => fn());
  assert.deepEqual(exposed.map(x => x[0]), ['synkBackupHost']);
  const api = exposed[0][1];
  assert.deepEqual(Object.keys(api).sort(), ['call', 'close', 'onOpen', 'onState']);
  assert.ok(Object.isFrozen(api));
  assert.doesNotMatch(src, /getState|restoreRun|methods\.json/, 'no method names in the preload');
  await api.call('getState', ['a']);
  await api.close();
  assert.deepEqual(invoked, [['workbackup:call', 'getState', ['a']], ['workbackup:close']]);
  on['workbackup:open']({}, 'restore');
  const topics = [];
  api.onOpen(t => topics.push(t));
  assert.deepEqual(topics, ['restore'], 'the early topic is given once onOpen is set');
  on['workbackup:open']({}, 'BAD topic!');
  on['workbackup:open']({}, 'move');
  assert.deepEqual(topics, ['restore', 'move']);
  const states = [];
  const off = await api.onState(v => states.push(v));
  on['workbackup:state']({}, { a: 1 });
  off();
  on['workbackup:state']({}, { a: 2 });
  assert.deepEqual(states, [{ a: 1 }]);
});
