#!/usr/bin/env node
// 「오늘」 한 장 흐름 시험(11-14) — 대역 판(오늘시험.mjs)을 가짜 마이크 크롬으로 끝까지 따라간다: 오늘 화면 → 버튼 하나 → 복습(사감 선생님)
// → 새 상황(B) → 입장 검사 열림 → 「오늘로 돌아가기」 → 끝 화면(달라진 것 · 내일). 각 단계를 찍고 틀 · 콘솔 오류를 센다.
//   node experiences/drama/qa/오늘한장-20261114/흐름시험.cjs [주소=http://127.0.0.1:8798] [--out .tmp/today-20261114/흐름] [--entry]
// playwright는 공용 작업본 node_modules, 크롬은 설치된 헤드리스 껍데기(현장 노트 시험 · 화면)를 쓴다.
const path = require('path');
const fs = require('fs');
const os = require('os');
const MAIN = process.env.SYNK_MAIN || path.join(os.homedir(), 'Documents/SYNK-appsscript');
const { chromium } = require(path.join(MAIN, 'node_modules/playwright'));
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8798';
const out = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '.tmp/today-20261114/흐름');
const shell = () => { const root = path.join(os.homedir(), 'AppData/Local/ms-playwright'); const d = fs.readdirSync(root).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop(); return path.join(root, d, 'chrome-headless-shell-win64/chrome-headless-shell.exe'); };
fs.mkdirSync(out, { recursive: true });

(async () => {
 const browser = await chromium.launch({ executablePath: shell(), args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
 const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
 const errors = [];
 page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
 page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`); });
 let n = 0;
 const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}_${name}.png`) }); };
 const F = () => page.frame({ url: /\/(drama|entry-check)\// });
 const until = async (fn, ms = 15000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch { /* 틀이 바뀌는 중 */ } if (Date.now() - t0 > ms) throw new Error('기다림 넘김'); await page.waitForTimeout(200); } };
 await page.goto(`${base}/?s=A`);
 await until(async () => (await F()?.$('.td [data-go]')));
 const rows = await F().$$eval('.td h3', (x) => x.map((e) => e.textContent));
 await shot('오늘');
 await F().click('.td [data-go]');
 // 차례마다: (동의) → 구를 눌러 녹음 → 다시 눌러 끝 → 결과 → 마치기.
 async function speakAndFinish(tag) {
  // 받아쓰기 동의(처음 한 번)는 새 상황 카드보다 먼저 묻는다.
  await until(async () => { const d = await F()?.$('dialog[open] button.pill'); if (d) { await d.click(); return false; } return (await F()?.$('#orbBtn:not([disabled])')) && (await F().$('.transfer')); }, 20000);
  await shot(`${tag}_상황`);
  await F().click('#orbBtn');
  await page.waitForTimeout(4800); // 실제 말 길이(빠르기 검사에 걸리지 않게)
  await F().click('#orbBtn');
  await until(async () => (await F()?.$('.transfer .result')));
  await shot(`${tag}_결과`);
  const heard = await F().$eval('.transfer .result', (e) => e.textContent);
  await F().click(`.transfer button.pill:has-text("마치기")`);
  return heard;
 }
 const heard1 = await speakAndFinish('다시');
 const heard2 = await speakAndFinish('새로');
 // 입장 검사가 같은 자리에 열린다(부모 대역의 「오늘」 통로).
 await until(async () => page.frame({ url: /\/entry-check\// }));
 await page.waitForTimeout(2500);
 await shot('입장검사');
 const lobby = await page.frame({ url: /\/entry-check\// }).$eval('#rec-reason', (e) => e.textContent).catch(() => null);
 await page.click('#back');
 await until(async () => (await F()?.$('.td [data-close]')));
 const changed = await F().$$eval('.td .td-now', (x) => x.map((e) => e.textContent));
 const tomorrow = await F().$$eval('.td .td-tm span', (x) => x.map((e) => e.textContent));
 await shot('끝');
 await browser.close();
 const report = { rows, heard1, heard2, lobby, changed, tomorrow, errors };
 fs.writeFileSync(path.join(out, '흐름.json'), JSON.stringify(report, null, 1));
 console.log(JSON.stringify(report, null, 1));
 process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
