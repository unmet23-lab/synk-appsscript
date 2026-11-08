#!/usr/bin/env node
// synk.im 「개인화 엔진이 붙으면」 시안 미리 보기 서버(2026-11-08).
// 지금 원고 빌드(dist) 쪽에 시안 구역을 끼워 실제 쪽 안에서 보인다. 공개본은 건드리지 않는다.
//   /                       비교 쪽(index.html)
//   /page/<home|atlas|lab>?안=a|b|공개   그 쪽 + 시안 구역
//   /시안/…                  이 폴더
//   그 밖의 주소             dist 파일, 없으면 synk.im으로 넘긴다(쿼리는 떼고 — 공개 전에 새 ?v= 주소를 CDN에 묻히지 않는다)
// 쓰기: node docs/디자인/synk.im_개인화면_20261108/시안/serve.cjs [포트=4797]   (SYNK_SITE_DIST로 빌드 폴더를 바꾼다)
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const here = __dirname;
const dist = process.env.SYNK_SITE_DIST || 'C:/Users/q1212/Documents/SYNK-worktrees/site-learner-20261108/SYNK-website/dist';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };
const send = (res, body, type = 'text/html; charset=utf-8', code = 200) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
const pages = { home: 'index.html', atlas: 'atlas/index.html', lab: 'lab/index.html' };
// 쪽마다 시안 구역을 끼우는 자리. 그 줄 바로 앞에 넣는다.
const slots = { home: '<section class="section" id="atlas"', atlas: '<section class="section" id="engines"', lab: '<section class="section" id="online"' };
function page(name, variant) {
  let html = fs.readFileSync(path.join(dist, pages[name]), 'utf8');
  if (variant === '공개') return html;
  const file = path.join(here, `${variant}-${name}.html`);
  if (!fs.existsSync(file)) return html;
  const slot = slots[name];
  if (!html.includes(slot)) throw new Error(`끼울 자리가 없다: ${name} ${slot}`);
  html = html.replace(slot, fs.readFileSync(file, 'utf8') + '\n' + slot);
  const stamp = Date.now();
  return html.replace('</head>', `<link rel="stylesheet" href="/시안/learner.css?t=${stamp}">\n<script type="module" src="/시안/learner.js?t=${stamp}"></script>\n</head>`);
}
const port = Number(process.argv[2] || 4797);
http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    if (p === '/') return send(res, fs.readFileSync(path.join(here, 'index.html')));
    const m = /^\/page\/(home|atlas|lab)\/?$/.exec(p);
    if (m) return send(res, page(m[1], u.searchParams.get('안') || 'a'));
    if (p.startsWith('/시안/')) {
      const f = path.join(here, p.slice('/시안/'.length));
      if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, '없음', 'text/plain; charset=utf-8', 404);
      return send(res, fs.readFileSync(f), types[path.extname(f).toLowerCase()] || 'application/octet-stream');
    }
    let f = path.join(dist, p);
    if (f.startsWith(path.normalize(dist)) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (f.startsWith(path.normalize(dist)) && fs.existsSync(f)) return send(res, fs.readFileSync(f), types[path.extname(f).toLowerCase()] || 'application/octet-stream');
    res.writeHead(302, { location: 'https://synk.im' + encodeURI(p) }); res.end();
  } catch (e) { send(res, String(e), 'text/plain; charset=utf-8', 500); }
}).listen(port, '127.0.0.1', () => console.log(`시안: http://127.0.0.1:${port}/`));
