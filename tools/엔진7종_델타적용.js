'use strict';
/**
 * 엔진7종 v3 «합치기» — 델타 적용기.
 *
 * 델타 파일 = 블록의 나열. 블록은 `@@@` 줄로 시작하고, `===` 줄이 «원문»과 «고친 글»을 가른다.
 *   @@@
 *   <원문 · 대상 파일에 정확히 한 번 있어야 한다>
 *   ===
 *   <고친 글>
 * 원문이 0번이거나 2번 이상이면 아무것도 안 고치고 멈춘다(조용한 폴백이 사고의 원인이라 던진다).
 * 전부 통과해야 한 번에 쓴다(반쯤 고친 파일을 남기지 않는다).
 *
 * 사용: node tools/엔진7종_델타적용.js <대상.md> <델타.txt> [--시험]
 *   --시험 = 쓰지 않고 «몇 번 있나»만 센다.
 */
const fs = require('fs');
const path = require('path');

function 블록들(델타글) {
  const 줄 = 델타글.replace(/\r\n/g, '\n').split('\n');
  const 결과 = [];
  let 현재 = null; let 쪽 = null;
  for (const l of 줄) {
    if (l === '@@@') { if (현재) 결과.push(현재); 현재 = { 원문: [], 고침: [] }; 쪽 = '원문'; continue; }
    if (l === '===' && 현재 && 쪽 === '원문') { 쪽 = '고침'; continue; }
    if (!현재) { if (l.trim() === '') continue; throw new Error('블록 밖의 글: ' + l.slice(0, 60)); }
    현재[쪽].push(l);
  }
  if (현재) 결과.push(현재);
  return 결과.map((b, i) => {
    const 원문 = b.원문.join('\n').replace(/\n+$/, '');
    const 고침 = b.고침.join('\n').replace(/\n+$/, '');
    if (!원문) throw new Error(`블록 ${i + 1}: 원문이 비었다`);
    return { 번호: i + 1, 원문, 고침 };
  });
}

function 세기(본문, 조각) {
  let n = 0; let i = 0;
  while ((i = 본문.indexOf(조각, i)) !== -1) { n++; i += 조각.length; }
  return n;
}

function main() {
  const [대상, 델타, ...옵] = process.argv.slice(2);
  if (!대상 || !델타) { console.error('사용: node tools/엔진7종_델타적용.js <대상.md> <델타.txt> [--시험]'); process.exit(2); }
  const 시험 = 옵.includes('--시험');
  const 원본 = fs.readFileSync(대상, 'utf8');
  const 크르 = 원본.includes('\r\n');
  let 본문 = 원본.replace(/\r\n/g, '\n');
  const 목록 = 블록들(fs.readFileSync(델타, 'utf8'));
  const 문제 = [];
  for (const b of 목록) {
    const n = 세기(본문, b.원문);
    if (n !== 1) 문제.push(`블록 ${b.번호}: 원문이 ${n}번 있다 — ${b.원문.slice(0, 70).replace(/\n/g, '⏎')}`);
  }
  if (문제.length) { console.error('🔴 멈춤 — 아무것도 안 고쳤다\n' + 문제.join('\n')); process.exit(1); }
  if (시험) { console.log(`✅ 시험 통과 — 블록 ${목록.length}개 전부 한 번씩 있다`); return; }
  for (const b of 목록) 본문 = 본문.replace(b.원문, () => b.고침);
  fs.writeFileSync(대상, 크르 ? 본문.replace(/\n/g, '\r\n') : 본문);
  console.log(`✅ 적용 — 블록 ${목록.length}개 · ${path.basename(대상)} ${원본.length}→${본문.length}자`);
}

main();
