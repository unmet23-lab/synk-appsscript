#!/usr/bin/env node
'use strict';
/**
 * PULSE 작품 진열 굽기 (2026-11-09) — 작품.json 한 장으로 세 자리의 영상 · 포스터 · 쇼릴을 굽는다.
 *
 *   node 굽기.cjs synk <synk.im 자산 폴더(dist/assets/v10)> [--tag 20261109] [--only key,…]
 *        → pulse-film-<key>-<tag>.mp4(소리 없는 미리 보기 960 · 540) · .webp(같은 크기 포스터)
 *   node 굽기.cjs app <고객 앱 public/pulse-app 폴더> [--only key,…]
 *        → assets/films/<appId>-v1.mp4(소리 있는 720p) · <appId>-poster-v1.webp(1280 · 720)
 *   node 굽기.cjs pc <desktop/assets/pulse/portfolio 폴더> [--only key,…]
 *        → <pcId>.webp(4:3 1360 × 1020로 자름 — 세로 작품은 작품.json pc.y)
 *   node 굽기.cjs reel <쇼릴 결과 폴더> → reel-wide.mp4(1280 × 800) · reel-tall.mp4(720 × 1280) · 포스터 · reel.json(시각표)
 *
 * poster.src: raw(자막 전 그림 판) · final(완성본) · keep(이 자리의 지금 그림을 그대로 — 굽지 않음).
 * 생성 영상의 도구 표시가 공개 파일에 남지 않게 모든 결과는 다시 인코딩하고 -map_metadata -1 · -map_chapters -1로 머리 정보를 비운다.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, '작품.json'), 'utf8'));
const VENDOR = path.join(process.env.USERPROFILE || '', 'Documents', 'synk-vendor');
const MAEJIN_CUTS = path.join(VENDOR, 'homeshopping-horror-20261021', '최종', '_컷');

const args = process.argv.slice(2);
const mode = args[0];
const outDir = args[1];
const opt = (name, dflt) => { const i = args.indexOf(name); return i > 0 ? args[i + 1] : dflt; };
const only = (opt('--only', '') || '').split(',').filter(Boolean);
const tag = opt('--tag', '20261109');
const pick = (w) => !only.length || only.includes(w.key);
const vpath = (rel) => rel && path.join(VENDOR, rel);
const CLEAN = ['-map_metadata', '-1', '-map_chapters', '-1', '-metadata', 'creation_time=', '-fflags', '+bitexact'];

function run(cmd, a) { execFileSync(cmd, a, { stdio: ['ignore', 'ignore', 'inherit'] }); }
function probe(f) {
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number);
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
  return { w, h, d };
}
function need(f) { if (!f || !fs.existsSync(f)) throw new Error('없는 파일: ' + f); return f; }
function posterSrc(w) { return w.poster.src === 'raw' ? vpath(w.raw) : vpath(w.final); }

// 소리 없는 미리 보기: 넓은 작품 960 × 540, 세로 540 × 960. synk.im 시험(qa/pages-v12)이 한 편 3MB 아래를 요구해 길이로 상한을 둔다(2.6MB ÷ 길이, 900k까지).
function preview(w, out) {
  const src = need(vpath(w.final));
  const scale = w.tall ? 'scale=540:960:flags=lanczos' : 'scale=960:540:flags=lanczos';
  const kbps = Math.min(900, Math.floor(2.6 * 8000 / probe(src).d));
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', `${scale},fps=24,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-maxrate', kbps + 'k', '-bufsize', kbps * 2 + 'k', '-profile:v', 'high', '-movflags', '+faststart', ...CLEAN, out]);
}
function stillTo(src, t, vf, out, q = 80) {
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', '-vf', vf, '-c:v', 'libwebp', '-quality', String(q), ...CLEAN, out]);
}
// 고객 앱 완성 광고: 소리 있는 720p.
function full(w, out) {
  const src = need(vpath(w.final));
  const scale = w.tall ? 'scale=720:1280:flags=lanczos' : 'scale=1280:720:flags=lanczos';
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `${scale},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-maxrate', '3500k', '-bufsize', '7000k', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', ...CLEAN, out]);
}

function doSynk() {
  for (const w of DATA.works.filter(pick)) {
    if (!w.final || w.poster.src === 'keep') { console.log('그대로', w.key); continue; }
    const base = path.join(outDir, `pulse-film-${w.key}-${tag}`);
    preview(w, base + '.mp4');
    stillTo(need(posterSrc(w)), w.poster.t, w.tall ? 'scale=540:960:flags=lanczos' : 'scale=960:540:flags=lanczos', base + '.webp', 78);
    console.log(w.key, (fs.statSync(base + '.mp4').size / 1e6).toFixed(2) + 'MB', (fs.statSync(base + '.webp').size / 1e3).toFixed(0) + 'KB');
  }
}
function doApp() {
  const films = path.join(outDir, 'assets', 'films');
  for (const w of DATA.works.filter(pick)) {
    if (!w.final || w.poster.src === 'keep') { console.log('그대로', w.key); continue; }
    const mp4 = path.join(films, `${w.appId}-v1.mp4`), webp = path.join(films, `${w.appId}-poster-v1.webp`);
    full(w, mp4);
    stillTo(need(posterSrc(w)), w.poster.t, w.tall ? 'scale=720:1280:flags=lanczos' : 'scale=1280:720:flags=lanczos', webp, 80);
    console.log(w.appId, (fs.statSync(mp4).size / 1e6).toFixed(2) + 'MB', (fs.statSync(webp).size / 1e3).toFixed(0) + 'KB');
  }
}
function doPc() {
  for (const w of DATA.works.filter(pick)) {
    if (!w.final || w.poster.src === 'keep') { console.log('그대로', w.key); continue; }
    const out = path.join(outDir, `${w.pcId}.webp`);
    // 4:3로 자른다(옛 霜の肌理 그림과 같은 꼴). 세로 작품은 작품.json pc.y(가로 전체 × 3/4 창의 위 자리), 가로 작품은 그림이 있는 자리(rawBox)의 가운데.
    const src = need(posterSrc(w)), p = probe(src);
    const [bx, by, bw, bh] = (w.poster.src === 'raw' && w.rawBox) || [0, 0, p.w, p.h];
    const vf = w.tall
      ? `crop=${bw}:${Math.round(bw * 3 / 4)}:${bx}:${by + (w.pc?.y ?? Math.round((bh - bw * 3 / 4) / 2))},scale=1360:1020:flags=lanczos`
      : `crop=${Math.round(bh * 4 / 3)}:${bh}:${bx + Math.round((bw - bh * 4 / 3) / 2)}:${by},scale=1360:1020:flags=lanczos`;
    stillTo(src, w.poster.t, vf, out, 80);
    console.log(w.pcId, (fs.statSync(out).size / 1e3).toFixed(0) + 'KB');
  }
}

// 쇼릴: reel2.cjs(11-06)와 같은 방법 — 판마다 쓸 구역을 잘라 24fps로 잇는다.
function cutSrc(c) {
  const w = DATA.works.find((x) => x.key === c.work);
  if (c.src.startsWith('cut:')) return need(path.join(MAEJIN_CUTS, c.src.slice(4).padStart(2, '0') + '.mp4'));
  return need(c.src === 'raw' ? vpath(w.raw) : vpath(w.final));
}
// box = 그 판에서 그림이 실제로 있는 자리 [x, y, w, h](위아래 검은 띠를 품은 판 — 도담중공업은 1920 × 960 @ y60).
function cropFor(src, tw, th, o, box) {
  const p = probe(src), [bx, by, w, h] = box || [0, 0, p.w, p.h], ar = tw / th;
  let cw, ch;
  if (w / h > ar) { ch = h; cw = Math.round(ch * ar); } else { cw = w; ch = Math.round(cw / ar); }
  cw -= cw % 2; ch -= ch % 2;
  const cx = bx + Math.round((w - cw) * (o.x ?? 0.5));
  const cy = by + (o.y !== undefined ? Math.max(0, Math.min(o.y, h - ch)) : Math.round((h - ch) / 2));
  return `crop=${cw}:${ch}:${cx}:${cy},scale=${tw}:${th}:flags=lanczos,fps=24,setsar=1,format=yuv420p`;
}
function doReel() {
  fs.mkdirSync(outDir, { recursive: true });
  const cuts = DATA.reel.cuts;
  for (const c of cuts) { const { d } = probe(cutSrc(c)); if (c.in + c.dur > d + 0.01) throw new Error(`${c.work} ${c.src}: ${c.in}+${c.dur} > ${d}`); }
  for (const [kind, tw, th, crf] of [['wide', 1280, 800, 25], ['tall', 720, 1280, 26]]) {
    const tmp = path.join(outDir, `_tmp_${kind}`); fs.mkdirSync(tmp, { recursive: true });
    const list = [];
    cuts.forEach((c, i) => {
      const f = path.join(tmp, `${String(i).padStart(2, '0')}.mp4`);
      const box = c.src === 'raw' ? DATA.works.find((x) => x.key === c.work).rawBox : null;
      run('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.in), '-t', String(c.dur), '-i', cutSrc(c), '-an', '-vf', cropFor(cutSrc(c), tw, th, c[kind], box), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf - 4), '-r', '24', f]);
      list.push(`file '${f.replaceAll('\\', '/')}'`);
    });
    const lf = path.join(tmp, 'list.txt'); fs.writeFileSync(lf, list.join('\n'));
    const out = path.join(outDir, `reel-${kind}.mp4`);
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', ...CLEAN, out]);
    stillTo(out, 0.05, 'null', path.join(outDir, `reel-${kind}.webp`), 78);
    run('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', `fps=2,scale=${kind === 'wide' ? 240 : 120}:-1,tile=${kind === 'wide' ? '7x4' : '14x2'}`, '-frames:v', '1', path.join(outDir, `_보기-${kind}.jpg`)]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(kind, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB', probe(out).d.toFixed(3) + 's');
  }
  // 시각표는 구운 판에서 잰다(판마다 프레임 반올림이 쌓인다): 컷 길이를 24fps 프레임으로 내림한 누적.
  let fr = 0; const timeline = cuts.map((c) => { const e = { at: Math.round(fr / 24 * 100) / 100, work: c.work }; fr += Math.round(c.dur * 24); return e; });
  const total = Math.round(probe(path.join(outDir, 'reel-wide.mp4')).d * 100) / 100;
  fs.writeFileSync(path.join(outDir, 'reel.json'), JSON.stringify({ total, timeline }, null, 1));
  console.log('total', total, JSON.stringify(timeline));
}

if (!outDir) { console.error('쓰기: node 굽기.cjs <synk|app|pc|reel> <폴더> [--only …] [--tag …]'); process.exit(2); }
const MODES = { synk: doSynk, app: doApp, pc: doPc, reel: doReel };
if (!MODES[mode]) { console.error('모르는 모드: ' + mode); process.exit(2); }
MODES[mode]();
