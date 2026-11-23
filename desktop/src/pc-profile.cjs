'use strict';
// 솔리오 「내 PC 진단」의 값(설계 docs/디자인/솔리오_PC진단_20261123/설계.md 3절 · 6절 · 8절 둘째 조각).
// 읽기만 하고 이 PC를 바꾸지 않는다. 관리자 권한이 필요한 값은 재지 않는다.
// 둔 곳은 이 PC의 앱 자료 폴더(userData/solio/pc-profile.json)뿐이다. 서버 · 로그 · 오류 보고 · 사무실 직원 지시문으로 보내지 않는다.
// 이름(프로세서 · 그래픽 카드 · 볼륨 · Wi-Fi)과 일련번호, 경로는 읽지도 넘기지도 않는다. 화면으로 가는 것은 수와 종류뿐이다.
// 「이 PC에 이렇게 맞췄습니다」 판은 renderer/pc-fit-model.mjs가 이 값으로 그린다. 시험: desktop/tests/pc-profile.test.cjs
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { candidatePaths } = require('./subscription-common.cjs');
const { pickDrives } = require('./solio-oneclick.cjs');

const FORMAT = 1;
const GB = 1024 ** 3;
/* 앱을 켤 때와 판을 열 때 이보다 오래된 가벼운 값은 다시 읽는다. 그래픽 값(느림)은 하루 한 번이다(설계 6절) */
const LIGHT_AGE = 10 * 60000;
const SLOW_AGE = 24 * 3600000;
const FILE_MAX = 64 * 1024;
/* 엔진이 공간을 훑는 파일 시스템(11-24). 이 밖의 고정 드라이브(Google Drive G:의 FAT32 따위)는 가상 드라이브로 보고 칸으로 세우지 않는다 */
const SCAN_FS = Object.freeze(['NTFS', 'ReFS', 'exFAT']);
const KINDS = Object.freeze({ Fixed: 'fixed', Removable: 'removable', Network: 'network', CDRom: 'cdrom', Ram: 'ram' });
/* Win32_SystemEnclosure.ChassisTypes 가운데 들고 다니는 꼴(노트북 · 태블릿 · 변환형 따위) */
const PORTABLE = Object.freeze([8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32]);

/* 가벼운 값: 드라이브 목록과 종류, 노트북인지, Windows 판, WSL이 있는지, 지금 회선. 1~2초 걸린다.
   드라이브는 글자 · 종류 · 파일 시스템 · 크기 · 남은 공간만, 회선은 종류와 종량제인지만 읽는다(Wi-Fi 이름은 위치 권한을 건드려 읽지 않는다).
   WSL은 배포판 이름 대신 수만 센다 */
const LIGHT_SCRIPT = String.raw`$ErrorActionPreference='SilentlyContinue'
$o=[ordered]@{}
$o.drives=@([System.IO.DriveInfo]::GetDrives() | ForEach-Object {
  $d=$_; $r=[ordered]@{letter=$d.Name.Substring(0,1); type=[string]$d.DriveType; ready=[bool]$d.IsReady}
  if($d.IsReady){ $r.fs=[string]$d.DriveFormat; $r.size=[double]$d.TotalSize; $r.free=[double]$d.AvailableFreeSpace }
  [pscustomobject]$r })
$o.pcType=[int](Get-CimInstance Win32_ComputerSystem -Property PCSystemType).PCSystemType
$o.battery=@(Get-CimInstance Win32_Battery).Count
$o.chassis=@((Get-CimInstance Win32_SystemEnclosure).ChassisTypes | ForEach-Object {[int]$_})
$cv=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$o.build=[int]$cv.CurrentBuildNumber; $o.display=[string]$cv.DisplayVersion
$o.arch=[string](Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment').PROCESSOR_ARCHITECTURE
$o.wsl=@(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss').Count
try {
  [void][Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
  $p=[Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if($p){ $o.net=[ordered]@{wlan=[bool]$p.IsWlanConnectionProfile; wwan=[bool]$p.IsWwanConnectionProfile; cost=[string]$p.GetConnectionCost().NetworkCostType} } else { $o.net=[ordered]@{offline=$true} }
} catch { $o.net=$null }
$o | ConvertTo-Json -Depth 4 -Compress`;
/* 느린 값: 그래픽 장치 수와 그래픽 메모리. 디스플레이 장치 하위 키의 qwMemorySize를, 지금 있는 장치(Win32_VideoController)와 맞는 것만 읽는다.
   장치 이름은 읽지 않는다. 2~3초 걸린다 */
const SLOW_SCRIPT = String.raw`$ErrorActionPreference='SilentlyContinue'
$ids=@(Get-CimInstance Win32_VideoController -Property PNPDeviceID | ForEach-Object { ([string]$_.PNPDeviceID).ToLower() } | Where-Object { $_ })
$mem=@(Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' | Where-Object { $_.PSChildName -match '^\d{4}$' } | ForEach-Object {
  $p=Get-ItemProperty -LiteralPath $_.PSPath; $m=([string]$p.MatchingDeviceId).ToLower()
  if($m -and @($ids | Where-Object { $_.StartsWith($m) }).Count){
    $q=$p.'HardwareInformation.qwMemorySize'; if($null -eq $q){ $q=$p.'HardwareInformation.MemorySize' }
    if($q -is [byte[]]){ if($q.Length -ge 8){$q=[BitConverter]::ToUInt64($q,0)}elseif($q.Length -ge 4){$q=[BitConverter]::ToUInt32($q,0)}else{$q=0} }
    [double]$q } })
[ordered]@{ adapters=$ids.Count; memory=@($mem) } | ConvertTo-Json -Compress`;

/* 도구: 실행 파일이 있는지만 본다(실행해서 판을 묻지 않는다). 로그인은 자격 파일이 있는지만 보고 내용은 읽지 않는다(설계 3절).
   Claude Code · Codex는 구독 방과 사무실이 쓰는 찾기(subscription-common candidatePaths)와 같은 자리를 본다 */
const TOOLS = Object.freeze([
  { key: 'claude', bins: ['claude'], login: ({ env, home }) => path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), '.credentials.json') },
  { key: 'codex', bins: ['codex'], login: ({ env, home }) => path.join(env.CODEX_HOME || path.join(home, '.codex'), 'auth.json') },
  { key: 'gemini', bins: ['gemini'], login: ({ home }) => path.join(home, '.gemini', 'oauth_creds.json') },
  { key: 'vscode', bins: ['code'], apps: ({ env }) => [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'), env.ProgramFiles && path.join(env.ProgramFiles, 'Microsoft VS Code', 'Code.exe')] },
  { key: 'cursor', bins: ['cursor'], apps: ({ env }) => [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'cursor', 'Cursor.exe')] },
  { key: 'node', bins: ['node'] },
  { key: 'python', bins: ['python', 'py'] },
  { key: 'git', bins: ['git'] },
]);
/* Windows가 Python 없이도 두는 「스토어에서 받기」 바로가기는 Python이 있다는 뜻이 아니다 */
const STORE_ALIAS = /[\\/]WindowsApps[\\/]/i;

function runPowerShell(script, { timeout = 20000 } = {}) {
  return new Promise(resolve => {
    let child, out = '', done = false;
    const finish = value => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { resolve(null); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(null); }, timeout);
    child.stdout.on('data', chunk => { if (out.length < 65536) out += chunk; });
    child.once('error', () => finish(null));
    child.once('close', code => finish(code === 0 ? out : null));
  });
}

const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const safe = fn => { try { return fn(); } catch { return null; } };
const count = v => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const bytes = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const round1 = n => Math.round(n * 10) / 10;
const memGb = v => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? round1(Number(v) / GB) : null);
const parse = text => { try { const v = JSON.parse(String(text || '').trim()); return isObject(v) ? v : null; } catch { return null; } };

/* 드라이브를 판에 세울 것과 뺄 것으로 가른다. 이동식 · 네트워크는 수만 센다(칸으로 세우지 않고 「재지 않음」만 쓴다, 설계 3절).
   광학 · 램 드라이브는 세지 않는다. 크기를 읽지 못한 고정 드라이브(BitLocker로 잠긴 따위)는 「읽지 못한 드라이브 n개」다 */
function sortDrives(list) {
  const out = { shown: [], hidden: [], unread: 0, removable: 0, network: 0 };
  const fixed = [];
  for (const d of list) {
    if (d.kind === 'removable') { out.removable += 1; continue; }
    if (d.kind === 'network') { out.network += 1; continue; }
    if (d.kind !== 'fixed') continue;
    if (!d.ready || !d.size) { out.unread += 1; continue; }
    if (!SCAN_FS.includes(d.fs)) { out.hidden.push({ letter: d.letter, why: 'virtual' }); continue; }
    fixed.push({ letter: d.letter, size: d.size, free: d.free, startLineGb: null, daysToStartLine: null });
  }
  const picked = pickDrives(fixed);
  out.shown = picked.shown.map(({ letter, size, free }) => ({ letter, size, free }));
  out.hidden = [...out.hidden, ...picked.hidden].sort((a, b) => a.letter.localeCompare(b.letter));
  return out;
}
/* PowerShell 한 번의 답(LIGHT_SCRIPT)을 화면에 넘길 꼴로 옮긴다. 모르는 값은 null이다 */
function parseLight(text) {
  const v = parse(text);
  if (!v) return null;
  const drives = (Array.isArray(v.drives) ? v.drives : []).filter(d => isObject(d) && typeof d.letter === 'string' && /^[A-Z]$/.test(d.letter)).slice(0, 26)
    .map(d => ({ letter: d.letter, kind: KINDS[d.type] || 'unknown', ready: d.ready === true, fs: typeof d.fs === 'string' ? d.fs.slice(0, 16) : '', size: bytes(d.size) || 0, free: bytes(d.free) || 0 }));
  // PCSystemType 2(휴대형) · 8(태블릿)이 노트북이다. 모를 때만 배터리와 몸체 꼴을 함께 본다 — USB UPS만 꽂은 데스크톱을 노트북으로 잡지 않는다(설계 3절)
  const pcType = count(v.pcType), battery = count(v.battery), chassis = Array.isArray(v.chassis) ? v.chassis.filter(Number.isSafeInteger) : [];
  const laptop = pcType === 2 || pcType === 8 ? true : pcType >= 1 && pcType <= 7 ? false : battery == null ? null : battery > 0 && chassis.some(c => PORTABLE.includes(c));
  const build = count(v.build);
  const display = typeof v.display === 'string' && /^[0-9A-Za-z]{2,8}$/.test(v.display) ? v.display : '';
  const osInfo = build ? { build, version: `Windows ${build >= 22000 ? 11 : 10}${display ? ` ${display}` : ''}`, arm: /^ARM64$/i.test(String(v.arch || '')) } : null;
  const n = isObject(v.net) ? v.net : null;
  const net = !n ? null : n.offline === true ? { kind: 'offline', metered: null }
    : { kind: n.wwan === true ? 'cellular' : n.wlan === true ? 'wifi' : 'wired', metered: n.cost === 'Unrestricted' ? false : n.cost === 'Fixed' || n.cost === 'Variable' ? true : null };
  return { drives: sortDrives(drives), power: { laptop, battery: battery == null ? null : battery > 0 }, os: osInfo, wsl: count(v.wsl) == null ? null : v.wsl > 0, net };
}
/* SLOW_SCRIPT의 답: 그래픽 장치 수와 가장 큰 그래픽 메모리(GB, 반올림). 메모리 값이 없으면 memGb는 null이다 */
function parseSlow(text) {
  const v = parse(text);
  if (!v) return null;
  const mem = (Array.isArray(v.memory) ? v.memory : []).map(bytes).filter(b => b !== null && b > 0);
  return { adapters: count(v.adapters) ?? 0, memGb: mem.length ? Math.round(Math.max(...mem) / GB) : null };
}
/* 도구가 있는지와 로그인 흔적. 경로는 돌려주지 않는다 */
function findTools({ platform, env, home, isFile }) {
  const out = {};
  for (const t of TOOLS) {
    const found = t.bins.some(bin => candidatePaths(bin, { platform, env, home }).some(p => !(t.key === 'python' && STORE_ALIAS.test(p)) && isFile(p)))
      || (t.apps ? t.apps({ env, home }).filter(Boolean).some(isFile) : false);
    out[t.key] = t.login ? { installed: found, signedIn: isFile(t.login({ env, home })) } : found;
  }
  return out;
}
/* 화면 크기(실제 화소)와 배율(%). narrow: 작업 영역이 원클릭 판을 한 단으로 쌓는 폭(orb-face.css 1100px) 이하인가 */
function readDisplay(display) {
  const d = safe(display);
  if (!isObject(d)) return null;
  const w = Number(d.width), h = Number(d.height), s = Number(d.scale), work = Number(d.workWidth);
  if (!(w > 0 && h > 0 && s > 0)) return null;
  return { width: Math.round(w * s), height: Math.round(h * s), scale: Math.round(s * 100), narrow: Number.isFinite(work) && work > 0 ? work <= 1100 : w <= 1100 };
}
/* 다시 진단할 때 알릴 바뀜(설계 6절): 메모리 · 그래픽 메모리. 드라이브가 늘고 빠지는 것은 외장 하드와 가를 수 없어 지금은 알리지 않는다(엔진 연결 값이 들어오면 넣는다) */
const marks = p => ({ memGb: p?.mem?.totalGb != null ? Math.round(p.mem.totalGb) : null, gpuGb: p?.gpu?.memGb ?? null });
function diffMarks(base, now) {
  const out = [];
  if (!base) return out;
  if (base.memGb != null && now.memGb != null && base.memGb !== now.memGb) out.push({ what: 'memory', from: base.memGb, to: now.memGb });
  if (base.gpuGb != null && now.gpuGb != null && base.gpuGb !== now.gpuGb) out.push({ what: 'gpu', from: base.gpuGb, to: now.gpuGb });
  return out;
}
/* 저장 파일을 믿을 수 있는 꼴로만 받는다. 깨졌으면 처음부터 다시 잰다 */
function validStore(v) {
  if (!isObject(v) || v.v !== FORMAT || !isObject(v.profile)) return null;
  const p = v.profile;
  if (!Number.isFinite(Date.parse(p.readAt || ''))) return null;
  return { profile: p, base: isObject(v.base) ? { memGb: count(v.base.memGb), gpuGb: count(v.base.gpuGb) } : null, changed: Array.isArray(v.changed) ? v.changed.filter(c => isObject(c) && ['memory', 'gpu'].includes(c.what) && count(c.from) !== null && count(c.to) !== null).slice(0, 4) : [] };
}

function createPcProfile({
  userData, platform = process.platform, env = process.env, home = os.homedir(), osImpl = os, display = () => null,
  run = runPowerShell, fsImpl = fs, now = Date.now,
} = {}) {
  const file = userData ? path.join(userData, 'solio', 'pc-profile.json') : null;
  const isFile = p => { try { return fsImpl.statSync(p).isFile(); } catch { return false; } };
  let store = null, loaded = false, reading = null, wantFull = false;

  function load() {
    if (loaded) return;
    loaded = true;
    if (!file) return;
    try {
      const stat = fsImpl.statSync(file);
      if (stat.isFile() && stat.size <= FILE_MAX) store = validStore(parse(fsImpl.readFileSync(file, 'utf8')));
    } catch { store = null; }
  }
  async function save() {
    if (!file || !store) return;
    const text = JSON.stringify({ v: FORMAT, ...store });
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      await fsImpl.promises.mkdir(path.dirname(file), { recursive: true });
      await fsImpl.promises.writeFile(tmp, text, 'utf8');
      await fsImpl.promises.rename(tmp, file);
    } catch { try { await fsImpl.promises.rm(tmp, { force: true }); } catch {} }
  }

  async function measure(full) {
    const prev = store?.profile || null;
    const slowDue = full || !prev?.slowAt || now() - Date.parse(prev.slowAt) >= SLOW_AGE || Date.parse(prev.slowAt) > now() + 5 * 60000;
    const win = platform === 'win32';
    const [lightOut, slowOut] = await Promise.all([win ? run(LIGHT_SCRIPT) : null, win && slowDue ? run(SLOW_SCRIPT) : null]);
    const light = win ? parseLight(lightOut) : null, slow = win && slowDue ? parseSlow(slowOut) : null;
    const cpus = safe(() => osImpl.cpus()) || [];
    const parallel = Number(safe(() => osImpl.availableParallelism?.()));
    const cores = cpus.length || (Number.isInteger(parallel) && parallel > 0 ? parallel : null);
    const failed = [win && !light ? 'system' : '', win && slowDue && !slow ? 'gpu' : ''].filter(Boolean);
    const at = new Date(now()).toISOString();
    const profile = {
      readAt: at,
      slowAt: slow ? at : prev?.slowAt || null,
      cpu: { cores },
      mem: { totalGb: memGb(safe(() => osImpl.totalmem())), freeGb: memGb(safe(() => osImpl.freemem())) },
      // 그래픽은 하루 한 번만 다시 읽는다. 사이의 가벼운 읽기는 앞 값을 그대로 쓴다
      gpu: slow || (slowDue ? null : prev?.gpu || null),
      drives: light?.drives || null,
      power: light?.power || null,
      net: light?.net || null,
      os: light?.os || null,
      screen: readDisplay(display),
      tools: { ...findTools({ platform, env, home, isFile }), wsl: light ? light.wsl : null },
      failed,
    };
    const mark = { ...marks(profile), gpuGb: slow ? marks(profile).gpuGb : null };
    // 처음 잰 값이 기준이다. 기준과 다르면 판을 열어 볼 때까지 「이 PC가 바뀌었습니다」를 둔다. 그래픽을 이번에 읽지 않았으면 그래픽은 견주지 않는다.
    // 기준에 아직 없는 값(처음에 그래픽을 못 읽은 따위)은 처음 읽은 값으로 채운다
    const old = store?.base || {};
    const base = { memGb: old.memGb ?? mark.memGb, gpuGb: old.gpuGb ?? mark.gpuGb };
    const changed = diffMarks(old, mark);
    const merged = [...(store?.changed || []).filter(c => !changed.some(x => x.what === c.what)), ...changed];
    store = { profile, base, changed: merged };
    await save();
    return profile;
  }
  /* 가벼운 값은 maxAge보다 오래됐을 때만, full이면 그래픽까지 모두 다시 읽는다. 한 번에 하나만 읽고, 읽는 중에 full을 부르면 끝난 뒤 한 번 더 읽는다 */
  function refresh({ full = false, maxAge = LIGHT_AGE } = {}) {
    load();
    if (reading) { if (full) wantFull = true; return reading.then(() => snapshot()); }
    const at = Date.parse(store?.profile?.readAt || '');
    if (!full && Number.isFinite(at) && now() - at < maxAge && at <= now() + 5 * 60000) return Promise.resolve(snapshot());
    reading = (async () => {
      let f = full;
      for (;;) { wantFull = false; try { await measure(f); } catch { /* 못 읽은 값은 null로 둔다 */ } if (!wantFull) break; f = true; }
    })().finally(() => { reading = null; });
    return reading.then(() => snapshot());
  }
  function snapshot() {
    load();
    return { ok: true, available: platform === 'win32', reading: !!reading, profile: store?.profile || null, changed: store?.changed ? store.changed.map(c => ({ ...c })) : [] };
  }
  /* 판을 열어 바뀜을 보였으면 지금 값을 새 기준으로 삼는다 */
  async function seen() {
    load();
    if (store?.profile) { store = { ...store, base: marks(store.profile), changed: [] }; await save(); }
    return { ok: true };
  }
  /* 원클릭 판이 엔진 보고서를 아직 받지 못했을 때 쓰는 드라이브(설계 5.1). 정한 선과 예측은 없다 */
  function spaceDrives() {
    load();
    const d = store?.profile?.drives;
    if (!d || !Array.isArray(d.shown) || !d.shown.length) return null;
    return { readAt: store.profile.readAt, drives: d.shown.map(x => ({ ...x, growthPerDay: null, startLineGb: null, daysToStartLine: null })), hiddenDrives: d.hidden.map(x => ({ ...x })) };
  }
  return { refresh, snapshot, seen, spaceDrives };
}

module.exports = { createPcProfile, parseLight, parseSlow, sortDrives, findTools, readDisplay, diffMarks, LIGHT_SCRIPT, SLOW_SCRIPT, LIGHT_AGE, SLOW_AGE, FORMAT };
