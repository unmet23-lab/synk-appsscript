'use strict';
// 트랙의 Atlas 단계 4 줄 — 선택 공개 대목을 지금 상태로(설계 주인 11-23 (나) · (ㄱ) 5).  node edit-track.cjs <트랙.md>
const fs = require('node:fs');
const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
const head = '설계 주인 11-20 답대로 라이브 위에 새 길만 얹는 선택 공개로 두 단계에 올린다(4c, 조건은 §6 5).';
const tail = '후보 · 되돌림 자료와 명령은 인계 노트에 있다.';
const a = s.indexOf(head), b = s.indexOf(tail, a);
if (a < 0 || b < 0 || s.indexOf(head, a + 1) >= 0 || s.indexOf(tail, b + 1) >= 0) throw Error(`자리 ${a} ${b}`);
if (s.slice(a, b).includes('\n')) throw Error('한 줄 안이 아니다');
const now = `${head} 1단계 ①(world-strings) · ②(world-lang)는 라이브다. ③은 설계 주인 11-23 (나)대로 꺼진 판에서 닿지 않는 열일곱(엔진 다섯 · 새 길 모듈 열둘)을 빼고 남는 열여섯만 싣는다. (1) 토큰 없는 모듈 열하나(검수 atlas-world-step1-pub-20261123-s3e1) → 10분 → (2) app-shell · home.css · HTML 셋(-s3e2)으로 나눠 11-24 02시 창에 올린다. 뺀 열일곱은 깃발 전의 켜는 공개(§6 5-3)에 싣는다. 2단계 (2-1) GC1은 ③ 뒤 같은 창에서 06시 전에 시작할 수 있을 때만 올리고, (2-2)는 11-25 02시 창에 올린다. (2-2)를 미룬 까닭은 ③ P1 고침을 묶음에 싣기 위함이다. `;
s = s.slice(0, a) + now + s.slice(b);
fs.writeFileSync(file, s);
console.log('트랙 줄 고침');
