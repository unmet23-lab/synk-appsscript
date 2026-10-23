'use strict';
/**
 * 장부올리기 — 공용 작업본에서 도구가 추적 파일(장부·요약)에 쓴 결과를 그 경로만 곧바로 origin에 올린다(2026-10-21).
 *
 * 공용 작업본은 origin을 따라가기만 하는 곳이다(작업 방식 v2). 거기서 도는 예약 작업·세션이 부른 도구가 장부에 줄을 쓰고 커밋하지 않으면
 * 미커밋이 다시 쌓여 따라가기가 막히고, 장부를 읽는 CI·다른 작업본은 그 줄을 못 본다(10-21 정리 때 몽골어 검문 장부 23줄·채널성과 23줄).
 * 그래서 결과를 쓴 도구가 이 함수로 tools/바로올리기.js(공용 작업본 모드)를 불러 그 경로만 올린다.
 *
 *   const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
 *   const r = await 장부올리기(['docs/_ops/몽골어검문.jsonl'], 'chore(장부): …');
 *   const 줄 = 장부올리기글(r, '검문 장부');
 *   if (줄) console.log(줄);
 *
 * - 워크트리(세션마다 따로 쓰는 작업본)에서는 하지 않는다 — 그 세션이 제 커밋에 같이 올린다.
 * - 운영 사본(예약 작업이 도는 origin 판 사본, tools/운영사본.js)에서는 공용 작업본처럼 그 자리에서 올린다(2026-10-22) —
 *   남겨 두면 그 사본이 origin을 따라가지 못하고, 운영 사본 갱신이 다음 회차에 다시 올린다.
 * - 환경 SYNK_장부올리기: 「끔」이면 하지 않는다. 「나중」이면 하지 않고, 자식으로 여러 번 부른 묶음 실행기가 끝에 한 번 올린다
 *   (tools/몽골어출구.js --태우기 · tools/검수표검문.js · evals/검문커버리지.js).
 * - node --test 안(NODE_TEST_CONTEXT)에서는 저장소를 따로 주지 않으면 하지 않는다 — 시험이 실제 origin에 올리지 않게.
 * - 올리지 못해도(오프라인·꼬리·남의 스테이징·검사) 도구를 실패시키지 않는다. 장부는 작업본에 남고 다음에 올릴 때 같이 올라간다.
 *   그동안 공용 작업본 따라가기는 .jsonl 장부의 같은 자리 덧붙임을 합친다(tools/내커밋.js 장부덧붙이기).
 * 시험: node --test tests/장부올리기.test.js
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { holdResult } = require('./ledger-publish-policy.cjs');

const 뿌리 = path.resolve(__dirname, '..', '..');

/** 메인 작업본(여러 세션이 같이 쓰는 공용 작업본)인가 — git 폴더가 공용 git 폴더와 같다. 워크트리·저장소 밖이면 false */
function 공용작업본인가(저장소) {
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { cwd: 저장소, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return false;
  const [git폴더, 공용폴더] = String(r.stdout).trim().split(/\r?\n/);
  return Boolean(git폴더 && 공용폴더) && path.resolve(git폴더) === path.resolve(공용폴더);
}

/** 운영 사본인가 — 운영사본.js가 없는 옛 사본에서만 false. 그 밖의 오류는 던진다(못 올린 채 조용히 건너뛰지 않게) */
function 운영사본인가(저장소) {
  let 운영;
  try { 운영 = require('../운영사본.js'); } catch (e) { if (e && e.code === 'MODULE_NOT_FOUND') return false; throw e; }
  return 운영.운영사본인가(저장소);
}

/**
 * 경로들(저장소 기준)을 바로올리기로 올린다. → 바로올리기 결과({결과:'올림'|'올릴 것 없음'|'멈춤'|…})
 * 또는 {결과:'건너뜀'|'미룸'|'실패', 이유}. 던지지 않는다.
 */
async function 장부올리기(경로들, 메시지, { 저장소, 환경 = process.env } = {}) {
  const 보류 = holdResult(환경, Boolean(저장소));
  if (보류) return 보류;
  const 곳 = 저장소 || 뿌리;
  let 운영;
  try { 운영 = !공용작업본인가(곳) && 운영사본인가(곳); } catch (e) { return { 결과: '실패', 이유: `운영 사본인지 가리지 못했다 — ${e.message}` }; }
  if (!운영 && !공용작업본인가(곳)) return { 결과: '건너뜀', 이유: '워크트리 — 그 세션이 제 커밋에 같이 올린다' };
  let r;
  try {
    // 운영 사본(무인 예약 작업)은 공용 작업본에 쓰지 않는다 — 세션들의 push가 공용 작업본을 따라가게 한다
    r = await require('../바로올리기.js').올리기({ 저장소: 곳, 경로들, 메시지, 실행: true, ...(운영 ? { 공용안따라감: true } : {}) });
  } catch (e) {
    r = { 결과: '실패', 이유: e.이유 || e.message };
  }
  // 운영 사본에서 못 올린 기록은 운영 사본 갱신이 다음 회차에 다시 올린다(올렸으면 그 목록에서 지운다)
  if (운영) { try { require('../운영사본.js').남은장부적기(경로들, r); } catch {} }
  return r;
}

/** 사람이 볼 한 줄. 할 말이 없으면(이미 origin에 있음·미룸·시험·끔) null */
function 장부올리기글(r, 이름 = '장부') {
  if (!r || r.결과 === '올릴 것 없음' || r.결과 === '미룸') return null;
  if (r.결과 === '올림') {
    const 따라 = r.따라가기 && r.따라가기.결과 !== '따라감'
      ? ` · 공용 작업본은 따라가지 않았다(${r.따라가기.결과}${r.따라가기.이유 ? `: ${String(r.따라가기.이유).slice(0, 120)}` : ''})` : '';
    return `   ${이름} → origin ${String(r.머리 || '').slice(0, 9)}${r.원격확인 ? ' ✓' : ''}${따라}`;
  }
  if (r.결과 === '건너뜀') return /워크트리/.test(r.이유 || '') ? `   ${이름}: 워크트리라 여기서 올리지 않았다 — 이 세션 커밋에 같이 올린다` : null;
  return `   ⚠ ${이름} — origin에 올리지 못했다(${r.결과}: ${String(r.이유 || '').slice(0, 200)}). 작업본에 남았고 다음에 올릴 때 같이 올라간다`;
}

module.exports = { 장부올리기, 장부올리기글, 공용작업본인가 };
