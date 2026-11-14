#!/usr/bin/env node
'use strict';
/**
 * 세션 우선순위 — Claude Code 세션 프로세스를 CPU 「보통 아래」 · 디스크 「낮음」으로 낮춘다 (2026-11-15).
 *
 * 왜 있나: 유호님 「채팅이 너무 느리게쳐지거든? 아예 안쳐지기도해. 특이하게 클로드 앱 쓸때만」 → 「웅 그럼 그렇게 고쳐줘」.
 *   재 보니 CPU 24코어가 100%였다. 여러 세션이 띄운 렌더(Remotion · 크롬) · ffmpeg · 시험 묶음 · 최종본 검사 · 백업이
 *   모두 「보통」 우선순위로 돌아, 같은 「보통」인 Claude 앱 화면(글자 입력 담당)이 차례를 못 받았다.
 *   Windows는 부모가 BELOW_NORMAL이면 새 자식도 BELOW_NORMAL로 만든다(CreateProcess 기본). 그래서 세션 프로세스
 *   (claude-code의 claude.exe) 하나만 낮추면, 그 세션이 띄우는 셸 · 렌더 · 시험 · 검사가 모두 처음부터 낮게 뜬다.
 *   앱 화면(Program Files의 Claude.exe와 그 --type 자식)은 건드리지 않는다. 우선순위는 차례만 바꾸고 계산은 바꾸지 않아
 *   결과물(영상 · 검사 · 시험)은 같고, 유호님이 화면을 쓰지 않을 때는 CPU를 그대로 다 쓴다.
 *
 *   node tools/세션우선순위.js          SessionStart 훅 — 이 프로세스의 조상 가운데 세션 프로세스를 찾아 낮춘다. 출력 없음 · 늘 끝 코드 0.
 *   node tools/세션우선순위.js --지금   지금 떠 있는 모든 세션 프로세스와 그 자손 가운데 「보통」인 것을 낮춘다(이미 뜬 일에 한 번). 바꾼 수를 보인다.
 *
 * 훅 자리: `~/.claude/settings.json` SessionStart(matcher 없음 — 새로 · 이어서 · 압축 뒤 모두), 운영 사본의 이 파일을 부른다.
 * 관문 표: docs/_ops/관문_자동화.md 「Claude Code 훅」.
 */
const os = require('os');
const { execFileSync } = require('child_process');

const 낮춤 = os.constants.priority.PRIORITY_BELOW_NORMAL; // Windows BELOW_NORMAL_PRIORITY_CLASS
const 보통 = os.constants.priority.PRIORITY_NORMAL;

/** 세션 프로세스인가 — claude-code 폴더의 claude.exe(앱이 띄운 대화 하나). 앱 본체 Claude.exe · --type 자식은 아니다. */
function 세션인가(행) {
  const 이름 = String(행.Name || '').toLowerCase();
  const 경로 = String(행.ExecutablePath || '').replace(/\//g, '\\').toLowerCase();
  return 이름 === 'claude.exe' && 경로.includes('\\claude-code\\');
}

/** GPT(Codex) 앱의 codex.exe인가 — GPT 세션의 셸 · 렌더 · 시험이 이 아래에서 뜬다. Claude 세션만 낮추면 GPT 쪽 「보통」 일에
 * Claude 쪽 시험이 밀려 시간 초과가 난다(11-02 조건부 시험 — 현장 노트 윈도우 셸) — 두 쪽을 같은 등급으로 맞춘다. */
function 코덱스인가(행) {
  const 이름 = String(행.Name || '').toLowerCase();
  const 경로 = String(행.ExecutablePath || '').replace(/\//g, '\\').toLowerCase();
  return 이름 === 'codex.exe' && 경로.includes('\\openai.codex');
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

/** 세션 프로세스들과 그 자손 pid(세션 먼저). 앱 본체 Claude.exe는 자손이어도 빼지 않지만 세션의 자손이 될 일이 없다. */
function 세션과자손(표) {
  const 자식들 = new Map();
  for (const 행 of 표) {
    const 부모 = Number(행.ParentProcessId);
    if (!자식들.has(부모)) 자식들.set(부모, []);
    자식들.get(부모).push(Number(행.ProcessId));
  }
  const 결과 = [];
  const 본 = new Set();
  const 줄 = 표.filter((행) => 세션인가(행) || 코덱스인가(행)).map((행) => Number(행.ProcessId));
  while (줄.length) {
    const pid = 줄.shift();
    if (본.has(pid)) continue;
    본.add(pid);
    결과.push(pid);
    for (const c of 자식들.get(pid) || []) 줄.push(c);
  }
  return 결과;
}

function 파워셸(명령, 기다림) {
  const 글 = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' + 명령],
    { encoding: 'utf8', timeout: 기다림, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const 값 = JSON.parse(글 || '[]');
  return Array.isArray(값) ? 값 : [값];
}

/** 프로세스 표 전체(「지금」). CPU가 꽉 찬 때는 전체 조회가 15초를 넘었다(11-15) — 넉넉히 기다린다. */
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
 * NtSetInformationProcess(33)으로 「낮음」(1)으로 둔다 — 자식도 물려받는다(11-15 확인: 낮춘 세션에서 띄운 PowerShell이 io 1). 「보통」(2)일 때만 바꾼다. */
const 디스크준비 = 'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public static class SynkIo { '
  + '[DllImport("ntdll.dll")] static extern int NtSetInformationProcess(IntPtr h, int c, ref int v, int l); '
  + '[DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int c, ref int v, int l, out int r); '
  + '[DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int a, bool i, int p); [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h); '
  + 'public static bool Low(int pid) { IntPtr h = OpenProcess(0x1200, false, pid); if (h == IntPtr.Zero) return false; int v = -1, r; '
  + 'NtQueryInformationProcess(h, 33, ref v, 4, out r); bool ok = false; if (v == 2) { int n = 1; ok = NtSetInformationProcess(h, 33, ref n, 4) == 0; } CloseHandle(h); return ok; } }\'; ';

/** pid들의 디스크 우선순위를 「보통」에서 「낮음」으로. 바꾼 수. 덧붙여 GPT 앱 codex.exe 행들을 돌려준다(훅이 한 번에 쓰게). */
function 디스크낮추기(pids, 코덱스도 = false) {
  const 목록 = pids.filter((p) => Number.isInteger(p) && p > 0).join(',');
  const 명령 = 디스크준비
    + `$n=0; foreach ($p in @(${목록 || '0'})) { if ($p -gt 0 -and [SynkIo]::Low($p)) { $n++ } }; `
    + (코덱스도
      ? `$c=@(Get-CimInstance Win32_Process -Filter "Name='codex.exe'" -Property ProcessId,ParentProcessId,Name,ExecutablePath | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath); `
        + `foreach ($x in $c) { if ($x.ExecutablePath -like '*OpenAI.Codex*' -and [SynkIo]::Low([int]$x.ProcessId)) { $n++ } }; `
      : '$c=@(); ')
    + 'ConvertTo-Json -InputObject @(@{ n = $n; codex = $c }) -Compress -Depth 4';
  const [결과] = 파워셸(명령, 90000);
  return { 바꿈: Number(결과 && 결과.n) || 0, 코덱스: (결과 && 결과.codex) ? [].concat(결과.codex) : [] };
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

function main(argv) {
  if (process.platform !== 'win32') return 0;
  if (argv.includes('--지금')) {
    const 표 = 표읽기();
    const 대상 = 세션과자손(표);
    let 바꿈 = 0;
    for (const pid of 대상) if (낮추기(pid, true)) 바꿈 += 1;
    let 디스크 = 0;
    try { 디스크 = 디스크낮추기(대상).바꿈; } catch { /* CPU만 바꾼 채 둔다 */ }
    process.stdout.write(`세션과 자손 ${대상.length}개 가운데 CPU 「보통」이던 ${바꿈}개를 「보통 아래」로, 디스크 「보통」이던 ${디스크}개를 「낮음」으로 낮췄다\n`);
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
    // 세션의 디스크 우선순위도 낮추고, GPT 앱은 다시 켜면 codex.exe가 「보통」으로 뜨니 Claude 세션이 시작될 때마다 함께 맞춘다
    // (그 뒤 띄우는 GPT 일부터 낮게). PowerShell 한 번으로 한다 — CPU가 꽉 찬 때 PowerShell을 띄우는 데만 몇 초가 든다.
    const { 코덱스 } = 디스크낮추기(세션 ? [세션] : [], true);
    for (const 행 of 코덱스) if (코덱스인가(행)) 낮추기(Number(행.ProcessId), true);
  } catch {
    // 그대로 둔다
  }
  return 0;
}

module.exports = { 세션인가, 코덱스인가, 조상세션, 세션과자손 };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
