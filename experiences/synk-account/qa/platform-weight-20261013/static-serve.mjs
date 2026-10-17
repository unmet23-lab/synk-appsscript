// 두 판을 같은 조건에서 재기 위한 작은 정적 서버. 사용: node static-serve.mjs <root> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';

const [,, firstRoot, port = '4401', fallbackRoot = ''] = process.argv;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  // 앞 뿌리에 없으면 뒤 뿌리에서 찾는다(한두 파일만 바꾼 판을 잴 때).
  const file = [firstRoot, fallbackRoot].filter(Boolean).map((root) => path.join(root, decodeURIComponent(url.pathname))).find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!file) { res.writeHead(404); res.end(); return; }
  const type = types[path.extname(file)] || 'application/octet-stream';
  // GitHub Pages처럼 글자 파일은 gzip으로 보낸다.
  if (/text|json|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    const body = zlib.gzipSync(fs.readFileSync(file), { level: 6 });
    res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    res.end(body); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  // pipe()는 브라우저가 요청을 끊어도 파일을 닫지 않아, Windows에서 빌드가 그 파일을 바꾸지 못했다(rename EPERM, 10-17).
  pipeline(fs.createReadStream(file), res, () => {});
}).listen(Number(port), '127.0.0.1', () => console.log('serving', firstRoot, fallbackRoot, 'on', port));
