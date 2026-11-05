'use strict';
// 입장 검사 캠퍼스 판 — 「소리 나는 움직이는 시안」(2026-11-04). 주문 폭주 시안영상.cjs(11-03 밤 판)를 옮겼다:
// 게임을 WORLD 틀(같은 출처 .game-frame)에서 실제로 돌리며 탭 녹화(getDisplayMedia preferCurrentTab)로 화면과 게임이 낸 소리를 한 번에 담는다.
// 설치된 Edge를 헤드리스 · 임시 프로필 · 실제 GPU로 띄우고, 틀을 CSS zoom 2로 키워 2W × 2H로 담는다. 게임 코드는 바꾸지 않는다.
// 흐름: 입구(사진이 또렷해지고 도장이 내려앉음) → 근무 시작 → 블라인드 「창문 열기」 → 연수 건너뛰기 → 손님 여섯
//   (첫 손님은 표 살피기 · 줄 체크 · 도장 들기, 경수는 일부러 통과, 말순 할머니는 일부러 잘못 거절, 나머지는 맞게 — 틀린 뒤 게임이 끼워 넣는 확인 손님까지) → 근무 끝.
//   node experiences/entry-check/qa/world-campus-20261104/시안영상.cjs [폭 높이]   (기본 390 844) → 공용 작업본 .tmp/entry-check-world-20261104/시안/시안_<폭>.mp4
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const [W = 390, H = 844] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const CAPTURE_FPS = 60, FPS = 30;
const EXP = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const FRAME = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#060709;overflow:hidden}iframe{border:0;display:block;width:${W}px;height:${H}px;zoom:2}</style><iframe class="game-frame" src="/entry-check/index.html?qa=1" allow="autoplay"></iframe>`;
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
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'entry-check-world-20261104', '시안');
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
  page.on('console', (m) => { if (m.type() === 'error' && !/404|vibrate/.test(m.text())) logs.push('console: ' + m.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const fr = () => page.frames().find((x) => x.url().includes('/entry-check/'));
  // 틀 안 요소의 자리 × 2 = 바깥 화면 자리에 진짜 마우스를 누른다(요소 클릭은 확대된 틀 문서를 스크롤해 화면이 밀린다)
  const tap = async (sel) => {
    const r = await fr().evaluate((q) => { const n = document.querySelector(q); n.scrollIntoView({ block: 'nearest' }); const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    await page.mouse.move(r.x * 2, r.y * 2);
    await page.mouse.down(); await sleep(90); await page.mouse.up();
    await page.mouse.move(W * 2 - 2, 2);
  };
  // 도장을 눌러 든 채로 끌고 와 놓는다(놓을 곳이 없으면 든 채로 잠시 있다가 도장 줄에 내려놓는다 — 찍히지 않는다)
  const carry = async (sel, to) => {
    const at = (q) => fr().evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, q);
    const a = await at(sel), b = to ? await at(to) : { x: a.x + (sel === '#btn-pass' ? -40 : 40), y: a.y - 170 };
    await page.mouse.move(a.x * 2, a.y * 2); await page.mouse.down(); await sleep(700);
    await page.mouse.move(b.x * 2, b.y * 2, { steps: 26 }); await sleep(to ? 300 : 1100);
    if (!to) { const h = await at('#btn-hint'); await page.mouse.move(h.x * 2, h.y * 2, { steps: 14 }); await sleep(120); }
    await page.mouse.up(); await page.mouse.move(W * 2 - 2, 2);
  };
  for (let i = 0; i < 120; i += 1) { if (fr()) break; await sleep(50); }
  const type = await page.evaluate(async (fps) => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: { suppressLocalAudioPlayback: true, autoGainControl: false, echoCancellation: false, noiseSuppression: false }, preferCurrentTab: true, selfBrowserSurface: 'include' });
    const t = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus'].find((x) => MediaRecorder.isTypeSupported(x));
    window.__rec = new MediaRecorder(s, { mimeType: t, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192000 });
    window.__chunks = []; window.__stream = s; window.__type = t;
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(500);
    return t;
  }, CAPTURE_FPS);
  const t0 = Date.now(), marks = {};
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await sleep(100); }
  marks.ready = Date.now() - t0;
  await sleep(2400);
  await tap('.hero-copy .lede'); await sleep(700);   // 첫 손짓(빈 곳) — 오디오 문맥을 깨운다
  await tap('#rec-start'); marks.start = Date.now() - t0;
  await sleep(2000);
  await tap('#btn-begin'); marks.open = Date.now() - t0;   // 블라인드가 걷히고 음악이 들어온다
  await sleep(1400);
  if (await fr().evaluate(() => !document.querySelector('#coach').hidden)) { await sleep(1400); await tap('#coach-skip'); }
  // 손님마다: 말을 듣고 → (앞 손님은 표 · 짐 · 안내문을 읽는 시간) → 도장. 말순 할머니(pool-03)만 일부러 틀리게 거절해 갸웃 · 묻는 두 음 · 「그 뒤에 생긴 일」을 담는다.
  // 틀린 뒤에는 게임이 같은 규칙의 확인 손님을 다음에 끼워 넣으므로(서달수 pool-11) 손님 차례를 정해 두지 않고 지금 손님을 읽는다.
  const current = () => fr().evaluate(() => window.__entry.state().cur);
  let seen = 0, last = null;
  for (let n = 0; n < 12; n += 1) {
    let cur = null;
    for (let i = 0; i < 120; i += 1) { cur = await current(); if (cur?.id && cur.id !== last && !cur.done) break; await sleep(100); }
    if (!cur?.id || cur.id === last) break;
    last = cur.id; seen += 1;
    await sleep(seen <= 3 ? 3600 : 2500);
    // 2판에서 보여 줄 손짓: 첫 손님은 표를 살피고 줄을 체크한 뒤 도장을 들고 와서 찍는다.
    // 경수는 일부러 놓치고(씩 웃음 → 대답 뒤 흑백 사건), 말순 할머니는 일부러 잘못 거절한다(갸웃). 나머지는 맞게.
    const planned = { 'pool-02': 'pass', 'pool-03': 'cap' };
    const answer = planned[cur.id] ?? cur.answer, wrong = answer !== cur.answer;
    if (seen === 1) { await tap('#doc'); await sleep(1800); await tap('.rules li .w-tick'); await sleep(1700); await carry('#btn-reject'); await sleep(1200); }
    if (answer === 'pass') { if (seen === 1) await carry('#btn-pass', '#doc'); else await tap('#btn-pass'); }
    else { await tap('#btn-reject'); await sleep(1300); await tap(`#notice .rule[data-rule=${answer}]`); }
    await sleep(wrong ? 6400 : 3200);
    marks[`손님${seen}`] = cur.id;
    await fr().evaluate(() => document.querySelector('#feedback').scrollTo?.(0, 0));
    await tap('#btn-next');
    if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break;
    await sleep(700);
    if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break;
  }
  marks.finish = Date.now() - t0;
  await sleep(5200);
  await fr().evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' })); await sleep(2200);
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
  const raw = path.join(OUT, `녹화_${W}${type.startsWith('video/mp4') ? '.mp4' : '.webm'}`);
  await (await dl).saveAs(raw);
  const shots = await fr().evaluate(() => window.__entry.state().results.map((r) => `${r.caseId} ${r.choice} ${r.correct}`));
  await context.close(); await browser.close(); srv.close();
  const out = path.join(OUT, `시안_${W}.mp4`);
  // 탭 녹화 소리는 게임 끝 출력(최고 0.93)보다 커져 1.0을 넘는다(11-05 실측 1.39) — 보는 파일이 찌그러지지 않게 3dB 내린다
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-af', 'volume=-3dB', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(raw, { force: true });
  console.log(JSON.stringify({ out, 녹화형식: type, marks, 판정: shots, bytes: fs.statSync(out).size, errors: logs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
