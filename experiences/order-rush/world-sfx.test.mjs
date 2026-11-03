// 주문 폭주 WORLD 카페 효과음이 브랜드 사운드킷 셋째 가족 규칙을 지키는지 본다(docs/브랜드_사운드킷/_사운드킷.md).
// 브라우저 없이 가짜 오디오 문맥으로 소리마다 만든 음(파형 · 음높이) · 잡음 거르개 · 멈추는 시각을 모은다(빈칸 베기 sfx.test.mjs와 같은 꼴).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUNDS, PENTA, FILL, GUEST_CHIME, LEVEL, comboNote, createBus, renderSfx, softLimit } from './world-sfx.mjs';
import { ICE_LAND } from './stage.mjs';

function mockContext() {
  const made = [];
  const param = (v = 0) => {
    const p = { value: v, events: [] };
    for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) p[k] = (x, t) => { p.events.push([k, x, t]); return p; };
    return p;
  };
  const node = (kind, extra = {}) => { const n = { kind, connect: (d) => d, ...extra }; made.push(n); return n; };
  const c = {
    sampleRate: 8000, currentTime: 0, state: 'running', destination: node('dest'),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), start(t) { this.t0 = t; }, stop(t) { this.t1 = t; } }),
    createBufferSource: () => node('noise', { buffer: null, start(t, off, dur) { this.t0 = t; this.t1 = t + (dur ?? this.buffer.duration); }, stop(t) { this.t1 = Math.min(this.t1 ?? t, t); } }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: { value: 1 } }),
    createWaveShaper: () => node('shaper', { curve: null }),
    createBuffer: (ch, n, sr) => { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { duration: n / sr, length: n, numberOfChannels: ch, getChannelData: (i) => d[i] }; },
  };
  return { c, made };
}
/** 소리 하나를 1초 시각에 만들고, 그때 생긴 음 · 잡음 · 거르개와 끝나는 시각을 돌려준다. */
function voice(name, opts = {}, seed = 3) {
  const { c, made } = mockContext();
  const bus = createBus(c, { seed }), from = made.length;
  const end = renderSfx(bus, name, 1, opts);
  const nodes = made.slice(from);
  const tones = nodes.filter((n) => n.kind === 'osc').map((n) => ({ type: n.type, freqs: n.frequency.events.map((e) => e[1]), start: n.t0 - 1, stop: n.t1 - 1 }));
  const stops = nodes.filter((n) => n.t1 != null).map((n) => n.t1 - 1);
  const filters = nodes.filter((n) => n.kind === 'filter').map((n) => ({ type: n.type, q: n.Q.value }));
  const gains = nodes.filter((n) => n.kind === 'gain');
  return { end, tones, stops, filters, noise: nodes.filter((n) => n.kind === 'noise').length, gains, made: nodes };
}
const PC = new Set([0, 2, 4, 7, 9]);   // 도 · 레 · 미 · 솔 · 라
const inPenta = (f) => { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return Math.abs(m - r) < 0.06 && PC.has(((r % 12) + 12) % 12); };

const CASES = [];
for (const name of Object.keys(SOUNDS)) {
  CASES.push([name, {}]);
  if (['coffee', 'tea', 'milk', 'ice', 'sugar', 'cold'].includes(name)) for (const step of [1, 3, 5, 7]) CASES.push([name, { step }]);
}
for (const guest of Object.keys(GUEST_CHIME)) CASES.push(['arrive', { guest }], ['leave', { guest }]);
for (const combo of [1, 2, 3, 5, 9]) CASES.push(['correct', { combo }]);
for (const n of [0, 1]) CASES.push(['tick', { n }], ['tick', { n, last: true }]);
CASES.push(['remove', { step: 4 }], ['ice', { step: 3, hits: ICE_LAND }], ['ice', { hits: ICE_LAND }]);

test('규칙 ①③④: 소리마다 400ms 이하, 음은 사인 · 트라이앵글만, 음높이는 C 펜타토닉 안(미끄럼도)', () => {
  for (const seed of [1, 3, 11]) {
    for (const [name, opts] of CASES) {
      const v = voice(name, opts, seed), label = `${name} ${JSON.stringify(opts)} seed ${seed}`;
      assert.ok(v.end <= 0.4, `${label}: ${v.end}s`);
      assert.ok(Math.max(...v.stops) <= v.end + 1e-9, `${label}: 마지막 소리가 알린 길이보다 늦다`);
      assert.ok(v.tones.length + v.noise > 0, `${label}: 소리가 있다`);
      for (const t of v.tones) {
        assert.ok(['sine', 'triangle'].includes(t.type), `${label}: ${t.type}`);
        for (const f of t.freqs) assert.ok(inPenta(f), `${label}: ${f}Hz는 C 펜타토닉 밖`);
      }
    }
  }
});

test('잡음은 넓은 대역만: 띠 거르개 Q 0.9 이하', () => {
  for (const [name, opts] of CASES) for (const f of voice(name, opts).filters) if (f.type === 'bandpass') assert.ok(f.q <= 0.9, `${name}: Q ${f.q}`);
});

test('규칙 ②: 다름 · 떠남은 내려가는 음이 없다(벌주는 소리 없음)', () => {
  for (const [name, opts] of [['differ', {}], ...Object.keys(GUEST_CHIME).map((guest) => ['leave', { guest }])]) {
    const v = voice(name, opts), byStart = [...v.tones].sort((a, b) => a.start - b.start);
    for (const t of v.tones) for (let i = 1; i < t.freqs.length; i += 1) assert.ok(t.freqs[i] >= t.freqs[i - 1], `${name}: 미끄럼이 내려간다`);
    // 같은 때 시작하는 음은 한 음(바탕음 + 겹친 옥타브)으로 보고, 음마다 바탕음이 앞 음보다 낮지 않아야 한다
    const groups = new Map();
    for (const t of byStart) { const k = t.start.toFixed(4); groups.set(k, Math.min(groups.get(k) ?? Infinity, t.freqs[0])); }
    const firsts = [...groups.values()];
    for (let i = 1; i < firsts.length; i += 1) assert.ok(firsts[i] >= firsts[i - 1] * 0.999, `${name}: 뒤 음이 앞 음보다 낮다 ${firsts}`);
  }
  const d = voice('differ');
  assert.deepEqual([...new Set(d.tones.map((t) => Math.round(t.freqs[0])))].sort((a, b) => a - b), [392, 440]);
});

test('사다리 · 연속: 컵의 n번째 재료는 도5 레5 미5 솔5 라5, 맞음 시작음은 연속 5단계에서 멈춘다', () => {
  assert.deepEqual(FILL.map(Math.round), [523, 587, 659, 784, 880]);
  for (let step = 1; step <= 5; step += 1) {
    const v = voice('coffee', { step }), late = v.tones.filter((t) => t.start >= 0.169).map((t) => Math.round(t.freqs[0]));
    assert.ok(late.includes(Math.round(FILL[step - 1])), `커피 step ${step}: ${late}`);
  }
  const start = (combo) => Math.min(...voice('correct', { combo }).tones.filter((t) => t.start < 0.001 && t.type === 'triangle').map((t) => t.freqs[0]));
  assert.equal(Math.round(start(1)), Math.round(PENTA[0]));
  assert.equal(Math.round(start(5)), Math.round(PENTA[4]));
  assert.equal(start(9), start(5));
  assert.equal(comboNote(12), PENTA[PENTA.length - 1]);
});

test('얼음은 땡 사이 같은 음을 이어 쓰지 않고, 같은 씨앗이면 같은 소리다', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const v = voice('ice', {}, seed), clinks = v.tones.filter((t) => t.freqs[0] < 2200).sort((a, b) => a.start - b.start).map((t) => t.freqs[0]);
    for (let i = 1; i < clinks.length; i += 1) assert.notEqual(clinks[i], clinks[i - 1], `seed ${seed}: ${clinks}`);
  }
  assert.deepEqual(voice('ice', {}, 9).tones, voice('ice', {}, 9).tones);
});

test('리미터: −3dBFS까지는 그대로, 위로는 −0.6dBFS를 넘지 않는다', () => {
  assert.equal(softLimit(0.5), 0.5);
  assert.ok(softLimit(3) <= 0.93 && softLimit(3) > 0.9);
  assert.equal(softLimit(-0.7), -0.7);
});

test('크기: LEVEL은 소리재기.cjs가 잰 값 그대로이고(모두 1이면 실패), 잰 순간 음량이 목표 ±1 LU다', () => {
  const m = JSON.parse(readFileSync(new URL('./qa/world-sfx-levels.json', import.meta.url), 'utf8'));
  assert.ok(Object.values(LEVEL).some((v) => v !== 1), 'LEVEL이 아직 재지 않은 1이다');
  assert.deepEqual(Object.keys(LEVEL).sort(), Object.keys(SOUNDS).sort(), '소리마다 LEVEL이 있다');
  assert.deepEqual(LEVEL, m.level, 'LEVEL을 고쳤으면 소리재기.cjs --쓰기로 다시 재야 한다');
  for (const [name, target] of Object.entries(m.target)) {
    assert.ok(Math.abs(m.measuredLufs[name] - target) <= 1, `${name}: ${m.measuredLufs[name]} LUFS(목표 ${target})`);
    assert.ok(m.peakDbfs[name] <= -0.6, `${name}: 최대 ${m.peakDbfs[name]}dBFS`);
  }
});

test('시작 표본 튐 없음: 음 · 잡음마다 크기 노드는 0에서 시작한다(기본값 1이 첫 표본에 새면 딸깍)', () => {
  for (const [name, opts] of CASES) {
    const v = voice(name, opts);
    const sources = v.made.filter((n) => n.kind === 'osc' || n.kind === 'noise').length;
    const fromZero = v.gains.filter((g) => g.gain.value === 0).length;
    assert.ok(fromZero >= sources, `${name} ${JSON.stringify(opts)}: 소리 ${sources}개 · 0에서 시작하는 크기 ${fromZero}개`);
  }
});

test('얼음은 3D 얼음이 컵 바닥에 닿는 시각(ICE_LAND)에 땡이 난다', () => {
  for (const seed of [1, 4, 9]) {
    const v = voice('ice', { step: 2, hits: ICE_LAND }, seed);
    const clinks = v.tones.filter((t) => t.freqs[0] >= 1300 && t.freqs[0] < 2200).map((t) => t.start).sort((a, b) => a - b);
    assert.equal(clinks.length, ICE_LAND.length);
    clinks.forEach((at, i) => assert.ok(Math.abs(at - (ICE_LAND[i] + 0.002)) < 1e-6, `땡 ${i}: ${at}`));
  }
});
