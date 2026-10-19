#!/usr/bin/env node
'use strict';
/**
 * git 잠금 — 공용 작업본의 `.git/index.lock`이 «주인 없는 잠금»인지 가리고, 그럴 때만 지운다.
 *
 *   node tools/git잠금.js           상태만 본다(아무것도 지우지 않는다)
 *   node tools/git잠금.js --정리     주인 없는 잠금이면 지운다
 *   node tools/git잠금.js --json     기계 판독용
 *
 * 주인 없는 잠금 = 0바이트 · 10초 넘게 남아 있음 · 잠금보다 먼저 시작한 git 프로세스가 없음.
 * 잠금 파일은 O_EXCL로 만들어지므로 잠금보다 늦게 시작한 프로세스는 주인이 될 수 없다.
 * 프로세스 목록을 못 읽으면 주인이 있다고 보고 지우지 않는다.
 *
 * 2026-10-03 측정: Claude 앱과 Codex 앱이 변경 보기용으로 git을 수시로 돌려 이 저장소의
 * index.lock이 15분에 30번(각 0.5~2초) 생겼다. 그런 조회가 중간에 끊기면 0바이트 잠금이 남아
 * 커밋·reset이 «File exists»로 멈춘다(10-02~03 여덟 번). 공용 인덱스를 늘 같이 쓰는 커밋 절차는
 * 이 잠금에 막히면 몇 초 기다렸다 다시 하고, 10초 넘게 남으면 이 도구로 가린다.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 기다림초 = 10;

/** 순수 판정. 입력: {있음, 크기, 수정ms, 지금ms, 먼저시작한git수(모르면 null)} */
function 판정(s) {
  if (!s.있음) return { 상태: '없음', 지움: false, 이유: '잠금 없음' };
  if (s.크기 !== 0) return { 상태: '주인 있음 추정', 지움: false, 이유: `내용이 있는 잠금(${s.크기}B) — 쓰는 중일 수 있다` };
  const 나이 = (s.지금ms - s.수정ms) / 1000;
  if (나이 < 기다림초) return { 상태: '잠깐 쓰는 중', 지움: false, 이유: `${나이.toFixed(1)}초째 — ${기다림초}초까지 기다린다` };
  if (s.먼저시작한git수 == null) return { 상태: '모름', 지움: false, 이유: '프로세스 목록을 못 읽어 주인을 가릴 수 없다' };
  if (s.먼저시작한git수 > 0) return { 상태: '주인 있음', 지움: false, 이유: `잠금보다 먼저 시작한 git ${s.먼저시작한git수}개` };
  return { 상태: '주인 없음', 지움: true, 이유: `0바이트 · ${Math.round(나이)}초째 · 잠금보다 먼저 시작한 git 없음` };
}

/** 잠금보다 먼저 시작한 git 프로세스 수. 못 읽으면 null. */
function 먼저시작한git(잠금수정ms) {
  try {
    if (process.platform === 'win32') {
      const 출력 = execFileSync('powershell', ['-NoProfile', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='git.exe'\" | ForEach-Object { [int64]($_.CreationDate.ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds }"],
      { encoding: 'utf8', timeout: 20000, windowsHide: true });
      return 출력.split(/\s+/).filter(Boolean).map(Number).filter((t) => t < 잠금수정ms).length;
    }
    const 출력 = execFileSync('ps', ['-eo', 'lstart=,comm='], { encoding: 'utf8' });
    return 출력.split('\n').filter((l) => /\bgit$/.test(l.trim())).map((l) => Date.parse(l.trim().slice(0, 24))).filter((t) => t < 잠금수정ms).length;
  } catch (_) {
    return null;
  }
}

/** 그 저장소의 공용 인덱스 잠금 경로. 연결 워크트리는 `.git`이 파일이라 git에 묻는다. */
function 잠금경로(저장소) {
  const 기본 = path.join(저장소, '.git', 'index.lock');
  try { if (fs.statSync(path.join(저장소, '.git')).isDirectory()) return 기본; } catch (_) { return 기본; }
  const env = { ...process.env };
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
  try {
    return path.resolve(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'index.lock'],
      { cwd: 저장소, encoding: 'utf8', env, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch (_) {
    return 기본;
  }
}

/** 옵션: 잠금(잠금 파일 경로), 먼저시작한git(잠금수정ms → 수 | null, 시험에서 바꿔 끼운다). */
function 살피기(저장소 = path.resolve(__dirname, '..'), 옵션 = {}) {
  const 잠금 = 옵션.잠금 || 잠금경로(저장소);
  let st = null;
  try { st = fs.statSync(잠금); } catch (_) {}
  const 입력 = st
    ? { 있음: true, 크기: st.size, 수정ms: st.mtimeMs, 지금ms: Date.now(), 먼저시작한git수: null }
    : { 있음: false };
  if (st && st.size === 0 && (입력.지금ms - st.mtimeMs) / 1000 >= 기다림초) {
    입력.먼저시작한git수 = (옵션.먼저시작한git || 먼저시작한git)(st.mtimeMs);
  }
  return { 잠금, 입력, ...판정(입력) };
}

/** 살피기 결과가 주인 없는 잠금이고 그사이 바뀌지 않았을 때만 지운다. 지웠으면 true. */
function 정리(r) {
  if (!r || !r.지움) return false;
  let 다시;
  try { 다시 = fs.statSync(r.잠금); } catch (_) { return false; }
  if (다시.size !== 0 || 다시.mtimeMs !== r.입력.수정ms) return false;
  fs.unlinkSync(r.잠금);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const 모르는 = args.filter((a) => !['--정리', '--json'].includes(a));
  if (모르는.length) { console.error(`모르는 인자: ${모르는.join(' ')} (아는 것: --정리 --json)`); process.exit(1); }
  const r = 살피기();
  if (args.includes('--정리') && r.지움) {
    if (정리(r)) r.지웠음 = true;
    else r.이유 += ' — 그사이 바뀌어 지우지 않았다';
  }
  if (args.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return; }
  console.log(`index.lock: ${r.상태} — ${r.이유}${r.지웠음 ? ' → 지웠다' : r.지움 ? ' (지우려면 --정리)' : ''}`);
}

if (require.main === module) main();

module.exports = { 판정, 살피기, 정리, 잠금경로, 기다림초 };
