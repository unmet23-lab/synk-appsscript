import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initialState, restoreState, reduceCommand, snapshot, TownError } from './core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
export function defaultSavePath() {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SYNK', 'town-preview', 'ft10-v1.json');
}
function atomicSave(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(temporary, 'w');
  try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
/** One process owns this developer fixture. Commit to durable storage before
 * publishing its new state. A bad save is blocked, never silently re-created. */
export function createStore({ file, save } = {}) {
  let state = initialState(), loadError = null;
  if (file && fs.existsSync(file)) {
    try { state = restoreState(JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch { loadError = new TownError('invalid-save', '저장 기록을 읽지 못했어요. 원본을 보존하고 확인해 주세요.', 503); }
  }
  const persist = save || (file ? next => atomicSave(file, next) : () => {});
  return {
    read() { if (loadError) throw loadError; return snapshot(state); },
    execute(command) {
      if (loadError) throw loadError;
      const result = reduceCommand(state, command);
      if (!result.duplicate) {
        try { persist(result.state); }
        catch { throw new TownError('save-failed', '저장하지 못했어요. 진행은 그대로예요. 다시 시도해 주세요.', 503); }
        state = result.state;
      }
      return { ...snapshot(state), duplicate: result.duplicate };
    },
  };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
function fileFor(route, previewEnabled) {
  if (route === '/' || route === '/index.html') return path.join(root, 'index.html');
  if (route === '/style.css') return path.join(root, 'style.css');
  if (/^\/assets\/(?:[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_-]+\.(webp|png|jpg|svg|woff2|ttf)$/.test(route)) return path.join(root, route.slice(1));
  if (!previewEnabled) return null;
  if (['/preview.html', '/app.mjs'].includes(route)) return path.join(root, route.slice(1));
  if (route === '/engine/loom-life.js') return path.join(repo, 'tools/lib/loom-life.js');
  if (route === '/engine/loom-motion.js') return path.join(repo, 'tools/lib/loom-motion.js');
  return null;
}
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
export function createServer({ previewEnabled = false, store = createStore({ file: defaultSavePath() }) } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host)) return json(res, 403, { error: 'local-preview-only' });
    let route;
    try {
      const raw = decodeURIComponent(req.url.split('?')[0]);
      if (raw.includes('..') || raw.includes('\\') || raw.includes('\0')) throw new Error();
      route = new URL(req.url, `http://${req.headers.host}`).pathname;
    } catch { return json(res, 400, { error: 'invalid-path' }); }
    if (route === '/api/entry' && req.method === 'GET') return json(res, 200,
      { allowed: false, reason: 'verified-town-access-unavailable', requires: 'TOPIK1+ verified by trusted account service' });
    if (route.startsWith('/api/preview/')) {
      if (!previewEnabled) return json(res, 403, { error: 'preview-disabled' });
      try {
        if (route === '/api/preview/state' && req.method === 'GET') return json(res, 200, store.read());
        if (route !== '/api/preview/command') return json(res, 404, { error: 'not-found' });
        if (req.method !== 'POST') return json(res, 405, { error: 'method-not-allowed' });
        if (req.headers.origin !== `http://${req.headers.host}`) return json(res, 403, { error: 'same-origin-required' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'json-required' });
        let body = '', size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 24576) return json(res, 413, { error: 'body-too-large' });
          body += chunk;
        }
        let command;
        try { command = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid-json' }); }
        return json(res, 200, store.execute(command));
      } catch (error) {
        let current = {};
        try { current = store.read(); } catch { /* Preserve corrupt save, fail closed. */ }
        return json(res, error instanceof TownError ? error.status : 503,
          { error: error.code || 'unavailable', message: error instanceof TownError ? error.message : '기록을 확인할 수 없어요.', ...current });
      }
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'method-not-allowed' });
    const file = fileFor(route, previewEnabled);
    if (!file || !fs.existsSync(file)) return json(res, 404, { error: 'not-found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const previewEnabled = process.argv.includes('--preview');
  const port = Number(process.env.SYNK_TOWN_PORT || 4288);
  const server = createServer({ previewEnabled });
  server.on('error', error => { console.error(`Town server: ${error.code || 'unavailable'}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`SYNK TOWN ${previewEnabled ? 'developer fixture' : 'locked entry'}: http://127.0.0.1:${port}${previewEnabled ? '/preview.html' : '/'}`));
}
