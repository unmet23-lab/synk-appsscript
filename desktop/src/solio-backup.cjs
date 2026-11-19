'use strict';
// 솔리오 「백업·복구」(2026-11-20): 업무 백업 엔진의 입구다. 본체 프로세스에서만 돈다.
// 계약: experiences/solo-backup-rust/STAGE1_DESIGN.md 4.13 「솔리오에 잇기」, 꼴과 견본: experiences/solo-backup-rust/contract/solio/.
// 하는 일은 다섯이다.
//   1. 엔진이 있는지 본다. HKLM 제거 등록과 그 설치 폴더의 WorkBackupRun.exe가 둘 다 있어야 있음이다.
//   2. 엔진이 남긴 상태 파일 %APPDATA%\SynkWorkBackup\solio\status.json을 읽기만 한다. 아는 칸만 옮기고 나머지는 버린다.
//   3. 엔진이 없으면 엔진 피드를 직접 HTTPS로 받고, 설치 파일을 받아 쓰기·지우기를 막는 핸들을 쥔 채 크기·SHA-256·자체 서명을
//      확인한다. 그다음 setup 요청을 쓰고, 핸들을 쥔 채로 설치기를 관리자 권한으로 띄운다. 설치기가 끝날 때까지 핸들을 놓지 않는다.
//   4. 엔진이 있는데 이 사용자가 보호를 시작하지 않았으면 setup 요청만 쓰고 엔진 창을 연다.
//   5. 엔진 창은 열기 주소 synk-workbackup:open?topic=<낱말>로만 연다(고정 아홉 낱말).
// 넣지 않는 것: 공간 보고서(space.json)는 후보의 경로가 들어 있어 이 모듈이 읽지 않는다. 화면에 넘기는 값과 오류에는 경로,
// 파일 이름, 계정 주소를 넣지 않는다(4.13 「화면 쪽에 넘길 것」). 시험: desktop/tests/solio-backup.test.cjs.
// 실제 입구는 유호님 계정에만 보인다. 계정 번호 자체는 공개 저장소에 두지 않고 소금 친 SHA-256만 둔다.
// 모두에게 여는 날(2단계 노트북 시험 시작일)에 PREVIEW_ACCOUNTS 대신 열림으로 바꾼다.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const FORMAT = 1;
const STATUS_MAX = 64 * 1024;
const FEED_MAX = 64 * 1024;
const SETUP_MAX = 512 * 1024 * 1024;
const FEED_URL = 'https://synk.im/desktop/releases/workbackup.json';
const FEED_AGE = 10 * 60 * 1000;
const ENGINE_AGE = 15 * 1000;
const CHECKING_AFTER = 2 * 60 * 60 * 1000;
const DOWNLOAD_FOR = 30 * 60 * 1000;
const STATES = Object.freeze(['safe', 'starting', 'attention', 'paused', 'off', 'not-set-up', 'moved', 'restore-only']);
const ATTENTION = Object.freeze(['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update']);
const OPEN_TOPICS = Object.freeze([...ATTENTION, 'move']);
const PROOF_RESULTS = Object.freeze(['passed', 'failed', 'incomplete', 'skipped']);
const STAGES = Object.freeze(['backup', 'check', 'proof', 'restore', 'move', 'setup', 'other']);
const MODES = Object.freeze(['protect', 'move']);
const UNINSTALL_KEY = 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SYNK 업무 백업';
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const HEX64 = /^[a-f0-9]{64}$/;
const REQUEST_NAME = /^[0-9]{13}-[a-z0-9]{8,32}\.json$/;

// 엔진에 박힌 업데이트 공개 열쇠 둘(엔진 src-tauri/tauri.conf.json의 plugins.updater.pubkey · plugins.synkUpdate.recoveryPubkey).
// 시험이 엔진 설정과 같은지 본다.
const ENGINE_KEYS = Object.freeze([
  Object.freeze({ role: 'operating', pub: 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEU0NTBEQzE4NkVENzA2QTkKUldTcEJ0ZHVHTnhRNU1TSjllZTBJZFRyNlZIVE1IR1l2YiswcFdFdEFNSXMvc3luaEJPZVpnb3MK' }),
  Object.freeze({ role: 'recovery', pub: 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDREOUZENUU0RDhGREZCNkEKUldScSsvM1k1TldmVGRhdkk3QWJ2eHhKT3VlbFlJczZhOHN4bFBSUXY5ZmFjb2svQnkwUE9rcmcK' }),
]);

// sha256(PREVIEW_SALT + synk_user_id). 이 PC의 방문자 분석 볼 계정(viewers.json)에 있는 유호님 SYNK 계정이다(11-20).
const PREVIEW_SALT = 'SYNK-SOLIO-BACKUP-PREVIEW-v1:';
const PREVIEW_ACCOUNTS = Object.freeze(['1c9b96c34bc629877b01afa944a64ece23b5cd5d965ec84af4ca46c69d8bc424']);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fault = code => Object.assign(new Error(code), { backupCode: code });
const iso = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function previewAllowed(account, list = PREVIEW_ACCOUNTS) {
  const id = account?.synk_user_id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(id)) return false;
  return list.includes(crypto.createHash('sha256').update(PREVIEW_SALT + id).digest('hex'));
}

function statusPaths(env = process.env) {
  if (!env.APPDATA || !path.isAbsolute(env.APPDATA)) return null;
  const root = path.join(env.APPDATA, 'SynkWorkBackup'), solio = path.join(root, 'solio');
  return { root, solio, status: path.join(solio, 'status.json'), requests: path.join(solio, 'requests') };
}

/* 상태 파일 한 장을 아는 칸만으로 옮긴다. 모르는 칸은 버린다(4.13 「꼴 번호」). 꼴 번호가 크면 newer다 */
function normalizeStatus(value) {
  if (!isObject(value) || !Number.isSafeInteger(value.v) || value.v < 1) return { format: 'invalid' };
  if (value.v > FORMAT) return { format: 'newer' };
  const proof = isObject(value.proof) && iso(value.proof.at) && PROOF_RESULTS.includes(value.proof.result) ? { at: iso(value.proof.at), result: value.proof.result } : null;
  const job = isObject(value.job) && STAGES.includes(value.job.stage)
    ? { stage: value.job.stage, percent: Number.isFinite(value.job.percent) ? Math.max(0, Math.min(100, Math.round(value.job.percent))) : null } : null;
  const attention = Array.isArray(value.attention) ? ATTENTION.filter(word => value.attention.includes(word)) : [];
  return {
    format: 'ok',
    status: {
      engine: typeof value.engine === 'string' && VERSION.test(value.engine) ? value.engine : null,
      state: STATES.includes(value.state) ? value.state : 'unknown',
      lastBackupAt: iso(value.lastBackupAt),
      proof,
      attention,
      job,
      folders: count(value.folders),
      bytes: count(value.bytes),
      writer: value.writer === true,
      nextRunAt: iso(value.nextRunAt),
      writtenAt: iso(value.writtenAt),
    },
  };
}

/* 읽기 전용으로 연다. 없으면 missing, 연결점 · 큰 파일 · 깨진 파일은 invalid다 */
async function readStatus(file, fsImpl = fsp) {
  if (!file) return { format: 'missing' };
  let stat;
  try { stat = await fsImpl.lstat(file); } catch (error) { return { format: error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 'missing' : 'invalid' }; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > STATUS_MAX) return { format: 'invalid' };
  let handle = null;
  try {
    // 담은 폴더(solio, SynkWorkBackup)가 연결점이면 읽지 않는다. 실제 경로가 같은지로 한 번에 본다(GPT 검수 GA5)
    const real = await fsImpl.realpath(file);
    if (path.resolve(real).toLowerCase() !== path.resolve(file).toLowerCase()) return { format: 'invalid' };
    // 확인한 뒤 바뀐 파일을 읽지 않게 연 핸들로 크기를 다시 보고, 상한 하나를 넘겨 읽지 않는다
    handle = await fsImpl.open(file, 'r');
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > STATUS_MAX) return { format: 'invalid' };
    const buffer = Buffer.alloc(STATUS_MAX + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > STATUS_MAX) return { format: 'invalid' };
    return normalizeStatus(JSON.parse(buffer.subarray(0, bytesRead).toString('utf8').replace(/^﻿/, '')));
  } catch { return { format: 'invalid' }; }
  finally { await handle?.close().catch(() => {}); }
}

/* 화면이 그릴 갈래 하나. 순서는 4.13 「엔진이 있는지」 → 「꼴 번호」 → 「솔리오의 판단」이다 */
function decideView({ platform = process.platform, engine, read, now = Date.now() }) {
  if (platform !== 'win32') return 'windows-only';
  const has = read?.format === 'ok' || read?.format === 'newer' || read?.format === 'invalid';
  // 엔진 확인 자체가 실패했으면(PowerShell 오류) 「없음」으로 치지 않는다. 깔린 엔진 위에 다시 받지 않게 한다
  if (engine?.error && !engine?.installed) return 'engine-unknown';
  if (!engine?.installed) return has ? 'engine-removed' : 'no-engine';
  if (read?.format === 'newer') return 'engine-newer';
  // 상태 파일이 있는데 읽지 못하면(깨짐 · 연결점 · 잠깐 잠김) 보호 시작이 아니다. 엔진 창에서 본다
  if (read?.format === 'invalid') return 'status-unreadable';
  if (read?.format !== 'ok') return 'needs-setup';
  const status = read.status;
  if (status.state === 'not-set-up' || status.state === 'restore-only') return 'needs-setup';
  const next = Date.parse(status.nextRunAt || '');
  if (Number.isFinite(next) && now - next > CHECKING_AFTER) return 'checking';
  return 'status';
}

/* ── 엔진 설치 확인: 64비트 HKLM의 제거 등록을 PowerShell로 읽는다. 키 이름은 환경 변수로 넘겨 명령 줄에 한글을 두지 않는다 ── */
const ENGINE_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)',
  "$k=[Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine','Registry64').OpenSubKey($env:SWB_UNINSTALL_KEY)",
  "if($k -eq $null){'{}';exit 0}",
  "@{loc=[string]$k.GetValue('InstallLocation');ver=[string]$k.GetValue('DisplayVersion')}|ConvertTo-Json -Compress",
].join(';');

function runPowerShell(script, { env = {}, timeout = 15000 } = {}) {
  return new Promise(resolve => {
    let child, out = '', done = false;
    const finish = value => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, ...env }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { resolve(null); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(null); }, timeout);
    child.stdout.on('data', chunk => { if (out.length < 65536) out += chunk; });
    child.once('error', () => finish(null));
    child.once('close', code => finish(code === 0 ? out : null));
  });
}

async function readEngine({ run = runPowerShell, fsImpl = fsp } = {}) {
  const out = await run(ENGINE_SCRIPT, { env: { SWB_UNINSTALL_KEY: UNINSTALL_KEY } });
  if (out == null) return { installed: false, version: null, error: true };
  let value;
  try { value = JSON.parse(String(out).trim() || '{}'); } catch { return { installed: false, version: null, error: true }; }
  const loc = typeof value?.loc === 'string' ? value.loc.trim().replace(/^"(.*)"$/, '$1') : '';
  if (!loc || !path.win32.isAbsolute(loc)) return { installed: false, version: null };
  try {
    const stat = await fsImpl.stat(path.win32.join(loc, 'WorkBackupRun.exe'));
    if (!stat.isFile()) return { installed: false, version: null };
  } catch { return { installed: false, version: null }; }
  return { installed: true, version: typeof value.ver === 'string' && VERSION.test(value.ver) ? value.ver : null };
}

/* ── minisign(Tauri 업데이터 서명) ── */
function publicKey(pub) {
  const line = Buffer.from(pub, 'base64').toString('utf8').split('\n').map(l => l.trim()).find(l => l && !l.startsWith('untrusted comment:'));
  const raw = Buffer.from(line || '', 'base64');
  if (raw.length !== 42 || raw.toString('latin1', 0, 2) !== 'Ed') throw Error('not a minisign public key');
  return { id: raw.subarray(2, 10), key: crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.subarray(10).toString('base64url') }, format: 'jwk' }) };
}
/* 서명 글(base64)을 나눈다. 미리 해시하는 「ED」만 받는다(Tauri signer가 만드는 꼴). 아니면 null */
function parseSignature(signature) {
  if (typeof signature !== 'string' || signature.length > 4096 || !/^[A-Za-z0-9+/=]+$/.test(signature)) return null;
  const lines = Buffer.from(signature, 'base64').toString('utf8').split('\n').map(l => l.replace(/\r$/, ''));
  const commentAt = lines.findIndex(l => l.startsWith('trusted comment: '));
  if (commentAt < 2 || !lines[0].startsWith('untrusted comment:')) return null;
  const raw = Buffer.from(lines[1] || '', 'base64'), global = Buffer.from(lines[commentAt + 1] || '', 'base64');
  if (raw.length !== 74 || raw.toString('latin1', 0, 2) !== 'ED' || global.length !== 64) return null;
  const comment = lines[commentAt].slice('trusted comment: '.length);
  const fields = Object.fromEntries(comment.split('\t').map(f => { const i = f.indexOf(':'); return i > 0 ? [f.slice(0, i), f.slice(i + 1)] : [f, '']; }));
  return { keyId: raw.subarray(2, 10), value: raw.subarray(10), comment, fields, global };
}
/* 받은 파일의 BLAKE2b-512와 서명을 견준다. 맞는 열쇠의 역할(operating · recovery)이나 null */
function verifySignature(blake, parsed, keys = ENGINE_KEYS) {
  if (!parsed || !Buffer.isBuffer(blake)) return null;
  for (const entry of keys) {
    let key;
    try { key = publicKey(entry.pub); } catch { continue; }
    if (!key.id.equals(parsed.keyId)) continue;
    try {
      if (crypto.verify(null, blake, key.key, parsed.value) && crypto.verify(null, Buffer.concat([parsed.value, Buffer.from(parsed.comment, 'utf8')]), key.key, parsed.global)) return entry.role;
    } catch {}
  }
  return null;
}

/* ── 엔진 피드: Tauri 업데이터의 정적 JSON에 size · sha256 두 칸을 더한 꼴(설치 세션과 맞춤, 11-20) ── */
const setupName = version => `SynkWorkBackup-${version}-setup.exe`;
function validateFeed(value) {
  if (!isObject(value) || typeof value.version !== 'string' || !VERSION.test(value.version) || !isObject(value.platforms)) throw fault('FEED_INVALID');
  const version = value.version, entry = value.platforms['windows-x86_64-nsis'] || value.platforms['windows-x86_64'];
  if (!isObject(entry)) throw fault('FEED_INVALID');
  const url = `https://github.com/unmet23-lab/synk-policy/releases/download/workbackup-${version}/${setupName(version)}`;
  if (entry.url !== url) throw fault('FEED_INVALID');
  if (!Number.isSafeInteger(entry.size) || entry.size <= 0 || entry.size > SETUP_MAX || typeof entry.sha256 !== 'string' || !HEX64.test(entry.sha256)) throw fault('FEED_INVALID');
  const signature = parseSignature(entry.signature);
  if (!signature || signature.fields.version !== version || signature.fields.file !== setupName(version)) throw fault('FEED_INVALID');
  return { version, url, size: entry.size, sha256: entry.sha256, signature: entry.signature };
}

function requestHttps(url, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { signal, headers: { Accept: 'application/octet-stream, application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'SYNK-Platform-Solio-Backup' } },
      response => resolve({ status: response.statusCode, headers: response.headers, body: response }));
    request.setTimeout(30000, () => request.destroy(fault('NETWORK')));
    request.on('error', reject);
  });
}
const discard = response => { try { response?.body?.destroy?.(); } catch {} };
/* 피드는 넘겨주기를 따라가지 않는다. 설치 파일은 GitHub Releases가 주는 release-assets 한 곳만 따라간다 */
async function responseFor(url, { request, signal, artifact = false }) {
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (signal?.aborted) throw fault('CANCELLED');
    const response = await request(url, { signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers?.location; discard(response);
      if (!artifact || redirects === 3 || typeof location !== 'string') throw fault('UNTRUSTED_REDIRECT');
      let next; try { next = new URL(location, url); } catch { throw fault('UNTRUSTED_REDIRECT'); }
      if (next.protocol !== 'https:' || next.username || next.password || next.port || next.hostname !== 'release-assets.githubusercontent.com' || !next.pathname.startsWith('/github-production-release-asset/')) throw fault('UNTRUSTED_REDIRECT');
      url = next.href; continue;
    }
    if (response.status === 404 && !artifact) { discard(response); throw fault('FEED_MISSING'); }
    if (response.status !== 200) { discard(response); throw fault('NETWORK'); }
    const encoding = response.headers?.['content-encoding'];
    if (encoding && encoding !== 'identity') { discard(response); throw fault('NETWORK'); }
    return response;
  }
  throw fault('UNTRUSTED_REDIRECT');
}
async function fetchFeed({ request = requestHttps, signal } = {}) {
  const response = await responseFor(FEED_URL, { request, signal });
  const pieces = []; let size = 0;
  try { for await (const piece of response.body) { const chunk = Buffer.from(piece); size += chunk.length; if (size > FEED_MAX) throw fault('FEED_INVALID'); pieces.push(chunk); } }
  finally { discard(response); }
  let value; try { value = JSON.parse(Buffer.concat(pieces).toString('utf8')); } catch { throw fault('FEED_INVALID'); }
  return validateFeed(value);
}

/* ── setup 요청 파일: 임시 이름에 쓰고 꼴이 맞는 이름으로 바꿔 넣는다(엔진은 꼴이 맞는 보통 파일만 읽는다) ── */
async function realDirectory(dir, fsImpl) {
  const stat = await fsImpl.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw fault('STORAGE');
}
async function writeSetupRequest({ paths, mode, hint = null, now = Date.now(), random = () => crypto.randomBytes(8).toString('hex'), fsImpl = fsp }) {
  if (!paths || !MODES.includes(mode)) throw fault('INVALID');
  await fsImpl.mkdir(paths.requests, { recursive: true });
  for (const dir of [paths.root, paths.solio, paths.requests]) await realDirectory(dir, fsImpl);
  const body = { v: FORMAT, kind: 'setup', mode };
  // 엔진은 254자 이하 · @ 하나인 주소 꼴만 받는다. 다른 값은 넣지 않는다
  if (typeof hint === 'string' && hint.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) body.hint = hint;
  const name = `${String(Math.trunc(now)).padStart(13, '0')}-${random()}.json`;
  if (!REQUEST_NAME.test(name)) throw fault('INVALID');
  const temp = path.join(paths.requests, `.${random()}.tmp`), file = path.join(paths.requests, name);
  try {
    await fsImpl.writeFile(temp, JSON.stringify(body), { flag: 'wx' });
    await fsImpl.rename(temp, file);
  } catch (error) { await fsImpl.unlink(temp).catch(() => {}); throw error?.backupCode ? error : fault('STORAGE'); }
  return name;
}

/* ── 받은 설치 파일을 쥐고 띄우는 PowerShell 하나. 읽기 공유만 남긴 핸들(CreateFileW의 FILE_SHARE_READ)이라
     다른 프로그램은 그동안 이 파일을 쓰거나 이름을 바꾸거나 지우지 못한다. 읽기는 되므로 본체가 같은 바이트를 확인하고,
     셸도 같은 파일로 설치기를 띄운다. 공유 0이면 셸이 열지 못해 띄울 수 없다(엔진 업데이터와 같은 공유, 4.10) ── */
const HOLDER_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  // 경로에 한글이 있어도 깨지지 않게 UTF-8로 내보낸다(GPT 다시 검수 GA1). 본체도 UTF-8로 읽는다
  '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)',
  "try{$h=[IO.File]::Open($env:SWB_SETUP,'Open','Read','Read')}catch{[Console]::Out.WriteLine('LOCKFAIL');exit 3}",
  // 쥔 핸들이 실제로 가리키는 파일의 경로(GetFinalPathNameByHandleW)를 알린다. 본체가 받은 경로와 같을 때만 확인을 잇는다(GPT 검수 GA1).
  // C# 선언은 따옴표가 들어 있어 명령 줄 대신 환경 변수로 넘긴다
  "try{$t=Add-Type -MemberDefinition $env:SWB_FINAL_SIG -Name SwbFinal -Namespace SynkSolio -PassThru;$b=New-Object System.Text.StringBuilder 1024;$n=$t::GetFinalPathNameByHandleW($h.SafeFileHandle,$b,1024,0)}catch{$n=0}",
  "if($n -eq 0 -or $n -ge 1024){[Console]::Out.WriteLine('LOCKFAIL');$h.Dispose();exit 3}",
  "[Console]::Out.WriteLine('LOCKED '+$b.ToString())",
  '$c=[Console]::In.ReadLine()',
  "if($c -ne 'RUN'){$h.Dispose();exit 0}",
  "try{$p=Start-Process -FilePath $env:SWB_SETUP -ArgumentList '/P','/R' -Verb RunAs -PassThru}catch{[Console]::Out.WriteLine('DECLINED');$h.Dispose();exit 4}",
  "[Console]::Out.WriteLine('STARTED')",
  '$p.WaitForExit()',
  "[Console]::Out.WriteLine('EXIT '+$p.ExitCode)",
  '$h.Dispose()',
].join(';');

const FINAL_SIG = '[DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern uint GetFinalPathNameByHandleW(Microsoft.Win32.SafeHandles.SafeFileHandle h, System.Text.StringBuilder b, uint n, uint f);';
/* \\?\C:\a\b 꼴만 걷고 글자 그대로 견준다. 대소문자를 가리는 폴더에서 다른 폴더가 같다고 나오지 않게 대소문자는 접지 않는다.
   두 쪽 모두 GetFinalPathNameByHandleW(libuv의 realpath도 같다)가 낸 디스크의 글자라 같은 파일이면 글자도 같다(GPT 다시 검수 GA2). 드라이브 글자만 접는다 */
const samePath = (a, b) => {
  const norm = value => path.resolve(String(value || '').replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/, '')).replace(/^[a-z]:/, d => d.toUpperCase());
  return !!a && !!b && norm(a) === norm(b);
};

function holdSetup(file, { spawnImpl = spawn, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    let child, buffer = '', locked = false, settled = false;
    const waiters = [], lines = [];
    const deliver = () => { while (waiters.length && lines.length) waiters.shift()(lines.shift()); };
    const fail = code => { if (!settled) { settled = true; clearTimeout(timer); reject(fault(code)); } };
    try {
      child = spawnImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', HOLDER_SCRIPT], { env: { ...process.env, SWB_SETUP: file, SWB_FINAL_SIG: FINAL_SIG }, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch { reject(fault('LOCK_FAILED')); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch {} fail('LOCK_FAILED'); }, timeout);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at).trim(); buffer = buffer.slice(at + 1);
        if (!locked) {
          if (line.startsWith('LOCKED ')) { holder.finalPath = line.slice(7); locked = true; settled = true; clearTimeout(timer); resolve(holder); }
          else if (line === 'LOCKFAIL') fail('LOCK_FAILED');
          continue;
        }
        lines.push(line); deliver();
      }
    });
    child.once('error', () => { fail('LOCK_FAILED'); lines.push('GONE'); deliver(); });
    child.once('close', () => { fail('LOCK_FAILED'); lines.push('GONE'); deliver(); });
    const next = () => new Promise(ok => { waiters.push(ok); deliver(); });
    const holder = {
      /* 놓으라고 알리고, PowerShell이 끝나 핸들이 닫힐 때까지 기다린다(5초까지) */
      release() {
        try { child.stdin.end('QUIT\n'); } catch {}
        return new Promise(ok => {
          if (child.exitCode !== null || child.signalCode !== null) { ok(); return; }
          const t = setTimeout(ok, 5000);
          child.once('close', () => { clearTimeout(t); ok(); });
        });
      },
      /* 띄우고 끝날 때까지 기다린다. declined · started 뒤 exit, 또는 gone */
      async run(onStarted = () => {}) {
        try { child.stdin.write('RUN\n'); } catch { return { outcome: 'gone' }; }
        const first = await next();
        if (first === 'DECLINED') return { outcome: 'declined' };
        if (first !== 'STARTED') return { outcome: 'gone' };
        try { onStarted(); } catch {}
        const last = await next();
        const match = /^EXIT\s*(-?\d*)$/.exec(last || '');
        return match ? { outcome: 'exited', code: match[1] === '' ? null : Number(match[1]) } : { outcome: 'gone' };
      },
    };
  });
}

/* 쥔 파일을 읽어 크기 · SHA-256 · BLAKE2b-512를 낸다(본체의 읽기는 쥔 핸들의 읽기 공유 안에서 열린다) */
async function digestFile(file, limit, fsImpl = fs) {
  const stat = await fsImpl.promises.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw fault('VERIFY_FAILED');
  const sha = crypto.createHash('sha256'), blake = crypto.createHash('blake2b512');
  let size = 0;
  for await (const chunk of fsImpl.createReadStream(file)) { size += chunk.length; if (size > limit) throw fault('VERIFY_FAILED'); sha.update(chunk); blake.update(chunk); }
  return { size, sha256: sha.digest('hex'), blake: blake.digest() };
}

async function download({ feed, file, request, signal, onProgress }) {
  const response = await responseFor(feed.url, { request, signal, artifact: true });
  const length = Number(response.headers?.['content-length']);
  if (Number.isFinite(length) && length !== feed.size) { discard(response); throw fault('VERIFY_FAILED'); }
  const out = fs.createWriteStream(file, { flags: 'wx' });
  let size = 0, shown = -1;
  try {
    await new Promise((resolve, reject) => {
      out.once('error', reject);
      response.body.once('error', reject);
      response.body.on('data', chunk => {
        size += chunk.length;
        if (size > feed.size) { reject(fault('VERIFY_FAILED')); return; }
        if (!out.write(chunk)) { response.body.pause(); out.once('drain', () => response.body.resume()); }
        const percent = Math.floor(size * 100 / feed.size);
        if (percent !== shown) { shown = percent; onProgress(percent); }
      });
      response.body.once('end', resolve);
    });
  } catch (error) {
    discard(response);
    out.destroy();
    throw error;
  }
  discard(response);
  // 마지막 쓰기의 오류(디스크 가득 참 따위)를 놓치지 않는다(GPT 검수 GA6)
  await new Promise((resolve, reject) => out.end(error => (error ? reject(error) : resolve())));
  if (size !== feed.size) throw fault('VERIFY_FAILED');
}

function createSolioBackup({
  platform = process.platform, env = process.env, cacheRoot, now = Date.now,
  run = runPowerShell, request = requestHttps, hold = holdSetup, openExternal = async () => {},
  fsImpl = fs, keys = ENGINE_KEYS, previewAccounts = PREVIEW_ACCOUNTS, wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const paths = statusPaths(env);
  let engine = null, engineAt = 0, engineLoading = null;
  let feedState = { state: 'unknown', version: null, at: 0 }, feedLoading = null;
  let install = { phase: 'idle', progress: 0, code: null, mode: null };
  let busy = null, mode = null, swept = false;

  const allowed = account => previewAllowed(account, previewAccounts);
  /* 엔진 확인이 실패하면(PowerShell 오류 · 시간 초과) 앞의 답을 그대로 쓴다. 앞의 답이 없으면 error로 둬서 「깔려 있지 않음」과 가른다.
     있다고 확인된 답은 1분 쓴다(방이 보이는 동안 PowerShell을 덜 띄운다) */
  async function engineNow(force = false) {
    if (platform !== 'win32') return { installed: false, version: null };
    if (!force && engine && now() - engineAt < (engine.installed ? ENGINE_AGE * 4 : ENGINE_AGE)) return engine;
    if (!engineLoading) {
      engineLoading = readEngine({ run, fsImpl: fsImpl.promises })
        .then(value => { if (value.error && engine && !engine.error) return engine; engine = value; engineAt = now(); return value; })
        .finally(() => { engineLoading = null; });
    }
    return engineLoading;
  }
  /* 누를 때와 설치기를 띄우기 직전에는 앞의 답을 쓰지 않고 지금 답만 쓴다. 확인이 실패하면 error 그대로 돌려줘 아무것도 띄우지 않게 한다(GPT 다시 검수 GA5) */
  async function engineFresh() {
    if (platform !== 'win32') return { installed: false, version: null };
    const value = await readEngine({ run, fsImpl: fsImpl.promises });
    if (!value.error) { engine = value; engineAt = now(); }
    return value;
  }
  function refreshFeed(force = false) {
    if (feedLoading || (!force && feedState.state !== 'unknown' && now() - feedState.at < FEED_AGE)) return feedLoading;
    feedLoading = fetchFeed({ request })
      .then(feed => { feedState = { state: 'available', version: feed.version, at: now() }; return feed; })
      .catch(error => { feedState = { state: error?.backupCode === 'FEED_MISSING' ? 'missing' : error?.backupCode === 'FEED_INVALID' ? 'invalid' : 'error', version: null, at: now() }; return null; })
      .finally(() => { feedLoading = null; });
    return feedLoading;
  }

  async function state() {
    const [eng, read] = await Promise.all([engineNow(), platform === 'win32' ? readStatus(paths?.status, fsImpl.promises) : Promise.resolve({ format: 'missing' })]);
    return { engine: eng, read, view: decideView({ platform, engine: eng, read, now: now() }) };
  }

  async function snapshot(account) {
    if (!allowed(account)) return { ok: true, available: false };
    const { engine: eng, read, view } = await state();
    if ((view === 'no-engine' || view === 'engine-removed') && install.phase === 'idle') void refreshFeed();
    return {
      ok: true, available: true, view, now: new Date(now()).toISOString(),
      engine: { installed: !!eng?.installed, version: eng?.version || null },
      status: read.format === 'ok' ? read.status : null,
      feed: { state: feedState.state, version: feedState.version },
      install: { ...install },
    };
  }

  function setInstall(phase, extra = {}) { install = { phase, progress: extra.progress ?? 0, code: extra.code ?? null, mode }; }

  /* 받은 폴더를 지운다. 쥔 PowerShell이 핸들을 놓을 때까지 잠깐 걸릴 수 있어 몇 번 다시 해 본다 */
  const removeDir = dir => fsImpl.promises.rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }).catch(() => {});
  /* 앞에서 끊긴 설치(앱이 꺼짐 따위)가 남긴 setup-* 폴더를 처음 받을 때 한 번 치운다 */
  async function sweep() {
    if (swept) return;
    swept = true;
    let names = [];
    try { names = await fsImpl.promises.readdir(cacheRoot); } catch { return; }
    for (const name of names) if (/^setup-[A-Za-z0-9]{6}$/.test(name)) await removeDir(path.join(cacheRoot, name));
  }
  /* 쥔 파일의 실제 경로가 받은 경로와 같아야 한다. 조상에 연결점(정션 · 링크)이 있으면 쥔 뒤에도 그 연결점을 바꿔
     다른 파일을 같은 경로로 보이게 할 수 있다. 쥔 동안 실제 조상 폴더는 바꿀 수 없으므로 이 확인 한 번이면 닫힌다(설계 검토 P1, 11-20) */
  async function sameRealPath(file) {
    let real;
    try { real = await fsImpl.promises.realpath(file); } catch { return false; }
    const norm = value => path.resolve(String(value).replace(/^\\\\\?\\/, '')).toLowerCase();
    return norm(real) === norm(file);
  }
  /* 막 받은 파일을 백신이 잠깐 쥐면 읽기 공유 핸들이 열리지 않는다. 세 번까지 다시 쥐어 본다 */
  async function holdWithRetry(file) {
    for (let i = 0; ; i++) {
      try { return await hold(file); } catch (error) { if (i >= 2 || error?.backupCode !== 'LOCK_FAILED') throw error; await wait(1000); }
    }
  }
  async function engineAppeared() {
    for (let i = 0; i < 6; i++) {
      if ((await engineNow(true)).installed) return true;
      await wait(2000);
    }
    return false;
  }

  async function installEngine(mode, hint) {
    setInstall('feed');
    const feed = await refreshFeed(true);
    if (!feed) throw fault(feedState.state === 'missing' ? 'FEED_MISSING' : feedState.state === 'invalid' ? 'FEED_INVALID' : 'NETWORK');
    if (typeof cacheRoot !== 'string' || !path.isAbsolute(cacheRoot)) throw fault('STORAGE');
    await fsImpl.promises.mkdir(cacheRoot, { recursive: true });
    await sweep();
    // 실제 경로(짧은 이름 · 연결점을 푼 것) 아래에 만든다. 쥔 뒤의 실제 경로 확인이 이 이름과 견준다
    const base = await fsImpl.promises.realpath(cacheRoot);
    const dir = await fsImpl.promises.mkdtemp(path.join(base, 'setup-'));
    const file = path.join(dir, setupName(feed.version));
    let holder = null, requestName = null, keepRequest = false;
    try {
      setInstall('download');
      // 받기 전체에 30분 기한을 둔다. 조금씩 이어지는 느린 응답이 누름을 끝없이 붙잡지 않게 한다(GPT 검수 GA8)
      const signal = AbortSignal.timeout(DOWNLOAD_FOR);
      try { await download({ feed, file, request, signal, onProgress: progress => { install = { ...install, progress }; } }); }
      catch (error) { throw signal.aborted ? fault('NETWORK') : error; }
      setInstall('verify');
      holder = await holdWithRetry(file);
      // 쥔 핸들이 가리키는 실제 파일이 받은 경로의 그 파일이어야 한다. 연결점을 거쳐 다른 파일을 쥐었거나, 쥔 뒤 경로가 다른 곳을
      // 가리키게 바뀌었으면 여기서 멈춘다(설계 검토 P1, GPT 검수 GA1)
      if (!samePath(holder.finalPath, file) || !(await sameRealPath(file))) throw fault('VERIFY_FAILED');
      const digest = await digestFile(file, feed.size, fsImpl);
      if (digest.size !== feed.size || digest.sha256 !== feed.sha256) throw fault('VERIFY_FAILED');
      const parsed = parseSignature(feed.signature);
      if (!verifySignature(digest.blake, parsed, keys)) throw fault('VERIFY_FAILED');
      // 받는 동안 다른 계정으로 바뀌었으면 누른 계정의 주소를 넣지 않는다(GPT 다시 검수 GA3)
      requestName = await writeSetupRequest({ paths, mode, hint: stillCurrent() ? hint : null, now: now(), fsImpl: fsImpl.promises });
      // 받는 동안 다른 길로 엔진이 깔렸으면 설치기를 다시 띄우지 않고 엔진 창을 연다(GPT 검수 GA4).
      // 지금 확인이 실패하면 깔렸는지 모르므로 띄우지 않는다(GPT 다시 검수 GA5)
      const fresh = await engineFresh();
      if (fresh.error) throw fault('ENGINE_UNKNOWN');
      if (fresh.installed) {
        keepRequest = true;
        await holder.release(); holder = null;
        try { await openExternal(`synk-workbackup:open?topic=${mode === 'move' ? 'move' : 'status'}`); } catch { keepRequest = false; throw fault('OPEN_FAILED'); }
        setInstall('opened');
        return;
      }
      setInstall('admin');
      let started = false;
      const ran = await holder.run(() => { started = true; setInstall('install'); });
      holder = null;
      if (ran.outcome === 'declined') throw fault('DECLINED');
      if (!started) throw fault('INSTALL_STOPPED');
      // 설치기가 실패를 알렸으면(종료 코드 0이 아님) 엔진이 남아 있어도 끝난 것으로 보지 않는다(GPT 검수 GA3)
      if (ran.outcome === 'exited' && ran.code !== 0 && ran.code !== null) throw fault('INSTALL_STOPPED');
      // 쥔 PowerShell이 설치 도중 끝났거나 종료 코드를 받지 못했으면, 설치기는 아직 돌 수 있다. 요청은 남기되 끝났다고 하지 않는다.
      // 엔진이 보이면 「끝났는지 확인하지 못함 — 엔진 창에서 이어서」로 둔다(Fable 설계 검토 P2 · GPT 다시 검수 GA4)
      keepRequest = true;
      const confirmed = ran.outcome === 'exited' && ran.code === 0;
      if (!(await engineAppeared())) throw fault(confirmed ? 'INSTALL_STOPPED' : 'INSTALL_UNCONFIRMED');
      if (!confirmed) throw fault('INSTALL_UNCONFIRMED');
      setInstall('done');
    } finally {
      if (holder) await holder.release();
      if (requestName && paths && !keepRequest) await fsImpl.promises.unlink(path.join(paths.requests, requestName)).catch(() => {});
      await removeDir(dir);
    }
  }

  /* 「보호 시작」 · 「이 PC로 옮겨 오기」 · 「다시 깔기」. 엔진이 있으면 setup만 쓰고 엔진 창을 연다.
     누름이 겹치지 않게 첫 await 전에 busy를 세운다(설계 검토 P1, 11-20) */
  let stillCurrent = () => true;
  async function start(account, asked, { getHint = async () => null, isCurrent = () => true } = {}) {
    if (!allowed(account)) return { ok: false, code: 'NOT_AVAILABLE' };
    if (!MODES.includes(asked)) return { ok: false, code: 'INVALID' };
    if (busy) return { ok: false, code: 'BUSY' };
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    busy = gate;
    let view = null, fresh = null;
    // 누를 때는 엔진 확인을 새로 한다. 15초 전의 「없음」으로 깔린 엔진 위에 다시 받지 않게 한다(GPT 검수 GA4).
    // 지금 확인이 실패하면 아무것도 하지 않는다(GPT 다시 검수 GA5)
    try { fresh = await engineFresh(); ({ view } = await state()); } catch { view = null; }
    if (fresh?.error) { busy = null; release(); return { ok: false, code: 'ENGINE_UNKNOWN' }; }
    if (!['no-engine', 'engine-removed', 'needs-setup'].includes(view)) { busy = null; release(); return { ok: false, code: 'NOT_NEEDED' }; }
    mode = asked;
    stillCurrent = () => { try { return isCurrent() === true; } catch { return false; } };
    busy = (async () => {
      let hint = null;
      // 힌트는 누른 계정의 것만 받는다. 그사이 다른 계정으로 바뀌었으면 getHint가 null을 준다(GPT 검수 GA2, main.cjs)
      try { hint = await getHint(account); } catch { hint = null; }
      if (view === 'needs-setup') {
        setInstall('opening');
        let name;
        try { name = await writeSetupRequest({ paths, mode, hint: stillCurrent() ? hint : null, now: now(), fsImpl: fsImpl.promises }); } catch { throw fault('REQUEST_FAILED'); }
        try { await openExternal(`synk-workbackup:open?topic=${mode === 'move' ? 'move' : 'status'}`); }
        catch {
          // 열지 못했으면 요청을 남기지 않는다. 나중에 따로 연 엔진이 실패한 시도의 요청을 읽지 않게 한다(GPT 검수 GA7)
          await fsImpl.promises.unlink(path.join(paths.requests, name)).catch(() => {});
          throw fault('OPEN_FAILED');
        }
        setInstall('opened');
        return;
      }
      await installEngine(mode, hint);
    })().catch(error => { setInstall('error', { code: error?.backupCode || (['ENOSPC', 'EACCES', 'EPERM', 'EROFS', 'EIO'].includes(error?.code) ? 'STORAGE' : 'NETWORK') }); })
      .finally(() => { busy = null; release(); });
    return { ok: true };
  }

  async function open(account, topic) {
    if (!allowed(account)) return { ok: false, code: 'NOT_AVAILABLE' };
    if (!OPEN_TOPICS.includes(topic)) return { ok: false, code: 'INVALID' };
    const eng = await engineNow();
    if (!eng.installed) return { ok: false, code: 'NO_ENGINE' };
    try { await openExternal(`synk-workbackup:open?topic=${topic}`); return { ok: true }; } catch { return { ok: false, code: 'OPEN_FAILED' }; }
  }

  /* 끝난 설치 결과(오류 · 완료)를 지우고 처음 화면으로 */
  function dismiss(account) { if (allowed(account) && !busy) setInstall('idle'); return { ok: true }; }

  return { snapshot, start, open, dismiss, whenIdle: () => busy || Promise.resolve() };
}

module.exports = {
  createSolioBackup, previewAllowed, statusPaths, normalizeStatus, readStatus, decideView, readEngine, parseSignature, verifySignature,
  validateFeed, fetchFeed, writeSetupRequest, holdSetup, digestFile, publicKey,
  FORMAT, FEED_URL, STATES, ATTENTION, OPEN_TOPICS, ENGINE_KEYS, PREVIEW_SALT, PREVIEW_ACCOUNTS, UNINSTALL_KEY, CHECKING_AFTER, HOLDER_SCRIPT, ENGINE_SCRIPT,
};
