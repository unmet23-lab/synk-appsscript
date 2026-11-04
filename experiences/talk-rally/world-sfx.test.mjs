// 말 랠리 WORLD 화면 효과음이 브랜드 사운드킷 셋째 가족 규칙을 지키는지 본다(주문 폭주 world-sfx.test.mjs의 공통 시험 — 브라우저 없이 가짜 오디오 문맥으로).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUNDS, LEVEL, createBus, renderSfx, softLimit } from './world-sfx.mjs';

function mockContext() {
  const made = [];
  const param = (v = 0) => {
    const p = { value: v, events: [] };
    for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) p[k] = (x, t) => { p.events.push([k, x, t]); };
    return p;
  };
  const node = (kind, extra = {}) => { const n = { kind, connect: (d) => d, ...extra }; made.push(n); return n; };
  const c = {
    sampleRate: 8000, currentTime: 0, state: 'running', destination: node('dest'),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), start(t) { this.t0 = t; }, stop(t) { this.t1 = t; } }),
    createBufferSource: () => node('noise', { buffer: null, start(t, off, dur) { this.t0 = t; this.t1 = t + (dur ?? this.buffer.duration); }, stop(t) { this.t1 = t; } }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: { value: 1 } }),
    createWaveShaper: () => node('shaper', { curve: null }),
    createBuffer: (ch, n, sr) => { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { duration: n / sr, length: n, numberOfChannels: ch, getChannelData: (i) => d[i] }; },
  };
  return { c, made };
}
function voice(name, opts = {}, seed = 3) {
  const { c, made } = mockContext();
  const bus = createBus(c, { seed }), from = made.length;
  const end = renderSfx(bus, name, 1, opts);
  const nodes = made.slice(from);
  return { end, tones: nodes.filter((n) => n.kind === 'osc').map((n) => ({ type: n.type, freqs: n.frequency.events.map((e) => e[1]) })), stops: nodes.filter((n) => n.t1 != null).map((n) => n.t1 - 1),
    noise: nodes.filter((n) => n.kind === 'noise').length, filters: nodes.filter((n) => n.kind === 'filter').map((n) => ({ type: n.type, q: n.Q.value })), gains: nodes.filter((n) => n.kind === 'gain'), made: nodes };
}
const PC = new Set([0, 2, 4, 7, 9]);   // 도 · 레 · 미 · 솔 · 라
const inPenta = (f) => { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return Math.abs(m - r) < 0.06 && PC.has(((r % 12) + 12) % 12); };
const CASES = [...Object.keys(SOUNDS).map((name) => [name, {}]), ['far', { hi: true }], ['tick', { n: 1, last: true }]];

test('규칙 ①③④: 소리마다 400ms 이하, 음은 사인 · 트라이앵글만, 음높이는 C 펜타토닉 안', () => {
  for (const seed of [1, 3, 11]) for (const [name, opts] of CASES) {
    const v = voice(name, opts, seed), label = `${name} ${JSON.stringify(opts)} seed ${seed}`;
    assert.ok(v.end <= 0.4, `${label}: ${v.end}s`);
    assert.ok(Math.max(...v.stops) <= v.end + 1e-9, `${label}: 마지막 소리가 알린 길이보다 늦다`);
    assert.ok(v.tones.length + v.noise > 0, `${label}: 소리가 있다`);
    for (const t of v.tones) {
      assert.ok(['sine', 'triangle'].includes(t.type), `${label}: ${t.type}`);
      for (const f of t.freqs) assert.ok(inPenta(f), `${label}: ${f}Hz는 C 펜타토닉 밖`);
    }
  }
});

test('시작음이 없는 실패음: 이 파일에는 틀렸을 때 내는 소리가 없다(규칙 ②)', () => {
  for (const name of Object.keys(SOUNDS)) assert.ok(!/wrong|fail|miss|buzz/i.test(name), name);
});

test('크기: LEVEL은 소리재기.cjs가 잰 값 그대로이고, 잰 순간 음량이 목표 ±1 LU다', () => {
  const m = JSON.parse(readFileSync(new URL('./qa/world-sfx-levels.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(LEVEL).sort(), Object.keys(SOUNDS).sort(), '소리마다 LEVEL이 있다');
  assert.deepEqual(LEVEL, m.level, 'LEVEL을 고쳤으면 소리재기.cjs --쓰기로 다시 재야 한다');
  for (const [name, target] of Object.entries(m.target)) {
    assert.ok(Math.abs(m.measuredLufs[name] - target) <= 1, `${name}: ${m.measuredLufs[name]} LUFS(목표 ${target})`);
    assert.ok(m.peakDbfs[name] <= -0.6, `${name}: 최대 ${m.peakDbfs[name]}dBFS`);
  }
});

test('시작 표본 튐 없음: 음 · 잡음마다 크기 노드는 0에서 시작한다', () => {
  for (const [name, opts] of CASES) {
    const v = voice(name, opts);
    const sources = v.made.filter((n) => n.kind === 'osc' || n.kind === 'noise').length;
    assert.ok(v.gains.filter((g) => g.gain.value === 0).length >= sources, `${name} ${JSON.stringify(opts)}`);
  }
});

test('리미터: −3dBFS까지는 그대로, 위로는 −0.6dBFS를 넘지 않는다', () => {
  assert.equal(softLimit(0.5), 0.5);
  assert.ok(softLimit(3) <= 0.93 && softLimit(3) > 0.9);
});
