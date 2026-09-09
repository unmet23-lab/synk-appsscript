'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const at = process.argv.indexOf('--playwright');
const { chromium } = require(at >= 0 ? process.argv[at + 1] : 'playwright');
const baseArg = process.argv.find(a => a.startsWith('--base='));
const base = baseArg ? baseArg.slice(7) : 'http://127.0.0.1:4399';
const folder = path.join(__dirname, 'qa');
const axeFile = path.resolve(__dirname, '../../tools/vendor/axe.min.js');
fs.mkdirSync(folder, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [], problems = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', e => problems.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) problems.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    for (const [name, route] of [['hub', '/'], ['rehearsal', '/rehearsal/'], ['accessibility', '/accessibility/'], ['pulse', '/pulse/']]) {
      await page.goto(base + route); await page.evaluate(() => document.fonts.ready);
      if (name === 'pulse') await page.waitForFunction(() => window.pulseScene || !document.getElementById('fallback').hidden);
      await page.addScriptTag({ path: axeFile });
      const axe = await page.evaluate(async () => { const r = await axe.run(document); return { violations: r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), incomplete: r.incomplete.map(v => v.id) }; });
      await page.screenshot({ path: path.join(folder, `${name}-desktop.png`), fullPage: true });
      const links = await page.locator('a[href]').evaluateAll(a => a.map(e => e.getAttribute('href')));
      results.push({ name, viewport: 1440, axe, links });
      if (axe.violations.length) problems.push(`${name}: axe ${axe.violations.map(v => v.id).join(',')}`);
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        results.push({ name, viewport: width, overflow }); assert.equal(overflow, false, name + ' overflow at ' + width);
        if (width === 390) await page.screenshot({ path: path.join(folder, `${name}-mobile.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto(base + '/');
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    await page.locator('#motion-toggle').click();
    assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('html').getAttribute('data-synk-motion'), 'reduce');
    await page.goto(base + '/accessibility/');
    assert.equal(await page.locator('html').getAttribute('data-synk-motion'), 'reduce');
    results.push({ name: 'shared-accessibility', skipLink: true, motionPreferenceShared: true });
    await page.goto(base + '/pulse/');
    await page.waitForFunction(() => document.documentElement.dataset.synkMotion === 'reduce');
    await page.waitForFunction(() => window.pulseScene || !document.getElementById('fallback').hidden);
    results.push({ name: 'pulse-under-common-server', sharedReducedMotion: true, render: await page.evaluate(() => window.pulseScene?.getMetrics() || { fallback: true }) });
    await page.goto(base + '/rehearsal/');
    await page.getByRole('button', { name: '고객 의뢰 열기' }).click();
    await page.locator('[name=askGoal]').fill('통합 확인용 가상 질문: 이번 홍보에서 가장 필요한 변화는 무엇인가요?');
    await page.reload();
    assert.match(await page.locator('[name=askGoal]').inputValue(), /통합 확인용/);
    results.push({ name: 'rehearsal-under-common-server', inputAndReload: true });
    fs.writeFileSync(path.join(folder, 'integration-browser.json'), JSON.stringify({ time: new Date().toISOString(), base, browser: 'Chrome headless', results, problems }, null, 2));
    assert.deepEqual(problems, []);
    console.log(JSON.stringify({ passed: results.length, problems }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
