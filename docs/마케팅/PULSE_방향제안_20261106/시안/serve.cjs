// 방향 제안 시안을 로컬에서 띄운다. 회사 서버와 같은 CSP를 걸어 인라인 스타일 실수를 바로 잡는다.
// node docs/마케팅/PULSE_방향제안_20261106/시안/serve.cjs [포트]
// /assets/ 는 git 밖 synk-vendor/pulse-direction-20261106/assets/ → 고객 앱 assets/ → assets/request/ 순서로 찾는다.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname), port = Number(process.argv[2] || 4794);
const APP = path.resolve(root, '../../온라인마케팅지도/engagement/company/public/pulse-app/assets');
const GENERATED = path.join(require('os').homedir(), 'Documents/synk-vendor/pulse-direction-20261106/assets');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src 'self'";
const find = (clean) => {
  if (!clean.startsWith('/assets/')) return path.join(root, clean === '/' ? 'index.html' : clean);
  const name = path.basename(clean);
  return [GENERATED, APP, path.join(APP, 'request')].map((dir) => path.join(dir, name)).find((file) => fs.existsSync(file)) || '';
};
http.createServer((req, res) => {
  const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname), file = find(clean);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('없음'); }
  const stat = fs.statSync(file), headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP, 'Accept-Ranges': 'bytes' };
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
