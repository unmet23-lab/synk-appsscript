// 탁구 손맛 소리 합성이 브랜드 사운드킷 규칙(‘게임 효과음’)을 지키는지 본다(docs/브랜드_사운드킷/_사운드킷.md).
// 브라우저 없이 가짜 오디오 문맥으로 소리마다 만든 음(파형·음높이)과 멈추는 시각을 모은다(빈칸 베기 sfx.test.mjs와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PENTA, VOICES, rallyNote, swingPower, createBus, softLimit } from './sfx.mjs';

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
function voice(name, opts = {}) {
  const { c, made } = mockContext();
  const b = createBus(c, { seed: 3 }), from = made.length;
  const end = VOICES[name](b, 1, opts);
  const nodes = made.slice(from);
  const tones = nodes.filter((n) => n.kind === 'osc').map((n) => ({ type: n.type, freqs: n.frequency.events.map((e) => e[1]), start: n.t0 - 1, stop: n.t1 - 1 }));
  const stops = nodes.filter((n) => n.t1 != null).map((n) => n.t1 - 1);
  return { end, tones, stops, noise: nodes.filter((n) => n.kind === 'noise').length };
}
const PC = new Set([0, 2, 4, 7, 9]);   // 도·레·미·솔·라
const inPenta = (f) => { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return Math.abs(m - r) < 0.06 && PC.has(((r % 12) + 12) % 12); };

const CASES = [['opponent', { power: 0.2 }], ['opponent', { power: 1 }], ['bounce', { near: 0 }], ['bounce', { near: 1, x: 0.5 }],
  ['swing', { power: 0 }], ['swing', { power: 1, to: 0.8 }], ['hit', { correct: false }], ['star', { i: 0 }], ['star', { i: 2 }]];
for (const rally of [1, 2, 3, 6, 9, 14]) CASES.push(['hit', { correct: true, rally }], ['hit', { correct: true, rally, smash: true }]);

test('규칙 ①③④: 소리마다 400ms 이하, 음은 사인·트라이앵글만, 음높이는 C 펜타토닉 안(미끄럼은 시작·끝음)', () => {
  for (const [name, opts] of CASES) {
    const v = voice(name, opts), label = `${name} ${JSON.stringify(opts)}`;
    assert.ok(v.end <= 0.4, `${label}: ${v.end}s`);
    assert.ok(Math.max(...v.stops) <= v.end + 1e-9, `${label}: 알린 길이보다 늦게 끝나는 층이 있다`);
    assert.ok(v.tones.length + v.noise > 0, `${label}: 소리가 있다`);
    for (const t of v.tones) {
      assert.ok(['sine', 'triangle'].includes(t.type), `${label}: ${t.type}`);
      for (const f of t.freqs) assert.ok(inPenta(f), `${label}: ${f}Hz는 C 펜타토닉 밖`);
    }
  }
});

test('규칙 ②: 틀린 대답으로 받아친 소리는 맞힌 소리에서 ‘팅’만 빠진다(새 음·내려가는 긴 음 없음)', () => {
  const ok = voice('hit', { correct: true, rally: 1 }), ko = voice('hit', { correct: false });
  const key = (t) => `${t.type}:${t.freqs.join('>')}`;
  const okKeys = new Set(ok.tones.map(key));
  for (const t of ko.tones) assert.ok(okKeys.has(key(t)), `틀림에만 있는 음 ${key(t)}`);
  assert.ok(ko.tones.length < ok.tones.length, '틀림에는 ‘팅’이 없다');
  assert.ok(ko.end <= 0.12, '틀림은 짧게 끝난다');
});

test('스매시는 보통 맞힘보다 층이 많다(낮은 쿵·바람·두 칸 위 음), 잡음은 짧은 순간 층만', () => {
  const plain = voice('hit', { correct: true, rally: 3 }), smash = voice('hit', { correct: true, rally: 3, smash: true });
  assert.ok(smash.tones.length > plain.tones.length);
  assert.ok(smash.noise > plain.noise);
  assert.ok(voice('bounce', {}).noise === 1 && voice('opponent', {}).noise === 1);
});

test('랠리 계단: 이어질수록 한 칸씩 오르고 10번째부터 같은 음, 휘두르기 세기는 0~1', () => {
  const notes = Array.from({ length: 12 }, (_, i) => rallyNote(i + 1));
  for (let i = 1; i < 10; i++) assert.ok(notes[i] > notes[i - 1]);
  assert.equal(notes[11], PENTA[PENTA.length - 1]);
  assert.equal(swingPower(0), 0); assert.equal(swingPower(99), 1);
});

test('리미터: 빈칸 베기와 같은 곡선(-3dBFS까지 그대로, 두 배 크기도 0.93 아래)', () => {
  const curve = softLimit(), n = curve.length, at = (u) => curve[Math.round(((u / 2 + 1) / 2) * (n - 1))];
  for (const u of [0, 0.35, 0.69, -0.69]) assert.ok(Math.abs(at(u) - u) < 0.002);
  assert.ok(at(2) <= 0.93 && at(-2) >= -0.93);
});
