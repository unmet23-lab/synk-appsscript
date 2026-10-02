import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 이 PC에서만 듣는 로컬 미리보기 서버. 공통 학습 기록을 다른 게임과 이으려면 experiences/learning-hub/server.mjs(4280)로 연다.
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
const blocked = new Set(['art-source', 'qa', 'node_modules']);
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(root, '.' + pathname);
    const rel = path.relative(root, target);
    if (rel.startsWith('..') || path.isAbsolute(rel) || blocked.has(rel.split(path.sep)[0].toLowerCase())) { res.writeHead(403).end(); return; }   // Windows는 대소문자를 가리지 않는다
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const type = types[path.extname(target)];
    if (!type) { res.writeHead(404).end(); return; }
    const data = await readFile(target);
    const head = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    // 영상·소리는 범위 요청(Safari는 영상에 꼭 필요하다)
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
      if (start >= data.length || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }).end(); return; }
      const part = data.subarray(start, end + 1);
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': part.length });
      res.end(req.method === 'HEAD' ? undefined : part);
      return;
    }
    res.writeHead(200, { ...head, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 5215), '127.0.0.1', () => process.stdout.write(`입장 검사: http://127.0.0.1:${server.address().port}/\n`));
