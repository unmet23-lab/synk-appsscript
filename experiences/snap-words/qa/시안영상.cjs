'use strict';
// 찰칵 낱말 — 소리 나는 움직이는 시안(2026-11-04). 주문 폭주 시안영상.cjs와 같은 길: 게임을 WORLD 틀(.game-frame)에서 진짜 마우스로 돌리며 탭 녹화로 화면 · 소리를 한 번에 담는다.
//   node experiences/snap-words/qa/시안영상.cjs <출력 폴더> [phone|film] [폭 높이]   → 시안_<판>_<폭>.mp4(30fps)
// 게임 코드는 바꾸지 않는다. 시험 손잡이 window.__snap으로 자리만 읽는다.
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../node_modules')] }));
const args = process.argv.slice(2), OUT = args[0], LOOK = args.find((a) => a === 'film' || a === 'phone') || 'phone';
const nums = args.filter((a) => /^\d+$/.test(a)).map(Number), W = nums[0] || 390, H = nums[1] || 844;
const EXP = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class=game-frame src="/snap-words/index.html?seed=7&lang=ko&look=${LOOK}" allow="autoplay"></iframe>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'],
    args: ['--headless=new', '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] });
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`;
  const context = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) logs.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/snap-words/'));
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
  const pressAt = async (x, y, hold = 70) => { await page.mouse.move(x * 2, y * 2); await page.mouse.down(); await sleep(hold); await page.mouse.up(); await page.mouse.move(W * 2 - 2, 2); };
  const tapSel = async (sel) => { const r = await fr().evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); await pressAt(r.x, r.y); };
  const until = async (src, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(src).catch(() => false)) return true; await sleep(80); } return false; };
  // 판 · 물건의 화면 자리(뷰파인더 기준 + 뷰파인더 자리)
  const posOf = (word, kind) => fr().evaluate(([word, kind]) => {
    const { S, cam } = window.__snap, item = S.items.find((i) => i.word === word && (!kind || i.kind === kind));
    if (!item) return null;
    const xs = item.q.map((p) => p[0]), ys = item.q.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const v = document.querySelector('#vf').getBoundingClientRect();
    return { x: v.left + cam.x + cx * cam.s, y: v.top + cam.y + cy * cam.s, vx: v.left, vy: v.top, vw: v.width, vh: v.height };
  }, [word, kind]);
  const dragBy = async (dx, dy, steps = 22) => {
    const v = await posOf('tree'); const sx = v.vx + v.vw / 2, sy = v.vy + v.vh * 0.45;
    await page.mouse.move(sx * 2, sy * 2); await page.mouse.down();
    for (let i = 1; i <= steps; i += 1) { await page.mouse.move((sx + (dx * i) / steps) * 2, (sy + (dy * i) / steps) * 2); await sleep(16); }
    await page.mouse.up(); await page.mouse.move(W * 2 - 2, 2);
  };
  // 그 판이 보이게 천천히 돌아본 뒤 누른다
  const lookAndTap = async (word, kind) => {
    let p = await posOf(word, kind);
    const marginX = 60, top = p.vy + 70, bottom = p.vy + p.vh - 150;
    const dx = p.x < p.vx + marginX ? p.vx + p.vw * 0.4 - p.x : p.x > p.vx + p.vw - marginX ? p.vx + p.vw * 0.6 - p.x : 0;
    const dy = p.y < top ? top + 60 - p.y : p.y > bottom ? bottom - 40 - p.y : 0;
    if (dx || dy) { await dragBy(dx, dy); await sleep(420); p = await posOf(word, kind); }
    await pressAt(p.x, p.y); await sleep(760);
  };
  const shutter = async (after = 1500) => { await tapSel('#shutter'); await sleep(after); };
  const stateOf = () => fr().evaluate(() => { const { S } = window.__snap; const m = S.missions[S.mi]; return { phase: S.phase, screen: S.screen, mi: S.mi, m: m && { kind: m.kind, word: m.word } }; });

  await until(() => !!window.__snap);
  await sleep(2400);                      // 입구: 흐림 → 또렷 → 괄호가 제목 날개를 잡는다
  await tapSel('[data-go=start]');
  await until(() => window.__snap.S.screen === 'shoot' && !document.querySelector('#msg').hidden);
  await sleep(1500);                      // 태오 인사
  await lookAndTap('cat'); await sleep(450); await shutter(1900);          // 고양이: 야옹 · 찰칵 · 카드
  const plates = await fr().evaluate(() => window.__snap.S.plates.filter((p) => p.kind === 'plate' && p.group === 'blade').map((p) => p.word));
  const free = async (not) => plates.find((w) => !not.includes(w));
  const missionWords = await fr().evaluate(() => window.__snap.S.missions.map((m) => m.word));
  const first = await free(missionWords);
  await lookAndTap(first, 'plate'); await shutter(1900);
  const second = plates.find((w) => w !== first && !missionWords.includes(w)) || plates.find((w) => w !== first);
  await lookAndTap(second, 'plate'); await shutter(1700);
  // 물러나서 「부탁 들으러 가기」
  await tapSel('#step-back'); await sleep(900);
  await until(() => !!document.querySelector('#msg .pill'));
  await tapSel('#msg .pill');
  await sleep(1900);
  // 첫 부탁: 한 번은 일부러 다른 곳을 찍는다 → 태오가 짚어 준다 → 맞는 곳
  let s = await stateOf();
  const wrongWord = plates.find((w) => w !== s.m.word);
  if (s.m.kind !== 'word') { await lookAndTap(wrongWord, 'plate'); await shutter(1900); await tapSel('#step-back'); await sleep(600); }
  for (let guard = 0; guard < 6; guard += 1) {
    s = await stateOf();
    if (s.phase !== 'mission') break;
    if (s.m.kind === 'sound') await sleep(1700);
    await lookAndTap(s.m.word, s.m.kind === 'word' ? 'thing' : 'plate');
    await sleep(300);
    const before = s.mi;
    await tapSel('#shutter');
    await until(`window.__snap.S.mi !== ${before} || window.__snap.S.phase !== 'mission'`, 9000);
    await sleep(1500);
  }
  // 인화
  await until(() => window.__snap.S.screen === 'develop', 8000);
  for (let i = 0; i < 3; i += 1) {
    if ((await stateOf()).screen !== 'develop') break;
    await sleep(1500);
    const answer = await fr().evaluate(() => document.querySelector('.dev-opt') ? window.__snap.answerNow?.() ?? 0 : 0);
    await page.mouse.move(W * 2 - 2, 2);
    const r = await fr().evaluate((i) => { const b = document.querySelectorAll('.dev-opt')[i]?.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, answer);
    if (r) await pressAt(r.x, r.y);
    await sleep(1300);
  }
  await until(() => window.__snap.S.screen === 'result', 6000);
  await sleep(3800);
  await tapSel('.res-row [data-go=album]').catch(() => {});
  await sleep(3000);
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
  const raw = path.join(OUT, `녹화_${LOOK}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `시안_${LOOK}_${W}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, bytes: fs.statSync(out).size, errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
