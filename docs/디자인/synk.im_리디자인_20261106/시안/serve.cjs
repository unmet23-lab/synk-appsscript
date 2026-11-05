#!/usr/bin/env node
// synk.im 리디자인 시안 미리 보기 서버(2026-11-06). 시안 쪽(이 폴더)과 재료 셋을 한 주소로 낸다.
//   /           이 폴더(index.html 비교 · pulse.html · shift.html)
//   /pa/        공개 PULSE 고객 앱 재료(작품 영상 · 글꼴) — 저장소 docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets
//   /media/     쇼릴(git 밖) — synk-vendor/pulse-rebuild-20261104/media/works
//   /assets/    synk.im 회사 쪽 그림(모델 사진 등) — 원고 빌드 dist/assets(환경 SYNK_SITE_DIST, 없으면 공개 synk.im으로 넘긴다)
// 쓰기: node docs/디자인/synk.im_리디자인_20261106/시안/serve.cjs [포트=4796]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const here = __dirname;
const repo = path.resolve(here, '..', '..', '..', '..');
const docs = path.join(repo, '..');
const roots = {
  '/pa/': path.join(repo, 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company', 'public', 'pulse-app', 'assets'),
  '/media/': path.join(docs, 'synk-vendor', 'pulse-rebuild-20261104', 'media', 'works'),
  '/assets/': process.env.SYNK_SITE_DIST ? path.join(process.env.SYNK_SITE_DIST, 'assets') : null,
};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
function send(res, f, req) {
  const size = fs.statSync(f).size;
  res.setHeader('content-type', types[path.extname(f).toLowerCase()] || 'application/octet-stream');
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('cache-control', 'no-store');
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${start}-${end}/${size}`);
    res.setHeader('content-length', end - start + 1);
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.setHeader('content-length', size);
  fs.createReadStream(f).pipe(res);
}
const port = Number(process.argv[2] || 4796);
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const [pre, dir] of Object.entries(roots)) {
    if (!p.startsWith(pre)) continue;
    if (!dir) { res.statusCode = 302; res.setHeader('location', 'https://synk.im' + p); return res.end(); }
    const f = path.join(dir, p.slice(pre.length));
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
    return send(res, f, req);
  }
  let f = path.join(here, p === '/' ? 'index.html' : p);
  if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('없음'); }
  send(res, f, req);
}).listen(port, '127.0.0.1', () => console.log(`시안: http://127.0.0.1:${port}/`));
