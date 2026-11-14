#!/usr/bin/env node
'use strict';
/**
 * 스레드 21시 게시 — Windows 예약 작업 「SYNK 스레드 21시 게시」가 run-hidden.py로 부른다(AI 없음, 2026-11-14).
 *
 * 왜: 이 게시는 Claude 앱 예약 `synk-daily-threads`가 20:52에 하던 일이다. 앱은 예약 회차를 셋까지만 같이 돌려서
 * 제작 회차가 자리를 잡은 날은 스레드가 늦었다(11-09 +130분, 11-12 +66분, 11-14는 사람이 「지금 실행」을 눌러 21:41).
 * 게시 자체는 스크립트가 40초쯤에 끝내는 일이라 앱 자리 밖으로 옮겼다. 유호님 11-14 승인(점검 보고의 「먼저 할 셋」 2번).
 * 앱 예약은 21:38에 떠서 기록(게시결과.json)과 올리기, 게시 뒤 손질을 맡고, 이 예약이 못 올린 날은 지금처럼 받쳐 올린다.
 *
 * 하는 일:
 *   1. 오늘(한국 시각) 슬롯의 yuhobuilds-threads 판이 든 편을 찾는다(운영 사본과 공용 작업본의 docs/마케팅/<편>/게시/준비.json).
 *   2. 그 편마다 최종 확인(tools/lib/최종확인.js)을 본다. 하나라도 「통과」가 아니면 올리지 않는다(11-13 유호님 「응, 고쳐」).
 *   3. 모두 통과면 ego로 th-post.mjs를 한 번 돌린다. 그 스크립트는 이미 올라간 글이 있으면 스스로 멈추고,
 *      글과 영상과 AI 레이블을 다시 읽어 맞을 때만 「게시」를 한 번 누른다. 로그인이 풀려 있으면 로그인하지 않고 멈춘다.
 *   4. 결과 한 줄을 git 밖 파일(~/ego/threads-daily/예약결과.jsonl)에 덧붙인다. 저장소에는 쓰지 않는다.
 *      게시결과.json 기록과 올리기는 21:38 앱 회차가 한다.
 *
 *   node tools/스레드예약/게시.js            정해진 창(20:55~23:59)에서만 돈다
 *   node tools/스레드예약/게시.js --확인만    편과 최종 확인만 보고 올리지 않는다(시험, 창 밖에서도 돈다)
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../lib/공용작업본.js');
const 묶음 = require('../lib/게시묶음.js');
const 확인 = require('../lib/최종확인.js');

const 계정 = 'yuhobuilds-threads';
const 창시작 = 20 * 60 + 55;
const 창끝 = 23 * 60 + 59;

function 한국시각(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return { 날짜: `${p.year}-${p.month}-${p.day}`, 분: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}

/** 오늘 슬롯의 스레드 판이 든 편 폴더들. 앞 뿌리가 먼저다(같은 이름은 한 번). */
function 오늘편(뿌리들, 날짜) {
  const 본 = new Set();
  const 편들 = [];
  for (const 뿌리 of 뿌리들) {
    const root = path.join(뿌리, 'docs', '마케팅');
    let 이름들 = [];
    try { 이름들 = fs.readdirSync(root); } catch { continue; }
    for (const d of 이름들) {
      if (본.has(d)) continue;
      const f = path.join(root, d, '게시', '준비.json');
      let j;
      try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
      본.add(d);
      const 판 = [].concat(j.판 || []).find((x) => x && x.계정 === 계정 && String(x.시각 || '').startsWith(날짜));
      if (판) 편들.push({ 편: d, 고칠것: Boolean(j.검사 && j.검사.결과 === '고칠 것') });
    }
  }
  return 편들;
}

/** 편마다 최종 확인을 본다. 영상은 git 밖이라 공용 작업본의 편 폴더로 본다. */
function 최종확인판정(편들, 공용) {
  return 편들.map((e) => {
    if (e.고칠것) return { ...e, 막힘: '올리기 전 검사 「고칠 것」' };
    try {
      const bundle = 묶음.load(path.join(공용, 'docs', '마케팅', e.편));
      if (!확인.required(bundle.prep)) return { ...e, 막힘: '' };
      return { ...e, 막힘: 확인.problem(bundle) || '' };
    } catch (error) {
      return { ...e, 막힘: `편을 읽지 못함: ${String(error && error.message).slice(0, 120)}` };
    }
  });
}

function 마지막json(글) {
  const 줄들 = String(글 || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (let i = 줄들.length - 1; i >= 0; i--) {
    /* ego가 줄 앞에 보이지 않는 글자를 붙여 내는 때가 있어 첫 「{」부터 읽는다(11-14 첫 실행에서 already 줄을 못 읽었다). */
    const 시작 = 줄들[i].indexOf('{');
    if (시작 < 0) continue;
    try { return JSON.parse(줄들[i].slice(시작)); } catch { /* 다음 줄 */ }
  }
  return null;
}

function 판정({ 날짜, 분, 편들, 확인만 }) {
  if (!확인만 && (분 < 창시작 || 분 > 창끝)) return { 올림: false, 결과: '창 밖', 까닭: '20:55~23:59에만 돈다' };
  if (!편들.length) return { 올림: false, 결과: '오늘 편 없음', 까닭: 날짜 };
  const 막힌 = 편들.filter((e) => e.막힘);
  if (막힌.length) return { 올림: false, 결과: '최종 확인 전', 까닭: 막힌.map((e) => `${e.편}(${e.막힘})`).join(', ') };
  return { 올림: !확인만, 결과: 확인만 ? '확인만 — 올릴 수 있음' : '올림' };
}

function main(argv) {
  const 확인만 = argv.includes('--확인만');
  const 집 = os.homedir().replace(/\\/g, '/');
  const 자리 = `${집}/ego/threads-daily`;
  const 스크립트 = `${자리}/th-post.mjs`;
  const EGO = path.join(os.homedir(), '.local', 'share', 'ego', 'active_version_dir', 'ego-browser.exe');
  const 운영 = path.resolve(__dirname, '..', '..');
  const 공용 = 공용작업본(운영);
  const { 날짜, 분 } = 한국시각();
  const 시작 = new Date().toISOString();
  const 편들 = 최종확인판정(오늘편([운영, 공용], 날짜), 공용);
  const p = 판정({ 날짜, 분, 편들, 확인만 });
  const 줄 = { 날짜, 시작, 편: 편들.map((e) => e.편), 결과: p.결과, ...(p.까닭 ? { 까닭: p.까닭 } : {}) };
  if (p.올림) {
    if (!fs.existsSync(스크립트) || !fs.existsSync(EGO)) {
      줄.결과 = '실행 파일 없음';
      줄.까닭 = !fs.existsSync(스크립트) ? 스크립트 : EGO;
    } else {
      const r = spawnSync(EGO, ['nodejs', '-e', `await import('file:///${스크립트}')`], { encoding: 'utf8', timeout: 9 * 60 * 1000, windowsHide: true });
      /* ego는 스크립트의 console.log를 표준 오류로 내는 때가 있다(11-14 첫 실행). 둘 다 본다. */
      const j = 마지막json(r.stdout) || 마지막json(r.stderr);
      줄.종료 = r.status;
      줄.출력 = j || String(r.stdout || r.stderr || (r.error && r.error.message) || '').slice(-300);
      줄.결과 = j && j.ok ? '게시됨' : j && j.already ? '이미 올라가 있음' : j && j.reason ? `올리지 못함: ${j.reason}` : '올리지 못함';
      if (j && (j.url || (j.posts && j.posts[0]))) 줄.주소 = j.url || j.posts[0];
    }
  }
  줄.끝 = new Date().toISOString();
  if (확인만) { console.log(JSON.stringify(줄)); return 0; }
  if (p.결과 === '창 밖') { console.log(JSON.stringify(줄)); return 0; }
  try {
    fs.mkdirSync(자리, { recursive: true });
    fs.appendFileSync(`${자리}/예약결과.jsonl`, `${JSON.stringify(줄)}\n`);
  } catch (error) {
    console.error(String(error && error.message));
  }
  console.log(JSON.stringify(줄));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { 한국시각, 오늘편, 최종확인판정, 마지막json, 판정, 계정 };
