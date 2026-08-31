#!/usr/bin/env node
/**
 * 낫표 「 」 교정을 «손으로 스택을 박은» 지면들에 깐다.
 *
 * ■ 왜 이 도구가 필요한가
 *   킷 정본(docs/디자인_토큰.json)과 두 내는 곳(토큰빌드·loom)은 한 자리에서 고치면 되는데,
 *   HTML 지면 다수가 폰트 스택을 **손으로 박아** 두었다(자립형 지면이라 바깥 CSS 를 못 건다).
 *   그래서 이 사본들에도 같은 값을 날라야 한다 — 값은 «여기서» 안 짓고 토큰에서 읽는다.
 *
 * ■ 무엇만 고치는가 — «SUIT 가 낫표를 그리는» 스택만
 *   'Inter Tight' 뒤에 'SUIT' 가 오는 스택이 병이다(Inter Tight 에 U+300C/300D 글리프가 없어
 *   SUIT 가 그리고, SUIT 의 낫표가 0.396em 이라 옆 글자에 붙는다). 뒤가 sans-serif 인 스택은
 *   폴백이 전각으로 그리므로 **안 건드린다.**
 *
 * ■ 안전한 까닭
 *   @font-face 가 없는 지면에서 'SYNK Bracket' 은 그냥 «없는 가족»으로 건너뛰어진다.
 *   그래서 스택만 깔려도 아무것도 안 깨지고, 규칙이 함께 깔리면 그때부터 낫표만 갈린다.
 *
 * 쓰기: node tools/낫표교정_깔기.js [--재본다]   (--재본다 = 고치지 않고 셈만)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 재본다 = process.argv.includes('--재본다');

const 토큰 = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', '디자인_토큰.json'), 'utf8'));
const 규칙 = 토큰.서체.낫표교정;
const 가족 = "'SYNK Bracket'";
if (!규칙 || !규칙.includes('SYNK Bracket')) throw new Error('토큰에 「서체.낫표교정」이 없다 — 정본부터 세운다');

/* 병든 스택: 'Inter Tight' 바로 뒤가 SUIT 계열인 것만. */
const 병든스택 = /'Inter Tight'(\s*,\s*)('SUIT)/g;

/* ⚠ 과녁은 .html 뿐이다 — HTML 을 «내는» JS(Code.js·배너굽기·브랜드킷색상조립·시스템대장·자율기록)는
 *   `<style>` 이 **JS 문자열 안**에 있어, 그 뒤에 줄바꿈을 끼우면 리터럴이 끊겨 파일이 깨진다.
 *   그 다섯은 08-31 에 손으로 박았다. 새 생성기가 생기면 그것도 손으로 박는다. */
const 파일들 = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n').map((s) => s.trim()).filter(Boolean);

const 셈 = { 훑음: 0, 이미: 0, 스택고침: 0, 규칙깔음: 0, 규칙못깔음: [], 고친파일: 0 };

for (const rel of 파일들) {
  const p = path.join(ROOT, rel);
  let 글 = fs.readFileSync(p, 'utf8');
  if (!병든스택.test(글)) { 병든스택.lastIndex = 0; continue; }
  병든스택.lastIndex = 0;
  셈.훑음 += 1;

  if (글.includes('SYNK Bracket')) { 셈.이미 += 1; continue; }

  const 앞 = 글;
  const 바뀐수 = (글.match(병든스택) || []).length;
  병든스택.lastIndex = 0;
  글 = 글.replace(병든스택, `${가족},'Inter Tight'$1$2`);

  /* 규칙은 «스택보다 먼저» 서야 한다 — 첫 <style> 여는 태그 바로 뒤에 한 번만 넣는다. */
  const m = 글.match(/<style[^>]*>/i);
  if (m) {
    const i = 글.indexOf(m[0]) + m[0].length;
    글 = 글.slice(0, i) + '\n' + 규칙 + '\n' + 글.slice(i);
    셈.규칙깔음 += 1;
  } else {
    셈.규칙못깔음.push(rel);       /* 스택만 깔린다 — 안전하되 낫표는 안 갈린다 */
  }

  if (글 !== 앞) {
    셈.스택고침 += 바뀐수;
    셈.고친파일 += 1;
    if (!재본다) fs.writeFileSync(p, 글);
  }
}

console.log(`[낫표교정] 병든 지면 ${셈.훑음} · 이미 깔림 ${셈.이미} · ${재본다 ? '고칠 것' : '고침'} ${셈.고친파일}벌`);
console.log(`           스택 ${셈.스택고침}자리 · @font-face ${셈.규칙깔음}벌`);
if (셈.규칙못깔음.length) {
  console.log(`  ⚠ <style> 이 없어 규칙을 못 깐 지면 ${셈.규칙못깔음.length}벌 — 스택만 깔렸다(안전하되 낫표는 그대로):`);
  for (const f of 셈.규칙못깔음) console.log(`     ${f}`);
}
