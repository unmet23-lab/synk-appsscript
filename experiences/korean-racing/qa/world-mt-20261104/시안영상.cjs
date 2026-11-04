'use strict';
// MT 바닷가 레이스 — 소리 나는 움직이는 시안(주문 폭주 시안영상.cjs와 같은 길): 게임을 WORLD 틀에서 실제로 돌리며 탭 녹화로 화면과 소리를 한 번에 담는다.
// 소리는 게임이 내는 그대로(문제 음성 · 바람 · 바퀴 · 프리휠 · 벨 · 음악)이고 스피커로는 내지 않는다. 게임 코드는 바꾸지 않는다.
//   node experiences/korean-racing/qa/world-mt-20261104/시안영상.cjs [city|hybrid] [폭 높이]   (기본 city 390 844) → 시안_<결>_<폭>.mp4(30fps)
//   한 판 순서: 입구 → 출발 → 1번 맞힘(내리막 질주 · 추월 벨) → 2번 일부러 틀림(안 멈춤, 해설은 달리면서) → 3번 맞힘 → 끝까지 달려 도착 → 바닷길 잠깐.
//   나가는 것: 공용 작업본 .tmp/world-mt-20261104/시안/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const args = process.argv.slice(2), style = args.find((a) => /^(city|hybrid)$/.test(a)) || 'city';
const [W = 390, H = 844] = args.filter((a) => /^\d+$/.test(a)).map(Number);
const SHORT = args.includes('--짧게');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.hdr': 'application/octet-stream' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="/index.html?qa=1&bike=${style}" allow="autoplay"></iframe>`;
const serve = () => new Promise((resolve) => { const srv = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (u === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(FRAME); return; } let file = path.join(ROOT, u); if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; } if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(fs.readFileSync(file)); }); srv.listen(0, '127.0.0.1', () => resolve(srv)); });
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'world-mt-20261104', '시안');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function stutter(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'mpdecimate=hi=64*4:lo=64*2:frac=0.1', '-loglevel', 'debug', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const seq = [...`${r.stderr || ''}`.matchAll(/(keep|drop) pts:\d+ pts_time:([\d.]+)/g)].map((m) => m[1] === 'keep');
  let moving = 0, stalls = 0;
  for (let i = 1; i < seq.length; i += 1) { if (seq[i] && seq[i - 1]) moving += 1; if (!seq[i] && seq[i - 1]) { let j = i; while (j < seq.length && !seq[j]) j += 1; if (j - i <= 2 && j < seq.length) { stalls += 1; moving += 1; } } }
  return { 움직임자리: moving, 짧은멈춤: stalls, 비율: +(stalls / Math.max(1, moving)).toFixed(3) };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'], args: ['--headless=new', '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const context = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage(), logs = [], marks = {};
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('SYNK_RACING_TUTORIAL_V1', JSON.stringify({ version: 1, completed: true })); } catch { /* 없는 환경 */ } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const fr = () => page.frames().find((x) => x.url().includes('/index.html'));
  for (let i = 0; i < 600; i++) { if (await fr()?.evaluate(() => window.__racingQA?.state().ready).catch(() => false)) break; await sleep(250); }
  const tap = async (sel) => {
    const r = await fr().evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    await page.mouse.move(r.x * 2, r.y * 2); await page.mouse.down(); await sleep(70); await page.mouse.up(); await page.mouse.move(W * 2 - 2, 2);
  };
  const type = await page.evaluate(async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: { suppressLocalAudioPlayback: true }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t; window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); }; window.__rec.start(500);
    return t;
  });
  const t0 = Date.now(), state = () => fr().evaluate(() => { const s = window.__racingQA.state(); return { running: s.running, gate: s.gate, gateIndex: s.gateIndex, answers: s.answers.length, total: s.total, finished: s.finished, coast: s.coast, boost: s.boost }; });
  await sleep(1800);   // 입구
  await tap('#start'); marks.start = Date.now() - t0;
  for (let i = 0; i < 120; i++) { if ((await state()).running) break; await sleep(150); }
  // 문제 하나: 음성을 끝까지 듣고 고른다. wrong이면 일부러 다른 길.
  async function answer(index, wrong) {
    for (let i = 0; i < 700; i++) { const s = await state(); if (s.gateIndex === index && s.gate?.announced && s.gate.readyAt != null) break; if (s.finished) return; await sleep(120); }
    await sleep(500);
    const s = await state(), pick = wrong ? s.gate.types.find((x) => x !== s.gate.answer) : s.gate.answer;
    await tap(`#lane-choices .lane-tag[data-word="${String(pick).replace(/"/g, '\\"')}"]`); marks[`q${index}`] = Date.now() - t0;
    for (let i = 0; i < 400; i++) { const n = await state(); if (n.answers > index || n.finished) break; await sleep(100); }
  }
  await answer(0, false); marks.music = await fr().evaluate(() => { const c = window.__racing.snapshot().coastRadio; return { playing: c.playing, gain: c.targetGain, blocked: c.blocked, error: c.error }; }); await answer(1, true); await answer(2, false);
  if (!SHORT) { await answer(3, false); await answer(4, false); await sleep(5500); marks.end = Date.now() - t0; } else await sleep(5000);
  const dl = page.waitForEvent('download', { timeout: 180000 });
  await page.evaluate(() => new Promise((resolve) => { window.__rec.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(window.__chunks, { type: window.__type })); a.download = window.__type.startsWith('video/mp4') ? 'rec.mp4' : 'rec.webm'; document.body.append(a); a.click(); window.__stream.getTracks().forEach((t) => t.stop()); resolve(); }; window.__rec.stop(); }));
  const raw = path.join(OUT, `녹화_${style}_${W}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `시안_${style}_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, marks, bytes: fs.statSync(out).size, 짧은멈춤: stutter(out), errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
