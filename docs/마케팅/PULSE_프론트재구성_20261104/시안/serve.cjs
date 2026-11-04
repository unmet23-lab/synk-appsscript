// 시안 묶음을 로컬에서 띄운다. 회사 서버와 같은 CSP를 걸어 인라인 스타일 실수를 바로 잡는다.
// node docs/마케팅/PULSE_프론트재구성_20261104/시안/serve.cjs [포트]
// /media/ 는 git 밖 synk-vendor/pulse-rebuild-20261104/media/ 에서 읽는다(영상은 저장소에 넣지 않는다).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname), port = Number(process.argv[2] || 4793);
const MEDIA = path.resolve(process.env.PULSE_MEDIA || path.join(require('os').homedir(), 'Documents/synk-vendor/pulse-rebuild-20261104'));
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'";
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const clean = decodeURIComponent(url.pathname);
  let file = clean.startsWith('/media/') || clean.startsWith('/before/') ? path.join(MEDIA, clean.startsWith('/media/') ? clean : clean) : path.join(root, clean);
  if (!file.startsWith(root) && !file.startsWith(MEDIA)) { res.writeHead(403); return res.end(); }
  if (file.endsWith(path.sep) || file === root) file = path.join(file, 'index.html');
  fs.stat(file, (error, stat) => {
    if (!error && stat.isDirectory()) { res.writeHead(302, { Location: clean.replace(/\/?$/, '/') + url.search }); return res.end(); }
    if (error) { res.writeHead(404); return res.end('없음'); }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP, 'Accept-Ranges': 'bytes' };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
