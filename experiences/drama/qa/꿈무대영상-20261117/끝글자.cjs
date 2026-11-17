#!/usr/bin/env node
'use strict';
/**
 * 꿈 무대 영상(2026-11-17) — 끝 화면의 제목과 크레딧을 조판해서 투명 PNG로 뽑는다.
 * 유호님 「마지막 폰트가 너무 슬롭인데」에서 나왔다. 앞 판은 그림 엔진이 붓글씨 제목까지 한 장으로 구웠다.
 * 폰트 정본 §10(브랜드 이름 · 끝 로고는 로고타입으로 묶어 작게, 효과 없이)과 후반 가이드 「엔드카드」(글자는 HTML 층을 크롬으로
 * 투명 PNG로 뽑아 합성한다)를 따른다. 글꼴은 감성 편 승인값인 Noto Serif KR(제목)과 SUIT(크레딧, 로마자)다.
 *
 *   node 끝글자.cjs <밖 폴더> [--주연 <이름>] [--고침 <이름>] [--바탕 <그림>]
 *
 * 시안마다 층 둘(제목.png, 크레딧.png — 1280×720 투명, 2배 밀도)을 내고, --바탕을 주면 그 위에 얹은 미리 보기(<시안>_보기.png)도 낸다.
 * 층을 나눈 까닭은 영상에서 제목과 크레딧이 차례로 올라오게 하려는 것이다(`이어붙이기.py --끝글자`).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const 인자 = process.argv.slice(2);
const 밖 = path.resolve(인자[0] || '.');
const 값 = (이름, 기본) => (인자.includes(이름) ? 인자[인자.indexOf(이름) + 1] : 기본);
const 주연 = 값('--주연', '유호');
const 고침 = 값('--고침', '유호');
const 바탕 = 값('--바탕', '');
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 명조 = b64('C:/Windows/Fonts/NotoSerifKR-VF.ttf');
const 수트 = b64(path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2'));

const 머리 = `
@font-face{font-family:"M";src:url(data:font/ttf;base64,${명조}) format("truetype");font-weight:200 900}
@font-face{font-family:"S";src:url(data:font/woff2;base64,${수트}) format("woff2");font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;background:transparent;overflow:hidden}
body{color:#F6EFE6;font-family:"S";-webkit-font-smoothing:antialiased}
.층{position:absolute;inset:0}
.역{font-weight:500;opacity:.9;letter-spacing:.12em}
.이{font-family:"M";font-weight:500;letter-spacing:.1em}
`;

// 시안 셋. 제목 층과 크레딧 층을 따로 그린다. 글자 뒤에는 아무 효과도 두지 않는다.
const 시안 = {
  // 가: 가운데 가로 묶음 — 제목 한 줄, 한참 아래에 크레딧 두 줄(역할은 작게, 이름은 명조로 크게)
  가: {
    제목: `<div class="층" style="display:flex;flex-direction:column;align-items:center;top:232px;height:200px">
      <div style="font-family:M;font-weight:500;font-size:78px;letter-spacing:.12em;margin-right:-.12em;line-height:1">안녕<span style="letter-spacing:.02em">,</span> 서울</div>
    </div>`,
    크레딧: `<div class="층" style="top:440px;display:grid;grid-template-columns:1fr auto auto 1fr;column-gap:26px;row-gap:16px;align-items:baseline;height:140px;align-content:start">
      <i></i><div class="역" style="font-size:27px;text-align:right">주연</div><div class="이" style="font-size:34px">${주연}</div><i></i>
      <i></i><div class="역" style="font-size:27px;text-align:right">대사 고침</div><div class="이" style="font-size:34px">${고침}</div><i></i>
    </div>`,
  },
  // 나: 왼쪽 아래 두 줄 묶음 — 작은 「안녕,」 위에 큰 「서울」, 크레딧은 같은 왼쪽 줄에 맞춘다
  나: {
    제목: `<div class="층" style="left:104px;top:318px;width:700px">
      <div style="font-family:M;font-weight:400;font-size:40px;letter-spacing:.1em;line-height:1">안녕,</div>
      <div style="font-family:M;font-weight:600;font-size:118px;letter-spacing:.08em;line-height:1;margin-top:14px;margin-left:-6px">서울</div>
    </div>`,
    크레딧: `<div class="층" style="left:104px;top:536px;width:700px">
      <div style="display:grid;grid-template-columns:auto auto 1fr;column-gap:20px;row-gap:10px;align-items:baseline">
        <div class="역" style="font-size:24px">주연</div><div class="이" style="font-size:30px">${주연}</div><i></i>
        <div class="역" style="font-size:24px">대사 고침</div><div class="이" style="font-size:30px">${고침}</div><i></i>
      </div>
    </div>`,
  },
  // 다: 세로 묶음 — 오른쪽에 글자를 한 자씩 세로로 쌓고(쉼표는 「녕」의 오른쪽 아래에 작게), 크레딧은 왼쪽 아래
  다: {
    제목: `<div class="층" style="right:150px;top:96px;left:auto;width:200px;height:520px;display:flex;flex-direction:row-reverse;align-items:flex-start;gap:30px">
      <div style="display:flex;flex-direction:column;align-items:center;font-family:M;font-weight:500;font-size:76px;line-height:1">
        <span>안</span>
        <span style="position:relative;margin-top:14px">녕<span style="position:absolute;right:-22px;bottom:2px;font-size:54px;line-height:1">,</span></span>
        <span style="margin-top:36px">서</span>
        <span style="margin-top:14px">울</span>
      </div>
    </div>`,
    크레딧: `<div class="층" style="left:104px;top:556px;width:600px">
      <div style="display:grid;grid-template-columns:auto auto 1fr;column-gap:20px;row-gap:10px;align-items:baseline">
        <div class="역" style="font-size:24px">주연</div><div class="이" style="font-size:30px">${주연}</div><i></i>
        <div class="역" style="font-size:24px">대사 고침</div><div class="이" style="font-size:30px">${고침}</div><i></i>
      </div>
    </div>`,
  },
};

(async () => {
  fs.mkdirSync(밖, { recursive: true });
  // 내려받은 Playwright 브라우저의 판이 안 맞을 때가 있어 이 PC의 크롬으로 연다
  const 브 = await chromium.launch({ channel: 'chrome' });
  const 쪽 = await 브.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const 바탕주소 = 바탕 ? `data:image/${path.extname(바탕).slice(1).replace('jpg', 'jpeg')};base64,${b64(바탕)}` : '';
  for (const [이름, 층] of Object.entries(시안)) {
    for (const [무엇, 몸] of Object.entries(층)) {
      await 쪽.setContent(`<!doctype html><meta charset="utf-8"><style>${머리}</style>${몸}`);
      await 쪽.evaluate(() => document.fonts.ready);
      await 쪽.screenshot({ path: path.join(밖, `${이름}_${무엇}.png`), omitBackground: true });
    }
    if (바탕주소) {
      await 쪽.setContent(`<!doctype html><meta charset="utf-8"><style>${머리}html,body{background:#000}</style>
        <img src="${바탕주소}" style="position:absolute;inset:0;width:1280px;height:720px;object-fit:cover">${층.제목}${층.크레딧}`);
      await 쪽.evaluate(() => document.fonts.ready);
      await 쪽.waitForTimeout(300);
      await 쪽.screenshot({ path: path.join(밖, `${이름}_보기.png`) });
    }
    console.log('시안', 이름);
  }
  await 브.close();
})().catch((e) => { console.error(e); process.exit(1); });
