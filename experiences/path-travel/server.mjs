import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sharedAccountServer } from '../synk-account/server-shared.mjs';

const PUBLIC = new Map(['index.html', 'planner.html', 'planner.css', 'planner-ui.mjs', 'planner-origin.mjs', 'planner.mjs', 'places-v2.mjs', 'walking-router.mjs', 'planner-storage.mjs', 'planner-feedback.mjs', 'planner-account.mjs', 'planner-account-session.mjs', 'app.mjs', 'style.css', 'model.mjs', 'catalog.mjs', 'storage.mjs', 'profile.mjs', 'extractor.mjs', 'conversation.mjs', 'real-places.mjs', 'real-guide.mjs', 'real-ui.mjs', 'real-conditions.mjs', 'real-course.mjs', 'real-course-data.mjs', 'real-course-ui.mjs'].map(file => ['/' + file, new URL(file, import.meta.url)]));
PUBLIC.set('/planner-login-draft.mjs', new URL('./planner-login-draft.mjs', import.meta.url));
for (const module of ['engine', 'personalization', 'domain', 'interpretation', 'ask', 'travel', 'trail-life', 'temper-outcomes']) PUBLIC.set(`/atlas/${module}.js`, new URL(`../../atlas/${module}.js`, import.meta.url));
PUBLIC.set('/tools/lib/loom-motion.js', new URL('../../tools/lib/loom-motion.js', import.meta.url));
const ASSETS = new Set(['DMMono-Regular.ttf', 'felt-black.webp', 'felt-button.webp', 'felt-choice.webp', 'felt-selected.webp', 'InterTight-Bold.ttf', 'logo-synk.webp', 'scrapbook.css', 'sticker-search.webp', 'sticker-time.webp', 'SUIT-Variable.woff2', 'thread.webp']);
PUBLIC.set('/legacy.html', new URL('./legacy.html', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const HEADERS = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const REENTRY_HTML = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>여행 계획 열기</title><main><h1>여행 계획 열기</h1><p>이 PC의 여행 화면으로 이동하려면 아래 링크를 눌러 주세요.</p><a href="/">여행 계획 열기</a></main></html>';

export function createServer({ port = 4303, accountConfigPath = new URL('./config.json', import.meta.url), accountConfig } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('Invalid port');
  const shared = sharedAccountServer({ configPath: accountConfigPath, config: accountConfig });
  const server = http.createServer(async (req, res) => {
    await shared.ready;
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { ...HEADERS, 'Content-Security-Policy': HEADERS['Content-Security-Policy'].replace("connect-src 'self'", `connect-src ${shared.connections()}`), 'Content-Type': type });
      res.end(req.method === 'HEAD' ? undefined : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    const host = req.headers.host ?? '';
    const origin = `http://${host}`;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || Number(host.split(':')[1]) !== server.address()?.port) return send(403, { error: '이 PC의 여행 주소에서 열어 주세요.' });
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '지원하지 않는 요청이에요.' });
    let pathname, url;
    try { url = new URL(req.url, origin); pathname = decodeURIComponent(url.pathname); }
    catch { return send(400, { error: '올바르지 않은 주소예요.' }); }
    if (req.headers.origin && req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site' && !shared.allowsOAuthReturn(req, url, 'path-travel')) {
      // Extension-opened tabs can arrive cross-site. Keep them denied and let
      // the user explicitly enter the fixed local page from this same origin.
      if (req.method === 'GET' && req.headers.origin === undefined && req.headers['sec-fetch-mode'] === 'navigate'
        && req.headers['sec-fetch-dest'] === 'document' && ['/', '/index.html', '/planner.html'].includes(pathname) && !url.search && !url.hash) {
        return send(403, REENTRY_HTML, 'text/html; charset=utf-8');
      }
      return send(403, { error: '이 앱에서 직접 열어 주세요.' });
    }
    if (pathname === '/api/health') return send(200, { ok: true, product: 'path-travel', mode: 'local-real-planner-v4', city: 'seoul', cloudAI: false, booking: false, accountSync: shared.configured('path-travel') });
    const common = await shared.read(pathname === '/config.json' ? '/api/account-config' : pathname);
    if (common) return send(200, common.body, common.type);
    let file = PUBLIC.get(pathname === '/' ? '/index.html' : pathname);
    if (!file && pathname.startsWith('/assets/') && ASSETS.has(pathname.slice(8))) file = new URL('.' + pathname, import.meta.url);
    if (!file && (pathname === '/assets/jongno-walking.json' || /^\/assets\/places\/[a-z0-9-]+\.jpg$/.test(pathname) || /^\/assets\/felt\/[a-z0-9-]+\.webp$/.test(pathname))) file = new URL('.' + pathname, import.meta.url);
    if (!file) return send(404, { error: '찾을 수 없는 파일이에요.' });
    try { return send(200, await readFile(file), MIME[path.extname(file.pathname)]); }
    catch { return send(404, { error: '찾을 수 없는 파일이에요.' }); }
  });
  server.start = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(server); }); });
  server.stop = async () => { server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve)); };
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--port');
  const server = createServer({ port: index < 0 ? 4303 : Number(process.argv[index + 1]) });
  await server.start();
  console.log(`SYNK PATH 개인화 여행: http://127.0.0.1:${server.address().port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.stop(); process.exit(0); });
}
