#!/usr/bin/env node
// 인계문 — 이 세션의 인계문을 **지금 상태**(커밋·보드 줄·미커밋)로 새로 만들어 출력한다.
//
// stdout 전문 = 새 세션의 첫 메시지(그대로 복붙). 같은 내용을 docs/_ops/인계문.md 에도 갱신한다.
// 쓰는 곳: /close 6단계 · context-budget 🔴 wake ④ · track-boundary 재출력 · 유호님 수동 실행.
//
// 왜 필요한가 (F096 · 2026-08-04 실측):
//   300k 에서 깨워진 AI 가 「창 닫으세요」만 말하고 **복붙할 실물을 화면에 안 냈다.**
//   파일 경로 안내는 그 순간 파일이 오염돼 있으면 같이 무너진다(실측: 안내가 가리킨
//   인계문.md 가 시험이 남긴 가짜 블록 3개였다). 화면에 실물이 있으면 어느 경로
//   (같은 PC 자동 입력·다른 계정·폰)로든 이어진다.
//
// ⚠ stdout 은 인계문 **원문만** 낸다 — 장식·안내가 섞이면 복붙 지시문이 오염된다.
//   부가 정보(사본 경로)는 stderr 로 보낸다.
'use strict';
const path = require('path');
const report = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'session-report.js'));

const cwd = process.cwd();
const sid = report.hostSessionId(''); // 호스트 id — 커밋 트레일러에 박히는 그 값(F074)
const msg = report.buildHandoff(cwd, '', { reason: '세션 정리(/close)' });
const file = report.writeHandoffFile(cwd, msg, { sessionId: sid || '?', reason: '세션 정리' });

process.stdout.write(msg + '\n');
process.stderr.write(file
  ? `[인계문] 사본 갱신: ${file}\n`
  : '[인계문] 사본 파일 갱신 실패 — stdout 출력만 유효하다(복붙 통로는 살아 있다)\n');
