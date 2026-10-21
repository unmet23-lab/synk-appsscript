// Read-only: which part of one presence pulse grows with the Trail log.
// Usage: node bench-town-parts.mjs <repo-root> <targetEvents>
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const repo = process.argv[2], target = Number(process.argv[3] || 600);
const url = p => pathToFileURL(path.join(repo, p)).href;
const { createStore } = await import(url('experiences/synk-town/server.mjs'));
const core = await import(url('experiences/synk-town/core.mjs'));
const require = createRequire(path.join(repo, 'package.json'));
const Trail = require(path.join(repo, 'atlas/trail-life.js'));

let now = 100000, sequence = 0, receipt;
const store = createStore({ now: () => now });
const pulse = (ms = 0) => { now += ms; const r = store.presence({ surfaceId: 'parts-a', surface: 'day', foreground: true, safe: true }); receipt = r.presence; return r; };
const send = (type, payload = {}) => store.execute({ id: `p-${++sequence}`, type, expectedRevision: store.read().state.revision,
  payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
const go = location => { send('DAY_MOVE', { location }); if (store.read().state.day.home.exitTarget) send('DAY_EXIT'); };
pulse();
let cycle = 0;
while (store.read().state.events.length < target) { pulse(200); go(cycle % 2 ? 'home' : 'cafe'); if (cycle % 10 === 0) for (let i = 0; i < 15; i++) pulse(1000); cycle++; }
const state = store.read().state;
const canonical = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const time = (label, fn, n = 20) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return [label, +((performance.now() - t0) / n).toFixed(2)]; };
const rows = [
  time('Trail.summarize(events)', () => Trail.summarize(state.events, { scope: state.scope })),
  time('core.assertState(state)', () => core.assertState(state)),
  time('core.viewFor(state)', () => core.viewFor(state)),
  time('canonical(state) x1', () => canonical(state)),
  time('structuredClone(state)', () => structuredClone(state)),
  time('JSON.stringify(state)', () => JSON.stringify(state)),
  time('store.presence (one pulse)', () => pulse(1000), 10),
];
console.log(JSON.stringify({ events: state.events.length, stateBytes: Buffer.byteLength(JSON.stringify(state)), ms: Object.fromEntries(rows) }));
