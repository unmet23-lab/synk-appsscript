'use strict';
// 빈칸 베기 캠퍼스 판 — 「소리 나는 움직이는 시안」(2026-11-04, 처음에는 겉 세 안을 견줬고 11-04 찢기로 정했다). 주문 폭주 2판 시안영상.cjs와 같은 길:
// 게임을 WORLD 틀(같은 출처 .game-frame)에서 실제로 돌리며 탭 녹화(getDisplayMedia preferCurrentTab)로 화면과 게임 소리를 한 번에 담는다.
// 틀(iframe, 폭 W · 높이 H)을 바깥에서 CSS zoom 2로 키워 2W × 2H로 담는다(틀 안 devicePixelRatio 2). 설치된 Edge 헤드리스 · 실제 GPU.
// 손은 진짜 마우스로 긋는다(누름 → 10번 나눠 움직임 → 뗌): 게임의 베기 판정(손 빠르기 · 거리)과 칼빛 자취 · 「휙」이 실제 손과 같은 길로 난다.
// 판은 같은 차례로 친다: 맞힘 · 맞힘 · 틀림(해설 → 다음) · 내려오는 조각 맞힘 · 맞힘 — 연속 계단 · 틀림 · 끼워짐을 한 영상에서 듣는다. 게임 코드는 바꾸지 않는다.
//   node experiences/blank-slice/qa/world-campus-20261104/시안영상.cjs [폭 높이]   (기본 390 844)
//   나가는 것: 공용 작업본 .tmp/blank-slice-world-20261104/시안/찢기_<폭>.mp4 (30fps) · 장면 확인용 PNG
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const args = process.argv.slice(2);
const [W = 390, H = 844] = args.filter((a) => /^\d+$/.test(a)).map(Number);
const FPS = 30;
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'blank-slice-world-20261104', '시안');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(kind) {
  const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="/blank-slice/index.html?qa=1" allow="autoplay"></iframe>`;
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

async function record(browser, kind) {
  const srv = await serve(kind), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const context = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 1, acceptDownloads: true });
  // 연습 문장은 건너뛴다(처음 한 번만 나오는 안내라 견줄 거리가 아니다). 판 수 3 = 아틀라스가 고른 판
  await context.addInitScript(() => { try { if (location.pathname.includes('/blank-slice/')) localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 3, practiced: true, slow: false, best: null })); } catch { /* 저장소 없음 */ } });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) logs.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/blank-slice/'));
  for (let i = 0; i < 200; i += 1) { if (await fr()?.evaluate(() => !!window.__slice).catch(() => false)) break; await sleep(100); }
  const tap = async (sel) => {
    const r = await fr().evaluate((q) => { const el = document.querySelector(q); el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    await page.mouse.move(r.x * 2, r.y * 2); await page.mouse.down(); await sleep(70); await page.mouse.up();
    await page.mouse.move(W * 2 - 2, 2);
  };
  /** 조각 i가 던져져 꼭대기 가까이 오면 그 자리를 가로질러 긋는다. 반환: 그었는지. */
  const slash = async (i, dirY = 1, hold = 650) => {
    let seen = 0;
    for (let k = 0; k < 120; k += 1) {
      const p = await fr().evaluate((n) => { const a = window.__slice.arena(), s = window.__slice.pieceScreen(n); return s && { x: a.x + s.x, y: a.y + s.y, h: a.h }; }, i);
      if (p && p.y < p.h * 0.82) { if (!seen) seen = Date.now(); if (Date.now() - seen > hold) break; }
      await sleep(40);
    }
    const p = await fr().evaluate((n) => { const a = window.__slice.arena(), s = window.__slice.pieceScreen(n); return s && { x: a.x + s.x, y: a.y + s.y }; }, i);
    if (!p) return false;
    const x0 = p.x - 62, y0 = p.y - 16 * dirY, x1 = p.x + 62, y1 = p.y + 16 * dirY;
    await page.mouse.move(x0 * 2, y0 * 2); await page.mouse.down();
    for (let s = 1; s <= 10; s += 1) { await page.mouse.move((x0 + (x1 - x0) * s / 10) * 2, (y0 + (y1 - y0) * s / 10) * 2); await sleep(8); }
    await page.mouse.up(); await page.mouse.move(W * 2 - 2, 2);
    return true;
  };
  const cur = () => fr().evaluate(() => ({ ...window.__slice.state().cur, pieces: window.__slice.pieces() }));
  const waitToss = async () => { for (let k = 0; k < 200; k += 1) { const c = await cur(); if (c?.id && !c.done && c.pieces.length === 4 && c.pieces.every((p) => c.options.includes(p.word) && p.alive)) return c; await sleep(60); } return null; };

  const type = await page.evaluate(async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: { suppressLocalAudioPlayback: true }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t;
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(500);
    return t;
  });
  const t0 = Date.now(), marks = {};
  await sleep(1200);
  await tap('#btn-start'); marks.start = Date.now() - t0;
  // late: 꼭대기를 지나 천천히 내려오는 조각을 벤다(내려오는 곡선이 보이게)
  const plan = ['ok', 'ok', 'wrong', 'late', 'ok'];
  for (const [n, what] of plan.entries()) {
    const c = await waitToss();
    if (!c) { logs.push(`toss ${n} 없음`); break; }
    const target = what === 'wrong' ? c.pieces.find((p) => p.word !== c.answer) : c.pieces.find((p) => p.word === c.answer);
    await slash(target.index, n % 2 ? -1 : 1, what === 'late' ? 2300 : 650);
    marks[`slice${n}`] = Date.now() - t0;
    if (n === 0) await page.screenshot({ path: path.join(OUT, `${kind}_${W}_베는순간.png`) }).catch(() => {});
    if (what === 'wrong') {
      await sleep(2600);
      await page.screenshot({ path: path.join(OUT, `${kind}_${W}_해설.png`) }).catch(() => {});
      await tap('#btn-next');
    } else await sleep(what === 'late' ? 1400 : 900);
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${kind}_${W}_끝.png`) }).catch(() => {});
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
  const raw = path.join(OUT, `녹화_${kind}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  const gpu = await fr()?.evaluate(() => window.__slice.stage()?.gpuInfo()).catch(() => null);
  await context.close(); srv.close();
  // 앞 1초(입구 그림이 서는 동안)는 잘라 낸다
  const out = path.join(OUT, `${kind}_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '0.9', '-i', raw, '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  return { kind, out, 녹화형식: type, marks, gpu, bytes: fs.statSync(out).size, errors: logs };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'],
    args: ['--headless=new', '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const results = [];
  results.push(await record(browser, '찢기'));
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
