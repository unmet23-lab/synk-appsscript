import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initialState, restoreState, reduceCommand, snapshot, advanceLivingState, TownError } from './core.mjs';
import { initialPresence, updatePresence, commandPresence, PRESENCE_LEASE_MS } from './presence.mjs';

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
export function createStore({ file, save, now = () => Date.now(), lifeEnabled = true } = {}) {
  let state = initialState({ lifeEnabled }), loadError = null, presence = initialPresence(), walkClock = null;
  if (file && fs.existsSync(file)) {
    try { state = restoreState(JSON.parse(fs.readFileSync(file, 'utf8')), { lifeEnabled }); }
    catch { loadError = new TownError('invalid-save', '저장 기록을 읽지 못했어요. 원본을 보존하고 확인해 주세요.', 503); }
  }
  const persist = save || (file ? next => atomicSave(file, next) : () => {});
  const current = () => ({ ...snapshot(state), capabilities: { life: !!state.life && lifeEnabled, day: !!state.day && lifeEnabled } });
  function commit(next) {
    try { persist(next); }
    catch { throw new TownError('save-failed', '저장하지 못했어요. 진행은 그대로예요. 다시 시도해 주세요.', 503); }
    state = next;
  }
  // Only a host timestamp survives for the 30-minute logical-visit boundary;
  // foreground leases and elapsed execution time never survive a restart.
  if (state.lifeHost?.lastForegroundAt != null) presence.lastActiveAt = state.lifeHost.lastForegroundAt;
  presence.fence = state.lifeHost?.fence || 0;
  return {
    read() { if (loadError) throw loadError; return current(); },
    presence(input) {
      if (loadError) throw loadError;
      if (!state.life || !lifeEnabled) throw new TownError('life-unavailable', '이웃 생활을 열 수 없어요.', 403);
      if (typeof input?.foreground !== 'boolean') throw new TownError('invalid-presence', '이 창의 연결 상태를 다시 확인해 주세요.');
      let pulse;
      try { pulse = updatePresence(presence, { ...input, foreground: input?.foreground === true && state.phase !== 'away' }, now()); }
      catch { throw new TownError('invalid-presence', '이 창의 연결 상태를 다시 확인해 주세요.'); }
      const result = advanceLivingState(state, pulse.context);
      const lifeHost = { lastForegroundAt: input.foreground && state.phase !== 'away'
        ? pulse.next.at : state.lifeHost?.lastForegroundAt ?? null, fence: pulse.next.fence };
      if (JSON.stringify(lifeHost) !== JSON.stringify(state.lifeHost)) {
        result.state.lifeHost = lifeHost;
        if (!result.changed) result.state.revision++;
        result.changed = true;
      }
      // Clock, delivery owner and world facts publish together after durability.
      if (result.changed) commit(result.state);
      const previousOwner = presence.surfaces[presence.owner];
      if (pulse.next.owner !== presence.owner || pulse.next.fence !== presence.fence || !pulse.context.canRun
        || previousOwner && pulse.next.at - previousOwner.at >= PRESENCE_LEASE_MS) walkClock = null;
      presence = pulse.next;
      return { ...current(), presence: pulse.receipt };
    },
    execute(command) {
      if (loadError) throw loadError;
      let host = { enabled: lifeEnabled, canContact: false, elapsedMs: 0,
        surfaceId: presence.owner, fence: presence.fence, nowMs: Math.max(now(), presence.at ?? 0),
        surface: presence.surfaces[presence.owner]?.surface || 'classic' };
      // An already committed request can be recovered after a lease expired.
      // The reducer still compares the entire signed request before returning.
      const recorded = state.commands.some(item => item.id === command?.id);
      if (!recorded && typeof command?.type === 'string' && /^(LIFE_|DAY_|BAZAAR_|SUPPORT_)/.test(command.type)) {
        host = commandPresence(presence, command.payload, Math.max(now(), presence.at ?? 0));
        if (!host) throw new TownError('stale-surface', '이 창의 연결 상태를 다시 확인해 주세요.', 409);
        host.ownerSurfaceId = presence.owner;
      }
      if (!recorded && command?.type === 'DAY_WALK') {
        const elapsed = walkClock && walkClock.surfaceId === host.surfaceId && walkClock.fence === host.fence
          ? host.nowMs - walkClock.at : 0;
        host.walkElapsedMs = elapsed >= 0 ? Math.min(250, elapsed) : 0;
      }
      const result = reduceCommand(state, command, host);
      if (!result.duplicate) {
        commit(result.state);
        if (['DAY_WALK_ENABLE', 'DAY_WALK'].includes(command.type)) walkClock = { at: host.nowMs, surfaceId: host.surfaceId, fence: host.fence };
        if (['DAY_WALK_DISABLE', 'RESET', 'LEAVE'].includes(command.type)) walkClock = null;
        if (command.type === 'RESET') presence = initialPresence();
        else if (command.type === 'LEAVE') presence = { ...presence, at: Math.max(now(), presence.at ?? 0),
          surfaces: {}, owner: null, fence: presence.fence + 1 };
      }
      return { ...current(), duplicate: result.duplicate };
    },
  };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm' };
function fileFor(route, previewEnabled) {
  if (route === '/' || route === '/index.html') return path.join(root, 'index.html');
  if (route === '/style.css') return path.join(root, 'style.css');
  if (previewEnabled && route === '/assets/felt-coral.webp') return path.join(repo, 'experiences/synk-world-home/assets/felt-coral.webp');
  if (/^\/assets\/(?:[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_-]+\.(webp|png|jpg|svg|woff2|ttf)$/.test(route)) return path.join(root, route.slice(1));
  if (!previewEnabled) return null;
  // Baked district comparison only (?district=); v20 never requests these.
  if (/^\/assets\/district\/[a-z0-9-]+\.(?:glb|json)$/.test(route)) return path.join(root, route.slice(1));
  if (/^\/rendering\/basis\/basis_transcoder\.(?:js|wasm)$/.test(route)) return path.join(root, route.slice(1));
  if (['/day.html', '/day-app.mjs', '/day-style.css', '/day-scene.mjs', '/day-character.mjs', '/day-residents.mjs', '/day-environment.mjs', '/day-materials.mjs', '/day-rendering.mjs', '/day-district.mjs', '/walk.mjs', '/walk-controls.mjs', '/town-layout.mjs'].includes(route)) return path.join(root, route.slice(1));
  if (/^\/rendering\/(?:Pass|RenderPass|EffectComposer|ShaderPass|MaskPass|OutputPass|CopyShader|OutputShader|SSAOPass|SSAOShader|SimplexNoise|GLTFLoader|BufferGeometryUtils|KTX2Loader|WorkerPool|ktx-parse\.module|zstddec\.module|ColorSpaces|meshopt_decoder\.module)\.js$/.test(route)) return path.join(root, route.slice(1));
  if (route === '/avatar-v3.mjs') return path.join(repo, 'experiences/synk-world-home/avatar-v3.mjs');
  if (route === '/avatar-textiles.mjs') return path.join(repo, 'experiences/synk-world-home/avatar-textiles.mjs');
  if (['/avatar-wardrobe.mjs', '/wardrobe-catalog.mjs', '/wardrobe-garments-v8.mjs'].includes(route)) return path.join(repo, 'experiences/synk-world-home', path.basename(route));
  if (['/scene-assets/three.module.js', '/scene-assets/three.core.js'].includes(route)) return path.join(repo, 'experiences/synk-world-home/scene-assets', path.basename(route));
  if (['/day-assets/three.module.js', '/day-assets/three.core.js', '/day-assets/THREE-LICENSE.txt'].includes(route))
    return path.join(repo, 'experiences/synk-world-home/scene-assets', path.basename(route));
  if (['azure-sky-v3.jpg', 'azure-sky-v3-mobile.jpg', 'terrain-normal.jpg', 'cliff-normal.jpg'].some(file => route === `/day-assets/${file}`))
    return path.join(repo, 'experiences/synk-world-home/scene-assets/graphics-v2', path.basename(route));
  if (route === '/day-assets/felt-coral.webp') return path.join(repo, 'experiences/synk-world-home/assets/felt-coral.webp');
  if (['/preview.html', '/app.mjs', '/life-ui.mjs', '/linked-client.mjs', '/understanding.mjs', '/understanding-ui.mjs'].includes(route)) return path.join(root, route.slice(1));
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
    // Baked districts (?district=, day-district.mjs) need three's KTX2 transcoder and
    // meshopt decoder: WebAssembly ('wasm-unsafe-eval'), the Basis transcoder's
    // Emscripten glue builds functions from strings ('unsafe-eval'), it runs in a
    // blob: worker, and GLTFLoader hands images to the loaders as blob: URLs
    // (10-18: with the old policy every baked set failed back to v20; QA had
    // opened pages with bypassCSP). Scripts still load from this origin only.
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob:; font-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
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
        if (!['/api/preview/command', '/api/preview/presence'].includes(route)) return json(res, 404, { error: 'not-found' });
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
        return json(res, 200, route.endsWith('/presence') ? store.presence(command) : store.execute(command));
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
  server.listen(port, '127.0.0.1', () => console.log(`SYNK TOWN ${previewEnabled ? 'developer fixture' : 'locked entry'}: http://127.0.0.1:${port}${previewEnabled ? '/day.html' : '/'}`));
}
