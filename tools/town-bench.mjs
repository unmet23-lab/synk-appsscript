#!/usr/bin/env node
/** 싱크타운 저장 벤치(세로 조각 설계 §15-4, W2 계획 D11). 로컬 저장소를 사건 N개까지 키운 뒤 요청마다 시간과 응답 크기를 잰다 —
 * 맥박(임대만)·경계 신호(20초 놀이를 결산)·명령(DAY_MOVE)·읽기, 비교용으로 옛 presence. 기준: 맥박은 사건 0/1,000/10,000에서
 * 시간·응답 크기가 ±10% 안, 경계 신호 p95 30ms, 명령 p95 50ms(사건 1만), 세계 64KB 안, 7일 부재 결산 한 번 중앙 50ms(W6 — 마을
 * 씨앗 12가 7일 비웠다가 읽을 때의 저장소 결산).
 * 원형: docs/디자인/research/town-review-20261021/tools/bench-town-growth.mjs. 시계는 가짜이고 저장은 임시 폴더(기본) 또는 메모리.
 *   node tools/town-bench.mjs [--events 0,1000,10000] [--repeat 100] [--memory] [--json <파일>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => { const at = argv.indexOf(name); return at < 0 ? fallback : argv[at + 1]; };
const targets = option('--events', '0,1000,10000').split(',').map(Number);
const repeat = Number(option('--repeat', '100'));
const memory = argv.includes('--memory');
const out = option('--json', null);
if (!targets.every(n => Number.isSafeInteger(n) && n >= 0) || !Number.isSafeInteger(repeat) || repeat < 5) {
  console.error('--events는 0 이상의 정수 목록, --repeat는 5 이상이에요.'); process.exit(2);
}
const { createStore, BOUNDARY_GAP_MS } = await import(pathToFileURL(path.join(repo, 'experiences/synk-town/server.mjs')).href);

const dir = memory ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-bench-'));
let at = Date.UTC(2026, 9, 22, 3, 0), n = 0, receipt, revision = 0;
const store = createStore({ ...(dir ? { dir } : {}), now: () => at, tz: 540 });
const surface = { surfaceId: 'bench', surface: 'day', foreground: true, safe: true };
const pulse = (ms = 1000) => { at += ms; const answer = store.pulse(surface); receipt = answer.presence; return answer; };
const send = (type, payload = {}) => {
  const answer = store.execute({ id: `bench-${++n}`, type, expectedRevision: revision,
    payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  revision = answer.state.revision;
  return answer;
};
const go = location => { const answer = send('DAY_MOVE', { location }); return answer.state.day.home.exitTarget ? send('DAY_EXIT') : answer; };
const time = run => { const started = performance.now(); const value = run(); return [performance.now() - started, value]; };
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(2); };
const spread = values => ({ p50: quantile(values, 0.5), p95: quantile(values, 0.95) });

pulse(0);
revision = store.peek().state.revision;
const rows = [];
let cycle = 0;
const started = performance.now();
for (const target of [...targets].sort((a, b) => a - b)) {
  while (store.stats().lines < target) {
    pulse(200); go(cycle % 2 ? 'home' : 'cafe');
    // The scripted routine runs now and then, so its facts accrue too.
    if (cycle % 10 === 0) { for (let i = 0; i < 15; i++) pulse(1000); store.read(); }
    cycle++;
  }
  const sample = { pulse: [], pulseBytes: [], boundary: [], command: [], read: [], presence: [], presenceBytes: [] };
  for (let i = 0; i < repeat; i++) {
    const [ms, answer] = time(() => pulse(1000));
    sample.pulse.push(ms); sample.pulseBytes.push(Buffer.byteLength(JSON.stringify(answer)));
  }
  for (let i = 0; i < repeat; i++) {
    for (let s = 0; s < BOUNDARY_GAP_MS / 1000; s++) pulse(1000);
    const [ms, answer] = time(() => store.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence }));
    if (answer.throttled) throw new Error('boundary throttled');
    sample.boundary.push(ms);
  }
  for (let i = 0; i < repeat; i++) {
    pulse(250);
    const where = store.peek().state.day.location === 'cafe' ? 'home' : 'cafe';
    const [ms, answer] = time(() => send('DAY_MOVE', { location: where }));
    sample.command.push(ms);
    if (answer.state.day.home.exitTarget) send('DAY_EXIT');
  }
  for (let i = 0; i < repeat; i++) { pulse(1000); sample.read.push(time(() => store.read())[0]); }
  for (let i = 0; i < repeat; i++) {
    at += 1000;
    const [ms, answer] = time(() => store.presence(surface));
    receipt = answer.presence; sample.presence.push(ms); sample.presenceBytes.push(Buffer.byteLength(JSON.stringify(answer)));
  }
  revision = store.peek().state.revision;
  const stats = store.stats();
  // events counts the lines after the sampling too (its boundaries and commands add some).
  rows.push({ target, events: stats.lines, receipts: stats.receipts, worldBytes: stats.worldBytes,
    ...(dir ? { eventFileBytes: stats.eventBytes, receiptFileBytes: stats.receiptBytes } : {}),
    pulse: spread(sample.pulse), pulseBytes: quantile(sample.pulseBytes, 0.5),
    boundary: spread(sample.boundary), command: spread(sample.command), read: spread(sample.read),
    oldPresence: spread(sample.presence), oldPresenceBytes: quantile(sample.presenceBytes, 0.5) });
  console.log(JSON.stringify(rows.at(-1)));
}
// 7일 부재 결산 한 번(W6, §15-4): 마을 씨앗 12가 한 번 결산한 뒤 7일 비웠다가 읽을 때의 저장소 결산 시간(중앙·최악).
const absence = [];
for (let i = 0; i < 12; i++) {
  let clock = Date.UTC(2026, 9, 23, 3, 0);
  const awayDir = dir ? fs.mkdtempSync(path.join(dir, 'absence-')) : null;
  const away = createStore({ ...(awayDir ? { dir: awayDir } : {}), now: () => clock, tz: 540, villageSeed: `bench-absence-${i}`, sleeps: true });
  const window = { surfaceId: 'bench-away', surface: 'day', foreground: true, safe: true };
  away.pulse(window); away.read();
  clock += 7 * 24 * 3600000;
  const t0 = performance.now();
  away.pulse(window); away.read();
  absence.push(performance.now() - t0);
}
const absenceMedian = +quantile(absence, 0.5).toFixed(1), absenceWorst = +Math.max(...absence).toFixed(1);
const seconds = +((performance.now() - started) / 1000).toFixed(1);
const first = rows[0], last = rows.at(-1);
const within = (a, b) => b <= Math.max(a * 1.1, a + 0.05);
const checks = [
  ['맥박 시간 ±10%(p50, 사건 0 대비 — 0.05ms 안의 차는 같음으로)', rows.every(row => within(first.pulse.p50, row.pulse.p50)), rows.map(row => row.pulse.p50).join(' · ')],
  ['맥박 응답 크기 ±10%', rows.every(row => Math.abs(row.pulseBytes - first.pulseBytes) <= first.pulseBytes * 0.1), rows.map(row => row.pulseBytes).join(' · ')],
  [`경계 신호 p95 30ms(사건 ${last.events})`, last.boundary.p95 <= 30, `${last.boundary.p95}ms`],
  [`명령 p95 50ms(사건 ${last.events})`, last.command.p95 <= 50, `${last.command.p95}ms`],
  ['세계 64KB 안', rows.every(row => row.worldBytes <= 65536), rows.map(row => row.worldBytes).join(' · ')],
  // 처음 기준은 20ms였고, 돌아온 순간 한 번이라 중앙 50ms로 고쳤다(10-27 결정 — 실측 중앙 23ms).
  ['7일 부재 결산 중앙 50ms(마을 씨앗 12)', absenceMedian <= 50, `중앙 ${absenceMedian}ms · 최악 ${absenceWorst}ms`],
];
for (const [name, ok, value] of checks) console.log(`${ok === null ? '·' : ok ? '✓' : '✗'} ${name}: ${value}`);
console.log(`저장 ${dir ? '갈래 폴더(임시)' : '메모리'} · 반복 ${repeat} · ${seconds}초`);
if (out) fs.writeFileSync(out, JSON.stringify({ storage: dir ? 'branch-folder' : 'memory', repeat, seconds, rows, absence: { median: absenceMedian, worst: absenceWorst },
  checks: checks.map(([name, ok, value]) => ({ name, ok, value })) }, null, 2));
if (dir) fs.rmSync(dir, { recursive: true, force: true });
process.exitCode = checks.every(([, ok]) => ok !== false) ? 0 : 1;
