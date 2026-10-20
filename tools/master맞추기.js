#!/usr/bin/env node
'use strict';
/**
 * master맞추기 — 은퇴(2026-10-20). 공용 작업본(메인)의 로컬 master 꼬리를 정리해 master가 origin/master의 조상이 됐다.
 * 이제 공용 작업본은 따라가기만 하고, 커밋·push는 tools/바로올리기.js로 한다(공용 문서는 --조각).
 *   origin 최신으로 옮기기: node tools/바로올리기.js 따라가기(미리 보기 → --실행)
 *   꼬리가 다시 생겼으면: docs/현장노트/git_줄끝_잠금.md 「공용 작업본 꼬리 정리」
 * 병합 트리를 셈하던 옛 판(1,751줄·시험 36개)은 이력에 있다: git show 855e68eaa:tools/master맞추기.js
 * (같은 판의 시험 git show 855e68eaa:tests/master맞추기.test.js). 꼬리 정리에서 「합친 트리」를 받을 때만 꺼내 쓴다.
 */
const 안내 = [
  'master맞추기는 은퇴했다(2026-10-20 공용 작업본 로컬 master 꼬리 정리 — master는 origin/master의 조상).',
  '  origin 최신으로 옮기기: node tools/바로올리기.js 따라가기   (미리 보기 → --실행)',
  '  커밋·push:            node tools/바로올리기.js <경로…> -m "…" (공용 문서는 --조각 <경로>=<조각>) → --실행',
  '  꼬리가 다시 생겼으면:  docs/현장노트/git_줄끝_잠금.md 「공용 작업본 꼬리 정리」(옛 판: git show 855e68eaa:tools/master맞추기.js)',
].join('\n');

function main() {
  console.error(안내);
  return 2;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, 안내 };
