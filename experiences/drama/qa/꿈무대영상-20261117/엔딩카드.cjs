#!/usr/bin/env node
'use strict';
/**
 * 꿈 무대 엔딩 여덟째 판(2026-11-20) — 엔딩의 정지 카드를 화면 크기(1280×720, 2배 밀도) 투명 PNG로 조판한다.
 * 유호님 11-20 「디자인 사이트 크롤링해서 … 엔딩 마무리 트렌디하게」에 따른 조사(README 「엔딩 여덟째 판」)를 옮겼다.
 *   - 흐르는 크레딧 대신 정지 카드. 이름은 Noto Serif KR 600, 역할은 SUIT 500. 글자는 순백 대신 오프화이트이고,
 *     역할도 회색으로 묻지 않는다(DESIGN 3절 「읽혀야 할 말을 회색으로 물리지 않는다」). 줄 그은 틀린 말만 한 단계 낮춘다.
 *   - 크기는 화면 높이 기준 제목 7% · 주연 이름 5.5% · 출연 이름 4.7% · 역할 2.9% · 작은 글 2.8%다.
 * 한 카드 안에서 따로 움직이는 글(「이 영화에 쓰인 말」의 블록, 그어지는 줄, 고친 말)은 같은 자리에 층마다 한 장씩 뽑는다.
 *
 *   node 엔딩카드.cjs <밖 폴더> --로고 <평면 로고.png>
 *   (원고는 엔딩원고.cjs의 「판8」, 로고는 엔딩로고.py가 만든 평면 판)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const 인자 = process.argv.slice(2);
const 밖 = path.resolve(인자[0]);
const 로고 = path.resolve(인자[인자.indexOf('--로고') + 1]);
const 원고 = require('./엔딩원고.cjs').판8;
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 명조 = b64('C:/Windows/Fonts/NotoSerifKR-VF.ttf');
const 수트 = b64(path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2'));
const 막 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const 머리 = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"M";src:url(data:font/ttf;base64,${명조}) format("truetype");font-weight:200 900}
@font-face{font-family:"S";src:url(data:font/woff2;base64,${수트}) format("woff2");font-weight:100 900}
:root{--이름:#E6DFD2;--역:#C2BBAF;--틀:#9C968C}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;background:transparent;overflow:hidden}
body{color:var(--이름);-webkit-font-smoothing:antialiased;font-family:"S"}
.판{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.역{font:500 21px "S";letter-spacing:.06em;color:var(--역)}
.이{font:600 34px "M";letter-spacing:.03em;color:var(--이름)}
.작{font:500 20px "S";letter-spacing:.04em;color:var(--역);line-height:1.5}
.덧{font:400 20px "S";letter-spacing:.02em;color:var(--역);line-height:1.5}
.제목{font:600 50px "M";letter-spacing:.02em;padding-bottom:24px}
.오른{position:absolute;left:780px;top:0;bottom:0;width:460px;display:flex;flex-direction:column;justify-content:center}
.쌍+.쌍{margin-top:30px}
.쌍 .이{margin-top:6px}
.블{text-align:center}
.블+.블{margin-top:34px}
.블 .말{font:600 32px "M";letter-spacing:.02em;margin:6px 0 4px}
.틀{position:relative;color:var(--틀)}
.줄{position:absolute;left:-2px;right:-2px;top:54%;height:2px;background:var(--틀)}
.화살{font:300 28px "M";color:var(--역);margin:0 .4em}
.표{display:grid;grid-template-columns:auto auto;column-gap:22px;row-gap:12px;align-items:baseline}
.표 .역{text-align:right}
.표 .이{font-size:26px}
[data-층]{visibility:var(--보임,visible)}
</style>`;

const 카드 = {};
카드.제목 = `<div class="판"><div class="제목" data-층="글">${막(원고.제목)}</div></div>`;
카드.주연 = `<div class="판" data-층="글"><div class="역">주연</div><div class="이" style="font-size:40px;margin-top:12px">${막(원고.주연)}</div></div>`;
원고.출연.forEach((쌍들, i) => {
  카드[`출연_${i + 1}`] = `<div class="오른" data-층="글">${쌍들.map(([역, 이]) => `<div class="쌍"><div class="역">${막(역)}</div><div class="이">${막(이)}</div></div>`).join('')}</div>`;
});
카드.특별출연 = `<div class="오른" data-층="글"><div class="쌍"><div class="역">특별출연</div><div class="이" style="font-size:40px">${막(원고.특별출연)}</div></div></div>`;
카드.쓰인말 = `<div class="판"><div class="작" data-층="머리" style="letter-spacing:.24em;margin-bottom:40px">이 영화에 쓰인 말</div>${원고.쓰인말.map((b, i) => {
  const 말 = b.틀린
    ? `<span class="틀">${막(b.틀린)}<span class="줄" data-층="${i + 1}줄"></span></span><span data-층="${i + 1}고침"><span class="화살">→</span>${막(b.말)}</span>`
    : 막(b.말);
  return `<div class="블" data-층="${i + 1}"><div class="작">${막(b.때)}</div><div class="말">${말}</div><div class="덧">${막(b.덧)}</div></div>`;
}).join('')}</div>`;
카드.마지막 = `<div class="판" data-층="글"><div class="표">${원고.마지막.map(([역, 이]) => `<div class="역">${막(역)}</div><div class="이">${막(이)}</div>`).join('')}</div>
<div class="작" style="letter-spacing:.24em;margin-top:46px">${막(원고.제작)}</div><img src="data:image/png;base64,${b64(로고)}" style="height:34px;margin-top:12px"></div>`;

(async () => {
  fs.mkdirSync(밖, { recursive: true });
  const 브 = await chromium.launch({ channel: 'chrome' });
  const 쪽 = await 브.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const 쓴것 = [];
  for (const [이름, 몸] of Object.entries(카드)) {
    await 쪽.setContent(머리 + 몸);
    await 쪽.evaluate(() => document.fonts.ready);
    const 층들 = await 쪽.evaluate(() => [...new Set([...document.querySelectorAll('[data-층]')].map((e) => e.dataset.층))]);
    for (const 층 of 층들) {
      // 이 층만 보이고 나머지는 자리만 지킨다(visibility) — 층마다 같은 자리에 놓인다
      await 쪽.evaluate((층) => document.querySelectorAll('[data-층]').forEach((e) => e.style.setProperty('--보임', e.dataset.층 === 층 ? 'visible' : 'hidden')), 층);
      const 파일 = path.join(밖, 층 === '글' ? `${이름}.png` : `${이름}_${층}.png`);
      await 쪽.screenshot({ path: 파일, omitBackground: true });
      쓴것.push(path.basename(파일));
    }
  }
  await 브.close();
  console.log(JSON.stringify({ 밖, 쓴것 }));
})().catch((e) => { console.error(e); process.exit(1); });
