'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createServer } = require('./server.cjs');
const { createResilientTranscriber } = require('./resilient-transcriber.cjs');
const { verifyExport } = require('./projection-replay.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-studio-live-'));
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime/studio.json'), 'utf8'));
  fs.cpSync(path.join(config.directory, 'samples'), path.join(directory, 'samples'), { recursive: true });
  const transcriber = createResilientTranscriber({ env: { SYNK_PATENT_STT_PROVIDER: 'local' },
    cloud: { status: async () => ({ available: true, provider: 'gemini', model: 'fault-injection' }),
      transcribe: async () => { throw Object.assign(new Error('simulated disconnected network'), { code: 'SIMULATED_NETWORK_DOWN' }); } } });
  const app = await createServer({ directory, transcriber });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const sample = path.join(directory, 'samples/original.wav');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + sample] });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1080 }, permissions: ['microphone'] });
  const page = await context.newPage(), errors = [], checks = { scope: 'Real local recognizer and browser capture of a synthetic fixture; human review fields are test inputs. External failure is injected, local inference is real.' };
  page.on('pageerror', error => errors.push(error.message));
  const out = path.join(__dirname, 'qa-output');
  fs.mkdirSync(out, { recursive: true });
  const request = async (url, body) => {
    const result = await fetch(base + url, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Studio-Token': app.token }, body: JSON.stringify(body) });
    assert.ok(result.ok, `HTTP ${result.status} ${url}`); return result.json();
  };
  try {
    checks.preflight = await request('/api/preflight', {}); assert.equal(checks.preflight.ok, true);
    await page.goto(base); await page.waitForFunction(() => !document.querySelector('#create-recording').disabled);
    await page.locator('#mode-recording').click(); await page.locator('#create-recording').click();
    await page.waitForFunction(() => !document.querySelector('#record-original').disabled);
    await page.locator('#record-original').click(); await page.waitForFunction(() => !document.querySelector('#recording-bar').hidden);
    await new Promise(resolve => setTimeout(resolve, 4500)); await page.locator('#stop-recording').click();
    await page.waitForFunction(() => document.querySelector('#original-audio-status').textContent.includes('실제 자동 전사'), { timeout: 60000 });
    const id = new URL(page.url()).searchParams.get('session');
    let session = await (await fetch(base + '/api/sessions/' + id)).json();
    const audio = session.audios[0];
    assert.equal(audio.transcription.provider, 'local'); assert.equal(audio.transcription.raw.networkAttempts, 0);
    assert.equal(session.original.source, 'machine'); assert.equal(session.original.humanConfirmed, false);
    checks.recording = { text: audio.transcription.text, source: session.original.source, provider: audio.transcription.provider,
      networkAttempts: audio.transcription.raw.networkAttempts, capture: session.original.performanceInterval, bytes: audio.bytes };
    await page.locator('details.task-options summary').click();
    for (const selector of ['#role-confirmed', '#past-independent', '#exposure-confirmed']) await page.locator(selector).check();
    await page.locator('#save-task').click(); await page.waitForFunction(() => !document.querySelector('#save-task').disabled);
    await page.locator('#review-text').fill('친구를 만나서 카페에 갔어요.'); await page.locator('#review-confirmed').check(); await page.locator('#review-original').click();
    await page.waitForFunction(() => document.querySelector('#analysis-summary').textContent.includes('3개 반영'));
    await page.locator('#present-help').click(); await page.waitForFunction(() => document.querySelector('#help-dialog').open && !document.querySelector('#help-continue').disabled); await page.locator('#help-continue').click();
    await page.locator('#file-response').setInputFiles(sample);
    await page.waitForFunction(() => !document.querySelector('#response-review-details').hidden && !document.querySelector('#file-response').disabled, { timeout: 60000 });
    if (!await page.locator('#response-review-details').evaluate(el => el.open)) await page.locator('#response-review-details summary').click();
    await page.locator('#response-review-text').fill('친구를 만나서 카페에 갔어요.');
    for (const selector of ['#response-review-confirmed', '#response-exposure-confirmed', '#response-time-confirmed']) await page.locator(selector).check();
    await page.locator('#review-response').click(); await page.waitForFunction(() => document.querySelector('#analysis-summary').textContent.includes('6개 반영'));
    session = await (await fetch(base + '/api/sessions/' + id)).json();
    checks.finalMetrics = session.analysis.metrics; assert.equal(checks.finalMetrics.excluded, 1);
    const retry = await request('/api/sessions/' + id + '/transcribe', { expectedRevision: session.revision, audioRef: audio.audioRef, audioEventId: audio.audioEventId, provider: 'auto' });
    const after = retry.audios.find(a => a.audioEventId === audio.audioEventId);
    checks.fallback = { provider: after.transcription.provider, attempts: after.transcription.raw.routeAttempts };
    assert.deepEqual(checks.fallback.attempts.map(a => a.outcome), ['failed', 'succeeded']); assert.equal(checks.fallback.provider, 'local');
    assert.equal(retry.original.source, 'human'); assert.equal(retry.original.humanConfirmed, true);
    const bundle = await (await fetch(base + '/api/sessions/' + id + '/export')).json();
    fs.writeFileSync(path.join(out, 'live-evidence-export.json'), JSON.stringify(bundle, null, 2));
    checks.replay = verifyExport(bundle); assert.equal(checks.replay.valid, true);
    await page.reload(); await page.waitForFunction(() => document.querySelector('#original-player audio')?.src);
    await page.screenshot({ path: path.join(out, 'live-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(out, 'live-mobile.png'), fullPage: true });
    checks.overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(checks.overflow.scrollWidth <= checks.overflow.width + 1); assert.deepEqual(errors, []);
    checks.errors = errors; checks.passed = true;
  } catch (error) {
    checks.failure = { message: error.message, errors, notice: await page.locator('#notice').innerText().catch(() => ''),
      state: await page.evaluate(() => ({ busy: state.busy, recorderStarting: state.recorderStarting, recording: !!state.recording, retry: !!state.retry, pendingHelp: !!state.pendingHelp })).catch(() => null) };
    await page.screenshot({ path: path.join(out, 'live-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'browser-live-checks.json'), JSON.stringify(checks, null, 2));
    await browser.close(); await app.close();
  }
  console.log(JSON.stringify(checks, null, 2));
}
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
