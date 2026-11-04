#!/usr/bin/env node
'use strict';
/* 버려진 화면 스크립트 — 3시간 넘게 CPU를 쓰는 Playwright 헤드리스 브라우저의 트리를 끈다 (2026-11-04 유호님 승인 「감시 넣어」).
 *
 *   node tools/버려진화면스크립트.js                 미리 보기 — 3시간 넘은 브라우저만 보인다(재지 않고 끄지 않는다)
 *   node tools/버려진화면스크립트.js --실행           그런 브라우저가 있을 때만 10분 재고, 조건이 다 맞는 트리만 끈다(예약 작업이 30분마다)
 *   node tools/버려진화면스크립트.js 기록             끄거나 남긴 기록 끝 20줄
 *   node tools/버려진화면스크립트.js 설치 [--실행]    운영 사본을 가리키는 예약 작업을 보인다 · 건다
 *   공통: --json. 시험용: --대상 <pid,…> --문턱분 <분> --창초 <초> --코어 <개> (기준을 바꾼 실행은 --대상과 함께만)
 *
 * 왜 있나: 11-04 앱화면 스크립트 셋이 실패 뒤 안 끝나 10~13시간 코어 약 6개를 잡아 조건부 시험을 밀었다(현장노트 시험_화면확인).
 *   앱화면 · lab-proof 꼴은 tools/lib/화면시험.cjs로 막았지만, 다른 이름의 스크립트와 세션 임시 스크립트는 그 문으로 못 덮는다. 이것은 마지막 안전망이다.
 * 대상(모두 맞을 때): Playwright가 임시 프로필로 띄운 헤드리스 브라우저(chrome-headless-shell · chrome · msedge) · 3시간 넘게 돎 ·
 *   그 트리가 최근 10분 평균 코어 0.5개 이상 · 조건부 시험 일꾼 아래가 아님. 그 브라우저를 띄운 node 트리를 끈다.
 *   그 node 아래에 아직 3시간 안 된 브라우저 · 다른 브라우저 · 조건부 시험이 있으면 일하는 중으로 보고 오래된 브라우저 트리만 끈다.
 * 안 닿는 것: 유호님 크롬 · ego · Aside · WebView2 · Remotion 렌더(puppeteer_dev_chrome_profile) — 임시 프로필 이름이 다르다.
 *   일부러 3시간 넘게 돌릴 Playwright 일은 launchPersistentContext(자기 프로필)로 띄우면 대상이 아니다.
 * 그 트리만: Windows는 프로세스 번호를 다시 쓴다. 그래서 부모 · 자식은 시작 시각까지 맞을 때만 잇고, 끌 때는 핸들을 쥔 뒤 시작 시각이 같은 프로세스만 끈다.
 *   taskkill은 번호만 받고 /T는 부모 번호만 보므로(옛 부모의 번호를 물려받은 남의 프로세스까지 끈다) 쓰지 않는다.
 * 끄기는 작업 스케줄러 「사용 안 함」(관문·자동화 한 장). */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 인자게이트 } = require('./lib/인자게이트.js');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 뿌리폴더 = path.resolve(__dirname, '..');
const 예약이름 = 'SYNK 버려진 화면 스크립트';
const 기본 = Object.freeze({ 문턱분: 180, 창초: 600, 코어: 0.5 });
const 브라우저이름 = new Set(['chrome-headless-shell.exe', 'chrome.exe', 'msedge.exe']);
const 임시프로필 = 'playwright_chromiumdev_profile-';
const 보호글 = /conditional-qa/i;
const 명령보임 = 300;

const 파워셸글 = `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,CreationDate,CommandLine,KernelModeTime,UserModeTime | ForEach-Object {
  $s = if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { $null }
  [pscustomobject]@{ p = [int]$_.ProcessId; q = [int]$_.ParentProcessId; n = [string]$_.Name; s = $s; c = [string]$_.CommandLine; k = [double]$_.KernelModeTime; u = [double]$_.UserModeTime }
} | ConvertTo-Json -Compress -Depth 2`;

const 파워셸 = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const 인코딩 = (글) => Buffer.from(글, 'utf16le').toString('base64');

/** Win32_Process 줄들 → pid로 찾는 표. 시작 시각을 못 읽은 프로세스는 잇지도 끄지도 않는다. */
function 표만들기(줄들) {
  const 표 = new Map();
  for (const x of [].concat(줄들)) {
    const 시작 = Date.parse(x.s);
    if (Number.isNaN(시작)) continue;
    표.set(x.p, { pid: x.p, ppid: x.q, 이름: x.n, 시작, 명령: x.c || '', cpu: ((x.k || 0) + (x.u || 0)) / 1e7 });
  }
  return 표;
}

function 프로세스읽기() {
  if (process.platform !== 'win32') throw new Error('이 도구는 Windows 전용이다');
  const r = spawnSync(파워셸(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', 인코딩(파워셸글)], { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 1 << 28 });
  if (r.error || r.status !== 0) throw new Error(`프로세스 목록을 못 읽었다: ${r.error?.message || String(r.stderr).trim().slice(0, 300)}`);
  return 표만들기(JSON.parse(r.stdout));
}

const 이름소문자 = (p) => p.이름.toLowerCase();

/** Playwright가 임시 프로필로 띄운 헤드리스 브라우저의 메인인가. 렌더러 등 자식은 --type=가 붙어 빠진다. */
function 브라우저메인인가(p) {
  if (!브라우저이름.has(이름소문자(p))) return false;
  if (p.명령.includes('--type=') || !p.명령.includes(임시프로필)) return false;
  return 이름소문자(p) === 'chrome-headless-shell.exe' || /(^|\s)--headless(=|\s|$)/.test(p.명령);
}

/** 부모 번호가 가리키는 프로세스가 자식보다 먼저 떴을 때만 진짜 부모다 — 죽은 부모의 번호를 다른 프로세스가 물려받았을 수 있다. */
function 진짜부모(p, 표) {
  const q = 표.get(p.ppid);
  return q && q.pid !== p.pid && q.시작 <= p.시작 ? q : null;
}

function 후손들(뿌리, 표) {
  const 자식표 = new Map();
  for (const p of 표.values()) {
    const q = 진짜부모(p, 표);
    if (!q) continue;
    if (!자식표.has(q.pid)) 자식표.set(q.pid, []);
    자식표.get(q.pid).push(p);
  }
  const 나온것 = [], 본 = new Set([뿌리.pid]), 차례 = [뿌리.pid];
  while (차례.length) {
    for (const p of 자식표.get(차례.pop()) || []) {
      if (본.has(p.pid)) continue;
      본.add(p.pid);
      나온것.push(p);
      차례.push(p.pid);
    }
  }
  return 나온것;
}

/** 조건부 시험 일꾼 아래(또는 그 전용 임시 폴더의 프로필)면 건드리지 않는다. */
function 보호됨(p, 표) {
  const 본 = new Set();
  for (let 지금 = p; 지금 && !본.has(지금.pid); 지금 = 진짜부모(지금, 표)) {
    if (보호글.test(지금.명령)) return true;
    본.add(지금.pid);
  }
  return false;
}

/** 브라우저 안의 보조 프로세스가 아닌, 따로 띄운 브라우저인가. Edge는 뜬 지 30초쯤 뒤 메인 아래에 명령 줄을 못 읽는 msedge.exe를 띄운다(11-04 실측). */
function 꼭대기브라우저인가(p, 표) {
  if (!브라우저이름.has(이름소문자(p)) || p.명령.includes('--type=')) return false;
  const q = 진짜부모(p, 표);
  return !(q && 브라우저이름.has(이름소문자(q)));
}

/** 주인 node까지 꺼도 되는가 — 그 아래 어디에도 조건부 시험이나 대상이 아닌 브라우저(3시간 안 된 것 · 다른 프로필)가 없을 때만. */
function 넓혀도되나(주인, 표, 오래됨) {
  if (이름소문자(주인) !== 'node.exe') return false;
  const 나무 = [주인, ...후손들(주인, 표)];
  if (나무.some((p) => 보호글.test(p.명령))) return false;
  return 나무.filter((p) => 꼭대기브라우저인가(p, 표)).every((m) => 오래됨.has(m.pid));
}

/** 3시간 넘은 브라우저를 끌 뿌리별로 묶는다. 주인 node까지 꺼도 될 때만 node까지, 아니면 그 브라우저 트리만. */
function 후보찾기(표, 지금, { 문턱분 = 기본.문턱분, 대상 = null } = {}) {
  const 메인들 = [...표.values()].filter((p) => 브라우저메인인가(p) && 꼭대기브라우저인가(p, 표) && !보호됨(p, 표));
  const 오래됨 = new Set(메인들.filter((p) => (지금 - p.시작) / 60000 >= 문턱분).map((p) => p.pid));
  const 뿌리별 = new Map();
  for (const m of 메인들) {
    if (!오래됨.has(m.pid)) continue;
    const 주인 = 진짜부모(m, 표);
    const 뿌리 = 주인 && 넓혀도되나(주인, 표, 오래됨) ? 주인 : m;
    if (대상 && !대상.has(뿌리.pid)) continue;
    if (!뿌리별.has(뿌리.pid)) 뿌리별.set(뿌리.pid, { 뿌리, 메인들: [] });
    뿌리별.get(뿌리.pid).메인들.push(m);
  }
  return [...뿌리별.values()].map((칸) => ({ ...칸, 나이분: Math.max(...칸.메인들.map((m) => (지금 - m.시작) / 60000)) }));
}

/** 두 표 사이 그 트리의 평균 코어. 사이에 뜬 프로세스는 쓴 시간 전부를 센다. 번호만 같은 다른 프로세스는 앞 값을 빼지 않는다. */
function 코어재기(뿌리, 표앞, 표뒤, 초) {
  let 합 = 0;
  for (const p of [뿌리, ...후손들(뿌리, 표뒤)]) {
    const 앞 = 표앞.get(p.pid);
    합 += p.cpu - (앞 && 앞.시작 === p.시작 ? 앞.cpu : 0);
  }
  return 합 / 초;
}

/** 끄는 사이 그 집합의 프로세스가 띄운 자식까지 넓힌다. 부모가 같은 프로세스로 살아 있을 때만 잇는다 — 죽은 부모의 번호를 남이 물려받았을 수 있다. */
function 집합넓히기(집합, 표) {
  for (let 바뀜 = true; 바뀜;) {
    바뀜 = false;
    for (const p of 표.values()) {
      const 부 = 집합.get(p.ppid);
      if (!부 || 집합.has(p.pid) || 부.pid === p.pid || 부.시작 > p.시작 || 표.get(부.pid)?.시작 !== 부.시작) continue;
      집합.set(p.pid, p);
      바뀜 = true;
    }
  }
}

const 살아있는것 = (집합, 표) => [...집합.values()].filter((p) => 표.get(p.pid)?.시작 === p.시작);

/** 뿌리부터 번호로 끈다 — 뿌리가 먼저 죽어야 새 브라우저를 못 띄운다. 끄고 다시 읽어 시작 시각이 같은 것이 남았는지 본다. */
async function 끄기(뿌리, 표, 도구) {
  const 집합 = new Map([[뿌리.pid, 뿌리], ...후손들(뿌리, 표).map((p) => [p.pid, p])]);
  let 지금표 = 표;
  for (let 차례 = 0; 차례 < 3; 차례 += 1) {
    집합넓히기(집합, 지금표);
    const 남음 = 살아있는것(집합, 지금표);
    if (!남음.length) return { 꺼짐: true, 개수: 집합.size };
    await 도구.끄기명령(남음.map((p) => ({ pid: p.pid, 시작: p.시작 })));
    await 도구.기다리기(3000);
    지금표 = await 도구.읽기();
  }
  집합넓히기(집합, 지금표);
  const 남음 = 살아있는것(집합, 지금표);
  return { 꺼짐: !남음.length, 개수: 집합.size, 남음: 남음.map((p) => `${p.이름}#${p.pid}(${p.명령 ? p.명령.match(/--type=\S+/)?.[0] || '메인' : '명령 줄 없음'})`) };
}

// 핸들을 쥔 뒤 시작 시각을 대조하고 그 핸들로 끈다 — 표를 읽은 뒤 번호를 남이 물려받았으면 건드리지 않는다. 5ms는 CIM(마이크로초) · 표(밀리초)의 자릿수 차이다.
// 권한은 끄기 · 시작 시각 조회 · 대기만 청한다(0x101001). 전체 권한을 청하는 .NET Process.Handle로는 Edge에서 8번 중 3번 프로세스 하나가 남았고, 이렇게 바꾼 뒤 8번은 하나도 안 남았다(11-04 실측).
const 끄기글 = (대상들) => `$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class SynkKill {
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool GetProcessTimes(IntPtr h, out long create, out long exit, out long kernel, out long user);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool TerminateProcess(IntPtr h, uint code);
  [DllImport("kernel32.dll")] public static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
}
'@
$끈것 = @()
$목록 = '${JSON.stringify(대상들.map((x) => ({ p: x.pid, s: new Date(x.시작).toISOString() })))}' | ConvertFrom-Json
foreach ($t in $목록) {
  $h = [SynkKill]::OpenProcess(0x101001, $false, [int]$t.p)
  if ($h -eq [IntPtr]::Zero) { continue }
  $기준 = [datetime]::Parse($t.s, $null, [Globalization.DateTimeStyles]::RoundtripKind)
  $c = 0L; $e = 0L; $k = 0L; $u = 0L
  if ([SynkKill]::GetProcessTimes($h, [ref]$c, [ref]$e, [ref]$k, [ref]$u) -and [math]::Abs(([DateTime]::FromFileTimeUtc($c) - $기준).TotalMilliseconds) -lt 5) {
    $null = [SynkKill]::TerminateProcess($h, 1)
    $끈것 += $h
  } else { $null = [SynkKill]::CloseHandle($h) }
}
foreach ($h in $끈것) { $null = [SynkKill]::WaitForSingleObject($h, 5000); $null = [SynkKill]::CloseHandle($h) }`;

function 끄기명령(대상들) {
  for (let i = 0; i < 대상들.length; i += 40) {   // 결과는 다시 읽어 본다
    spawnSync(파워셸(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', 인코딩(끄기글(대상들.slice(i, i + 40)))], { windowsHide: true, stdio: 'ignore', timeout: 120000 });
  }
}

const 기록파일 = () => process.env.SYNK_버려진화면스크립트_기록 || path.join(공용작업본(뿌리폴더), '.git', 'synk-버려진화면스크립트', '기록.jsonl');

function 적기(줄) {
  try {
    const 파일 = 기록파일();
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    fs.appendFileSync(파일, `${JSON.stringify(줄)}\n`);
  } catch (e) { console.error(`기록을 못 남겼다: ${e.message}`); }
}

const 실제도구 = () => ({
  읽기: 프로세스읽기, 끄기명령, 기다리기: (ms) => new Promise((r) => setTimeout(r, ms)), 지금: () => Date.now(), 적기,
});

const 소수 = (n) => Math.round(n * 100) / 100;
const 뿌리글 = (칸) => ({ pid: 칸.뿌리.pid, 이름: 칸.뿌리.이름, 명령: 칸.뿌리.명령.slice(0, 명령보임), 나이분: Math.round(칸.나이분), 브라우저: 칸.메인들.length });

/** 예약 회차: 후보가 없으면 바로 끝난다(평소). 있으면 창만큼 재고, 조건이 다 맞는 트리만 끈다. */
async function 돌리기({ 문턱분 = 기본.문턱분, 창초 = 기본.창초, 코어 = 기본.코어, 대상 = null } = {}, 도구 = 실제도구()) {
  const 앞때 = 도구.지금(), 표앞 = await 도구.읽기();
  const 앞후보 = 후보찾기(표앞, 앞때, { 문턱분, 대상 });
  if (!앞후보.length) return { 후보: 0, 결과: [] };
  await 도구.기다리기(창초 * 1000);
  const 결과 = [];
  for (const 앞칸 of 앞후보) {
    // 후보마다 표를 새로 읽는다 — 앞 후보를 끄는 사이 번호를 남이 물려받았거나 트리가 바뀌었을 수 있다.
    const 뒤때 = 도구.지금(), 표뒤 = await 도구.읽기();
    const 칸 = 후보찾기(표뒤, 뒤때, { 문턱분, 대상 }).find((x) => x.뿌리.pid === 앞칸.뿌리.pid && x.뿌리.시작 === 앞칸.뿌리.시작);
    const 줄 = { 때: new Date(뒤때).toISOString(), ...뿌리글(칸 || 앞칸) };
    if (!칸) { 줄.결과 = '사라짐'; } else {
      const 잰코어 = 코어재기(칸.뿌리, 표앞, 표뒤, Math.max(1, (뒤때 - 앞때) / 1000));
      줄.코어 = 소수(잰코어);   // 반올림은 적는 값만 — 0.495코어가 0.5로 통과하면 안 된다
      if (잰코어 < 코어) { 줄.결과 = '남김'; } else {
        const r = await 끄기(칸.뿌리, 표뒤, 도구);
        줄.결과 = r.꺼짐 ? '끔' : '못 끔';
        줄.개수 = r.개수;
        if (r.남음) 줄.남음 = r.남음;
      }
    }
    도구.적기(줄);
    결과.push(줄);
  }
  return { 후보: 앞후보.length, 결과 };
}

function 설치계획({ 뿌리 = 뿌리폴더, 파이썬 = path.join(process.env.LOCALAPPDATA || '', 'Python', 'pythoncore-3.14-64', 'pythonw.exe') } = {}) {
  const 메인 = 공용작업본(뿌리);
  const 운영 = fs.readFileSync(path.join(메인, '.git', 'synk-ops-path'), 'utf8').trim();
  const 숨김 = path.win32.join(운영, 'tools', '숨김실행.py'), 도구 = path.win32.join(운영, 'tools', '버려진화면스크립트.js');
  const 따옴 = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const 인자 = `-X utf8 -B "${숨김}" --한도 1200 "${도구}" --실행`;
  return {
    운영, 파이썬, 인자, 도구,
    ps: [
      '$ErrorActionPreference = "Stop"',
      `$a = New-ScheduledTaskAction -Execute ${따옴(파이썬)} -Argument ${따옴(인자)} -WorkingDirectory ${따옴(운영)}`,
      '$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)',
      '$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 25) -MultipleInstances IgnoreNew -Priority 5',
      `Register-ScheduledTask -TaskName ${따옴(예약이름)} -Action $a -Trigger $t -Settings $s -Description ${따옴('3시간 넘게 CPU를 쓰는 Playwright 헤드리스 브라우저 트리를 끈다(AI 없음). tools/버려진화면스크립트.js')} -Force | Out-Null`,
      `(Get-ScheduledTask -TaskName ${따옴(예약이름)}).State`,
    ].join('\n'),
  };
}

function 설치(실행) {
  const 계획 = 설치계획();
  if (!실행) return { 계획: 계획.ps };
  for (const 파일 of [계획.파이썬, 계획.도구]) if (!fs.existsSync(파일)) throw new Error(`없다: ${파일} — 운영 사본은 push 뒤 5분 안에 따라간다`);
  const r = spawnSync(파워셸(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', 인코딩(계획.ps)], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (r.error || r.status !== 0) throw new Error(`예약을 못 걸었다: ${r.error?.message || String(r.stderr).trim().slice(0, 300)}`);
  return { 예약: 예약이름, 상태: String(r.stdout).trim(), 운영: 계획.운영 };
}

function 인자읽기(argv) {
  const 오류 = 인자게이트('버려진화면스크립트', argv, ['--실행', '--json', '--대상', '--문턱분', '--창초', '--코어']);
  if (오류) throw new Error(오류);
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : undefined; };
  const 수 = (이름) => {
    const v = 값(이름);
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${이름}의 값이 수가 아니다: ${v}`);
    return n;
  };
  const 대상글 = 값('--대상');
  const 대상 = 대상글 === undefined ? null : new Set(대상글.split(',').map(Number));
  if (대상 && [...대상].some((n) => !Number.isInteger(n) || n <= 0)) throw new Error(`--대상은 프로세스 번호다: ${대상글}`);
  const 옵션 = { 문턱분: 수('--문턱분'), 창초: 수('--창초'), 코어: 수('--코어') };
  if (!대상 && Object.values(옵션).some((v) => v !== undefined)) throw new Error('기준을 바꾼 실행은 --대상 <pid>와 함께만 한다 — 다른 세션의 브라우저를 끄지 않게');
  const 낱말 = argv.filter((x, i) => !x.startsWith('--') && !['--대상', '--문턱분', '--창초', '--코어'].includes(argv[i - 1]));
  if (낱말.length > 1 || (낱말[0] && !['설치', '기록'].includes(낱말[0]))) throw new Error(`모르는 낱말: ${낱말.join(' ')}`);
  return { 명령: 낱말[0] || null, 실행: argv.includes('--실행'), json: argv.includes('--json'), 대상, ...Object.fromEntries(Object.entries(옵션).filter(([, v]) => v !== undefined)) };
}

function 미리보기({ 문턱분, 대상 }) {
  const 지금 = Date.now(), 표 = 프로세스읽기();
  return 후보찾기(표, 지금, { 문턱분, 대상 }).map((칸) => {
    const 나무 = [칸.뿌리, ...후손들(칸.뿌리, 표)];
    return { ...뿌리글(칸), 개수: 나무.length, 평생코어: 소수(나무.reduce((합, p) => 합 + p.cpu, 0) / Math.max(1, (지금 - 칸.뿌리.시작) / 1000)) };
  });
}

async function main(argv) {
  const 옵션 = 인자읽기(argv);
  const 보임 = (값, 글) => console.log(옵션.json ? JSON.stringify(값, null, 1) : 글);
  if (옵션.명령 === '기록') {
    let 줄들 = [];
    try { 줄들 = fs.readFileSync(기록파일(), 'utf8').trim().split('\n').filter(Boolean).slice(-20); } catch { /* 아직 없다 */ }
    보임(줄들.map((x) => JSON.parse(x)), 줄들.length ? 줄들.join('\n') : '기록 없음');
  } else if (옵션.명령 === '설치') {
    const r = 설치(옵션.실행);
    보임(r, r.계획 ? `[미리 보기] --실행을 붙이면 건다\n${r.계획}` : `[걸림] ${r.예약} · ${r.상태} · 운영 사본 ${r.운영}`);
  } else if (옵션.실행) {
    const r = await 돌리기(옵션);
    보임(r, r.후보 ? r.결과.map((x) => `[${x.결과}] ${x.이름}#${x.pid} ${x.나이분}분 코어 ${x.코어 ?? '-'} ${x.명령.slice(0, 120)}`).join('\n') : '[바뀐 것 없음] 3시간 넘은 Playwright 브라우저 없음');
  } else {
    const r = 미리보기(옵션);
    보임(r, r.length ? `[미리 보기] 끄지 않았다. --실행이면 10분 재어 코어 ${기본.코어}개 이상인 트리만 끈다\n${r.map((x) => `${x.이름}#${x.pid} ${x.나이분}분 · 트리 ${x.개수}개 · 평생 평균 코어 ${x.평생코어} · ${x.명령.slice(0, 120)}`).join('\n')}` : '3시간 넘은 Playwright 브라우저 없음');
  }
}

if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });

module.exports = { 예약이름, 기본, 표만들기, 프로세스읽기, 브라우저메인인가, 진짜부모, 후손들, 보호됨, 후보찾기, 코어재기, 끄기, 끄기명령, 돌리기, 설치계획, 인자읽기 };
