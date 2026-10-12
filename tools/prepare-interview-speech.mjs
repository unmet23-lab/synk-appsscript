/** Real browser/WASM integration proof with a public synthetic Korean WAV.
 * Run: node tools/prepare-interview-speech.mjs
 * Requires the assets from the .py and .ps1 tools, and Playwright/Chrome.
 * Does not use real microphone input, external inference, or paid APIs.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const runtime = process.env.PLAYWRIGHT_MODULE || 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(runtime);
const root = fileURLToPath(new URL('../experiences/path-vr/', import.meta.url));
const allowed = new Set(['interview/voice.mjs', 'interview/audio-worklet.js', 'vendor/vosk/vosk.mjs', 'vendor/vosk/vosk-worker.js', 'models/vosk-model-small-ko-0.22.tar.gz', 'models/fixtures/interview-ko.wav']);
const server = http.createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1);
  const headers = { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; object-src 'none'", 'X-Content-Type-Options': 'nosniff' };
  if (name === 'vendor/vosk/vosk-worker.js') headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace("'wasm-unsafe-eval'", "'unsafe-eval'");
  if (!name) { response.writeHead(200, { ...headers, 'Content-Type': 'text/html' }); response.end('<!doctype html><title>Local Korean speech fixture</title>'); return; }
  if (name === 'favicon.ico') { response.writeHead(204); response.end(); return; }
  if (!allowed.has(name)) { response.writeHead(404); response.end(); return; }
  try {
    const file = path.join(root, name);
    const size = (await stat(file)).size;
    response.writeHead(200, { ...headers, 'Content-Length': size, 'Content-Type': name.endsWith('.gz') ? 'application/gzip' : name.endsWith('.wav') ? 'audio/wav' : 'text/javascript' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [], external = [], diagnostics = [];
let result;
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (!request.url().startsWith(base) && !request.url().startsWith('data:')) external.push(request.url()); });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); if (['warning', 'error'].includes(message.type())) diagnostics.push(message.text()); });
  await page.goto(base);
  result = await page.evaluate(async () => {
    const { transcribeWavFixture } = await import('/interview/voice.mjs');
    const statuses = [];
    let frames = 0;
    const timer = setInterval(() => { frames += 1; }, 16);
    const started = performance.now();
    try {
      const recognized = await transcribeWavFixture('/models/fixtures/interview-ko.wav', { onStatus(status) { if (statuses.at(-1)?.state !== status.state || status.loaded === status.total) statuses.push(status); } });
      return { recognized, statuses, elapsedMs: Math.round(performance.now() - started), renderThreadTicks: frames };
    } finally { clearInterval(timer); }
  });
  const compact = result.recognized.text.replace(/\s+/gu, '');
  result.checks = { nonemptyKorean: /[가-힣]/u.test(compact), greeting: compact.includes('안녕하세요'), targetLanguage: compact.includes('한국어'), careerContext: compact.includes('회사'), mainThreadResponsive: result.renderThreadTicks > 60, noExternalRequests: external.length === 0, noBrowserErrors: errors.length === 0 };
  result.pass = Object.values(result.checks).every(Boolean);
} catch (error) { result = { pass: false, failure: error.message }; }
finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
const report = { checkedAt: new Date().toISOString(), scope: 'Desktop Chrome using the real browser AudioWorklet and Vosk WASM worker. Quest hardware not tested.', fixture: 'Locally synthesized Microsoft Heami Desktop. No user recording.', ...result, errors, external, diagnostics };
await writeFile(path.join(root, 'models/fixtures/verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!result?.pass) process.exitCode = 1;
