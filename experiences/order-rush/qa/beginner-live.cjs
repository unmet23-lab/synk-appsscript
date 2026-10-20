'use strict';
// 공개 주소(synk.im)에서 주문 폭주 입문을 연다(2026-10-20). 후보 폴더를 주면 그 폴더의 파일만 route로 바꿔 끼우고 나머지는 공개본 그대로다.
// 시작 단추 → 음성 목록·15개 소리 준비 → 시범을 지나 첫 주문을 건넬 때까지 1280·390 폭에서 실패 요청·콘솔 오류·페이지 오류를 센다.
// 실제 음성 파일이 내려오는지만 본다. 발음이나 듣기 좋음은 사람이 확인한다.
// 쓰임: node experiences/order-rush/qa/beginner-live.cjs <후보 폴더|-> <결과 폴더> [이름표]   ('-'는 공개본 그대로, 후보 폴더는 공개 경로 구조)
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const [candidate, outDir, label = candidate === '-' ? 'live' : 'candidate'] = process.argv.slice(2);
if (!candidate || !outDir) { console.error('쓰임: node beginner-live.cjs <후보 폴더|-> <결과 폴더> [이름표]'); process.exit(2); }
const BASE = process.env.RUSH_URL || 'https://synk.im/try/order-rush/', ORIGIN = new URL(BASE).origin;
const types = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' };
fs.mkdirSync(outDir, { recursive: true });

async function run(browser, width, height, mobile) {
  const report = { label, width, routed: [], failedRequests: [], badResponses: [], consoleErrors: [], pageErrors: [], voiceList: null, voiceClips: new Set(), steps: [] };
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
  if (candidate !== '-') await context.route(ORIGIN + '/**', async route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice(1)), file = path.join(candidate, rel);
    if (rel && fs.existsSync(file) && fs.statSync(file).isFile()) { report.routed.push(rel); return route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('requestfailed', r => report.failedRequests.push(`${r.url()} ${r.failure()?.errorText || ''}`));
  page.on('response', r => {
    const url = r.url();
    if (r.status() >= 400) report.badResponses.push(`${r.status()} ${url}`);
    if (/\/voices\.json(?:\?|$)/.test(url)) report.voiceList = `${r.status()} ${new URL(url).pathname}`;
    if (/\/audio\/[^/]+\.mp3(?:\?|$)/.test(url) && r.status() === 200) report.voiceClips.add(new URL(url).pathname);
  });
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('pageerror', e => report.pageErrors.push(e.message));
  await page.goto(BASE + 'beginner.html', { waitUntil: 'load', timeout: 120000 });
  await page.locator('h1').first().waitFor({ timeout: 60000 });
  report.steps.push('입문 첫 화면');
  await page.locator('[data-action=start]').click();
  const started = await Promise.race([
    page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'), null, { timeout: 90000 }).then(() => 'ready'),
    page.locator('.b-error').first().waitFor({ timeout: 90000 }).then(() => 'error'),
  ]);
  if (started === 'error') {
    report.steps.push('시작 실패: ' + (await page.locator('.b-error').first().textContent()).trim());
    await page.screenshot({ path: path.join(outDir, `${label}-${width}-start.png`), fullPage: true });
    await context.close();
    return { ...report, voiceClips: report.voiceClips.size, firstOrderDelivered: false };
  }
  report.steps.push('음성 준비 끝 · 시작');
  let firstOrderDelivered = false, demos = 0;
  for (let guard = 0; guard < 30 && !firstOrderDelivered; guard++) {
    await page.waitForFunction(() => !!document.querySelector('[data-item]:not(:disabled)'), null, { timeout: 60000 });
    // 지금 차례의 주문은 게임이 저장한 진행과 공개 beginner-core.js로 계산한다(beginner-browser.cjs와 같은 방법).
    const next = await page.evaluate(async () => {
      const core = await import(new URL('beginner-core.js', location.href).href);
      const progress = JSON.parse(localStorage.getItem('synk.order-rush.beginner.v1')), c = progress.checkpoint;
      const line = c.phase === 'demo' ? core.STAGES[c.stage].demos[c.index] : null;
      const order = line ? { item: line.startsWith('count-') ? 'bread' : line.split('-')[0], count: /-[123]$/.test(line) ? Number(line.at(-1)) : 1 } : core.stageOrders(c.stage, progress.seed + c.stage)[c.index];
      return { phase: c.phase, item: order.item, count: order.count };
    });
    for (let n = 0; n < next.count; n++) await page.locator(`[data-item=${next.item}]`).click();
    await page.locator('[data-action=serve]').click();
    await page.locator('[data-action=next]').waitFor({ timeout: 60000 });
    if (next.phase === 'order') {
      firstOrderDelivered = true;
      report.steps.push(`첫 주문 건넴: ${next.item} ${next.count}개 (시범 ${demos}개 뒤)`);
      await page.screenshot({ path: path.join(outDir, `${label}-${width}-first-order.png`), fullPage: true });
    } else { demos++; await page.locator('[data-action=next]').click(); }
  }
  report.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await context.close();
  return { ...report, voiceClips: report.voiceClips.size, firstOrderDelivered };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  try {
    for (const [w, h, mobile] of [[1280, 900, false], [390, 844, true]]) results.push(await run(browser, w, h, mobile));
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify({ at: new Date().toISOString(), base: BASE, candidate, results }, null, 1));
  let ok = true;
  for (const r of results) {
    const clean = r.firstOrderDelivered && r.voiceClips === 15 && !r.failedRequests.length && !r.badResponses.length && !r.consoleErrors.length && !r.pageErrors.length && !r.overflow;
    ok &&= clean;
    console.log(JSON.stringify({ ok: clean, label: r.label, width: r.width, routed: [...new Set(r.routed)], voiceList: r.voiceList, voiceClips: r.voiceClips, firstOrderDelivered: r.firstOrderDelivered, failedRequests: r.failedRequests, badResponses: r.badResponses, consoleErrors: r.consoleErrors, pageErrors: r.pageErrors, overflow: r.overflow, steps: r.steps }));
  }
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
