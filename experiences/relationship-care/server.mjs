import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readConfig } from '../synk-account/src/core.mjs';
import { isOAuthReturnNavigation } from '../synk-account/oauth-return.mjs';

const require = createRequire(import.meta.url);
const { createLocalTranscriber } = require('../../tools/patent-studio/local-transcriber.cjs');
const ROOT = fileURLToPath(new URL('.', import.meta.url));
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const FILES = new Set(['index.html', 'style.css', 'app.mjs', 'model.mjs', 'lunar.mjs', 'care-features.mjs', 'care-sync.mjs', 'account.mjs', 'care-account-view.mjs', 'care-focus.mjs', 'care-context.mjs', 'care-push.mjs', 'care-sw.js', 'manifest.webmanifest', 'care-planner.mjs', 'care-personalization.mjs', 'care-support.mjs', 'care-followup.js', 'care-outcomes.mjs', 'memory-card.mjs', 'memory-theme.mjs']);
const ENGINE_FILES = new Set(['domain.js', 'ask.js', 'vellum-expression.js', 'temper-outcomes.js']);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const HEADERS = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac', 'video/mp4', 'video/webm', 'application/octet-stream']);

function failure(status, message) { return Object.assign(new Error(message), { status }); }
async function readAudio(req) {
  const size = Number(req.headers['content-length']);
  if (size > MAX_AUDIO_BYTES) throw failure(413, '녹음은 20MB 이하로 골라 주세요.');
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_AUDIO_BYTES) throw failure(413, '녹음은 20MB 이하로 골라 주세요.');
    chunks.push(chunk);
  }
  if (!bytes) throw failure(400, '녹음 파일이 비어 있어요.');
  return Buffer.concat(chunks);
}

/** A loopback-only development service. Never stores audio or contacts on disk. */
export function createServer({ port = 4296, transcriber = createLocalTranscriber(), root = ROOT, accountConfigPath = process.env.SYNK_CARE_ACCOUNT_CONFIG || path.resolve(ROOT, '../synk-account/config.json') } = {}) {
  let busy = false;
  let publicConfig = { version: 1, clients: {} }, accountOrigins = [];
  const configReady = readFile(accountConfigPath, 'utf8').then(raw => {
    const value = JSON.parse(raw), checked = readConfig(value, `http://127.0.0.1:${port}/`);
    // Only the vetted public contract can reach the renderer. No arbitrary config fields or server keys.
    publicConfig = Object.fromEntries(['version', 'supabaseUrl', 'supabasePublishableKey', 'accountApiUrl', 'portalUrl', 'learningUrl', 'messengerUrl', 'clients', 'authorizationClients'].filter(key => checked[key] !== undefined).map(key => [key, checked[key]]));
    accountOrigins = [...new Set([checked.supabaseUrl, checked.accountApiUrl].filter(Boolean).map(value => new URL(value).origin))];
  }).catch(() => { publicConfig = { version: 1, clients: {} }; });
  const server = http.createServer(async (req, res) => {
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      if (res.destroyed || res.writableEnded) return;
      const headers = { ...HEADERS, 'Content-Type': type };
      if (accountOrigins.length) headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace("connect-src 'self'", `connect-src 'self' ${accountOrigins.join(' ')}`);
      res.writeHead(status, headers);
      res.end(req.method === 'HEAD' ? undefined : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || Number(host.split(':')[1]) !== server.address()?.port) return send(403, { error: '이 PC의 앱 주소에서 열어 주세요.' });
    const origin = `http://${host}`;
    if (req.headers.origin && req.headers.origin !== origin) return send(403, { error: '다른 페이지에서 자료를 보낼 수 없어요.' });
    let url, pathname;
    try { url = new URL(req.url, origin); pathname = decodeURIComponent(url.pathname); } catch { return send(400, { error: '올바르지 않은 주소예요.' }); }
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      await configReady;
      // Only load the registered OAuth return document; the client still validates state and PKCE.
      if (!isOAuthReturnNavigation(req, url, publicConfig, 'care')) return send(403, { error: '이 앱에서 직접 열어 주세요.' });
    }
    if (req.method === 'POST' && pathname === '/api/transcribe') {
      // Custom header prevents ambient form requests; no cross-origin CORS permission is granted.
      if (req.headers['x-synk-care'] !== '1' || req.headers.origin !== origin) return send(403, { error: '앱의 받아쓰기 버튼으로 요청해 주세요.' });
      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!AUDIO_TYPES.has(mimeType)) return send(415, { error: 'MP3, M4A, WAV 등 음성 파일을 골라 주세요.' });
      if (busy) { req.resume(); return send(409, { error: '이전 녹음의 받아쓰기를 마친 뒤 다시 시도해 주세요.' }); }
      busy = true; let bytes;
      try {
        if (!(await transcriber.status()).available) { req.resume(); return send(503, { error: '이 PC의 받아쓰기가 준비되지 않았어요. 녹취 텍스트를 직접 넣을 수 있어요.' }); }
        bytes = await readAudio(req);
        const result = await transcriber.transcribe({ bytes, mimeType });
        send(200, {
          text: String(result.text || ''), language: result.raw?.response?.language || 'ko',
          durationSeconds: result.raw?.response?.durationSeconds ?? null,
          mode: 'local-whisper', speakerSeparation: false, needsReview: true,
        });
      } catch (error) {
        send(error.status || 422, { error: error.status ? error.message : '받아쓰기를 완료하지 못했어요. 짧은 녹음으로 다시 시도하거나 녹취 텍스트를 넣어 주세요.' });
      } finally { bytes?.fill(0); bytes = null; busy = false; }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '지원하지 않는 요청이에요.' });
    if (pathname === '/api/account-config') { await configReady; return send(200, publicConfig); }
    if (pathname === '/account-core.mjs') return send(200, await readFile(path.resolve(ROOT, '../synk-account/src/core.mjs')), MIME['.mjs']);
    if (['/synk-account/src/core.mjs', '/synk-account/src/product-account.mjs', '/synk-account/src/document-sync.mjs'].includes(pathname)) return send(200, await readFile(path.resolve(ROOT, '..', pathname.slice(1))), MIME['.mjs']);
    if (pathname.startsWith('/atlas/') && ENGINE_FILES.has(pathname.slice('/atlas/'.length))) {
      try { return send(200, await readFile(path.resolve(ROOT, '../../atlas', pathname.slice('/atlas/'.length))), MIME['.js']); }
      catch { return send(404, { error: '찾을 수 없는 파일이에요.' }); }
    }
    if (pathname === '/api/health') return send(200, { ok: true, product: 'care', mode: 'local-mvp', data: 'browser-only', transcription: 'local-only' });
    if (pathname === '/api/capabilities') {
      try {
        const status = await transcriber.status();
        return send(200, { transcription: { available: !!status.available, reason: status.reason, mode: 'local-whisper', maxBytes: MAX_AUDIO_BYTES, speakerSeparation: false }, cloudAI: false, accountSync: false, backgroundNotifications: false });
      } catch { return send(200, { transcription: { available: false, reason: 'local_runtime_missing' }, cloudAI: false }); }
    }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    const asset = /^assets\/[A-Za-z0-9_.-]+\.(webp|png|svg|woff2|ttf)$/.test(file);
    if (!FILES.has(file) && !asset) return send(404, { error: '찾을 수 없는 파일이에요.' });
    try { send(200, await readFile(path.join(root, file)), MIME[path.extname(file)]); }
    catch { send(404, { error: '찾을 수 없는 파일이에요.' }); }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  server.start = async () => { await configReady; return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(server); });
  }); };
  server.stop = async () => {
    await transcriber.close();
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  };
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port'), port = i < 0 ? 4296 : Number(process.argv[i + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const server = createServer({ port }); await server.start();
  console.log(`SYNK 플레저: http://127.0.0.1:${server.address().port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.stop(); process.exit(0); });
}
