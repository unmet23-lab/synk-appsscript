'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try {
  ({
    chromium
  } = require('playwright'));
} catch {
  ({
    chromium
  } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));
}
const {
  createServer
} = require('./server.cjs');
const resultDir = path.join(__dirname, 'qa-output');
const sample = path.join(process.env.LOCALAPPDATA, 'SYNK/patent-studio/samples/original.wav');
async function run() {
  fs.mkdirSync(resultDir, {
    recursive: true
  });
  // Browser capture/HTTP/database tests run without transmitting audio. Actual
  // provider verification is a separate, explicitly identified check.
  const dir = path.join(resultDir, 'browser-data');
  const app = await createServer({
    directory: dir,
    transcriber: {
      status: async () => ({
        available: false,
        provider: 'manual',
        reason: 'automated_browser_test_no_network'
      }),
      transcribe: async () => {
        throw new Error('no external audio in UI QA');
      }
    }
  });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + sample]
  });
  const ctx = await browser.newContext({
    viewport: {
      width: 1512,
      height: 1080
    },
    permissions: ['microphone']
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const checks = {};
  try {
    await page.goto(base);
    await page.waitForFunction(() => !document.querySelector('#create-example').disabled);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(resultDir, '01-start.png'),
      fullPage: true
    });
    await page.locator('#create-example').click();
    await page.waitForFunction(() => document.querySelector('#cells').textContent.includes('과거형'));
    checks.example = await page.locator('#cells').innerText();
    assert.match(checks.example, /보류/);
    assert.match(checks.example, /반영/);
    await page.screenshot({
      path: path.join(resultDir, '02-example.png'),
      fullPage: true
    });
    checks.fonts = await page.evaluate(() => ({
      suit: document.fonts.check('500 16px "SUIT Variable"'),
      inter: document.fonts.check('500 16px "Inter Tight"'),
      mono: document.fonts.check('500 16px "DM Mono"')
    }));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const {
      root
    } = await cdp.send('DOM.getDocument');
    checks.actualFonts = {};
    for (const selector of ['h1', '.pane-intro']) {
      const {
        nodeId
      } = await cdp.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector
      });
      checks.actualFonts[selector] = (await cdp.send('CSS.getPlatformFontsForNode', {
        nodeId
      })).fonts;
    }
    checks.images = await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    assert.deepEqual(checks.images, []);
    await page.locator('#mode-recording').click();
    await page.locator('#create-recording').click();
    await page.waitForFunction(() => !document.querySelector('#record-original').disabled);
    await page.locator('#record-original').click();
    await page.waitForFunction(() => !document.querySelector('#recording-bar').hidden);
    await new Promise(r => setTimeout(r, 4500));
    await page.locator('#stop-recording').click();
    await page.waitForFunction(() => document.querySelector('#original-player audio')?.src, {
      timeout: 30000
    });
    const audio = page.locator('#original-player audio');
    checks.captureUrl = await audio.getAttribute('src');
    assert.ok(checks.captureUrl);
    await audio.evaluate(el => el.load());
    await page.waitForFunction(() => document.querySelector('#original-player audio').readyState >= 1);
    checks.duration = await page.evaluate(async () => {
      const bytes = await (await fetch(document.querySelector('#original-player audio').src)).arrayBuffer();
      const context = new AudioContext();
      try {
        return (await context.decodeAudioData(bytes)).duration;
      } finally {
        await context.close();
      }
    });
    assert.ok(Number.isFinite(checks.duration) && checks.duration > 0);
    await page.screenshot({
      path: path.join(resultDir, '03-recorded.png'),
      fullPage: true
    });
    await page.locator('details.task-options summary').click();
    await page.locator('#role-confirmed').check();
    await page.locator('#past-independent').check();
    await page.locator('#exposure-confirmed').check();
    await page.locator('#save-task').click();
    await page.waitForFunction(() => !document.querySelector('#save-task').disabled);
    await page.locator('#review-text').fill('친구를 만나서 카페에 갔어요.');
    await page.locator('#review-confirmed').check();
    await page.locator('#review-original').click();
    await page.waitForFunction(() => document.querySelector('#analysis-summary').textContent.includes('3개 반영'));
    checks.originalReviewed = await page.locator('#cells').innerText();
    await page.locator('#present-help').click();
    await page.waitForFunction(() => document.querySelector('#help-dialog').open && !document.querySelector('#help-continue').disabled);
    checks.helpShown = await page.locator('#help-display').innerText();
    await page.locator('#help-continue').click();
    await page.locator('#file-response').setInputFiles(sample);
    await page.waitForFunction(() => !document.querySelector('#response-review-details').hidden && !document.querySelector('#file-response').disabled);
    if (!(await page.locator('#response-review-details').evaluate(el => el.open))) await page.locator('#response-review-details summary').click();
    await page.locator('#response-review-text').fill('친구를 만나서 카페에 갔어요.');
    await page.locator('#response-review-confirmed').check();
    await page.locator('#response-exposure-confirmed').check();
    await page.locator('#response-time-confirmed').check();
    await page.locator('#review-response').click();
    await page.waitForFunction(() => document.querySelector('#analysis-summary').textContent.includes('6개 반영'));
    checks.afterHelp = await page.locator('#cells').innerText();
    assert.match(checks.afterHelp, /사용 제외/);
    assert.match(checks.afterHelp, /도움 후/);
    await page.locator('#comparison-button').click();
    await page.waitForFunction(() => document.querySelector('#comparison-dialog').open);
    checks.comparison = await page.locator('#comparison-content').innerText();
    assert.match(checks.comparison, /시점/);
    await page.screenshot({
      path: path.join(resultDir, '05-comparison.png')
    });
    await page.locator('#comparison-dialog form button').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-link').click();
    const download = await downloadPromise;
    await download.saveAs(path.join(resultDir, 'evidence-export.json'));
    const exported = JSON.parse(fs.readFileSync(path.join(resultDir, 'evidence-export.json'), 'utf8'));
    assert.equal(exported.files.length, 2);
    assert.ok(exported.session.events.some(e => e.type === 'help-presented'));
    assert.ok(exported.session.analysis.cells.some(c => c.reasonCode === 'later-response-not-original-evidence'));
    checks.export = {
      files: exported.files.length,
      events: exported.session.events.length,
      revision: exported.session.revision
    };
    await page.screenshot({
      path: path.join(resultDir, '06-full-flow.png'),
      fullPage: true
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#original-player audio')?.src);
    checks.persistedAudio = await page.locator('#original-player audio').getAttribute('src');
    assert.equal(checks.persistedAudio, checks.captureUrl);
    await page.setViewportSize({
      width: 390,
      height: 844
    });
    await page.screenshot({
      path: path.join(resultDir, '04-mobile.png'),
      fullPage: true
    });
    checks.overflow = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    assert.ok(checks.overflow.scrollWidth <= checks.overflow.width + 1);
    assert.deepEqual(errors, []);
    checks.errors = errors;
    checks.passed = true;
  } finally {
    fs.writeFileSync(path.join(resultDir, 'browser-checks.json'), JSON.stringify(checks, null, 2));
    await browser.close();
    await app.close();
  }
  console.log(JSON.stringify(checks, null, 2));
}
run().catch(e => {
  console.error(e.stack);
  process.exitCode = 1;
});
