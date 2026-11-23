'use strict';
// G3: 판을 닫거나 끝낼 때 기기 기록부가 그 답으로 다시 접히면 홈도 다시 그린다(여섯 자리 — 진단 셋 · 시험 형식 셋).
//   node edit-g3.cjs <폴더(master experiences/synk-world-app 또는 후보 원본 world)>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-learning-ui.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const old = 'Promise.resolve(set.folded).then(()=>redrawNext(),()=>{})';
const n = s.split(old).length - 1;
if (n !== 6) throw Error(`접기 뒤 다시 그리는 자리가 ${n}곳이다(6이어야 한다)`);
s = s.split(old).join('Promise.resolve(set.folded).then(foldedRedraw,()=>{})');
const anchor = eol(' function planOnce(coachNow,area){');
if (s.split(anchor).length !== 2) throw Error('planOnce 자리를 못 찾음');
s = s.replace(anchor, () => eol(` // 판이 그 답으로 다시 접히면(기기 기록부 — 손님 · 동의를 끈 계정) 홈(세 줄 · 이번 주 계획 · 열린 허브)과 열린 내 위치 판을 다시 그린다. 엔진의 watch는
 // 같은 문서 안의 접기를 알리지 않아, 판을 도중에 닫으면 다른 계기 전까지 홈이 접기 전 요약에 머문다(검수 s3d G3).
 function foldedRedraw(){if(!stopped)refresh();redrawNext();}
`) + anchor);
fs.writeFileSync(file, s);
console.log('G3 고침 6곳');
