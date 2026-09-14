'use strict';
// Capture one existing synthetic QA record; does not create or amend any event.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = path.join(__dirname, 'qa');
async function main() {
  const directory = process.argv[2];
  assert.ok(directory && fs.existsSync(directory), 'Existing isolated synthetic QA directory required');
  const exported = JSON.parse(fs.readFileSync(path.join(out, 'downloaded-record.json'), 'utf8'));
  const app = await createServer({ directory, transcriber: {
    status: async () => ({ provider: 'manual', available: false }),
    transcribe: async () => { throw new Error('Audio is not part of this screenshot capture'); }
  } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1512, height: 1080 } });
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${app.server.address().port}/?session=${exported.session.id}`);
    const latest = page.locator('#effect-ledger-content .ledger-entry').first();
    await latest.waitFor({ state: 'attached' });
    if (!await page.locator('#effect-ledger-details').evaluate(el => el.open)) await page.locator('#effect-ledger-details summary').click();
    assert.equal((await latest.locator('h4').innerText()).replace(/\s/g, ''), 'v1→v2');
    assert.match(await latest.innerText(), /철회 1 · 유지 2 · 보류 0/);
    const screenshot = path.join(out, 'ledger-latest.png');
    await latest.screenshot({ path: screenshot });
    const readyPath = path.join(out, 'meeting-ready.json');
    const ready = JSON.parse(fs.readFileSync(readyPath, 'utf8'));
    ready.screenshots['ledger-full'] = path.join(out, 'ledger.png');
    ready.screenshots.ledger = screenshot;
    ready.ledgerScreenshot = { capturedAt: new Date().toISOString(), selector: '#effect-ledger-content .ledger-entry:first-of-type', fromRevision: 1, toRevision: 2, source: 'existing isolated synthetic QA session', noEventsAdded: true };
    fs.writeFileSync(readyPath, JSON.stringify(ready, null, 2) + '\n');
    console.log(JSON.stringify({ screenshot, text: await latest.innerText() }));
  } finally { await browser.close(); await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
