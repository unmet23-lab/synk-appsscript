#!/usr/bin/env node
// synk.im 뼈대 시안 미리 보기 서버(2026-11-10). 이 폴더를 내고, 없는 주소는 공개 synk.im에서 받아 그대로 건넨다(같은 출처라 글꼴 · 모듈 · 질문창 자료가 막히지 않는다).
//   /pa/  공개 PULSE 고객 앱 재료의 명조 글꼴(11-09 시안과 같은 길)
// 쓰기: node docs/디자인/synk.im_뼈대시안_20261110/시안/serve.cjs [포트=4798]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const here = __dirname;
const repo = path.resolve(here, '..', '..', '..', '..');
const pa = path.join(repo, 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company', 'public', 'pulse-app', 'assets');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const cache = new Map(); // 공개본 재료는 한 번 받아 둔다(영상은 받아 두지 않고 넘긴다)
function send(res, f) {
  res.setHeader('content-type', types[path.extname(f).toLowerCase()] || 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  fs.createReadStream(f).pipe(res);
}
const port = Number(process.argv[2] || 4798);
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  if (p.startsWith('/pa/')) {
    const f = path.join(pa, p.slice(4));
    if (f.startsWith(pa) && fs.existsSync(f)) return send(res, f);
  }
  const f = path.join(here, p === '/' ? 'index.html' : p);
  if (f.startsWith(here) && fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, f);
  const far = 'https://synk.im' + u.pathname + u.search;
  if (/\.(mp4|webm|exe|dmg|zip)$/i.test(p) || req.headers.range) { res.statusCode = 302; res.setHeader('location', far); return res.end(); }
  try {
    let hit = cache.get(far);
    if (!hit) {
      const r = await fetch(far, { redirect: 'follow' });
      hit = { status: r.status, type: r.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await r.arrayBuffer()) };
      if (r.ok && hit.body.length < 8e6) cache.set(far, hit);
    }
    res.statusCode = hit.status; res.setHeader('content-type', hit.type); res.setHeader('cache-control', 'no-store'); res.end(hit.body);
  } catch (e) { res.statusCode = 502; res.end(String(e).slice(0, 200)); }
}).listen(port, '127.0.0.1', () => console.log(`뼈대 시안: http://127.0.0.1:${port}/`));
