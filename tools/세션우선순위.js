#!/usr/bin/env node
'use strict';
/**
 * 세션 우선순위 — Claude Code 세션과 GPT 세션이 띄운 일을 CPU 「보통 아래」 · 디스크 「낮음」으로 낮춘다 (2026-11-15).
 *
 * 왜 있나: 유호님 「채팅이 너무 느리게쳐지거든? 아예 안쳐지기도해. 특이하게 클로드 앱 쓸때만」 → 「웅 그럼 그렇게 고쳐줘」.
 *   재 보니 CPU 24코어가 100%였다. 여러 세션이 띄운 렌더(Remotion · 크롬) · ffmpeg · 시험 묶음 · 최종본 검사 · 백업이
 *   모두 「보통」 우선순위로 돌아, 같은 「보통」인 Claude 앱 화면(글자 입력 담당)이 차례를 못 받았다.
 *   Windows는 부모가 BELOW_NORMAL이면 새 자식도 BELOW_NORMAL로 만든다(CreateProcess 기본). 그래서 세션 프로세스
 *   (claude-code의 claude.exe) 하나만 낮추면, 그 세션이 띄우는 셸 · 렌더 · 시험 · 검사가 모두 처음부터 낮게 뜬다.
 *   앱 화면(Program Files의 Claude.exe와 그 --type 자식)은 건드리지 않는다. 우선순위는 차례만 바꾸고 계산은 바꾸지 않아
 *   결과물(영상 · 검사 · 시험)은 같고, 유호님이 화면을 쓰지 않을 때는 CPU를 그대로 다 쓴다.
 *
 *   GPT 앱 서버(부모가 ChatGPT.exe인 codex.exe)는 낮추지 않는다. 그 서버는 GPT 앱 화면이 묻는 대화 목록 · 대화 읽기 ·
 *   모델 목록에 모두 답하는 곳이라 Claude로 치면 앱 화면 자리다. 서버까지 낮췄더니 CPU가 꽉 찬 때 대화 읽기가 488초 걸려
 *   GPT 화면이 멈췄다(11-15 17:35, GPT 작업 검수 세션 실측). 그래서 서버는 「보통」으로 두고(낮아져 있으면 되돌린다)
 *   그 자손(GPT 세션이 띄운 셸 · 시험 · 렌더)만 낮춘다. 서버가 「보통」이라 새로 뜨는 GPT 명령은 다음 회차까지 「보통」이다.
 *
 *   node tools/세션우선순위.js          SessionStart 훅 — 이 프로세스의 조상 가운데 세션 프로세스를 찾아 CPU를 낮추고,
 *                                       나머지(디스크 · GPT 자손 · 주인 없는 grep)는 뒤에 띄운 작업(--뒤)에 맡긴다. 출력 없음 · 늘 끝 코드 0.
 *   node tools/세션우선순위.js --지금   지금 떠 있는 Claude 세션과 그 자손, GPT 앱 서버의 자손 가운데 「보통」인 것을 낮추고,
 *                                       GPT 앱 서버를 「보통」으로 되돌리고, 주인 없는 grep을 끈다. 바꾼 수를 보인다.
 *
 * 훅 자리: `~/.claude/settings.json` SessionStart(matcher 없음 — 새로 · 이어서 · 압축 뒤 모두), 운영 사본의 이 파일을 부른다.
 * 관문 표: docs/_ops/관문_자동화.md 「Claude Code 훅」.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const 낮춤 = os.constants.priority.PRIORITY_BELOW_NORMAL; // Windows BELOW_NORMAL_PRIORITY_CLASS
const 보통 = os.constants.priority.PRIORITY_NORMAL;

function 이름(행) { return String((행 && 행.Name) || '').toLowerCase(); }

/** 세션 프로세스인가 — claude-code 폴더의 claude.exe(앱이 띄운 대화 하나). 앱 본체 Claude.exe · --type 자식은 아니다. */
function 세션인가(행) {
  const 경로 = String(행.ExecutablePath || '').replace(/\//g, '\\').toLowerCase();
  return 이름(행) === 'claude.exe' && 경로.includes('\\claude-code\\');
}

/** GPT 앱 서버인가 — 부모가 ChatGPT.exe인 codex.exe. GPT 세션의 셸 · 렌더 · 시험이 이 아래에서 뜬다.
 * npm으로 설치된 codex.exe(검수 묶음의 codex exec — 부모가 node.exe)는 서버가 아니다. 그것은 띄운 세션의 등급을 물려받는다. */
function GPT앱서버인가(행, 부모) {
  return 이름(행) === 'codex.exe' && 이름(부모) === 'chatgpt.exe';
}

/** 표(행: ProcessId · ParentProcessId · Name · ExecutablePath)에서 시작 pid의 조상 가운데 첫 세션 프로세스 pid. 없으면 null. */
function 조상세션(표, 시작) {
  const 찾기 = new Map(표.map((행) => [Number(행.ProcessId), 행]));
  let pid = Number(시작);
  for (let 걸음 = 0; 걸음 < 12 && pid; 걸음++) {
    const 행 = 찾기.get(pid);
    if (!행) return null;
    if (세션인가(행)) return pid;
    const 부모 = Number(행.ParentProcessId);
    if (!부모 || 부모 === pid) return null;
    pid = 부모;
  }
  return null;
}

function 자식표(표) {
  const 자식들 = new Map();
  for (const 행 of 표) {
    const 부모 = Number(행.ParentProcessId);
    if (!자식들.has(부모)) 자식들.set(부모, []);
    자식들.get(부모).push(Number(행.ProcessId));
  }
  return 자식들;
}

/** 뿌리들에서 아래로 내려가며 pid를 모은다(뿌리 포함 여부는 고른다). 고리가 있어도 멈춘다. */
function 아래로(자식들, 뿌리들, 뿌리도) {
  const 결과 = [];
  const 본 = new Set();
  const 줄 = 뿌리들.map((pid) => [pid, true]);
  while (줄.length) {
    const [pid, 뿌리] = 줄.shift();
    if (본.has(pid)) continue;
    본.add(pid);
    if (!뿌리 || 뿌리도) 결과.push(pid);
    for (const c of 자식들.get(pid) || []) 줄.push([c, false]);
  }
  return 결과;
}

/** Claude 세션 프로세스들과 그 자손 pid(세션 먼저). 앱 본체 Claude.exe는 세션의 자손이 될 일이 없다. */
function 세션과자손(표) {
  const 뿌리들 = 표.filter((행) => 세션인가(행)).map((행) => Number(행.ProcessId));
  return 아래로(자식표(표), 뿌리들, true);
}

/** GPT 앱 서버 pid들과, 서버는 빼고 그 아래 자손 pid들. */
function GPT대상(표) {
  const 찾기 = new Map(표.map((행) => [Number(행.ProcessId), 행]));
  const 서버 = 표.filter((행) => GPT앱서버인가(행, 찾기.get(Number(행.ParentProcessId)))).map((행) => Number(행.ProcessId));
  return { 서버, 자손: 아래로(자식표(표), 서버, false).filter((pid) => !서버.includes(pid)) };
}

function 파워셸(명령, 기다림) {
  const 글 = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' + 명령],
    { encoding: 'utf8', timeout: 기다림, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const 값 = JSON.parse(글 || '[]');
  return Array.isArray(값) ? 값 : [값];
}

/** 프로세스 표 전체. CPU가 꽉 찬 때는 전체 조회가 15초를 넘었다(11-15) — 넉넉히 기다린다. 훅 본체에서는 부르지 않는다(뒤 작업과 --지금만). */
function 표읽기() {
  return 파워셸('Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,ExecutablePath | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath | ConvertTo-Json -Compress', 120000);
}

/** 시작 pid에서 조상 쪽으로 몇 칸만(훅). 전체 표 대신 pid로 하나씩 찾아 빠르다. 세션을 만나면 멈춘다. */
function 조상읽기(시작) {
  const 명령 = `$r=@(); $id=${Number(시작)}; for ($i=0; $i -lt 8 -and $id; $i++) { `
    + `$p=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -Property ProcessId,ParentProcessId,Name,ExecutablePath; if (-not $p) { break }; `
    + `$r += ($p | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath); `
    + `if ($p.Name -eq 'claude.exe' -and $p.ExecutablePath -like '*\\claude-code\\*') { break }; $id=$p.ParentProcessId }; `
    + `ConvertTo-Json -InputObject $r -Compress`;
  return 파워셸(명령, 60000);
}

/* 디스크 우선순위(I/O priority) — CPU 등급만 낮추면 디스크 차례는 그대로라, 세션들이 저장소를 통째로 훑는 grep(초당 98MB 읽기)
 * · 렌더 · 영상 처리가 C:를 막아(디스크 사용 433% · 대기 2.5) 같은 C:에 대화를 쓰는 Claude 앱 입력이 또 멈췄다(11-15 두 번째 실측).
 * NtSetInformationProcess(33)으로 「낮음」(1)으로 둔다 — 자식도 물려받는다(11-15 확인: 낮춘 세션에서 띄운 PowerShell이 io 1).
 * Low는 「보통」(2)일 때만 1로, Normal은 「낮음」(1)일 때만 2로 바꾼다(GPT 앱 서버 되돌리기). */
const 디스크준비 = 'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public static class SynkIo2 { '
  + '[DllImport("ntdll.dll")] static extern int NtSetInformationProcess(IntPtr h, int c, ref int v, int l); '
  + '[DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int c, ref int v, int l, out int r); '
  + '[DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int a, bool i, int p); [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h); '
  + 'static bool Swap(int pid, int from, int to) { IntPtr h = OpenProcess(0x1200, false, pid); if (h == IntPtr.Zero) return false; int v = -1, r; '
  + 'NtQueryInformationProcess(h, 33, ref v, 4, out r); bool ok = false; if (v == from) { int n = to; ok = NtSetInformationProcess(h, 33, ref n, 4) == 0; } CloseHandle(h); return ok; } '
  + 'public static bool Low(int pid) { return Swap(pid, 2, 1); } public static bool Normal(int pid) { return Swap(pid, 1, 2); } }\'; ';

/* 주인 없는 grep — 셸 명령이 시간 초과로 끊기면 bash만 죽고 `grep -r … docs tools`는 남아, 미디어가 든 docs를 30~60분 동안
 * 초당 100MB씩 읽으며 C:를 막았다(11-15 하루에 다섯). 유호님 「응, 꺼」(11-15 — 「주인 없이 10분 넘게 도는 grep은 앞으로도 꺼도 될까요?」).
 * 부모가 없거나, 같은 번호의 부모가 grep보다 나중에 생겼으면(번호를 다른 프로세스가 물려받음) 주인이 없는 것이다. */
const grep분 = 10;
const grep읽기 = '$g=@(Get-CimInstance Win32_Process -Filter "Name=\'grep.exe\'" -Property ProcessId,ParentProcessId,CreationDate | ForEach-Object { '
  + '$q=Get-CimInstance Win32_Process -Filter "ProcessId=$($_.ParentProcessId)" -Property CreationDate; '
  + '@{ ProcessId=[int]$_.ProcessId; Created=$_.CreationDate.ToUniversalTime().ToString(\'o\'); '
  + 'ParentCreated=$(if ($q) { $q.CreationDate.ToUniversalTime().ToString(\'o\') } else { $null }) } }); ';

/** grep 행들(ProcessId · Created · ParentCreated, ISO 시각)에서 주인 없이 grep분 넘게 돈 pid. 지금은 ms. */
function 끌grep(행들, 지금 = Date.now()) {
  return [].concat(행들 || []).filter((행) => {
    const 시작 = Date.parse(행 && 행.Created);
    if (!Number.isFinite(시작) || 지금 - 시작 < grep분 * 60000) return false;
    const 부모 = Date.parse(행.ParentCreated);
    return !Number.isFinite(부모) || 부모 > 시작;
  }).map((행) => Number(행.ProcessId)).filter((p) => Number.isInteger(p) && p > 0);
}

function grep끄기(행들) {
  let 끔 = 0;
  for (const pid of 끌grep(행들)) {
    try { process.kill(pid); 끔 += 1; } catch { /* 그사이 끝났다 */ }
  }
  return 끔;
}

/** 디스크 우선순위를 낮출 pid는 「보통」→「낮음」, 되돌릴 pid는 「낮음」→「보통」. 덧붙여 grep 행들을 돌려준다(PowerShell 한 번). */
function 디스크맞추기(낮출, 되돌릴 = []) {
  const 목록 = (값) => [...new Set(값)].filter((p) => Number.isInteger(p) && p > 0).join(',') || '0';
  const 명령 = 디스크준비
    + `$n=0; foreach ($p in @(${목록(낮출)})) { if ($p -gt 0 -and [SynkIo2]::Low($p)) { $n++ } }; `
    + `$u=0; foreach ($p in @(${목록(되돌릴)})) { if ($p -gt 0 -and [SynkIo2]::Normal($p)) { $u++ } }; `
    + grep읽기
    + 'ConvertTo-Json -InputObject @(@{ n = $n; u = $u; grep = $g }) -Compress -Depth 4';
  const [결과] = 파워셸(명령, 120000);
  return {
    낮춤: Number(결과 && 결과.n) || 0,
    되돌림: Number(결과 && 결과.u) || 0,
    grep: (결과 && 결과.grep) ? [].concat(결과.grep) : [],
  };
}

function 낮추기(pid, 보통만 = false) {
  try {
    if (보통만 && os.getPriority(pid) !== 보통) return false;
    os.setPriority(pid, 낮춤);
    return true;
  } catch {
    return false; // 이미 끝났거나 다른 사용자 프로세스
  }
}

/** 「보통 아래」인 것만 「보통」으로 되돌린다(누가 일부러 올린 등급은 그대로 둔다). */
function 되돌리기(pid) {
  try {
    if (os.getPriority(pid) !== 낮춤) return false;
    os.setPriority(pid, 보통);
    return true;
  } catch {
    return false;
  }
}

/** 표 하나로 모두 맞춘다 — Claude 세션과 자손 · GPT 서버의 자손은 낮추고, GPT 서버는 되돌리고, 주인 없는 grep은 끈다. */
function 맞추기(표, 더낮출 = []) {
  const 클로드 = 세션과자손(표);
  const { 서버, 자손 } = GPT대상(표);
  const 낮출 = [...클로드, ...자손];
  const 셈 = { 대상: 낮출.length, 서버: 서버.length, cpu: 0, cpu되돌림: 0, 디스크: 0, 디스크되돌림: 0, grep: 0 };
  for (const pid of 낮출) if (낮추기(pid, true)) 셈.cpu += 1;
  for (const pid of 서버) if (되돌리기(pid)) 셈.cpu되돌림 += 1;
  try {
    const 결과 = 디스크맞추기([...더낮출, ...낮출], 서버);
    셈.디스크 = 결과.낮춤;
    셈.디스크되돌림 = 결과.되돌림;
    셈.grep = grep끄기(결과.grep);
  } catch { /* CPU만 바꾼 채 둔다 */ }
  return 셈;
}

/** 여러 세션이 한꺼번에 시작되면(이어서 깨우기) 뒤 작업이 여럿 뜬다 — 전체 표 읽기가 무거우니 3분 안에는 하나만 돈다. */
function 잠그기() {
  const 자리 = path.join(os.tmpdir(), 'synk-세션우선순위.lock');
  for (let 시도 = 0; 시도 < 2; 시도++) {
    try {
      fs.writeFileSync(자리, String(process.pid), { flag: 'wx' });
      return () => { try { fs.unlinkSync(자리); } catch { /* 그대로 */ } };
    } catch {
      try {
        if (Date.now() - fs.statSync(자리).mtimeMs < 3 * 60000) return null;
        fs.unlinkSync(자리);
      } catch { return null; }
    }
  }
  return null;
}

function main(argv) {
  if (process.platform !== 'win32') return 0;
  if (argv.includes('--지금')) {
    const 셈 = 맞추기(표읽기());
    process.stdout.write(`Claude 세션과 자손 · GPT 앱 서버의 자손 ${셈.대상}개 가운데 CPU 「보통」이던 ${셈.cpu}개를 「보통 아래」로, 디스크 「보통」이던 ${셈.디스크}개를 「낮음」으로 낮췄다. `
      + `GPT 앱 서버 ${셈.서버}개 가운데 CPU ${셈.cpu되돌림}개 · 디스크 ${셈.디스크되돌림}개를 「보통」으로 되돌렸다. 주인 없이 ${grep분}분 넘게 돈 grep ${셈.grep}개를 껐다\n`);
    return 0;
  }
  const 뒤 = argv.indexOf('--뒤');
  if (뒤 >= 0) {
    const 풀기 = 잠그기();
    if (!풀기) return 0;
    try { 맞추기(표읽기(), [Number(argv[뒤 + 1]) || 0]); } catch { /* 그대로 둔다 */ } finally { 풀기(); }
    return 0;
  }
  let 세션 = null;
  try {
    세션 = 조상세션(조상읽기(process.pid), process.pid);
    if (세션) 낮추기(세션);
  } catch {
    // 훅은 세션 시작을 막지 않는다 — 실패하면 조용히 그대로 둔다
  }
  try {
    // 나머지는 뒤에서 — 전체 표 읽기와 디스크 등급 맞추기는 CPU가 꽉 찬 때 10초를 넘겨, 세션 시작을 기다리게 하지 않는다.
    // 세션이 시작될 때마다 돌아, GPT 앱을 다시 켜거나 GPT 세션이 새 일을 띄운 뒤에도 다음 회차에 맞춘다.
    spawn(process.execPath, [__filename, '--뒤', String(세션 || 0)], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {
    // 그대로 둔다
  }
  return 0;
}

module.exports = { 세션인가, GPT앱서버인가, 조상세션, 세션과자손, GPT대상, 끌grep };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
