// WORLD 캠퍼스 판 종이 소리가 브랜드 사운드킷 규칙을 지키는지 본다(docs/브랜드_사운드킷/_사운드킷.md) — sfx.test.mjs와 같은 가짜 오디오 문맥.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBus } from './sfx.mjs';
import { VOICES, KIT_MAP, LEVEL } from './world-sfx.mjs';

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
  const tones = nodes.filter((n) => n.kind === 'osc').map((n) => ({ type: n.type, freqs: n.frequency.events.map((e) => e[1]) }));
  const stops = nodes.filter((n) => n.t1 != null).map((n) => n.t1 - 1);
  const band = nodes.filter((n) => n.kind === 'filter' && n.type === 'bandpass').map((n) => n.Q.value);
  return { end, tones, stops, band, noise: nodes.filter((n) => n.kind === 'noise').length };
}
const PC = new Set([0, 2, 4, 7, 9]);   // 도·레·미·솔·라
const inPenta = (f) => { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return Math.abs(m - r) < 0.06 && PC.has(((r % 12) + 12) % 12); };

const CASES = [
  ['whoosh', { power: 0 }], ['whoosh', { power: 1 }], ['launch', { n: 2 }], ['snap', {}], ['nudge', {}], ['streak', {}], ['tap', {}],
  ['slice', { correct: false }], ...[1, 3, 4, 9, 12].map((combo) => ['slice', { correct: true, combo }]),
  ['mark', { ok: false }], ...[1, 5, 12].map((step) => ['mark', { ok: true, step }]), ...[0, 1, 2].map((i) => ['star', { i }]),
];

test('규칙 ①③④⑤: 소리마다 400ms 이하, 음은 사인·트라이앵글만, 음높이는 C 펜타토닉 안, 띠 거르개는 넓게', () => {
  for (const [name, opts] of CASES) {
    const v = voice(name, opts), label = `${name} ${JSON.stringify(opts)}`;
    assert.ok(v.end <= 0.4, `${label}: ${v.end}s`);
    assert.ok(Math.max(...v.stops) <= v.end + 1e-9, `${label}: 마지막 소리 ${Math.max(...v.stops)}s > 알린 길이 ${v.end}s`);
    assert.ok(v.tones.length + v.noise > 0, `${label}: 소리가 있다`);
    for (const t of v.tones) {
      assert.ok(['sine', 'triangle'].includes(t.type), `${label}: ${t.type}`);
      for (const f of t.freqs) assert.ok(inPenta(f), `${label}: ${f}Hz는 C 펜타토닉 밖`);
    }
    for (const q of v.band) assert.ok(q <= 0.9, `${label}: 띠 거르개 Q ${q} — 좁으면 무전 잡음`);
  }
});

test('규칙 ②: 틀리게 벤 소리는 맞힌 소리에서 「팅」만 빠진다(찢는 소리는 그대로, 새 음 · 내려가는 긴 음 없음)', () => {
  const ok = voice('slice', { correct: true, combo: 1 }), ko = voice('slice', { correct: false });
  const key = (t) => `${t.type}:${t.freqs.join('>')}`;
  const okKeys = new Set(ok.tones.map(key));
  for (const t of ko.tones) assert.ok(okKeys.has(key(t)), `틀림에만 있는 음 ${key(t)}`);
  assert.ok(ko.tones.length < ok.tones.length, '틀림에는 「팅」이 없다');
  assert.ok(ko.noise >= 20, `찢는 알갱이 잡음이 틀림에도 그대로다(${ko.noise})`);
  assert.equal(voice('mark', { ok: false }).tones.length, 0, '틀린 문장의 빨간 펜에는 음이 없다');
  const nudge = voice('nudge').tones.map((t) => t.freqs[0]);
  assert.ok(nudge[1] > nudge[0], '몽글 「괜찮아」 자리의 두 음은 오른다');
});

test('찢는 소리는 칙 · 찌이익 · 툭 · 파사삭 네 겹이 0.2초 안에 든다(더 길어지면 다음 소리를 흐린다)', () => {
  const v = voice('slice', { correct: false });
  assert.ok(v.noise >= 25, `알갱이 + 바탕 + 칼끝 + 팔랑(${v.noise})`);
  assert.ok(v.tones.length === 2, '무게 「툭」과 몸통 「톡」');
  assert.ok(Math.max(...v.stops) <= 0.23);
});

test('몽글 목소리 파일은 앱에서 울리지 않는다: audio.mjs의 mongle 파일은 모두 KIT_MAP에 있고, 갈 곳은 VOICES이거나 null이다', () => {
  const src = readFileSync(new URL('./audio.mjs', import.meta.url), 'utf8');
  const names = [...src.matchAll(/(\w+): 'assets\/sound\/mongle-[^']+'/g)].map((m) => m[1]);
  assert.ok(names.length >= 6, `몽글 파일 ${names}`);
  for (const n of names) assert.ok(n in KIT_MAP, `${n}이 KIT_MAP에 없다`);
  for (const [n, to] of Object.entries(KIT_MAP)) assert.ok(to === null || VOICES[to], `${n} → ${to}`);
});

test('크기 값은 소리재기.cjs가 맞춘 값 그대로다(소리를 고치면 다시 재서 고친다)', () => {
  for (const k of ['slice', 'snap', 'launch', 'nudge', 'streak', 'tap', 'mark']) assert.ok(LEVEL[k] > 0 && LEVEL[k] < 10, k);
  assert.equal(VOICES.whoosh.name, 'whoosh', '휘두르기는 LAB 펠트 소리 그대로');
});
