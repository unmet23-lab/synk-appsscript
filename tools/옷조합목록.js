#!/usr/bin/env node
/**
 * 옷 조합 목록 — «무엇을 아직 안 구웠나»를 세어 준다 (2026-09-08).
 *
 * ■ 왜 있나
 *   정액제 ChatGPT 창으로 굽는 일은 사람이 브라우저를 몰아야 한다(유호 확정 09-08).
 *   그 일을 이어받는 세션이 «어디까지 됐고 다음이 무엇인지»를 한 줄로 알아야 한다.
 *
 * ■ 규칙 = 의상 1 + 악세 1 (유호 확정 09-08)
 *   09-06 의 「악세 최대 2」에서 둘째 칸을 뺐다. 까몽 789가지가 129가지로 줄었다.
 *
 * ■ 어디를 보고 «구웠다»를 판정하나
 *   docs/Loom_자산/옷/GPT       — 열쇠로 구운 것
 *   docs/Loom_자산/옷/GPT정액시험 — 정액제 창으로 구운 것
 *   두 방을 다 본다. 파일 이름은 tools/lib/옷목록.js 의 옷토막() 이 정한다.
 *
 * 쓰기:
 *   node tools/옷조합목록.js                 # 까몽 — 남은 것 몇 개인가
 *   node tools/옷조합목록.js --다음 10       # 다음에 구울 열 개를 낸다
 *   node tools/옷조합목록.js --누구 몽글
 *   node tools/옷조합목록.js --전량          # 남은 것 전부를 낸다
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 저장소 = path.join(__dirname, '..');
const L = require(path.join(저장소, 'tools', 'lib', '옷목록.js'));
const 원본 = require(path.join(저장소, 'tools', 'lib', '마스코트원본.js'));

/* 🔴 구운 것을 찾는 방은 «둘»이다 — 열쇠로 구운 것과 정액제 창으로 구운 것.
   한 곳만 보면 이미 있는 것을 또 굽는다(정액제는 한 장에 3~5분이라 비싸다). */
const 굽힌방들 = ['GPT', 'GPT정액시험'];

const 인자 = (() => {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true;
  return o;
})();

function 있는것(누구) {
  const 본 = new Set();
  for (const 방 of 굽힌방들) {
    const p = path.join(저장소, L.옷방뿌리, 방);
    for (const f of 원본.names(p)) {
      if (!f.endsWith('.png') || !f.startsWith(누구 + '_')) continue;
      본.add(f.slice(누구.length + 1, -4));      // <옷토막> 부분만
    }
  }
  return 본;
}

function 할것(누구) {
  const 벌 = L.목록(누구);
  const 의 = 벌.filter((v) => v.갈래 === '의상').map((v) => v.이름);
  const 악 = 벌.filter((v) => v.갈래 === '악세').map((v) => v.이름);
  const 전부 = [];
  for (const a of 의) 전부.push([a]);
  for (const b of 악) 전부.push([b]);
  for (const a of 의) for (const b of 악) 전부.push([a, b]);
  return 전부.map((조) => ({ 조, 토막: L.옷토막(누구, 조) }));
}

const 누구 = 인자.누구 || '까몽';
const 전체 = 할것(누구);
const 본 = 있는것(누구);
const 남은 = 전체.filter((v) => !본.has(v.토막));
const 한벌남 = 남은.filter((v) => v.조.length === 1).length;

console.log(`■ ${누구} — 차림 ${전체.length}가지 (의상1 + 악세1)`);
console.log(`   구운 것 ${전체.length - 남은.length}장 · 남은 것 ${남은.length}장`
  + (한벌남 ? ` (그중 한 벌짜리 ${한벌남})` : ''));
const 값 = 남은.reduce((s, v) => s + (v.조.length === 1 ? 63 : 116), 0);
console.log(`   열쇠로 구우면 ${값.toLocaleString()}원 · 정액제 창이면 0원(한 장 3~5분 → 약 ${Math.round(남은.length * 4 / 60)}시간)`);

if (인자.다음 || 인자.전량) {
  const n = 인자.전량 ? 남은.length : Number(인자.다음);
  console.log('');
  남은.slice(0, n).forEach((v, i) => {
    console.log(`${String(i + 1).padStart(3)}. ${v.조.join(' + ')}`);
  });
}
