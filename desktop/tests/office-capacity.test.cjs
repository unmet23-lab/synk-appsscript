'use strict';
// 솔리오 「사무실」의 이 PC 값 읽기(office-capacity.cjs, 구현설계.md 6절). os는 가짜다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOfficeCapacity, SAMPLE_MS } = require('../src/office-capacity.cjs');

const GB = 1024 ** 3;
const cpu = (user, sys, idle) => ({ model: 'x', speed: 1, times: { user, nice: 0, sys, idle, irq: 0 } });
function fakeOs(samples, { total = 16 * GB, free = 7.26 * GB, parallel } = {}) {
  let i = 0;
  return {
    cpus: () => samples[Math.min(i++, samples.length - 1)],
    totalmem: () => total,
    freemem: () => free,
    ...(parallel ? { availableParallelism: () => parallel } : {}),
    // Windows처럼 loadavg가 0이어도 쓰지 않는다
    loadavg: () => [0, 0, 0],
  };
}

test('CPU use comes from two os.cpus() samples one second apart, memory in GB with one decimal', async () => {
  const waits = [];
  const before = [cpu(100, 50, 850), cpu(200, 0, 800)];
  const after = [cpu(160, 70, 870), cpu(260, 20, 820)]; // 바쁨 160, 쉼 40 → 80%
  const capacity = createOfficeCapacity({ osImpl: fakeOs([before, after]), sleep: async ms => { waits.push(ms); } });
  const v = await capacity.read();
  assert.deepEqual(waits, [1000]);
  assert.equal(SAMPLE_MS, 1000);
  assert.deepEqual(v, { cores: 2, totalMemGb: 16, freeMemGb: 7.3, cpuPercent: 80 });
  for (const k of Object.keys(v)) assert.equal(typeof v[k], 'number', 'plain numbers only');
});

test('no time between samples gives null, values are clamped, and a missing cpu list falls back', async () => {
  const same = [cpu(1, 1, 1)];
  assert.equal((await createOfficeCapacity({ osImpl: fakeOs([same, same]), sleep: async () => {} }).read()).cpuPercent, null);
  const weird = createOfficeCapacity({ osImpl: fakeOs([[cpu(100, 0, 100)], [cpu(0, 0, 250)]]), sleep: async () => {} }); // 바쁨 칸이 줄었다(셈이 다시 시작됨)
  assert.equal((await weird.read()).cpuPercent, 0, 'idle growing faster than total is clamped to 0');
  const broken = createOfficeCapacity({ osImpl: { cpus: () => { throw new Error('x'); }, totalmem: () => 8 * GB, freemem: () => 1 * GB, availableParallelism: () => 6 }, sleep: async () => {} });
  assert.deepEqual(await broken.read(), { cores: 6, totalMemGb: 8, freeMemGb: 1, cpuPercent: null });
  const bare = createOfficeCapacity({ osImpl: { cpus: () => [], totalmem: () => NaN, freemem: () => -1 }, sleep: async () => {} });
  assert.deepEqual(await bare.read(), { cores: 1, totalMemGb: null, freeMemGb: null, cpuPercent: null });
  // 0.5.2 공개 검수 B3: 메모리를 읽다 실패하거나 null이 오면 0GB가 아니라 모름이다
  const failing = createOfficeCapacity({ osImpl: { cpus: () => [], totalmem: () => { throw new Error('x'); }, freemem: () => null }, sleep: async () => {} });
  const read = await failing.read();
  assert.equal(read.totalMemGb, null);
  assert.equal(read.freeMemGb, null);
});

test('a real read returns sane numbers', async () => {
  const v = await createOfficeCapacity({ sampleMs: 50 }).read();
  assert.ok(Number.isInteger(v.cores) && v.cores >= 1);
  assert.ok(v.totalMemGb > 0 && v.freeMemGb >= 0 && v.freeMemGb <= v.totalMemGb);
  assert.ok(v.cpuPercent === null || (v.cpuPercent >= 0 && v.cpuPercent <= 100));
});
