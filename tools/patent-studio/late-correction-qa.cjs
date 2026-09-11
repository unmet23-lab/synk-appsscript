'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createServer } = require('./server.cjs');
const { verifyExport } = require('./projection-replay.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
(async () => {
  const app = await createServer({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'synk-late-correction-')),
    transcriber: { status: async () => ({ provider: 'manual', available: false }), transcribe: async () => { throw new Error('No audio request is expected'); } } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1080 } });
  const errors = [], out = path.join(__dirname, 'qa-output');
  fs.mkdirSync(out, { recursive: true });
  const proof = { scope: 'Controlled example only: authored review and historical help events, no student audio or actual historical assistance.' };
  page.on('pageerror', e => errors.push(e.message));
  const read = async () => (await fetch(base + '/api/sessions/' + new URL(page.url()).searchParams.get('session'))).json();
  const start = async () => {
    await page.locator('#create-correction-example').click();
    await page.waitForFunction(() => !document.querySelector('#correction-example').hidden && !document.querySelector('#apply-correction-example').disabled);
  };
  try {
    await page.goto(base); await page.waitForFunction(() => !document.querySelector('#create-correction-example').disabled);
    await start();
    const before = await read(); assert.equal(before.analysis.metrics.accepted, 3);
    await page.locator('#apply-correction-example').click();
    await page.waitForFunction(() => document.querySelector('#correction-example-result').textContent.includes('반영 철회 1개'));
    const after = await read(); const last = after.effectLedger.entries.at(-1);
    assert.equal(last.summary.withdrawn, 1); assert.equal(last.summary.retained, 2);
    assert.equal(after.analysis.cells.find(c => c.id === 'e0:object').status, 'excluded');
    assert.equal(after.analysis.cells.find(c => c.id === 'e0:asr').status, 'accepted');
    assert.equal(after.analysis.cells.find(c => c.id === 'e0:past').status, 'accepted');
    assert.equal(after.audios.length, 0); assert.equal(after.mode, 'example');
    const help = after.events.at(-1);
    assert.equal(Date.parse(after.original.performanceInterval.startedAt) - Date.parse(help.at), 60000);
    assert.match(await page.locator('#timeline').innerText(), /시연용 과거 도움 기록 추가/);
    assert.doesNotMatch(await page.locator('#effect-ledger-content').innerText(), /도움 문장 실제 제시/);
    await page.locator('#verify-record').click(); await page.waitForFunction(() => document.querySelector('#ledger-verification').textContent.includes('일치합니다'));
    const bundle = await (await fetch(base + '/api/sessions/' + after.id + '/export')).json();
    proof.replay = verifyExport(bundle); assert.equal(proof.replay.valid, true);
    fs.writeFileSync(path.join(out, 'late-correction-export.json'), JSON.stringify(bundle, null, 2));
    proof.before = before.analysis.metrics; proof.after = after.analysis.metrics; proof.transition = last.summary;
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#correction-example').hidden);
    assert.equal(await page.locator('#apply-correction-example').isDisabled(), true);
    await page.locator('#effect-ledger-details summary').click();
    await page.locator('#correction-example').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'late-correction-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#correction-example').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'late-correction-mobile.png') });
    const width = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(width.width, width.scrollWidth); proof.mobile = width;
    await page.setViewportSize({ width: 1512, height: 1080 });
    await start();
    let dropped = false;
    await page.route('**/events', async route => {
      const event = route.request().postDataJSON()?.event;
      if (!dropped && event?.id.startsWith('demo-correction-help-')) { dropped = true; await route.fetch(); await route.abort('failed'); }
      else await route.continue();
    });
    await page.locator('#apply-correction-example').click(); await page.locator('#retry-bar').waitFor({ state: 'visible' });
    await page.locator('#retry-button').click();
    await page.waitForFunction(() => document.querySelector('#correction-example-result').textContent.includes('반영 철회 1개'));
    const retried = await read(); assert.equal(retried.events.length, 2); assert.equal(retried.revision, 2);
    proof.lostAcknowledgement = { dropped, events: retried.events.length, revision: retried.revision, replay: (await (await fetch(base + '/api/sessions/' + retried.id + '/verification')).json()).valid };
    await page.unroute('**/events');
    await start(); await page.locator('#purpose-select').selectOption('asr-data'); await page.locator('#save-purpose').click();
    await page.waitForFunction(() => !document.querySelector('#save-purpose').disabled);
    assert.equal(await page.locator('#apply-correction-example').isDisabled(), true);
    assert.match(await page.locator('#correction-example-note').innerText(), /조건을 추가로 바꿨습니다/);
    await page.locator('#mode-recording').click(); await page.locator('#create-recording').click();
    await page.waitForFunction(() => document.querySelector('#session-mode').textContent === '실제 녹음');
    assert.equal(await page.locator('#correction-example').isVisible(), false);
    assert.equal(await page.locator('#apply-correction-example').isDisabled(), true);
    proof.modifiedExampleLocked = true; proof.realSessionExcluded = true;
    assert.deepEqual(errors, []); proof.passed = true;
  } finally {
    proof.errors = errors; fs.writeFileSync(path.join(out, 'late-correction-checks.json'), JSON.stringify(proof, null, 2));
    await browser.close(); await app.close();
  }
  console.log(JSON.stringify(proof));
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
