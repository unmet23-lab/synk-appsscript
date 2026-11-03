'use strict';
// 주문 폭주 캠퍼스 판 2판 — 「소리 나는 움직이는 시안」(2026-11-03): 게임을 WORLD 틀(같은 출처 .game-frame)에서 실제로 돌리며
// 탭 녹화(getDisplayMedia preferCurrentTab — 화면에 나간 장 그대로, 움직이는 동안 초당 60장까지)로 화면과 소리를 한 번에 담는다.
// 소리는 게임이 내는 그대로(배경음악 · 효과음 · 주문 음성 — 덕킹 · 겹침 · 크기가 게임 안과 같다)이고, 녹음하는 동안 스피커로는 내지 않는다
// (suppressLocalAudioPlayback). 화면과 소리가 한 녹화라 따로 맞추지 않는다. 게임 코드는 바꾸지 않는다.
// 11-03 밤까지는 화면 스트림(CDP screencast) + 소프트웨어 렌더(SwiftShader)였다 — 초당 25장 안팎이라 움직이는 0.5초 칸의 60%에
// 같은 장이 섞여 실제 화면보다 끊겨 보였다(현장노트 영상 「게임을 소리째 찍은 시안 영상」).
// 탭은 CSS 픽셀 크기로 담기므로 게임 틀(iframe, 폭 W · 높이 H — 게임은 이 크기로 배치된다)을 바깥에서 CSS zoom 2로 키워 2W × 2H로 담는다
// (틀 안 devicePixelRatio 2 — 3D 컵 · 사진 · 글자가 모두 2배 해상도로 그려진다). 설치된 Edge를 헤드리스 · 임시 프로필 · 실제 GPU로 띄운다
// (플레이라이트 크로뮴 셸에는 탭 녹화가 없다).
// 자체 서버가 experiences/를 낸다: /order-rush/ = 이 게임, /brand-opening/ = 앱 설정 — 앱 안과 같은 길이다.
//   node experiences/order-rush/qa/world-campus-20261103/시안영상.cjs [폭 높이]   (기본 390 844) → 시안_2판_<폭>.mp4(30fps)
//   node experiences/order-rush/qa/world-campus-20261103/시안영상.cjs --입구      입구만 10초(제목 「바쁜 박자」) → 입구_2판_<폭>.mp4
//   끝에 「짧은 멈춤」(움직이는 중 새 장 사이에 같은 장이 1~2장 끼인 자리 / 움직임 자리)을 적는다 — 장을 버린 자리다.
//   내보내기는 30fps 고정: 녹화는 장이 바뀔 때마다 담기는데 그 간격이 ±10ms 흔들려(녹화 쪽 부하), 60fps로 맞추면 같은 장이 끼어 실제보다 끊겨 보인다
//   (11-03 밤 입구 10초: 60fps 짧은 멈춤 15~30% · 30fps 6%, 앞 소프트웨어 렌더 시안 13%).
//   나가는 것: 공용 작업본 .tmp/order-rush-world-20261103/시안/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const [W = 390, H = 844] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const LOBBY = process.argv.includes('--입구');
const CAPTURE_FPS = 60, FPS = 30;   // 담기는 60장까지, 내보내기는 30fps(위)
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="/order-rush/index.html?qa=1" allow="autoplay"></iframe>`;
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
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'order-rush-world-20261103', '시안');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 짧은 멈춤: mpdecimate가 장마다 새 장(keep) · 같은 장(drop)을 가른다 — 새 장 뒤 같은 장이 1~2장 끼고 다시 새 장이면(움직이는 중 멈칫) 하나.
 *  같은 장이 3장 넘게 이어지면 정지 화면이라 세지 않는다. */
function stutter(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'mpdecimate=hi=64*4:lo=64*2:frac=0.1', '-loglevel', 'debug', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const seq = [...`${r.stderr || ''}`.matchAll(/(keep|drop) pts:\d+ pts_time:([\d.]+)/g)].map((m) => m[1] === 'keep');
  let moving = 0, stalls = 0;
  for (let i = 1; i < seq.length; i += 1) {
    if (seq[i] && seq[i - 1]) moving += 1;
    if (!seq[i] && seq[i - 1]) {
      let j = i;
      while (j < seq.length && !seq[j]) j += 1;
      if (j - i <= 2 && j < seq.length) { stalls += 1; moving += 1; }
    }
  }
  return { 움직임자리: moving, 짧은멈춤: stalls, 비율: +(stalls / Math.max(1, moving)).toFixed(3) };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'],
    args: ['--headless=new', '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  // 틀을 CSS zoom 2로 키운다(transform이면 마우스가 틀 안에 닿지 않는다) — 안의 게임은 폭 W 그대로, devicePixelRatio 2(3D 캔버스도 2배)
  const context = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const f = page.frameLocator('iframe.game-frame');
  const fr = () => page.frames().find((x) => x.url().includes('/order-rush/'));
  // 누르기: 틀 안 요소의 자리(틀 CSS 픽셀) × 2 = 바깥 화면 자리에 진짜 마우스를 누른다.
  // Playwright의 요소 클릭은 확대된 틀 안 문서를 스크롤해 화면이 밀린다 — 마우스 좌표로 누르면 그대로다(:active 눌림 · pointerdown도 난다).
  const tap = async (sel) => {
    const r = await fr().evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    await page.mouse.move(r.x * 2, r.y * 2);
    await page.mouse.down(); await sleep(80); await page.mouse.up();
    await page.mouse.move(W * 2 - 2, 2);   // 휴대폰처럼 마우스를 비켜 둔다(단추에 머문 hover 테두리가 남지 않게)
  };
  // 게임 문서가 붙기 전에 녹화를 켠다 — 입구가 처음 나타나 제목이 오르는 데서부터 담긴다
  for (let i = 0; i < 120; i += 1) { if (fr()) break; await sleep(50); }
  const type = await page.evaluate(async (fps) => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: { suppressLocalAudioPlayback: true }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t;
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(500);
    return t;
  }, CAPTURE_FPS);
  const t0 = Date.now();
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => !!document.querySelector('.w-art') && !!window.__rush && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
  const marks = { ready: Date.now() - t0 };
  if (LOBBY) await sleep(10000);
  else {
    await sleep(2600);   // 입구: 제목이 잔 뒤에서 오르고 바쁜 박자 한 번
    await tap('.w-lede');   // 첫 손짓(빈 곳) — 미리 만든 오디오 문맥을 깨운다(입구는 음악 없이 조용하다)
    await sleep(900);
    await tap('#start'); marks.start = Date.now() - t0;   // 「카페 문 열기」 문 종
    const waitHeard = async (ms = 16000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(() => window.__rush.state().current?.heard)) return; await sleep(150); } };
    const make = async (cups, gap = 480) => {
      for (const [i, cup] of cups.entries()) {
        if (i) { await tap('#add-cup'); await sleep(gap); }
        if (cup.base) { await tap(`[data-ingredient=${cup.base}]`); await sleep(gap); }
        if (cup.milk) { await tap('[data-ingredient=milk]'); await sleep(gap); }
        if (cup.ice) { await tap('[data-ingredient=ice]'); await sleep(gap); } else if (cup.temp === 'cold') { await tap('[data-ingredient=cold]'); await sleep(gap); }
        if (cup.sugar) { await tap('[data-ingredient=sugar]'); await sleep(gap); }
      }
    };
    const recipe = () => fr().evaluate(() => window.__rush.state().current.recipe);
    // 손님 1: 끝까지 듣고(음악이 물러남 · 목소리 막대) → 맞게 만들어 서빙
    await waitHeard();
    await sleep(900);
    await make(await recipe());
    await sleep(500);
    await tap('#serve');
    await sleep(1500);
    // 손님 2: 듣고 → 하나 빠뜨려 서빙(갸웃 · 묻는 두 음) → 고쳐 서빙
    await waitHeard();
    await sleep(600);
    const cups = await recipe();
    const wrong = cups.map((c) => ({ ...c }));
    if (wrong[0].sugar) wrong[0].sugar = false; else if (wrong[0].milk) wrong[0].milk = false; else if (wrong[0].ice) wrong[0].ice = false; else wrong[0].base = wrong[0].base === 'tea' ? 'coffee' : 'tea';
    await make(wrong);
    await sleep(400);
    await tap('#serve');
    await sleep(1600);
    while (await f.locator('#remove-cup').textContent() === '이 컵 빼기') { await tap('#remove-cup'); await sleep(250); }
    await tap('#remove-cup');
    await sleep(450);
    await make(cups, 360);
    await sleep(400);
    await tap('#serve');
    await sleep(1500);
    // 손님 3: 듣는 중 몇 초 → 영업 마감(결과)
    await sleep(3800);
    marks.finish = Date.now() - t0;
    await fr().evaluate(() => window.__rush.finish());
    await sleep(5600);
  }
  // 녹화를 멈추고 파일로 받는다(녹화 묶음이 수십 MB라 evaluate로 넘기지 않고 내려받기로)
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
  const raw = path.join(OUT, `녹화_${W}${LOBBY ? '_입구' : ''}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  // 장이 바뀔 때만 담긴 녹화(가변 장 수)를 30fps 고정으로 — 정지 구간은 같은 장이 이어진다
  const out = path.join(OUT, `${LOBBY ? '입구' : '시안'}_2판_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', ...(LOBBY ? ['-an'] : ['-c:a', 'aac', '-b:a', '192k']), '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, marks, bytes: fs.statSync(out).size, 짧은멈춤: stutter(out), errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
