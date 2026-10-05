import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 이 PC에서만 듣는 한글 단계 미리보기 서버(node experiences/hangul-stage/server.mjs → http://127.0.0.1:5240/).
// 다른 게임·WORLD와 같은 학습 기록을 쓰려면 같은 출처에서 열어야 한다: 공통 서버(experiences/learning-hub/server.mjs, 4280)에 이 폴더를 더한 뒤 그 주소로 연다.
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const blocked = new Set(['qa', 'node_modules']);
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(root, '.' + pathname);
    const rel = path.relative(root, target);
    if (rel.startsWith('..') || path.isAbsolute(rel) || blocked.has(rel.split(path.sep)[0].toLowerCase())) { res.writeHead(403).end(); return; } // Windows는 대소문자를 가리지 않는다
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const type = types[path.extname(target)];
    if (!type || /\.test\.mjs$/.test(target)) { res.writeHead(404).end(); return; }
    const data = await readFile(target);
    const head = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    // 노래의 범위 요청: 범위를 받지 않으면 브라우저가 소리를 옮길 수 없는 것으로 본다(사파리·iOS는 206이 있어야 재생한다 — 학습 허브 서버와 같은 처리).
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
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
server.listen(Number(process.env.PORT || 5240), '127.0.0.1', () => process.stdout.write(`한글 단계: http://127.0.0.1:${server.address().port}/\n`));
