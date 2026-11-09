#!/usr/bin/env node
// synk.im 홈 재구성 시안 미리 보기 서버(2026-11-09). 이 폴더를 내고, 없는 주소는 공개 synk.im으로 넘긴다(글꼴 · 질문창 자료 · 플랫폼 파일).
//   /pa/   공개 PULSE 고객 앱 재료의 명조 글꼴 — synk.im의 명조는 지금 쓰는 글자만 남긴 판이라 새 글에 글자가 없다. 실제 공개 때는 font-subset.py가 다시 줄인다.
// 쓰기: node docs/디자인/synk.im_홈재구성_20261109/시안/serve.cjs [포트=4797]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const here = __dirname;
const repo = path.resolve(here, '..', '..', '..', '..');
const pa = path.join(repo, 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company', 'public', 'pulse-app', 'assets');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function send(res, f) {
  res.setHeader('content-type', types[path.extname(f).toLowerCase()] || 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  fs.createReadStream(f).pipe(res);
}
const port = Number(process.argv[2] || 4797);
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  if (p.startsWith('/pa/')) {
    const f = path.join(pa, p.slice(4));
    if (f.startsWith(pa) && fs.existsSync(f)) return send(res, f);
  }
  const f = path.join(here, p === '/' ? 'index.html' : p);
  if (f.startsWith(here) && fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, f);
  res.statusCode = 302;
  res.setHeader('location', 'https://synk.im' + u.pathname + u.search);
  res.end();
}).listen(port, '127.0.0.1', () => console.log(`시안: http://127.0.0.1:${port}/`));
