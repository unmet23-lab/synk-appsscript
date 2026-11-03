// 말의 리듬 WORLD 효과음의 규칙 시험(2026-11-04) — 브랜드 사운드킷 셋째 가족(주문 폭주 world-sfx.test.mjs와 같은 규칙):
// 400ms 이하 · 실패음 없음(내려가는 음 없음) · 사인/트라이앵글만 · C 펜타토닉 안 · 몸통 도4 이상 · 넓은 잡음만 · 크기가 잰 값과 같음.
// 키음은 90ms 안, 문장 안내음은 음성 전에 끝난다(0.45초 앞에서 시작). 소리 그래프를 가짜 AudioContext에 그려 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUNDS, LEVEL, createBus, renderSfx, LANE_NOTE, PENTA, softLimit } from './world-sfx.mjs';

const PITCH_CLASSES = new Set([0, 2, 4, 7, 9]);   // C D E G A
const inScale = (f) => PITCH_CLASSES.has(((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12);

function fakeContext() {
  const log = { tones: [], noises: [], filters: [] };
  const param = (name) => ({ value: 0, setValueAtTime(v) { if (name === 'freq') log.last = v; return this; }, exponentialRampToValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, setTargetAtTime() { return this; } });
  const node = () => ({ connect() { return this; }, disconnect() {}, gain: param('gain') });
  const c = {
    sampleRate: 8000, currentTime: 0, destination: node(), state: 'running',
    createGain: () => node(),
    createWaveShaper: () => ({ ...node(), curve: null }),
    createBuffer: (_ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createOscillator() {
      const o = { ...node(), type: 'sine', frequency: { setValueAtTime(v) { o.f = v; }, exponentialRampToValueAtTime(v) { o.f2 = v; } }, start(t) { o.t = t; }, stop(t) { o.end = t; log.tones.push(o); } };
      return o;
    },
    createBufferSource() {
      const s = { ...node(), buffer: null, start(t) { s.t = t; }, stop(t) { s.end = t; log.noises.push(s); } };
      return s;
    },
    createBiquadFilter() {
      const f = { ...node(), type: '', Q: { value: 0 }, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
      log.filters.push(f);
      return f;
    },
  };
  return { c, log };
}
function render(name, opts = {}) {
  const { c, log } = fakeContext();
  const bus = createBus(c, { seed: 3 });
  const end = renderSfx(bus, name, 0, opts);
  return { end, log };
}
const VARIANTS = { key: [{ lane: 0, quality: 1 }, { lane: 1, quality: 1 }, { lane: 0, quality: 0.8 }, { lane: 1, quality: 0.5 }], pick: [{ lane: 0 }, { lane: 1 }], count: [{ accent: false }, { accent: true }],
  right: [1, 2, 3, 4, 5].map((n) => ({ n })), dot: [{ step: 1, ok: true }, { step: 5, ok: true }, { ok: false }] };
const cases = () => Object.keys(SOUNDS).flatMap((name) => (VARIANTS[name] || [{}]).map((opts) => [name, opts]));

test('모든 소리는 400ms 이하', () => {
  for (const [name, opts] of cases()) { const { end } = render(name, opts); assert.ok(end > 0 && end <= 0.4, `${name} ${JSON.stringify(opts)} = ${end}`); }
});
test('음 있는 층은 사인 · 트라이앵글, C 펜타토닉 안, 몸통 도4 이상', () => {
  for (const [name, opts] of cases()) for (const o of render(name, opts).log.tones) {
    assert.ok(['sine', 'triangle'].includes(o.type), `${name} ${o.type}`);
    assert.ok(inScale(o.f), `${name} ${o.f}Hz`);
    assert.ok(o.f >= 261, `${name} ${o.f}Hz`);
  }
});
test('실패음이 없다: 틀림 · 놓침에 내려가는 음이 없다', () => {
  const tones = render('differ').log.tones.sort((a, b) => a.t - b.t);
  assert.ok(tones[tones.length - 1].f >= tones[0].f, '다름은 오르는 두 음');
  assert.ok(!('miss' in SOUNDS) && !('fail' in SOUNDS), '놓침 소리는 만들지 않는다');
});
test('넓은 잡음만: 띠 거르개 Q ≤ 0.9', () => {
  for (const [name, opts] of cases()) for (const f of render(name, opts).log.filters) if (f.type === 'bandpass') assert.ok(f.Q.value <= 0.9, `${name} Q ${f.Q.value}`);
});
test('키음: 90ms 안, O · X 레인이 다른 음, 딱!만 위 반짝이 한 겹 더, 아쉬워요는 어둡게', () => {
  for (const q of [1, 0.8, 0.5]) assert.ok(render('key', { lane: 0, quality: q }).end <= 0.09, `quality ${q}`);
  assert.notEqual(LANE_NOTE[0], LANE_NOTE[1]);
  const perfect = render('key', { lane: 0, quality: 1 }).log.tones, great = render('key', { lane: 0, quality: 0.8 }).log.tones, good = render('key', { lane: 0, quality: 0.5 }).log.tones;
  assert.ok(perfect.length > great.length, '딱!은 층이 더 많다');
  assert.ok(Math.max(...good.map((o) => o.f)) < Math.max(...great.map((o) => o.f)), '아쉬워요는 더 낮다');
});
test('문장 안내음은 음성 전에 끝난다(음성 0.45초 전에 시작)', () => {
  assert.ok(render('listen').end < 0.45);
});
test('맞음 소리의 계단이 범위 안(5칸 천장)', () => {
  assert.ok(PENTA.length >= 10);
  for (const n of [1, 3, 5, 9]) for (const o of render('right', { n }).log.tones) assert.ok(inScale(o.f));
});
test('리미터는 표본을 0.93 안으로 누른다', () => {
  for (const x of [0.2, 0.7, 1, 2, 10]) assert.ok(Math.abs(softLimit(x)) <= 0.93);
});
test('크기: 잰 기록과 LEVEL이 같고 모두 목표 ±1 LU, 최대가 리미터 천장(−0.6dBFS) 아래', () => {
  const rec = JSON.parse(readFileSync(new URL('./qa/world-sfx-levels.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(rec.level).sort(), Object.keys(SOUNDS).sort(), '소리 이름이 같다');
  for (const [name, v] of Object.entries(rec.level)) {
    assert.equal(LEVEL[name], v, name);
    assert.ok(Math.abs(rec.measuredLufs[name] - rec.target[name]) <= 1, `${name} ${rec.measuredLufs[name]} / ${rec.target[name]}`);
    assert.ok(rec.peakDbfs[name] < -0.55, `${name} 최대 ${rec.peakDbfs[name]}`);
  }
});
