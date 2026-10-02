// 손맛 소리 합성이 브랜드 사운드킷 규칙을 지키는지 본다(docs/브랜드_사운드킷/_사운드킷.md).
// 브라우저 없이 가짜 오디오 문맥으로 소리마다 만든 음(파형·음높이)과 멈추는 시각을 모은다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PENTA, VARIANTS, VOICES, comboNote, swingPower, createBus, softLimit } from './sfx.mjs';

function mockContext() {
  const made = [];
  const param = (v = 0) => {
    const p = { value: v, events: [] };
    for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) p[k] = (x, t) => { p.events.push([k, x, t]); return p; };
    return p;
  };
  const node = (kind, extra = {}) => { const n = { kind, connect: (d) => d, ...extra }; made.push(n); return n; };
  const c = {
    sampleRate: 8000, destination: node('dest'),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), start(t) { this.t0 = t; }, stop(t) { this.t1 = t; } }),
    createBufferSource: () => node('noise', { buffer: null, start(t, off, dur) { this.t0 = t; this.t1 = t + (dur ?? this.buffer.duration); } }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createConvolver: () => node('conv', { buffer: null }),
    createWaveShaper: () => node('shaper', { curve: null, oversample: 'none' }),
    createBuffer: (ch, n, sr) => { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { duration: n / sr, length: n, numberOfChannels: ch, getChannelData: (i) => d[i] }; },
  };
  return { c, made };
}
/** 소리 하나를 1초 시각에 만들고, 그때 생긴 음·잡음과 끝나는 시각을 돌려준다. */
function voice(name, opts = {}) {
  const { c, made } = mockContext();
  const b = createBus(c, { seed: 3 }), from = made.length;
  const end = VOICES[name](b, 1, opts);
  const nodes = made.slice(from);
  const tones = nodes.filter((n) => n.kind === 'osc').map((n) => ({
    type: n.type, freqs: n.frequency.events.map((e) => e[1]), start: n.t0 - 1, stop: n.t1 - 1,
  }));
  const stops = nodes.filter((n) => n.t1 != null).map((n) => n.t1 - 1);
  return { end, tones, stops, noise: nodes.filter((n) => n.kind === 'noise').length };
}
const PC = new Set([0, 2, 4, 7, 9]);   // 도·레·미·솔·라
const inPenta = (f) => { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return Math.abs(m - r) < 0.06 && PC.has(((r % 12) + 12) % 12); };

const CASES = [];
for (const variant of VARIANTS) {
  CASES.push(['whoosh', { power: 0, variant }], ['whoosh', { power: 1, variant }], ['launch', { n: 2, variant }], ['slice', { correct: false, variant }]);
  for (const combo of [1, 3, 4, 9, 12]) CASES.push(['slice', { correct: true, combo, variant }]);
}
CASES.push(['snap', {}], ['star', { i: 0 }], ['star', { i: 1 }], ['star', { i: 2 }]);

test('규칙 ①③④: 소리마다 400ms 이하, 음은 사인·트라이앵글만, 음높이는 C 펜타토닉 안(미끄럼은 시작·끝음)', () => {
  for (const [name, opts] of CASES) {
    const v = voice(name, opts), label = `${name} ${JSON.stringify(opts)}`;
    const last = Math.max(...v.stops);
    assert.ok(v.end <= 0.4, `${label}: ${v.end}s`);
    assert.ok(last <= v.end + 1e-9, `${label}: 마지막 소리 ${last}s > 알린 길이 ${v.end}s`);
    assert.ok(v.tones.length + v.noise > 0, `${label}: 소리가 있다`);
    for (const t of v.tones) {
      assert.ok(['sine', 'triangle'].includes(t.type), `${label}: ${t.type}`);
      for (const f of t.freqs) assert.ok(inPenta(f), `${label}: ${f}Hz는 C 펜타토닉 밖`);
    }
  }
});

test('규칙 ②: 틀리게 벤 소리는 맞힌 소리에서 ‘팅’만 빠진다(새 음·내려가는 긴 음 없음)', () => {
  for (const variant of VARIANTS) {
    const ok = voice('slice', { correct: true, combo: 1, variant }), ko = voice('slice', { correct: false, variant });
    const key = (t) => `${t.type}:${t.freqs.join('>')}`;
    const okKeys = new Set(ok.tones.map(key));
    for (const t of ko.tones) assert.ok(okKeys.has(key(t)), `${variant}: 틀림에만 있는 음 ${key(t)}`);
    assert.ok(ko.tones.length < ok.tones.length, `${variant}: 틀림에는 ‘팅’이 없다`);
    assert.ok(ko.end <= 0.16, `${variant}: 틀림은 짧게 끝난다`);
  }
});

test('B(맑은 사인)는 잡음을 쓰지 않는다, A(펠트 사각)는 베기·바람에 잡음 층이 있다', () => {
  for (const name of ['whoosh', 'slice', 'launch']) {
    assert.equal(voice(name, { variant: 'clean' }).noise, 0, `${name} B`);
  }
  assert.ok(voice('slice', { variant: 'felt' }).noise >= 2);
  assert.ok(voice('whoosh', { variant: 'felt' }).noise >= 1);
});

test('연속 계단: 맞힐수록 한 칸씩 오르고 10번째부터 같은 음, 휘두르기 세기는 0~1', () => {
  const notes = Array.from({ length: 12 }, (_, i) => comboNote(i + 1));
  for (let i = 1; i < 10; i++) assert.ok(notes[i] > notes[i - 1], `${i + 1}번째가 더 높다`);
  assert.equal(notes[11], PENTA[PENTA.length - 1]);
  assert.equal(comboNote(0), PENTA[0]);
  assert.equal(swingPower(0), 0); assert.equal(swingPower(99), 1);
  assert.ok(swingPower(1.2) < swingPower(2));
});

test('리미터: -3dBFS(0.7)까지는 그대로, 겹친 소리(두 배 크기)도 0.93을 넘지 않게 부드럽게', () => {
  const curve = softLimit(), n = curve.length, at = (u) => curve[Math.round(((u / 2 + 1) / 2) * (n - 1))];
  for (const u of [0, 0.1, 0.35, 0.5, 0.69]) assert.ok(Math.abs(at(u) - u) < 0.002, `${u}`);
  for (const u of [-0.69, -0.3]) assert.ok(Math.abs(at(u) - u) < 0.002, `${u}`);
  assert.ok(at(0.8) < 0.8 && at(0.8) > 0.78, '조금 넘으면 조금만 누른다');
  assert.ok(at(2) <= 0.93 && at(2) > 0.92 && at(-2) >= -0.93, '두 배여도 -0.6dBFS 아래');
  for (let i = 1; i < n; i++) assert.ok(curve[i] >= curve[i - 1], '꺾이지 않고 늘 오른다');
});
