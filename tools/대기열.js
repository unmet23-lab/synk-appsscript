#!/usr/bin/env node
/* 작업 대기열 조회 — 「다음에 무엇을 집나」를 세션 시작에 3줄로 보여준다.
 *
 * 발단(유호님 질의 2026-08-09): 「새 창에 『이어서 해』만 치면 기획한 게 실행되나?」
 *   실측 답 = **절반**. 세션 시작 훅이 인계문·미커밋·유호님 답 대기까지는 물려주는데,
 *   **다음에 무엇을 지을지의 순서**가 어디에도 없어서 세션마다 다른 것을 집었다.
 *   그 자리를 `docs/_ops/작업대기열.md` 가 채우고, 이 도구가 그걸 세션에 발화한다.
 *
 * 🔑 스스로 발화하지 않는 장치는 안 돈다(CLAUDE.md) — 그래서 조회 명령이 아니라 훅이다.
 *   대신 **세 줄만** 낸다: 세션 시작에 이미 훅 다섯이 말하고 있어, 여기서 길어지면
 *   전부가 소음이 되고 아무도 안 읽는다.
 * 🔑 이미 남이 잡은 것을 추천하지 않는다 — 보드(`lib/보드.js`)와 대조해 걸러 낸다.
 *   대조를 못 하면(파일 없음·파싱 실패) **거르지 않고 그대로 보여주되 그 사실을 밝힌다**:
 *   조용히 빈 목록을 내면 「할 게 없구나」로 읽힌다(초록은 분모와 함께).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
const 대기열경로 = path.join(ROOT, 'docs', '_ops', '작업대기열.md');
const 보일줄수 = 3;

/* 열린 항목 = `- [ ]`. 닫힌 것은 지우는 규약이라 `- [x]` 는 원래 없어야 하지만, 있으면 건너뛴다. */
function 항목들() {
  if (!fs.existsSync(대기열경로)) return null;
  const 줄들 = fs.readFileSync(대기열경로, 'utf8').split(/\r?\n/);
  const 결과 = [];
  let 층 = '';
  for (const 줄 of 줄들) {
    const h = /^##\s+(P\d[^\n]*)/.exec(줄);
    if (h) { 층 = h[1].trim(); continue; }
    const m = /^\s*-\s*\[ \]\s*(.+)$/.exec(줄);
    if (m) 결과.push({ 층, 본문: m[1].trim() });
  }
  return 결과;
}

/* 보드에 이미 선언된 트랙의 글자를 모은다 — 제목 몇 글자가 겹치면 「누가 잡았다」로 본다.
 * 느슨한 매칭이라 거짓양성(안 잡았는데 잡았다고 봄)이 날 수 있는데, 그 방향이 안전하다:
 * 겹쳐서 두 세션이 같은 걸 짓는 사고(F070)가 못 고르는 것보다 비싸다. */
function 보드글자() {
  try {
    const 보드 = require(path.join(ROOT, 'tools', 'lib', '보드.js'));
    const 표 = typeof 보드.읽기 === 'function' ? 보드.읽기() : null;
    if (표) return JSON.stringify(표);
  } catch { /* 아래 폴백 */ }
  try {
    const 디렉 = path.join(ROOT, 'docs', '_ops', '보드');
    return fs.readdirSync(디렉)
      .filter((f) => f.endsWith('.md') && !f.startsWith('유물-'))
      .map((f) => fs.readFileSync(path.join(디렉, f), 'utf8'))
      .join('\n');
  } catch { return null; }
}

/* 항목 제목에서 매칭에 쓸 씨앗을 뽑는다 — 굵게 표기(`**…**`) 안쪽이 트랙 제목에 해당한다. */
function 씨앗(본문) {
  const m = /\*\*(.+?)\*\*/.exec(본문);
  const s = (m ? m[1] : 본문).replace(/[`*]/g, '').trim();
  return s.slice(0, 12);
}

function 출력() {
  const 전체 = 항목들();
  if (전체 === null) {
    console.log(`■ 작업 대기열 — 파일이 없다: ${path.relative(ROOT, 대기열경로)}`);
    return 0;
  }
  const 글자 = 보드글자();
  const 남은 = 글자 === null ? 전체 : 전체.filter((it) => !글자.includes(씨앗(it.본문)));

  if (!전체.length) {
    console.log('■ 작업 대기열 — 열린 항목 0. 새 일감을 찾았으면 docs/_ops/작업대기열.md 에 추가한다.');
    return 0;
  }

  console.log(`■ 작업 대기열 — 다음에 집을 것 (열림 ${전체.length}${글자 === null ? '' : ` · 남이 안 잡은 것 ${남은.length}`})`);
  for (const it of 남은.slice(0, 보일줄수)) {
    console.log(`  · [${it.층.split(' ')[0]}] ${씨앗(it.본문)}${it.본문.length > 12 ? '…' : ''}`);
  }
  if (글자 === null) console.log('  ⚠ 보드를 못 읽어 **남이 잡은 것을 못 걸렀다** — 고르기 전에 node tools/board.js 로 대조한다.');
  else if (!남은.length) console.log('  (전부 누군가 잡았다 — 보드에서 확인하고, 정말 없으면 새 일감을 추가한다)');
  console.log(`  전문: docs/_ops/작업대기열.md — 고르면 **내 보드 파일에 선언**하고 시작한다.`);
  return 0;
}

module.exports = { 항목들, 씨앗 };

if (require.main === module) process.exit(출력());
