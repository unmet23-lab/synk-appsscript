// 링크드인 회사 페이지 SYNK 커버 — 꼴(검은 펠트 바탕 · 네 사업 색 펠트 조각 · synk.im)은 그대로, 글만 11-18 태그라인과 맞춘다.
// 11-20 유호님 「자율주행으로 마무리 해」. synkbrief 유튜브 배너 A(11-19 「A 걸고 B 짓기」)와 같은 길: 글만 바꾼 판.
// 바탕은 09-19 판(프로필최신화_20260919/커버_문구포함/synk-linkedin-company.svg, 공용 작업본)에서 글 세 묶음만 뺀 SVG(저장소 밖
// %USERPROFILE%/ego/profile-bio-20261118/li-co-bg.svg)이고, 글자 펠트 결은 같은 SVG의 feltType 무늬(li-co-felt.txt)를 쓴다.
//   node docs/마케팅/프로필점검_20261118/시안/굽기_링크드인회사커버.mjs <li-co-bg.svg> <li-co-felt.txt>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const [바탕, 결] = process.argv.slice(2);
const W = 1512, H = 256, S = 2;
const 제목 = ['한 사람에게 맞추는', 'AI를 만드는 SYNK'];
const 아래 = '한국어 교육 · AI 강의 · AI 광고 · 유학 준비';
const 문서 = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../../디자인/SNS키트/kit.css"><style>
html,body{margin:0;background:#080605}
.판{position:relative;width:${W}px;height:${H}px;transform:scale(${S});transform-origin:0 0;overflow:hidden}
.판>img{position:absolute;inset:0;width:${W}px;height:${H}px}
.글{position:absolute;left:340px;top:0;height:${H}px;display:flex;flex-direction:column;justify-content:center}
h1{margin:0;font:800 49px/60px var(--k-sans);letter-spacing:-.04em;white-space:nowrap;color:#FBF7F0;background:url(${fs.readFileSync(결, 'utf8').trim()}) 0 0/180px 180px;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1.1px .8px rgba(0,0,0,.3))}
h1 span{display:block}
.밑선{display:inline-block;width:0;height:0;vertical-align:baseline}
p{margin:14px 0 0;font:500 33px/1.2 var(--k-sans);letter-spacing:-.02em;color:#FBF7F0;opacity:.82;white-space:nowrap}
</style></head><body><div class="판"><img src="data:image/svg+xml;base64,${fs.readFileSync(바탕).toString('base64')}">
<div class="글"><h1>${제목.map((s) => `<span>${s}</span>`).join('')}</h1><p>${아래}<i class="밑선"></i></p></div></div></body></html>`;
const 임시 = path.join(여기, `._굽는중_${process.pid}.html`);
fs.writeFileSync(임시, 문서, 'utf8');
const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
try {
  const 쪽 = await 브라우저.newPage({ viewport: { width: W * S, height: H * S } });
  await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
  await 쪽.evaluate(() => document.fonts.ready);
  await 쪽.waitForTimeout(500);
  // 카본 맹검(11-20, 6점) 「부제와 오른쪽 synk.im의 밑선이 어긋남」 → 부제 밑선을 synk.im 밑선(SVG translate y 214)에 맞춘다
  await 쪽.evaluate(() => { const b = document.querySelector('.밑선').getBoundingClientRect().top / 2; document.querySelector('.글').style.transform = `translateY(${214 - b}px)`; });
  await 쪽.waitForTimeout(200);
  console.log('밑선', await 쪽.evaluate(() => document.querySelector('.밑선').getBoundingClientRect().top / 2));
  const 잼 = await 쪽.evaluate(() => { const r = [...document.querySelectorAll('h1 span, p')].map((e) => e.getBoundingClientRect()); return { 오른: Math.round(Math.max(...r.map((x) => x.right)) / 2), 위: Math.round(r[0].top / 2), 아래: Math.round(r[r.length - 1].bottom / 2) }; });
  if (잼.오른 > 930) throw new Error('글이 펠트 조각(x 950)에 닿는다 ' + JSON.stringify(잼));
  const 낼 = path.join(여기, 'out', 'li-company-cover_2x.png');
  await 쪽.screenshot({ path: 낼, clip: { x: 0, y: 0, width: W * S, height: H * S } });
  console.log('구움', path.relative(여기, 낼), JSON.stringify(잼));
} finally { await 브라우저.close(); fs.rmSync(임시, { force: true }); }
