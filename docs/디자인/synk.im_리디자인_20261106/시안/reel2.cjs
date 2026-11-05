// synk.im 시안용 쇼릴 2판(2026-11-06) — 고객 앱 쇼릴(synk-vendor/pulse-rebuild-20261104/media/works/build_reel.cjs)과 같은 방법, 순서만 바꿈.
// 까닭: 11-05 결정 「PULSE 첫 화면 제목」이 사진 「유리결」을 첫 화면에서 내렸다(「전면에 내세울만큼 매력적인 영상은 아닌것같아」). 1판은 유리결로 열고 44%가 유리결이었다(Fable 시안 검수 P1).
// 2판: 화성 CF 알의 번개로 열고 매진 임박(칼이 안 나오는 컷)과 엇갈리며, 유리결은 끝 쪽 1.8초 한 구간만. 결과는 같은 폴더의 reel2-*.mp4 · reel2.json(git 밖).
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const V = 'C:/Users/q1212/Documents/synk-vendor/';
const FILMS = 'C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets/films/';
const GIFT = V + 'pulse-season4-20261025/콘티/holiday-giftset/새컨셉/움직임/15초/기프트세트_안12_15초.mp4';
const CF = FILMS + 'hwaseong-cf-light-v1.mp4', MJ = V + 'homeshopping-horror-20261021/최종/_컷/';
const OUT = V + 'pulse-rebuild-20261104/media/works/';
// wide · tall: 그 판에서 쓸 원본 구역. y=세로 위치, top=자막 띠 위 82%만, x=가로 비율, rect=[x,y,w,h]를 그대로.
const CUTS = [
  { w: 'cf', src: CF, in: 1.3, dur: 2.2, wide: { top: true }, tall: { top: true } }, // 알에 번개
  { w: 'maejin', src: MJ + '10.mp4', in: 0.5, dur: 1.8, wide: {}, tall: { x: 0.5 } }, // 세 사람
  { w: 'cf', src: CF, in: 8.9, dur: 1.8, wide: { top: true }, tall: { top: true } }, // 부감, 둥근 물
  { w: 'maejin', src: MJ + '17.mp4', in: 0.3, dur: 1.5, wide: {}, tall: { x: 0.5 } }, // 안경 놀람
  { w: 'cf', src: CF, in: 5.1, dur: 2.2, wide: {}, tall: {} }, // 일몰과 새
  { w: 'maejin', src: MJ + '30.mp4', in: 0.3, dur: 1.5, wide: {}, tall: { x: 0.5 } }, // 우는 웃음
  { w: 'gift', src: GIFT, in: 0.9, dur: 1.8, wide: { y: 620 }, tall: {} }, // 결정이 자란다 — 끝 쪽 한 구간만
];
const probe = (f) => { const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number); return { w, h }; };
function vf(cut, tw, th, opt) {
  const tail = `scale=${tw}:${th}:flags=lanczos,fps=24,setsar=1,format=yuv420p`;
  if (opt.rect) { const [x, y, w, h] = opt.rect; return `crop=${w}:${h}:${x}:${y},${tail}`; }
  const { w, h } = probe(cut.src), ar = tw / th; let cw, ch;
  const usableH = opt.top ? Math.round(h * 0.82) : h; // 자막 띠 위까지만 쓴다
  if (w / usableH > ar) { ch = usableH; cw = Math.round(ch * ar); } else { cw = w; ch = Math.round(cw / ar); }
  const cx = Math.round((w - cw) * (opt.x ?? 0.5));
  const cy = opt.y !== undefined ? Math.min(opt.y, h - ch) : opt.top ? 0 : Math.round((h - ch) / 2);
  return `crop=${cw}:${ch}:${cx}:${cy},${tail}`;
}
function build(kind, tw, th, crf) {
  const tmp = path.join(OUT, `_tmp2_${kind}`); fs.mkdirSync(tmp, { recursive: true });
  const list = [];
  CUTS.forEach((c, i) => {
    const f = path.join(tmp, `${String(i).padStart(2, '0')}.mp4`).replaceAll('\\', '/');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.in), '-t', String(c.dur), '-i', c.src, '-an', '-vf', vf(c, tw, th, c[kind]), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-r', '24', f]);
    list.push(`file '${f}'`);
  });
  const lf = path.join(tmp, 'list.txt'); fs.writeFileSync(lf, list.join('\n'));
  const out = path.join(OUT, `reel2-${kind}.mp4`).replaceAll('\\', '/');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.05', '-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', path.join(OUT, `reel2-${kind}-poster.webp`)]);
  // 둘째 컷 프레임: 글자 창처럼 어두운 그림으로 시작해야 하는 화면이 쓴다.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(CUTS[0].dur + 0.4), '-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', path.join(OUT, `reel2-${kind}-poster2.webp`)]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', `fps=1,scale=${kind === 'wide' ? 240 : 120}:-1,tile=${kind === 'wide' ? '9x3' : '13x2'}`, '-frames:v', '1', path.join(OUT, `_reel2-${kind}.jpg`)]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(kind, (fs.statSync(out).size / 1e6).toFixed(1) + 'MB');
}
let t = 0; const timeline = CUTS.map((c) => { const e = { at: Math.round(t * 100) / 100, work: c.w }; t += c.dur; return e; });
const total = Math.round(t * 100) / 100;
fs.writeFileSync(OUT + 'reel2.json', JSON.stringify({ total, timeline }));
build('wide', 1280, 800, 25);
build('tall', 720, 1280, 26);
console.log('total', total);
