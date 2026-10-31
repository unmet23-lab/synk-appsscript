// 실제 공개 주소(https://synk.im/account/platform.html)에서 회원 성향의 「PATH 열기」를 누른다 — 시험 계정 없이.
//   node check-path.cjs <후보 폴더> <캡처 폴더>
// 회원 성향 「고른 관심과 이어지는 앱」의 단추는 mi2 ghost 단추다:
//   <button type="button" class="mi2-ghost mi2-small" data-insight-action="activity" data-insight-target="path">PATH 열기</button>
// 그 클릭은 #page-content(root)에 건 위임 처리기 → openInsightActivity('path')로 간다. 웹에서 PATH는 로그인 상태와
// 상관없이 열 수 있는 앱이라(accountEntryReady: 공개 입구 표에 path가 없다) 로그인 전 페이지에 같은 단추를 넣어 눌러도 같은 갈래다.
// live = 공개본 그대로, candidate = 후보 묶음·페이지만 끼움. 새 창이 PATH 면접 연습 주소로 가는지, 오류가 나는지 센다.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [dir, shots] = process.argv.slice(2);
if (!dir || !shots) throw Error('node check-path.cjs <후보 폴더> <캡처 폴더>');
fs.mkdirSync(shots, { recursive: true });
const PATH_URL = 'https://synk.im/path/interview/film/rehearsal.html';
const files = { '/account/dist/platform.js': ['account__dist__platform.js', 'text/javascript; charset=utf-8'], '/account/platform.html': ['account__platform.html', 'text/html; charset=utf-8'] };

async function run(browser, mode, width) {
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript(() => { window.__rejections = []; addEventListener('unhandledrejection', e => window.__rejections.push(String(e.reason?.message || e.reason))); });
  if (mode === 'candidate') for (const [pathname, [name, type]] of Object.entries(files)) {
    await page.route(url => { const u = new URL(url); return u.origin === 'https://synk.im' && u.pathname === pathname; }, route => route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(path.join(dir, name)) }));
  }
  await page.goto('https://synk.im/account/platform.html?probe=path-open-' + Date.now() + '#benefits/insight', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const served = await page.evaluate(() => document.querySelector('script[src*="dist/platform.js"]')?.getAttribute('src'));
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mi2-ghost mi2-small'; b.dataset.insightAction = 'activity'; b.dataset.insightTarget = 'path'; b.textContent = 'PATH 열기'; b.id = 'qa-path-open';
    document.getElementById('page-content').prepend(b);
  });
  const popupWait = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  await page.click('#qa-path-open');
  const popup = await popupWait;
  let popupUrl = null;
  if (popup) { await popup.waitForURL(u => String(u).startsWith('https://'), { timeout: 15000 }).catch(() => {}); popupUrl = popup.url(); await popup.close(); }
  await page.waitForTimeout(800);
  const rejections = await page.evaluate(() => window.__rejections);
  const message = await page.evaluate(() => { const m = document.getElementById('platform-message'); return m && !m.hidden ? m.textContent : null; });
  await page.screenshot({ path: path.join(shots, `path-open-${mode}-${width}.png`) });
  await context.close();
  return { served, popupUrl, opened: popupUrl === PATH_URL, rejections, message, errors };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }), report = {};
  for (const mode of ['live', 'candidate']) for (const width of [1440, 390]) report[mode + '-' + width] = await run(browser, mode, width);
  await browser.close();
  fs.writeFileSync(path.join(shots, 'check-path.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report, null, 1));
  // 기대: 공개본은 ReferenceError로 새 창이 안 열리고, 후보는 오류 없이 PATH 면접 연습 주소로 연다.
  const liveBroken = ['live-1440', 'live-390'].every(k => !report[k].opened && report[k].rejections.some(r => /PATH_INTERVIEW_URL/.test(r)));
  const candidateOk = ['candidate-1440', 'candidate-390'].every(k => report[k].opened && !report[k].rejections.length && !report[k].errors.length);
  console.log(JSON.stringify({ liveBroken, candidateOk }));
  if (!candidateOk) process.exit(1);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
