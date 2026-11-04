'use strict';
// 말의 리듬 캠퍼스 판 — 윈도용 WebKit(아이폰 화면 흉내)에서 입구 → 놀이 → 멈춤 → 결과 → 한 곡 더를 돌린다(2026-11-04).
// 윈도용 WebKit에는 AudioContext가 없다(현장 노트) — 소리를 가짜 문맥으로 대신해 엔진 오류 · 넘침 · 화면 넘어감만 본다.
// 실제 소리 · 아이폰 무음 모드 · 끼어들기 · 키음 지연은 이 시험으로 재지 못한다. 글꼴 굵기 · 뒤 흐림도 이 빌드로 판정하지 않는다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/웹킷흐름.cjs   → 찍은 것은 공용 작업본 .tmp/rhythm-world-20261104/웹킷
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE || os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { webkit, devices } = require(require.resolve('playwright', { paths: [NM] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');

const EXP = path.resolve(__dirname, '../../..');
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'rhythm-world-20261104', '웹킷');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;width:100%;height:100%}</style><iframe class="game-frame" src="/korean-rhythm/index.html?qa=1" allow="autoplay"></iframe>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
      if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      let file = path.join(EXP, u);
      if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      let body = fs.readFileSync(file);
      // 가짜 문맥은 진짜 길이를 모른다 — 곡 · 문장 길이 대조만 이 시험에서 뺀다
      if (u.endsWith('/korean-rhythm/audio.mjs')) body = String(body).replace(/ *if \(!Number\.isFinite\(buffer\.duration\).*\r?\n/, '').replace(/ *if \(Math\.abs\(buffer\.duration - voice\.duration\).*\r?\n/, '');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const FAKE_AUDIO = () => {
  try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ }
  if (window.AudioContext) return;
  const param = (value = 1) => ({ value, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => new Proxy({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(440), detune: param(0), Q: param(1), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), delayTime: param(0), offset: param(0), pan: param(0), fftSize: 2048, getFloatTimeDomainData(d) { d.fill(0); }, ...extra }, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  class Fake {
    constructor() { this.state = 'suspended'; this.sampleRate = 44100; this.destination = node(); this.base = performance.now(); this.held = 0; this.outputLatency = 0; this.baseLatency = 0.005; (window.__fakes ||= []).push(this); }
    get currentTime() { return (this.state === 'running' ? performance.now() - this.base : this.held) / 1000; }
    async resume() { if (this.state !== 'running' && this.state !== 'closed') { this.base = performance.now() - this.held; this.state = 'running'; } }
    async suspend() { if (this.state === 'running') { this.held = performance.now() - this.base; this.state = 'suspended'; } }
    async close() { this.state = 'closed'; }
    async decodeAudioData() { return { duration: 200, sampleRate: 44100, numberOfChannels: 2, getChannelData: () => new Float32Array(16) }; }
    createBuffer(c, n, sampleRate) { return { numberOfChannels: c, length: n, sampleRate, duration: n / sampleRate, getChannelData: () => new Float32Array(n) }; }
  }
  for (const name of ['Gain', 'Analyser', 'BufferSource', 'Oscillator', 'BiquadFilter', 'DynamicsCompressor', 'WaveShaper', 'StereoPanner', 'Delay', 'ConstantSource', 'Convolver', 'ChannelMerger', 'ChannelSplitter']) Fake.prototype[`create${name}`] = function () { return node(); };
  Fake.prototype.createPeriodicWave = () => ({});
  window.AudioContext = Fake;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 15'] });
  await ctx.addInitScript(FAKE_AUDIO);
  const page = await ctx.newPage(), errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`콘솔: ${m.text().slice(0, 220)}`); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  const out = { 엔진: `webkit ${browser.version()}`, 화면: [] };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/korean-rhythm/'));
  for (let i = 0; i < 120; i += 1) { if (await fr()?.evaluate(() => !!window.__rhythm && !!document.querySelector('.w-art')).catch(() => false)) break; await sleep(150); }
  const f = page.frameLocator('iframe.game-frame');
  const until = async (test, arg, ms = 40000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(test, arg)) return true; await sleep(80); } return false; };
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    out.화면.push(await fr().evaluate((n) => ({ 이름: n, 화면: window.__rhythm.state().screen, 넘침: document.documentElement.scrollWidth > innerWidth + 1, 호스트: document.documentElement.dataset.host, 깨진그림: [...document.images].filter((i) => i.complete && !i.naturalWidth && i.getBoundingClientRect().width > 0).map((i) => i.getAttribute('src')) }), name));
  };
  await sleep(2500);
  await shot('1_입구');
  await f.locator('#track-grid .song[data-track="1"]').click();
  await sleep(300);
  await f.locator('#start-button').click();
  out.시작 = await until(() => { const r = window.__rhythm.state(); return r.screen === 'game' && !r.loading && r.time > 0.5; });
  if (!out.시작) throw new Error(`시작 못 함: ${await fr().evaluate(() => document.getElementById('toast')?.textContent)} | ${errors.join(' | ')}`);
  await fr().evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan(['right', 'right', 'right', 'right', 'right']); });
  await sleep(1500);
  await shot('2_놀이');
  await f.locator('#pause-button').click();
  await sleep(300);
  await shot('3_멈춤');
  await f.locator('#resume-button').click();
  await sleep(1400);
  const qs = await fr().evaluate(() => window.__rhythm.state().questions);
  await fr().evaluate((t) => window.__rhythm.seek(t), qs[0].answerOpen - 0.2);
  await sleep(1500);
  await shot('4_듣기');
  const dur = await fr().evaluate(() => window.__rhythm.state().duration);
  await fr().evaluate((t) => window.__rhythm.seek(t), dur - 1);
  out.결과 = await until(() => window.__rhythm.state().screen === 'results');
  await sleep(3600);
  await shot('5_결과');
  await f.locator('.say-again:visible').first().click({ timeout: 8000 });
  await sleep(400);
  await f.locator('#replay-button').click();
  out.한곡더 = await until(() => { const r = window.__rhythm.state(); return r.screen === 'game' && !r.loading && r.time > 0.5; });
  await sleep(600);
  await shot('6_한곡더');
  out.문맥 = await fr().evaluate(() => (window.__fakes || []).map((c) => c.state));
  out.오류 = errors; out.실패 = [...new Set(failed)];
  await browser.close();
  srv.close();
  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
