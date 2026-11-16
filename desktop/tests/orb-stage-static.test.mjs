// WebGL도 2D 캔버스도 없을 때의 정적 구(11-16 토큰 세션 전달 — 지금 얼굴의 정적 구와 같은 약속).
// 그리기가 캔버스에 static을 적고 구의 자리 · 크기 · 빛을 CSS 변수로 넘겨, CSS가 어느 단계에서도 같은 자리에 구를 그린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createOrbStage } from '../renderer/orb-stage.mjs';

function fakeCanvas() {
  const frames = [], props = {};
  const win = { devicePixelRatio: 1, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => 1000 } };
  const host = { getBoundingClientRect: () => ({ width: 1200, height: 800 }) };
  const canvas = {
    ownerDocument: { defaultView: win }, parentElement: host, parentNode: host, dataset: {}, width: 0, height: 0,
    style: { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: k => props[k] || '' },
    getContext: () => null, addEventListener() {}, removeEventListener() {},
  };
  return { canvas, frames, props };
}
const px = v => parseFloat(v);

test('with neither WebGL nor a 2D canvas the stage marks static and hands the orb to CSS in every pose', () => {
  const { canvas, frames, props } = fakeCanvas();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 40 }) });
  try {
    assert.equal(canvas.dataset.orbMode, 'static');
    stage.snap('ask');
    frames.shift()?.(1100);
    const ask = { x: px(props['--orb-sx']), y: px(props['--orb-sy']), r: px(props['--orb-sr']) };
    assert.ok(ask.r > 40 && ask.x > 500 && ask.y > 0, JSON.stringify(props));
    assert.match(props['--orb-ring'], /^rgba\(243,241,236,/);
    // 들어온 뒤의 작은 구(배정된 공간이 열리기를 기다리는 동안도 이 자세다)도 사라지지 않는다
    stage.snap('home');
    frames.shift()?.(1200);
    assert.ok(px(props['--orb-sr']) > 0 && px(props['--orb-sr']) < ask.r, JSON.stringify(props));
  } finally { stage.dispose(); }
});

test('the static orb CSS draws from those variables', () => {
  const css = fs.readFileSync(new URL('../renderer/orb-face.css', import.meta.url), 'utf8');
  assert.match(css, /\.orb-canvas\[data-orb-mode="static"\]\{background:radial-gradient\(circle var\(--orb-sr,0px\) at var\(--orb-sx,50%\) var\(--orb-sy,50%\)/);
});
