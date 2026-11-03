'use strict';
// 환승 러시 시안 영상(2026-11-04): 주문 폭주 시안영상.cjs와 같은 길 — 게임 틀(같은 출처 .game-frame, CSS zoom 2)에서 실제로 돌리며 탭 녹화로 화면과 소리를 한 번에 담는다.
// 설치된 Edge 헤드리스 · 임시 프로필 · 실제 GPU. 자체 서버가 experiences/와 /재료/(공용 작업본)를 낸다. 시안은 ?auto=1로 스스로 끝까지 간다.
//   node experiences/subway-rush/qa/시안-20261104/시안영상.cjs [a|b] [폭 높이]   (기본 a 390 844) → 공용 작업본 .tmp/subway-rush-20261104/시안/시안_<판>_<폭>.mp4
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const LOOK = process.argv.includes('b') ? 'b' : 'a';
const [W = 390, H = 844] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const EXP = path.resolve(__dirname, '../../..');
const 밖 = path.join(공용작업본(path.resolve(EXP, '..')), '.tmp', 'subway-rush-20261104');
const 재료 = path.join(밖, '재료'), OUT = path.join(밖, '시안');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const PAGE = '/subway-rush/qa/%EC%8B%9C%EC%95%88-20261104/%EC%8B%9C%EC%95%88.html';
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="${PAGE}?look=${LOOK}&auto=1" allow="autoplay"></iframe>`;
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
      let file = u.startsWith('/재료/') ? path.join(재료, path.basename(u)) : path.join(EXP, u);
      if (!(file.startsWith(EXP) || file.startsWith(재료)) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
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
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => logs.push('failed: ' + r.url()));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('subway-rush'));
  for (let i = 0; i < 120; i += 1) { if (fr()) break; await sleep(50); }
  const type = await page.evaluate(async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: { suppressLocalAudioPlayback: true }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t;
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(500);
    return t;
  });
  const t0 = Date.now();
  for (let i = 0; i < 1200; i += 1) {   // 끝 카드까지 최대 2분
    const done = await fr()?.evaluate(() => document.documentElement.dataset.done ? 'done' : document.body.dataset.error || '').catch(() => '');
    if (done) { if (done !== 'done') logs.push('시안 오류: ' + done); break; }
    await sleep(100);
  }
  await sleep(1800);
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.evaluate(() => new Promise((resolve) => {
    window.__rec.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(window.__chunks, { type: window.__type }));
      a.download = window.__type.startsWith('video/mp4') ? 'rec.mp4' : 'rec.webm';
      document.body.append(a); a.click();
      window.__stream.getTracks().forEach((t) => t.stop());
      resolve();
    };
    window.__rec.stop();
  }));
  const raw = path.join(OUT, `녹화_${LOOK}_${W}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `시안_${LOOK}_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, 초: (Date.now() - t0) / 1000, bytes: fs.statSync(out).size, errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
