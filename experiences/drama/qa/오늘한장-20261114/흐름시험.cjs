#!/usr/bin/env node
// 「오늘」 한 장 흐름 시험(11-14) — 대역 판(오늘시험.mjs)을 가짜 마이크 크롬으로 끝까지 따라간다: 오늘 화면 → 버튼 하나 → 복습(첫 화면과 같은
// 틀린 장면 복습 — 선배 대사 → 빈칸 카드 → 결과와 튜터 카드, 11-15) → 새 상황(B) → 입장 검사 열림 → 「오늘로 돌아가기」 → 끝 화면(달라진 것 ·
// 다음에 할 것). 각 단계를 찍고 틀 · 콘솔 오류를 센다.
// 11-16 일력 판부터 끝에 「오늘은 여기까지」를 눌러 이 장을 뜯고 다음 장(내일)이 보이는지까지 본다.
//   node experiences/drama/qa/오늘한장-20261114/흐름시험.cjs [주소=http://127.0.0.1:8798] [--s A|B] [--out .tmp/today-20261114/흐름] [--size 390x844]
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
 const [vw, vh] = (args.includes('--size') ? args[args.indexOf('--size') + 1] : '390x844').split('x').map(Number);
 const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 800 ? 2 : 1 });
 const errors = [];
 page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
 page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`); });
 let n = 0;
 const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}_${name}.png`) }); };
 const F = () => page.frame({ url: /\/(drama|entry-check)\// });
 const until = async (fn, ms = 15000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch { /* 틀이 바뀌는 중 */ } if (Date.now() - t0 > ms) throw new Error('기다림 넘김'); await page.waitForTimeout(200); } };
 // 기록: --s A(기본) · B. 줄마다 칸 이름(복습 · 오늘 공부 · 점검)과 제목을 읽어 그 차례대로 따라간다.
 const scenario = args.includes('--s') ? args[args.indexOf('--s') + 1] : 'A';
 await page.goto(`${base}/?s=${scenario}`);
 await until(async () => (await F()?.$('.td [data-go]')));
 const rows = await F().$$eval('.td .td-item', (x) => x.map((e) => ({ kind: e.querySelector('.td-k')?.firstChild?.textContent || '', title: e.querySelector('h3')?.textContent || '' })));
 await page.waitForTimeout(1300); // 태오 한마디가 낱말마다 다 떠오를 때까지
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
 // 복습: 표지 → 그 줄 앞 선배 대사 → (받아쓰기 동의) → 빈칸 카드에서 구가 녹음 단추가 되면 → 녹음 → 결과(튜터 카드) → 「마치기」가 다음 차례로.
 // 헤드리스 껍데기 크롬은 mp4(H.264)를 못 틀어 선배 대사가 「계속」 단추로 멈춘다 — 누르고 지나간다(소리 · 영상은 이 시험이 보는 것이 아니다).
 async function reviewAndFinish(tag) {
  await until(async () => /REVIEW/i.test((await F()?.$eval('#epTag', (e) => e.textContent)) || ''), 20000);
  await until(async () => {
   const d = await F()?.$('dialog[open] button.pill'); if (d) { await d.click(); return false; }
   const c = await F()?.$('.beat button.pill'); if (c) { await c.click(); return false; }
   // 내 차례 카드(빈칸 대사)가 떠 있고 구가 녹음 단추일 때 — 표지 · 선배 대사 동안 구는 앞 화면의 상태를 잠깐 들고 있다.
   return (await F()?.$('.turn .cardline')) && F()?.$('#orbBtn:not([disabled])');
  }, 60000);
  await page.waitForTimeout(500); // 카드가 올라오는 움직임이 끝날 때까지
  await shot(`${tag}_빈칸`);
  await F().click('#orbBtn');
  await page.waitForTimeout(4800);
  await F().click('#orbBtn');
  await until(async () => (await F()?.$('.director.review')), 20000);
  await shot(`${tag}_결과`);
  const result = await F().$eval('.director.review', (e) => ({ lead: e.querySelector('.lead')?.textContent || '', tutor: !!e.querySelector('.card.tutor'), last: e.querySelector('.last')?.textContent || '' }));
  await F().click('.director.review button.pill:has-text("마치기")');
  return result;
 }
 const steps = [];
 for (const row of rows) {
  if (row.kind === '복습') steps.push({ ...row, result: await reviewAndFinish('복습') });
  else if (row.title.startsWith('입장 검사')) {
   // 입장 검사가 같은 자리에 열린다(부모 대역의 「오늘」 통로). 열린 것만 보고 바로 돌아온다.
   await until(async () => page.frame({ url: /\/entry-check\// }));
   await page.waitForTimeout(2500);
   await shot('입장검사');
   const lobby = await page.frame({ url: /\/entry-check\// }).$eval('#rec-reason', (e) => e.textContent).catch(() => null);
   await page.click('#back');
   steps.push({ ...row, result: lobby });
  } else if (row.title === '1화 이어서 하기') { steps.push({ ...row, result: '장면 흐름으로 넘어감 — 이 시험은 여기서 멈춘다' }); break; }
  else steps.push({ ...row, result: await speakAndFinish(row.kind === '점검' ? '점검' : '새로') });
 }
 await until(async () => (await F()?.$('.td [data-close]')));
 const changed = await F().$$eval('.td .td-now', (x) => x.map((e) => e.textContent));
 const tomorrow = await F().$$eval('.td .td-pg', (x) => x.map((e) => e.textContent));
 await page.waitForTimeout(1600); // 날짜 동그라미와 체크가 그어질 때까지
 await shot('끝');
 // 뜯으면 보일 장 = 다음에 할 것의 첫 날짜(없으면 내일). 그 장이 드러나고 화면 낭독기에도 열렸는지 본다(11-16 GPT 검수 GA3).
 const expected = await F().$eval('.td-pg .td-pd', (e) => parseInt(e.textContent, 10)).catch(() => new Date(Date.now() - 4 * 3600e3 + 864e5).getDate());
 // 뜯기 전 밑장은 키보드로도 닿지 않아야 한다(11-16 GPT 다시 검수 GA1).
 if (!(await F().$eval('.td-under', (e) => e.inert).catch(() => false))) errors.push('밑장: 뜯기 전에 inert가 아니다(가려진 단추에 키보드 초점이 간다)');
 await F().click('.td [data-close]');
 const nextPage = await until(async () => (await F()?.$('.td.torn')) && F().$eval('.td-under .td-num', (e) => e.textContent), 5000).catch(() => null);
 if (nextPage == null) errors.push('다음 장: 뜯은 뒤 .td.torn이나 다음 장 날짜가 없다');
 else if (parseInt(nextPage, 10) !== expected) errors.push(`다음 장: ${nextPage}일이 보인다(기대 ${expected}일)`);
 if (nextPage != null && await F().$eval('.td-under', (e) => e.getAttribute('aria-hidden')).catch(() => 'x') != null) errors.push('다음 장: 드러난 장이 aria-hidden으로 숨겨져 있다');
 await shot('다음장');
 await browser.close();
 const report = { scenario, steps, changed, tomorrow, nextPage, errors };
 fs.writeFileSync(path.join(out, '흐름.json'), JSON.stringify(report, null, 1));
 console.log(JSON.stringify(report, null, 1));
 process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
