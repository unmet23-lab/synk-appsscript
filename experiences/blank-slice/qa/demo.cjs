'use strict';
// 시연 영상(소리 포함): 실제 게임을 마우스로 그어 베며 녹화한다. 녹화에는 소리가 담기지 않아서, 게임이 울린 소리 기록을
// 같은 합성(sound-lab.mjs의 render)으로 굽고 영상에 입힌다. 한 번 녹화한 같은 화면에 소리 후보 A(펠트 사각)·B(맑은 사인)를 각각 입혀 비교하게 한다.
// 흐름: 연습 → 맞힘 다섯 번(연속 계단, 4연속 몽글) → 일부러 틀림(해설) → 맞힘 둘. 맞힌 첫 문장의 손맛은 40ms 간격 프레임으로 모은다(qa/filmstrip.py).
//
// 소리 맞추기: 녹화(스크린캐스트)는 게임이 바쁠 때 화면을 0.2초쯤 늦게 찍는다. 그래서 시작·끝의 검은 표시만으로 맞추면 판 도중에는
// 소리가 화면보다 먼저 난다(2026-10-02 실측). 벨 때마다 왼쪽 위 16px에 자홍 표시를 찍고(?qa, window.__sliceMark), 영상에서 그 프레임을 찾아
// 소리 기록 하나하나를 영상 시각으로 옮긴다(검은 표시·자홍 표시를 잇는 꺾은선). 표시는 최종 영상에서 바탕색으로 덮는다.
// 쓰는 법: 서버를 켠 뒤  node experiences/blank-slice/qa/demo.cjs [desktop|mobile]
//          → qa/demo/<화면>-A.mp4 · qa/demo/<화면>-B.mp4 · qa/demo/<화면>-손맛.jpg (git 제외)
const path = require('node:path'), fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const OUT = path.join(__dirname, 'demo'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5217/';
const which = process.argv[2] || 'desktop';
const SIZE = which === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (page) => page.evaluate(() => window.__slice.state());
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); if (r.status !== 0) throw new Error(`${cmd}: ${(r.stderr || '').slice(-600)}`); return r; };

async function apex(page, i) {
  let prev = null;
  for (let k = 0; k < 90; k++) {
    const p = await page.evaluate((n) => { const s = window.__slice.pieceScreen(n), a = window.__slice.arena(); return s && { x: a.x + s.x, y: a.y + s.y, ay: a.y, ah: a.h }; }, i);
    if (p && p.y > p.ay + 60 && p.y < p.ay + p.ah - 40) { if (prev && Math.abs(prev.y - p.y) < 5) return p; prev = p; }
    await sleep(50);
  }
  return null;
}
/** 마우스로 긋기. 실제 움직인 시각(8ms 간격)을 함께 보낸다(바쁜 때 늦게 도착해도 손 빠르기는 실제대로 — capture.cjs와 같은 까닭). */
async function swipe(cdp, p) {
  const dx = which === 'mobile' ? 60 : 110, dy = which === 'mobile' ? 26 : 50;   // 좁은 화면은 짧게(옆 열 조각을 먼저 베지 않게)
  const t0 = Date.now() / 1000, at = (k) => ({ x: Math.round(p.x - dx + (2 * dx * k) / 8), y: Math.round(p.y - dy + (2 * dy * k) / 8) });
  const ev = (type, k, pressed) => cdp.send('Input.dispatchMouseEvent', { type, ...at(k), button: 'left', buttons: pressed ? 1 : 0, clickCount: 1, timestamp: t0 + 0.008 * k });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at(0), button: 'none', buttons: 0, timestamp: t0 - 0.02 });
  await ev('mousePressed', 0, true);
  for (let k = 1; k <= 8; k++) { await ev('mouseMoved', k, true); await sleep(8); }
  await ev('mouseReleased', 8, false);
}
/** 영상에서 검은 화면이 시작되는 시각들(초). */
function blackStarts(file) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-vf', 'blackdetect=d=0.1:pic_th=0.97:pix_th=0.08', '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return [...(r.stderr || '').matchAll(/black_start:([\d.]+)/g)].map((m) => Number(m[1]));
}
/** 왼쪽 위 자홍 표시가 처음 보이는 시각들(초). 자홍은 YUV에서 U·V가 모두 크다(흰 바탕은 둘 다 128 근처). */
function markerStarts(file) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-vf', 'crop=12:12:2:2,showinfo', '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const frames = [...(r.stderr || '').matchAll(/pts_time:([\d.]+)[^\n]*?mean:\[(\d+) (\d+) (\d+)\]/g)].map((m) => ({ t: +m[1], u: +m[3], v: +m[4] }));
  const out = []; let on = false;
  for (const f of frames) { const m = f.u > 150 && f.v > 150; if (m && !on) out.push(f.t); on = m; }
  return out;
}
/** 페이지 시각(ms) → 영상 시각(초): 맞춘 점들을 잇는 꺾은선(양끝은 가장 가까운 구간을 늘린다). */
function mapper(anchors) {
  const a = [...anchors].sort((p, q) => p[0] - q[0]);
  return (t) => {
    let i = a.findIndex((p) => p[0] > t);
    if (i <= 0) i = i === 0 ? 1 : a.length - 1;
    const [t0, v0] = a[i - 1], [t1, v1] = a[i];
    return v0 + ((t - t0) * (v1 - v0)) / (t1 - t0);
  };
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: SIZE } });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  // 녹화 도구 한계: 상단 칸(점수·연속)의 ‘튀기’ CSS 애니메이션이 도는 0.3초 동안 스크린캐스트가 새 화면을 받지 못한다
  // (성능 추적으로는 실제 화면이 16.7ms마다 매끄럽게 그려진다 — 2026-10-02 확인). 그래서 시연 녹화에서만 그 애니메이션을 뺀다
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.pill.punch{animation:none!important}'; document.head.append(s); }); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}?qa&sfx=felt`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForSelector('#btn-start'); await sleep(2500);   // 입구에서 3D 무대를 미리 만드는 시간
  await page.evaluate(() => { window.__slice.sound.start(); window.__sliceMark = true; });
  const T0 = await page.evaluate(() => window.__slice.mark()); await sleep(700);
  await page.click('#btn-start'); await sleep(900);
  const pr = (await S(page)).practice;
  await swipe(cdp, await apex(page, pr.options.indexOf('우유'))); await sleep(2700);
  for (let k = 0; k < 8; k++) {
    let st = await S(page);
    for (let w = 0; w < 80 && !(st.cur && st.cur.tosses > 0 && !st.cur.done); w++) { await sleep(60); st = await S(page); }
    const wrong = k === 5, idx = st.index;
    const target = wrong ? st.cur.options.find((o) => o !== st.cur.answer) : st.cur.answer;
    for (let attempt = 0; attempt < 2; attempt++) {   // 빗나가면 다음 던지기에서 한 번 더
      const tosses = st.cur.tosses, p = await apex(page, st.cur.options.indexOf(target));
      if (p) await swipe(cdp, p);
      await sleep(250); st = await S(page);
      if (st.index !== idx || st.cur?.done) break;
      for (let w = 0; w < 60 && st.cur && !st.cur.done && st.cur.tosses === tosses; w++) { await sleep(100); st = await S(page); }
      if (!st.cur || st.cur.done) break;
    }
    if (wrong) { await sleep(3200); if (await page.isVisible('#btn-next')) await page.click('#btn-next'); await sleep(400); } else await sleep(1300);
  }
  await sleep(900);
  const T1 = await page.evaluate(() => window.__slice.mark()); await sleep(600);
  const log = await page.evaluate(() => window.__slice.sound.take());
  const impacts = await page.evaluate(() => window.__slice.impacts());
  const arena = await page.evaluate(() => window.__slice.arena());
  const video = page.video();
  await context.close();
  const webm = await video.path();

  // 맞출 점: 검은 표시 둘(시작·끝) + 벤 순간의 자홍 표시
  const blacks = blackStarts(webm), marks = markerStarts(webm);
  if (blacks.length < 2) throw new Error(`검은 표시를 못 찾음: ${blacks}`);
  const V0 = blacks[0], V1 = blacks[blacks.length - 1];
  const anchors = [[T0, V0], [T1, V1]];
  const linear = mapper(anchors), lags = [];
  if (marks.length === impacts.length) impacts.forEach((im, i) => { anchors.push([im.t, marks[i]]); lags.push(Math.round((marks[i] - linear(im.t)) * 1000)); });
  else errors.push(`자홍 표시 ${marks.length}개 ≠ 벤 횟수 ${impacts.length}: 시작·끝 표시로만 맞춤`);
  const toVideo = mapper(anchors);
  const events = log.map((e) => ({ ...e, t: toVideo(e.t) })).filter((e) => e.t >= 0);

  // 소리 굽기(새 페이지에서, 영상 시각 그대로): A·B
  const lab = await browser.newPage();
  await lab.goto(`${BASE}sound-lab.html`); await lab.waitForFunction(() => window.__lab);
  const wavs = {};
  for (const [tag, v] of [['A', 'felt'], ['B', 'clean']]) {
    const evs = events.map((e) => (e.kind === 'sfx' ? { ...e, opts: { ...e.opts, variant: v } } : e));
    const b64 = await lab.evaluate(({ evs, sec }) => window.__lab.render(evs, sec), { evs, sec: V1 + 1 });
    wavs[tag] = path.join(OUT, `${which}-${tag}.wav`);
    fs.writeFileSync(wavs[tag], Buffer.from(b64, 'base64'));
  }
  await browser.close();

  // 자홍 표시가 보이는 동안 그 자리를 게임 막대 바탕색으로 덮는다
  const cover = marks.map((s) => `between(t,${(s - 0.05).toFixed(3)},${(s + 0.3).toFixed(3)})`).join('+') || '0';
  const outs = [];
  for (const tag of ['A', 'B']) {
    const out = path.join(OUT, `${which}-${tag}.mp4`);
    run('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-i', wavs[tag],
      '-filter_complex', `[0:v]drawbox=x=0:y=0:w=20:h=20:color=0xfefcf7:t=fill:enable='${cover}'[v];[1:a]aresample=48000[a]`, '-map', '[v]', '-map', '[a]',
      '-ss', (V0 + 0.34).toFixed(3), '-to', (V1 - 0.04).toFixed(3),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
    fs.rmSync(wavs[tag], { force: true });
    outs.push(out);
  }

  // 손맛 프레임: 연습 다음, 맞힌 첫 문장(그 문장의 자홍 표시 시각)
  const k = impacts.findIndex((x, i) => i > 0 && x.verdict === 'ok');
  const hitAt = marks.length === impacts.length ? marks[k] : toVideo(impacts[k].t);
  const strip = path.join(OUT, `${which}-손맛.jpg`);
  run('python', [path.join(__dirname, 'filmstrip.py'), webm, String(hitAt), String(arena.x + impacts[k].x), String(arena.y + impacts[k].y), String(SIZE.width), String(SIZE.height), strip]);
  fs.rmSync(webm, { force: true });

  const counts = {}; for (const e of events) counts[e.name] = (counts[e.name] || 0) + 1;
  console.log(JSON.stringify({ out: outs.map((o) => `${path.relative(process.cwd(), o)} ${(fs.statSync(o).size / 1048576).toFixed(1)}MB`),
    seconds: +(V1 - V0).toFixed(2), sounds: counts, impacts: impacts.length, markers: marks.length, recordLagMs: lags, errors }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
