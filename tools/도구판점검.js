#!/usr/bin/env node
'use strict';
/* 도구 판 점검 — 「우리가 쓰는 도구가 뒤졌나」를 스스로 세는 자.
 *
 * ■ 왜 있나 (2026-09-03 · 유호님 「뭘 더 업그레이드 할 수 있는 거는 없는거야?」)
 *   그날 손으로 재보니 셋이 뒤져 있었다. 그중 clasp 3.3.0 은 그냥 낡은 게 아니라
 *   **배포되는 꾸러미 안에 구글 로그인 비밀값이 박혀 있던 판**이었다(구글이 3.4.0 에서 걷어냄 · CWE-798).
 *   즉 「뒤짐」이 조용히 «안전»에 걸려 있었고, 아무도 안 물었으면 계속 그대로였다.
 *   ⇒ 사람이 물어야만 재지던 자리를 기계로 옮긴다.
 *
 * ■ 무엇을 재나
 *   ① 클로드 하네스 — 깔린 판 vs 설치처가 내놓는 최신(자동 갱신이 막히면 여기서 드러난다)
 *   ② 전역 도구      — clasp(배포 통로) · codex(이종 검수) · gemini-cli(몽골어 검문)
 *   ③ 이 저장소 꾸러미 — package.json 이 거느린 것들
 *
 * ■ 하지 «않는» 것
 *   🚫 **자동으로 올리지 않는다.** clasp 판올림은 배포 통로를 건드리고, 큰 판올림은
 *      「지우는 범위」 같은 동작까지 데려온다(3.4.0 이 그랬다). 알리기만 하고 판단은 사람이 한다.
 *   🚫 **막지 않는다.** 네트워크가 안 되면 조용히 넘어간다 — 「0건」이 아니라 「못 쟀다」로 적는다.
 *   🚫 **세션 시작을 붙잡지 않는다.** --훅 은 «캐시만» 읽어 즉시 끝내고,
 *      실제 대조는 뒤에서 따로 돈다. npm 에 묻는 데 수십 초가 걸리기 때문이다.
 *
 * ■ 쓰는 법
 *     node tools/도구판점검.js         ← 지금 전량 대조(네트워크를 쓴다 · 수십 초)
 *     node tools/도구판점검.js --훅     ← 세션 시작용. 캐시를 보여주고, 낡았으면 뒤에서 새로 잰다
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

/* 결과도 「잰 때」도 저장소 «밖»에 둔다. 저장소에 적으면 훅이 돌 때마다 미커밋이 하나 떠서
 * 다음 세션이 배포 1단계에서 「남의 변경인가」를 헛센다(스킬판점검이 같은 이유로 밖에 뒀다).
 * ⚠ 지워지면 한 번 더 재기만 한다 — 무해한 실패다. */
const 결과경로 = path.join(os.tmpdir(), 'synk-도구판-결과.json');
const 조용한시간 = 20; // 이만큼 안에 쟀으면 다시 안 잰다

const 저장소뿌리 = path.resolve(__dirname, '..');
const npm명령 = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function 셸(명령, 인자, 옵션 = {}) {
  try {
    return execFileSync(명령, 인자, {
      encoding: 'utf8', timeout: 옵션.제한 || 90000,
      cwd: 옵션.자리 || 저장소뿌리, stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    }).trim();
  } catch (e) {
    // npm outdated 는 «뒤진 게 있으면» 1 로 끝난다 — 실패가 아니라 결과다
    if (e.stdout) return String(e.stdout).trim();
    return null; // 진짜 못 쟀다
  }
}

/* ── 재기 ───────────────────────────────────────────────────────────── */

/* 🔴 클로드 코드는 이 기계에 «두 벌» 산다(09-05 실측 · Win32_Process 로 셈).
 *   · 터미널 CLI  = PATH 의 `claude`(~/.local/bin) — `claude update` 가 올린다.
 *   · 데스크톱 앱 내장 = `%APPDATA%\Claude\claude-code\<판>\claude.exe` — **유호님 세션(Code 탭)은 전부 이걸로 돈다**.
 *     앱이 스스로 올리고 `claude update` 는 못 건드린다.
 *   09-05 전까지 이 자는 터미널 CLI 하나만 재서 「2.1.259 → 2.1.260 · 자동 갱신이 막혔을 수 있다」고 울렸는데,
 *   그때 실제 세션은 이미 2.1.260 이었다 — **자가 다른 벌을 재고 있었다.** 둘을 따로 재고 따로 말한다. */
const 데스크톱폴더 = process.env.APPDATA ? path.join(process.env.APPDATA, 'Claude', 'claude-code') : null;

/** 폴더 이름 중 가장 높은 판. 폴더가 없거나 판 모양이 하나도 없으면 null(«안 깔림»이 아니라 «못 봤다»). 순수 함수 — 시험이 가짜 폴더로 잰다. */
function 데스크톱내장판(폴더) {
  let 이름들;
  try { 이름들 = fs.readdirSync(폴더); } catch { return null; }
  const 판들 = 이름들.filter((n) => /^\d+\.\d+\.\d+$/.test(n));
  if (!판들.length) return null;
  const 수 = (v) => v.split('.').map(Number);
  판들.sort((a, b) => { const x = 수(a), y = 수(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; });
  return 판들[0];
}

function 하네스재기() {
  const 깔린 = 셸('claude', ['--version'], { 제한: 30000 });
  const 최신 = 셸(npm명령, ['view', '@anthropic-ai/claude-code', 'version']);
  if (!깔린 || !최신) return null; // 못 쟀다
  const m = 깔린.match(/(\d+\.\d+\.\d+)/);
  const cli = m ? m[1] : 깔린;
  const 앱 = 데스크톱폴더 ? 데스크톱내장판(데스크톱폴더) : null;
  return { 깔린: cli, 앱, 최신, 뒤짐: cli !== 최신, 앱뒤짐: 앱 !== null && 앱 !== 최신 };
}

function outdated재기(전역) {
  const 인자 = ['outdated', '--json'];
  if (전역) 인자.push('-g');
  const 원문 = 셸(npm명령, 인자, { 제한: 180000 });
  if (원문 === null) return null; // 못 쟀다
  if (!원문) return []; // 0건 — 전부 최신
  let d;
  try { d = JSON.parse(원문); } catch { return null; }
  return Object.entries(d).map(([이름, v]) => ({
    이름, 지금: v.current || '?', 최신: v.latest || '?',
  })).filter((r) => r.지금 !== r.최신);
}

function 전량대조() {
  const 결과 = {
    시각: new Date().toISOString(),
    하네스: 하네스재기(),
    전역: outdated재기(true),
    저장소: outdated재기(false),
  };
  try { fs.writeFileSync(결과경로, JSON.stringify(결과), 'utf8'); } catch { /* 못 적어도 출력은 낸다 */ }
  return 결과;
}

/* ── 말하기 ─────────────────────────────────────────────────────────── */

// 「못 쟀다」(null)와 「0건」(빈 배열)을 반드시 갈라서 말한다 — 둘이 같은 얼굴이 되면 이 자가 거짓말을 한다.
function 말짓기(결과, 짧게) {
  const 줄 = [];
  const 못잰것 = [];

  if (결과.하네스 === null) 못잰것.push('하네스');
  else if (결과.하네스.뒤짐 || 결과.하네스.앱뒤짐) {
    /* 두 벌을 «따로» 말한다 — 어느 벌이 뒤졌는지 모르면 `claude update` 를 쳐도 세션 판이 안 바뀌어 헛돈다(09-05). */
    const h = 결과.하네스;
    const cli말 = h.뒤짐 ? `터미널 CLI ${h.깔린} → ${h.최신}(자동 갱신이 막혔을 수 있다 · \`claude update\`)` : `터미널 CLI ${h.깔린}(최신)`;
    const 앱말 = h.앱 == null
      ? '데스크톱 앱 내장 판은 못 봤다'
      : (h.앱뒤짐 ? `데스크톱 앱 내장 ${h.앱} → ${h.최신}(유호님 세션이 도는 벌 · 앱이 스스로 올린다 · \`claude update\` 로는 안 올라간다)` : `데스크톱 앱 내장 ${h.앱}(최신 · 유호님 세션이 도는 벌)`);
    줄.push(`🔺 **클로드 하네스** — ${cli말} · ${앱말}`);
  }

  if (결과.전역 === null) 못잰것.push('전역 도구');
  else if (결과.전역.length) {
    const 목록 = 결과.전역.map((r) => `${r.이름} ${r.지금}→${r.최신}`).join(' · ');
    줄.push(`🔺 **전역 도구 ${결과.전역.length}** — ${목록}`);
  }

  if (결과.저장소 === null) 못잰것.push('저장소 꾸러미');
  else if (결과.저장소.length) {
    const 앞 = 결과.저장소.slice(0, 4).map((r) => `${r.이름} ${r.지금}→${r.최신}`).join(' · ');
    const 꼬리 = 결과.저장소.length > 4 ? ` 외 ${결과.저장소.length - 4}` : '';
    줄.push(`🔺 **저장소 꾸러미 ${결과.저장소.length}** — ${앞}${꼬리}`);
  }

  if (!줄.length && !못잰것.length) return null; // 0건이면 완전 침묵

  const 머리 = [];
  if (줄.length) {
    머리.push('🔺 **판이 뒤진 도구가 있다**(알림 · 막지 않는다):');
    머리.push(...줄.map((l) => '   ' + l));
    머리.push('   ↳ 올릴지는 유호님이 정하신다 — 배포 통로(clasp)는 판올림이 동작까지 데려온 적이 있다');
  }
  if (못잰것.length) {
    머리.push(`   ⚠ ${못잰것.join(' · ')} 는 **못 쟀다**(네트워크·npm) — 이건 「최신」이 아니라 «확인 불가»다`);
  }
  if (!짧게) 머리.push(`   ↳ 잰 때: ${new Date(결과.시각).toLocaleString('ko-KR')}`);
  return 머리.join('\n');
}

module.exports = { 데스크톱내장판, 말짓기 };

/* ── 들머리 ─────────────────────────────────────────────────────────── */

if (require.main === module) {
  const 훅모드 = process.argv.includes('--훅');

  if (!훅모드) {
    const 결과 = 전량대조();
    const 말 = 말짓기(결과, false);
    console.log(말 || '✅ 도구 판 — 뒤진 것 0건(하네스 · 전역 도구 · 저장소 꾸러미 전부 최신)');
    process.exit(0);
  }

  // --훅 : 캐시를 읽어 «즉시» 끝낸다. 세션 시작을 네트워크에 매달지 않는다.
  let 캐시 = null;
  try { 캐시 = JSON.parse(fs.readFileSync(결과경로, 'utf8')); } catch { /* 아직 잰 적 없다 */ }

  if (캐시) {
    const 말 = 말짓기(캐시, true);
    if (말) console.log(말);
  }

  const 낡았나 = !캐시 || (Date.now() - new Date(캐시.시각).getTime()) > 조용한시간 * 3600 * 1000;
  if (낡았나) {
    // 뒤에서 새로 잰다 — 결과는 «다음» 세션이 본다. 지금 세션은 기다리지 않는다.
    try {
      spawn(process.execPath, [__filename], { detached: true, stdio: 'ignore', cwd: 저장소뿌리 }).unref();
    } catch { /* 못 띄워도 세션 시작을 막지 않는다 */ }
  }
  process.exit(0);
}
