// 시안 묶음을 로컬에서 띄운다(회사 서버와 같은 CSP를 걸어 인라인 스타일 실수를 바로 잡는다).
// node docs/마케팅/PULSE_의뢰흐름_20261104/시안/serve.cjs <묶음 폴더> [포트]
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.'), port = Number(process.argv[3] || 4791);
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (file.endsWith(path.sep) || file === root) file = path.join(file, 'index.html');
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); return res.end('없음'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self'" });
    res.end(bytes);
  });
}).listen(port, () => console.log('http://127.0.0.1:' + port));
