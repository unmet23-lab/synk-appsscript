#!/usr/bin/env node
/**
 * 지면 서버 — 저장소의 판정 지면(HTML)을 브라우저로 열어 보기 위한 정적 서버.
 *
 * ■ 🔴 왜 새로 짓나 (09-02)
 *   `.claude/launch.json` 의 「시안지면」이 `python -m http.server` 였는데 **이 기계에 python 이
 *   없다**(실측: 「Python was not found」). 즉 그 항목은 조용히 죽어 있었다 — 브라우저 통로가
 *   없다는 뜻이라, 지면을 구워도 «도는지»를 아무도 못 봤다.
 *   그리고 file:// 로는 대신할 수 없다: 미리보기가 정적 스냅샷으로 바꾸면서 상대 경로 그림이
 *   통째로 빠진다(같은 날 실측 — `complete:true` 인데 `naturalWidth:0`).
 *
 * ■ 규율
 *   · **읽기 전용**이다. GET 만 받고, 저장소 «밖»으로 나가는 경로는 거절한다.
 *   · 캐시를 끈다 — 지면을 다시 굽고 새로고침했는데 옛 판이 보이면 그것이 판정을 망친다.
 *
 * 쓰기: node tools/지면서버.js [포트]      (기본 8765 · `.claude/launch.json` 의 「시안지면」)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 포트 = Number(process.argv[2]) || 8765;

const 형 = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

http.createServer((요청, 답) => {
  if (요청.method !== 'GET') { 답.writeHead(405).end('GET 만 받는다'); return; }

  let 상대;
  try { 상대 = decodeURIComponent(요청.url.split('?')[0]); } catch { 답.writeHead(400).end('경로를 못 읽었다'); return; }
  const 절대 = path.join(뿌리, 상대);

  /* 🔴 저장소 밖으로는 안 나간다 — `..` 를 섞은 경로가 홈 디렉터리를 읽는 것이 이 종류
     서버의 고전적 사고다. 정규화 «뒤»에 뿌리로 시작하는지 본다(앞에 검사하면 우회된다). */
  if (!path.resolve(절대).startsWith(path.resolve(뿌리))) { 답.writeHead(403).end('저장소 밖'); return; }

  fs.stat(절대, (e, st) => {
    if (e) { 답.writeHead(404).end('없다: ' + 상대); return; }
    if (st.isDirectory()) {
      /* 디렉터리는 목록을 준다 — 어느 지면이 있는지 눈으로 고르실 수 있어야 한다. */
      const 줄 = fs.readdirSync(절대, { withFileTypes: true })
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, 'ko'))
        .map((d) => {
          const 이름 = d.name + (d.isDirectory() ? '/' : '');
          const 링크 = path.posix.join(상대.replace(/\\/g, '/'), encodeURIComponent(d.name)) + (d.isDirectory() ? '/' : '');
          return `<li><a href="${링크}">${이름}</a></li>`;
        }).join('');
      답.writeHead(200, { 'content-type': 형['.html'], 'cache-control': 'no-store' });
      답.end(`<!doctype html><meta charset="utf-8"><title>${상대}</title>`
        + '<style>body{font-family:system-ui;background:#14161a;color:#eef0f4;padding:24px}'
        + 'a{color:#f36758;text-decoration:none}a:hover{text-decoration:underline}li{margin:3px 0}</style>'
        + `<h2>${상대}</h2><ul>${줄}</ul>`);
      return;
    }
    답.writeHead(200, {
      'content-type': 형[path.extname(절대).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      /* 지면을 다시 굽고 새로고침했는데 옛 판이 보이면 판정이 통째로 헛돈다 */
      'cache-control': 'no-store, max-age=0',
    });
    fs.createReadStream(절대).pipe(답);
  });
}).listen(포트, () => {
  console.log(`지면 서버 — http://localhost:${포트}/  (뿌리 = ${뿌리})`);
  console.log('  예) http://localhost:' + 포트 + '/docs/캐릭터/마스코트_업그레이드_09-02.html');
});
