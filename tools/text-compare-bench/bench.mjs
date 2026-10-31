#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpus, totalmem, platform, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compareText as baseline } from './baseline.mjs';
import { compareTextJs, distanceJs, prepare } from './compare.mjs';
import { createRustComparison, wasmUrl } from './rust.mjs';
import { benchmarkCases } from './cases.mjs';

const output = process.argv.indexOf('--out');
if (output === -1 || !process.argv[output + 1]) throw new Error('Usage: node tools/text-compare-bench/bench.mjs --out <new-result.json>');
// This program never invokes paid APIs, transcribes media, or modifies production.
globalThis.fetch = () => { throw new Error('Network disabled for this local experiment'); };
const started = new Date().toISOString(), cpuStart = process.cpuUsage(), wallStart = performance.now();
const rust = await createRustComparison();
const cases = benchmarkCases(), rounds = 7, targetBatchMs = 25, maxBatch = 512;
let sink = 0;
function time(fn, iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) sink += fn();
  return (performance.now() - start) / iterations;
}
function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], minMs: sorted[0],
    maxMs: sorted.at(-1), samplesMs: samples };
}

// Give all three engines the same non-trivial warm-up work before calibration.
const warm = cases.find(c => c.id === '100-mixed-edits');
for (let i = 0; i < 500; i++) {
  sink += baseline(warm.expected, warm.observed).editDistance;
  sink += compareTextJs(warm.expected, warm.observed).editDistance;
  sink += rust.compareText(warm.expected, warm.observed).editDistance;
}
const rows = [];
for (const [index, c] of cases.entries()) {
  const expected = baseline(c.expected, c.observed);
  assert.deepEqual(compareTextJs(c.expected, c.observed), expected);
  assert.deepEqual(rust.compareText(c.expected, c.observed), expected);
  const normalized = prepare(c.expected, c.observed);
  const functions = {
    baseline: () => baseline(c.expected, c.observed).editDistance,
    javascript: () => compareTextJs(c.expected, c.observed).editDistance,
    rustWasm: () => rust.compareText(c.expected, c.observed).editDistance,
    javascriptCore: () => distanceJs(normalized.a, normalized.b),
    rustWasmCoreWithCopy: () => rust.distance(normalized.a, normalized.b),
  };
  const names = Object.keys(functions), measures = {};
  for (const name of names) {
    const probe = time(functions[name], 1);
    const iterations = Math.max(1, Math.min(maxBatch, Math.floor(targetBatchMs / Math.max(probe, .001))));
    time(functions[name], iterations);
    measures[name] = { iterationsPerSample: iterations, samples: [] };
  }
  // Rotate the order each round to avoid assigning every slow/busy slot to one implementation.
  for (let round = 0; round < rounds; round++) for (let k = 0; k < names.length; k++) {
    const name = names[(k + round + index) % names.length];
    const measure = measures[name];
    measure.samples.push(time(functions[name], measure.iterationsPerSample));
  }
  const timings = Object.fromEntries(names.map(name => [name,
    { iterationsPerSample: measures[name].iterationsPerSample, ...stats(measures[name].samples) }]));
  rows.push({ id: c.id, kind: c.kind, inputSha256: createHash('sha256').update(JSON.stringify([c.expected, c.observed])).digest('hex'),
    result: expected, timings, speedup: {
      javascriptVsBaseline: timings.baseline.medianMs / timings.javascript.medianMs,
      rustVsBaseline: timings.baseline.medianMs / timings.rustWasm.medianMs,
      rustVsJavascript: timings.javascript.medianMs / timings.rustWasm.medianMs,
    } });
  console.error(`${c.id}: original=${timings.baseline.medianMs.toFixed(3)}ms JS=${timings.javascript.medianMs.toFixed(3)}ms Rust/WASM=${timings.rustWasm.medianMs.toFixed(3)}ms`);
}

// Fresh Node process for each sample, so WASM compilation is not reused from
// the timed steady-state instance. Report in-process initialization separately
// from the time spent starting the fresh Node process itself.
const cold = [];
for (let i = 0; i < 7; i++) {
  const start = performance.now();
  const sample = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./cold-start.mjs', import.meta.url))],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 }));
  assert.equal(sample.distance, 1);
  cold.push({ ...sample, freshNodeProcessWallMs: performance.now() - start });
}
const sourceFiles = ['../영상사전검사.mjs', '../lib/text-compare.mjs', './baseline.mjs', './compare.mjs', './rust.mjs', './cases.mjs', './bench.mjs',
  './cold-start.mjs', './rust/src/lib.rs', './rust/Cargo.toml', './rust/Cargo.lock'];
const sourceSha256 = {};
for (const file of sourceFiles) sourceSha256[file] = createHash('sha256').update(await readFile(new URL(file, import.meta.url))).digest('hex');
const report = {
  experiment: 'Exact normalized Unicode edit distance: existing JS vs improved JS vs Rust/WASM',
  started, finished: new Date().toISOString(),
  environment: { node: process.version, v8: process.versions.v8, unicode: process.versions.unicode,
    platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length,
    memoryBytes: totalmem(), rustc: process.env.SYNK_BENCH_RUSTC_VERSION || 'not recorded',
    rustTarget: 'wasm32-unknown-unknown', cargoProfile: 'release opt-level=3 lto=true codegen-units=1',
    wasmBytes: (await stat(wasmUrl)).size,
    wasmSha256: createHash('sha256').update(await readFile(wasmUrl)).digest('hex') },
  method: { rounds, targetBatchMs, maxBatch, aggregate: 'median of seven per-call batch averages',
    fullFunctionIncludes: 'String coercion, NFKC, lowercase, Unicode filtering, codepoint conversion, calculation, result object; Rust also copies into WASM memory',
    fullFunctionExcludes: 'one-time read/compile/instantiate (reported separately), Rust build/install',
    coreIncludes: 'prepared Unicode codepoints; Rust includes JS/WASM crossing and input copying',
    dataset: 'synthetic deterministic Hangul and a newly written short script, not a production workload sample',
    scope: 'Rust is WASM in Node V8, not a native executable or Node native addon; JS shares the media-preflight implementation; frozen baseline preserves the pre-optimization algorithm',
    concurrency: 'one benchmark process, sequential implementations; other desktop workloads not controlled' },
  sourceSha256, rows, coldStart: { samples: cold,
    initialize: stats(cold.map(s => s.initializeMs)),
    initializeAndFirstCompare: stats(cold.map(s => s.initializeAndFirstCompareMs)) },
  wallMs: performance.now() - wallStart, cpuUsageMicros: process.cpuUsage(cpuStart), checksum: sink,
};
await writeFile(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(`Saved ${rows.length} cases to ${process.argv[output + 1]}`);
