// Recheck only the corrected felt URL and its answer/feedback layout.
// Curriculum and account behavior remain evidenced by source-r2/report.json.
process.env.SYNK_WORLD_QA_URL ||= 'http://127.0.0.1:4312';
process.env.SYNK_LIFE_QA_RUN = 'source-r3';
const qa = require('../../life-content-browser.cjs');
let browser, context, page;

async function answerTargets(label) {
  const data = await page.locator('[data-life-choice]').evaluateAll(elements => elements.map(element => {
    const r = element.getBoundingClientRect(); return { width: r.width, height: r.height };
  }));
  qa.check(`${label}: each answer keeps a 44px target`, data.length === 3 && data.every(r => r.width >= 44 && r.height >= 44), data);
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-life-choice]').nth(i).scrollIntoViewIfNeeded();
    const result = await page.locator('[data-life-choice]').nth(i).evaluate(element => {
      const r = element.getBoundingClientRect(); return { inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, hit: element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) };
    });
    qa.check(`${label}: answer ${i + 1} is reachable`, result.inside && result.hit, result);
  }
}

(async () => {
  browser = await qa.launch(); context = await qa.context(); page = context.page;
  await page.goto(qa.base + '/mobile.html?opening=off', { waitUntil: 'domcontentloaded' }); await qa.ready(page); await qa.homePlaying(page);
  await page.waitForFunction(() => window.__synkWorld.life());
  const variables = await page.evaluate(() => ['--life-paper-button', '--life-coral-button', '--life-cream', '--life-blush'].map(name => ({ name, value: getComputedStyle(document.documentElement).getPropertyValue(name) })));
  qa.check('all four felt variables resolve to the approved brand asset directory', variables.length === 4 && variables.every(v => v.value.includes(locationOrigin(qa.base) + '/brand-opening/assets/home/')), variables);
  await page.locator('[data-life-next]').click(); await page.locator('[data-life-begin]').click();
  for (let n = 0; n < 20 && !await page.locator('[data-life-choice]').count(); n++) await page.locator('[data-life-scene-next]').click();
  for (const [w, h] of [[320, 740], [740, 320], [390, 844], [844, 390]]) {
    await qa.rotate(w, h, `answer/${w}x${h}`, page); await answerTargets(`answer/${w}x${h}`);
  }
  await page.locator('[data-life-choice="b"]').click(); await page.locator('.life-feedback').waitFor();
  const selected = await page.locator('.life-choice.is-chosen').evaluate(el => getComputedStyle(el).backgroundImage);
  qa.check('incorrect choice uses the actual blush felt image', selected.includes('/brand-opening/assets/home/quality-blush.webp'), selected);
  const served = await page.locator('.life-choice.is-chosen').evaluate(async el => {
    const value = getComputedStyle(el).backgroundImage;
    const url = value.match(/url\(["']?([^"')]+)["']?\)/)[1];
    const response = await fetch(url); return { url, status: response.status };
  });
  qa.check('the resolved blush felt file is served with HTTP 200', served.status === 200, served);
  const before = await qa.metrics(page);
  for (const [w, h] of [[320, 740], [740, 320], [390, 844], [844, 390]]) {
    await qa.rotate(w, h, `feedback/${w}x${h}`, page); await answerTargets(`feedback/${w}x${h}`);
    const after = await qa.metrics(page);
    qa.check(`feedback/${w}x${h}: rotation preserves the original incorrect answer`, JSON.stringify(after.progress) === JSON.stringify(before.progress));
    await page.locator('.life-feedback p').scrollIntoViewIfNeeded();
    const detail = await page.locator('.life-feedback p').evaluate(el => { const r = el.getBoundingClientRect(); return { inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, text: el.textContent }; });
    qa.check(`feedback/${w}x${h}: the explanation can be read without obscuring the actions`, detail.inside, detail);
    const next = await qa.hit('[data-life-question-next]', page);
    qa.check(`feedback/${w}x${h}: next remains visible and at least 44px`, next.inside && next.hit && next.width >= 44 && next.height >= 44, next);
    await qa.snap(`corrected-feedback-${w}x${h}`, page);
  }
  await page.locator('[data-life-question-next]').click();
  qa.check('the corrected feedback continues to the next real question', (await qa.metrics(page)).step === 1);
  qa.check('corrected felt produces no asset or API errors', qa.resources.length === 0, qa.resources);
  qa.check('corrected flow produces no JavaScript errors', qa.errors.length === 0, qa.errors);
  qa.check('corrected flow makes no external or paid requests', qa.blocked.length === 0, qa.blocked);
  qa.report();
  console.log(JSON.stringify({ passed: qa.checks.length, output: qa.output }));
})().catch(async error => {
  console.error(error.stack); if (page && !page.isClosed()) await qa.snap('failure', page).catch(() => {}); qa.report(error); process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });

function locationOrigin(url) { return new URL(url).origin; }
