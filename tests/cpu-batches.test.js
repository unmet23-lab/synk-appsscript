'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cpuBatches, assertCpuGrowth } = require('./lib/cpu-batches.js');

test('CPU 성장 관문: 계산하지 않고 기다린 시간은 경과시간에 남고 계산량 증가로 실패하지 않는다', () => {
  const idle = new Int32Array(new SharedArrayBuffer(4));
  const early = cpuBatches(() => {}, { iterations: 10, samples: 3 });
  const late = cpuBatches(() => Atomics.wait(idle, 0, 0, 20), { iterations: 10, samples: 3 });
  assert.ok(late.wallMs >= 10 && late.wallMs > late.cpuMs, '실제 기다림은 진단에서 보인다');
  assertCpuGrowth(early, late);
});

test('CPU 성장 관문: 실제 계산량 증가를 넣으면 기존 3배·5ms 관문이 실패한다', () => {
  const early = cpuBatches(() => {}, { iterations: 5, samples: 3 });
  const late = cpuBatches(() => {
    const start = process.cpuUsage();
    let cpu;
    do { cpu = process.cpuUsage(start); } while (cpu.user + cpu.system < 20000);
  }, { iterations: 5, samples: 3 });
  assert.throws(() => assertCpuGrowth(early, late), { code: 'ERR_ASSERTION' });
});
