#!/usr/bin/env node
'use strict';
/**
 * PULSE 작품 진열 굽기 (2026-11-09) — 작품.json 한 장으로 세 자리의 영상 · 포스터 · 쇼릴을 굽는다.
 *
 *   node 굽기.cjs synk <synk.im 자산 폴더(dist/assets/v10)> [--tag 20261109] [--only key,…]
 *        → pulse-film-<key>-<tag>.mp4(소리 없는 미리 보기 — 큰 줄 1280 · 720, 작은 칸 960 · 540) · .webp(포스터 — 큰 줄 1600 · 900)
 *   node 굽기.cjs app <고객 앱 public/pulse-app 폴더> [--only key,…]
 *        → assets/films/<appId>-v1.mp4(소리 있는 1080p) · <appId>-poster-v1.webp(1280 · 720)
 *   node 굽기.cjs pc <desktop/assets/pulse/portfolio 폴더> [--only key,…]
 *        → <pcId>.webp(4:3 1360 × 1020로 자름 — 세로 작품은 작품.json pc.y)
 *   node 굽기.cjs reel <쇼릴 결과 폴더> → reel-wide.mp4(1920 × 1200) · reel-tall.mp4(1080 × 1920) · 포스터 · reel.json(시각표)
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

// 소리 없는 미리 보기: 큰 줄(쇼릴의 네 편)은 1280 × 720 · 세로 720 × 1280, 작은 칸은 960 × 540 · 세로 540 × 960.
// 파일 크기가 아니라 화질로 맞춘다(11-09 유호님 「둘 다 바꿔」 — 3MB에 맞추던 판은 폭 1265px 칸에 초당 0.24Mb였다). 칸에 닿기 전에는 받지 않는다.
const BIG = new Set(DATA.reel.cuts.map((c) => c.work));
function preview(w, out) {
  const src = need(vpath(w.final));
  const big = BIG.has(w.key);
  const scale = big ? (w.tall ? 'scale=720:1280:flags=lanczos' : 'scale=1280:720:flags=lanczos') : (w.tall ? 'scale=540:960:flags=lanczos' : 'scale=960:540:flags=lanczos');
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', `${scale},fps=24,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '3000k', '-bufsize', '6000k', '-profile:v', 'high', '-threads', '6', '-movflags', '+faststart', ...CLEAN, out]);
}
function stillTo(src, t, vf, out, q = 80) {
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', '-vf', vf, '-c:v', 'libwebp', '-quality', String(q), ...CLEAN, out]);
}
// 고객 앱 완성 광고: 소리 있는 1080p(원본 크기), 한 번만 압축(11-09 유호님 「둘 다 바꿔」 — 720p · 초당 0.8~2.8Mb였다).
function full(w, out) {
  const src = need(vpath(w.final));
  const scale = w.tall ? 'scale=1080:1920:flags=lanczos' : 'scale=1920:1080:flags=lanczos';
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `${scale},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '8000k', '-bufsize', '16000k', '-profile:v', 'high', '-threads', '6', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', ...CLEAN, out]);
}

function doSynk() {
  for (const w of DATA.works.filter(pick)) {
    if (!w.final) { console.log('그대로', w.key); continue; }
    const base = path.join(outDir, `pulse-film-${w.key}-${tag}`);
    preview(w, base + '.mp4');
    if (w.poster.src !== 'keep') {
      const big = BIG.has(w.key);
      const shape = big ? (w.tall ? 'scale=720:1280:flags=lanczos' : 'scale=1600:900:flags=lanczos') : (w.tall ? 'scale=540:960:flags=lanczos' : 'scale=960:540:flags=lanczos');
      stillTo(need(posterSrc(w)), w.poster.t, shape, base + '.webp', big ? 82 : 78);
      console.log(w.key, (fs.statSync(base + '.webp').size / 1e3).toFixed(0) + 'KB');
    }
    console.log(w.key, (fs.statSync(base + '.mp4').size / 1e6).toFixed(2) + 'MB');
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
// 화면 비율이 맞는 작품은 꽉 채우고, 안 맞는 작품은 자르지 않고 어두운 방의 스크린으로 놓는다(11-09 — 잘라 펼치면 720p 원본이 3.6배까지 늘어나 깨졌다).
function frameFor(src, kind, o, box) {
  const s = DATA.reel.screens[kind], p = probe(src), [bx, by, w, h] = box || [0, 0, p.w, p.h], srcTall = h > w;
  const tail = 'fps=24,setsar=1,format=yuv420p';
  if (kind === 'wide' && srcTall) { const tw = Math.round(w * s.h / h / 2) * 2; return `crop=${w}:${h}:${bx}:${by},scale=${tw}:${s.h}:flags=lanczos,pad=${s.w}:${s.h}:${s.panelX}:0:black,${tail}`; }
  if (kind === 'tall' && !srcTall) { const th = Math.round(h * s.w / w / 2) * 2; return `crop=${w}:${h}:${bx}:${by},scale=${s.w}:${th}:flags=lanczos,pad=${s.w}:${s.h}:0:${s.panelY}:black,${tail}`; }
  const ar = s.w / s.h;
  let cw, ch;
  if (w / h > ar) { ch = h; cw = Math.round(ch * ar); } else { cw = w; ch = Math.round(cw / ar); }
  cw -= cw % 2; ch -= ch % 2;
  const cx = bx + Math.round((w - cw) * (o.x ?? 0.5));
  const cy = by + (o.y !== undefined ? Math.max(0, Math.min(o.y, h - ch)) : Math.round((h - ch) / 2));
  return `crop=${cw}:${ch}:${cx}:${cy},scale=${s.w}:${s.h}:flags=lanczos,${tail}`;
}
function doReel() {
  fs.mkdirSync(outDir, { recursive: true });
  const cuts = DATA.reel.cuts;
  for (const c of cuts) for (const kind of ['wide', 'tall']) { const { d } = probe(cutSrc(c)); const at = c[kind].in ?? c.in; if (at + c.dur > d + 0.01) throw new Error(`${c.work} ${c.src} ${kind}: ${at}+${c.dur} > ${d}`); }
  for (const kind of ['wide', 'tall']) {
    const { crf } = DATA.reel.screens[kind];
    const tmp = path.join(outDir, `_tmp_${kind}`); fs.mkdirSync(tmp, { recursive: true });
    const list = [];
    cuts.forEach((c, i) => {
      const f = path.join(tmp, `${String(i).padStart(2, '0')}.mp4`);
      const box = c.src === 'raw' ? DATA.works.find((x) => x.key === c.work).rawBox : null;
      // 컷은 무손실로 먼저 잘라 이어 붙인 뒤 한 번만 압축한다(두 번 압축하면 그만큼 뭉개진다).
      run('ffmpeg', ['-v', 'error', '-y', '-ss', String(c[kind].in ?? c.in), '-t', String(c.dur), '-i', cutSrc(c), '-an', '-vf', frameFor(cutSrc(c), kind, c[kind], box), '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-r', '24', f]);
      list.push(`file '${f.replaceAll('\\', '/')}'`);
    });
    const lf = path.join(tmp, 'list.txt'); fs.writeFileSync(lf, list.join('\n'));
    const out = path.join(outDir, `reel-${kind}.mp4`);
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', ...CLEAN, out]);
    stillTo(out, 0.05, 'null', path.join(outDir, `reel-${kind}.webp`), 82);
    run('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', `fps=2,scale=${kind === 'wide' ? 240 : 120}:-1,tile=${kind === 'wide' ? '7x4' : '14x2'}`, '-frames:v', '1', path.join(outDir, `_보기-${kind}.jpg`)]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(kind, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB', probe(out).d.toFixed(3) + 's');
  }
  // 시각표는 구운 판과 맞춘다: ffmpeg -t는 24fps 프레임으로 올림해서 굽는다(11-09 잰 값 — 1.8초 = 44프레임). 컷 끝이 다음 장면으로 넘어가지 않게 원본 장면 경계를 재서 고른다.
  // 같은 작품이 이어지는 컷은 번호가 바뀌지 않으니 한 줄로 합친다.
  let fr = 0; const timeline = []; for (const c of cuts) { if (timeline.at(-1)?.work !== c.work) timeline.push({ at: Math.round(fr / 24 * 100) / 100, work: c.work }); fr += Math.ceil(c.dur * 24); }
  const total = Math.round(probe(path.join(outDir, 'reel-wide.mp4')).d * 100) / 100;
  fs.writeFileSync(path.join(outDir, 'reel.json'), JSON.stringify({ total, timeline }, null, 1));
  console.log('total', total, JSON.stringify(timeline));
}

if (!outDir) { console.error('쓰기: node 굽기.cjs <synk|app|pc|reel> <폴더> [--only …] [--tag …]'); process.exit(2); }
const MODES = { synk: doSynk, app: doApp, pc: doPc, reel: doReel };
if (!MODES[mode]) { console.error('모르는 모드: ' + mode); process.exit(2); }
MODES[mode]();
