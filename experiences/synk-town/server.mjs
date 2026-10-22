import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initialState, restoreState, reduceCommand, snapshot, stepLiving, assertState, foldWorld, FOLD_LIMITS, TownError } from './core.mjs';
import { initialPresence, commandPresence, initialLease, pulseLease, boundaryPresence } from './presence.mjs';
import { settle } from './town/settle.mjs';

/** A screen may open a safe boundary at most once in this long (vertical slice §14-3). */
export const BOUNDARY_GAP_MS = 20000;
/** Receipts the world itself keeps, and the movement receipts the store keeps (talk's limits). */
export const COMMAND_WINDOW = 32, WALK_RECEIPTS = 512;

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
// Observation runs keep their own save: a shifted clock must never leave
// future presence stamps in the everyday developer save.
export function defaultSavePath(observe = null) {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SYNK', 'town-preview', observe?.active ? 'ft10-observe.json' : 'ft10-v1.json');
}
/** Observation switches for playtests (vertical slice design §15-6). Local
 * preview only; the talk runtime has no such input.
 *   --clock +1d | -3h30m | 2026-10-23T19:00+09:00   shift the town clock or start at a set instant
 *   --card C4[,R2]                                  raise these cards at once (read by the card runtime, W5) */
export function parseObservation(argv, { realNow = Date.now() } = {}) {
  const value = name => {
    const at = argv.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
    if (at < 0) return null;
    const inline = argv[at].slice(name.length + 1);
    const given = argv[at] === name ? argv[at + 1] : inline;
    if (!given || given.startsWith('--')) throw new RangeError(`${name} 뒤에 값을 적어 주세요.`);
    return given;
  };
  const clockArg = value('--clock'), cardArg = value('--card');
  let clock = null;
  if (clockArg !== null) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(clockArg)) {
      const atMs = Date.parse(clockArg);
      if (!Number.isSafeInteger(atMs)) throw new RangeError('--clock 시각을 읽지 못했어요.');
      clock = { atMs, startedAtMs: realNow, label: clockArg };
    } else if (/^[+-](?:\d+[dhms])+$/.test(clockArg)) {
      const unit = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
      const offsetMs = (clockArg[0] === '-' ? -1 : 1)
        * [...clockArg.matchAll(/(\d+)([dhms])/g)].reduce((sum, [, n, u]) => sum + Number(n) * unit[u], 0);
      if (!Number.isSafeInteger(offsetMs)) throw new RangeError('--clock 값이 너무 커요.');
      clock = { offsetMs, label: clockArg };
    } else throw new RangeError('--clock은 +1d·-3h30m 같은 꼴이나 2026-10-23T19:00+09:00 같은 시각이에요.');
  }
  const cards = cardArg === null ? [] : [...new Set(cardArg.split(','))];
  if (cards.some(id => !/^[CWR][1-6]$/.test(id))) throw new RangeError('--card는 C1~C6·W1~W6·R1~R6 가운데에서 골라요.');
  const label = [clock && `시계 ${clock.label}`, cards.length && `카드 ${cards.join('·')}`].filter(Boolean).join(' · ');
  return { active: !!clock || cards.length > 0, clock, cards, label };
}
/** The host clock a store runs on under the observation switches. */
export function observationClock(observe, realNow = () => Date.now()) {
  const clock = observe?.clock;
  if (!clock) return realNow;
  if (clock.offsetMs !== undefined) return () => realNow() + clock.offsetMs;
  return () => clock.atMs + Math.max(0, realNow() - clock.startedAtMs);
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
 * publishing its new state. A bad save is blocked, never silently re-created.
 * Four requests (vertical slice §14-3): pulse moves only the lease; boundary settles the world
 * and may issue a contact; read settles and saves what changed; execute settles, applies and
 * saves together. presence is the old pulse — pulse, a boundary when every window is safe, and a
 * read, published together only after the save. peek answers errors without settling.
 * The world keeps no log and only the newest command receipts (W2 plan D7, talk's rule): a commit
 * moves the lines a step appended to the event branch and every receipt to the store's receipts,
 * and folds the world to its limits (fold: false keeps every row — tests compare with it). An
 * older command still answers from its receipt. Until the branches have their own files (D9) the
 * save holds the world with this epoch's lines and every receipt inline, the old one-file shape;
 * answers show them as state.events and state.commands (F11). */
export function createStore({ file, save, now = () => Date.now(), lifeEnabled = true, observe = null, fold = FOLD_LIMITS } = {}) {
  let state = initialState({ lifeEnabled }), log = [], loadError = null;
  const receipts = new Map(), walks = [];
  function remember(records) {
    for (const record of records) {
      if (receipts.has(record.id)) continue;
      receipts.set(record.id, record);
      // Movement receipts retire in a rolling window, as talk's do; a retired step's
      // expectedRevision can no longer run against the newer world.
      if (/"type":"DAY_WALK/.test(record.signature) && walks.push(record.id) > WALK_RECEIPTS) receipts.delete(walks.shift());
    }
  }
  if (file && fs.existsSync(file)) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved?.trail && Array.isArray(saved.events)) {
        // The index is the record; the lines beside it are the branch.
        state = restoreState({ ...saved, events: [] }, { lifeEnabled });
        log = saved.events.filter(event => event?.seq > state.trail.archivedBelow && event.seq <= state.trail.seq);
      } else {
        const restored = restoreState(saved, { lifeEnabled });
        log = restored.events; state = { ...restored, events: [] };
      }
      remember(state.commands); state = { ...state, commands: state.commands.slice(-COMMAND_WINDOW) };
      if (fold) state = foldWorld(state, fold);
    } catch { loadError = new TownError('invalid-save', '저장 기록을 읽지 못했어요. 원본을 보존하고 확인해 주세요.', 503); }
  }
  const persist = save || (file ? next => atomicSave(file, next) : null);
  const current = () => {
    const shown = snapshot(state);
    shown.state.events = log.slice(); shown.state.commands = [...receipts.values()];
    return { ...shown, capabilities: { life: !!state.life && lifeEnabled, day: !!state.day && lifeEnabled } };
  };
  function commit(next) {
    let world = { ...next, events: [], commands: next.commands.slice(-COMMAND_WINDOW), writeSeq: (state.writeSeq ?? 0) + 1 };
    if (fold) world = foldWorld(world, fold);
    // A reset starts a new epoch: the branch's earlier lines are archived, never shown again.
    const kept = world.trail.archivedBelow > state.trail.archivedBelow ? [] : log, lines = next.events;
    const fresh = next.commands.filter(record => !receipts.has(record.id));
    try { if (persist) persist({ ...world, events: [...kept, ...lines], commands: [...receipts.values(), ...fresh] }); }
    catch { throw new TownError('save-failed', '저장하지 못했어요. 진행은 그대로예요. 다시 시도해 주세요.', 503); }
    state = world; log = kept; log.push(...lines); remember(fresh);
  }
  // Only a host timestamp survives for the 30-minute logical-visit boundary;
  // foreground leases and unsettled play time never survive a restart.
  let lease = initialLease({ uMs: state.settledU ?? 0, lastForegroundAt: state.lifeHost?.lastForegroundAt ?? null,
    presence: { ...initialPresence(), lastActiveAt: state.lifeHost?.lastForegroundAt ?? null, fence: state.lifeHost?.fence || 0 } });
  const living = () => !!state.life && lifeEnabled;
  function requireLife(input) {
    if (loadError) throw loadError;
    if (!living()) throw new TownError('life-unavailable', '이웃 생활을 열 수 없어요.', 403);
    if (typeof input?.foreground !== 'boolean') throw new TownError('invalid-presence', '이 창의 연결 상태를 다시 확인해 주세요.');
  }
  function pulseOf(input, at) {
    try { return pulseLease(lease, input, at, { away: state.phase === 'away', settledU: state.settledU }); }
    catch { throw new TownError('invalid-presence', '이 창의 연결 상태를 다시 확인해 주세요.'); }
  }
  /** The world settled to a lease, with the host stamp a pulse leaves; null when nothing changed. */
  function settledTo(next, { nowMs, canContact = false, touch = false }) {
    if (!living()) return null;
    let { state: world, changed } = settle(state, next, { step: stepLiving, check: assertState, nowMs, canContact, touch });
    const lifeHost = { lastForegroundAt: next.lastForegroundAt, fence: next.presence.fence };
    if (next.presence.at !== null && JSON.stringify(lifeHost) !== JSON.stringify(world.lifeHost ?? null)) {
      world = { ...world, lifeHost }; changed = true;
    }
    return changed ? world : null;
  }
  const hostNow = () => Math.max(now(), lease.presence.at ?? 0);
  return {
    observation: observe,
    /** Sizes for benches and tests: the world as saved, and the two branches beside it. */
    stats() { return { worldBytes: Buffer.byteLength(JSON.stringify(state)), lines: log.length, receipts: receipts.size }; },
    peek() { if (loadError) throw loadError; return current(); },
    read() {
      if (loadError) throw loadError;
      const world = settledTo(lease, { nowMs: hostNow() });
      if (world) commit(world);
      return current();
    },
    pulse(input) {
      requireLife(input);
      const at = now(), pulse = pulseOf(input, at);
      lease = pulse.lease;
      return { presence: pulse.receipt, serverNow: at, worldSeq: state.writeSeq };
    },
    boundary(input) {
      if (loadError) throw loadError;
      if (!living()) throw new TownError('life-unavailable', '이웃 생활을 열 수 없어요.', 403);
      const at = hostNow(), holder = boundaryPresence(lease.presence, input, at);
      if (!holder) throw new TownError('stale-surface', '이 창의 연결 상태를 다시 확인해 주세요.', 409);
      if (lease.boundaryAt !== null && at - lease.boundaryAt < BOUNDARY_GAP_MS) return { issued: null, throttled: true, worldSeq: state.writeSeq };
      const before = state.life.contacts.length, world = settledTo(lease, { nowMs: at, canContact: holder.canContact, touch: true });
      if (world) commit(world);
      lease = { ...lease, boundaryAt: at };
      const issued = state.life.contacts.length > before ? state.life.contacts.at(-1) : null;
      return { issued: issued && { id: issued.id, contactKey: issued.contactKey }, worldSeq: state.writeSeq };
    },
    presence(input) {
      requireLife(input);
      const at = now(), pulse = pulseOf(input, at);
      // Clock, delivery owner and world facts publish together after durability.
      const world = settledTo(pulse.lease, { nowMs: at, canContact: pulse.context.canContact, touch: true });
      if (world) commit(world);
      lease = pulse.lease;
      return { ...current(), presence: pulse.receipt, worldSeq: state.writeSeq };
    },
    execute(command) {
      if (loadError) throw loadError;
      const at = hostNow(), presence = lease.presence;
      let host = { enabled: lifeEnabled, canContact: false, elapsedMs: 0,
        surfaceId: presence.owner, fence: presence.fence, nowMs: at,
        surface: presence.surfaces[presence.owner]?.surface || 'classic' };
      // An already committed request can be recovered after a lease expired.
      // The reducer still compares the entire signed request before returning;
      // one older than the world's window is compared with its receipt.
      const receipt = receipts.get(command?.id), recorded = !!receipt;
      const base = recorded && !state.commands.some(item => item.id === command.id) ? { ...state, commands: [receipt] } : state;
      if (!recorded && typeof command?.type === 'string' && /^(LIFE_|DAY_|BAZAAR_|SUPPORT_)/.test(command.type)) {
        host = commandPresence(presence, command.payload, at);
        if (!host) throw new TownError('stale-surface', '이 창의 연결 상태를 다시 확인해 주세요.', 409);
        host.ownerSurfaceId = presence.owner;
      }
      if (!recorded && command?.type === 'DAY_WALK') {
        const walk = lease.walkClock;
        const elapsed = walk && walk.surfaceId === host.surfaceId && walk.fence === host.fence ? host.nowMs - walk.at : 0;
        host.walkElapsedMs = elapsed >= 0 ? Math.min(250, elapsed) : 0;
      }
      // A command settles first and is saved with what the settlement changed (§14-3).
      const result = reduceCommand((!recorded && settledTo(lease, { nowMs: at })) || base, command, host);
      if (!result.duplicate) {
        commit(result.state);
        if (['DAY_WALK_ENABLE', 'DAY_WALK'].includes(command.type)) lease = { ...lease, walkClock: { at: host.nowMs, surfaceId: host.surfaceId, fence: host.fence } };
        if (['DAY_WALK_DISABLE', 'RESET', 'LEAVE'].includes(command.type)) lease = { ...lease, walkClock: null };
        if (command.type === 'RESET') lease = initialLease({ uMs: state.settledU });
        else if (command.type === 'LEAVE') lease = { ...lease, presence: { ...lease.presence, at: Math.max(now(), lease.presence.at ?? 0),
          surfaces: {}, owner: null, fence: lease.presence.fence + 1 } };
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
  // The town runtime layer the browser shares with the host (vertical slice §2-5): modules only, never data sources.
  if (/^\/town\/[a-z0-9-]+(?:\.gen)?\.mjs$/.test(route)) return path.join(root, route.slice(1));
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
        const operation = { '/api/preview/command': 'execute', '/api/preview/presence': 'presence',
          '/api/preview/pulse': 'pulse', '/api/preview/boundary': 'boundary' }[route];
        if (!operation) return json(res, 404, { error: 'not-found' });
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
        return json(res, 200, store[operation](command));
      } catch (error) {
        let current = {};
        // An error answer shows the world as it is; it never settles or saves.
        try { current = (store.peek || store.read).call(store); } catch { /* Preserve corrupt save, fail closed. */ }
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
  let observe;
  try { observe = parseObservation(process.argv.slice(2)); }
  catch (error) { console.error(`관찰 스위치: ${error.message}`); process.exit(2); }
  if (observe.active && !previewEnabled) { console.error('관찰 스위치는 --preview와 함께만 써요.'); process.exit(2); }
  const store = createStore({ file: defaultSavePath(observe), now: observationClock(observe), observe });
  const server = createServer({ previewEnabled, store });
  server.on('error', error => { console.error(`Town server: ${error.code || 'unavailable'}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`SYNK TOWN ${previewEnabled ? 'developer fixture' : 'locked entry'}: http://127.0.0.1:${port}${previewEnabled ? '/day.html' : '/'}`);
    if (observe.active) console.log(`관찰 스위치: ${observe.label} · 저장 ${defaultSavePath(observe)}`);
  });
}
