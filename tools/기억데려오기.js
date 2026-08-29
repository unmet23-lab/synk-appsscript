#!/usr/bin/env node
/**
 * 기억데려오기 — 이 기계에 기억이 없으면 스스로 데려온다.
 *
 * 까닭(유호 08-26 「노트북 없이도 지금 이대로의 너와 대화하고 싶다」):
 *   기억이 놓이는 폴더 «이름»은 작업 폴더의 «경로»에서 만들어진다. 기계가 바뀌거나
 *   원격 세션(claude.ai/code)에서 열면 그 이름이 달라지고, GitHub 에 기억이 멀쩡히
 *   있어도 «빈 폴더»를 보고 백지에서 시작한다. 저장은 되고 있었고, 못 하던 건 데려오기였다.
 *
 * 길 둘 — 환경이 다르면 통로도 다르다(08-26 실측):
 *   ㉠ 로컬 PC : gh 인증이 있으니 private 저장소를 그대로 clone 한다.
 *   ㉡ 원격 세션 : gh CLI 가 아예 없고 GitHub 접근 범위가 연 저장소 하나로 묶인다.
 *      유호님이 「레포 선택」에서 synk-memory 를 함께 붙이면 «형제 폴더»로 내려오고,
 *      그때는 네트워크를 안 타고 그 폴더에서 가져온다.
 *
 * 규율 셋 — 이걸 어기면 도구가 사고를 낸다:
 *   ① 기억이 «이미» 있으면 아무것도 안 한다. 덮지 않는다.
 *      (실측 08-26: 동기화가 주기라 로컬엔 아직 안 밀린 기억이 늘 몇 벌 있다. 덮으면 그게 사라진다.
 *       주기 값은 여기 안 적는다 — 정본은 Task Scheduler 의 SYNK_MemoryPush 트리거다.)
 *   ② 실패해도 세션을 막지 않는다. 종료코드는 언제나 0.
 *   ③ 데려온 그 세션부터 바로 붙게, MEMORY.md 색인을 훅 출력으로 뿜는다.
 *
 * ⚠ 이 파일에는 역슬래시를 한 글자도 쓰지 않는다 — 첫 판이 죽은 자리다.
 *   정규식의 역슬래시 문자 클래스가 써 넣는 도중 조용히 사라져, 경로 구분자가 안 지워졌고
 *   기억이 제자리가 아니라 «폴더 트리»로 클론됐다. 구문검사는 통과했다(정규식이 여전히 유효해서).
 *   회귀 = tests/기억데려오기.test.js 가 「이 파일에 역슬래시 0」을 센다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const 원격 = 'https://github.com/unmet23-lab/synk-memory.git';
const 줄바꿈 = String.fromCharCode(10);

/** 작업 폴더 경로 -> Claude Code 가 쓰는 프로젝트 폴더 이름.
 *  영문·숫자·하이픈만 «남기고» 나머지(콜론·구분자·점)는 전부 하이픈으로 바꾼다.
 *  «지울 것»이 아니라 «남길 것»으로 적는다 — 그래야 역슬래시를 쓸 일이 없다.
 *  실측 대조(08-26): C:/Users/q1212/Documents/SYNK-appsscript
 *                 -> C--Users-q1212-Documents-SYNK-appsscript (실물과 일치) */
function 폴더이름(p) {
  return path.resolve(p).replace(/[^A-Za-z0-9-]/g, '-');
}

function 작업폴더() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function 기억자리() {
  return path.join(os.homedir(), '.claude', 'projects', 폴더이름(작업폴더()), 'memory');
}

function 이미있나(dir) {
  try { return fs.existsSync(path.join(dir, 'MEMORY.md')); } catch { return false; }
}

/** 이 기계 어딘가에 synk-memory 가 «이미» 내려와 있나.
 *  원격 세션의 유일한 길이다 — 거기엔 gh 도 private 인증도 없다.
 *  실측 08-26: 원격 세션의 작업 폴더는 /home/user/synk-appsscript 무늬였다. */
function 형제기억() {
  const 후보 = [
    path.resolve(작업폴더(), '..', 'synk-memory'),
    path.join(os.homedir(), 'synk-memory'),
    '/home/user/synk-memory',
  ];
  for (const c of 후보) { if (이미있나(c)) return c; }
  return null;
}

/** gh CLI 가 이 세션에 있나 — 처방을 가르는 유일한 갈림길이다. */
function gh있나() {
  try { execFileSync('gh', ['--version'], { stdio: 'ignore', timeout: 5000 }); return true; }
  catch { return false; }
}

function 처방줄들() {
  if (gh있나()) {
    return ['   👉 private 저장소다. `gh auth login` 한 번이면 다음 세션부터 스스로 온다.'];
  }
  return [
    '   👉 이 세션엔 gh CLI 가 없다 — 원격(claude.ai/code) 세션으로 보인다.',
    '      입력창 위 「+ 레포 선택」에서 unmet23-lab/synk-memory 를 «함께» 붙이면',
    '      형제 폴더로 내려오고, 이 도구가 다음 세션부터 그것을 쓴다.',
  ];
}

function main() {
  const 훅 = process.argv.includes('--훅');
  const 자리 = 기억자리();

  if (이미있나(자리)) {
    if (!훅) { console.log('기억은 이미 제자리에 있다 — ' + 자리); }
    /* 🧠 기억 위생 한 줄 (2026-08-30 · 유호 지시 「철학정본에 빗댄 완벽히 자동화」).
     * 왜 «여기»인가: 이 훅은 SessionStart 에 이미 배선돼 있고, 기억이 제자리면 지금까지
     * «0줄을 찍고 return» 했다 — 화면 예산이 비어 있는 유일한 칸이다. settings.json 을 한 글자도
     * 안 고치고 매 세션 자동으로 돈다.
     * ⚠ 자는 여기 없다 — `memory-graph.js` 가 쥔다. 여기는 «부르기만» 한다.
     *   (rot-check.js 가 열리면 그쪽으로 옮기는 것이 정본 Ⅰ-9 문면에 더 맞다 — 트랙에 남겼다.)
     * ⚠ 이 파일엔 역슬래시를 한 글자도 못 쓴다(회귀가 0개를 센다) — 그래서 정규식·경로 조립은
     *   전부 memory-graph 안에 두고 여기서는 require 와 출력만 한다. */
    try {
      console.log(require('./memory-graph.js').위생훅줄());
    } catch (e) {
      console.log('🧠 기억 위생 — 확인 불가(자를 부르지 못했다): ' + String(e.message || e));
    }
    return;                                    // 규율① — 덮지 않는다
  }

  const 형제 = 형제기억();                       // 있으면 네트워크를 안 탄다
  try {
    fs.mkdirSync(path.dirname(자리), { recursive: true });
    execFileSync('git', ['clone', '--quiet', 형제 || 원격, 자리], {
      stdio: ['ignore', 'ignore', 'pipe'], timeout: 90000,
    });
    if (형제) {
      // origin 이 형제 폴더를 가리킨 채로 두면 그 세션에서 민 기억이 아무 데도 안 간다.
      try {
        execFileSync('git', ['-C', 자리, 'remote', 'set-url', 'origin', 원격], { stdio: 'ignore' });
      } catch { /* 못 돌려놔도 읽기는 된다 — 막지 않는다 */ }
    }
  } catch (e) {
    const 사유 = String(e.stderr || e.message || e).trim().slice(-200);
    console.log('🧠 기억을 데려오지 못했다 — 이 세션은 «백지»다(기억이 없는 게 아니라 못 찾은 것이다).');
    console.log('   자리 : ' + 자리);
    console.log('   사유 : ' + 사유);
    for (const 줄 of 처방줄들()) { console.log(줄); }
    return;                                    // 규율② — 막지 않는다
  }

  let 본문 = '';
  try { 본문 = fs.readFileSync(path.join(자리, 'MEMORY.md'), 'utf8'); } catch { /* 벌수만 낸다 */ }

  let 벌수 = 0;
  try { 벌수 = fs.readdirSync(자리).filter(f => f.endsWith('.md')).length; } catch { /* 무시 */ }

  const 어디서 = 형제 ? '형제 폴더에서' : 'GitHub 에서';
  console.log('🧠 기억 ' + 벌수 + '벌을 ' + 어디서 + ' 데려왔다 — 이 기계는 처음이었다.');
  if (본문) {
    console.log('   아래는 색인이다. 상세는 토픽 파일이 쥔다.' + 줄바꿈);
    console.log(본문);
  }
}

/* 시험이 require 해도 «클론이 일어나면 안 된다» — 그래서 실행은 이 가드 안에서만 한다. */
if (require.main === module) {
  try { main(); } catch (e) {
    console.log('🧠 기억데려오기가 스스로 넘어졌다 — 세션은 계속된다. (' + String(e.message || e) + ')');
  }
  process.exitCode = 0;                        // 규율② — 항상 0
}

module.exports = { 폴더이름, 기억자리, 형제기억 };   // 회귀시험이 부르는 자리
