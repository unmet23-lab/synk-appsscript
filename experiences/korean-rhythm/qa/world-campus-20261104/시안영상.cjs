'use strict';
// 말의 리듬 캠퍼스 판 — 「소리 나는 움직이는 시안」(2026-11-04, 주문 폭주 캠퍼스 판 시안영상.cjs를 옮김): 게임을 WORLD 틀(같은 출처 .game-frame)에서 실제로 돌리며
// 탭 녹화(getDisplayMedia preferCurrentTab)로 화면과 게임 소리를 한 번에 담는다 — 곡 · 문장 · 키음 · 덕킹이 게임 안과 같다. 게임 코드는 바꾸지 않는다.
// 틀(iframe, 폭 W · 높이 H)을 CSS zoom 2로 키워 2W × 2H로 담고, 설치된 Edge를 헤드리스 · 임시 프로필 · 실제 GPU로 띄운다.
// 한 곡을 처음부터 끝까지 자동 연주(?qa 훅 — 실제 입력 함수)하며 입구 · 미리듣기 · 카운트 · 첫 문장(안내음 → 방이 어두워짐 → 맞음)까지 담고, 녹화를 멈췄다가 곡 끝에서 이어 결과를 담는다
// (점수 · 콤보 · 5/5 도장이 실제 값이다).
//   node experiences/korean-rhythm/qa/world-campus-20261104/시안영상.cjs [폭 높이]        (기본 390 844) → 시안_<폭>.mp4(30fps, 곡 한 번 — 약 4분 걸림)
//   node experiences/korean-rhythm/qa/world-campus-20261104/시안영상.cjs --다름 [폭 높이]  둘째 문장을 틀리게 답하는 짧은 판(건너뛰기로 — 묻는 두 음 · 벌 없음) → 다름_<폭>.mp4
//   나가는 것: 공용 작업본 .tmp/rhythm-world-20261104/시안/  · 끝에 「짧은 멈춤」 비율을 적는다.
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const [W = 390, H = 844] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const WRONG = process.argv.includes('--다름');
const CAPTURE_FPS = 60, FPS = 30;
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="/korean-rhythm/index.html?qa=1" allow="autoplay"></iframe>`;
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
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'rhythm-world-20261104', '시안');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 짧은 멈춤: 새 장 뒤 같은 장이 1~2장 끼고 다시 새 장이면(움직이는 중 멈칫) 하나. 같은 장이 3장 넘게 이어지면 정지 화면이라 세지 않는다(주문 폭주와 같은 셈). */
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
  const context = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 1, acceptDownloads: true });
  await context.addInitScript(() => { try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ } });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/korean-rhythm/'));
  // 누르기: 틀 안 요소의 자리 × 2 = 바깥 화면 자리에 진짜 마우스(요소 클릭은 확대된 틀을 스크롤해 화면이 밀린다)
  const tap = async (sel) => {
    const r = await fr().evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    await page.mouse.move(r.x * 2, r.y * 2);
    await page.mouse.down(); await sleep(80); await page.mouse.up();
    await page.mouse.move(W * 2 - 2, 2);
  };
  for (let i = 0; i < 120; i += 1) { if (fr()) break; await sleep(50); }
  const type = await page.evaluate(async (fps) => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: { suppressLocalAudioPlayback: true }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 14e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t;
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(500);
    return t;
  }, CAPTURE_FPS);
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => !!document.querySelector('.w-art') && !!window.__rhythm).catch(() => false)) break; await sleep(100); }
  const state = () => fr().evaluate(() => window.__rhythm.state());
  const waitFor = async (test, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await state(); if (test(s)) return s; await sleep(60); } throw Error('기다림 초과'); };
  const marks = {};
  const t0 = Date.now();
  await sleep(WRONG ? 1200 : 3600);   // 입구: 제목이 마이크 뒤에서 오르고 박자 점
  if (!WRONG) {
    await tap('[data-track="1"]'); marks.preview = Date.now() - t0;   // 곡을 고르면 그 곡이 들린다(후렴 미리듣기 · 제목 박자가 그 곡 빠르기로)
    await sleep(3600);
    await tap('[data-track="0"]');
    await sleep(3000);
  }
  await tap('#start-button'); marks.start = Date.now() - t0;
  await waitFor((s) => s.screen === 'game' && s.time > -6 && !s.loading);
  await fr().evaluate((wrong) => { window.__rhythm.autoplay(true); window.__rhythm.plan(wrong ? ['right', 'wrong', 'right', 'right', 'right'] : ['right', 'right', 'right', 'right', 'right']); }, WRONG);
  if (WRONG) {
    await waitFor((s) => s.time > 2);
    const q = (await state()).questions[1];
    await fr().evaluate((t) => window.__rhythm.seek(t), q.showTime - 3);
    await waitFor((s) => s.questions[1].state !== 'pending', 40000);
    marks.answered = Date.now() - t0;
    await sleep(3500);
  } else {
    await waitFor((s) => s.questions[0].state !== 'pending', 60000); marks.first = Date.now() - t0;
    await sleep(5000);
    await page.evaluate(() => window.__rec.pause());   // 곡 가운데는 건너뛴다 — 끝 몇 초 전에 이어서 담는다
    const dur = (await state()).duration;
    await waitFor((s) => s.time > dur - 7, 260000);
    await page.evaluate(() => window.__rec.resume()); marks.resume = Date.now() - t0;
    await waitFor((s) => s.screen === 'results', 30000); marks.results = Date.now() - t0;
    await sleep(8000);
  }
  const final = await state();
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
  const raw = path.join(OUT, `녹화_${W}${WRONG ? '_다름' : ''}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `${WRONG ? '다름' : '시안'}_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, marks, 점수: final.score, 최대콤보: final.maxCombo, 맞힘: final.questions.filter((q) => q.correct).length, MB: +(fs.statSync(out).size / 1048576).toFixed(1), 짧은멈춤: stutter(out), errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
