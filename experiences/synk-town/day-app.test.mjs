import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer, createStore } from './server.mjs';

// The real day-app in Node against the real town host (an in-memory store behind the preview HTTP server): a
// small DOM built from day.html, the real walk controls, a renderer stand-in whose painted serial the test
// sets (the frame evidence) and a hand-cranked clock, display frame and timers. It checks what the window
// sends — walk packets and acknowledgements — not how the scene looks.
// SYNK_TOWN_SOURCE_OVERRIDE=<dir> serves same-named modules of this folder from <dir> (before/after and
// mutation evidence); SYNK_DAY_APP_TRACE=<dir> writes each scenario's requests and per-frame walk there.
const here = path.dirname(fileURLToPath(import.meta.url)), dayURL = pathToFileURL(path.join(here, 'day-app.mjs')).href;
const override = process.env.SYNK_TOWN_SOURCE_OVERRIDE ? path.resolve(process.env.SYNK_TOWN_SOURCE_OVERRIDE) : null;
const traceDir = process.env.SYNK_DAY_APP_TRACE ? path.resolve(process.env.SYNK_DAY_APP_TRACE) : null;
const sceneStub = 'data:text/javascript,' + encodeURIComponent('export const createDayScene = (canvas, options) => globalThis.__dayHarness.renderer(options);');
registerHooks({
  resolve: (specifier, context, next) => specifier === './day-scene.mjs' && context.parentURL?.split('?')[0] === dayURL ? { url: sceneStub, shortCircuit: true } : next(specifier, context),
  load(url, context, next) {
    const file = override && url.startsWith('file:') ? fileURLToPath(url.split('?')[0]) : null, swap = file && path.join(override, path.basename(file));
    if (swap && path.dirname(file) === here && fs.existsSync(swap)) return { format: 'module', source: fs.readFileSync(swap, 'utf8'), shortCircuit: true };
    return next(url, context);
  },
});
const LoomLife = createRequire(import.meta.url)('../../tools/lib/loom-life.js');
const markup = fs.readFileSync(path.join(here, 'day.html'), 'utf8');
const BASE = Date.UTC(2026, 9, 24, 3, 0, 0), FRAME = 1000 / 60;

// --- A DOM just large enough for day-app and walk-controls --------------------------------------------
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function target() {
  const listeners = {};
  return { addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
    dispatchEvent(event) { for (const fn of [...(listeners[event.type] || [])]) fn.call(this, event); return true; } };
}
const event = (type, extra = {}) => ({ type, repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
class Element {
  constructor(tag, doc) {
    Object.assign(this, target()); this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.parentNode = null; this.attrs = new Map(); this.classes = new Set();
    this.dataset = {}; this.hidden = false; this.disabled = false; this.open = false; this.textContent = ''; this.value = ''; this.type = '';
    this.style = { setProperty(name, value) { this[name] = String(value); }, removeProperty(name) { delete this[name]; } };
    const classes = this.classes;
    this.classList = { add: (...n) => n.forEach(c => classes.add(c)), remove: (...n) => n.forEach(c => classes.delete(c)), contains: c => classes.has(c),
      toggle: (c, force = !classes.has(c)) => { if (force) classes.add(c); else classes.delete(c); return force; } };
  }
  get id() { return this.attrs.get('id') || ''; }
  set id(value) { this.attrs.set('id', String(value)); }
  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes.clear(); for (const c of String(value).split(/\s+/).filter(Boolean)) this.classes.add(c); }
  setAttribute(name, value) {
    value = String(value);
    if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = value;
    else if (name === 'class') this.className = value;
    else if (['hidden', 'disabled', 'open'].includes(name)) this[name] = true;
    else this.attrs.set(name, value);
  }
  getAttribute(name) { return name.startsWith('data-') ? this.dataset[camel(name.slice(5))] ?? null : ['hidden', 'disabled', 'open'].includes(name) ? (this[name] ? '' : null) : this.attrs.get(name) ?? null; }
  removeAttribute(name) { if (['hidden', 'disabled', 'open'].includes(name)) this[name] = false; else this.attrs.delete(name); }
  append(...nodes) { for (const node of nodes) if (typeof node !== 'string') { node.parentNode = this; this.children.push(node); } }
  // The tea board (W8, day-tea.mjs) builds its controls with these.
  prepend(...nodes) { const own = nodes.filter(node => typeof node !== 'string'); for (const node of own) node.parentNode = this; this.children.unshift(...own); }
  remove() { if (this.parentNode) { const siblings = this.parentNode.children; siblings.splice(siblings.indexOf(this), 1); this.parentNode = null; } }
  get firstChild() { return this.children[0] || null; }
  get isConnected() { let node = this; while (node.parentNode) node = node.parentNode; return node.tagName === '#ROOT'; }
  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
  get offsetTop() { return this.getBoundingClientRect().top; }
  get clientWidth() { return this.getBoundingClientRect().width; }
  get clientHeight() { return this.getBoundingClientRect().height; }
  before(...nodes) { if (!this.parentNode) return; const siblings = this.parentNode.children; for (const node of nodes) node.parentNode = this.parentNode; siblings.splice(siblings.indexOf(this), 0, ...nodes); }
  closest(selector) { for (let node = this; node; node = node.parentNode) if (node.matches(selector)) return node; return null; }
  contains(other) { for (let node = other; node; node = node.parentNode) if (node === this) return true; return false; }
  replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...nodes); }
  click() { if (!this.disabled) this.dispatchEvent(event('click', { target: this })); }
  focus() { this.doc.activeElement = this; }
  scrollIntoView() {}
  setPointerCapture() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  getBoundingClientRect() { return this.doc.rectOf(this); }
  matches(selector) { return selector.split(',').some(part => matchOne(this, part.trim())); }
  querySelectorAll(selector) { const all = []; const walk = node => node.children.forEach(child => { if (child.matches(selector)) all.push(child); walk(child); }); walk(this); return all; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function matchOne(el, selector) {
  const [, tag, rest] = selector.match(/^([a-z]*)(.*)$/i);
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  for (const [token] of rest.matchAll(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:not\(:disabled\)/g)) {
    if (token[0] === '#' && el.id !== token.slice(1)) return false;
    if (token[0] === '.' && !el.classes.has(token.slice(1))) return false;
    if (token === ':not(:disabled)' && el.disabled) return false;
    if (token[0] === '[') { const [, name, value] = token.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/); const actual = el.getAttribute(name); if (actual === null || value !== undefined && actual !== value) return false; }
  }
  return true;
}
function createDocument() {
  const doc = Object.assign(target(), { hidden: false, focused: true, fonts: { ready: Promise.resolve() }, images: [], rects: new Map() });
  const root = new Element('#root', doc); let current = root;
  for (const m of markup.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g)) {
    if (m[5] !== undefined) { if (current !== root && m[5].trim()) current.textContent += m[5]; continue; }
    const [, closing, tag, attrs, selfClosing] = m;
    if (closing) { let node = current; while (node !== root && node.tagName !== tag.toUpperCase()) node = node.parentNode; current = node === root ? root : node.parentNode; continue; }
    const el = new Element(tag, doc);
    for (const a of attrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) el.setAttribute(a[1], a[2] ?? '');
    current.append(el);
    if (!selfClosing && !['meta', 'link', 'img', 'input', 'br', 'path'].includes(tag.toLowerCase())) current = el;
  }
  const ids = new Map(root.querySelectorAll('[id]').map(el => [el.id, el]));
  Object.assign(doc, { body: root.querySelector('body'), head: root.querySelector('head'), getElementById: id => ids.get(id) || root.querySelector('#' + id), createElement: tag => new Element(tag, doc),
    createTextNode: value => Object.assign(new Element('#text', doc), { textContent: String(value) }),
    querySelectorAll: selector => root.querySelectorAll(selector), querySelector: selector => root.querySelector(selector), hasFocus: () => doc.focused,
    // A hidden element (or one in a hidden parent or closed dialog) has no box; others fill a 100×40 box unless a test moves it.
    rectOf(el) {
      for (let node = el; node; node = node.parentNode) if (node.hidden || node.tagName === 'DIALOG' && !node.open) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const r = doc.rects.get(el.id) || { left: 0, top: 0, width: 100, height: 40 };
      return { ...r, right: r.left + r.width, bottom: r.top + r.height };
    } });
  doc.activeElement = doc.body;
  return doc;
}

// --- One scenario: a fresh store, server, window and app instance ------------------------------------
let scenarios = 0;
async function boot(t, { setup } = {}) {
  let clock = 0, offset = 0, uuid = 0, raf = null, painting = true;
  const store = createStore({ lifeEnabled: true, now: () => BASE + offset + Math.floor(clock) });
  // Another window prepares the town (a seat, an episode), then leaves it: the app's first pulse takes the lease.
  if (setup) {
    const flags = { surfaceId: 'setup-window', surface: 'day', foreground: true, safe: false };
    let receipt = store.pulse(flags).presence, n = 0;
    const send = (type, payload = {}) => store.execute({ id: `setup-${++n}`, type, expectedRevision: store.peek().state.revision,
      payload: { ...(/^(DAY_|LIFE_|BAZAAR_|SUPPORT_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
    setup({ send, pulse(ms) { offset += ms; receipt = store.pulse(flags).presence; },
      ack() { const { state, view } = store.read(); send('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, activity: state.activity || 'seat',
        worldRevision: state.worldRevision, mode: 'static', appliedStepIds: view.committedStepIds, visible: true, assetsReady: true }); } });
    offset += 1000; store.pulse({ ...flags, foreground: false });
  }
  const server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, realFetch = globalThis.fetch;
  const doc = createDocument(), win = target(), media = [], intervals = [], gates = [], faults = [], live = new Set();
  const trace = { requests: [], frames: [] }, renderer = { requested: 1, painted: 1, ready: true, poses: 0 };
  async function fetch(input, init = {}) {
    const url = new URL(input, origin), body = init.body ? JSON.parse(init.body) : null;
    const entry = { at: Math.round(clock * 1000) / 1000, path: url.pathname.replace('/api/preview/', ''), body };
    trace.requests.push(entry);
    let park; entry.parked = new Promise(resolve => { park = resolve; });
    const run = (async () => {
      const fault = faults.find(f => f.match(entry));
      let status, text;
      if (fault?.once) faults.splice(faults.indexOf(fault), 1);
      if (fault && !fault.through) { status = fault.status; text = JSON.stringify(typeof fault.body === 'function' ? fault.body() : fault.body); }
      else {
        const gate = gates.find(g => g.before && g.match(entry));
        if (gate) { entry.held = true; park(); await gate.opened; entry.held = false; }
        const response = await realFetch(url, { ...init, headers: { ...init.headers, ...(init.method === 'POST' ? { Origin: origin } : {}) } });
        status = response.status; text = await response.text();
        if (fault) { status = fault.status; text = JSON.stringify(typeof fault.body === 'function' ? fault.body() : fault.body); }
      }
      entry.status = status;
      try { const answer = JSON.parse(text); if (answer?.state) entry.revision = answer.state.revision; if (answer?.presence) entry.presence = answer.presence; } catch {}
      const gate = gates.find(g => !g.before && g.match(entry));
      if (gate) { entry.held = true; park(); await gate.opened; entry.held = false; }
      return new Response(text, { status, headers: { 'Content-Type': 'application/json' } });
    })();
    live.add(entry); run.finally(() => { live.delete(entry); park(); }).catch(() => {});
    return run;
  }
  /** Lets every request that is not held finish, and what its answer starts. */
  async function settle() {
    for (let quiet = 0; quiet < 4;) {
      await new Promise(resolve => setImmediate(resolve));
      const moving = [...live].filter(entry => !entry.held);
      if (moving.length) { quiet = 0; await Promise.all(moving.map(entry => entry.parked)); } else quiet++;
    }
  }
  const globals = {
    document: doc, window: win, innerWidth: 1440, innerHeight: 900, LoomLife, fetch,
    addEventListener: win.addEventListener, removeEventListener: win.removeEventListener,
    // W7b uses Window's event aliases. This single-window walking test exercises its no-channel fallback.
    BroadcastChannel: undefined,
    location: { search: '', hostname: '127.0.0.1', origin, reload() { trace.reloads = (trace.reloads || 0) + 1; } },
    matchMedia: query => { const m = { media: query, matches: false, ...target() }; media.push(m); return m; },
    performance: { now: () => clock },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
    requestAnimationFrame: fn => { raf = fn; return 1; }, cancelAnimationFrame: () => { raf = null; },
    setInterval: (fn, ms) => { intervals.push({ fn, ms, next: clock + ms }); return intervals.length; }, clearInterval: () => {},
    sessionStorage: new Map(), localStorage: { getItem: () => null, setItem() {} },
    __dayHarness: { renderer: () => ({
      render() { return ++renderer.requested; }, stats: () => ({ ready: renderer.ready, renderedSerial: renderer.painted }),
      setPlayerPose() { renderer.poses++; }, setResidents() {}, setLight() {}, setAppearance() {}, dispose() {}, prepareInitialAssets() {}, resize() {} }) },
  };
  globals.sessionStorage.getItem = key => globals.sessionStorage.get(key) ?? null;
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  let closed = false;
  async function close() {
    if (closed) return; closed = true;
    for (const gate of gates.splice(0)) gate.open();
    await settle();
    win.dispatchEvent(event('pagehide'));
    await new Promise(resolve => server.close(resolve));
    for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    delete globalThis.SYNKTownDay;
    if (traceDir) { fs.mkdirSync(traceDir, { recursive: true }); fs.writeFileSync(path.join(traceDir, `${t.name.replace(/[^\w가-힣-]+/g, '_')}.json`), JSON.stringify(trace, null, 1)); }
  }
  t.after(close);
  await import(`${dayURL}?scenario=${++scenarios}`);
  await settle();
  const app = {
    store, doc, window: win, trace, renderer, close, settle,
    get clock() { return clock; },
    metrics: () => globalThis.SYNKTownDay.metrics(), walk: () => globalThis.SYNKTownDay.metrics().walk, snapshot: () => globalThis.SYNKTownDay.snapshot(),
    /** Whether the renderer stand-in paints each frame what it was asked to draw (off: a stalled GPU). */
    set painting(value) { painting = value; },
    /** One display frame: due timers, then the renderer's paint of what it was asked last frame, then day-app's frame. */
    async frame(dt = FRAME) {
      clock += dt;
      for (let due; (due = intervals.filter(i => i.next <= clock).sort((a, b) => a.next - b.next)[0]);) { due.next += due.ms; due.fn(); }
      if (painting) renderer.painted = renderer.requested;
      const fn = raf; raf = null; fn?.(clock);
      trace.frames.push({ at: Math.round(clock * 1000) / 1000, walk: app.walk() });
      await settle();
    },
    async run(ms, dt = FRAME) { const end = clock + ms - 1e-9; while (clock < end) await app.frame(Math.min(dt, end - clock + 1e-9)); },
    key(code, down = true) { win.dispatchEvent(event(down ? 'keydown' : 'keyup', { code, key: code })); },
    /** Holds answers matching match (after the host handled them, or before it sees them) until opened. */
    hold(match, { before = false } = {}) {
      let open; const gate = { match, before, opened: new Promise(resolve => { open = resolve; }) };
      gate.open = () => { gates.splice(gates.indexOf(gate), 1); open(); };
      gates.push(gate); return { open: async () => { if (gates.includes(gate)) gate.open(); await settle(); }, get held() { return [...live].filter(e => e.held && match(e)).length; } };
    },
    /** Answers the next request matching match with this status and body (a function: built then) instead of the host's
     * answer — through: the host still handles it, only its answer is lost. */
    fail(match, status, body, { once = true, through = false } = {}) { faults.push({ match, status, body, once, through }); },
    sent: type => trace.requests.filter(r => r.path === 'command' && r.body.type === type),
    hide(hidden = true) { doc.hidden = hidden; doc.dispatchEvent(event('visibilitychange')); },
  };
  return app;
}
const total = segments => segments.reduce((n, s) => n + s.durationMs, 0);
const command = type => r => r.path === 'command' && r.body?.type === type;
const isPulse = r => r.path === 'pulse';
const SPEED = 3.2; // walk.mjs WALK_SPEED, units per second in the open
const toCafe = town => { town.send('DAY_MOVE', { location: 'cafe' }); town.send('DAY_EXIT'); };
const seat = town => { toCafe(town); town.send('CHOOSE', { branch: 'inside' }); town.send('NEXT'); town.send('PLACE', { slot: 'eaves-left' }); town.pulse(2000); town.pulse(2000); };
const dayExecuting = town => { toCafe(town); town.send('DAY_START', { kind: 'coordination' }); town.send('DAY_ROLE', { role: 'delegated' }); };
const dayResult = town => { dayExecuting(town); town.pulse(2000); town.pulse(2000); };
const lifeResult = town => { seat(town); town.ack(); town.send('LIFE_OPEN', { source: 'direct' }); town.send('LIFE_ROLE', { role: 'delegated' }); town.send('LIFE_CONFIRM'); town.pulse(3000); town.pulse(3000); };
const contactDue = town => { seat(town); town.ack(); for (let i = 0; i < 12; i++) town.pulse(2900); };
const byId = (app, id) => app.doc.getElementById(id);
const lost = { error: 'unavailable', message: '기록을 확인할 수 없어요.' };

// --- Walk packets: the window's prediction, the packets it sends and how it takes the host's corrections ---
for (const hz of [60, 120]) test(`걷기 ${hz}Hz: 소수 밀리초 프레임을 같은 방향끼리 합쳐 150ms마다 한 패킷으로 보내고, 호스트 영수증이 예측과 같다`, async t => {
  const app = await boot(t), start = app.walk(), lease = app.trace.requests.find(isPulse).presence;
  app.key('KeyD'); await app.run(700, 1000 / hz); app.key('KeyD', false); await app.run(300, 1000 / hz);
  const walks = app.sent('DAY_WALK'), sent = walks.flatMap(r => r.body.payload.segments), server = app.store.peek().state.day.walk, end = app.walk();
  assert.ok(walks.length >= 4);
  walks.forEach((r, i) => {
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.payload.surfaceId, r.body.payload.fence], [lease.surfaceId, lease.fence], 'signed with this window\'s lease');
    assert.equal(r.body.payload.segments.length, 1, 'one direction is one part');
    assert.ok(total(r.body.payload.segments) <= 240 + 1e-9);
    if (i) assert.equal(r.body.expectedRevision, walks[i - 1].revision, 'predicted on the last receipt');
    if (i && i < walks.length - 1) assert.ok(r.at - walks[i - 1].at >= 150 - 1e-9, 'paced');
  });
  assert.ok(sent.some(s => !Number.isInteger(s.durationMs)), 'sub-millisecond frame time is kept');
  assert.ok(Math.abs(server.x - start.x - SPEED * total(sent) / 1000) < .01, 'the host walked the time sent, less its whole-millisecond clock');
  assert.deepEqual([end.x, end.z, end.pending, end.sending], [server.x, server.z, 0, false]);
  assert.ok(end.maxCorrection < .01, 'in the open only the host clock rounding corrects');
});

test('걷기: 한 프레임은 50ms까지만 걷고, 답을 기다리는 동안 240ms까지만 쌓은 뒤 멈춘다(역압)', async t => {
  const app = await boot(t), gate = app.hold(command('DAY_WALK'));
  app.key('KeyD'); await app.run(1200, 100);
  const held = app.walk();
  assert.ok(Math.abs(total(app.sent('DAY_WALK')[0].body.payload.segments) - 50) < 1e-9, 'a 100 ms frame walks 50 ms');
  assert.deepEqual([gate.held, held.sending, held.pending, held.backpressured], [1, true, 1, true]);
  assert.ok(Math.abs(held.pendingMs - 240) < 1e-9, 'the prediction window is 240 ms');
  await gate.open(); await app.frame(100);
  const second = app.sent('DAY_WALK')[1].body.payload.segments;
  assert.equal(second.length, 1); assert.ok(Math.abs(total(second) - 240) < 1e-9);
  app.key('KeyD', false); await app.run(400, 100);
  const end = app.walk(), server = app.store.peek().state.day.walk;
  assert.deepEqual([end.x, end.z, end.backpressured], [server.x, server.z, false]);
  assert.ok(end.maxCorrection < 1e-9);
});

test('걷기: 방향이 바뀐 입력은 합치지 않고, 답을 기다리는 동안 32조각에서 멈춘다', async t => {
  const app = await boot(t), gate = app.hold(command('DAY_WALK'));
  app.key('KeyD');
  for (let i = 0; i < 80; i++) { app.key('KeyS', i % 2 === 0); await app.frame(4); }
  const held = app.walk(), first = app.sent('DAY_WALK')[0].body.payload.segments;
  assert.equal(first.length, 32, 'a full packet goes at 32 parts');
  assert.deepEqual([held.pending, held.backpressured, held.sending], [32, true, true]);
  assert.ok(first.every((s, i) => i === 0 || s.x !== first[i - 1].x || s.z !== first[i - 1].z), 'changed input is never merged');
  await gate.open(); await app.frame(4);
  const second = app.sent('DAY_WALK')[1].body.payload.segments;
  assert.equal(second.length, 32); assert.ok(total(second) <= 240);
  app.key('KeyD', false); app.key('KeyS', false); await app.run(300);
  assert.ok(app.sent('DAY_WALK').every(r => r.status === 200 && r.body.payload.segments.length <= 32));
});

test('걷기: 이야기하기 전에 보내는 중인 패킷을 기다렸다가 남은 걸음까지 보내고, 그 자리에서 말을 건다', async t => {
  const app = await boot(t), gate = app.hold(command('DAY_WALK'));
  app.key('KeyD'); await app.run(300); app.key('KeyD', false); await app.frame();
  const waiting = app.walk();
  assert.ok(waiting.sending && waiting.pending >= 1);
  app.key('KeyE'); app.key('KeyE', false); await app.settle();
  assert.equal(app.sent('DAY_INTERACT').length, 0, 'the interaction waits for the packet in flight');
  await gate.open();
  const commands = app.trace.requests.filter(r => r.path === 'command').map(r => r.body.type);
  assert.deepEqual(commands.slice(-3), ['DAY_WALK', 'DAY_WALK', 'DAY_INTERACT']);
  const end = app.walk(), server = app.store.peek().state.day.walk;
  assert.deepEqual([end.x, end.z, end.pending, end.sending], [server.x, server.z, 0, false]);
  assert.equal(app.sent('DAY_INTERACT')[0].body.payload.location, end.nearby);
  assert.equal(end.interactionOpen, true);
});

test('걷기: 패킷이 거절되면 쌓인 걸음을 버리고 입력을 멈추며, 다시 연결하면 호스트 자리에서 이어간다', async t => {
  const app = await boot(t), start = app.walk();
  app.fail(command('DAY_WALK'), 503, lost);
  app.key('KeyD'); await app.run(600);
  const stopped = app.walk();
  assert.equal(app.sent('DAY_WALK').length, 1, 'nothing more is sent after the refusal');
  assert.equal(byId(app, 'error').hidden, false); assert.equal(byId(app, 'error').textContent, lost.message);
  assert.deepEqual([stopped.pending, stopped.sending, stopped.inputActive, app.metrics().connected], [0, false, false, false]);
  app.key('KeyD', false); byId(app, 'retry').click(); await app.settle();
  const back = app.walk();
  assert.equal(app.metrics().connected, true);
  assert.deepEqual([back.x, back.z], [start.x, start.z], 'the refused packet never moved the host');
  assert.ok(back.maxCorrection > .1, 'the prediction snaps back to the host');
});

test('걷기: 호스트가 처리한 패킷의 답을 잃으면, 다시 연결한 뒤 그 걸음을 두 번 걷지 않는다', async t => {
  const app = await boot(t), start = app.walk();
  app.fail(command('DAY_WALK'), 503, lost, { through: true });
  app.key('KeyD'); await app.run(300); app.key('KeyD', false);
  byId(app, 'retry').click(); await app.settle(); await app.run(300);
  const end = app.walk(), server = app.store.peek().state.day.walk, applied = app.sent('DAY_WALK')[0].body.payload.segments;
  assert.ok(Math.abs(server.x - start.x - SPEED * total(applied) / 1000) < 1e-9, 'only the lost packet moved the host');
  assert.deepEqual([end.x, end.z, app.sent('DAY_WALK').length], [server.x, server.z, 1]);
});

test('교정: 호스트가 늦게 받은 패킷 다음 것을 잘라 끌어당기면, 남은 걸음을 그 위에 다시 얹고 끝에는 호스트 자리와 같다', async t => {
  const app = await boot(t), gate = app.hold(command('DAY_WALK'), { before: true });
  app.key('KeyD'); await app.run(600);
  await gate.open(); await app.run(200); app.key('KeyD', false); await app.run(300);
  const end = app.walk(), server = app.store.peek().state.day.walk;
  assert.ok(end.maxCorrection > .5, 'the host pulled the prediction back');
  assert.deepEqual([end.x, end.z, end.pending], [server.x, server.z, 0]);
});

test('교정: 보내기 전에 걸린 마을 상태 답이 늦게 와도 보내는 중인 패킷과 쌓인 걸음을 다시 얹어 예측이 튀지 않는다', async t => {
  const app = await boot(t, { setup: dayExecuting }), gate = app.hold(r => r.path === 'state');
  await app.run(1100);
  assert.equal(gate.held, 1, 'the timed episode reads the town each second');
  app.key('KeyD'); await app.run(300);
  const waiting = app.walk();
  assert.ok(waiting.sending && waiting.pending >= 1);
  await gate.open();
  assert.ok(app.walk().maxCorrection < 1e-9, 'the late town is replayed with the packet in flight and the pending input');
  app.key('KeyD', false); await app.run(300);
  const end = app.walk(), server = app.store.peek().state.day.walk;
  assert.deepEqual([end.x, end.z], [server.x, server.z]);
});

test('임대: 늦게 온 임대 답은 걷기 패킷 전에 다시 받는다', async t => {
  const app = await boot(t), gate = app.hold(isPulse);
  await app.run(1000); app.key('KeyD'); await app.run(1500);
  assert.equal(app.sent('DAY_WALK').length, 0, 'the packet waits behind the lease');
  assert.equal(app.walk().backpressured, true);
  await gate.open();
  const fresh = app.trace.requests.findIndex(r => isPulse(r) && r.at > 2400), walk = app.trace.requests.findIndex(command('DAY_WALK'));
  assert.ok(fresh > 0 && walk > fresh, 'a fresh lease before the packet');
  assert.equal(app.trace.requests[walk].status, 200);
  app.key('KeyD', false); await app.run(300);
  assert.equal(byId(app, 'error').hidden, true);
});

test('임대: 다시 받은 임대도 늦으면 걷기 패킷을 버리고 다시 연결을 청한다', async t => {
  const app = await boot(t), first = app.hold(isPulse);
  await app.run(1000); app.key('KeyD'); await app.run(300); app.key('KeyD', false); await app.run(1300);
  const second = app.hold(isPulse);
  await first.open();
  assert.equal(second.held, 1, 'the packet asks for a fresh lease first');
  await app.run(1300); const third = app.hold(isPulse); await second.open();
  assert.equal(third.held, 1, 'a late lease is asked once more');
  await app.run(1300); await third.open();
  assert.equal(app.sent('DAY_WALK').length, 0);
  assert.equal(byId(app, 'error').textContent, '연결이 늦어지고 있어요. 다시 연결을 눌러 주세요.');
  assert.deepEqual([app.walk().pending, app.walk().sending], [0, false]);
});

test('임대: 다른 창이 임대를 가져간 뒤의 걷기 패킷은 호스트가 거절하고, 화면은 걷기를 멈춘다', async t => {
  const app = await boot(t);
  app.store.pulse({ surfaceId: 'other-window', surface: 'day', foreground: true, safe: false });
  app.doc.focused = false; app.window.dispatchEvent({ type: 'blur' }); await app.settle();
  app.doc.focused = true; app.window.dispatchEvent({ type: 'focus' }); await app.settle();
  const lease = app.trace.requests.filter(isPulse).at(-1).presence;
  assert.equal(lease.owner, false, 'the other window holds the town');
  app.key('KeyD'); await app.run(400);
  const refused = app.sent('DAY_WALK');
  assert.equal(refused.length, 1); assert.equal(refused[0].status, 409);
  assert.equal(refused[0].body.payload.fence, lease.fence);
  assert.equal(byId(app, 'error').hidden, false);
  assert.deepEqual([app.walk().pending, app.metrics().connected], [0, false]);
});

test('걷기 소유자: 벽 곁에서는 끝점이 같을 때만 합쳐, 호스트가 조각을 차례로 다시 걸은 자리가 예측과 같다', async () => {
  // Imported here so SYNK_TOWN_SOURCE_OVERRIDE reaches the owner too. A planter corner where collision substeps
  // make one long step land elsewhere than the same time split in two; every frame is within the 50 ms contract.
  const { createWalkPackets } = await import('./walk-packets.mjs'), { movePoint } = await import('./walk.mjs');
  const start = { x: -7.5, z: -13.5 }, input = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, walk = createWalkPackets();
  walk.reconcile({ ...start, headingX: 0, headingZ: 1 });
  let now = 0; walk.step(now, input);
  for (const dt of [50, 40, 40, 40]) walk.step(now += dt, input);
  const sent = walk.take(now), merged = movePoint(start, input, total(sent) / 1000);
  // The host's DAY_WALK walks each part in order from its own point (day.mjs).
  const receipt = sent.reduce((at, part) => movePoint(at, part, part.durationMs / 1000), start);
  assert.ok(sent.length >= 2, 'a merge that would move the endpoint starts a new part');
  assert.deepEqual(receipt, walk.point, 'the receipt lands where the window predicted');
  assert.ok(Math.hypot(merged.x - walk.point.x, merged.z - walk.point.z) > .05, 'one merged part would have landed elsewhere');
});

// --- Acknowledgements: only from frames the renderer painted, once, and not again after a refusal is settled ---
test('관측: 계획 ACK는 렌더러가 실제로 그린 프레임만 근거로 삼고, 다 보인 뒤 한 번만 보낸다', async t => {
  const app = await boot(t, { setup: seat });
  const { view, state } = app.snapshot();
  assert.ok(view.plan && view.day.location === 'cafe');
  app.painting = false; await app.run(8000, 50);
  assert.equal(app.sent('ACK').length, 0, 'a renderer that never painted the plan cannot vouch for it');
  app.painting = true; await app.run(4000, 50);
  const acks = app.sent('ACK');
  assert.equal(acks.length, 1);
  assert.deepEqual(acks[0].body.payload, { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, activity: 'seat', worldRevision: state.worldRevision,
    mode: 'motion', appliedStepIds: view.committedStepIds, visible: true, assetsReady: true });
  assert.equal(acks[0].status, 200);
  assert.ok(acks[0].at - 8000 >= 1200, 'the completed plan stays painted for 1.2 s before its ACK');
  assert.equal(app.snapshot().view.plan, null);
});

test('관측: 장면 글이 화면 밖이면 계획을 본 시간이 흐르지 않는다', async t => {
  const app = await boot(t, { setup: seat });
  app.doc.rects.set('scene-caption', { left: 0, top: -400, width: 100, height: 40 });
  await app.run(8000, 50);
  assert.equal(app.sent('ACK').length, 0);
  app.doc.rects.delete('scene-caption'); await app.run(2000, 50);
  assert.equal(app.sent('ACK').length, 0, 'visible time starts only when it is seen');
  await app.run(6000, 50);
  assert.equal(app.sent('ACK').length, 1);
  assert.ok(app.sent('ACK')[0].at - 8000 >= 2400, 'the plan needs 2.4 s of visible time');
});

test('관측: 답이 아직 같은 계획을 보여도 ACK를 다시 보내지 않는다', async t => {
  const app = await boot(t, { setup: seat });
  app.fail(command('ACK'), 200, () => app.store.peek());
  await app.run(10000, 50);
  assert.equal(app.sent('ACK').length, 1, 'one ACK per plan, however its answer looks');
  assert.ok(app.snapshot().view.plan, 'the answer still showed the plan');
});

test('관측: 호스트가 받은 ACK의 답을 잃으면 다시 연결한 뒤 그 ACK를 되풀이하지 않는다', async t => {
  const app = await boot(t, { setup: seat });
  app.fail(command('ACK'), 503, lost, { through: true });
  await app.run(10000, 50);
  assert.deepEqual([app.sent('ACK').length, app.metrics().connected], [1, false]);
  await app.run(2000, 50);
  assert.equal(app.sent('ACK').length, 1, 'a lost connection acknowledges nothing');
  byId(app, 'retry').click(); await app.settle(); await app.run(4000, 50);
  assert.equal(app.sent('ACK').length, 1, 'the reloaded town no longer has the plan');
  assert.equal(app.snapshot().view.plan, null);
});

test('관측: 결과는 숨은 창·화면 밖·걷는 동안에는 본 시간이 쌓이지 않고, 한 프레임은 100ms까지만 센다', async t => {
  const app = await boot(t, { setup: dayResult });
  const result = app.snapshot().view.day.observation;
  assert.equal(result.allowed, true);
  app.doc.rects.set('observation', { left: 0, top: -200, width: 100, height: 40 }); await app.run(3000, 100);
  app.doc.rects.delete('observation'); app.hide(true); await app.run(3000, 100); app.hide(false); await app.settle();
  app.key('KeyD'); await app.run(400); app.key('KeyD', false); await app.frame();
  assert.equal(app.sent('DAY_OBSERVED').length, 0);
  const released = app.clock;
  await app.run(6000, 300);
  const seen = app.sent('DAY_OBSERVED');
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].body.payload, { resultId: result.resultId, visible: true, surfaceId: seen[0].body.payload.surfaceId, fence: seen[0].body.payload.fence });
  assert.ok(seen[0].at - released >= 12 * 300 - 1e-6, '300 ms frames count 100 ms each');
  assert.equal(seen[0].status, 200);
});

test('관측: 결과 답이 아직 본 적 없다고 보여도 같은 결과를 다시 보내지 않는다', async t => {
  const app = await boot(t, { setup: dayResult });
  app.fail(command('DAY_OBSERVED'), 200, () => app.store.peek());
  await app.run(6000, 100);
  assert.equal(app.sent('DAY_OBSERVED').length, 1);
  assert.equal(app.snapshot().view.day.observation.allowed, true);
});

test('관측: 생활 결과는 1.2초 보인 뒤 LIFE_ACK로 한 번 보낸다', async t => {
  const app = await boot(t, { setup: lifeResult });
  const interaction = app.snapshot().view.life.interaction;
  assert.equal(interaction.stage, 'result');
  await app.run(3000, 100);
  const acks = app.sent('LIFE_ACK');
  assert.equal(acks.length, 1);
  assert.equal(acks[0].body.payload.resultId, interaction.resultId);
  assert.ok(acks[0].at >= 1200);
});

test('관측: 이 창에 온 연락은 0.3초 보인 뒤 LIFE_ACK로 한 번 보낸다', async t => {
  const app = await boot(t, { setup: contactDue });
  await app.run(22000, 100);
  const boundary = app.trace.requests.find(r => r.path === 'boundary'), acks = app.sent('LIFE_ACK');
  assert.ok(boundary, 'the safe window offers a boundary');
  assert.equal(acks.length, 1);
  assert.equal(acks[0].body.payload.contactId, 'C1:contact:1');
  assert.ok(acks[0].at - boundary.at >= 300, 'shown for 0.3 s first');
  assert.equal(app.snapshot().view.life.contact.state, 'delivered');
});
