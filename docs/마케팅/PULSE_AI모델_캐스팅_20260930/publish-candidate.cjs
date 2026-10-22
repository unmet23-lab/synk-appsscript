// 홈페이지판 공개 후보를 모은다 — site/index.html이 부르는 파일만 <후보 폴더>/pulse/casting/에 복사한다(10-22 synk.im 첫 공개).
// 사용: node build-site.cjs → node publish-candidate.cjs <후보 폴더> → node tools/공개.js 올리기 --원본 <후보 폴더> pulse/casting --전부
// site/에는 claude.ai 판(artifact.html·계정별 사본)과 옛 폴더가 같이 있어서 폴더째 올리지 않는다.
const fs = require('node:fs'), path = require('node:path');
const site = path.join(__dirname, 'site');
const root = process.argv[2];
if (!root) { console.error('사용: node publish-candidate.cjs <후보 폴더>'); process.exit(2); }
const dst = path.join(root, 'pulse', 'casting');
fs.rmSync(root, { recursive: true, force: true });
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const refs = new Set((html.match(/"(?:img|voice|video)\/[^"]+"/g) || []).map((x) => x.slice(1, -1)));
for (const m of html.matchAll(/(?:"|\(|=|casting\/)(assets\/[^"')?\s]+)/g)) refs.add(m[1]); // 글꼴·로고·파비콘·og.jpg(og는 절대 주소)
refs.add('index.html');
let n = 0, bytes = 0;
const bad = [];
for (const r of [...refs].sort()) {
  const src = path.join(site, r);
  if (!fs.existsSync(src)) { bad.push('없음 ' + r); continue; }
  if (fs.statSync(src).isDirectory()) continue; // 글꼴 라이선스 주석의 (assets/fonts)
  if (r.split('/').some((s) => s.startsWith('_') || s.startsWith('.'))) bad.push('밑줄·점(Jekyll이 뺀다) ' + r);
  const d = path.join(dst, r);
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.copyFileSync(src, d);
  n++; bytes += fs.statSync(src).size;
}
console.log('후보 파일', n, (bytes / 1048576).toFixed(1) + 'MB', bad.length ? '문제 ' + bad.join(', ') : '문제 없음', '→', dst);
if (bad.length) process.exit(1);
