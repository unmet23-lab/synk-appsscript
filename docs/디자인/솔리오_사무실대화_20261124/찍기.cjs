#!/usr/bin/env node
'use strict';
/*
 * 대화.html을 여러 모습으로 찍어 캡처/에 둔다(시안 확인과 미학 맹검용).
 * 먼저 지면서버를 띄운다: node tools/지면서버.js 8783
 * 쓰기: node docs/디자인/솔리오_사무실대화_20261124/찍기.cjs [포트] [--2배] [이름…]
 *       이름을 주면 그 장면만 찍는다. --2배는 화면 밀도 2배로 찍는다.
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const 인자 = process.argv.slice(2);
const 포트 = Number(인자.find(a => /^\d+$/.test(a))) || 8783;
const 배 = 인자.includes('--2배') ? 2 : 1;
const 고른 = 인자.filter(a => !/^\d+$/.test(a) && a !== '--2배');
const 주소 = `http://localhost:${포트}/docs/${encodeURIComponent('디자인')}/${encodeURIComponent('솔리오_사무실대화_20261124')}/${encodeURIComponent('대화.html')}`;
const 나갈곳 = path.join(__dirname, '캡처');
fs.mkdirSync(나갈곳, { recursive: true });

const 쉼 = ms => new Promise(r => setTimeout(r, ms));
/* 장면: 이름, 창 크기, 주소 끝, 찍기 전에 할 일 */
const 장면 = [
  ['1_팀장', 1440, 900, '#lead'],
  ['2_법무부_승인물음', 1440, 900, '#law'],
  ['3_마케팅부_맡기는중', 1440, 900, '#mkt', async p => { await p.click('[data-chip="경쟁사 다시 읽어 줘"]'); await 쉼(2600); }],
  ['4_마케팅부_결과', 1440, 900, '#mkt', async p => { await p.click('[data-chip="경쟁사 다시 읽어 줘"]'); await 쉼(7600); }],
  ['5_팀장이_나눔', 1440, 900, '#lead', async p => { await p.fill('#msg', '11월 영수증 정리하고 합계 알려 줘'); await p.press('#msg', 'Enter'); await 쉼(3200); }],
  ['6_회계부_새결과', 1440, 900, '#acc'],
  ['7_부서없는일', 1440, 900, '#lobby'],
  ['8_좁은창_1024', 1024, 720, '#dev'],
  ['9_휴대폰_목록', 420, 800, '#list'],
  ['10_휴대폰_방', 420, 800, '#law'],
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [이름, w, h, 끝, 할일] of 장면) {
    if (고른.length && !고른.some(g => 이름.includes(g))) continue;
    // 저장소에는 1배로 둔다(공개 저장소의 크기). 맹검이나 세부를 볼 때는 --2배
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 배 });
    const 오류 = [];
    page.on('pageerror', e => 오류.push(e.message));
    page.on('console', m => { if (m.type() === 'error') 오류.push(m.text()); });
    await page.goto(주소 + 끝, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await 쉼(900);
    if (할일) await 할일(page);
    // 시안 조작 막대는 찍지 않는다
    await page.evaluate(() => { const m = document.getElementById('meta'); if (m) m.style.display = 'none'; });
    await 쉼(400);
    const 파일 = path.join(나갈곳, 이름 + '.png');
    await page.screenshot({ path: 파일 });
    console.log((오류.length ? '오류 ' + 오류.join(' | ') + ' · ' : '') + 파일);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
