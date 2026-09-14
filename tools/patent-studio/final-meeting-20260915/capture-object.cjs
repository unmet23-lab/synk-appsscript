'use strict';
// Bounded visual capture of one synthetic session, before and after the existing UI action.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = path.join(__dirname, 'qa');
async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-object-capture-20260915-'));
  let audioRequests = 0;
  const app = await createServer({ directory, transcriber: {
    status: async () => ({ provider: 'manual', available: false }),
    transcribe: async () => { audioRequests++; throw new Error('Audio is not part of this screenshot capture'); }
  } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1512, height: 1080 }, deviceScaleFactor: 2 });
    const externalRequests = [], pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { externalRequests.push(url.origin); return route.abort(); }
      return route.continue();
    });
    await page.goto(base);
    await page.waitForFunction(() => !document.querySelector('#create-correction-example').disabled);
    await page.locator('#create-correction-example').click();
    await page.waitForFunction(() => !document.querySelector('#correction-example').hidden && !document.querySelector('#apply-correction-example').disabled);
    const sessionId = new URL(page.url()).searchParams.get('session');
    assert.ok(sessionId);
    const read = async () => (await fetch(base + '/api/sessions/' + sessionId)).json();
    const before = await read();
    assert.equal(before.analysis.metrics.accepted, 3);
    assert.equal(before.analysis.cells.find(c => c.id === 'e0:object').status, 'accepted');
    const selector = '#cells [data-cell="e0:object"]';
    const beforePath = path.join(out, 'before-object.png');
    const afterPath = path.join(out, 'after-object.png');
    await page.locator(selector).screenshot({ path: beforePath });
    await page.locator('#apply-correction-example').click();
    await page.waitForFunction(() => document.querySelector('#correction-example-result').textContent.includes('반영 철회 1개'));
    const after = await read();
    assert.equal(after.id, before.id);
    assert.equal(after.analysis.metrics.accepted, 2);
    assert.equal(after.analysis.metrics.excluded, 1);
    assert.equal(after.analysis.cells.find(c => c.id === 'e0:object').status, 'excluded');
    assert.equal(after.effectLedger.entries.at(-1).summary.withdrawn, 1);
    assert.equal(after.effectLedger.entries.at(-1).summary.retained, 2);
    assert.equal(before.audios.length + after.audios.length, 0);
    await page.locator(selector).screenshot({ path: afterPath });
    assert.deepEqual(externalRequests, []); assert.deepEqual(pageErrors, []); assert.equal(audioRequests, 0);
    const readyPath = path.join(out, 'meeting-ready.json');
    const ready = JSON.parse(fs.readFileSync(readyPath, 'utf8'));
    ready.screenshots.beforeObject = beforePath;
    ready.screenshots.afterObject = afterPath;
    ready.objectScreenshots = { capturedAt: new Date().toISOString(), selector, deviceScaleFactor: 2,
      source: 'new isolated synthetic session; actual existing UI button', sameSession: true, sessionId,
      before: { revision: before.revision, accepted: 3, held: 0, excluded: 0, object: 'accepted' },
      after: { revision: after.revision, accepted: 2, held: 0, excluded: 1, object: 'excluded', withdrawn: 1, retained: 2 },
      audioOccurrences: 0, audioRequests, externalRequests: 0, pageErrors, meetingBaselineUntouched: true };
    fs.writeFileSync(readyPath, JSON.stringify(ready, null, 2) + '\n');
    console.log(JSON.stringify({ beforePath, afterPath, capture: ready.objectScreenshots }));
  } finally { await browser.close(); await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
