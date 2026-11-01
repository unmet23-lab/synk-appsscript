'use strict';
const assert = require('node:assert/strict');

// Synchronous in-memory work only. Count this process's CPU (including GC workers),
// not time when a shared runner scheduled another process. Keep wall time as evidence;
// end-to-end/disk latency still belongs in tools/town-bench.mjs.
function cpuBatches(run, { iterations = 20, samples = 7 } = {}) {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || !Number.isSafeInteger(samples) || samples < 3 || samples % 2 !== 1) {
    throw new TypeError('positive iterations and an odd sample count >= 3 required');
  }
  for (let i = 0; i < iterations; i++) run(i); // warm both the early and late phase
  const batches = [];
  for (let s = 0; s < samples; s++) {
    const wallStart = process.hrtime.bigint(), cpuStart = process.cpuUsage();
    for (let i = 0; i < iterations; i++) run(i);
    const cpu = process.cpuUsage(cpuStart);
    batches.push({ cpuMs: (cpu.user + cpu.system) / 1000 / iterations,
      wallMs: Number(process.hrtime.bigint() - wallStart) / 1e6 / iterations });
  }
  const median = key => batches.map(row => row[key]).sort((a, b) => a - b)[Math.floor(samples / 2)];
  return { cpuMs: median('cpuMs'), wallMs: median('wallMs'), iterations, batches };
}

function assertCpuGrowth(early, late) {
  assert.ok(Number.isFinite(early.cpuMs) && early.cpuMs >= 0 && Number.isFinite(late.cpuMs) && late.cpuMs >= 0, 'valid CPU measurements required');
  assert.ok(late.cpuMs < Math.max(5, early.cpuMs * 3),
    `한 바퀴 CPU(맥박 + 명령 한둘) 처음 ${early.cpuMs.toFixed(2)}ms · 나중 ${late.cpuMs.toFixed(2)}ms`);
}

module.exports = { cpuBatches, assertCpuGrowth };
