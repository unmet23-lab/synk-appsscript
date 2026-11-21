// 검수 묶음 캡처용 「공개 트리 서버」: 이 PC 주소로 들어온 GET을 https://synk.im 같은 경로로 받아 그대로 돌려준다.
// 검수 도구가 후보가 아는 경로(account/client.html · account/client.css)는 후보 · 앞판 바이트로 끼운다.
// 새 파일 account/client.css는 synk.im에 묻지 않는다 — 공개 전에 새 ?v= 주소를 부르면 CDN이 옛 응답을 묶는다(현장 노트 배포_공개).
// node experiences/synk-account/qa/client-a-20261121/public-proxy.mjs [포트(기본 4871)]
import http from 'node:http';

const port = Number(process.argv[2] || 4871);
const NEVER = new Set(['/account/client.css']);
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET' || NEVER.has(u.pathname)) { res.writeHead(404).end();return; }
    const r = await fetch(`https://synk.im${u.pathname}${u.search}`, { redirect: 'manual' });
    const body = Buffer.from(await r.arrayBuffer());
    const headers = { 'Cache-Control': 'no-store' };
    for (const k of ['content-type', 'location']) if (r.headers.get(k)) headers[k] = r.headers.get(k);
    res.writeHead(r.status, headers).end(body);
  } catch (e) { res.writeHead(502, { 'Content-Type': 'text/plain' }).end(String(e?.message || e)); }
}).listen(port, '127.0.0.1', () => console.log(`public proxy http://127.0.0.1:${port}/`));
