#!/usr/bin/env node
/* html-script-check — 저장소 HTML의 인라인 <script>가 **실제로 살아 있는지** 검사한다.
 *
 * 왜 있나 (마찰 F047, 2026-08-04):
 *   크루카드 제출 버튼이 죽어 있었는데 **회귀 10건이 전부 초록**이었다. 원인은
 *   「주석 안에 스크립트 종료 태그를 문자로 써서 HTML 파서가 블록을 거기서 끊은 것」이라,
 *   문자열 존재 검사(`html.includes('submit')`)로는 **원리적으로 못 잡는다** — 문자열은
 *   그대로 파일에 있고, 죽은 건 실행이다.
 *   옆 세션이 crewcard 2파일에 파싱 회귀를 넣었고(353d5c4), 이 파일은 그걸 **저장소 전체로
 *   일반화**한 것이다(인수인계 — `docs/tools/*.html` 등 나머지는 검사 밖이었다).
 *
 * 검사 2종:
 *   ① 인라인 블록이 **파싱되는가**(`new Function`) — 끊긴 블록은 대개 괄호가 안 맞아 여기서 걸린다
 *   ② `<script` 와 `</script>` **개수가 맞는가** — 종료 태그가 주석·문자열 안에 있으면
 *      브라우저가 거기서 블록을 끝내고 뒤쪽 진짜 종료 태그가 붕 뜬다(F047의 지문)
 *
 * ⚠ 파일 목록은 `-c core.quotepath=false` 로 받는다. 기본값은 비ASCII 경로를 8진 이스케이프로
 *   따옴표 씌워 내놓아서 **한글 파일명 12/17이 조용히 빠진다** — 이 탐침을 처음 짤 때 실제로
 *   그렇게 「전부 통과」가 나왔다. 검사에서 조용히 빠지는 것이 통과와 같은 모양이면 안 된다.
 *
 * 사용: node tools/html-script-check.js        (문제 있으면 종료코드 1)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** 인라인(=src 없는) 스크립트 블록만. type이 JS가 아닌 템플릿 블록은 건너뛴다. */
function inlineBlocks(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((m) => !/\bsrc\s*=/i.test(m[1]))
    .filter((m) => !/type\s*=\s*["'](?!text\/javascript|module)/i.test(m[1]));
}

/** 한 파일의 문제 목록. 빈 배열 = 이상 없음. */
function checkHtml(html, label) {
  const problems = [];
  const opens = (html.match(/<script\b/gi) || []).length;
  const closes = (html.match(/<\/script\s*>/gi) || []).length;
  if (opens !== closes) {
    problems.push(`${label}: <script> ${opens}개 · </script> ${closes}개 — 개수가 안 맞는다. ` +
      '종료 태그가 주석·문자열 안에 있으면 파서가 블록을 거기서 끊는다(F047).');
  }
  inlineBlocks(html).forEach((m, i) => {
    try { new Function(m[2]); }
    catch (e) { problems.push(`${label} 블록#${i}: 파싱 실패 — ${String(e.message).split('\n')[0]}`); }
  });
  return problems;
}

function listHtml(root) {
  return execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '*.html'],
    { cwd: root, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

function checkRepo(root) {
  const files = listHtml(root);
  const problems = [];
  let withScript = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    if (inlineBlocks(html).length) withScript++;
    problems.push(...checkHtml(html, f));
  }
  return { files: files.length, withScript, problems };
}

module.exports = { checkHtml, checkRepo, inlineBlocks, listHtml };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const r = checkRepo(root);
  r.problems.forEach((p) => console.error('  X ' + p));
  console.log(`[html-script-check] ${r.files}파일 · 인라인 스크립트 ${r.withScript} · 문제 ${r.problems.length}`);
  process.exit(r.problems.length ? 1 : 0);
}
