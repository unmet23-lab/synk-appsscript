/** Full standalone app proof through Chrome's fake microphone, never user audio.
 * First: node tools/package-path-interview.mjs
 * Then:  node tools/qa-path-interview-microphone.mjs
 * Uses the package's actual path-specific CSP, local WASM and synthetic WAV.
 * Desktop proof only; does not emulate Quest hardware or publish anything.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { OUTPUT } from './package-path-interview.mjs';
import { parseRange } from '../experiences/path-vr/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture = fileURLToPath(new URL('../experiences/path-vr/models/fixtures/interview-ko.wav', import.meta.url));
const reportPath = fileURLToPath(new URL('../.tmp/path-interview-microphone-qa.json', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(OUTPUT, '_package-manifest.json'), 'utf8'));
const files = new Set(manifest.files.map((entry) => entry.file));
const headerBlocks = new Map();
let target;
for (const line of (await readFile(path.join(OUTPUT, '_headers'), 'utf8')).split('\n')) {
  if (line.startsWith('/')) { target = line; headerBlocks.set(target, {}); }
  else if (line.startsWith('  ') && target) {
    const separator = line.indexOf(':');
    headerBlocks.get(target)[line.slice(2, separator)] = line.slice(separator + 1).trim();
  }
}
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
  const headers = { ...headerBlocks.get('/*'), ...headerBlocks.get('/' + file) };
  if (!files.has(file)) { response.writeHead(404, headers); response.end(); return; }
  try {
    const absolute = path.join(OUTPUT, file), info = await stat(absolute);
    const range = parseRange(request.headers.range, info.size);
    if (range === false) { response.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); response.end(); return; }
    const start = range?.start || 0, end = range?.end ?? info.size - 1;
    response.writeHead(range ? 206 : 200, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}) });
    if (request.method === 'HEAD') response.end();
    else createReadStream(absolute, range || {}).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404, headers); response.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: [
  '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${fixture}`
] });
const checks = {}, errors = [], external = [], uploadRequests = [], failedRequests = [], snapshots = [];
let failure;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => {
    if (!request.url().startsWith(origin + '/') && !/^(?:blob:|data:)/.test(request.url())) external.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) uploadRequests.push({ url: request.url(), method: request.method() });
  });
  page.on('response', (response) => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
  await page.addInitScript(() => {
    const tracks = [], original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await original(...args); tracks.push(...stream.getTracks()); return stream;
    };
    window.syntheticMicrophoneProbe = () => ({ totalTracks: tracks.length, liveTracks: tracks.filter((track) => track.readyState === 'live').length, endedTracks: tracks.filter((track) => track.readyState === 'ended').length });
  });
  const snapshot = async (label) => {
    const state = await page.evaluate(() => ({ ...window.pathInterviewDiagnostics(), ...window.syntheticMicrophoneProbe(), transcript: document.getElementById('transcript').textContent, caption: document.getElementById('caption').textContent }));
    snapshots.push({ label, ...state }); console.log(label, JSON.stringify({ phase: state.phase, turn: state.turn, branch: state.branch, liveTracks: state.liveTracks, transcript: state.transcript })); return state;
  };
  const check = (name, value) => { checks[name] = value; assert.ok(value, name); };
  await page.goto(origin + '/');
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', undefined, { timeout: 60000 });
  check('standaloneRootRedirect', new URL(page.url()).pathname === '/interview/');
  check('roomAndAudioReady', (await snapshot('loaded')).audioReady === true);
  await page.locator('#mic-consent').check(); await page.locator('#prepare').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.microphonePrepared === true, undefined, { timeout: 90000 });
  const prepared = await snapshot('prepared');
  check('localModelReady', prepared.voiceReady === true);
  check('prepareClosesMicrophone', prepared.totalTracks >= 1 && prepared.liveTracks === 0);
  await page.locator('#prepare').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'listening', undefined, { timeout: 40000 });
  await page.waitForFunction(() => window.syntheticMicrophoneProbe().liveTracks > 0);
  await page.waitForFunction(() => document.getElementById('transcript').textContent.includes('공부'), undefined, { timeout: 20000 });
  const firstAnswer = await snapshot('first-spoken-answer');
  check('realMicrophonePipelineRecognizesKorean', /한국어/.test(firstAnswer.transcript));
  await page.locator('#finish-answer').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'followup', undefined, { timeout: 15000 });
  const followup = await snapshot('changed-followup');
  check('spokenStudyCueSelectsPreparation', followup.branch === 'preparation' && /어떤 준비/.test(followup.caption));
  check('submitClosesMicrophone', followup.liveTracks === 0);
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'listening' && window.pathInterviewDiagnostics()?.turn === 2, undefined, { timeout: 25000 });
  await page.waitForFunction(() => window.syntheticMicrophoneProbe().liveTracks > 0);
  await page.waitForFunction(() => /[가-힣]/u.test(document.getElementById('transcript').textContent), undefined, { timeout: 12000 });
  await page.locator('#pause').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.paused && window.syntheticMicrophoneProbe().liveTracks === 0);
  const paused = await snapshot('paused');
  check('pauseClosesMicrophone', paused.liveTracks === 0 && paused.paused);
  await page.locator('#resume').click();
  await page.waitForFunction(() => !window.pathInterviewDiagnostics()?.paused && window.syntheticMicrophoneProbe().liveTracks > 0);
  check('resumeStartsNewMicrophone', (await snapshot('resumed')).totalTracks > paused.totalTracks);
  await page.waitForFunction(() => /한국어/.test(document.getElementById('transcript').textContent), undefined, { timeout: 15000 });
  await page.locator('#finish-answer').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'reflection', undefined, { timeout: 25000 });
  const reflection = await snapshot('reflection');
  check('completesTwoSpokenAnswers', (await page.locator('#reflection-body article small').count()) === 2);
  check('reflectionClosesMicrophone', reflection.liveTracks === 0);
  await page.locator('#restart').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'idle');
  check('restartClearsVisibleTranscript', (await snapshot('restart')).transcript === '');
  await page.locator('#prepare').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'listening', undefined, { timeout: 40000 });
  await page.waitForFunction(() => window.syntheticMicrophoneProbe().liveTracks > 0);
  await page.locator('#end').click();
  await page.waitForFunction(() => window.pathInterviewDiagnostics()?.phase === 'idle' && window.syntheticMicrophoneProbe().liveTracks === 0);
  const ended = await snapshot('reset-during-recording');
  check('resetStopsActiveMicrophone', ended.totalTracks >= 5 && ended.liveTracks === 0 && ended.transcript === '');
  check('noExternalRequests', external.length === 0);
  check('noUploadRequests', uploadRequests.length === 0);
  check('noBrowserErrors', errors.length === 0);
  check('noMissingPackageAssets', failedRequests.length === 0);
  check('noWebStorageWrites', await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0));
} catch (error) { failure = error.stack || error.message; }
finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
const report = { checkedAt: new Date().toISOString(), scope: 'Standalone package in desktop Chrome, real getUserMedia/AudioWorklet/Vosk WASM path with local synthetic Korean fake microphone. No Quest headset or human listening test.', fixture: 'Microsoft Heami Desktop synthetic Korean; not user audio', packageGeneratedAt: manifest.generatedAt, pass: !failure && Object.values(checks).every(Boolean), checks, snapshots, errors, external, uploadRequests, failedRequests, ...(failure ? { failure } : {}) };
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ reportPath, pass: report.pass, checks, errors, external, uploadRequests, failedRequests, failure }, null, 2));
if (!report.pass) process.exitCode = 1;
