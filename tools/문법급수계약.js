#!/usr/bin/env node
/**
 * `계약/문법급수_계약.json` 생성기 — 뱅크(정본) → 계약 파일(파생).
 *
 * ■ 왜 있나 — 급수를 **두 곳에 적지 않으려고**
 *   TOPIK 급수의 정본은 `엔진_콘텐츠AI.js` 의 `GRAMMAR_BANK` 칸 4·5·6 하나다(v9.218).
 *   그런데 그 값을 실제로 쓸 자리는 형제 저장소(SYNK-talk)의 문항팩·배정이다 —
 *   저장소가 둘이라 서로의 CI 가 상대를 못 본다(`tests/계약.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 머리말과 같은 층).
 *   손으로 옮기면 언젠가 한 급이 어긋나고, **어긋난 급수 태그는 화면에 아무 표시도 안 낸다**
 *   (「Lv3 학생에게 1급 문항만 나가는」 상태 — `tests/문법급수.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 가 이미 적어 둔 그 실패).
 *   그래서 사람이 옮기지 않는다: 뱅크를 고치면 이 도구가 계약을 다시 뽑고, 회귀가 갈라짐을 잡고,
 *   `tools/계약동기화.js` 가 형제에 같은 바이트로 넣는다.
 *
 * ■ 🔑 왜 `수집_교정_계약.json` 에 절을 더하지 않았나 (분리 반박에서 살아남은 갈래)
 *   그 계약의 판올림은 **DB CHECK 14개 개명과 한 벌**이다(c10→c11 실측 · 대기열 Lane B).
 *   급수 태그는 CHECK 를 하나도 건드리지 않는데, 한 파일에 얹으면 문형 하나 옮길 때마다
 *   그 대가를 치르게 된다 — 그러면 **아무도 안 옮기고 계약이 낡는다**. 값의 수명이 다르면
 *   파일도 갈라 둔다(L0 §463 이 `role` 값목록을 뺀 것과 같은 판단, 반대 방향).
 *
 * ■ 이 도구가 **안** 하는 것
 *   · 어느 문형이 몇 급인지 판정 — 교육 영역이고 정본은 커리큘럼 §3 요목이다.
 *   · `STORY_GRAMMAR` 96문형 실기 — 그건 **출제 풀**(`급수문형풀_`)이고 급수 «정본»이 아니다.
 *     계약에 섞으면 게이트 축(뱅크 72)과 골격 축이 한 목록이 된다(엔진 주석 §급수문형풀_ 의 🔑).
 *
 * 쓰는 법:
 *   node tools/문법급수계약.js           계약 파일을 다시 뽑는다
 *   node tools/문법급수계약.js --check   갈라졌으면 종료코드 1 (고치지 않는다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, 뱅크읽기 } = require('./lib/문법뱅크.js');
/* 파일을 «검사 대상으로» 읽는 문 — 읽으면서 두 축(CRLF·줄끝 공백)을 접는다. 손으로 접으면
 * CRLF 축만 막힌다(도구층 실측 08-17: 손 접기 12벌 전부가 그 반쪽 · #Q101). */
const { 파일소스 } = require('../tests/lib/소스검사.js');

const 상대경로 = path.join('계약', '문법급수_계약.json');
const 계약경로 = path.join(ROOT, 상대경로);

/** 계약 판 — **뱅크 칸 규격**이 바뀔 때만 올린다(값이 바뀔 때가 아니다 · 소비자 코드가 깨지는 축). */
const 판 = 'g1';

/** 뱅크에서 계약 객체를 짓는다(순수 — 파일을 안 쓴다). 순서는 뱅크 순서 그대로다. */
function 계약짓기(소스) {
  const { GRAMMAR_BANK, LEVEL_TOPIK_BAND } = 뱅크읽기(소스);
  return {
    이름: '문법 급수 계약 — TOPIK 도입급·재출현급',
    판,
    정본: 'SYNK-appsscript `엔진_콘텐츠AI.js` GRAMMAR_BANK · LEVEL_TOPIK_BAND',
    생성: 'node tools/문법급수계약.js — **손으로 고치지 않는다**(다음 생성에서 통째로 덮인다)',
    근거뜻: { 요: '커리큘럼 정본 §3 문법 요목에 그 문형이 직접 있다', 표: '요목 밖 — 국제통용 표준 배정(교재 6권 확정 시 재검토 대상)' },
    읽는_법: '도입급 = 처음 다루는 TOPIK 급(1~5 · 6급 반은 열지 않는다) · 재출현급 = 상위 급 심화·복습(없으면 null)',
    레벨밴드: LEVEL_TOPIK_BAND,
    문법: GRAMMAR_BANK.map((g) => ({ id: g[0], 이름: g[1], 도입급: g[3], 재출현급: g[4], 근거: g[5] })),
  };
}

/** 파일에 담기는 정확한 바이트 — LF·2칸 들여쓰기·끝 개행(형제는 언제나 LF다). */
function 계약글(소스) {
  return `${JSON.stringify(계약짓기(소스), null, 2)}\n`;
}

function main(argv) {
  const check = argv.includes('--check');
  const 새글 = 계약글();
  const 옛글 = fs.existsSync(계약경로) ? 파일소스(계약경로) : null;

  if (옛글 === 새글) {
    console.log(`문법 급수 계약 최신 ✓ (문법 ${계약짓기().문법.length}개)`);
    return 0;
  }
  if (check) {
    console.error(`계약이 뱅크와 갈라졌다 — \`node tools/문법급수계약.js\` 로 다시 뽑아라\n  파일: ${계약경로}`);
    console.error('  (뱅크를 고쳤으면 형제 저장소까지: node tools/계약동기화.js)');
    return 1;
  }
  fs.mkdirSync(path.dirname(계약경로), { recursive: true });
  fs.writeFileSync(계약경로, 새글, 'utf8');
  console.log(`계약을 다시 뽑았다 → ${계약경로} (문법 ${계약짓기().문법.length}개)`);
  console.log('⚠ 형제 저장소까지 넣어야 계약이 계약이 된다: node tools/계약동기화.js');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { 판, 상대경로, 계약경로, 계약짓기, 계약글, main };
