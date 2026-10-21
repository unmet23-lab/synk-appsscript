// Read-only benchmark: how the per-request cost of the Town reducer grows with the
// Trail event log. Uses an in-memory store (no file) and a fake clock.
// Usage: node bench-town-growth.mjs <repo-root> [targetEvents...]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const repo = process.argv[2];
const targets = (process.argv.slice(3).length ? process.argv.slice(3) : ['200', '1000', '3000']).map(Number);
const { createStore } = await import(pathToFileURL(path.join(repo, 'experiences/synk-town/server.mjs')).href);

let now = 100000, sequence = 0, receipt;
const store = createStore({ now: () => now });
const pulse = (ms = 0) => { now += ms; const r = store.presence({ surfaceId: 'bench-a', surface: 'day', foreground: true, safe: true }); receipt = r.presence; return r; };
const command = (type, payload = {}) => ({ id: `bench-${++sequence}`, type, expectedRevision: store.read().state.revision,
  payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
const send = (type, payload = {}) => store.execute(command(type, payload));
const go = location => { send('DAY_MOVE', { location }); if (store.read().state.day.home.exitTarget) send('DAY_EXIT'); };

pulse();
const rows = [];
let cycle = 0;
for (const target of targets) {
  while (store.read().state.events.length < target) {
    pulse(200);
    go(cycle % 2 ? 'home' : 'cafe');
    // let the 14 s scripted routine run once in a while so routine facts accrue too
    if (cycle % 10 === 0) for (let i = 0; i < 15; i++) pulse(1000);
    cycle++;
  }
  // measure
  const N = 30;
  let t0 = performance.now();
  for (let i = 0; i < N; i++) pulse(1000);
  const pulseMs = (performance.now() - t0) / N;
  t0 = performance.now();
  for (let i = 0; i < N; i++) { pulse(100); go(i % 2 ? 'home' : 'cafe'); }
  const moveMs = (performance.now() - t0) / N; // includes one pulse + 1-2 commands
  const state = store.read().state;
  rows.push({ events: state.events.length, commands: state.commands.length,
    stateBytes: Buffer.byteLength(JSON.stringify(state)), pulseMs: +pulseMs.toFixed(2), moveCycleMs: +moveMs.toFixed(2),
    dayEmitted: state.day.emitted.length, dayVisit: state.day.visit });
  console.log(JSON.stringify(rows.at(-1)));
}
