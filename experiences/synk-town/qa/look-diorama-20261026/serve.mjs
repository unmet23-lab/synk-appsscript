// 디오라마 그래픽 시안(2026-10-26)을 진짜 Town 화면에 얹어 보는 로컬 서버.
// 제품 파일은 그대로 두고, 이 서버가 /day-district.mjs 요청에만 이 폴더의 shim을 내준다 —
// ?district=diorama면 shim이 diorama.mjs로 마을을 다시 그리고, 그 밖의 값은 원래 모듈에 넘긴다.
// 주민 · 걷기 · 시계 · 시간대 빛과 비 · UI · 저장은 모두 원래 Town 그대로다.
//   node experiences/synk-town/qa/look-diorama-20261026/serve.mjs   → http://127.0.0.1:4296/day.html?play=walk&district=diorama
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const town = path.resolve(here, '../..');
const ROUTES = {
  '/day-district.mjs': path.join(here, 'district-shim.mjs'),
  '/day-district.real.mjs': path.join(town, 'day-district.mjs'),
  '/look/diorama.mjs': path.join(here, 'diorama.mjs'),
  '/look/diorama-parts.mjs': path.join(here, 'diorama-parts.mjs'),
};

/** Wraps a Town server: the look's own files first, everything else as the Town server answers it. */
export function withLook(server) {
  const [handler] = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    const route = new URL(req.url, 'http://x').pathname, file = ROUTES[route];
    if (!file) return handler(req, res);
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(fs.readFileSync(file));
  });
  return server;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { createServer } = await import(pathToFileURL(path.join(town, 'server.mjs')).href);
  const port = Number(process.env.SYNK_LOOK_PORT || 4296);
  withLook(createServer({ previewEnabled: true })).listen(port, '127.0.0.1', () => {
    console.log(`시안: http://127.0.0.1:${port}/day.html?play=walk&district=diorama`);
    console.log(`지금 화면: http://127.0.0.1:${port}/day.html?play=walk&district=townwide-merged`);
  });
}
