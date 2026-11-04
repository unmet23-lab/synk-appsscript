import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, RIGHT, N, rightSound } from './sfx.mjs';

const penta = new Set(Object.values(N));
const check = (name, layers) => {
  for (const l of layers) {
    assert.ok((l.t || 0) + l.d <= 0.4 + 1e-9, `${name}: 400ms 넘음`);
    if (l.noise) continue;
    assert.ok(penta.has(l.f), `${name}: 펜타토닉 밖 ${l.f}`);
    assert.ok(l.f >= N.C4, `${name}: C4 아래`);
    assert.ok(['sine', 'triangle'].includes(l.type), `${name}: ${l.type}`);
  }
};
test('소리마다 400ms 이하 · 펜타토닉 · 사인/트라이앵글', () => { for (const [n, l] of Object.entries(SOUNDS)) check(n, l); RIGHT.forEach((_, i) => check(`right${i}`, rightSound(i))); });
test('맞음은 연속일수록 오르고 천장이 있다', () => { for (let i = 1; i < RIGHT.length; i += 1) assert.ok(RIGHT[i][0] > RIGHT[i - 1][0]); assert.deepEqual(rightSound(99)[0].f, RIGHT.at(-1)[0]); });
test('틀림 소리에 내려가는 음이 없다', () => { const tones = SOUNDS.scene.filter((l) => l.f); assert.ok(tones.length <= 1); });
