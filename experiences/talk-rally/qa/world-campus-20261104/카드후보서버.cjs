'use strict';
// 앱 카드 공개 후보를 지금 공개본 위에 얹어 띄운다(2026-11-04). 후보에 있는 파일은 후보 판으로, 나머지는 synk.im에서 받아 그대로 낸다 — 카드 검수 캡처와 공개 직전 손님 길 확인용.
//   node experiences/talk-rally/qa/world-campus-20261104/카드후보서버.cjs <후보 폴더> [포트]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const DIR = path.resolve(process.argv[2] || ''), PORT = Number(process.argv[3] || 0);
if (!fs.existsSync(path.join(DIR, '후보.json'))) throw Error('후보 폴더가 아니다: ' + DIR);
const TYPE = { '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(DIR, rel.endsWith('/') ? `${rel}index.html` : rel);
  if (rel && file.startsWith(DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': TYPE[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(file));
    return;
  }
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const up = await fetch(`https://synk.im${req.url}`, { method: req.method, headers: { accept: req.headers.accept || '*/*', 'content-type': req.headers['content-type'] || '' }, body: chunks.length ? Buffer.concat(chunks) : undefined, redirect: 'manual' });
    const head = {}; for (const [k, v] of up.headers) if (!/^(content-encoding|content-length|transfer-encoding|connection|strict-transport-security|content-security-policy)$/i.test(k)) head[k] = v;
    if (head.location) head.location = head.location.replace(/^https:\/\/synk\.im/, '');
    res.writeHead(up.status, head);
    res.end(Buffer.from(await up.arrayBuffer()));
  } catch (error) { res.writeHead(502); res.end(String(error)); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/world/`));
