// 네이버 블로그 synkshift PC 머리 그림(타이틀 966×360) 굽기 — 11-20 유호님 「자율주행으로 마무리 해」.
// 11-19 유호님이 고르신 synkbrief 유튜브 배너(저녁 통화 재연, out/B2-brief-W6b_경리통화.png)와 같은 장면 · 같은 글로 짓는다.
// GPT 맹검(카본은 답을 거절) 7점 · 「AI 때문에」가 작고 가늘다 · 제목 그림자가 썸네일 효과 같다 → 머리말 29px 600 · 그림자 옅게(11-20).
// 장면 원본은 저장소 밖(%USERPROFILE%/ego/profile-bio-20261118/B2/판/W6_경리통화_072940_1.png). 2배로 그린 뒤 966×360으로 줄인다.
//   node docs/마케팅/프로필점검_20261118/시안/굽기_블로그머리.mjs <장면 PNG> [잘라 낼 x y 폭(장면 2560 기준)]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 장면 = process.argv[2];
const [cx, cy, cw] = (process.argv.slice(3, 6).length === 3 ? process.argv.slice(3, 6) : [700, 380, 1500]).map(Number);
const W = 966, H = 360, S = 2;
const 배 = (W * S) / cw;                       // 장면(2560 기준) 1px → 판 px
const 그림 = fs.readFileSync(장면).toString('base64');
const 로고 = fs.readFileSync(path.resolve(여기, '../../../홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png')).toString('base64');
const 문서 = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../../디자인/SNS키트/kit.css"><style>
html,body{margin:0;background:#0b0c10}
.판{position:relative;width:${W * S}px;height:${H * S}px;overflow:hidden;font-family:var(--k-sans)}
.장면{position:absolute;left:${-cx * 배}px;top:${-cy * 배}px;width:${2560 * 배}px;height:${1441 * 배}px;background:url(data:image/png;base64,${그림}) 0 0/100% 100% no-repeat}
.글{position:absolute;left:${60 * S}px;top:0;height:100%;display:flex;flex-direction:column;justify-content:center;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.22)}
.글 img{height:${26 * S}px;width:auto;align-self:flex-start;filter:drop-shadow(0 1px 8px rgba(0,0,0,.22))}
.머리{margin:${14 * S}px 0 ${6 * S}px;font:600 ${29 * S}px/1.2 var(--k-sans);letter-spacing:-.015em;color:#b9d3ff}
h1{margin:0;font:800 ${44 * S}px/1.14 var(--k-sans);letter-spacing:-.022em;white-space:nowrap}
</style></head><body><div class="판"><div class="장면"></div>
<div class="글"><img src="data:image/png;base64,${로고}" alt="SYNK"><p class="머리">AI 때문에</p><h1>실제로 벌어진 일</h1></div></div></body></html>`;
const 임시 = path.join(여기, `._굽는중_${process.pid}.html`);
fs.writeFileSync(임시, 문서, 'utf8');
const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
try {
  const 쪽 = await 브라우저.newPage({ viewport: { width: W * S, height: H * S } });
  await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
  await 쪽.evaluate(() => document.fonts.ready);
  await 쪽.waitForTimeout(300);
  const 잼 = await 쪽.evaluate(() => { const r = document.querySelector('.글').getBoundingClientRect(); return { 왼: Math.round(r.left), 오른: Math.round(Math.max(...[...document.querySelectorAll('.글 > *')].map((e) => e.getBoundingClientRect().right))) }; });
  const 낼 = path.join(여기, 'out', 'blog-title_synkshift_2x.png');
  await 쪽.screenshot({ path: 낼, clip: { x: 0, y: 0, width: W * S, height: H * S } });
  console.log('구움', path.relative(여기, 낼), JSON.stringify({ 잘라냄: { x: cx, y: cy, 폭: cw }, 글: { 왼: 잼.왼 / S, 오른: 잼.오른 / S } }));
} finally { await 브라우저.close(); fs.rmSync(임시, { force: true }); }
