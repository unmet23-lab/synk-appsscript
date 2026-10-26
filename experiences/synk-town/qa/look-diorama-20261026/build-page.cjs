// capture.cjs 결과(report.json + 캡처)로 지금 화면과 시안을 나란히 보는 비교 페이지를 만든다.
//   node experiences/synk-town/qa/look-diorama-20261026/build-page.cjs <capture 폴더> [<걷기 capture 폴더>] [--bytes <capture 폴더>] [--out <dir>]
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !['--out', '--bytes'].includes(all[i - 1])), outAt = process.argv.indexOf('--out');
const [captureDir, walkDir] = args.map(a => path.resolve(a));
const out = path.resolve(outAt > 0 ? process.argv[outAt + 1] : path.join(captureDir, '../page'));
const rows = [captureDir, walkDir].filter(Boolean).flatMap(dir => JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).rows.map(r => ({ ...r, dir })));
const gpu = JSON.parse(fs.readFileSync(path.join(captureDir, 'report.json'), 'utf8')).gpu;
fs.mkdirSync(path.join(out, 'img'), { recursive: true });

// Smaller copies for the page (PC 960 wide, phone 420 wide).
const shots = rows.filter(r => r.file && !r.walk && !r.failed);
const resize = shots.map(r => [path.join(r.dir, r.file), path.join(out, 'img', r.file), r.device === 'phone' ? 420 : 960]);
execFileSync('python', ['-c', `import sys,json
from PIL import Image
for src,dst,w in json.loads(sys.argv[1]):
    im=Image.open(src).convert('RGB'); h=round(im.height*w/im.width); im.resize((w,h),Image.LANCZOS).save(dst,'JPEG',quality=82,optimize=True,progressive=True)`, JSON.stringify(resize)]);

const pick = r => r && !r.failed ? {
  file: r.walk ? null : `img/${r.file}`,
  sceneFps: r.fps ? Math.min(60, Math.round(1000 / r.fps.frameIntervalMs.p50)) : null,
  sceneFpsLow: r.fps ? Math.min(60, Math.round(1000 / r.fps.frameIntervalMs.p95)) : null,
  cpu: r.fps?.cpuRenderMs?.p50 ?? null, draw: r.metrics.drawCalls, tri: r.metrics.triangles, readyMs: r.readyMs,
  art: r.bytes.art, total: r.bytes.total, sun: r.metrics.light?.sunMode,
  texBytes: r.metrics.baked ? r.metrics.baked.textureBytes : r.metrics.look ? r.metrics.look.textureBytes : null,
  firstArt: r.metrics.baked ? r.metrics.baked.downloadBytes : null, laterArt: r.metrics.baked?.deferred?.bytes ?? null,
} : null;
const data = {};
for (const r of rows) data[r.id] = pick(r);
// --bytes <capture 폴더>: network totals re-measured after blob: textures were excluded (the first runs counted them).
const bytesAt = process.argv.indexOf('--bytes');
if (bytesAt > 0) for (const r of JSON.parse(fs.readFileSync(path.join(path.resolve(process.argv[bytesAt + 1]), 'report.json'), 'utf8')).rows)
  for (const id of Object.keys(data)) if (data[id] && id.startsWith(`${r.look}-${r.device}-`)) data[id].total = r.bytes.total;
const html = fs.readFileSync(path.join(__dirname, 'page.html.tmpl'), 'utf8').replace('/*DATA*/null', JSON.stringify({ rows: data, gpu, when: new Date().toISOString().slice(0, 10) }));
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`${out}\\index.html · 그림 ${shots.length}장`);
