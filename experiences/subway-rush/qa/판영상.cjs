'use strict';
// 환승 러시 한 판 영상(2026-11-04): 게임 틀(같은 출처 .game-frame, CSS zoom 2)에서 ?auto=1로 스스로 끝까지 돌리며 탭 녹화로 화면과 소리를 한 번에 담는다(주문 폭주 시안영상.cjs와 같은 길).
// 설치된 Edge 헤드리스 · 임시 프로필 · 실제 GPU. 끝나면 콘솔 오류 · 실패 요청 · 넘침을 적고, --시트면 일정 간격 장면 시트도 낸다.
//   node experiences/subway-rush/qa/판영상.cjs [--씨앗 12345] [--틀림 1,3] [--시트] [--이름 판1] [폭 높이]   → 공용 작업본 .tmp/subway-rush-20261104/영상/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : d; };
const SEED = opt('--씨앗', '20261104'), WRONG = opt('--틀림', ''), NAME = opt('--이름', '판'), SHEET = argv.includes('--시트');
const nums = argv.filter((a, i) => /^\d+$/.test(a) && !['--씨앗', '--틀림', '--이름'].includes(argv[i - 1])).map(Number);
const [W = 390, H = 844] = nums;
const EXP = path.resolve(__dirname, '../..');
const OUT = path.join(공용작업본(path.resolve(EXP, '..')), '.tmp', 'subway-rush-20261104', '영상');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const SRC = `/subway-rush/index.html?auto=1&qa=1&seed=${SEED}${WRONG ? '&wrong=' + WRONG : ''}`;
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="${SRC}" allow="autoplay"></iframe>`;
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
      let file = path.join(EXP, u);
      if (!file.startsWith(EXP) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'],
    args: ['--headless=new', '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const context = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('subway-rush'));
  for (let i = 0; i < 120; i += 1) { if (fr()) break; await sleep(50); }
  const type = await page.evaluate(async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: { suppressLocalAudioPlayback: true, autoGainControl: false, echoCancellation: false, noiseSuppression: false }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 7e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t;
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(500);
    return t;
  });
  const t0 = Date.now();
  let measures = null;
  for (let i = 0; i < 2400; i += 1) {   // 끝까지 최대 4분
    const done = await fr()?.evaluate(() => document.documentElement.dataset.done ? 'done' : document.body.dataset.error || '').catch(() => '');
    if (done) { if (done !== 'done') logs.push('오류: ' + done); break; }
    await sleep(100);
  }
  console.log(`끝까지 ${(Date.now() - t0) / 1000}초`, JSON.stringify(logs).slice(0, 600));
  await sleep(3200);
  measures = await fr()?.evaluate(() => ({ 넘침: document.documentElement.scrollWidth > innerWidth, 틀폭: innerWidth })).catch(() => null);
  await fr()?.evaluate(() => { const r = document.getElementById('result'); if (r) r.scrollTo({ top: r.scrollHeight, behavior: 'smooth' }); }).catch(() => {});
  await sleep(1800);
  const dl = page.waitForEvent('download', { timeout: 300000 });
  await page.evaluate(() => new Promise((resolve) => {
    window.__rec.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(window.__chunks, { type: window.__type })); a.download = window.__type.startsWith('video/mp4') ? 'rec.mp4' : 'rec.webm'; document.body.append(a); a.click(); window.__stream.getTracks().forEach((t) => t.stop()); resolve(); };
    window.__rec.stop();
  }));
  const raw = path.join(OUT, `녹화_${NAME}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `${NAME}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  if (SHEET) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', out, '-vf', 'fps=1/4,scale=190:-2,pad=iw+4:ih:2:0:black,tile=12x3', '-frames:v', '1', path.join(OUT, `${NAME}_시트.jpg`)], { stdio: 'inherit' });
  console.log(JSON.stringify({ out, 초: (Date.now() - t0) / 1000, bytes: fs.statSync(out).size, measures, errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
