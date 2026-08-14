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
//
// `--no-save` = **화면에만 낸다**(파일을 안 건드린다). 왜 필요한가 (2026-08-05 실측 · F099):
//   막 시작한 세션은 커밋도 보드 줄도 없어 블록이 사실상 빈다("커밋 없음"). 점검하러 돌린
//   그 빈 블록이 목차 맨 위 — 「여기를 복사하라」고 적힌 자리 — 를 차지하면 F096 이 고치려던
//   증상이 그대로 돌아온다. 그래서 **점검·재출력은 `--no-save`**, 실제로 끊을 때
//   (/close ⑥·wake ④)만 파일을 갱신한다.
//   ⚠ 축출 자체는 저장 구조를 세션별 파일로 가르며 끝냈다(F099 본안 · session-report.js).
//     그때까지는 사본이 칸 3개짜리 공유 파일이라, 한 번 돌리는 것만으로 살아있는 옆 세션의
//     인계문이 사라졌다(실측). 이 플래그는 그 뒤로도 **목차를 조용히 흔들지 않기 위해** 남는다.
'use strict';
const path = require('path');
const report = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'session-report.js'));

// 모르는 인자는 실행이 아니라 정지다 — 2026-08-14 실측: `--help` 를 받은 채 그대로 실행돼
// 산 세션의 가짜 「마감」 인계문이 목차 맨 위(「여기를 복사하라」 자리)를 차지했다(F096 증상의
// 새 입구 — 탐색·오타 호출이 곧 파일 쓰기였다). 인자 층에서 막아야 쓰기 층에 안 닿는다.
// 대가: 부르는 쪽이 새 플래그를 먼저 쓰면 거짓 정지 — 방향이 시끄러운 쪽(exit 1)이라 바로 보인다.
const 인자 = process.argv.slice(2);
const 모르는 = 인자.filter((a) => a !== '--no-save');
if (모르는.length) {
  process.stderr.write(`[인계문] 모르는 인자: ${모르는.join(' ')} — 아무것도 안 썼다.\n`
    + '  끊을 때(파일 갱신) = 인자 없이 · 점검(화면만) = --no-save\n');
  process.exit(1);
}
const 사본금지 = 인자.includes('--no-save');

const cwd = process.cwd();
const sid = report.hostSessionId(''); // 호스트 id — 커밋 트레일러에 박히는 그 값(F074)
const msg = report.buildHandoff(cwd, '', { reason: '세션 정리(/close)' });
const file = 사본금지
  ? null
  : report.writeHandoffFile(cwd, msg, { sessionId: sid || '?', reason: '세션 정리' });

process.stdout.write(msg + '\n');
process.stderr.write(사본금지
  ? '[인계문] --no-save — 화면 출력만(내 세션 파일도 목차도 안 건드린다)\n'
  : file
    ? `[인계문] 사본 갱신: ${file}\n`
    : '[인계문] 사본 파일 갱신 실패 — stdout 출력만 유효하다(복붙 통로는 살아 있다)\n');
