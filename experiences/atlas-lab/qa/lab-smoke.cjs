'use strict';
// The Atlas lab and the hub's condition choice in an isolated headless browser.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const base = process.env.SYNK_QA_BASE || 'http://127.0.0.1:4291';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const result = { origin: base, at: new Date().toISOString() }, errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
    // The hub's account link draws /synk-account/assets/*; that folder lives only in the main
    // working tree, not in this isolated worktree. Missing responses are listed, not hidden.
    result.missing = []; const watch = p => p.on('response', r => { if (r.status() >= 400) result.missing.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    watch(page);
    await page.goto(`${base}/atlas-lab/`);
    await page.locator('.person').first().waitFor();
    result.people = {};
    for (const key of ['cafe', 'rhythm', 'reading']) {
      await page.locator(`[data-content="${key}"]`).click();
      result.people[key] = await page.locator('.person .score .adapted').allTextContents();
      assert.equal(result.people[key].length, 7);
    }
    await page.locator('[data-content="cafe"]').click();
    await page.screenshot({ path: path.join(__dirname, 'lab-desktop.png'), fullPage: true });
    // Try it: answer fast and right ten times; the engine should raise something.
    await page.locator('#try-start').click();
    for (let i = 0; i < 10; i += 1) {
      await page.locator('.tile').first().waitFor();
      const values = await page.locator('.tile').allTextContents();
      const max = String(Math.max(...values.map(Number)));
      await page.locator('.tile', { hasText: new RegExp(`^${max}$`) }).first().click();
      await page.waitForTimeout(700);
    }
    result.tryLine = await page.locator('#try-line').textContent();
    result.tryRun = await page.evaluate(() => window.synkAtlasLab.run());
    assert.ok(result.tryRun.changes.some(c => c.direction > 0), 'quick right answers raised the challenge');
    // The aim is the content's own; the estimate beside it is labelled as an estimate.
    result.tryAim = { target: await page.locator('#target').textContent(), expected: await page.locator('#expected').textContent() };
    assert.equal(result.tryAim.target, '75%');
    assert.match(result.tryAim.expected, /^\d{1,3}%$/);
    // A chosen help style holds the hint knob (Flow.declaredFrom); the rest still follows the answers.
    const answerTen = async () => {
      for (let i = 0; i < 10; i += 1) {
        await page.locator('.tile').first().waitFor();
        const values = await page.locator('.tile').allTextContents();
        await page.locator('.tile', { hasText: new RegExp(`^${Math.max(...values.map(Number))}$`) }).first().click();
        await page.waitForTimeout(700);
      }
    };
    const hintKnob = () => page.locator('#knobs div', { hasText: '힌트' }).locator('dd').textContent();
    await page.locator('#try-support').selectOption('step');
    await page.locator('#try-start').click();
    await page.locator('.tile').first().waitFor();
    result.step = { hintedAtOnce: await page.locator('#tiles').evaluate(n => n.classList.contains('hinted')), knob: await hintKnob() };
    await answerTen();
    result.step.run = await page.evaluate(() => window.synkAtlasLab.run());
    result.step.line = await page.locator('#try-line').textContent();
    assert.equal(result.step.hintedAtOnce, true);
    assert.equal(result.step.knob, '바로 보여 줌 · 고른 대로');
    assert.equal(result.step.run.settings.values.hint, '바로 보여 줌');
    assert.ok(result.step.run.changes.every(c => c.knob !== 'hint'), 'the chosen help style is not moved');
    assert.match(result.step.line, /힌트는 고른 도움 방식대로 두었어요/);
    await page.locator('#try-support').selectOption('independent');
    await page.locator('#try-start').click();
    await page.locator('.tile').first().waitFor();
    result.alone = { knob: await hintKnob(), seconds: (await page.evaluate(() => window.synkAtlasLab.run())).settings.values.seconds };
    await page.waitForTimeout(Math.round(result.alone.seconds * 600));
    result.alone.hintedAfterMoreThanHalf = await page.locator('#tiles').evaluate(n => n.classList.contains('hinted'));
    await answerTen();
    assert.equal(result.alone.knob, '보여 주지 않음 · 고른 대로');
    assert.equal(result.alone.hintedAfterMoreThanHalf, false);
    await page.locator('#try-support').selectOption('choose');
    // Consultation: only questions that change the advice are asked.
    await page.locator('#uses .chip', { hasText: 'AI와 대화' }).click();
    result.webAsk = await page.locator('.ask-card h3').textContent().catch(() => null);
    result.webSkipped = await page.locator('#skipped li').allTextContents();
    await page.locator('#uses .chip', { hasText: '내 컴퓨터에 AI 설치하기' }).click();
    result.aiAsk = await page.locator('.ask-card h3').textContent();
    let rounds = 0;
    while (await page.locator('.ask-card .chip').count() && rounds < 12) { await page.locator('.ask-card .chip').first().click(); rounds += 1; }
    result.aiAnswered = rounds;
    result.aiAdvice = await page.locator('#advice').textContent();
    result.aiSkipped = await page.locator('#skipped li').allTextContents();
    result.aiCount = await page.locator('#count').textContent();
    await page.locator('#consult-title').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, 'lab-consult.png') });
    await context.close();
    // Phone width.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await phone.newPage(); p2.on('pageerror', e => errors.push(e.message)); watch(p2);
    await p2.goto(`${base}/atlas-lab/`); await p2.locator('.person').first().waitFor();
    result.mobileOverflow = await p2.evaluate(() => ({ scroll: document.documentElement.scrollWidth > innerWidth, zoomed: innerWidth > (visualViewport?.width ?? innerWidth) + 1 }));
    await p2.screenshot({ path: path.join(__dirname, 'lab-mobile.png'), fullPage: true });
    // The hub: today's condition is remembered for the day and reaches the games.
    await p2.goto(`${base}/learning-hub/`); await p2.locator('[data-today="tired"]').click();
    result.hubNote = await p2.locator('#today-note').textContent();
    await p2.screenshot({ path: path.join(__dirname, 'hub-today-mobile.png'), fullPage: true });
    await p2.goto(`${base}/order-rush/`); await p2.locator('[data-mode="rush"]').click(); await p2.locator('#start').click();
    await p2.waitForFunction(() => !document.querySelector('#flow-line').hidden);
    result.cafeAfterTired = await p2.locator('#flow-line').textContent();
    assert.equal(result.cafeAfterTired, '오늘은 더 바빠지지 않게 영업해요.');
    assert.deepEqual(result.mobileOverflow, { scroll: false, zoomed: false });
    await phone.close();
    assert.deepEqual(errors, []);
    assert.deepEqual([...new Set(result.missing)].filter(entry => !entry.split(' ')[1].startsWith('/synk-account/')), [], 'nothing else is missing');
    result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.error = error.message; process.exitCode = 1; }
  finally { result.pageErrors = errors; fs.writeFileSync(path.join(__dirname, 'lab-smoke.json'), JSON.stringify(result, null, 2) + '\n'); await browser.close(); console.log(JSON.stringify({ status: result.status, error: result.error, tryLine: result.tryLine, webAsk: result.webAsk, webSkipped: result.webSkipped, aiAsk: result.aiAsk, aiAnswered: result.aiAnswered, aiAdvice: result.aiAdvice, aiSkipped: result.aiSkipped, aiCount: result.aiCount, hubNote: result.hubNote, cafeAfterTired: result.cafeAfterTired, errors }, null, 1)); }
})();
