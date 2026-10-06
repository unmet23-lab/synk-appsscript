import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readConfig } from '../synk-account/src/core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicFiles = ['index.html', 'app.css', 'app.mjs', 'core.mjs', 'saju-core.mjs', 'insights.mjs', 'account.mjs', 'account-state.mjs'];
const assets = ['synk-logo.svg', 'SUIT.woff2', 'SUIT-LICENSE.txt', 'InterTight.woff2', 'InterTight-LICENSE.txt', 'fortune-star.avif', 'slab-cream-long.webp', 'slab-blush-long.webp', 'slab-coral-long.webp', 'wide-butter.webp'];
const files = new Map([
  ['/', path.join(root, 'index.html')],
  ...publicFiles.map(name => [`/${name}`, path.join(root, name)]),
  ['/synk-account/src/core.mjs', path.join(root, '../synk-account/src/core.mjs')],
  ['/vendor/lunar-javascript-1.7.7/lunar.mjs', path.join(root, 'vendor/lunar-javascript-1.7.7/lunar.mjs')],
  ['/vendor/lunar-javascript-1.7.7/LICENSE', path.join(root, 'vendor/lunar-javascript-1.7.7/LICENSE')],
  ...assets.map(name => [`/assets/${name}`, path.join(root, 'assets', name)]),
]);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

export function createServer({ accountConfig = { version: 1 } } = {}) {
  // Only the established public configuration format is exposed. Secret keys fail validation.
  const config = readConfig(accountConfig, 'http://127.0.0.1:4299/');
  const safeConfig = { version: 1, supabaseUrl: config.supabaseUrl || '', accountApiUrl: config.accountApiUrl || '',
    supabasePublishableKey: config.supabasePublishableKey || '', portalUrl: config.portalUrl || '', clients: { platform: config.clients.platform } };
  const connections = [...new Set([config.supabaseUrl, config.accountApiUrl].filter(Boolean).map(value => new URL(value).origin))];
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' ${connections.join(' ')}; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400); res.end(); return; }
    if (url.pathname === '/account-config.json') {
      const body = JSON.stringify(safeConfig);res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);return;
    }
    const file = files.get(url.pathname);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : '찾을 수 없는 화면입니다.'); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : '화면을 읽지 못했습니다. 로컬 파일을 확인해 주세요.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let accountConfig;
  try { accountConfig = JSON.parse(await readFile(path.join(root, 'account.config.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const server = createServer({ accountConfig });
  server.on('error', error => { console.error(`무료 운세 서버: ${error.message}`); process.exitCode = 1; });
  server.listen(4299, '127.0.0.1', () => console.log('SYNK 무료 운세 http://127.0.0.1:4299/'));
}
