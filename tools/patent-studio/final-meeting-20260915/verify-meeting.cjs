'use strict';
// Existing UI, Core, Store and renderer only. Synthetic sessions, no microphone or STT requests.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const studio = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'qa');
const { createServer } = require('../server.cjs');
const { verifyExport } = require('../projection-replay.cjs');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const saved = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
const states = s => Object.fromEntries(s.analysis.cells.map(c => [c.id, c.status]));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  // Run the original bounded QA once. Only redirect its output directory in memory.
  const originalPath = path.join(studio, 'late-correction-qa.cjs');
  const originalCode = fs.readFileSync(originalPath, 'utf8');
  const outputNeedle = "out = path.join(__dirname, 'qa-output')";
  assert.equal(originalCode.split(outputNeedle).length, 2);
  const legacyOut = path.join(out, 'legacy');
  const wrapped = originalCode.replace(outputNeedle, `out = ${JSON.stringify(legacyOut)}`);
  const runner = "const Module=require('node:module');const m=new Module(process.argv[1]);m.filename=process.argv[1];m.paths=Module._nodeModulePaths(require('node:path').dirname(m.filename));m._compile(require('node:fs').readFileSync(0,'utf8'),m.filename);";
  const legacy = spawnSync(process.execPath, ['-e', runner, originalPath], { input: wrapped, encoding: 'utf8', timeout: 120000, windowsHide: true });
  fs.writeFileSync(path.join(out, 'legacy-run.log'), legacy.stdout + legacy.stderr);
  assert.equal(legacy.status, 0, legacy.stderr);
  const legacyProof = JSON.parse(fs.readFileSync(path.join(legacyOut, 'late-correction-checks.json'), 'utf8'));
  assert.equal(legacyProof.passed, true);

  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-meeting-20260915-'));
  let audioRequests = 0;
  const app = await createServer({ directory: isolatedDir, transcriber: {
    status: async () => ({ provider: 'manual', available: false }),
    transcribe: async () => { audioRequests++; throw new Error('Audio is not part of this meeting QA'); }
  } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const isolatedBase = 'http://127.0.0.1:' + app.server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1080 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [], externalRequests = [], shots = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { externalRequests.push(url.origin); return route.abort(); }
    return route.continue();
  });
  const read = async base => {
    const id = new URL(page.url()).searchParams.get('session');
    assert.ok(id, 'Our newly created session must be selected');
    return (await fetch(base + '/api/sessions/' + id)).json();
  };
  const capture = async (key, selector) => {
    const destination = path.join(out, key + '.png');
    await page.locator(selector).screenshot({ path: destination });
    shots[key] = destination;
    return destination;
  };
  const correction = async base => {
    await page.goto(base);
    await page.waitForFunction(() => !document.querySelector('#create-correction-example').disabled);
    await page.locator('#create-correction-example').click();
    await page.waitForFunction(() => !document.querySelector('#correction-example').hidden && !document.querySelector('#apply-correction-example').disabled);
    const s = await read(base); assert.equal(s.analysis.metrics.accepted, 3); assert.equal(s.audios.length, 0); return s;
  };
  const verify = async () => {
    if (!await page.locator('#effect-ledger-details').evaluate(el => el.open)) await page.locator('#effect-ledger-details summary').click();
    await page.locator('#verify-record').click();
    await page.waitForFunction(() => document.querySelector('#ledger-verification').textContent.includes('저장 사건과 판정이 일치합니다'));
  };
  const results = { legacy: { passed: true, sourceSha256: sha(originalPath), outputDirectoryRedirectOnly: true }, checks: {}, screenshots: shots };
  try {
    const before = await correction(isolatedBase);
    await capture('before', '#cells');
    await capture('before-result', '#correction-example');
    await page.locator('#correction-example').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'before-page.png') });
    shots['before-page'] = path.join(out, 'before-page.png');
    await page.locator('#apply-correction-example').click();
    await page.waitForFunction(() => document.querySelector('#correction-example-result').textContent.includes('반영 철회 1개'));
    const after = await read(isolatedBase), last = after.effectLedger.entries.at(-1);
    assert.deepEqual(states(after), { 'e0:asr': 'accepted', 'e0:object': 'excluded', 'e0:past': 'accepted' });
    assert.equal(last.summary.withdrawn, 1); assert.equal(last.summary.retained, 2); assert.equal(after.audios.length, 0);
    await capture('after', '#cells');
    await capture('after-result', '#correction-example');
    await capture('ledger', '#effect-ledger-content');
    if (await page.locator('#change-summary').isVisible()) await capture('change-summary', '#change-summary');
    await verify(); await capture('replay', '#ledger-verification');
    const downloadPending = page.waitForEvent('download');
    await page.locator('#export-link').click();
    const download = await downloadPending;
    await download.saveAs(path.join(out, 'downloaded-record.json'));
    const downloaded = JSON.parse(fs.readFileSync(path.join(out, 'downloaded-record.json'), 'utf8'));
    assert.equal(downloaded.session.id, after.id);
    const independentReplay = verifyExport(downloaded); assert.equal(independentReplay.valid, true);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#correction-example').hidden);
    const reloaded = await read(isolatedBase); assert.equal(reloaded.revision, after.revision); assert.deepEqual(states(reloaded), states(after));
    assert.equal(await page.locator('#apply-correction-example').isDisabled(), true);
    await verify(); await capture('replay-after-reload', '#ledger-verification');
    results.checks.correction = { before: states(before), after: states(after), transition: last.summary, replay: independentReplay, downloadButton: true, refreshPreserved: true, verificationAfterRefresh: true, audioOccurrences: 0 };

    results.checks.ambiguous = [];
    for (const direction of ['after', 'before']) {
      await page.locator('#create-time-example').click();
      await page.waitForFunction(() => !document.querySelector('#advance-content').hidden && !document.querySelector('#create-time-example').disabled);
      const initial = await read(isolatedBase), initialLast = initial.effectLedger.entries.at(-1);
      assert.deepEqual(states(initial), { 'e0:asr': 'accepted', 'e0:object': 'held', 'e0:past': 'accepted' });
      assert.equal(initialLast.transitions.find(t => t.cellId === 'e0:object').action, 'withdrawn');
      if (direction === 'after') await capture('ambiguous', '#advance-content');
      await page.locator('#refine-' + direction).click();
      await page.waitForFunction(() => document.querySelector('#refine-after').dataset.done === 'true');
      const refined = await read(isolatedBase), delta = refined.effectLedger.entries.at(-1).transitions.find(t => t.cellId === 'e0:object');
      assert.equal(refined.analysis.cells.find(c => c.id === 'e0:object').status, direction === 'after' ? 'accepted' : 'excluded');
      assert.equal(delta.action, direction === 'after' ? 'added' : 'excluded');
      assert.deepEqual(refined.original, initial.original);
      await capture('ambiguous-' + direction, '#advance-content');
      await verify();
      results.checks.ambiguous.push({ direction, initialStatus: 'held', initialTransition: 'withdrawn', afterStatus: delta.after.status, transition: delta.action, originalUnchanged: true, verified: true, input: 'synthetic bounds, not measured clock error' });
    }
    assert.equal(audioRequests, 0); assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);

    // Only create our own new synthetic session on the meeting service. No existing session is opened.
    const liveBase = fs.readFileSync(path.join(__dirname, '.runtime', 'url.txt'), 'utf8').trim();
    const health = await (await fetch(liveBase + '/api/health')).json();
    assert.equal(health.service, 'synk-evidence-studio'); assert.equal(health.engineVersion, '0.5.0');
    const live = await correction(liveBase);
    const baselineUrl = page.url();
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#correction-example').hidden && !document.querySelector('#apply-correction-example').disabled);
    const reopened = await read(liveBase); assert.equal(reopened.id, live.id); assert.equal(reopened.analysis.metrics.accepted, 3); assert.equal(reopened.revision, 1); assert.equal(reopened.audios.length, 0);
    await capture('meeting-baseline', '#cells');
    assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
    const ready = { checkedAt: new Date().toISOString(), baseUrl: liveBase, baselineUrl, passed: true,
      checks: { ...results.checks, legacy: results.legacy, meetingBaseline: { revision: reopened.revision, accepted: 3, held: 0, excluded: 0, eventCount: reopened.events.length, audioOccurrences: 0, correctionButtonEnabled: true, reopened: true }, externalRequests: 0, audioRequests: 0, pageErrors: [],
        sourceSha256: Object.fromEntries(['core.cjs','store.cjs','temporal-evidence.cjs','projection.cjs','public/app.js','public/advance.js'].map(p => [p, sha(path.join(studio,p))])),
        remaining: ['at and timeBounds both omitted still fall back to server time; not changed here', 'no student production integration or learning-effect measurement', 'microphone, speaker and automatic transcription not tested in this run'], original4318Preserved: true }, screenshots: shots };
    saved('meeting-ready.json', ready);
    console.log(JSON.stringify({ checkedAt: ready.checkedAt, baseUrl: liveBase, baselineUrl, passed: true, screenshots: shots, ambiguous: results.checks.ambiguous, downloadButton: true, refreshReplay: true, audioRequests: 0 }));
  } finally {
    await browser.close(); await app.close();
    // The temporary synthetic DB is deliberately retained; no filesystem deletion is needed.
  }
}
main().catch(error => { fs.mkdirSync(out, { recursive: true }); saved('failure.json', { checkedAt: new Date().toISOString(), error: error.stack }); console.error(error.stack); process.exitCode = 1; });
