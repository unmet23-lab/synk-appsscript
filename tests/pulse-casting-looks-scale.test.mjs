// PULSE 방향 화면 옷 · 머리 칸(11-10)의 사진(538×720, 전신은 402~538×720)이 세 기기에서 1.5배 넘게 늘어나지 않는지 본다(슬롭 점검표 48).
// 저장소 전용 도구 tools/화면배율.mjs의 기기 · 셈을 쓰므로 회사 폴더가 아니라 저장소 시험에 둔다(pulse-model-film-scale.test.mjs와 같은 까닭).
// film.css: 칸 폭은 124px까지(.sx-dp-pics), 사진 높이는 clamp(…,140px) — 머리는 cover, 옷은 원래 비율(contain). 가장 큰 칸 124×140이
// 가장 높은 화소비(휴대폰 3배)에서도 기준 아래면 어느 칸이든 아래다. 실제 칸 크기는 Chrome 실측(검수 기록 pulse-looks-20261110): 1440×900 95×90 · 390×844 95×110 · 2560×1440 124×140.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {기기들,기본기준,늘어난배율} from '../tools/화면배율.mjs';

const css=readFileSync(new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/film.css',import.meta.url),'utf8');

test('outfit and hair photos never stretch past the limit on the three reference screens',()=>{
  const width=Number(css.match(/\.sx-dp-pics\{display:grid;grid-template-columns:repeat\(3,minmax\(0,(\d+)px\)\)/)?.[1]);
  const heights=[...css.matchAll(/\.sx-dp-pic img\{[^}]*height:clamp\((\d+)px,[\d.]+vh,(\d+)px\)/g)].map(m=>Number(m[2]));
  assert.equal(width,124,'cells are capped at 124px wide');
  assert.ok(heights.length>=2&&heights.every(h=>h<=140),'every photo height rule tops out at 140px');
  const tallest=Math.max(...heights);
  for(const device of 기기들){
    const hair=늘어난배율({칸폭:width,칸높이:tallest,원본폭:538,원본높이:720,맞춤:'cover',화소비:device.화소비});
    const outfit=늘어난배율({칸폭:width,칸높이:tallest,원본폭:402,원본높이:720,맞춤:'contain',화소비:device.화소비});
    assert.ok(hair<기본기준,`${device.이름}: hair ${hair}×`);assert.ok(outfit<기본기준,`${device.이름}: outfit ${outfit}×`);
  }
});
