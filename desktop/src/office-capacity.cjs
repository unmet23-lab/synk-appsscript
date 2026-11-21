'use strict';
// 솔리오 「사무실」의 수용 인원에 쓰는 이 PC의 값(구현설계.md 6절): 논리 코어 수, 전체 · 빈 메모리(GB, 소수 한 자리), 지금 프로세서를 쓰는 비율(%).
// 프로세서 비율은 os.cpus()의 시간 값을 1초 간격으로 두 번 읽어 셈한다. Windows에는 부하 평균 값이 없다.
// 숫자만 돌려준다. 몇 사람까지인지 셈하는 것은 renderer/office-model.mjs의 officeCapacity다.
// GB는 1024³ 바이트다(Windows 작업 관리자가 보이는 값과 같다).
const os = require('node:os');

const GB = 1024 ** 3;
const SAMPLE_MS = 1000;
const round1 = n => Math.round(n * 10) / 10;

function cpuTimes(list) {
  let idle = 0, total = 0;
  for (const c of Array.isArray(list) ? list : []) {
    const t = c && c.times ? c.times : {};
    for (const k of ['user', 'nice', 'sys', 'idle', 'irq']) total += Number(t[k]) || 0;
    idle += Number(t.idle) || 0;
  }
  return { idle, total };
}
const safe = fn => { try { return fn(); } catch { return null; } };
const memGb = v => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? round1(Number(v) / GB) : null); // null이 0GB가 되지 않게(0.5.2 공개 검수 B3)

function createOfficeCapacity({ osImpl = os, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), sampleMs = SAMPLE_MS } = {}) {
  /**
   * @returns Promise<{ cores, totalMemGb, freeMemGb, cpuPercent }> — cpuPercent는 0~100의 정수, 두 번 읽은 사이에 시간이 흐르지 않았으면 null
   */
  async function read() {
    const first = cpuTimes(safe(() => osImpl.cpus()));
    await sleep(sampleMs);
    const list = safe(() => osImpl.cpus()) || [];
    const second = cpuTimes(list);
    const spent = second.total - first.total, rested = second.idle - first.idle;
    const cpuPercent = spent > 0 ? Math.min(100, Math.max(0, Math.round((1 - rested / spent) * 100))) : null;
    const parallel = Number(safe(() => osImpl.availableParallelism?.()));
    const cores = list.length || (Number.isInteger(parallel) && parallel > 0 ? parallel : 1);
    return { cores, totalMemGb: memGb(safe(() => osImpl.totalmem())), freeMemGb: memGb(safe(() => osImpl.freemem())), cpuPercent };
  }
  return { read };
}

module.exports = { createOfficeCapacity, SAMPLE_MS };
