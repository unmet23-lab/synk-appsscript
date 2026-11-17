#!/usr/bin/env node
'use strict';
/**
 * 꿈 무대 엔딩(2026-11-18) — 영화 엔드 크레딧을 조판해 길쭉한 투명 PNG 한 장으로 뽑는다.
 * 유호님 「진짜 영화 엔딩처럼 (조사해봐) 크레딧 나오면서 … 이 학생의 기록이나 성향을 추가한 아이디어로 구성해도 좋을것같고」에서 나왔다.
 * 글자는 그림 엔진이 굽지 않고 조판한다(폰트 정본 §10, 후반 가이드 「엔드카드」). 글꼴은 끝 제목과 같은 Noto Serif KR(이름)과 SUIT(역할)다.
 *
 *   node 엔딩크레딧.cjs <크레딧.json | 엔딩원고.cjs:<이름>> <밖.png> [--폭 <px>] [--높이 <px>]
 *   --높이를 주면 그 높이의 카드 한 장(내용을 세로 가운데에)으로 뽑는다. 주지 않으면 내용 높이의 길쭉한 판이다.
 *
 * 크레딧.json은 블록의 배열이다. 블록 꼴:
 *   { "머리": "출연" }                       역할 묶음의 머리(작은 대문자처럼 벌린 글자)
 *   { "역": "선배", "이름": "태오" }          두 칸 줄(역할은 오른쪽 맞춤, 이름은 왼쪽 맞춤 — 실제 영화 크레딧 꼴)
 *   { "이름만": "유호", "크기": 44 }          가운데 이름 한 줄
 *   { "글": "서울, 2026년 가을", "크기": 22 } 가운데 작은 글 한 줄
 *   { "빈칸": 80 }                           세로 빈 칸(px)
 *   { "그림": "<png>", "높이": 34 }        가운데 그림 한 장(제작사 마크 같은 승인 자산을 그대로, 저장소 기준 경로)
 *   { "지운글": "커피 나오셨습니다", "고친글": "커피 나왔습니다", "크기": 30 }  틀린 말에 줄을 긋고 고친 말을 잇는 한 줄
 * 출력은 폭 × 내용 높이의 투명 PNG(2배 밀도)이고, 높이는 표준 출력에 찍는다. 굴리기는 엔딩잇기.py가 한다.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const 인자 = process.argv.slice(2);
// 원고는 JSON 파일 또는 `<모듈.cjs>:<이름>`(qa 아래 .json은 .gitignore에 걸려 원고를 cjs 모듈로 둔다)
const 원고 = /\.cjs:/.test(인자[0])
  ? require(path.resolve(인자[0].split(':').slice(0, -1).join(':')))[인자[0].split(':').pop()]
  : JSON.parse(fs.readFileSync(인자[0], 'utf8'));
const 밖 = path.resolve(인자[1]);
const 폭 = 인자.includes('--폭') ? Number(인자[인자.indexOf('--폭') + 1]) : 640;
const 카드높이 = 인자.includes('--높이') ? Number(인자[인자.indexOf('--높이') + 1]) : 0;
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 명조 = b64('C:/Windows/Fonts/NotoSerifKR-VF.ttf');
const 수트 = b64(path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2'));
const 막 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const 몸 = 원고.map((b) => {
  if (b.빈칸) return `<div style="height:${b.빈칸}px"></div>`;
  if (b.머리) return `<div class="머리">${막(b.머리)}</div>`;
  if (b.역 !== undefined) return `<div class="줄"><div class="역">${막(b.역)}</div><div class="이">${막(b.이름)}</div></div>`;
  if (b.이름만) return `<div class="가운데 이" style="font-size:${b.크기 || 40}px">${막(b.이름만)}</div>`;
  if (b.글) return `<div class="가운데 글" style="font-size:${b.크기 || 20}px">${막(b.글)}</div>`;
  if (b.그림) return `<div class="가운데"><img src="data:image/png;base64,${b64(path.isAbsolute(b.그림) ? b.그림 : path.join(뿌리, b.그림))}" style="height:${b.높이 || 34}px"></div>`;
  if (b.지운글) return `<div class="가운데 이" style="font-size:${b.크기 || 30}px"><s style="opacity:.55;text-decoration-thickness:2px">${막(b.지운글)}</s><span style="opacity:.6;margin:0 .45em;font-family:M;font-weight:300">→</span>${막(b.고친글)}</div>`;
  throw new Error('모르는 블록: ' + JSON.stringify(b));
}).join('\n');

const 쪽글 = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"M";src:url(data:font/ttf;base64,${명조}) format("truetype");font-weight:200 900}
@font-face{font-family:"S";src:url(data:font/woff2;base64,${수트}) format("woff2");font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${폭}px;background:transparent}${카드높이 ? `body{height:${카드높이}px;display:flex;flex-direction:column;justify-content:center}` : ''}
body{color:#F6EFE6;font-family:"S";-webkit-font-smoothing:antialiased;padding:0 24px}
.머리{font-family:"S";font-weight:500;font-size:15px;letter-spacing:.32em;text-align:center;opacity:.72;margin:0 0 18px}
.줄{display:grid;grid-template-columns:1fr 1fr;column-gap:22px;align-items:baseline;margin:0 0 12px}
.역{font-family:"S";font-weight:400;font-size:17px;text-align:right;opacity:.78;letter-spacing:.04em}
.이{font-family:"M";font-weight:500;font-size:22px;letter-spacing:.06em}
.가운데{text-align:center;margin:0 0 10px}
.글{font-family:"S";font-weight:400;opacity:.8;letter-spacing:.03em;line-height:1.6}
</style><div id="판">${몸}</div>`;

(async () => {
  const 브 = await chromium.launch({ channel: 'chrome' });
  const 쪽 = await 브.newPage({ viewport: { width: 폭, height: 400 }, deviceScaleFactor: 2 });
  await 쪽.setContent(쪽글);
  await 쪽.evaluate(() => document.fonts.ready);
  const 높이 = 카드높이 || Math.ceil(await 쪽.evaluate(() => document.getElementById('판').getBoundingClientRect().height));
  await 쪽.setViewportSize({ width: 폭, height: 높이 });
  await 쪽.screenshot({ path: 밖, omitBackground: true, fullPage: !카드높이 });
  await 브.close();
  console.log(JSON.stringify({ 밖, 폭, 높이 }));
})().catch((e) => { console.error(e); process.exit(1); });
