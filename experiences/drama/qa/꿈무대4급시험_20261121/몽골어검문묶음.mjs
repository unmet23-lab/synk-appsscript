#!/usr/bin/env node
// 꿈 무대 4급 시험판의 몽골어 검문 파일(몽골어검문/1~5.txt)을 대본.mjs에서 만든다(2026-11-21).
// 한 · 몽 34짝을 다섯 묶음으로 나눈다. 맞춤법 층(spellcheck.mn)이 한 번에 받는 글자 수에 상한이 있어서, 몽골어가 묶음마다 650자 안쪽이다.
// 검문 파일은 qa 결과 파일이라 git에 올리지 않는다(.gitignore). 검문 장부(docs/_ops/몽골어검문.jsonl)의 대상지문은 이 스크립트로 다시 만든 파일과 견준다.
//   node experiences/drama/qa/꿈무대4급시험_20261121/몽골어검문묶음.mjs [--쓰기]
//   node tools/몽골어대조.js --파일 experiences/drama/qa/꿈무대4급시험_20261121/몽골어검문/<n>.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 메시지, 차례, 문형, 규칙글, 빠짐글 } from './대본.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 쓰기 = process.argv.includes('--쓰기');
const 짝 = new Map([['msg', [메시지.ko, 메시지.mn]]]);
for (const x of 차례) {
  if (x.종류 === '나') 짝.set(x.id, [x.대본, x.mn]);
  else if (x.말) 짝.set(x.클립, [x.말, x.mn]);
}
for (const [id, p] of Object.entries(문형)) if (p.쓰임) { 짝.set(`쓰임:${id}`, [p.쓰임.ko, p.쓰임.mn]); 짝.set(`빠짐:${id}`, [빠짐글.ko(p), 빠짐글.mn(p)]); }
for (const [g, m] of Object.entries(규칙글)) for (const [id, t] of Object.entries(m)) 짝.set(`규칙:${g}.${id}`, [t.ko, t.mn]);
const 묶음 = [
  ['msg', 'N1', 'W1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N12', 'd1', 'd2'],
  ['d4', 'd5', 'd6', 'd7', '쓰임:S444', '쓰임:S429', '쓰임:S454', '쓰임:S316', '쓰임:S447', '쓰임:S420'],
  ['규칙:tense.S454', '규칙:tense.S316', '규칙:adnominal.S454', '규칙:rieul.S429', '규칙:soon.S447', '빠짐:S454'],
  ['빠짐:S429', '빠짐:S447', '빠짐:S420'],
  ['빠짐:S444', '빠짐:S316', 'd3'],
];
const 쓴 = new Set(묶음.flat());
const 빠진 = [...짝.keys()].filter((k) => !쓴.has(k));
if (빠진.length) { console.error(`묶음에 넣지 않은 짝: ${빠진.join(', ')}`); process.exit(1); }
const 상한 = 650;
let 넘음 = false;
묶음.forEach((ks, i) => {
  const 몽 = ks.map((k) => 짝.get(k)[1]);
  const 글자 = 몽.join('').length;
  const 글 = `${ks.map((k, j) => `${j + 1}. ${짝.get(k)[0]}`).join('\n')}\n---\n${몽.map((m, j) => `${j + 1}. ${m}`).join('\n')}\n`;
  const 파일 = path.join(여기, '몽골어검문', `${i + 1}.txt`);
  const 옛 = fs.existsSync(파일) ? fs.readFileSync(파일, 'utf8') : null;
  if (글자 > 상한) 넘음 = true;
  console.log(`${i + 1}.txt ${ks.length}짝 · 몽골어 ${글자}자${글자 > 상한 ? ` (상한 ${상한}자 넘음)` : ''} · ${옛 === 글 ? '같음' : 옛 === null ? '새 파일' : '바뀜'}`);
  if (쓰기 && 옛 !== 글) { fs.mkdirSync(path.dirname(파일), { recursive: true }); fs.writeFileSync(파일, 글, 'utf8'); }
});
if (넘음) process.exit(1);
