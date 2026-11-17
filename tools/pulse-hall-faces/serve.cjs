// 정적 미리 보기 서버(폴더 주소는 index.html, 영상 구간 요청 받음): node tools/pulse-hall-faces/serve.cjs <SYNK-website dist 폴더> <포트> [바꿔 낼 pulse-v12.css]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.argv[2]) + path.sep, port = +process.argv[3] || 4391;
const over = process.argv[4] ? { '/assets/v10/pulse-v12.css': path.resolve(process.argv[4]) } : {};
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.mp3':'audio/mpeg','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  let t = over[p] || path.resolve(root, '.' + p + (p.endsWith('/') ? 'index.html' : ''));
  if (!over[p] && !t.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(t, (e, st) => {
    if (!e && st.isDirectory()) t = path.join(t, 'index.html');
    fs.readFile(t, (err, data) => {
      if (err) { res.writeHead(404).end('Not found'); return; }
      const range = req.headers.range;
      const type = mime[path.extname(t)] || 'application/octet-stream';
      if (range && /^bytes=/.test(range)) {
        const [a, b] = range.slice(6).split('-'); const s = +a || 0, en = b ? +b : data.length - 1;
        res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${s}-${en}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': en - s + 1, 'Cache-Control': 'no-cache'}).end(data.subarray(s, en + 1));
        return;
      }
      res.writeHead(200, {'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'}).end(data);
    });
  });
}).listen(port, '127.0.0.1', () => console.log('serve ' + root + ' on ' + port));
