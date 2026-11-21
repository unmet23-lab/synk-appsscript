#!/usr/bin/env node
'use strict';
/**
 * 꿈 무대 엔딩의 「저장하는 포스터 한 장」(2026-11-21, 유호님 「응, 파생판부터」). 기획안 「시즌 마무리 엔딩」의 소장 기준이다.
 * 엔딩이 끝나면 학생이 저장하고 보내는 2:3 포스터다. 원고는 엔딩원고.cjs 「판8」 그대로 쓴다.
 *   - 바탕은 영화의 얼굴 컷 시작 그림(2560×1440)을 높이 그대로 2:3으로 잘라 쓴다. 생성 그림 위에 글자를 굽지 않는다.
 *   - 위에 학생이 5화에 고친 대사 한 줄, 아래에 제목 · 주연 · 크레딧 블록 · 제작 마크. 사진을 검게 덮지 않는다
 *     (첫 판은 아래 3분의 1을 검정으로 덮어 「템플릿 앱이 만든 그림」으로 읽혔다 — 11-21 다른 눈). 글자와 결은 엔딩 카드와 같다
 *     (Noto Serif KR 600 제목, SUIT 500 크레딧, 오프화이트, 바탕 #0B0B0B, 얇은 그레인).
 *
 *   node 엔딩포스터.cjs <밖.png> --바탕 <그림> --가운데 <얼굴 가운데 x 비율> --로고 <평면 로고.png>
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const 인자 = process.argv.slice(2);
const 값 = (이름) => 인자[인자.indexOf(이름) + 1];
const 밖 = path.resolve(인자[0]);
const 바탕그림 = path.resolve(값('--바탕'));
const 가운데 = Number(값('--가운데'));
const 로고 = path.resolve(값('--로고'));
const 원고 = require('./엔딩원고.cjs').판8;
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 막 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const PW = 1200, PH = 1800;

const 출연 = 원고.출연.flat().map(([, 이]) => 이);
const [곡, 촬영, 곳] = 원고.마지막;
const 몸 = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"M";src:url(data:font/ttf;base64,${b64('C:/Windows/Fonts/NotoSerifKR-VF.ttf')}) format("truetype");font-weight:200 900}
@font-face{font-family:"S";src:url(data:font/woff2;base64,${b64(path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2'))}) format("woff2");font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${PW}px;height:${PH}px;overflow:hidden;background:#0B0B0B;color:#E6DFD2;-webkit-font-smoothing:antialiased}
.바탕{position:absolute;inset:0;background:url(data:image/png;base64,${b64(바탕그림)}) no-repeat;background-size:auto ${PH}px;
  background-position:calc(${PW / 2}px - ${가운데} * ${PH} * 16 / 9 * 1px) 0}
.그늘{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(11,11,11,.55) 0,rgba(11,11,11,.18) 9%,rgba(11,11,11,0) 17%,rgba(11,11,11,0) 54%,rgba(11,11,11,.5) 70%,rgba(11,11,11,.84) 100%)}
.결{position:absolute;inset:0;opacity:.06;mix-blend-mode:overlay}
.한줄{position:absolute;top:78px;left:0;right:0;text-align:center;font:500 28px "M";letter-spacing:.06em;color:#F3EEE4;text-shadow:0 1px 14px rgba(0,0,0,.45)}
.아래{position:absolute;left:80px;right:80px;bottom:70px;text-align:center;text-shadow:0 1px 22px rgba(0,0,0,.55)}
.주연{font:500 24px "S";letter-spacing:.32em;color:#DCD5C9}
.주연 b{font:600 38px "M";letter-spacing:.14em;color:#F0EAE0;margin-left:.45em}
.제목{font:600 112px "M";letter-spacing:.07em;color:#F3EDE3;line-height:1.1;margin:0 0 22px}
.주연{margin-bottom:38px}
.블록{font:500 19px "S";letter-spacing:.02em;color:#D2CBBF;line-height:1.75;word-break:keep-all}
.블록 i{font-style:normal;font-weight:700;color:#EDE7DC;margin-right:.45em}
.블록 .사이{display:inline-block;width:1.3em}
.마크{margin-top:34px;height:30px}
</style>
<div class="바탕"></div><div class="그늘"></div>
<svg class="결" width="${PW}" height="${PH}"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
<div class="한줄">“${막(원고.쓰인말[0].말)}”</div>
<div class="아래">
 <div class="제목">${막(원고.제목)}</div>
 <div class="주연">주연<b>${막(원고.주연)}</b></div>
 <div class="블록"><i>출연</i>${출연.map(막).join(' · ')}<span class="사이"></span><i>특별출연</i>${막(원고.특별출연)}<br>
 <i>${막(곡[0])}</i>${막(곡[1])}<span class="사이"></span><i>${막(촬영[0])}</i>${막(촬영[1])}<span class="사이"></span>${막(곳[1])}</div>
 <img class="마크" src="data:image/png;base64,${b64(로고)}">
</div>`;

(async () => {
  const 브 = await chromium.launch({ channel: 'chrome' });
  const 쪽 = await 브.newPage({ viewport: { width: PW, height: PH }, deviceScaleFactor: 1.5 });
  await 쪽.setContent(몸);
  await 쪽.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(밖), { recursive: true });
  await 쪽.screenshot({ path: 밖 });
  await 브.close();
  console.log(JSON.stringify({ 밖 }));
})().catch((e) => { console.error(e); process.exit(1); });
