#!/usr/bin/env node
/*
 * 자산 쓰임 — 구운 것 중 «사람이 보는 자리»가 실제로 부르는 것이 몇인가 (2026-09-08).
 *
 * ■ 왜 있나 — 트랙 §0-공방 「가장 큰 빈칸 = 구운 것이 화면에 없다」
 *   그 수(09-05 「175 중 19」 · 09-08 「1,028 중 약 10」)는 세션마다 손 grep 으로 잰 값이라
 *   같은 자로 잰 것이 아니었다. 수를 견주려면 자가 하나여야 한다(기억 one-ruler-per-judgment).
 *
 * ■ 🔴 무엇을 «쓰임»으로 세지 «않는가» — 09-08 에 밟은 거짓 초록
 *   `영상/public/공방/목록.json` 은 **자산 목록**이지 쓰임이 아니다. 그것 하나를 근거로 세면
 *   175 가지가 전부 「얹힘」으로 나온다. 목록 지면(`docs/공방/구운것_*.html`·`구울것_*.html`·
 *   `색인.html`)도 「우리가 뭘 구웠나」를 보여주는 안쪽 지면이라 뺀다.
 *
 * ■ ⚠ 이 자의 한계 — 밝혀 둔다
 *   지면이 파일 이름을 «만들어» 부르면(문자열 조립) 못 잡는다. 그래서 나오는 수는 **바닥값**이다.
 *
 * 쓰기: node tools/자산쓰임.js            요약
 *       node tools/자산쓰임.js --안쓰임   안 쓰이는 이름을 묶음별로 센다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 계획경로 = path.join(루트, 'docs/공방/계획.json');

/* 세지 «않는» 자리 — 목록·장부는 쓰임이 아니다 */
const 뺄것 = [
  'docs/공방/계획.json',
  'docs/공방/색인.html',
  '영상/public/공방/목록.json',
  'docs/_ops/',
  'node_modules/',
  '.claude/',
];
const 뺄무늬 = [/docs[\\/]공방[\\/]구운것_.*\.html$/, /docs[\\/]공방[\\/]구울것_.*\.html$/];

function 쇠들() {
  const 계획 = JSON.parse(fs.readFileSync(계획경로, 'utf8'));
  const 낸다 = [];
  (function 훑기(o, 묶) {
    if (Array.isArray(o)) return o.forEach((v) => 훑기(v, 묶));
    if (o && typeof o === 'object') {
      if (o.쇠 && o.이름) 낸다.push({ 쇠: o.쇠, 이름: o.이름, 묶음: 묶 });
      const 묶2 = o.것들 ? o.이름 : 묶;
      for (const v of Object.values(o)) 훑기(v, 묶2);
    }
  })(계획, null);
  return 낸다;
}

/* git 이 아는 파일만 훑는다 — 굽기 산출물(무시되는 큰 그림)까지 열지 않는다 */
const 파일들 = execFileSync('git', ['ls-files'], { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').filter(Boolean)
  .filter((f) => !뺄것.some((b) => f.startsWith(b)) && !뺄무늬.some((r) => r.test(f)))
  .filter((f) => /\.(html|js|json|md|py|jsx|tsx|css)$/i.test(f));

/* 한 번만 읽어 한 덩이로 붙인다 — 이름마다 전수 훑으면 느리다 */
const 덩이 = [];
for (const f of 파일들) {
  try { 덩이.push(fs.readFileSync(path.join(루트, f), 'utf8')); } catch { /* 못 읽는 것은 넘긴다 */ }
}
const 전문 = 덩이.join('\n');

const 목록 = 쇠들();
const 쓰인것 = [], 안쓰인것 = [];
for (const x of 목록) (전문.includes(x.쇠) ? 쓰인것 : 안쓰인것).push(x);

console.log(`■ 자산 쓰임 — 구운 이름 ${목록.length}가지 중 «사람이 보는 자리»가 부르는 것 ${쓰인것.length}가지`);
console.log(`   훑은 파일 ${파일들.length}벌(목록 지면·장부·영상 자산목록은 뺐다)`);
console.log(`   ⚠ 이름을 «만들어» 부르는 자리는 못 잡는다 — 이 수는 바닥값이다.`);
if (쓰인것.length) {
  const 묶 = {};
  for (const x of 쓰인것) (묶[x.묶음] = 묶[x.묶음] || []).push(x.이름);
  console.log('\n■ 쓰이는 것');
  for (const [k, v] of Object.entries(묶).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`   ${String(k).padEnd(22)} ${String(v.length).padStart(3)} — ${v.slice(0, 6).join(' · ')}${v.length > 6 ? ' …' : ''}`);
  }
}
if (process.argv.includes('--안쓰임')) {
  const 묶 = {};
  for (const x of 안쓰인것) 묶[x.묶음] = (묶[x.묶음] || 0) + 1;
  console.log('\n■ 안 쓰이는 것 — 묶음별');
  for (const [k, n] of Object.entries(묶).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(k).padEnd(22)} ${String(n).padStart(4)}`);
  }
}
