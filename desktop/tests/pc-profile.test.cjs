'use strict';
// 솔리오 「내 PC 진단」의 값(src/pc-profile.cjs, 설계 docs/디자인/솔리오_PC진단_20261123/설계.md 3절 · 6절).
// 실제 PC 값은 쓰지 않는다. PowerShell 답과 os 값은 꾸민 견본이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('../src/pc-profile.cjs');

const GB = 1024 ** 3;
const drive = (letter, type, fs, sizeGb, freeGb, ready = true) => ({ letter, type, ready, ...(ready ? { fs, size: sizeGb * GB, free: freeGb * GB } : {}) });
const light = (o = {}) => JSON.stringify({ drives: [drive('C', 'Fixed', 'NTFS', 953, 118), drive('D', 'Fixed', 'NTFS', 1907, 299)], pcType: 2, battery: 1, chassis: [10], build: 26100, display: '24H2', arch: 'AMD64', wsl: 0, net: { wlan: true, wwan: false, cost: 'Unrestricted' }, ...o });
const slow = (o = {}) => JSON.stringify({ adapters: 2, memory: [2 * GB, 8 * GB], ...o });
const fakeOs = (cores = 16, memGb = 31.7, freeGb = 12.3) => ({ cpus: () => Array.from({ length: cores }, () => ({ times: {} })), totalmem: () => memGb * GB, freemem: () => freeGb * GB });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pc-profile-'));
function service({ lightOut = light(), slowOut = slow(), cores, memGb, platform = 'win32', userData = tmp(), clock = { t: Date.parse('2026-11-24T01:00:00Z') }, display, env = {}, home = 'C:\\Users\\nobody', files = new Set() } = {}) {
  const calls = [];
  const run = async script => { calls.push(script === P.LIGHT_SCRIPT ? 'light' : script === P.SLOW_SCRIPT ? 'slow' : 'other'); return script === P.LIGHT_SCRIPT ? (typeof lightOut === 'function' ? lightOut() : lightOut) : (typeof slowOut === 'function' ? slowOut() : slowOut); };
  const fsImpl = { ...fs, statSync: p => (files.has(p) ? { isFile: () => true } : fs.statSync(p)) };
  const s = P.createPcProfile({ userData, platform, run, osImpl: fakeOs(cores, memGb), now: () => clock.t, display: display || (() => ({ width: 1707, height: 1067, scale: 1.5, workWidth: 1707 })), env, home, fsImpl });
  return { s, calls, clock, userData };
}

test('the light answer becomes kinds and numbers only: drives sorted into shown and hidden, laptop, Windows version, line kind', () => {
  const v = P.parseLight(light({ drives: [drive('C', 'Fixed', 'NTFS', 953, 118), drive('D', 'Fixed', 'NTFS', 1907, 299), drive('G', 'Fixed', 'FAT32', 953, 118), drive('E', 'Fixed', 'NTFS', 20, 2), drive('F', 'Removable', 'FAT32', 64, 30), drive('Z', 'Network', 'NTFS', 4000, 900), drive('H', 'Fixed', '', 0, 0, false), drive('X', 'CDRom', 'UDF', 4, 0)] }));
  assert.deepEqual(v.drives.shown.map(d => d.letter), ['C', 'D']);
  assert.deepEqual(v.drives.hidden, [{ letter: 'E', why: 'small' }, { letter: 'G', why: 'virtual' }], 'a FAT32 fixed drive (Google Drive) is virtual, a 20GB recovery partition is small');
  assert.deepEqual([v.drives.unread, v.drives.removable, v.drives.network], [1, 1, 1], 'a locked drive is unread; USB and network are counted, not shown; the CD drive is not counted');
  assert.deepEqual(v.power, { laptop: true, battery: true });
  assert.deepEqual(v.os, { build: 26100, version: 'Windows 11 24H2', arm: false });
  assert.deepEqual(v.net, { kind: 'wifi', metered: false });
  assert.equal(v.wsl, false);
  // 볼륨 이름 · 일련번호 · 경로는 꼴에 없다
  assert.deepEqual(Object.keys(v.drives.shown[0]).sort(), ['free', 'letter', 'size']);
});

test('a desktop with only a USB UPS is not a laptop; unknown PC type falls back to battery and body shape', () => {
  assert.equal(P.parseLight(light({ pcType: 1, battery: 1, chassis: [3] })).power.laptop, false, 'PCSystemType 1 is a desktop even with a UPS battery');
  assert.equal(P.parseLight(light({ pcType: 0, battery: 1, chassis: [3] })).power.laptop, false, 'unknown type, a battery, but a desktop body');
  assert.equal(P.parseLight(light({ pcType: 0, battery: 1, chassis: [9] })).power.laptop, true, 'unknown type, a battery and a laptop body');
  assert.equal(P.parseLight(light({ pcType: 8 })).power.laptop, true, 'a slate is carried');
  assert.equal(P.parseLight(light({ build: 19045, display: '22H2', arch: 'ARM64' })).os.version, 'Windows 10 22H2');
  assert.equal(P.parseLight(light({ arch: 'ARM64' })).os.arm, true);
  assert.deepEqual(P.parseLight(light({ net: { wlan: false, wwan: true, cost: 'Variable' } })).net, { kind: 'cellular', metered: true });
  assert.deepEqual(P.parseLight(light({ net: { offline: true } })).net, { kind: 'offline', metered: null });
  assert.equal(P.parseLight('not json'), null);
  assert.equal(P.parseLight(''), null);
});

test('only small drives on a PC: the small one is still shown (eMMC tablet)', () => {
  const v = P.parseLight(light({ drives: [drive('C', 'Fixed', 'NTFS', 29, 3)] }));
  assert.deepEqual([v.drives.shown.map(d => d.letter), v.drives.hidden], [['C'], []]);
});

test('the slow answer keeps the largest graphics memory in GB and the adapter count; no names', () => {
  assert.deepEqual(P.parseSlow(slow()), { adapters: 2, memGb: 8 });
  assert.deepEqual(P.parseSlow(slow({ adapters: 1, memory: [] })), { adapters: 1, memGb: null });
  assert.equal(P.parseSlow('{'), null);
});

test('tools are found where the subscriptions look, the login is only a file that exists, and the Store python stub is not python', () => {
  const home = 'C:\\Users\\nobody', env = { PATH: 'C:\\Tools;C:\\Users\\nobody\\AppData\\Local\\Microsoft\\WindowsApps', LOCALAPPDATA: 'C:\\Users\\nobody\\AppData\\Local' };
  const files = new Set([path.join('C:\\Tools', 'claude.exe'), path.join(home, '.claude', '.credentials.json'), path.join('C:\\Tools', 'git.exe'), path.join(env.PATH.split(';')[1], 'python.exe')]);
  const t = P.findTools({ platform: 'win32', env, home, isFile: p => files.has(p) });
  assert.deepEqual(t.claude, { installed: true, signedIn: true });
  assert.deepEqual(t.codex, { installed: false, signedIn: false });
  assert.equal(t.git, true);
  assert.equal(t.python, false, 'WindowsApps\\python.exe is the store shortcut');
  assert.equal(t.vscode, false);
});

test('a read stores the profile in the app data folder only, and a second read inside ten minutes reuses it', async () => {
  const { s, calls, clock, userData } = service({ files: new Set() });
  const first = await s.refresh();
  assert.equal(first.ok, true);
  assert.deepEqual(calls, ['light', 'slow'], 'the first read takes the slow values too');
  const p = first.profile;
  assert.deepEqual([p.cpu.cores, p.mem.totalGb, p.gpu.memGb, p.screen], [16, 31.7, 8, { width: 2561, height: 1601, scale: 150, narrow: false }]);
  const stored = JSON.parse(fs.readFileSync(path.join(userData, 'solio', 'pc-profile.json'), 'utf8'));
  assert.equal(stored.v, 1);
  assert.deepEqual(stored.profile.drives.shown.map(d => d.letter), ['C', 'D']);
  clock.t += 5 * 60000;
  await s.refresh();
  assert.deepEqual(calls, ['light', 'slow'], 'five minutes later nothing is read again');
  clock.t += 6 * 60000;
  await s.refresh();
  assert.deepEqual(calls, ['light', 'slow', 'light'], 'after ten minutes only the light values are read; graphics wait a day');
  assert.equal(s.snapshot().profile.gpu.memGb, 8, 'the light read keeps the earlier graphics value');
  clock.t += 24 * 3600000;
  await s.refresh();
  assert.deepEqual(calls.slice(-2), ['light', 'slow'], 'a day later graphics are read again');
  await s.refresh({ full: true });
  assert.deepEqual(calls.slice(-2), ['light', 'slow'], 'again reads everything');
  // 다른 서비스가 같은 폴더를 읽으면 저장한 값으로 시작한다
  const again = P.createPcProfile({ userData, platform: 'win32', run: async () => null, osImpl: fakeOs(), now: () => clock.t });
  assert.deepEqual(again.snapshot().profile.drives.shown.map(d => d.letter), ['C', 'D']);
});

test('a blocked PowerShell leaves the system values null and says which part failed; cores, memory and screen still come from the app', async () => {
  const { s } = service({ lightOut: null, slowOut: null });
  const p = (await s.refresh()).profile;
  assert.deepEqual([p.drives, p.power, p.net, p.os, p.gpu], [null, null, null, null, null]);
  assert.deepEqual(p.failed, ['system', 'gpu']);
  assert.equal(p.cpu.cores, 16);
  assert.ok(p.screen);
  assert.equal(s.spaceDrives(), null, 'no drives to lend the oneclick board');
});

test('memory or graphics that changed since the last look is kept until the board is seen', async () => {
  let mem = 15.7;
  const clock = { t: Date.parse('2026-11-24T01:00:00Z') }, userData = tmp();
  let gpu = 8;
  const make = () => P.createPcProfile({ userData, platform: 'win32', run: async sc => (sc === P.LIGHT_SCRIPT ? light() : slow({ memory: [gpu * GB] })), osImpl: { cpus: () => [{}, {}, {}, {}], totalmem: () => mem * GB, freemem: () => GB }, now: () => clock.t });
  let s = make();
  await s.refresh();
  assert.deepEqual(s.snapshot().changed, [], 'the first read is the base');
  mem = 31.7; gpu = 12;
  s = make();
  await s.refresh({ full: true });
  assert.deepEqual(s.snapshot().changed, [{ what: 'memory', from: 16, to: 32 }, { what: 'gpu', from: 8, to: 12 }]);
  clock.t += 11 * 60000;
  await s.refresh();
  assert.equal(s.snapshot().changed.length, 2, 'a later light read does not forget the change');
  await s.seen();
  assert.deepEqual(s.snapshot().changed, [], 'seen makes the new values the base');
  s = make();
  clock.t += 11 * 60000;
  await s.refresh();
  assert.deepEqual(s.snapshot().changed, []);
});

test('a full read asked while a light read runs is done right after it', async () => {
  let release, n = 0;
  const gate = new Promise(r => { release = r; });
  const calls = [];
  const s = P.createPcProfile({ userData: tmp(), platform: 'win32', osImpl: fakeOs(), now: () => Date.now(), run: async sc => { calls.push(sc === P.LIGHT_SCRIPT ? 'light' : 'slow'); if (n++ === 0) await gate; return sc === P.LIGHT_SCRIPT ? light() : slow(); } });
  const a = s.refresh();
  await new Promise(r => setImmediate(r));
  assert.equal(s.snapshot().reading, true);
  const b = s.refresh({ full: true });
  release();
  await Promise.all([a, b]);
  assert.deepEqual(calls, ['light', 'slow', 'light', 'slow'], 'the waiting full read runs once after the first');
});

test('the oneclick board borrows only shown drives with no line, and hidden drives with their reason', async () => {
  const { s } = service({ lightOut: light({ drives: [drive('C', 'Fixed', 'NTFS', 953, 118), drive('G', 'Fixed', 'FAT32', 953, 118)] }) });
  await s.refresh();
  assert.deepEqual(s.spaceDrives().drives, [{ letter: 'C', size: 953 * GB, free: 118 * GB, growthPerDay: null, startLineGb: null, daysToStartLine: null }]);
  assert.deepEqual(s.spaceDrives().hiddenDrives, [{ letter: 'G', why: 'virtual' }]);
});

test('not Windows: nothing is run and the answer says the board is not available', async () => {
  const { s, calls } = service({ platform: 'darwin' });
  const snap = await s.refresh();
  assert.deepEqual([snap.available, calls], [false, []]);
});

test('a broken or oversized stored file is ignored', () => {
  const userData = tmp();
  fs.mkdirSync(path.join(userData, 'solio'), { recursive: true });
  fs.writeFileSync(path.join(userData, 'solio', 'pc-profile.json'), '{"v":1,"profile":{"readAt":"nope"}}');
  assert.equal(P.createPcProfile({ userData, platform: 'win32', run: async () => null }).snapshot().profile, null);
  fs.writeFileSync(path.join(userData, 'solio', 'pc-profile.json'), 'x'.repeat(70 * 1024));
  assert.equal(P.createPcProfile({ userData, platform: 'win32', run: async () => null }).snapshot().profile, null);
});

test('main wires the service for the platform client only, and the four calls take no arguments', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.cjs'), 'utf8');
  assert.match(main, /function pcProfile\(\)\{if\(runtime\.clientId!=='platform'\|\|smoke\)return null;/);
  for (const ch of ['synk:pc-profile', 'synk:pc-profile-again', 'synk:pc-profile-seen', 'synk:pc-open-storage']) assert.match(main, new RegExp(`'${ch}':\\(\\)=>pcProfileCall`), ch);
  assert.match(main, /shell\.openExternal\('ms-settings:savelocations'\)/, 'only the Windows save-locations page is opened');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.cjs'), 'utf8');
  assert.match(preload, /pcProfile:Object\.freeze\(\{\s*snapshot:\(\)=>ipcRenderer\.invoke\('synk:pc-profile'\),\s*again:\(\)=>ipcRenderer\.invoke\('synk:pc-profile-again'\),\s*seen:\(\)=>ipcRenderer\.invoke\('synk:pc-profile-seen'\),\s*openStorage:\(\)=>ipcRenderer\.invoke\('synk:pc-open-storage'\),\s*\}\)/);
  // 진단 값은 오류 보고 · 문제 알리기 정보에 싣지 않는다
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'pc-profile.cjs'), 'utf8');
  assert.doesNotMatch(src, /console\.|telemetry|report\(/);
  // 스크립트는 이름 · 볼륨 이름 · 일련번호 · Wi-Fi 이름을 읽지 않는다. 드라이브 Name은 글자 하나만 쓴다
  const scripts = P.LIGHT_SCRIPT + P.SLOW_SCRIPT;
  assert.doesNotMatch(scripts, /VolumeLabel|SerialNumber|MachineGuid|Caption|DriverDesc|ProfileName|SSID|\.Description|Win32_Processor|\.Name\b(?!\.Substring\(0,1\))/, 'no names, labels or serial numbers are read');
});
