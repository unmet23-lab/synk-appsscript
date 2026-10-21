// Run: node experiences/mascot-render-lab/qa/measurement-check.mjs
// Runs the real lab module with synthetic DOM, renderer, and clock only.
// This verifies measurement lifecycle logic, not browser/GPU/mobile performance.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const importExpression = "await import('./three/renderer.mjs')";
const original = fs.readFileSync(new URL('../lab.mjs', import.meta.url), 'utf8');
assert.equal(original.split(importExpression).length, 2, 'Expected exactly one renderer import to replace with the test engine.');
const source = original.replace(importExpression, '({createThreeLab:fakeCreateThreeLab})');

function node() {
  return {
    textContent: '', disabled: false, events: {},
    addEventListener(key, callback) { this.events[key] = callback; },
    click() { this.events.click?.(); },
    setAttribute() {},
  };
}

async function setup() {
  const nodes = new Map([
    '#selection-status', '#render-stats', '#measure', '#three-stage',
    '#three-status', '#measure-status', '#save-report',
  ].map(key => [key, node()]));
  const raf = new Map(), docEvents = new Map(), windowEvents = new Map();
  let sequence = 0, now = 0, reportBlob, onStats, disposed = 0;
  const stats = { fps: 60, contextLost: false, paused: false };
  const document = {
    hidden: false,
    querySelector: selector => nodes.get(selector),
    querySelectorAll: () => [],
    createElement: () => node(),
    addEventListener: (key, callback) => docEvents.set(key, callback),
    removeEventListener: (key, callback) => {
      if (docEvents.get(key) === callback) docEvents.delete(key);
    },
  };
  const engine = {
    setQuality() {}, setMotion() {}, setCostume() {}, setView() {},
    getStats: () => ({ ...stats }),
    setPaused(value) { stats.paused = value; },
    dispose() { disposed += 1; },
  };
  const context = {
    document,
    matchMedia: () => ({ matches: false }),
    performance: { now: () => now },
    requestAnimationFrame(callback) { raf.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => raf.delete(id),
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
    addEventListener: (key, callback) => windowEvents.set(key, callback),
    setTimeout() {}, Blob,
    URL: {
      createObjectURL(blob) { reportBlob = blob; return 'blob:synthetic'; },
      revokeObjectURL() {},
    },
    async fakeCreateThreeLab(container, options) {
      onStats = options.onStats;
      onStats(stats);
      return engine;
    },
  };
  await vm.runInNewContext('(async()=>{' + source + '})()', context);
  return {
    stats, document, docEvents, windowEvents, nodes, raf,
    start: () => nodes.get('#measure').click(),
    frame(time) {
      now = time;
      const [id, callback] = raf.entries().next().value || [];
      if (callback) { raf.delete(id); callback(time); }
    },
    async report() {
      nodes.get('#save-report').click();
      return JSON.parse(await reportBlob.text());
    },
    onStats: () => onStats({ ...stats }),
    disposed: () => disposed,
  };
}

let passed = 0;
async function check(name, callback) {
  await callback();
  passed += 1;
  console.log('PASS ' + name);
}

await check('healthy callback interval remains valid and identifies the metric', async () => {
  const run = await setup();
  run.start();
  for (let i = 1; i <= 480; i += 1) run.frame(i * 1000 / 60);
  const report = await run.report();
  assert.equal(report.measurement.valid, true);
  assert.ok(Math.abs(report.measurement.fps - 60) < 0.001);
  assert.equal(report.measurement.samples, 478);
  assert.match(report.measurementMetric.fpsMeaning, /not GPU/);
  assert.match(run.nodes.get('#measure-status').textContent, /GPU 실행 시간이 아니/);
});

await check('context loss before measurement cannot claim 60 fps', async () => {
  const run = await setup();
  run.stats.contextLost = true; run.stats.fps = 0;
  run.start();
  const report = await run.report();
  assert.equal(report.measurement.valid, false);
  assert.equal(run.raf.size, 0);
  assert.equal(report.measurement.fps, undefined);
});

await check('context loss notification ends the active measurement immediately', async () => {
  const run = await setup();
  run.start(); run.frame(16);
  run.stats.contextLost = true; run.onStats();
  assert.equal((await run.report()).measurement.valid, false);
  assert.equal(run.raf.size, 0);
});

await check('paused renderer invalidates both initial and active measurements', async () => {
  const run = await setup();
  run.stats.paused = true; run.start();
  assert.equal((await run.report()).measurement.valid, false);
  run.stats.paused = false; run.start(); run.frame(16);
  run.stats.paused = true; run.frame(32);
  assert.equal((await run.report()).measurement.valid, false);
});

await check('visibilitychange aborts without waiting for a background rAF', async () => {
  const run = await setup();
  run.start(); run.document.hidden = true;
  run.docEvents.get('visibilitychange')();
  assert.equal((await run.report()).measurement.valid, false);
  assert.equal(run.raf.size, 0);
  assert.equal(run.docEvents.size, 0);
  run.document.hidden = false; run.frame(9000);
  assert.equal((await run.report()).measurement.valid, false);
});

await check('one late first callback has too few samples and no toFixed exception', async () => {
  const run = await setup();
  run.start(); run.frame(9000);
  const report = await run.report();
  assert.equal(report.measurement.valid, false);
  assert.match(report.measurement.reason, /표본이 부족/);
  assert.equal(run.nodes.get('#measure').disabled, false);
});

await check('cancelled callback cannot overwrite a new measurement', async () => {
  const run = await setup();
  run.start();
  const stale = [...run.raf.values()][0];
  run.document.hidden = true; run.docEvents.get('visibilitychange')();
  run.document.hidden = false; run.start();
  stale(10000);
  assert.equal((await run.report()).measurement, null);
  assert.equal(run.raf.size, 1);
});

await check('bfcache pagehide pauses, pageshow resumes, real exit disposes', async () => {
  const run = await setup();
  run.start();
  run.windowEvents.get('pagehide')({ persisted: true });
  assert.equal(run.stats.paused, true);
  assert.equal(run.disposed(), 0);
  assert.equal((await run.report()).measurement.valid, false);
  run.windowEvents.get('pageshow')({ persisted: true });
  assert.equal(run.stats.paused, false);
  run.start();
  assert.equal(run.raf.size, 1);
  run.windowEvents.get('pagehide')({ persisted: false });
  assert.equal(run.disposed(), 1);
  assert.equal(run.raf.size, 0);
});

console.log(`RESULT ${passed}/8 passed; real lab source, synthetic DOM/engine/clock only.`);
