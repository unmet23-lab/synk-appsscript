// 사운드킷 셋째 가족 규칙(sfx.mjs 머리): 길이 400ms 이하 · 사인/트라이앵글 · C 펜타토닉 · 실패음에 내려가는 음 없음. 고양이는 합성 흉내라 길이만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, LEVEL, N, createBus, renderSfx, softLimit } from './sfx.mjs';

function fakeContext() {
  const oscillators = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  return {
    sampleRate: 8000, currentTime: 0, destination: node(), oscillators,
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ frequency: param(), Q: param(), type: 'lowpass' }),
    createBuffer: (_, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => node({ start() {}, stop() {}, buffer: null }),
    createOscillator() {
      const seen = [], o = node({ type: 'sine', start() {}, stop() {}, frequency: { value: 0, setValueAtTime: (f) => seen.push(f), exponentialRampToValueAtTime: (f) => seen.push(f) } });
      oscillators.push({ get type() { return o.type; }, seen }); return o;
    },
  };
}
const PENTA = new Set(['C', 'D', 'E', 'G', 'A']);
const noteName = (f) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12];

for (const name of Object.keys(SOUNDS)) {
  test(`${name}: 400ms 안 · 음계 안 · 크기가 정해져 있다`, () => {
    const c = fakeContext(), bus = createBus(c), end = renderSfx(bus, name, 0, { step: 2 });
    assert.ok(end > 0 && end <= 0.4, `${name} ${end}`);
    assert.ok(LEVEL[name] > 0, name);
    if (name === 'meow') return;
    for (const o of c.oscillators) {
      assert.ok(['sine', 'triangle'].includes(o.type), `${name} ${o.type}`);
      for (const f of o.seen) assert.ok(PENTA.has(noteName(f)), `${name} ${f} ${noteName(f)}`);
    }
  });
}

test('다르게 찍은 소리에 내려가는 음이 없다', () => {
  for (const name of ['other', 'soft', 'nope']) {
    const c = fakeContext(); renderSfx(createBus(c), name, 0);
    for (const o of c.oscillators) for (let i = 1; i < o.seen.length; i += 1) assert.ok(o.seen[i] >= o.seen[i - 1], name);
  }
});

test('리미터는 0.93을 넘지 않고 작은 소리는 그대로다', () => {
  assert.equal(softLimit(0.3), 0.3);
  assert.ok(softLimit(5) <= 0.93 && softLimit(-5) >= -0.93);
  assert.ok(N.C4 > 200);
});
