'use strict';
// 말 랠리 캠퍼스 판 — 「소리 나는 움직이는 시안」(2026-11-04, 주문 폭주 시안영상.cjs를 옮김): 게임을 WORLD 틀(같은 출처 .game-frame)에서 실제로 돌리며
// 탭 녹화(getDisplayMedia preferCurrentTab)로 화면과 소리를 한 번에 담는다. 소리는 게임이 내는 그대로(음악 · 효과음 · 태오 목소리, 덕킹 포함)이고 게임 코드는 바꾸지 않는다.
// 탭은 CSS 픽셀 크기로 담기므로 게임 틀(iframe, 폭 W · 높이 H — 게임은 이 크기로 배치된다)을 바깥에서 CSS zoom 2로 키워 2W × 2H로 담는다
// (틀 안 devicePixelRatio 2 — 3D 컵 · 사진 · 글자가 모두 2배 해상도로 그려진다). 설치된 Edge를 헤드리스 · 임시 프로필 · 실제 GPU로 띄운다
// (플레이라이트 크로뮴 셸에는 탭 녹화가 없다).
// 자체 서버가 experiences/를 낸다: /talk-rally/ = 이 게임 — 앱 안과 같은 길이다.
//   node experiences/talk-rally/qa/world-campus-20261104/시안영상.cjs [폭 높이]   (기본 390 844) → 시안_<폭>.mp4(30fps)
//   node experiences/talk-rally/qa/world-campus-20261104/시안영상.cjs --입구      입구만 10초(제목의 공 박자) → 입구_<폭>.mp4
//   node experiences/talk-rally/qa/world-campus-20261104/시안영상.cjs 1280 720 --짧게   다른 화면 크기에서 영상 · 3D 공이 맞는지 볼 짧은 판
//   끝에 「짧은 멈춤」(움직이는 중 새 장 사이에 같은 장이 1~2장 끼인 자리 / 움직임 자리)을 적는다 — 장을 버린 자리다.
//   내보내기는 30fps 고정: 녹화는 장이 바뀔 때마다 담기는데 그 간격이 ±10ms 흔들려(녹화 쪽 부하), 60fps로 맞추면 같은 장이 끼어 실제보다 끊겨 보인다
//   (11-03 밤 입구 10초: 60fps 짧은 멈춤 15~30% · 30fps 6%, 앞 소프트웨어 렌더 시안 13%).
//   나가는 것: 공용 작업본 .tmp/talk-rally-world-20261104/시안/
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
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="/talk-rally/index.html?qa=1" allow="autoplay"></iframe>`;
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
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'talk-rally-world-20261104', '시안');
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
  const fr = () => page.frames().find((x) => x.url().includes('/talk-rally/'));
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
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => !!document.querySelector('.w-art') && !!window.__rally && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
  const marks = { ready: Date.now() - t0 };
  if (LOBBY) await sleep(10000);
  else {
    await sleep(3200);   // 입구: 제목이 오르고 공이 두 낱말 위를 오간다
    await tap('.w-lede');   // 첫 손짓(빈 곳) — 미리 만든 오디오 문맥을 깨운다(입구는 음악 없이 조용하다)
    await sleep(700);
    await tap('#btn-start'); marks.start = Date.now() - t0;   // 공 두 번 튀기는 소리 → 태오 「한 판 할래요?」
    const cur = () => fr().evaluate(() => window.__rally.state().cur);
    /** 이번 공을 기다렸다가 고른다. pick: 'ok'(맞는 카드) · 'wrong'. wait: 카드를 누르기 전 기다리는 밀리초(공이 오는 동안 고르면 「빠르게」). */
    const hit = async (pick = 'ok', wait = 900) => {
      let c = null; const t = Date.now();
      while (Date.now() - t < 22000) { c = await cur(); if (c && ['talk', 'flight'].includes(c.phase) && c.choice == null) break; await sleep(120); }
      if (!c) return false;
      // 태오 말이 끝나고 공이 뜰 때까지 기다린 뒤
      for (let i = 0; i < 80; i += 1) { const x = await cur(); if (x?.phase === 'flight') break; await sleep(100); }
      await sleep(wait);
      const lane = pick === 'ok' ? c.options.indexOf(c.answer) : c.options.findIndex((o) => o !== c.answer);
      await tap(`#cards .card.l${lane}`);
      return true;
    };
    const settle = async () => { for (let i = 0; i < 80; i += 1) { const x = await cur(); if (!x || x.phase === 'talk') return; await sleep(100); } };
    const lane = (k) => fr().evaluate((v) => window.__rally.setLane(v), k);
    const rally = (n) => fr().evaluate((v) => window.__rally.setRally(v), n);
    const after = async (ms = 2000) => { await sleep(ms); await settle(); };
    await lane(0);
    await hit('ok', 2600);    // 연습 공: 공이 라켓 앞에서 기다리는 것까지 보인다
    await after(2400);
    await lane(1); await hit('ok', 700); marks.left = Date.now() - t0;   // 왼쪽 칸: 태오가 왼쪽으로 움직여 친다
    await after();
    if (process.argv.includes('--짧게')) {   // 다른 화면 크기 확인: 왼쪽 · 오른쪽 한 번씩 치고 끝낸다
      await lane(0); await hit('ok', 300); await after(1500);
      await fr().evaluate(() => window.__rally.finish()); await sleep(1500);
    } else {
    await lane(2); await hit('ok', 200); marks.center = Date.now() - t0;   // 가운데(빠른 대답 표정)
    await after();
    await lane(2); await hit('ok', 500); marks.smash3 = Date.now() - t0;   // 랠리 3: 스매시 · 태오가 놓치고 웃음
    await after(2800);
    await lane(1); await hit('ok', 500); marks.right = Date.now() - t0;   // 오른쪽 칸(스매시 뒤 새 공은 공 띄워 치기로 시작)
    await after();
    await rally(5); await lane(0); await hit('ok', 500); marks.smash6 = Date.now() - t0;   // 랠리 6: 놀람
    await after(2800);
    await rally(8); await lane(1); await hit('ok', 500); marks.smash9 = Date.now() - t0;   // 랠리 9: 두 팔 환호
    await after(2800);
    await hit('wrong', 1200); marks.miss = Date.now() - t0;   // 틀림: 놓침 판 · 「아깝다!」 · 해설
    await sleep(4200);
    await tap('#btn-next');
    await sleep(300); await settle();
    await hit('wrong', 800); marks.miss2 = Date.now() - t0;   // 연달아 틀림: 응원 판
    await sleep(4200);
    await tap('#btn-next');
    await sleep(300); await settle();
    await hit('ok', 8200); marks.wait = Date.now() - t0;   // 오래 기다림: 「천천히 골라요」 뒤 맞힘
    await sleep(2200);
    }
    marks.finish = Date.now() - t0;
    await fr().evaluate(() => window.__rally.finish());
    await sleep(6500);
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
  const out = path.join(OUT, `${LOBBY ? '입구' : '시안'}_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', ...(LOBBY ? ['-an'] : ['-c:a', 'aac', '-b:a', '192k']), '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, marks, bytes: fs.statSync(out).size, 짧은멈춤: stutter(out), errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
