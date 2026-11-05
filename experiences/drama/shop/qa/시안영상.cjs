'use strict';
// 옷 가게 시안 — 움직이는 화면을 소리째 담는다(2026-11-05). 틀은 주문 폭주 2판 `시안영상.cjs`(11-03) 그대로:
// 설치된 Edge를 헤드리스 · 실제 GPU로 띄우고 탭 녹화(getDisplayMedia preferCurrentTab)로 화면에 나간 장과 웹 오디오 소리를 한 번에.
// 휴대폰은 틀(iframe 390×844)을 CSS zoom 2로 키워 2배 해상도로, PC는 1440×900 그대로 담는다. 마우스는 진짜 마우스 좌표로 움직인다.
//   node experiences/drama/shop/qa/시안영상.cjs pc a      → 시안_a_pc.mp4  (흰 스튜디오 봉)
//   node experiences/drama/shop/qa/시안영상.cjs phone b   → 시안_b_phone.mp4 (색을 따라오는 처진 봉)
//   … --사진   녹화 없이 단계마다 화면만 찍는다(검수 · 맹검 심사용 낱장)
// 나가는 것: 공용 작업본 .tmp/me2-20261102/옷상점/시안/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const ROOT = path.resolve(__dirname, '../../../..');
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
const [kind = 'pc', look = 'a'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PHOTO = process.argv.includes('--사진');
const PHONE = kind === 'phone';
const W = PHONE ? 390 : 1440, H = PHONE ? 844 : 900, Z = PHONE ? 2 : 1;
const FPS = 30;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#111;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:${Z}}</style><iframe class="game-frame" src="/experiences/drama/shop/index.html?판=${look}" allow="autoplay"></iframe>`;
// 낼 곳은 가게 폴더 · 서체 · 시안용 대역 사진뿐이다(저장소 전체를 내지 않는다)
const ALLOW = ['/experiences/drama/shop/', '/experiences/play-common/', '/experiences/brand-opening/assets/', '/.tmp/me2-20261102/옷상점/입혀보기/'];
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; }
      const file = path.join(ROOT, u);
      if (!ALLOW.some((a) => u.startsWith(a)) || !file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
const OUT = path.join(공용작업본(ROOT), '.tmp', 'me2-20261102', '옷상점', '시안');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stutter(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'mpdecimate=hi=64*4:lo=64*2:frac=0.1', '-loglevel', 'debug', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const seq = [...`${r.stderr || ''}`.matchAll(/(keep|drop) pts:\d+ pts_time:([\d.]+)/g)].map((m) => m[1] === 'keep');
  let moving = 0, stalls = 0;
  for (let i = 1; i < seq.length; i += 1) {
    if (seq[i] && seq[i - 1]) moving += 1;
    if (!seq[i] && seq[i - 1]) { let j = i; while (j < seq.length && !seq[j]) j += 1; if (j - i <= 2 && j < seq.length) { stalls += 1; moving += 1; } }
  }
  return { 움직임자리: moving, 짧은멈춤: stalls, 비율: +(stalls / Math.max(1, moving)).toFixed(3) };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'],
    args: ['--headless=new', '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const context = await browser.newContext({ viewport: { width: W * Z, height: H * Z }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) logs.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/drama/shop/'));
  for (let i = 0; i < 120; i += 1) { if (fr()) break; await sleep(50); }
  const box = async (sel, nth = 0) => fr().evaluate(([q, n]) => { const b = document.querySelectorAll(q)[n].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, top: b.top }; }, [sel, nth]);
  const move = async (x, y, steps = 18) => page.mouse.move(x * Z, y * Z, { steps });
  const tapAt = async (x, y) => { await move(x, y, 8); await page.mouse.down(); await sleep(70); await page.mouse.up(); };
  const tap = async (sel, nth = 0) => { const r = await box(sel, nth); await tapAt(r.x, r.y); };
  const drag = async (x0, y0, x1, y1, ms) => { await move(x0, y0, 4); await page.mouse.down(); const n = Math.max(6, Math.round(ms / 16)); for (let i = 1; i <= n; i += 1) { const k = i / n, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await page.mouse.move((x0 + (x1 - x0) * e) * Z, (y0 + (y1 - y0) * e) * Z); await sleep(16); } await page.mouse.up(); };
  let shotN = 0;
  const shot = async (name) => { if (!PHOTO) return; await sleep(60); await page.screenshot({ path: path.join(OUT, `${look}_${kind}_${String(++shotN).padStart(2, '0')}_${name}.png`) }); };

  let type = null;
  if (!PHOTO) {
    type = await page.evaluate(async (fps) => {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: { suppressLocalAudioPlayback: true }, preferCurrentTab: true, selfBrowserSurface: 'include' });
      const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
      window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 18e6, audioBitsPerSecond: 192000 });
      window.__chunks = []; window.__stream = s; window.__type = t;
      window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
      window.__rec.start(500);
      return t;
    }, 60);
  }
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => document.querySelector('.shop')?.dataset.ready === 'yes').catch(() => false)) break; await sleep(100); }
  await page.mouse.move(W * Z - 4, 4);
  await sleep(2400); await shot('입구');

  if (!PHONE) {
    // PC: 봉을 따라 마우스를 천천히 지나간다 → 바시티 → 누름 → 뒤 → 끌어 돌림 → 다음 둘 → 입어 보기 → 상자 → 카디건(내 옷)
    const r0 = await box('.hanger', 0), r7 = await box('.hanger', 7);
    const y = r0.top + r0.h * 0.45;
    await move(r0.x - 120, y, 10); await sleep(200);
    for (let i = 0; i <= 7; i += 1) { const r = await box('.hanger', i); await move(r.x, y, 14); await sleep(i === 2 ? 650 : 260); if (i === 2) await shot('올림'); }
    await move(r7.x + 160, y, 10); await sleep(500);
    // 올리면 옆 옷이 비켜나므로 올린 뒤 자리를 다시 재고 누른다
    let v = await box('.hanger', 2); await move(v.x, y, 26); await sleep(700); v = await box('.hanger', 2); await move(v.x, y, 6); await sleep(250);
    await tapAt(v.x, y); await sleep(1300); await shot('자세히');
    await tap('.shop-side button[data-side=back]'); await sleep(1500); await shot('뒤');
    const t = await box('.shop-turn-wrap');
    await drag(t.x - 40, t.y, t.x + 260, t.y + 6, 900); await sleep(1300); await shot('끌어돌림');
    await tap('.shop-step[data-act=next]'); await sleep(1500); await shot('배송조회');
    await tap('.shop-step[data-act=next]'); await sleep(1200); await shot('다음');
    await tap('.shop-go[data-act=order]'); await sleep(1300); await shot('종이');
    await sleep(1150); await shot('상자'); await sleep(1450); await shot('송장');
    await sleep(1900); await shot('배송중'); await sleep(900);
    let c = await box('.hanger', 1); await move(c.x, y, 30); await sleep(800); c = await box('.hanger', 1); await move(c.x, y, 6); await sleep(250);
    await tapAt(c.x, y); await sleep(1500); await shot('내옷');
    await tap('.shop-side button[data-side=worn]'); await sleep(2300); await shot('입은나');
    await tap('.shop-side button[data-side=front]'); await sleep(1100);
    await tap('.shop-close'); await sleep(1600);
    await move(W - 4, 4, 30); await sleep(900);
  } else {
    // 휴대폰: 끌어 넘기기 세 번(흔들림 · 바탕색) → 가운데 누름 → 옷을 끌어 돌림 → 입어 보기 → 상자 → 닫기
    const rail = await box('.shop-rail');
    const y = rail.top + rail.h * 0.5;
    await drag(300, y, 120, y + 8, 380); await sleep(1300); await shot('넘김1');
    await drag(310, y, 70, y - 6, 300); await sleep(1500);
    await drag(90, y, 330, y + 4, 420); await sleep(1600); await shot('넘김3');
    const center = await fr().evaluate(() => window.__shop && document.querySelector('.shop-caption-n').textContent);
    await fr().evaluate(() => window.__shop.go(4)); await sleep(1000); // 아직 안 산 옷(럭비)을 가운데로 — 봉 크기가 바뀌어도 같은 옷
    await tapAt(W / 2, y); await sleep(1400); await shot('자세히');
    const t = await box('.shop-turn-wrap');
    await drag(t.x - 80, t.y, t.x + 120, t.y + 4, 700); await sleep(1300); await shot('돌림');
    await drag(t.x + 60, t.y, t.x - 160, t.y - 4, 650); await sleep(1300);
    await fr().evaluate(() => document.querySelector('.shop-stage').scrollTo({ top: 420, behavior: 'smooth' })); await sleep(1300); await shot('설명');
    await fr().evaluate(() => document.querySelector('.shop-stage').scrollTo({ top: 0, behavior: 'smooth' })); await sleep(900);
    await tap('.shop-go[data-act=order]'); await sleep(1300); await shot('종이');
    await sleep(1150); await shot('상자'); await sleep(1450); await shot('송장');
    await sleep(1900); await shot('배송중'); await sleep(900);
    // 도착한 카디건으로 가서 「입은 나」
    await drag(80, y, 340, y + 4, 420); await sleep(700);
    await fr().evaluate(() => window.__shop.go(1)); await sleep(1400);
    await tap('.shop-more'); await sleep(1400);
    await tap('.shop-side button[data-side=worn]'); await sleep(2400); await shot('입은나');
    await tap('.shop-close'); await sleep(1500);
    logs.push('가운데: ' + center);
  }

  if (PHOTO) { await context.close(); await browser.close(); srv.close(); console.log(JSON.stringify({ out: OUT, shots: shotN, errors: logs }, null, 1)); return; }
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.evaluate(() => new Promise((resolve) => {
    window.__rec.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(window.__chunks, { type: window.__type }));
      a.download = window.__type.startsWith('video/mp4') ? 'rec.mp4' : 'rec.webm';
      document.body.append(a); a.click();
      window.__stream.getTracks().forEach((tr) => tr.stop());
      resolve();
    };
    window.__rec.stop();
  }));
  const raw = path.join(OUT, `녹화_${look}_${kind}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `시안_${look}_${kind}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, bytes: fs.statSync(out).size, 짧은멈춤: stutter(out), errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
